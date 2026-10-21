import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const game=(page:Page,expression:string)=>page.evaluate(expression=>{
 const g=(window as any).__WILDLANDS__;
 return new Function('g',`return (${expression})(g)`)(g);
},expression);
const captured=async(page:Page)=>{
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect(page.locator('#overlay')).toBeHidden();
};
const start=async(page:Page)=>{
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();await captured(page);
 await expect.poll(()=>game(page,'g=>g.scene.isReady()')).toBe(true);
 await game(page,'g=>{g.sim.state.player.iframes=10000;}');
};
const pause=async(page:Page)=>{
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 await expect.poll(()=>game(page,'g=>g.sim.state.phase')).toBe('paused');
};

test('world health bars track damage, pause, jumps and camera movement without crowding the fight',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await start(page);await pause(page);
 const initial=await game(page,`g=>{
  const s=g.sim.state,p=s.player,e=s.enemies[0];
  s.party.push({...s.party[0],uid:s.idCounter++,x:p.x-3,hp:20});
  s.enemies=[{...e,x:p.x+5,z:p.z+3,hp:100,maxHp:100,dead:false}];
  p.hp=p.maxHp;
  g.healthBars.sync(s,1,(x,z)=>g.world.height(x,z));
  return {bars:g.healthBars.inspect(),enemy:e.uid,player:s.party[0].uid,follower:s.party[1].uid};
 }`);
 expect(initial.bars).toHaveLength(2);
 expect(initial.bars.every((b:any)=>b.visible&&b.ratio===1&&b.displayedRatio===1)).toBe(true);
 expect(initial.bars.some((b:any)=>b.uid===initial.follower)).toBe(false);
 const damaged=await game(page,`g=>{
  const s=g.sim.state;s.player.hp=s.player.maxHp*.5;s.enemies[0].hp=25;
  g.healthBars.sync(s,0,(x,z)=>g.world.height(x,z));return g.healthBars.inspect();
 }`);
 expect(damaged.find((b:any)=>b.kind==='player').ratio).toBe(.5);
 expect(damaged.find((b:any)=>b.kind==='enemy').ratio).toBe(.25);
 expect(damaged.every((b:any)=>b.displayedRatio===1)).toBe(true);
 await page.waitForTimeout(140);
 expect(await game(page,'g=>g.healthBars.inspect()')).toEqual(damaged);
 const eased=await game(page,`g=>{
  g.healthBars.sync(g.sim.state,.06,(x,z)=>g.world.height(x,z));return g.healthBars.inspect();
 }`);
 expect(eased.every((b:any)=>b.displayedRatio>b.ratio&&b.displayedRatio<1)).toBe(true);

 const alignment=await game(page,`g=>{
  const s=g.sim.state,uid=s.party[0].uid,before=g.healthBars.inspect().find(b=>b.uid===uid);
  s.player.y=2;
  g.healthBars.sync(s,0,(x,z)=>g.world.height(x,z));
  const jumped=g.healthBars.inspect().find(b=>b.uid===uid);
  const track=g.scene.getMeshByName('health-track-'+uid),fill=g.scene.getMeshByName('health-fill-'+uid);
  const beforeMatrix=Array.from(track.computeWorldMatrix(true).m);
  g.camera.alpha+=.9;g.camera.beta=.72;g.camera.getViewMatrix(true);
  g.healthBars.sync(s,0,(x,z)=>g.world.height(x,z));g.scene.render();
  const after=g.healthBars.inspect().find(b=>b.uid===uid),ground=g.world.height(s.player.x,s.player.z);
  return {rise:jumped.y-before.y,offset:Math.hypot(after.x-s.player.x,after.y-ground-s.player.y,after.z-s.player.z),
   previousOffset:Math.hypot(before.x-s.player.x,before.y-ground,before.z-s.player.z),
   matrixChanged:beforeMatrix.some((v,i)=>Math.abs(v-track.getWorldMatrix().m[i])>.0001),
   rendered:track.isEnabled()&&track.isVisible&&fill.isEnabled()&&fill.isVisible&&track.material.isReady(track)};
 }`);
 expect(alignment.rise).toBeCloseTo(2,5);
 expect(alignment.offset).toBeCloseTo(alignment.previousOffset,4);
 expect(alignment.matrixChanged).toBe(true);expect(alignment.rendered).toBe(true);

 const crowded=await game(page,`g=>{
  const s=g.sim.state,e=s.enemies[0],p=s.player;
  s.enemies=Array.from({length:31},(_,i)=>({...e,uid:s.idCounter++,x:p.x+4+i*.7,z:p.z,hp:100,maxHp:100,dead:i===0}));
  const removed=e.uid,far={...e,uid:s.idCounter++,x:p.x+40,z:p.z,hp:100,maxHp:100,dead:false};s.enemies.push(far);
  g.healthBars.sync(s,0,(x,z)=>g.world.height(x,z));
  return {bars:g.healthBars.inspect(),closest:s.enemies[1].uid,dead:s.enemies[0].uid,far:far.uid,
   removedMesh:g.scene.getMeshByName('health-track-'+removed)!==null};
 }`);
 expect(crowded.bars.filter((b:any)=>b.kind==='enemy')).toHaveLength(24);
 expect(crowded.bars.some((b:any)=>b.uid===crowded.closest)).toBe(true);
 expect(crowded.bars.some((b:any)=>b.uid===crowded.dead||b.uid===crowded.far)).toBe(false);
 expect(crowded.removedMesh).toBe(false);
 await page.locator('#restart-btn').click();
 expect(await game(page,`g=>({bars:g.healthBars,meshes:g.scene.meshes.filter(m=>m.name.startsWith('health-')).length,
  roots:g.scene.transformNodes.filter(n=>n.name.startsWith('health-bar-')).length,materials:g.scene.materials.filter(m=>m.name.startsWith('health-')).length})`))
  .toEqual({bars:null,meshes:0,roots:0,materials:0});
 expect(errors).toEqual([]);
});

