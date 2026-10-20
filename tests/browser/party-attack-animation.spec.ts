import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const game=(page:Page,expression:string)=>page.evaluate(expression=>new Function('g',`return (${expression})(g)`)((window as any).__WILDLANDS__),expression);
const identity={forward:0,lift:0,scaleX:1,scaleY:1,lean:0};
const start=async(page:Page,reducedMotion=false)=>{
 await page.emulateMedia({reducedMotion:reducedMotion?'reduce':'no-preference'});
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 await game(page,`g=>{
  const original=g.sim.onEvent;g.partyAnimationEvents=[];
  g.sim.onEvent=event=>{g.partyAnimationEvents.push(event);original(event);};
 }`);
};
const arena=async(page:Page,speciesId=66)=>{
 await game(page,`g=>{
  const s=g.sim.state,p=s.player,m=s.party[0],template=s.enemies[0]??g.partyAnimationEnemy;
  g.partyAnimationEnemy=template;
  Object.assign(p,{x:0,z:0,y:0,vy:0,facing:0,hp:p.maxHp*.8,iframes:10000,poisonTime:0,dodgeTime:0,specialCooldown:10000});
  delete p.aimFacing;
  Object.assign(m,{speciesId:${speciesId},x:0,z:0,facing:0,animation:'idle',attackTimer:0,attackDuration:undefined,
   attackKind:undefined,attackSpecial:undefined,attackLevel:1,cooldown:10000,learnedMoves:[]});
  s.party=[m];s.enemies=[{...template,uid:s.idCounter++,speciesId:19,variant:'normal',x:4,z:0,
   hp:100000,maxHp:100000,speed:0,stunTime:10000,attackCooldown:10000,hitCooldown:10000,
   attackTimer:0,animation:'idle',dead:false,windup:undefined,poisonTime:0,burnTime:0}];
  s.projectiles=[];s.drops=[];s.activeSpecials=[];s.psychicRings=[];s.items=[];s.phase='paused';
  g.sim.spawnAccum=-10000;g.partyAnimationEvents=[];g.fx.update(s,100);g.ui.refresh(s);
  g.camera.alpha=-Math.PI/2;g.camera.beta=1.05;g.camera.radius=16;g.camera.target.set(1,g.world.height(0,0),0);g.camera.getViewMatrix(true);
  g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),p.y);g.scene.render();
 }`);
 await expect.poll(()=>game(page,`g=>{
  const m=g.sim.state.party[0],a=g.visuals.inspect().find(a=>a.uid===m.uid);
  return a?.requested==='idle'&&a.resolved==='Idle'&&a.source.includes('/assets/pmd/');
 }`)).toBe(true);
};
const advance=(page:Page,seconds:number,special=false)=>game(page,`g=>{
 const s=g.sim.state;let remaining=${seconds},first=true;s.phase='playing';
 while(remaining>1e-8){
  const dt=Math.min(.02,remaining);
  g.sim.update(dt,{mx:0,mz:0,jump:false,dodge:false,special:${special}&&first,interact:false});
  g.fx.update(s,dt);remaining-=dt;first=false;
 }
 s.phase='paused';
 g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),s.player.y);
 g.healthBars.sync(s,0,(x,z)=>g.world.height(x,z));g.scene.render();
}`);
const read=(page:Page)=>game(page,`g=>{
 const m=g.sim.state.party[0],a=g.visuals.inspect().find(a=>a.uid===m.uid);
 return {actor:{animation:m.animation,timer:m.attackTimer,duration:m.attackDuration,kind:m.attackKind??null,
  special:m.attackSpecial??null,facing:m.facing},visual:a,
  casts:g.partyAnimationEvents.filter(e=>e.kind==='cast').length,
  specials:g.partyAnimationEvents.filter(e=>e.kind==='special').length};
}`);
const nativeAttack=async(page:Page)=>{
 await expect.poll(()=>game(page,`g=>{
  const m=g.sim.state.party[0],a=g.visuals.inspect().find(a=>a.uid===m.uid);
  return a?.requested==='attack'&&a.resolved==='Attack'&&a.source.includes('/assets/pmd/')&&a.visible;
 }`)).toBe(true);
};

