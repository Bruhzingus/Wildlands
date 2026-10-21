import {test,expect} from '@playwright/test';

test('miniboss attack budgets produce distinct, correctly labelled committed moves',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 const result=await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  const {createEnemy}=await import('/src/game/systems/spawning.ts');
  const {getEnemyAttackLoadout}=await import('/src/data/enemyAttacks.ts');
  const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
  s.player.x=0;s.player.z=0;s.player.iframes=1000;s.player.hp=s.player.maxHp;
  s.party=s.party.slice(0,1);s.party[0].x=0;s.party[0].z=0;s.party[0].cooldown=10000;
  s.stats.elapsed=840;s.stats.xpToNext=1e12;s.projectiles=[];s.drops=[];g.sim.spawnAccum=-1000;
  const ordinary=createEnemy(s,g.sim.rng,20,'normal',-5,3),normal=createEnemy(s,g.sim.rng,149,'normal',5,3);
  const rocket=createEnemy(s,g.sim.rng,149,'rocket',0,3);
  const budgets={ordinary:getEnemyAttackLoadout(ordinary,840).length,normal:getEnemyAttackLoadout(normal,840).length,
   rocket:getEnemyAttackLoadout(rocket,840).length};
  rocket.hardShrine=true;rocket.speed=0;rocket.attackCooldown=0;rocket.attackIndex=0;
  s.enemies=[rocket];
  const moves=getEnemyAttackLoadout(rocket,840),events:any[]=[],previousListener=g.sim.onEvent;
  g.sim.onEvent=(event:any)=>{events.push(event);previousListener(event);};
  const sync=()=>{g.fx.update(s,0);g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x:number,z:number)=>g.world.height(x,z));g.scene.render();};
  const casts=[];
  for(let index=0;index<moves.length;index++){
   Object.assign(rocket,{x:0,z:3,windup:undefined,attackCooldown:0,attackTimer:0,attackIndex:index});
   s.projectiles=[];s.stats.elapsed=840;events.length=0;
   s.phase='playing';g.sim.update(.01,idle);s.phase='paused';sync();
   const windup=rocket.windup,label=g.visuals.inspectMoveLabels().active.find((entry:any)=>entry.uid===rocket.uid);
   const warning=g.scene.getMeshByName(`combat-windup-${rocket.uid}`);
   const tell={name:windup?.moveName,role:windup?.role,label:label?.moveName,cell:label?.cellIndex,expectedCell:label?.expectedCell,
    warning:warning?.isEnabled(),pose:g.visuals.inspect().find((entry:any)=>entry.uid===rocket.uid)?.attackStyle};
   s.phase='playing';for(let tick=0;tick<100&&rocket.windup;tick++)g.sim.update(.02,idle);s.phase='paused';
   // A fresh visual has no cached tell pose, just as when simulation ticks cross
   // a complete tell before the next rendered frame.
   if(index===1)g.visuals.sync(s.party,[],0,-g.camera.alpha-Math.PI/2,(x:number,z:number)=>g.world.height(x,z));
   sync();
   casts.push({expected:moves[index].moveName,tell,released:events.some(event=>event.kind==='attack'&&event.sourceId===rocket.uid&&event.label===moves[index].moveName),
    projectile:s.projectiles.find((p:any)=>!p.friendly&&p.sourceId===rocket.uid)?.moveName,
    releasePose:g.visuals.inspect().find((entry:any)=>entry.uid===rocket.uid)?.attackStyle,nextIndex:rocket.attackIndex});
  }
  g.sim.onEvent=previousListener;
  return {budgets,hardShrineMoves:moves.map((move:any)=>move.moveName),casts,
   health:{ordinary:ordinary.maxHp,normal:normal.maxHp,rocket:rocket.maxHp},size:{ordinary:ordinary.size,normal:normal.size},labels:g.visuals.inspectMoveLabels()};
 });
 expect(result.budgets).toEqual({ordinary:1,normal:2,rocket:3});
 expect(result.hardShrineMoves).toEqual(['Dragon Rush','Dragon Pulse','Hurricane','Hyper Beam']);
 expect(result.health.normal).toBeGreaterThan(4000);expect(result.health.normal).toBeGreaterThan(result.health.ordinary*10);
 expect(result.health.rocket).toBeGreaterThan(10000);expect(result.size.normal).toBeGreaterThan(result.size.ordinary*2);
 for(const [index,cast] of result.casts.entries()){
  expect(cast.tell.name).toBe(cast.expected);expect(cast.tell.label).toBe(cast.expected);
  expect(cast.tell.expectedCell).toBeDefined();expect(cast.tell.cell).toBe(cast.tell.expectedCell);
  expect(cast.tell.warning).toBe(true);expect(cast.released).toBe(true);expect(cast.nextIndex).toBe(index+1);
  expect(cast.releasePose).toBe(cast.tell.pose);
 }
 expect(result.casts[1].projectile).toBe('Dragon Pulse');expect(result.casts[2].projectile).toBe('Hurricane');
 expect(result.casts[3].projectile).toBe('Hyper Beam');
 expect(new Set(result.casts.map(cast=>cast.tell.cell)).size).toBe(4);
 expect(result.labels).toMatchObject({allocated:1,atlases:1});expect(result.labels.active).toHaveLength(0);
 expect(errors).toEqual([]);
});

