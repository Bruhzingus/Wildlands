import test from 'node:test';
import assert from 'node:assert/strict';
import {ImpactFeedback} from '../src/game/feedback.ts';
import {IMPACT_FEEDBACK} from '../src/data/feedback.ts';
import {Simulation,type GameEvent} from '../src/game/Simulation.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {RNG} from '../src/utils/random.ts';

const neutral={offsetX:0,offsetY:0,offsetZ:0,freeze:false,stopRemaining:0,shakeRemaining:0};

test('feedback is limited to specials and actual incoming boss damage',()=>{
 const feedback=new ImpactFeedback(),s=new Simulation(25,9).state;
 const boss=createEnemy(s,new RNG(9),150,'legendary',0,0);boss.isBoss=true;s.enemies=[boss];
 for(const event of [
  {kind:'attack',sourceId:boss.uid},{kind:'boss',sourceId:boss.uid},
  {kind:'hit',damageTo:'enemy',targetId:boss.uid,amount:40,shape:'crit'},
  {kind:'hit',damageTo:'player',amount:20},
  {kind:'hit',damageTo:'player',amount:0,sourceId:boss.uid},
  {kind:'hit',damageTo:'player',amount:NaN,sourceId:boss.uid},
  {kind:'hit',damageTo:'player',amount:10,sourceId:-1},
 ] as GameEvent[])assert.equal(feedback.onEvent(event,s),false);
 assert.deepEqual(feedback.inspect(),neutral);
 assert.equal(feedback.onEvent({kind:'hit',damageTo:'companion',amount:10,sourceId:boss.uid},s),true);
 assert.equal(feedback.inspect().stopRemaining,IMPACT_FEEDBACK.boss.stopSeconds);
 feedback.reset();assert.equal(feedback.onEvent({kind:'special'}),true);
 assert.equal(feedback.inspect().stopRemaining,IMPACT_FEEDBACK.special.stopSeconds);
});

test('camera displacement stays bounded, decays to zero, and stop expires in real time',()=>{
 const feedback=new ImpactFeedback();feedback.trigger('boss');
 let peak=0,frozen=0;
 for(let i=0;i<240;i++){
  const frame=feedback.step(1/1000,true),offset=Math.hypot(frame.offsetX,frame.offsetY,frame.offsetZ);
  assert.ok(offset<=IMPACT_FEEDBACK.maxOffset);peak=Math.max(peak,offset);
  if(frame.freeze)frozen++;
 }
 assert.ok(peak>.02);assert.ok(frozen>=39&&frozen<=41,`${frozen} frozen milliseconds`);
 assert.deepEqual(feedback.inspect(),neutral);
 feedback.trigger('boss');const longFrame=feedback.step(1,true);
 assert.equal(longFrame.freeze,true,'A long frame beginning in stop still presents one stopped frame');
 assert.equal(longFrame.stopRemaining,0);assert.equal(feedback.step(.016,true).freeze,false);
});

test('duplicate events and a multi-target burst cannot extend a stop or shake',()=>{
 const feedback=new ImpactFeedback(),special:GameEvent={kind:'special'};
 assert.equal(feedback.onEvent(special),true);feedback.step(.012,true);
 const before=feedback.inspect();
 for(let i=0;i<20;i++)assert.equal(feedback.onEvent({kind:'special'}),false);
 assert.equal(feedback.trigger('boss'),false,'A boss impact in the same burst also shares the cooldown');
 assert.deepEqual(feedback.inspect(),before);
 feedback.step(.3,true);assert.equal(feedback.onEvent(special),false,'The same event object cannot play again later');
 assert.equal(feedback.onEvent({kind:'special'}),true,'A later distinct activation may play');
});

test('pause clears residue and resumes without delayed feedback',()=>{
 const feedback=new ImpactFeedback();feedback.trigger('special');feedback.step(.01,true);
 assert.deepEqual(feedback.step(20,false),neutral);assert.deepEqual(feedback.step(.01,true),neutral);
 assert.equal(feedback.trigger('boss'),true,'A fresh real impact after resume remains responsive');
 feedback.reset();assert.deepEqual(feedback.inspect(),neutral);
});

test('settings independently suppress shake and stop, including changes during an impact',()=>{
 const feedback=new ImpactFeedback({screenShake:false});feedback.trigger('special');
 let frame=feedback.step(.01,true);
 assert.equal(frame.freeze,true);assert.equal(frame.offsetX,0);assert.equal(frame.offsetY,0);assert.equal(frame.offsetZ,0);
 feedback.reset();feedback.setSettings({screenShake:true,hitStop:false});feedback.trigger('boss');frame=feedback.step(.01,true);
 assert.equal(frame.freeze,false);assert.ok(Math.hypot(frame.offsetX,frame.offsetY,frame.offsetZ)>0);
 feedback.setSettings({screenShake:false});assert.deepEqual(feedback.inspect(),neutral);
 assert.equal(feedback.trigger('special'),false);
 feedback.setSettings({screenShake:true,hitStop:true});feedback.trigger('special');
 feedback.setSettings({hitStop:false});assert.equal(feedback.inspect().freeze,false);
});

test('system reduced motion overrides saved settings immediately without buffered effects',()=>{
 const feedback=new ImpactFeedback({screenShake:true,hitStop:true},true);
 assert.equal(feedback.trigger('special'),false);assert.deepEqual(feedback.step(.01,true),neutral);
 feedback.setReducedMotion(false);feedback.trigger('boss');feedback.step(.01,true);
 feedback.setReducedMotion(true);assert.deepEqual(feedback.inspect(),neutral);
 feedback.setReducedMotion(false);assert.deepEqual(feedback.step(.01,true),neutral);
 assert.equal(feedback.trigger('special'),true);
});

test('feedback is deterministic and cannot mutate the run, seeded RNG or returned snapshot',()=>{
 const s=new Simulation(25,31).state,before=JSON.stringify(s),one=new ImpactFeedback(),two=new ImpactFeedback();
 const event:GameEvent={kind:'special',x:2,z:4};one.onEvent(event,s);two.onEvent(event,s);
 const originalRandom=Math.random;Math.random=()=>{throw new Error('Feedback must not consume randomness');};
 try{for(const dt of [.005,.01,.02,.014,.03,.05,.4]){
  const a=one.step(dt,true),b=two.step(dt,true);assert.deepEqual(a,b);
  a.stopRemaining=100;a.offsetX=100;assert.deepEqual(one.inspect(),two.inspect());
 }}finally{Math.random=originalRandom;}
 assert.equal(JSON.stringify(s),before);assert.deepEqual(event,{kind:'special',x:2,z:4});
});
