import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const game=(page:Page,expression:string)=>page.evaluate(expression=>new Function('g',`return (${expression})(g)`)((window as any).__WILDLANDS__),expression);
const start=async(page:Page)=>{await page.locator('[data-starter="25"]').click();await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBe(true);};

test('graphics controls persist and keep pause, capture and essential telegraphs intact',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?dev=1');
 await page.locator('#graphics-quality').selectOption('low');await page.locator('#render-resolution').selectOption('0.5');
 await page.locator('#vfx-density').fill('0.35');await page.reload();
 await expect(page.locator('#graphics-quality')).toHaveValue('low');await expect(page.locator('#render-resolution')).toHaveValue('0.5');await expect(page.locator('#vfx-density')).toHaveValue('0.35');
 await start(page);const report=await game(page,'g=>g.inspectPerformance()');expect(report.graphics.quality).toBe('low');expect(report.graphics.hardwareScaling).toBe(2);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 const elapsed=await game(page,'g=>g.sim.state.stats.elapsed');await page.locator('#graphics-quality').selectOption('high');await page.locator('#render-resolution').selectOption('1');await page.waitForTimeout(120);
 expect(await game(page,'g=>g.sim.state.stats.elapsed')).toBe(elapsed);expect(await game(page,'g=>g.inspectPerformance().graphics.quality')).toBe('high');
 await page.locator('#resume-btn').click();await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');expect(errors).toEqual([]);
 await page.keyboard.press('Escape');await page.evaluate(()=>{Storage.prototype.getItem=()=>{throw new Error('storage denied');};Storage.prototype.setItem=()=>{throw new Error('storage denied');};});
 await page.locator('#sound-volume').fill('0.33');await page.locator('#graphics-quality').selectOption('balanced');
 expect(await game(page,'g=>g.ui.settings.soundVolume')).toBe(.33);expect(await game(page,'g=>g.audio.inspect().soundVolume')).toBe(.33);
});

test('ten real restarts release run resources and reuse the audio graph',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?dev=1');
 // Babylon creates one scene-owned default material lazily. Warm that engine
 // resource before comparing run-owned resources across all ten restarts.
 await game(page,'g=>{void g.scene.defaultMaterial;}');
 const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');
 const baseline=await game(page,'g=>g.inspectPerformance()'),runs:any[]=[];
 for(let run=0;run<10;run++){
  await start(page);await game(page,'g=>{g.sim.state.enemies=[];g.sim.spawnAccum=-1000;g.sim.state.player.iframes=10000;}');
  await page.waitForTimeout(100);await page.keyboard.press('q');await page.waitForTimeout(80);
  await game(page,'g=>g.ui.toast("Previous encounter warning",2)');
  await page.keyboard.press('Escape');await expect(page.locator('#restart-btn')).toBeVisible();await page.locator('#restart-btn').click();await expect(page.locator('#toast')).not.toHaveClass(/show/);
  await expect(page.locator('[data-starter="25"]')).toBeVisible();await expect.poll(()=>game(page,'g=>g.inspectPerformance().resources.spriteManagers')).toBe(0);
  const report=await game(page,'g=>g.inspectPerformance()');expect(report.resources).toEqual(baseline.resources);expect(report.audio.voices).toBe(0);expect(report.audio.nodes).toBe(3);expect(report.audio.errors).toBe(0);runs.push(report);
 }
 await cdp.send('HeapProfiler.collectGarbage');const after=await game(page,'g=>g.inspectPerformance()');
 if(after.heap&&baseline.heap)expect(after.heap.used-baseline.heap.used).toBeLessThan(50_000_000);
 await mkdir('artifacts/performance',{recursive:true});await writeFile('artifacts/performance/browser-restarts.json',JSON.stringify({renderer:'Chrome SwiftShader software WebGL; not target hardware FPS',baseline,runs,after},null,2));
 expect(errors).toEqual([]);
});

test('above-budget actors and projectile cap render with bounded effects; missing art stays playable',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?dev=1');await start(page);
 await game(page,`async g=>{
  g.engine.stopRenderLoop();g.ui.settings.hitStop=false;g.feedback.setSettings({hitStop:false,screenShake:false});
  const {createEnemy}=await import('/src/game/systems/spawning.ts'),{addProjectile}=await import('/src/game/combat/projectiles.ts');
  const s=g.sim.state;s.enemies=[];s.bossSpawned=true;s.endless=true;s.stats.elapsed=2700;s.stats.xpToNext=Number.MAX_SAFE_INTEGER;s.player.iframes=10000;g.sim.spawnAccum=-1000;
  s.party=Array.from({length:7},(_,i)=>({...s.party[0],uid:i? s.idCounter++:1,speciesId:25,hp:155,maxHp:155}));
  for(let i=0;i<210;i++){const a=i*Math.PI*2/210,e=createEnemy(s,g.sim.rng,19,'normal',Math.sin(a)*(10+i%12),Math.cos(a)*(10+i%12));Object.assign(e,{hp:100000,maxHp:100000,speed:0,attackCooldown:10000,hitCooldown:10000});s.enemies.push(e);}
  for(let i=0;i<220;i++)addProjectile(s,{x:i%20-10,z:10+Math.floor(i/20),vx:0,vz:.01,ttl:50,damage:1,size:.12,kind:'bolt',type:'normal',penetration:0,friendly:true,sourceId:1,poisonChance:0});
  for(let i=0;i<6;i++){g.previous=performance.now()-16;g.frame();}
 }`);
 await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBe(true);
 const report=await game(page,'g=>g.inspectPerformance()');expect(report.simulation.enemies).toBe(210);expect(report.simulation.party).toBe(7);expect(report.simulation.projectiles).toBeLessThanOrEqual(220);expect(report.effects.allocated).toBeLessThanOrEqual(520);expect(report.resources.geometries).toBeLessThan(50);
 await mkdir('artifacts/performance',{recursive:true});await writeFile('artifacts/performance/browser-crowd.json',JSON.stringify({conditions:'210 enemies, leader plus 6 followers, capped220projectiles; injected stress above normal190enemy/6party budgets, real scene render',report},null,2));await page.screenshot({path:'artifacts/performance/crowd.png'});
 await page.goto('/?dev=1');await page.route('**/assets/pmd/**',route=>route.abort());await page.route('**/assets/pokemon/**',route=>route.abort());await page.route('https://raw.githubusercontent.com/**',route=>route.abort());await start(page);
 await expect.poll(()=>game(page,'g=>g.visuals.inspect()[0]?.source')).toBe('artwork/generated');await page.keyboard.press('w');await page.waitForTimeout(150);await page.keyboard.up('w');expect(await game(page,'g=>g.sim.state.stats.elapsed')).toBeGreaterThan(0);expect(errors).toEqual([]);
});
