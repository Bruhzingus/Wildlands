import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const game=(page:Page,expression:string)=>page.evaluate(expression=>new Function('g',`return (${expression})(g)`)((window as any).__WILDLANDS__),expression);
const starters=[1,4,7,10,16,25,27,37,43,52,58,63,66,92,133];

test('all fifteen starter specials cast with Q, render, pause and deal their distinct damage',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[],consoleErrors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 await mkdir('artifacts/browser',{recursive:true});
 const frames:{id:number;name:string;shape:string;image:string}[]=[],results:unknown[]=[];
 for(const id of starters){
  await game(page,`g=>{
   const s=g.sim.state,p=s.player,m=s.party[0],template=s.enemies[0]??g.specialSmokeTemplate;
   g.specialSmokeTemplate=template;g.specialSmokeEvents=[];g.specialSmokeCapture=true;
   if(!g.specialSmokeListener){g.specialSmokeListener=g.sim.onEvent;g.sim.onEvent=event=>{
    g.specialSmokeEvents.push(event);g.specialSmokeListener(event);
    if(event.kind==='special'&&g.specialSmokeCapture){g.specialSmokeCapture=false;g.sim.state.phase='paused';}
   };}
   s.enemies=Array.from({length:8},(_,i)=>({...template,uid:s.idCounter++,speciesId:19,variant:'normal',x:(i%3-1)*2,z:4+Math.floor(i/3)*2,hp:100000,maxHp:100000,speed:0,stunTime:100,hitCooldown:100,attackCooldown:100,poisonTime:0,burnTime:0,slowTime:0,soakedTime:0,dead:false,windup:undefined}));
   Object.assign(p,{x:0,z:0,y:0,vy:0,hp:p.maxHp,iframes:10000,specialCooldown:0,facing:0});
   Object.assign(m,{speciesId:${id},x:0,z:0,attackLevel:1,attackTimer:0,cooldown:1000,learnedMoves:[],facing:0});
   s.projectiles=[];s.activeSpecials=[];s.drops=[];s.items=[];s.stats.xpToNext=1e12;g.sim.spawnAccum=-1000;
   g.fx.update(s,100);g.ui.refresh(s);g.camera.alpha=-Math.PI/2;g.camera.beta=.9;g.camera.radius=24;
  }`);
  await page.locator('#resume-btn').click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
  await expect(page.locator('#overlay')).toBeHidden();
  await expect.poll(()=>game(page,'g=>g.pointerCaptured&&g.sim.state.phase==="playing"&&g.lastPhase==="playing"')).toBe(true);
  await page.keyboard.press('q');
  await expect.poll(()=>game(page,'g=>g.sim.state.player.specialCooldown')).toBeGreaterThan(0);
  // Freeze at the authoritative cast event so brief strikes are sampled before
  // their intended recovery gap, regardless of software WebGL frame timing.
  await expect(page.locator('#resume-btn')).toBeVisible();
  await expect.poll(()=>game(page,`g=>{g.scene.render();return g.scene.isReady();}`)).toBe(true);
  await expect.poll(()=>game(page,`g=>{
   g.scene.render();return g.scene.meshes.filter(mesh=>mesh.name.startsWith('combat-')&&mesh.isEnabled()&&mesh.isVisible&&!mesh.material.isReady(mesh.sourceMesh??mesh,Boolean(mesh.sourceMesh))).map(mesh=>mesh.name);
  }`),{message:`Starter ${id} materials compile for their actual instanced draw`}).toEqual([]);
  const cast=await game(page,`g=>{
   const special=g.specialSmokeEvents.filter(event=>event.kind==='special');
   const visible=g.scene.meshes.filter(mesh=>mesh.name.startsWith('combat-')&&mesh.isEnabled()&&mesh.isVisible);
   return {special,visible:visible.map(mesh=>({name:mesh.name,ready:mesh.material.isReady(mesh.sourceMesh??mesh,Boolean(mesh.sourceMesh)),vertices:mesh.getTotalVertices()})),state:JSON.stringify(g.sim.state),damage:g.sim.state.stats.damageDealt};
  }`);
  expect(cast.special).toHaveLength(1);expect(cast.visible.length).toBeGreaterThan(0);
  expect(cast.visible.every((mesh:any)=>mesh.ready&&mesh.vertices>0)).toBe(true);
  await page.waitForTimeout(90);expect(await game(page,'g=>JSON.stringify(g.sim.state)')).toBe(cast.state);
  await page.locator('#overlay').evaluate(node=>{(node as HTMLElement).style.visibility='hidden';});
  const bytes=await page.screenshot();
  await page.locator('#overlay').evaluate(node=>{(node as HTMLElement).style.visibility='';});
  frames.push({id,name:cast.special[0].label,shape:cast.special[0].shape,image:bytes.toString('base64')});
  const completed=await game(page,`g=>{
   const s=g.sim.state;s.phase='playing';
   for(let frame=0;frame<100;frame++){g.sim.update(.02,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});g.fx.update(s,.02);}
   s.phase='paused';g.scene.render();
   return {hits:g.specialSmokeEvents.filter(event=>event.kind==='hit'&&event.damageTo==='enemy').length,damage:s.enemies.reduce((sum,e)=>sum+e.maxHp-e.hp,0),fx:g.fx.inspect(),finite:[s.player.x,s.player.z,...s.projectiles.flatMap(p=>[p.x,p.z,p.vx,p.vz])].every(Number.isFinite)};
  }`);
  expect(completed.hits,`Starter ${id} must damage an enemy`).toBeGreaterThan(0);
  expect(completed.damage).toBeGreaterThan(0);expect(completed.finite).toBe(true);
  results.push({id,name:cast.special[0].label,shape:cast.special[0].shape,...completed});
 }
 expect(new Set(frames.map(frame=>frame.name)).size).toBe(starters.length);
 expect(errors).toEqual([]);expect(consoleErrors).toEqual([]);
 await writeFile('artifacts/browser/all-starter-specials.json',JSON.stringify({results,errors,consoleErrors},null,2));
 const html=`<!doctype html><meta charset="utf-8"><style>body{margin:16px;background:#172015;color:#e0e6d2;font:14px monospace}main{display:grid;grid-template-columns:repeat(3,480px);gap:14px}figure{margin:0}figcaption{padding:8px 0}img{display:block;width:480px;height:300px}</style><main>${frames.map(frame=>`<figure><figcaption>${frame.id} / ${frame.name} / ${frame.shape}</figcaption><img src="data:image/png;base64,${frame.image}"></figure>`).join('')}</main>`;
 await writeFile('artifacts/browser/all-starter-specials.html',html);
 const sheet=await page.context().newPage();await sheet.setViewportSize({width:1500,height:900});await sheet.setContent(html);
 await sheet.screenshot({path:'artifacts/browser/all-starter-specials.png',fullPage:true});await sheet.close();
});
