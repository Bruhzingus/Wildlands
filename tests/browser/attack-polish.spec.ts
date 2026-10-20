import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const game=(page:Page,expression:string)=>page.evaluate(expression=>{
 const g=(window as any).__WILDLANDS__;
 return new Function('g',`return (${expression})(g)`)(g);
},expression);
const identity={forward:0,lift:0,scaleX:1,scaleY:1,lean:0};
const normalized=(value:unknown)=>JSON.parse(JSON.stringify(value));
const prepare=async(page:Page,reducedMotion=false)=>{
 await page.emulateMedia({reducedMotion:reducedMotion?'reduce':'no-preference'});
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect(page.locator('#overlay')).toBeHidden();
 await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 await game(page,`g=>{
  const s=g.sim.state,p=s.player,m=s.party[0],e=s.enemies[0];
  p.x=0;p.z=0;p.y=0;p.iframes=10000;p.hp=p.maxHp*.8;
  Object.assign(m,{x:0,z:0,facing:Math.PI/2,animation:'attack',attackTimer:.32,attackDuration:.32,cooldown:10});
  s.enemies=[{...e,speciesId:19,variant:'normal',x:4,z:1,facing:-Math.PI/2,hp:10000,maxHp:10000,
   size:1.2,speed:0,stunTime:0,hitCooldown:10,attackCooldown:10,animation:'attack',attackTimer:.32,attackDuration:.32}];
  s.projectiles=[];s.drops=[];g.camera.alpha=-Math.PI/2;g.camera.beta=1.05;g.camera.radius=18;g.camera.getViewMatrix(true);
  g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),0);
  g.healthBars.sync(s,1,(x,z)=>g.world.height(x,z));
 }`);
 await expect.poll(()=>game(page,`g=>g.visuals.inspect().length===2&&g.visuals.inspect().every(a=>a.requested==='attack'&&a.resolved==='Attack'&&a.source.includes('/assets/pmd/'))`)).toBe(true);
};
const sample=(page:Page,progress:number)=>game(page,`g=>{
 const s=g.sim.state;
 for(const a of [...s.party,...s.enemies]){a.animation='attack';a.attackTimer=a.attackDuration*(1-${progress});}
 g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),s.player.y);
 g.healthBars.sync(s,0,(x,z)=>g.world.height(x,z));g.scene.render();
 return g.visuals.inspect().map(a=>{
  const avatar=g.visuals.actors.get(a.uid).avatar,sprite=avatar.sprite,asset=avatar.asset;
  const actor=[...s.party,...s.enemies].find(actor=>actor.uid===a.uid),V=g.camera.target.constructor,view=g.camera.getViewMatrix();
  const center=V.TransformCoordinates(sprite.position,view),anchor=asset.anchors[avatar.row%asset.anchors.length]*sprite.height/asset.meta.height;
  const expected=V.TransformCoordinates(new V(actor.x+Math.sin(actor.facing)*a.pose.forward,
   g.world.height(actor.x,actor.z)+(actor===s.party[0]?s.player.y:0)+a.pose.lift,actor.z+Math.cos(actor.facing)*a.pose.forward),view);
  const footError=Math.hypot(center.x+anchor*Math.sin(sprite.angle)-expected.x,center.y-anchor*Math.cos(sprite.angle)-expected.y,center.z-expected.z);
  return {...a,footError,rendered:{width:sprite.width,height:sprite.height,angle:sprite.angle,x:sprite.position.x,y:sprite.position.y,z:sprite.position.z}};
 });
}`);

