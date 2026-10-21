import test from 'node:test';
import assert from 'node:assert/strict';
import {ACHIEVEMENTS,BASE_ITEMS,GATED_ITEMS,GATED_RECRUITS,MAP_OPTIONS,CHALLENGE_OPTIONS} from '../src/data/unlocks.ts';
import {ITEM_DEFINITIONS} from '../src/data/items.ts';
import {starterChoices} from '../src/data/kanto.ts';
import {DEFAULT_SAVE,SAVE_KEY,exportSave,importSave,loadSave,migrateSave,persist,selectRunOptions} from '../src/game/save.ts';
import {ProgressionTracker} from '../src/game/achievements.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {renderUnlockLibrary,renderRunOptions,renderProgressionResult} from '../src/ui/UnlockLibrary.ts';

const storage=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)}});
const fresh=()=>structuredClone(DEFAULT_SAVE);
const state=()=>new Simulation(1,346).state;

test('v1 migration retains every prior partner, all available relics/recruits, scores and settings',()=>{
 const migrated=migrateSave({version:1,unlocked:[1,4,7,25,133,63],games:14,wins:3,bestKills:808,longestRun:1453,settings:{volume:.6,camera:33,quality:'low'}})!;
 assert.equal(migrated.version,2);assert.deepEqual(migrated.unlocked,[1,4,7,25,133,63,10]);
 assert.deepEqual(new Set(migrated.unlockedItems),new Set(ITEM_DEFINITIONS.map(item=>item.id)));
 assert.deepEqual(migrated.unlockedRecruits,[...GATED_RECRUITS]);assert.equal(migrated.games,14);assert.equal(migrated.wins,3);
 assert.deepEqual(migrated.settings,{volume:.6,camera:33,quality:'low'});assert.equal(migrated.bestKills,808);assert.equal(migrated.longestRun,1453);
 assert.deepEqual(migrated.achievements,['psychic-break']);assert.deepEqual(migrated.totals,{kills:0,rocketKills:0});
 assert.ok(!migrated.achievements.includes('everyone-home'),'old win does not invent party history');
});

test('new save has finite side unlocks without hidden HP/damage fields or starter regressions',()=>{
 const save=fresh();assert.deepEqual(save.unlocked,[1,4,7,25]);assert.equal(save.unlockedItems.length,BASE_ITEMS.length);assert.deepEqual(save.unlockedItems,BASE_ITEMS);
 assert.equal(ACHIEVEMENTS.length,10);assert.equal(new Set(ACHIEVEMENTS.map(entry=>entry.id)).size,10);
 assert.deepEqual(new Set([...save.unlocked,...ACHIEVEMENTS.flatMap(entry=>entry.reward.starters??[])]),new Set(starterChoices()));
 assert.deepEqual(new Set(ACHIEVEMENTS.flatMap(entry=>entry.reward.items??[])),new Set(GATED_ITEMS));
 assert.ok(ACHIEVEMENTS.every(entry=>!('power' in entry.reward)&&!('hp' in entry.reward)));
});

test('damaged v2 fields cannot create foreign species/items/options, fake achievements or unsafe counts',()=>{
 const save=migrateSave({version:2,unlocked:[999,26,133,133,'63'],unlockedItems:['bogus','life-orb'],unlockedRecruits:[150,143],unlockedMaps:['bogus'],unlockedChallenges:['famine',7],selection:{map:'ruins-route',challenge:'bogus'},achievements:['made-up','first-watch','first-watch'],achievementProgress:{'rocket-patrol':9999,'trail-reader':-2},totals:{kills:Infinity,rocketKills:'100'},recentRuns:[{id:'same',kills:1},{id:'same',kills:3},null,{id:'x'.repeat(101)}]})!;
 assert.deepEqual(save.unlocked,[1,4,7,25,133,16,27]);assert.deepEqual(save.unlockedRecruits,[143]);
 assert.ok(!save.unlockedItems.includes('bogus'));assert.deepEqual(save.selection,{map:'wildlands',challenge:'standard'});
 assert.deepEqual(save.achievements,['first-watch']);assert.equal(save.achievementProgress['rocket-patrol'],100);
 assert.equal(save.achievementProgress['trail-reader'],undefined);assert.deepEqual(save.totals,{kills:0,rocketKills:0});assert.equal(save.recentRuns.length,1);
 assert.equal(migrateSave({version:99}),null);assert.equal(migrateSave([]),null);
});

