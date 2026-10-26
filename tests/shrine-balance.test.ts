import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {SHRINE_TIERS,shrineDefinition} from '../src/data/shrines.ts';
import {createGuardian} from '../src/game/systems/spawning.ts';
import {createShrineProgressionRun,runShrineProgressionExperiment} from '../scripts/shrine-balance.mjs';
import type {POI} from '../src/game/types.ts';

test('late shrine budgets have no health cliff and remain fixed as the party improves',()=>{
 const sim=createShrineProgressionRun(),s=sim.state;
 for(let tier=9;tier<=15;tier++){
  const definition=shrineDefinition(tier),previous=shrineDefinition(tier-1);
  assert.ok(definition.health>previous.health&&definition.health/previous.health<1.7);
  const first=createGuardian(s,sim.rng,definition.speciesId,6,0,true,tier);
  s.stats.elapsed+=1200;s.buffs.power=(s.buffs.power??0)+2;s.party[0].level=100;
  const later=createGuardian(s,sim.rng,definition.speciesId,6,0,true,tier);
  assert.equal(later.maxHp,first.maxHp,'Levels, relic power and the clock must not raise shrine HP');
 }
});

test('the reported ordinary build can clear tiers nine and ten with movement and endless arrivals',()=>{
 for(const tier of [9,10])for(const seed of [1883105034,8841]){
  const result=runShrineProgressionExperiment({tier,seed});
  assert.equal(result.completed,true,JSON.stringify(result));
  assert.ok(result.seconds>=70&&result.seconds<=150,JSON.stringify(result));
  assert.ok(result.peakAdds>10,'Normal endless arrivals must remain active in the benchmark');
  assert.equal(result.incomingDamage,0,'Isolate damage throughput from survival');
  assert.equal(result.relicCopiesGained,0,'Keep the reported build fixed throughout the duration check');
  assert.ok(Math.abs(result.estimatedDps-3962.27)<.01,'Use the actual saved build with the shared move definitions');
 }
});

test('modest growth makes every later tier beatable with time left for repositioning',()=>{
 for(const definition of SHRINE_TIERS.filter(tier=>tier.tier>=9))for(const seed of [1883105034,8841]){
  const result=runShrineProgressionExperiment({tier:definition.tier,leaderLevel:definition.level,seed});
  assert.equal(result.completed,true,JSON.stringify(result));
  assert.ok(result.seconds>30&&result.seconds<=definition.targetSeconds[1],JSON.stringify(result));
  assert.ok(result.peakAdds>10,JSON.stringify(result));
  assert.equal(result.incomingDamage,0);
  assert.equal(result.relicCopiesGained,0);
 }
});

function legacyTrial(){
 const sim=createShrineProgressionRun(),s=sim.state;
 const site:POI={uid:9999,x:0,z:0,kind:'shrine',shrineTier:10,used:false};s.pois=[site];
 (sim as any).activatePOI(site);
 const snapshot=sim.exportSnapshot(),guardians=snapshot.state.enemies.filter(enemy=>enemy.shrineGuardian);
 guardians[0].maxHp=2400000;guardians[0].hp=2300000;
 guardians[1].maxHp=2400000;guardians[1].hp=2100000;
 return {snapshot,guardians};
}

test('legacy active shrine imports retain damage, timers and stable rewind checkpoints',()=>{
 const {snapshot,guardians}=legacyTrial(),trial=structuredClone(snapshot.state.pois[0].challenge);
 const sim=Simulation.restore(snapshot),enemies=sim.state.enemies.filter(enemy=>enemy.shrineGuardian);
 assert.equal(enemies[0].maxHp,250000);assert.equal(enemies[0].hp,150000);
 assert.equal(enemies[1].maxHp,250000);assert.equal(enemies[1].hp,1);
 assert.equal(guardians[0].maxHp,2400000,'Do not modify the imported source');
 assert.deepEqual(sim.state.pois[0].challenge,trial);
 assert.equal(sim.exportSuspendedSnapshot().snapshot.state.enemies[0].hp,150000);
 const twice=Simulation.restore(sim.exportSnapshot());
 assert.deepEqual(twice.state.enemies,sim.state.enemies,'The correction must be idempotent');
});

test('migrated group shrines complete and award training once, after the last guardian',()=>{
 const {snapshot}=legacyTrial(),sim=Simulation.restore(snapshot,{paused:false}),s=sim.state;
 const enemies=s.enemies.filter(enemy=>enemy.shrineGuardian);
 sim.damageEnemy(enemies[1],1,'normal',1,{},false,false,false,false);
 assert.ok(s.pois[0].challenge);assert.equal(s.pendingSquadRewards,0);
 sim.damageEnemy(enemies[0],150000,'normal',1,{},false,false,false,false);
 assert.equal(s.pois[0].challenge,undefined);assert.equal(s.pois[0].uses,1);assert.equal(s.pendingSquadRewards,1);
 sim.damageEnemy(enemies[0],150000,'normal',1,{},false,false,false,false);
 assert.equal(s.pendingSquadRewards,1);
});

test('migration leaves defeated guardians and unrelated enemies alone',()=>{
 const {snapshot,guardians}=legacyTrial();
 guardians[0].dead=true;guardians[0].hp=0;
 snapshot.state.enemies.push({...structuredClone(guardians[1]),uid:12000,shrineGuardian:false});
 const sim=Simulation.restore(snapshot),s=sim.state;
 assert.equal(s.enemies[0].maxHp,2400000);assert.equal(s.enemies[0].hp,0);
 assert.equal(s.enemies.find(enemy=>enemy.uid===12000)!.maxHp,2400000);
 assert.equal(s.enemies[1].maxHp,250000);
});
