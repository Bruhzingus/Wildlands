import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraAimDirection,cameraRelativeMovement} from '../src/game/input.ts';
import {Simulation,type MoveInput} from '../src/game/Simulation.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {enemyInAim} from '../src/game/combat/targeting.ts';

const idle:MoveInput={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
function arena(id:number){
 const sim=new Simulation(id,194),s=sim.state;s.enemies=[];s.player.iframes=10000;s.party[0].cooldown=0;
 const foe=(x:number,z:number)=>{const e=createEnemy(s,sim.rng,19,'normal',x,z);Object.assign(e,{hp:1e6,maxHp:1e6,speed:0,stunTime:100,attackCooldown:100,hitCooldown:100});s.enemies.push(e);return e;};
 return {sim,s,foe};
}
test('camera aim agrees with forward movement across the orbit even when standing or strafing',()=>{
 for(const alpha of [-Math.PI/2,0,Math.PI/2,Math.PI,5.3]){
  const aim=cameraAimDirection(alpha),movement=cameraRelativeMovement(alpha,1,0);
  assert.ok(Math.abs(aim.aimX-movement.mx)<1e-12&&Math.abs(aim.aimZ-movement.mz)<1e-12);
  assert.ok(Math.abs(Math.hypot(aim.aimX,aim.aimZ)-1)<1e-12);
 }
});
test('leader flames automatically choose the nearest enemy independently of camera and movement',()=>{
 const {sim,s,foe}=arena(4),front=foe(0,8),rear=foe(0,-2);
 sim.update(.02,{...idle,mx:1,aimX:0,aimZ:1});
 assert.equal(s.player.facing,Math.PI/2);
 assert.equal(s.party[0].facing,Math.atan2(rear.x-s.player.x,rear.z-s.player.z));
 assert.equal(s.projectiles.length,3);assert.ok(s.projectiles.every(p=>p.vz<0&&p.targetId===rear.uid));
 s.party[0].cooldown=100;for(let i=0;i<35;i++)sim.update(.02,{...idle,aimX:0,aimZ:1});
 assert.ok(rear.hp<rear.maxHp);assert.equal(front.hp,front.maxHp);
});
test('camera rotation leaves the next normal cast on the same nearest target',()=>{
 const {sim,s,foe}=arena(4),nearest=foe(0,-6);foe(0,10);
 for(const alpha of [-Math.PI/2,0,Math.PI/2,Math.PI]){
  s.projectiles=[];s.party[0].cooldown=0;
  sim.update(.02,{...idle,...cameraAimDirection(alpha)});
  assert.equal(s.projectiles.length,3);
  assert.ok(s.projectiles.every(p=>p.vz<0&&p.targetId===nearest.uid));
  assert.ok(Math.abs(s.projectiles[0].vx)<1e-10);
 }
 s.phase='paused';const before=structuredClone(s);sim.update(.02,{...idle,aimX:-1,aimZ:0});assert.deepEqual(s,before);
});
test('normal and learned attacks remain idle without a target even when the camera supplies aim',()=>{
 for(const id of [1,4,7,63,66]){
  const {sim,s}=arena(id);
  s.party[0].learnedMoves=[{moveId:'hyper-beam',rank:1,cooldown:0}];
  let casts=0;sim.onEvent=event=>{if(event.kind==='cast')casts++;};
  for(const alpha of [-Math.PI/2,0,Math.PI/2,Math.PI])sim.update(.02,{...idle,...cameraAimDirection(alpha)});
  assert.equal(casts,0);assert.equal(s.projectiles.length,0);
  assert.equal(s.party[0].animation,'idle');assert.equal(s.party[0].attackTimer,0);
 }
});
test('vines, melee combos and learned beams automatically follow the nearest target',()=>{
 for(const id of [1,66]){
  const {sim,s,foe}=arena(id),front=foe(0,6),rear=foe(0,-3);
  sim.update(.02,{...idle,mx:1,aimX:0,aimZ:1});assert.equal(s.player.facing,Math.PI/2);
  assert.ok(rear.hp<rear.maxHp);assert.equal(front.hp,front.maxHp);
  assert.equal(s.party[0].facing,Math.atan2(rear.x-s.party[0].x,rear.z-s.party[0].z));
 }
 const {sim,s,foe}=arena(1),nearest=foe(0,-6);foe(0,10);s.party[0].cooldown=100;
 s.party[0].learnedMoves=[{moveId:'solar-beam',rank:1,cooldown:0}];
 sim.update(.02,{...idle,mx:1,aimX:0,aimZ:1});
 assert.equal(s.projectiles.length,1);assert.ok(s.projectiles[0].vz<0);
 assert.equal(s.party[0].facing,Math.atan2(nearest.x-s.party[0].x,nearest.z-s.party[0].z));
 assert.ok(Math.abs(s.projectiles[0].vx/s.projectiles[0].vz-(nearest.x-s.party[0].x)/(nearest.z-s.party[0].z))<1e-10);
});
test('camera assistance remains available to specials while party members auto-target independently',()=>{
 const {sim,s,foe}=arena(4),rear=foe(0,-3),front=foe(0,9),companionTarget=foe(8,3);
 assert.equal(enemyInAim(s.enemies,s.player,16,0)?.uid,front.uid);
 const companion={...s.party[0],uid:s.idCounter++,speciesId:7,x:8,z:0};s.party.push(companion);
 sim.update(.02,{...idle,aimX:0,aimZ:1});
 const leaderShots=s.projectiles.filter(p=>p.sourceId===s.party[0].uid);
 assert.equal(leaderShots.length,3);assert.ok(leaderShots.every(p=>p.targetId===rear.uid));
 const followerShots=s.projectiles.filter(p=>p.sourceId===companion.uid);
 assert.equal(followerShots.length,1);assert.equal(followerShots[0].targetId,companionTarget.uid);
});
test('directional specials and remote fields follow the camera rather than a nearby enemy behind it',()=>{
 for(const id of [1,7,58,133]){
  const {sim,s,foe}=arena(id),front=foe(0,id===1?10:7),rear=foe(0,-2);s.party[0].cooldown=100;s.player.facing=Math.PI;
  sim.update(.02,{...idle,aimX:0,aimZ:1,special:true});
  for(let i=0;i<80;i++)sim.update(.02,{...idle,aimX:0,aimZ:1});
  assert.ok(front.hp<front.maxHp,`Starter ${id} should hit ahead`);assert.equal(rear.hp,rear.maxHp,`Starter ${id} should not target behind`);
 }
});
test('Thunder Circuit automatically strikes the nearest enemy regardless of camera direction',()=>{
 const {sim,s,foe}=arena(25),front=foe(0,10),rear=foe(0,-3);s.party[0].cooldown=100;
 sim.update(.02,{...idle,aimX:0,aimZ:1,special:true});
 assert.ok(rear.hp<rear.maxHp);assert.equal(front.hp,front.maxHp);
 for(let i=0;i<20;i++)sim.update(.02,{...idle,aimX:1,aimZ:0});
 assert.ok(front.hp<front.maxHp,'Later circuit strikes also find enemies outside the camera direction');
});
test('a sustained flame cone follows camera turns during the cast',()=>{
 const {sim,s,foe}=arena(4),front=foe(0,6),right=foe(6,0);s.party[0].cooldown=100;
 sim.update(.02,{...idle,aimX:0,aimZ:1,special:true});assert.ok(front.hp<front.maxHp);assert.equal(right.hp,right.maxHp);
 for(let i=0;i<18;i++)sim.update(.02,{...idle,aimX:1,aimZ:0});
 assert.ok(right.hp<right.maxHp);assert.equal(s.party[0].facing,Math.PI/2);
});
