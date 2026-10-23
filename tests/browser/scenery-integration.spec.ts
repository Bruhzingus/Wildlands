import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const output='artifacts/visual-overhaul/stage-07-08/review';
for(const [map,authored] of [['wildlands',4],['pinewood-route',46837],['ruins-route',81073],['volcanic-ridge',4]] as const)
for(const seed of [authored,301])test(`${map}/${seed}: open exploration, two-seed composition and normal-camera review`,async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('wildlands-controls-v1',JSON.stringify({graphicsQuality:'high',resolution:1,soundVolume:0,musicVolume:0}));});
 await page.route('https://raw.githubusercontent.com/**',route=>route.abort());await page.goto('/?dev=1');
 await page.evaluate(async({map,seed})=>{
  const g=(window as any).__WILDLANDS__,{MAP_OPTIONS}=await import('/src/data/unlocks.ts');
  MAP_OPTIONS.find((m:any)=>m.id===map)!.seed=seed;
  g.save.unlockedMaps=['wildlands','pinewood-route','ruins-route','volcanic-ridge'];g.ui.showTitle();
 },{map,seed});
 await page.locator('[data-run-map]').selectOption(map);await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.scene.isReady())).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.visuals.inspect()[0]?.source.includes('/pmd/'))).toBe(true);
 await page.keyboard.press('Escape');await page.locator('#resume-btn').waitFor();await mkdir(output,{recursive:true});
 await page.locator('#overlay').evaluate(el=>el.style.visibility='hidden');
 const initial=await page.evaluate(()=>{const g=(window as any).__WILDLANDS__;return {camera:[g.camera.alpha,g.camera.beta,g.camera.radius],seed:g.sim.state.seed};});
 expect(initial.seed).toBe(seed);
 for(const view of ['spawn','landscape','poi','shore']){
  await page.evaluate(async view=>{
   const g=(window as any).__WILDLANDS__,s=g.sim.state,{worldPoint}=await import('/src/data/maps.ts'),lake=g.world.profile.lake;
   const site=s.pois.find((p:any)=>p.kind==='shrine');
   const p=view==='spawn'?{x:0,z:0}:view==='landscape'?worldPoint({x:-35,z:-44},g.world.profile):view==='poi'?{x:site.x,z:site.z-8}:{x:lake.x,z:lake.z-lake.waterRadius-6};
   Object.assign(s.player,{...p,y:0});Object.assign(s.party[0],p);g.camera.target.set(p.x,g.world.height(p.x,p.z)+2,p.z);
  },view);
  await page.waitForTimeout(80);await page.screenshot({path:`${output}/${map}-${seed}-${view}.png`});
 }
 const report=await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,{explorationRoute,createEnvironment}=await import('/src/game/systems/environment.ts'),{createSurfaceDetails}=await import('/src/game/systems/surfaceDetails.ts');
  const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
  Object.assign(s.player,{x:0,z:0,y:0,iframes:100000});Object.assign(s.party[0],{x:0,z:0,cooldown:100000});
  s.stats.xpToNext=1e12;s.phase='playing';const start=s.stats.elapsed,visited:number[]=[];
  // Three simulated minutes through actual collision-aware approaches with
  // normal enemy arrivals. This is automated traversal, not a human playtest.
  while(s.stats.elapsed-start<180){
   const site=s.pois[visited.length%s.pois.length],route=explorationRoute(site,g.world.profile);
   const circuit=[...route,...route.slice(0,-1).reverse()];
   for(const end of circuit){
    for(let step=0;step<2500&&Math.hypot(end.x-s.player.x,end.z-s.player.z)>.25;step++){
     const distance=Math.hypot(end.x-s.player.x,end.z-s.player.z);
     g.sim.update(.02,{...idle,mx:(end.x-s.player.x)/distance,mz:(end.z-s.player.z)/distance});
    }
    if(Math.hypot(end.x-s.player.x,end.z-s.player.z)>.35)throw Error(`Blocked scenery approach to ${site.uid}`);
   }
   visited.push(site.uid);
  }
  const elapsed=s.stats.elapsed-start,enemies=s.enemies.length;
  g.sim.update(.02,{...idle,jump:true});const jumped=s.player.y>0;
  g.sim.update(.02,{...idle,mx:1,dodge:true});const dodged=s.player.dodgeCooldown>0;
  // Real map-specific legendary trigger; stop before any victory/reward change.
  s.stats.elapsed=899.99;s.bossSpawned=false;s.phase='playing';g.sim.update(.02,idle);
  const boss=s.enemies.find((e:any)=>e.isBoss),bossId=boss?.speciesId;
  s.phase='paused';g.world.update(0,s.pois,s.stats.elapsed,s.terrainFeatures,s.berryTrees);g.world.setAtmospherePreview(900);
  g.camera.target.set(s.player.x,g.world.height(s.player.x,s.player.z)+2,s.player.z);
  const layout=createEnvironment(s.seed,s.pois,s.mapId),again=createEnvironment(s.seed,s.pois,s.mapId);
  const details=createSurfaceDetails(s.seed,g.world.profile,s.pois,layout,s.berryTrees);
  return {elapsed,visited,enemies,jumped,dodged,bossId,berries:s.berryTrees.length,
   repeatable:JSON.stringify(layout)===JSON.stringify(again),details:details.length,
   camera:[g.camera.alpha,g.camera.beta,g.camera.radius],atmosphere:g.world.inspectAtmosphere(),resources:g.inspectPerformance().resources};
 });
 expect(report.elapsed).toBeGreaterThanOrEqual(180);expect(report.visited.length).toBeGreaterThan(0);
 expect(report.enemies).toBeGreaterThan(0);expect(report).toMatchObject({jumped:true,dodged:true,repeatable:true,berries:16,bossId:map==='volcanic-ridge'?146:150});
 expect(report.camera).toEqual(initial.camera);expect(report.atmosphere.fogStart).toBeGreaterThanOrEqual(44);
 await page.waitForTimeout(120);await page.screenshot({path:`${output}/${map}-${seed}-combat-dusk.png`});
 expect(errors).toEqual([]);await writeFile(`${output}/${map}-${seed}.json`,JSON.stringify({initial,report,errors},null,2));
});
