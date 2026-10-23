import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,NullEngine,Scene,StandardMaterial,VertexBuffer} from '@babylonjs/core';
import {styleLakeSurface} from '../src/game/render/lakeSurface.ts';
import {createShrinePlinth} from '../src/game/render/ShrinePlinth.ts';

test('painted water keeps an upward, closed surface within the authoritative lake circle',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),mesh=new Mesh('lake',scene),radius=28.125;
 try{
  styleLakeSurface(mesh,radius,'#5e9eaa');
  const p=mesh.getVerticesData(VertexBuffer.PositionKind)!,indices=mesh.getIndices()!,colors=mesh.getVerticesData(VertexBuffer.ColorKind)!;
  assert.ok(mesh.getTotalIndices()/3<1100,'lake should remain a single modest surface');
  for(let i=0;i<p.length;i+=3){assert.ok(Math.hypot(p[i],p[i+1])<=radius+.00001);assert.equal(p[i+2],0);}
  for(let i=0;i<indices.length;i+=3){
   const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
   const cross=(p[b]-p[a])*(p[c+1]-p[a+1])-(p[b+1]-p[a+1])*(p[c]-p[a]);
   // Babylon's default left-handed front winding uses the opposite normal
   // from the right-handed 2D cross product here.
   assert.ok(cross>0,'every triangle must face up after the disc rotates into world space');
  }
  const edges=new Map<string,number>();
  for(let i=0;i<indices.length;i+=3)for(let side=0;side<3;side++){
   const a=indices[i+side],b=indices[i+(side+1)%3],key=a<b?`${a}/${b}`:`${b}/${a}`;edges.set(key,(edges.get(key)??0)+1);
  }
  for(const [key,count] of edges){
   assert.ok(count===1||count===2);if(count===1)for(const id of key.split('/').map(Number))assert.ok(Math.abs(Math.hypot(p[id*3],p[id*3+1])-radius)<.00001,'only shoreline edges may be open');
  }
  assert.ok(colors.every(value=>Number.isFinite(value)&&value>=0&&value<=1));
  assert.equal(mesh.hasVertexAlpha,false);
 }finally{scene.dispose();engine.dispose();}
});

test('carved shrine pedestal retains the seat height and shares one opaque stone material',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),stone=new StandardMaterial('stone',scene);
 try{
  const mesh=createShrinePlinth(scene,stone);mesh.position.y=.325;mesh.computeWorldMatrix(true);
  const bounds=mesh.getBoundingInfo().boundingBox;
  assert.ok(Math.abs(bounds.minimumWorld.y)<.00001);assert.ok(Math.abs(bounds.maximumWorld.y-.65)<.00001);
  assert.equal(mesh.material,stone);assert.equal(mesh.isPickable,false);assert.equal(mesh.checkCollisions,false);
  assert.ok(mesh.getTotalIndices()/3<900);assert.equal(scene.materials.length,1);
 }finally{scene.dispose();engine.dispose();}
});
