import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix,Mesh,NullEngine,Scene,StandardMaterial,Vector3,VertexBuffer} from '@babylonjs/core';
import {terrainOrientation} from '../src/game/render/terrainOrientation.ts';
import {World} from '../src/game/render/World.ts';
import {MAP_DEFINITIONS} from '../src/data/maps.ts';
import {createEnvironment,createPOIs} from '../src/game/systems/environment.ts';
import {createBerryTrees} from '../src/game/systems/berries.ts';
import {createSurfaceDetails} from '../src/game/systems/surfaceDetails.ts';

test('static decoration follows the actual slope normal independently of its seeded yaw',()=>{
 for(const [dx,dz] of [[0,0],[.35,-.22],[-.3,.4],[.65,.55]])for(const yaw of [0,.7,2.4,4.9]){
  const ground=(x:number,z:number)=>dx*x+dz*z;
  const rotation=terrainOrientation(7,-3,yaw,ground),matrix=Matrix.Compose(Vector3.One(),rotation,Vector3.Zero());
  const up=Vector3.TransformNormal(Vector3.Up(),matrix).normalize(),expected=new Vector3(-dx,1,-dz).normalize();
  assert.ok(Vector3.Dot(up,expected)>.999999,'a random yaw tipped the decoration away from the ground');
  assert.ok(rotation.asArray().every(Number.isFinite));
 }
});

test('world asset templates meet primitive budgets, light both sides of plants, and keep cut wood readable',()=>{
 const engine=new NullEngine(),scene=new Scene(engine);void scene.defaultMaterial;
 const resources=()=>[scene.meshes.length,scene.geometries.length,scene.materials.length,scene.lights.length,scene.transformNodes.length];
 const baseline=resources();
 try{
  for(const map of Object.values(MAP_DEFINITIONS)){
   const seed=map.seed??4,pois=createPOIs(seed,map.id),layout=createEnvironment(seed,pois,map.id),berries=createBerryTrees(layout.props,seed),world=new World(scene,seed,pois,map.id,berries);
   try{
    for(const [name,budget] of [['bush',80],['berry leaf source',20],['cone crown',20],['round crown source',20],['low-poly rock',20]] as const){
     const mesh=scene.getMeshByName(name)!;assert.ok(mesh);assert.ok(mesh.getTotalIndices()/3<=budget,`${map.id}/${name}: primitive exceeded its face budget`);
    }
    const details=createSurfaceDetails(seed,world.profile,pois,layout,berries);
    const expectedUp=(x:number,z:number)=>new Vector3(world.height(x-.2,z)-world.height(x+.2,z),.4,world.height(x,z-.2)-world.height(x,z+.2)).normalize();
    for(const mesh of scene.meshes.filter((m):m is Mesh=>m instanceof Mesh&&m.name.startsWith('ground-detail-'))){
     const material=mesh.material as StandardMaterial;
     assert.equal(material.alpha,1);assert.equal(material.backFaceCulling,false);assert.equal(material.twoSidedLighting,true);
     assert.ok(mesh.getTotalVertices()<400);
     const placements=details.filter(detail=>`ground-detail-${detail.kind}`===mesh.name),matrices=mesh.thinInstanceGetWorldMatrices();
     assert.equal(matrices.length,placements.length);
     for(const [index,detail] of placements.entries()){
      const up=Vector3.TransformNormal(Vector3.Up(),matrices[index]).normalize();
      assert.ok(Vector3.Dot(up,expectedUp(detail.x,detail.z))>.9995,`${map.id}/${detail.kind}: base remains horizontal on a slope`);
     }
     if(mesh.name==='ground-detail-stump'){
      const colors=mesh.getVerticesData(VertexBuffer.ColorKind)!,normals=mesh.getVerticesData(VertexBuffer.NormalKind)!;
      const values={top:[] as number[],side:[] as number[]};
      for(let i=0;i<mesh.getTotalVertices();i++)if(normals[i*3+1]>=0){
       values[normals[i*3+1]>.5?'top':'side'].push(colors[i*4]+colors[i*4+1]+colors[i*4+2]);
      }
      assert.ok(Math.min(...values.top)>Math.max(...values.side),'cut top merges with the bark');
     }
    }
    for(const mesh of scene.meshes.filter(m=>m.metadata?.landmarkDressing&&(m.name.includes('-paver-')||m.name.includes('-plant-')))){
     mesh.computeWorldMatrix(true);const p=mesh.getAbsolutePosition(),up=Vector3.TransformNormal(Vector3.Up(),mesh.getWorldMatrix()).normalize();
     assert.ok(Vector3.Dot(up,expectedUp(p.x,p.z))>.9995,`${map.id}: a dressing base ignores the surface slope`);
    }
    const initial=resources();for(let frame=0;frame<60;frame++)world.update(1/60,pois,frame/60,layout.features,berries);assert.deepEqual(resources(),initial);
   }finally{world.dispose();}
   assert.deepEqual(resources(),baseline);
  }
 }finally{scene.dispose();engine.dispose();}
});
