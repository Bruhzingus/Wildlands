import test from 'node:test';
import assert from 'node:assert/strict';
import {PROGRESSION,TRAINING_UPGRADES} from '../src/data/progression.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {getBuildModifiers} from '../src/game/systems/builds.ts';
import {applyChoice,availableItemChoices,chestChoices,learnedMoveSlots,makeChoices,toRoman} from '../src/game/systems/progression.ts';
import {getAttackProfile} from '../src/data/attacks.ts';
import {getLearnedMoveProfile,learnedMovePower} from '../src/data/moves.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {RNG} from '../src/utils/random.ts';

const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

test('extra move slots unlock gradually, and stale learning cannot bypass the gates',()=>{
 const state=new Simulation(4,37).state,member=state.party[0];state.recruitCount=5;
 const card={id:'learn-1-swift',kind:'learn' as const,speciesId:1,moveId:'swift',title:'Swift',description:'',rarity:'rare' as const};
 for(const [level,slots] of [[3,0],[5,0],[9,0],[10,1],[19,1],[20,2],[29,2],[30,3]]){
  member.level=level;assert.equal(learnedMoveSlots(member),slots);
  if(!slots){
   assert.equal(applyChoice(state,card).applied,false);
   const choices=makeChoices(state,new RNG(level));
   assert.equal(choices.length,3);assert.ok(choices.every(choice=>choice.kind!=='learn'));
   assert.ok(choices.some(choice=>choice.kind==='attack'));assert.ok(choices.some(choice=>choice.kind==='stat'));
  }
 }
 member.level=10;assert.equal(applyChoice(state,card).applied,true);
 const second={...card,id:'learn-1-brick-break',moveId:'brick-break'};
 assert.equal(applyChoice(state,second).applied,false);
 member.level=20;assert.equal(applyChoice(state,second).applied,true);
});

test('learning is occasional while existing move and stat training stay in every normal milestone',()=>{
 const state=new Simulation(4,37).state;state.party[0].level=10;state.recruitCount=5;
 const rng=new RNG(7919);let learning=0;
 for(let roll=0;roll<2000;roll++){
  const choices=makeChoices(state,rng);
  assert.ok(choices.some(choice=>choice.kind==='attack'));assert.ok(choices.some(choice=>choice.kind==='stat'));
  const learned=choices.filter(choice=>choice.kind==='learn');assert.ok(learned.length<=1);learning+=learned.length;
 }
 assert.ok(Math.abs(learning/2000-PROGRESSION.moves.newMoveOfferChance)<.035);
});

