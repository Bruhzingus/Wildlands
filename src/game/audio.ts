import type {GameEvent} from './Simulation.ts';
import type {RunState} from './types.ts';
import {musicNotes,MUSIC_STEP_SECONDS,soundIdentity,type SoundNote} from '../data/audio.ts';

/** Original, deliberately quiet synth cues. No recordings or external assets. */
export type AudioCue='attack'|'impact'|'crit'|'hurt'|'special'|'level'|'upgrade'|'recruit'|'evolve'|'interact'|'boss'|'victory'|'defeat'|'faint'|'ready'|'jump'|'dash'|'kill';
export interface AudioSettings{soundVolume:number;musicVolume:number;}
type Note=SoundNote;
interface CueDefinition{gap:number;priority:number;notes:readonly Note[];}

const note=(frequency:number,duration:number,extra:Partial<Note>={}):Note=>({frequency,duration,...extra});
const CUES:Record<AudioCue,CueDefinition>={
 jump:{gap:.2,priority:2,notes:[note(220,.18,{end:440,gain:.09})]},
 dash:{gap:.25,priority:2,notes:[note(330,.16,{end:110,gain:.075,wave:'triangle'})]},
 kill:{gap:.24,priority:0,notes:[note(392,.13,{end:196,gain:.045})]},
 attack:{gap:.18,priority:0,notes:[note(440,.095,{end:270,gain:.065,wave:'triangle'})]},
 impact:{gap:.2,priority:0,notes:[note(165,.07,{end:110,gain:.027})]},
 crit:{gap:.24,priority:1,notes:[note(690,.105,{end:420,gain:.033,wave:'triangle'})]},
 hurt:{gap:.3,priority:2,notes:[note(155,.14,{end:98,gain:.045,wave:'triangle'})]},
 special:{gap:.55,priority:3,notes:[note(196,.24,{end:392,gain:.045,wave:'triangle'}),note(588,.28,{delay:.09,gain:.026})]},
 level:{gap:.6,priority:3,notes:[note(392,.14),note(493.88,.18,{delay:.1}),note(587.33,.25,{delay:.22})]},
 upgrade:{gap:.15,priority:2,notes:[note(440,.12),note(554.37,.17,{delay:.09})]},
 recruit:{gap:.3,priority:3,notes:[note(329.63,.16),note(440,.18,{delay:.12}),note(659.25,.25,{delay:.25})]},
 evolve:{gap:.5,priority:3,notes:[note(293.66,.21,{end:440}),note(587.33,.27,{delay:.17}),note(739.99,.32,{delay:.34})]},
 interact:{gap:.25,priority:1,notes:[note(349.23,.12),note(523.25,.18,{delay:.09})]},
 boss:{gap:1.2,priority:3,notes:[note(110,.3,{gain:.04,wave:'triangle'}),note(146.83,.35,{delay:.19,gain:.035,wave:'triangle'})]},
 victory:{gap:1,priority:3,notes:[note(392,.19),note(493.88,.23,{delay:.18}),note(659.25,.55,{delay:.4})]},
 defeat:{gap:1,priority:3,notes:[note(293.66,.23),note(220,.3,{delay:.2}),note(146.83,.48,{delay:.43})]},
 faint:{gap:.4,priority:3,notes:[note(246.94,.2),note(164.81,.3,{delay:.15})]},
 ready:{gap:1,priority:1,notes:[note(659.25,.1,{gain:.025}),note(880,.14,{delay:.09,gain:.022})]},
};

export const AUDIO_LIMITS={maxVoices:12,maxSoundVoices:8,maxMusicVoices:4,ambientInterval:MUSIC_STEP_SECONDS,maxFrameSeconds:.1,impactGap:.12,audibleDistance:32} as const;
const CHARACTER_CUES=new Set<AudioCue>(['attack','special','jump','dash','kill','hurt','faint','defeat']);
const defaults:AudioSettings={soundVolume:.18,musicVolume:.07};
const volume=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?Math.min(1,Math.max(0,value)):fallback;
interface Voice{oscillator:OscillatorNode;envelope:GainNode;bus:'sound'|'music';priority:number;}

