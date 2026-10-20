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
 for(const x of [-113,0,113])for(const z of [-113,0,113])for(let seed=1;seed<=64;seed++){
  Object.assign(s.player,{x,z,facing:seed*Math.PI/8});
  const enemy=spawnRandomEnemy(s,new RNG(seed));assert.ok(enemy);
  assertSpawn(enemy,s.player,24,34);
 }
});

test('spawn positions are deterministic and boss rings stay clear near boundaries',()=>{
 for(const x of [-113,0,113])for(const z of [-113,0,113])for(let seed=1;seed<=32;seed++){
  const player={x,z,facing:seed*Math.PI/8};
  const position=enemySpawnPosition(player,new RNG(seed),30,38);
  assertSpawn(position,player,30,38);
  assert.deepEqual(position,enemySpawnPosition(player,new RNG(seed),30,38));
 }
});

test('repeated outward samples fall back inward after a bounded number of draws',()=>{
 class OutwardRNG extends RNG{calls=0;override next(){this.calls++;return 0;}}
 const player={x:113,z:113,facing:Math.PI/4+1.25},rng=new OutwardRNG();
 assertSpawn(enemySpawnPosition(player,rng),player,24,34);
 assert.equal(rng.calls,18,'Eight attempts and one fallback should cap the sampling work');
});

test('opening enemies use the same distant ring as later waves',()=>{
 for(let seed=1;seed<=24;seed++){
  const s=new Simulation(1,seed).state;
  assert.equal(s.enemies.length,8);
  for(const enemy of s.enemies)assertSpawn(enemy,s.player,24,34);
 }
});

test('scheduled bosses keep their spawn distance when the player reaches a corner',()=>{
 const sim=new Simulation(1,42),s=sim.state;
 Object.assign(s.player,{x:113,z:113});s.stats.elapsed=DESIGN.bossAtSeconds-.01;s.enemies=[];
 sim.update(.02,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});
 const boss=s.enemies.find(enemy=>enemy.isBoss);assert.ok(boss);
 assertSpawn(boss,s.player,30,38);
});
