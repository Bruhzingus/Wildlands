import {test,expect} from '@playwright/test';

test('haste previews actual faster cadence and repeat relics apply and display their copy counts',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
 await page.goto('/');await page.locator('[data-starter="1"]').click();
 const before=await page.evaluate(async()=>{
  // @ts-ignore Vite browser source module.
  const {makeChoices}=await import('/src/game/systems/progression.ts');
  // @ts-ignore Vite browser source module.
  const {RNG}=await import('/src/utils/random.ts');
  // @ts-ignore Vite browser source module.
  const {getAttackProfile}=await import('/src/data/attacks.ts');
  // @ts-ignore Vite browser source module.
  const {attackInterval}=await import('/src/game/combat/cadence.ts');
  const g=(window as any).__WILDLANDS__,s=g.sim.state;s.buffs.haste=10;
  let card;const rng=new RNG(4207);
  for(let roll=0;roll<10000&&!card;roll++)card=makeChoices(s,rng,'squad').find((choice:any)=>choice.stat==='haste'&&choice.rarity==='legendary');
  g.sim.enterChoice([card],'Attack speed','squad');
  return attackInterval(getAttackProfile(s.party[0].speciesId).cooldown,10);
 });
 const card=page.locator('[data-choice="haste-legendary"]');
 await expect(card).toContainText('+40% attack speed');await expect(card).toContainText('1000% → 1040%');
 await expect(card).toContainText('/ sec');await expect(card).not.toContainText('strengthens hits');
 await card.click();
 const after=await page.evaluate(async()=>{
  // @ts-ignore Vite browser source module.
  const {getAttackProfile}=await import('/src/data/attacks.ts');
  // @ts-ignore Vite browser source module.
  const {attackInterval}=await import('/src/game/combat/cadence.ts');
  const s=(window as any).__WILDLANDS__.sim.state;
  return attackInterval(getAttackProfile(s.party[0].speciesId).cooldown,s.buffs.haste);
 });
 expect(after).toBeLessThan(before);expect(after).toBeLessThan(.2);
 for(const [index,id] of ['leftovers','leftovers','leftovers-legendary'].entries()){
  await page.evaluate(async id=>{
   // @ts-ignore Vite browser source module.
   const {availableItemChoices}=await import('/src/game/systems/progression.ts');
   const g=(window as any).__WILDLANDS__,s=g.sim.state;s.itemUnlocks=['leftovers'];
   g.sim.enterChoice([availableItemChoices(s).find((choice:any)=>choice.id===id)],'Stack relics','cache');
  },id);
  if(index===1)await expect(page.locator('.choice-preview')).toContainText('1 → 2');
  await page.locator(`[data-choice="${id}"]`).click();
 }
 const build=await page.evaluate(async()=>{
  // @ts-ignore Vite browser source module.
  const {getBuildModifiers}=await import('/src/game/systems/builds.ts');
  const g=(window as any).__WILDLANDS__,s=g.sim.state;g.sim.pause();g.ui.update(s);
  return {count:s.itemStacks.leftovers,legendary:s.itemStacks['leftovers-legendary'],recovery:getBuildModifiers(s).regenerationPercent,ids:s.items};
 });
 expect(build.count).toBe(2);expect(build.legendary).toBe(1);expect(build.recovery).toBeCloseTo(.016);
 expect(build.ids.filter((id:string)=>id==='leftovers')).toHaveLength(1);
 await expect(page.locator('[data-item="leftovers"] strong')).toContainText('×2');
 await page.screenshot({path:'artifacts/browser/n3-stacked-build.png'});
 expect(errors).toEqual([]);
});
