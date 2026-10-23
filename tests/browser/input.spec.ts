import {test,expect,type Page} from '@playwright/test';

const captured=async(page:Page)=>{
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect(page.locator('#overlay')).toBeHidden();
};

test('keyboard-only play supports camera look, simultaneous movement and pause without mouse capture',async({page})=>{
 await page.addInitScript(()=>{
  HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(new Error('Mouse capture unavailable'));
 });
 await page.goto('/?dev=1');
 await page.locator('[data-starter="25"]').focus();
 await page.keyboard.press('Enter');
 await expect(page.locator('#overlay')).toBeHidden();
 const inspect=()=>page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__;
  return {alpha:g.camera.alpha,beta:g.camera.beta,x:g.sim.state.player.x,z:g.sim.state.player.z,phase:g.sim.state.phase};
 });
 await page.evaluate(()=>{(window as any).__WILDLANDS__.sim.state.player.iframes=10000;});
 const origin=await inspect();
 await page.keyboard.down('ArrowRight');
 await page.keyboard.down('ArrowUp');
 await expect.poll(async()=>(await inspect()).alpha).toBeLessThan(origin.alpha-.15);
 await expect.poll(async()=>(await inspect()).beta).toBeGreaterThan(origin.beta+.05);
 await page.keyboard.up('ArrowUp');
 const looking=await inspect();
 expect(Math.hypot(looking.x-origin.x,looking.z-origin.z)).toBeLessThan(.01);
 await page.keyboard.down('w');
 await expect.poll(async()=>{const p=await inspect();return Math.hypot(p.x-looking.x,p.z-looking.z);}).toBeGreaterThan(.25);
 expect((await inspect()).alpha).toBeLessThan(looking.alpha);
 await page.keyboard.up('w');await page.keyboard.up('ArrowRight');
 await page.keyboard.down('ArrowLeft');await page.keyboard.down('ArrowDown');
 const turning=await inspect();
 await expect.poll(async()=>(await inspect()).alpha).toBeGreaterThan(turning.alpha+.1);
 await expect.poll(async()=>(await inspect()).beta).toBeLessThan(turning.beta-.05);
 await page.keyboard.press('Escape');
 await page.keyboard.up('ArrowLeft');await page.keyboard.up('ArrowDown');
 await expect(page.locator('#resume-btn')).toBeFocused();
 const paused=await inspect();
 await page.keyboard.press('ArrowRight');
 expect(await inspect()).toEqual(paused);
 await page.keyboard.press('Enter');
 await expect(page.locator('#overlay')).toBeHidden();
 await page.keyboard.press('Space');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.player.y)).toBeGreaterThan(.1);
 expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();
});

test('held movement, mouse look and jump work together without releasing movement keys',async({page})=>{
 await page.goto('/?dev=1');
 await page.locator('[data-starter="25"]').click();
 await captured(page);
 await page.mouse.move(720,450);
 await page.evaluate(()=>{
  const game=(window as any).__WILDLANDS__;
  game.sim.state.player.iframes=10000;
  game.camera.alpha=-Math.PI/2;
 });
 const position=()=>page.evaluate(()=>{
  const {x,z}=(window as any).__WILDLANDS__.sim.state.player;
  return {x,z};
 });
 const origin=await position();
 await page.keyboard.down('w');
 await expect.poll(async()=>{
  const after=await position();return Math.hypot(after.x-origin.x,after.z-origin.z);
 }).toBeGreaterThan(.25);

 // Supply mouse deltas while W remains physically held, as with a trackpad.
 for(const x of [800,900,1000]){
  const before=await page.evaluate(()=>{
   const game=(window as any).__WILDLANDS__;
   return {alpha:game.camera.alpha,x:game.sim.state.player.x,z:game.sim.state.player.z};
  });
  await page.mouse.move(x,450,{steps:5});
  await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.camera.alpha)).toBeLessThan(before.alpha-.05);
  await expect.poll(async()=>{
   const after=await position();return Math.hypot(after.x-before.x,after.z-before.z);
  }).toBeGreaterThan(.25);
  expect(await page.evaluate(()=>(window as any).__WILDLANDS__.pressed.has('KeyW'))).toBe(true);
 }
 await page.keyboard.press('Space');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.player.y)).toBeGreaterThan(.1);
 await captured(page);
 await page.keyboard.up('w');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.pressed.size)).toBe(0);
});

test('Space never activates focused controls and still jumps across upgrade popups',async({page})=>{
 await page.goto('/?dev=1');
 const starter=page.locator('[data-starter="25"]');
 await starter.focus();
 await page.keyboard.press('Space');
 await expect(starter).toBeFocused();
 expect(await page.evaluate(()=>(window as any).__WILDLANDS__.sim)).toBeNull();

 // Keep normal keyboard activation available for deliberately choosing a button.
 await page.keyboard.press('Enter');
 await captured(page);
 await page.evaluate(()=>{(window as any).__WILDLANDS__.sim.state.player.iframes=10000;});
 await page.keyboard.down('Space');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.player.y)).toBeGreaterThan(.1);

 // Reproduce a level-up taking focus while the jump key is already held.
 await page.keyboard.press('[');
 const cards=page.locator('.choice-card');
 await expect(cards).toHaveCount(3);
 await expect(cards.first()).toBeFocused();
 const choices=await cards.evaluateAll(elements=>elements.map(el=>(el as HTMLElement).dataset.choice));
 await page.keyboard.up('Space');
 await page.keyboard.press('Space');
 await page.keyboard.down('Space');
 await page.keyboard.down('Space'); // A repeated keydown while the popup is focused.
 await page.keyboard.up('Space');
 await expect(cards).toHaveCount(3);
 expect(await cards.evaluateAll(elements=>elements.map(el=>(el as HTMLElement).dataset.choice))).toEqual(choices);
 expect(await page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.phase)).toBe('choice');
 expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();

 await page.keyboard.press('1');
 await captured(page);
 await page.keyboard.press('Escape');
 const resume=page.locator('#resume-btn');
 await expect(resume).toBeFocused();
 await page.keyboard.press('Space');
 await expect(resume).toBeFocused();
 expect(await page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.phase)).toBe('paused');

 const checkbox=page.locator('#screen-shake');
 const checked=await checkbox.isChecked();
 await checkbox.focus();await page.keyboard.press('Space');
 expect(await checkbox.isChecked()).toBe(checked);
 const summary=page.locator('.build-summary summary');
 await summary.focus();await page.keyboard.press('Space');
 await expect(page.locator('.build-summary')).toHaveAttribute('open','');

 await resume.click();
 await captured(page);
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.player.y)).toBe(0);
 await page.keyboard.press('Space');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.player.y)).toBeGreaterThan(.1);
});
