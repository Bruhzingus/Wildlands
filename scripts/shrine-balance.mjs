import {pathToFileURL} from 'node:url';
import {createReportedBossRun} from './boss-balance.mjs';
import {SHRINE_RULES,shrineDefinition} from '../src/data/shrines.ts';
import {estimatedBuildDps} from '../src/game/analytics.ts';
import {xpThreshold} from '../src/game/systems/progression.ts';

/** The reported 23:08 build. Later fixtures keep its five members and relics.
 * Each twenty levels adds two signature ranks, one rank to the first learned
 * move, and one 7% personal power/haste choice (alternating). This fits four
 * five-level milestones; Koffing is assumed evolved by level 35. These are
 * conservative projections, not later snapshots of the user's actual run. */
export function createShrineProgressionRun({leaderLevel=40,seed=1883105034}={}){
 const sim=createReportedBossRun({seed}),s=sim.state,levels=Math.max(0,leaderLevel-40),training=Math.floor(levels/20);
 sim.captureRewindCheckpoint=()=>{};
 // Slow-ground geometry still affects movement through movePlayer. Disable the
 // separate hazard damage tick as well as ordinary hits for a pure duration check.
 sim.updateShrineHazards=()=>{};
 s.stats.elapsed=1388.18515+levels*12;s.stats.bossKilled=true;s.stats.bossesDefeated=1;
 s.bossSpawned=true;s.endless=true;s.nextBossAt=1e9;s.recruitCount=5;s.analytics=undefined;
 s.buffs={luck:.4,specialHaste:1.5,radius:.504,crit:.16,specialPower:.2,deflection:.17,
  power:.53,haste:.33,health:.3,staminaRechargeReduction:.1,speed:.12};
 s.itemStacks={'magnet-stone':1,'lucky-egg-xp-epic':3,'kings-rock':3,leftovers:1,'toxic-barb':1,
  'rare-candy':3,'power-herb-epic':3,'critical-capacitor':1,'blast-seed':1,'power-herb':1,
  'lucky-egg-xp':1,'storm-coil':3,'eruption-core':3,'multi-lens':5,'metronome-ramp':1};
 s.items=Object.keys(s.itemStacks);
 const members=[
  {uid:1,speciesId:26,level:40,attackLevel:5,maxHp:491.38947,evolutionPower:.25,
   trainingBuffs:{crit:.14,health:.17},moves:[['shock-wave',2],['discharge',1]]},
  {uid:343,speciesId:99,level:40,attackLevel:7,maxHp:493.17125,evolutionPower:.25,
   trainingBuffs:{radius:.21,haste:.13},moves:[['water-gun',1]]},
  {uid:1722,speciesId:113,level:38,attackLevel:5,maxHp:350.61,evolutionPower:0,
   trainingBuffs:{deflection:.04,specialHaste:.64,crit:.2},moves:[['tackle',3]]},
  {uid:3896,speciesId:3,level:33,attackLevel:5,maxHp:516.34375,evolutionPower:.5,
   trainingBuffs:{power:.34},moves:[['sludge-bomb',2]]},
  {uid:5686,speciesId:109,level:27,attackLevel:1,maxHp:336.908,evolutionPower:0,
   trainingBuffs:{radius:.21,power:.34,haste:.13,specialPower:.26,specialHaste:.43},moves:[]},
 ];
 const template=s.party[0];
 s.party=members.map(({moves,...member},index)=>{
  const level=member.level+levels,evolve=member.speciesId===109&&level>=35;
  return {...structuredClone(template),...member,speciesId:evolve?110:member.speciesId,level,
   attackLevel:member.attackLevel+Math.floor(levels/10)+(evolve?1:0),
   evolutionPower:member.evolutionPower+(evolve?.25:0),
   trainingBuffs:{...member.trainingBuffs,power:(member.trainingBuffs.power??0)+.07*Math.ceil(training/2),
    haste:(member.trainingBuffs.haste??0)+.07*Math.floor(training/2)},
   learnedMoves:moves.map(([moveId,rank],index)=>({moveId,rank:rank+(index===0?Math.floor(levels/20):0),cooldown:0})),
   xp:0,xpToNext:xpThreshold(level),hp:member.maxHp,iframes:1e6,cooldown:0,specialCooldown:0,
   x:index*.5,z:0,animation:'idle',attackTimer:0};
 });
 s.player.hp=s.player.maxHp=357.37416;s.player.iframes=1e6;
 s.stats.level=s.party.reduce((sum,member)=>sum+member.level,0);s.idCounter=10000;
 return sim;
}

