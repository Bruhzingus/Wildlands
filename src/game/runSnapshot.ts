import {ELEMENT_COLORS} from '../data/kanto.ts';
import {getItemDefinition} from '../data/items.ts';
import {getMoveDefinition} from '../data/moves.ts';
import {MAP_DEFINITIONS} from '../data/maps.ts';
import {CHALLENGE_DEFINITIONS} from '../data/challenges.ts';
import {OPTIONAL_CHALLENGES} from '../data/optionalChallenges.ts';
import {BERRIES} from '../data/berries.ts';
import type {RunPhase,RunState} from './types.ts';
import type {NavigationSnapshot} from './systems/navigation.ts';

export const SNAPSHOT_VERSION=1;
export const SUSPENDED_RUN_VERSION=1;
export const RUN_FILE_MAX_BYTES=12_000_000;
export const SUSPEND_REWIND_SECONDS=30;
export const REWIND_CHECKPOINT_SECONDS=1;
export const REWIND_CHECKPOINT_LIMIT=33;
type SerializedHit<T extends {hit:Set<number>}>=Omit<T,'hit'>&{hit:number[]};
export type SerializedRunState=Omit<RunState,'projectiles'|'psychicRings'|'activeSpecials'>&{
 projectiles:SerializedHit<RunState['projectiles'][number]>[];
 psychicRings?:SerializedHit<NonNullable<RunState['psychicRings']>[number]>[];
 activeSpecials?:SerializedHit<NonNullable<RunState['activeSpecials']>[number]>[];
};
export interface SimulationSnapshot {
 version:1;state:SerializedRunState;metadata:Record<string,unknown>;
 bookkeeping:{rng:number;lootRng:number;spawnAccum:number;statusOwners:Array<[number,number]>;
  velocity:{x:number;z:number};dodgeDirection:{x:number;z:number};walking:boolean;rewardsDeferred:boolean;
  navigation:NavigationSnapshot;resumePhase:RunPhase;};
}
export interface SuspendedRunMetadata {
 runId:string;starterId:number;rocketKills:number;victoryRecorded:boolean;finished?:boolean;
 savedElapsed?:number;rewoundSeconds?:number;[key:string]:unknown;
}
export interface SuspendedRunFile {format:'wildlands-suspended-run';version:1;snapshot:SimulationSnapshot;metadata:SuspendedRunMetadata;}
export type RunFileResult={ok:true;file:SuspendedRunFile}|{ok:false;error:string};

