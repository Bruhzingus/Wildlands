import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

async function startSquad(page:Page){
 await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
 await page.goto('/?dev=1');
 await page.locator('[data-starter="1"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await page.evaluate(()=>{
  const s=(window as any).__WILDLANDS__.sim.state,leader=s.party[0];
  s.player.iframes=100000;s.enemies=[];
  s.party.push({...leader,uid:101,speciesId:4,joinedAt:s.stats.elapsed,level:1,xp:0,attackLevel:1,learnedMoves:[],x:1,z:1});
 });
 await expect(page.locator('.party-unit')).toHaveCount(2);
}

test('XP pickups progress each Pokémon and its earned card trains only its own move',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await startSquad(page);
 await page.evaluate(()=>{
  const s=(window as any).__WILDLANDS__.sim.state;
  s.drops.push({uid:s.idCounter++,x:s.player.x,z:s.player.z,value:20,age:0,kind:'xp'});
 });
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.party.every((member:any)=>member.xp>0))).toBe(true);
 const follower=page.locator('[data-member="101"]');
 await expect(follower.locator('.party-level')).toHaveText('L1');
 await expect(follower.locator('.party-rank')).toHaveText('R1');
 await expect(follower).toHaveAttribute('title',/Charmander · Lv 1[\s\S]*4\. Open move slot/);
 const width=await follower.locator('.party-xp').evaluate(element=>element.getBoundingClientRect().width);
 expect(width).toBeGreaterThan(0);
 const stable=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,node=document.querySelector('[data-member="101"]');
  g.sim.gainXP(12,101);g.ui.update(g.sim.state);
  return node===document.querySelector('[data-member="101"]');
 });
 expect(stable).toBe(true);
 await expect.poll(()=>follower.locator('.party-xp').evaluate(element=>element.getBoundingClientRect().width)).toBeGreaterThan(width);
 const before=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,member=s.party[1];
  const leader={level:s.party[0].level,rank:s.party[0].attackLevel,xp:s.party[0].xp};
  g.sim.gainXP(member.xpToNext-member.xp+1,member.uid);
  return leader;
 });
 await expect(page.locator('[data-level-owner="101"]')).toContainText('Charmander');
 await expect(page.locator('.choice-pokemon')).toContainText('LV 2');
 const owners=await page.locator('[data-choice-member]').evaluateAll(cards=>cards.map(card=>(card as HTMLElement).dataset.choiceMember));
 expect(owners.length).toBeGreaterThan(0);expect(owners.every(owner=>owner==='101')).toBe(true);
 const upgrade=page.locator('[data-choice^="attack-101-"]');
 await expect(upgrade).toHaveCount(1);
 await expect(upgrade.locator('.choice-owner')).toHaveText('Charmander · LV 2 · MOVE 1 / 4');
 await upgrade.focus();await page.keyboard.press('Space');
 await expect(page.locator('[data-level-owner="101"]')).toBeVisible();
 await mkdir('artifacts/browser',{recursive:true});
 await page.screenshot({path:'artifacts/browser/pokemon-progression.png'});
 await upgrade.click();
 await expect(page.locator('#overlay')).toBeHidden();
 const after=await page.evaluate(()=>{
  const s=(window as any).__WILDLANDS__.sim.state;
  return {leader:{level:s.party[0].level,rank:s.party[0].attackLevel,xp:s.party[0].xp},follower:{level:s.party[1].level,rank:s.party[1].attackLevel}};
 });
 expect(after.leader).toEqual(before);expect(after.follower).toEqual({level:2,rank:2});
 await expect(follower.locator('.party-level')).toHaveText('L2');
 await expect(follower.locator('.party-rank')).toHaveText('R2');
 expect(errors).toEqual([]);
});

test('queued individual levels change the owner without resuming combat',async({page})=>{
 await startSquad(page);
 await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  for(const member of s.party)g.sim.gainXP(member.xpToNext-member.xp+1,member.uid);
 });
 await expect(page.locator('[data-level-owner="1"]')).toContainText('Bulbasaur');
 await expect(page.locator('.choice-pokemon')).toContainText('1 more level reward');
 const frozen=await page.locator('#clock').textContent();
 await page.locator('[data-choice^="attack-1-"]').click();
 await expect(page.locator('[data-level-owner="101"]')).toContainText('Charmander');
 await expect(page.locator('#clock')).toHaveText(frozen!);
 await expect(page.locator('.choice-pokemon')).not.toContainText('more level');
 await expect(page.locator('.choice-card').first()).toBeFocused();
 await page.keyboard.press('Space');
 await expect(page.locator('[data-level-owner="101"]')).toBeVisible();
 await page.locator('[data-choice^="attack-101-"]').click();
 await expect(page.locator('#overlay')).toBeHidden();
});

test('pause shows exactly four move slots per Pokémon and fits narrow screens',async({page})=>{
 await startSquad(page);
 await page.evaluate(()=>{
  const s=(window as any).__WILDLANDS__.sim.state;
  s.party[0].learnedMoves=[{moveId:'seed-bomb',rank:2,cooldown:0},{moveId:'solar-beam',rank:3,cooldown:0},{moveId:'swift',rank:1,cooldown:0}];
 });
 await page.keyboard.press('Escape');
 const summaries=page.locator('.pokemon-summary');
 await expect(summaries).toHaveCount(2);
 await expect(summaries.first()).toContainText('4 / 4 MOVES');
 await expect(summaries.first().locator('.pokemon-move-slot')).toHaveCount(4);
 await expect(summaries.first().locator('.move-slot-rank')).toHaveText(['RANK 1','RANK 2','RANK 3','RANK 1']);
 await expect(summaries.nth(1).locator('.pokemon-move-slot.empty')).toHaveCount(3);
 await expect(summaries.first()).toContainText('LV 1');
 await expect(summaries.first()).toContainText('XP');
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});
  const fits=await summaries.evaluateAll(elements=>elements.every(element=>{
   const bounds=element.getBoundingClientRect();
   return bounds.left>=0&&bounds.right<=document.documentElement.clientWidth&&element.scrollWidth<=element.clientWidth;
  }));
  expect(fits).toBe(true);
  for(const slot of await page.locator('.pokemon-move-slot').all()){
   const dimensions=await slot.evaluate(element=>({width:element.clientWidth,scroll:element.scrollWidth}));
   expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  }
  expect(await page.locator('#overlay-content').evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
  if(width===390){await mkdir('artifacts/browser',{recursive:true});await page.screenshot({path:'artifacts/browser/pokemon-moves-mobile.png'});}
 }
});
