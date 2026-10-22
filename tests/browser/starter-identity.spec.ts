import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const game=(page:Page,expression:string)=>page.evaluate(expression=>new Function('g',`return (${expression})(g)`)((window as any).__WILDLANDS__),expression);
const activeVisuals=`g=>g.scene.meshes.filter(m=>m.name.startsWith('combat-special-')&&m.isEnabled()&&m.isVisible).map(m=>({name:m.name,x:m.position.x,z:m.position.z,scale:[m.scaling.x,m.scaling.y,m.scaling.z],vertices:m.getTotalVertices(),ready:m.material.isReady(m)}))`;

test('Play stays visible on the title screen and starts the chosen partner',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');
 await expect(page.locator('.game-version')).toHaveText('v0.3.0');
 await expect(page.locator('.game-version')).toBeInViewport();
 const play=page.locator('#play-btn');
 await expect(play).toBeInViewport();
 await expect(play).toHaveText('Play as Bulbasaur');
 await page.locator('[data-starter="4"]').focus();
 await expect(play).toHaveText('Play as Charmander');
 await play.click();
 await expect.poll(()=>game(page,'g=>g.sim?.state.party[0].speciesId')).toBe(4);
 await expect(page.locator('#overlay')).toBeHidden();
 await expect.poll(()=>game(page,'g=>g.sim?.state.phase')).toBe('playing');
 expect(errors).toEqual([]);
});

test('starter choices explain different attacks and the HUD names the equipped Q ability',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');
 const descriptions=await page.locator('.starter-card .starter-moves').allTextContents();
 expect(descriptions).toHaveLength(4);expect(new Set(descriptions).size).toBe(4);
 for(const id of [1,4,7,25])await expect(page.locator(`[data-starter="${id}"] .starter-move`)).toHaveCount(id===25?3:2);
 await expect(page.locator('[data-starter="1"]')).toContainText('Bramble Garden');
 await expect(page.locator('[data-starter="4"]')).toContainText('Flamethrower');
 await expect(page.locator('[data-starter="7"]')).toContainText('Surf');
 await expect(page.locator('[data-starter="25"]')).toContainText('Thunder Circuit');
 await page.setViewportSize({width:390,height:844});
 expect(await page.locator('.starter-grid').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.setViewportSize({width:1440,height:900});
 await page.locator('[data-starter="7"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect(page.locator('#special-cd')).toContainText('SURF');
 await expect(page.locator('#special-cd')).toHaveAttribute('data-special','surf');
 await page.keyboard.press('Escape');await expect(page.locator('.build-special')).toContainText('Q / Surf');
 expect(errors).toEqual([]);
});

test('distinct special geometry compiles, keeps area coverage, travels, pauses and recycles',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 await game(page,`g=>{
  const s=g.sim.state;s.enemies=[];s.projectiles=[];s.drops=[];g.fx.update(s,20);
  const events=[
   {shape:'garden',x:-6,z:5,radius:3,duration:2,color:'#8ebc72'},
   {shape:'sleep',x:-7,z:-5,radius:3,duration:2,color:'#8ebc72'},
   {shape:'curse',x:6,z:-5,radius:3,duration:2,color:'#b299d2'},
   {shape:'cone',x:0,z:0,radius:8,duration:2,facing:0,angle:1.05,color:'#ef9860'},
   {shape:'column',x:6,z:5,radius:1.3,duration:2,color:'#edd168'},
   {shape:'wave',x:0,z:-3,toX:0,toZ:9,radius:3.5,endRadius:7,duration:2,color:'#7db9df'},
   {shape:'volley',x:6,z:0,radius:10,duration:2,color:'#c4a1dd'},
  ];
  for(const event of events)g.fx.onEvent({kind:'special',...event});
  g.scene.render();
 }`);
 await expect.poll(()=>game(page,activeVisuals)).toEqual(expect.arrayContaining([
  expect.objectContaining({name:'combat-special-garden',ready:true}),
  expect.objectContaining({name:'combat-special-garden-thorn',ready:true}),
  expect.objectContaining({name:'combat-special-sleep-wisp',ready:true}),
  expect.objectContaining({name:'combat-special-curse-sigil',ready:true}),
  expect.objectContaining({name:'combat-special-cone',ready:true}),
  expect.objectContaining({name:'combat-special-column',ready:true}),
  expect.objectContaining({name:'combat-special-wave',ready:true}),
  expect.objectContaining({name:'combat-special-cast',ready:true}),
 ]));
 const first=await game(page,activeVisuals);
 expect(first.every((mesh:any)=>mesh.vertices>0)).toBe(true);
 expect(first.some((mesh:any)=>mesh.name==='combat-special')).toBe(false);
 await page.waitForTimeout(120);expect(await game(page,activeVisuals)).toEqual(first);
 await game(page,'g=>{g.fx.update(g.sim.state,1);g.scene.render();}');
 const advanced=await game(page,activeVisuals);
 expect(advanced.find((mesh:any)=>mesh.name==='combat-special-wave').z).toBeCloseTo(3,5);
 expect(advanced.find((mesh:any)=>mesh.name==='combat-special-wave').scale[0]).toBeCloseTo(5.25,5);
 for(const name of ['combat-special-garden','combat-special-cone'])expect(advanced.find((mesh:any)=>mesh.name===name).scale).toEqual(first.find((mesh:any)=>mesh.name===name).scale);
 expect(advanced.some((mesh:any)=>mesh.name==='combat-special-cast')).toBe(false);
 await mkdir('artifacts/browser',{recursive:true});
 await page.locator('#overlay').evaluate(el=>{(el as HTMLElement).style.visibility='hidden';});
 await page.screenshot({path:'artifacts/browser/starter-special-shapes.png'});
 await page.locator('#overlay').evaluate(el=>{(el as HTMLElement).style.visibility='';});
 await game(page,'g=>{g.fx.update(g.sim.state,2);g.scene.render();}');
 expect(await game(page,activeVisuals)).toEqual([]);
 const allocated=await game(page,'g=>g.fx.inspect().allocated');
 await game(page,`g=>{g.fx.onEvent({kind:'special',shape:'garden',x:-6,z:5,radius:3,duration:2,color:'#8ebc72'});g.scene.render();}`);
 expect(await game(page,'g=>g.fx.inspect().allocated')).toBe(allocated);
 expect(errors).toEqual([]);
});

