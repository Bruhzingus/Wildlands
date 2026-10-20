import type {Enemy,Vec2} from '../types.ts';
import {segmentDistanceSquared} from '../../utils/geometry.ts';

/** Aim assistance stays in front of the camera; proximity cannot select a foe behind it. */
export function enemyInAim(enemies:readonly Enemy[],from:Vec2,range:number,facing:number,excluded:ReadonlySet<number>=new Set()):Enemy|undefined {
 let best:Enemy|undefined,score=Infinity;
 const dx=Math.sin(facing),dz=Math.cos(facing);
 for(const enemy of enemies){
  if(enemy.dead||enemy.hp<=0||excluded.has(enemy.uid))continue;
  const x=enemy.x-from.x,z=enemy.z-from.z,distance=Math.hypot(x,z),along=x*dx+z*dz;
  if(distance>range||along<distance*Math.cos(Math.PI/6))continue;
  const candidate=Math.abs(Math.atan2(x*dz-z*dx,along))+distance/Math.max(1,range)*.025;
  if(candidate<score){score=candidate;best=enemy;}
 }
 return best;
}

export function nearestEnemy(enemies:readonly Enemy[],from:Vec2,range:number,excluded:ReadonlySet<number>=new Set()):Enemy|undefined {
 let best:Enemy|undefined,min=range*range;
 for(const enemy of enemies){if(enemy.dead||excluded.has(enemy.uid))continue;
  const distance=(enemy.x-from.x)**2+(enemy.z-from.z)**2;
  if(distance<min){min=distance;best=enemy;}
 }
 return best;
}
/** A fresh visited set belongs to each cast, so one enemy can never bounce twice. */
export function chainTargets(enemies:readonly Enemy[],start:Enemy,jumps:number,range:number):Enemy[]{
 const result:Enemy[]=[],visited=new Set<number>();let target:Enemy|undefined=start;
 while(target&&result.length<Math.min(16,jumps)){
  result.push(target);visited.add(target.uid);target=nearestEnemy(enemies,target,range,visited);
 }
 return result;
}
export function enemiesInRadius(enemies:readonly Enemy[],center:Vec2,radius:number):Enemy[]{
 return enemies.filter(enemy=>!enemy.dead&&(enemy.x-center.x)**2+(enemy.z-center.z)**2<=radius*radius);
}
/** Return swept collisions in travel order; array insertion must not decide penetration. */
export function sweptTargets(enemies:readonly Enemy[],from:Vec2,to:Vec2,size:number,hit:ReadonlySet<number>):Enemy[]{
 const dx=to.x-from.x,dz=to.z-from.z,len=dx*dx+dz*dz;
 return enemies.filter(enemy=>!enemy.dead&&!hit.has(enemy.uid)&&segmentDistanceSquared(enemy,from,to)<(size+enemy.size*.75)**2)
  .sort((a,b)=>{
   const along=(e:Enemy)=>len?Math.max(0,Math.min(1,((e.x-from.x)*dx+(e.z-from.z)*dz)/len)):0;
   return along(a)-along(b);
  });
}