test('the scheduled Mewtwo has a much larger health budget than a tier-four Dragonite',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 const health=await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,{createEnemy}=await import('/src/game/systems/spawning.ts');
  const {getEnemyAttackLoadout}=await import('/src/data/enemyAttacks.ts');
  s.player.iframes=1000;s.party[0].cooldown=10000;s.stats.xpToNext=1e12;s.stats.elapsed=899.99;
  s.enemies=[];g.sim.spawnAccum=-1000;
  const rocket=createEnemy(s,g.sim.rng,149,'rocket',10,5);
  s.phase='playing';g.sim.update(.02,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});s.phase='paused';
  const boss=s.enemies.find((enemy:any)=>enemy.isBoss);
  s.player.x=0;s.player.z=0;Object.assign(boss,{x:0,z:5,speed:0,bossCycle:3,attackCooldown:0});
  s.phase='boss';g.sim.update(.01,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});s.phase='paused';
  g.fx.update(s,0);g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x:number,z:number)=>g.world.height(x,z));
  const label=g.visuals.inspectMoveLabels().active.find((entry:any)=>entry.uid===boss.uid);
  g.ui.update({...s,phase:'boss'});g.ui.update(s);
  const fourth={name:boss.windup?.moveName,hint:document.querySelector('#boss-action')?.textContent,radius:g.scene.getMeshByName(`combat-windup-${boss.uid}`)?.scaling.x,
   label:label?.moveName,cell:label?.cellIndex,expectedCell:label?.expectedCell};
  s.phase='boss';for(let tick=0;tick<100&&boss.windup;tick++)g.sim.update(.02,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});s.phase='paused';
  return {rocket:rocket.maxHp,boss:boss.maxHp,tier:boss.combatTier,moves:getEnemyAttackLoadout(boss,900).length,fourth,nextCycle:boss.bossCycle};
 });
 expect(health.boss).toBeGreaterThan(60000);expect(health.boss).toBeGreaterThan(health.rocket*3);
 expect(health.tier).toBe(5);expect(health.moves).toBe(4);
 expect(health.fourth).toMatchObject({name:'Psyshock',label:'Psyshock',radius:6});
 expect(health.fourth.hint).toContain('PSYSHOCK');
 expect(health.fourth.expectedCell).toBeDefined();expect(health.fourth.cell).toBe(health.fourth.expectedCell);
 expect(health.nextCycle).toBe(0);expect(errors).toEqual([]);
});
