import {ELEMENT_COLORS,type Element} from '../../data/kanto.ts';
import {specialAimMode,type SpecialProfile} from '../../data/specials.ts';
import {segmentDistanceSquared} from '../../utils/geometry.ts';
import type {Enemy,PartyMember,RunState,Vec2} from '../types.ts';
import type {StatusProc} from '../../data/attacks.ts';
import type {CombatVisual} from './patterns.ts';
import {addProjectile} from './projectiles.ts';
import {enemiesInRadius,nearestEnemy,enemyInAim} from './targeting.ts';

export const SPECIAL_LIMITS={active:6,pulses:16,projectiles:12} as const;
type SpecialVisual=Omit<CombatVisual,'kind'>&{kind:'special'|'attack';label?:string;facing?:number;angle?:number;endRadius?:number};
export interface ActiveSpecial {
 sourceId:number;profile:SpecialProfile;element:Element;damage:number;x:number;z:number;toX:number;toZ:number;
 dx:number;dz:number;age:number;pulse:number;hit:Set<number>;manualAim?:boolean;
}
export interface SpecialContext {
 state:RunState;member:PartyMember;profile:SpecialProfile;element:Element;damage:number;
 radiusScale:number;durationScale:number;extraProjectiles:number;
 move:(dx:number,dz:number)=>Vec2;
 hit:(enemy:Enemy,damage:number,element:Element,sourceId:number,status:StatusProc)=>void;
 visual:(event:SpecialVisual)=>void;heal:(amount:number)=>void;
}
function projectileVolley(context:SpecialContext,origin:Vec2,aim:Vec2):void {
 const {state,member,profile,element}=context,count=Math.min(SPECIAL_LIMITS.projectiles,profile.projectiles+context.extraProjectiles);
 const facing=specialAimMode(profile.kind)==='automatic'?undefined:state.player.aimFacing;
 const targets=state.enemies.filter(e=>!e.dead&&Math.hypot(e.x-origin.x,e.z-origin.z)<=profile.range&&(facing===undefined||(e.x-origin.x)*Math.sin(facing)+(e.z-origin.z)*Math.cos(facing)>=Math.hypot(e.x-origin.x,e.z-origin.z)*Math.cos(Math.PI/6))).sort((a,b)=>Math.hypot(a.x-origin.x,a.z-origin.z)-Math.hypot(b.x-origin.x,b.z-origin.z));
 const heading=Math.atan2(aim.z-origin.z,aim.x-origin.x);
 for(let i=0;i<count;i++){
  const target=targets[i%Math.max(1,targets.length)],fan=i===0?0:Math.ceil(i/2)*(i%2===1?-1:1)*.2;
  const homing=profile.kind==='volley'||profile.kind==='quickstep',orbit=profile.kind==='foxfire';
  const angle=homing&&target&&facing===undefined?Math.atan2(target.z-origin.z,target.x-origin.x):orbit?i/count*Math.PI*2:(facing===undefined?heading:Math.PI/2-facing)+fan;
  const speed=profile.kind==='web'?17:homing?23:20;
  addProjectile(state,{x:origin.x+(orbit?Math.cos(angle)*profile.radius:0),z:origin.z+(orbit?Math.sin(angle)*profile.radius:0),vx:Math.cos(angle)*speed,vz:Math.sin(angle)*speed,
   ttl:orbit?profile.duration:profile.range/speed+1,damage:context.damage*profile.damageScale,size:profile.kind==='web'?.42:.35,
   kind:'bolt',type:element,penetration:profile.kind==='web'?5:orbit?8:0,friendly:true,sourceId:member.uid,poisonChance:0,
   targetId:homing?target?.uid:undefined,silhouette:profile.kind==='web'||profile.kind==='payday'?'needle':'orb',
   behavior:orbit?'orbit':profile.kind==='payday'?'ricochet':homing?'homing':'straight',
   bounces:profile.kind==='payday'?2+Math.floor((member.attackLevel-1)/3):0,bounceRange:7,
   orbitCenterX:origin.x,orbitCenterZ:origin.z,orbitAngle:angle,orbitRadius:profile.radius,orbitSpeed:2.8,
   status:profile.kind==='web'?{slow:1,stun:1}:orbit?{burn:1}:{},allowProcs:true});
 }
}
function lineHit(context:SpecialContext,from:Vec2,to:Vec2,radius:number,scale:number,status:StatusProc={},forward?:Vec2):void {
 for(const enemy of context.state.enemies){
  if(context.state.result!==null)return;
  if(forward&&(enemy.x-from.x)*forward.x+(enemy.z-from.z)*forward.z<0)continue;
  if(!enemy.dead&&segmentDistanceSquared(enemy,from,to)<=(radius+enemy.size*.4)**2)context.hit(enemy,context.damage*scale,context.element,context.member.uid,status);
 }
}

