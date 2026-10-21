import test from 'node:test';
import assert from 'node:assert/strict';
import {KANTO,getSpecies} from '../src/data/kanto.ts';
import {ENEMY_SPECIES_PROFILES,getEnemySpeciesProfile} from '../src/data/enemySpecies.ts';

test('enemy profiles explicitly cover every Kanto ID with finite, bounded arcade stats',()=>{
 assert.deepEqual(Object.keys(ENEMY_SPECIES_PROFILES).map(Number),KANTO.map(species=>species.id));
 const bounds={strength:[1,10],size:[.8,2.8],health:[.72,2.2],damage:[.7,1.65],speed:[.85,1.12],rarity:[.04,1]} as const;
 for(const species of KANTO){
  const profile=getEnemySpeciesProfile(species.id);
  assert.equal(profile,ENEMY_SPECIES_PROFILES[species.id]);
  for(const key of Object.keys(bounds) as (keyof typeof bounds)[]){
   const value=profile[key],[min,max]=bounds[key];
   assert.ok(Number.isFinite(value)&&value>=min&&value<=max,`${species.name} ${key}: ${value}`);
  }
 }
 assert.equal(getEnemySpeciesProfile(-1),getEnemySpeciesProfile(19));
 assert.equal(getEnemySpeciesProfile(NaN),getEnemySpeciesProfile(19));
 assert.ok(Object.isFrozen(ENEMY_SPECIES_PROFILES));
 assert.ok(Object.values(ENEMY_SPECIES_PROFILES).every(Object.isFrozen));
});

test('strength budgets distinguish natural power from evolution stage',()=>{
 for(const species of KANTO)for(const target of species.evolvesTo){
  assert.ok(getEnemySpeciesProfile(target).strength>getEnemySpeciesProfile(species.id).strength,`${species.name} to ${getSpecies(target).name}`);
 }
 for(const weak of [10,13,19,129])assert.equal(getEnemySpeciesProfile(weak).strength,1);
 assert.equal(getSpecies(12).stage,getSpecies(6).stage);
 assert.ok(getEnemySpeciesProfile(6).strength>getEnemySpeciesProfile(12).strength*2,'Charizard is substantially stronger than Butterfree');
 for(const strongSingleStage of [95,115,123,128,131,143]){
  assert.equal(getSpecies(strongSingleStage).stage,1);
  assert.ok(getEnemySpeciesProfile(strongSingleStage).strength>getEnemySpeciesProfile(20).strength*2);
 }
 assert.ok(getEnemySpeciesProfile(130).strength>=getEnemySpeciesProfile(129).strength*8,'Magikarp and Gyarados have separate budgets');
 const dragonite=getEnemySpeciesProfile(149);
 assert.equal(dragonite.strength,10);
 assert.ok(dragonite.rarity<=.12);
 assert.ok(dragonite.rarity<getEnemySpeciesProfile(148).rarity);
});

test('physically imposing species receive larger bodies and meaningful health and damage',()=>{
 const rattata=getEnemySpeciesProfile(19);
 for(const speciesId of [95,115,130,131,143,149]){
  const profile=getEnemySpeciesProfile(speciesId);
  assert.ok(profile.size>rattata.size*2.5,getSpecies(speciesId).name);
  assert.ok(profile.health>rattata.health*2,getSpecies(speciesId).name);
  assert.ok(profile.damage>rattata.damage*1.5,getSpecies(speciesId).name);
 }
 assert.ok(getEnemySpeciesProfile(95).size>getEnemySpeciesProfile(12).size,'Onix remains large despite having no evolution stage advantage');
 assert.ok(getEnemySpeciesProfile(143).health>getEnemySpeciesProfile(65).health,'Snorlax is bulkier than Alakazam');
 assert.ok(getEnemySpeciesProfile(65).damage>getEnemySpeciesProfile(113).damage,'Psychic power and health are separate traits');
});
