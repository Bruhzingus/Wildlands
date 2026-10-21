import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP_DEFINITIONS,worldProfile,worldPoint} from '../src/data/maps.ts';
import {terrainHeight,createPOIs,explorationRoute} from '../src/game/systems/environment.ts';
import {projectMapPoint,MAP_SIZE} from '../src/ui/minimap.ts';
import {WORLD} from '../src/data/world.ts';

test('composed terrain has real relief, a level safe spawn and gentle traversable gradients in both families',()=>{
 for(const map of Object.values(MAP_DEFINITIONS))for(const seed of [0,1,4,12,301,808]){
  const profile=worldProfile(seed,map.id);let minimum=Infinity,maximum=-Infinity;
  for(let x=-WORLD.hardBoundary;x<=WORLD.hardBoundary;x+=4)for(let z=-WORLD.hardBoundary;z<=WORLD.hardBoundary;z+=4){
   const h=terrainHeight(x,z,profile);minimum=Math.min(minimum,h);maximum=Math.max(maximum,h);
   const gradient=Math.hypot(terrainHeight(x+.1,z,profile)-h,terrainHeight(x,z+.1,profile)-h)/.1;
   assert.ok(Number.isFinite(h)&&gradient<.85,`${map.id}, seed ${seed}: slope ${gradient}`);
  }
  assert.ok(maximum-minimum>11);assert.ok(minimum> -4&&maximum<22);
  for(const p of [{x:0,z:0},{x:10,z:0},{x:0,z:-10}])assert.equal(terrainHeight(p.x,p.z,profile),0);
  assert.ok(terrainHeight(profile.lake.x,profile.lake.z,profile)<profile.lake.waterHeight);
 }
});

test('seeded branch junctions change approaches without enlarging the map or moving minimap authority',()=>{
 const variants=new Set<number>(),approaches=new Set<string>();
 for(let sample=1;sample<=30;sample++){
  const seed=sample*7919,profile=worldProfile(seed);variants.add(profile.composition.variant);
  const pois=createPOIs(seed);
  for(const poi of pois){
   const route=explorationRoute(poi,profile);assert.ok(route.length>=3);assert.deepEqual(route.at(-1),{x:poi.x,z:poi.z});
   approaches.add(JSON.stringify(profile.composition.hubs));
   for(const point of route){
    assert.ok(Math.max(Math.abs(point.x),Math.abs(point.z))<WORLD.hardBoundary);
    const projected=projectMapPoint(point);assert.ok(projected.x>0&&projected.x<MAP_SIZE&&projected.y>0&&projected.y<MAP_SIZE);
   }
  }
  assert.deepEqual(profile,worldProfile(seed));
  assert.deepEqual(worldPoint(profile.composition.hubs[0],profile),explorationRoute(worldPoint({x:-60,z:-70},profile),profile)[1]);
 }
 assert.equal(variants.size,3);assert.equal(approaches.size,3);
});
