import test from 'node:test';
import assert from 'node:assert/strict';
import {animationFrame,oneShotFrame,attackPose,attackStyle,specialAttackStyle,enemyAttackStyle,parseAnimationMetadata,spriteDirection,validateAtlas,measureAtlas,type AttackStyle} from '../src/game/render/animation.ts';
import type {SpecialKind} from '../src/data/specials.ts';
const xml=`<AnimData><Anims><Anim><Name>Walk</Name><FrameWidth>24</FrameWidth><FrameHeight>32</FrameHeight><Durations><Duration>30</Duration><Duration>3</Duration><Duration>6</Duration></Durations></Anim><Anim><Name>Idle</Name><CopyOf>Walk</CopyOf></Anim><Anim><Name>Attack</Name><CopyOf>Idle</CopyOf></Anim></Anims></AnimData>`;
test('SpriteCollab aliases share the original sheet, dimensions and unequal durations',()=>{
 const meta=parseAnimationMetadata(xml);assert.equal(meta.Idle,meta.Walk);assert.equal(meta.Attack.name,'Walk');assert.deepEqual(meta.Walk.durations,[30,3,6]);
});
test('invalid metadata and cyclic animation aliases cannot create invisible atlas cells',()=>{
 assert.throws(()=>parseAnimationMetadata('bad html'));
 assert.deepEqual(parseAnimationMetadata('<AnimData><Anim><Name>Idle</Name><CopyOf>Walk</CopyOf></Anim><Anim><Name>Walk</Name><CopyOf>Idle</CopyOf></Anim></AnimData>'),{});
 assert.deepEqual(parseAnimationMetadata(xml.replace('<Duration>30</Duration>','<Duration>0</Duration>')),{});
});
test('frame timing uses 60 Hz source durations rather than a fixed animation FPS',()=>{
 const d=[30,3,6];assert.equal(animationFrame(d,0),0);assert.equal(animationFrame(d,.49),0);assert.equal(animationFrame(d,.5),1);assert.equal(animationFrame(d,.55),2);assert.equal(animationFrame(d,.65),0);
 assert.equal(animationFrame(d,-4),0);assert.equal(animationFrame([],4),0);
});

test('one-shot attacks preserve unequal frame holds and clamp instead of looping',()=>{
 const holds=[6,3,3];
 assert.equal(oneShotFrame(holds,-1),0);assert.equal(oneShotFrame(holds,0),0);
 assert.equal(oneShotFrame(holds,.49),0);assert.equal(oneShotFrame(holds,.5),1);
 assert.equal(oneShotFrame(holds,.75),2);assert.equal(oneShotFrame(holds,1),2);
 assert.equal(oneShotFrame(holds,8),2);assert.equal(oneShotFrame([],1),0);
 // Receiving an atlas late joins the current swing rather than replaying frame 0.
 assert.equal(oneShotFrame(holds,.8),2);
});

test('attack styles distinguish forward melee, ranged recoil and casting lift',()=>{
 assert.equal(attackStyle('slash'),'melee');
 for(const kind of ['bolt','beam','lob'] as const)assert.equal(attackStyle(kind),'ranged');
 for(const kind of ['burst','aura','chain','heal'] as const)assert.equal(attackStyle(kind),'pulse');
 const melee=attackPose(.42,'melee'),ranged=attackPose(.42,'ranged'),pulse=attackPose(.42,'pulse');
 assert.ok(melee.forward>0&&ranged.forward<0);
 assert.ok(pulse.lift>melee.lift&&pulse.lift>ranged.lift);
});

test('special body motion follows fields, shots, charges, heavy strikes and squad healing',()=>{
 const expected:Record<SpecialKind,AttackStyle>={
  garden:'pulse',flamethrower:'ranged',surf:'ranged',thunder:'pulse',quickstep:'quick',web:'ranged',
  whirlwind:'ranged',fissure:'heavy',foxfire:'pulse',sleep:'pulse',payday:'ranged',charge:'quick',
  teleport:'ranged',flurry:'heavy','fury-swipes':'melee',curse:'pulse',lance:'ranged',volley:'ranged',mend:'heal',
 };
 const neutral={forward:0,lift:0,scaleX:1,scaleY:1,lean:0};
 for(const [kind,style] of Object.entries(expected) as [SpecialKind,AttackStyle][]){
  assert.equal(specialAttackStyle(kind),style,kind);
  assert.deepEqual(attackPose(0,style),neutral);assert.deepEqual(attackPose(1,style),neutral);
  for(let tick=0;tick<=100;tick++){
   const pose=attackPose(tick/100,style);
   assert.ok(Object.values(pose).every(Number.isFinite),kind);
   assert.ok(Math.abs(pose.forward)<=.33&&pose.lift>=0&&pose.lift<=.19,kind);
   assert.ok(pose.scaleX>=.9&&pose.scaleX<=1.1&&pose.scaleY>=.9&&pose.scaleY<=1.14,kind);
   assert.ok(Math.abs(pose.lean)<=.1,kind);
  }
 }
 assert.ok(attackPose(.42,specialAttackStyle('charge')).forward>0);
 assert.ok(attackPose(.42,specialAttackStyle('flamethrower')).forward<0);
 assert.ok(attackPose(.42,specialAttackStyle('mend')).lift>attackPose(.42,specialAttackStyle('garden')).lift);
});

