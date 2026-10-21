import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {ITEM_DEFINITIONS} from '../../src/data/items.ts';

const game=(page:Page,expression:string)=>page.evaluate(expression=>new Function('g',`return (${expression})(g)`)((window as any).__WILDLANDS__),expression);
const capture=async(page:Page)=>{await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');await expect(page.locator('#overlay')).toBeHidden();};
const frame=(page:Page)=>game(page,'g=>{g.previous=performance.now()-16;g.frame();}');

test('collection has10 readable achievements and reviewed safe import/export with mobile layout',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/?dev=1');
 await page.locator('.unlock-library>summary').click();await expect(page.locator('[data-achievement]')).toHaveCount(10);await expect(page.locator('[data-collection-partner]')).toHaveCount(15);await expect(page.locator('.partner-collection .collected')).toHaveCount(4);
 const input=page.locator('[data-import-save]');
 await input.setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await expect(page.locator('[data-save-status]')).toContainText('not valid JSON');await expect(page.locator('[data-confirm-import]')).toHaveCount(0);expect(await game(page,'g=>g.save.unlocked.length')).toBe(4);
 const oldSave={version:1,unlocked:[1,4,7,25,133],wins:0,games:6,bestKills:444,longestRun:888,settings:{volume:.45,camera:28,quality:'high'}};
 const file={name:'wildlands-old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(oldSave))};
 await input.setInputFiles(file);await expect(page.locator('[data-import-preview]')).toContainText('5 partners');await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await game(page,'g=>g.save.unlocked.length')).toBe(4);
 await input.setInputFiles(file);await page.locator('[data-confirm-import]').click();await expect(page.locator('[data-starter="133"]')).toBeVisible();expect(await game(page,'g=>[g.save.version,g.save.games,g.save.bestKills,g.save.unlockedItems.length]')).toEqual([2,6,444,ITEM_DEFINITIONS.length]);
 await page.locator('.unlock-library>summary').click();const downloadPromise=page.waitForEvent('download');await page.locator('[data-export-save]').click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('wildlands-save.json');
 await page.reload();await expect(page.locator('[data-starter="133"]')).toBeVisible();await page.setViewportSize({width:390,height:844});await page.locator('.unlock-library>summary').click();
 expect(await page.evaluate(()=>document.querySelector('#overlay-content')!.scrollWidth<=document.querySelector('#overlay-content')!.clientWidth)).toBe(true);
 await mkdir('artifacts/browser',{recursive:true});await page.screenshot({path:'artifacts/browser/phase14-library-mobile.png'});expect(errors).toEqual([]);
});

test('actual Rocket defeats unlock partners, real victory and20min endless account once and next title offers new partners',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();await capture(page);
 await game(page,'g=>{g.engine.stopRenderLoop();g.sim.state.enemies=[];g.sim.spawnAccum=-1000;g.sim.state.player.iframes=10000;}');
 await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,{createEnemy}=await import('/src/game/systems/spawning.ts');
  for(let i=0;i<100;i++){const enemy=createEnemy(g.sim.state,g.sim.rng,19,'rocket',10,10);g.sim.state.enemies.push(enemy);g.sim.damageEnemy(enemy,100000,'normal',1);}
  g.sim.state.party.forEach((m:any)=>m.xp=0);g.sim.state.stats.xp=0;g.sim.state.stats.elapsed=180;
 });await frame(page);expect(await game(page,'g=>g.save.achievements.includes("rocket-patrol")')).toBe(true);expect(await game(page,'g=>g.save.unlocked.includes(133)')).toBe(true);expect(await game(page,'g=>g.save.games')).toBe(0);
 await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,{createEnemy}=await import('/src/game/systems/spawning.ts');g.sim.state.stats.elapsed=927;g.sim.state.stats.xp=0;g.sim.state.bossSpawned=true;
  const boss=createEnemy(g.sim.state,g.sim.rng,150,'legendary',10,10,true,true);boss.hp=1;g.sim.state.enemies.push(boss);g.sim.damageEnemy(boss,100000,'normal',1);g.sim.state.party.forEach((m:any)=>m.xp=0);g.sim.state.pendingSquadRewards=0;
 });await frame(page);await expect(page.getByRole('heading',{name:'Victory',exact:true})).toBeVisible();await expect(page.locator('.earned-unlocks')).toContainText('Psychic break');expect(await game(page,'g=>[g.save.games,g.save.wins]')).toEqual([1,1]);
 await page.locator('#endless-btn').click();await capture(page);expect(await game(page,'g=>g.sim.state.endlessStartedAt')).toBe(927);
 await game(page,'g=>{g.sim.state.stats.elapsed=g.sim.state.endlessStartedAt+1199.5;}');await frame(page);expect(await game(page,'g=>g.save.achievements.includes("beyond-the-watch")')).toBe(false);
 await game(page,'g=>{g.sim.state.stats.elapsed=g.sim.state.endlessStartedAt+1200;}');await frame(page);expect(await game(page,'g=>g.save.achievements.includes("beyond-the-watch")')).toBe(true);
 await game(page,'g=>{g.sim.state.player.hp=0;}');await frame(page);await expect(page.getByRole('heading',{name:'Game over',exact:true})).toBeVisible();expect(await game(page,'g=>[g.save.games,g.save.wins,g.save.totals.rocketKills]')).toEqual([1,1,100]);
 await page.locator('#restart-btn').click();await expect(page.locator('[data-starter="133"]')).toBeVisible();await expect(page.locator('[data-starter="10"]')).toBeVisible();expect(await game(page,'g=>[g.save.games,g.save.wins]')).toEqual([1,1]);
 await expect(page.locator('[data-run-map] option')).toHaveCount(3);await expect(page.locator('[data-run-challenge] option')).toHaveCount(5);await page.screenshot({path:'artifacts/browser/phase14-collected-partners.png'});expect(errors).toEqual([]);
});

test('earned expedition route and optional challenge persist and configure an actual run',async({page})=>{
 await page.goto('/?dev=1');await page.locator('.unlock-library>summary').click();
 const save=await game(page,'g=>({...g.save,unlockedMaps:["wildlands","pinewood-route","ruins-route"],unlockedChallenges:["standard","quickened","famine"]})');
 await page.locator('[data-import-save]').setInputFiles({name:'routes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await page.locator('[data-confirm-import]').click();
 await page.locator('[data-run-map]').selectOption('pinewood-route');await page.locator('[data-run-challenge]').selectOption('quickened');await expect(page.locator('[data-run-option-help]')).toContainText('20% faster');await page.reload();await expect(page.locator('[data-run-map]')).toHaveValue('pinewood-route');await expect(page.locator('[data-run-challenge]')).toHaveValue('quickened');
 await page.locator('[data-starter="25"]').click();await capture(page);expect(await game(page,'g=>[g.sim.state.seed,g.sim.state.mapId,g.sim.state.challenge]')).toEqual([46837,'pinewood-route','quickened']);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();await page.locator('#restart-btn').click();await page.locator('[data-run-map]').selectOption('wildlands');await page.locator('[data-run-challenge]').selectOption('standard');await page.locator('[data-starter="25"]').click();await capture(page);expect(await game(page,'g=>g.sim.state.challenge')).toBe('standard');
});
