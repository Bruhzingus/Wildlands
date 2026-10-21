import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const game=(page:Page,expression:string)=>page.evaluate(expression=>new Function('g',`return (${expression})(g)`)((window as any).__WILDLANDS__),expression);
const captured=async(page:Page)=>{await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');await expect(page.locator('#overlay')).toBeHidden();};
async function start(page:Page,map='wildlands',seed=4){
 await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
 await page.addInitScript(seed=>{Date.now=()=>seed;},seed);
 await page.goto('/?dev=1');
 await page.locator('[data-run-map]').selectOption(map);await page.locator('[data-starter="4"]').click();await captured(page);
 expect(await game(page,'g=>g.sim.state.seed')).toBe(seed);
 await game(page,'g=>{const s=g.sim.state;s.enemies=[];s.drops=[];s.player.iframes=10000;s.party[0].cooldown=10000;s.recruitCount=5;g.sim.spawnAccum=-10000;}');
 await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBe(true);
 await mkdir('artifacts/browser',{recursive:true});
}
async function offer(page:Page,from:number,to:number,follower=false,queued=false){
 await page.evaluate(async({from,to,follower,queued})=>{
  const {makeChoices}=await import('/src/game/systems/progression.ts'),{RNG}=await import('/src/utils/random.ts');
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  if(s.phase==='playing'||s.phase==='boss')g.sim.pause();
  if(follower&&s.party.length===1)s.party.push({...structuredClone(s.party[0]),uid:101,x:3,z:1});
  const m=s.party[follower?1:0];s.stats.elapsed=600;s.levelUpMemberId=m.uid;s.pendingLevelUps=[];s.pendingSquadRewards=queued?1:0;
  Object.assign(m,{speciesId:from,joinedAt:0,evolvedAt:0,level:30,xp:17,hp:80,maxHp:160,attackLevel:3,animation:'idle',attackTimer:0,
   learnedMoves:from===4?[{moveId:'swift',rank:1,cooldown:2},{moveId:'flame-burst',rank:5,cooldown:3}]:[]});
  s.player.hp=s.player.maxHp/2;
  g.sim.enterChoice(makeChoices(s,new RNG(1)));g.ui.update(s);
  g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z));
 },{from,to,follower,queued});
 await expect(page.locator(`[data-choice="evolve-${follower?101:1}-${to}"]`)).toBeVisible();
}

test('evolution holds a slow sheet, freezes authority, reports real merged gains and resumes through a gesture',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 await page.route('**/assets/pmd/0005/**',async route=>{await new Promise(resolve=>setTimeout(resolve,900));await route.continue();});
 await offer(page,4,5);
 await page.screenshot({path:'artifacts/browser/n2-before-choice.png'});
 const cues=await game(page,'g=>g.audio.inspect().cues.evolve??0');
 await page.locator('[data-choice="evolve-1-5"]').click();
 await expect(page.locator('.evolution-screen')).toContainText('Charmeleon');
 await expect(page.locator('.evolution-gains')).toContainText('120 → 150');
 await expect(page.locator('.evolution-moves')).toContainText('Flame Burst');
 await expect(page.locator('.evolution-moves')).toContainText('1 move slot freed');
 expect(await game(page,'g=>g.sim.state.phase')).toBe('paused');expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();
 const frozen=await game(page,'g=>JSON.stringify(g.sim.state)');
 await expect.poll(()=>game(page,'g=>g.visuals.inspectEvolutions().some(e=>e.old?.speciesId===4&&e.next?.speciesId===5)')).toBe(true);
 await page.screenshot({path:'artifacts/browser/n2-transformation.png'});
 await page.keyboard.press('1');await page.keyboard.press('q');await page.waitForTimeout(250);
 expect(await game(page,'g=>JSON.stringify(g.sim.state)')).toBe(frozen);
 await expect.poll(()=>game(page,'g=>g.visuals.inspectEvolutions().length')).toBe(0);
 await expect.poll(()=>game(page,'g=>g.visuals.inspect().find(a=>a.uid===1)?.resolved')).toBe('Idle');
 expect(await game(page,'g=>g.audio.inspect().cues.evolve')).toBe(cues+1);
 expect(await game(page,'g=>g.audio.inspect().voices')).toBe(0);
 await page.screenshot({path:'artifacts/browser/n2-after-evolution.png'});
 await page.locator('#evolution-continue').focus();await page.keyboard.press('Enter');await captured(page);
 expect(await game(page,'g=>g.sim.state.stats.evolutions')).toBe(1);expect(errors).toEqual([]);
});

