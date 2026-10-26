import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {ENDLESS_BOSS_HEALTH} from '../src/data/director.ts';
import {scheduledBossEncounter} from '../src/data/encounters.ts';
import {averagePartyLevel,enemyProgressionScale,lateEnemyScale} from '../src/game/systems/spawning.ts';
import {analyticsEnemies} from '../src/game/analytics.ts';
import {createReportedBossRun,runReportedBossExperiment,bossHealthCalculation} from '../scripts/boss-balance.mjs';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};

test('both first map bosses keep a 160k budget across party investment and delayed spawns',()=>{
 for(const mapId of ['wildlands','volcanic-ridge'] as const)for(const [level,count,elapsed] of [[15,3,899.99],[29,4,899.99],[70,6,1200]]){
  const sim=new Simulation(26,234,{mapId}),s=sim.state;
  s.enemies=[];s.pois=[];s.stats.elapsed=elapsed;s.player.iframes=10000;
  s.party=Array.from({length:count},(_,index)=>({...structuredClone(s.party[0]),uid:index+1,
   level,attackLevel:level,cooldown:1e6}));
  s.idCounter=100;s.buffs={power:level*.05,haste:level*.02};
  sim.update(.02,idle);
  const boss=s.enemies.find(enemy=>enemy.isBoss)!;
  assert.equal(boss.maxHp,160000);assert.equal(boss.hp,160000);
  assert.equal(analyticsEnemies(s).alive.find(enemy=>enemy.speciesId===boss.speciesId)!.lateScale.health,1);
 }
});

test('endless chapters retain the previous level, party, time and chapter budget',()=>{
 for(const round of [1,3]){
  const sim=createReportedBossRun(),s=sim.state;
  s.endless=true;s.bossSpawned=true;s.stats.bossesDefeated=round;s.stats.elapsed=1500;
  s.nextBossAt=1500.01;
  const encounter=scheduledBossEncounter(s.mapId,round);
  sim.update(.02,idle);
  const boss=s.enemies.find(enemy=>enemy.isBoss)!;
  const expected=(280000+averagePartyLevel(s)*5600)*(1+enemyProgressionScale(s).party)*
   lateEnemyScale(s.stats.elapsed,encounter.speciesId,5).health*(1+round*.18);
  assert.equal(boss.maxHp,expected);assert.ok(boss.maxHp>160000*10);
  assert.equal(ENDLESS_BOSS_HEALTH.baseHp,280000);
  const snapshot=sim.exportSnapshot(),restored=Simulation.restore(snapshot,{paused:false});
  assert.equal(restored.state.enemies.find(enemy=>enemy.isBoss)!.maxHp,boss.maxHp);
 }
});

test('legacy first bosses keep all earned damage and migrated rewind checkpoints are stable',()=>{
 const sim=createReportedBossRun();sim.update(.02,idle);
 const snapshot=sim.exportSnapshot(),legacy=snapshot.state.enemies.find(enemy=>enemy.isBoss)!;
 legacy.maxHp=3621745.68;legacy.hp=legacy.maxHp-10000;
 const restored=Simulation.restore(snapshot),boss=restored.state.enemies.find(enemy=>enemy.isBoss)!;
 assert.equal(boss.maxHp,160000);assert.equal(boss.hp,150000);
 assert.equal(restored.state.stats.damageDealt,snapshot.state.stats.damageDealt);
 assert.equal(legacy.maxHp,3621745.68,'Migration must not mutate the caller or imported file');
 assert.equal(restored.exportSuspendedSnapshot().snapshot.state.enemies.find(enemy=>enemy.isBoss)!.hp,150000);
 const twice=Simulation.restore(restored.exportSnapshot());
 assert.equal(twice.state.enemies.find(enemy=>enemy.isBoss)!.hp,150000);
});

test('the reported legacy boss finishes on the next hit and awards victory once',()=>{
 const sim=createReportedBossRun();sim.update(.02,idle);
 const snapshot=sim.exportSnapshot(),legacy=snapshot.state.enemies.find(enemy=>enemy.isBoss)!;
 legacy.maxHp=3621745.68;legacy.hp=3185545.549450128;
 const restored=Simulation.restore(snapshot),boss=restored.state.enemies.find(enemy=>enemy.isBoss)!;
 assert.equal(boss.maxHp,160000);assert.equal(boss.hp,1);
 assert.equal(restored.state.result,null);assert.equal(restored.state.phase,'paused');
 assert.equal(restored.resumeSnapshot(),true);
 restored.damageEnemy(boss,1,'normal',restored.state.party[0].uid);
 assert.equal(restored.state.result,'victory');assert.equal(restored.state.stats.bossesDefeated,1);
 restored.damageEnemy(boss,1,'normal',restored.state.party[0].uid);
 assert.equal(restored.state.stats.bossesDefeated,1);
});

test('reported damage supports a three-minute budget and the 15-minute party completes both stages with adds',()=>{
 const calculation=bossHealthCalculation();
 assert.ok(calculation.targetHp>160000&&calculation.targetHp<162000);
 assert.ok(calculation.newFightSeconds>175&&calculation.newFightSeconds<185);
 for(const mapId of ['wildlands','volcanic-ridge'])for(const seed of [1883105034,8841]){
  const result=runReportedBossExperiment({mapId,seed});
  assert.equal(result.defeated,true,JSON.stringify(result));
  assert.ok(result.seconds>=90&&result.seconds<=230,JSON.stringify(result));
  assert.ok(result.peakAdds>0&&result.reachedSecondStage,JSON.stringify(result));
  assert.ok(Math.abs(result.estimatedDps-1020.86)<.01,'Use the report at boss arrival with the shared move definitions');
 }
});
