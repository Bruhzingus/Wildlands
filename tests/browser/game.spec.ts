import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const game=(page:Page,fn:string)=>page.evaluate(expression=>{
 const g=(window as any).__WILDLANDS__;
 return new Function('g',`return (${expression})(g)`)(g);
},fn);
const snapshot=(page:Page)=>game(page,'g=>JSON.stringify(g.sim.state)');
const captured=async(page:Page)=>{
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect(page.locator('#overlay')).toBeHidden();
};
const hold=async(page:Page,key:string,ms=200)=>{
 await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);
};

test('real WebGL gameplay, camera, actions, full pause, interaction and restarts',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');
 await expect(page.locator('[data-starter]')).toHaveCount(4);
 await mkdir('artifacts/browser',{recursive:true});
 await page.screenshot({path:'artifacts/browser/title.png'});
 await page.locator('[data-starter="25"]').click();
 await captured(page);
 await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBeTruthy();
 await game(page,'g=>{g.sim.state.player.iframes=10000;g.camera.alpha=-Math.PI/2;}');
 const origin=await game(page,'g=>g.sim.state.player.x');
 await hold(page,'d');
 const right=await game(page,'g=>g.sim.state.player.x');expect(right).toBeGreaterThan(origin+.25);
 await hold(page,'a',350);expect(await game(page,'g=>g.sim.state.player.x')).toBeLessThan(right-.25);
 const z=await game(page,'g=>g.sim.state.player.z');await hold(page,'w');
 expect(await game(page,'g=>g.sim.state.player.z')).toBeGreaterThan(z+.25);
 const forwardZ=await game(page,'g=>g.sim.state.player.z');
 await hold(page,'s',350);expect(await game(page,'g=>g.sim.state.player.z')).toBeLessThan(forwardZ-.25);
 await page.mouse.move(640,350);
 const alpha=await game(page,'g=>g.camera.alpha');
 await page.mouse.move(850,400,{steps:8});
 expect(Math.abs((await game(page,'g=>g.camera.alpha'))-alpha)).toBeGreaterThan(.05);
 const orbited=await game(page,'g=>g.camera.alpha');await hold(page,'w',250);
 expect(await game(page,'g=>g.camera.alpha')).toBeCloseTo(orbited,5);
 await page.keyboard.press('Space');
 await expect.poll(()=>game(page,'g=>g.sim.state.player.y')).toBeGreaterThan(.1);
 await page.keyboard.press('Shift');
 await expect.poll(()=>game(page,'g=>g.sim.state.player.dodgeCooldown')).toBeGreaterThan(0);
 expect(await game(page,'g=>g.sim.state.player.iframes')).toBeGreaterThan(0);
 await game(page,'g=>{const s=g.sim.state,e=s.enemies[0];e.x=s.player.x+2;e.z=s.player.z;e.hp=e.maxHp=500;e.stunTime=100;}');
 const damageBefore=await game(page,'g=>g.sim.state.stats.damageDealt');
 await page.keyboard.down('q');
 await expect.poll(()=>game(page,'g=>g.sim.state.stats.damageDealt')).toBeGreaterThan(damageBefore);
 const specialAt=await game(page,'g=>g.sim.state.lastSpecialAt');
 await game(page,'g=>{g.sim.state.player.specialCooldown=0;}');
 await page.waitForTimeout(200);
 expect(await game(page,'g=>g.sim.state.lastSpecialAt')).toBe(specialAt);
 await page.keyboard.up('q');
 await page.screenshot({path:'artifacts/browser/gameplay.png'});
 await page.keyboard.press('[');await expect(page.locator('.choice-card')).toHaveCount(3);
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement)).toBeNull();
 const frozen=await snapshot(page);await hold(page,'w');await page.waitForTimeout(200);
 expect(await snapshot(page)).toBe(frozen);
 await page.screenshot({path:'artifacts/browser/upgrade.png'});
 await page.keyboard.press('1');await captured(page);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement)).toBeNull();
 const paused=await snapshot(page),cameraPaused=await game(page,'g=>g.camera.alpha');
 await page.mouse.move(700,350);await page.waitForTimeout(200);
 expect(await snapshot(page)).toBe(paused);expect(await game(page,'g=>g.camera.alpha')).toBe(cameraPaused);
 await page.screenshot({path:'artifacts/browser/pause.png'});
 await page.locator('#resume-btn').click();await captured(page);
 await game(page,'g=>{const s=g.sim.state,p=s.pois.find(p=>p.kind==="cache");s.player.x=p.x;s.player.z=p.z;}');
 await page.keyboard.press('e');
 await expect.poll(()=>game(page,'g=>g.sim.state.pois.find(p=>p.kind==="cache").used')).toBeTruthy();
 if(await page.locator('.choice-card').count()){await page.keyboard.press('1');await captured(page);}
 await page.keyboard.down('w');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('w');
 await expect(page.locator('#resume-btn')).toBeVisible();
 expect(await game(page,'g=>g.pressed.size')).toBe(0);
 for(let i=0;i<10;i++){
  await page.locator('#restart-btn').click();await page.locator('[data-starter="25"]').click();
  await captured(page);
  await page.waitForTimeout(100);await page.keyboard.press('Escape');
  expect(await game(page,'g=>g.scene.lights.length')).toBe(2);
 }
 const resources=await game(page,'g=>({meshes:g.scene.meshes.length,materials:g.scene.materials.length,textures:g.scene.textures.length,lights:g.scene.lights.length})');
 expect(resources.materials).toBeLessThan(65);expect(resources.textures).toBeLessThan(50);
 await page.locator('#restart-btn').click();await expect(page.locator('[data-starter]')).toHaveCount(4);
 expect(errors).toEqual([]);
});

