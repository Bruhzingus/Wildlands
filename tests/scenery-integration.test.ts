import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP_DEFINITIONS,worldProfile,worldPoint} from '../src/data/maps.ts';
import {WORLD} from '../src/data/world.ts';
import {createEnvironment,createPOIs,explorationRoute} from '../src/game/systems/environment.ts';
import {createBerryTrees} from '../src/game/systems/berries.ts';
import {sceneryDensity} from '../src/game/systems/sceneryDensity.ts';
import {createSurfaceDetails} from '../src/game/systems/surfaceDetails.ts';

test('all four maps have repeatable coordinated scenery, matching collision and open POI approaches',()=>{
 for(const map of Object.values(MAP_DEFINITIONS))for(const seed of [map.seed??4,301,808]){
  const profile=worldProfile(seed,map.id),pois=createPOIs(seed,map.id),layout=createEnvironment(seed,pois,map.id),berries=createBerryTrees(layout.props,seed);
  const again=createEnvironment(seed,createPOIs(seed,map.id),map.id);
  assert.deepEqual(layout,again);assert.deepEqual(berries,createBerryTrees(again.props,seed));
  assert.deepEqual(createSurfaceDetails(seed,profile,pois,layout,berries),createSurfaceDetails(seed,profile,pois,again,berries));
  assert.equal(berries.length,16);assert.ok(layout.props.length<=WORLD.maxProps);
  assert.ok(layout.props.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));
  assert.ok(layout.obstacles.every(o=>Number.isFinite(o.x)&&Number.isFinite(o.z)));
  for(const prop of layout.props.filter(p=>p.kind==='tree'||p.kind==='ruin')){
   const collider=layout.obstacles.find(o=>o.x===prop.x&&o.z===prop.z);assert.ok(collider,`${map.id}: missing ${prop.kind} proxy`);
   if(prop.kind==='tree'){assert.equal(collider.kind,'circle');if(collider.kind==='circle')assert.equal(collider.radius,.37*prop.scale);}
   if(prop.landmark)continue;
   const radius=collider.kind==='circle'?collider.radius:Math.hypot(collider.halfWidth,collider.halfDepth);
   assert.ok(Math.hypot(prop.x,prop.z)>=WORLD.safeSpawnRadius+radius);
   assert.ok(pois.every(p=>Math.hypot(p.x-prop.x,p.z-prop.z)>=WORLD.poiClearance+radius));
   assert.ok(Math.hypot(prop.x-profile.lake.x,prop.z-profile.lake.z)>=profile.lake.shoreRadius+radius);
   for(const poi of pois){
    const route=explorationRoute(poi,profile);
    for(let i=1;i<route.length;i++)for(let t=0;t<=1;t+=.05){
     const a=route[i-1],b=route[i];
     assert.ok(Math.hypot(prop.x-a.x-(b.x-a.x)*t,prop.z-a.z-(b.z-a.z)*t)>=WORLD.routeHalfWidth+radius);
    }
   }
  }
  const landmarks=layout.props.filter(p=>p.landmark);
  assert.deepEqual(landmarks,map.landmarkProps.map(p=>({...p,...worldPoint(p,profile),rotation:(p.rotation??0)-profile.turn*Math.PI/2})));
 }
});

test('regional density has broad continuous gaps, distinct biome controls and no tile seams',()=>{
 for(const map of Object.values(MAP_DEFINITIONS))for(const seed of [4,301]){
  const profile=worldProfile(seed,map.id),values:number[]=[];
  for(let x=-100;x<=100;x+=5)for(let z=-100;z<=100;z+=5){
   const point=worldPoint({x,z},profile),value=sceneryDensity(point.x,point.z,profile);values.push(value);
   assert.ok(value>=0&&value<=1);
   assert.ok(Math.abs(value-sceneryDensity(point.x+.1,point.z+.1,profile))<.02,'density has an abrupt seam');
  }
  assert.ok(Math.max(...values)-Math.min(...values)>.5,'a map lost its broad clearings and clusters');
 }
 assert.ok(MAP_DEFINITIONS['pinewood-route'].placement.woodlandBoost>MAP_DEFINITIONS.wildlands.placement.woodlandBoost);
 assert.ok(MAP_DEFINITIONS['volcanic-ridge'].placement.shrubKeep<MAP_DEFINITIONS.wildlands.placement.shrubKeep);
});
