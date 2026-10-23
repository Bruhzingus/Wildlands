import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const maps=['wildlands','pinewood-route','ruins-route','volcanic-ridge'];

async function start(page:Page,mapId:string){
 await page.addInitScript(()=>{
  Date.now=()=>4;
  localStorage.setItem('wildlands-controls-v1',JSON.stringify({graphicsQuality:'high',resolution:1,vfxDensity:1,soundVolume:0,musicVolume:0}));
 });
 await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
 await page.goto('/?dev=1');
 await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__;
  g.save.unlockedMaps=['wildlands','pinewood-route','ruins-route','volcanic-ridge'];g.ui.showTitle();
 });
 await page.locator('[data-run-map]').selectOption(mapId);
 await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.scene.isReady())).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.visuals.inspect()[0]?.source.includes('/pmd/'))).toBe(true);
}

for(const mapId of maps)test(`${mapId}: terrain, shore and tree silhouettes render at the unchanged normal camera`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await start(page,mapId);
 const initial=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  return {mapId:s.mapId,seed:s.seed,camera:[g.camera.alpha,g.camera.beta,g.camera.radius],berries:s.berryTrees.length,
   terrainVertices:g.scene.getMeshByName('rolling forest terrain').getTotalVertices(),
   pine:g.scene.meshes.filter((m:any)=>m.name.startsWith('crown-pine-')).length,
   tiered:g.scene.meshes.filter((m:any)=>m.name.startsWith('crown-tiered-')).length,
   round:g.scene.meshes.filter((m:any)=>m.name.startsWith('crown-round-')).length,
   dead:g.scene.meshes.filter((m:any)=>m.name.startsWith('dead-trunk-')).length,
   floatingShore:!!g.scene.getMeshByName('pond shore')};
 });
 expect(initial.mapId).toBe(mapId);
 expect(initial.seed).toBe(mapId==='pinewood-route'?46837:mapId==='ruins-route'?81073:4);
 expect(initial.berries).toBe(16);expect(initial.terrainVertices).toBe(13689);expect(initial.floatingShore).toBe(false);
 if(mapId==='volcanic-ridge'){
  expect(initial.dead).toBeGreaterThan(0);expect(initial.pine+initial.tiered+initial.round).toBe(0);
 }else{
  expect(initial.pine).toBeGreaterThan(0);expect(initial.tiered).toBeGreaterThan(0);expect(initial.round).toBeGreaterThan(0);
 }
 await mkdir('artifacts/browser',{recursive:true});
 await page.screenshot({path:`artifacts/browser/visual-overhaul-${mapId}-spawn.png`});
 await page.keyboard.press('Escape');await page.locator('#resume-btn').waitFor();
 await page.locator('#overlay').evaluate(el=>el.style.visibility='hidden');
 const scenery=await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,{createEnvironment}=await import('/src/game/systems/environment.ts'),{createSurfaceDetails}=await import('/src/game/systems/surfaceDetails.ts');
  const layout=createEnvironment(s.seed,s.pois,s.mapId),expected=createSurfaceDetails(s.seed,g.world.profile,s.pois,layout,s.berryTrees),batches=g.scene.meshes.filter((m:any)=>m.name.startsWith('ground-detail-'));
  const before=JSON.stringify(s),resources=g.inspectPerformance().resources;
  g.world.setGroundDetailsVisible(false);const hidden=batches.every((m:any)=>!m.isEnabled());
  g.world.setQuality('low');g.world.setGroundDetailsVisible(true);const low=batches.every((m:any)=>!m.isEnabled());
  g.world.setQuality('high');const visible=batches.every((m:any)=>m.isEnabled());
  return {batches:batches.length,expected:expected.length,count:batches.reduce((sum:number,m:any)=>sum+m.thinInstanceCount,0),
   safe:batches.every((m:any)=>!m.isPickable&&!m.checkCollisions&&!m.thinInstanceEnablePicking),hidden,low,visible,
   stable:JSON.stringify(s)===before&&JSON.stringify(g.inspectPerformance().resources)===JSON.stringify(resources)};
 });
 expect(scenery.batches).toBeGreaterThan(0);expect(scenery.batches).toBeLessThanOrEqual(5);expect(scenery.count).toBe(scenery.expected);
 expect(scenery).toMatchObject({safe:true,hidden:true,low:true,visible:true,stable:true});
 for(const view of ['spawn','forest','rocks']){
  await page.evaluate(async view=>{
   const g=(window as any).__WILDLANDS__,s=g.sim.state,{createEnvironment}=await import('/src/game/systems/environment.ts'),{worldPoint}=await import('/src/data/maps.ts'),{createSurfaceDetails}=await import('/src/game/systems/surfaceDetails.ts');
   const layout=createEnvironment(s.seed,s.pois,s.mapId);
   const obstruction=(p:any)=>g.scene.meshes.filter((m:any)=>(m.name.startsWith('crown-')||m.name.startsWith('dead-trunk-')||m.name.startsWith('great-pine-')||m.name.startsWith('ruin-'))&&Math.abs(m.position.x-p.x)<7&&m.position.z<p.z&&m.position.z>p.z-24).length+(Math.max(Math.abs(p.x),Math.abs(p.z))>105?100:0)+s.pois.filter((site:any)=>Math.hypot(site.x-p.x,site.z-(p.z-8))<12).length*10;
   let point=view==='spawn'?{x:0,z:0}:worldPoint({x:-48,z:-48},g.world.profile);
   if(view==='forest'){
    const details=createSurfaceDetails(s.seed,g.world.profile,s.pois,layout,s.berryTrees).filter((p:any)=>p.kind==='mushroom'||p.kind==='tuft'||p.kind==='chip');
    const mushrooms=details.filter((p:any)=>p.kind==='mushroom');
    const detail=[...(mushrooms.length?mushrooms:details)].sort((a:any,b:any)=>obstruction(a)-obstruction(b))[0];if(detail)point={x:detail.x,z:detail.z-5};
   }
   if(view==='rocks'){
    const rocks=layout.props.filter((p:any)=>p.rockCluster!==undefined);
    const rock=[...rocks].sort((a:any,b:any)=>obstruction(a)-obstruction(b))[0];point={x:rock.x,z:rock.z-8};
   }
   Object.assign(s.player,{...point,y:0});Object.assign(s.party[0],point);g.camera.target.set(point.x,g.world.height(point.x,point.z)+2,point.z);
  },view);
  for(const visible of [true,false]){
   await page.evaluate(visible=>(window as any).__WILDLANDS__.world.setGroundDetailsVisible(visible),visible);
   await page.waitForTimeout(60);await page.screenshot({path:`artifacts/browser/stage-03-04-${mapId}-${view}-details-${visible?'on':'off'}.png`});
  }
 }
 await page.evaluate(()=>(window as any).__WILDLANDS__.world.setGroundDetailsVisible(true));
 await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,lake=g.world.profile.lake;
  const x=lake.x,z=lake.z-lake.waterRadius-6;
  Object.assign(s.player,{x,z,y:0});Object.assign(s.party[0],{x,z});s.enemies=[];
  g.camera.target.set(x,g.world.height(x,z)+2,z);
 });
 await page.waitForTimeout(100);
 expect(await page.evaluate(()=>{const g=(window as any).__WILDLANDS__;return [g.camera.alpha,g.camera.beta,g.camera.radius];})).toEqual(initial.camera);
 await page.screenshot({path:`artifacts/browser/visual-overhaul-${mapId}-shore.png`});
 await page.evaluate(()=>(window as any).__WILDLANDS__.world.setGroundDetailsVisible(false));
 await page.screenshot({path:`artifacts/browser/stage-03-04-${mapId}-shore-details-off.png`});
 expect(errors).toEqual([]);
});

