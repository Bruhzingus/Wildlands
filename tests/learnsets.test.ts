import test from 'node:test';
import assert from 'node:assert/strict';
import {KANTO} from '../src/data/kanto.ts';
import {SPECIES_LEARNSETS} from '../src/data/learnsets.ts';
import {getMoveDefinition,learnableMoves,moveLearnLevel} from '../src/data/moves.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {applyChoice,makeChoices} from '../src/game/systems/progression.ts';
import {RNG} from '../src/utils/random.ts';

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
});

test('milestones vary move offers within species learnsets, honor level gates, and always offer eligible evolution',()=>{
 const state=new Simulation(4,8).state,member=state.party[0];state.recruitCount=5;state.stats.elapsed=300;member.level=5;
 const offers=new Set<string>();
 for(let seed=1;seed<=40;seed++){
  const choices=makeChoices(state,new RNG(seed*7919));assert.ok(choices.some(choice=>choice.kind==='evolve'));
  assert.ok(choices.every(choice=>choice.kind!=='stat'&&choice.kind!=='item'));
  for(const choice of choices.filter(choice=>choice.kind==='learn')){
   assert.ok(learnableMoves(4,5).some(move=>move.id===choice.moveId));offers.add(choice.moveId!);
  }
 }
 assert.ok(offers.size>=3,'Runs should vary their valid move candidates');
 const invalid={id:'learn-1-hyper-beam',kind:'learn' as const,speciesId:1,moveId:'hyper-beam',title:'Hyper Beam',description:'',rarity:'rare' as const};
 assert.equal(applyChoice(state,invalid).applied,false);
 member.speciesId=6;assert.equal(applyChoice(state,invalid).applied,false,'Legal species still needs the move’s milestone level');
 member.level=10;assert.equal(applyChoice(state,invalid).applied,true);
});