/** All positioning, targeting and damage stays authoritative; rendering only consumes events. */
export function castSpecial(context:SpecialContext):void {
 const {state,member,element}=context;
 const profile={...context.profile,range:context.profile.range*context.radiusScale,radius:context.profile.radius*context.radiusScale,duration:context.profile.duration*context.durationScale};
 context={...context,profile};
 const manualFacing=specialAimMode(profile.kind)==='automatic'?undefined:state.player.aimFacing;
 const origin={x:state.player.x,z:state.player.z},target=manualFacing===undefined?nearestEnemy(state.enemies,origin,profile.range):enemyInAim(state.enemies,origin,profile.range,manualFacing);
 const length=target?Math.hypot(target.x-origin.x,target.z-origin.z):1;
 const dx=manualFacing!==undefined?Math.sin(manualFacing):target?(target.x-origin.x)/(length||1):Math.sin(state.player.facing),dz=manualFacing!==undefined?Math.cos(manualFacing):target?(target.z-origin.z)/(length||1):Math.cos(state.player.facing);
 const aim={x:origin.x+dx*profile.range,z:origin.z+dz*profile.range};
 const center=target?(manualFacing===undefined?{x:target.x,z:target.z}:{x:origin.x+dx*length,z:origin.z+dz*length}):aim,color=ELEMENT_COLORS[element],facing=Math.atan2(dx,dz);
 const visual=(shape:string,at:Vec2=origin,extra:Partial<SpecialVisual>={})=>context.visual({kind:'special',x:at.x,z:at.z,color,sourceId:member.uid,shape,label:profile.name,radius:profile.radius,duration:.25,...extra});
 state.player.iframes=Math.max(state.player.iframes,.4);member.facing=facing;
 if(profile.kind==='quickstep'||profile.kind==='charge'){
  // Move in short collision-aware steps, so dashes cannot tunnel through scenery.
  for(let distance=0;distance<profile.range;distance+=.4){
   const step=Math.min(.4,profile.range-distance),before={x:state.player.x,z:state.player.z},next=context.move(dx*step,dz*step);
   state.player.x=next.x;state.player.z=next.z;
   if(Math.hypot(next.x-before.x,next.z-before.z)<step*.1)break;
  }
  member.x=state.player.x;member.z=state.player.z;
  const destination={x:member.x,z:member.z};
  lineHit(context,origin,destination,profile.radius,profile.kind==='quickstep'?profile.damageScale:1,{burn:profile.kind==='charge'?1:0},{x:dx,z:dz});
  visual(profile.kind==='charge'?'trail':'dash',origin,{toX:destination.x,toZ:destination.z,duration:profile.kind==='charge'?profile.duration:.3});
  if(state.result!==null)return;
  if(profile.kind==='quickstep'){projectileVolley(context,destination,aim);return;}
  const active=state.activeSpecials??=[];
  if(active.length<SPECIAL_LIMITS.active)active.push({sourceId:member.uid,profile,element,damage:context.damage,x:origin.x,z:origin.z,toX:destination.x,toZ:destination.z,dx,dz,age:0,pulse:0,hit:new Set()});
  return;
 }
 if(profile.kind==='teleport'){
  // Blink away from the nearest threat using the same world collision as walking.
  const destination=context.move(-dx*6,-dz*6);state.player.x=member.x=destination.x;state.player.z=member.z=destination.z;
  const focus=target??aim,lanceX=manualFacing===undefined?focus.x-destination.x:dx,lanceZ=manualFacing===undefined?focus.z-destination.z:dz,lanceDistance=Math.hypot(lanceX,lanceZ)||1;
  const reach=profile.range+Math.hypot(destination.x-origin.x,destination.z-origin.z);
  const lance={x:destination.x+lanceX/lanceDistance*reach,z:destination.z+lanceZ/lanceDistance*reach};
  member.facing=Math.atan2(lanceX,lanceZ);
  visual('teleport',origin,{toX:destination.x,toZ:destination.z});lineHit(context,destination,lance,profile.radius,profile.damageScale,{stun:1});
  context.visual({kind:'attack',x:destination.x,z:destination.z,toX:lance.x,toZ:lance.z,color,sourceId:member.uid,shape:'beam',radius:profile.radius,duration:.35});return;
 }
 if(profile.kind==='lance'){
  visual('beam',origin,{toX:aim.x,toZ:aim.z});lineHit(context,origin,aim,profile.radius,profile.damageScale);return;
 }
 if(['web','foxfire','payday','volley'].includes(profile.kind)){
  visual('volley');projectileVolley(context,origin,aim);return;
 }
 if(profile.kind==='mend'){
  context.heal(20+member.attackLevel*3);for(const partner of state.party)partner.iframes=Math.max(partner.iframes,1.5);
  state.player.iframes=Math.max(state.player.iframes,1.5);visual('shield',origin,{radius:profile.radius,duration:1.5});return;
 }
 const active=state.activeSpecials??=[];
 if(active.length>=SPECIAL_LIMITS.active)active.shift();
 const targeted=['garden','sleep','curse'].includes(profile.kind);
 const position=targeted?center:origin;
 const effect:ActiveSpecial={sourceId:member.uid,profile,element,damage:context.damage,x:position.x,z:position.z,toX:aim.x,toZ:aim.z,dx,dz,age:0,pulse:0,hit:new Set(),manualAim:manualFacing!==undefined};
 active.push(effect);
 if(targeted)visual(profile.kind,position,{duration:profile.duration});
 else if(profile.kind==='surf'||profile.kind==='whirlwind')visual('wave',origin,{toX:aim.x,toZ:aim.z,duration:profile.duration,endRadius:profile.radius*(profile.kind==='whirlwind'?2:1)});
 else if(profile.kind==='flamethrower'||profile.kind==='flurry')visual('cone',origin,{radius:profile.range,facing,angle:profile.angle});
 else if(profile.kind==='fissure')visual('trail',origin,{toX:aim.x,toZ:aim.z,radius:.25,duration:profile.duration});
 else if(profile.kind==='thunder')visual('column',target??aim,{radius:profile.radius,duration:.2});
}

