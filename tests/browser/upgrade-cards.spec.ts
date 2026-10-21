import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

async function showUpgradeChoices(page:Page){
 await page.route('**/assets/pokemon/**',route=>route.abort());
 await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
 await page.goto('/');
 await page.locator('[data-starter="1"]').click();
 return page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  s.choiceTitle='Choose an upgrade';s.stats.level=21;
  s.upgradeChoices=[
   {id:'stat-rarity-test',kind:'stat',stat:'damage',amount:.1,title:'Power',description:'Increase the damage of every move by 10%.',rarity:'common',rank:2,maxRank:5},
   {id:'item-rarity-test',kind:'item',title:'Lucky Egg',description:'A passive relic that helps your squad gain experience faster.',rarity:'rare'},
   {id:'evolve-rarity-test',kind:'evolve',speciesId:s.party[0].uid,targetId:2,title:'Evolve Bulbasaur',description:'Evolve into Ivysaur, strengthening its attacks and health.',rarity:'epic'},
  ];s.phase='choice';g.ui.update(s);
  return Array.from(document.querySelectorAll('.choice-card'),card=>card.getAnimations().map(animation=>({delay:Number(animation.effect?.getTiming().delay),state:animation.playState})));
 });
}

async function expectCardsToFit(page:Page){
 const layout=await page.locator('.choice-card').evaluateAll(cards=>({
  viewport:document.documentElement.clientWidth,
  bodyWidth:document.body.scrollWidth,
  cards:cards.map(card=>{
   const frame=card.getBoundingClientRect(),label=card.querySelector('.rarity-label')!.getBoundingClientRect();
   return {left:frame.left,right:frame.right,scrollWidth:card.scrollWidth,width:card.clientWidth,labelLeft:label.left,labelRight:label.right,labelTop:label.top,labelBottom:label.bottom,top:frame.top,bottom:frame.bottom};
  }),
 }));
 expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewport);
 for(const card of layout.cards){
  expect(card.left).toBeGreaterThanOrEqual(0);expect(card.right).toBeLessThanOrEqual(layout.viewport);
  expect(card.scrollWidth).toBeLessThanOrEqual(card.width+1);
  expect(card.labelLeft).toBeGreaterThanOrEqual(card.left);expect(card.labelRight).toBeLessThanOrEqual(card.right);
  expect(card.labelTop).toBeGreaterThanOrEqual(card.top);expect(card.labelBottom).toBeLessThanOrEqual(card.bottom);
 }
}

test('reroll button replaces all cards in their rarity slots and stops at zero charges',async({page})=>{
 await page.goto('/');
 await page.locator('[data-starter="1"]').click();
 const before=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  s.upgradeChoices=[
   {id:'power',kind:'stat',stat:'power',amount:.12,title:'Swords Dance',description:'+12% damage.',rarity:'common'},
   {id:'haste-rare',kind:'stat',stat:'haste',amount:.2,title:'Tailwind',description:'+20% attack speed.',rarity:'rare'},
   {id:'speed-epic',kind:'stat',stat:'speed',amount:.36,title:'Agility',description:'+36% movement speed.',rarity:'epic'},
  ];s.stats.elapsed=0;s.choiceSource='squad';s.phase='choice';g.ui.update(s);
  return s.upgradeChoices.map((c:any)=>c.id);
 });
 const reroll=page.locator('[data-reroll]');
 await expect(reroll).toHaveText('Reroll (2)');await expect(reroll).toBeEnabled();
 await reroll.click();await expect(reroll).toHaveText('Reroll (1)');
 await expect(page.locator('.rarity-label')).toHaveText(['COMMON','RARE','EPIC']);
 const after=await page.locator('[data-choice]').evaluateAll(cards=>cards.map(card=>(card as HTMLElement).dataset.choice));
 expect(after.every(id=>!before.includes(id))).toBe(true);
 await reroll.click();await expect(reroll).toHaveText('Reroll (0)');await expect(reroll).toBeDisabled();
 await expect(page.locator('.choice-screen')).toContainText('Next in 05:00');
 expect(await page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.phase)).toBe('choice');
});

