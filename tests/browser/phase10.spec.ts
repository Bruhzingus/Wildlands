import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const game=(page:Page,expression:string)=>page.evaluate(expression=>new Function('g',`return (${expression})(g)`)((window as any).__WILDLANDS__),expression);
const captured=async(page:Page)=>{await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');await expect(page.locator('#overlay')).toBeHidden();};
const start=async(page:Page)=>{await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();await captured(page);await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBe(true);await game(page,'g=>{g.sim.state.enemies=[];g.sim.spawnAccum=-1000;g.sim.state.player.iframes=10000;}');};
const frame=(page:Page)=>game(page,'g=>{g.previous=performance.now()-16;g.frame();}');

test('quiet audio unlocks on a gesture, produces a signal, persists controls and silences pause/blur/restart',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');expect(await game(page,'g=>g.audio.inspect().state')).toBe('locked');expect(await game(page,'g=>g.audio.inspect().nodes')).toBe(0);
 await expect(page.locator('#sound-volume')).toHaveValue('0.18');await expect(page.locator('#music-volume')).toHaveValue('0.07');
 await page.locator('#sound-volume').fill('0.32');await page.locator('#music-volume').fill('0.11');await page.locator('#mouse-sensitivity').fill('1.4');
 await page.locator('#screen-shake').uncheck();await page.locator('#hit-stop').uncheck();await page.locator('#reduce-flashes').check();await page.locator('#invert-y').check();
 await page.reload();await expect(page.locator('#sound-volume')).toHaveValue('0.32');await expect(page.locator('#music-volume')).toHaveValue('0.11');
 await expect(page.locator('#screen-shake')).not.toBeChecked();await expect(page.locator('#hit-stop')).not.toBeChecked();await expect(page.locator('#reduce-flashes')).toBeChecked();await expect(page.locator('#invert-y')).toBeChecked();
 await page.locator('[data-starter="25"]').click();await captured(page);await expect.poll(()=>game(page,'g=>g.audio.inspect().state')).toBe('running');
 await game(page,'g=>{g.sim.state.enemies=[];g.sim.spawnAccum=-1000;g.sim.state.player.iframes=10000;window.__audioContext=g.audio.context;}');
 const rms=await page.evaluate(async()=>{
  const audio=(window as any).__WILDLANDS__.audio,context=audio.context as AudioContext,analyser=context.createAnalyser(),mute=context.createGain();mute.gain.value=0;
  audio.sound.connect(analyser);analyser.connect(mute);mute.connect(context.destination);analyser.fftSize=2048;
  let peak=0;try{audio.cue('special');for(let i=0;i<8;i++){await new Promise(resolve=>setTimeout(resolve,25));const samples=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);peak=Math.max(peak,Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length));}}
  finally{audio.sound.disconnect(analyser);analyser.disconnect();mute.disconnect();}return peak;
 });expect(rms).toBeGreaterThan(.000001);
 await expect.poll(()=>game(page,'g=>g.audio.inspect().ambientNotes')).toBeGreaterThan(0);
 expect(await game(page,'g=>g.audio.inspect().voices')).toBeLessThanOrEqual(12);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();await expect.poll(()=>game(page,'g=>g.audio.inspect().voices')).toBe(0);
 const paused=await game(page,'g=>g.audio.inspect()');await page.waitForTimeout(250);expect((await game(page,'g=>g.audio.inspect()')).createdVoices).toBe(paused.createdVoices);
 await game(page,'g=>{g.audio.cue("level");window.dispatchEvent(new Event("blur"));}');expect(await game(page,'g=>g.audio.inspect().voices')).toBe(0);
 await page.locator('#sound-volume').fill('0');await page.locator('#music-volume').fill('0');expect(await game(page,'g=>[g.audio.inspect().soundGain,g.audio.inspect().musicGain]')).toEqual([0,0]);
 for(let run=0;run<3;run++){
  await page.locator('#restart-btn').click();expect(await game(page,'g=>g.audio.inspect().nodes')).toBe(3);
  await page.locator('[data-starter="25"]').click();await captured(page);expect(await game(page,'g=>g.audio.context===window.__audioContext')).toBe(true);
  await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 }
 expect(await game(page,'g=>g.audio.inspect().errors')).toBe(0);expect(errors).toEqual([]);
});

