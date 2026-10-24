import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,type MoveInput} from '../src/game/Simulation.ts';
import {RNG} from '../src/utils/random.ts';
import {decodeRunFile,encodeRunFile,isSimulationSnapshot,REWIND_CHECKPOINT_LIMIT,serializeRunState,type SimulationSnapshot} from '../src/game/runSnapshot.ts';
import {applyChoice,makeChoices} from '../src/game/systems/progression.ts';
import {addProjectile} from '../src/game/combat/projectiles.ts';
import {EnemyNavigation} from '../src/game/systems/navigation.ts';
import {ObstacleField} from '../src/game/systems/environment.ts';
const idle:MoveInput={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
const metadata={runId:'run-snapshot-fixture',starterId:1,rocketKills:4,victoryRecorded:false};
function safeRun(seed=381,starter=1){const sim=new Simulation(starter,seed);sim.state.player.iframes=100000;return sim;}
function advance(sim:Simulation,seconds:number){const until=sim.state.stats.elapsed+seconds;while(sim.state.stats.elapsed<until){if(sim.state.phase==='choice')sim.choose(sim.state.upgradeChoices[0].id);sim.update(.04,idle);assert.notEqual(sim.state.phase,'result');}}
function copy<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}

test('RNG states restore future draws without consuming the stream',()=>{
 const rng=new RNG(924);rng.next();const checkpoint=rng.exportState(),expected=Array.from({length:20},()=>rng.next());
 const restored=new RNG(1);restored.restoreState(checkpoint);assert.deepEqual(Array.from({length:20},()=>restored.next()),expected);
 for(const invalid of [0,-1,1.5,NaN,Infinity,0x100000000])assert.throws(()=>restored.restoreState(invalid));
});
test('navigation snapshots preserve pending FIFO scheduling after an enemy is removed',()=>{
 const field=new ObstacleField([{kind:'circle',x:0,z:0,radius:2}]),navigation=new EnemyNavigation();
 const actors=Array.from({length:12},(_,index)=>({uid:index+1,x:-8,z:index*.01})),target={x:8,z:0};
 navigation.beginFrame(field,0);for(const actor of actors)navigation.steer(actor,target,0);
 const survivors=actors.slice(7),snapshot=navigation.exportSnapshot(survivors);
 assert.ok(snapshot.routes.some(route=>route.actor),'Removed enemies still have queued scheduling work');
 const restored=new EnemyNavigation(),resumedActors=structuredClone(survivors);restored.restoreSnapshot(snapshot,resumedActors,field);
 navigation.beginFrame(field,.04);restored.beginFrame(field,.04);
 for(let index=0;index<survivors.length;index++)assert.deepEqual(restored.steer(resumedActors[index],target,.04),navigation.steer(survivors[index],target,.04));
 assert.deepEqual(restored.exportSnapshot(resumedActors),navigation.exportSnapshot(survivors));
});
test('exact snapshot roundtrip preserves seeded combat, navigation, sets, RNG streams and accounting',()=>{
 const original=safeRun(196,4);advance(original,10);
 original.state.player.poisonTime=4;original.state.buffs.crit=.4;
 original.state.build={counters:{test:7},cooldownUntil:{test:50},budgetWindow:10,actionsInWindow:3,metronomeHits:4};
 original.snapshotMetadata=()=>({progression:{id:'same-run',kills:original.state.stats.kills}});
 addProjectile(original.state,{x:0,z:0,vx:5,vz:0,ttl:4,damage:14,size:.2,kind:'bolt',type:'fire',penetration:4,friendly:true,sourceId:1,poisonChance:.2});
 original.state.projectiles.at(-1)!.hit.add(991);
 original.state.psychicRings!.push({uid:original.state.idCounter++,sourceId:80,x:10,z:10,radius:2,previousRadius:1.9,maxRadius:25,speed:3,width:1,damage:2,hit:new Set([1])});
 const snapshot=original.exportSnapshot();assert.ok(isSimulationSnapshot(snapshot));
 const json=encodeRunFile(snapshot,metadata),decoded=decodeRunFile(json);assert.ok(decoded.ok);if(!decoded.ok)return;
 const restored=Simulation.restore(decoded.file.snapshot,{paused:false});
 assert.ok(restored.state.projectiles.at(-1)!.hit instanceof Set);assert.ok(restored.state.psychicRings![0].hit instanceof Set);
 assert.deepEqual(copy(restored.exportSnapshot()),copy(snapshot));
 for(let frame=0;frame<400;frame++){
  const input={...idle,mx:Math.sin(frame*.04),mz:Math.cos(frame*.07)};
  for(const sim of [original,restored]){if(sim.state.phase==='choice')sim.choose(sim.state.upgradeChoices[0].id);sim.update(.04,input);}
 }
 assert.deepEqual(copy(serializeRunState(restored.state)),copy(serializeRunState(original.state)));
 const after=original.exportSnapshot(),resumed=restored.exportSnapshot();assert.deepEqual(resumed.bookkeeping,after.bookkeeping);
 assert.equal(restored.rng.next(),original.rng.next());
});

