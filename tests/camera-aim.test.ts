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
test('leader flames launch along the camera while moving backward, and never acquire the closer rear enemy',()=>{
 const {sim,s,foe}=arena(4),front=foe(0,8),rear=foe(0,-2);
 sim.update(.02,{...idle,mz:-1,aimX:0,aimZ:1});
 assert.equal(s.player.facing,Math.PI);assert.equal(s.party[0].facing,0);
 assert.equal(s.projectiles.length,3);assert.ok(s.projectiles.every(p=>p.vz>0&&p.targetId===front.uid));
 assert.ok(Math.abs(s.projectiles[0].vx)<1e-10);
 s.party[0].cooldown=100;for(let i=0;i<35;i++)sim.update(.02,{...idle,aimX:0,aimZ:1});
 assert.ok(front.hp<front.maxHp);assert.equal(rear.hp,rear.maxHp);
});
test('camera rotation changes the next cast and free aimed shots work with no enemies',()=>{
 const {sim,s}=arena(4);
 sim.update(.02,{...idle,aimX:0,aimZ:1});assert.ok(s.projectiles.every(p=>p.vz>0&&p.targetId===undefined));
 s.projectiles=[];s.party[0].cooldown=0;
 sim.update(.02,{...idle,aimX:1,aimZ:0});assert.ok(s.projectiles.every(p=>p.vx>0));assert.ok(Math.abs(s.projectiles[0].vz)<1e-10);
 s.phase='paused';const before=structuredClone(s);sim.update(.02,{...idle,aimX:-1,aimZ:0});assert.deepEqual(s,before);
});
test('vines, combos and learned beams use the camera independently of movement facing',()=>{
 for(const id of [1,66]){
  const {sim,s,foe}=arena(id),front=foe(0,3),rear=foe(0,-2);
  sim.update(.02,{...idle,mx:1,aimX:0,aimZ:1});assert.equal(s.player.facing,Math.PI/2);
  assert.ok(front.hp<front.maxHp);assert.equal(rear.hp,rear.maxHp);
 }
 const {sim,s,foe}=arena(1);foe(0,-2);foe(0,10);s.party[0].cooldown=100;
 s.party[0].learnedMoves=[{moveId:'solar-beam',rank:1,cooldown:0}];
 sim.update(.02,{...idle,mx:1,aimX:0,aimZ:1});
 assert.ok(s.projectiles.length>0&&s.projectiles.every(p=>p.vz>0&&Math.abs(p.vx)<1e-8));
});
test('target assistance favors the look direction, and companions retain independent targeting',()=>{
 const {sim,s,foe}=arena(25),rear=foe(0,-3),front=foe(0,9);foe(3,5);
 assert.equal(enemyInAim(s.enemies,s.player,16,0)?.uid,front.uid);
 s.party.push({...s.party[0],uid:s.idCounter++,speciesId:1,x:0,z:-2});
 sim.update(.02,{...idle,aimX:0,aimZ:1});
 assert.ok(front.hp<front.maxHp);assert.ok(rear.hp<rear.maxHp,'The follower still chooses its own nearby target');
 const empty=arena(25),behind=empty.foe(0,-3);empty.sim.update(.02,{...idle,aimX:0,aimZ:1});assert.equal(behind.hp,behind.maxHp);
});
test('directional specials and remote fields follow the camera rather than a nearby enemy behind it',()=>{
 for(const id of [1,7,25,58,133]){
  const {sim,s,foe}=arena(id),front=foe(0,id===1?10:7),rear=foe(0,-2);s.party[0].cooldown=100;s.player.facing=Math.PI;
  sim.update(.02,{...idle,aimX:0,aimZ:1,special:true});
  for(let i=0;i<80;i++)sim.update(.02,{...idle,aimX:0,aimZ:1});
  assert.ok(front.hp<front.maxHp,`Starter ${id} should hit ahead`);assert.equal(rear.hp,rear.maxHp,`Starter ${id} should not target behind`);
 }
});
test('a sustained flame cone follows camera turns during the cast',()=>{
 const {sim,s,foe}=arena(4),front=foe(0,6),right=foe(6,0);s.party[0].cooldown=100;
 sim.update(.02,{...idle,aimX:0,aimZ:1,special:true});assert.ok(front.hp<front.maxHp);assert.equal(right.hp,right.maxHp);
 for(let i=0;i<18;i++)sim.update(.02,{...idle,aimX:1,aimZ:0});
 assert.ok(right.hp<right.maxHp);assert.equal(s.party[0].facing,Math.PI/2);
});
