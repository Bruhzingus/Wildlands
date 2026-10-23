import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const output='artifacts/world-atmosphere';
for(const map of ['wildlands','pinewood-route','ruins-route','volcanic-ridge'])test(`${map}: enlarged world has a continuous scenic horizon and compiles atmospheric shaders`,async({page})=>{
 test.setTimeout(150000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|compile|uniform|effect/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{Date.now=()=>4;localStorage.setItem('wildlands-controls-v1',JSON.stringify({graphicsQuality:'high',resolution:1,soundVolume:0,musicVolume:0}));});
 await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
 await page.goto('/?dev=1');
 await page.evaluate(()=>{const g=(window as any).__WILDLANDS__;g.save.unlockedMaps=['wildlands','pinewood-route','ruins-route','volcanic-ridge'];g.ui.showTitle();});
 await page.locator('[data-run-map]').selectOption(map);await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.scene.isReady())).toBe(true);
 await page.keyboard.press('Escape');await page.locator('#resume-btn').waitFor();
 await mkdir(output,{recursive:true});
 await page.locator('#overlay').evaluate(el=>el.style.visibility='hidden');
 await page.evaluate(()=>{(window as any).__WILDLANDS__.sim.state.enemies=[];});
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.visuals.inspect().length)).toBe(1);
 const initial=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  return {state:JSON.stringify(s),meshes:g.scene.meshes.length,materials:g.scene.materials.length,geometries:g.scene.geometries.length};
 });
 const colors=[];
 for(const seconds of [0,900]){
  for(const view of ['spawn','north','east','south','west','corner']){
   const result=await page.evaluate(async({view,seconds})=>{
    const {WORLD}=await import('/src/data/world.ts'),{ObstacleField}=await import('/src/game/systems/environment.ts');
    const g=(window as any).__WILDLANDS__,b=WORLD.hardBoundary-1;
    const p=view==='spawn'?{x:0,z:0}:view==='north'?{x:0,z:b}:view==='south'?{x:0,z:-b}:view==='east'?{x:b,z:0}:view==='west'?{x:-b,z:0}:{x:b,z:b};
    g.camera.target.set(p.x,g.world.height(p.x,p.z)+2,p.z);g.camera.radius=48;g.camera.beta=1.43;
    g.camera.alpha=view==='north'?-Math.PI/2:view==='south'?Math.PI/2:view==='west'?0:view==='corner'?-Math.PI*3/4:Math.PI;
    if(view==='spawn'){g.camera.radius=28;g.camera.beta=1.05;g.camera.alpha=-Math.PI/2;}
    g.world.setAtmospherePreview(seconds);
    const field=new ObstacleField([]),stopped=field.move(p,p.x===0?0:Math.sign(p.x)*50,p.z===0?0:Math.sign(p.z)*50);
    return {width:g.scene.getMeshByName('rolling forest terrain').getBoundingInfo().boundingBox.extendSize.x*2,
     perimeter:g.scene.getMeshByName('scenic perimeter foothills').isEnabled(),sky:g.scene.getMeshByName('atmosphere sky').isEnabled(),bounded:Math.max(Math.abs(stopped.x),Math.abs(stopped.z))<=WORLD.hardBoundary,
     atmosphere:g.world.inspectAtmosphere()};
   },{view,seconds});
   expect(result.width).toBe(359.375);expect(result.perimeter&&result.sky&&result.bounded).toBe(true);
   await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.scene.isReady())).toBe(true);
   await page.waitForTimeout(80);
   if(['spawn','north','corner'].includes(view))await page.screenshot({path:`${output}/${map}-${view}-${seconds}.png`});
   colors.push(result.atmosphere.sky);
  }
 }
 expect(colors[0]).not.toEqual(colors.at(-1));
 const after=await page.evaluate(()=>{const g=(window as any).__WILDLANDS__;return {state:JSON.stringify(g.sim.state),meshes:g.scene.meshes.length,materials:g.scene.materials.length,geometries:g.scene.geometries.length};});
 expect(after).toEqual(initial);expect(errors).toEqual([]);
});
