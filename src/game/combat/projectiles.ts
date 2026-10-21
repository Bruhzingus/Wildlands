import {DESIGN} from '../../data/config.ts';
import {segmentDistanceSquared} from '../../utils/geometry.ts';
import type {Enemy,PartyMember,Projectile,RunState} from '../types.ts';
import {enemiesInRadius,nearestEnemy,sweptTargets} from './targeting.ts';

export type ProjectileSpawn=Omit<Projectile,'uid'|'prevX'|'prevZ'|'hit'>;
export function addProjectile(state:RunState,spawn:ProjectileSpawn):boolean {
 if(![spawn.x,spawn.z,spawn.vx,spawn.vz,spawn.damage,spawn.ttl].every(Number.isFinite))return false;
 if(state.projectiles.length>=DESIGN.maxProjectiles){
  // Repeated friendly casts keep their hit count when the visual pool is full.
  // Damage remains per hit; the existing flight represents the matching stream.
  const stream=spawn.friendly?state.projectiles.find(projectile=>projectile.friendly&&projectile.sourceId===spawn.sourceId&&projectile.moveName===spawn.moveName&&projectile.kind===spawn.kind&&projectile.type===spawn.type&&projectile.targetId===spawn.targetId&&projectile.damage===spawn.damage&&projectile.critTier===spawn.critTier&&projectile.ttl>0):undefined;
  if(!stream)return false;
  stream.hitCount=(stream.hitCount??1)+(spawn.hitCount??1);return true;
 }
 state.projectiles.push({...spawn,uid:state.idCounter++,prevX:spawn.x,prevZ:spawn.z,hit:new Set()});return true;
}
export interface ProjectileHooks {hit:(enemy:Enemy,projectile:Projectile)=>void;hurtPlayer:(damage:number,poison:boolean,projectile?:Projectile)=>void;hurtCompanion?:(member:PartyMember,damage:number,poison:boolean,projectile:Projectile)=>void;explode?:(projectile:Projectile)=>void}
export function stepProjectiles(state:RunState,dt:number,hooks:ProjectileHooks):void {
 for(const projectile of state.projectiles){
  const travel=Math.min(dt,Math.max(0,projectile.ttl));projectile.ttl-=dt;projectile.prevX=projectile.x;projectile.prevZ=projectile.z;
  if(travel===0)continue;
  // Hostile projectiles keep the launched velocity and never home or teleport.
  if(projectile.friendly&&projectile.behavior==='orbit'){
   const center=projectile.targetId===undefined?state.party.find(member=>member.uid===projectile.sourceId):state.enemies.find(enemy=>enemy.uid===projectile.targetId&&!enemy.dead);
   const cx=center?.x??projectile.orbitCenterX??projectile.x,cz=center?.z??projectile.orbitCenterZ??projectile.z;
   projectile.orbitCenterX=cx;projectile.orbitCenterZ=cz;
   projectile.orbitAngle=(projectile.orbitAngle||0)+(projectile.orbitSpeed||3)*travel;
   // Targeted foxfire spirals inward; defensive wisps keep their owner orbit.
   if(projectile.targetId!==undefined)projectile.orbitRadius=(projectile.orbitRadius||2)*Math.exp(-travel*.75);
   const radius=projectile.orbitRadius||2,nextX=cx+Math.cos(projectile.orbitAngle)*radius,nextZ=cz+Math.sin(projectile.orbitAngle)*radius;
   projectile.vx=travel?(nextX-projectile.x)/travel:0;projectile.vz=travel?(nextZ-projectile.z)/travel:0;
  }else if(projectile.friendly&&projectile.behavior!=='straight'&&projectile.targetId!==undefined&&projectile.kind!=='beam'){
   const target=state.enemies.find(enemy=>enemy.uid===projectile.targetId&&!enemy.dead);
   if(target){const dx=target.x-projectile.x,dz=target.z-projectile.z,speed=Math.hypot(projectile.vx,projectile.vz);
    const heading=Math.atan2(projectile.vz,projectile.vx),desired=Math.atan2(dz,dx),difference=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
    const maxTurn=travel*(projectile.turnRate??9),turn=Math.max(-maxTurn,Math.min(maxTurn,difference));
    projectile.vx=Math.cos(heading+turn)*speed;projectile.vz=Math.sin(heading+turn)*speed;
   }
  }
  projectile.x+=projectile.vx*travel;projectile.z+=projectile.vz*travel;
  const from={x:projectile.prevX,z:projectile.prevZ};
  if(!projectile.friendly){
   const poison=projectile.type==='poison'||projectile.poisonChance>0;
   if(projectile.kind==='lob'){
    if(projectile.ttl<=0){
     projectile.x=projectile.blastX??projectile.x;projectile.z=projectile.blastZ??projectile.z;
     const radius=projectile.radius??3;
     if(Math.hypot(state.player.x-projectile.x,state.player.z-projectile.z)<radius+DESIGN.playerRadius)hooks.hurtPlayer(projectile.damage,poison,projectile);
     if(state.result!==null)return;
     for(const member of [...state.party].slice(1))if(Math.hypot(member.x-projectile.x,member.z-projectile.z)<radius+.55){hooks.hurtCompanion?.(member,projectile.damage*.65,poison,projectile);}
     hooks.explode?.(projectile);
    }
    continue;
   }
   if(segmentDistanceSquared(state.player,from,projectile)<(projectile.size+.8)**2){hooks.hurtPlayer(projectile.damage,poison,projectile);projectile.ttl=0;}
   if(state.result!==null)return;
   if(projectile.ttl>0)for(const member of [...state.party].slice(1)){
    if(segmentDistanceSquared(member,from,projectile)>=(projectile.size+.55)**2)continue;
    hooks.hurtCompanion?.(member,projectile.damage*.65,poison,projectile);projectile.ttl=0;break;
   }
   continue;
  }
  const collisions=sweptTargets(state.enemies,from,projectile,projectile.size,projectile.hit);
  if((projectile.kind==='lob'||(projectile.splashRadius||0)>0)&&(collisions.length>0||projectile.ttl<=0)){
   const center=collisions[0]||projectile;projectile.x=center.x;projectile.z=center.z;
   const radius=projectile.splashRadius||projectile.radius||2.1;
   for(const enemy of enemiesInRadius(state.enemies,center,radius)){
    if(projectile.hit.has(enemy.uid))continue;projectile.hit.add(enemy.uid);hooks.hit(enemy,projectile);
    if(state.result!==null)return;
   }
   projectile.radius=radius;hooks.explode?.(projectile);projectile.ttl=0;continue;
  }
  for(const enemy of collisions){
   projectile.hit.add(enemy.uid);hooks.hit(enemy,projectile);if(state.result!==null)return;
   if(projectile.knockback&&!enemy.dead&&!enemy.isBoss){
    const speed=Math.hypot(projectile.vx,projectile.vz)||1;
    enemy.x+=projectile.vx/speed*projectile.knockback;enemy.z+=projectile.vz/speed*projectile.knockback;
   }
   if(projectile.behavior==='ricochet'&&(projectile.bounces||0)>0){
    const next=nearestEnemy(state.enemies,enemy,projectile.bounceRange||5.5,projectile.hit);
    if(next){
     const speed=Math.hypot(projectile.vx,projectile.vz),dx=next.x-enemy.x,dz=next.z-enemy.z,length=Math.hypot(dx,dz)||1;
     projectile.x=enemy.x;projectile.z=enemy.z;projectile.vx=dx/length*speed;projectile.vz=dz/length*speed;
     projectile.targetId=next.uid;projectile.bounces!--;projectile.damage*=.84;
     projectile.ttl=Math.max(projectile.ttl,length/Math.max(1,speed)+.15);break;
    }
   }
   if(projectile.penetration--<=0){projectile.ttl=0;break;}
  }
 }
 state.projectiles=state.projectiles.filter(projectile=>projectile.ttl>0&&Math.abs(projectile.x)<DESIGN.mapRadius+10&&Math.abs(projectile.z)<DESIGN.mapRadius+10);
}
