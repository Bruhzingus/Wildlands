import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine,Scene} from '@babylonjs/core';
import {TreasureChests} from '../src/game/render/TreasureChests.ts';
import type {POI} from '../src/game/types.ts';

test('chest geometry opens at its hinge, hides discovery loot and restores locked rarity after reset',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),pois:POI[]=[{uid:1,x:0,z:0,kind:'cache',used:false},{uid:2,x:4,z:0,kind:'cache',used:false,price:45,rarity:'rare'}];
 const chests=new TreasureChests(scene,pois,()=>0);chests.update(pois,0);
 const root=scene.getTransformNodeByName('landmark-1')!,hinge=scene.getTransformNodeByName('chest-hinge-2')!,lock=scene.getMeshByName('chest-lock-2')!,body=scene.getMeshByName('chest-body-2')!;
 assert.equal(scene.getMeshByName('discovery-glow-1')!.isEnabled(),true);assert.equal(lock.isEnabled(),true);assert.equal(body.material!.name,'rare stained chest wood');
 pois.forEach(p=>p.used=true);pois[1].respawnAt=180;chests.update(pois,1);
 assert.equal(root.isEnabled(),false);assert.equal(lock.isEnabled(),false);assert.equal(hinge.rotation.x,Math.PI*.64);
 assert.equal(scene.getMeshByName('chest-empty-floor-2')!.isEnabled(),true);
 pois[1].used=false;pois[1].rarity='epic';delete pois[1].respawnAt;chests.update(pois,180);
 assert.equal(lock.isEnabled(),true);assert.equal(hinge.rotation.x,0);assert.equal(body.material!.name,'epic stained chest wood');
 chests.dispose();assert.equal(scene.meshes.length,0);assert.equal(scene.transformNodes.length,0);assert.equal(scene.multiMaterials.length,0);assert.equal(scene.materials.filter(m=>m.name!=='default material').length,0);
 scene.dispose();engine.dispose();
});
