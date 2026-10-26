import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('new relic cards show their real tradeoffs and stack across rarities in the build',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
 await page.goto('/');await page.locator('[data-starter="1"]').click();
 const show=async(id:string)=>page.evaluate(async id=>{
  // @ts-ignore Vite browser source import.
  const {availableItemChoices}=await import('/src/game/systems/progression.ts');
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  s.itemUnlocks=['expert-belt','spillstone','blood-pact','berserker-emblem'];
  s.enemies=[];s.player.hp=s.player.maxHp*.45;
  const choice=availableItemChoices(s).find((entry:any)=>entry.id===id);
  if(!choice)throw Error(`Missing relic ${id}`);
  g.sim.enterChoice([choice],'New relics','cache');g.ui.update(s);
 },id);

 await show('expert-belt');const belt=page.locator('[data-choice="expert-belt"]');
 await expect(belt).toContainText('Damage bonus vs elites / bosses');
 await expect(belt).toContainText('0% → 25%');await belt.click();
 await show('spillstone');
 await expect(page.locator('[data-choice="spillstone"]')).toContainText('20% of overkill damage');
 await page.locator('[data-choice="spillstone"]').click();

 await page.setViewportSize({width:390,height:844});await show('blood-pact');
 const pact=page.locator('[data-choice="blood-pact"]');
 await expect(pact).toContainText('15%');await expect(pact).toContainText('can be lethal');
 await expect(pact).toContainText('1× → 2×');await expect(pact).toContainText('16s → 8s');
 const layout=await pact.evaluate(card=>({width:card.clientWidth,scroll:card.scrollWidth,right:card.getBoundingClientRect().right,viewport:document.documentElement.clientWidth}));
 expect(layout.scroll).toBeLessThanOrEqual(layout.width+1);expect(layout.right).toBeLessThanOrEqual(layout.viewport);
 await mkdir('artifacts/browser',{recursive:true});
 await page.screenshot({path:'artifacts/browser/new-relics-blood-pact.png'});await pact.click();

 for(const id of ['berserker-emblem','berserker-emblem','berserker-emblem-rare']){
  await show(id);
  if(id==='berserker-emblem-rare')await expect(page.locator(`[data-choice="${id}"]`)).toContainText('40% → 70%');
  await page.locator(`[data-choice="${id}"]`).click();
 }
 const build=await page.evaluate(async()=>{
  // @ts-ignore Vite browser source import.
  const {getBuildModifiers}=await import('/src/game/systems/builds.ts');
  // @ts-ignore Vite browser source import.
  const {availableItemChoices}=await import('/src/game/systems/progression.ts');
  const g=(window as any).__WILDLANDS__,s=g.sim.state;g.sim.pause();g.ui.update(s);
  const mod=getBuildModifiers(s);
  return {copies:s.itemStacks['berserker-emblem'],power:mod.power,defense:mod.defense,speed:mod.speed,pactAvailable:availableItemChoices(s).some((choice:any)=>choice.id==='blood-pact')};
 });
 expect(build.copies).toBe(2);expect(build.power).toBeCloseTo(.7);
 expect(build.defense).toBeCloseTo(.7);expect(build.speed).toBeCloseTo(.7);expect(build.pactAvailable).toBe(false);
 await expect(page.locator('[data-item="berserker-emblem"] strong')).toContainText('×2');
 expect(errors).toEqual([]);
});
