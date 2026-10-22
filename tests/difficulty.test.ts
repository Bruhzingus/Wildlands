import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {getSpecies,KANTO} from '../src/data/kanto.ts';
import {DIFFICULTY,ordinaryThreatScale} from '../src/data/config.ts';
import {BOSS_RULES} from '../src/data/director.ts';
import {ENEMY_TIER_TUNING,getEnemyTier} from '../src/data/enemyTiers.ts';
import {createEnemy,createGuardian,lateEnemyScale} from '../src/game/systems/spawning.ts';
import {RNG} from '../src/utils/random.ts';

test('the opening stays unchanged and ordinary threat ramps smoothly to twenty percent after two minutes',()=>{
 for(const seconds of [0,30,90,119.99,120])assert.equal(ordinaryThreatScale(seconds),1);
 assert.equal(ordinaryThreatScale(150),1.1);
 for(const seconds of [180,360,900,1800])assert.equal(ordinaryThreatScale(seconds),1.2);
 let previous=1;
 for(let seconds=120;seconds<=180;seconds+=.25){
  const scale=ordinaryThreatScale(seconds);assert.ok(scale>=previous&&scale<=1.2);previous=scale;
 }
 assert.ok(ordinaryThreatScale(120.01)-1<1e-7,'The first frame after two minutes has no damage spike');
 assert.equal(ordinaryThreatScale(NaN),1);
});

test('ordinary tier-one and tier-two stats grow gradually within bounds while body size stays consistent',()=>{
 const s=new Simulation(7,99).state,rng=new RNG(4);
 for(const speciesId of [19,26,82,148]){
  assert.ok(getEnemyTier(speciesId)<=2);
  s.stats.elapsed=0;const opening=createEnemy(s,rng,speciesId,'normal',0,0);let previous=opening;
  for(const elapsed of [120,150,180,600,900]){
   s.stats.elapsed=elapsed;const enemy=createEnemy(s,rng,speciesId,'normal',0,0);
   assert.ok(enemy.maxHp>previous.maxHp&&enemy.damage>previous.damage&&enemy.speed>previous.speed,`${getSpecies(speciesId).name} at ${elapsed}s`);
   assert.equal(enemy.size,opening.size,'Elapsed time does not inflate a species silhouette');
   previous=enemy;
  }
  assert.ok(previous.maxHp/opening.maxHp<6,'Endurance growth remains bounded over a complete run');
  assert.ok(previous.damage/opening.damage<2.6,'Ordinary damage growth remains below the heavy encounter budget');
  assert.ok(previous.speed/opening.speed<1.25,'Movement gains preserve readable attack tells');
 }
});

test('all species and variants gain health and damage at three minutes, with greater boosts for stronger tiers',()=>{
 const s=new Simulation(7,99).state,rng=new RNG(4);
 for(const species of KANTO)for(const variant of ['normal','rocket','dark','rabid','poisoned'] as const){
  s.stats.elapsed=179.999;const before=createEnemy(s,rng,species.id,variant,0,0);
  s.stats.elapsed=180;const after=createEnemy(s,rng,species.id,variant,0,0);
  assert.ok(after.maxHp/before.maxHp>=1.15,`${species.name} ${variant} health`);
  assert.ok(after.damage/before.damage>=1.08,`${species.name} ${variant} damage`);
  assert.equal(after.size,before.size);assert.ok(after.speed/before.speed<1.00001);
 }
 for(const seconds of [0,120,179.999])assert.deepEqual(lateEnemyScale(seconds,149,4),{health:1,damage:1});
 for(const seconds of [180,420,900]){
  const ordinary=lateEnemyScale(seconds,19,1),evolved=lateEnemyScale(seconds,148,2);
  const smallMiniboss=lateEnemyScale(seconds,12,3),largeMiniboss=lateEnemyScale(seconds,143,3);
  const elite=lateEnemyScale(seconds,143,4),boss=lateEnemyScale(seconds,150,5);
  for(const stat of ['health','damage'] as const){
   assert.ok(evolved[stat]>ordinary[stat]);assert.ok(largeMiniboss[stat]>smallMiniboss[stat]);
   assert.ok(elite[stat]>largeMiniboss[stat]);assert.ok(boss[stat]>elite[stat]);
  }
 }
 assert.deepEqual(lateEnemyScale(900,19,1),{health:1.6,damage:1.25});
 assert.deepEqual(lateEnemyScale(900,150,5),{health:2.44,damage:1.6});
 for(const id of [19,148,143,150]){
  let previous=lateEnemyScale(180,id,getEnemyTier(id));
  for(const seconds of [240,360,600,900]){
   const current=lateEnemyScale(seconds,id,getEnemyTier(id));
   assert.ok(current.health>previous.health&&current.damage>previous.damage);previous=current;
  }
  assert.deepEqual(lateEnemyScale(1800,id,getEnemyTier(id)),previous,'Endless adds its own scaling after the full run bonus');
 }
});