test('party and enemy attacks play once, face their targets and freeze when paused',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await start(page);await pause(page);
 await game(page,`g=>{
  const s=g.sim.state,p=s.player,e=s.enemies[0],m=s.party[0];
  s.enemies=[{...e,speciesId:19,variant:'normal',x:p.x+2,z:p.z,hp:10000,maxHp:10000,speed:0,
   stunTime:0,hitCooldown:0,attackCooldown:0,attackTimer:0,animation:'idle',windup:undefined}];
  g.sim.spawnAccum=-1000;
  s.player.facing=0;m.cooldown=0;m.attackTimer=0;
  s.phase='playing';g.sim.update(.02,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});s.phase='paused';
  g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),s.player.y);
 }`);
 const attack=await game(page,'g=>({party:g.sim.state.party[0],enemy:g.sim.state.enemies[0]})');
 expect(attack.party.animation).toBe('attack');expect(attack.enemy.animation).toBe('attack');
 expect(attack.enemy.windup?.moveName).toBe('Quick Attack');
 expect(attack.party.attackTimer).toBeGreaterThan(0);expect(attack.enemy.attackTimer).toBeGreaterThan(0);
 expect(attack.party.facing).toBeCloseTo(Math.PI/2,4);expect(attack.enemy.facing).toBeCloseTo(-Math.PI/2,4);
 await expect.poll(()=>game(page,`g=>g.visuals.inspect().every(a=>a.requested==='attack'&&a.resolved!=='artwork')`)).toBe(true);
 const first=await game(page,'g=>g.visuals.inspect()');
 expect(first.every((a:any)=>a.attackProgress!==null&&a.visible)).toBe(true);
 await page.waitForTimeout(150);expect(await game(page,'g=>g.visuals.inspect()')).toEqual(first);
 const headClearance=await game(page,`g=>{
  const s=g.sim.state,uid=s.party[0].uid,cameraAlpha=g.camera.alpha,clearances=[];
  for(let direction=0;direction<8;direction++)for(const progress of [.05,.3,.6,.9]){
   g.camera.alpha=-Math.PI/2+direction*Math.PI/4;g.camera.getViewMatrix(true);
   s.party[0].attackTimer=s.party[0].attackDuration*(1-progress);
   g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),s.player.y);
   g.healthBars.sync(s,0,(x,z)=>g.world.height(x,z));g.scene.render();
   const avatar=g.visuals.actors.get(uid).avatar,a=avatar.asset,sprite=avatar.sprite;
   const pixels=a.manager.texture.getContext().getImageData(avatar.frame*a.meta.width,avatar.row*a.meta.height,a.meta.width,a.meta.height).data;
   let top=a.meta.height;
   for(let y=0;y<a.meta.height;y++)for(let x=0;x<a.meta.width;x++)if(pixels[(y*a.meta.width+x)*4+3]>16)top=Math.min(top,y);
   const up=g.assets.billboardUp(),track=g.scene.getMeshByName('health-track-'+uid);
   const spriteTop=sprite.position.add(up.scale((a.meta.height/2-top)*sprite.height/a.meta.height));
   const barBottom=track.parent.position.subtract(up.scale(track.scaling.y/2));
   clearances.push(up.constructor.Dot(barBottom.subtract(spriteTop),up));
  }
  g.camera.alpha=cameraAlpha;return clearances;
 }`);
 expect(headClearance).toHaveLength(32);
 expect(Math.min(...headClearance)).toBeGreaterThan(.05);
 const advanced=await game(page,`g=>{
  const s=g.sim.state;for(const a of [...s.party,...s.enemies])a.attackTimer=a.attackDuration*.2;
  g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),s.player.y);
  return g.visuals.inspect();
 }`);
 expect(advanced.every((a:any)=>a.attackProgress>.7&&a.attackProgress<.9)).toBe(true);
 expect(advanced.some((a:any,i:number)=>a.frame>first[i].frame)).toBe(true);
 await game(page,`g=>{
  const s=g.sim.state;s.enemies[0].hitCooldown=10;s.party[0].cooldown=10;
  // Let the committed enemy windup and its release finish, not only the
  // manually sampled body timer. Recovery begins when the attack releases.
  s.phase='playing';for(let i=0;i<20;i++)g.sim.update(.04,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});s.phase='paused';
  g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x,z)=>g.world.height(x,z),s.player.y);
 }`);
 expect(await game(page,'g=>g.sim.state.party[0].animation')).toBe('idle');
 expect(await game(page,'g=>g.sim.state.enemies[0].animation')).toBe('idle');
 expect((await game(page,'g=>g.visuals.inspect()')).every((a:any)=>a.attackProgress===null)).toBe(true);
 expect(errors).toEqual([]);
});

