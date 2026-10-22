import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const game=(page:Page,expression:string)=>page.evaluate(expression=>new Function('g',`return (${expression})(g)`)((window as any).__WILDLANDS__),expression);
async function start(page:Page,id:number){
 await page.goto('/?dev=1');
 await game(page,`g=>{if(!g.ui.save.unlocked.includes(${id}))g.ui.save.unlocked.push(${id});g.ui.showTitle();}`);
 await expect(page.locator(`[data-starter="${id}"]`)).toContainText(id===25?'Run-up':id===129?'Splash leap':'Short flight');
 await page.locator(`[data-starter="${id}"]`).click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBe(true);
 await game(page,`g=>{const s=g.sim.state;s.enemies=[];s.drops=[];s.terrainFeatures=[];g.sim.spawnAccum=-10000;s.player.iframes=10000;s.party[0].cooldown=10000;g.camera.alpha=-Math.PI/2;}`);
 await mkdir('artifacts/browser/movement-traits',{recursive:true});
}
test('Pikachu charges a straight run, loses it when turning and explains movement in menus',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page,25);
 await page.keyboard.down('w');
 await expect.poll(()=>game(page,'g=>g.sim.state.player.movement?.boost??0')).toBeGreaterThan(.24);
 await expect.poll(()=>game(page,"g=>g.visuals.inspect()[0]?.requested")).toBe('walk');
 await expect.poll(()=>game(page,"g=>g.visuals.inspect()[0]?.resolved")).toBe('Walk');
 await expect(page.locator('#movement-trait')).toContainText('+25% SPEED');
 await page.screenshot({path:'artifacts/browser/movement-traits/runup.png'});
 await page.keyboard.up('w');await page.keyboard.down('d');
 await expect.poll(()=>game(page,'g=>g.sim.state.player.movement?.boost')).toBe(0);await page.keyboard.up('d');
 await page.keyboard.press('Escape');await expect(page.locator('.build-movement')).toContainText('Run-up');
 await expect(page.locator('.build-movement')).toContainText('1s');expect(errors).toEqual([]);
});
test('holding Space flies over a real rock, animates native frames, pauses and descends on release',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page,16);
 const rock=await game(page,`async g=>{
  const {createEnvironment}=await import('/src/game/systems/environment.ts');const s=g.sim.state;
  const prop=createEnvironment(s.seed,s.pois,s.mapId).props.find(p=>p.kind==='rock'&&Math.hypot(p.x,p.z)<60&&Math.abs(g.sim.obstacles.move({x:p.x-4,z:p.z},0,0).x-(p.x-4))<.01);
  Object.assign(s.player,{x:prop.x-4,z:prop.z,y:0,vy:0});Object.assign(g.sim,{velocity:{x:0,z:0}});return prop;
 }`);
 await page.keyboard.down('Space');
 await expect.poll(()=>game(page,'g=>g.sim.state.player.movement?.flying')).toBe(true);
 await expect.poll(()=>game(page,'g=>g.sim.state.player.y')).toBeGreaterThan(2);
 await page.keyboard.down('d');
 await expect.poll(()=>game(page,'g=>g.sim.state.player.x')).toBeGreaterThan(rock.x+1.25*rock.scale+.7);
 await page.keyboard.up('d');
 expect(await game(page,'g=>g.sim.state.player.movement.flying')).toBe(true);
 const first=await game(page,'g=>g.visuals.inspect()[0].frame');
 await expect.poll(()=>game(page,'g=>g.visuals.inspect()[0].frame')).not.toBe(first);
 await expect(page.locator('#movement-trait')).toContainText('FLYING');
 await page.screenshot({path:'artifacts/browser/movement-traits/flight-over-rock.png'});
 await page.keyboard.press('Escape');const frozen=await game(page,'g=>JSON.stringify(g.sim.state)');
 await page.waitForTimeout(200);expect(await game(page,'g=>JSON.stringify(g.sim.state)')).toBe(frozen);
 await page.keyboard.up('Space');await page.locator('#resume-btn').click();
 await expect.poll(()=>game(page,'g=>g.sim.state.player.y')).toBe(0);
 expect(await game(page,'g=>g.sim.state.player.movement.flying')).toBe(false);
 await expect(page.locator('#movement-trait')).toContainText('RECHARGE');expect(errors).toEqual([]);
});
test('Magikarp and Zubat are selectable unlocked kits; held jump never repeats Splash leaps',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page,129);
 await page.keyboard.down('Space');await expect.poll(()=>game(page,'g=>g.sim.state.player.y')).toBeGreaterThan(2.2);
 await expect(page.locator('#movement-trait')).toContainText('SPLASH LEAP');
 await page.screenshot({path:'artifacts/browser/movement-traits/splash-leap.png'});
 await expect.poll(()=>game(page,'g=>g.sim.state.player.y')).toBe(0);
 await page.waitForTimeout(300);expect(await game(page,'g=>g.sim.state.player.y')).toBe(0);
 await page.keyboard.up('Space');await page.keyboard.press('Escape');await page.locator('#restart-btn').click();
 await game(page,'g=>{g.ui.save.unlocked.push(41);g.ui.showTitle();}');
 await expect(page.locator('[data-starter="41"]')).toContainText('Short flight');
 await page.locator('[data-starter="41"]').click();await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await page.keyboard.down('Space');await expect.poll(()=>game(page,'g=>g.sim.state.player.movement?.flying')).toBe(true);await page.keyboard.up('Space');
 expect(errors).toEqual([]);
});
