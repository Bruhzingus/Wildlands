import {DESIGN} from '../../data/config.ts';
import {RNG,clamp} from '../../utils/random.ts';
import type {POI,Vec2} from '../types.ts';
import {WORLD,LANDMARKS,type BiomeId} from '../../data/world.ts';
import {ECONOMY} from '../../data/economy.ts';

export type WorldProp={kind:'rock'|'bush'|'tree'|'flower'|'ruin';x:number;z:number;scale:number;scaleY?:number;rotation?:number;landmark?:boolean};
export type Obstacle=({kind:'circle';radius:number}|{kind:'box';halfWidth:number;halfDepth:number;rotation:number})&Vec2;
export interface EnvironmentLayout {props:WorldProp[];obstacles:Obstacle[];}
const landmarkProps:readonly WorldProp[]=[
 {kind:'tree',x:-61,z:-50,scale:3.1,landmark:true},
 {kind:'ruin',x:55.5,z:-49,scale:1.1,scaleY:3,rotation:0,landmark:true},
 {kind:'ruin',x:66.5,z:-49,scale:1.1,scaleY:3,rotation:0,landmark:true},
 {kind:'rock',x:50,z:40,scale:2.4,landmark:true},
 {kind:'rock',x:56,z:44,scale:1.8,landmark:true},
 {kind:'rock',x:58,z:36,scale:1.3,landmark:true},
];
const propRadius=(p:WorldProp)=>p.kind==='ruin'?Math.hypot(1.2*p.scale,.9):(p.kind==='tree'?.37:1.25)*p.scale;

export function biomeAt(x:number,z:number):BiomeId {
 if(Math.hypot(x,z)<32)return 'meadow';
 if(Math.hypot(x-WORLD.lake.x,z-WORLD.lake.z)<44||(z>48&&x<26))return 'lake';
 if((z< -24&&x<28)||(x< -50&&z<38))return 'woodland';
 if((x>34&&z<14)||(x>51&&z<62))return 'ruins';
 return 'meadow';
}
/** Shared by characters, terrain and props; the pond basin never hides actors under a flat disc. */
export function terrainHeight(x:number,z:number):number {
 const broad=.55*Math.sin(x*.046)+.42*Math.cos(z*.053)+.24*Math.sin((x+z)*.10);
 const hill=(cx:number,cz:number,s:number,h:number)=>h*Math.exp(-((x-cx)**2+(z-cz)**2)/(s*s));
 const ground=broad+hill(-56,-32,37,4.2)+hill(52,40,33,5.1)+hill(62,-55,29,3.8);
 const distance=Math.hypot(x-WORLD.lake.x,z-WORLD.lake.z),blend=clamp((distance-WORLD.lake.waterRadius)/9,0,1);
 const shoreBlend=blend*blend*(3-2*blend);
 return (-.7+distance*.018)*(1-shoreBlend)+ground*shoreBlend;
}
const segmentDistance=(point:Vec2,a:Vec2,b:Vec2)=>{
 const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
 return Math.hypot(point.x-a.x-t*dx,point.z-a.z-t*dz);
};
/** Open, obstacle-free spokes make every optional site reachable from the clearing. */
export function explorationRoute(poi:Vec2):Vec2[] {
 const start={x:0,z:0},lake=WORLD.lake;
 if(segmentDistance(lake,start,poi)>lake.shoreRadius+2)return [start,{x:poi.x,z:poi.z}];
 const side=poi.x<lake.x?-1:1,waypoint={x:lake.x+side*34,z:lake.z-30};
 return [start,waypoint,{x:poi.x,z:poi.z}];
}
export function createPOIs(seed:number):POI[] {
 const rng=new RNG(seed^0x6ac690c5),pois:POI[]=[];
 const sites:readonly [POI['kind'],number,number,BiomeId][]=[
  ['cache',24,24,'meadow'],['shrine',-48,-43,'woodland'],['elite',72,-74,'ruins'],
  ['cache',-84,-20,'woodland'],['healing',-28,18,'meadow'],['cache',87,-8,'ruins'],
  ['elite',-29,-86,'woodland'],['shrine',40,-56,'ruins'],['cache',-26,40,'lake'],
  ['healing',-76,67,'lake'],['cache',28,82,'meadow'],['elite',80,56,'ruins'],
 ];
 for(const [kind,cx,cz,biome] of sites){
  const valid=(point:Vec2)=>{
   if(biomeAt(point.x,point.z)!==biome||Math.hypot(point.x,point.z)<27||Math.max(Math.abs(point.x),Math.abs(point.z))>101)return false;
   if(Math.hypot(point.x-WORLD.lake.x,point.z-WORLD.lake.z)<WORLD.lake.shoreRadius+3)return false;
   if(pois.some(p=>Math.hypot(p.x-point.x,p.z-point.z)<WORLD.poiSpacing)||LANDMARKS.some(p=>Math.hypot(p.x-point.x,p.z-point.z)<10))return false;
   const route=explorationRoute(point);
   return !landmarkProps.some(p=>route.slice(1).some((end,index)=>segmentDistance(p,route[index],end)<propRadius(p)+WORLD.routeHalfWidth));
  };
  let candidate:Vec2|undefined;
  for(let attempt=0;attempt<100;attempt++){
   const point={x:cx+rng.between(-11,11),z:cz+rng.between(-11,11)};
   if(valid(point)){candidate=point;break;}
  }
  // Bounded deterministic recovery validates the same constraints as random placement.
  if(!candidate)for(let distance=0;distance<=24&&!candidate;distance+=2)for(let angle=0;angle<32;angle++){
   const point={x:cx+Math.sin(angle*Math.PI/16)*distance,z:cz+Math.cos(angle*Math.PI/16)*distance};
   if(valid(point)){candidate=point;break;}
  }
  if(!candidate)throw new Error(`No reachable exploration site for ${kind} in ${biome}`);
  const paid=kind==='cache'&&pois.filter(poi=>poi.kind==='cache').length>=2;
  pois.push({uid:20+pois.length,...candidate,kind,used:false,...(paid?{price:ECONOMY.chestBaseCost}:{})});
 }
 return pois;
}
export type ExplorationEvent={kind:'wild-bloom'|'cache-ambush'|'ancient-echo';label:string};
/** A stable one-shot hook attached to an optional site, independent of combat RNG and visit order. */
export function rareEventFor(seed:number,poi:POI):ExplorationEvent|null {
 if(poi.kind==='elite')return null;
 let mixed=(seed^0x1833a72b)^Math.imul(poi.uid,0x45d9f3b);
 mixed=Math.imul(mixed^(mixed>>>16),0x7feb352d);mixed=Math.imul(mixed^(mixed>>>15),0x846ca68b);mixed^=mixed>>>16;
 const rng=new RNG(mixed);
 if(rng.next()>=WORLD.rareEventChance)return null;
 return poi.kind==='healing'?{kind:'wild-bloom',label:'Wild bloom: the spring restores the whole party.'}
  :poi.kind==='cache'?{kind:'cache-ambush',label:'A rustle in the grass: a rare cache ambush!'}
  :{kind:'ancient-echo',label:'Ancient echo: a lingering blessing surrounds the party.'};
}
export function boundaryStrength(position:Vec2):number {
 return clamp((Math.max(Math.abs(position.x),Math.abs(position.z))-WORLD.softBoundaryStart)/(WORLD.hardBoundary-WORLD.softBoundaryStart),0,1);
}

