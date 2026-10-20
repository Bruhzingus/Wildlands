/** Local experiment code. Nothing under src imports this module. No renderer, storage or network. */
import {Simulation,type GameEvent,type MoveInput} from '../../src/game/Simulation.ts';
import type {RunState,UpgradeChoice} from '../../src/game/types.ts';
import {getAttackProfile} from '../../src/data/attacks.ts';
import {getSpecies} from '../../src/data/kanto.ts';
import {DESIGN} from '../../src/data/config.ts';
import {getVariant} from '../../src/data/variants.ts';
import {BASE_ITEMS,GATED_RECRUITS} from '../../src/data/unlocks.ts';

export const BEHAVIORS=['cautious','orbit','stationary'] as const;
export const BUILDS=['balanced','offense','survival'] as const;
export type Behavior=typeof BEHAVIORS[number];
export type Build=typeof BUILDS[number];
export interface ExperimentConfig {
 seed:number;starter:number;seconds:number;behavior:Behavior;build:Build;
 maintainHealth:boolean;continueEndless:boolean;step:number;pools:'fresh'|'legacy-full';
}
export const DEFAULT_EXPERIMENT:Readonly<ExperimentConfig>=Object.freeze({
 seed:1001,starter:7,seconds:1000,behavior:'cautious',build:'balanced',maintainHealth:false,continueEndless:false,step:.04,pools:'fresh',
});
const round=(value:number)=>Math.round(value*1000)/1000;
const emptyRarity=()=>({common:0,rare:0,epic:0});
export interface LevelMetric {level:number;at:number;secondsSincePrevious:number}
export interface ChoiceMetric {at:number;level:number;kind:UpgradeChoice['kind'];id:string;rarity:UpgradeChoice['rarity']}
export interface RecruitOffer {at:number;level:number;ordinal:number;species:number[]}
export interface MinuteMetric {minute:number;seconds:number;kills:number;killsPerMinute:number;leaderDamage:number;meanEnemies:number;maxEnemies:number;faints:number}
export interface RunMetrics {
 config:ExperimentConfig;assistance:'none'|'health-maintained';elapsed:number;level:number;kills:number;killsPerMinute:number;
 leaderDamage:number;followerDamage:number;followerHitDamage:number;followerPoisonDamage:number;faints:number;followerFaintRate:number|null;
 recruits:number;livingParty:number;partyAt15m:number|null;evolutions:number;itemRarity:ReturnType<typeof emptyRarity>;
 offeredItemRarity:ReturnType<typeof emptyRarity>;levels:LevelMetric[];recruitOffers:RecruitOffer[];choices:ChoiceMetric[];
 minutes:MinuteMetric[];longestUpgradeGap:number;bossOutcome:'not-reached'|'alive-at-limit'|'victory'|'defeat';
 bossStartedAt:number|null;bossFightSeconds:number|null;result:'victory'|'defeat'|'time-limit';
 peakEnemies:number;peakProjectiles:number;peakDrops:number;validationErrors:string[];
}