test('each stat has stronger rarity variants with observable odds and no duplicate stat cards',()=>{
 const state=new Simulation(4,38).state,rng=new RNG(3907),seen=new Map(),counts={common:0,rare:0,epic:0};
 for(let roll=0;roll<1500;roll++){
  const choices=makeChoices(state,rng,'squad');
  assert.equal(new Set(choices.map(choice=>choice.stat)).size,choices.length);
  for(const choice of choices){seen.set(choice.id,choice);counts[choice.rarity]++;}
 }
 assert.equal(seen.size,TRAINING_UPGRADES.length*3);
 for(const rarity of ['common','rare','epic'] as const)assert.ok(Math.abs(counts[rarity]/4500-PROGRESSION.rarityWeights[rarity]/100)<.025);
 for(const definition of TRAINING_UPGRADES){
  for(const [rarity,multiplier] of [['common',1],['rare',2],['epic',3]] as const){
   const card=seen.get(rarity==='common'?definition.id:`${definition.id}-${rarity}`);
   assert.equal(card.title,definition.title);close(card.amount,definition.amount*multiplier);
   assert.match(card.description,new RegExp(`${Math.round(card.amount*100)}%`));
   assert.doesNotMatch(card.description,/percentage points|Rank \d+\//);assert.equal(card.maxRank,undefined);
  }
 }
 const common=seen.get('power'),rare=seen.get('power-rare'),epic=seen.get('power-epic');
 assert.equal(applyChoice(state,{...rare,amount:.12}).applied,false);
 assert.equal(applyChoice(state,rare).applied,true);close(state.buffs.power,.24);
 assert.equal(applyChoice(state,common).applied,false,'A sibling rarity from the same selection is stale too');
 assert.equal(applyChoice(state,{...epic,rank:2}).applied,true);close(state.buffs.power,.60);
 assert.equal(state.trainingRanks?.power,2);
});

test('team-only relics are unavailable solo, including stale selections after a faint',()=>{
 const state=new Simulation(4,39).state;state.itemUnlocks=['exp-share'];
 assert.deepEqual(availableItemChoices(state),[]);
 for(const source of ['cache','shop','squad','level'] as const)assert.ok(makeChoices(state,new RNG(5),source).every(choice=>choice.id!=='exp-share'));
 state.party.push({...structuredClone(state.party[0]),uid:42});
 const card=availableItemChoices(state).find(choice=>choice.id==='exp-share')!;assert.ok(card);
 state.party[1].hp=0;assert.deepEqual(availableItemChoices(state),[]);
 assert.equal(applyChoice(state,card).applied,false);
 state.party[1].hp=100;assert.equal(applyChoice(state,card).applied,true);
});

test('every training stack keeps benefiting combat beyond previous limits',()=>{
 const state=new Simulation(4,40).state;
 for(const definition of TRAINING_UPGRADES){
  for(let rank=1;rank<=24;rank++){
   const before=getBuildModifiers(state),maxHp=state.player.maxHp;
   assert.equal(applyChoice(state,{...definition,kind:'stat',rank}).applied,true);
   const after=getBuildModifiers(state);
   const stat=definition.stat==='crit'?'critChance':definition.stat as keyof typeof after;
   if(definition.stat==='health')assert.ok(state.player.maxHp>maxHp);
   else if(definition.stat==='crit')assert.ok(after.critChance>before.critChance||after.critDamage>before.critDamage);
   else assert.ok(after[stat]>before[stat],`${definition.id} rank ${rank} must improve combat`);
  }
 }
 const defense=makeChoices(state,new RNG(23),'squad').find(choice=>choice.stat==='damageReduction');
 // Verify a Rare defense card applies the full printed 16% to remaining damage.
 const rare={id:'armor-rare',kind:'stat' as const,stat:'damageReduction',amount:.16,rank:25,rarity:'rare' as const,title:'Iron Defense',description:''};
 const before=getBuildModifiers(state).damageReduction;
 assert.equal(applyChoice(state,rare).applied,true);close(1-getBuildModifiers(state).damageReduction,(1-before)*.84);
 assert.ok(!defense||defense.maxRank===undefined);
 assert.ok(getAttackProfile(4,30).range>getAttackProfile(4,12).range);
 assert.ok(getLearnedMoveProfile('swift',30).cooldown<getLearnedMoveProfile('swift',12).cooldown);
 assert.ok(learnedMovePower('swift',30)>learnedMovePower('swift',12));
 assert.notEqual(toRoman(13),toRoman(12));assert.notEqual(toRoman(50),toRoman(49));
});

test('high-rarity chests keep their advertised rarity after exhausting relics',()=>{
 const state=new Simulation(4,41).state;state.itemUnlocks=[];
 for(const rarity of ['rare','epic'] as const){
  const choices=chestChoices(state,new RNG(79),rarity);assert.equal(choices.length,3);
  assert.ok(choices.every(choice=>choice.kind==='stat'&&(rarity==='rare'?choice.rarity!=='common':choice.rarity==='epic')));
 }
});

test('attack-speed stacks keep increasing real damage after reaching the casting budget',()=>{
 for(const learned of [false,true]){
  const sim=new Simulation(7,93),state=sim.state,member=state.party[0];sim.rng.next=()=>.99;
  state.enemies=[createEnemy(state,sim.rng,19,'normal',6,0)];
  const results=[];
  for(const haste of [10,20]){
   state.buffs.haste=haste;state.projectiles=[];member.cooldown=0;
   member.learnedMoves=learned?[{moveId:'swift',rank:1,cooldown:0}]:[];
   if(learned)(sim as any).updateLearnedMoves(member,.01);else (sim as any).updateAttacks(.01);
   assert.ok(state.projectiles.length>0);
   results.push({damage:state.projectiles[0].damage,cooldown:learned?member.learnedMoves[0].cooldown:member.cooldown});
  }
  close(results[0].cooldown,results[1].cooldown);
  close(results[1].damage/results[0].damage,21/11);
 }
});
