import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EVOLUTION_CHAINS,KANTO,getSpecies} from '../src/data/kanto.ts';
import {SPECIES_COMBAT,GATED_RECRUIT_SPECIES,LEGENDARY_SPECIES} from '../src/data/rosterContent.ts';
import {validateRoster} from '../src/data/validateRoster.ts';
import {evolutionRule,evolutionRequirement} from '../src/data/evolutions.ts';
import {ENCOUNTER_TABLES,selectEncounter} from '../src/data/encounters.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {applyChoice,makeChoices,eligibleEvolutions} from '../src/game/systems/progression.ts';
import {createEnemy,spawnRandomEnemy} from '../src/game/systems/spawning.ts';
import {RNG} from '../src/utils/random.ts';
const reference=JSON.parse(readFileSync(new URL('./fixtures/kanto-reference.json',import.meta.url),'utf8')).species;

test('all 151 original IDs, historical types, 72 evolution links and authored loadouts match independent cached source data',()=>{
 assert.deepEqual(validateRoster(reference),[]);
 assert.equal(KANTO.reduce((sum,species)=>sum+species.evolvesTo.length,0),72);
 assert.deepEqual(getSpecies(81).types,['electric'],'Magnemite has its original Gen 1 typing');
 assert.deepEqual(getSpecies(35).types,['normal'],'Clefairy has its original Gen 1 typing');
 assert.equal(SPECIES_COMBAT.length,151);
});

test('two-stage families occupy the intended stat and evolution window',()=>{
 const [squirtle,wartortle,blastoise,growlithe,arcanine,magikarp,gyarados]=[7,8,9,58,59,129,130].map(getSpecies);
 for(const stat of ['power','defense','health'] as const){
  assert.ok(growlithe[stat]>squirtle[stat],stat);
  assert.ok(wartortle[stat]>growlithe[stat],stat);
  assert.ok(arcanine[stat]>wartortle[stat],stat);
  assert.ok(blastoise[stat]>arcanine[stat],stat);
  assert.ok(magikarp[stat]<squirtle[stat],stat);
  assert.ok(gyarados[stat]>blastoise[stat],stat);
 }
 const first=evolutionRule(7,8)!,twoStage=evolutionRule(58,59)!;
 assert.ok(twoStage.level>first.level);
 assert.ok(twoStage.maturitySeconds>first.maturitySeconds);
 const ordinaryStarters=KANTO.filter(species=>species.stage===1&&species.id!==129);
 assert.ok(ordinaryStarters.every(species=>magikarp.power<species.power&&magikarp.defense<species.defense&&magikarp.health<species.health));
 const three=EVOLUTION_CHAINS.filter(chain=>chain.length===3).map(chain=>chain.map(getSpecies));
 const two=EVOLUTION_CHAINS.filter(chain=>chain.length===2&&chain[0]!==129).map(chain=>chain.map(getSpecies));
 const tiers=[three.map(chain=>chain[0]),two.map(chain=>chain[0]),three.map(chain=>chain[1]),two.map(chain=>chain[1]),three.map(chain=>chain[2])];
 for(const stat of ['power','defense','health'] as const)for(let index=1;index<tiers.length;index++){
  assert.ok(Math.min(...tiers[index].map(species=>species[stat]))>Math.max(...tiers[index-1].map(species=>species[stat])),`${stat} tier ${index}`);
 }
 assert.ok(gyarados.power>Math.max(...tiers[4].map(species=>species.power)));
 const fishRun=new Simulation(129,29).state;fishRun.stats.elapsed=300;fishRun.party[0].level=15;
 const fishEvolution=makeChoices(fishRun,new RNG(29)).find(choice=>choice.kind==='evolve'&&choice.targetId===130)!;
 assert.match(fishEvolution.description,/\+150% maximum HP/);
 const beforeHp=fishRun.player.maxHp;
 assert.equal(applyChoice(fishRun,fishEvolution).applied,true);
 assert.equal(fishRun.player.maxHp,beforeHp*2.5);
});

test('content validator detects removed IDs, wrong historical types, invalid evolutions and duplicate move entries',()=>{
 assert.ok(validateRoster(reference,KANTO.slice(1)).some(issue=>issue==='Missing species 1'));
 const bad=structuredClone(KANTO);bad[0].types=['fire'];bad[0].evolvesTo=[1,999];
 const errors=validateRoster(reference,bad);assert.ok(errors.some(issue=>issue.includes('historical Gen 1 types')));assert.ok(errors.some(issue=>issue.includes('invalid or duplicate evolution target')));
 const moves=structuredClone(SPECIES_COMBAT);moves[1]={...moves[0]};
 assert.ok(validateRoster(reference,KANTO,moves).some(issue=>issue.includes('missing or duplicate move entry')));
 moves[1]={...SPECIES_COMBAT[1],moveName:moves[0].moveName};
 assert.ok(validateRoster(reference,KANTO,moves).some(issue=>issue.includes('duplicate authored move name')));
});