/** Observes authoritative state without changing its RNG, actors, XP or gates. */
export class RunMetricRecorder {
 private readonly config:ExperimentConfig;
 private readonly levels:LevelMetric[]=[];
 private readonly recruitOffers:RecruitOffer[]=[];
 private readonly choices:ChoiceMetric[]=[];
 private readonly minutes:MinuteMetric[]=[];
 private readonly itemRarity=emptyRarity();private readonly offeredItemRarity=emptyRarity();
 private previousLevel:number;private previousLevelAt:number;private lastUpgradeAt:number;private longestGap=0;
 private lastChoice:RunState['upgradeChoices']|null=null;private partyAt15m:number|null=null;
 private followerHitDamage=0;private followerPoisonDamage=0;private bossStartedAt:number|null=null;private bossWonAt:number|null=null;
 private bucket={start:0,kills:0,damage:0,faints:0,samples:0,enemies:0,maxEnemies:0};
 private peakEnemies=0;private peakProjectiles=0;private peakDrops=0;private readonly validationErrors=new Set<string>();
 constructor(config:ExperimentConfig,state:RunState){
  this.config=config;
  this.previousLevel=state.stats.level;this.previousLevelAt=state.stats.elapsed;this.lastUpgradeAt=state.stats.elapsed;
  this.bucket.start=state.stats.elapsed;this.bucket.kills=state.stats.kills;this.bucket.damage=state.stats.damageTaken;this.bucket.faints=state.stats.faints;
 }
 event(event:GameEvent){
  if(event.kind==='hit'&&event.damageTo==='companion')this.followerHitDamage+=Math.max(0,event.amount||0);
 }
 /** Call before an advancing tick. Poison has no hit event and is sampled before healing. */
 beforeStep(state:RunState,dt:number){
  if(state.player.hp<=0)return;
  const poisonDps=getVariant('poisoned').contactPoison!.damagePerSecond;
  for(const member of state.party.slice(1))this.followerPoisonDamage+=Math.min(dt,member.poisonTime||0)*poisonDps;
 }
 offered(state:RunState){
  if(state.phase!=='choice'||state.upgradeChoices===this.lastChoice)return;
  this.lastChoice=state.upgradeChoices;
  const recruits=state.upgradeChoices.filter(choice=>choice.kind==='recruit');
  if(recruits.length){
   this.recruitOffers.push({at:round(state.stats.elapsed),level:state.stats.level,ordinal:state.recruitCount+1,species:recruits.map(choice=>choice.speciesId!)});
   const gate=DESIGN.recruitUnlockSeconds[state.recruitCount];
   if(gate===undefined||state.stats.elapsed+1e-7<gate)this.validationErrors.add('recruit-offered-before-time-gate');
   if(state.stats.level<DESIGN.recruitUnlockLevels[state.recruitCount])this.validationErrors.add('recruit-offered-before-level-gate');
   if(recruits.some(choice=>getSpecies(choice.speciesId!).stage!==1))this.validationErrors.add('recruit-offered-evolved-species');
   if(state.recruitUnlocks&&recruits.some(choice=>GATED_RECRUITS.includes(choice.speciesId!)&&!state.recruitUnlocks!.includes(choice.speciesId!)))this.validationErrors.add('recruit-offered-locked-species');
  }
  for(const choice of state.upgradeChoices)if(choice.kind==='item'){
   this.offeredItemRarity[choice.rarity]++;
   if(state.itemUnlocks&&!state.itemUnlocks.includes(choice.id))this.validationErrors.add('item-offered-before-meta-unlock');
  }
 }
 selected(state:RunState,choice:UpgradeChoice,accepted:boolean){
  if(!accepted)return;
  this.longestGap=Math.max(this.longestGap,state.stats.elapsed-this.lastUpgradeAt);this.lastUpgradeAt=state.stats.elapsed;
  this.choices.push({at:round(state.stats.elapsed),level:state.stats.level,kind:choice.kind,id:choice.id,rarity:choice.rarity});
  if(choice.kind==='item')this.itemRarity[choice.rarity]++;
 }
 sample(state:RunState){
  const t=state.stats.elapsed;
  if(state.stats.level!==this.previousLevel){
   this.levels.push({level:state.stats.level,at:round(t),secondsSincePrevious:round(t-this.previousLevelAt)});
   this.previousLevel=state.stats.level;this.previousLevelAt=t;
  }
  if(this.partyAt15m===null&&t+1e-7>=900)this.partyAt15m=state.party.filter(member=>member.hp>0).length;
  if(this.bossStartedAt===null&&state.bossSpawned)this.bossStartedAt=t;
  if(this.bossWonAt===null&&state.stats.bossKilled)this.bossWonAt=t;
  const enemies=state.enemies.reduce((sum,enemy)=>sum+Number(!enemy.dead),0);
  this.peakEnemies=Math.max(this.peakEnemies,enemies);this.peakProjectiles=Math.max(this.peakProjectiles,state.projectiles.length);this.peakDrops=Math.max(this.peakDrops,state.drops.length);
  this.bucket.samples++;this.bucket.enemies+=enemies;this.bucket.maxEnemies=Math.max(this.bucket.maxEnemies,enemies);
  if(t-this.bucket.start+1e-7>=60)this.flushMinute(state);
  if(state.party.length>DESIGN.maxParty)this.validationErrors.add('party-cap-exceeded');
  if(enemies>DESIGN.maxEnemies)this.validationErrors.add('enemy-cap-exceeded');
  if(state.projectiles.length>DESIGN.maxProjectiles)this.validationErrors.add('projectile-cap-exceeded');
  if(state.drops.length>DESIGN.maxActiveDrops)this.validationErrors.add('drop-cap-exceeded');
  if(!Number.isFinite(t+state.player.x+state.player.z+state.player.hp+state.stats.damageTaken))this.validationErrors.add('non-finite-state');
 }
 private flushMinute(state:RunState){
  const duration=state.stats.elapsed-this.bucket.start;if(duration<=0)return;
  const kills=state.stats.kills-this.bucket.kills;
  this.minutes.push({minute:Math.floor(this.bucket.start/60)+1,seconds:round(duration),kills,killsPerMinute:round(kills*60/duration),
   leaderDamage:round(state.stats.damageTaken-this.bucket.damage),meanEnemies:round(this.bucket.enemies/Math.max(1,this.bucket.samples)),maxEnemies:this.bucket.maxEnemies,faints:state.stats.faints-this.bucket.faints});
  this.bucket={start:state.stats.elapsed,kills:state.stats.kills,damage:state.stats.damageTaken,faints:state.stats.faints,samples:0,enemies:0,maxEnemies:0};
 }
 finish(state:RunState):RunMetrics {
  if(state.stats.elapsed>this.bucket.start+1e-7)this.flushMinute(state);
  const bossOutcome=state.stats.bossKilled?'victory':!state.bossSpawned?'not-reached':state.result==='defeat'?'defeat':'alive-at-limit';
  return {config:{...this.config},assistance:this.config.maintainHealth?'health-maintained':'none',elapsed:round(state.stats.elapsed),level:state.stats.level,kills:state.stats.kills,
   killsPerMinute:round(state.stats.kills*60/Math.max(.001,state.stats.elapsed)),leaderDamage:round(state.stats.damageTaken),
   followerDamage:round(this.followerHitDamage+this.followerPoisonDamage),followerHitDamage:round(this.followerHitDamage),followerPoisonDamage:round(this.followerPoisonDamage),
   faints:state.stats.faints,followerFaintRate:state.stats.recruits?round(state.stats.faints/state.stats.recruits):null,recruits:state.stats.recruits,
   livingParty:state.party.filter(member=>member.hp>0).length,partyAt15m:this.partyAt15m,evolutions:state.stats.evolutions,itemRarity:{...this.itemRarity},offeredItemRarity:{...this.offeredItemRarity},
   levels:[...this.levels],recruitOffers:[...this.recruitOffers],choices:[...this.choices],minutes:[...this.minutes],longestUpgradeGap:round(Math.max(this.longestGap,state.stats.elapsed-this.lastUpgradeAt)),
   bossOutcome,bossStartedAt:this.bossStartedAt===null?null:round(this.bossStartedAt),
   bossFightSeconds:this.bossStartedAt===null?null:round((this.bossWonAt??state.stats.elapsed)-this.bossStartedAt),
   result:state.stats.bossKilled&&!state.endless?'victory':state.result==='defeat'?'defeat':'time-limit',peakEnemies:this.peakEnemies,peakProjectiles:this.peakProjectiles,peakDrops:this.peakDrops,
   validationErrors:[...this.validationErrors]};
 }
}