test('a learned ranged move uses its native attack and recoil while overlapping casts let that shot finish',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await start(page);await arena(page);
 await game(page,`g=>{g.sim.state.party[0].learnedMoves=[{moveId:'hyper-beam',rank:1,cooldown:0}];}`);
 await advance(page,.02);await nativeAttack(page);
 const first=await read(page);
 expect(first.actor.kind).toBe('beam');expect(first.actor.special).toBeNull();
 expect(first.visual.attackStyle).toBe('ranged');expect(first.visual.frame).toBe(0);
 expect(first.actor.facing).toBeCloseTo(Math.PI/2,6);expect(first.casts).toBe(1);
 await advance(page,.12);
 const recoil=await read(page);
 expect(recoil.visual.frame).toBeGreaterThan(first.visual.frame);expect(recoil.visual.pose.forward).toBeLessThan(0);
 await page.waitForTimeout(150);expect(await read(page)).toEqual(recoil);
 await mkdir('artifacts/browser',{recursive:true});
 await page.locator('#overlay').evaluate(node=>{(node as HTMLElement).style.visibility='hidden';});
 await page.screenshot({path:'artifacts/browser/party-learned-ranged.png'});
 await page.locator('#overlay').evaluate(node=>{(node as HTMLElement).style.visibility='';});

 // A ready primary still hits a newly selected target, without restarting the
 // in-flight body animation or changing the facing of its earlier beam.
 const hp=await game(page,`g=>{const s=g.sim.state;s.enemies[0].x=0;s.enemies[0].z=4;s.party[0].cooldown=0;return s.enemies[0].hp;}`);
 await advance(page,.02);
 const overlap=await read(page);
 expect(overlap.casts).toBe(recoil.casts+1);
 expect(await game(page,'g=>g.sim.state.enemies[0].hp')).toBeLessThan(hp);
 expect(overlap.actor.timer).toBeCloseTo(recoil.actor.timer-.02,6);
 expect(overlap.actor.facing).toBe(recoil.actor.facing);expect(overlap.actor.kind).toBe('beam');
 expect(overlap.visual.attackStyle).toBe('ranged');expect(overlap.visual.frame).toBeGreaterThanOrEqual(recoil.visual.frame);
 await advance(page,.3);
 const rest=await read(page);
 expect(rest.actor.animation).toBe('idle');expect(rest.actor.kind).toBeNull();expect(rest.actor.special).toBeNull();
 expect(rest.visual.posePhase).toBe('idle');expect(rest.visual.pose).toEqual(identity);
 await game(page,'g=>{g.sim.state.party[0].cooldown=0;}');await advance(page,.02);await nativeAttack(page);
 const primary=await read(page);
 expect(primary.actor.kind).toBe('slash');expect(primary.visual.attackStyle).toBe('melee');expect(primary.visual.frame).toBe(0);
 expect(primary.actor.facing).toBeCloseTo(0,6);
 await advance(page,.14);
 expect((await read(page)).visual.pose.forward).toBeGreaterThan(0);
 await page.locator('#overlay').evaluate(node=>{(node as HTMLElement).style.visibility='hidden';});
 await page.screenshot({path:'artifacts/browser/party-primary-melee.png'});
 expect(errors).toEqual([]);
});

