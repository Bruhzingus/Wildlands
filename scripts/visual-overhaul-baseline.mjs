/** Repeatable visual-overhaul evidence capture. Uses existing DEV hooks in an isolated browser;
 * never changes the game source or the user's browser profile/save. */
import {chromium} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

const baseURL=process.env.WILDLANDS_BASE_URL??'http://127.0.0.1:5173';
// Keep Stage 00 evidence intact when capturing later implementations.
const output=resolve(process.env.WILDLANDS_CAPTURE_DIR??'artifacts/visual-overhaul/stage-00');
const captureSeed=process.env.WILDLANDS_CAPTURE_SEED===undefined?null:Number(process.env.WILDLANDS_CAPTURE_SEED);
if(captureSeed!==null&&!Number.isSafeInteger(captureSeed))throw Error('WILDLANDS_CAPTURE_SEED must be an integer');
await mkdir(output,{recursive:true});
const sourceFiles=['src/data/maps.ts','src/data/world.ts','src/data/atmosphere.ts','src/game/systems/environment.ts','src/game/systems/sceneryDensity.ts','src/game/systems/berries.ts','src/game/systems/surfaceDetails.ts','src/game/systems/landmarkDressing.ts','src/game/render/World.ts','src/game/render/groundDetails.ts','src/game/render/terrainPalette.ts','src/game/render/vegetation.ts','src/game/render/atmosphere.ts','src/game/render/LandmarkDressing.ts','src/game/Game.ts','src/game/Simulation.ts','package-lock.json'];
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const browser=await chromium.launch({
 ...(existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?{channel:'chrome'}:{}),
 args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
const reports=[];
try{
 for(const mapId of ['wildlands','pinewood-route','ruins-route','volcanic-ridge']){
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  // Random maps use seed 4; authored routes retain their own fixed seed.
  await page.addInitScript(()=>{
   Date.now=()=>4;
   localStorage.setItem('wildlands-controls-v1',JSON.stringify({graphicsQuality:'high',resolution:1,vfxDensity:1,soundVolume:0,musicVolume:0}));
  });
  await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
  await page.goto(`${baseURL}/?dev=1`);
  // Unlock only this throwaway context's in-memory menu; use its normal selector.
  await page.evaluate(()=>{const g=window.__WILDLANDS__;g.save.unlockedMaps=['wildlands','pinewood-route','ruins-route','volcanic-ridge'];g.ui.showTitle();});
  // QA override lives only in this throwaway module context, never in a save or source file.
  if(captureSeed!==null)await page.evaluate(async({mapId,seed})=>{const {MAP_OPTIONS}=await import('/src/data/unlocks.ts');MAP_OPTIONS.find(map=>map.id===mapId).seed=seed;},{mapId,seed:captureSeed});
  await page.locator('[data-run-map]').selectOption(mapId);
  await page.locator('[data-starter="25"]').click();
  await page.waitForFunction(()=>document.pointerLockElement?.id==='renderCanvas');
  await page.waitForFunction(()=>window.__WILDLANDS__.scene.isReady());
  await page.waitForFunction(()=>window.__WILDLANDS__.visuals.inspect()[0]?.source.includes('/pmd/'));
  const initial=await page.evaluate(()=>{
   const g=window.__WILDLANDS__,s=g.sim.state,gl=g.engine._gl,debug=gl.getExtension('WEBGL_debug_renderer_info');
   return {mapId:s.mapId,seed:s.seed,camera:{alpha:g.camera.alpha,beta:g.camera.beta,radius:g.camera.radius},
    renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
    profile:{turn:g.world.profile.turn,composition:g.world.profile.composition.variant,lake:g.world.profile.lake},
    sprites:g.visuals.inspect(),pois:s.pois.length,berryTrees:s.berryTrees.length};
  });
  await page.evaluate(async()=>{
   const g=window.__WILDLANDS__,{SceneInstrumentation}=await import('/node_modules/@babylonjs/core/Instrumentation/sceneInstrumentation.js');
   const instrumentation=new SceneInstrumentation(g.scene),samples=[];
   g.metrics.reset();
   const observer=g.scene.onAfterRenderObservable.add(()=>{
    if(g.sim.state.phase!=='playing'||document.pointerLockElement?.id!=='renderCanvas')return;
    samples.push({at:performance.now(),drawCalls:instrumentation.drawCallsCounter.current,enemies:g.sim.state.enemies.length});
    if(samples.length>=120){g.scene.onAfterRenderObservable.remove(observer);instrumentation.dispose();}
   });
   window.__BASELINE_SAMPLES__=samples;
  });
  await page.waitForFunction(()=>window.__BASELINE_SAMPLES__.length>=120,{},{timeout:60000});
  const performanceReport=await page.evaluate(()=>{
   const g=window.__WILDLANDS__,samples=window.__BASELINE_SAMPLES__;
   const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {average:values.reduce((a,b)=>a+b,0)/values.length,p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)};};
   return {observed:g.inspectPerformance(),activeFrames:samples.length,
    frameIntervalsMs:stats(samples.slice(1).map((sample,i)=>sample.at-samples[i].at)),
    drawCalls:stats(samples.map(sample=>sample.drawCalls)),enemyRange:[Math.min(...samples.map(s=>s.enemies)),Math.max(...samples.map(s=>s.enemies))]};
  });
  await page.screenshot({path:resolve(output,`${mapId}-spawn.png`)});
  const beforeMove=await page.evaluate(()=>window.__WILDLANDS__.sim.state.player.z);
  await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');
  const moved=await page.evaluate(()=>window.__WILDLANDS__.sim.state.player.z);
  if(!(moved>beforeMove+.2))throw Error(`${mapId}: forward movement failed`);
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.__WILDLANDS__.sim.state.player.y>.1);
  await page.keyboard.press('Shift');
  await page.waitForFunction(()=>window.__WILDLANDS__.sim.state.player.dodgeCooldown>0);
  await page.screenshot({path:resolve(output,`${mapId}-gameplay.png`)});
  await page.keyboard.press('Escape');await page.locator('#resume-btn').waitFor();
  const frozen=await page.evaluate(()=>JSON.stringify(window.__WILDLANDS__.sim.state));
  await page.waitForTimeout(150);
  if(await page.evaluate(()=>JSON.stringify(window.__WILDLANDS__.sim.state))!==frozen)throw Error(`${mapId}: pause did not freeze`);
  const determinism=await page.evaluate(async()=>{
   const {createEnvironment,createPOIs}=await import('/src/game/systems/environment.ts'),{createSurfaceDetails}=await import('/src/game/systems/surfaceDetails.ts');
   const g=window.__WILDLANDS__,s=g.sim.state;
   const make=()=>{const pois=createPOIs(s.seed,s.mapId),layout=createEnvironment(s.seed,pois,s.mapId);return {pois,...layout,details:createSurfaceDetails(s.seed,g.world.profile,pois,layout,s.berryTrees)};};
   const a=make(),b=make();return {equal:JSON.stringify(a)===JSON.stringify(b),props:a.props.length,obstacles:a.obstacles.length,features:a.features.length,
    rockGroups:new Set(a.props.filter(p=>p.rockCluster!==undefined).map(p=>p.rockCluster)).size,rocks:a.props.filter(p=>p.rockCluster!==undefined).length,
    details:Object.fromEntries(['tuft','flower','mushroom','stump','chip'].map(kind=>[kind,a.details.filter(p=>p.kind===kind).length])),
    detailBatches:g.scene.meshes.filter(m=>m.name.startsWith('ground-detail-')).length};
  });
  if(!determinism.equal)throw Error(`${mapId}: generation was not repeatable`);
  await page.locator('#overlay').evaluate(el=>el.style.visibility='hidden');
  for(const [name,x,z] of [['ridge',32,-46],['shore',-74,66]]){
   await page.evaluate(async({x,z})=>{
    const {worldPoint}=await import('/src/data/maps.ts'),g=window.__WILDLANDS__,s=g.sim.state,p=worldPoint({x,z},g.world.profile);
    Object.assign(s.player,p);Object.assign(s.party[0],p);s.player.y=0;
    g.camera.target.set(p.x,g.world.height(p.x,p.z)+2,p.z);g.ui.refresh(s);
   },{x,z});
   await page.waitForTimeout(100);
   await page.screenshot({path:resolve(output,`${mapId}-${name}.png`)});
  }
  // Same paused state and camera isolates the detail batches from combat RNG.
  const detailComparison={};
  for(const visible of [true,false]){
   detailComparison[visible?'on':'off']=await page.evaluate(async visible=>{
    const g=window.__WILDLANDS__,{SceneInstrumentation}=await import('/node_modules/@babylonjs/core/Instrumentation/sceneInstrumentation.js');
    g.world.setGroundDetailsVisible(visible);
    const instrumentation=new SceneInstrumentation(g.scene),samples=[];
    await new Promise(resolve=>{const observer=g.scene.onAfterRenderObservable.add(()=>{
     samples.push({at:performance.now(),draws:instrumentation.drawCallsCounter.current});
     if(samples.length===80){g.scene.onAfterRenderObservable.remove(observer);resolve();}
    });});instrumentation.dispose();
    const times=samples.slice(1).map((s,i)=>s.at-samples[i].at).sort((a,b)=>a-b);
    return {frames:samples.length,meanDraws:samples.reduce((n,s)=>n+s.draws,0)/samples.length,
     meanMs:times.reduce((a,b)=>a+b,0)/times.length,p95Ms:times[Math.floor(times.length*.95)]};
   },visible);
   await page.screenshot({path:resolve(output,`${mapId}-shore-details-${visible?'on':'off'}.png`)});
  }
  await page.evaluate(()=>window.__WILDLANDS__.world.setGroundDetailsVisible(true));
  await page.locator('#overlay').evaluate(el=>el.style.visibility='');
  reports.push({initial,performance:performanceReport,detailComparison,determinism,checks:{movement:true,jump:true,dodge:true,pause:true},errors});
  await writeFile(resolve(output,'metrics.json'),JSON.stringify({revision,sourceHashes,conditions:{baseURL,viewport:[1440,900],deviceScaleFactor:1,quality:'high',sampleFrames:120,
   renderer:'Chrome SwiftShader software WebGL; early live gameplay, not target GPU or late-wave performance',remoteFallback:'blocked; local cached PMD sprites required'},maps:reports},null,2));
  console.log(`${mapId}: seed ${initial.seed}; ${performanceReport.drawCalls.average.toFixed(1)} draw calls; ${performanceReport.frameIntervalsMs.average.toFixed(1)} ms/frame; ${errors.length} page errors`);
  if(errors.length)throw Error(`${mapId}: browser page errors`);
  await context.close();
 }
}finally{await browser.close();}