test('the four opening partners cast their actual distinct specials in the live renderer',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await mkdir('artifacts/browser',{recursive:true});
 for(const [id,shape] of [[1,'garden'],[4,'cone'],[7,'wave'],[25,'column']] as const){
  await page.goto('/?dev=1');await page.locator(`[data-starter="${id}"]`).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
  await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBe(true);
  await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
  const events=await game(page,`g=>{
   const s=g.sim.state,p=s.player,original=g.sim.onEvent,events=[];g.sim.onEvent=event=>{events.push(event);original(event);};
   p.x=0;p.z=0;p.iframes=10000;p.specialCooldown=0;s.party[0].x=0;s.party[0].z=0;s.party[0].cooldown=100;
   const template=s.enemies[0];s.enemies=Array.from({length:4},(_,i)=>({...template,uid:s.idCounter++,x:(i-1.5)*2,z:7+i*.7,hp:10000,maxHp:10000,speed:0,stunTime:100,hitCooldown:100}));
   g.sim.spawnAccum=-100;g.fx.update(s,10);
   s.phase='playing';g.sim.update(.04,{mx:0,mz:0,jump:false,dodge:false,special:true,interact:false});s.phase='paused';
   g.fx.update(s,.04);g.ui.refresh(s);g.camera.alpha=-Math.PI/2;g.camera.beta=1.05;g.camera.radius=24;
   g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),p.y);g.scene.render();return events;
  }`);
  expect(events.filter((event:any)=>event.kind==='special').map((event:any)=>event.shape)).toEqual([shape]);
  await expect.poll(()=>game(page,activeVisuals)).toEqual(expect.arrayContaining([expect.objectContaining({name:`combat-special-${shape}`,ready:true})]));
  await page.locator('#overlay').evaluate(el=>{(el as HTMLElement).style.visibility='hidden';});
  await page.screenshot({path:`artifacts/browser/starter-${id}-special.png`});
 }
 expect(errors).toEqual([]);
});
