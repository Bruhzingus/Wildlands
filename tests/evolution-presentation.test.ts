import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,type GameEvent} from '../src/game/Simulation.ts';
import {getSpecies} from '../src/data/kanto.ts';
import type {UpgradeChoice} from '../src/game/types.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
for(const [from,to,follower] of [[4,5,false],[5,6,true],[133,134,false],[133,135,true],[133,136,false]] as const){
 test(`evolution receipt observes ${from} → ${to}, commits once and keeps health/ranks/UID`,()=>{
  const sim=new Simulation(from,8),s=sim.state,events:GameEvent[]=[];
  if(follower)s.party.push({...structuredClone(s.party[0]),uid:101});
  const member=s.party[follower?1:0];s.recruitCount=5;s.stats.elapsed=600;s.levelUpMemberId=member.uid;
  Object.assign(member,{joinedAt:0,evolvedAt:0,level:30,xp:17,hp:80,maxHp:160,attackLevel:3,
   learnedMoves:from===4?[{moveId:'flame-burst',rank:5,cooldown:2},{moveId:'swift',rank:2,cooldown:1}]:[]});
  s.player.hp=s.player.maxHp/2;const before=structuredClone(member),player=structuredClone(s.player);
  const choice:UpgradeChoice={id:`evolve-${member.uid}-${to}`,kind:'evolve',speciesId:member.uid,sourceSpeciesId:from,targetId:to,title:'Evolution',description:'',rarity:'epic'};
  sim.enterChoice([choice]);sim.onEvent=event=>events.push(event);
  const rng=structuredClone(sim.rng);assert.equal(sim.choose(choice.id),true);
  const receipt=events.find(event=>event.kind==='evolve')!.evolution!;
  assert.equal(receipt.uid,member.uid);assert.equal(receipt.from,from);assert.equal(receipt.to,to);
  assert.equal(receipt.hpBefore,follower?160:player.maxHp);assert.equal(receipt.hpAfter,follower?200:player.maxHp*1.25);assert.equal(receipt.powerGain,.25);
  assert.equal(receipt.level,30);assert.equal(receipt.xp,17);assert.equal(receipt.freedSlots,from===4?1:0);
  assert.equal(receipt.moves[0].name,getSpecies(to).moveName);assert.equal(receipt.moves[0].rank,from===4?6:4);
  assert.equal(member.hp/member.maxHp,before.hp/before.maxHp);assert.deepEqual(structuredClone(sim.rng),rng);
  assert.equal(s.player.hp,follower?player.hp:player.hp*1.25);
  const committed=structuredClone(s),detached=structuredClone(receipt);
  assert.equal(sim.choose(choice.id),false);assert.deepEqual(s,committed);
  sim.pause();const paused=structuredClone(s);for(let i=0;i<100;i++)sim.update(.02,idle);assert.deepEqual(s,paused);
  member.attackLevel++;assert.deepEqual(receipt,detached,'receipt must not hold live move state');
 });
}

test('stale or fainted evolution cannot start a presentation or resurrect a member',()=>{
 const sim=new Simulation(4,8),s=sim.state,events:GameEvent[]=[];sim.onEvent=e=>events.push(e);
 s.recruitCount=5;s.stats.elapsed=600;s.party[0].level=30;s.party[0].hp=0;
 sim.enterChoice([{id:'evolve-1-5',kind:'evolve',speciesId:1,sourceSpeciesId:4,targetId:5,title:'Evolution',description:'',rarity:'epic'}]);
 assert.equal(sim.choose('evolve-1-5'),false);assert.equal(s.party[0].hp,0);assert.equal(s.party[0].speciesId,4);
 assert.equal(events.filter(event=>event.evolution).length,0);assert.equal(s.stats.evolutions,0);
});

test('evolution presentation leaves combat running and opens queued rewards afterward',()=>{
 const sim=new Simulation(4,8),s=sim.state;
 s.recruitCount=5;s.stats.elapsed=600;s.party[0].level=30;s.party[0].joinedAt=0;
 s.player.iframes=100;s.pendingSquadRewards=1;
 const choice:UpgradeChoice={id:`evolve-${s.party[0].uid}-5`,kind:'evolve',speciesId:s.party[0].uid,sourceSpeciesId:4,targetId:5,title:'Evolution',description:'',rarity:'epic'};
 sim.enterChoice([choice]);assert.equal(sim.choose(choice.id,true),true);
 assert.equal(s.phase,'playing');assert.equal(s.pendingSquadRewards,1);
 const elapsed=s.stats.elapsed;sim.update(.04,idle);
 assert.ok(s.stats.elapsed>elapsed);assert.equal(s.phase,'playing');
 sim.resumeDeferredRewards();assert.equal(s.phase,'choice');assert.equal(s.pendingSquadRewards,0);
});