test('all 72 explicit evolution cards apply, including 16 stone and four adapted trade forms',()=>{
 const counts={training:0,stone:0,bond:0};
 for(const species of KANTO)for(const targetId of species.evolvesTo){
  const rule=evolutionRule(species.id,targetId)!;counts[rule.method]++;
  const state=new Simulation(species.id,27).state;state.stats.elapsed=500;state.stats.level=30;state.party[0].level=30;state.recruitCount=1;
  assert.deepEqual(eligibleEvolutions(state),[1]);
  assert.ok(evolutionRequirement(species.id,targetId).includes(`${rule.maturitySeconds}s`));
  const result=applyChoice(state,{id:`evolve-1-${targetId}`,speciesId:1,sourceSpeciesId:species.id,targetId,kind:'evolve',title:'Evolution',description:'',rarity:'epic'});
  assert.equal(result.applied,true,`${species.name} → ${getSpecies(targetId).name}`);assert.equal(state.party[0].speciesId,targetId);
  assert.equal(state.party[0].attackLevel,2,'Every evolution grants a move rank');assert.equal(state.party[0].level,30,'Evolution does not grant a level');
  assert.deepEqual(eligibleEvolutions(state),[],'Every evolved form waits for new maturity');
 }
 assert.deepEqual(counts,{training:52,stone:16,bond:4});assert.equal(evolutionRule(133,150),null);
});

test('every species is in a live encounter table and legendary birds/Mew remain scarce late elites',()=>{
 assert.equal(new Set(Object.values(ENCOUNTER_TABLES).flat()).size,151);
 for(const tier of ['early','mid','late'] as const)assert.ok(ENCOUNTER_TABLES[tier].every(id=>!LEGENDARY_SPECIES.includes(id)));
 const rng=new RNG(993),counts=new Map<number,number>();
 for(let roll=0;roll<100000;roll++){
  const result=selectEncounter(rng,900,'late');if(result.rare)counts.set(result.speciesId,(counts.get(result.speciesId)||0)+1);
  assert.notEqual(result.speciesId,150);
 }
 assert.deepEqual([...counts.keys()].sort((a,b)=>a-b),[144,145,146,151]);
 const total=[...counts.values()].reduce((sum,value)=>sum+value,0);assert.ok(total>=65&&total<=135,`Expected ~100 rare arrivals, saw ${total}`);
 class ZeroRNG extends RNG{override next(){return 0;}}
 for(const time of [0,210,660,719.99])assert.equal(selectEncounter(new ZeroRNG(),time,'late').rare,false);
 assert.equal(selectEncounter(new ZeroRNG(),900,'late',false).rare,false);
 const state=new Simulation(1,10).state;state.stats.elapsed=900;state.enemies=[];
 const rare=spawnRandomEnemy(state,new ZeroRNG(),{speciesTier:'late'})!;
 assert.equal(rare.speciesId,144);assert.equal(rare.elite,true);assert.equal(rare.isBoss,false);assert.equal(rare.variant,'normal');
});

test('new-run recruitment policy gates single-stage rewards and rejects forged recruits without changing legacy access',()=>{
 const state=new Simulation(1,7).state;state.stats.elapsed=165;state.stats.level=7;state.recruitUnlocks=[];
 const choices=Array.from({length:100},(_,seed)=>makeChoices(state,new RNG(seed+20))).flat();
 assert.ok(choices.every(choice=>!GATED_RECRUIT_SPECIES.includes(choice.speciesId!)));
 const card={id:'recruit-83',speciesId:83,kind:'recruit' as const,title:'Recruit',description:'',rarity:'rare' as const};
 assert.equal(applyChoice(state,card).applied,false);state.recruitUnlocks=[83];
 assert.equal(applyChoice(state,card).applied,true);assert.equal(state.party[1].speciesId,83);
 const legacy=new Simulation(1,7).state;legacy.stats.elapsed=165;legacy.stats.level=7;
 assert.equal(applyChoice(legacy,card).applied,true);
});

test('item policy applies to offers and application; quickened changes only selected enemy movement',()=>{
 const state=new Simulation(1,7).state;state.itemUnlocks=[];
 assert.ok(makeChoices(state,new RNG(51),'cache').every(choice=>choice.kind!=='item'));
 const card={id:'echo-bell',kind:'item' as const,title:'Echo Bell',description:'',rarity:'rare' as const};
 assert.equal(applyChoice(state,card).applied,false);state.itemUnlocks=['echo-bell'];
 assert.equal(applyChoice(state,card).applied,true);
 const original=createEnemy(state,new RNG(4),19,'normal',4,4);state.challenge='quickened';
 const fast=createEnemy(state,new RNG(4),19,'normal',4,4);
 assert.equal(fast.speed,original.speed*1.20);assert.equal(fast.hp,original.hp);assert.equal(fast.damage,original.damage);
});
