import {test,expect} from '@playwright/test';

test('evolution animates in the world while the run continues',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="4"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await page.evaluate(()=>{
  const game=(window as any).__WILDLANDS__,sim=game.sim,s=sim.state,member=s.party[0];
  member.level=30;member.joinedAt=0;s.stats.elapsed=600;s.recruitCount=5;s.player.iframes=100;
  s.pendingSquadRewards=1;
  sim.enterChoice([{id:`evolve-${member.uid}-5`,kind:'evolve',speciesId:member.uid,sourceSpeciesId:4,targetId:5,title:'Evolve',description:'',rarity:'epic'}]);
 });
 await expect(page.locator('[data-choice="evolve-1-5"]')).toBeVisible();
 await page.evaluate(()=>{
  (window as any).__evolutionPauseSeen=false;
  new MutationObserver(()=>{if(document.querySelector('.pause-screen'))(window as any).__evolutionPauseSeen=true;})
   .observe(document.querySelector('#overlay-content')!,{childList:true,subtree:true});
 });
 await page.locator('[data-choice="evolve-1-5"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect(page.locator('#overlay')).toBeHidden();
 await expect(page.locator('#evolution-announcement')).toContainText('Charmeleon');
 expect(await page.evaluate(()=>(window as any).__evolutionPauseSeen)).toBe(false);
 await expect.poll(()=>page.evaluate(()=>{
  const game=(window as any).__WILDLANDS__;
  return game.scene.meshes.filter((mesh:any)=>mesh.name.startsWith('evolution-ring-')).length;
 })).toBe(2);
 const before=await page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.stats.elapsed);
 const startX=await page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.player.x);
 await page.keyboard.down('d');await page.waitForTimeout(180);await page.keyboard.up('d');
 expect(Math.abs((await page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.player.x))-startX)).toBeGreaterThan(.1);
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.stats.elapsed)).toBeGreaterThan(before+.3);
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.phase)).toBe('choice');
 await expect(page.locator('#evolution-announcement')).toBeHidden();
 await expect(page.locator('.choice-card')).toHaveCount(3);
 expect(await page.evaluate(()=>(window as any).__evolutionPauseSeen)).toBe(false);
 expect(errors).toEqual([]);
});
