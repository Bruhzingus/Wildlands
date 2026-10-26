import {Engine,Scene,ArcRotateCamera,Vector3,Color3} from '@babylonjs/core';
import {Simulation,type MoveInput,type GameEvent} from './Simulation.ts';
import {World} from './render/World.ts';
import {AssetLibrary,CharacterVisuals} from './render/AssetLibrary.ts';
import {Effects} from './render/Effects.ts';
import {HealthBars} from './render/HealthBars.ts';
import {DamageNumbers} from './render/DamageNumbers.ts';
import {EvolutionEffect} from './render/EvolutionEffect.ts';
import {UI} from '../ui/UI.ts';
import {loadSave,type SaveData} from './save.ts';
import {availableStarters,availableRecruitUnlocks} from './characterAccess.ts';
import {ProgressionTracker} from './achievements.ts';
import {MAP_OPTIONS} from '../data/unlocks.ts';
import {cameraAimDirection,cameraRelativeMovement,keyboardLook,mouseLook} from './input.ts';
import {requestCameraPointerLock} from './pointerLock.ts';
import {GameAudio} from './audio.ts';
import {ImpactFeedback} from './feedback.ts';
import {AutomaticQuality,graphicsProfile,initialQuality} from './graphics.ts';
import {FrameMetrics} from './performance.ts';
import type {EvolutionReceipt} from './evolution.ts';
import {ELEMENT_COLORS,getSpecies} from '../data/kanto.ts';
import {decodeRunFile,encodeRunFile} from './runSnapshot.ts';
import {loadSuspendedRun,storeSuspendedRun,discardSuspendedRun} from './runStorage.ts';
import {downloadJSON} from '../ui/runFiles.ts';
import type {ProgressionSnapshot} from './achievements.ts';

const isActive=(sim:Simulation|null)=>sim?.state.phase==='playing'||sim?.state.phase==='boss';
const withoutActions=(input:MoveInput):MoveInput=>({...input,jump:false,dodge:false,special:false,interact:false});

