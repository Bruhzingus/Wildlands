import {DESIGN} from '../../data/config.ts';
import {RNG,clamp} from '../../utils/random.ts';
import type {POI,Vec2} from '../types.ts';
import {WORLD,type BiomeId,type WorldProp} from '../../data/world.ts';
import {DEFAULT_WORLD,worldProfile,worldPoint,localPoint,type WorldProfile,type MapId} from '../../data/maps.ts';
import {ECONOMY} from '../../data/economy.ts';

export type {WorldProp} from '../../data/world.ts';
export type Obstacle=({kind:'circle';radius:number}|{kind:'box';halfWidth:number;halfDepth:number;rotation:number})&Vec2;
export interface EnvironmentLayout {props:WorldProp[];obstacles:Obstacle[];}
const propRadius=(p:WorldProp)=>p.kind==='ruin'?Math.hypot(1.2*p.scale,.9):(p.kind==='tree'?.37:1.25)*p.scale;
const worldLandmarkProps=(profile:WorldProfile)=>profile.definition.landmarkProps.map(prop=>({...prop,...worldPoint(prop,profile),rotation:(prop.rotation??0)-profile.turn*Math.PI/2}));

export function biomeAt(x:number,z:number,profile:WorldProfile=DEFAULT_WORLD):BiomeId {
 const point=localPoint({x,z},profile);x=point.x;z=point.z;
 if(Math.hypot(x,z)<32)return 'meadow';
 const lake=localPoint(profile.lake,profile);
 if(Math.hypot(x-lake.x,z-lake.z)<44||(z>48&&x<26))return 'lake';
 if((z< -24&&x<28)||(x< -50&&z<38))return 'woodland';
 if((x>34&&z<14)||(x>51&&z<62))return 'ruins';
 return 'meadow';
}
/** Shared by characters, terrain and props; the pond basin never hides actors under a flat disc. */
export function terrainHeight(x:number,z:number,profile:WorldProfile=DEFAULT_WORLD):number {
 const distance=Math.hypot(x-profile.lake.x,z-profile.lake.z),point=localPoint({x,z},profile);x=point.x;z=point.z;
 const broad=.55*Math.sin(x*.046)+.42*Math.cos(z*.053)+.24*Math.sin((x+z)*.10);
 const hill=(cx:number,cz:number,s:number,h:number)=>h*Math.exp(-((x-cx)**2+(z-cz)**2)/(s*s));
 const shift=profile.hillShift,ridge=profile.definition.geography==='ridge';
 const ground=(broad+hill(-56+shift,-32,37,ridge?7:4.2)+hill(52,40+shift,33,ridge?8:5.1)+hill(62-shift,-55,29,ridge?6:3.8))*profile.relief;
 const blend=clamp((distance-profile.lake.waterRadius)/(9*WORLD.scale),0,1);
 const shoreBlend=blend*blend*(3-2*blend);
 return (-.7+distance*.018)*(1-shoreBlend)+ground*shoreBlend;
}
const segmentDistance=(point:Vec2,a:Vec2,b:Vec2)=>{
 const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
 return Math.hypot(point.x-a.x-t*dx,point.z-a.z-t*dz);
};
/** Open, obstacle-free spokes make every optional site reachable from the clearing. */
export function explorationRoute(poi:Vec2,profile:WorldProfile=DEFAULT_WORLD):Vec2[] {
 const start={x:0,z:0},lake=localPoint(profile.lake,profile),local=localPoint(poi,profile);
 const localLake={...lake,shoreRadius:profile.lake.shoreRadius/WORLD.scale};
 if(segmentDistance(localLake,start,local)>localLake.shoreRadius+2)return [start,{x:poi.x,z:poi.z}];
 // A tiny visibility graph handles destinations on either side of a shifted lake.
 const clearance=localLake.shoreRadius+7,nodes=[start,local,
  ...[-1,1].flatMap(x=>[-1,1].map(z=>({x:lake.x+x*clearance,z:lake.z+z*clearance})))];
 const costs=nodes.map((_,i)=>i===0?0:Infinity),previous=nodes.map(()=>-1),visited=new Set<number>();
 while(visited.size<nodes.length){
  let next=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(next<0||costs[i]<costs[next]))next=i;
  if(next<0||!Number.isFinite(costs[next]))break;
  if(next===1){const path:Vec2[]=[];for(let i=1;i>=0;i=previous[i])path.unshift(worldPoint(nodes[i],profile));return path;}
  visited.add(next);
  for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&segmentDistance(localLake,nodes[next],nodes[i])>localLake.shoreRadius+2){
   const cost=costs[next]+Math.hypot(nodes[next].x-nodes[i].x,nodes[next].z-nodes[i].z);
   if(cost<costs[i]){costs[i]=cost;previous[i]=next;}
  }
 }
 throw new Error('No dry exploration route around the lake');
}
export function createPOIs(seed:number,mapId:MapId='wildlands'):POI[] {
 const rng=new RNG(seed^0x6ac690c5),pois:POI[]=[];
 const profile=worldProfile(seed,mapId),lake=profile.lake,landmarks=profile.landmarks,solidLandmarks=worldLandmarkProps(profile);
 const sites:[POI['kind'],number,number,BiomeId?][]=[
  ['cache',24,24,'meadow'],['shrine',-48,-43,'woodland'],['elite',72,-74,'ruins'],
  ['cache',-84,-20,'woodland'],['healing',-28,18,'meadow'],['cache',87,-8,'ruins'],
  ['elite',-29,-86,'woodland'],['shrine',40,-56,'ruins'],['cache',-26,40,'lake'],
  ['healing',-76,67,'lake'],['cache',28,82,'meadow'],['elite',80,56,'ruins'],
 ];
 // Outer discoveries vary in kind as well as position. Three further sites emerge during play.
 for(const [x,z] of [[-95,-87],[-98,28],[3,-96],[96,-48],[94,90],[-5,99]])sites.push([rng.pick(['cache','shrine','elite','healing'] as const),x,z]);
 for(const change of profile.definition.changes)sites.push([change.kind,rng.between(-88,88),rng.between(-88,88)]);
 for(const [kind,cx,cz,biome] of sites){
  const valid=(point:Vec2)=>{
   if((biome&&biomeAt(point.x,point.z,profile)!==biome)||Math.hypot(point.x,point.z)<27||Math.max(Math.abs(point.x),Math.abs(point.z))>101*WORLD.scale)return false;
   if(Math.hypot(point.x-lake.x,point.z-lake.z)<lake.shoreRadius+3)return false;
   if(pois.some(p=>Math.hypot(p.x-point.x,p.z-point.z)<WORLD.poiSpacing)||landmarks.some(p=>Math.hypot(p.x-point.x,p.z-point.z)<10))return false;
   const route=explorationRoute(point,profile);
   return !solidLandmarks.some(p=>route.slice(1).some((end,index)=>segmentDistance(p,route[index],end)<propRadius(p)+WORLD.routeHalfWidth+DESIGN.playerRadius));
  };
  let candidate:Vec2|undefined;
  for(let attempt=0;attempt<100;attempt++){
   const point=worldPoint({x:cx+rng.between(-14,14),z:cz+rng.between(-14,14)},profile);
   if(valid(point)){candidate=point;break;}
  }
  // Bounded deterministic recovery validates the same constraints as random placement.
  if(!candidate)for(let distance=0;distance<=200&&!candidate;distance+=2)for(let angle=0;angle<32;angle++){
   const point=worldPoint({x:cx+Math.sin(angle*Math.PI/16)*distance,z:cz+Math.cos(angle*Math.PI/16)*distance},profile);
   if(valid(point)){candidate=point;break;}
  }
  if(!candidate)throw new Error(`No reachable exploration site for ${kind} in ${biome}`);
  const change=profile.definition.changes[pois.length-18];
  const paid=!change&&kind==='cache'&&pois.filter(poi=>poi.kind==='cache').length>=2;
  const chestIndex=pois.filter(poi=>poi.price!==undefined).length;
  pois.push({uid:20+pois.length,...candidate,kind,used:false,...(change?{availableAt:change.at,name:change.name,changeLabel:change.label}:{}),...(paid?{price:ECONOMY.chestBaseCost,rarity:(['common','rare','epic'] as const)[chestIndex%3]}:{})});
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
export function createEnvironment(seed:number,pois:readonly POI[]=[],mapId:MapId='wildlands'):EnvironmentLayout {
 const rng=new RNG(seed),props:WorldProp[]=[],obstacles:Obstacle[]=[];
 const profile=worldProfile(seed,mapId),lake=profile.lake,landmarks=profile.landmarks;
 const routes=pois.map(poi=>explorationRoute(poi,profile));
 const clear=(x:number,z:number,margin=1.5)=>Math.hypot(x,z)>=WORLD.safeSpawnRadius+margin&&Math.hypot(x-lake.x,z-lake.z)>=lake.shoreRadius+margin
  &&!pois.some(p=>Math.hypot(x-p.x,z-p.z)<WORLD.poiClearance+margin)
  &&!routes.some(route=>route.slice(1).some((end,index)=>segmentDistance({x,z},route[index],end)<WORLD.routeHalfWidth+margin));
 const add=(prop:WorldProp)=>{
  props.push(prop);
  if(prop.kind==='tree'||prop.kind==='rock')obstacles.push({kind:'circle',x:prop.x,z:prop.z,radius:(prop.kind==='tree'?.37:1.25)*prop.scale});
  if(prop.kind==='ruin')obstacles.push({kind:'box',x:prop.x,z:prop.z,halfWidth:1.2*prop.scale,halfDepth:.9,rotation:prop.rotation||0});
 };
 for(let i=0;i<WORLD.propAttempts&&props.length<WORLD.maxProps-profile.definition.landmarkProps.length;i++){
  const x=rng.between(-110,110)*WORLD.scale,z=rng.between(-110,110)*WORLD.scale,biome=biomeAt(x,z,profile),roll=rng.next();
  const scale=rng.between(.65,1.4);
  const kind:WorldProp['kind']=roll<profile.definition.scenery.rockChance?'rock':biome==='woodland'?(roll<.80?'tree':roll<.91?'rock':'bush')
   :biome==='ruins'?(roll<.28?'ruin':roll<.62?'rock':roll<.78?'tree':'bush')
   :biome==='lake'?(roll<.36?'tree':roll<.58?'rock':roll<.85?'bush':'flower')
   :roll<.36?'flower':roll<.64?'bush':roll<.83?'tree':'rock';
  const margin=kind==='rock'?1.25*scale:kind==='ruin'?Math.hypot(1.2*scale,.9):kind==='tree'?.37*scale:.5;
  if(!clear(x,z,margin)||landmarks.some(p=>Math.hypot(p.x-x,p.z-z)<9))continue;
  // Avoid intersecting solid primitives while allowing canopy overlap.
  if(kind!=='flower'&&kind!=='bush'&&obstacles.some(o=>Math.hypot(o.x-x,o.z-z)<margin+(o.kind==='circle'?o.radius:Math.hypot(o.halfWidth,o.halfDepth))+.8))continue;
  add({kind,x,z,scale,scaleY:rng.between(.5,1.5),rotation:rng.between(0,Math.PI*2)});
 }
 // Authored landmarks reuse the same primitives and colliders as random decoration.
 for(const prop of worldLandmarkProps(profile))add({...prop});
 obstacles.push({kind:'circle',x:lake.x,z:lake.z,radius:lake.waterRadius-1});
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