test('opening and regular enemies appear outside the immediate fight, with a calm combat view',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await start(page);await pause(page);
 const distances=await game(page,`g=>{
  const Sim=g.sim.constructor,samples=[];
  for(const [x,z] of [[0,0],[110,0],[-110,-110],[110,110]]){
   const sim=new Sim(25,347);const s=sim.state;
   const opening=s.enemies.map(e=>Math.hypot(e.x-s.player.x,e.z-s.player.z));
   s.enemies=[];s.player.x=x;s.player.z=z;s.player.iframes=10000;
   while(s.enemies.length===0)sim.update(.04,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});
   const e=s.enemies[0];samples.push({opening,regular:Math.hypot(e.x-s.player.x,e.z-s.player.z),x:e.x,z:e.z});
  }return samples;
 }`);
 for(const sample of distances){
  expect(sample.opening).toHaveLength(3);
  expect(sample.opening.every((d:number)=>d>=24&&d<=34)).toBe(true);
  expect(sample.regular).toBeGreaterThanOrEqual(24);expect(sample.regular).toBeLessThanOrEqual(34);
  expect(Math.abs(sample.x)).toBeLessThanOrEqual(111);expect(Math.abs(sample.z)).toBeLessThanOrEqual(111);
 }
 await game(page,`g=>{
  const s=g.sim.state,p=s.player,e=s.enemies[0];p.hp=p.maxHp*.72;p.iframes=10000;
  g.sim.spawnAccum=-100;
  s.enemies=[[-5,5,.3],[-1,8,.8],[4,5,.55],[7,9,1]].map(([x,z,ratio],i)=>({...e,uid:s.idCounter++,speciesId:[19,10,16,29][i],
   x:p.x+x,z:p.z+z,hp:10000*ratio,maxHp:10000,speed:0,stunTime:10000,hitCooldown:10000,dead:false}));
  s.party[0].cooldown=0;g.camera.alpha=-Math.PI/2;g.camera.beta=1.05;g.camera.radius=24;
  g.healthBars.sync(s,1,(x,z)=>g.world.height(x,z));
 }`);
 await page.locator('#resume-btn').click();await captured(page);
 await expect.poll(()=>game(page,'g=>g.visuals.inspect().every(a=>a.resolved!=="artwork")')).toBe(true);
 await game(page,'g=>{g.sim.state.party[0].cooldown=0;}');
 await expect.poll(()=>game(page,'g=>{const a=g.sim.state.party[0];return a.animation==="attack"&&a.attackTimer>.12&&a.attackTimer<.25;}'),{intervals:[20]}).toBe(true);
 await mkdir('artifacts/browser',{recursive:true});
 await page.screenshot({path:'artifacts/browser/combat.png'});
 expect(await game(page,'g=>g.healthBars.inspect().filter(b=>b.visible).length')).toBe(5);
 expect(errors).toEqual([]);
});