test('a species and variant retain the same combat stats across random rolls and spawn positions',()=>{
 const s=new Simulation(7,99).state;s.stats.elapsed=420;
 for(const speciesId of [19,95,149])for(const variant of ['normal','rocket'] as const){
  const first=createEnemy(s,new RNG(4),speciesId,variant,0,0),second=createEnemy(s,new RNG(97),speciesId,variant,22,-14);
  for(const stat of ['maxHp','hp','damage','speed','size'] as const)assert.equal(first[stat],second[stat],`${getSpecies(speciesId).name} ${variant} ${stat}`);
 }
});

test('species strength and size distinguish minibosses within the same evolution stage',()=>{
 const s=new Simulation(7,99).state,rng=new RNG(4),weak=createEnemy(s,rng,19,'normal',0,0);
 assert.equal(getSpecies(19).stage,1);
 const bulky=[95,143].map(speciesId=>{
  assert.equal(getSpecies(speciesId).stage,1);
  const enemy=createEnemy(s,rng,speciesId,'normal',0,0);
  assert.ok(enemy.maxHp>weak.maxHp*3&&enemy.damage>weak.damage*2&&enemy.size>weak.size*2.5,`${getSpecies(speciesId).name} is large and threatening despite sharing Rattata's stage`);
  return enemy;
 });
 const butterfree=createEnemy(s,rng,12,'normal',0,0),charizard=createEnemy(s,rng,6,'normal',0,0);
 assert.equal(getSpecies(12).stage,getSpecies(6).stage);
 assert.equal(charizard.combatTier,3);assert.equal(butterfree.combatTier,3);
 assert.ok(charizard.maxHp>butterfree.maxHp*1.25&&charizard.damage>butterfree.damage*1.8&&charizard.size>butterfree.size*1.4,'Tier-three durability floors retain Charizard\'s greater strength and size');
 s.stats.elapsed=900;const lateWeak=createEnemy(s,rng,19,'normal',0,0);
 for(const earlyEnemy of bulky){
  const enemy=createEnemy(s,rng,earlyEnemy.speciesId,'normal',0,0);
  assert.ok(enemy.maxHp>lateWeak.maxHp*1.5&&enemy.damage>lateWeak.damage*1.5,'A full run of time scaling does not make Rattata stronger than naturally imposing species');
 }
});

test('miniboss and elite durability grow with their encounter windows and remain far above ordinary enemies',()=>{
 const s=new Simulation(7,99).state,rng=new RNG(4);
 for(const speciesId of [12,95,143,149]){
  let previousHp=0;
  for(const elapsed of [360,600,780,900]){
   s.stats.elapsed=elapsed;
   const ordinary=createEnemy(s,rng,148,'rocket',0,0),miniboss=createEnemy(s,rng,speciesId,'normal',0,0),elite=createEnemy(s,rng,speciesId,'rocket',0,0);
   assert.equal(ordinary.combatTier,2);assert.equal(miniboss.combatTier,3);assert.equal(elite.combatTier,4);
   assert.ok(miniboss.maxHp>previousHp*1.1,'Each later encounter window adds meaningful miniboss endurance');
   assert.ok(miniboss.maxHp>ordinary.maxHp*4,'Even a small third-stage miniboss outlasts an enhanced ordinary enemy');
   assert.ok(elite.maxHp>miniboss.maxHp*2.5,'Promoting a miniboss to tier four adds substantial durability');
   assert.ok(elite.damage>miniboss.damage*1.9,'The promoted Rocket encounter also has greater offensive power');
   assert.ok(miniboss.maxHp>ENEMY_TIER_TUNING.tier3.minimumHealth);
   assert.equal(miniboss.size,createEnemy(s,rng,speciesId,'normal',20,20).size,'Durability does not depend on spawn position');
   previousHp=miniboss.maxHp;
  }
 }
});