test('valid export/import round trip and corrupt/foreign/oversized files leave current save intact',()=>{
 const save=fresh();save.unlocked.push(133);save.games=5;save.achievements.push('rocket-patrol');
 const result=importSave(exportSave(save));assert.ok(result.ok);assert.ok(result.save.unlocked.includes(133));assert.equal(result.save.games,5);assert.ok(result.save.unlockedItems.includes('iron-ball'));
 const before=JSON.stringify(save);
 for(const json of ['{broken','null','[]','{"version":99}','{"version":2,"project":"some-other-game"}','x'.repeat(250001)])assert.equal(importSave(json).ok,false);
 assert.equal(JSON.stringify(save),before);
});

test('selection accepts only earned routes/rules and survives reload',()=>{
 storage.clear();const save=fresh();selectRunOptions(save,{map:'ruins-route',challenge:'famine'});assert.deepEqual(save.selection,{map:'wildlands',challenge:'standard'});
 save.unlockedMaps.push('pinewood-route');save.unlockedChallenges.push('quickened');selectRunOptions(save,{map:'pinewood-route',challenge:'quickened'});
 assert.deepEqual(loadSave().selection,{map:'pinewood-route',challenge:'quickened'});assert.ok(storage.has(SAVE_KEY));
 assert.notEqual(MAP_OPTIONS[1].seed,MAP_OPTIONS[2].seed);assert.equal(CHALLENGE_OPTIONS.length,5);
});

test('actual snapshot boundaries award survival once and persist a midrun achievement without counting a completed game',()=>{
 storage.clear();const save=fresh(),s=state(),tracker=new ProgressionTracker(save,s,'boundary');
 s.stats.elapsed=179.99;assert.equal(tracker.observe(s).earned.length,0);assert.equal(save.games,0);
 s.stats.elapsed=180;const result=tracker.observe(s);assert.deepEqual(result.earned.map(entry=>entry.id),['first-watch']);assert.equal(result.saved,true);
 assert.ok(loadSave().unlocked.includes(16));assert.equal(loadSave().games,0);assert.equal(tracker.observe(s).earned.length,0);
 tracker.finish(s);tracker.finish(s);assert.equal(save.games,1);assert.equal(save.wins,0);
});

test('team achievement uses living members and evolution requires leader and follower within same run',()=>{
 const save=fresh(),s=state();s.party.push({...s.party[0],uid:2,speciesId:13},{...s.party[0],uid:3,speciesId:43},{...s.party[0],uid:4,speciesId:23,hp:0});
 const tracker=new ProgressionTracker(save,s,'team');tracker.observe(s);assert.ok(!save.achievements.includes('squad-assembly'));
 s.party[3].hp=100;tracker.observe(s);assert.ok(save.achievements.includes('squad-assembly'));assert.deepEqual(save.unlockedRecruits,[83,95,114]);
 s.party[0].speciesId=2;tracker.observe(s);assert.ok(!save.achievements.includes('growing-together'));
 s.party[1].speciesId=14;tracker.observe(s);assert.ok(save.achievements.includes('growing-together'));assert.ok(save.unlocked.includes(63));
 const s2=state(),tracker2=new ProgressionTracker(save,s2,'other');s2.party[0].speciesId=2;tracker2.observe(s2);assert.equal(save.achievements.filter(id=>id==='growing-together').length,1);
});

test('Poison accomplishment needs two living Poison types at15min; discoveries/relics use distinct actual contents',()=>{
 const save=fresh(),s=state(),tracker=new ProgressionTracker(save,s,'poison');s.stats.elapsed=900;s.party.push({...s.party[0],uid:2,speciesId:13,hp:0});
 s.items=Array(8).fill('leftovers');s.pois.slice(0,3).forEach(poi=>poi.used=true);tracker.observe(s);
 assert.ok(!save.achievements.includes('poison-patrol'));assert.ok(!save.achievements.includes('relic-satchel'));assert.ok(!save.achievements.includes('trail-reader'));
 s.party[1].hp=100;s.items=ITEM_DEFINITIONS.slice(0,8).map(item=>item.id);s.pois[3].used=true;tracker.observe(s);
 for(const id of ['poison-patrol','relic-satchel','trail-reader'])assert.ok(save.achievements.includes(id));
 assert.ok(save.unlockedMaps.includes('pinewood-route'));assert.ok(save.unlockedItems.includes('echo-bell'));
});

