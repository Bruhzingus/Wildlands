import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SAVE,loadSave,recordRun} from '../src/game/save.ts';
import {DEFAULT_SETTINGS,loadSettings,saveSettings} from '../src/game/settings.ts';

const storage=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
 getItem:(key:string)=>storage.get(key)??null,
 setItem:(key:string,value:string)=>storage.set(key,value),
}});

test('damaged saves cannot inject invalid starters or nonnumeric camera and counters',()=>{
 storage.set('wildlands-save-v1',JSON.stringify({version:1,unlocked:[25,999,26,null,'1',133,133],games:'broken',wins:-5,bestKills:12.8,settings:{camera:'oops',volume:12,quality:'unknown'}}));
 const save=loadSave();
 assert.deepEqual(save.unlocked,[1,4,7,25,133]);assert.equal(save.games,0);assert.equal(save.wins,0);
 assert.equal(save.bestKills,12);assert.equal(save.settings.camera,28);assert.equal(save.settings.volume,1);
 storage.set('wildlands-save-v1','null');assert.deepEqual(loadSave(),DEFAULT_SAVE);
 storage.set('wildlands-save-v1','{bad json');assert.deepEqual(loadSave(),DEFAULT_SAVE);
});

test('run recording persists unlocks and best scores',()=>{
 storage.clear();const save=loadSave();recordRun(save,901,200,true);
 assert.equal(save.games,1);assert.equal(save.wins,1);assert.ok(save.unlocked.includes(10));
 assert.equal(loadSave().bestKills,200);assert.equal(loadSave().longestRun,901);
});

test('mouse settings survive reload and ignore damaged stored values',()=>{
 storage.clear();assert.deepEqual(loadSettings(),DEFAULT_SETTINGS);
 saveSettings({mouseSensitivity:1.7,invertY:true});assert.deepEqual(loadSettings(),{...DEFAULT_SETTINGS,mouseSensitivity:1.7,invertY:true});
 storage.set('wildlands-controls-v1',JSON.stringify({mouseSensitivity:'invalid',invertY:'yes'}));
 assert.deepEqual(loadSettings(),DEFAULT_SETTINGS);
 assert.equal(saveSettings({mouseSensitivity:20,invertY:false}).mouseSensitivity,2.5);
});

test('camera-only settings migrate quietly and partial writes retain audio and comfort preferences',()=>{
 storage.clear();
 storage.set('wildlands-controls-v1',JSON.stringify({mouseSensitivity:1.5,invertY:true,futurePreference:'retained'}));
 storage.set('wildlands-save-v1',JSON.stringify({version:1,unlocked:[1,4,7,25,133],games:7,custom:{keep:true}}));
 const runSave=storage.get('wildlands-save-v1');
 assert.deepEqual(loadSettings(),{...DEFAULT_SETTINGS,mouseSensitivity:1.5,invertY:true});
 saveSettings({soundVolume:.4,musicVolume:0,screenShake:false,hitStop:false,reduceFlashes:true});
 const changed=saveSettings({mouseSensitivity:.8,invertY:false});
 assert.deepEqual(changed,{...DEFAULT_SETTINGS,mouseSensitivity:.8,invertY:false,soundVolume:.4,musicVolume:0,screenShake:false,hitStop:false,reduceFlashes:true});
 assert.deepEqual(loadSettings(),changed);assert.equal(JSON.parse(storage.get('wildlands-controls-v1')!).futurePreference,'retained');
 assert.equal(storage.get('wildlands-save-v1'),runSave);
});

test('audio and comfort settings sanitize corrupt values and clamp numeric sliders',()=>{
 storage.clear();storage.set('wildlands-controls-v1','{broken');assert.deepEqual(loadSettings(),DEFAULT_SETTINGS);
 storage.set('wildlands-controls-v1',JSON.stringify({soundVolume:'loud',musicVolume:null,screenShake:'yes',hitStop:1,reduceFlashes:null}));
 assert.deepEqual(loadSettings(),DEFAULT_SETTINGS);
 assert.deepEqual(saveSettings({soundVolume:4,musicVolume:-5,mouseSensitivity:NaN}),{...DEFAULT_SETTINGS,soundVolume:1,musicVolume:0});
 assert.equal(saveSettings({soundVolume:Infinity}).soundVolume,DEFAULT_SETTINGS.soundVolume);
});

test('storage denial still returns working in-memory settings without throwing',()=>{
 const previous=globalThis.localStorage;
 try{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}}});
  assert.deepEqual(loadSettings(),DEFAULT_SETTINGS);
  assert.deepEqual(saveSettings({soundVolume:0,musicVolume:0,screenShake:false}),{...DEFAULT_SETTINGS,soundVolume:0,musicVolume:0,screenShake:false});
 }finally{Object.defineProperty(globalThis,'localStorage',{configurable:true,value:previous});}
});
