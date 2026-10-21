import {Engine,Scene,ArcRotateCamera,Vector3,Color3} from '@babylonjs/core';
import {Simulation,type MoveInput,type GameEvent} from './Simulation.ts';
import {World} from './render/World.ts';
import {AssetLibrary,CharacterVisuals} from './render/AssetLibrary.ts';
import {Effects} from './render/Effects.ts';
import {HealthBars} from './render/HealthBars.ts';
import {DamageNumbers} from './render/DamageNumbers.ts';
import {UI} from '../ui/UI.ts';
import {loadSave,type SaveData} from './save.ts';
import {ProgressionTracker} from './achievements.ts';
import {MAP_OPTIONS} from '../data/unlocks.ts';
import {cameraAimDirection,cameraRelativeMovement,mouseLook} from './input.ts';
import {requestCameraPointerLock} from './pointerLock.ts';
import {GameAudio} from './audio.ts';
import {ImpactFeedback} from './feedback.ts';
import {AutomaticQuality,graphicsProfile,initialQuality} from './graphics.ts';
import {FrameMetrics} from './performance.ts';

const isActive=(sim:Simulation|null)=>sim?.state.phase==='playing'||sim?.state.phase==='boss';
const withoutActions=(input:MoveInput):MoveInput=>({...input,jump:false,dodge:false,special:false,interact:false});

