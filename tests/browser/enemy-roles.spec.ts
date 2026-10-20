import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('an actual Egg Bomb cast shows its aimed landing warning, readable throw and arcing flight',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 const cast=await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,{createEnemy}=await import('/src/game/systems/spawning.ts');
  const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
  s.player.x=0;s.player.z=0;s.player.iframes=1000;s.party[0].cooldown=1000;g.sim.spawnAccum=-1000;s.projectiles=[];
  const enemy=createEnemy(s,g.sim.rng,102,'normal',8,8);Object.assign(enemy,{speed:0,attackCooldown:0});s.enemies=[enemy];
  s.phase='playing';g.sim.update(.01,idle);s.phase='paused';g.fx.update(s,0);
  g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x:number,z:number)=>g.world.height(x,z));
  const warning=g.scene.getMeshByName(`combat-windup-${enemy.uid}`);
  const first={move:enemy.windup.moveName,x:warning.position.x,z:warning.position.z,radius:warning.scaling.x,label:g.visuals.inspectMoveLabels().active[0].moveName};
  s.phase='playing';for(let i=0;i<36;i++)g.sim.update(.02,idle);s.phase='paused';g.fx.update(s,0);g.scene.render();
  const bomb=s.projectiles.find((p:any)=>!p.friendly&&p.kind==='lob'),landing=g.scene.getMeshByName(`combat-bomb-landing-${bomb.uid}`);
  return {first,bombId:bomb.uid,landing:{x:landing.position.x,z:landing.position.z,radius:landing.scaling.x},ttl:bomb.ttl};
 });
 expect(cast.first).toEqual({move:'Egg Bomb',x:0,z:0,radius:3.4,label:'Egg Bomb'});
 expect(cast.landing).toEqual({x:0,z:0,radius:3.4});expect(cast.ttl).toBeGreaterThan(1);
 await expect.poll(()=>page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__;g.scene.render();return g.scene.meshes.filter((m:any)=>m.isEnabled()&&m.name.startsWith('combat-')).every((m:any)=>m.material.isReady(m));
 })).toBe(true);
 const frozen=await page.evaluate(()=>JSON.stringify((window as any).__WILDLANDS__.sim.state.projectiles));
 await page.waitForTimeout(120);expect(await page.evaluate(()=>JSON.stringify((window as any).__WILDLANDS__.sim.state.projectiles))).toBe(frozen);
 await mkdir('artifacts/browser',{recursive:true});
 await page.locator('#overlay').evaluate(node=>{(node as HTMLElement).style.visibility='hidden';});
 await page.screenshot({path:'artifacts/browser/enemy-egg-bomb.png'});
 const end=await page.evaluate((uid:number)=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
  s.player.x=20;s.enemies[0].attackCooldown=1000;s.phase='playing';for(let i=0;i<140&&s.projectiles.length;i++)g.sim.update(.02,idle);s.phase='paused';g.fx.update(s,0);
  return {projectiles:s.projectiles.length,warning:g.scene.getMeshByName(`combat-bomb-landing-${uid}`).isEnabled()};
 },cast.bombId);
 expect(end).toEqual({projectiles:0,warning:false});expect(errors).toEqual([]);
});

test('all seven enemy roles show distinct attack poses and pooled real-move labels',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect(page.locator('#overlay')).toBeHidden();
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 const setup=await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  const {createEnemy}=await import('/src/game/systems/spawning.ts');
  const {getEnemyAttackProfile}=await import('/src/data/enemyAttacks.ts');
  s.player.x=0;s.player.z=0;s.party[0].x=0;s.party[0].z=0;
  s.enemies=[19,20,25,26,100,102,113].map((id,index)=>{
   const enemy=createEnemy(s,g.sim.rng,id,'normal',(index-3)*4,7),profile=getEnemyAttackProfile(id);
   Object.assign(enemy,{animation:'attack',attackTimer:.5,attackDuration:1});
   enemy.windup={kind:'enemyMove',role:profile.role,moveName:profile.moveName,remaining:.5,duration:1,x:enemy.x,z:enemy.z,facing:0,radius:profile.radius};
   return enemy;
  });
  const sync=()=>g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x:number,z:number)=>g.world.height(x,z));sync();g.scene.render();
  return {names:g.visuals.inspectMoveLabels().active.map((a:any)=>a.moveName),poses:g.visuals.inspect().filter((a:any)=>a.uid!==s.party[0].uid).map((a:any)=>({style:a.attackStyle,phase:a.posePhase,pose:a.pose})),labels:g.visuals.inspectMoveLabels()};
 });
 expect(setup.names).toEqual(expect.arrayContaining(['Quick Attack','Hyper Fang','Thunder Shock','Thunderbolt','Self-Destruct','Egg Bomb','Soft-Boiled']));
 expect(new Set(setup.poses.map((pose:any)=>pose.style)).size).toBe(7);
 expect(setup.poses.every((pose:any)=>pose.phase==='windup')).toBe(true);
 expect(setup.poses.find((pose:any)=>pose.style==='explosive').pose.scaleY).toBeGreaterThan(1);
 expect(setup.labels).toMatchObject({allocated:7,atlases:1});
 const pool=await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,{createEnemy}=await import('/src/game/systems/spawning.ts');
  const sync=()=>g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x:number,z:number)=>g.world.height(x,z));
  const seed=s.enemies[0];
  s.enemies=Array.from({length:24},(_,index)=>({...createEnemy(s,g.sim.rng,19,'normal',index%6-3,6+Math.floor(index/6)),animation:'attack',attackTimer:.5,attackDuration:1,windup:{...seed.windup}}));
  sync();const capped=g.visuals.inspectMoveLabels();
  s.enemies[0].isBoss=true;s.enemies[0].x=30;sync();const priority=g.visuals.inspectMoveLabels().active.some((label:any)=>label.uid===s.enemies[0].uid);
  for(const enemy of s.enemies){enemy.windup=undefined;enemy.animation='idle';enemy.attackTimer=0;}sync();
  const idle=g.visuals.inspectMoveLabels();
  for(let wave=0;wave<20;wave++){
   for(const enemy of s.enemies){enemy.windup={...seed.windup};enemy.animation='attack';enemy.attackTimer=.5;}sync();
   for(const enemy of s.enemies){enemy.windup=undefined;enemy.animation='idle';enemy.attackTimer=0;}sync();
  }
  const reused=g.visuals.inspectMoveLabels(),atlases=g.scene.textures.filter((texture:any)=>texture.name==='enemy-move-name-atlas').length;
  g.visuals.dispose();return {capped,idle,reused,atlases,priority,remaining:g.scene.textures.filter((texture:any)=>texture.name==='enemy-move-name-atlas').length};
 });
 expect(pool.capped).toMatchObject({allocated:16,atlases:1});expect(pool.capped.active).toHaveLength(16);
 expect(pool.priority).toBe(true);expect(pool.idle.active).toHaveLength(0);
 expect(pool.reused).toMatchObject({allocated:16,atlases:1});expect(pool.atlases).toBe(1);expect(pool.remaining).toBe(0);
 expect(errors).toEqual([]);
});