test('attack additions return exactly to rest and remain bounded at any playback speed',()=>{
 const neutral={forward:0,lift:0,scaleX:1,scaleY:1,lean:0};
 for(const style of ['melee','ranged','pulse'] as AttackStyle[]){
  for(const progress of [-1,0,1,5,NaN])assert.deepEqual(attackPose(progress,style),neutral);
  for(let tick=0;tick<=100;tick++){
   const p=tick/100,pose=attackPose(p,style);
   assert.deepEqual(pose,attackPose(p,style),'Repeated paused rendering must not accumulate motion');
   assert.ok(Object.values(pose).every(Number.isFinite));
   assert.ok(Math.abs(pose.forward)<=.23&&pose.lift>=0&&pose.lift<=.08);
   assert.ok(pose.scaleX>=.95&&pose.scaleX<=1.05&&pose.scaleY>=.95&&pose.scaleY<=1.05);
   assert.ok(Math.abs(pose.lean)<=.06);
  }
 }
});

test('enemy windups settle at readiness without playing a second strike before release',()=>{
 for(const style of ['melee','ranged','pulse'] as AttackStyle[]){
  const ready=attackPose(.5,style,true);
  assert.deepEqual(attackPose(.9,style,true),ready);assert.deepEqual(attackPose(1,style,true),ready);
  assert.equal(ready.lift,0);assert.ok(ready.scaleY<1);
  assert.notDeepEqual(ready,attackPose(.42,style));
 }
});

test('every enemy attack role has a distinct bounded pose and returns to rest after release',()=>{
 const roles=['melee-fast','melee-slow','ranged-burst','ranged-projectile','explosive-suicide','explosive-bomb','healer'] as const;
 const styles=roles.map(enemyAttackStyle),neutral={forward:0,lift:0,scaleX:1,scaleY:1,lean:0};
 assert.equal(new Set(styles).size,roles.length);
 assert.ok(attackPose(.42,'heavy').forward>attackPose(.42,'quick').forward);
 assert.ok(attackPose(.42,'heal').lift>attackPose(.42,'lob').lift);
 assert.ok(attackPose(.5,'explosive',true).scaleY>1,'Self-Destruct swells visibly before detonation');
 for(const style of styles){
  assert.deepEqual(attackPose(0,style),neutral);assert.deepEqual(attackPose(1,style),neutral);
  const ready=attackPose(.5,style,true);assert.deepEqual(attackPose(1,style,true),ready);
  for(let tick=0;tick<=100;tick++){
   const pose=attackPose(tick/100,style);
   assert.ok(Object.values(pose).every(Number.isFinite));
   assert.ok(Math.abs(pose.forward)<=.33&&pose.lift<=.19);
   assert.ok(pose.scaleX>=.9&&pose.scaleX<=1.1&&pose.scaleY>=.9&&pose.scaleY<=1.14);
  }
 }
});

test('attack anticipation, strike and recovery join without positional discontinuities',()=>{
 for(const style of ['melee','ranged','pulse'] as AttackStyle[])for(const boundary of [.16,.42,.72]){
  const before=Object.values(attackPose(boundary-1e-6,style)),after=Object.values(attackPose(boundary+1e-6,style));
  assert.ok(before.every((value,i)=>Math.abs(value-after[i])<1e-6));
 }
});
test('camera-relative eight-way sheet rows keep right and left correct around the orbit',()=>{
 assert.equal(spriteDirection(Math.PI,0),0);assert.equal(spriteDirection(Math.PI/2,0),2);
 assert.equal(spriteDirection(0,0),4);assert.equal(spriteDirection(-Math.PI/2,0),6);
 for(let row=0;row<8;row++)for(const camera of [-Math.PI*4,-1.3,0,Math.PI*7])assert.equal(spriteDirection(camera+Math.PI-row*Math.PI/4,camera),row);
});
test('atlas indexing uses actual column stride and handles a one-direction sheet',()=>{
 const meta=parseAnimationMetadata(xml).Walk;
 assert.deepEqual(validateAtlas(meta,96,256),{columns:4,rows:8});
 assert.deepEqual(validateAtlas(meta,72,32),{columns:3,rows:1});
 assert.throws(()=>validateAtlas(meta,48,256));assert.throws(()=>validateAtlas(meta,73,256));assert.throws(()=>validateAtlas(meta,72,64));
});
test('transparent padding does not shrink bodies and resting anchors stay stable over frame motion',()=>{
 const meta={name:'Idle',width:4,height:8,durations:[6,6]},pixels=new Uint8ClampedArray(8*8*4);
 for(const [x,y] of [[1,2],[1,5],[5,3],[5,6]])pixels[(y*8+x)*4+3]=255;
 assert.deepEqual(measureAtlas(meta,8,8,pixels),{visibleHeight:4,bottoms:[3],tops:[2]});
 assert.throws(()=>measureAtlas(meta,8,8,new Uint8ClampedArray(8*8*4)),/Empty/);
});