test('loaded player and enemy attack sheets gain restrained anticipation, strike and recovery without drift',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await prepare(page);
 const base=await sample(page,0),anticipation=await sample(page,.16),strike=await sample(page,.42),recovery=await sample(page,.8),end=await sample(page,1);
 expect(base.map((a:any)=>a.attackStyle)).toEqual(['pulse','quick']);
 for(let i=0;i<base.length;i++){
  expect(normalized(base[i].pose)).toEqual(identity);expect(normalized(end[i].pose)).toEqual(identity);
  expect(normalized(end[i].rendered)).toEqual(normalized(base[i].rendered));
  expect(anticipation[i].pose).not.toEqual(identity);expect(strike[i].pose).not.toEqual(identity);
  expect(recovery[i].pose).not.toEqual(strike[i].pose);
  expect(strike[i].rendered).not.toEqual(base[i].rendered);
  expect(end[i].frame).toBeGreaterThan(base[i].frame);
  for(const phase of [anticipation,strike,recovery]){
   const a=phase[i],r=a.rendered,b=base[i].rendered;
   expect(a.footError).toBeLessThan(.00001);
   expect(a.resolved).toBe('Attack');expect(a.visible).toBe(true);
   expect(r.width/b.width).toBeCloseTo(a.pose.scaleX,5);expect(r.height/b.height).toBeCloseTo(a.pose.scaleY,5);
   expect(Math.abs(r.angle)).toBeLessThan(.16);
   expect(Math.hypot(r.x-b.x,r.y-b.y,r.z-b.z)).toBeLessThan(.7);
   expect(r.width/b.width).toBeGreaterThan(.85);expect(r.width/b.width).toBeLessThan(1.15);
   expect(r.height/b.height).toBeGreaterThan(.85);expect(r.height/b.height).toBeLessThan(1.15);
  }
 }
 const frozen=await sample(page,.42);
 for(let i=0;i<20;i++)expect(await sample(page,.42)).toEqual(frozen);
 const pausedState=await game(page,'g=>JSON.stringify(g.sim.state)');
 const pausedVisuals=await game(page,'g=>g.visuals.inspect()');
 await page.keyboard.down('w');await page.mouse.move(900,400,{steps:3});await page.waitForTimeout(180);await page.keyboard.up('w');
 expect(await game(page,'g=>JSON.stringify(g.sim.state)')).toBe(pausedState);
 expect(await game(page,'g=>g.visuals.inspect()')).toEqual(pausedVisuals);
 expect((await sample(page,.42))).toEqual(frozen);
 const mirror=await game(page,`g=>{
  const s=g.sim.state,e=s.enemies[0],sync=()=>g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),s.player.y);
  sync();const first=g.visuals.inspect().find(a=>a.uid===e.uid).angle;e.facing+=Math.PI;sync();
  const second=g.visuals.inspect().find(a=>a.uid===e.uid).angle;e.facing-=Math.PI;sync();return {first,second};
 }`);
 expect(mirror.first*mirror.second).toBeLessThan(0);expect(mirror.first).toBeCloseTo(-mirror.second,6);
 await game(page,`g=>{
  const s=g.sim.state;for(const a of [...s.party,...s.enemies]){a.animation='idle';a.attackTimer=0;}
  g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),s.player.y);
 }`);
 expect((await game(page,'g=>g.visuals.inspect()')).every((a:any)=>a.pose.forward===0&&a.pose.lift===0&&a.pose.scaleX===1&&a.pose.scaleY===1&&a.pose.lean===0)).toBe(true);

 await mkdir('artifacts/browser',{recursive:true});
 await page.locator('#overlay').evaluate(node=>{(node as HTMLElement).style.visibility='hidden';});
 await sample(page,0);
 await expect.poll(()=>game(page,`g=>g.visuals.inspect().every(a=>a.resolved==='Attack')`)).toBe(true);
 const frames:{phase:string;image:string}[]=[];
 for(const [phase,progress] of [['Ready',0],['Anticipation',.16],['Strike',.42],['Recovery',.8]] as const){
  await sample(page,progress);
  await game(page,`g=>{
   const s=g.sim.state,e=s.enemies[0];g.fx.update(s,.4);
   if('${phase}'==='Strike'){
    g.fx.onEvent({kind:'attack',shape:'slash',sourceId:e.uid,x:e.x,z:e.z,radius:2.8,color:'#e4f6f8',duration:.32});
    g.fx.update(s,.1);
   }g.scene.render();
  }`);
  const bytes=await page.screenshot({clip:{x:390,y:230,width:700,height:410}});
  frames.push({phase,image:bytes.toString('base64')});
  if(phase==='Strike')await page.screenshot({path:'artifacts/browser/attack-polish.png'});
 }
 const html=`<!doctype html><meta charset="utf-8"><style>body{margin:16px;background:#172015;color:#e0e6d2;font:14px monospace}main{display:grid;grid-template-columns:repeat(2,700px);gap:14px}figure{margin:0}figcaption{padding:8px 0}img{display:block;width:700px;height:410px}</style><main>${frames.map(f=>`<figure><figcaption>${f.phase}</figcaption><img src="data:image/png;base64,${f.image}"></figure>`).join('')}</main>`;
 await writeFile('artifacts/browser/attack-polish-contact-sheet.html',html);
 const sheet=await page.context().newPage();await sheet.setViewportSize({width:1448,height:930});await sheet.setContent(html);
 await sheet.screenshot({path:'artifacts/browser/attack-polish-contact-sheet.png',fullPage:true});await sheet.close();
 expect(errors).toEqual([]);
});