test('upgrade cards show each rarity, enter in sequence, lift on hover and fit small screens',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const entryAnimations=await showUpgradeChoices(page);
 const cards=page.locator('.choice-card');await expect(cards).toHaveCount(3);
 expect(entryAnimations.every(animations=>animations.some(animation=>animation.state==='running'))).toBe(true);
 const delays=entryAnimations.map(animations=>Math.max(...animations.map(animation=>animation.delay)));
 expect(delays[1]).toBeGreaterThan(delays[0]);expect(delays[2]).toBeGreaterThan(delays[1]);
 await expect(page.locator('.rarity-label')).toHaveText(['COMMON','RARE','EPIC']);
 for(const label of await page.locator('.rarity-label').all())await expect(label).toBeVisible();
 await expect(page.locator('.upgrade-pokemon')).toHaveAttribute('alt','Ivysaur');
 await expect(page.locator('.choice-rank')).toHaveText('RANK 2');
 const badgeColors=await page.locator('.choice-rarity').evaluateAll(badges=>badges.map(badge=>getComputedStyle(badge).color));
 expect(new Set(badgeColors).size).toBe(3);
 const frameColors=await cards.evaluateAll(elements=>elements.map(element=>getComputedStyle(element).borderLeftColor));
 expect(new Set(frameColors).size).toBe(3);
 await expect.poll(()=>cards.evaluateAll(elements=>elements.every(element=>element.getAnimations().every(animation=>animation.playState!=='running'&&!animation.pending)))).toBe(true);
 for(const card of await cards.all())await expect(card).toHaveCSS('opacity','1');
 await expectCardsToFit(page);
 await mkdir('artifacts/browser',{recursive:true});
 await page.screenshot({path:'artifacts/browser/upgrade-cards-desktop.png'});
 const hoverCard=cards.nth(1),restingY=(await hoverCard.boundingBox())!.y;
 await hoverCard.hover();
 await expect.poll(async()=>(await hoverCard.boundingBox())!.y).toBeLessThan(restingY-1);
 await page.mouse.move(0,0);
 await expect.poll(async()=>Math.abs((await hoverCard.boundingBox())!.y-restingY)).toBeLessThan(1);
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});
  await expectCardsToFit(page);
  for(const label of await page.locator('.rarity-label').all())await expect(label).toBeVisible();
  if(width===390)await page.screenshot({path:'artifacts/browser/upgrade-cards-mobile.png'});
 }
 expect(errors).toEqual([]);
});

test('reduced motion keeps upgrade cards still on arrival and hover',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 const entryAnimations=await showUpgradeChoices(page);
 expect(entryAnimations.every(animations=>animations.length===0)).toBe(true);
 const card=page.locator('.choice-card').nth(1);
 const resting=await card.boundingBox();
 await expect(card).toHaveCSS('opacity','1');
 await card.hover();
 await expect(card).toHaveCSS('transform','none');
 const hovered=await card.boundingBox();
 expect(hovered!.y).toBeCloseTo(resting!.y,1);
 expect(hovered!.width).toBeCloseTo(resting!.width,1);
 await expectCardsToFit(page);
});

test('real solo rewards prioritize training and show stronger versions with uncapped rank labels',async({page})=>{
 await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
 await page.goto('/');await page.locator('[data-starter="1"]').click();
 const early=await page.evaluate(async()=>{
  // @ts-ignore Vite resolves browser source imports.
  const {makeChoices}=await import('/src/game/systems/progression.ts');
  // @ts-ignore Vite resolves browser source imports.
  const {RNG}=await import('/src/utils/random.ts');
  const g=(window as any).__WILDLANDS__,s=g.sim.state;s.party[0].level=3;s.itemUnlocks=['exp-share'];
  const choices=makeChoices(s,new RNG(79)),cache=makeChoices(s,new RNG(79),'cache');
  const variants=new Map();
  for(let seed=1;seed<=300;seed++)for(const choice of makeChoices(s,new RNG(seed*7919),'squad')){
   if(choice.stat==='power')variants.set(choice.rarity,choice);
  }
  g.sim.enterChoice(['common','rare','epic'].map(rarity=>variants.get(rarity)),'Training rarities','squad');
  return {kinds:choices.map((choice:any)=>choice.kind),cacheIds:cache.map((choice:any)=>choice.id)};
 });
 expect(early.kinds).toContain('attack');expect(early.kinds).toContain('stat');expect(early.kinds).not.toContain('learn');
 expect(early.cacheIds).not.toContain('exp-share');
 await expect(page.locator('.choice-rank')).toHaveText(['RANK 1','RANK 1','RANK 1']);
 await expect(page.locator('.choice-owner')).toHaveText(['YOUR POKÉMON','YOUR POKÉMON','YOUR POKÉMON']);
 await expect(page.locator('.choice-card p')).toHaveText([
  '+12% attack damage, including learned moves.',
  '+24% attack damage, including learned moves.',
  '+36% attack damage, including learned moves.',
 ]);
 await page.locator('[data-choice="power-rare"]').click();
 expect(await page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.buffs.power)).toBe(.24);
});