function browserContext():AudioContext|null{
 const Constructor=globalThis.AudioContext??(globalThis as typeof globalThis & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
 return Constructor?new Constructor():null;
}

/** Owns one lazily unlocked Web Audio graph, with no listeners and no audio queue. */
export class GameAudio{
 private settings:AudioSettings;
 private createContext:()=>AudioContext|null;
 private context:AudioContext|null=null;
 private sound:GainNode|null=null;private music:GainNode|null=null;private limiter:DynamicsCompressorNode|null=null;
 private active=false;private disposed=false;private unavailable=false;private resumePending=false;
 private voices=new Set<Voice>();private lastCue=new Map<AudioCue,number>();
 private ambientRemaining:number=AUDIO_LIMITS.ambientInterval;private ambientIndex=0;
 private lastImpact=-Infinity;
 private counts:Partial<Record<AudioCue,number>>={};private created=0;private completed=0;private stopped=0;private denied=0;private errors=0;private ambientNotes=0;
 constructor(settings:Partial<AudioSettings>={},createContext:()=>AudioContext|null=browserContext){
  this.settings={soundVolume:volume(settings.soundVolume,defaults.soundVolume),musicVolume:volume(settings.musicVolume,defaults.musicVolume)};
  this.createContext=createContext;
 }
 /** Call synchronously from Start, Resume or a menu choice, never from a timer. */
 unlock():void{
  if(this.disposed||this.unavailable)return;
  try{
   if(!this.context){
    const context=this.createContext();
    if(!context){this.unavailable=true;return;}
    this.context=context;this.sound=context.createGain();this.music=context.createGain();this.limiter=context.createDynamicsCompressor();
    this.sound.gain.value=this.settings.soundVolume;this.music.gain.value=this.settings.musicVolume;
    this.limiter.threshold.value=-18;this.limiter.knee.value=12;this.limiter.ratio.value=4;this.limiter.attack.value=.006;this.limiter.release.value=.18;
    this.sound.connect(this.limiter);this.music.connect(this.limiter);this.limiter.connect(context.destination);
   }
   if(this.context.state==='suspended'&&!this.resumePending){
    this.resumePending=true;
    void this.context.resume().catch(()=>{this.errors++;}).finally(()=>{this.resumePending=false;});
   }
  }catch{
   this.errors++;this.unavailable=true;this.disconnectGraph();
   const context=this.context;this.context=null;
   if(context)try{void context.close().catch(()=>{});}catch{/** Audio is optional. */}
  }
 }
 setSettings(settings:Partial<AudioSettings>):void{
  if(this.disposed)return;
  this.settings={soundVolume:volume(settings.soundVolume,this.settings.soundVolume),musicVolume:volume(settings.musicVolume,this.settings.musicVolume)};
  if(this.sound)this.sound.gain.value=this.settings.soundVolume;
  if(this.music)this.music.gain.value=this.settings.musicVolume;
  for(const voice of [...this.voices])if(this.settings[voice.bus==='sound'?'soundVolume':'musicVolume']===0)this.stopVoice(voice);
 }
 setActive(active:boolean):void{
  if(this.disposed||this.active===active)return;
  this.active=active;this.ambientRemaining=AUDIO_LIMITS.ambientInterval;
  if(!active)this.stopAll();
 }
 /** Blur, visibility loss and explicit pause also cancel any paused-menu cue. */
 silence():void{this.active=false;this.ambientRemaining=AUDIO_LIMITS.ambientInterval;this.stopAll();}
 /** Explicit menu/ready/faint feedback is permitted while the simulation is paused. */
 cue(kind:AudioCue,speciesId?:number,loudness=1):void{
  const context=this.context,definition=CUES[kind];
  if(this.disposed||!context||context.state!=='running'||this.settings.soundVolume<=0)return;
  const now=context.currentTime,last=this.lastCue.get(kind)??-Infinity;
  if(now-last<definition.gap){this.denied++;return;}
  const impact=kind==='impact'||kind==='crit'||kind==='kill';
  if(impact&&now-this.lastImpact<AUDIO_LIMITS.impactGap){this.denied++;return;}
  const soundVoices=[...this.voices].filter(voice=>voice.bus==='sound');
  const room=Math.min(AUDIO_LIMITS.maxVoices-this.voices.size,AUDIO_LIMITS.maxSoundVoices-soundVoices.length);
  if(room<definition.notes.length){
   const disposable=soundVoices.filter(voice=>voice.priority<definition.priority).sort((a,b)=>a.priority-b.priority);
   if(room+disposable.length<definition.notes.length){this.denied++;return;}
   for(let i=0;i<definition.notes.length-room;i++)this.stopVoice(disposable[i]);
  }
  this.lastCue.set(kind,now);this.counts[kind]=(this.counts[kind]??0)+1;
  if(impact)this.lastImpact=now;
  const identity=speciesId!==undefined&&CHARACTER_CUES.has(kind)?soundIdentity(speciesId):null;
  const density=1/Math.sqrt(1+soundVoices.length*.35);
  for(const sound of definition.notes){
   const pitch=identity?identity.pitch/330:1;
   this.play({...sound,frequency:sound.frequency*pitch,
    end:sound.end?Math.max(70,sound.end*pitch*(kind==='attack'?identity?.glide??1:1)):undefined,
    duration:sound.duration*(identity?.length??1),wave:identity?.wave??sound.wave,
    gain:(sound.gain??.04)*Math.max(0,Math.min(1,loudness))*density},'sound',definition.priority);
  }
 }
 onEvent(event:GameEvent,state?:RunState):void{
  if(!this.active||this.disposed)return;
  const hurt=event.kind==='hit'&&(event.damageTo==='player'||event.damageTo==='companion');
  const actorId=hurt?event.targetId:event.sourceId;
  const member=state?.party.find(actor=>actor.uid===actorId);
  const enemyId=event.kind==='kill'?event.targetId:actorId;
  const enemy=(!member||event.kind==='kill')&&enemyId!==undefined?state?.enemies.find(actor=>actor.uid===enemyId):undefined;
  const species=event.speciesId??member?.speciesId??enemy?.speciesId;
  const position=event.kind==='kill'?enemy:event.x!==undefined&&event.z!==undefined?{x:event.x,z:event.z}:member??enemy;
  const distance=state&&position?Math.hypot(position.x-state.player.x,position.z-state.player.z):0;
  if(!hurt&&distance>AUDIO_LIMITS.audibleDistance&&['cast','attack','chain','hit','kill'].includes(event.kind))return;
  const loudness=hurt?1:Math.max(.15,1-distance/AUDIO_LIMITS.audibleDistance)*(enemy&&event.kind!=='kill'?.45:1);
  const cue=(kind:AudioCue)=>this.cue(kind,species,loudness);
  switch(event.kind){
   case 'cast':cue('attack');break;
   // Party launch events cover projectiles too; visual chains/procs aren't new casts.
   case 'attack':case 'chain':if(!state||enemy)cue('attack');break;
   case 'jump':case 'dash':case 'kill':cue(event.kind);break;
   case 'hit':
    if(!event.amount||event.amount<=0)break;
    if(hurt)cue('hurt');
    // A lethal hit is immediately followed by kill. Leave its slot for the
    // soft defeat pop instead of masking it with two nearly simultaneous cues.
    else if(event.damageTo==='enemy'&&!state?.enemies.some(enemy=>enemy.uid===event.targetId&&enemy.hp<=0))cue(event.shape==='crit'?'crit':'impact');
    break;
   case 'special':cue('special');break;
   case 'level':this.cue('level');break;
   case 'evolve':this.cue('evolve');break;
   case 'interact':this.cue('interact');break;
   case 'boss':this.cue('boss');break;
   case 'win':this.cue('victory');break;
   case 'death':cue('defeat');break;
   case 'faint':cue('faint');break;
  }
 }
 /** At most one musical step per frame; never catch up after a long frame. */
 update(dt:number):void{
  if(!this.active||!this.context||this.context.state!=='running'||this.settings.musicVolume<=0||!Number.isFinite(dt)||dt<=0)return;
  this.ambientRemaining-=Math.min(dt,AUDIO_LIMITS.maxFrameSeconds);
  if(this.ambientRemaining>0)return;
  this.ambientRemaining+=AUDIO_LIMITS.ambientInterval;
  const notes=musicNotes(this.ambientIndex++);
  const musicVoices=[...this.voices].filter(voice=>voice.bus==='music').length;
  if(musicVoices+notes.length>AUDIO_LIMITS.maxMusicVoices||this.voices.size+notes.length>AUDIO_LIMITS.maxVoices)return;
  for(const sound of notes){this.play(sound,'music',-1);this.ambientNotes++;}
 }
 reset():void{
  this.active=false;this.stopAll();this.lastCue.clear();this.lastImpact=-Infinity;this.counts={};this.ambientRemaining=AUDIO_LIMITS.ambientInterval;this.ambientIndex=0;this.ambientNotes=0;
 }
 inspect(){
  return {state:this.disposed?'disposed':this.unavailable?'unavailable':this.context?.state??'locked',active:this.active,voices:this.voices.size,
   soundVoices:[...this.voices].filter(voice=>voice.bus==='sound').length,musicVoices:[...this.voices].filter(voice=>voice.bus==='music').length,
   nodes:this.context?3+this.voices.size*2:0,createdVoices:this.created,completedVoices:this.completed,stoppedVoices:this.stopped,
   cues:{...this.counts},deniedCues:this.denied,ambientNotes:this.ambientNotes,resumePending:this.resumePending,errors:this.errors,
   soundVolume:this.settings.soundVolume,musicVolume:this.settings.musicVolume,soundGain:this.sound?.gain.value??0,musicGain:this.music?.gain.value??0};
 }
 dispose():void{
  if(this.disposed)return;
  this.reset();this.disposed=true;this.disconnectGraph();
  const context=this.context;this.context=null;
  if(context)try{void context.close().catch(()=>{});}catch{/** Closing an unavailable device must not affect the game. */}
 }
 private play(sound:Note,bus:'sound'|'music',priority:number):void{
  const context=this.context,destination=bus==='sound'?this.sound:this.music;
  if(!context||!destination)return;
  let oscillator:OscillatorNode|undefined,envelope:GainNode|undefined;
  try{
   oscillator=context.createOscillator();envelope=context.createGain();
   const start=context.currentTime+(sound.delay??0),end=start+sound.duration;
   oscillator.type=sound.wave??'sine';oscillator.frequency.setValueAtTime(sound.frequency,start);
   if(sound.end)oscillator.frequency.exponentialRampToValueAtTime(sound.end,end);
   envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(sound.gain??.04,start+(sound.attack??.012));
   envelope.gain.exponentialRampToValueAtTime(.0001,end);
   oscillator.connect(envelope);envelope.connect(destination);
   const voice:Voice={oscillator,envelope,bus,priority};
   oscillator.onended=()=>{if(this.voices.delete(voice)){this.completed++;oscillator!.disconnect();envelope!.disconnect();}};
   this.voices.add(voice);this.created++;oscillator.start(start);oscillator.stop(end+.02);
  }catch{
   this.errors++;
   for(const voice of [...this.voices])if(voice.oscillator===oscillator)this.stopVoice(voice);
   try{oscillator?.disconnect();envelope?.disconnect();}catch{/** A failed device is optional. */}
  }
 }
 private stopVoice(voice:Voice):void{
  if(!this.voices.delete(voice))return;
  this.stopped++;voice.oscillator.onended=null;
  try{voice.oscillator.stop();}catch{/** The oscillator may already have ended. */}
  voice.oscillator.disconnect();voice.envelope.disconnect();
 }
 private stopAll():void{for(const voice of [...this.voices])this.stopVoice(voice);}
 private disconnectGraph():void{
  this.sound?.disconnect();this.music?.disconnect();this.limiter?.disconnect();this.sound=null;this.music=null;this.limiter=null;
 }
}
