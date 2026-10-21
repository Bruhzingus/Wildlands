import test from 'node:test';
import assert from 'node:assert/strict';
import {worldProfile} from '../src/data/maps.ts';
import {WORLD,LANDMARKS} from '../src/data/world.ts';
import {biomeAt,boundaryStrength,createEnvironment,createPOIs,explorationRoute,ObstacleField,rareEventFor,terrainHeight} from '../src/game/systems/environment.ts';

test('seeded exploration sites retain every optional kind, safe spawn and separation across biomes',()=>{
 for(let seed=1;seed<=250;seed++){
  const profile=worldProfile(seed),pois=createPOIs(seed);assert.deepEqual(pois,createPOIs(seed));
  assert.deepEqual(pois.map(p=>p.uid),Array.from({length:21},(_,i)=>20+i));
  assert.ok(pois.filter(p=>p.kind==='cache').length>=6);assert.ok(pois.filter(p=>p.kind==='healing').length>=3);
  assert.ok(pois.filter(p=>p.kind==='shrine').length>=2);assert.ok(pois.filter(p=>p.kind==='elite').length>=4);
  assert.equal(new Set(pois.map(p=>biomeAt(p.x,p.z,profile))).size,4);
  for(const [index,poi] of pois.entries()){
   assert.equal(poi.used,false);assert.ok(Math.hypot(poi.x,poi.z)>=27);assert.ok(Math.max(Math.abs(poi.x),Math.abs(poi.z))<=101*WORLD.scale);
   assert.ok(Math.hypot(poi.x-profile.lake.x,poi.z-profile.lake.z)>=WORLD.lake.shoreRadius+3);
   for(const other of pois.slice(index+1))assert.ok(Math.hypot(poi.x-other.x,poi.z-other.z)>=WORLD.poiSpacing);
  }
 }
 assert.notDeepEqual(createPOIs(24),createPOIs(25));assert.equal(biomeAt(0,0),'meadow');
 assert.deepEqual(new Set(LANDMARKS.map(l=>l.biome)),new Set(['woodland','ruins','meadow','lake']));
});

test('solid scenery shares collision dimensions and keeps spawn and interaction clear',()=>{
 const pois=createPOIs(301),layout=createEnvironment(301,pois);
 assert.deepEqual(layout,createEnvironment(301,pois));assert.ok(layout.props.length<=WORLD.maxProps);
 assert.ok(layout.obstacles.length>200);
 for(const prop of layout.props){
  if(prop.kind==='flower'||prop.kind==='bush')continue;
  const obstacle=layout.obstacles.find(o=>o.x===prop.x&&o.z===prop.z);assert.ok(obstacle);
  assert.ok(Math.hypot(prop.x,prop.z)>WORLD.safeSpawnRadius);
  assert.ok(pois.every(p=>Math.hypot(p.x-prop.x,p.z-prop.z)>WORLD.poiClearance));
  if(prop.kind==='ruin'){
   assert.equal(obstacle.kind,'box');if(obstacle.kind==='box'){assert.equal(obstacle.halfWidth,1.2*prop.scale);assert.equal(obstacle.halfDepth,.9);assert.equal(obstacle.rotation,prop.rotation||0);}
  }else{
   assert.equal(obstacle.kind,'circle');if(obstacle.kind==='circle')assert.equal(obstacle.radius,(prop.kind==='tree'?.37:1.25)*prop.scale);
  }
 }
 assert.equal(layout.obstacles.length,layout.props.filter(p=>p.kind==='tree'||p.kind==='rock'||p.kind==='ruin').length+1,'Only the lake adds a collider without a prop');
});

test('terrain interactions are seeded, finite, and leave routes, sites, and the lake clear',()=>{
 for(const seed of [1,4,301,808]){
  const pois=createPOIs(seed),layout=createEnvironment(seed,pois),profile=worldProfile(seed);
  assert.deepEqual(layout.features,createEnvironment(seed,pois).features);
  assert.equal(layout.features.filter(feature=>feature.kind==='bramble').length,4);
  assert.equal(layout.features.filter(feature=>feature.kind==='ruin-beacon').length,3);
  for(const feature of layout.features){
   assert.equal(feature.state,'ready');assert.ok(Math.hypot(feature.x,feature.z)>=30);
   assert.ok(Math.hypot(feature.x-profile.lake.x,feature.z-profile.lake.z)>=profile.lake.shoreRadius+feature.radius+3);
   assert.ok(pois.every(poi=>Math.hypot(feature.x-poi.x,feature.z-poi.z)>WORLD.poiClearance+feature.radius+2));
  }
 }
});