export class Game{
 private evolution:EvolutionReceipt|null=null;
 private evolutionEffect:EvolutionEffect|null=null;private evolutionTime=0;private evolutionCuePending=false;
 private damageNumbers:DamageNumbers|null=null;
 private canvas=document.querySelector<HTMLCanvasElement>('#renderCanvas')!;
 private engine:Engine;private scene:Scene;private camera:ArcRotateCamera;
 private ui:UI;private sim:Simulation|null=null;private world:World|null=null;private assets:AssetLibrary|null=null;private visuals:CharacterVisuals|null=null;private fx:Effects|null=null;private healthBars:HealthBars|null=null;
 private save:SaveData;private pressed=new Set<string>();private justPressed=new Set<string>();private ended=false;private previous=performance.now();
 private progression:ProgressionTracker|null=null;
 private savedRunJSON:string|null=null;private recoveryRunId:string|null=null;private lastRecoveryWrite=0;
 private listeners=new AbortController();private lastPhase='title';private pointerCaptured=false;private flashUntil=0;
 private captureWanted=false;private capturePending=false;private captureAttempt=0;private captureTimer=0;
 private captureError:(()=>void)|null=null;
 private audio:GameAudio;private feedback:ImpactFeedback;private motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
 private pendingActions={jump:false,dodge:false,special:false,interact:false};private previousSpecialCooldown:number|null=null;
 private automatic=new AutomaticQuality(initialQuality(navigator.hardwareConcurrency,(navigator as Navigator&{deviceMemory?:number}).deviceMemory??8));
 private cameraTarget=new Vector3();private metrics:FrameMetrics|null=null;
 private dev=new URLSearchParams(location.search).get('dev')==='1';private speed=Number(new URLSearchParams(location.search).get('speed'))||1;
 constructor(){
  this.save=loadSave();this.engine=new Engine(this.canvas,true,{preserveDrawingBuffer:false,stencil:false,antialias:true},true);
  this.scene=new Scene(this.engine);this.scene.ambientColor=new Color3(.5,.5,.5);
  this.camera=new ArcRotateCamera('player-follow',-Math.PI/2,1.11,28,new Vector3(0,2,0),this.scene);
  this.camera.lowerRadiusLimit=14;this.camera.upperRadiusLimit=48;this.camera.lowerBetaLimit=.48;this.camera.upperBetaLimit=1.43;
  // Own the input mapping: Babylon's keyboard camera otherwise also consumes arrow keys.
  this.camera.inputs.clear();this.camera.inertia=0;
  this.ui=new UI(this.save);
  if(import.meta.env.DEV&&this.dev)this.metrics=new FrameMetrics();
  this.audio=new GameAudio(this.ui.settings);this.feedback=new ImpactFeedback(this.ui.settings,this.motionPreference.matches);
  this.applyGraphics();
  this.ui.onSettingsChange=settings=>{this.audio.unlock();this.audio.setSettings(settings);this.feedback.setSettings(settings);this.applyGraphics();if(settings.reduceFlashes)this.flashUntil=0;};
  this.motionPreference.addEventListener('change',event=>{this.feedback.setReducedMotion(event.matches);this.applyGraphics();if(event.matches)this.flashUntil=0;},{signal:this.listeners.signal});
  this.ui.onStart=id=>this.start(id);
  this.ui.onPick=id=>this.pick(id);
  this.ui.onReroll=()=>{if(this.sim?.reroll()){this.audio.unlock();this.audio.cue('upgrade');this.ui.update(this.sim.state);}};
  this.ui.onResume=()=>this.captureForPlay();
  this.ui.onSuspend=()=>this.suspendRun();
  this.ui.onResumeSaved=()=>{if(this.savedRunJSON)this.restoreRun(this.savedRunJSON);};
  this.ui.onImportRun=json=>this.importRun(json);
  this.ui.onDiscardSaved=()=>{
   const removed=discardSuspendedRun();this.savedRunJSON=null;this.recoveryRunId=null;this.refreshRecovery();
   this.ui.toast(removed?'Saved run discarded.':'Browser storage could not be cleared.');
  };
  this.ui.onRestart=()=>this.restart();
  this.ui.onEndless=()=>{this.ended=false;this.clearInput();this.sim?.continueEndless();this.captureForPlay();};
  this.refreshRecovery();
  this.installInput();this.engine.runRenderLoop(()=>this.frame());
  window.addEventListener('resize',()=>{this.applyGraphics();this.engine.resize();},{signal:this.listeners.signal});
 }
 private applyGraphics(){
  const profile=graphicsProfile(this.ui.settings,this.automatic.quality,window.devicePixelRatio);
  if(this.engine.getHardwareScalingLevel()!==profile.hardwareScaling)this.engine.setHardwareScalingLevel(profile.hardwareScaling);
  this.world?.setQuality(profile.quality);this.fx?.setPresentation(profile.effectDensity,this.motionPreference.matches);
 }
 inspectPerformance(){
  const memory=(performance as Performance&{memory?:{usedJSHeapSize:number;totalJSHeapSize:number}}).memory;
  return {frames:this.metrics?.inspect()??null,graphics:graphicsProfile(this.ui.settings,this.automatic.quality,window.devicePixelRatio),
   resources:{meshes:this.scene.meshes.length,activeMeshes:this.scene.getActiveMeshes().length,geometries:this.scene.geometries.length,materials:this.scene.materials.length,textures:this.scene.textures.length,spriteManagers:this.scene.spriteManagers?.length??0,transformNodes:this.scene.transformNodes.length,lights:this.scene.lights.length},
   simulation:this.sim?{elapsed:this.sim.state.stats.elapsed,enemies:this.sim.state.enemies.length,party:this.sim.state.party.length,projectiles:this.sim.state.projectiles.length,drops:this.sim.state.drops.length}:null,
   effects:this.fx?.inspect()??null,heap:memory?{used:memory.usedJSHeapSize,total:memory.totalJSHeapSize}:null,audio:this.audio.inspect()};
 }
 private clearInput(){this.pressed.clear();this.justPressed.clear();this.pendingActions={jump:false,dodge:false,special:false,interact:false};}
 private pick(id:string){
  this.audio.unlock();this.audio.setActive(false);this.clearInput();
  const choice=this.sim?.state.upgradeChoices.find(choice=>choice.id===id);
  if(this.sim?.choose(id,choice?.kind==='evolve')){if(choice?.kind!=='evolve')this.audio.cue(choice?.kind==='recruit'?'recruit':'upgrade');this.observeProgression();}
  this.captureForPlay(choice?.kind==='evolve'&&!!this.evolution);
 }
 private releasePointer(){
  this.captureWanted=false;this.capturePending=false;this.captureAttempt++;clearTimeout(this.captureTimer);this.pointerCaptured=false;this.captureError=null;
  if(document.pointerLockElement===this.canvas)document.exitPointerLock();
 }
 private pause(){this.clearInput();if(isActive(this.sim))this.sim?.pause();this.releasePointer();this.audio.silence();this.feedback.reset();this.flashUntil=0;}
 /** Called directly from a click/key gesture; browsers require that to capture. */
 private captureForPlay(keepEvolutionVisible=false){
  const sim=this.sim;if(!sim||(!isActive(sim)&&sim.state.phase!=='paused'))return;
  this.audio.unlock();this.audio.setActive(false);this.feedback.reset();
  this.clearInput();
  if(isActive(sim)&&!keepEvolutionVisible)sim.pause();
  this.lastPhase=sim.state.phase;this.captureWanted=true;
  this.ui.setCaptureHint('Use arrow keys or the mouse to look. Enter on Resume continues play. Esc pauses.');
  this.ui.update(sim.state);this.canvas.focus();
  if(document.pointerLockElement===this.canvas){this.captureReady();return;}
  if(this.capturePending)return;
  this.capturePending=true;const attempt=++this.captureAttempt;
  this.captureTimer=window.setTimeout(()=>this.captureFailed(attempt),5000);
  this.captureError=requestCameraPointerLock(this.canvas,
   ()=>attempt===this.captureAttempt&&this.captureWanted&&this.capturePending,
   ()=>this.captureFailed(attempt));
 }
 private captureReady(){
  this.capturePending=false;clearTimeout(this.captureTimer);this.captureError=null;
  if(!this.captureWanted||!this.sim||(!isActive(this.sim)&&this.sim.state.phase!=='paused')){this.releasePointer();return;}
  this.pointerCaptured=document.pointerLockElement===this.canvas;this.clearInput();
  if(this.sim.state.phase==='paused')this.sim.pause();
  if(!isActive(this.sim)){
   this.releasePointer();this.audio.setActive(false);this.lastPhase=this.sim.state.phase;this.previous=performance.now();this.ui.update(this.sim.state);return;
  }
  this.audio.setActive(true);
  if(this.evolutionCuePending){this.evolutionCuePending=false;this.audio.cue('evolve',this.evolution?.to);}
  this.lastPhase=this.sim.state.phase;this.previous=performance.now();this.ui.update(this.sim.state);this.canvas.focus();
 }
 private captureFailed(attempt:number){
  if(attempt!==this.captureAttempt||!this.captureWanted)return;
  if(document.pointerLockElement===this.canvas){this.captureReady();return;}
  this.captureReady();
  this.ui.toast('Use arrow keys to look and WASD to move. Esc pauses.');
 }
 private installInput(){const signal=this.listeners.signal;
  // Space belongs to jumping, including when a popup takes focus mid-press.
  // Cancel both native activation events before controls can consume them.
  const preventSpaceActivation=(event:KeyboardEvent)=>{if(event.code==='Space'&&!this.ui.isCatalogueOpen())event.preventDefault();};
  window.addEventListener('keydown',preventSpaceActivation,{signal,capture:true});
  window.addEventListener('keyup',preventSpaceActivation,{signal,capture:true});
  window.addEventListener('keydown',e=>{
   if(e.code==='Escape'){
    if(e.repeat)return;
    if(isActive(this.sim)||this.capturePending)this.pause();
    return;
   }
   const target=e.target as HTMLElement|null;
   if(target?.matches('input,select,textarea'))return;
   if(!e.repeat&&this.sim&&this.ui.handleNumber(e.key,this.sim.state)){e.preventDefault();this.clearInput();return;}
   if(!isActive(this.sim))return;
   if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
   if(!this.pressed.has(e.code)&&!e.repeat)this.justPressed.add(e.code);
   this.pressed.add(e.code);
   if(e.repeat)return;
   if(this.dev&&this.sim){if(e.code==='BracketRight')this.sim.debugAdvance(120);if(e.code==='BracketLeft')this.sim.debugLevel();if(e.code==='Backslash')this.sim.debugHeal();}
  },{signal});
  window.addEventListener('keyup',e=>this.pressed.delete(e.code),{signal});
  window.addEventListener('blur',()=>this.pause(),{signal});
  window.addEventListener('wildlands:gallery-open',()=>this.pause(),{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();},{signal});
  window.addEventListener('pagehide',()=>{this.pause();this.checkpointRecovery();},{signal});
  document.addEventListener('mousemove',e=>{
   if(!isActive(this.sim)||document.pointerLockElement!==this.canvas)return;
   const look=mouseLook(this.camera.alpha,this.camera.beta,e.movementX,e.movementY,this.ui.settings.mouseSensitivity,this.ui.settings.invertY);
   this.camera.alpha=look.alpha;this.camera.beta=look.beta;
  },{signal});
  this.canvas.addEventListener('pointerdown',e=>{
   if(!isActive(this.sim)||e.button!==0)return;
   if(document.pointerLockElement!==this.canvas)this.captureForPlay();
  },{signal});
  document.addEventListener('pointerlockchange',()=>{
   if(document.pointerLockElement===this.canvas){this.captureReady();return;}
   const lost=this.pointerCaptured;this.pointerCaptured=false;
   if(lost){this.pause();this.ui.setCaptureHint('Mouse released. Click Resume to lock the mouse and continue.');if(this.sim)this.ui.update(this.sim.state);}
  },{signal});
  document.addEventListener('pointerlockerror',()=>{if(this.capturePending)this.captureError?.();},{signal});
  this.canvas.addEventListener('wheel',e=>{
   if(!isActive(this.sim)||document.pointerLockElement!==this.canvas)return;e.preventDefault();
   this.camera.radius=Math.max(14,Math.min(48,this.camera.radius+Math.sign(e.deltaY)*1.4));
  },{signal,passive:false});
  this.canvas.addEventListener('contextmenu',e=>e.preventDefault(),{signal});
 }
 private start(starterId:number){if(!availableStarters(this.save).includes(starterId))return;this.audio.unlock();this.cleanupRun();this.ended=false;
  const map=MAP_OPTIONS.find(option=>option.id===this.save.selection.map)!;
  this.sim=new Simulation(starterId,map.seed,{mapId:map.id,challenge:this.save.selection.challenge,itemUnlocks:[...this.save.unlockedItems],recruitUnlocks:availableRecruitUnlocks(this.save)});
  this.progression=new ProgressionTracker(this.save,this.sim.state);this.ui.setProgressionResult([]);
  this.bindSnapshotAccounting();this.lastRecoveryWrite=0;
  this.attachRun();
  this.ui.toast('WASD move. Arrow keys or mouse look. Esc pauses.');this.captureForPlay();this.checkpointRecovery();
 }
 private bindSnapshotAccounting(){
  const sim=this.sim,tracker=this.progression;if(!sim||!tracker)return;
  sim.snapshotMetadata=()=>{tracker.observe(sim.state);return {progression:tracker.exportSnapshot()};};
  sim.refreshCheckpointMetadata();
 }
 private attachRun(){
  if(!this.sim)return;
  this.world=new World(this.scene,this.sim.state.seed,this.sim.state.pois,this.sim.state.mapId,this.sim.state.berryTrees??[]);
  this.assets=new AssetLibrary(this.scene);this.visuals=new CharacterVisuals(this.assets);
  this.healthBars=new HealthBars(this.scene,this.motionPreference.matches,id=>this.assets?.headroom(id)??1);
  this.damageNumbers=new DamageNumbers(this.scene,(x,z)=>this.world!.height(x,z),id=>this.assets?.headroom(id)??1);
  this.fx=new Effects(this.scene,this.world);this.sim.onEvent=e=>this.event(e);
  this.applyGraphics();this.automatic.resetWindow();this.metrics?.reset();
  const {x,z}=this.sim.state.player;
  this.camera.setTarget(new Vector3(x,this.world.height(x,z)+2,z));this.camera.alpha=-Math.PI/2;this.camera.beta=1.05;this.camera.radius=this.save.settings.camera;
  this.lastPhase=this.sim.state.phase;this.previous=performance.now();
  this.previousSpecialCooldown=null;
  this.ui.update(this.sim.state);
 }
 private refreshRecovery(){
  const recovery=loadSuspendedRun();this.savedRunJSON=recovery.json;
  const decoded=recovery.json?decodeRunFile(recovery.json):null;
  this.recoveryRunId=decoded?.ok?decoded.file.metadata.runId:null;
  const state=decoded?.ok?decoded.file.snapshot.state:null;
  this.ui.setRunRecovery(state?`${getSpecies(state.party[0].speciesId).name} · ${Math.floor(state.stats.elapsed/60)}:${String(Math.floor(state.stats.elapsed%60)).padStart(2,'0')} · ${state.mapId??'wildlands'} · ${state.party.length} in squad`:null,!!recovery.json||!!recovery.error,recovery.error);
 }
 private runFile(){
  if(!this.sim||!this.progression)return null;
  const saved=this.sim.exportSuspendedSnapshot(),account=saved.snapshot.metadata.progression as ProgressionSnapshot|undefined;
  if(!account)throw new Error('Run checkpoint accounting is unavailable. Resume briefly before saving again.');
  const json=encodeRunFile(saved.snapshot,{runId:account.runId,starterId:saved.snapshot.state.party[0].speciesId,rocketKills:account.rocketKills,
   victoryRecorded:this.save.recentRuns.find(run=>run.id===account.runId)?.victory??false,savedElapsed:saved.savedElapsed,rewoundSeconds:saved.rewoundSeconds});
  return {...saved,json};
 }
 private checkpointRecovery(){
  if(!this.sim||!this.progression||this.sim.state.result!==null||this.recoveryRunId&&this.recoveryRunId!==this.progression.runId)return;
  try{const file=this.runFile();if(file&&storeSuspendedRun(file.json)){this.savedRunJSON=file.json;this.recoveryRunId=this.progression.runId;}}catch{/* Explicit saving can still report any failure and keep the live run. */}
 }
 private suspendRun(){
  if(!this.sim||this.sim.state.phase!=='paused')return;
  try{
   const file=this.runFile();if(!file)return;
   downloadJSON(file.json,`wildlands-run-${this.progression!.runId}.json`);
   const stored=storeSuspendedRun(file.json);
   this.savedRunJSON=file.json;this.recoveryRunId=this.progression!.runId;
   this.cleanupRun();this.ui.showTitle();
   if(stored)this.refreshRecovery();else{
    this.ui.setRunRecovery(`Downloaded checkpoint at ${Math.floor(file.snapshot.state.stats.elapsed)} seconds.`,true,'Browser storage is unavailable. Keep the downloaded run file; this copy lasts for this session.');
   }
   this.ui.toast(`Run saved. Restoring returns ${Math.round(file.rewoundSeconds)} seconds earlier.`);
  }catch(error){this.ui.toast(error instanceof Error?error.message:'The run could not be saved. Your paused run is still available.');}
 }
 private restoreRun(json:string){
  const decoded=decodeRunFile(json);if(!decoded.ok){this.ui.toast(decoded.error);return;}
  try{
   const sim=Simulation.restore(decoded.file.snapshot),account=decoded.file.snapshot.metadata.progression;
   const tracker=ProgressionTracker.restore(this.save,sim.state,account);
   if(tracker.runId!==decoded.file.metadata.runId)throw new Error('The saved run identity does not match its accounting.');
   this.cleanupRun();this.sim=sim;this.progression=tracker;this.ui.setProgressionResult([]);this.bindSnapshotAccounting();
   this.lastRecoveryWrite=sim.state.stats.elapsed;this.attachRun();
   // Keep a recovery copy until death or an explicit discard. Import never changes the collection.
   if(storeSuspendedRun(json)){this.savedRunJSON=json;this.recoveryRunId=tracker.runId;}
   this.ui.toast('Run restored and paused. Choose Resume when ready.');
  }catch(error){this.ui.toast(error instanceof Error?error.message:'The saved run could not be restored.');}
 }
 private importRun(json:string){
  const decoded=decodeRunFile(json);if(!decoded.ok){this.ui.setRunFileStatus(decoded.error);return;}
  try{
   const sim=Simulation.restore(decoded.file.snapshot),tracker=ProgressionTracker.restore(this.save,sim.state,decoded.file.snapshot.metadata.progression);
   if(tracker.runId!==decoded.file.metadata.runId)throw new Error('The saved run identity does not match its accounting.');
   const stored=storeSuspendedRun(json);this.savedRunJSON=json;this.recoveryRunId=tracker.runId;
   const seconds=sim.state.stats.elapsed;
   this.ui.setRunRecovery(`${getSpecies(sim.state.party[0].speciesId).name} · ${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')} · ${sim.state.mapId??'wildlands'}`,true,stored?null:'Imported for this session. Browser storage is unavailable; keep your run file.');
   this.ui.setRunFileStatus('Run file checked. Choose Resume saved run to continue.');
  }catch(error){this.ui.setRunFileStatus(error instanceof Error?error.message:'The saved run could not be imported.');}
 }
 private restart(){if(this.sim)this.progression?.finish(this.sim.state);this.cleanupRun();this.ui.showTitle();this.refreshRecovery();}
 private cleanupRun(){this.releasePointer();this.healthBars?.dispose();this.fx?.dispose();this.visuals?.dispose();this.assets?.dispose();this.world?.dispose();
  this.evolution=null;this.evolutionTime=0;this.evolutionCuePending=false;this.evolutionEffect?.dispose();this.evolutionEffect=null;this.ui.clearEvolution();
  this.damageNumbers?.dispose();this.damageNumbers=null;
  this.healthBars=null;this.fx=null;this.visuals=null;this.assets=null;this.world=null;this.sim=null;this.progression=null;this.clearInput();this.ended=false;this.lastPhase='title';this.flashUntil=0;
  this.audio.reset();this.feedback.reset();this.previousSpecialCooldown=null;
 }
 private event(event:GameEvent){if(event.label&&event.kind!=='evolve')this.ui.toast(event.label,['boss','faint','win','death'].includes(event.kind)?2:1);this.fx?.onEvent(event);
  if(event.kind==='evolve'&&event.evolution){
   this.evolution=event.evolution;this.evolutionTime=0;this.visuals?.beginEvolution(event.evolution.uid,event.evolution.from);
   this.evolutionEffect?.dispose();
   const from=getSpecies(event.evolution.from),to=getSpecies(event.evolution.to);
   this.evolutionEffect=new EvolutionEffect(this.scene,event.evolution.uid,Color3.FromHexString(ELEMENT_COLORS[from.types[0]]),Color3.FromHexString(ELEMENT_COLORS[to.types[0]]));
   this.ui.showEvolution(event.evolution);this.evolutionCuePending=true;
   return;
  }
  if(this.sim)this.damageNumbers?.onEvent(event,this.sim.state);
  if(event.kind==='kill'&&event.variant)this.progression?.onKill(event.variant,event.targetId);
  if(event.kind==='level'||event.kind==='win'||event.kind==='death'){
   this.audio.setActive(false);this.feedback.reset();this.flashUntil=0;
   this.audio.cue(event.kind==='level'?'level':event.kind==='win'?'victory':'defeat',event.speciesId);
  }else{
   this.audio.onEvent(event,this.sim?.state);if(isActive(this.sim))this.feedback.onEvent(event,this.sim?.state);
  }
  if(event.kind==='hit'&&event.damageTo==='player'&&(event.amount??0)>0&&!this.ui.settings.reduceFlashes&&!this.motionPreference.matches)this.flashUntil=performance.now()+130;
 }
 private observeProgression(){
  if(!this.sim||!this.progression)return;
  const change=this.progression.observe(this.sim.state);
  if(change.earned.length)this.ui.toast(`Collection: ${change.earned.map(achievement=>achievement.title).join(' / ')}`,0);
 }
 private input():MoveInput{
  const down=(...codes:string[])=>codes.some(c=>this.pressed.has(c));
  const f=(down('KeyW')?1:0)-(down('KeyS')?1:0);
  const r=(down('KeyD')?1:0)-(down('KeyA')?1:0);
  const movement=cameraRelativeMovement(this.camera.alpha,f,r);
  const tap=(...codes:string[])=>codes.some(c=>this.justPressed.has(c));
  // Camera aim also keeps run-up steering independent of mouse look.
  // Ordinary and learned attacks acquire their own targets.
  return {...movement,...cameraAimDirection(this.camera.alpha),jump:tap('Space'),jumpHeld:down('Space'),dodge:tap('ShiftLeft','ShiftRight'),special:tap('KeyQ'),interact:tap('KeyE')};
 }
 private frame(){const now=performance.now();const frameInterval=Math.max(0,(now-this.previous)/1000),dt=Math.min(.08,frameInterval);this.previous=now;
  if(!this.sim||!this.world){this.justPressed.clear();this.scene.render();return;}
  const sim=this.sim,state=sim.state;
  if(state.phase!==this.lastPhase){this.clearInput();if(!isActive(sim)&&!(state.phase==='paused'&&this.captureWanted))this.releasePointer();this.lastPhase=state.phase;}
  const active=isActive(sim);
  if(active){
   const right=Number(this.pressed.has('ArrowRight'))-Number(this.pressed.has('ArrowLeft'));
   const up=Number(this.pressed.has('ArrowUp'))-Number(this.pressed.has('ArrowDown'));
   const look=keyboardLook(this.camera.alpha,this.camera.beta,right,up,dt);
   this.camera.alpha=look.alpha;this.camera.beta=look.beta;
  }
  const input=this.input();sim.setWalking(active&&Math.hypot(input.mx,input.mz)>.01);
  if(active&&this.ui.settings.graphicsQuality==='auto'){if(this.automatic.update(frameInterval))this.applyGraphics();}else this.automatic.resetWindow();
  const simulationStart=this.metrics?performance.now():0;
  this.audio.setActive(active);const impactFrame=this.feedback.step(dt,active);
  if(active){
   if(impactFrame.freeze){
    for(const action of ['jump','dodge','special','interact'] as const)this.pendingActions[action] ||= input[action];
   }else{
    const steps=Math.max(1,Math.ceil(dt/.02)),times=this.dev?Math.min(5,Math.max(1,Math.round(this.speed))):1;
    const firstInput={...input,jump:input.jump||this.pendingActions.jump,dodge:input.dodge||this.pendingActions.dodge,special:input.special||this.pendingActions.special,interact:input.interact||this.pendingActions.interact};
    this.pendingActions={jump:false,dodge:false,special:false,interact:false};
    for(let i=0;i<steps*times;i++){
     if(!isActive(sim))break;
     sim.update(dt/steps,i===0?firstInput:withoutActions(input));
     this.observeProgression();
     if(this.feedback.inspect().freeze)break;
    }
   }
   this.world.update(dt,state.pois,state.stats.elapsed,state.terrainFeatures,state.berryTrees??[]);
   if(!isActive(sim)){this.clearInput();this.releasePointer();this.lastPhase=state.phase;}
  }
  const simulationEnd=this.metrics?performance.now():0;
  const playing=isActive(sim)&&document.pointerLockElement===this.canvas;
  this.audio.setActive(playing);this.audio.update(dt);
  if(playing&&this.previousSpecialCooldown!==null&&this.previousSpecialCooldown>0&&state.player.specialCooldown===0)this.audio.cue('ready');
  this.previousSpecialCooldown=state.player.specialCooldown;
  if(!playing){this.feedback.reset();this.flashUntil=0;}
  const target=this.cameraTarget.set(state.player.x,this.world.height(state.player.x,state.player.z)+2,state.player.z);
  // Assigning camera.target calls setTarget(), which rebuilds alpha/beta from the
  // previous camera position and cancels mouse look. Move the target in place.
  if(playing)Vector3.LerpToRef(this.camera.target,target,1-Math.exp(-9*dt),this.camera.target);
  const cameraAngle=-this.camera.alpha-Math.PI/2;
  const presentationDt=playing&&!impactFrame.freeze&&!this.feedback.inspect().freeze?dt:0;
  this.visuals?.sync(state.party,state.enemies,presentationDt,cameraAngle,(x,z)=>this.world!.height(x,z),state.player.y,this.evolution&&playing?dt:0,!!state.player.movement?.flying,state.player);
  if(this.evolution){
   if(playing){this.evolutionTime+=dt;this.evolutionEffect?.update(dt,state.party.find(member=>member.uid===this.evolution!.uid),(x,z)=>this.world!.height(x,z));}
   if(this.evolutionTime>=2.3||state.phase==='result'){
    this.evolution=null;this.evolutionTime=0;this.evolutionEffect?.dispose();this.evolutionEffect=null;this.visuals?.finishEvolution();this.ui.clearEvolution();
    if(state.phase!=='result')sim.resumeDeferredRewards();
   }
  }
  this.healthBars?.sync(state,presentationDt,(x,z)=>this.world!.height(x,z));
  this.fx?.update(state,presentationDt);
  document.querySelector<HTMLElement>('#damage-flash')!.style.opacity=now<this.flashUntil?'.38':'0';
  if(state.phase==='result'&&!this.ended){
   this.ended=true;
   this.progression?.finish(state);this.ui.setProgressionResult(this.progression?.earnedThisRun()??[]);
   if(this.recoveryRunId===this.progression?.runId&&discardSuspendedRun()){this.savedRunJSON=null;this.recoveryRunId=null;}
  }
  if(state.result===null&&state.stats.elapsed-this.lastRecoveryWrite>=30){this.lastRecoveryWrite=state.stats.elapsed;this.checkpointRecovery();}
  this.ui.update(state);this.justPressed.clear();
  const shake=this.feedback.inspect(),baseX=this.camera.target.x,baseY=this.camera.target.y,baseZ=this.camera.target.z;
  this.camera.target.addInPlaceFromFloats(shake.offsetX,shake.offsetY,shake.offsetZ);
  const renderStart=this.metrics?performance.now():0;
  try{this.scene.render();}finally{this.camera.target.set(baseX,baseY,baseZ);if(shake.offsetX||shake.offsetY||shake.offsetZ)this.camera.getViewMatrix(true);}
  this.damageNumbers?.update(presentationDt,this.motionPreference.matches);
  this.metrics?.record(frameInterval*1000,simulationEnd-simulationStart,renderStart-simulationEnd,performance.now()-renderStart);
 }
 dispose(){this.listeners.abort();this.cleanupRun();this.audio.dispose();this.ui.dispose();this.scene.dispose();this.engine.dispose();}
}