export interface SpecialStepHooks {
 hit:SpecialContext['hit'];visual:SpecialContext['visual'];heal:SpecialContext['heal'];
}
export function stepSpecials(state:RunState,dt:number,hooks:SpecialStepHooks):void {
 for(const effect of state.activeSpecials??[]){
  if(state.result!==null)break;
  const {profile,element,sourceId}=effect,member=state.party.find(m=>m.uid===sourceId);if(!member){effect.age=profile.duration+1;continue;}
  const previous=effect.age;effect.age+=dt;
  const hit=(enemy:Enemy,scale:number,status:StatusProc={},push=0)=>{
   if(state.result!==null)return;
   hooks.hit(enemy,effect.damage*scale,element,sourceId,status);
   if(state.result===null&&push&&!enemy.dead&&!enemy.isBoss){enemy.x+=effect.dx*push;enemy.z+=effect.dz*push;}
  };
  const visual=(shape:string,at:Vec2,radius:number,duration=.22,extra:Partial<SpecialVisual>={})=>hooks.visual({kind:'attack',x:at.x,z:at.z,color:ELEMENT_COLORS[element],sourceId,shape,radius,duration,...extra});
  if(profile.kind==='surf'||profile.kind==='whirlwind'){
   const from={x:effect.x+effect.dx*profile.range*Math.min(1,previous/profile.duration),z:effect.z+effect.dz*profile.range*Math.min(1,previous/profile.duration)};
   const to={x:effect.x+effect.dx*profile.range*Math.min(1,effect.age/profile.duration),z:effect.z+effect.dz*profile.range*Math.min(1,effect.age/profile.duration)};
   const width=profile.radius*(profile.kind==='whirlwind'?1+Math.min(1,effect.age/profile.duration):1);
   for(const enemy of state.enemies)if(!enemy.dead&&!effect.hit.has(enemy.uid)&&(enemy.x-effect.x)*effect.dx+(enemy.z-effect.z)*effect.dz>=0&&segmentDistanceSquared(enemy,from,to)<=(width+enemy.size*.4)**2){
    effect.hit.add(enemy.uid);hit(enemy,profile.damageScale,profile.kind==='surf'?{soak:1,slow:1}:{slow:1},profile.knockback);
   }
   continue;
  }
  const interval=profile.duration/Math.max(1,profile.pulses-(profile.kind==='curse'?0:1));
  while(effect.pulse<profile.pulses&&effect.age+1e-8>=(profile.kind==='curse'?profile.duration:effect.pulse*interval)){
   const index=effect.pulse++;
   if(state.result!==null)break;
   switch(profile.kind){
    case 'garden':
     for(const enemy of enemiesInRadius(state.enemies,effect,profile.radius))hit(enemy,profile.damageScale,{slow:1});
     break;
    case 'sleep':
     for(const enemy of enemiesInRadius(state.enemies,effect,profile.radius))hit(enemy,profile.damageScale,{stun:1,slow:1});
     hooks.heal(3+member.attackLevel*.5);break;
    case 'curse':
     for(const enemy of enemiesInRadius(state.enemies,effect,profile.radius))hit(enemy,profile.damageScale,{poison:1,slow:1});
     visual('column',effect,profile.radius,.4);break;
    case 'flamethrower':case 'flurry':{
     if(effect.manualAim&&state.player.aimFacing!==undefined){effect.dx=Math.sin(state.player.aimFacing);effect.dz=Math.cos(state.player.aimFacing);member.facing=state.player.aimFacing;}
     const origin={x:state.player.x,z:state.player.z};
     for(const enemy of enemiesInRadius(state.enemies,origin,profile.range)){
      const x=enemy.x-origin.x,z=enemy.z-origin.z,d=Math.hypot(x,z);
      if(d>1&&(x*effect.dx+z*effect.dz)/d<Math.cos(profile.angle/2))continue;
      hit(enemy,profile.damageScale,profile.kind==='flamethrower'?{burn:1}:{},index===profile.pulses-1?profile.knockback:0);
     }
     visual('cone',origin,profile.range,.22,{facing:Math.atan2(effect.dx,effect.dz),angle:profile.angle});break;
    }
    case 'thunder':{
     const enemy=effect.manualAim?enemyInAim(state.enemies,effect,profile.range,Math.atan2(effect.dx,effect.dz),effect.hit):nearestEnemy(state.enemies,effect,profile.range,effect.hit);if(!enemy)break;
     effect.hit.add(enemy.uid);hit(enemy,profile.damageScale,{stun:1});visual('column',enemy,profile.radius,.25);break;
    }
    case 'fissure':{
     const distance=profile.range*(index+1)/profile.pulses,center={x:effect.x+effect.dx*distance,z:effect.z+effect.dz*distance};
     for(const enemy of enemiesInRadius(state.enemies,center,profile.radius))hit(enemy,profile.damageScale*(1+index*.12),{slow:1});
     visual('column',center,profile.radius,.3);break;
    }
    case 'charge':
     for(const enemy of state.enemies)if(!enemy.dead&&(enemy.x-effect.x)*effect.dx+(enemy.z-effect.z)*effect.dz>=0&&segmentDistanceSquared(enemy,effect,{x:effect.toX,z:effect.toZ})<=(profile.radius+enemy.size*.4)**2)hit(enemy,profile.damageScale,{burn:1});
     break;
   }
  }
 }
 state.activeSpecials=(state.activeSpecials??[]).filter(effect=>effect.age<effect.profile.duration&&state.party.some(m=>m.uid===effect.sourceId));
}
