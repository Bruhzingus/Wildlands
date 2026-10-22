import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine,Scene,StandardMaterial} from '@babylonjs/core';
import {SHRINE_TIERS} from '../src/data/shrines.ts';
import {createShrineStatue} from '../src/game/render/ShrineStatues.ts';

test('all shrine species have solid stone sculptures with distinct geometry and a shared height',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),stone=new StandardMaterial('stone',scene),carving=new StandardMaterial('carving',scene);
 try{
  const shapes=new Set<string>();
  for(const definition of SHRINE_TIERS){
   const statue=createShrineStatue(scene,definition.speciesId,stone,carving);statue.computeWorldMatrix(true);
   const bounds=statue.getBoundingInfo().boundingBox;
   assert.equal(statue.metadata.speciesId,definition.speciesId);assert.equal(statue.metadata.stone,true);
   assert.ok(statue.getTotalVertices()>100);assert.ok(Math.abs(bounds.maximumWorld.y-bounds.minimumWorld.y-3.8)<.001);
   assert.ok(Math.abs(bounds.minimumWorld.y-.65)<.001,'All sculptures stand on the plinth');
   shapes.add(`${statue.getTotalVertices()}/${bounds.extendSize.x}/${bounds.extendSize.z}`);
  }
  assert.equal(shapes.size,15,'Each species has a different silhouette');
 }finally{scene.dispose();engine.dispose();}
});
