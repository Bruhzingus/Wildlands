import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP_DEFINITIONS,worldProfile} from '../src/data/maps.ts';
import {NullEngine,Scene,VertexBuffer} from '@babylonjs/core';
import {Simulation} from '../src/game/Simulation.ts';
import {World} from '../src/game/render/World.ts';
import {createPOIs,terrainHeight} from '../src/game/systems/environment.ts';

test('ten world restarts release geometry, materials, landmarks and lights',()=>{
 const engine=new NullEngine(),scene=new Scene(engine);
 // Babylon owns one lazily-created default material for the lifetime of a scene.
 void scene.defaultMaterial;
 const resources=()=>({meshes:scene.meshes.length,materials:scene.materials.length,lights:scene.lights.length,transforms:scene.transformNodes.length,geometries:scene.geometries.length});
 const baseline=resources();
 try{
  for(let i=0;i<10;i++){
   const sim=new Simulation(1,100+i),world=new World(scene,sim.state.seed,sim.state.pois);
   assert.ok(scene.meshes.length>600);
   assert.equal(scene.lights.length,2);
   world.update(.02,sim.state.pois);world.dispose();
   assert.deepEqual(resources(),baseline,`World ${i+1} leaked scene resources`);
  }
 }finally{scene.dispose();engine.dispose();}
});

test('biome scenery reuses geometry and rendered ground matches the shared collision height',()=>{
 const profile=worldProfile(4),engine=new NullEngine(),scene=new Scene(engine),pois=createPOIs(4),world=new World(scene,4,pois);
 try{
  const detailBatches=scene.meshes.filter(mesh=>mesh.name.startsWith('ground-detail-')).length;
  assert.ok(scene.meshes.length>600);assert.ok(scene.geometries.length<=37+detailBatches,'Scenery, detail batches and the single dressing paver must share source geometry');
  assert.ok(scene.meshes.filter(m=>m.isAnInstance).length>600);
  assert.equal(scene.meshes.filter(m=>m.name.startsWith('great-pine-')).length,1);
  assert.equal(scene.meshes.filter(m=>m.name.startsWith('gate-pillar-')).length,2);
  const terrain=scene.getMeshByName('rolling forest terrain')!,positions=terrain.getVerticesData(VertexBuffer.PositionKind)!;
  for(let index=0;index<positions.length;index+=3*137){
   const x=positions[index],z=positions[index+2];assert.ok(Math.abs(positions[index+1]-terrainHeight(x,z,profile))<.000004);assert.equal(world.height(x,z),terrainHeight(x,z,profile));
  }
  const site=pois[0],node=scene.getTransformNodeByName(`landmark-${site.uid}`)!;
  assert.equal(node.position.y,terrainHeight(site.x,site.z,profile));assert.equal(node.isEnabled(),true);
  site.used=true;world.update(.02,pois);assert.equal(node.isEnabled(),false);
  world.dispose();assert.equal(scene.meshes.length,0);assert.equal(scene.transformNodes.length,0);assert.equal(scene.lights.length,0);
  world.dispose();
 }finally{world.dispose();scene.dispose();engine.dispose();}
});

test('every map shares seeded geography with the renderer and releases its own palette and landmark resources',()=>{
 const engine=new NullEngine(),scene=new Scene(engine);void scene.defaultMaterial;
 const baseline={meshes:scene.meshes.length,materials:scene.materials.length,lights:scene.lights.length,geometries:scene.geometries.length,transforms:scene.transformNodes.length};
 try{
  for(const map of Object.values(MAP_DEFINITIONS)){
   const seed=map.seed??42,pois=createPOIs(seed,map.id),profile=worldProfile(seed,map.id),world=new World(scene,seed,pois,map.id);
   const ground=scene.getMeshByName('rolling forest terrain')!,positions=ground.getVerticesData(VertexBuffer.PositionKind)!;
   const detailBatches=scene.meshes.filter(mesh=>mesh.name.startsWith('ground-detail-')).length;
   assert.equal(ground.getBoundingInfo().boundingBox.extendSize.x*2,287.5);assert.ok(scene.geometries.length<=37+detailBatches);
   // Babylon stores x/z/y in Float32; taller relief also amplifies x/z rounding.
   for(let i=0;i<positions.length;i+=3*137)assert.ok(Math.abs(positions[i+1]-terrainHeight(positions[i],positions[i+2],profile))<.000004);
   const future=pois.find(p=>p.availableAt===180)!,node=scene.getTransformNodeByName(`landmark-${future.uid}`)!;
   assert.equal(node.isEnabled(),false);world.update(.02,pois,180);assert.equal(node.isEnabled(),true);
   world.dispose();assert.deepEqual({meshes:scene.meshes.length,materials:scene.materials.length,lights:scene.lights.length,geometries:scene.geometries.length,transforms:scene.transformNodes.length},baseline);
  }
 }finally{scene.dispose();engine.dispose();}
});
