import test from 'node:test';
import assert from 'node:assert/strict';
import {KANTO} from '../src/data/kanto.ts';
import {SPECIES_LEARNSETS} from '../src/data/learnsets.ts';
import {getMoveDefinition,learnableMoves,moveLearnLevel} from '../src/data/moves.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {applyChoice,makeChoices} from '../src/game/systems/progression.ts';
import {RNG} from '../src/utils/random.ts';
import {eligibleEvolutions} from '../src/game/systems/progression.ts';
import {PROGRESSION} from '../src/data/progression.ts';

test('cached learnsets cover all 151 species and contain only implemented real moves',()=>{
 assert.equal(Object.keys(SPECIES_LEARNSETS).length,151);
 for(const species of KANTO){
  const moves=SPECIES_LEARNSETS[species.id];assert.equal(new Set(moves).size,moves.length);
  assert.ok(moves.every(id=>getMoveDefinition(id)),species.name);
  for(const level of [3,5,10])for(const move of learnableMoves(species.id,level)){
   assert.ok(moves.includes(move.id));assert.ok(moveLearnLevel(move.id)<=level);assert.notEqual(move.name,species.moveName);
  }
 }
 assert.ok(learnableMoves(1).some(move=>move.id==='razor-leaf'));
 assert.ok(!learnableMoves(1).some(move=>move.id==='swift'),'Normal typing was never sufficient to teach Swift');
 assert.ok(!learnableMoves(4).some(move=>move.id==='hyper-beam'),'Charmander cannot learn Charizard’s Hyper Beam');
 assert.ok(learnableMoves(6).some(move=>move.id==='hyper-beam'));
 assert.ok(!learnableMoves(66).some(move=>move.id==='swift'),'Machop cannot learn Swift');
 assert.ok(!learnableMoves(133).some(move=>move.id==='swift'),'Eevee already knows Swift as its signature');
});

test('all evolution and new-move unlocks precede level 45; later milestones train moves and stats',()=>{
 for(const species of KANTO)for(const move of learnableMoves(species.id))assert.ok(moveLearnLevel(move.id)<45);
 assert.ok(PROGRESSION.evolution.firstLevel<45);assert.ok(PROGRESSION.evolution.finalLevel<45);
 const state=new Simulation(4,8).state,member=state.party[0];state.recruitCount=5;state.stats.elapsed=600;
 member.level=40;
 const early=Array.from({length:40},(_,seed)=>makeChoices(state,new RNG(seed*7919))),evolution=early.flat().find(choice=>choice.kind==='evolve')!;
 assert.ok(evolution);assert.ok(eligibleEvolutions(state).includes(member.uid));
 member.level=40;const staleLearn={id:'learn-1-swift',kind:'learn' as const,speciesId:member.uid,moveId:'swift',title:'Swift',description:'',rarity:'rare' as const};
 member.level=45;
 assert.deepEqual(eligibleEvolutions(state),[]);
 assert.equal(applyChoice(state,evolution).applied,false);assert.equal(applyChoice(state,staleLearn).applied,false,'An old new-move card cannot bypass the late training phase');
 for(const level of [45,50,75,100]){
  member.level=level;
  const choices=makeChoices(state,new RNG(level));
  assert.ok(choices.some(choice=>choice.kind==='attack'));assert.ok(choices.some(choice=>choice.kind==='stat'));
  assert.ok(choices.every(choice=>choice.kind==='attack'||choice.kind==='stat'));
  assert.equal(new Set(choices.map(choice=>choice.id)).size,choices.length);
 }
 member.learnedMoves=[{moveId:'swift',rank:1,cooldown:0}];
 const learned=Array.from({length:20},(_,seed)=>makeChoices(state,new RNG(seed*7919))).flat().find(choice=>choice.kind==='attack'&&choice.moveId==='swift')!;
 assert.ok(learned);assert.equal(applyChoice(state,learned).applied,true);assert.equal(member.learnedMoves[0].rank,2);
 member.attackLevel=8;member.learnedMoves[0].rank=8;
 const choices=makeChoices(state,new RNG(1));assert.equal(choices.length,3);assert.ok(choices.some(choice=>choice.kind==='attack'),'Moves continue past rank 8');
});

test('milestones vary move offers within species learnsets, honor level gates, and always offer eligible evolution',()=>{
 const state=new Simulation(4,8).state,member=state.party[0];state.recruitCount=5;state.stats.elapsed=300;member.level=10;member.evolvedAt=300;
 const offers=new Set<string>();
 for(let seed=1;seed<=40;seed++){
  const choices=makeChoices(state,new RNG(seed*7919));assert.ok(choices.some(choice=>choice.kind==='stat'));assert.ok(choices.some(choice=>choice.kind==='attack'));
  assert.ok(choices.every(choice=>choice.kind!=='item'));
  for(const choice of choices.filter(choice=>choice.kind==='learn')){
   assert.ok(learnableMoves(4,10).some(move=>move.id===choice.moveId));offers.add(choice.moveId!);
  }
 }
 assert.ok(offers.size>=3,'Runs should vary their valid move candidates');
 const invalid={id:'learn-1-hyper-beam',kind:'learn' as const,speciesId:1,moveId:'hyper-beam',title:'Hyper Beam',description:'',rarity:'rare' as const};
 assert.equal(applyChoice(state,invalid).applied,false);
 member.speciesId=6;member.level=5;assert.equal(applyChoice(state,invalid).applied,false,'Legal species still needs the move’s milestone level');
 member.level=10;assert.equal(applyChoice(state,invalid).applied,true);
});
