import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {availableStarters} from '../../src/game/characterAccess.ts';
import {DEFAULT_SAVE} from '../../src/game/save.ts';

test('offline portraits remain visible and evolution menus use species IDs with large party UIDs',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/assets/pokemon/**',route=>route.abort());
 await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
 await page.goto('/');
 const portraits=page.locator('.starter-card img');
 await expect(portraits).toHaveCount(availableStarters(DEFAULT_SAVE).length);
 for(const portrait of await portraits.all()){
  await expect(portrait).toHaveAttribute('src',/^data:image\/svg\+xml/);
  await expect.poll(()=>portrait.evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 }
 await page.locator('[data-starter="1"]').click();
 await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  s.party[0].uid=999;s.stats.elapsed=500;s.stats.level=12;
  s.choiceTitle='Choose an upgrade';
  s.upgradeChoices=[
   {id:'evolve-999-2',kind:'evolve',speciesId:999,targetId:2,title:'Evolve Bulbasaur',description:'Evolve into Ivysaur.',rarity:'epic'},
   {id:'stat-test',kind:'stat',stat:'damage',amount:.1,title:'Power',description:'Increase damage.',rarity:'common'},
   {id:'item-test',kind:'item',title:'Relic',description:'A passive upgrade.',rarity:'rare'},
  ];s.phase='choice';
 });
 await expect(page.locator('.choice-card')).toHaveCount(3);
 await expect(page.locator('.upgrade-pokemon')).toHaveAttribute('alt','Ivysaur');
 await expect(page.locator('.upgrade-pokemon')).toHaveAttribute('src',/^data:image\/svg\+xml/);
 const frozen=await page.locator('#clock').textContent();
 await page.waitForTimeout(200);await expect(page.locator('#clock')).toHaveText(frozen!);
 await page.setViewportSize({width:390,height:844});
 await mkdir('artifacts/browser',{recursive:true});
 await page.screenshot({path:'artifacts/browser/upgrade-small.png'});
 for(const card of await page.locator('.choice-card').all()){
  const box=await card.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390);
 }
 await page.evaluate(()=>{(window as any).__WILDLANDS__.sim.state.phase='paused';});
 await expect(page.locator('#resume-btn')).toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(page.locator('#invert-y')).toBeFocused();
 await page.screenshot({path:'artifacts/browser/pause-small.png'});
 await page.locator('#restart-btn').click();
 // The injected 500-second run legitimately earns First watch when restarted.
 await expect(page.locator('.starter-card')).toHaveCount(availableStarters({unlocked:[...DEFAULT_SAVE.unlocked,16,27]}).length);
 await expect(page.locator('[data-starter="16"]')).toBeVisible();await expect(page.locator('[data-starter="27"]')).toBeVisible();
 await expect.poll(()=>page.locator('.starter-card img').evaluateAll(images=>images.every(img=>(img as HTMLImageElement).naturalWidth>0))).toBe(true);
 await page.screenshot({path:'artifacts/browser/title-small.png'});
 const overflow=await page.locator('#overlay-content').evaluate(el=>el.scrollWidth>el.clientWidth);
 expect(overflow).toBe(false);expect(errors).toEqual([]);
});
