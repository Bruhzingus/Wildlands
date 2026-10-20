/** CPU/memory stress, deliberately above normal actor budgets. Never a survival
 * or GPU benchmark. Run with --expose-gc for comparable retained-heap samples. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {mkdir,writeFile} from 'node:fs/promises';
import {Simulation} from '../src/game/Simulation.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {addProjectile} from '../src/game/combat/projectiles.ts';
import {DESIGN} from '../src/data/config.ts';

const seconds=Number(process.argv.find(arg=>arg.startsWith('--seconds='))?.split('=')[1]??1800);
assert.ok(Number.isFinite(seconds)&&seconds>=1&&seconds<=7200,'--seconds must be 1–7200');
const sim=new Simulation(25,13014),s=sim.state,dt=1/30;
s.endless=true;s.endlessStartedAt=900;s.stats.elapsed=900;s.bossSpawned=true;s.stats.level=30;s.stats.xpToNext=Number.MAX_SAFE_INTEGER;
s.player.iframes=100000;s.pois=[];sim.spawnAccum=-100000;
s.enemies=[];
s.items=['storm-coil','quick-claw','echo-bell','wide-lens','charged-band','leftovers'];
s.party=Array.from({length:7},(_,i)=>({...s.party[0],uid:i?s.idCounter++:1,speciesId:[25,3,6,9,94,65,81][i],attackLevel:6,cooldown:i*.1}));
for(let i=0;i<210;i++){
 const angle=i*Math.PI*2/210,e=createEnemy(s,sim.rng,19,'normal',Math.sin(angle)*(12+i%5),Math.cos(angle)*(12+i%5));
 Object.assign(e,{hp:1e9,maxHp:1e9,speed:0,damage:0,attackCooldown:1e6,hitCooldown:1e6});s.enemies.push(e);
}
const spans={enemies:0,attacks:0,projectiles:0},calls={enemies:0,attacks:0,projectiles:0};
for(const [method,key] of [['updateEnemies','enemies'],['updateAttacks','attacks'],['updateProjectiles','projectiles']]){
 const original=sim[method].bind(sim);sim[method]=(...args)=>{const start=performance.now();try{return original(...args);}finally{spans[key]+=performance.now()-start;calls[key]++;}};
}
const frames=[],checkpoints=[];let maxProjectiles=0,maxDrops=0;
function checkpoint(){globalThis.gc?.();checkpoints.push({endlessSeconds:Math.round(s.stats.elapsed-900),heapUsed:process.memoryUsage().heapUsed,enemies:s.enemies.length,projectiles:s.projectiles.length,drops:s.drops.length,statusOwners:sim.statusOwners.size});}
checkpoint();const start=performance.now(),frameCount=Math.ceil(seconds/dt);
for(let frame=0;frame<frameCount;frame++){
 while(s.drops.length<DESIGN.maxActiveDrops)s.drops.push({uid:s.idCounter++,x:45,z:45,value:0,age:0,kind:'xp'});
 while(s.projectiles.length<DESIGN.maxProjectiles)addProjectile(s,{x:40,z:frame%20,vx:0,vz:.01,ttl:5,damage:1,size:.12,kind:'bolt',type:'normal',penetration:0,friendly:true,sourceId:1,poisonChance:0});
 const before=performance.now();sim.update(dt,{mx:0,mz:0,jump:false,dodge:false,special:frame%30===0,interact:false});
 if(frame%30===0)frames.push(performance.now()-before);
 maxProjectiles=Math.max(maxProjectiles,s.projectiles.length);maxDrops=Math.max(maxDrops,s.drops.length);
 if(frame%9000===8999){checkpoint();assert.equal(s.phase,'playing');assert.equal(s.party.length,7);assert.ok(Number.isFinite(s.stats.damageDealt+s.player.hp));}
 assert.ok(s.projectiles.length<=DESIGN.maxProjectiles);assert.ok(s.drops.length<=DESIGN.maxActiveDrops);assert.equal(s.enemies.length,210);
}
checkpoint();frames.sort((a,b)=>a-b);
const round=value=>Math.round(value*1000)/1000;
const report={conditions:{seconds,simulationHz:30,seed:s.seed,enemies:210,party:7,projectileCap:DESIGN.maxProjectiles,targets:'stationary, huge-HP, non-retaliating',rendering:false,gc:Boolean(globalThis.gc),interpretation:'Reliability and CPU/memory only. Above normal190enemies/6party budgets. No survival or target-hardware GPU FPS claim.'},
 wallMs:round(performance.now()-start),elapsed:s.stats.elapsed,maxProjectiles,maxDrops,checkpoints,
 cpuMs:{median:round(frames[Math.floor(frames.length*.5)]),p95:round(frames[Math.floor(frames.length*.95)]),max:round(frames.at(-1))},
 spans:Object.fromEntries(Object.entries(spans).map(([key,value])=>[key,{totalMs:round(value),perStepMs:round(value/calls[key])}]))};
await mkdir('artifacts/performance',{recursive:true});await writeFile('artifacts/performance/endless-profile.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
