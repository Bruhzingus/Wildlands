import {test,expect} from '@playwright/test';

test('development live telemetry observes an actual captured run and detaches without replacing game feedback',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');
 await page.evaluate(async()=>{
  const local=await (new Function('return import("/scripts/lib/live-telemetry.ts")')() as Promise<any>);
  const scope=window as any;scope.__PLAYTEST__=local.armPlaytest(scope.__WILDLANDS__);
 });
 await page.locator('[data-starter="7"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await page.keyboard.down('w');await page.waitForTimeout(220);await page.keyboard.up('w');
 const moving=await page.evaluate(()=>{
  const scope=window as any;return {elapsed:scope.__WILDLANDS__.sim.state.stats.elapsed,status:scope.__PLAYTEST__.status()};
 });
 expect(moving.elapsed).toBeGreaterThan(0);expect(moving.status).toBe('recording');
 await page.keyboard.press('Escape');
 const frozen=await page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.stats.elapsed);
 await page.waitForTimeout(120);
 const report=await page.evaluate(()=>{
  const scope=window as any,game=scope.__WILDLANDS__,capture=scope.__PLAYTEST__;
  const before=game.sim.state.stats.elapsed;
  const result=capture.finish({other:'Automated browser wiring test; not a human balance session'});
  return {before,report:result,status:capture.status(),elapsed:game.sim.state.stats.elapsed};
 });
 expect(report.before).toBe(frozen);expect(report.elapsed).toBe(frozen);expect(report.status).toBe('finished');
 expect(report.report.metrics.config.behavior).toBe('human');expect(report.report.metrics.validationErrors).toEqual([]);
 expect(report.report.metrics.elapsed).toBeCloseTo(frozen,2);expect(errors).toEqual([]);
});
