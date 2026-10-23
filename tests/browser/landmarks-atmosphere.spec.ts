import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const maps=['wildlands','pinewood-route','ruins-route','volcanic-ridge'];
const output='artifacts/visual-overhaul/stage-05-06';
async function start(page:Page,map:string){
 await page.addInitScript(()=>{Date.now=()=>4;localStorage.setItem('wildlands-controls-v1',JSON.stringify({graphicsQuality:'high',resolution:1,soundVolume:0,musicVolume:0}));});
 await page.route('https://raw.githubusercontent.com/**',route=>route.abort());await page.goto('/?dev=1');
 await page.evaluate(()=>{const g=(window as any).__WILDLANDS__;g.save.unlockedMaps=['wildlands','pinewood-route','ruins-route','volcanic-ridge'];g.ui.showTitle();});
 await page.locator('[data-run-map]').selectOption(map);await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.scene.isReady())).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.visuals.inspect()[0]?.source.includes('/pmd/'))).toBe(true);
 await page.keyboard.press('Escape');await page.locator('#resume-btn').waitFor();
 await page.evaluate(()=>{const g=(window as any).__WILDLANDS__,s=g.sim.state;s.enemies=[];s.player.iframes=100000;s.party[0].cooldown=100000;g.sim.spawnAccum=-100000;});
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.visuals.inspect().length)).toBe(1);
 await mkdir(output,{recursive:true});
}

