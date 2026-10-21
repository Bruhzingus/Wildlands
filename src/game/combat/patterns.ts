import {ELEMENT_COLORS,type Element} from '../../data/kanto.ts';
import type {AttackDefinition} from '../../data/attacks.ts';
import type {Enemy,PartyMember,Vec2} from '../types.ts';
import type {ProjectileSpawn} from './projectiles.ts';
import {chainTargets,enemiesInRadius,sweptTargets} from './targeting.ts';

/** Keep one aimed lane even when upgrades/items give an even projectile count. */
const fanOffset=(index:number,spread:number)=>index===0?0:Math.ceil(index/2)*(index%2===1?1:-1)*spread;

export interface CombatVisual {
 kind:'attack'|'chain'|'status';x:number;z:number;color:string;amount?:number;
 sourceId?:number;targetId?:number;toX?:number;toZ?:number;shape?:string;duration?:number;radius?:number;facing?:number;
}
export type AttackTarget=Pick<Enemy,'uid'|'x'|'z'|'dead'>;
export interface PatternContext {
 member:PartyMember;target:AttackTarget;enemies:readonly Enemy[];profile:AttackDefinition;element:Element;
 damage:number;crit:boolean;depth:number;radiusScale:number;extraProjectiles:number;extraPierce:number;
 extraChains:number;projectileSpeedScale:number;
 hit:(enemy:Enemy,damage:number)=>void;projectile:(projectile:ProjectileSpawn)=>void;
 visual:(event:CombatVisual)=>void;heal:(leader:number,squad:number)=>void;
}
export function executeChain(enemies:readonly Enemy[],start:Enemy,damage:number,jumps:number,range:number,element:Element,sourceId:number,
 hit:(enemy:Enemy,damage:number)=>void,visual:(event:CombatVisual)=>void,origin:Vec2=start):void {
 let previous=origin;
 for(const [index,enemy] of chainTargets(enemies,start,jumps,range).entries()){
  if(enemy.dead)continue;
  visual({kind:'chain',x:previous.x,z:previous.z,toX:enemy.x,toZ:enemy.z,color:ELEMENT_COLORS[element],amount:1,shape:'chain',sourceId,targetId:enemy.uid});
  hit(enemy,damage*Math.pow(.81,index));previous=enemy;
 }
}
export function executePattern(context:PatternContext):void {
 const {member,target,enemies,profile,element}=context,damage=Math.min(Number.MAX_VALUE,context.damage*profile.damageScale),color=ELEMENT_COLORS[element];
 const focus=target;
 const radius=profile.radius*context.radiusScale;
 // The selected melee target is committed when autoattack starts. Geometry
 // still decides which other enemies share the sweep.
 const selected=profile.kind==='slash'?enemies.find(enemy=>enemy.uid===target.uid&&!enemy.dead):undefined;
 let selectedHit=false;
 if(selected){const hit=context.hit;context={...context,hit:(enemy,amount)=>{if(enemy.uid===selected.uid)selectedHit=true;hit(enemy,amount);}};}
 const hitSelected=()=>{if(selected&&!selectedHit&&!selected.dead)context.hit(selected,damage);};
 if(profile.pattern&&executeSignature(context,damage,color)){hitSelected();return;}
 if(profile.kind==='heal'){
  context.heal(5+member.attackLevel*1.5,3+member.attackLevel*.8);
  context.visual({kind:'attack',x:member.x,z:member.z,color:'#8afaad',amount:radius,shape:'heal',sourceId:member.uid});return;
 }
 if(profile.kind==='chain'){
  const first=enemies.find(enemy=>enemy.uid===target.uid&&!enemy.dead);
  if(first)executeChain(enemies,first,damage,Math.min(16,profile.chains+context.extraChains),profile.chainRange*context.radiusScale,element,member.uid,context.hit,context.visual,member);return;
 }
 if(profile.kind==='slash'||profile.kind==='aura'||profile.kind==='burst'){
  const center=profile.kind==='burst'?focus:member;
  const fx=focus.x-member.x,fz=focus.z-member.z,length=Math.hypot(fx,fz)||1;
  for(const enemy of enemiesInRadius(enemies,center,radius)){
   if(profile.kind==='slash'){
    const dx=enemy.x-member.x,dz=enemy.z-member.z,d=Math.hypot(dx,dz);
    if(d>1.4&&(dx*fx+dz*fz)/(d*length)<.28)continue;
   }
   context.hit(enemy,damage);
  }
  hitSelected();context.visual({kind:'attack',x:center.x,z:center.z,color,amount:radius,radius,shape:profile.kind,facing:Math.atan2(fx,fz),sourceId:member.uid,targetId:target.uid});return;
 }
 const count=Math.min(12,Math.max(1,profile.projectiles+context.extraProjectiles));
 for(let shot=0;shot<count;shot++){
  const angle=Math.atan2(focus.z-member.z,focus.x-member.x)+(shot-(count-1)/2)*.17,speed=profile.speed*context.projectileSpeedScale;
  context.projectile({x:member.x,z:member.z,vx:Math.cos(angle)*speed,vz:Math.sin(angle)*speed,
   ttl:Math.max(profile.lifetime,profile.range*context.radiusScale/speed+.15),damage,size:profile.kind==='beam'?.4:profile.kind==='lob'?.43:.3,
   kind:profile.kind,type:element,penetration:Math.min(16,profile.pierce+context.extraPierce),friendly:true,
   sourceId:member.uid,targetId:profile.kind==='beam'||target.uid<0?undefined:target.uid,poisonChance:0,
   silhouette:profile.silhouette,radius,crit:context.crit,status:profile.status,allowProcs:context.depth===0});
 }
}

