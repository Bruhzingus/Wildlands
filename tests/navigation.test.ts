import test from 'node:test';
import assert from 'node:assert/strict';
import {DESIGN} from '../src/data/config.ts';
import {WORLD} from '../src/data/world.ts';
import {createEnvironment,ObstacleField,type Obstacle} from '../src/game/systems/environment.ts';
import {EnemyNavigation} from '../src/game/systems/navigation.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import type {Vec2} from '../src/game/types.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
const distance=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.z-b.z);

function follow(obstacles:Obstacle[],start:Vec2,target:Vec2,steps=1500){
 const field=new ObstacleField(obstacles),navigation=new EnemyNavigation(),actor={...start},trail=[{...actor}];
 for(let frame=0;frame<steps&&distance(actor,target)>.15;frame++){
  const now=frame*.04;navigation.beginFrame(field,now);
  const heading=navigation.steer(actor,target,now),stride=Math.min(.16,distance(actor,target));
  const next=field.move(actor,heading.x*stride,heading.z*stride);
  assert.ok(field.isPathClear(actor,next,DESIGN.playerRadius-.0001),'Every step clears the actual collision shapes');
  assert.ok(distance(actor,next)<=stride+.0001,'Navigation preserves movement speed');
  Object.assign(actor,next);trail.push({...actor});
 }
 assert.ok(distance(actor,target)<.2,`Enemy did not reach its target: ${JSON.stringify(actor)}`);
 return trail;
}

test('swept path clearance includes body radius, rotated ruins, rounded corners and map bounds',()=>{
 const circle=new ObstacleField([{kind:'circle',x:0,z:0,radius:2}]);
 assert.equal(circle.isPathClear({x:-5,z:0},{x:5,z:0}),false);
 assert.equal(circle.isPathClear({x:-5,z:2.5},{x:5,z:2.5}),false);
 assert.equal(circle.isPathClear({x:-5,z:2.7},{x:5,z:2.7}),true);
 assert.equal(circle.isPathClear({x:-5,z:0},{x:-3,z:0}),true);
 const box=new ObstacleField([{kind:'box',x:0,z:0,halfWidth:2,halfDepth:1,rotation:Math.PI/4}]);
 assert.equal(box.isPathClear({x:-4,z:0},{x:4,z:0}),false);
 assert.equal(box.isPathClear({x:-4,z:4},{x:4,z:4}),true);
 const unrotated=new ObstacleField([{kind:'box',x:0,z:0,halfWidth:2,halfDepth:1,rotation:0}]);
 assert.equal(unrotated.isPathClear({x:2.5,z:1.5},{x:2.5,z:1.5}),true,'Rounded corners keep their usable clearance');
 assert.equal(unrotated.isPathClear({x:WORLD.hardBoundary+1,z:0},{x:0,z:0}),false);
});

test('enemies take a straight route in open space and go around head-on rocks and rotated ruins',()=>{
 const straight=follow([],{x:-8,z:0},{x:8,z:0});assert.ok(straight.every(point=>point.z===0));
 for(const obstacle of [
  {kind:'circle',x:0,z:0,radius:2},
  {kind:'box',x:0,z:0,halfWidth:2.5,halfDepth:1.5,rotation:Math.PI/4},
 ] satisfies Obstacle[]){
  const trail=follow([obstacle],{x:-8,z:0},{x:8,z:0});
  assert.ok(trail.some(point=>Math.abs(point.z)>2.5),'The enemy leaves the blocked pursuit line');
 }
});

test('routing escapes a concave cluster even when the first steps lead away from the target',()=>{
 const obstacles:Obstacle[]=[
  {kind:'box',x:3,z:0,halfWidth:.5,halfDepth:4.5,rotation:0},
  {kind:'box',x:0,z:4,halfWidth:3,halfDepth:.5,rotation:0},
  {kind:'box',x:0,z:-4,halfWidth:3,halfDepth:.5,rotation:0},
 ];
 const trail=follow(obstacles,{x:0,z:0},{x:10,z:0});
 assert.ok(trail.some(point=>point.x< -3.6),'The enemy backs out of the pocket');
});

test('large lake colliders and neighbouring rocks are navigable',()=>{
 follow([{kind:'circle',x:0,z:0,radius:28,blocksFlight:true}],{x:-40,z:0},{x:40,z:0});
 follow([
  {kind:'circle',x:0,z:-1.8,radius:2},
  {kind:'circle',x:0,z:1.8,radius:2},
  {kind:'circle',x:2,z:4,radius:1.2},
 ],{x:-8,z:0},{x:8,z:0});
});

