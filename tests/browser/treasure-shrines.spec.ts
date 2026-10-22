import {test,expect} from '@playwright/test';

test('treasure tiers, spent chests and shrine trials render readable live status',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="7"]').click();
 await expect(page.locator('#overlay')).toBeHidden();
 await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  s.enemies=[];s.coins=1000;s.itemUnlocks=undefined;s.player.iframes=10000;s.party[0].cooldown=10000;g.sim.spawnAccum=-10000;
  const chest=s.pois.find((p:any)=>p.rarity==='epic');s.player.x=chest.x;s.player.z=chest.z;
 });
 await expect(page.locator('#interaction')).toContainText('EPIC chest');
 await page.keyboard.press('e');await expect(page.locator('.choice-card')).toHaveCount(3);
 await expect(page.locator('.choice-screen')).toContainText('EPIC chest');
 expect(await page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.upgradeChoices.every((c:any)=>c.kind==='item'&&c.rarity==='epic'))).toBe(true);
 await page.keyboard.press('1');await expect(page.locator('#overlay')).toBeHidden();
 await expect(page.locator('#interaction')).toContainText('Chest restocks in');
 await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,site=s.pois.find((p:any)=>p.kind==='shrine');
  s.player.x=site.x;s.player.z=site.z;
 });
 await expect(page.locator('#interaction')).toContainText('Machop Shrine - 1 Machop');
 await expect(page.locator('#interaction')).toContainText('Recommended Lv 5');
 await page.keyboard.press('e');await expect(page.locator('#interaction')).toContainText('1 left');
 expect(await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,site=s.pois.find((p:any)=>p.challenge);
  return g.scene.getMeshByName(`marker-ring-${site.uid}`).scaling.x;
 })).toBe(10);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 const before=await page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.stats.elapsed);
 await page.waitForTimeout(150);
 expect(await page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.stats.elapsed)).toBe(before);
 await page.locator('#resume-btn').click();await expect(page.locator('#overlay')).toBeHidden();
 await page.evaluate(()=>{
  const s=(window as any).__WILDLANDS__.sim.state,site=s.pois.find((p:any)=>p.challenge);
  s.player.x=site.x+25;s.player.z=site.z;
 });
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.pois.some((p:any)=>p.challenge))).toBe(false);
 expect(errors).toEqual([]);
});
