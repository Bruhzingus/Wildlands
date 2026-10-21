import {DESIGN} from '../../data/config.ts';
import {getMovementTrait,MOVEMENT_TRAITS} from '../../data/movementTraits.ts';
import {getSpecies} from '../../data/kanto.ts';
import type {Player,MovementState,RunState,Enemy} from '../types.ts';

/** Leader-only, authoritative state. It is serializable and uses active time. */
export function prepareMovement(player:Player,speciesId:number,nx:number,nz:number,strength:number,dt:number,dodging:boolean){
 const trait=getMovementTrait(speciesId);
 if(trait.kind==='normal'||trait.kind==='teleport'){delete player.movement;return undefined;}
 let m=player.movement;
 if(!m||m.speciesId!==speciesId)m=player.movement={speciesId,straightTime:0,heading:Math.atan2(nx,nz),boost:0,holdTime:0,flightRemaining:0,flightCooldown:0,flightEligible:false,flightUsed:false,flying:false};
 m.flightCooldown=Math.max(0,m.flightCooldown-dt);
 if(trait.kind==='runup'){
  const turn=nx*Math.sin(m.heading)+nz*Math.cos(m.heading);
  if(strength<.8||player.y>0||dodging||turn<Math.cos(MOVEMENT_TRAITS.turnTolerance)){
   m.straightTime=0;m.boost=0;m.heading=Math.atan2(nx,nz);
  }
 }
 return m;
}
export function recordRunUp(player:Player,m:MovementState|undefined,dx:number,dz:number,dt:number,expectedSpeed:number,strength:number,dodging:boolean){
 const trait=getMovementTrait(m?.speciesId??0);if(!m||trait.kind!=='runup')return;
 const distance=Math.hypot(dx,dz),direction=distance?(dx*Math.sin(m.heading)+dz*Math.cos(m.heading))/distance:0;
 if(strength>=.8&&player.y===0&&!dodging&&distance>=expectedSpeed*dt*.55&&direction>=Math.cos(MOVEMENT_TRAITS.turnTolerance))m.straightTime=Math.min(MOVEMENT_TRAITS.runupDelay+MOVEMENT_TRAITS.runupRamp,m.straightTime+dt);
 else m.straightTime=0;
 m.boost=Math.max(0,Math.min(1,(m.straightTime-MOVEMENT_TRAITS.runupDelay)/MOVEMENT_TRAITS.runupRamp))*(trait.boost??0);
}
export function stepFlight(player:Player,m:MovementState|undefined,jumped:boolean,held:boolean,dt:number){
 if(!m||getMovementTrait(m.speciesId).kind!=='flight')return false;
 if(jumped){m.flightEligible=m.flightCooldown===0;m.flightUsed=false;m.holdTime=0;}
 if(!held)m.flightEligible=false;
 if(m.flightEligible&&!m.flightUsed&&held&&player.y>0){
  m.holdTime+=dt;
  if(m.holdTime>=MOVEMENT_TRAITS.flightHold){m.flying=true;m.flightUsed=true;m.flightRemaining=getMovementTrait(m.speciesId).airtime??MOVEMENT_TRAITS.flightSeconds;}
 }
 if(m.flying){
  if(!held||m.flightRemaining<=0){m.flying=false;m.flightEligible=false;m.flightRemaining=0;m.flightCooldown=MOVEMENT_TRAITS.flightRecharge;}
  else{
   m.flightRemaining=Math.max(0,m.flightRemaining-dt);
   player.vy=Math.max(-3,Math.min(5,(MOVEMENT_TRAITS.flightHeight-player.y)*8));
   player.y=Math.max(0,player.y+player.vy*dt);return true;
  }
 }
 return false;
}
export function airborneTraversal(player:Player,speciesId:number):boolean {
 const kind=getMovementTrait(speciesId).kind;
 return player.y>=MOVEMENT_TRAITS.clearance&&(kind==='leap'||kind==='flight'&&!!player.movement?.flightUsed);
}
/** Flight clears ground contact/melee, not projectiles, explosions or bosses. */
export function canReachAirbornePlayer(enemy:Enemy,state:RunState):boolean {
 return !airborneTraversal(state.player,state.party[0].speciesId)||enemy.isBoss||getSpecies(enemy.speciesId).types.includes('flying');
}
export function jumpVelocity(speciesId:number){return DESIGN.jumpVelocity*(getMovementTrait(speciesId).kind==='leap'?MOVEMENT_TRAITS.leapJumpMultiplier:1);}