test('generated rock approaches remain navigable where boundary slowdown affects one axis',()=>{
 // Retain the original regression layout: added shrine approaches clear away
 // this particular outer rock, but its one-axis slowdown still needs coverage.
 const sim=new Simulation(7,1),layout=createEnvironment(1,sim.state.pois.filter(poi=>poi.uid<41));
 const rock=layout.obstacles.find(o=>o.kind==='circle'&&o.x< -145&&o.z>165&&o.radius>1)!;
 assert.ok(rock&&rock.kind==='circle');
 const span=rock.radius+4;
 follow(layout.obstacles,{x:rock.x-span,z:rock.z},{x:rock.x+span,z:rock.z});
});

test('cached routes respond to moving targets and replaced obstacle fields',()=>{
 const field=new ObstacleField([{kind:'circle',x:0,z:0,radius:3}]),navigation=new EnemyNavigation(),actor={x:-8,z:0};
 navigation.beginFrame(field,0);const detour=navigation.steer(actor,{x:8,z:0},0);
 assert.ok(Math.abs(detour.z)>.1);
 navigation.beginFrame(field,1);assert.deepEqual(navigation.steer(actor,{x:-12,z:0},1),{x:-1,z:0});
 navigation.beginFrame(new ObstacleField([]),2);assert.deepEqual(navigation.steer(actor,{x:8,z:0},2),{x:1,z:0});
});

test('queued enemies all receive routes and unreachable destinations remain finite and collision safe',()=>{
 const field=new ObstacleField([{kind:'circle',x:0,z:0,radius:2}]),navigation=new EnemyNavigation();
 const actors=Array.from({length:20},()=>({x:-8,z:0})),routed=new Set<Vec2>();
 for(let frame=0;frame<12;frame++){
  const now=frame*.04;navigation.beginFrame(field,now);
  for(const actor of actors)if(Math.abs(navigation.steer(actor,{x:8,z:0},now).z)>.1)routed.add(actor);
 }
 assert.equal(routed.size,actors.length);
 const actor={x:-8,z:0};
 for(let frame=0;frame<100;frame++){
  const now=frame*.04;navigation.beginFrame(field,now);const heading=navigation.steer(actor,{x:0,z:0},now);
  Object.assign(actor,field.move(actor,heading.x*.16,heading.z*.16));
  assert.ok(Number.isFinite(actor.x+actor.z));assert.ok(Math.hypot(actor.x,actor.z)>=2+DESIGN.playerRadius);
 }
});

function arena(obstacles:Obstacle[]){
 const sim=new Simulation(7,414),s=sim.state;
 Object.assign(sim,{obstacles:new ObstacleField(obstacles),spawnAccum:-1000});
 s.enemies=[];s.pois=[];s.terrainFeatures=[];s.berryTrees=[];s.party[0].cooldown=1000;s.player.iframes=1000;
 return {sim,s};
}

test('simulation melee enemies reach attack range around scenery and stop for stun and windup',()=>{
 const {sim,s}=arena([{kind:'box',x:-6,z:0,halfWidth:1,halfDepth:3,rotation:0}]);
 const enemy=createEnemy(s,sim.rng,19,'normal',-12,0);enemy.speed=4;enemy.attackCooldown=0;s.enemies=[enemy];
 let detoured=false;
 for(let frame=0;frame<500&&!enemy.windup;frame++){sim.update(.04,idle);detoured ||= Math.abs(enemy.z)>3;}
 assert.ok(detoured);assert.ok(enemy.windup,'The enemy gets close enough to begin its normal attack');
 const position={x:enemy.x,z:enemy.z};sim.update(.04,idle);assert.equal(distance(enemy,position),0);
 enemy.stunTime=1;sim.update(.04,idle);assert.equal(distance(enemy,position),0);assert.equal(enemy.windup,undefined);
});

test('ranged enemies preserve firing distance and healers route to wounded allies',()=>{
 const ranged=arena([{kind:'circle',x:-15,z:0,radius:2}]);
 const shooter=createEnemy(ranged.s,ranged.sim.rng,26,'normal',-25,0);shooter.speed=4;shooter.attackCooldown=1000;ranged.s.enemies=[shooter];
 for(let i=0;i<400;i++)ranged.sim.update(.04,idle);
 assert.ok(distance(shooter,ranged.s.player)>=8&&distance(shooter,ranged.s.player)<=10.2);
 const {sim,s}=arena([{kind:'box',x:0,z:0,halfWidth:1,halfDepth:3,rotation:0}]);
 s.player.x=-20;s.player.z=0;
 const healer=createEnemy(s,sim.rng,113,'normal',-6,0),ally=createEnemy(s,sim.rng,19,'normal',6,0);
 Object.assign(healer,{speed:4,attackCooldown:1000});Object.assign(ally,{hp:1,speed:0,attackCooldown:1000});s.enemies=[healer,ally];
 for(let i=0;i<350;i++)sim.update(.04,idle);
 assert.ok(healer.x>1,'The healer heads toward its wounded ally across the obstacle');
 assert.ok(distance(healer,ally)<8);
});