test('first/final, follower and every Eevee branch preserve queued rewards and reduced-motion presentation',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await start(page);
 for(const [from,to,follower] of [[5,6,true],[133,134,false],[133,135,true],[133,136,false]] as const){
  await offer(page,from,to,follower,true);
  await page.locator(`[data-choice="evolve-${follower?101:1}-${to}"]`).click();
  await expect(page.locator('#evolution-continue')).toHaveText('Next reward');
  expect(await page.locator('.evolution-after').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  const frozen=await game(page,'g=>JSON.stringify(g.sim.state)');await page.waitForTimeout(180);expect(await game(page,'g=>JSON.stringify(g.sim.state)')).toBe(frozen);
  await page.locator('#evolution-continue').click();await expect(page.locator('.choice-card').first()).toBeVisible();
  expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();
  await page.locator('.choice-card').first().click();await captured(page);
  expect(await game(page,`g=>g.sim.state.party[${follower?1:0}].speciesId`)).toBe(to);
 }
});

test('missing evolution art stays visible and restarting a pending transformation releases sprites and sound',async({page})=>{
 await start(page);await page.route('**/assets/pmd/0005/**',route=>route.abort());await page.route('**/assets/pokemon/5.png',route=>route.abort());
 await offer(page,4,5);await page.locator('[data-choice="evolve-1-5"]').click();
 await expect.poll(()=>game(page,'g=>g.visuals.inspectEvolutions().length')).toBe(0);
 expect(await game(page,'g=>g.visuals.inspect().find(a=>a.uid===1)?.visible')).toBe(true);
 expect(await game(page,'g=>g.visuals.inspect().find(a=>a.uid===1)?.width')).toBeGreaterThan(0);
 await page.setViewportSize({width:390,height:844});
 expect(await page.locator('.evolution-screen').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.screenshot({path:'artifacts/browser/n2-missing-art-mobile.png'});
 await page.locator('#restart-btn').click();await expect(page.locator('[data-starter="4"]')).toBeVisible();
 expect(await game(page,'g=>g.scene.spriteManagers.length')).toBe(0);expect(await game(page,'g=>g.audio.inspect().voices')).toBe(0);
 await page.setViewportSize({width:1440,height:900});await page.locator('[data-starter="4"]').click();await captured(page);
 await offer(page,4,5);await page.locator('[data-choice="evolve-1-5"]').click();await page.locator('#restart-btn').click();
 expect(await game(page,'g=>g.scene.spriteManagers.length')).toBe(0);await page.waitForTimeout(250);
 expect(await game(page,'g=>g.scene.spriteManagers.length')).toBe(0);
});

test('S2 terrain interactions render, arm once, and leave bosses outside the beacon rule',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 const result=await page.evaluate(async()=>{
  const {createEnemy}=await import('/src/game/systems/spawning.ts');const g=(window as any).__WILDLANDS__,s=g.sim.state;
  const bramble=s.terrainFeatures.find((feature:any)=>feature.kind==='bramble'),beacon=s.terrainFeatures.find((feature:any)=>feature.kind==='ruin-beacon');
  if(!bramble||!beacon)throw Error('Missing seeded S2 features');
  const ordinary=createEnemy(s,g.sim.rng,10,'normal',beacon.x,beacon.z),boss=createEnemy(s,g.sim.rng,150,'legendary',beacon.x,beacon.z,true,true);
  ordinary.hp=ordinary.maxHp=500;ordinary.speed=0;boss.hp=boss.maxHp=500;s.enemies=[ordinary,boss];Object.assign(s.player,{x:beacon.x,z:beacon.z,iframes:10000});
  g.sim.update(.03,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:true});g.sim.update(.03,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});
  for(let i=0;i<24;i++)g.sim.update(.03,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});
  g.world.update(.02,s.pois,s.stats.elapsed,s.terrainFeatures);
  return {brambleMesh:!!g.scene.getMeshByName(`bramble-${bramble.uid}`),state:beacon.state,ordinaryHp:ordinary.hp,bossHp:boss.hp,beaconVisible:g.scene.getMeshByName(`ruin-beacon-${beacon.uid}`)?.isEnabled()};
 });
 expect(result).toMatchObject({brambleMesh:true,state:'spent',bossHp:500,beaconVisible:false});expect(result.ordinaryHp).toBeLessThan(500);
 await page.screenshot({path:'artifacts/browser/s2-beacon-spent.png'});expect(errors).toEqual([]);
});