test('opening encounters are weak and large species retain their authored size in sprites and health bars',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await start(page);await pause(page);
 const opening=await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,{getEnemySpeciesProfile}=await import('/src/data/enemySpecies.ts');
  return Array.from({length:16},(_,index)=>{
   const s=new g.sim.constructor(25,347+index).state;
   return s.enemies.map((enemy:any)=>({variant:enemy.variant,elite:enemy.elite,strength:getEnemySpeciesProfile(enemy.speciesId).strength}));
  });
 });
 for(const enemies of opening){
  expect(enemies).toHaveLength(3);
  expect(enemies.every((enemy:any)=>enemy.variant==='normal'&&!enemy.elite&&enemy.strength<=2.4)).toBe(true);
 }
 await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,p=s.player,{createEnemy}=await import('/src/game/systems/spawning.ts');
  p.x=0;p.z=0;p.y=0;s.party[0].x=0;s.party[0].z=0;g.sim.spawnAccum=-1000;
  s.enemies=[19,95,143,149].map((id,index)=>createEnemy(s,g.sim.rng,id,'normal',(index-1.5)*6,7));
  g.camera.alpha=-Math.PI/2;g.camera.beta=1.05;g.camera.radius=27;g.camera.getViewMatrix(true);
  g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x:number,z:number)=>g.world.height(x,z));
 });
 await expect.poll(()=>game(page,`g=>g.visuals.inspect().length===5&&g.visuals.inspect().every(a=>a.resolved!=='artwork'&&a.visible)`)).toBe(true);
 const rendered=await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state,{getEnemySpeciesProfile}=await import('/src/data/enemySpecies.ts');
  const {ENEMY_TIER_TUNING}=await import('/src/data/enemyTiers.ts');
  g.visuals.sync(s.party,s.enemies,0,-g.camera.alpha-Math.PI/2,(x:number,z:number)=>g.world.height(x,z));
  g.healthBars.sync(s,1,(x:number,z:number)=>g.world.height(x,z));g.scene.render();
  return s.enemies.map((enemy:any)=>{
   const profile=getEnemySpeciesProfile(enemy.speciesId),actor=g.visuals.actors.get(enemy.uid),avatar=actor.avatar,asset=avatar.asset;
   const bar=g.healthBars.inspect().find((bar:any)=>bar.uid===enemy.uid),track=g.scene.getMeshByName('health-track-'+enemy.uid);
   const tierScale=enemy.combatTier===3?ENEMY_TIER_TUNING.tier3.sizeMultiplier:enemy.combatTier===4?ENEMY_TIER_TUNING.tier4.sizeMultiplier:1;
   return {speciesId:enemy.speciesId,size:enemy.size,expectedSize:profile.size*tierScale,
    bodyHeight:avatar.sprite.height*asset.bounds.visibleHeight/asset.meta.height,shadowWidth:actor.shadow.scaling.x,
    barOffset:Math.hypot(bar.x-enemy.x,bar.y-g.world.height(enemy.x,enemy.z),bar.z-enemy.z),
    expectedBarOffset:1.65*enemy.size*g.assets.headroom(enemy.speciesId)+.3,
    visible:avatar.sprite.isVisible&&avatar.sprite.manager.texture.isReady()&&track.isEnabled()&&track.isVisible&&track.material.isReady(track)};
  });
 });
 expect(rendered.map((enemy:any)=>enemy.speciesId)).toEqual([19,95,143,149]);
 for(const enemy of rendered){
  expect(enemy.size).toBe(enemy.expectedSize);
  expect(enemy.bodyHeight).toBeCloseTo(1.65*enemy.size,5);
  expect(enemy.barOffset).toBeCloseTo(enemy.expectedBarOffset,5);
  expect(enemy.visible).toBe(true);
 }
 for(const enemy of rendered.slice(1)){
  expect(enemy.bodyHeight).toBeGreaterThan(rendered[0].bodyHeight*2.5);
  expect(enemy.shadowWidth).toBeGreaterThan(rendered[0].shadowWidth*2.5);
 }
 await mkdir('artifacts/browser',{recursive:true});
 await page.locator('#overlay').evaluate(element=>(element as HTMLElement).style.visibility='hidden');
 await page.screenshot({path:'artifacts/browser/enemy-species-sizes.png'});
 await page.locator('#overlay').evaluate(element=>(element as HTMLElement).style.visibility='');
 expect(errors).toEqual([]);
});