test('the scheduled Mewtwo has a separate durability budget above even a late Rocket Dragonite',()=>{
 const sim=new Simulation(7,99),s=sim.state;s.stats.elapsed=899.99;s.enemies=[];s.pois=[];
 s.party[0].level=25;s.party[0].cooldown=1e6;
 const elite=createEnemy(s,new RNG(4),149,'rocket',0,0);
 sim.update(.02,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});
 const boss=s.enemies.find(enemy=>enemy.isBoss);
 assert.ok(boss);assert.equal(boss.combatTier,5);assert.equal(boss.speciesId,150);
 assert.ok(boss.maxHp>=90000,'A developed party faces a substantial final boss health pool');
 assert.ok(boss.maxHp>elite.maxHp*5,'Mewtwo remains a major step above a tier-four encounter');
 assert.ok(boss.damage>=BOSS_RULES.contactDamage,'Final boss contact damage uses its dedicated tuning');
});

test('elite encounters have substantial endurance and the final boss keeps readable tells with stronger attacks',()=>{
 const s=new Simulation(7,99).state,rng=new RNG(4);s.stats.elapsed=420;
 const ordinary=createEnemy(s,rng,26,'rocket',0,0),elite=createEnemy(s,rng,26,'rocket',0,0,true);
 assert.ok(Math.abs(elite.maxHp/ordinary.maxHp-DIFFICULTY.eliteHp)<1e-12);
 assert.ok(Math.abs(elite.damage/ordinary.damage-DIFFICULTY.eliteDamage)<1e-12);
 assert.equal(elite.speed,ordinary.speed);
 assert.ok(BOSS_RULES.baseHp>=12000&&BOSS_RULES.hpPerLevel>=250);
 assert.ok(BOSS_RULES.volleyDamage>=18&&BOSS_RULES.ringDamage>=26&&BOSS_RULES.summonCount>=4);
 assert.ok(BOSS_RULES.volleyWindup>=.7&&BOSS_RULES.ringWindup>=1.1&&BOSS_RULES.summonWindup>=1.5);
});

test('elite landmarks scale with the run while shrine tiers have fixed health budgets',()=>{
 const s=new Simulation(7,99).state,rng=new RNG(4);
 for(const elapsed of [0,180,600,900])for(const level of [1,8,20]){
  s.stats.elapsed=elapsed;s.stats.level=999;s.party[0].level=level;
  for(const shrine of [false,true]){
   const guardian=createGuardian(s,rng,26,4,4,shrine);
   if(shrine)assert.equal(guardian.maxHp,1350);else assert.ok(guardian.maxHp>=600+level*200+elapsed*1.5);
   assert.equal(guardian.shrineGuardian,shrine);assert.equal(guardian.elite,true);assert.equal(guardian.isBoss,false);
  }
 }
});

test('party strength has a small bounded influence on future spawns and cannot change existing enemies',()=>{
 const s=new Simulation(7,99).state,rng=new RNG(4);s.stats.elapsed=600;
 const weak=createEnemy(s,rng,19,'normal',0,0),snapshot=structuredClone(weak);
 s.party[0].level=50;s.party[0].attackLevel=8;s.buffs.power=4;
 while(s.party.length<6)s.party.push({...s.party[0],uid:s.idCounter++,learnedMoves:[{moveId:'swift',rank:12,cooldown:0}]});
 const strong=createEnemy(s,rng,19,'normal',0,0);
 assert.ok(Math.abs(strong.maxHp/weak.maxHp-1.2)<1e-9);assert.ok(Math.abs(strong.damage/weak.damage-1.08)<1e-9);
 assert.equal(strong.speed,weak.speed);assert.deepEqual(weak,snapshot);
});
