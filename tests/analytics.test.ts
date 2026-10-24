import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {ANALYTICS_LIMITS,recordDamage,runAnalyticsReport,partyDamageSource,observeAnalytics} from '../src/game/analytics.ts';
import {getBuildModifiers} from '../src/game/systems/builds.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {applyChoice,availableItemChoices} from '../src/game/systems/progression.ts';
import {addProjectile} from '../src/game/combat/projectiles.ts';
import {DESIGN} from '../src/data/config.ts';
import type {Enemy,PartyMember} from '../src/game/types.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function arena(starter=7){const sim=new Simulation(starter,4711),s=sim.state;s.enemies=[];s.party[0].cooldown=1000;return {sim,s,combat:sim as any};}
function foe(sim:Simulation,hp=1000):Enemy {const enemy=createEnemy(sim.state,sim.rng,19,'normal',3,0);enemy.hp=enemy.maxHp=hp;enemy.speed=0;enemy.attackCooldown=1000;sim.state.enemies.push(enemy);return enemy;}
function follower(sim:Simulation):PartyMember {const member={...structuredClone(sim.state.party[0]),uid:900,speciesId:1,hp:20,maxHp:20,joinedAt:1};sim.state.party.push(member);return member;}

test('effective damage reconciles ranked rows, mitigation and overkill independently',()=>{
 const {s}=arena(),source=partyDamageSource(s,1,'Test hit','signature');
 recordDamage(s,{direction:'outgoing',source,attempted:220,applied:200,beforeHp:100,afterHp:-100,criticalTier:2,preCritical:50,killed:true});
 recordDamage(s,{direction:'incoming',source:{origin:'enemy',name:'Threat',move:'Claw'},recipient:{uid:1,speciesId:7,leader:true},attempted:10,applied:6,beforeHp:3,afterHp:-3,killed:true});
 const report=runAnalyticsReport(s);
 assert.equal(report.totals.outgoing.effective,100);assert.equal(report.totals.outgoing.mitigated,20);assert.equal(report.totals.outgoing.overkill,100);
 assert.equal(report.totals.incoming.effective,3);assert.equal(report.totals.incoming.mitigated,4);assert.equal(report.totals.incoming.overkill,3);
 assert.equal(report.outgoing.reduce((sum,row)=>sum+row.effective,0),report.totals.outgoing.effective);
 assert.equal(report.incoming.reduce((sum,row)=>sum+row.effective,0),report.totals.incoming.effective);
 assert.equal(report.outgoing[0].source.move,'Test hit');assert.equal(report.outgoing[0].maxCriticalTier,2);
 report.outgoing[0].source.move='Changed export';assert.equal(s.analytics!.sources[0].source.move,'Test hit');
});

test('actual combat records armor, iframes, deflection, follower faint and leader overkill',()=>{
 const {sim,s,combat}=arena(),enemy=foe(sim),member=follower(sim),armor=getBuildModifiers(s).armor;
 s.player.iframes=0;const before=s.player.hp;combat.hurtPlayer(20,false,false,false,enemy.uid);
 near(s.analytics!.leaderIncoming.effective,20-armor);near(before-s.player.hp,20-armor);
 combat.hurtPlayer(20,false,false,false,enemy.uid);near(s.analytics!.leaderIncoming.mitigated,armor+20);
 s.buffs.deflection=.5;s.player.iframes=0;const original=sim.rng.next;sim.rng.next=()=>0;
 combat.hurtPlayer(20,false,false,false,enemy.uid);near(s.analytics!.leaderIncoming.mitigated,armor+40);sim.rng.next=original;s.buffs.deflection=0;
 combat.hurtCompanion(member,100,false,enemy.uid);assert.equal(s.stats.faints,1);assert.equal(s.analytics!.faints[0].source.speciesId,enemy.speciesId);near(s.analytics!.followerIncoming.effective,20);
 s.player.iframes=0;s.player.hp=3;combat.hurtPlayer(100,false,false,false,enemy.uid);
 assert.equal(s.result,'defeat');near(s.analytics!.leaderIncoming.overkill,100-armor-3);
 const report=runAnalyticsReport(s);near(report.incoming.reduce((sum,row)=>sum+row.effective,0),report.totals.incoming.effective);assert.equal(report.faints[0].member.uid,member.uid);
});

