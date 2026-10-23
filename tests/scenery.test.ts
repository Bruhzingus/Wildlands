import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP_DEFINITIONS,worldProfile} from '../src/data/maps.ts';
import {ROCK_SCALES,WORLD} from '../src/data/world.ts';
import {createEnvironment,createPOIs,explorationRoute,terrainHeight} from '../src/game/systems/environment.ts';
import {createSurfaceDetails} from '../src/game/systems/surfaceDetails.ts';
import {createBerryTrees} from '../src/game/systems/berries.ts';
import {NullEngine,Scene,Ray,Vector3} from '@babylonjs/core';
import {World} from '../src/game/render/World.ts';
import {GROUND_DETAIL_VARIANTS} from '../src/game/render/groundDetails.ts';
import {createStoneMesh,createStoneOutcrop} from '../src/game/render/stoneFormations.ts';
import {VertexBuffer} from '@babylonjs/core';

test('stone groups use three shared sizes with matching proxies and leave routes, features and opening spawns clear',()=>{
 const sizes=new Set<number>();
 for(const map of Object.values(MAP_DEFINITIONS))for(const seed of [4,301,808]){
  const pois=createPOIs(seed,map.id),profile=worldProfile(seed,map.id),layout=createEnvironment(seed,pois,map.id),rocks=layout.props.filter(p=>p.rockCluster!==undefined);
  assert.deepEqual(layout,createEnvironment(seed,pois,map.id));assert.ok(layout.props.length<=WORLD.maxProps);
  const clusters=new Set(rocks.map(p=>p.rockCluster));
  assert.ok(clusters.size>0&&clusters.size<=map.rocks.clusters);
  for(const cluster of clusters){const count=rocks.filter(p=>p.rockCluster===cluster).length;assert.ok(count>=map.rocks.minGroup&&count<=map.rocks.maxGroup);}
  for(const rock of rocks){
   sizes.add(rock.scale);assert.ok(Object.values(ROCK_SCALES).includes(rock.scale as typeof ROCK_SCALES.small));
   const radius=1.25*rock.scale,collider=layout.obstacles.find(o=>o.x===rock.x&&o.z===rock.z);
   assert.ok(collider?.kind==='circle');assert.equal(collider.radius,radius);
   assert.ok(Math.hypot(rock.x,rock.z)>=36+radius,'opening enemy ring remains free of new rocks');
   assert.ok(pois.every(p=>Math.hypot(rock.x-p.x,rock.z-p.z)>=WORLD.poiClearance+radius+2));
   assert.ok(layout.features.every(f=>Math.hypot(rock.x-f.x,rock.z-f.z)>=f.radius+radius+1));
   assert.ok(Math.hypot(rock.x-profile.lake.x,rock.z-profile.lake.z)>=profile.lake.shoreRadius+radius+2);
   for(const poi of pois)for(const [index,end] of explorationRoute(poi,profile).slice(1).entries()){
    const start=explorationRoute(poi,profile)[index];
    for(let t=0;t<=1;t+=.025)assert.ok(Math.hypot(rock.x-(start.x+(end.x-start.x)*t),rock.z-(start.z+(end.z-start.z)*t))>radius+WORLD.routeHalfWidth);
   }
  }
 }
 assert.deepEqual(sizes,new Set(Object.values(ROCK_SCALES)));
});

test('surface detail budgets, grounding and clearances are deterministic and leave simulation data untouched',()=>{
 for(const map of Object.values(MAP_DEFINITIONS))for(const seed of [4,808]){
  const profile=worldProfile(seed,map.id),pois=createPOIs(seed,map.id),layout=createEnvironment(seed,pois,map.id),berries=createBerryTrees(layout.props,seed),before=JSON.stringify({layout,berries,pois});
  const details=createSurfaceDetails(seed,profile,pois,layout,berries);
  assert.deepEqual(details,createSurfaceDetails(seed,profile,pois,layout,berries));assert.equal(JSON.stringify({layout,berries,pois}),before);
  for(const [kind,budget] of Object.entries({tuft:map.surfaceDetails.tufts,flower:map.surfaceDetails.flowers,mushroom:map.surfaceDetails.mushrooms,stump:map.surfaceDetails.stumps,chip:map.surfaceDetails.chips})){
   const count=details.filter(p=>p.kind===kind).length;
   assert.ok(count<=budget);if(budget)assert.ok(count>0,`${map.id}: ${kind} is absent`);
  }
  for(const detail of details){
   assert.ok(Math.abs(detail.y-(terrainHeight(detail.x,detail.z,profile)-.025))<1e-9);
   assert.ok(Math.hypot(detail.x,detail.z)>WORLD.safeSpawnRadius+3);
   assert.ok(pois.every(p=>Math.hypot(detail.x-p.x,detail.z-p.z)>WORLD.poiClearance+2));
   assert.ok(layout.obstacles.every(o=>Math.hypot(detail.x-o.x,detail.z-o.z)>(o.kind==='circle'?o.radius:Math.hypot(o.halfWidth,o.halfDepth))+.6));
   assert.ok(layout.features.every(f=>Math.hypot(detail.x-f.x,detail.z-f.z)>f.radius+.6));
  }
  if(map.id==='volcanic-ridge')assert.ok(details.every(detail=>detail.kind==='chip'));
  if(map.id!=='pinewood-route')assert.ok(details.every(detail=>detail.kind!=='mushroom'&&detail.kind!=='stump'));
 }
});