test('actual leader specials replace an automatic pose and keep their own style through overlapping shots',async({page})=>{
 test.setTimeout(120000);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await start(page);
 for(const [id,kind,style] of [[1,'garden','pulse'],[66,'flurry','heavy'],[63,'teleport','ranged'],
  [133,'quickstep','quick'],[58,'charge','quick'],[113,'mend','heal']] as const){
  await arena(page,id);
  await game(page,`g=>{g.sim.state.party[0].learnedMoves=[{moveId:'hyper-beam',rank:1,cooldown:0}];}`);
  await advance(page,.02);await nativeAttack(page);await advance(page,.12);
  const automatic=await read(page);
  expect(automatic.actor.kind).toBe('beam');expect(automatic.visual.attackStyle).toBe('ranged');
  await game(page,'g=>{g.sim.state.player.specialCooldown=0;}');await advance(page,.02,true);await nativeAttack(page);
  const special=await read(page);
  expect(special.actor.special,`Species ${id} routes its actual Q ability`).toBe(kind);
  expect(special.visual.attackStyle).toBe(style);expect(special.actor.duration).toBeGreaterThan(automatic.actor.duration);
  expect(special.visual.attackProgress).toBeLessThan(automatic.visual.attackProgress);expect(special.specials).toBe(1);
  await advance(page,.12);
  const strike=await read(page);
  expect(strike.visual.frame).toBeGreaterThan(special.visual.frame);expect(strike.visual.pose).not.toEqual(identity);
  await page.waitForTimeout(80);expect(await read(page)).toEqual(strike);
  await game(page,'g=>{g.sim.state.party[0].learnedMoves[0].cooldown=0;}');await advance(page,.02);
  const overlap=await read(page);
  expect(overlap.casts).toBe(strike.casts+1);expect(overlap.actor.timer).toBeCloseTo(strike.actor.timer-.02,6);
  expect(overlap.actor.special).toBe(kind);expect(overlap.visual.attackStyle).toBe(style);
  expect(overlap.actor.facing).toBe(strike.actor.facing);expect(overlap.visual.frame).toBeGreaterThanOrEqual(strike.visual.frame);
  await advance(page,.35);
  const rest=await read(page);
  expect(rest.actor.animation).toBe('idle');expect(rest.actor.kind).toBeNull();expect(rest.actor.special).toBeNull();
  expect(rest.visual.pose).toEqual(identity);
 }
 expect(errors).toEqual([]);
});

test('reduced motion preserves learned and special native frames while suppressing added body poses',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await start(page,true);await arena(page);
 await game(page,`g=>{g.sim.state.party[0].learnedMoves=[{moveId:'hyper-beam',rank:1,cooldown:0}];}`);
 await advance(page,.02);await nativeAttack(page);
 const learned=await read(page);expect(learned.visual.attackStyle).toBe('ranged');expect(learned.visual.pose).toEqual(identity);
 await advance(page,.22);
 const later=await read(page);expect(later.visual.frame).toBeGreaterThan(learned.visual.frame);expect(later.visual.pose).toEqual(identity);
 expect(later.visual.width).toBe(learned.visual.width);expect(later.visual.height).toBe(learned.visual.height);expect(later.visual.angle).toBe(0);
 await game(page,'g=>{g.sim.state.player.specialCooldown=0;}');await advance(page,.02,true);
 const special=await read(page);expect(special.actor.special).toBe('flurry');expect(special.visual.attackStyle).toBe('heavy');
 expect(special.visual.pose).toEqual(identity);
 await advance(page,.24);
 const strike=await read(page);expect(strike.visual.frame).toBeGreaterThan(special.visual.frame);expect(strike.visual.pose).toEqual(identity);
 expect(strike.visual.width).toBe(special.visual.width);expect(strike.visual.height).toBe(special.visual.height);expect(strike.visual.angle).toBe(0);
 const state=await game(page,'g=>JSON.stringify(g.sim.state)');await page.waitForTimeout(150);
 expect(await read(page)).toEqual(strike);expect(await game(page,'g=>JSON.stringify(g.sim.state)')).toBe(state);
 await advance(page,.2);expect((await read(page)).visual.pose).toEqual(identity);
 expect((await read(page)).actor.special).toBeNull();expect(errors).toEqual([]);
});
