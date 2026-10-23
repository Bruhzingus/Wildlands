import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {encodeRunFile} from '../src/game/runSnapshot.ts';
import {storeSuspendedRun,loadSuspendedRun,discardSuspendedRun,SUSPENDED_RUN_KEY} from '../src/game/runStorage.ts';
import {DEFAULT_SAVE} from '../src/game/save.ts';
import {ProgressionTracker} from '../src/game/achievements.ts';

const values=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}});
const runFile=(seed:number)=>{
 const sim=new Simulation(7,seed),tracker=new ProgressionTracker(structuredClone(DEFAULT_SAVE),sim.state,`storage-${seed}`);
 sim.snapshotMetadata=()=>({progression:tracker.exportSnapshot()});
 return encodeRunFile(sim.exportSnapshot(),{runId:tracker.runId,starterId:7,rocketKills:0,victoryRecorded:false});
};

test('run storage keeps an atomic current slot and recovers a valid previous slot without altering collection data',()=>{
 values.clear();values.set('wildlands-save-v1','collection unchanged');
 const first=runFile(71),second=runFile(72);
 assert.equal(storeSuspendedRun(first),true);assert.equal(storeSuspendedRun(second),true);
 assert.equal(loadSuspendedRun().json,second);
 values.set(SUSPENDED_RUN_KEY,'{interrupted');
 assert.equal(loadSuspendedRun().json,first);assert.match(loadSuspendedRun().error!,/previous/);
 assert.equal(storeSuspendedRun('{broken'),false);assert.equal(loadSuspendedRun().json,first);
 assert.equal(discardSuspendedRun(),true);assert.equal(loadSuspendedRun().json,null);
 assert.equal(values.get('wildlands-save-v1'),'collection unchanged');
});

test('storage quota and read failures preserve the live session and return actionable recovery status',()=>{
 const original=globalThis.localStorage;
 try{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){throw new Error('denied');},setItem(){throw new Error('quota');},removeItem(){throw new Error('denied');}}});
  assert.equal(storeSuspendedRun(runFile(73)),false);assert.match(loadSuspendedRun().error!,/unavailable/);assert.equal(discardSuspendedRun(),false);
 }finally{Object.defineProperty(globalThis,'localStorage',{configurable:true,value:original});}
});

test('restored achievement tracking retains run identity and counts victory/endless/defeat once',()=>{
 values.clear();const save=structuredClone(DEFAULT_SAVE),sim=new Simulation(7,74),tracker=new ProgressionTracker(save,sim.state,'portable-run');
 tracker.onKill('rocket',91);sim.state.stats.kills=1;sim.state.stats.elapsed=910;sim.state.stats.bossKilled=true;sim.state.result='victory';tracker.finish(sim.state);
 const snapshot=tracker.exportSnapshot(),restored=ProgressionTracker.restore(save,sim.state,JSON.parse(JSON.stringify(snapshot)));
 assert.deepEqual(restored.exportSnapshot(),snapshot);restored.onKill('rocket',91);
 sim.state.endless=true;sim.state.stats.elapsed=1000;sim.state.result='defeat';restored.finish(sim.state);restored.finish(sim.state);
 assert.equal(save.games,1);assert.equal(save.wins,1);assert.equal(save.totals.kills,1);assert.equal(save.totals.rocketKills,1);assert.equal(save.recentRuns.length,1);
 assert.throws(()=>ProgressionTracker.restore(save,sim.state,{...snapshot,seenKills:'broken'}),/invalid/);
});
