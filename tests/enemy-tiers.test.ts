import test from 'node:test';
import assert from 'node:assert/strict';
import {KANTO} from '../src/data/kanto.ts';
import {getEnemySpeciesProfile} from '../src/data/enemySpecies.ts';
import {ENEMY_TIER_TUNING,enemyAttackLimit,getEnemyTier,speciesEnemyTier} from '../src/data/enemyTiers.ts';
import {SPAWN_VARIANTS} from '../src/data/variants.ts';
import {BOSS_RULES} from '../src/data/director.ts';

test('every third-stage evolution is a tier-three miniboss regardless of natural strength',()=>{
 const thirdStages=KANTO.filter(species=>species.stage===3);
 assert.ok(thirdStages.length>10);
 for(const species of thirdStages)assert.equal(speciesEnemyTier(species.id),3,species.name);
 for(const id of [12,15,18,3,6,9,31,34,65,68,76,94,149])assert.equal(speciesEnemyTier(id),3);
});

test('strong final forms and standalone species are minibosses while middle evolutions remain ordinary',()=>{
 for(const id of [38,59,73,95,112,115,123,127,128,130,131,142,143])assert.equal(speciesEnemyTier(id),3,`#${id}`);
 for(const id of [2,5,8,64,67,148])assert.equal(speciesEnemyTier(id),2,`#${id}`);
 assert.ok(getEnemySpeciesProfile(148).strength>=6,'Dragonair proves strength alone does not promote a middle evolution');
 for(const id of [10,13,19,129])assert.equal(speciesEnemyTier(id),1);
 for(const id of [20,22,24,26,36,53,57,111])assert.equal(speciesEnemyTier(id),2);
});

test('legendary birds and Mew are tier four and Mewtwo is the final tier',()=>{
 for(const id of [144,145,146,151])assert.equal(speciesEnemyTier(id),4);
 assert.equal(speciesEnemyTier(150),5);
 assert.equal(getEnemyTier(19,'normal',true),5,'The explicit boss override always wins');
});

test('every variant of a tier-three species enters the tier-four encounter budget',()=>{
 for(const species of KANTO){
  const base=speciesEnemyTier(species.id);
  assert.equal(getEnemyTier(species.id),base);
  for(const variant of SPAWN_VARIANTS){
   assert.equal(getEnemyTier(species.id,variant),base===3&&variant!=='normal'?4:base,`${species.name} ${variant}`);
  }
 }
 assert.equal(getEnemyTier(149,'rocket'),4);
 assert.equal(getEnemyTier(149,'normal'),3);
});

test('ordinary enemies carry one attack and tier-three minibosses carry two throughout a run',()=>{
 for(const elapsed of [0,360,780,840,900,1080,3600])for(const strength of [1,6,8,10]){
  for(const hardShrine of [false,true]){
   assert.equal(enemyAttackLimit(1,elapsed,strength,hardShrine),1);
   assert.equal(enemyAttackLimit(2,elapsed,strength,hardShrine),1);
   assert.equal(enemyAttackLimit(3,elapsed,strength,hardShrine),2);
   assert.equal(enemyAttackLimit(5,elapsed,strength,hardShrine),4);
  }
 }
});

test('tier-four attacks grow with encounter strength and time, with four reserved for endless or hard shrines',()=>{
 const t=ENEMY_TIER_TUNING.attacks;
 assert.equal(enemyAttackLimit(4,t.thirdAttackSeconds-.01,10),2);
 assert.equal(enemyAttackLimit(4,t.thirdAttackSeconds,t.thirdAttackStrength),3);
 assert.equal(enemyAttackLimit(4,900,t.thirdAttackStrength-.01),2);
 assert.equal(enemyAttackLimit(4,t.fourthAttackSeconds-.01,10),3);
 assert.equal(enemyAttackLimit(4,t.fourthAttackSeconds,t.fourthAttackStrength),4);
 assert.equal(enemyAttackLimit(4,3600,t.fourthAttackStrength-.01),3);
 assert.equal(enemyAttackLimit(4,0,t.hardShrineFourthAttackStrength,true),4);
 assert.equal(enemyAttackLimit(4,0,t.hardShrineFourthAttackStrength-.01,true),2);
 for(let elapsed=0;elapsed<=900;elapsed+=30)assert.ok(enemyAttackLimit(4,elapsed,10)<4);
});

test('miniboss budgets begin sparsely and tier-four appearances fit only the final two minutes',()=>{
 const {tier3,tier4}=ENEMY_TIER_TUNING;
 assert.equal(tier3.earliestSeconds,360);
 assert.equal(tier3.initialChance,.01);
 assert.equal(tier3.lateChance,.05);
 assert.ok(tier3.fullChanceSeconds>tier3.earliestSeconds);
 assert.equal(tier4.earliestSeconds,780);
 assert.equal(tier4.fullChanceSeconds,900);
 assert.equal(tier4.lateChance,.003);
 assert.equal(tier4.maxAlive,1);
 assert.ok(tier4.minimumSpacingSeconds>=60);
 assert.ok(tier4.healthMultiplier>tier3.healthMultiplier);
 assert.ok(tier4.minimumHealth>tier3.minimumHealth);
 assert.ok(BOSS_RULES.baseHp>tier4.minimumHealth,'The final boss keeps a separate, larger health budget');
});
