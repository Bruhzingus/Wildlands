import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraAimDirection,cameraRelativeMovement,mouseLook} from '../src/game/input.ts';

test('WASD follows the camera with A on the left and D on the right',()=>{
 for(const alpha of [-Math.PI/2,0,Math.PI/2,Math.PI,Math.PI*1.73]){
  const w=cameraRelativeMovement(alpha,1,0),s=cameraRelativeMovement(alpha,-1,0);
  const a=cameraRelativeMovement(alpha,0,-1),d=cameraRelativeMovement(alpha,0,1);
  assert.ok(Math.abs(w.mx+s.mx)<1e-12&&Math.abs(w.mz+s.mz)<1e-12);
  assert.ok(Math.abs(a.mx+d.mx)<1e-12&&Math.abs(a.mz+d.mz)<1e-12);
  assert.ok(Math.abs(w.mx*d.mx+w.mz*d.mz)<1e-12);
  assert.ok(w.mz*d.mx-w.mx*d.mz>.999999);
 }
 assert.ok(cameraRelativeMovement(-Math.PI/2,0,1).mx>.999999);
 assert.ok(cameraRelativeMovement(-Math.PI/2,0,-1).mx<-.999999);
});

test('diagonal input has the same speed as cardinal movement',()=>{
 for(const alpha of [0,1,2,3]){
  const diagonal=cameraRelativeMovement(alpha,1,1);
  assert.ok(Math.abs(Math.hypot(diagonal.mx,diagonal.mz)-1)<1e-12);
 }
 assert.deepEqual(cameraRelativeMovement(0,0,0),{mx:0,mz:0});
});

test('FPS mouse look has natural pitch, invert-Y and consistent sensitivity',()=>{
 const right=mouseLook(-Math.PI/2,1,100,0,1,false);
 assert.ok(cameraRelativeMovement(right.alpha,1,0).mx>0,'Moving mouse right turns movement forward to the right');
 assert.ok(mouseLook(0,1,0,-50,1,false).beta>1,'Moving mouse up flattens the view toward the horizon');
 assert.ok(mouseLook(0,1,0,50,1,false).beta<1,'Moving mouse down looks toward the ground');
 assert.ok(mouseLook(0,1,0,50,1,true).beta>1,'Invert-Y reverses vertical mouse look');
 assert.equal(mouseLook(0,1,100,0,2,false).alpha,2*mouseLook(0,1,100,0,1,false).alpha);
 assert.equal(mouseLook(0,1,0,-10000,1,false).beta,1.43);
 assert.equal(mouseLook(0,1,0,10000,1,false).beta,.48);
});

test('repeated long swipes keep turning across full rotations and leave movement finite',()=>{
 for(const dx of [-1200,1200]){
  let alpha=-Math.PI/2;
  for(let swipe=0;swipe<100;swipe++){
   const next=mouseLook(alpha,1,dx,0,1,false);
   assert.ok(Math.abs((next.alpha-alpha)+dx*.0025)<1e-10);
   const move=cameraRelativeMovement(next.alpha,1,0),aim=cameraAimDirection(next.alpha);
   assert.ok(Number.isFinite(move.mx)&&Number.isFinite(move.mz));
   assert.ok(Math.abs(move.mx-aim.aimX)<1e-12&&Math.abs(move.mz-aim.aimZ)<1e-12);
   alpha=next.alpha;
  }
 }
});
