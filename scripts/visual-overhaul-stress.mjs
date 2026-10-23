/** Fixed-population presentation benchmark. The paused simulation makes before/
 * after captures comparable; this does not measure active late-wave combat CPU. */
import {chromium} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const baseURL=process.env.WILDLANDS_BASE_URL??'http://127.0.0.1:5173';
const output=resolve(process.env.WILDLANDS_CAPTURE_DIR??'artifacts/visual-overhaul/stage-07-08/stress');
const sourceRoot=resolve(process.env.WILDLANDS_SOURCE_ROOT??'.');
await mkdir(output,{recursive:true});
const sourceHashes={};
for(const file of ['src/data/maps.ts','src/game/render/World.ts','src/game/systems/environment.ts','src/game/systems/surfaceDetails.ts','src/game/systems/berries.ts','src/game/Game.ts','src/game/Simulation.ts']){
 sourceHashes[file]=createHash('sha256').update(await readFile(resolve(sourceRoot,file))).digest('hex');
}
const browser=await chromium.launch({...(existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?{channel:'chrome'}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const maps=[];
try{
 for(const mapId of ['wildlands','pinewood-route','ruins-route','volcanic-ridge']){
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Date.now=()=>4;localStorage.setItem('wildlands-controls-v1',JSON.stringify({graphicsQuality:'high',resolution:1,soundVolume:0,musicVolume:0}));});
  await page.route('https://raw.githubusercontent.com/**',route=>route.abort());await page.goto(`${baseURL}/?dev=1`);
  await page.evaluate(()=>{const g=window.__WILDLANDS__;g.save.unlockedMaps=['wildlands','pinewood-route','ruins-route','volcanic-ridge'];g.ui.showTitle();});
  await page.locator('[data-run-map]').selectOption(mapId);await page.locator('[data-starter="25"]').click();
  await page.waitForFunction(()=>document.pointerLockElement?.id==='renderCanvas');await page.waitForFunction(()=>window.__WILDLANDS__.scene.isReady());
  await page.keyboard.press('Escape');await page.locator('#resume-btn').waitFor();
  await page.evaluate(async()=>{
   const g=window.__WILDLANDS__,s=g.sim.state,{createEnemy}=await import('/src/game/systems/spawning.ts'),{addProjectile}=await import('/src/game/combat/projectiles.ts');
   s.stats.elapsed=1800;s.endless=true;s.bossSpawned=true;s.enemies=[];s.projectiles=[];s.drops=[];
   Object.assign(s.player,{x:0,z:0,y:0});
   s.party=Array.from({length:6},(_,i)=>({...s.party[0],uid:i?s.idCounter++:1,x:(i%3-1)*2,z:-Math.floor(i/3)*2,hp:155,maxHp:155}));
   for(let i=0;i<150;i++){
    const angle=i*Math.PI*2/150,reach=12+i%12,enemy=createEnemy(s,g.sim.rng,19,'normal',Math.sin(angle)*reach,Math.cos(angle)*reach);
    Object.assign(enemy,{hp:100000,maxHp:100000,speed:0,attackCooldown:10000,hitCooldown:10000});s.enemies.push(enemy);
   }
   for(let i=0;i<220;i++)addProjectile(s,{x:i%20-10,z:8+Math.floor(i/20),vx:0,vz:.01,ttl:50,damage:1,size:.12,kind:'bolt',type:'normal',penetration:0,friendly:true,sourceId:1,poisonChance:0});
   g.world.update(0,s.pois,s.stats.elapsed,s.terrainFeatures,s.berryTrees);g.world.setAtmospherePreview(900);
   g.camera.target.set(0,g.world.height(0,0)+2,0);
  });
  await page.waitForFunction(()=>window.__WILDLANDS__.scene.isReady());
  await page.waitForFunction(()=>{const actors=window.__WILDLANDS__.visuals.inspect();return actors.length===156&&actors.every(actor=>actor.source.includes('/pmd/'));});
  await page.locator('#overlay').evaluate(el=>el.style.visibility='hidden');
  const report=await page.evaluate(async()=>{
   const g=window.__WILDLANDS__,{SceneInstrumentation}=await import('/node_modules/@babylonjs/core/Instrumentation/sceneInstrumentation.js');
   const frameCount=async count=>new Promise(resolve=>{let n=0;const observer=g.scene.onAfterRenderObservable.add(()=>{if(++n===count){g.scene.onAfterRenderObservable.remove(observer);resolve();}});});
   await frameCount(30);g.metrics.reset();const initial=JSON.stringify(g.sim.state),instrumentation=new SceneInstrumentation(g.scene),samples=[];
   await new Promise(resolve=>{const observer=g.scene.onAfterRenderObservable.add(()=>{
    samples.push({at:performance.now(),draws:instrumentation.drawCallsCounter.current});
    if(samples.length===120){g.scene.onAfterRenderObservable.remove(observer);resolve();}
   });});instrumentation.dispose();
   const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {mean:values.reduce((a,b)=>a+b,0)/values.length,p95:sorted[Math.floor(sorted.length*.95)]};};
   return {seed:g.sim.state.seed,camera:[g.camera.alpha,g.camera.beta,g.camera.radius],stable:initial===JSON.stringify(g.sim.state),
    frameIntervalsMs:stats(samples.slice(1).map((sample,i)=>sample.at-samples[i].at)),drawCalls:stats(samples.map(s=>s.draws)),performance:g.inspectPerformance()};
  });
  if(!report.stable||errors.length)throw Error(`${mapId}: unstable stress state or page errors: ${errors.join(', ')}`);
  const population=report.performance.simulation;
  if(population.enemies!==150||population.party!==6||population.projectiles!==220)throw Error(`${mapId}: incorrect stress population`);
  await page.screenshot({path:resolve(output,`${mapId}.png`)});maps.push({mapId,...report,errors});
  await writeFile(resolve(output,'metrics.json'),JSON.stringify({sourceHashes,conditions:{baseURL,viewport:[1440,900],quality:'high',sampleFrames:120,warmupFrames:30,renderer:'Chrome SwiftShader software WebGL',population:{enemies:150,party:6,projectiles:220},clock:'paused at 1800 seconds; dusk presentation; excludes active simulation CPU'},maps},null,2));
  console.log(`${mapId}: ${report.drawCalls.mean.toFixed(1)} draws, ${report.frameIntervalsMs.mean.toFixed(1)} ms mean / ${report.frameIntervalsMs.p95.toFixed(1)} p95`);
  await context.close();
 }
}finally{await browser.close();}