/** Geometry and flight behavior are shared by whole move families. Per-species
 * data supplies the handling and milestones, rather than damage-only recolors. */
function executeSignature(context:PatternContext,damage:number,color:string):boolean {
 const {member,target,enemies,profile,element}=context,pattern=profile.pattern;
 const focus=target;
 const heading=Math.atan2(focus.z-member.z,focus.x-member.x),range=profile.range*context.radiusScale;
 const count=Math.min(12,Math.max(1,profile.projectiles+context.extraProjectiles));
 const width=(profile.width??profile.radius??.4)*context.radiusScale;
 const visual=(shape:string,from:Vec2,to:Vec2,radius:number)=>context.visual({kind:'attack',x:from.x,z:from.z,toX:to.x,toZ:to.z,color,shape,radius,amount:radius,duration:.28,sourceId:member.uid,targetId:target.uid});
 const push=(enemy:Enemy,amount:number,origin:Vec2=member)=>{
  if(enemy.dead||enemy.isBoss||!amount)return;
  const dx=enemy.x-origin.x,dz=enemy.z-origin.z,length=Math.hypot(dx,dz)||1;
  enemy.x+=dx/length*amount;enemy.z+=dz/length*amount;
 };
 if(pattern==='vine'||pattern==='thread'||pattern==='sand-wave'||pattern==='pounce'){
  const visited=new Set<number>(),lanes=pattern==='pounce'?1:count;
  for(let lane=0;lane<lanes;lane++){
   const angle=heading+fanOffset(lane,pattern==='sand-wave'?.4:.2);
   const reach=pattern==='pounce'?Math.min(range,Math.hypot(target.x-member.x,target.z-member.z)+1):range;
   const end={x:member.x+Math.cos(angle)*reach,z:member.z+Math.sin(angle)*reach};
   const limit=pattern==='pounce'?16:Math.min(16,profile.pierce+context.extraPierce+1);
   const forward=sweptTargets(enemies,member,end,width,visited).filter(enemy=>(enemy.x-member.x)*Math.cos(angle)+(enemy.z-member.z)*Math.sin(angle)>=0);
   for(const enemy of forward.slice(0,limit)){
    visited.add(enemy.uid);context.hit(enemy,damage);push(enemy,profile.knockback||0);
   }
   visual(pattern,member,end,width);
  }
  const victim=enemies.find(enemy=>enemy.uid===target.uid&&!enemy.dead);
  if(pattern==='pounce'&&(profile.strikes||1)>1&&victim&&visited.has(victim.uid)){context.hit(victim,damage*.65);visual('combo',member,focus,width*.6);}
  return true;
 }
 if(pattern==='combo'){
  const fx=focus.x-member.x,fz=focus.z-member.z,length=Math.hypot(fx,fz)||1;
  const victims=enemiesInRadius(enemies,member,profile.radius*context.radiusScale).filter(enemy=>{
   const dx=enemy.x-member.x,dz=enemy.z-member.z,distance=Math.hypot(dx,dz);
   return distance<=1.4||(dx*fx+dz*fz)/(distance*length)>=.38;
  });
  for(let strike=0;strike<(profile.strikes||2);strike++)for(const enemy of victims){
   if(enemy.dead)continue;context.hit(enemy,damage);
   if(strike===(profile.strikes||2)-1)push(enemy,profile.knockback||0);
  }
  visual('combo',member,focus,profile.radius*context.radiusScale);return true;
 }
 const speed=profile.speed*context.projectileSpeedScale;
 const spawn=(from:Vec2,angle:number,aim:AttackTarget|undefined,extra:Partial<ProjectileSpawn>={})=>context.projectile({
  x:from.x,z:from.z,vx:Math.cos(angle)*speed,vz:Math.sin(angle)*speed,
  ttl:Math.max(profile.lifetime,range/Math.max(1,speed)+.15),damage,size:profile.kind==='beam'?.32:profile.kind==='lob'?.43:.3,
  kind:profile.kind,type:element,penetration:Math.min(16,profile.pierce+context.extraPierce),friendly:true,
  sourceId:member.uid,targetId:aim&&aim.uid>=0?aim.uid:undefined,poisonChance:0,silhouette:profile.silhouette,radius:profile.radius*context.radiusScale,
  crit:context.crit,status:profile.status,allowProcs:context.depth===0,...extra,
 });
 const targets=[target,...enemies.filter(enemy=>!enemy.dead&&enemy.uid!==target.uid&&(enemy.x-member.x)**2+(enemy.z-member.z)**2<=range**2)
  .sort((a,b)=>(a.x-member.x)**2+(a.z-member.z)**2-((b.x-member.x)**2+(b.z-member.z)**2))];
 if(pattern==='foxfire'||pattern==='haunt'){
  const center=pattern==='foxfire'?focus:member,orbitRadius=(profile.orbitRadius||2)*context.radiusScale;
  for(let index=0;index<count;index++){
   const angle=heading+index/count*Math.PI*2,from={x:center.x+Math.cos(angle)*orbitRadius,z:center.z+Math.sin(angle)*orbitRadius};
   spawn(from,angle+Math.PI/2,pattern==='foxfire'?target:undefined,{behavior:'orbit',ttl:profile.lifetime,orbitCenterX:center.x,orbitCenterZ:center.z,orbitRadius,orbitAngle:angle,orbitSpeed:profile.orbitSpeed||3});
  }
  return true;
 }
 if(pattern==='psychic-cross'){
  for(let index=0;index<count;index++){
   const side=index%2===0?-1:1,offset=(2+Math.floor(index/2)*1.8)*context.radiusScale;
   const from={x:member.x-Math.sin(heading)*offset*side,z:member.z+Math.cos(heading)*offset*side};
   spawn(from,Math.atan2(focus.z-from.z,focus.x-from.x),undefined,{behavior:'straight'});
   const dx=focus.x-from.x,dz=focus.z-from.z,length=Math.hypot(dx,dz)||1;
   visual('psychic-cross',from,{x:from.x+dx/length*range,z:from.z+dz/length*range},.15);
  }
  return true;
 }
 for(let index=0;index<count;index++){
  const aim=pattern==='swift'||pattern==='spores'?targets[index%targets.length]:target;
  const angle=Math.atan2(aim.z-member.z,aim.x-member.x)+fanOffset(index,profile.spread??.17);
  spawn(member,angle,aim,{
   behavior:pattern==='flame-fan'||pattern==='gust'?'straight':pattern==='ricochet'?'ricochet':'homing',
   turnRate:profile.turnRate,splashRadius:(profile.splashRadius||0)*context.radiusScale,
   knockback:profile.knockback,bounces:profile.bounces,bounceRange:(profile.bounceRange||0)*context.radiusScale,
   size:pattern==='gust'?width:profile.kind==='lob'?.43:.3,
  });
 }
 return true;
}
