import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

async function start(page:Page,id:number){
 // Source edits in other IDE sessions must not reload an active browser check.
 await page.routeWebSocket('**',socket=>socket.close());
 const starter=[26,135].includes(id)?25:id;
 await page.goto('/?dev=1');
 await page.evaluate(id=>{const g=(window as any).__WILDLANDS__;if(!g.ui.save.unlocked.includes(id))g.ui.save.unlocked.push(id);g.ui.showTitle();},starter);
 await page.locator(`[data-starter="${starter}"]`).click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.scene.isReady())).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__WILDLANDS__,s=g.sim.state;s.enemies=[];s.terrainFeatures=[];s.player.iframes=10000;s.party[0].cooldown=10000;g.sim.spawnAccum=-10000;});
 if(id!==starter)await page.evaluate(id=>{const s=(window as any).__WILDLANDS__.sim.state;s.party[0].speciesId=id;delete s.player.movement;},id);
 await mkdir('artifacts/browser/chests-movement',{recursive:true});
}

test('locked wooden chests open into empty shells and close with their reset rarity',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page,7);
 const uid=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,p=s.pois.find((p:any)=>p.price!==undefined&&p.rarity==='rare');
  s.coins=1000;s.player.x=p.x;s.player.z=p.z+3;g.camera.radius=15;g.camera.target.set(p.x,g.world.height(p.x,p.z)+2,p.z+3);return p.uid;
 });
 await expect(page.locator('#interaction')).toContainText('RARE chest');
 expect(await page.evaluate(uid=>{const g=(window as any).__WILDLANDS__;return {lock:g.scene.getMeshByName(`chest-lock-${uid}`).isEnabled(),stain:g.scene.getMeshByName(`chest-body-${uid}`).material.name,hinge:g.scene.getTransformNodeByName(`chest-hinge-${uid}`).rotation.x};},uid)).toEqual({lock:true,stain:'rare stained chest wood',hinge:0});
 await page.screenshot({path:'artifacts/browser/chests-movement/locked.png'});
 await page.keyboard.press('e');await expect(page.locator('.choice-card')).toHaveCount(3);await page.keyboard.press('1');
 await expect(page.locator('#interaction')).toContainText('Chest restocks in');
 expect(await page.evaluate(uid=>{const g=(window as any).__WILDLANDS__;return {lock:g.scene.getMeshByName(`chest-lock-${uid}`).isEnabled(),floor:g.scene.getMeshByName(`chest-empty-floor-${uid}`).isEnabled(),hinge:g.scene.getTransformNodeByName(`chest-hinge-${uid}`).rotation.x};},uid)).toEqual({lock:false,floor:true,hinge:Math.PI*.64});
 await page.screenshot({path:'artifacts/browser/chests-movement/open-empty.png'});
 await page.evaluate(uid=>{const g=(window as any).__WILDLANDS__,s=g.sim.state,p=s.pois.find((p:any)=>p.uid===uid);g.sim.lootRng.next=()=>0;s.stats.elapsed=p.respawnAt;g.sim.updateExploration();},uid);
 await expect(page.locator('#interaction')).toContainText('EPIC chest');
 expect(await page.evaluate(uid=>{const g=(window as any).__WILDLANDS__;return {lock:g.scene.getMeshByName(`chest-lock-${uid}`).isEnabled(),stain:g.scene.getMeshByName(`chest-body-${uid}`).material.name,hinge:g.scene.getTransformNodeByName(`chest-hinge-${uid}`).rotation.x};},uid)).toEqual({lock:true,stain:'epic stained chest wood',hinge:0});
 expect(errors).toEqual([]);
});

test('weathered discovery chests glow faintly and disappear after opening',async({page})=>{
 await start(page,7);
 const uid=await page.evaluate(()=>{const g=(window as any).__WILDLANDS__,s=g.sim.state,p=s.pois.find((p:any)=>p.kind==='cache'&&p.price===undefined&&!p.availableAt);s.player.x=p.x;s.player.z=p.z+3;g.camera.radius=15;g.camera.target.set(p.x,g.world.height(p.x,p.z)+2,p.z+3);return p.uid;});
 await expect(page.locator('#interaction')).toContainText('Open discovery cache');
 expect(await page.evaluate(uid=>{const scene=(window as any).__WILDLANDS__.scene;return {glow:scene.getMeshByName(`discovery-glow-${uid}`).isEnabled(),scuffs:scene.getMeshByName(`chest-scuffs-${uid}`).isEnabled(),lock:scene.getMeshByName(`chest-lock-${uid}`).isEnabled()};},uid)).toEqual({glow:true,scuffs:true,lock:false});
 await page.screenshot({path:'artifacts/browser/chests-movement/discovery.png'});
 await page.keyboard.press('e');await expect(page.locator('.choice-card')).toHaveCount(3);await page.keyboard.press('1');
 await expect.poll(()=>page.evaluate(uid=>(window as any).__WILDLANDS__.scene.getTransformNodeByName(`landmark-${uid}`).isEnabled(),uid)).toBe(false);
 await expect(page.locator('#interaction')).toBeHidden();
});

for(const id of [25,26,135])test(`species ${id} switches to an animated quadruped gallop during run-up`,async({page})=>{
 await start(page,id);await page.keyboard.down('d');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.player.movement?.boost??0)).toBeGreaterThan(.1);
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.visuals.inspect()[0].resolved)).toBe('Run');
 const first=await page.evaluate(()=>(window as any).__WILDLANDS__.visuals.inspect()[0].frame);
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.visuals.inspect()[0].frame)).not.toBe(first);
 await page.screenshot({path:`artifacts/browser/chests-movement/run-${id}.png`});
 await page.keyboard.up('d');await page.keyboard.down('w');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.visuals.inspect()[0].requested)).not.toBe('run');await page.keyboard.up('w');
});

test('Sandshrew dives out of sight, leaves earth behind and surfaces after the dash',async({page})=>{
 await start(page,27);await page.keyboard.down('w');await page.keyboard.press('Shift');
 await expect(page.locator('#movement-trait')).toContainText('BURROWED');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.visuals.inspect()[0].visible)).toBe(false);
 expect(await page.evaluate(()=>(window as any).__WILDLANDS__.scene.getMeshByName('combat-burrow-mound')?.isEnabled())).toBe(true);
 await page.screenshot({path:'artifacts/browser/chests-movement/burrow.png'});
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.player.burrowTime)).toBe(0);
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.visuals.inspect()[0].visible)).toBe(true);await page.keyboard.up('w');
 expect(await page.evaluate(()=>(window as any).__WILDLANDS__.scene.getMeshByName('combat-burrow-mound')?.isEnabled())).toBe(false);
});
