import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const game=(page:Page,expression:string)=>page.evaluate(expression=>new Function('g',`return (${expression})(g)`)((window as any).__WILDLANDS__),expression);
const captured=async(page:Page)=>{await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');await expect(page.locator('#overlay')).toBeHidden();};
const start=async(page:Page)=>{await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();await captured(page);};

test('chain, area and critical projectile builds have distinct visuals and readable summaries',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await mkdir('artifacts/browser',{recursive:true});
 const cases=[
  {name:'storm',species:[25,81,7],items:['storm-coil','static-orb','scope-lens','multi-lens'],synergy:'Storm Circuit'},
  {name:'area',species:[6,92,1],items:['wide-lens','iron-ball','long-barrel'],synergy:'Wide Front'},
  {name:'critical',species:[7,63,133],items:['scope-lens','razor-claw','multi-lens','piercing-fang'],synergy:'Critical Volley'},
 ];
 for(const fixture of cases){
  await start(page);
  await page.evaluate(fixture=>{
   const g=(window as any).__WILDLANDS__,s=g.sim.state,leader=s.party[0],enemy=s.enemies[0];
   s.party=fixture.species.map((speciesId,index)=>({...leader,uid:index===0?leader.uid:s.idCounter++,speciesId,x:index*1.5,z:0,cooldown:0,attackLevel:4}));
   s.items=fixture.items;s.buffs={crit:.6};s.stats.xp=0;s.player.iframes=10000;
   s.enemies=Array.from({length:8},(_,index)=>({...enemy,uid:s.idCounter++,speciesId:19,x:-4+index*1.7,z:fixture.name==='critical'?12:4,hp:100000,maxHp:100000,speed:0,stunTime:10000,dead:false}));
   g.__phaseEvents=[];const listener=g.sim.onEvent;
   g.sim.onEvent=(event:any)=>{listener(event);if(g.__phaseEvents.length<300)g.__phaseEvents.push(event);};
  },fixture);
  if(fixture.name==='storm')await expect.poll(()=>game(page,'g=>g.__phaseEvents.some(e=>e.kind==="chain")')).toBe(true);
  if(fixture.name==='area')await expect.poll(()=>game(page,'g=>g.__phaseEvents.some(e=>e.shape==="burst"||e.shape==="aura")')).toBe(true);
  if(fixture.name==='critical')await expect.poll(()=>game(page,'g=>g.sim.state.projectiles.some(p=>p.friendly&&p.crit)')).toBe(true);
  await page.screenshot({path:`artifacts/browser/phase-${fixture.name}.png`});
  expect(await game(page,'g=>g.fx.inspect().allocated')).toBeLessThanOrEqual(520);
  expect(await game(page,'g=>g.fx.inspect().effects')).toBeLessThanOrEqual(80);
  await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
  await expect(page.locator('.build-summary')).toContainText(fixture.synergy);
  for(const item of fixture.items)await expect(page.locator(`[data-item="${item}"]`)).toBeVisible();
  const state=await game(page,'g=>JSON.stringify(g.sim.state)');await page.waitForTimeout(160);
  expect(await game(page,'g=>JSON.stringify(g.sim.state)')).toBe(state);
  await page.screenshot({path:`artifacts/browser/phase-${fixture.name}-summary.png`});
 }
 expect(errors).toEqual([]);
});

test('recruitment gates, explicit evolution branches and upgrade capture work in the game',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await start(page);
 await game(page,'g=>{const s=g.sim.state;s.stats.elapsed=164;s.stats.level=4;s.stats.xp=0;s.enemies=[];s.player.iframes=10000;}');
 await page.keyboard.press('[');await expect(page.locator('.choice-card')).toHaveCount(3);
 expect(await game(page,'g=>g.sim.state.upgradeChoices.some(c=>c.kind==="recruit")')).toBe(false);
 await page.keyboard.press('1');await captured(page);
 await game(page,'g=>{g.sim.state.stats.elapsed=165;g.sim.state.stats.level=4;g.sim.state.stats.xp=0;}');
 await page.keyboard.press('[');await expect(page.locator('.choice-card')).toHaveCount(3);
 expect(await game(page,'g=>g.sim.state.upgradeChoices.every(c=>c.kind==="recruit")')).toBe(true);
 await page.keyboard.press('1');
 expect(await game(page,'g=>g.sim.state.party.length')).toBe(2);
 await expect(page.locator('[data-level-owner="1"]')).toBeVisible();
 await expect(page.locator('.choice-pokemon')).toContainText('LV 5');
 await page.locator('.choice-card').first().click();await captured(page);
 await page.evaluate(async()=>{
  const {makeChoices}=await import('/src/game/systems/progression.ts');
  const {RNG}=await import('/src/utils/random.ts');
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  s.party=[s.party[0]];s.party[0].speciesId=133;s.party[0].level=5;s.party[0].joinedAt=0;s.party[0].evolvedAt=undefined;s.stats.elapsed=500;s.stats.level=13;s.recruitCount=3;s.enemies=[];
  g.sim.enterChoice(makeChoices(s,new RNG(1)));
 });
 await expect(page.locator('.choice-card')).toHaveCount(4);
 await expect(page.locator('.choices')).toContainText('Vaporeon');await expect(page.locator('.choices')).toContainText('Jolteon');await expect(page.locator('.choices')).toContainText('Flareon');
 await page.locator('[data-choice$="-135"]').click();await captured(page);
 expect(await game(page,'g=>g.sim.state.party[0].speciesId')).toBe(135);
 await page.keyboard.press('[');await expect(page.locator('.choice-card')).toHaveCount(3);
 expect(await game(page,'g=>g.sim.state.upgradeChoices.some(c=>[134,135,136].includes(c.targetId))')).toBe(false);
 expect(errors).toEqual([]);
});

test('boss windups have authoritative frozen warnings and resolve after Resume',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await start(page);
 await game(page,`g=>{
  const s=g.sim.state,e=s.enemies[0],p=s.player;s.bossSpawned=true;s.stats.elapsed=900;s.phase='boss';
  s.enemies=[{...e,speciesId:150,isBoss:true,elite:true,size:4.4,x:p.x+12,z:p.z+4,speed:0,stunTime:0,attackCooldown:0,hp:100000,maxHp:100000}];
  s.party[0].cooldown=10000;p.iframes=10000;
 }`);
 await expect.poll(()=>game(page,'g=>Boolean(g.sim.state.enemies[0].windup)')).toBe(true);
 await expect.poll(()=>game(page,'g=>g.fx.inspect().windups')).toBe(1);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 const state=await game(page,'g=>JSON.stringify(g.sim.state)'),visuals=await game(page,'g=>g.fx.inspect()');
 await page.waitForTimeout(200);expect(await game(page,'g=>JSON.stringify(g.sim.state)')).toBe(state);expect(await game(page,'g=>g.fx.inspect()')).toEqual(visuals);
 await page.locator('#overlay').evaluate(element=>element.classList.add('hidden'));
 await page.screenshot({path:'artifacts/browser/phase-boss-windup.png'});
 await page.locator('#overlay').evaluate(element=>element.classList.remove('hidden'));
 await page.locator('#resume-btn').click();await captured(page);
 await expect.poll(()=>game(page,'g=>g.sim.state.projectiles.some(p=>!p.friendly&&p.silhouette)')).toBe(true);
 await page.screenshot({path:'artifacts/browser/phase-boss-volley.png'});
 expect(await game(page,'g=>g.sim.state.player.hp')).toBe(120);
 expect(errors).toEqual([]);
});
