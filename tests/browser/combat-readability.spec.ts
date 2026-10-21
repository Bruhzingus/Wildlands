import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('readable enemy windup, release and flight remain visible and freeze with the game',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 await mkdir('artifacts/browser',{recursive:true});
 await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  const {createEnemy}=await import('/src/game/systems/spawning.ts');
  const {prepareEnemyMove}=await import('/src/game/combat/enemies.ts');
  s.player.x=0;s.player.z=-2;s.player.y=0;s.player.iframes=10000;
  s.party[0].x=0;s.party[0].z=-2;s.party[0].cooldown=10000;s.projectiles=[];s.drops=[];s.psychicRings=[];
  g.sim.spawnAccum=-10000;
  s.enemies=[[20,-5,-1],[25,6,5],[32,-7,6],[100,5,-2],[102,-1,9],[113,9,9]].map(([id,x,z])=>{
   const e=createEnemy(s,g.sim.rng,id,'normal',x,z);e.speed=0;e.hp=e.maxHp*.6;
   e.windup=prepareEnemyMove(e,s.player);e.windup.remaining=e.windup.duration*.65;
   e.animation='attack';e.attackDuration=e.windup.duration;e.attackTimer=e.windup.remaining;e.facing=e.windup.facing;return e;
  });
  g.camera.alpha=-Math.PI/2;g.camera.beta=.82;g.camera.radius=24;g.camera.target.set(0,g.world.height(0,3),3);g.camera.getViewMatrix(true);
  g.fx.update(s,0);g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x:number,z:number)=>g.world.height(x,z));
  g.healthBars.sync(s,1,(x:number,z:number)=>g.world.height(x,z));
  (document.querySelector('#overlay') as HTMLElement).style.visibility='hidden';
 });
 await expect.poll(()=>page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__;g.scene.render();
  return g.visuals.inspect().every((a:any)=>a.resolved==='Attack'||a.requested!=='attack')&&g.scene.isReady();
 })).toBe(true);
 await page.screenshot({path:'artifacts/browser/combat-readability-windup.png'});
 const late=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  for(const e of s.enemies)e.windup.remaining=e.windup.duration*.08;
  g.fx.update(s,0);g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x:number,z:number)=>g.world.height(x,z));g.scene.render();
  return {progress:g.scene.getMeshByName(`combat-windup-${s.enemies[0].uid}`).metadata.progress,lines:g.scene.meshes.filter((m:any)=>m.isEnabled()&&m.name.startsWith('combat-windup-aim')).length};
 });
 expect(late.progress).toBeCloseTo(.92);expect(late.lines).toBe(0);
 await page.screenshot({path:'artifacts/browser/combat-readability-imminent.png'});
 const flight=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
  s.phase='playing';for(let i=0;i<6;i++)g.sim.update(.02,idle);s.phase='paused';
  g.fx.update(s,.12);g.visuals.sync(s.party,s.enemies,.12,-g.camera.alpha-Math.PI/2,(x:number,z:number)=>g.world.height(x,z));g.scene.render();
  return {bomb:s.projectiles.some((p:any)=>p.moveName==='Egg Bomb'),rim:g.scene.meshes.some((m:any)=>m.isEnabled()&&m.name.startsWith('combat-hostile-rim'))};
 });
 expect(flight).toEqual({bomb:true,rim:false});
 await page.screenshot({path:'artifacts/browser/combat-readability-release.png'});
 const snapshot=()=>page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__;
  return JSON.stringify(g.scene.meshes.filter((m:any)=>m.isEnabled()&&m.name.startsWith('combat-')).map((m:any)=>({name:m.name,pos:m.position.asArray(),scale:m.scaling.asArray(),meta:m.metadata})));
 });
 const frozen=await snapshot();await page.waitForTimeout(150);expect(await snapshot()).toBe(frozen);
 expect(errors).toEqual([]);
});
