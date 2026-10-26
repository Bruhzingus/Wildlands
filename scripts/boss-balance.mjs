import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import {Simulation} from '../src/game/Simulation.ts';
import {estimatedBuildDps} from '../src/game/analytics.ts';
import {xpThreshold} from '../src/game/systems/progression.ts';

/** Measured from run mvn14c7y-1-1883105034, before changing boss health. */
export const REPORTED_BOSS={elapsed:1388.1851499998463,spawnedAt:900,maxHp:3621745.68,hp:3185545.549450128};
export function bossHealthCalculation(sample=REPORTED_BOSS){
 const seconds=sample.elapsed-sample.spawnedAt,damage=sample.maxHp-sample.hp,dps=damage/seconds;
 return {seconds,damage,dps,targetSeconds:180,targetHp:dps*180,
  oldFightSeconds:sample.maxHp/dps,newFightSeconds:160000/dps};
}

/** Reconstructed from the report's 15:00 telemetry, before eight minutes of
 * additional levels, evolutions, move training and relics. */
export function createReportedBossRun({mapId='wildlands',seed=1883105034}={}){
 const sim=new Simulation(26,seed,{mapId}),s=sim.state;
 sim.gainXP=()=>{};sim.openNextLevelUp=()=>false;
 // This is a fixed-build throughput benchmark: random item pickups would
 // otherwise change its damage, healing and special HP costs mid-experiment.
 s.itemUnlocks=[];
 s.enemies=[];s.pois=[];s.terrainFeatures=[];s.berryTrees=[];
 s.stats.elapsed=899.99;s.stats.level=95;s.recruitCount=3;s.idCounter=4000;
 s.buffs={luck:.39,specialHaste:1,radius:.504,crit:.04,specialPower:.2,deflection:.08,power:.3,haste:.08};
 s.itemStacks={'magnet-stone':1,'lucky-egg-xp-epic':1,'kings-rock':2,leftovers:1,'toxic-barb':1,
  'rare-candy':2,'power-herb-epic':2,'critical-capacitor':1,'blast-seed':1,'power-herb':1,
  'lucky-egg-xp':1,'storm-coil':1,'eruption-core':2,'multi-lens':1};
 s.items=Object.keys(s.itemStacks);
 const members=[
  {uid:1,speciesId:26,level:29,attackLevel:4,maxHp:240.9264,evolutionPower:.25,
   trainingBuffs:{crit:.14,health:.17},moves:[['shock-wave',1]]},
  {uid:343,speciesId:99,level:29,attackLevel:5,maxHp:332.475,evolutionPower:.25,
   trainingBuffs:{radius:.21},moves:[['water-gun',1]]},
  {uid:1722,speciesId:113,level:26,attackLevel:5,maxHp:232.5,evolutionPower:0,
   trainingBuffs:{deflection:.04,specialHaste:.64},moves:[['tackle',3]]},
  {uid:3896,speciesId:1,level:11,attackLevel:3,maxHp:186,evolutionPower:0,
   trainingBuffs:{power:.21},moves:[]},
 ];
 const template=s.party[0];
 s.party=members.map(({moves,...member},index)=>({...structuredClone(template),...member,
  xp:0,xpToNext:xpThreshold(member.level),hp:member.maxHp,iframes:1e6,
  learnedMoves:moves.map(([moveId,rank])=>({moveId,rank,cooldown:0})),
  x:index*.5,z:0,cooldown:0,specialCooldown:0}));
 s.player.hp=s.player.maxHp=s.party[0].maxHp;s.player.iframes=1e6;
 return sim;
}

/** Incoming hits are disabled to measure duration independently of survival.
 * Ordinary arrivals, summons, targeting, boss movement and both stages are real.
 * XP/upgrades are frozen so the weaker 15-minute build must finish the fight. */
export function runReportedBossExperiment({mapId='wildlands',seed=1883105034,adds=true,limit=480}={}){
 const sim=createReportedBossRun({mapId,seed}),s=sim.state;
 if(!adds)sim.spawnAccum=-1e6;
 const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
 sim.update(.02,idle);
 const target=s.enemies.find(enemy=>enemy.isBoss),started=s.stats.elapsed;
 const estimatedDps=estimatedBuildDps(s).withAbility;
 Object.assign(target,{x:8,z:0});
 let reachedSecondStage=false,peakAdds=0;
 for(let tick=0;tick<limit*25&&!target.dead;tick++){
  const dx=target.x-s.player.x,dz=target.z-s.player.z,distance=Math.max(.001,Math.hypot(dx,dz));
  // Stay within attack range while circling; this is a reproducible throughput
  // policy, not a claim about human dodging or survival.
  const nx=dx/distance,nz=dz/distance,radial=Math.max(-1,Math.min(1,(distance-8)*.3));
  sim.update(.04,{...idle,mx:nx*radial+nz*.5,mz:nz*radial-nx*.5,
   special:tick%2===0,aimX:nx,aimZ:nz});
  reachedSecondStage ||= target.bossStage===1;
  peakAdds=Math.max(peakAdds,s.enemies.filter(enemy=>!enemy.dead&&!enemy.isBoss).length);
 }
 const seconds=s.stats.elapsed-started;
 return {mapId,seed,adds,maxHp:target.maxHp,seconds:Number(seconds.toFixed(2)),defeated:target.dead,
  estimatedDps:Number(estimatedDps.toFixed(2)),bossDps:Number(((target.maxHp-Math.max(0,target.hp))/seconds).toFixed(2)),
  reachedSecondStage,peakAdds,hpRemaining:Math.max(0,target.hp)};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const file=process.argv[2]?JSON.parse(readFileSync(process.argv[2],'utf8')):undefined;
 const saved=file?.snapshot.state;
 const boss=saved?.enemies.find(enemy=>enemy.isBoss&&!enemy.dead);
 const restored=file?Simulation.restore(file.snapshot):undefined;
 const resumedBoss=restored?.state.enemies.find(enemy=>enemy.isBoss&&!enemy.dead);
 console.log(JSON.stringify({
  calculation:bossHealthCalculation(saved?{elapsed:saved.stats.elapsed,spawnedAt:900,maxHp:boss.maxHp,hp:boss.hp}:undefined),
  ...(resumedBoss?{importedSave:{bossHp:resumedBoss.hp,bossMaxHp:resumedBoss.maxHp,phase:restored.state.phase,result:restored.state.result}}:{}),
  conditions:'Reported 15:00 party, ranks, learned moves, training and relics. Normal arrivals and summons; both boss stages and movement. Circling at 8m with aimed Q. Incoming hits disabled; no XP or upgrades. Duration only.',
  results:['wildlands','volcanic-ridge'].flatMap(mapId=>[1883105034,8841].map(seed=>runReportedBossExperiment({mapId,seed}))),
 },null,2));
}
