import {getEnemyAttackProfile,type EnemyAttackProfile} from '../../data/enemyAttacks.ts';
import {getVariant} from '../../data/variants.ts';
import type {Enemy,EnemyWindup,PartyMember,RunState,Vec2} from '../types.ts';
import type {ProjectileSpawn} from './projectiles.ts';

export interface EnemyMoveVisual {
 kind:'attack'|'tell';x:number;z:number;sourceId:number;label:string;color:string;shape:string;
 radius?:number;duration?:number;toX?:number;toZ?:number;facing?:number;
}
export interface EnemyMoveHooks {
 animate:(enemy:Enemy,facing:number,duration:number)=>void;
 projectile:(projectile:ProjectileSpawn)=>void;
 hurtPlayer:(damage:number,poison:boolean,sourceId:number)=>void;
 hurtCompanion:(member:PartyMember,damage:number,poison:boolean,sourceId:number)=>void;
 visual:(event:EnemyMoveVisual)=>void;
 suicide:(enemy:Enemy)=>void;
}
const distance=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.z-b.z);
function woundedAllies(enemy:Enemy,state:RunState,radius:number){
 return state.enemies.filter(ally=>!ally.dead&&ally.hp<ally.maxHp-.1&&distance(enemy,ally)<=radius);
}
export function canStartEnemyMove(enemy:Enemy,target:Vec2,state:RunState,profile=getEnemyAttackProfile(enemy.speciesId)):boolean {
 if(enemy.dead||enemy.stunTime>0||enemy.attackCooldown>0||enemy.windup)return false;
 return profile.role==='healer'?woundedAllies(enemy,state,profile.radius).length>0:distance(enemy,target)<=profile.range+enemy.size*.4;
}
/** A normalized movement intent. Ranged foes hold firing distance; healers seek
 * wounded allies and stay behind them. The simulation applies speed and status. */
