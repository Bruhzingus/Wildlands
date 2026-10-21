import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,type GameEvent} from '../src/game/Simulation.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};

test('selected Quickened rules apply to the opening enemies as well as future arrivals',()=>{
 const normal=new Simulation(25,46837),quick=new Simulation(25,46837,{challenge:'quickened'});
 assert.equal(quick.state.enemies.length,3);
 quick.state.enemies.forEach((enemy,index)=>{const original=normal.state.enemies[index];assert.equal(enemy.speciesId,original.speciesId);assert.equal(enemy.x,original.x);assert.equal(enemy.speed,original.speed*1.2);assert.equal(enemy.damage,original.damage);});
});

test('Famine disables field, relic, drop and passive healing without changing normal runs',()=>{
 for(const famine of [false,true]){
  const sim=new Simulation(1,700),s=sim.state;
  s.challenge=famine?'famine':'standard';s.player.hp=30;s.items=['leftovers'];s.enemies=[];
  s.party.push({...s.party[0],uid:s.idCounter++,speciesId:7,hp:30,maxHp:155});
  s.pois=[{uid:999,x:0,z:0,kind:'healing',used:false}];
  s.drops=[{uid:s.idCounter++,x:0,z:0,age:0,value:10,kind:'heal'}];
  sim.update(.02,{...idle,interact:true});
  const hpAfter=s.player.hp,memberAfter=s.party[1].hp;
  (sim as unknown as {applyBuildAction:(action:unknown)=>void}).applyBuildAction({kind:'heal',sourceId:1,amount:8,target:'squad',depth:0});
  if(famine){assert.equal(hpAfter,30);assert.equal(memberAfter,30);assert.equal(s.player.hp,30);assert.equal(s.party[1].hp,30);}
  else {assert.ok(hpAfter>30);assert.ok(memberAfter>30);assert.ok(s.player.hp>hpAfter);assert.ok(s.party[1].hp>memberAfter);}
 }
});

test('semantic enemy kills carry one actual variant identity and endless starts at victory continuation',()=>{
 const sim=new Simulation(25,701),s=sim.state,events:GameEvent[]=[];sim.onEvent=event=>events.push(event);
 const enemy=createEnemy(s,sim.rng,19,'rocket',1,1);s.enemies=[enemy];
 const kill=(sim as unknown as {killEnemy:(enemy:typeof s.enemies[number])=>void}).killEnemy.bind(sim);
 kill(enemy);kill(enemy);const kills=events.filter(event=>event.kind==='kill');
 assert.equal(kills.length,1);assert.equal(kills[0].variant,'rocket');assert.equal(kills[0].speciesId,19);assert.equal(kills[0].targetId,enemy.uid);
 s.stats.elapsed=927.5;s.phase='result';s.result='victory';sim.continueEndless();
 assert.equal(s.endlessStartedAt,927.5);sim.continueEndless();assert.equal(s.endlessStartedAt,927.5);
});
