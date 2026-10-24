import {pathToFileURL} from 'node:url';
import {Simulation} from '../src/game/Simulation.ts';
import {getSpecies} from '../src/data/kanto.ts';
import {learnableMoves} from '../src/data/moves.ts';
import {xpThreshold} from '../src/game/systems/progression.ts';

/** Fixed, well-equipped level-48 party against isolated, non-retaliating targets.
 * Measures burst/endurance only; does not predict human survival or a specific save. */
export function runLateRunExperiment(){
 return ['gyarados','moltres'].map(encounter=>{
  const sim=new Simulation(9,8841,{mapId:'volcanic-ridge'}),s=sim.state;
  sim.gainXP=()=>{};
  sim.spawnAccum=-1e6;
  s.enemies=[];s.pois=[];s.terrainFeatures=[];s.recruitCount=5;
  s.stats.level=48;s.stats.elapsed=encounter==='gyarados'?600:899.99;
  s.buffs={power:.4,haste:.3,crit:.2};
  s.items=['life-orb','life-orb','life-orb-legendary','multi-lens','multi-lens','razor-claw','razor-claw','echo-bell','echo-bell-legendary','prism-shard','static-orb','metronome-ramp'];
  const template=s.party[0];
  s.party=[9,26,3,65].map((speciesId,index)=>({...structuredClone(template),uid:index?s.idCounter++:1,speciesId,
   level:48,xp:0,xpToNext:xpThreshold(48),attackLevel:8,hp:1000,maxHp:1000,iframes:1e6,
   learnedMoves:learnableMoves(speciesId,44).filter(move=>move.profile.kind!=='heal').slice(0,2).map(move=>({moveId:move.id,rank:6,cooldown:0})),
   x:index*.5,z:0,cooldown:0}));
  s.player.hp=s.player.maxHp=1000;s.player.iframes=1e6;
  let target;
  if(encounter==='gyarados'){
   const site={uid:s.idCounter++,x:6,z:0,kind:'shrine',shrineTier:9,used:false};
   s.pois=[site];sim.activatePOI(site);target=s.enemies.find(enemy=>enemy.shrineGuardian);
  }else{
   sim.update(.02,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});
   target=s.enemies.find(enemy=>enemy.isBoss);
  }
  Object.assign(target,{x:6,z:0,speed:0,attackCooldown:1e6,hitCooldown:1e6});
  const started=s.stats.elapsed,openingHp=target.hp;
  let hpAtPointTwo=openingHp;
  for(let tick=0;tick<4500&&!target.dead;tick++){
   // Keep the throughput target in place: Surf knockback otherwise pushes a
   // non-retaliating guardian outside attack range during the longer fight.
   target.x=6;target.z=0;
   sim.update(.04,{mx:0,mz:0,jump:false,dodge:false,special:tick%25===0,interact:false,aimX:1,aimZ:0});
   if(tick===4)hpAtPointTwo=Math.max(0,target.hp);
  }
  return {encounter,level:48,party:s.party.map(member=>getSpecies(member.speciesId).name),
   maxHp:target.maxHp,seconds:Number((s.stats.elapsed-started).toFixed(2)),defeated:target.dead,
   openingBurstFraction:Number(((openingHp-hpAtPointTwo)/openingHp).toFixed(4)),hpRemaining:Math.max(0,target.hp)};
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify({
 conditions:'Fixed level-48 four-member party; rank-8 signatures, two rank-6 learned moves each, twelve relics and squad training. Targets cannot retaliate. No XP, rendering or normal spawns. Throughput only.',
 results:runLateRunExperiment(),
},null,2));
