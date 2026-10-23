import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('water ripples follow the presentation clock, restore on preview and retain resources',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&/shader|compile|uniform|effect/i.test(message.text()))errors.push(message.text());});
 await page.addInitScript(()=>{Date.now=()=>4;localStorage.setItem('wildlands-controls-v1',JSON.stringify({graphicsQuality:'high',resolution:1,soundVolume:0,musicVolume:0}));});
 await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.scene.isReady())).toBe(true);
 await page.keyboard.press('Escape');await page.locator('#resume-btn').waitFor();
 await page.locator('#overlay').evaluate(element=>element.style.visibility='hidden');
 const before=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,lake=g.world.profile.lake;
  g.engine.stopRenderLoop();g.camera.target.set(lake.x,lake.waterHeight,lake.z);g.camera.radius=65;g.camera.beta=.65;
  g.world.setAtmospherePreview(900);g.scene.render();g.scene.render();
  return {state:JSON.stringify(g.sim.state),resources:g.inspectPerformance().resources};
 });
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.scene.isReady())).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__WILDLANDS__;g.scene.render();g.scene.render();});
 const canvas=page.locator('#renderCanvas'),still=await canvas.screenshot();
 await page.waitForTimeout(150);
 await page.evaluate(()=>{const g=(window as any).__WILDLANDS__;g.scene.render();g.scene.render();});
 expect((await canvas.screenshot()).equals(still)).toBe(true);
 // Atmosphere clamps at 900, isolating ripple motion from daylight changes.
 await page.evaluate(()=>{const g=(window as any).__WILDLANDS__;g.world.setAtmospherePreview(906);g.scene.render();g.scene.render();});
 const moving=await canvas.screenshot();expect(moving.equals(still)).toBe(false);
 await page.evaluate(()=>{const g=(window as any).__WILDLANDS__;g.world.setAtmospherePreview(900);g.scene.render();g.scene.render();});
 expect((await canvas.screenshot()).equals(still)).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__WILDLANDS__;g.world.setAtmospherePreview(g.sim.state.stats.elapsed);g.scene.render();g.scene.render();});
 const atRunTime=await canvas.screenshot();
 await page.evaluate(()=>{const g=(window as any).__WILDLANDS__;g.world.setAtmospherePreview(null);g.scene.render();g.scene.render();});
 expect((await canvas.screenshot()).equals(atRunTime)).toBe(true);
 const after=await page.evaluate(()=>{const g=(window as any).__WILDLANDS__;return {state:JSON.stringify(g.sim.state),resources:g.inspectPerformance().resources};});
 expect(after).toEqual(before);expect(errors).toEqual([]);
 await mkdir('artifacts/art-polish',{recursive:true});await canvas.screenshot({path:'artifacts/art-polish/water-clock.png'});
});
