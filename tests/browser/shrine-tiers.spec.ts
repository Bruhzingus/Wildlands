import {test,expect} from '@playwright/test';

test('nearby previews, species sculptures, tier dust and hazard warnings agree with encounters',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="7"]').click();await expect(page.locator('#overlay')).toBeHidden();
 await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,site=s.pois.find((poi:any)=>poi.kind==='shrine');
  s.pois=[site];site.shrineTier=1;s.enemies=[];s.terrainFeatures=[];s.recruitCount=5;s.player.iframes=10000;s.party[0].cooldown=10000;g.sim.spawnAccum=-10000;
  s.player.x=site.x+8;s.player.z=site.z;
 });
 await expect(page.locator('#interaction')).toContainText('Machop Shrine - 1 Machop');
 await expect(page.locator('#interaction')).toContainText('Recommended Lv 5');await expect(page.locator('#interaction .kbd')).toHaveCount(0);
 for(let tier=1;tier<=15;tier++){
  const expected=await page.evaluate(async(tier)=>{
   const {shrineDefinition}=await import('/src/data/shrines.ts' as string),definition=shrineDefinition(tier);
   const g=(window as any).__WILDLANDS__,s=g.sim.state,site=s.pois[0];s.party[0].level=definition.level;site.shrineTier=tier;
   s.player.x=site.x;s.player.z=site.z;return {speciesId:definition.speciesId,color:definition.color.toUpperCase(),level:definition.level};
  },tier);
  await expect(page.locator('#interaction')).toContainText(`Tier ${tier} · Recommended Lv ${expected.level}`);
  await expect.poll(()=>page.evaluate(()=>{
   const g=(window as any).__WILDLANDS__,site=g.sim.state.pois[0],statue=g.scene.getMeshByName(`shrine-statue-${site.uid}`),dust=g.scene.getMeshByName(`shrine-dust-${site.uid}-0`);
   return {speciesId:statue?.metadata?.speciesId,color:dust?.material?.diffuseColor.toHexString()};
  })).toEqual({speciesId:expected.speciesId,color:expected.color});
 }
 await page.evaluate(()=>{const g=(window as any).__WILDLANDS__,s=g.sim.state;s.party[0].level=13;s.pois[0].shrineTier=3;});
 await expect(page.locator('#interaction')).toContainText('Arbok Shrine - 2 Arbok + Poison');
 await page.keyboard.press('e');await expect(page.locator('#interaction')).toContainText('2 left');
 await expect.poll(()=>page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,site=g.sim.state.pois[0];return g.scene.getMeshByName(`shrine-hazard-${site.uid}-0`)?.isEnabled();
 })).toBe(true);
 await expect.poll(()=>page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,site=g.sim.state.pois[0];return g.scene.getMeshByName(`marker-ring-${site.uid}`).scaling.x;
 })).toBe(9);
 expect(errors).toEqual([]);
});
