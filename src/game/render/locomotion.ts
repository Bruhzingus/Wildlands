import {LOCOMOTION} from '../../data/locomotion.ts';
import {spriteDirection} from './animation.ts';

/** One bounded, renderer-owned travel sample per avatar. No input, simulation
 * flags, camera motion or sprite offsets are used to infer world travel. */
export class Locomotion {
 private previous:{x:number;z:number}|undefined;
 private stopped=0;
 moving=false;speed=0;rate=0;facing=0;
 update(x:number,z:number,facing:number,dt:number){
  const previous=this.previous;
  if(!previous){this.previous={x,z};this.facing=facing;return;}
  const dx=x-previous.x,dz=z-previous.z;previous.x=x;previous.z=z;
  // Paused rendering and late sheet callbacks rebase without advancing a clock.
  if(!(dt>0))return;
  const distance=Math.hypot(dx,dz);
  if(distance>LOCOMOTION.teleportDistance){this.moving=false;this.speed=0;this.rate=0;this.stopped=0;this.facing=facing;return;}
  this.speed=distance/dt;
  if(this.speed>=LOCOMOTION.startSpeed){this.moving=true;this.stopped=0;this.facing=Math.atan2(dx,dz);}
  else if(this.speed<LOCOMOTION.stopSpeed){this.stopped+=dt;if(this.stopped>=LOCOMOTION.stopDelay)this.moving=false;}
  else this.stopped=0;
  const target=this.moving?Math.min(LOCOMOTION.maxPlaybackRate,this.speed/LOCOMOTION.referenceSpeed):0;
  this.rate+=(target-this.rate)*(1-Math.exp(-dt/LOCOMOTION.rateResponse));
  if(!this.moving&&this.rate<.001)this.rate=0;
 }
}

/** A small angular deadband prevents row chatter at diagonal boundaries while
 * still allowing camera orbit to select the correct view of a stationary body. */
export function locomotionDirection(facing:number,cameraAngle:number,previous:number):number {
 const angle=cameraAngle-facing+Math.PI,center=previous*Math.PI/4;
 const delta=Math.atan2(Math.sin(angle-center),Math.cos(angle-center));
 return Math.abs(delta)<=Math.PI/8+LOCOMOTION.directionDeadband?previous:spriteDirection(facing,cameraAngle);
}