for(const map of ['wildlands','volcanic-ridge'])for(const seed of [4,808])test(`${map} seed ${seed}: normal traversal, ridge and shore views share real terrain`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page,map,seed);
 const origin=await game(page,'g=>g.sim.state.player.z');await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');
 expect(await game(page,'g=>g.sim.state.player.z')).toBeGreaterThan(origin+1);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 const metrics=await page.evaluate(async()=>{
  const {explorationRoute}=await import('/src/game/systems/environment.ts'),{worldPoint}=await import('/src/data/maps.ts');
  const g=(window as any).__WILDLANDS__,s=g.sim.state,profile=g.world.profile,p=s.player;
  const poi=s.pois.filter(p=>Math.hypot(p.x,p.z)>60).sort((a,b)=>g.world.height(b.x,b.z)-g.world.height(a.x,a.z))[0];
  Object.assign(p,{x:0,z:0});s.phase='playing';
  for(const end of explorationRoute(poi,profile).slice(1)){
   for(let step=0;step<5000&&Math.hypot(end.x-p.x,end.z-p.z)>.35;step++){
    const distance=Math.hypot(end.x-p.x,end.z-p.z);g.sim.update(.02,{mx:(end.x-p.x)/distance,mz:(end.z-p.z)/distance,jump:false,dodge:false,special:false,interact:false});
   }
   if(Math.hypot(end.x-p.x,end.z-p.z)>.4)throw Error('Traversal blocked');
  }
  s.phase='paused';g.camera.radius=28;g.camera.beta=1.05;g.camera.alpha=Math.PI+profile.turn*Math.PI/2;
  return {map:s.mapId,seed:s.seed,site:poi.uid,siteHeight:g.world.height(p.x,p.z),composition:profile.composition.variant,resources:g.inspectPerformance().resources};
 });
 await page.locator('#overlay').evaluate(el=>(el as HTMLElement).style.visibility='hidden');
 for(const [label,x,z] of [['ridge',32,-46],['shore',-74,66]] as const){
  await page.evaluate(async({x,z})=>{const {worldPoint}=await import('/src/data/maps.ts'),g=(window as any).__WILDLANDS__,s=g.sim.state,p=worldPoint({x,z},g.world.profile);Object.assign(s.player,p);Object.assign(s.party[0],p);g.camera.target.set(p.x,g.world.height(p.x,p.z)+2,p.z);g.ui.refresh(s);},{x,z});
  await page.waitForTimeout(160);await page.screenshot({path:`artifacts/browser/s1-${map}-${seed}-${label}.png`});
 }
 expect(await page.locator('#minimap').evaluate((el:any)=>Number(el.dataset.markers))).toBeGreaterThan(10);
 await writeFile(`artifacts/browser/s1-${map}-${seed}-metrics.json`,JSON.stringify({...metrics,performance:await game(page,'g=>g.inspectPerformance()')},null,2));
 expect(errors).toEqual([]);
});
