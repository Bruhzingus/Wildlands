import {DESIGN} from '../../data/config.ts';
import {WORLD} from '../../data/world.ts';
import type {Vec2} from '../types.ts';
import {boundarySpeedScale,type ObstacleField} from './environment.ts';

const CELL_SIZE=1.5,MAX_VISITS=1536,SEARCHES_PER_FRAME=3,RETRY_SECONDS=.6;
const DIRECTIONS=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]] as const;
const distance=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.z-b.z);
const direction=(from:Vec2,to:Vec2):Vec2=>{
 // Movement slows outward axes independently. Compensate before normalizing
 // so boundary slowdown preserves the chosen path and still limits speed.
 const dx=to.x-from.x,dz=to.z-from.z,x=dx/boundarySpeedScale(from.x,dx),z=dz/boundarySpeedScale(from.z,dz),d=Math.hypot(x,z)||1;
 return {x:x/d,z:z/d};
};
interface Route {target:Vec2;points:Vec2[];retryAt:number;}
export interface NavigationSnapshot {routes:Array<Route&{uid:number;actor?:Vec2}>;pending:number[];}

/** Direct pursuit stays cheap; blocked approaches share a lazy static navigation
 * grid and retain their waypoints. FIFO requests bound work even in a full horde. */
export class EnemyNavigation {
 private field?:ObstacleField;
 private grid?:NavigationGrid;
 private routes=new WeakMap<Vec2,Route>();
 private readonly pending=new Map<Vec2,Route>();
 private searches=0;

 /** Waypoints and FIFO requests affect steering; the static grid is a derived cache. */
 exportSnapshot(actors:readonly (Vec2&{uid:number})[]):NavigationSnapshot {
  const routes:NavigationSnapshot['routes']=actors.flatMap(actor=>{const route=this.routes.get(actor);return route?[{uid:actor.uid,...structuredClone(route)}]:[];});
  const activeIds=new Set(actors.map(actor=>actor.uid));
  // A removed actor can still occupy a FIFO request until next frame. Retain
  // that request's scheduling cost without restoring it as a living enemy.
  for(const [actor,route] of this.pending){const uid=(actor as Vec2&{uid:number}).uid;if(!activeIds.has(uid))routes.push({uid,actor:{x:actor.x,z:actor.z},...structuredClone(route)});}
  return {routes,pending:[...this.pending.keys()].map(actor=>(actor as Vec2&{uid:number}).uid)};
 }
 restoreSnapshot(snapshot:NavigationSnapshot,actors:readonly (Vec2&{uid:number})[],field:ObstacleField):void {
  this.field=field;this.grid=new NavigationGrid(field);this.routes=new WeakMap();this.pending.clear();this.searches=0;
  const byId=new Map(actors.map(actor=>[actor.uid,actor]));
  for(const entry of snapshot.routes){let actor=byId.get(entry.uid);if(!actor&&entry.actor){actor={uid:entry.uid,...entry.actor};byId.set(entry.uid,actor);}if(actor)this.routes.set(actor,structuredClone({target:entry.target,points:entry.points,retryAt:entry.retryAt}));}
  for(const uid of snapshot.pending){const actor=byId.get(uid),route=actor?this.routes.get(actor):undefined;if(actor&&route)this.pending.set(actor,route);}
 }

 beginFrame(field:ObstacleField,now:number){
  if(this.field!==field){
   this.field=field;this.grid=new NavigationGrid(field);this.routes=new WeakMap();this.pending.clear();
  }
  this.searches=0;
  for(const [actor,route] of this.pending){
   this.search(actor,route,now);
   if(this.searches>=SEARCHES_PER_FRAME)break;
  }
 }
 steer(actor:Vec2,target:Vec2,now:number):Vec2 {
  const field=this.field!;
  if(field.isPathClear(actor,target)){
   this.routes.delete(actor);this.pending.delete(actor);return direction(actor,target);
  }
  let route=this.routes.get(actor);
  if(!route){route={target:{x:target.x,z:target.z},points:[],retryAt:now};this.routes.set(actor,route);}
  if(this.pending.has(actor))route.target={x:target.x,z:target.z};
  else if(now>=route.retryAt&&(distance(route.target,target)>2||!route.points.length||!field.isPathClear(actor,route.points[0]))){
   route.target={x:target.x,z:target.z};this.pending.set(actor,route);
   if(this.searches<SEARCHES_PER_FRAME)this.search(actor,route,now);
  }
  // Skip visible waypoints so the route rounds scenery without a grid zigzag.
  while(route.points.length>1&&field.isPathClear(actor,route.points[1]))route.points.shift();
  const next=route.points[0];
  return next&&field.isPathClear(actor,next)?direction(actor,next):direction(actor,target);
 }
 private search(actor:Vec2,route:Route,now:number){
  this.pending.delete(actor);this.searches++;
  route.points=this.grid!.findPath(actor,route.target);route.retryAt=now+RETRY_SECONDS;
 }
}

