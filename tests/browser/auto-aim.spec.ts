import {test,expect,type Page} from '@playwright/test';

const game=(page:Page,expression:string)=>page.evaluate(expression=>new Function('g',`return (${expression})(g)`)((window as any).__WILDLANDS__),expression);
const start=async(page:Page)=>{
 await page.goto('/?dev=1');await page.locator('[data-starter="7"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 await game(page,`g=>{
  const original=g.sim.onEvent;g.aimTestEvents=[];
  g.sim.onEvent=event=>{g.aimTestEvents.push(event);original(event);};
 }`);
};
const arena=(page:Page,speciesId=7,alpha=-Math.PI/2)=>game(page,`g=>{
 const s=g.sim.state,p=s.player,m=s.party[0],e=s.enemies[0]??g.aimTestEnemy;g.aimTestEnemy=e;
 Object.assign(p,{x:0,z:0,y:0,vy:0,facing:0,hp:p.maxHp,iframes:10000,poisonTime:0,dodgeTime:0,specialCooldown:10000});
 Object.assign(m,{speciesId:${speciesId},x:0,z:0,facing:0,animation:'idle',attackTimer:0,attackKind:undefined,
  attackSpecial:undefined,attackLevel:1,cooldown:10000,learnedMoves:[]});
 s.party=[m];s.enemies=[-4,8].map(z=>({...e,uid:s.idCounter++,speciesId:19,variant:'normal',x:0,z,
  hp:100000,maxHp:100000,speed:0,stunTime:10000,attackCooldown:10000,hitCooldown:10000,
  attackTimer:0,animation:'idle',dead:false,windup:undefined,poisonTime:0,burnTime:0}));
 s.projectiles=[];s.drops=[];s.activeSpecials=[];s.psychicRings=[];s.items=[];g.sim.spawnAccum=-10000;
 g.camera.alpha=${alpha};g.camera.getViewMatrix(true);
 // Release the previous Q press through the same input path before the next cast.
 s.phase='playing';g.sim.update(.001,{...g.input(),special:false});s.phase='paused';g.aimTestEvents=[];
}`);

test('the real camera input leaves primary and learned attacks aimed at the nearest enemy behind the view',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await start(page);
 const observations=[];
 for(const alpha of [-Math.PI/2,-Math.PI/6]){
  await arena(page,7,alpha);
  const cast=await game(page,`g=>{
   const s=g.sim.state,m=s.party[0],input=g.input();m.cooldown=0;
   m.learnedMoves=[{moveId:'hyper-beam',rank:1,cooldown:0}];
   s.phase='playing';g.sim.update(.02,input);s.phase='paused';
   return {input,nearest:s.enemies[0].uid,facing:m.facing,
    shots:s.projectiles.map(p=>({move:p.moveName??'primary',target:p.targetId??null,vx:p.vx,vz:p.vz})),
    casts:g.aimTestEvents.filter(e=>e.kind==='cast').length};
  }`);
  expect(cast.input.aimZ).toBeGreaterThan(.49);expect(cast.input.mx).toBe(0);expect(cast.input.mz).toBe(0);
  expect(cast.shots).toHaveLength(2);expect(cast.casts).toBe(2);
  expect(cast.shots.find((shot:any)=>shot.move==='primary').target).toBe(cast.nearest);
  expect(cast.shots.some((shot:any)=>shot.move==='Hyper Beam')).toBe(true);
  for(const shot of cast.shots){expect(Math.abs(shot.vx)).toBeLessThan(1e-8);expect(shot.vz).toBeLessThan(0);}
  expect(Math.abs(cast.facing)).toBeCloseTo(Math.PI,6);observations.push(cast);
 }
 expect(Math.abs(observations[0].input.aimX-observations[1].input.aimX)).toBeGreaterThan(.8);
 await arena(page);
 const empty=await game(page,`g=>{
  const s=g.sim.state,m=s.party[0];s.enemies=[];m.cooldown=0;
  m.learnedMoves=[{moveId:'hyper-beam',rank:1,cooldown:0}];
  s.phase='playing';g.sim.update(.02,g.input());s.phase='paused';
  return {projectiles:s.projectiles.length,casts:g.aimTestEvents.filter(e=>e.kind==='cast').length,timer:m.attackTimer};
 }`);
 expect(empty).toEqual({projectiles:0,casts:0,timer:0});expect(errors).toEqual([]);
});

test('directional Surf and placed Bramble Garden still follow the actual camera input',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await start(page);
 for(const [id,alpha,kind] of [[7,-Math.PI/2,'surf'],[1,Math.PI,'garden']] as const){
  await arena(page,id,alpha);
  const cast=await game(page,`g=>{
   const s=g.sim.state,input=g.input();s.enemies=[s.enemies[0]];s.player.specialCooldown=0;
   s.phase='playing';g.sim.update(.02,{...input,special:true});s.phase='paused';
   const effect=s.activeSpecials[0];
   return {input,kind:effect?.profile.kind,x:effect?.x,z:effect?.z,dx:effect?.dx,dz:effect?.dz,
    toX:effect?.toX,toZ:effect?.toZ,specials:g.aimTestEvents.filter(e=>e.kind==='special').length};
  }`);
  expect(cast.kind).toBe(kind);expect(cast.specials).toBe(1);
  expect(cast.dx).toBeCloseTo(cast.input.aimX,6);expect(cast.dz).toBeCloseTo(cast.input.aimZ,6);
  expect(cast.toX*cast.input.aimX+cast.toZ*cast.input.aimZ).toBeGreaterThan(15);
  if(kind==='surf'){expect(cast.toZ).toBeGreaterThan(15);expect(Math.abs(cast.toX)).toBeLessThan(1e-8);}
  else{expect(cast.x).toBeGreaterThan(15);expect(Math.abs(cast.z)).toBeLessThan(1e-8);}
 }
 expect(errors).toEqual([]);
});