test('camera settings persist, capture releases on pause, victory continues without duplicate run counts',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');
 await page.locator('#mouse-sensitivity').fill('1.8');await page.locator('#invert-y').check();
 await page.reload();await expect(page.locator('#mouse-sensitivity')).toHaveValue('1.8');
 await expect(page.locator('#invert-y')).toBeChecked();
 await page.locator('[data-starter="25"]').click();
 await captured(page);
 await game(page,'g=>{g.sim.state.player.iframes=10000;}');
 await page.mouse.move(600,300);
 const beta=await game(page,'g=>g.camera.beta');
 await page.mouse.move(600,340,{steps:5});
 expect(await game(page,'g=>g.camera.beta')).toBeGreaterThan(beta);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement)).toBeNull();
 await page.locator('#resume-btn').click();await captured(page);
 await game(page,'g=>{g.sim.state.stats.elapsed=899.999;}');
 await expect.poll(()=>game(page,'g=>g.sim.state.enemies.some(e=>e.isBoss&&e.speciesId===150)')).toBeTruthy();
 await game(page,'g=>{const s=g.sim.state,b=s.enemies.find(e=>e.isBoss);b.x=s.player.x+2;b.z=s.player.z;b.hp=1;s.player.specialCooldown=0;}');
 await page.keyboard.press('q');await expect(page.locator('#endless-btn')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement)).toBeNull();
 const recorded=await game(page,'g=>({games:g.save.games,wins:g.save.wins,items:[...g.sim.state.items],party:g.sim.state.party.map(p=>p.uid)})');
 expect(recorded.games).toBe(1);expect(recorded.wins).toBe(1);
 await page.locator('#endless-btn').click();
 await captured(page);
 expect(await game(page,'g=>g.sim.state.endless')).toBeTruthy();
 expect(await game(page,'g=>g.sim.state.items')).toEqual(recorded.items);
 expect(await game(page,'g=>g.sim.state.party.map(p=>p.uid)')).toEqual(recorded.party);
 // Boss XP can open a choice immediately after endless resumes. Resolve it with a
 // real user gesture so the browser captures the mouse before play continues.
 while(await game(page,'g=>{const s=g.sim.state;if(s.phase==="choice")return true;s.player.hp=0;s.stats.elapsed=1000;return false;}')){
  await page.keyboard.press('1');await captured(page);
 }
 await expect.poll(()=>game(page,'g=>g.sim.state.phase')).toBe('result');
 await expect(page.locator('#restart-btn')).toBeVisible();
 expect(await game(page,'g=>g.save.games')).toBe(1);expect(await game(page,'g=>g.save.wins')).toBe(1);
 await expect.poll(()=>game(page,'g=>g.save.longestRun')).toBeGreaterThanOrEqual(1000);
 expect(errors).toEqual([]);
});

test('ten simulated minutes of movement remain finite with collision, jump and dodge',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="1"]').click();await captured(page);
 const result=await game(page,`g=>{
  const sim=g.sim,s=sim.state;let choices=0;
  s.player.hp=s.player.maxHp=100000;
  for(let i=0;i<18000;i++){
   if(s.phase==='choice'){sim.choose(s.upgradeChoices[0].id);choices++;}
   if(s.phase==='result')break;
   const angle=i/280;
   sim.setWalking(true);
   sim.update(1/30,{mx:Math.cos(angle),mz:Math.sin(angle),jump:i%90===0,dodge:i%120===0,special:i%500===0,interact:false});
   if(![s.player.x,s.player.z,s.player.y,s.player.hp].every(Number.isFinite)||s.player.y<0)throw Error('Invalid player state at frame '+i);
  }
  return {elapsed:s.stats.elapsed,choices,phase:s.phase,x:s.player.x,z:s.player.z};
 }`);
 expect(result.elapsed).toBeGreaterThan(599);expect(result.choices).toBeGreaterThan(0);
 expect(Math.abs(result.x)).toBeLessThanOrEqual(113*1.25);expect(Math.abs(result.z)).toBeLessThanOrEqual(113*1.25);
 await page.waitForTimeout(100);expect(errors).toEqual([]);
});