export function enemyMovementIntent(enemy:Enemy,target:Vec2,state:RunState,profile=getEnemyAttackProfile(enemy.speciesId)):{x:number;z:number;speedScale:number} {
 let destination=target,sign=1,scale=1;
 if(profile.role==='healer'){
  const allies=woundedAllies(enemy,state,20).filter(ally=>ally.uid!==enemy.uid).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp);
  if(allies.length){destination=allies[0];if(distance(enemy,destination)<profile.radius*.65)return {x:0,z:0,speedScale:0};}
  else if(distance(enemy,target)>12)return {x:0,z:0,speedScale:0};
  else {sign=-1;scale=.7;}
 }else if(profile.role==='ranged-burst'||profile.role==='ranged-projectile'||profile.role==='explosive-bomb'){
  const d=distance(enemy,target),preferred=profile.role==='explosive-bomb'?11:profile.role==='ranged-projectile'?10:8;
  if(d<preferred-2){sign=-1;scale=.65;}
  else if(d<=preferred)return {x:0,z:0,speedScale:0};
 }else if(distance(enemy,target)<enemy.size+.75)return {x:0,z:0,speedScale:0};
 const dx=destination.x-enemy.x,dz=destination.z-enemy.z,d=Math.hypot(dx,dz)||1;
 return {x:dx/d*sign,z:dz/d*sign,speedScale:scale};
}
export function prepareEnemyMove(enemy:Enemy,target:Vec2,profile=getEnemyAttackProfile(enemy.speciesId)):EnemyWindup {
 const centered=profile.role==='healer'||profile.role==='explosive-suicide',facing=Math.atan2(target.x-enemy.x,target.z-enemy.z);
 return {kind:'enemyMove',role:profile.role,moveName:profile.moveName,remaining:profile.windup,duration:profile.windup,
  x:centered?enemy.x:target.x,z:centered?enemy.z:target.z,facing,radius:profile.radius};
}
export function enemyMoveTell(enemy:Enemy,windup:EnemyWindup,profile=getEnemyAttackProfile(enemy.speciesId)):EnemyMoveVisual {
 return {kind:'tell',x:enemy.x,z:enemy.z,toX:windup.x,toZ:windup.z,sourceId:enemy.uid,label:profile.moveName,
  color:profile.color,shape:profile.role,radius:profile.radius,duration:windup.duration,facing:windup.facing};
}
function inCommittedStrike(enemy:Enemy,windup:EnemyWindup,target:Vec2,radius:number){
 const dx=target.x-enemy.x,dz=target.z-enemy.z,d=Math.hypot(dx,dz);
 // A committed forward cone leaves a clear escape behind or beside the attacker.
 return d<=radius+enemy.size*.3&&(d<.65||(dx*Math.sin(windup.facing)+dz*Math.cos(windup.facing))/d>.24);
}
export function resolveEnemyMove(enemy:Enemy,windup:EnemyWindup,state:RunState,hooks:EnemyMoveHooks,profile:EnemyAttackProfile=getEnemyAttackProfile(enemy.speciesId)):void {
 const role=profile.role,poison=profile.element==='poison'||enemy.variant==='poisoned',damage=enemy.damage*profile.damageScale;
 enemy.attackCooldown=profile.cooldown/getVariant(enemy.variant).aggression;hooks.animate(enemy,windup.facing,role==='melee-slow'?.48:.3);
 const visual=(shape:string,x=enemy.x,z=enemy.z,radius=profile.radius,duration=.32)=>hooks.visual({kind:'attack',x,z,sourceId:enemy.uid,label:profile.moveName,color:profile.color,shape,radius,duration,facing:windup.facing});
 if(role==='healer'){
  for(const ally of woundedAllies(enemy,state,profile.radius)){
   const amount=Math.min(45,ally.maxHp*(ally.isBoss?.03:ally.uid===enemy.uid?.05:.1));
   ally.hp=Math.min(ally.maxHp,ally.hp+amount);
   if(ally.uid!==enemy.uid)hooks.visual({kind:'attack',x:enemy.x,z:enemy.z,toX:ally.x,toZ:ally.z,sourceId:enemy.uid,label:profile.moveName,color:profile.color,shape:'heal',duration:.45});
  }
  visual('heal',enemy.x,enemy.z,profile.radius,.6);return;
 }
 if(role==='melee-fast'||role==='melee-slow'){
  visual('slash');
  if(inCommittedStrike(enemy,windup,state.player,profile.radius))hooks.hurtPlayer(damage,poison,enemy.uid);
  if(state.result!==null)return;
  for(const member of [...state.party].slice(1))if(inCommittedStrike(enemy,windup,member,profile.radius))hooks.hurtCompanion(member,damage*.55,poison,enemy.uid);
  return;
 }
 if(role==='explosive-suicide'){
  visual('explosion',enemy.x,enemy.z,profile.radius,.55);
  // Remove the bomber first, even if the blast ends the run. It never awards a kill.
  hooks.suicide(enemy);
  if(distance(enemy,state.player)<=profile.radius)hooks.hurtPlayer(damage,poison,enemy.uid);
  if(state.result!==null)return;
  for(const member of [...state.party].slice(1))if(distance(enemy,member)<=profile.radius)hooks.hurtCompanion(member,damage*.55,poison,enemy.uid);
  return;
 }
 if(role==='explosive-bomb'){
  const d=distance(enemy,windup),ttl=Math.max(.35,d/profile.projectileSpeed),speed=d/ttl;
  hooks.projectile({x:enemy.x,z:enemy.z,vx:Math.sin(windup.facing)*speed,vz:Math.cos(windup.facing)*speed,
   ttl,damage,size:.38,kind:'lob',type:profile.element,penetration:0,friendly:false,sourceId:enemy.uid,poisonChance:poison?1:0,
   silhouette:'lob',radius:profile.radius,blastX:windup.x,blastZ:windup.z,duration:ttl,warningDuration:windup.duration+ttl,moveName:profile.moveName});
  visual('throw',enemy.x,enemy.z,.9,.22);return;
 }
 for(let shot=0;shot<profile.shots;shot++){
  const angle=windup.facing+(shot-(profile.shots-1)/2)*.16;
  hooks.projectile({x:enemy.x+Math.sin(angle)*.7,z:enemy.z+Math.cos(angle)*.7,vx:Math.sin(angle)*profile.projectileSpeed,vz:Math.cos(angle)*profile.projectileSpeed,
   ttl:role==='ranged-burst'?1.3:3.2,damage,size:profile.radius,kind:'bolt',type:profile.element,penetration:0,friendly:false,
   sourceId:enemy.uid,poisonChance:poison?1:0,silhouette:role==='ranged-burst'?'needle':'orb',moveName:profile.moveName});
 }
 visual('muzzle',enemy.x+Math.sin(windup.facing)*.7,enemy.z+Math.cos(windup.facing)*.7,role==='ranged-burst'?.6:1,.2);
}
