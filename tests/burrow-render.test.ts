import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine,Scene} from '@babylonjs/core';
import {Effects} from '../src/game/render/Effects.ts';
import {Simulation} from '../src/game/Simulation.ts';

test('burrow has a persistent earth mound even when stopped, freezes on pause and reuses its mesh',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),s=new Simulation(27,4).state,fx=new Effects(scene,{height:()=>2},false);
 s.projectiles=[];s.drops=[];s.enemies=[];s.player.burrowTime=.8;
 fx.update(s,.02);const mound=scene.getMeshByName('combat-burrow-mound')!;assert.ok(mound?.isEnabled());assert.equal(mound.position.y,2.06);
 s.player.x=4;fx.update(s,.02);assert.equal(mound.position.x,4);
 const size=mound.scaling.clone();fx.update(s,0);assert.ok(mound.scaling.equals(size));
 s.player.burrowTime=0;fx.update(s,.02);assert.equal(mound.isEnabled(),false);
 s.player.burrowTime=.8;fx.update(s,.02);assert.equal(scene.getMeshByName('combat-burrow-mound'),mound);assert.ok(mound.isEnabled());
 fx.dispose();assert.equal(scene.getMeshByName('combat-burrow-mound'),null);scene.dispose();engine.dispose();
});
