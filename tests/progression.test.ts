import test from 'node:test';
import assert from 'node:assert/strict';
import {DESIGN} from '../src/data/config.ts';
import {KANTO,getSpecies} from '../src/data/kanto.ts';
import {ITEMS} from '../src/data/items.ts';
import {PROGRESSION,TRAINING_UPGRADES} from '../src/data/progression.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {applyChoice,canRecruit,eligibleEvolutions,makeChoices,maxMoveRank,moveRankGain,weightedUpgradeChoices} from '../src/game/systems/progression.ts';
import type {UpgradeChoice} from '../src/game/types.ts';
import {RNG} from '../src/utils/random.ts';
import {runPacingExperiment} from '../scripts/progression-pacing.mjs';

test('all five recruitment gates require exact time and level, with first-stage random candidates',()=>{
 assert.deepEqual(DESIGN.recruitUnlockSeconds,[165,420,690,960,1200]);
 assert.deepEqual(DESIGN.recruitUnlockLevels,[4,9,15,22,29]);
 for(let gate=0;gate<5;gate++){
  const state=new Simulation(1,9).state;state.recruitCount=gate;
  state.stats.level=DESIGN.recruitUnlockLevels[gate];state.stats.elapsed=DESIGN.recruitUnlockSeconds[gate]-.001;
  assert.equal(canRecruit(state),false);
  state.stats.elapsed+=.001;state.stats.level--;assert.equal(canRecruit(state),false);
  state.stats.level++;assert.equal(canRecruit(state),true);
  const choices=makeChoices(state,new RNG(gate+20));
  assert.equal(choices.length,3);assert.equal(new Set(choices.map(choice=>choice.id)).size,3);
  assert.ok(choices.every(choice=>choice.kind==='recruit'&&getSpecies(choice.speciesId!).stage===1));
 }
 const state=new Simulation(1,3).state;state.stats.level=10;state.stats.elapsed=200;
 const pools=new Set(Array.from({length:15},(_,seed)=>makeChoices(state,new RNG(seed+500)).map(choice=>choice.id).join(',')));
 assert.ok(pools.size>8,'Recruit species should vary by seeded candidate pool');
});

test('full slots and permanent faints cannot bypass recruitment schedule or duplicate evolution lines',()=>{
 const state=new Simulation(2,9).state;state.stats.level=99;state.stats.elapsed=200;
 const offer=makeChoices(state,new RNG(8));assert.ok(!offer.some(choice=>choice.speciesId===1));
 const recruited=applyChoice(state,offer[0]);assert.equal(recruited.applied,true);
 assert.equal(recruited.sourceUid,state.party[1].uid);state.party.splice(1);
 assert.equal(state.recruitCount,1);assert.equal(canRecruit(state),false);
 state.stats.elapsed=420;
 while(state.party.length<DESIGN.maxParty)state.party.push({...state.party[0],uid:state.idCounter++});
 assert.equal(canRecruit(state),false);assert.ok(makeChoices(state,new RNG(2)).every(choice=>choice.kind!=='recruit'));
 state.party.pop();assert.equal(canRecruit(state),true);
});

test('eligibility waits for a level selection, caches remain items and forged recruits are rejected',()=>{
 const state=new Simulation(1,13).state;state.stats.elapsed=165;state.stats.level=4;
 const cache=makeChoices(state,new RNG(5),'cache');assert.ok(cache.every(choice=>choice.kind==='item'));
 assert.equal(state.party.length,1);assert.equal(state.pendingRecruit,true);
 const recruit=makeChoices(state,new RNG(5))[0];
 assert.equal(applyChoice(state,{...recruit,speciesId:3,id:'recruit-3'}).applied,false);
 assert.equal(applyChoice(state,{...recruit,id:'recruit-999'}).applied,false);
 assert.equal(applyChoice(state,recruit).applied,true);
 state.stats.elapsed=420;state.stats.level=9;
 assert.equal(applyChoice(state,recruit).applied,false,'Old recruit card cannot spend a later gate');
 assert.equal(state.party.length,2);
});

test('every Eevee branch is explicit and only the selected branch evolves',()=>{
 for(const target of [134,135,136]){
  const state=new Simulation(133,10).state;state.stats.elapsed=300;state.stats.level=10;state.party[0].level=PROGRESSION.evolution.firstLevel;state.recruitCount=1;
  const choices=makeChoices(state,new RNG(1));
  assert.deepEqual(choices.filter(choice=>choice.kind==='evolve').map(choice=>choice.targetId).sort((a,b)=>a!-b!),[134,135,136]);
  assert.ok(choices.some(choice=>choice.kind==='attack'||choice.kind==='learn'),'An Eevee milestone can be spent without evolving');
  assert.equal(state.party[0].speciesId,133,'Displaying cards must not evolve');
  assert.equal(applyChoice(state,{id:'evolve-1',kind:'evolve',speciesId:1,title:'Evolve',description:'',rarity:'epic'}).applied,false);
  const result=applyChoice(state,choices.find(choice=>choice.targetId===target)!);
  assert.equal(result.applied,true);assert.equal(result.sourceUid,1);assert.equal(result.speciesChanged,target);
  assert.equal(state.party[0].speciesId,target);assert.equal(state.stats.evolutions,1);
  assert.equal(applyChoice(state,choices[0]).applied,false);
 }
});

