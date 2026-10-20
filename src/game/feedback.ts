import {IMPACT_FEEDBACK} from '../data/feedback.ts';
import type {GameEvent} from './Simulation.ts';
import type {RunState} from './types.ts';

export interface FeedbackSettings {screenShake:boolean;hitStop:boolean;}
export interface FeedbackSnapshot {
 offsetX:number;offsetY:number;offsetZ:number;
 /** True while stopped, or for a frame that began stopped even if its timer just expired. */
 freeze:boolean;
 stopRemaining:number;
 shakeRemaining:number;
}
export type ImpactKind='special'|'boss';

/**
 * Presentation-only feedback. It never changes the camera, game state, or seeded RNG.
 * Apply the returned translation for rendering, then remove it before following the player.
 */
export class ImpactFeedback {
 private settings:FeedbackSettings;
 private reducedMotion:boolean;
 private clock=0;
 private lastImpact=-Infinity;
 private shakeElapsed=0;
 private shakeDuration=0;
 private amplitude=0;
 private stopRemaining=0;
 private seen=new WeakSet<GameEvent>();
 constructor(settings:Partial<FeedbackSettings>={},reducedMotion=false){
  this.settings={screenShake:settings.screenShake??true,hitStop:settings.hitStop??true};
  this.reducedMotion=reducedMotion;
 }
 setSettings(settings:Partial<FeedbackSettings>){
  this.settings={screenShake:settings.screenShake??this.settings.screenShake,hitStop:settings.hitStop??this.settings.hitStop};
  if(!this.settings.screenShake)this.clearShake();
  if(!this.settings.hitStop)this.stopRemaining=0;
 }
 setReducedMotion(reducedMotion:boolean){
  this.reducedMotion=reducedMotion;
  if(reducedMotion)this.reset();
 }
 /** Only an activated special or damage dealt by a boss creates impact feedback. */
 onEvent(event:GameEvent,state?:Pick<RunState,'enemies'>):boolean {
  if(this.seen.has(event))return false;
  this.seen.add(event);
  if(event.kind==='special')return this.trigger('special');
  if(event.kind!=='hit'||!Number.isFinite(event.amount)||(event.amount??0)<=0||
   (event.damageTo!=='player'&&event.damageTo!=='companion'))return false;
  const boss=state?.enemies.some(enemy=>enemy.uid===event.sourceId&&enemy.isBoss);
  return boss?this.trigger('boss'):false;
 }
 trigger(kind:ImpactKind):boolean {
  if(this.reducedMotion||(!this.settings.screenShake&&!this.settings.hitStop)||
   this.clock-this.lastImpact<IMPACT_FEEDBACK.cooldownSeconds)return false;
  this.lastImpact=this.clock;
  const tuning=IMPACT_FEEDBACK[kind];
  if(this.settings.screenShake){this.shakeElapsed=0;this.shakeDuration=tuning.shakeSeconds;this.amplitude=Math.min(IMPACT_FEEDBACK.maxOffset,tuning.amplitude);}
  if(this.settings.hitStop)this.stopRemaining=Math.min(IMPACT_FEEDBACK.maxStopSeconds,tuning.stopSeconds);
  return true;
 }
 /** Call once per render frame before simulation. Inactive screens discard pending feedback. */
 step(realDt:number,active:boolean):FeedbackSnapshot {
  if(!active){this.reset();return this.inspect();}
  const dt=Number.isFinite(realDt)?Math.max(0,realDt):0;
  const wasStopped=this.stopRemaining>0;
  this.clock+=dt;
  this.stopRemaining=Math.max(0,this.stopRemaining-dt);
  this.shakeElapsed=Math.min(this.shakeDuration,this.shakeElapsed+dt);
  const snapshot=this.inspect();
  snapshot.freeze=wasStopped||snapshot.freeze;
  return snapshot;
 }
 inspect():FeedbackSnapshot {
  const shakeRemaining=this.reducedMotion||!this.settings.screenShake?0:Math.max(0,this.shakeDuration-this.shakeElapsed);
  const stopRemaining=this.reducedMotion||!this.settings.hitStop?0:this.stopRemaining;
  const envelope=shakeRemaining>0?Math.pow(shakeRemaining/this.shakeDuration,2)*this.amplitude:0;
  // Fixed frequencies give a short irregular tremor without random numbers or accumulating drift.
  return {offsetX:envelope?Math.sin(this.shakeElapsed*93)*envelope*.82:0,
   offsetY:envelope?Math.sin(this.shakeElapsed*117)*envelope*.42:0,
   offsetZ:envelope?Math.sin(this.shakeElapsed*71)*envelope*.27:0,
   freeze:stopRemaining>0,stopRemaining,shakeRemaining};
 }
 reset(){this.clock=0;this.lastImpact=-Infinity;this.stopRemaining=0;this.clearShake();}
 private clearShake(){this.shakeElapsed=0;this.shakeDuration=0;this.amplitude=0;}
}