test('burn and poison keep independent original member forms after the source faints',()=>{
 const {sim,s,combat}=arena(),enemy=foe(sim),member=follower(sim);
 const poisonSource=partyDamageSource(s,member.uid,'Poison touch','learned'),burnSource=partyDamageSource(s,1,'Ember','signature','fire');
 combat.damageEnemy(enemy,1,'normal',member.uid,{poison:1},false,false,false,false,1,0,poisonSource);
 combat.damageEnemy(enemy,1,'normal',1,{burn:1},false,false,false,false,1,0,burnSource);
 combat.hurtCompanion(member,1000,false,enemy.uid);s.party[0].speciesId=8;s.player.iframes=100;
 sim.update(.05,idle);
 const report=runAnalyticsReport(s),poison=report.outgoing.find(row=>row.source.status==='poison'),burn=report.outgoing.find(row=>row.source.status==='burn');
 assert.ok(poison&&burn);assert.equal(poison.source.actorId,member.uid);assert.equal(poison.source.speciesId,1);assert.equal(burn.source.speciesId,7);
 near(poison.effective,.04*2.6);near(burn.effective,.04*4);near(report.totals.outgoing.effective,s.stats.damageDealt);
});

test('delayed projectiles and Q fields retain launch-time forms and enemy moves after source removal',()=>{
 const {sim,s,combat}=arena(1),enemy=foe(sim);s.player.iframes=100;
 combat.specialAttack();s.party[0].speciesId=2;sim.update(.05,idle);
 const q=runAnalyticsReport(s).outgoing.find(row=>row.source.origin==='q');assert.ok(q);assert.equal(q.source.speciesId,1);
 s.projectiles=[];s.player.iframes=0;s.player.x=0;s.player.z=0;enemy.x=-3;
 addProjectile(s,{x:-3,z:0,vx:100,vz:0,ttl:1,damage:15,size:.2,kind:'bolt',type:'normal',penetration:0,friendly:false,sourceId:enemy.uid,poisonChance:0,moveName:'Launched Claw'});
 s.enemies=[];combat.updateProjectiles(.05);
 const incoming=runAnalyticsReport(s).incoming.find(row=>row.source.move==='Launched Claw');assert.ok(incoming);assert.equal(incoming.source.speciesId,enemy.speciesId);assert.ok(incoming.effective>0);
});

test('relic damage is separate from triggering critical hit without double-counting',()=>{
 const {sim,s,combat}=arena(),enemy=foe(sim);s.items=['prism-shard'];s.itemStacks={'prism-shard':1};
 combat.damageEnemy(enemy,20,'normal',1,{},true,true,false,true,1,1,partyDamageSource(s,1,'Crit strike','signature'),1.85);
 const report=runAnalyticsReport(s),proc=report.outgoing.find(row=>row.source.origin==='proc');assert.ok(proc);assert.equal(proc.source.effectId,'item:prism-shard');near(proc.effective,3.5);near(report.totals.outgoing.effective,23.5);near(report.totals.outgoing.effective,s.stats.damageDealt);
});

test('fractional projectile relics preserve learned move attribution through impact',()=>{
 for(const [roll,expectedShots] of [[.25,2],[.75,1]]){
  const {sim,s,combat}=arena(),enemy=foe(sim),member=s.party[0];
  s.items=['multi-lens'];sim.rng.next=()=>roll;
  combat.fireLearnedMove(member,{moveId:'water-gun',rank:1,cooldown:0},enemy);
  assert.equal(s.projectiles.length,expectedShots);
  assert.ok(s.projectiles.every(projectile=>projectile.damageSource?.origin==='learned'&&projectile.damageSource?.move==='Water Gun'&&projectile.damageSource?.actorId===member.uid));
  const launchSpecies=member.speciesId;member.speciesId=8;
  combat.updateProjectiles(.2);
  const report=runAnalyticsReport(s),row=report.outgoing.find(entry=>entry.source.move==='Water Gun');
  assert.ok(row);assert.equal(row.source.origin,'learned');assert.equal(row.source.speciesId,launchSpecies);
  near(row.effective,23*expectedShots);near(report.totals.outgoing.effective,s.stats.damageDealt);
 }
});