test('second evolution requires new maturity and a fresh card for the current species',()=>{
 const state=new Simulation(4,10).state;state.stats.elapsed=300;state.stats.level=30;state.party[0].level=30;state.recruitCount=1;
 const legacy:UpgradeChoice={id:'evolve-1',kind:'evolve',speciesId:1,title:'Evolve',description:'',rarity:'epic'};
 const previousMaxHp=state.player.maxHp;state.player.hp=50;
 assert.equal(applyChoice(state,legacy).applied,true);assert.equal(state.party[0].speciesId,5);
 assert.equal(state.player.maxHp,previousMaxHp*1.25);assert.equal(state.player.hp,62.5);
 assert.deepEqual(eligibleEvolutions(state),[]);
 state.stats.elapsed=469.999;assert.deepEqual(eligibleEvolutions(state),[]);
 state.stats.elapsed=470;state.party[0].level=PROGRESSION.evolution.finalLevel-1;assert.deepEqual(eligibleEvolutions(state),[]);
 state.party[0].level=PROGRESSION.evolution.finalLevel;assert.deepEqual(eligibleEvolutions(state),[1]);
 assert.equal(applyChoice(state,legacy).applied,false);
 const fresh:UpgradeChoice={...legacy,id:'evolve-1-6',targetId:6,sourceSpeciesId:5};
 assert.equal(applyChoice(state,{...fresh,sourceSpeciesId:4}).applied,false);
 assert.equal(applyChoice(state,fresh).applied,true);assert.equal(state.party[0].speciesId,6);
 assert.equal(state.party[0].attackLevel,3);assert.equal(state.party[0].evolutionPower,.5);
 assert.equal(state.player.maxHp,previousMaxHp*1.25*1.25);
});

test('a follower evolution affects only that member, and a fainted owner cannot spend a card',()=>{
 const state=new Simulation(1,10).state;state.stats.elapsed=165;state.stats.level=20;
 const recruit:UpgradeChoice={id:'recruit-4',kind:'recruit',speciesId:4,title:'Recruit',description:'',rarity:'rare'};
 assert.equal(applyChoice(state,recruit).applied,true);
 const follower=state.party[1];follower.level=PROGRESSION.evolution.firstLevel;state.stats.elapsed=335;
 const evolution:UpgradeChoice={id:`evolve-${follower.uid}-5`,kind:'evolve',speciesId:follower.uid,sourceSpeciesId:4,targetId:5,title:'Evolve',description:'',rarity:'epic'};
 const leader=structuredClone(state.party[0]),player=structuredClone(state.player),previousHp=follower.hp;
 assert.equal(applyChoice(state,evolution).applied,true);
 assert.equal(follower.speciesId,5);assert.equal(follower.hp,previousHp*1.25);
 assert.equal(follower.attackLevel,2);assert.equal(follower.evolutionPower,.25);
 assert.deepEqual(state.party[0],leader);assert.deepEqual(state.player,player);
 const next={...evolution,id:`evolve-${follower.uid}-6`,sourceSpeciesId:5,targetId:6};
 state.party.splice(1);state.stats.elapsed=600;
 assert.equal(applyChoice(state,next).applied,false);
});

test('single-stage species gain faster move training at their own level five without a rank ceiling',()=>{
 for(const species of KANTO.filter(species=>species.stage===1&&!species.evolvesTo.length)){
  const state=new Simulation(species.id,10).state,member=state.party[0];state.stats.elapsed=9000;state.stats.level=99;
  assert.equal(maxMoveRank(species),Infinity);assert.equal(moveRankGain(state,member),1,'Elapsed time and squad levels do not grant mastery');
  const upgrade:UpgradeChoice={id:'attack-1-1',kind:'attack',speciesId:1,sourceSpeciesId:species.id,rank:2,
   amount:1,title:'Move',description:'',rarity:'common'};
  assert.equal(applyChoice(state,{...upgrade,amount:999}).applied,false);
  assert.equal(applyChoice(state,upgrade).applied,true);assert.equal(member.attackLevel,2);
  assert.equal(applyChoice(state,upgrade).applied,false,'Repeated move card is stale');
  member.level=5;state.stats.elapsed=0;assert.equal(moveRankGain(state,member),2,'Personal training unlocks mastery even early in the run');
  assert.equal(applyChoice(state,{...upgrade,id:'attack-1-2',amount:1,rank:3}).applied,false,'Old single-rank cards cannot bypass mastery');
  assert.equal(applyChoice(state,{...upgrade,id:'attack-1-2',amount:2,rank:4}).applied,true);
  member.attackLevel=11;assert.equal(moveRankGain(state,member),2);
  assert.equal(applyChoice(state,{...upgrade,id:'attack-1-11',amount:2,rank:13}).applied,true);
  assert.equal(moveRankGain(state,member),2);
 }
 assert.equal(maxMoveRank(getSpecies(1)),Infinity);
 for(const species of KANTO.filter(species=>species.stage>1)){
  const state=new Simulation(species.id,10).state;state.party[0].level=99;state.stats.elapsed=9000;
  assert.equal(maxMoveRank(species),Infinity,'All species support unlimited move training');
  assert.equal(moveRankGain(state,state.party[0]),1);
 }
});

