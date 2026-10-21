import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const game=(page:Page,expression:string)=>page.evaluate(expression=>new Function('g',`return (${expression})(g)`)((window as any).__WILDLANDS__),expression);
const captured=async(page:Page)=>{await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');await expect(page.locator('#overlay')).toBeHidden();};
const start=async(page:Page)=>{await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();await captured(page);await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBe(true);await mkdir('artifacts/browser',{recursive:true});};
const screenshotPaused=async(page:Page,path:string)=>{await page.locator('#overlay').evaluate(el=>(el as HTMLElement).style.visibility='hidden');await page.screenshot({path});await page.locator('#overlay').evaluate(el=>(el as HTMLElement).style.visibility='');};

test('four biomes and optional discoveries have grounded landmarks and a readable north-up map',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await start(page);
 await game(page,'g=>{g.sim.state.enemies=[];g.sim.state.player.iframes=10000;g.sim.spawnAccum=-1000;g.sim.state.stats.xpToNext=1e12;}');
 for(const region of [{name:'OPEN MEADOW',x:0,z:0,file:'meadow'},{name:'PINEWOOD',x:-55,z:-44,file:'woodland'},{name:'OLD RUINS',x:61,z:-49,file:'ruins'},{name:'LAKE EDGE',x:-75,z:67,file:'lake'}]){
  await page.evaluate(async region=>{const {worldPoint,worldProfile}=await import('/src/data/maps.ts'),g=(window as any).__WILDLANDS__,s=g.sim.state,point=worldPoint(region,worldProfile(s.seed,s.mapId));s.player.x=point.x;s.player.z=point.z;s.party[0].x=point.x;s.party[0].z=point.z;g.camera.radius=30;g.camera.beta=1.02;},region);
  await expect(page.locator('#map-region')).toHaveText(region.name);await page.waitForTimeout(200);
  await page.screenshot({path:`artifacts/browser/phase-map-${region.file}.png`});
 }
 expect(await page.locator('#minimap').evaluate((el:any)=>Number(el.dataset.markers))).toBeGreaterThan(10);
 expect(await game(page,'g=>g.scene.meshes.filter(m=>m.name.startsWith("great-pine")||m.name.startsWith("gate-pillar")||m.name.startsWith("watchstone")).length')).toBe(6);
 await game(page,'g=>{const s=g.sim.state,p=s.pois.find(p=>p.kind==="cache");s.player.x=p.x;s.player.z=p.z;s.party[0].x=p.x;s.party[0].z=p.z;}');
 await expect(page.locator('#interaction')).toContainText('Open discovery cache');await page.keyboard.press('e');await expect(page.locator('.choice-card')).toHaveCount(3);
 const snapshot=await game(page,'g=>JSON.stringify(g.sim.state)');await page.waitForTimeout(150);expect(await game(page,'g=>JSON.stringify(g.sim.state)')).toBe(snapshot);
 expect(await game(page,'g=>g.sim.state.pois.find(p=>p.kind==="cache").used')).toBe(true);
 await page.keyboard.press('1');await captured(page);expect(await game(page,'g=>g.sim.state.items.length')).toBe(1);
 await page.keyboard.press('Escape');await expect(page.locator('.variant-key')).toContainText('Rocket');expect(errors).toEqual([]);
});

test('legendary approach warns before fifteen minutes and Mewtwo gets a readable boss bar',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await start(page);
 await game(page,'g=>{const s=g.sim.state;s.stats.elapsed=885;s.enemies=[];s.player.iframes=10000;s.stats.xpToNext=1e12;g.sim.spawnAccum=-1000;}');
 await expect(page.locator('#danger')).toContainText('MEWTWO APPROACHES');await expect(page.locator('#toast')).toContainText('psychic presence');
 await game(page,'g=>{g.sim.state.stats.elapsed=899.99;}');await expect(page.locator('#boss-bar')).toBeVisible();
 expect(await game(page,'g=>g.sim.state.enemies.filter(e=>e.isBoss&&e.speciesId===150).length')).toBe(1);
 const hp=await page.locator('#boss-hp-fill').evaluate(el=>el.style.width);expect(hp).toBe('100%');
 await page.screenshot({path:'artifacts/browser/phase-mewtwo-arrival.png'});expect(errors).toEqual([]);
});

