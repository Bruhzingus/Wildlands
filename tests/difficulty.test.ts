import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {getSpecies} from '../src/data/kanto.ts';
import {DIFFICULTY,ordinaryThreatScale} from '../src/data/config.ts';
import {BOSS_RULES} from '../src/data/director.ts';
import {createEnemy,createGuardian} from '../src/game/systems/spawning.ts';
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

test('ordinary difficulty applies once to damage without stacking health, speed or spawn buffs',()=>{
 const s=new Simulation(7,99).state,rng=new RNG(4),sp=getSpecies(19);
 for(const elapsed of [0,120,150,180,600,900]){
  s.stats.elapsed=elapsed;const minutes=elapsed/60,enemy=createEnemy(s,rng,19,'normal',0,0);
  const baseDamage=6+sp.stage*2.7+minutes*.46;
  assert.equal(enemy.damage,baseDamage*ordinaryThreatScale(elapsed));
  assert.equal(enemy.maxHp,(18+sp.stage*10+minutes*1.25)*(1+minutes*.07));
  assert.equal(enemy.speed,2.7+sp.stage*.2+minutes*.055);
 }
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

test('both landmark guardians scale their durability with run level and elapsed time',()=>{
 const s=new Simulation(7,99).state,rng=new RNG(4);
 for(const elapsed of [0,180,600,900])for(const level of [1,8,20]){
  s.stats.elapsed=elapsed;s.stats.level=level;
  for(const shrine of [false,true]){
   const guardian=createGuardian(s,rng,26,4,4,shrine);
   assert.ok(guardian.maxHp>=600+level*200+elapsed*1.5);
   assert.equal(guardian.shrineGuardian,shrine);assert.equal(guardian.elite,true);assert.equal(guardian.isBoss,false);
  }
 }
});
