import {test,expect,type Page} from '@playwright/test';
import {availableStarters} from '../../src/game/characterAccess.ts';
import {DEFAULT_SAVE} from '../../src/game/save.ts';

const game=(page:Page,expression:string)=>page.evaluate(expression=>{
 const g=(window as any).__WILDLANDS__;
 return new Function('g',`return (${expression})(g)`)(g);
},expression);
const captured=async(page:Page)=>{
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement===document.querySelector('#renderCanvas'))).toBe(true);
 await expect(page.locator('#overlay')).toBeHidden();
 await expect.poll(()=>game(page,'g=>["playing","boss"].includes(g.sim.state.phase)')).toBe(true);
};
const released=async(page:Page)=>{
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement)).toBeNull();
};
const start=async(page:Page)=>{
 await page.goto('/?dev=1');
 await page.locator('[data-starter="25"]').click();
 await captured(page);
 await game(page,'g=>{g.sim.state.player.iframes=10000;}');
};
const frozen=async(page:Page)=>{
 const state=await game(page,'g=>({state:JSON.stringify(g.sim.state),alpha:g.camera.alpha,beta:g.camera.beta})');
 await page.keyboard.down('w');
 await page.mouse.move(800,500,{steps:4});
 await page.waitForTimeout(150);
 await page.keyboard.up('w');
 expect(await game(page,'g=>({state:JSON.stringify(g.sim.state),alpha:g.camera.alpha,beta:g.camera.beta})')).toEqual(state);
};

test('starter captures the mouse and relative camera motion keeps working beyond screen edges',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await start(page);
 await page.mouse.move(720,450);
 await game(page,'g=>{g.camera.alpha=-Math.PI/2;g.camera.beta=1;}');
 const alpha=await game(page,'g=>g.camera.alpha');
 await page.mouse.move(840,450,{steps:6});
 expect(await game(page,'g=>g.camera.alpha')).toBeLessThan(alpha-.1);
 const beta=await game(page,'g=>g.camera.beta');
 await page.mouse.move(840,410,{steps:4});
 expect(await game(page,'g=>g.camera.beta')).toBeGreaterThan(beta+.03);
 await page.mouse.move(840,450,{steps:4});
 expect(await game(page,'g=>g.camera.beta')).toBeCloseTo(beta,3);
 // Native pointer lock must continue supplying relative deltas after the virtual mouse
 // passes the viewport boundary; a cursor-following camera stops here.
 await page.mouse.move(1600,450,{steps:12});
 const atEdge=await game(page,'g=>g.camera.alpha');
 await page.mouse.move(1840,450,{steps:8});
 expect(await game(page,'g=>g.camera.alpha')).toBeLessThan(atEdge-.1);
 await captured(page);
 await page.keyboard.press('Escape');await released(page);
 await expect(page.locator('#resume-btn')).toBeVisible();
 await page.locator('#invert-y').check();
 await page.locator('#resume-btn').click();await captured(page);
 await page.mouse.move(720,450);
 await game(page,'g=>{g.camera.beta=1;}');
 await page.mouse.move(720,490,{steps:4});
 expect(await game(page,'g=>g.camera.beta')).toBeGreaterThan(1.03);
 await page.mouse.move(720,450,{steps:4});
 expect(await game(page,'g=>g.camera.beta')).toBeCloseTo(1,3);
 expect(errors).toEqual([]);
});

test('pause and upgrade menus release the mouse and resume or either choice gesture captures it again',async({page})=>{
 await start(page);
 await page.keyboard.press('Escape');await released(page);
 await expect(page.locator('#resume-btn')).toBeVisible();await frozen(page);
 // Escape only opens pause. Resuming is a button gesture that can request browser capture.
 await page.keyboard.press('Escape');await released(page);
 await expect(page.locator('#resume-btn')).toBeVisible();
 await page.locator('#resume-btn').click();await captured(page);
 await page.keyboard.press('[');await expect(page.locator('.choice-card')).toHaveCount(3);
 await released(page);await frozen(page);
 await page.locator('.choice-card').first().click();await captured(page);
 await page.keyboard.press('[');await expect(page.locator('.choice-card')).toHaveCount(3);
 await released(page);
 await page.keyboard.press('1');await captured(page);
});

test('losing browser pointer lock pauses and freezes gameplay until Resume captures again',async({page})=>{
 await start(page);
 await page.keyboard.down('w');
 await page.evaluate(()=>document.exitPointerLock());
 await released(page);await expect(page.locator('#resume-btn')).toBeVisible();
 await page.keyboard.up('w');
 expect(await game(page,'g=>g.pressed.size')).toBe(0);
 await frozen(page);
 await page.locator('#resume-btn').click();await captured(page);
 const elapsed=await game(page,'g=>g.sim.state.stats.elapsed');
 await expect.poll(()=>game(page,'g=>g.sim.state.stats.elapsed')).toBeGreaterThan(elapsed);
});

test('capture denial allows keyboard play and Resume can recover mouse capture',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const original=Element.prototype.requestPointerLock;
  (window as any).__restorePointerLock=()=>{Element.prototype.requestPointerLock=original;};
  Element.prototype.requestPointerLock=()=>Promise.reject(new DOMException('Capture denied for test','NotAllowedError'));
 });
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();
 await released(page);await expect(page.locator('#overlay')).toBeHidden();
 expect(await game(page,'g=>g.sim.state.phase')).toBe('playing');
 const elapsed=await game(page,'g=>g.sim.state.stats.elapsed');
 await expect.poll(()=>game(page,'g=>g.sim.state.stats.elapsed')).toBeGreaterThan(elapsed);
 await page.keyboard.press('Escape');
 await expect(page.locator('#resume-btn')).toBeVisible();await frozen(page);
 await page.evaluate(()=>(window as any).__restorePointerLock());
 await page.locator('#resume-btn').click();await captured(page);
 await expect(page.locator('#capture-help')).toBeHidden();
 expect(errors).toEqual([]);
});

for(const cancellation of ['Escape','Restart'] as const){
test(`${cancellation} cancels a pending capture and a late browser grant is released`,async({page})=>{
 await page.addInitScript(()=>{
  const original=Element.prototype.requestPointerLock;
  (window as any).__locksSeen=0;
  document.addEventListener('pointerlockchange',()=>{
   if(document.pointerLockElement?.id==='renderCanvas')(window as any).__locksSeen++;
  });
  Element.prototype.requestPointerLock=function(){
   return new Promise<void>((resolve,reject)=>{
    (window as any).__grantPointerLock=()=>Promise.resolve(original.call(this)).then(resolve,reject);
   });
  };
 });
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();
 await expect(page.locator('#resume-btn')).toBeVisible();
 expect(await game(page,'g=>g.capturePending')).toBe(true);
 if(cancellation==='Escape')await page.keyboard.press('Escape');
 else await page.locator('#restart-btn').click();
 expect(await game(page,'g=>g.capturePending')).toBe(false);
 expect(await game(page,'g=>g.captureWanted')).toBe(false);
 await page.evaluate(()=>(window as any).__grantPointerLock());
 await expect.poll(()=>page.evaluate(()=>(window as any).__locksSeen)).toBe(1);
 await released(page);
 if(cancellation==='Escape'){
  await expect(page.locator('#resume-btn')).toBeVisible();
  expect(await game(page,'g=>g.sim.state.phase')).toBe('paused');await frozen(page);
 }else{
  await expect(page.locator('[data-starter]')).toHaveCount(availableStarters(DEFAULT_SAVE).length);
  expect(await game(page,'g=>g.sim')).toBeNull();
 }
});
}