test('psychic rings and summon tells freeze, resolve visibly and victory retains the build into endless',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await start(page);
 await page.evaluate(async()=>{
  const {createEnemy}=await import('/src/game/systems/spawning.ts'),g=(window as any).__WILDLANDS__,s=g.sim.state;
  s.stats.elapsed=900;s.stats.xpToNext=1e12;s.bossSpawned=true;s.phase='boss';s.player.iframes=10000;s.party[0].cooldown=10000;g.sim.spawnAccum=-1000;
  const boss=createEnemy(s,g.sim.rng,150,'legendary',s.player.x+12,s.player.z+4,true,true);
  Object.assign(boss,{speed:0,hp:100000,maxHp:100000,bossCycle:1,attackCooldown:0,hitCooldown:10000});s.enemies=[boss];
 });
 await expect(page.locator('#boss-action')).toContainText('PSYCHIC');await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 const warning=await game(page,'g=>JSON.stringify(g.sim.state)');await page.waitForTimeout(150);expect(await game(page,'g=>JSON.stringify(g.sim.state)')).toBe(warning);
 await screenshotPaused(page,'artifacts/browser/phase-mewtwo-ring-tell.png');await page.locator('#resume-btn').click();await captured(page);
 await expect.poll(()=>game(page,'g=>g.fx.inspect().psychicRings')).toBe(1);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 const ring=await game(page,'g=>g.sim.state.psychicRings[0].radius');await page.waitForTimeout(180);expect(await game(page,'g=>g.sim.state.psychicRings[0].radius')).toBe(ring);
 await screenshotPaused(page,'artifacts/browser/phase-mewtwo-ring.png');await page.locator('#resume-btn').click();await captured(page);
 await game(page,'g=>{const e=g.sim.state.enemies.find(e=>e.isBoss);e.attackCooldown=0;e.bossCycle=2;}');
 await expect(page.locator('#boss-action')).toContainText('TELEPORT');await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 await screenshotPaused(page,'artifacts/browser/phase-mewtwo-summon-tell.png');
 const frozen=await game(page,'g=>JSON.stringify(g.sim.state)');await page.waitForTimeout(150);expect(await game(page,'g=>JSON.stringify(g.sim.state)')).toBe(frozen);
 await page.locator('#resume-btn').click();await captured(page);await expect.poll(()=>game(page,'g=>g.sim.state.enemies.filter(e=>!e.isBoss).length')).toBe(4);
 await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,e=s.enemies.find((e:any)=>e.isBoss);
  s.party.push({...s.party[0],uid:s.idCounter++,speciesId:7,hp:95,maxHp:155,attackLevel:4,cooldown:10000});
  s.items=['wide-lens','echo-bell'];s.player.hp=77;s.player.specialCooldown=0;e.hp=1;e.x=s.player.x+2;e.z=s.player.z;
 });
 await page.keyboard.press('q');await expect(page.locator('#endless-btn')).toBeVisible();await expect(page.locator('.end-screen')).toContainText('Victory');
 const before=await game(page,'g=>({hp:g.sim.state.player.hp,items:g.sim.state.items,party:g.sim.state.party.map(m=>({uid:m.uid,speciesId:m.speciesId,hp:m.hp,attackLevel:m.attackLevel}))})');
 await page.screenshot({path:'artifacts/browser/phase-mewtwo-victory.png'});await game(page,'g=>g.engine.stopRenderLoop()');await page.locator('#endless-btn').click();await captured(page);
 const after=await game(page,'g=>({hp:g.sim.state.player.hp,items:g.sim.state.items,party:g.sim.state.party.map(m=>({uid:m.uid,speciesId:m.speciesId,hp:m.hp,attackLevel:m.attackLevel}))})');
 expect(after.hp).toBe(before.hp);expect(after.items).toEqual(before.items);expect(after.party.map((m:any)=>({uid:m.uid,speciesId:m.speciesId,attackLevel:m.attackLevel}))).toEqual(before.party.map((m:any)=>({uid:m.uid,speciesId:m.speciesId,attackLevel:m.attackLevel})));
 expect(after.party[1].hp).toBeGreaterThanOrEqual(before.party[1].hp);expect(after.party[1].hp-before.party[1].hp).toBeLessThan(.2);
 expect(await game(page,'g=>g.sim.state.director.phaseId')).toBe('endless');expect(await game(page,'g=>g.sim.state.psychicRings.length')).toBe(0);expect(errors).toEqual([]);
});