export function selectScriptedChoice(state:RunState,build:Build):UpgradeChoice|undefined {
 const priority=(choice:UpgradeChoice)=>{
  if(choice.kind==='recruit')return 100;
  if(choice.kind==='evolve')return 95;
  if(choice.kind==='attack')return build==='survival'?72:88;
  if(choice.kind==='stat')return (build==='survival'?{armor:91,health:90,power:82,haste:81,xp:74,radius:73,speed:71}:
   build==='offense'?{power:94,haste:93,radius:87,xp:80,crit:85,armor:60,health:55}:
   {power:86,haste:85,armor:82,health:state.player.hp<state.player.maxHp*.6?92:75,xp:83,radius:80})[choice.stat as 'power']??55;
  return build==='survival'?76:77;
 };
 return state.upgradeChoices.reduce<UpgradeChoice|undefined>((best,choice)=>!best||priority(choice)>priority(best)?choice:best,undefined);
}

/** Deterministic policy uses no simulation RNG. It is an experiment, not an AI player skill claim. */
export function scriptedInput(state:RunState,behavior:Behavior,tick:number):MoveInput {
 const idle:MoveInput={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
 if(behavior==='stationary')return {...idle,special:tick%425===0};
 const t=state.stats.elapsed,angle=t*.6+state.seed*.0001;
 let mx=Math.cos(angle),mz=Math.sin(angle);
 const profile=getAttackProfile(state.party[0].speciesId,state.party[0].attackLevel);
 let nearest:RunState['enemies'][number]|undefined,distance=Infinity;
 for(const enemy of state.enemies){if(enemy.dead)continue;const d=Math.hypot(enemy.x-state.player.x,enemy.z-state.player.z);if(d<distance){nearest=enemy;distance=d;}}
 const close=profile.kind==='aura'||profile.kind==='slash';
 if(nearest&&close&&distance>profile.radius*.7){mx=(nearest.x-state.player.x)/distance;mz=(nearest.z-state.player.z)/distance;}
 if(behavior==='cautious'){
  // Ranged leaders keep attackable enemies nearby, retreat from contact and circle telegraphs.
  if(nearest&&!close){
   const nx=(nearest.x-state.player.x)/Math.max(.001,distance),nz=(nearest.z-state.player.z)/Math.max(.001,distance);
   const radial=Math.max(-1,Math.min(1,(distance-Math.min(9,profile.range*.6))*.3));
   mx=nx*radial+nz*.75;mz=nz*radial-nx*.75;
  }
  // Soft return from the boundary; obstacle collisions still resolve in the real simulation.
  if(Math.abs(state.player.x)>88)mx-=Math.sign(state.player.x)*1.5;
  if(Math.abs(state.player.z)>88)mz-=Math.sign(state.player.z)*1.5;
  const ringNear=(state.psychicRings||[]).some(ring=>{const gap=Math.hypot(state.player.x-ring.x,state.player.z-ring.z)-ring.radius;return gap>0&&gap<3;});
  const threat=distance<3.5||state.enemies.some(enemy=>enemy.windup?.kind==='slam'&&Math.hypot(state.player.x-enemy.windup.x,state.player.z-enemy.windup.z)<4);
  return {mx,mz,jump:ringNear&&state.player.y===0&&tick%2===0,dodge:threat&&tick%3===0&&state.player.dodgeCooldown===0,
   special:!!nearest&&distance<9.5&&state.player.specialCooldown===0&&tick%2===0,interact:tick%25===0};
 }
 return {...idle,mx,mz,special:tick%425===0};
}

export function normalizeExperiment(input:Partial<ExperimentConfig>={}):ExperimentConfig {
 const config={...DEFAULT_EXPERIMENT,...input};
 if(!Number.isInteger(config.seed)||config.seed<1||config.seed>0xffffffff)throw Error('Seed must be an integer from 1 through 4294967295');
 if(!Number.isInteger(config.starter)||config.starter<1||config.starter>151)throw Error('Starter must be a Kanto ID from 1 through 151');
 if(!Number.isFinite(config.seconds)||config.seconds<=0||config.seconds>7200)throw Error('Seconds must be greater than zero and at most 7200');
 if(!Number.isFinite(config.step)||config.step<.005||config.step>.04)throw Error('Step must be between .005 and .04 seconds');
 if(!BEHAVIORS.includes(config.behavior))throw Error('Unknown scripted behavior');
 if(!BUILDS.includes(config.build))throw Error('Unknown scripted build priority');
 if(config.pools!=='fresh'&&config.pools!=='legacy-full')throw Error('Pools must be fresh or legacy-full');
 if(typeof config.maintainHealth!=='boolean'||typeof config.continueEndless!=='boolean')throw Error('Assistance and endless flags must be boolean');
 return config;
}

export function runExperiment(input:Partial<ExperimentConfig>={}):RunMetrics {
 const config=normalizeExperiment(input),sim=new Simulation(config.starter,config.seed),state=sim.state,recorder=new RunMetricRecorder(config,state);
 if(config.pools==='fresh'){state.itemUnlocks=[...BASE_ITEMS];state.recruitUnlocks=[];}
 sim.onEvent=event=>recorder.event(event);
 let tick=0,staleChoices=0;
 while(state.stats.elapsed+1e-7<config.seconds){
  if(state.phase==='result'){
   if(state.result==='victory'&&config.continueEndless)sim.continueEndless();else break;
  }
  if(state.phase==='choice'){
   recorder.offered(state);
   const choice=selectScriptedChoice(state,config.build);if(!choice)throw Error(`Seed ${config.seed}: empty paused choice`);
   const accepted=sim.choose(choice.id);recorder.selected(state,choice,accepted);
   if(!accepted&&++staleChoices>8)throw Error(`Seed ${config.seed}: repeated rejected choice`);
   if(accepted)staleChoices=0;
   continue;
  }
  if(state.phase!=='playing'&&state.phase!=='boss')throw Error(`Seed ${config.seed}: unexpected phase ${state.phase}`);
  if(config.maintainHealth){state.player.hp=state.player.maxHp;for(const member of state.party)member.hp=member.maxHp;}
  const dt=Math.min(config.step,config.seconds-state.stats.elapsed);
  recorder.beforeStep(state,dt);sim.update(dt,scriptedInput(state,config.behavior,tick++));recorder.sample(state);
 }
 // A choice raised on the final simulation frame is still a real offer, even if not selected.
 recorder.offered(state);
 return recorder.finish(state);
}

const mean=(values:number[])=>values.length?round(values.reduce((sum,value)=>sum+value,0)/values.length):null;
export function summarizeExperiments(runs:readonly RunMetrics[]){
 const present=(values:(number|null)[])=>values.filter((value):value is number=>value!==null);
 const group=(cohort:readonly RunMetrics[])=>{
  const at15=present(cohort.map(run=>run.partyAt15m)),firstRecruits=present(cohort.map(run=>run.recruitOffers[0]?.at??null));
  const recruited=cohort.reduce((sum,run)=>sum+run.recruits,0),faints=cohort.reduce((sum,run)=>sum+run.faints,0);
  return {runs:cohort.length,meanSeconds:mean(cohort.map(run=>run.elapsed)),meanLevel:mean(cohort.map(run=>run.level)),meanKillsPerMinute:mean(cohort.map(run=>run.killsPerMinute)),
   meanLeaderDamage:mean(cohort.map(run=>run.leaderDamage)),meanFollowerDamage:mean(cohort.map(run=>run.followerDamage)),followerFaintRate:recruited?round(faints/recruited):null,
   runsReaching15m:at15.length,meanPartyAt15m:mean(at15),meanFirstRecruitOffer:mean(firstRecruits),meanEvolutions:mean(cohort.map(run=>run.evolutions)),
   meanFirstLevel:mean(present(cohort.map(run=>run.levels[0]?.at??null))),meanLongestUpgradeGap:mean(cohort.map(run=>run.longestUpgradeGap)),
   bossReached:cohort.filter(run=>run.bossOutcome!=='not-reached').length,bossVictories:cohort.filter(run=>run.bossOutcome==='victory').length,
   deaths:cohort.filter(run=>run.result==='defeat').length,
   selectedItemRarity:cohort.reduce((sum,run)=>({common:sum.common+run.itemRarity.common,rare:sum.rare+run.itemRarity.rare,epic:sum.epic+run.itemRarity.epic}),emptyRarity()),
   validationFailures:cohort.filter(run=>run.validationErrors.length).length};
 };
 const cohortName=(run:RunMetrics)=>`${run.config.pools}/${run.assistance}/${run.config.behavior}/${run.config.build}`;
 const cohorts=[...new Set(runs.map(cohortName))].map(name=>({name,...group(runs.filter(run=>cohortName(run)===name))}));
 const unassisted=runs.filter(run=>run.assistance==='none'),progression=runs.filter(run=>run.assistance==='health-maintained');
 const firstLevel=present(unassisted.map(run=>run.levels[0]?.at??null)),parties=present(progression.map(run=>run.partyAt15m));
 return {all:group(runs),cohorts,hypotheses:[
  {id:'recruit-time-safety',kind:'regression',status:runs.some(run=>run.recruitOffers.some(offer=>offer.at+1e-6<DESIGN.recruitUnlockSeconds[offer.ordinal-1]))?'fail':'pass',target:'Never offer recruitment before its configured time gate',sampleSize:runs.reduce((sum,run)=>sum+run.recruitOffers.length,0)},
  {id:'finite-bounded-state',kind:'regression',status:runs.some(run=>run.validationErrors.length)?'fail':'pass',target:'Finite state and configured actor/projectile/drop/party bounds',sampleSize:runs.length},
  {id:'first-level-cadence',kind:'hypothesis',status:firstLevel.length?(mean(firstLevel)!>=30&&mean(firstLevel)!<=50?'within-target':'needs-review'):'insufficient-data',target:'Mean first level 30–50s among unassisted scripts that leveled; deaths are reported separately',observed:mean(firstLevel),sampleSize:firstLevel.length},
  {id:'four-party-progression',kind:'hypothesis',status:parties.length?(mean(parties)!>=3.5&&mean(parties)!<=4?'within-target':'needs-review'):'insufficient-data',target:'About four living at 15m in health-maintained progression experiments; not survival evidence',observed:mean(parties),sampleSize:parties.length},
  {id:'upgrade-gaps',kind:'hypothesis',status:runs.length?(Math.max(...runs.map(run=>run.longestUpgradeGap))<=90?'within-target':'needs-review'):'insufficient-data',target:'No selected-upgrade gap above 90 active seconds, including opening and trailing gaps',observed:runs.length?Math.max(...runs.map(run=>run.longestUpgradeGap)):null,sampleSize:runs.length},
  {id:'human-casual-victory',kind:'human-playtest',status:'not-measured',target:'Observe casual players using dodges, without coaching or health assistance; scripts cannot establish fun, clarity or human victory rate',sampleSize:0},
 ]};
}

export const CSV_COLUMNS=['seed','starter','pools','behavior','build','assistance','requestedSeconds','elapsed','level','kills','killsPerMinute','leaderDamage','followerDamage','faints','followerFaintRate','recruits','livingParty','partyAt15m','evolutions','firstLevelAt','firstRecruitOfferAt','secondRecruitOfferAt','thirdRecruitOfferAt','commonItems','rareItems','epicItems','bossOutcome','bossFightSeconds','longestUpgradeGap','peakEnemies','peakProjectiles','peakDrops','validationErrors'] as const;
export function metricsCSV(runs:readonly RunMetrics[]):string {
 const cell=(value:unknown)=>value===null||value===undefined?'':`"${String(value).replaceAll('"','""')}"`;
 const rows=runs.map(run=>[run.config.seed,run.config.starter,run.config.pools,run.config.behavior,run.config.build,run.assistance,run.config.seconds,run.elapsed,run.level,run.kills,run.killsPerMinute,
  run.leaderDamage,run.followerDamage,run.faints,run.followerFaintRate,run.recruits,run.livingParty,run.partyAt15m,run.evolutions,run.levels[0]?.at,
  run.recruitOffers[0]?.at,run.recruitOffers[1]?.at,run.recruitOffers[2]?.at,run.itemRarity.common,run.itemRarity.rare,run.itemRarity.epic,run.bossOutcome,run.bossFightSeconds,
  run.longestUpgradeGap,run.peakEnemies,run.peakProjectiles,run.peakDrops,run.validationErrors.join(';')]);
 return [CSV_COLUMNS.join(','),...rows.map(row=>row.map(cell).join(','))].join('\n')+'\n';
}
