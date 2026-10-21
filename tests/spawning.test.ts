import test from 'node:test';
import assert from 'node:assert/strict';
import {DESIGN} from '../src/data/config.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {enemySpawnPosition,spawnRandomEnemy} from '../src/game/systems/spawning.ts';
import {RNG} from '../src/utils/random.ts';
import type {Vec2} from '../src/game/types.ts';

function assertSpawn(position:Vec2,player:Vec2,minDistance:number,maxDistance:number){
 const distance=Math.hypot(position.x-player.x,position.z-player.z),bound=DESIGN.mapRadius-4;
 assert.ok(distance>=minDistance-1e-8&&distance<=maxDistance+1e-8,`Spawn was ${distance} units from player at ${player.x}, ${player.z}`);
 assert.ok(Math.abs(position.x)<=bound&&Math.abs(position.z)<=bound,`Spawn left arena at ${position.x}, ${position.z}`);
}

test('random enemies spawn 24–34 units away at the center, edges and corners',()=>{
 const sim=new Simulation(1,10),s=sim.state;
 for(const x of [-113*1.25,0,113*1.25])for(const z of [-113*1.25,0,113*1.25])for(let seed=1;seed<=64;seed++){
  Object.assign(s.player,{x,z,facing:seed*Math.PI/8});
  const enemy=spawnRandomEnemy(s,new RNG(seed));assert.ok(enemy);
  assertSpawn(enemy,s.player,24,34);
 }
});

test('spawn positions are deterministic and boss rings stay clear near boundaries',()=>{
 for(const x of [-113*1.25,0,113*1.25])for(const z of [-113*1.25,0,113*1.25])for(let seed=1;seed<=32;seed++){
  const player={x,z,facing:seed*Math.PI/8};
  const position=enemySpawnPosition(player,new RNG(seed),30,38);
  assertSpawn(position,player,30,38);
  assert.deepEqual(position,enemySpawnPosition(player,new RNG(seed),30,38));
 }
});

test('repeated outward samples fall back inward after a bounded number of draws',()=>{
 class OutwardRNG extends RNG{calls=0;override next(){this.calls++;return 0;}}
 const player={x:113*1.25,z:113*1.25,facing:Math.PI/4+1.25},rng=new OutwardRNG();
 assertSpawn(enemySpawnPosition(player,rng),player,24,34);
 assert.equal(rng.calls,18,'Eight attempts and one fallback should cap the sampling work');
});

test('opening enemies use the same distant ring as later waves',()=>{
 for(let seed=1;seed<=24;seed++){
  const s=new Simulation(1,seed).state;
  assert.equal(s.enemies.length,3);
  for(const enemy of s.enemies)assertSpawn(enemy,s.player,24,34);
 }
});

test('actual arrivals stay sparse in the first minute and build gradually through the run',()=>{
 const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
 function arrivals(elapsed:number){
  const sim=new Simulation(1,414),s=sim.state;s.enemies=[];s.stats.elapsed=elapsed;s.player.iframes=10000;s.party[0].cooldown=1e6;
  // Clear arrivals before they engage so combat, despawns and the active cap do not mask pacing.
  for(let frame=0;frame<1500;frame++){sim.update(.04,idle);s.enemies=[];}
  assert.equal(s.director!.denied,0);return s.director!.spawned;
 }
 const samples=[0,180,420,780].map(arrivals);
 assert.ok(samples[0]>=20&&samples[0]<=24,`Opening should have roughly one arrival per 2.8s, got ${samples[0]}`);
 assert.ok(samples[1]>=32&&samples[1]<=37);assert.ok(samples[2]>=49&&samples[2]<=54);assert.ok(samples[3]>=84&&samples[3]<=86);
 assert.ok(samples.every((count,index)=>index===0||count>samples[index-1]));
 assert.equal(arrivals(0),samples[0],'Seeded pacing is repeatable');
});

test('scheduled bosses keep their spawn distance when the player reaches a corner',()=>{
 const sim=new Simulation(1,42),s=sim.state;
 Object.assign(s.player,{x:113*1.25,z:113*1.25});s.stats.elapsed=DESIGN.bossAtSeconds-.01;s.enemies=[];
 sim.update(.02,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});
 const boss=s.enemies.find(enemy=>enemy.isBoss);assert.ok(boss);
 assertSpawn(boss,s.player,30,38);
});
