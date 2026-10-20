import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const game=(page:Page,expression:string)=>page.evaluate(expression=>new Function('g',`return (${expression})(g)`)((window as any).__WILDLANDS__),expression);

test('faction markers render without actor textures, follow the camera, pause and cleanly restart',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 await game(page,`g=>{
  const s=g.sim.state,p=s.player,e=s.enemies[0];
  s.enemies=['dark','rocket','rabid','poisoned','legendary'].map((variant,i)=>({...e,uid:s.idCounter++,variant,speciesId:19,x:p.x-7+i*3.5,z:p.z+7,hp:100,maxHp:100,size:1.18,speed:0,dead:false}));
  g.camera.alpha=-Math.PI/2;g.camera.beta=1.05;g.camera.radius=24;g.camera.getViewMatrix(true);
  g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),s.player.y);
 }`);
 await expect.poll(()=>game(page,'g=>g.visuals.inspect().every(a=>a.resolved!=="artwork")')).toBe(true);
 await expect.poll(()=>game(page,`g=>{
  const markers=g.scene.meshes.filter(m=>m.name.startsWith('variant-cue-')&&!m.name.startsWith('variant-cue-source-')&&m.isEnabled()&&m.isVisible);
  return markers.length===5&&markers.every(m=>m.material.isReady(m,true));
 }`)).toBe(true);
 const before=await game(page,`g=>({cues:g.visuals.inspectCues(),markers:g.scene.meshes.filter(m=>m.name.startsWith('variant-cue-')&&!m.name.startsWith('variant-cue-source-')).map(m=>({visible:m.isEnabled()&&m.isVisible,ready:m.material.isReady(m,true)})),textures:g.scene.textures.filter(t=>t.name.includes('variant')).length})`);
 expect(before.cues.active.map((marker:any)=>marker.cue).sort()).toEqual(['diamond','r','chevrons','droplets','crown'].sort());
 expect(before.cues.allocated).toBe(5);expect(before.cues.sources).toBe(5);expect(before.textures).toBe(0);
 expect(before.markers.every((marker:any)=>marker.visible&&marker.ready)).toBe(true);
 await page.waitForTimeout(150);expect(await game(page,'g=>g.visuals.inspectCues()')).toEqual(before.cues);
 await mkdir('artifacts/browser',{recursive:true});
 await page.locator('#overlay').evaluate(element=>(element as HTMLElement).style.visibility='hidden');
 await page.screenshot({path:'artifacts/browser/phase-faction-markers.png'});
 await page.locator('#overlay').evaluate(element=>(element as HTMLElement).style.visibility='');
 const turned=await game(page,`g=>{g.camera.alpha+=.65;g.camera.getViewMatrix(true);g.visuals.sync(g.sim.state.party,g.sim.state.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z));return g.visuals.inspectCues();}`);
 expect(turned.active.some((marker:any,i:number)=>Math.hypot(marker.x-before.cues.active[i].x,marker.y-before.cues.active[i].y,marker.z-before.cues.active[i].z)>.1)).toBe(true);
 const recycled=await game(page,`g=>{
  const s=g.sim.state,fixture=s.enemies;
  for(let wave=0;wave<20;wave++){
   g.visuals.sync(s.party,[],0,0,(x,z)=>g.world.height(x,z));
   s.enemies=fixture.map(e=>({...e,uid:s.idCounter++}));g.visuals.sync(s.party,s.enemies,0,0,(x,z)=>g.world.height(x,z));
  }return g.visuals.inspectCues();
 }`);
 expect(recycled.allocated).toBe(5);expect(recycled.sources).toBe(5);
 await page.locator('#restart-btn').click();
 expect(await game(page,`g=>({meshes:g.scene.meshes.filter(m=>m.name.startsWith('variant-cue-')).length,materials:g.scene.materials.filter(m=>m.name==='variant-markers').length})`)).toEqual({meshes:0,materials:0});
 expect(errors).toEqual([]);
});
