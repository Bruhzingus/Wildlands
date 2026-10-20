/**
 * Deterministic combat load test: node --experimental-strip-types scripts/build-stress.mjs
 * This isolates throughput, numerical safety and caps; it is not a survival/balance test.
 * Targets have 280 HP, stand still and cannot retaliate. Dead targets are replenished.
 * Party HP is never reset, damage/healing use the game, XP selections are suppressed.
 * Every case runs 60 game seconds at 30 simulation updates/second without rendering.
 */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {Simulation} from '../src/game/Simulation.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {getSpecies} from '../src/data/kanto.ts';
import {ITEMS} from '../src/data/items.ts';
import {DESIGN} from '../src/data/config.ts';
import {BUILD_LIMITS,BUILD_STAT_CAPS,getBuildModifiers,getBuildSummary} from '../src/game/systems/builds.ts';

const DT=1/30,FRAMES=1800,TARGETS=DESIGN.maxEnemies;
const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
const cases=[
 {name:'chain-lightning',party:[25,81,100],items:['storm-coil','static-orb','echo-bell','quick-claw','charged-band','binding-thread','life-orb','leftovers']},
 {name:'wide-aoe',party:[6,3,94],items:['wide-lens','long-barrel','echo-bell','blast-seed','binding-thread','toxic-barb','life-orb','leftovers']},
 {name:'crit-burst',party:[63,92,133],items:['scope-lens','razor-claw','prism-shard','static-orb','multi-lens','piercing-fang','critical-capacitor','quick-claw']},
 {name:'all-items-extreme',party:[25,81,7,3,6,94],items:ITEMS.map(item=>item.id)},
];
const round=value=>Math.round(value*1000)/1000;
function finiteTree(value,path='state'){
 if(typeof value==='number'){assert.ok(Number.isFinite(value),`${path} is not finite`);return;}
 if(!value||typeof value!=='object'||value instanceof Set)return;
 for(const [key,child] of Object.entries(value))finiteTree(child,`${path}.${key}`);
}
function run(definition,index){
 const simulation=new Simulation(definition.party[0],1701+index),s=simulation.state;
 s.enemies=[];s.pois=[];s.items=[...definition.items];s.stats.level=15;
 // Keep the combat scenario constant; rewards still accrue, choices do not interrupt it.
 s.stats.xpToNext=Number.MAX_SAFE_INTEGER;s.buffs={power:.36,haste:.28,crit:.06,armor:2};
 s.party=definition.party.map((speciesId,slot)=>({...s.party[0],uid:slot? s.idCounter++:1,speciesId,attackLevel:6,cooldown:slot*.1}));
 const counters={damageHits:0,criticalHits:0,chainSegments:0,areaAttacks:0,specials:0,statusEvents:0,procActions:0,offensiveProcActions:0,resourceActions:0,procsByKind:{}};
 const maxima={enemies:0,projectiles:0,drops:0,procActionsPer100ms:0,offensiveProcActionsPer100ms:0,resourceActionsPer100ms:0,runtimeBytes:0,statusOwners:0};
 const procWindows=new Map();
 simulation.onEvent=event=>{
  if(event.kind==='hit'&&event.damageTo==='enemy'){counters.damageHits++;if(event.shape==='crit')counters.criticalHits++;}
  if(event.kind==='chain')counters.chainSegments++;
  if(event.kind==='attack'&&['slash','burst','aura'].includes(event.shape))counters.areaAttacks++;
  if(event.kind==='special')counters.specials++;
  if(event.kind==='status')counters.statusEvents++;
 };
 // Read-only instrumentation around the real action interpreter, including nested actions.
 const applyAction=simulation.applyBuildAction.bind(simulation);
 simulation.applyBuildAction=action=>{
  counters.procActions++;counters.procsByKind[action.kind]=(counters.procsByKind[action.kind]||0)+1;
  const window=Math.floor(s.stats.elapsed/BUILD_LIMITS.windowSeconds),counts=procWindows.get(window)||{all:0,offensive:0,resource:0};counts.all++;
  if(['echo','chain','area','status'].includes(action.kind)){counts.offensive++;counters.offensiveProcActions++;}else{counts.resource++;counters.resourceActions++;}
  procWindows.set(window,counts);maxima.procActionsPer100ms=Math.max(maxima.procActionsPer100ms,counts.all);
  maxima.offensiveProcActionsPer100ms=Math.max(maxima.offensiveProcActionsPer100ms,counts.offensive);maxima.resourceActionsPer100ms=Math.max(maxima.resourceActionsPer100ms,counts.resource);
  assert.ok(action.depth<=BUILD_LIMITS.maxProcDepth);return applyAction(action);
 };
 let generated=0;
 function replenish(){
  s.enemies=s.enemies.filter(enemy=>!enemy.dead);
  while(s.enemies.length<TARGETS){
   const slot=generated++%TARGETS,x=(slot%14-6.5)*1.1,z=(Math.floor(slot/14)-6.5)*1.1;
   const enemy=createEnemy(s,simulation.rng,19,'normal',x,z);
   Object.assign(enemy,{hp:280,maxHp:280,speed:0,hitCooldown:1e6,attackCooldown:1e6});s.enemies.push(enemy);
  }
 }
 const frameTimes=[];const start=performance.now();
 for(let frame=0;frame<FRAMES;frame++){
  replenish();maxima.enemies=Math.max(maxima.enemies,s.enemies.length);
  const before=performance.now();simulation.update(DT,{...idle,special:frame%30===0});frameTimes.push(performance.now()-before);
  assert.equal(s.result,null,`${definition.name} ended before the requested time`);assert.equal(s.phase,'playing');
  maxima.projectiles=Math.max(maxima.projectiles,s.projectiles.length);maxima.drops=Math.max(maxima.drops,s.drops.length);
  maxima.statusOwners=Math.max(maxima.statusOwners,simulation.statusOwners.size);
  assert.ok(s.enemies.length<=DESIGN.maxEnemies);assert.ok(s.projectiles.length<=DESIGN.maxProjectiles);assert.ok(s.drops.length<=DESIGN.maxActiveDrops);
  if(s.build)assert.ok(s.build.actionsInWindow<=BUILD_LIMITS.maxActionsPerWindow);
  if(frame%30===0){
   finiteTree(s);maxima.runtimeBytes=Math.max(maxima.runtimeBytes,JSON.stringify(s.build||{}).length);
   for(const member of s.party)for(const [stat,value] of Object.entries(getBuildModifiers(s,member)))assert.ok(value<=BUILD_STAT_CAPS[stat]);
  }
 }
 finiteTree(s);assert.ok(s.stats.elapsed>=60-1e-8);assert.ok(s.stats.damageDealt>0);assert.ok(s.stats.kills>0);
 assert.ok(maxima.offensiveProcActionsPer100ms<=BUILD_LIMITS.maxActionsPerWindow);assert.ok(maxima.runtimeBytes<8000);assert.ok(maxima.statusOwners<=DESIGN.maxEnemies);
 if(definition.name==='chain-lightning')assert.ok(counters.chainSegments>counters.areaAttacks);
 if(definition.name==='wide-aoe')assert.ok(counters.areaAttacks>counters.chainSegments);
 if(definition.name==='crit-burst')assert.ok(counters.criticalHits>0);
 frameTimes.sort((a,b)=>a-b);const summary=getBuildSummary(s);
 return {
  name:definition.name,seed:s.seed,seconds:round(s.stats.elapsed),party:s.party.map(member=>getSpecies(member.speciesId).name),items:definition.items.length,
  hpAtEnd:round(s.player.hp),followersRemaining:s.party.length-1,totalDamage:round(s.stats.damageDealt),kills:s.stats.kills,xp:round(s.stats.xp),...counters,maxima,
  synergies:summary.synergies.map(synergy=>synergy.title),leaderModifiers:summary.modifiers,
  cpuMilliseconds:round(performance.now()-start),simulationFrameCpuMs:{median:round(frameTimes[Math.floor(frameTimes.length*.5)]),p95:round(frameTimes[Math.floor(frameTimes.length*.95)]),max:round(frameTimes.at(-1))},
 };
}
console.log(JSON.stringify({
 conditions:{secondsPerCase:60,simulationHz:30,targetCount:TARGETS,targetHp:280,targetSpecies:'Rattata',targets:'stationary, non-retaliating, replenished after death',partyHpMaintenance:false,partyMoveRank:6,levelUps:'suppressed to keep each build constant',specialInput:'one tap each second, normal cooldown respected',rendering:false,interpretation:'CPU simulation and caps only; no browser FPS or survival balance claim'},
 results:cases.map(run),
},null,2));