test('details share geometry, never intercept picking, respect quality and dispose without growth',()=>{
 const engine=new NullEngine(),scene=new Scene(engine);void scene.defaultMaterial;
 const resources=()=>[scene.meshes.length,scene.materials.length,scene.geometries.length,scene.lights.length,scene.transformNodes.length];
 const empty=resources();
 try{
  for(const map of Object.values(MAP_DEFINITIONS)){
   const seed=map.seed??4,pois=createPOIs(seed,map.id),layout=createEnvironment(seed,pois,map.id),berries=createBerryTrees(layout.props,seed);
   const world=new World(scene,seed,pois,map.id,berries);
   try{
    const batches=scene.meshes.filter(mesh=>mesh.name.startsWith('ground-detail-'));
    assert.ok(batches.length>0&&batches.length<=5*GROUND_DETAIL_VARIANTS);
    assert.equal(new Set(batches.map(mesh=>mesh.material)).size,1,'all variants share one opaque material');
    const details=createSurfaceDetails(seed,world.profile,pois,layout,berries);
    assert.equal(batches.reduce((sum,mesh)=>sum+mesh.thinInstanceCount,0),details.length,'variants preserve placement budgets');
    for(const kind of new Set(details.map(detail=>detail.kind))){
     const variants=batches.filter(mesh=>mesh.metadata.surfaceDetail===kind);
     assert.ok(variants.length>=2&&variants.length<=GROUND_DETAIL_VARIANTS,`${kind}: expected distinct shared templates`);
     assert.ok(new Set(variants.map(mesh=>JSON.stringify(mesh.getVerticesData(VertexBuffer.PositionKind)))).size>=2);
    }
    assert.equal(scene.getMeshByName('ruin block'),null);
    for(const mesh of batches){
     assert.equal(mesh.isPickable,false);assert.equal(mesh.checkCollisions,false);assert.equal(mesh.receiveShadows,false);
     assert.ok(mesh.getTotalVertices()<512,`${mesh.name}: template exceeds the low-poly budget`);assert.equal(mesh.material?.alpha,1);
    }
    const initial=resources();world.setGroundDetailsVisible(false);assert.ok(batches.every(mesh=>!mesh.isEnabled()));
    world.setQuality('low');world.setGroundDetailsVisible(true);assert.ok(batches.every(mesh=>!mesh.isEnabled()));
    world.setQuality('high');assert.ok(batches.every(mesh=>mesh.isEnabled()));
    for(const mesh of batches){
     const center=mesh.getBoundingInfo().boundingBox.centerWorld;
     const pick=scene.pickWithRay(new Ray(new Vector3(center.x,100,center.z),new Vector3(0,-1,0)));
     assert.ok(!pick?.pickedMesh?.name.startsWith('ground-detail-'));
    }
    for(let i=0;i<60;i++)world.update(1/60,pois,i/60,layout.features,berries);
    assert.deepEqual(resources(),initial);
   }finally{world.dispose();}
   assert.deepEqual(resources(),empty,`${map.id}: scenery leaked on unload`);
  }
 }finally{scene.dispose();engine.dispose();}
});

test('fractured stone templates have outward facets and stay inside existing collision footprints',()=>{
 const engine=new NullEngine(),scene=new Scene(engine);
 try{
  for(let variant=0;variant<4;variant++){
   const mesh=createStoneMesh(scene,'test boulder',0x6291+variant*173,2.4,2.15,2.1,'#ffffff',1.24);
   const positions=mesh.getVerticesData(VertexBuffer.PositionKind)!,normals=mesh.getVerticesData(VertexBuffer.NormalKind)!;
   for(let i=0;i<positions.length;i+=3){
    assert.ok(Math.hypot(positions[i],positions[i+2])<=1.240001);
    assert.ok(positions[i+1]>=0&&positions[i+1]<=2.150001);
    assert.ok(Number.isFinite(normals[i]+normals[i+1]+normals[i+2]));
    if(positions[i+1]>2.14)assert.ok(normals[i+1]>0,'the crown is lit from above');
   }
   assert.ok(mesh.getTotalVertices()<150);mesh.dispose();
  }
  for(let variant=0;variant<3;variant++){
   const mesh=createStoneOutcrop(scene,'test outcrop',variant),positions=mesh.getVerticesData(VertexBuffer.PositionKind)!;
   for(let i=0;i<positions.length;i+=3){
    assert.ok(Math.abs(positions[i])<=1.200001);assert.ok(Math.abs(positions[i+2])<=.900001);
    assert.ok(positions[i+1]>=0&&positions[i+1]<=2.200001);
   }
   assert.ok(mesh.getTotalVertices()<300);mesh.dispose();
  }
 }finally{scene.dispose();engine.dispose();}
});
