import test from 'node:test';
import assert from 'node:assert/strict';
import {MultiMaterial,NullEngine,Scene,StandardMaterial,VertexBuffer} from '@babylonjs/core';
import {SHRINE_SPECIES} from '../src/data/shrines.ts';
import {createShrineStatue} from '../src/game/render/ShrineStatues.ts';
import {ShrineSculptor} from '../src/game/render/shrineSculpting.ts';

test('all shrine species have solid stone sculptures with distinct geometry and a shared height',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),stone=new StandardMaterial('stone',scene),carving=new StandardMaterial('carving',scene);
 try{
  const shapes=new Set<string>();
  for(const speciesId of new Set(SHRINE_SPECIES.flat())){
   const statue=createShrineStatue(scene,speciesId,stone,carving);statue.computeWorldMatrix(true);
   const bounds=statue.getBoundingInfo().boundingBox;
   assert.equal(statue.metadata.speciesId,speciesId);assert.equal(statue.metadata.stone,true);
   assert.ok(statue.getTotalVertices()>100);assert.ok(Math.abs(bounds.maximumWorld.y-bounds.minimumWorld.y-3.8)<.001);
   assert.ok(Math.abs(bounds.minimumWorld.y-.65)<.001,'All sculptures stand on the plinth');
   assert.ok(statue.getTotalIndices()/3<=5000,'Each cached source stays below 5,000 triangles');
   assert.equal(scene.meshes.length,shapes.size+1,'Temporary sculpting parts are merged and disposed');
   assert.equal(statue.isPickable,false);
   assert.ok(statue.material instanceof MultiMaterial);
   assert.equal(statue.subMeshes.length,2,'Each shrine sculpture uses only two draw calls');
   assert.deepEqual(new Set(statue.material.subMaterials),new Set([stone,carving]));
   const clone=statue.clone('another shrine')!;
   assert.equal(clone.geometry,statue.geometry,'Additional shrines share source geometry');clone.dispose();
   assert.equal(statue.isDisposed(),false,'Removing a site preserves its reusable species source');
   shapes.add(`${statue.getTotalVertices()}/${bounds.extendSize.x}/${bounds.extendSize.z}`);
  }
  assert.ok(shapes.size>=21,'Added species have distinct stone silhouettes');
 }finally{scene.dispose();engine.dispose();}
});

test('beveled stone reliefs have outward front, back and edge normals for either outline winding',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),stone=new StandardMaterial('stone',scene);
 try{
  for(const reverse of [false,true]){
   const outline:[number,number][]=[[-1,-1],[1,-1],[1,1],[-1,1]];if(reverse)outline.reverse();
   const sculptor=new ShrineSculptor(scene,stone,stone),mesh=sculptor.plate(outline,0,.2);
   const positions=mesh.getVerticesData(VertexBuffer.PositionKind)!,normals=mesh.getVerticesData(VertexBuffer.NormalKind)!;
   let fronts=0,backs=0,bevels=0;
   for(let i=0;i<positions.length;i+=9){
    const x=(positions[i]+positions[i+3]+positions[i+6])/3,y=(positions[i+1]+positions[i+4]+positions[i+7])/3,z=(positions[i+2]+positions[i+5]+positions[i+8])/3;
    const dot=x*normals[i]+y*normals[i+1]+z*normals[i+2];
    assert.ok(dot>0,'Every stone face points outward instead of being culled from outside');
    if(normals[i+2]>.99)fronts++;else if(normals[i+2]<-.99)backs++;else bevels++;
   }
   assert.equal(fronts,2);assert.equal(backs,2);assert.equal(bevels,16);mesh.dispose();
  }
 }finally{scene.dispose();engine.dispose();}
});
