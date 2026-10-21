import test from 'node:test';
import assert from 'node:assert/strict';
import {Locomotion,locomotionDirection} from '../src/game/render/locomotion.ts';
import {LOCOMOTION} from '../src/data/locomotion.ts';
import {spriteDirection} from '../src/game/render/animation.ts';

test('walk cadence follows actual travel equally at different render rates',()=>{
 for(const fps of [20,60,144])for(const fraction of [.06,.35,1]){
  const motion=new Locomotion();motion.update(0,0,Math.PI,0);
  for(let i=1;i<=fps;i++)motion.update(i/fps*LOCOMOTION.referenceSpeed*fraction,0,Math.PI,1/fps);
  assert.ok(motion.moving);assert.ok(Math.abs(motion.rate-fraction)<1e-6);
  assert.equal(motion.facing,Math.PI/2,'Visual heading follows travel rather than the formation heading');
 }
});
test('slow starts and stop noise do not flicker between rest and walking',()=>{
 const motion=new Locomotion();motion.update(0,0,0,0);
 motion.update(.0001,0,0,.02);assert.equal(motion.moving,false);
 motion.update(.02,0,0,.02);assert.equal(motion.moving,true);
 // One zero-distance render between simulation steps must not reset a walk.
 motion.update(.02,0,0,.02);assert.equal(motion.moving,true);
 motion.update(.04,0,0,.02);assert.equal(motion.moving,true);
 for(let i=0;i<6;i++)motion.update(.04,0,0,.02);
 assert.equal(motion.moving,false);
 for(let i=0;i<20;i++)motion.update(.04+(i%2)*.0001,0,0,.02);
 assert.equal(motion.moving,false);assert.ok(motion.rate<.001);
});
test('pause and sheet callbacks leave playback unchanged and teleports do not become a stride',()=>{
 const motion=new Locomotion();motion.update(0,0,0,0);motion.update(.15,0,0,.02);
 const snapshot={...motion};
 for(let i=0;i<20;i++)motion.update(.15,0,Math.PI,0);
 assert.deepEqual({...motion},snapshot);
 motion.update(50,50,Math.PI,.02);assert.equal(motion.moving,false);assert.equal(motion.rate,0);
 motion.update(50,50,Math.PI,.02);assert.equal(motion.speed,0);
});
test('direction reversals follow travel immediately and camera-relative rows have a deadband',()=>{
 const motion=new Locomotion();motion.update(0,0,0,0);
 motion.update(.1,0,0,.02);assert.equal(motion.facing,Math.PI/2);
 motion.update(0,0,0,.02);assert.equal(motion.facing,-Math.PI/2);
 let row=0;
 for(const jitter of [-.01,.01,-.02,.02])row=locomotionDirection(Math.PI,Math.PI/8+jitter,row);
 assert.equal(row,0);
 assert.equal(locomotionDirection(Math.PI,Math.PI/8+.06,row),1);
 for(let i=0;i<8;i++)assert.equal(locomotionDirection(Math.PI,i*Math.PI/4,(i+7)%8),spriteDirection(Math.PI,i*Math.PI/4));
});