test('Rocket kill accounting uses semantic deduplicated deaths across runs, never normal hits or despawns',()=>{
 const save=fresh(),s=state(),tracker=new ProgressionTracker(save,s,'rocket-a');
 for(let uid=1;uid<=60;uid++){tracker.onKill('rocket',uid);tracker.onKill('rocket',uid);tracker.onKill('normal',uid+100);}
 tracker.finish(s);assert.equal(save.totals.rocketKills,60);assert.ok(!save.achievements.includes('rocket-patrol'));
 const next=state(),tracker2=new ProgressionTracker(save,next,'rocket-b');
 for(let uid=1;uid<=39;uid++)tracker2.onKill('rocket',uid);tracker2.observe(next);assert.ok(!save.achievements.includes('rocket-patrol'));
 tracker2.onKill('rocket',40);tracker2.observe(next);assert.ok(save.achievements.includes('rocket-patrol'));assert.equal(save.totals.rocketKills,100);
 tracker2.finish(next);tracker2.finish(next);assert.equal(save.totals.rocketKills,100);assert.equal(save.games,2);
});

test('victory -> endless -> defeat has one game/win and exact incremental lifetime/best counters',()=>{
 const save=fresh(),s=state(),tracker=new ProgressionTracker(save,s,'same-run');s.stats.elapsed=927;s.stats.kills=500;s.stats.bossKilled=true;s.result='victory';
 tracker.finish(s);assert.equal(save.games,1);assert.equal(save.wins,1);assert.equal(save.totals.kills,500);assert.ok(save.unlocked.includes(10));
 s.endless=true;s.endlessStartedAt=927;s.result=null;tracker.observe(s);s.stats.elapsed=2126.99;s.stats.kills=900;tracker.observe(s);
 assert.ok(!save.achievements.includes('beyond-the-watch'),'19:59.99 endless is insufficient');
 s.stats.elapsed=2127;tracker.observe(s);assert.ok(save.achievements.includes('beyond-the-watch'));assert.ok(save.unlockedChallenges.includes('famine'));
 s.result='defeat';tracker.finish(s);tracker.finish(s);
 assert.equal(save.games,1);assert.equal(save.wins,1);assert.equal(save.bestKills,900);assert.equal(save.longestRun,2127);assert.equal(save.totals.kills,900);
 assert.equal(tracker.earnedThisRun().filter(entry=>entry.id==='beyond-the-watch').length,1);
});

test('faint history prevents no-loss victory reward and different run IDs count separate attempts',()=>{
 const save=fresh(),s=state(),tracker=new ProgressionTracker(save,s,'lost-member');s.stats.bossKilled=true;s.stats.faints=1;tracker.finish(s);
 assert.ok(!save.achievements.includes('everyone-home'));assert.ok(!save.unlockedChallenges.includes('quickened'));
 new ProgressionTracker(save,s,'new-attempt').finish(s);assert.equal(save.games,2);assert.equal(save.wins,2);
});

test('run history is bounded and storage denial preserves in-memory earned progression',()=>{
 const save=fresh(),s=state();for(let i=0;i<40;i++)new ProgressionTracker(save,s,`run-${i}`).finish(s);assert.equal(save.recentRuns.length,32);assert.equal(save.games,40);
 const previous=globalThis.localStorage;try{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){throw Error('denied');},setItem(){throw Error('denied');}}});
  const offline=fresh(),run=state(),tracker=new ProgressionTracker(offline,run,'denied');run.stats.elapsed=180;
  const change=tracker.observe(run);assert.equal(change.saved,false);assert.ok(offline.unlocked.includes(16));assert.equal(persist(offline),false);assert.deepEqual(loadSave(),DEFAULT_SAVE);
 }finally{Object.defineProperty(globalThis,'localStorage',{configurable:true,value:previous});}
});

test('library exposes all10 requirements, collectible partners, lock text, backups and honest route labels',()=>{
 const save=fresh(),library=renderUnlockLibrary(save),options=renderRunOptions(save);
 assert.equal((library.match(/data-achievement=/g)??[]).length,10);assert.equal((library.match(/data-collection-partner=/g)??[]).length,starterChoices().length);
 assert.ok(library.includes('Export save'));assert.ok(library.includes('Import save'));assert.ok(library.includes('COLLECTED'));assert.ok(library.includes('Rocket patrol'));
 assert.ok(options.includes('Wildlands'));assert.ok(!options.includes('value="pinewood-route"'));assert.equal(renderProgressionResult([]),'');
 assert.ok(renderProgressionResult([ACHIEVEMENTS[0]]).includes('Collection updated'));
});