test('directional slash compiles in WebGL, freezes while paused and fades into the reusable pool',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await prepare(page);await sample(page,.42);
 const read=`g=>{
  const mesh=g.scene.meshes.find(m=>m.name==='combat-attack'&&m.isEnabled()&&m.instancedBuffers?.instanceColor);
  return mesh?{angle:mesh.rotation.y,alpha:mesh.instancedBuffers.instanceColor.a,x:mesh.position.x,z:mesh.position.z,
   ready:mesh.material.isReady(mesh),enabled:mesh.isEnabled(),vertices:mesh.getTotalVertices()}:null;
 }`;
 await game(page,`g=>{
  const s=g.sim.state,e=s.enemies[0];g.fx.update(s,0);
  g.fx.onEvent({kind:'attack',shape:'slash',sourceId:e.uid,x:e.x,z:e.z,radius:2.8,color:'#e4f6f8',duration:.32});g.scene.render();
 }`);
 await expect.poll(()=>game(page,read)).toMatchObject({ready:true,enabled:true});
 const first=await game(page,read);expect(first.alpha).toBeGreaterThan(0);expect(first.vertices).toBeGreaterThan(0);
 await page.waitForTimeout(160);expect(await game(page,read)).toEqual(first);
 await game(page,'g=>{g.fx.update(g.sim.state,.08);g.scene.render();}');
 const moved=await game(page,read);
 expect(moved.alpha).toBeLessThan(first.alpha);expect(moved.angle).not.toBe(first.angle);
 expect(Math.hypot(moved.x-first.x,moved.z-first.z)).toBeLessThan(.5);
 await game(page,'g=>{g.fx.update(g.sim.state,.4);g.scene.render();}');
 expect(await game(page,read)).toBeNull();
 const allocated=await game(page,'g=>g.fx.inspect().allocated');
 await game(page,`g=>{
  const s=g.sim.state,e=s.enemies[0];g.fx.onEvent({kind:'attack',shape:'slash',sourceId:e.uid,x:e.x,z:e.z,radius:2.8,color:'#e4f6f8',duration:.32});g.scene.render();
 }`);
 expect((await game(page,read)).alpha).toBeCloseTo(first.alpha,6);
 expect(await game(page,'g=>g.fx.inspect().allocated')).toBe(allocated);
 expect(errors).toEqual([]);
});

test('enemy windup holds anticipation until release and cancellation returns to neutral',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await prepare(page);
 const charge=await game(page,`g=>{
  const s=g.sim.state,e=s.enemies[0];e.isBoss=true;e.attackTimer=0;
  e.windup={kind:'volley',remaining:.35,duration:.7,x:s.player.x,z:s.player.z,facing:e.facing};
  g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),s.player.y);
  return g.visuals.inspect().find(a=>a.uid===e.uid);
 }`);
 expect(charge.attackStyle).toBe('ranged');expect(charge.posePhase).toBe('windup');
 expect(charge.pose).not.toEqual(identity);expect(charge.resolved).toBe('Attack');expect(charge.frame).toBe(0);
 const held=await game(page,`g=>{
  const s=g.sim.state,e=s.enemies[0];e.windup.remaining=.001;
  g.visuals.sync(s.party,s.enemies,.2,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),s.player.y);
  return g.visuals.inspect().find(a=>a.uid===e.uid);
 }`);
 expect(held.posePhase).toBe('windup');expect(held.frame).toBe(0);
 expect(held.pose.forward).toBeGreaterThanOrEqual(0);expect(held.pose).toEqual(charge.pose);
 const releaseStart=await game(page,`g=>{
  const s=g.sim.state,e=s.enemies[0];e.windup=undefined;e.animation='attack';e.attackDuration=.42;e.attackTimer=.42;
  g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),s.player.y);
  return g.visuals.inspect().find(a=>a.uid===e.uid);
 }`);
 expect(releaseStart.posePhase).toBe('attack');expect(releaseStart.frame).toBe(0);
 expect(releaseStart.pose).toEqual(held.pose);expect(releaseStart.position).toEqual(held.position);
 const released=await game(page,`g=>{
  const s=g.sim.state,e=s.enemies[0];e.windup=undefined;e.animation='attack';e.attackDuration=.42;e.attackTimer=.42*(1-.42);
  g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),s.player.y);
  return g.visuals.inspect().find(a=>a.uid===e.uid);
 }`);
 expect(released.posePhase).toBe('attack');expect(released.pose).not.toEqual(held.pose);
 expect(released.attackStyle).toBe('ranged');
 expect(released.frame).toBeGreaterThan(0);
 const cancelled=await game(page,`g=>{
  const s=g.sim.state,e=s.enemies[0];e.windup={kind:'volley',remaining:.2,duration:.7,x:s.player.x,z:s.player.z,facing:e.facing};e.stunTime=1;
  s.phase='playing';g.sim.update(.02,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});s.phase='paused';
  g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),s.player.y);
  return g.visuals.inspect().find(a=>a.uid===e.uid);
 }`);
 expect(cancelled.posePhase).toBe('idle');expect(normalized(cancelled.pose)).toEqual(identity);expect(cancelled.angle).toBeCloseTo(0,8);
 expect(errors).toEqual([]);
});

test('reduced motion retains actual one-shot attack frames while suppressing extra transforms',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await prepare(page,true);
 const first=await sample(page,0);
 for(const progress of [.16,.42,.8,1]){
  const phase=await sample(page,progress);
  for(let i=0;i<phase.length;i++){
   expect(normalized(phase[i].pose)).toEqual(identity);expect(normalized(phase[i].rendered)).toEqual(normalized(first[i].rendered));
   expect(phase[i].resolved).toBe('Attack');expect(phase[i].visible).toBe(true);
   if(progress===1)expect(phase[i].frame).toBeGreaterThan(first[i].frame);
  }
 }
 expect(errors).toEqual([]);
});
