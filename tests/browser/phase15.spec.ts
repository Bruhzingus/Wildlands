import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const game=(page:Page,expression:string)=>page.evaluate(expression=>new Function('g',`return (${expression})(g)`)((window as any).__WILDLANDS__),expression);
const captured=async(page:Page)=>{await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');await expect(page.locator('#overlay')).toBeHidden();};
const start=async(page:Page,map='volcanic-ridge')=>{
 await page.goto('/?dev=1');await page.locator('[data-run-map]').selectOption(map);await page.locator('[data-starter="25"]').click();await captured(page);
 await game(page,'g=>{const s=g.sim.state;s.enemies=[];s.player.iframes=10000;s.party[0].cooldown=10000;s.recruitCount=5;g.sim.spawnAccum=-10000;}');
};

test('Volcanic Ridge is selectable, renders its geography and reveals a timed discovery only after unpausing',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 await expect(page.locator('#map-region')).toHaveText('ASHEN CLEARING');await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBe(true);
 expect(await game(page,'g=>g.sim.state.pois.filter(p=>!p.availableAt).length')).toBe(18);
 expect(await game(page,'g=>g.world.profile.definition.id')).toBe('volcanic-ridge');
 expect(await game(page,'g=>g.scene.getMeshByName("rolling forest terrain").getBoundingInfo().boundingBox.extendSize.x*2')).toBe(287.5);
 expect(await game(page,'g=>g.scene.geometries.length')).toBeLessThan(80);
 const reveal=await game(page,'g=>{const s=g.sim.state,p=s.pois.find(p=>p.availableAt===180);s.player.x=p.x;s.player.z=p.z;s.stats.elapsed=179.5;return p.uid;}');
 expect(await game(page,`g=>g.scene.getTransformNodeByName('landmark-${reveal}').isEnabled()`)).toBe(false);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 const frozen=await game(page,'g=>JSON.stringify(g.sim.state)');await page.waitForTimeout(200);expect(await game(page,'g=>JSON.stringify(g.sim.state)')).toBe(frozen);
 await page.locator('#resume-btn').click();await captured(page);await expect(page.locator('#interaction')).toContainText('Geothermal spring');
 expect(await game(page,`g=>g.scene.getTransformNodeByName('landmark-${reveal}').isEnabled()`)).toBe(true);
 await game(page,'g=>{g.sim.state.player.hp=20;}');await page.keyboard.press('e');await expect.poll(()=>game(page,'g=>g.sim.state.player.hp')).toBeGreaterThan(60);
 await page.evaluate(async()=>{const {worldPoint}=await import('/src/data/maps.ts'),g=(window as any).__WILDLANDS__,p=worldPoint({x:60,z:-48},g.world.profile);Object.assign(g.sim.state.player,p);g.camera.radius=38;g.camera.beta=.9;});
 await expect(page.locator('#map-region')).toHaveText('BASALT RIDGE');await page.waitForTimeout(200);
 await mkdir('artifacts/browser',{recursive:true});await page.screenshot({path:'artifacts/browser/phase15-volcanic-ridge.png'});expect(errors).toEqual([]);
});

test('Moltres has named fire tells, a frozen solar wave and victory can continue endless',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 await game(page,'g=>{g.sim.state.stats.elapsed=885;}');await expect(page.locator('#danger')).toContainText('MOLTRES APPROACHES');
 await game(page,'g=>{g.sim.state.stats.elapsed=899.99;}');await expect(page.locator('#boss-bar')).toBeVisible();
 expect(await game(page,'g=>g.sim.state.enemies.filter(e=>e.isBoss&&e.speciesId===146).length')).toBe(1);
 await game(page,'g=>{const s=g.sim.state,e=s.enemies.find(e=>e.isBoss);Object.assign(e,{x:s.player.x+12,z:s.player.z+4,speed:0,attackCooldown:0,bossCycle:0,hp:100000,maxHp:100000});}');
 await expect(page.locator('#boss-action')).toContainText('EMBER FAN');
 await expect.poll(()=>game(page,'g=>g.sim.state.projectiles.some(p=>!p.friendly&&p.type==="fire")')).toBe(true);
 await game(page,'g=>{const e=g.sim.state.enemies.find(e=>e.isBoss);e.windup=undefined;e.attackCooldown=0;e.bossCycle=2;}');
 await expect(page.locator('#boss-action')).toContainText('SOLAR FLARE');await expect.poll(()=>game(page,'g=>g.sim.state.psychicRings.length')).toBe(1);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();const frozen=await game(page,'g=>JSON.stringify(g.sim.state)');
 await page.waitForTimeout(200);expect(await game(page,'g=>JSON.stringify(g.sim.state)')).toBe(frozen);
 await page.locator('#overlay').evaluate(el=>(el as HTMLElement).style.visibility='hidden');await page.screenshot({path:'artifacts/browser/phase15-moltres-solar-flare.png'});await page.locator('#overlay').evaluate(el=>(el as HTMLElement).style.visibility='');
 await page.locator('#resume-btn').click();await captured(page);
 await game(page,'g=>{const s=g.sim.state,e=s.enemies.find(e=>e.isBoss);s.items=["wide-lens"];s.player.hp=77;g.sim.damageEnemy(e,200000,"normal",1);}');
 await expect(page.locator('.end-screen')).toContainText('Moltres defeated');await game(page,'g=>g.engine.stopRenderLoop()');await page.locator('#endless-btn').click();await captured(page);
 expect(await game(page,'g=>g.sim.state.items')).toEqual(['wide-lens']);expect(await game(page,'g=>g.sim.state.endless')).toBe(true);expect(errors).toEqual([]);
});

test('new challenge choices persist and configure real enemy damage and arrival rates',async({page})=>{
 await page.goto('/?dev=1');await expect(page.locator('[data-run-map] option')).toHaveCount(2);await expect(page.locator('[data-run-challenge] option')).toHaveCount(3);
 await page.locator('[data-run-map]').selectOption('volcanic-ridge');await page.locator('[data-run-challenge]').selectOption('onslaught');await page.reload();
 await expect(page.locator('[data-run-map]')).toHaveValue('volcanic-ridge');await expect(page.locator('[data-run-challenge]')).toHaveValue('onslaught');
 await page.locator('[data-starter="25"]').click();await captured(page);expect(await game(page,'g=>g.sim.state.challenge')).toBe('onslaught');
 expect(await game(page,'g=>g.sim.state.director.spawnInterval')).toBeLessThan(1.09);
 await page.keyboard.press('Escape');await page.locator('#restart-btn').click();await page.locator('[data-run-challenge]').selectOption('volatile');await page.locator('[data-starter="25"]').click();await captured(page);
 expect(await game(page,'g=>g.sim.state.challenge')).toBe('volatile');
 expect(await page.evaluate(async()=>{const {createEnemy}=await import('/src/game/systems/spawning.ts'),{RNG}=await import('/src/utils/random.ts'),g=(window as any).__WILDLANDS__,s=g.sim.state;const one=createEnemy({...s,challenge:'standard'},new RNG(1),19,'normal',0,0),two=createEnemy(s,new RNG(1),19,'normal',0,0);return two.damage/one.damage;})).toBe(1.25);
});