test('health, faint and ready feedback stay readable while numeric upgrade choices fully pause and sound once',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await start(page);await mkdir('artifacts/browser',{recursive:true});
 await game(page,'g=>{const s=g.sim.state;s.player.hp=24;s.player.specialCooldown=.6;const member={...s.party[0],uid:s.idCounter++,speciesId:7,hp:20,maxHp:155};s.party.push(member);}');
 await expect(page.locator('#health-status')).toContainText('CRITICAL');await expect(page.locator('.party-hp')).toHaveCount(2);await expect(page.locator('.party-hp').nth(1)).toContainText(/[0-9]+ HP/);await expect(page.locator('.party-unit').nth(1)).toHaveClass(/low-health/);
 await expect(page.locator('#ability-ready')).toContainText('Q Thunder Circuit ready');await expect(page.locator('#special-cd')).toHaveClass(/is-ready/);
 await page.screenshot({path:'artifacts/browser/phase10-health-ready.png'});
 await game(page,'g=>{const m=g.sim.state.party[1];m.hp=.001;m.poisonTime=1;}');await expect(page.locator('#party-alert')).toContainText('Squirtle fainted');
 expect(await game(page,'g=>g.audio.inspect().cues.faint')).toBe(1);await page.screenshot({path:'artifacts/browser/phase10-faint.png'});
 await page.keyboard.press('[');await expect(page.locator('.choice-card')).toHaveCount(3);
 for(const card of await page.locator('.choice-card').all()){await expect(card.locator('p')).toContainText(/[0-9]/);await expect(card).toHaveAttribute('aria-keyshortcuts',/[123]/);expect(await card.locator('svg,img').count()).toBe(1);}
 const before=await game(page,'g=>({state:JSON.stringify(g.sim.state),audio:g.audio.inspect()})');await page.keyboard.press('q');await page.keyboard.press('w');await page.waitForTimeout(650);
 expect(await game(page,'g=>JSON.stringify(g.sim.state)')).toBe(before.state);expect((await game(page,'g=>g.audio.inspect()')).createdVoices).toBe(before.audio.createdVoices);expect(await game(page,'g=>g.audio.inspect().voices')).toBe(0);
 await page.screenshot({path:'artifacts/browser/phase10-upgrades.png'});await page.keyboard.press('1');await captured(page);
 expect(await game(page,'g=>g.audio.inspect().cues.upgrade')).toBe(1);await page.keyboard.press('1');expect(await game(page,'g=>g.audio.inspect().cues.upgrade')).toBe(1);
 expect(errors).toEqual([]);
});

test('brief hit-stop buffers a jump, restores the camera and respects independent comfort controls',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await start(page);
 await game(page,'g=>{g.engine.stopRenderLoop();g.sim.state.player.iframes=0;g.__baseCamera={alpha:g.camera.alpha,beta:g.camera.beta,target:g.camera.target.asArray()};}');
 await page.keyboard.press('q');await frame(page);expect(await game(page,'g=>g.feedback.inspect().freeze')).toBe(true);expect(await game(page,'g=>g.audio.inspect().cues.special')).toBe(1);
 const elapsed=await game(page,'g=>g.sim.state.stats.elapsed');await page.keyboard.press('Space');await frame(page);
 expect(await game(page,'g=>g.sim.state.stats.elapsed')).toBe(elapsed);expect(await game(page,'g=>g.pendingActions.jump')).toBe(true);
 await frame(page);await frame(page);expect(await game(page,'g=>g.sim.state.player.y')).toBeGreaterThan(0);expect(await game(page,'g=>g.pendingActions.jump')).toBe(false);
 expect(await game(page,'g=>({alpha:g.camera.alpha,beta:g.camera.beta,target:g.camera.target.asArray()})')).toEqual(await game(page,'g=>g.__baseCamera'));
 await page.keyboard.press('Escape');await frame(page);await expect(page.locator('#resume-btn')).toBeVisible();expect(await game(page,'g=>g.feedback.inspect().freeze')).toBe(false);
 await page.locator('#screen-shake').uncheck();await page.locator('#hit-stop').uncheck();await page.locator('#reduce-flashes').check();await page.locator('#resume-btn').click();await captured(page);
 await game(page,'g=>{g.sim.state.player.specialCooldown=0;}');await page.keyboard.press('q');await frame(page);
 expect(await game(page,'g=>g.feedback.inspect()')).toMatchObject({freeze:false,offsetX:0,offsetY:0,offsetZ:0});
 await game(page,'g=>{g.sim.state.player.iframes=0;g.sim.hurtPlayer(5,false);}');await frame(page);await expect(page.locator('#damage-flash')).toHaveCSS('opacity','0');
 expect(errors).toEqual([]);
});

test('system reduced motion suppresses impact movement, hit-stop and flashes while actions still work',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.emulateMedia({reducedMotion:'reduce'});await start(page);
 await game(page,'g=>{g.engine.stopRenderLoop();g.sim.state.player.iframes=0;}');await page.keyboard.press('q');await frame(page);
 expect(await game(page,'g=>g.sim.state.player.specialCooldown')).toBeGreaterThan(0);expect(await game(page,'g=>g.feedback.inspect()')).toMatchObject({freeze:false,offsetX:0,offsetY:0,offsetZ:0});
 await game(page,'g=>{g.sim.state.player.iframes=0;g.sim.hurtPlayer(5,false);}');await frame(page);await expect(page.locator('#damage-flash')).toHaveCSS('opacity','0');
 await page.keyboard.press('Space');await frame(page);expect(await game(page,'g=>g.sim.state.player.y')).toBeGreaterThan(0);expect(errors).toEqual([]);
});