test('redesigned berry tree retains visible edge fruit, collection reward and observed regrowth delay',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await start(page,'wildlands');
 await page.keyboard.press('Escape');await page.locator('#resume-btn').waitFor();
 await page.locator('#overlay').evaluate(el=>el.style.visibility='hidden');
 const before=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  // Choose an existing tree with a clear foreground for an honest silhouette
  // comparison. Do not remove nearby scenery or alter the normal camera.
  const obstruction=(tree:any)=>g.scene.meshes.filter((mesh:any)=>mesh.name.startsWith('crown-')&&Math.abs(mesh.position.x-tree.x)<4&&mesh.position.z<tree.z-2&&mesh.position.z>tree.z-24).length;
  const tree=[...s.berryTrees].sort((a:any,b:any)=>obstruction(a)-obstruction(b))[0];
  (window as any).__QA_BERRY_UID__=tree.uid;
  s.enemies=[];s.player.iframes=100;Object.assign(s.player,{x:tree.x,z:tree.z-7,y:0});Object.assign(s.party[0],{x:tree.x,z:tree.z-7});
  g.camera.target.set(tree.x,g.world.height(tree.x,tree.z)+2,tree.z);
  const fruit=Array.from({length:5},(_,index)=>g.scene.getMeshByName(`berry-tree-${tree.uid}-fruit-${index}`));
  return {camera:[g.camera.alpha,g.camera.beta,g.camera.radius],berry:tree.berry,
   fruit:fruit.map((mesh:any)=>({visible:mesh.isVisible&&mesh.isEnabled(),material:mesh.material.name,radius:Math.hypot(mesh.position.x-tree.x,mesh.position.z-tree.z)}))};
 });
 expect(before.fruit.every(fruit=>fruit.visible&&fruit.material===`${before.berry} berry`&&fruit.radius>0)).toBe(true);
 await page.waitForTimeout(100);await mkdir('artifacts/browser',{recursive:true});
 await page.screenshot({path:'artifacts/browser/visual-overhaul-berry-normal-camera.png'});
 const result=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,tree=s.berryTrees.find((tree:any)=>tree.uid===(window as any).__QA_BERRY_UID__),fruit=tree.berries[0],kind=tree.berry;
  const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
  const oldCycle=tree.cycle,uid=tree.uid,origin={x:tree.x,z:tree.z},stackCount=s.berryBuffs?.[kind]?.length??0;
  // Use the real simulation update/collection path; the visual factory cannot
  // change berry positions, yields, buffs or the observed-tree timer rules.
  s.phase='playing';Object.assign(s.player,{x:fruit.x,z:fruit.z});g.sim.update(.02,idle);
  const reward={collected:fruit.collected,stacks:(s.berryBuffs?.[kind]?.length??0)-stackCount,expires:s.berryBuffs?.[kind]?.at(-1),elapsed:s.stats.elapsed};
  g.world.update(0,s.pois,s.stats.elapsed,s.terrainFeatures,s.berryTrees);
  const dropHidden=!g.scene.getMeshByName(`berry-${uid}-0`).isEnabled();
  s.stats.elapsed=tree.nextChangeAt+1;Object.assign(s.player,origin);g.sim.update(.02,idle);
  const watchedCycle=tree.cycle;
  Object.assign(s.player,{x:0,z:0});g.sim.update(.02,idle);
  g.world.update(0,s.pois,s.stats.elapsed,s.terrainFeatures,s.berryTrees);s.phase='paused';
  return {uid,origin,after:{uid:tree.uid,x:tree.x,z:tree.z},reward,dropHidden,oldCycle,watchedCycle,cycle:tree.cycle,
   differentKind:tree.berry!==kind,regrown:tree.berries.every((berry:any)=>!berry.collected),yield:tree.berries.length,
   nextChangeIn:tree.nextChangeAt-s.stats.elapsed,dropVisible:g.scene.getMeshByName(`berry-${uid}-0`).isEnabled(),
   crownPalette:Array.from({length:5},(_,index)=>g.scene.getMeshByName(`berry-tree-${uid}-fruit-${index}`).material.name),berry:tree.berry};
 });
 expect(result.reward.collected).toBe(true);expect(result.reward.stacks).toBeGreaterThanOrEqual(1);
 expect(result.reward.expires-result.reward.elapsed).toBeCloseTo(20,5);expect(result.dropHidden).toBe(true);
 expect(result.watchedCycle).toBe(result.oldCycle);expect(result.cycle).toBe(result.oldCycle+1);
 expect(result.differentKind).toBe(true);expect(result.regrown).toBe(true);expect(result.yield).toBeGreaterThanOrEqual(1);expect(result.yield).toBeLessThanOrEqual(3);
 expect(result.nextChangeIn).toBeCloseTo(180,5);expect(result.dropVisible).toBe(true);
 expect(result.after).toEqual({uid:result.uid,...result.origin});
 expect(result.crownPalette).toEqual(Array(5).fill(`${result.berry} berry`));expect(errors).toEqual([]);
});