/** Shared seeded geometry: rendering and collision must describe the same world. */
export function createEnvironment(seed:number,pois:readonly POI[]=[]):EnvironmentLayout {
 const rng=new RNG(seed),props:WorldProp[]=[],obstacles:Obstacle[]=[];
 const routes=pois.map(explorationRoute);
 const clear=(x:number,z:number,margin=1.5)=>Math.hypot(x,z)>=WORLD.safeSpawnRadius+margin&&Math.hypot(x-WORLD.lake.x,z-WORLD.lake.z)>=WORLD.lake.shoreRadius+margin
  &&!pois.some(p=>Math.hypot(x-p.x,z-p.z)<WORLD.poiClearance+margin)
  &&!routes.some(route=>route.slice(1).some((end,index)=>segmentDistance({x,z},route[index],end)<WORLD.routeHalfWidth+margin));
 const add=(prop:WorldProp)=>{
  props.push(prop);
  if(prop.kind==='tree'||prop.kind==='rock')obstacles.push({kind:'circle',x:prop.x,z:prop.z,radius:(prop.kind==='tree'?.37:1.25)*prop.scale});
  if(prop.kind==='ruin')obstacles.push({kind:'box',x:prop.x,z:prop.z,halfWidth:1.2*prop.scale,halfDepth:.9,rotation:prop.rotation||0});
 };
 for(let i=0;i<WORLD.propAttempts&&props.length<WORLD.maxProps-6;i++){
  const x=rng.between(-110,110),z=rng.between(-110,110),biome=biomeAt(x,z),roll=rng.next();
  const scale=rng.between(.65,1.4);
  const kind:WorldProp['kind']=biome==='woodland'?(roll<.80?'tree':roll<.91?'rock':'bush')
   :biome==='ruins'?(roll<.28?'ruin':roll<.62?'rock':roll<.78?'tree':'bush')
   :biome==='lake'?(roll<.36?'tree':roll<.58?'rock':roll<.85?'bush':'flower')
   :roll<.36?'flower':roll<.64?'bush':roll<.83?'tree':'rock';
  const margin=kind==='rock'?1.25*scale:kind==='ruin'?Math.hypot(1.2*scale,.9):kind==='tree'?.37*scale:.5;
  if(!clear(x,z,margin)||LANDMARKS.some(p=>Math.hypot(p.x-x,p.z-z)<9))continue;
  // Avoid intersecting solid primitives while allowing canopy overlap.
  if(kind!=='flower'&&kind!=='bush'&&obstacles.some(o=>Math.hypot(o.x-x,o.z-z)<margin+(o.kind==='circle'?o.radius:Math.hypot(o.halfWidth,o.halfDepth))+.8))continue;
  add({kind,x,z,scale,scaleY:rng.between(.5,1.5),rotation:rng.between(0,Math.PI*2)});
 }
 // Authored landmarks reuse the same primitives and colliders as random decoration.
 for(const prop of landmarkProps)add({...prop});
 obstacles.push({kind:'circle',x:WORLD.lake.x,z:WORLD.lake.z,radius:WORLD.lake.waterRadius-1});
 return {props,obstacles};
}