test('snapshots preserve companion special cooldowns and persistent casts',()=>{
 const original=safeRun(194,1),s=original.state;
 s.party[0].cooldown=1000;
 const member={...structuredClone(s.party[0]),uid:s.idCounter++,speciesId:4,x:2,z:0,specialCooldown:0};s.party.push(member);
 for(const enemy of s.enemies)Object.assign(enemy,{x:7,z:0,hp:100000,maxHp:100000,speed:0,attackCooldown:1000});
 original.update(.02,idle);
 assert.ok(member.specialCooldown>0);assert.ok(s.activeSpecials?.some(effect=>effect.sourceId===member.uid));
 const restored=Simulation.restore(copy(original.exportSnapshot()),{paused:false});
 assert.equal(restored.state.party[1].specialCooldown,member.specialCooldown);
 for(let frame=0;frame<30;frame++){original.update(.02,idle);restored.update(.02,idle);}
 assert.deepEqual(copy(restored.exportSnapshot()),copy(original.exportSnapshot()));
 const invalid=copy(original.exportSnapshot());(invalid.state.party[1] as any).specialCooldown='ready';
 assert.equal(isSimulationSnapshot(invalid),false);
});
test('restoration starts paused and preserves pending choice without granting a second reward',()=>{
 const original=safeRun(),choices=makeChoices(original.state,original.rng,'squad'),choice=choices[0];original.enterChoice(choices,'Choose','squad');
 original.state.pendingLevelUps=[1];original.state.rerolls=2;
 const resumed=Simulation.restore(original.exportSnapshot());assert.equal(resumed.state.phase,'paused');
 const elapsed=resumed.state.stats.elapsed;resumed.update(.04,idle);assert.equal(resumed.state.stats.elapsed,elapsed);
 resumed.pause();assert.equal(resumed.state.phase,'choice');assert.deepEqual(resumed.state.upgradeChoices,original.state.upgradeChoices);
 assert.ok(resumed.choose(choice.id));assert.equal(resumed.choose(choice.id),false);
 assert.equal(resumed.state.buffs[choice.stat!],choice.amount);assert.equal(resumed.state.rerolls,2);
});
test('restoring an interrupted evolution releases its cosmetic reward gate exactly once',()=>{
 const original=safeRun();original.state.pendingSquadRewards=1;
 Object.assign(original,{rewardsDeferred:true});const snapshot=original.exportSnapshot();
 const exact=Simulation.restore(snapshot,{paused:false});assert.equal(exact.exportSnapshot().bookkeeping.rewardsDeferred,true,'Exact deterministic restores keep the private gate');
 const restored=Simulation.restore(snapshot);restored.pause();assert.equal(restored.state.phase,'choice');assert.equal(restored.state.pendingSquadRewards,0);
 assert.equal(restored.exportSnapshot().bookkeeping.rewardsDeferred,false);
 const stream=restored.rng.exportState(),choices=structuredClone(restored.state.upgradeChoices);restored.resumeDeferredRewards();
 assert.equal(restored.rng.exportState(),stream);assert.deepEqual(restored.state.upgradeChoices,choices);
});
test('suspension rolls back the whole run and recent upgrades while retaining map and earlier cooldowns',()=>{
 const sim=safeRun(802);sim.snapshotMetadata=()=>({coins:sim.state.coins});sim.refreshCheckpointMetadata();advance(sim,10);
 const shrine=sim.state.pois.find(poi=>poi.kind==='shrine')!;shrine.used=true;shrine.respawnAt=130;
 const shrineUid=shrine.uid;sim.state.coins=17;advance(sim,35);
 const oldItem='echo-bell';applyChoice(sim.state,{id:oldItem,kind:'item',title:'Relic',description:'',rarity:'rare'});
 sim.state.player.x=30;sim.state.player.z=20;advance(sim,10);
 const training=makeChoices(sim.state,sim.rng,'squad')[0];assert.ok(applyChoice(sim.state,training).applied);
 const chest=sim.state.pois.find(poi=>poi.kind==='cache')!;chest.used=true;chest.respawnAt=150;sim.state.coins=999;advance(sim,15);
 const saved=sim.exportSuspendedSnapshot(),checkpoint=saved.snapshot;
 assert.ok(saved.rewoundSeconds>=30&&saved.rewoundSeconds<31.1);assert.ok(checkpoint.state.stats.elapsed<=saved.savedElapsed-30);
 assert.equal(checkpoint.state.seed,802);assert.equal(checkpoint.state.pois.find(poi=>poi.uid===shrineUid)!.respawnAt,130);
 assert.equal(checkpoint.state.pois.find(poi=>poi.uid===chest.uid)!.used,false);
 assert.equal(checkpoint.state.items.includes(oldItem),false);assert.equal(checkpoint.state.buffs[training.stat!],undefined);
 assert.notEqual(checkpoint.state.player.x,30);assert.equal(checkpoint.state.coins,17);assert.deepEqual(checkpoint.metadata,{coins:17});
 assert.ok((sim as unknown as {rewindCheckpoints:unknown[]}).rewindCheckpoints.length<=REWIND_CHECKPOINT_LIMIT);
 const imported=Simulation.restore(checkpoint);assert.equal(imported.state.phase,'paused');assert.equal(imported.exportSuspendedSnapshot().rewoundSeconds,0);
 imported.pause();advance(imported,31);assert.ok(imported.exportSuspendedSnapshot().rewoundSeconds>=30);
});
test('early suspension returns the opening state and does not retain a newly earned item',()=>{
 const sim=safeRun();sim.state.items.push('echo-bell');advance(sim,5);
 const result=sim.exportSuspendedSnapshot();assert.equal(result.snapshot.state.stats.elapsed,0);assert.deepEqual(result.snapshot.state.items,[]);
 assert.ok(result.rewoundSeconds>=5);assert.equal(result.snapshot.state.phase,'playing');
});
test('boss/endless snapshots retain timed attacks, phase and next chapter schedule',()=>{
 const sim=safeRun(59,25);sim.state.stats.elapsed=899.99;sim.update(.04,idle);assert.equal(sim.state.phase,'boss');
 sim.state.endless=true;sim.state.endlessStartedAt=800;sim.state.nextBossAt=1300;sim.state.enemies.find(enemy=>enemy.isBoss)!.bossStage=1;
 const restored=Simulation.restore(sim.exportSnapshot());assert.equal(restored.state.phase,'paused');restored.pause();assert.equal(restored.state.phase,'boss');
 assert.equal(restored.state.endless,true);assert.equal(restored.state.nextBossAt,1300);assert.equal(restored.state.enemies.find(enemy=>enemy.isBoss)!.bossStage,1);
});
test('snapshot codec rejects malformed, incompatible and completed files without mutating a live run',()=>{
 const sim=safeRun(),snapshot=sim.exportSnapshot(),json=encodeRunFile(snapshot,metadata),before=sim.exportSnapshot();
 const envelope=JSON.parse(json) as {version:number;snapshot:SimulationSnapshot;metadata:typeof metadata};
 const mutations:Array<(value:typeof envelope)=>void>=[
  value=>{value.version=42;},value=>{value.snapshot.version=42 as 1;},value=>{value.snapshot.bookkeeping.rng=0;},
  value=>{value.snapshot.state.party=[];},value=>{value.snapshot.state.party[0].speciesId=500;},
  value=>{value.snapshot.state.projectiles=[{hit:null}] as unknown as SimulationSnapshot['state']['projectiles'];},
  value=>{value.snapshot.state.result='defeat';},value=>{value.metadata.runId='';},
  value=>{value.snapshot.state.buffs={power:null} as unknown as Record<string,number>;},
  value=>{value.snapshot.state.analytics={version:99} as unknown as SimulationSnapshot['state']['analytics'];},
  value=>{value.snapshot.state.analytics!.sources=[{source:{name:32}}] as unknown as NonNullable<SimulationSnapshot['state']['analytics']>['sources'];},
  value=>{value.snapshot.state.analytics!.recentHits=null as unknown as NonNullable<SimulationSnapshot['state']['analytics']>['recentHits'];},
  value=>{value.snapshot.state.player.movement={speciesId:1} as unknown as SimulationSnapshot['state']['player']['movement'];},
  value=>{value.snapshot.bookkeeping.resumePhase='title';},value=>{value.snapshot.state.rerolls='broken' as unknown as number;},
  value=>{value.snapshot.state.phase='choice';value.snapshot.bookkeeping.resumePhase='choice';},
  value=>{(value.snapshot.state.pois[0] as unknown as Record<string,unknown>).challenge={id:'invalid',tier:1,endsAt:10};},
 ];
 for(const mutate of mutations){const bad=copy(envelope);mutate(bad);assert.equal(decodeRunFile(JSON.stringify(bad)).ok,false);}
 assert.equal(decodeRunFile('{').ok,false);assert.equal(decodeRunFile('{}').ok,false);
 assert.deepEqual(sim.exportSnapshot(),before);
 const cyclic=sim.exportSnapshot();cyclic.metadata.loop=cyclic.metadata;assert.equal(isSimulationSnapshot(cyclic),false);
 const shared={label:'same'};const aliased=sim.exportSnapshot();aliased.metadata={first:shared,second:shared};assert.equal(isSimulationSnapshot(aliased),true);
});