test('successful acquisitions retain order/time and minute reports expose observed DPS/build/spawn tuning',()=>{
 const {s}=arena();s.choiceSource='cache';
 s.stats.elapsed=12;const choice=availableItemChoices(s).find(item=>item.id==='razor-claw')!;assert.ok(choice);assert.equal(applyChoice(s,choice).applied,true);
 s.stats.elapsed=42;assert.equal(applyChoice(s,choice).applied,true);assert.equal(applyChoice(s,{...choice,id:'missing'}).applied,false);
 const signature=partyDamageSource(s,1,'Crit strike','signature'),q=partyDamageSource(s,1,'Q strike','q');
 recordDamage(s,{direction:'outgoing',source:signature,attempted:185,applied:185,beforeHp:1000,afterHp:815,criticalTier:1,preCritical:100});
 recordDamage(s,{direction:'outgoing',source:q,attempted:100,applied:100,beforeHp:1000,afterHp:900});
 s.stats.elapsed=60;s.director!.spawned=30;s.director!.denied=2;observeAnalytics(s);const report=runAnalyticsReport(s),sample=report.minuteSamples[0];
 assert.deepEqual(report.acquisitions.map(item=>[item.order,item.at,item.id]),[[1,12,'razor-claw'],[2,42,'razor-claw']]);assert.equal(report.build.items[0].stacks,2);
 near(sample.dps.beforeCrits,100/60);near(sample.dps.afterCrits,185/60);near(sample.dps.withAbility,285/60);near(sample.spawn.acceptedPerSecond,.5);assert.equal(sample.spawn.denied,2);
 assert.equal(sample.at,60);assert.equal(sample.build.items[0].stacks,2);assert.ok(sample.director!.spawnInterval>0);assert.ok(report.build.estimatedDps.withAbility>report.build.estimatedDps.beforeCrits);
});

test('bounded aggregation preserves totals when source cardinality exceeds its storage budget',()=>{
 const {s}=arena();recordDamage(s,{direction:'incoming',source:{origin:'enemy',name:'Threat',move:'Prior wound'},attempted:1,applied:1,beforeHp:2,afterHp:1});
 for(let i=0;i<ANALYTICS_LIMITS.sources+20;i++)recordDamage(s,{direction:'outgoing',source:{origin:'signature',name:'Member',move:`Hit ${i}`,actorId:1},attempted:1,applied:1,beforeHp:2,afterHp:1});
 const report=runAnalyticsReport(s);assert.ok(s.analytics!.sources.length<=ANALYTICS_LIMITS.sources+4);assert.equal(report.recentHits.length,ANALYTICS_LIMITS.recentHits);assert.equal(report.dropped.sources,21);assert.ok(report.recentHits.some(hit=>hit.source.move==='Prior wound'));assert.equal(report.outgoing.reduce((sum,row)=>sum+row.effective,0),ANALYTICS_LIMITS.sources+20);
});

test('merged projectile streams split immutable attribution without changing pool/gameplay rules',()=>{
 const {sim,s,combat}=arena(),enemy=foe(sim);s.player.iframes=100;
 const shot={x:0,z:0,vx:10,vz:0,ttl:1,damage:10,size:.2,kind:'bolt' as const,type:'normal' as const,penetration:0,friendly:true,sourceId:1,poisonChance:0,moveName:'Shared shot',allowProcs:false};
 addProjectile(s,{...shot,damageSource:partyDamageSource(s,1,'Shared shot','signature')});
 for(let i=1;i<DESIGN.maxProjectiles;i++)addProjectile(s,{...shot,x:100,z:100,sourceId:i+100});
 s.party[0].speciesId=8;addProjectile(s,{...shot,damageSource:partyDamageSource(s,1,'Shared shot','signature')});
 assert.equal(s.projectiles.length,DESIGN.maxProjectiles);assert.equal(s.projectiles[0].hitCount,2);combat.updateProjectiles(.4);
 const rows=runAnalyticsReport(s).outgoing.filter(row=>row.source.move==='Shared shot');assert.equal(rows.length,2);assert.deepEqual(rows.map(row=>row.source.speciesId).sort(),[7,8]);near(rows.reduce((sum,row)=>sum+row.effective,0),20);
 assert.equal(enemy.hp,980);
});

test('analytics on/off produces identical gameplay state and random streams',()=>{
 const first=new Simulation(7,8192),second=new Simulation(7,8192);delete second.state.analytics;
 for(const sim of [first,second]){sim.state.player.hp=sim.state.player.maxHp=10000;sim.state.items=['static-orb','echo-bell','toxic-barb'];sim.state.buffs.crit=.25;}
 for(let frame=0;frame<900;frame++){
  const input={...idle,mx:Math.sin(frame/60)*.5,mz:Math.cos(frame/50)*.5,special:frame%160===0,dodge:frame%120===0};
  first.update(1/30,input);second.update(1/30,input);
  if(first.state.phase==='choice'){const id=first.state.upgradeChoices[0]?.id;if(id){first.choose(id);second.choose(id);}}
 }
 const observed=structuredClone(first.state);delete observed.analytics;
 assert.deepEqual(observed,second.state);assert.deepEqual(first.rng.exportState(),second.rng.exportState());
 near(runAnalyticsReport(first.state).totals.outgoing.effective,first.state.stats.damageDealt);
});