test('training keeps canonical amounts and stale-card guards beyond the old caps',()=>{
 for(const definition of TRAINING_UPGRADES){
  const state=new Simulation(1,5).state;
  for(let rank=1;rank<=30;rank++){
   const upgrade:UpgradeChoice={...definition,kind:'stat',rank,category:'training'};
   for(const amount of [-1,0,Infinity,NaN,100000])assert.equal(applyChoice(state,{...upgrade,amount}).applied,false);
   assert.equal(applyChoice(state,{...upgrade,stat:'unknown'}).applied,false);
   assert.equal(applyChoice(state,upgrade).applied,true);
   assert.equal(applyChoice(state,upgrade).applied,false,'Same training rank cannot be applied twice');
  }
  assert.ok(Math.abs(state.buffs[definition.stat]-30*definition.amount)<1e-9);
 }
});

test('upgrade rarity follows configured weights and luck improves high rarity odds',()=>{
 const pool:UpgradeChoice[]=(['common','rare','epic'] as const).map(rarity=>({id:rarity,kind:'item',rarity,title:rarity,description:''}));
 const rng=new RNG(62342),luckyRng=new RNG(62342),counts={common:0,rare:0,epic:0},lucky={common:0,rare:0,epic:0};
 for(let roll=0;roll<20000;roll++){
  counts[weightedUpgradeChoices(pool,1,rng)[0].rarity]++;
  lucky[weightedUpgradeChoices(pool,1,luckyRng,.4)[0].rarity]++;
 }
 for(const rarity of ['common','rare','epic'] as const)assert.ok(Math.abs(counts[rarity]/20000-PROGRESSION.rarityWeights[rarity]/100)<.015,`${rarity}: ${counts[rarity]}`);
 assert.ok(lucky.rare>counts.rare);assert.ok(lucky.epic>counts.epic);
 const duplicated=[...pool,...pool];
 assert.equal(new Set(weightedUpgradeChoices(duplicated,20,new RNG(1)).map(choice=>choice.id)).size,3);
});

test('owned relics disappear while high-rank training remains available and categorized',()=>{
 const state=new Simulation(113,3).state;state.party[0].attackLevel=100;state.party[0].level=100;
 state.items=ITEMS.slice(1).map(item=>item.id);
 const training=makeChoices(state,new RNG(8));
 assert.equal(training.length,3);assert.ok(training.some(choice=>choice.kind==='attack'&&choice.rank!>100));
 assert.ok(training.every(choice=>choice.category&&choice.maxRank===undefined));
 const options=makeChoices(state,new RNG(8),'cache');assert.deepEqual(options.map(option=>option.id),[ITEMS[0].id]);
 assert.equal(options[0].category,'item');assert.equal(applyChoice(state,options[0]).applied,true);
 assert.equal(applyChoice(state,options[0]).applied,false);
 assert.ok(makeChoices(state,new RNG(8),'cache').every(choice=>choice.kind==='stat'));
});

test('six seeded 15-minute routes reach four living members; six slots require endless timing',()=>{
 const runs=runPacingExperiment({seeds:[1001,1198,1395,1592,1789,1986]});
 assert.equal(runs.length,6);
 for(const run of runs){
  assert.equal(run.elapsed,900);assert.equal(run.living,4,`Seed ${run.seed}: ${JSON.stringify(run)}`);
  assert.equal(run.recruits,3);assert.equal(run.faints,0);assert.ok(run.level>=15);
  assert.ok(run.leaderLevel>=24&&run.leaderLevel<=35,`Leader target with tougher late encounters is level 24–35 at 15 minutes: ${JSON.stringify(run)}`);
 }
 const state=new Simulation(1,4).state;state.stats.level=99;
 for(const time of DESIGN.recruitUnlockSeconds){state.stats.elapsed=time;assert.equal(applyChoice(state,makeChoices(state,new RNG(time))[0]).applied,true);}
 assert.equal(state.party.length,6);assert.equal(state.recruitCount,5);assert.equal(canRecruit(state),false);
});
