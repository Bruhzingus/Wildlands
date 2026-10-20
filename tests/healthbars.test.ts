import test from 'node:test';
import assert from 'node:assert/strict';
import {ArcRotateCamera,NullEngine,Scene,Vector3} from '@babylonjs/core';
import {HealthBars} from '../src/game/render/HealthBars.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';

const setup=()=>{
 const engine=new NullEngine(),scene=new Scene(engine);
 new ArcRotateCamera('test-camera',-Math.PI/2,1.05,28,Vector3.Zero(),scene);
 const sim=new Simulation(1,123),bars=new HealthBars(scene);
 return {engine,scene,sim,bars,dispose:()=>{bars.dispose();scene.dispose();engine.dispose();}};
};

test('health bars read authoritative player HP and freeze smoothing during pause',()=>{
 const t=setup();try{
  const {sim,bars}=t,s=sim.state,ground=()=>0;
  s.player.hp=90;s.player.maxHp=120;s.party[0].hp=1;
  bars.sync(s,.02,ground);
  assert.equal(bars.inspect().find(b=>b.kind==='player')!.ratio,.75);
  s.player.hp=30;bars.sync(s,.02,ground);
  const bar=bars.inspect().find(b=>b.kind==='player')!;
  assert.equal(bar.ratio,.25);assert.ok(bar.displayedRatio>.25&&bar.displayedRatio<.75);
  for(let i=0;i<10;i++)bars.sync(s,0,ground);
  assert.equal(bars.inspect().find(b=>b.kind==='player')!.displayedRatio,bar.displayedRatio);
  for(let i=0;i<30;i++)bars.sync(s,.04,ground);
  assert.ok(Math.abs(bars.inspect().find(b=>b.kind==='player')!.displayedRatio-.25)<.001);
 }finally{t.dispose();}
});

test('crowded encounters show nearby threats within a bounded visual budget and remove dead bars',()=>{
 const t=setup();try{
  const {sim,bars}=t,s=sim.state;
  s.enemies=[];
  for(let i=0;i<40;i++)s.enemies.push(createEnemy(s,sim.rng,19,'normal',1+i*.5,0));
  const distant=createEnemy(s,sim.rng,19,'normal',40,0);s.enemies.push(distant);
  bars.sync(s,.02,()=>0);
  const visible=bars.inspect().filter(b=>b.kind==='enemy');
  assert.equal(visible.length,24);assert.ok(visible.every(b=>s.enemies.slice(0,24).some(e=>e.uid===b.uid)));
  assert.ok(!visible.some(b=>b.uid===distant.uid));
  const dead=s.enemies[0];dead.dead=true;dead.hp=0;bars.sync(s,.02,()=>0);
  assert.ok(!bars.inspect().some(b=>b.uid===dead.uid));
  s.enemies=[];s.player.hp=0;bars.sync(s,.02,()=>0);assert.equal(bars.inspect().length,0);
 }finally{t.dispose();}
});

test('player bar follows jumping and camera rotation without changing its health',()=>{
 const t=setup();try{
  const {sim,bars,scene}=t,s=sim.state;
  bars.sync(s,.02,()=>2);const resting=bars.inspect().find(b=>b.kind==='player')!;
  s.player.y=2;bars.sync(s,.02,()=>2);const jumping=bars.inspect().find(b=>b.kind==='player')!;
  assert.equal(jumping.y-resting.y,2);assert.equal(jumping.ratio,resting.ratio);
  (scene.activeCamera as ArcRotateCamera).alpha+=Math.PI/2;scene.activeCamera!.getViewMatrix(true);
  bars.sync(s,0,()=>2);assert.ok(bars.inspect().every(b=>[b.x,b.y,b.z,b.width].every(Number.isFinite)));
 }finally{t.dispose();}
});

test('ten health bar restarts release instances, templates, transforms and shared materials',()=>{
 const engine=new NullEngine(),scene=new Scene(engine);void scene.defaultMaterial;
 const resources=()=>({meshes:scene.meshes.length,materials:scene.materials.length,transforms:scene.transformNodes.length,geometries:scene.geometries.length});
 const baseline=resources();try{
  const sim=new Simulation(1,123);sim.state.enemies.forEach((e,i)=>{e.x=i+2;e.z=0;});
  for(let i=0;i<10;i++){
   const bars=new HealthBars(scene);bars.sync(sim.state,.02,()=>0);assert.ok(bars.inspect().length>1);
   bars.dispose();assert.deepEqual(resources(),baseline,`Health bar restart ${i+1} leaked resources`);
  }
 }finally{scene.dispose();engine.dispose();}
});
