import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,type GameEvent} from '../src/game/Simulation.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {addProjectile} from '../src/game/combat/projectiles.ts';
import {ImpactFeedback} from '../src/game/feedback.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};

test('hostile impacts retain their attacker so only actual boss damage triggers feedback',()=>{
 for(const boss of [false,true]){
  const sim=new Simulation(7,101),s=sim.state,events:GameEvent[]=[],feedback=new ImpactFeedback();sim.onEvent=event=>events.push(event);
  const enemy=createEnemy(s,sim.rng,boss?150:19,boss?'legendary':'normal',20,0,false,boss);enemy.speed=0;enemy.attackCooldown=1000;
  s.enemies=[enemy];s.party[0].cooldown=1000;
  addProjectile(s,{x:-1,z:0,vx:50,vz:0,ttl:1,damage:7,size:.2,kind:'bolt',type:'psychic',penetration:0,friendly:false,sourceId:enemy.uid,poisonChance:0});
  sim.update(.04,idle);
  const hit=events.find(event=>event.kind==='hit'&&event.damageTo==='player')!;
  assert.equal(hit.sourceId,enemy.uid);assert.equal(hit.targetId,s.party[0].uid);assert.equal(hit.amount,7);assert.equal(s.player.hp,113);
  assert.equal(feedback.onEvent(hit,s),boss);assert.equal(feedback.inspect().freeze,boss);
 }
});

test('a permanent follower faint emits one semantic notification and keeps its run log',()=>{
 const sim=new Simulation(7,102),s=sim.state,events:GameEvent[]=[];sim.onEvent=event=>events.push(event);
 const member={...s.party[0],uid:s.idCounter++,speciesId:25,hp:.001,poisonTime:1};s.party.push(member);s.enemies=[];s.recruitCount=1;
 sim.update(.02,idle);sim.update(.02,idle);
 const notifications=events.filter(event=>event.kind==='faint');assert.equal(notifications.length,1);assert.equal(notifications[0].sourceId,member.uid);
 assert.match(notifications[0].label!,/Pikachu fainted/);assert.equal(s.eventLog[0],notifications[0].label);assert.equal(s.recruitCount,1);assert.equal(s.stats.faints,1);
});

test('choice result distinguishes actual selection from repeated or rejected input for menu feedback',()=>{
 const sim=new Simulation(7,103),s=sim.state;
 sim.debugLevel();sim.update(.02,idle);assert.equal(s.phase,'choice');
 const choice=s.upgradeChoices.find(choice=>choice.kind!=='item')??s.upgradeChoices[0];
 assert.equal(sim.choose('missing'),false);assert.equal(sim.choose(choice.id),true);assert.equal(sim.choose(choice.id),false);
});
