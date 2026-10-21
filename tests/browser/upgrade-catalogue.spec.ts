import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {createUpgradeCatalogue} from '../../src/ui/upgradeCatalogueData.ts';

const entries=createUpgradeCatalogue();
const entryCount=entries.length;
const training=entries.filter(entry=>entry.group==='training');

async function openCatalogue(page:Page){
 await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
 await page.goto('/');await page.locator('[data-open-catalogue]').click();
 await expect(page.getByRole('heading',{name:'Upgrade catalogue',exact:true})).toBeVisible();
}

async function expectCatalogueFits(page:Page){
 const layout=await page.locator('.upgrade-catalogue').evaluate(root=>{
  const bounds=root.getBoundingClientRect(),list=root.querySelector<HTMLElement>('[data-catalogue-results]')!;
  return {left:bounds.left,right:bounds.right,top:bounds.top,bottom:bounds.bottom,width:window.innerWidth,height:window.innerHeight,
   bodyWidth:document.body.scrollWidth,rootScroll:root.scrollWidth,rootWidth:root.clientWidth,listHeight:list.clientHeight,listScrollWidth:list.scrollWidth,listWidth:list.clientWidth};
 });
 expect(layout.left).toBeGreaterThanOrEqual(0);expect(layout.right).toBeLessThanOrEqual(layout.width);
 expect(layout.top).toBeGreaterThanOrEqual(0);expect(layout.bottom).toBeLessThanOrEqual(layout.height);
 expect(layout.bodyWidth).toBeLessThanOrEqual(layout.width);expect(layout.rootScroll).toBeLessThanOrEqual(layout.rootWidth+1);
 expect(layout.listHeight).toBeGreaterThan(90);expect(layout.listScrollWidth).toBeLessThanOrEqual(layout.listWidth+1);
}

test('menu catalogue lists every document group, scrolls independently and filters with readable rarity colours',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await openCatalogue(page);
 await expect(page.locator('[data-catalogue-section]')).toHaveCount(10);
 await expect(page.locator('[data-catalogue-entry]')).toHaveCount(entryCount);
 await expect(page.locator('[data-catalogue-count]')).toContainText(`${entryCount} of ${entryCount} entries`);
 await expectCatalogueFits(page);
 const list=page.locator('[data-catalogue-results]');
 await list.evaluate(element=>{element.scrollTop=element.scrollHeight;});
 expect(await list.evaluate(element=>element.scrollTop)).toBeGreaterThan(100);
 await expect(page.getByRole('heading',{name:'Upgrade catalogue',exact:true})).toBeInViewport();
 await page.locator('[data-catalogue-group="training"]').click();
 await page.locator('[data-catalogue-filter="sort"]').selectOption('rarity-desc');
 await expect(page.locator('[data-catalogue-entry]')).toHaveCount(training.length);
 await expect(page.locator('[data-catalogue-entry]').first()).toHaveAttribute('data-rarity','legendary');
 const colors=await page.locator('.catalogue-entry .catalogue-badge').evaluateAll(badges=>new Set(badges.map(badge=>getComputedStyle(badge).color)).size);
 expect(colors).toBe(4);
 await mkdir('artifacts/browser',{recursive:true});
 await page.screenshot({path:'artifacts/browser/upgrade-catalogue-desktop.png'});
 await page.locator('[data-catalogue-filter="rarity"]').selectOption('legendary');
 await expect(page.locator('[data-catalogue-entry]')).toHaveCount(training.filter(entry=>entry.rarities.includes('legendary')).length);
 await page.locator('[data-catalogue-search]').fill('focus energy');
 await expect(page.locator('[data-catalogue-entry]')).toHaveCount(1);
 await expect(page.locator('[data-catalogue-entry]')).toContainText('+16% critical strike chance');
 await page.getByText('Details & progression',{exact:true}).click();
 await expect(page.locator('.catalogue-details')).toContainText('Base roll weights');
 await page.locator('[data-catalogue-reset]').first().click();
 await expect(page.locator('[data-catalogue-entry]')).toHaveCount(entryCount);
 await expect(page.locator('option[value="retired"]')).toHaveCount(0);
 await page.locator('[data-catalogue-search]').fill('Zoom Lens');
 await expect(page.locator('[data-catalogue-entry]')).toHaveCount(0);
 await expect(page.locator('.catalogue-status.retired')).toHaveCount(0);
 await page.locator('[data-catalogue-reset]').first().click();
 await page.locator('[data-catalogue-search]').pressSequentially('legendary life orb');
 await expect(page.locator('[data-catalogue-search]')).toHaveValue('legendary life orb');
 await expect(page.locator('[data-catalogue-entry]')).toHaveCount(1);
 await expect(page.locator('.catalogue-status.locked')).toHaveText('Locked');
 await page.getByText('Details & progression',{exact:true}).click();
 await expect(page.locator('.catalogue-details')).toContainText('Everyone home');
 await page.locator('[data-catalogue-search]').fill('<unmatched>');
 await expect(page.locator('.catalogue-empty')).toContainText('No upgrades match');
 await page.locator('[data-catalogue-search]').press('Escape');
 await expect(page.locator('[data-starter="1"]')).toBeVisible();
 await expect(page.locator('[data-open-catalogue]')).toBeFocused();
 expect(errors).toEqual([]);
});