/** Explicit set conversion keeps the on-disk schema ordinary JSON. */
export function serializeRunState(state:RunState):SerializedRunState {
 const cloned=structuredClone(state);
 return {...cloned,projectiles:cloned.projectiles.map(value=>({...value,hit:[...value.hit]})),
  ...(cloned.psychicRings?{psychicRings:cloned.psychicRings.map(value=>({...value,hit:[...value.hit]}))}:{}),
  ...(cloned.activeSpecials?{activeSpecials:cloned.activeSpecials.map(value=>({...value,hit:[...value.hit]}))}:{})} as SerializedRunState;
}
export function deserializeRunState(state:SerializedRunState):RunState {
 const cloned=structuredClone(state);
 return {...cloned,projectiles:cloned.projectiles.map(value=>({...value,hit:new Set(value.hit)})),
  ...(cloned.psychicRings?{psychicRings:cloned.psychicRings.map(value=>({...value,hit:new Set(value.hit)}))}:{}),
  ...(cloned.activeSpecials?{activeSpecials:cloned.activeSpecials.map(value=>({...value,hit:new Set(value.hit)}))}:{})} as RunState;
}
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)!==Set.prototype&&Object.getPrototypeOf(value)!==Map.prototype;
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const integer=(value:unknown):value is number=>finite(value)&&Number.isSafeInteger(value);
const positiveId=(value:unknown)=>integer(value)&&value>0;
const species=(value:unknown)=>integer(value)&&value>=1&&value<=151;
const text=(value:unknown)=>typeof value==='string'&&value.length<=8192;
const numbers=(value:Record<string,unknown>,keys:readonly string[])=>keys.every(key=>finite(value[key]));
const booleans=(value:Record<string,unknown>,keys:readonly string[])=>keys.every(key=>typeof value[key]==='boolean');
const records=(value:unknown,max=10000):value is Record<string,unknown>[]=>Array.isArray(value)&&value.length<=max&&value.every(object);
const ids=(value:unknown,max=10000):value is number[]=>Array.isArray(value)&&value.length<=max&&value.every(integer)&&new Set(value).size===value.length;
const numericRecord=(value:unknown)=>object(value)&&Object.values(value).every(finite);
const oneOf=(value:unknown,options:readonly string[])=>typeof value==='string'&&options.includes(value);
const optional=(value:Record<string,unknown>,key:string,validate:(candidate:unknown)=>boolean)=>value[key]===undefined||validate(value[key]);
const optionalNumbers=(value:Record<string,unknown>,keys:readonly string[])=>keys.every(key=>optional(value,key,finite));
const optionalBooleans=(value:Record<string,unknown>,keys:readonly string[])=>keys.every(key=>optional(value,key,candidate=>typeof candidate==='boolean'));
const vector=(value:unknown)=>object(value)&&numbers(value,['x','z']);
const own=(dictionary:object,value:unknown)=>typeof value==='string'&&Object.hasOwn(dictionary,value);
const attacks=['bolt','burst','slash','aura','chain','beam','lob','heal'];
const phases=['title','playing','choice','paused','boss','result'];
const origins=['signature','learned','q','proc','status','enemy','environment','self','unknown'];
const variants=['normal','dark','rocket','rabid','poisoned','legendary'];
const totalFields=['effective','attempted','mitigated','overkill','hits','kills','preCritical','postCritical','criticalHits','maxCriticalTier'];
function validDamageSource(value:unknown):boolean {
 return object(value)&&oneOf(value.origin,origins)&&text(value.name)&&text(value.move)&&optional(value,'actorId',integer)&&optional(value,'speciesId',species)&&optional(value,'element',element=>own(ELEMENT_COLORS,element))&&optional(value,'variant',variant=>oneOf(variant,variants))&&optional(value,'rootOrigin',origin=>oneOf(origin,origins));
}
const totals=(value:unknown)=>object(value)&&numbers(value,totalFields)&&totalFields.every(key=>(value[key] as number)>=0);
const recipient=(value:unknown)=>object(value)&&positiveId(value.uid)&&species(value.speciesId)&&typeof value.leader==='boolean';
function validAnalytics(value:unknown):boolean {
 if(!object(value)||value.version!==1||!numbers(value,['startedAt','acquisitionCount','nextMinute','windowStartedAt']))return false;
 if(!['outgoing','incoming','leaderIncoming','followerIncoming'].every(key=>totals(value[key]))||!numericRecord(value.observedItems))return false;
 if(!object(value.window)||!numbers(value.window,['preCritical','postCritical','withAbility','effective'])||!object(value.dropped)||!numbers(value.dropped,['sources','acquisitions','minutes','faints']))return false;
 if(!records(value.sources,2060)||!value.sources.every(row=>totals(row)&&text(row.key)&&validDamageSource(row.source)&&optional(row,'recipient',recipient)))return false;
 if(!records(value.recentHits,80)||!value.recentHits.every(hit=>numbers(hit,['at','effective','attempted','criticalTier','hpAfter'])&&oneOf(hit.direction,['outgoing','incoming'])&&validDamageSource(hit.source)&&optional(hit,'recipient',recipient)))return false;
 if(!records(value.faints,100)||!value.faints.every(faint=>numbers(faint,['at','uid'])&&species(faint.speciesId)&&text(faint.name)&&validDamageSource(faint.source)))return false;
 if(!records(value.acquisitions,20000)||!value.acquisitions.every(entry=>numbers(entry,['order','at'])&&text(entry.kind)&&text(entry.id)&&text(entry.title)))return false;
 if(!records(value.minutes,1440))return false;
 for(const sample of value.minutes){
  if(!numbers(sample,['at','observedAt','windowSeconds','leaderHp','leaderMaxHp','kills','coins'])||!object(sample.dps)||!numbers(sample.dps,['beforeCrits','afterCrits','withAbility','effective'])||!object(sample.cumulative)||!totals(sample.cumulative.outgoing)||!totals(sample.cumulative.incoming))return false;
  if(!object(sample.build)||!records(sample.build.items,10000)||!records(sample.build.party,6)||!object(sample.enemies)||!records(sample.enemies.alive,2048))return false;
 }
 return true;
}