/** Real guardians, hazards, boundaries and endless arrivals. Incoming damage is
 * disabled to isolate duration; XP and upgrades are frozen throughout a trial. */
export function runShrineProgressionExperiment({tier=9,leaderLevel=40,seed=1883105034,healthOverride}={}){
 const sim=createShrineProgressionRun({leaderLevel,seed}),s=sim.state,definition=shrineDefinition(tier);
 const site={uid:9999,x:0,z:0,kind:'shrine',shrineTier:tier,used:false};s.pois=[site];
 sim.activatePOI(site);
 if(!site.challenge)throw Error(`Level ${leaderLevel} cannot enter tier ${tier}`);
 const guardians=s.enemies.filter(enemy=>enemy.shrineGuardian),started=s.stats.elapsed;
 if(healthOverride!==undefined)for(const enemy of guardians)enemy.hp=enemy.maxHp=healthOverride/definition.count;
 const health=guardians.reduce((sum,enemy)=>sum+enemy.maxHp,0),estimatedDps=estimatedBuildDps(s).withAbility;
 const relicCopies=()=>Object.values(s.itemStacks??{}).reduce((sum,count)=>sum+count,0),startingRelics=relicCopies();
 let peakAdds=0;
 for(let tick=0;tick<Math.ceil(SHRINE_RULES.timeLimit/.04)+2&&site.challenge;tick++){
  const target=guardians.find(enemy=>!enemy.dead);if(!target)break;
  const dx=target.x-s.player.x,dz=target.z-s.player.z,distance=Math.max(.001,Math.hypot(dx,dz)),nx=dx/distance,nz=dz/distance;
  const radial=Math.max(-1,Math.min(1,(distance-7)*.3));let mx=nx*radial+nz*.4,mz=nz*radial-nx*.4;
  const centerDistance=Math.hypot(s.player.x,s.player.z);
  if(centerDistance>definition.radius*.65){mx=-s.player.x/centerDistance;mz=-s.player.z/centerDistance;}
  sim.update(.04,{mx,mz,jump:false,dodge:false,special:tick%2===0,interact:false,aimX:nx,aimZ:nz});
  peakAdds=Math.max(peakAdds,s.enemies.filter(enemy=>!enemy.dead&&!enemy.shrineGuardian).length);
 }
 const remaining=guardians.reduce((sum,enemy)=>sum+Math.max(0,enemy.hp),0);
 return {tier,leaderLevel,projected:leaderLevel>40,seed,health,completed:!!site.uses,
  seconds:Number((s.stats.elapsed-started).toFixed(2)),percentCleared:Number(((health-remaining)/health*100).toFixed(1)),
  estimatedDps:Number(estimatedDps.toFixed(2)),peakAdds,incomingDamage:s.stats.damageTaken,relicCopiesGained:relicCopies()-startingRelics};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify({
 conditions:'Reported level-40 build and conservative later projections; same five members and relic stacks. Real guardian movement, hazards, boundary and endless arrivals. Incoming hits disabled; no XP/upgrades during trials. Duration only.',
 results:[runShrineProgressionExperiment({tier:9}),runShrineProgressionExperiment({tier:10}),
  ...[9,10,11,12,13,14,15].map(tier=>runShrineProgressionExperiment({tier,leaderLevel:shrineDefinition(tier).level}))],
},null,2));