test('catalogue type filters and progression details remain usable on narrow screens',async({page})=>{
 await page.setViewportSize({width:390,height:844});await openCatalogue(page);
 await page.locator('[data-catalogue-filter="group"]').selectOption('signatures');
 await page.locator('[data-catalogue-filter="element"]').selectOption('grass');
 await page.locator('[data-catalogue-search]').fill('Bulbasaur');
 await expect(page.locator('[data-catalogue-entry]')).toHaveCount(1);
 await expect(page.locator('[data-catalogue-entry]')).toContainText('Bulbasaur');
 await page.getByText('Details & progression',{exact:true}).click();
 await expect(page.locator('.catalogue-details')).toContainText('Rank 1 → 2');
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});await expectCatalogueFits(page);
 }
 await page.screenshot({path:'artifacts/browser/upgrade-catalogue-mobile.png'});
 await page.locator('[data-catalogue-reset]').first().click();
 await page.locator('[data-catalogue-filter="group"]').selectOption('learned');
 await page.locator('[data-catalogue-search]').fill('swift');
 await expect(page.locator('[data-catalogue-entry]')).toHaveCount(1);
 await page.getByText('Details & progression',{exact:true}).click();
 await expect(page.locator('.catalogue-details')).toContainText('Eligible Pokémon');
 await page.locator('[data-catalogue-results]').evaluate(element=>{element.scrollTop=element.scrollHeight;});
 await expect(page.locator('[data-catalogue-close]')).toBeInViewport();
 await page.locator('[data-catalogue-close]').click();
 await expect(page.locator('.front-page')).toBeVisible();
});

test('pause-menu browsing leaves simulation and RNG unchanged and returns to the paused run',async({page})=>{
 await page.goto('/');await page.locator('[data-starter="1"]').click();
 await page.keyboard.press('Escape');
 await expect(page.locator('#resume-btn')).toBeVisible();
 const before=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__;return {state:JSON.stringify(g.sim.state),rng:JSON.stringify(g.sim.rng)};
 });
 await page.locator('[data-open-catalogue]').click();
 await expect(page.locator('.upgrade-catalogue')).toBeVisible();
 await page.locator('[data-catalogue-filter="group"]').selectOption('evolutions');
 await page.locator('[data-catalogue-search]').fill('eevee');
 await expect(page.locator('[data-catalogue-entry]')).toHaveCount(3);
 await page.locator('[data-catalogue-search]').press('1');
 await page.locator('[data-catalogue-close]').click();
 await expect(page.locator('#resume-btn')).toBeVisible();
 expect(await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__;return {state:JSON.stringify(g.sim.state),rng:JSON.stringify(g.sim.rng)};
 })).toEqual(before);
 for(let repeat=0;repeat<2;repeat++){
  await page.locator('[data-open-catalogue]').click();await page.locator('[data-catalogue-close]').click();
 }
 await page.locator('#resume-btn').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.phase)).toBe('playing');
});
