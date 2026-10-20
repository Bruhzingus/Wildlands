import {Simulation} from '../src/game/Simulation.ts';
import {pathToFileURL} from 'node:url';

/** Isolated tactical boss experiment; no health maintenance or damage overrides. */
export function runBossExperiment(){
 return [[9,26,3],[9,26,3,65],[6,38,123],[25,81,131,65]].map((species,index)=>{
  const sim=new Simulation(species[0],7001+index),s=sim.state;
  // Keep this isolated fight at the stated fixed build. Per-member XP can
  // otherwise open a paused level-up modal which the tactical script cannot use.
  sim.gainXP=()=>{};
  s.enemies=[];s.stats.elapsed=899.99;s.stats.level=20;s.stats.xpToNext=1e12;
  const leader=s.party[0];leader.speciesId=species[0];leader.attackLevel=4;
  for(const id of species.slice(1))s.party.push({...leader,uid:s.idCounter++,speciesId:id,hp:165,maxHp:165,cooldown:.35});
  s.items=['quick-claw','wide-lens','scope-lens'];
  sim.update(.02,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});
  // Place the scheduled boss in the clear starting meadow for a repeatable fight.
  const boss=s.enemies.find(enemy=>enemy.isBoss);boss.x=12;boss.z=0;
  const started=s.stats.elapsed;let ticks=0;
  while(s.result===null&&s.stats.elapsed-started<120){
   const dx=boss.x-s.player.x,dz=boss.z-s.player.z,distance=Math.hypot(dx,dz)||1;
   const radial=(distance-10)*.55;
   const ringNear=(s.psychicRings||[]).some(ring=>{const gap=Math.hypot(s.player.x-ring.x,s.player.z-ring.z)-ring.radius;return gap>0&&gap<3;});
   sim.update(.04,{mx:dx/distance*radial+dz/distance,mz:dz/distance*radial-dx/distance,
    jump:ringNear&&s.player.y===0,dodge:ticks%80===0,special:ticks%410===0,interact:false});
   ticks++;
  }
  return {species,seed:s.seed,result:s.result||'timeout',seconds:Number((s.stats.elapsed-started).toFixed(2)),
   playerHP:Number(s.player.hp.toFixed(2)),bossHP:Number(boss.hp.toFixed(2)),bossMaxHP:boss.maxHp,living:s.party.length,faints:s.stats.faints,
   damageTaken:Number(s.stats.damageTaken.toFixed(2)),peakBudget:s.director?.enemyBudget};
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify({
 experiment:'Isolated seeded boss fights in clear meadow; level20, rank4, three named passives, tactical orbit/jumps/dodges; XP disabled to retain the fixed build; no HP maintenance. Not human balance proof.',
 results:runBossExperiment()},null,2));