interface SearchNode {id:number;cost:number;score:number;parent?:SearchNode;}

class NavigationGrid {
 private readonly min=Math.ceil(-WORLD.hardBoundary/CELL_SIZE);
 private readonly width=Math.floor(WORLD.hardBoundary/CELL_SIZE)-this.min+1;
 private readonly tested=new Uint8Array(this.width*this.width);
 private readonly clear=new Uint8Array(this.width*this.width);
 private readonly field:ObstacleField;
 constructor(field:ObstacleField){this.field=field;}
 private point(id:number):Vec2{return {x:(id%this.width+this.min)*CELL_SIZE,z:(Math.floor(id/this.width)+this.min)*CELL_SIZE};}
 private id(x:number,z:number){return x<0||z<0||x>=this.width||z>=this.width?-1:z*this.width+x;}
 private canStep(id:number,next:number,heading:number):boolean {
  const bit=1<<heading;
  if(!(this.tested[id]&bit)){
   const opposite=1<<((heading+4)%8),pass=this.field.isPathClear(this.point(id),this.point(next),DESIGN.playerRadius+.08);
   this.tested[id]|=bit;this.tested[next]|=opposite;
   if(pass){this.clear[id]|=bit;this.clear[next]|=opposite;}
  }
  return !!(this.clear[id]&bit);
 }
 findPath(from:Vec2,target:Vec2):Vec2[] {
  if(!this.field.isPathClear(from,from)||!this.field.isPathClear(target,target))return [];
  const open=new MinHeap(),costs=new Map<number,number>(),closed=new Set<number>();
  const startX=Math.round(from.x/CELL_SIZE)-this.min,startZ=Math.round(from.z/CELL_SIZE)-this.min;
  // Connect the actual position to nearby vertices, including starts beside a collider.
  for(let x=startX-1;x<=startX+1;x++)for(let z=startZ-1;z<=startZ+1;z++){
   const id=this.id(x,z);if(id<0)continue;
   const point=this.point(id);if(!this.field.isPathClear(from,point))continue;
   const cost=distance(from,point);costs.set(id,cost);open.push({id,cost,score:cost+distance(point,target)});
  }
  for(let visits=0;open.length&&visits<MAX_VISITS;){
   const node=open.pop();
   if(closed.has(node.id))continue;closed.add(node.id);visits++;
   const point=this.point(node.id);
   if(this.field.isPathClear(point,target)){
    const path=[target];let step:SearchNode|undefined=node;
    while(step){path.push(this.point(step.id));step=step.parent;}
    return path.reverse();
   }
   const x=node.id%this.width,z=Math.floor(node.id/this.width);
   for(const [heading,[dx,dz]] of DIRECTIONS.entries()){
    const next=this.id(x+dx,z+dz);
    if(next<0||closed.has(next)||!this.canStep(node.id,next,heading))continue;
    const cost=node.cost+CELL_SIZE*(dx&&dz?Math.SQRT2:1);
    if(cost>=(costs.get(next)??Infinity))continue;
    costs.set(next,cost);open.push({id:next,cost,score:cost+distance(this.point(next),target),parent:node});
   }
  }
  return [];
 }
}

/** Small binary heap keeps bounded A* searches cheap without sorting each expansion. */
class MinHeap {
 private readonly nodes:SearchNode[]=[];
 get length(){return this.nodes.length;}
 push(node:SearchNode){
  let i=this.nodes.length;this.nodes.push(node);
  while(i>0){const parent=(i-1)>>1;if(this.nodes[parent].score<=node.score)break;this.nodes[i]=this.nodes[parent];i=parent;}
  this.nodes[i]=node;
 }
 pop():SearchNode {
  const first=this.nodes[0],last=this.nodes.pop()!;
  if(this.nodes.length){
   let i=0;
   while(i*2+1<this.nodes.length){
    let child=i*2+1;if(child+1<this.nodes.length&&this.nodes[child+1].score<this.nodes[child].score)child++;
    if(last.score<=this.nodes[child].score)break;this.nodes[i]=this.nodes[child];i=child;
   }
   this.nodes[i]=last;
  }
  return first;
 }
}
