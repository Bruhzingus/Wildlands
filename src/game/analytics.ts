import {getSpecies,type Element} from '../data/kanto.ts';
import {getAttackProfile} from '../data/attacks.ts';
import {getSpecialProfile} from '../data/specials.ts';
import {getLearnedMoveProfile,learnedMovePower} from '../data/moves.ts';
import {getItemDefinition} from '../data/items.ts';
import {PROGRESSION,levelPowerMultiplier} from '../data/progression.ts';
import {getBuildModifiers,getBuildSummary,itemStacks} from './systems/builds.ts';
import {enemyProgressionScale,lateEnemyScale} from './systems/spawning.ts';
import {attackInterval} from './combat/cadence.ts';
import type {Enemy,PartyMember,RunState,UpgradeChoice,Variant} from './types.ts';

export const ANALYTICS_LIMITS={sources:2048,recentHits:80,faints:100,acquisitions:20000,minutes:1440} as const;
export type DamageOrigin='signature'|'learned'|'q'|'proc'|'status'|'enemy'|'environment'|'self'|'unknown';
/** A value captured when the attack is made, never a reference to a live actor. */
export interface DamageSource {
 origin:DamageOrigin;actorId?:number;speciesId?:number;name:string;move:string;element?:Element;
 variant?:Variant;bossStage?:number;effectId?:string;status?:string;rootOrigin?:DamageOrigin;
}
export interface DamageTotals {effective:number;attempted:number;mitigated:number;overkill:number;hits:number;kills:number;preCritical:number;postCritical:number;criticalHits:number;maxCriticalTier:number;}
export interface DamageRow extends DamageTotals {key:string;source:DamageSource;recipient?:{uid:number;speciesId:number;leader:boolean};}
export interface RecentDamage {at:number;direction:'outgoing'|'incoming';source:DamageSource;recipient?:DamageRow['recipient'];effective:number;attempted:number;criticalTier:number;hpAfter:number;}
export interface Acquisition {order:number;at:number;kind:string;id:string;title:string;memberUid?:number;speciesId?:number;rarity?:string;rank?:number;amount?:number;source?:string;}
export interface FaintRecord {at:number;uid:number;speciesId:number;name:string;source:DamageSource;member:PartyMember;}
export interface MinuteSample {
 at:number;observedAt:number;windowSeconds:number;dps:{beforeCrits:number;afterCrits:number;withAbility:number;effective:number};
 cumulative:{outgoing:DamageTotals;incoming:DamageTotals};leaderHp:number;leaderMaxHp:number;kills:number;coins:number;
 build:ReturnType<typeof analyticsBuild>;enemies:ReturnType<typeof analyticsEnemies>;director:RunState['director'];
 spawn:{scheduledPerSecond:number;accepted:number;denied:number;acceptedPerSecond:number};
}
export interface RunAnalytics {
 version:1;startedAt:number;outgoing:DamageTotals;incoming:DamageTotals;leaderIncoming:DamageTotals;followerIncoming:DamageTotals;
 sources:DamageRow[];recentHits:RecentDamage[];faints:FaintRecord[];acquisitions:Acquisition[];acquisitionCount:number;minutes:MinuteSample[];
 nextMinute:number;windowStartedAt:number;window:{preCritical:number;postCritical:number;withAbility:number;effective:number};
 observedItems:Record<string,number>;dropped:{sources:number;acquisitions:number;minutes:number;faints:number};
 lastDirectorSpawned:number;lastDirectorDenied:number;
}
const zero=():DamageTotals=>({effective:0,attempted:0,mitigated:0,overkill:0,hits:0,kills:0,preCritical:0,postCritical:0,criticalHits:0,maxCriticalTier:0});
const safe=(value:number)=>Math.max(0,Number.isNaN(value)?0:Math.min(Number.MAX_VALUE,value));
const sum=(a:number,b:number)=>safe(a+b);
export function unknownDamageSource(move='Unknown source'):DamageSource{return {origin:'unknown',name:'Unknown source',move};}
export function partyDamageSource(state:RunState,sourceUid:number|undefined,move?:string,origin:DamageOrigin='signature',element?:Element):DamageSource {
 const member=state.party.find(candidate=>candidate.uid===sourceUid);
 if(!member)return {...unknownDamageSource(move),actorId:sourceUid,element};
 const species=getSpecies(member.speciesId);
 return {origin,actorId:member.uid,speciesId:member.speciesId,name:species.name,move:move??species.moveName,element:element??species.types[0],rootOrigin:origin};
}
export function enemyDamageSource(enemy:Enemy|undefined,move?:string,element?:Element):DamageSource {
 if(!enemy)return unknownDamageSource(move);
 return {origin:'enemy',speciesId:enemy.speciesId,name:getSpecies(enemy.speciesId).name,move:move??enemy.windup?.moveName??'Contact',variant:enemy.variant,bossStage:enemy.isBoss?(enemy.bossStage??0)+1:undefined,element,actorId:enemy.uid};
}
export function statusDamageSource(source:DamageSource|undefined,status:string):DamageSource {
 return {...(source??unknownDamageSource()),origin:'status',rootOrigin:source?.rootOrigin??source?.origin??'unknown',status,move:`${status} (${source?.move??'unknown source'})`,element:status==='burn'?'fire':status==='poison'?'poison':source?.element};
}
export function initializeAnalytics(state:RunState):RunAnalytics {
 if(state.analytics)return state.analytics;
 const a:RunAnalytics={version:1,startedAt:state.stats.elapsed,outgoing:zero(),incoming:zero(),leaderIncoming:zero(),followerIncoming:zero(),sources:[],recentHits:[],faints:[],acquisitions:[],acquisitionCount:0,minutes:[],nextMinute:(Math.floor(state.stats.elapsed/60)+1)*60,windowStartedAt:state.stats.elapsed,window:{preCritical:0,postCritical:0,withAbility:0,effective:0},observedItems:{},dropped:{sources:0,acquisitions:0,minutes:0,faints:0},lastDirectorSpawned:state.director?.spawned??0,lastDirectorDenied:state.director?.denied??0};
 state.analytics=a;return a;
}
export interface DamageObservation {
 direction:'outgoing'|'incoming';source?:DamageSource;recipient?:DamageRow['recipient'];attempted:number;applied:number;beforeHp:number;afterHp:number;
 criticalTier?:number;preCritical?:number;hitCount?:number;killed?:boolean;
}
function addTotals(total:DamageTotals,hit:DamageTotals){for(const key of Object.keys(hit) as (keyof DamageTotals)[])total[key]=key==='maxCriticalTier'?Math.max(total[key],hit[key]):sum(total[key],hit[key]);}
export function recordDamage(state:RunState,event:DamageObservation):void {
 const a=state.analytics;if(!a)return;
 const source={...(event.source??unknownDamageSource())},attempted=safe(event.attempted),applied=safe(event.applied),effective=Math.min(Math.max(0,event.beforeHp),Math.max(0,event.beforeHp-Math.max(0,event.afterHp)));
 const tier=event.criticalTier??0,hit:DamageTotals={effective,attempted,mitigated:Math.max(0,attempted-applied),overkill:Math.max(0,applied-Math.max(0,event.beforeHp)),hits:event.hitCount??1,kills:event.killed?1:0,preCritical:safe(event.preCritical??attempted),postCritical:attempted,criticalHits:tier>0?(event.hitCount??1):0,maxCriticalTier:tier};
 addTotals(a[event.direction],hit);
 if(event.direction==='incoming')addTotals(event.recipient?.leader?a.leaderIncoming:a.followerIncoming,hit);
 // Enemy instance IDs never create new aggregate keys; member identity remains meaningful.
 const actor=event.direction==='outgoing'?source.actorId:undefined;
 const key=JSON.stringify([event.direction,source.origin,actor,source.speciesId,source.variant,source.bossStage,source.move,source.effectId,source.status,source.element,event.recipient?.uid]);
 let row=a.sources.find(candidate=>candidate.key===key);
 if(!row){
  if(a.sources.length<ANALYTICS_LIMITS.sources){row={...zero(),key,source,...(event.recipient?{recipient:{...event.recipient}}:{})};a.sources.push(row);}
  else {a.dropped.sources++;const overflowKey=`${event.direction}:overflow:${event.recipient?.leader?'leader':'other'}`;row=a.sources.find(candidate=>candidate.key===overflowKey);if(!row){row={...zero(),key:overflowKey,source:unknownDamageSource('Additional sources (aggregation limit)'),recipient:event.recipient?{...event.recipient}:undefined};a.sources.push(row);}}
 }
 addTotals(row,hit);
 if(effective>0){
  a.recentHits.push({at:state.stats.elapsed,direction:event.direction,source,recipient:event.recipient?{...event.recipient}:undefined,effective,attempted,criticalTier:tier,hpAfter:Math.max(0,event.afterHp)});
  if(a.recentHits.length>ANALYTICS_LIMITS.recentHits){
   // Reserve half the window for each direction, so high DPS cannot hide the final incoming sequence.
   const count=a.recentHits.filter(hit=>hit.direction===event.direction).length;
   const index=a.recentHits.findIndex(hit=>count>ANALYTICS_LIMITS.recentHits/2?hit.direction===event.direction:hit.direction!==event.direction);
   a.recentHits.splice(Math.max(0,index),1);
  }
 }
 if(event.direction==='outgoing'){
  const ability=source.rootOrigin==='q'||source.origin==='q';
  if(!ability){a.window.preCritical=sum(a.window.preCritical,hit.preCritical);a.window.postCritical=sum(a.window.postCritical,attempted);}
  a.window.withAbility=sum(a.window.withAbility,attempted);a.window.effective=sum(a.window.effective,effective);
 }
}
export function recordFaint(state:RunState,member:PartyMember,source?:DamageSource):void {
 const a=state.analytics;if(!a)return;
 if(a.faints.length===ANALYTICS_LIMITS.faints){a.faints.shift();a.dropped.faints++;}
 const recent=[...a.recentHits].reverse().find(hit=>hit.direction==='incoming'&&hit.recipient?.uid===member.uid);
 a.faints.push({at:state.stats.elapsed,uid:member.uid,speciesId:member.speciesId,name:getSpecies(member.speciesId).name,source:{...(source??recent?.source??unknownDamageSource())},member:structuredClone(member)});
}
export function recordAcquisition(state:RunState,choice:UpgradeChoice,memberUid?:number):void {
 const a=state.analytics;if(!a)return;
 const member=state.party.find(candidate=>candidate.uid===(memberUid??(choice.kind==='recruit'?undefined:choice.speciesId)));
 a.acquisitionCount++;
 if(a.acquisitions.length<ANALYTICS_LIMITS.acquisitions)a.acquisitions.push({order:a.acquisitionCount,at:state.stats.elapsed,kind:choice.kind,id:choice.id,title:choice.title,memberUid:member?.uid,speciesId:member?.speciesId,rarity:choice.rarity,rank:choice.rank,amount:choice.amount,source:state.choiceSource});
 else a.dropped.acquisitions++;
 if(choice.kind==='item')a.observedItems[choice.id]=itemStacks(state,choice.id);
}
export function analyticsBuild(state:RunState){
 return {items:state.items.map(id=>({id,title:getItemDefinition(id)?.title??id,stacks:itemStacks(state,id),ownerUid:state.build?.itemOwners?.[id]})),buffs:{...state.buffs},trainingRanks:{...state.trainingRanks},synergies:getBuildSummary(state).synergies,
  party:state.party.map((member,index)=>({uid:member.uid,speciesId:member.speciesId,name:getSpecies(member.speciesId).name,joinedAt:member.joinedAt,evolvedAt:member.evolvedAt,leader:index===0,level:member.level,xp:member.xp,hp:index===0?state.player.hp:member.hp,maxHp:index===0?state.player.maxHp:member.maxHp,attackLevel:member.attackLevel,learnedMoves:member.learnedMoves?.map(move=>({...move})),trainingBuffs:{...member.trainingBuffs},trainingRanks:{...member.trainingRanks},modifiers:{...getBuildModifiers(state,member)}})),estimatedDps:estimatedBuildDps(state)};
}
/** Single-target connected casts; excludes extra projectiles, procs, statuses and target mitigation. */
export function estimatedBuildDps(state:RunState){
 let beforeCrits=0,afterCrits=0,q=0;
 for(const [index,member] of state.party.entries()){
  if((index===0?state.player.hp:member.hp)<=0)continue;
  const mod=getBuildModifiers(state,member),profile=getAttackProfile(member.speciesId,member.attackLevel),whole=Math.floor(mod.critChance),fraction=mod.critChance-whole;
  const expectedCrit=Math.pow(mod.critDamage,whole)*(1-fraction+fraction*mod.critDamage);
  const primary=(getSpecies(member.speciesId).power+9)*levelPowerMultiplier(member.level)*(1+PROGRESSION.moves.damagePerRank*Math.max(0,member.attackLevel-1))*(1+mod.power);
  let dps=profile.kind==='heal'?0:primary*profile.damageScale/attackInterval(profile.cooldown,mod.haste,member.attackLevel);
  for(const learned of member.learnedMoves??[]){const move=getLearnedMoveProfile(learned.moveId,learned.rank);if(move.kind!=='heal')dps+=learnedMovePower(learned.moveId,learned.rank)*levelPowerMultiplier(member.level)*(1+mod.power)*move.damageScale/attackInterval(move.cooldown,mod.haste);}
  beforeCrits+=dps;afterCrits+=dps*expectedCrit;
  if(index===0){const special=getSpecialProfile(member.speciesId,member.attackLevel);q=(32+(member.attackLevel-1)*2)*levelPowerMultiplier(member.level)*(1+mod.power)*(1+mod.specialPower)*special.damageScale*Math.max(1,special.pulses)/(special.cooldown/(1+mod.specialHaste));}
 }
 return {beforeCrits:safe(beforeCrits),afterCrits:safe(afterCrits),withAbility:safe(afterCrits+q),ability:safe(q),assumptions:'Single-target connected casts at current stats; Q used on cooldown; excludes extra projectiles, relic procs, status damage, target matchup and travel. Use observed DPS for actual output.'};
}
export function analyticsEnemies(state:RunState){
 const groups=new Map<string,{speciesId:number;name:string;variant:Variant;tier:number;bossStage?:number;count:number;hpMin:number;hpMax:number;damageMin:number;damageMax:number;speedMin:number;speedMax:number;lateScale:{health:number;damage:number}}>();
 for(const enemy of state.enemies){if(enemy.dead)continue;const key=`${enemy.speciesId}/${enemy.variant}/${enemy.combatTier}/${enemy.bossStage}`;let row=groups.get(key);if(!row){row={speciesId:enemy.speciesId,name:getSpecies(enemy.speciesId).name,variant:enemy.variant,tier:enemy.combatTier??1,bossStage:enemy.isBoss?(enemy.bossStage??0)+1:undefined,count:0,hpMin:enemy.maxHp,hpMax:enemy.maxHp,damageMin:enemy.damage,damageMax:enemy.damage,speedMin:enemy.speed,speedMax:enemy.speed,lateScale:lateEnemyScale(state.stats.elapsed,enemy.speciesId,enemy.combatTier??1)};groups.set(key,row);}row.count++;row.hpMin=Math.min(row.hpMin,enemy.maxHp);row.hpMax=Math.max(row.hpMax,enemy.maxHp);row.damageMin=Math.min(row.damageMin,enemy.damage);row.damageMax=Math.max(row.damageMax,enemy.damage);row.speedMin=Math.min(row.speedMin,enemy.speed);row.speedMax=Math.max(row.speedMax,enemy.speed);}
 return {alive:[...groups.values()],progressionScale:enemyProgressionScale(state)};
}
function makeSample(state:RunState,at:number):MinuteSample {
 const a=state.analytics!,seconds=Math.max(.001,state.stats.elapsed-a.windowStartedAt);
 const accepted=Math.max(0,(state.director?.spawned??0)-a.lastDirectorSpawned),denied=Math.max(0,(state.director?.denied??0)-a.lastDirectorDenied);
 return {at,observedAt:state.stats.elapsed,windowSeconds:seconds,dps:{beforeCrits:a.window.preCritical/seconds,afterCrits:a.window.postCritical/seconds,withAbility:a.window.withAbility/seconds,effective:a.window.effective/seconds},cumulative:{outgoing:{...a.outgoing},incoming:{...a.incoming}},leaderHp:state.player.hp,leaderMaxHp:state.player.maxHp,kills:state.stats.kills,coins:state.coins??0,build:analyticsBuild(state),enemies:analyticsEnemies(state),director:state.director?structuredClone(state.director):undefined,spawn:{scheduledPerSecond:state.director?state.director.batchSize/state.director.spawnInterval:0,accepted,denied,acceptedPerSecond:accepted/seconds}};
}
export function observeAnalytics(state:RunState):void {
 const a=state.analytics;if(!a)return;
 for(const id of new Set(state.items)){const count=itemStacks(state,id),previous=a.observedItems[id]??0;for(let i=previous;i<count;i++)recordAcquisition(state,{id,kind:'item',title:getItemDefinition(id)?.title??id,description:'',rarity:getItemDefinition(id)?.rarity??'common'});a.observedItems[id]=count;}
 if(state.stats.elapsed+1e-7>=a.nextMinute){
  if(a.minutes.length===ANALYTICS_LIMITS.minutes){a.minutes.shift();a.dropped.minutes++;}
  a.minutes.push(makeSample(state,a.nextMinute));a.nextMinute=(Math.floor(state.stats.elapsed/60)+1)*60;a.windowStartedAt=state.stats.elapsed;a.window={preCritical:0,postCritical:0,withAbility:0,effective:0};a.lastDirectorSpawned=state.director?.spawned??0;a.lastDirectorDenied=state.director?.denied??0;
 }
}
export function runAnalyticsReport(state:RunState){
 const a=state.analytics;
 const outgoing=(a?.sources??[]).filter(row=>row.key.startsWith('["outgoing"')||row.key.startsWith('outgoing:')).sort((x,y)=>y.effective-x.effective);
 const incoming=(a?.sources??[]).filter(row=>row.key.startsWith('["incoming"')||row.key.startsWith('incoming:')).sort((x,y)=>y.effective-x.effective);
 return structuredClone({format:'wildlands-balancing-report',version:1,gameVersion:'0.3.0',seed:state.seed,mapId:state.mapId??'wildlands',challenge:state.challenge??'standard',phase:state.phase,result:state.result,elapsed:state.stats.elapsed,stats:{...state.stats},
  definitions:{effective:'Actual HP removed, clamped to HP available. Default ranking measure.',attempted:'Resolved damage before armor, invulnerability, stage gates and overkill. Outgoing includes elemental matchup and metronome.',mitigated:'Attempted minus post-mitigation damage. Includes armor, immunity/iframes/deflection and boss stage gates.',overkill:'Post-mitigation damage exceeding available HP.',observedDps:'Damage attempted per second in each elapsed minute; before/after crits exclude Q and Q-caused statuses/procs; withAbility includes all outgoing damage. Final partial window is separate.',statusOwnership:'Each status refresh is credited to its latest successful applier; burn and poison keep independent ownership.',enemyStats:'Actual live enemy max HP/contact damage/speed ranges at sample time; move multipliers are additional.',acquisitions:'Ordered successful choices plus directly granted items; automatic level and XP progression are included in minute build snapshots.'},
  totals:{outgoing:a?.outgoing??zero(),incoming:a?.incoming??zero(),leaderIncoming:a?.leaderIncoming??zero(),followerIncoming:a?.followerIncoming??zero()},outgoing,incoming,recentHits:a?.recentHits??[],faints:a?.faints??[],acquisitions:a?.acquisitions??[],minuteSamples:a?.minutes??[],finalPartialWindow:a?makeSample(state,state.stats.elapsed):undefined,build:analyticsBuild(state),enemies:analyticsEnemies(state),director:state.director,position:{x:state.player.x,z:state.player.z},sites:state.pois.map(poi=>({uid:poi.uid,kind:poi.kind,x:poi.x,z:poi.z,used:poi.used,respawnAt:poi.respawnAt,availableAt:poi.availableAt,shrineTier:poi.shrineTier,price:poi.price,rarity:poi.rarity})),limits:ANALYTICS_LIMITS,dropped:a?.dropped??{sources:0,acquisitions:0,minutes:0,faints:0}});
}