test('all optional sites are reachable through the generated open routes with actual player collision',()=>{
 for(const seed of [1,4,12,100,301,808]){
  const profile=worldProfile(seed),pois=createPOIs(seed),field=new ObstacleField(createEnvironment(seed,pois).obstacles);
  for(const poi of pois){
   let position={x:0,z:0};
   for(const end of explorationRoute(poi,profile).slice(1)){
    for(let step=0;step<1200&&Math.hypot(position.x-end.x,position.z-end.z)>.01;step++){
     const distance=Math.hypot(position.x-end.x,position.z-end.z),stride=Math.min(.25,distance);
     position=field.move(position,(end.x-position.x)/distance*stride,(end.z-position.z)/distance*stride);
    }
    assert.ok(Math.hypot(position.x-end.x,position.z-end.z)<.02,`Seed ${seed}, site ${poi.uid} has an obstructed route`);
   }
  }
 }
});

test('rolling ground stays continuous and the pond has a shallow shared shoreline',()=>{
 let minimum=Infinity,maximum=-Infinity;
 for(let x=-113;x<=WORLD.hardBoundary;x+=3)for(let z=-113;z<=WORLD.hardBoundary;z+=3){
  const h=terrainHeight(x,z);assert.ok(Number.isFinite(h));minimum=Math.min(minimum,h);maximum=Math.max(maximum,h);
  assert.ok(Math.abs(terrainHeight(x+.1,z)-h)<.09);assert.ok(Math.abs(terrainHeight(x,z+.1)-h)<.09);
 }
 assert.ok(maximum>10&&maximum<16);assert.ok(minimum> -3);
 assert.ok(terrainHeight(WORLD.lake.x,WORLD.lake.z)<WORLD.lake.waterHeight);
 const profile=worldProfile(6),lake=profile.lake,field=new ObstacleField(createEnvironment(6,createPOIs(6)).obstacles);
 const stopped=field.move({x:lake.x,z:lake.z-30},0,25);
 assert.ok(Math.hypot(stopped.x-lake.x,stopped.z-lake.z)>=WORLD.lake.waterRadius-1+.62);
});

test('soft square boundaries slow outward travel without trapping inward or tangential movement',()=>{
 const field=new ObstacleField([]);
 const middle=field.move({x:0,z:0},1,0),edge=field.move({x:110*WORLD.scale,z:0},1,0);
 assert.equal(middle.x,1);assert.ok(edge.x-110*WORLD.scale>.1&&edge.x-110*WORLD.scale<.6);
 const inward=field.move({x:112*WORLD.scale,z:0},-1,0),tangent=field.move({x:112*WORLD.scale,z:0},0,1);
 assert.ok(Math.abs(inward.x-(112*WORLD.scale-1))<1e-9);assert.equal(tangent.x,112*WORLD.scale);assert.equal(tangent.z,1);
 assert.equal(boundaryStrength({x:0,z:0}),0);assert.equal(boundaryStrength({x:WORLD.hardBoundary,z:0}),1);
 const corner=field.move({x:112*WORLD.scale,z:112*WORLD.scale},50,50);assert.ok(corner.x<=WORLD.hardBoundary&&corner.z<=WORLD.hardBoundary);
});

test('rare exploration hooks are seeded, optional and independent of visitation order',()=>{
 let events=0,eligible=0;const kinds=new Set<string>();
 for(let seed=1;seed<=500;seed++)for(const poi of createPOIs(seed)){
  const before=structuredClone(poi),event=rareEventFor(seed,poi);
  assert.deepEqual(rareEventFor(seed,poi),event);assert.deepEqual(poi,before);
  if(poi.kind==='elite'){assert.equal(event,null);continue;}
  eligible++;if(event){events++;kinds.add(event.kind);}
 }
 assert.ok(events/eligible>.03&&events/eligible<.14,`Observed optional site event rate: ${events}/${eligible}`);
 assert.deepEqual(kinds,new Set(['cache-ambush','wild-bloom','ancient-echo']));
});