/** Static grid avoids scanning the whole forest for every controller step. */
export class ObstacleField {
 private readonly cells=new Map<string,Obstacle[]>();
 private readonly cellSize=8;
 constructor(obstacles:readonly Obstacle[]){
  for(const obstacle of obstacles){
   const radius=obstacle.kind==='circle'?obstacle.radius:Math.hypot(obstacle.halfWidth,obstacle.halfDepth);
   for(let x=Math.floor((obstacle.x-radius)/this.cellSize);x<=Math.floor((obstacle.x+radius)/this.cellSize);x++)
    for(let z=Math.floor((obstacle.z-radius)/this.cellSize);z<=Math.floor((obstacle.z+radius)/this.cellSize);z++){
     const key=`${x},${z}`,cell=this.cells.get(key)||[];cell.push(obstacle);this.cells.set(key,cell);
    }
  }
 }
 move(position:Vec2,dx:number,dz:number,radius=DESIGN.playerRadius):Vec2 {
  const result={x:position.x,z:position.z};
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3));
  for(let step=0;step<steps;step++){
   const soften=(coordinate:number,delta:number)=>coordinate*delta>0?delta*(1-.83*boundaryStrength({x:coordinate,z:0})):delta;
   result.x+=soften(result.x,dx/steps);result.z+=soften(result.z,dz/steps);
   const nearby=new Set<Obstacle>();
   for(let x=Math.floor((result.x-radius)/this.cellSize);x<=Math.floor((result.x+radius)/this.cellSize);x++)
    for(let z=Math.floor((result.z-radius)/this.cellSize);z<=Math.floor((result.z+radius)/this.cellSize);z++)
     for(const obstacle of this.cells.get(`${x},${z}`)||[])nearby.add(obstacle);
   for(let pass=0;pass<3;pass++)for(const obstacle of nearby)this.resolve(result,obstacle,radius,position);
   const bound=WORLD.hardBoundary;
   result.x=clamp(result.x,-bound,bound);result.z=clamp(result.z,-bound,bound);
  }
  return result;
 }
 private resolve(p:Vec2,o:Obstacle,radius:number,from:Vec2){
  if(o.kind==='circle'){
   const dx=p.x-o.x,dz=p.z-o.z,distance=Math.hypot(dx,dz),minimum=o.radius+radius;
   if(distance>=minimum)return;
   const fallback=Math.hypot(from.x-o.x,from.z-o.z),nx=distance>1e-8?dx/distance:fallback>1e-8?(from.x-o.x)/fallback:1,nz=distance>1e-8?dz/distance:fallback>1e-8?(from.z-o.z)/fallback:0;
   p.x=o.x+nx*(minimum+.0001);p.z=o.z+nz*(minimum+.0001);return;
  }
  const cos=Math.cos(o.rotation),sin=Math.sin(o.rotation),dx=p.x-o.x,dz=p.z-o.z;
  let lx=dx*cos-dz*sin,lz=dx*sin+dz*cos;
  const closestX=clamp(lx,-o.halfWidth,o.halfWidth),closestZ=clamp(lz,-o.halfDepth,o.halfDepth);
  const ox=lx-closestX,oz=lz-closestZ,distance=Math.hypot(ox,oz);
  if(distance>=radius)return;
  if(distance>1e-8){lx+=ox/distance*(radius-distance+.0001);lz+=oz/distance*(radius-distance+.0001);}
  else if(o.halfWidth-Math.abs(lx)<o.halfDepth-Math.abs(lz))lx=(lx<0?-1:1)*(o.halfWidth+radius+.0001);
  else lz=(lz<0?-1:1)*(o.halfDepth+radius+.0001);
  p.x=o.x+lx*cos+lz*sin;p.z=o.z-lx*sin+lz*cos;
 }
}