for(const map of maps)test(`${map}: landmark settings preserve interactions and the run clock drives readable atmosphere`,async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page,map);
 const initial=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__;
  return {state:JSON.stringify(g.sim.state),save:JSON.stringify(g.save),camera:[g.camera.alpha,g.camera.beta,g.camera.radius],
   spriteColors:g.scene.spriteManagers.flatMap((manager:any)=>manager.sprites.map((sprite:any)=>sprite.color.asArray())),
   resources:Object.fromEntries(Object.entries(g.inspectPerformance().resources).filter(([key])=>key!=='activeMeshes'))};
 });
 await page.locator('#overlay').evaluate(el=>el.style.visibility='hidden');
 const previews=[];
 for(const view of ['spawn','shore','ridge']){
  await page.evaluate(async view=>{
   const {worldPoint}=await import('/src/data/maps.ts'),g=(window as any).__WILDLANDS__,s=g.sim.state,lake=g.world.profile.lake;
   const peak=g.world.profile.composition.forms.reduce((a:any,b:any)=>a.height>b.height?a:b);
   const point=view==='spawn'?{x:0,z:0}:view==='ridge'?worldPoint(peak,g.world.profile):{x:lake.x,z:lake.z-lake.waterRadius-6};
   Object.assign(s.player,{...point,y:0});Object.assign(s.party[0],point);g.camera.target.set(point.x,g.world.height(point.x,point.z)+2,point.z);
  },view);
  for(const seconds of [0,420,720,900]){
   const atmosphere=await page.evaluate(seconds=>{const world=(window as any).__WILDLANDS__.world;world.setAtmospherePreview(seconds);return world.inspectAtmosphere();},seconds);
   expect(atmosphere.seconds).toBe(seconds);expect(atmosphere.fogStart).toBeGreaterThanOrEqual(44);
   await page.waitForTimeout(50);await page.screenshot({path:`${output}/${map}-${view}-${seconds/60}m.png`});previews.push({view,...atmosphere});
  }
 }
 const afterPreview=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__;
  return {save:JSON.stringify(g.save),elapsed:g.sim.state.stats.elapsed,camera:[g.camera.alpha,g.camera.beta,g.camera.radius],
   spriteColors:g.scene.spriteManagers.flatMap((manager:any)=>manager.sprites.map((sprite:any)=>sprite.color.asArray())),
   nearest:g.scene.spriteManagers.filter((manager:any)=>manager.name.startsWith('pmd-')).every((manager:any)=>manager.texture.samplingMode===1),resources:Object.fromEntries(Object.entries(g.inspectPerformance().resources).filter(([key])=>key!=='activeMeshes'))};
 });
 expect(afterPreview.save).toBe(initial.save);expect(afterPreview.elapsed).toBe(JSON.parse(initial.state).stats.elapsed);
 expect(afterPreview.camera).toEqual(initial.camera);expect(afterPreview.spriteColors).toEqual(initial.spriteColors);expect(afterPreview.nearest).toBe(true);
 expect(afterPreview.resources).toEqual(initial.resources);
 for(const kind of ['shrine','cache','grove']){
  const site=await page.evaluate(kind=>{
   const g=(window as any).__WILDLANDS__,s=g.sim.state;
   const obstruction=(site:any)=>g.scene.meshes.filter((m:any)=>(m.name.startsWith('crown-')||m.name.startsWith('great-pine-'))&&Math.abs(m.position.x-site.x)<6&&m.position.z<site.z&&m.position.z>site.z-24).length;
   const sites=kind==='grove'?s.berryTrees:s.pois.filter((p:any)=>p.kind===kind&&!p.availableAt);
   const site=[...sites].sort((a:any,b:any)=>obstruction(a)-obstruction(b))[0];
   Object.assign(s.player,{x:site.x,z:site.z-6,y:0});Object.assign(s.party[0],{x:site.x,z:site.z-6});g.camera.target.set(site.x,g.world.height(site.x,site.z)+2,site.z-6);
   g.world.setAtmospherePreview(0);return {uid:site.uid,x:site.x,z:site.z};
  },kind);
  for(const visible of [true,false]){
   const safe=await page.evaluate(visible=>{
    const g=(window as any).__WILDLANDS__,before=JSON.stringify(g.sim.state);g.world.setLandmarkDressingVisible(visible);
    return before===JSON.stringify(g.sim.state)&&g.scene.meshes.filter((m:any)=>m.metadata?.landmarkDressing).every((m:any)=>!m.isPickable&&!m.checkCollisions);
   },visible);
   expect(safe).toBe(true);await page.waitForTimeout(50);await page.screenshot({path:`${output}/${map}-${kind}-dressing-${visible?'on':'off'}.png`});
  }
  expect(site.uid).toBeGreaterThan(0);
 }
 const combat=await page.evaluate(async()=>{
  const {createEnemy}=await import('/src/game/systems/spawning.ts');
  const g=(window as any).__WILDLANDS__,s=g.sim.state;Object.assign(s.player,{x:0,z:0,y:0});Object.assign(s.party[0],{x:0,z:0});g.camera.target.set(0,g.world.height(0,0)+2,0);
  const enemy=createEnemy(s,g.sim.rng,102,'normal',8,8);Object.assign(enemy,{speed:0,attackCooldown:0});s.enemies=[enemy];
  s.phase='playing';g.sim.update(.01,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});s.phase='paused';g.fx.update(s,0);
  g.world.setAtmospherePreview(900);return {uid:enemy.uid,move:enemy.windup?.moveName};
 });
 expect(combat.move).toBe('Egg Bomb');
 await expect.poll(()=>page.evaluate(()=>{const g=(window as any).__WILDLANDS__;return g.visuals.inspect().some((actor:any)=>actor.speciesId===102&&actor.source.includes('/pmd/'));})).toBe(true);
 expect(await page.evaluate(uid=>{const warning=(window as any).__WILDLANDS__.scene.getMeshByName(`combat-windup-${uid}`);return !!warning?.isEnabled();},combat.uid)).toBe(true);
 await page.screenshot({path:`${output}/${map}-combat-15m.png`});
 await page.evaluate(()=>{const s=(window as any).__WILDLANDS__.sim.state;s.enemies=[];s.projectiles=[];});
 await page.evaluate(()=>{const world=(window as any).__WILDLANDS__.world;world.setLandmarkDressingVisible(true);world.setAtmospherePreview(null);});
 await page.locator('#overlay').evaluate(el=>el.style.visibility='');
 const interactions=await page.evaluate(async()=>{
  const {explorationRoute}=await import('/src/game/systems/environment.ts');
  const g=(window as any).__WILDLANDS__,s=g.sim.state,idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
  const resolve=()=>{for(let i=0;i<30&&s.phase==='choice';i++)g.sim.choose(s.upgradeChoices[0].id);};
  const walk=(site:any)=>{
   resolve();s.phase='playing';Object.assign(s.player,{x:0,z:0,y:0});
   for(const end of explorationRoute(site,g.world.profile).slice(1)){
    for(let i=0;i<6000&&Math.hypot(end.x-s.player.x,end.z-s.player.z)>.25;i++){
     const distance=Math.hypot(end.x-s.player.x,end.z-s.player.z);g.sim.update(.02,{...idle,mx:(end.x-s.player.x)/distance,mz:(end.z-s.player.z)/distance});
    }
    if(Math.hypot(end.x-s.player.x,end.z-s.player.z)>.35)throw Error(`Blocked approach to ${site.uid}`);
   }
   g.sim.update(.02,{...idle,interact:true});g.world.update(0,s.pois,s.stats.elapsed,s.terrainFeatures,s.berryTrees);
  };
  const free=s.pois.find((p:any)=>p.kind==='cache'&&p.price===undefined&&!p.availableAt);walk(free);
  const frozenChoice=JSON.stringify(g.world.inspectAtmosphere()),choiceTime=s.stats.elapsed;
  await new Promise(resolve=>setTimeout(resolve,150));
  const discovery={used:free.used,choices:s.upgradeChoices.length,hidden:!g.scene.getTransformNodeByName(`dressing-cache-${free.uid}`).isEnabled(),choiceFrozen:JSON.stringify(g.world.inspectAtmosphere())===frozenChoice&&s.stats.elapsed===choiceTime};resolve();
  const paid=s.pois.find((p:any)=>p.price!==undefined);s.coins=10000;const coins=s.coins;walk(paid);
  const chest={used:paid.used,cost:coins-s.coins,choices:s.upgradeChoices.length,reset:paid.respawnAt>s.stats.elapsed,visible:g.scene.getTransformNodeByName(`dressing-cache-${paid.uid}`).isEnabled()};resolve();
  const shrine=s.pois.find((p:any)=>p.kind==='shrine'&&!p.availableAt);walk(shrine);
  const trial={active:!!shrine.challenge,guardians:s.enemies.filter((e:any)=>e.challengeSiteId===shrine.uid&&!e.dead).length};
  for(const enemy of [...s.enemies])if(enemy.challengeSiteId===shrine.uid&&!enemy.dead)g.sim.damageEnemy(enemy,enemy.maxHp*2,'normal',s.party[0].uid);
  const reward={won:!shrine.challenge,uses:shrine.uses,reset:shrine.respawnAt>s.stats.elapsed,item:s.drops.some((drop:any)=>drop.kind==='item')};resolve();
  const tree=s.berryTrees[0],berry=tree.berries[0],kind=tree.berry,stacks=s.berryBuffs[kind]?.length??0;
  s.phase='playing';Object.assign(s.player,{x:berry.x,z:berry.z});g.sim.update(.02,idle);
  const harvest={collected:berry.collected,reward:(s.berryBuffs[kind]?.length??0)>stacks};
  s.phase='paused';g.world.update(0,s.pois,s.stats.elapsed,s.terrainFeatures,s.berryTrees);
  return {discovery,chest,trial,reward,harvest,atmosphere:g.world.inspectAtmosphere(),elapsed:s.stats.elapsed};
 });
 expect(interactions.discovery).toMatchObject({used:true,hidden:true,choiceFrozen:true});expect(interactions.discovery.choices).toBeGreaterThan(0);
 expect(interactions.chest).toMatchObject({used:true,reset:true,visible:true});expect(interactions.chest.cost).toBeGreaterThan(0);expect(interactions.chest.choices).toBeGreaterThan(0);
 expect(interactions.trial.active).toBe(true);expect(interactions.trial.guardians).toBeGreaterThan(0);expect(interactions.reward).toMatchObject({won:true,uses:1,reset:true,item:true});
 expect(interactions.harvest).toEqual({collected:true,reward:true});
 const frozen=await page.evaluate(()=>{const g=(window as any).__WILDLANDS__;return {elapsed:g.sim.state.stats.elapsed,atmosphere:g.world.inspectAtmosphere()};});
 await page.waitForTimeout(150);expect(await page.evaluate(()=>{const g=(window as any).__WILDLANDS__;return {elapsed:g.sim.state.stats.elapsed,atmosphere:g.world.inspectAtmosphere()};})).toEqual(frozen);
 expect(errors).toEqual([]);await writeFile(`${output}/${map}-validation.json`,JSON.stringify({initial:{camera:initial.camera},previews,interactions,errors},null,2));
});