/** Bound hostile imports before inspecting the domain schema. Unknown optional analytics
 * fields are retained, but executable values, prototypes and nonfinite numbers are not. */
function boundedData(value:unknown):boolean {
 let nodes=0;const seen=new Set<object>();
 const visit=(entry:unknown,depth:number):boolean=>{
  if(++nodes>1000000||depth>40)return false;
  if(entry===null||entry===undefined||typeof entry==='boolean')return true;
  if(typeof entry==='number')return Number.isFinite(entry);
  if(typeof entry==='string')return entry.length<=8192;
  if(typeof entry!=='object'||seen.has(entry))return false;
  seen.add(entry);
  if(Array.isArray(entry)){const valid=entry.length<=50000&&entry.every(child=>visit(child,depth+1));seen.delete(entry);return valid;}
  const prototype=Object.getPrototypeOf(entry);if(prototype!==Object.prototype&&prototype!==null)return false;
  const entries=Object.entries(entry),valid=entries.length<=4096&&entries.every(([key,child])=>key.length<=256&&!['__proto__','prototype','constructor'].includes(key)&&visit(child,depth+1));seen.delete(entry);return valid;
 };
 return visit(value,0);
}
function validState(candidate:unknown):candidate is SerializedRunState {
 if(!object(candidate))return false;const s=candidate;
 if(!oneOf(s.phase,phases)||!(s.result===null||s.result==='victory'||s.result==='defeat')||!integer(s.seed))return false;
 if(!object(s.player)||!numbers(s.player,['x','z','y','vy','facing','hp','maxHp','iframes','poisonTime','dodgeTime','dodgeCooldown','specialCooldown','specialCharge'])||!finite(s.player.maxHp)||s.player.maxHp<=0)return false;
 if(!optionalNumbers(s.player,['aimFacing','dodgeCharges','burrowTime']))return false;
 if(!optional(s.player,'poisonSource',validDamageSource)||!optional(s.player,'movement',value=>object(value)&&species(value.speciesId)&&numbers(value,['straightTime','heading','boost','holdTime','flightRemaining','flightCooldown'])&&booleans(value,['flightEligible','flightUsed','flying'])))return false;
 if(!records(s.party,6)||s.party.length<1||!ids(s.party.map(member=>member.uid),6))return false;
 for(const member of s.party){
  if(!positiveId(member.uid)||!species(member.speciesId)||!numbers(member,['joinedAt','level','hp','maxHp','iframes','attackLevel','cooldown','x','z','facing','attackTimer'])||!finite(member.maxHp)||member.maxHp<=0||!oneOf(member.animation,['idle','walk','attack']))return false;
  if(!optional(member,'learnedMoves',value=>records(value,16)&&value.every(move=>typeof move.moveId==='string'&&!!getMoveDefinition(move.moveId)&&numbers(move,['rank','cooldown']))))return false;
  for(const key of ['trainingBuffs','trainingRanks'])if(!optional(member,key,numericRecord))return false;
  if(!optional(member,'poisonSource',validDamageSource))return false;
  if(!optionalNumbers(member,['xp','xpToNext','attackDuration','evolvedAt','poisonTime','evolutionPower','specialCooldown']))return false;
 }
 if(!records(s.enemies,2048)||!ids(s.enemies.map(enemy=>enemy.uid),2048))return false;
 for(const enemy of s.enemies){
  if(!positiveId(enemy.uid)||!species(enemy.speciesId)||!oneOf(enemy.variant,['normal','dark','rocket','rabid','poisoned','legendary'])||!numbers(enemy,['x','z','hp','maxHp','speed','damage','size','facing','attackTimer','hitCooldown','attackCooldown','poisonTime','burnTime','slowTime','soakedTime','stunTime'])||!booleans(enemy,['elite','dead','isBoss'])||!oneOf(enemy.animation,['idle','walk','attack']))return false;
  if(!optional(enemy,'windup',value=>object(value)&&numbers(value,['remaining','duration','x','z','facing'])&&oneOf(value.kind,['volley','slam','psychicRing','summon','enemyMove'])))return false;
  if(!optional(enemy,'lastDamageSource',validDamageSource)||!optional(enemy,'statusSources',value=>object(value)&&Object.entries(value).every(([key,source])=>oneOf(key,['burn','poison'])&&validDamageSource(source))))return false;
  if(!optionalNumbers(enemy,['attackDuration','bossCycle','bossStage','challengeSiteId','combatTier','attackIndex','shrineXPScale'])||!optionalBooleans(enemy,['shrineGuardian','landmarkGuardian','hardShrine']))return false;
 }
 if(!records(s.projectiles,10000))return false;
 for(const p of s.projectiles){
  if(!positiveId(p.uid)||!numbers(p,['x','z','prevX','prevZ','vx','vz','ttl','damage','size','penetration','sourceId','poisonChance'])||typeof p.friendly!=='boolean'||!oneOf(p.kind,attacks)||!own(ELEMENT_COLORS,p.type)||!ids(p.hit)||!optional(p,'damageSource',validDamageSource))return false;
  if(!optionalNumbers(p,['targetId','radius','blastX','blastZ','duration','warningDuration','hitCount','critTier','turnRate','splashRadius','knockback','bounces','bounceRange','orbitCenterX','orbitCenterZ','orbitAngle','orbitRadius','orbitSpeed','criticalMultiplier'])||!optionalBooleans(p,['crit','allowProcs'])||!optional(p,'status',numericRecord)||!optional(p,'behavior',value=>oneOf(value,['straight','homing','ricochet','orbit'])))return false;
 }
 if(!records(s.drops,10000)||!s.drops.every(drop=>positiveId(drop.uid)&&numbers(drop,['x','z','value','age'])&&oneOf(drop.kind,['xp','heal','coin','item'])&&optional(drop,'itemId',id=>typeof id==='string'&&!!getItemDefinition(id))))return false;
 if(!records(s.pois,2048))return false;
 for(const poi of s.pois){
  if(!positiveId(poi.uid)||!numbers(poi,['x','z'])||typeof poi.used!=='boolean'||!oneOf(poi.kind,['cache','shrine','healing']))return false;
  if(!optional(poi,'challengeKind',value=>own(OPTIONAL_CHALLENGES,value))||!optional(poi,'challenge',value=>object(value)&&own(OPTIONAL_CHALLENGES,value.id)&&numbers(value,['endsAt','tier'])))return false;
  if(!optionalNumbers(poi,['price','uses','respawnAt','availableAt','shrineTier','shrineVariant'])||!optionalBooleans(poi,['rareTriggered','announced','promoteShrineOnRestock']))return false;
  if(poi.challenge&&object(poi.challenge)&&(!optionalNumbers(poi.challenge,['guardianId','startedAt','progress','nextPressureAt'])||!optional(poi.challenge,'guardianIds',ids)||!optional(poi.challenge,'ringIds',ids)))return false;
 }
 if(!object(s.stats)||!numbers(s.stats,['elapsed','kills','recruits','evolutions','level','xp','xpToNext','damageDealt','damageTaken','faints','highestCombo'])||!finite(s.stats.elapsed)||s.stats.elapsed<0||typeof s.stats.bossKilled!=='boolean')return false;
 if(!Array.isArray(s.items)||s.items.length>10000||!s.items.every(id=>typeof id==='string'&&!!getItemDefinition(id))||!numericRecord(s.buffs))return false;
 if(!numbers(s,['recruitCount','lastEnemySpawn','idCounter','lastSpecialAt'])||!positiveId(s.idCounter)||!booleans(s,['pendingRecruit','bossSpawned','endless'])||!text(s.choiceTitle))return false;
 if(!Array.isArray(s.eventLog)||s.eventLog.length>64||!s.eventLog.every(text)||!records(s.upgradeChoices,128))return false;
 for(const choice of s.upgradeChoices)if(!text(choice.id)||!text(choice.title)||!text(choice.description)||!oneOf(choice.kind,['recruit','evolve','attack','learn','stat','item'])||!oneOf(choice.rarity,['common','uncommon','rare','epic','legendary']))return false;
 if(s.phase==='choice'&&s.upgradeChoices.length===0)return false;
 if(!optionalNumbers(s,['levelUpMemberId','pendingSquadRewards','lastSquadRewardAt','coins','chestPurchases','rerolls','rerollGrants','endlessStartedAt','nextBossAt','bossStage','lastTier3Spawn','lastTier4Spawn'])||!optionalNumbers(s.stats,['bossesDefeated']))return false;
 for(const key of ['itemStacks','trainingRanks'])if(!optional(s,key,numericRecord))return false;
 if(!optional(s,'mapId',value=>own(MAP_DEFINITIONS,value))||!optional(s,'challenge',value=>own(CHALLENGE_DEFINITIONS,value)))return false;
 if(!optional(s,'recruitUnlocks',value=>Array.isArray(value)&&value.length<=151&&value.every(species))||!optional(s,'itemUnlocks',value=>Array.isArray(value)&&value.length<=1000&&value.every(id=>typeof id==='string'&&!!getItemDefinition(id))))return false;
 if(!optional(s,'pendingLevelUps',value=>ids(value,6)))return false;
 if(!optional(s,'build',value=>object(value)&&numericRecord(value.counters)&&numericRecord(value.cooldownUntil)&&numbers(value,['budgetWindow','actionsInWindow'])&&optional(value,'itemOwners',numericRecord)))return false;
 if(!optional(s,'psychicRings',value=>records(value,2048)&&value.every(ring=>numbers(ring,['uid','sourceId','x','z','radius','previousRadius','maxRadius','speed','width','damage'])&&ids(ring.hit)&&optional(ring,'damageSource',validDamageSource))))return false;
 if(!optional(s,'activeSpecials',value=>records(value,64)&&value.every(active=>numbers(active,['sourceId','damage','x','z','toX','toZ','dx','dz','age','pulse'])&&own(ELEMENT_COLORS,active.element)&&ids(active.hit)&&object(active.profile)&&text(active.profile.kind)&&numbers(active.profile,['damageScale','range','radius','duration','cooldown','projectiles']))))return false;
 if(!optional(s,'terrainFeatures',value=>records(value,4096)&&value.every(feature=>numbers(feature,['uid','x','z','radius'])&&oneOf(feature.kind,['bramble','ruin-beacon'])&&oneOf(feature.state,['ready','arming','spent'])&&optional(feature,'damageSource',validDamageSource))))return false;
 if(!optional(s,'berryTrees',value=>records(value,4096)&&value.every(tree=>numbers(tree,['uid','x','z','scale','nextChangeAt','cycle'])&&own(BERRIES,tree.berry)&&records(tree.berries,64)&&tree.berries.every(berry=>numbers(berry,['x','z','droppedAt'])&&typeof berry.collected==='boolean'))))return false;
 if(!optional(s,'berryBuffs',value=>object(value)&&Object.values(value).every(list=>Array.isArray(list)&&list.length<=10000&&list.every(finite))))return false;
 if(!optional(s,'analytics',validAnalytics))return false;
 return true;
}
export function isSimulationSnapshot(value:unknown):value is SimulationSnapshot {
 if(!boundedData(value)||!object(value)||value.version!==SNAPSHOT_VERSION||!object(value.metadata)||!validState(value.state)||!object(value.bookkeeping))return false;
 const b=value.bookkeeping;
 if(![b.rng,b.lootRng].every(state=>integer(state)&&state>0&&state<=0xffffffff)||!finite(b.spawnAccum)||b.spawnAccum<0||!vector(b.velocity)||!vector(b.dodgeDirection)||!booleans(b,['walking','rewardsDeferred'])||!oneOf(b.resumePhase,phases))return false;
 if(value.state.phase==='paused'){
  if(!oneOf(b.resumePhase,['playing','boss','choice'])||b.resumePhase==='choice'&&value.state.upgradeChoices.length===0)return false;
 }else if(b.resumePhase!==value.state.phase)return false;
 if(!Array.isArray(b.statusOwners)||b.statusOwners.length>10000||!b.statusOwners.every(pair=>Array.isArray(pair)&&pair.length===2&&pair.every(integer)))return false;
 const nav=b.navigation;if(!object(nav)||!records(nav.routes,2048)||!ids(nav.pending,2048))return false;
 for(const route of nav.routes)if(!positiveId(route.uid)||!vector(route.target)||!Array.isArray(route.points)||route.points.length>2048||!route.points.every(vector)||!finite(route.retryAt)||!optional(route,'actor',vector))return false;
 const routes=nav.routes;if(!ids(routes.map(route=>route.uid),2048)||!nav.pending.every(uid=>routes.some(route=>route.uid===uid)))return false;
 return true;
}
function validMetadata(value:unknown):value is SuspendedRunMetadata {
 return object(value)&&typeof value.runId==='string'&&value.runId.length>0&&value.runId.length<=100&&species(value.starterId)&&integer(value.rocketKills)&&value.rocketKills>=0&&typeof value.victoryRecorded==='boolean'&&optional(value,'finished',candidate=>typeof candidate==='boolean')&&optional(value,'savedElapsed',finite)&&optional(value,'rewoundSeconds',finite);
}
/** Collection/settings export is deliberately separate from this live run file. */
export function encodeRunFile(snapshot:SimulationSnapshot,metadata:SuspendedRunMetadata):string {
 if(!isSimulationSnapshot(snapshot)||!validMetadata(metadata)||!boundedData(metadata))throw Error('This run could not be saved because its snapshot is invalid.');
 const json=JSON.stringify({format:'wildlands-suspended-run',version:SUSPENDED_RUN_VERSION,snapshot,metadata} satisfies SuspendedRunFile);
 if(json.length>RUN_FILE_MAX_BYTES||new TextEncoder().encode(json).byteLength>RUN_FILE_MAX_BYTES)throw Error('The suspended run exceeds the 12 MB file limit.');
 return json;
}
export function decodeRunFile(json:string):RunFileResult {
 if(json.length>RUN_FILE_MAX_BYTES||new TextEncoder().encode(json).byteLength>RUN_FILE_MAX_BYTES)return {ok:false,error:'This run file exceeds the 12 MB limit.'};
 let value:unknown;try{value=JSON.parse(json);}catch{return {ok:false,error:'This run file is not valid JSON.'};}
 if(!object(value)||value.format!=='wildlands-suspended-run')return {ok:false,error:'Choose a Wildlands suspended run file.'};
 if(value.version!==SUSPENDED_RUN_VERSION)return {ok:false,error:'This suspended run version is incompatible with this game.'};
 if(!isSimulationSnapshot(value.snapshot)||!validMetadata(value.metadata)||!boundedData(value.metadata))return {ok:false,error:'This run file contains incomplete or invalid simulation state.'};
 if(value.snapshot.state.result!==null||value.metadata.finished)return {ok:false,error:'A completed run cannot be resumed.'};
 if(!oneOf(value.snapshot.state.phase,['playing','boss','choice','paused']))return {ok:false,error:'This run file does not contain a resumable checkpoint.'};
 return {ok:true,file:value as unknown as SuspendedRunFile};
}