export class Game{
 private damageNumbers:DamageNumbers|null=null;
 private canvas=document.querySelector<HTMLCanvasElement>('#renderCanvas')!;
 private engine:Engine;private scene:Scene;private camera:ArcRotateCamera;
 private ui:UI;private sim:Simulation|null=null;private world:World|null=null;private assets:AssetLibrary|null=null;private visuals:CharacterVisuals|null=null;private fx:Effects|null=null;private healthBars:HealthBars|null=null;
 private save:SaveData;private pressed=new Set<string>();private justPressed=new Set<string>();private ended=false;private previous=performance.now();
 private progression:ProgressionTracker|null=null;
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
  this.ui.onRestart=()=>this.restart();
  this.ui.onEndless=()=>{this.ended=false;this.clearInput();this.sim?.continueEndless();this.captureForPlay();};
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
  if(this.sim?.choose(id)){this.audio.cue(choice?.kind==='recruit'?'recruit':choice?.kind==='evolve'?'evolve':'upgrade');this.observeProgression();}
  this.captureForPlay();
 }
 private releasePointer(){
  this.captureWanted=false;this.capturePending=false;this.captureAttempt++;clearTimeout(this.captureTimer);this.pointerCaptured=false;this.captureError=null;
  if(document.pointerLockElement===this.canvas)document.exitPointerLock();
 }
 private pause(){this.clearInput();if(isActive(this.sim))this.sim?.pause();this.releasePointer();this.audio.silence();this.feedback.reset();this.flashUntil=0;}
 /** Called directly from a click/key gesture; browsers require that to capture. */
 private captureForPlay(){
  const sim=this.sim;if(!sim||(!isActive(sim)&&sim.state.phase!=='paused'))return;
  this.audio.unlock();this.audio.setActive(false);this.feedback.reset();
  this.clearInput();
  if(isActive(sim))sim.pause();
  this.lastPhase=sim.state.phase;this.captureWanted=true;
  this.ui.setCaptureHint('Resume locks the mouse for continuous camera control. Esc pauses and releases it.');
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
  this.pointerCaptured=true;this.clearInput();
  if(this.sim.state.phase==='paused')this.sim.pause();
  this.audio.setActive(true);
  this.lastPhase=this.sim.state.phase;this.previous=performance.now();this.ui.update(this.sim.state);this.canvas.focus();
 }
 private captureFailed(attempt:number){
  if(attempt!==this.captureAttempt||!this.captureWanted)return;
  if(document.pointerLockElement===this.canvas){this.captureReady();return;}
  this.pause();
  this.ui.setCaptureHint('Mouse capture was blocked. Click Resume to try again. If needed, open the game in its own tab.');
  if(this.sim)this.ui.update(this.sim.state);
 }
 private installInput(){const signal=this.listeners.signal;
  // Space belongs to jumping, including when a popup takes focus mid-press.
  // Cancel both native activation events before controls can consume them.
  const preventSpaceActivation=(event:KeyboardEvent)=>{if(event.code==='Space')event.preventDefault();};
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
   if(!isActive(this.sim)||document.pointerLockElement!==this.canvas)return;
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
 private start(starterId:number){if(!this.save.unlocked.includes(starterId))return;this.audio.unlock();this.cleanupRun();this.ended=false;
  const map=MAP_OPTIONS.find(option=>option.id===this.save.selection.map)!;
  this.sim=new Simulation(starterId,map.seed,{mapId:map.id,challenge:this.save.selection.challenge,itemUnlocks:[...this.save.unlockedItems],recruitUnlocks:[...this.save.unlockedRecruits]});
  this.progression=new ProgressionTracker(this.save,this.sim.state);this.ui.setProgressionResult([]);
  this.world=new World(this.scene,this.sim.state.seed,this.sim.state.pois,this.sim.state.mapId);
  this.assets=new AssetLibrary(this.scene);this.visuals=new CharacterVisuals(this.assets);
  this.healthBars=new HealthBars(this.scene,this.motionPreference.matches,id=>this.assets?.headroom(id)??1);
  this.damageNumbers=new DamageNumbers(this.scene,(x,z)=>this.world!.height(x,z),id=>this.assets?.headroom(id)??1);
  this.fx=new Effects(this.scene,this.world);this.sim.onEvent=e=>this.event(e);
  this.applyGraphics();this.automatic.resetWindow();this.metrics?.reset();
  this.camera.setTarget(new Vector3(0,this.world.height(0,0)+2,0));this.camera.alpha=-Math.PI/2;this.camera.beta=1.05;this.camera.radius=this.save.settings.camera;
  this.lastPhase=this.sim.state.phase;this.previous=performance.now();
  this.previousSpecialCooldown=null;
  this.ui.update(this.sim.state);this.ui.toast('WASD move. Mouse look. Esc pauses and releases the mouse.');this.captureForPlay();
 }
 private restart(){if(this.sim)this.progression?.finish(this.sim.state);this.cleanupRun();this.ui.showTitle();}
 private cleanupRun(){this.releasePointer();this.healthBars?.dispose();this.fx?.dispose();this.visuals?.dispose();this.assets?.dispose();this.world?.dispose();
  this.damageNumbers?.dispose();this.damageNumbers=null;
  this.healthBars=null;this.fx=null;this.visuals=null;this.assets=null;this.world=null;this.sim=null;this.progression=null;this.clearInput();this.ended=false;this.lastPhase='title';this.flashUntil=0;
  this.audio.reset();this.feedback.reset();this.previousSpecialCooldown=null;
 }
 private event(event:GameEvent){if(event.label)this.ui.toast(event.label,['boss','faint','win','death'].includes(event.kind)?2:1);this.fx?.onEvent(event);
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
  const f=(down('KeyW','ArrowUp')?1:0)-(down('KeyS','ArrowDown')?1:0);
  const r=(down('KeyD','ArrowRight')?1:0)-(down('KeyA','ArrowLeft')?1:0);
  const movement=cameraRelativeMovement(this.camera.alpha,f,r);
  const tap=(...codes:string[])=>codes.some(c=>this.justPressed.has(c));
  // Camera aim is consumed only by directional/placed specials, including
  // sustained casts. Ordinary and learned attacks acquire their own targets.
  return {...movement,...cameraAimDirection(this.camera.alpha),jump:tap('Space'),dodge:tap('ShiftLeft','ShiftRight'),special:tap('KeyQ'),interact:tap('KeyE')};
 }
 private frame(){const now=performance.now();const frameInterval=Math.max(0,(now-this.previous)/1000),dt=Math.min(.08,frameInterval);this.previous=now;
  if(!this.sim||!this.world){this.justPressed.clear();this.scene.render();return;}
  const sim=this.sim,state=sim.state;
  if(state.phase!==this.lastPhase){this.clearInput();if(!isActive(sim)&&!(state.phase==='paused'&&this.captureWanted))this.releasePointer();this.lastPhase=state.phase;}
  if(isActive(sim)&&document.pointerLockElement!==this.canvas)this.pause();
  const active=isActive(sim)&&document.pointerLockElement===this.canvas,input=this.input();sim.setWalking(active&&Math.hypot(input.mx,input.mz)>.01);
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
   this.world.update(dt,state.pois,state.stats.elapsed);
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
  this.visuals?.sync(state.party,state.enemies,presentationDt,cameraAngle,(x,z)=>this.world!.height(x,z),state.player.y);
  this.healthBars?.sync(state,presentationDt,(x,z)=>this.world!.height(x,z));
  this.fx?.update(state,presentationDt);
  document.querySelector<HTMLElement>('#damage-flash')!.style.opacity=now<this.flashUntil?'.38':'0';
  if(state.phase==='result'&&!this.ended){
   this.ended=true;
   this.progression?.finish(state);this.ui.setProgressionResult(this.progression?.earnedThisRun()??[]);
  }
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
