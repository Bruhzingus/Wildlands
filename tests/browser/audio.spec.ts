import {test,expect} from '@playwright/test';

test('new cues render soft nonzero signals and species produce different waveforms',async({page})=>{
 await page.goto('/?dev=1');
 const rendered=await page.evaluate(async()=>{
  const {GameAudio}=await new Function('return import("/src/game/audio.ts")')();
  const results=[];
  for(const [kind,species] of [['attack',1],['attack',4],['attack',7],['attack',25],['jump',25],['dash',25],['kill',7],['faint',7],['defeat',25],['music',0]] as const){
   const context=new OfflineAudioContext(1,48000*6,48000);
   // Offline rendering has no autoplay gesture; the production graph is unchanged.
   Object.defineProperty(context,'state',{get:()=> 'running'});
   const audio=new GameAudio({soundVolume:.18,musicVolume:.07},()=>context);
   audio.unlock();audio.setActive(true);
   if(kind==='music')for(let i=0;i<7;i++)audio.update(.1);
   else audio.cue(kind,species);
   const buffer=await context.startRendering(),samples=buffer.getChannelData(0);
   let peak=0,energy=0,tail=0,fingerprint=0;
   for(let i=0;i<samples.length;i++){
    peak=Math.max(peak,Math.abs(samples[i]));energy+=samples[i]**2;
    if(i>samples.length-4800)tail=Math.max(tail,Math.abs(samples[i]));
    if(i<4800)fingerprint+=samples[i]*(i%97);
   }
   results.push({kind,species,peak,rms:Math.sqrt(energy/samples.length),tail,fingerprint,errors:audio.inspect().errors});
  }
  return results;
 });
 for(const signal of rendered){
  expect(signal.peak,JSON.stringify(signal)).toBeGreaterThan(.0001);
  expect(signal.peak).toBeLessThan(.08);expect(signal.tail).toBeLessThan(.00001);expect(signal.errors).toBe(0);
 }
 expect(new Set(rendered.filter(signal=>signal.kind==='attack').map(signal=>signal.fingerprint.toFixed(5))).size).toBe(4);
});

test('real jump and dash input sound once and stop on pause',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await page.evaluate(()=>{
  const game=(window as any).__WILDLANDS__;
  game.sim.state.enemies=[];game.sim.spawnAccum=-1000;game.sim.state.player.iframes=10000;
 });
 await page.keyboard.down('Space');await page.keyboard.down('ShiftLeft');await page.waitForTimeout(350);
 await page.keyboard.up('Space');await page.keyboard.up('ShiftLeft');
 const audio=()=>page.evaluate(()=>(window as any).__WILDLANDS__.audio.inspect());
 expect((await audio()).cues).toMatchObject({jump:1,dash:1});
 await expect.poll(async()=>(await audio()).ambientNotes).toBeGreaterThan(0);
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 expect((await audio()).voices).toBe(0);
 await page.keyboard.press('Space');await page.keyboard.press('ShiftLeft');
 expect((await audio()).cues).toMatchObject({jump:1,dash:1});
 expect(errors).toEqual([]);
});
