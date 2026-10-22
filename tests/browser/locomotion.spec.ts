import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';

const run=(page:Page,expression:string)=>page.evaluate(expression=>new Function('g',`return (${expression})(g)`)((window as any).locomotion),expression);
const open=async(page:Page)=>{
 await page.goto(`/tests/browser/fixtures/locomotion.html${process.env.N1_BASELINE?'?baseline=1':''}`);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).locomotion),{timeout:60000,message:'Native sheets and the first WebGL frame are ready'}).toBe(true);
};
test.use({viewport:{width:960,height:600},video:{mode:'on',size:{width:960,height:600}}});

test('same seeded movement route comparison for 1, 4 and 6 members',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await open(page);await mkdir('artifacts/browser/n1',{recursive:true});
 const side=process.env.N1_BASELINE?'before':'after',results:unknown[]=[];
 for(const count of [1,4,6]){
  await run(page,`g=>g.reset(${count})`);
  const stages=[
   {name:'idle',frames:8,input:{}},
   {name:'slow start',frames:14,input:{mz:.06}},
   {name:'walk',frames:16,input:{mz:1}},
   {name:'diagonal',frames:14,input:{mx:1,mz:1}},
   {name:'reverse',frames:14,input:{mx:-1,mz:-1}},
   {name:'jump',frames:14,input:{mz:1},jump:true},
   {name:'dodge',frames:10,input:{mx:1},dodge:true},
   {name:'attack and recover',frames:18,input:{mx:1},special:true},
   {name:'stop and orbit',frames:20,input:{},orbit:true},
  ];
  for(const stage of stages){
   await run(page,`g=>g.label('${stage.name}')`);
   for(let i=0;i<stage.frames;i++){
    await run(page,`g=>{${stage.orbit?'g.camera.alpha+=.04;':''}g.step(${JSON.stringify({...stage.input,...(i===0?{jump:!!stage.jump,dodge:!!stage.dodge,special:!!stage.special}:{})})},.04);}`);
    await page.waitForTimeout(25);
   }
   results.push(await run(page,`g=>({count:${count},stage:'${stage.name}',state:structuredClone(g.sim.state),rng:JSON.stringify([g.sim.rng,g.sim.lootRng]),actors:g.visuals.inspect()})`));
   if(['slow start','reverse','stop and orbit'].includes(stage.name))await page.screenshot({path:`artifacts/browser/n1/${side}-${count}-${stage.name.replaceAll(' ','-')}.png`});
  }
 }
 await run(page,'g=>g.reset(6,40,35)');await run(page,"g=>g.label('slope')");
 for(let i=0;i<40;i++)await run(page,'g=>g.step({mx:1,mz:.4},.04)');
 await page.screenshot({path:`artifacts/browser/n1/${side}-slope.png`});
 results.push(await run(page,'g=>({stage:"slope",state:structuredClone(g.sim.state),rng:JSON.stringify([g.sim.rng,g.sim.lootRng]),actors:g.visuals.inspect()})'));
 await writeFile(`artifacts/browser/n1/${side}.json`,JSON.stringify(results,null,2));
 if(!process.env.N1_BASELINE&&process.env.N1_COMPARE_BASELINE){
  const before=JSON.parse(await readFile('artifacts/browser/n1/before.json','utf8'));
  expect(results.map((r:any)=>({state:r.state,rng:r.rng}))).toEqual(before.map((r:any)=>({state:r.state,rng:r.rng})));
 }
 expect(errors).toEqual([]);
 const video=page.video();await page.close();await video?.saveAs(`artifacts/browser/n1/${side}.webm`);
});

for(const reduced of [false,true])test(`actual travel, airborne frame hold, attack priority and pause (${reduced?'reduced':'normal'} motion)`,async({page})=>{
 await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});await open(page);
 // Low-speed leader and followers must walk despite the simulation's coarse
 // follower animation flag. Wing motion keeps native timing.
 await run(page,'g=>{for(let i=0;i<40;i++)g.step({mz:.08});}');
 const slow=await run(page,'g=>g.visuals.inspect()');
 expect(slow[0].requested).toBe('walk');expect(slow[0].locomotion.rate).toBeCloseTo(.08,3);
 expect(slow[2].requested).toBe('walk');
 await run(page,'g=>{for(let i=0;i<20;i++)g.step({mx:1,mz:1});}');
 const walk=await run(page,'g=>g.visuals.inspect()');
 expect(walk[0].locomotion.rate).toBeGreaterThan(.9);
 // An actual jump freezes the feet, follows player height and leaves its shadow
 // on the terrain. Cosmetic rendering cannot mutate any authoritative state.
 await run(page,'g=>g.step({mx:1,mz:1,jump:true})');
 const jump=await run(page,'g=>g.visuals.inspect()[0]');
 await run(page,'g=>{for(let i=0;i<6;i++)g.step({mx:1,mz:1});}');
 const airborne=await run(page,'g=>g.visuals.inspect()[0]');
 expect(airborne.locomotion.airborne).toBe(true);expect(airborne.frame).toBe(jump.frame);
 expect(airborne.locomotion.walkTime).toBe(jump.locomotion.walkTime);
 const frozen=await run(page,'g=>({state:JSON.stringify(g.sim.state),visuals:g.visuals.inspect()})');
 await run(page,'g=>{for(let i=0;i<30;i++)g.sync(0);}');
 expect(await run(page,'g=>({state:JSON.stringify(g.sim.state),visuals:g.visuals.inspect()})')).toEqual(frozen);
 // A native attack uses its authoritative aim and full one-shot progress while
 // locomotion continues sampling travel in the background.
 await run(page,`g=>{
  const m=g.sim.state.party[0];m.animation='attack';m.attackTimer=.24;m.attackDuration=.32;m.attackKind='beam';m.facing=-Math.PI/2;
  g.sync(.02);
 }`);
 const shot=await run(page,'g=>g.visuals.inspect()[0]');
 expect(shot.requested).toBe('attack');expect(shot.resolved).toBe('Attack');
 expect(shot.attackStyle).toBe('ranged');expect(shot.attackProgress).toBeCloseTo(.25,5);
 expect(shot.locomotion.facing).toBeCloseTo(-Math.PI/2,5);
 await run(page,`g=>{
  const s=g.sim.state,m=s.party[0];m.attackTimer=.08;g.sync(.02);
 }`);
 const recovery=await run(page,'g=>g.visuals.inspect()[0]');
 expect(recovery.requested).toBe('attack');expect(recovery.frame).toBeGreaterThan(shot.frame);
 if(reduced)expect(recovery.pose).toEqual({forward:0,lift:0,scaleX:1,scaleY:1,lean:0});
 await run(page,'g=>{for(let i=0;i<35;i++)g.step({mx:-1});}');
 const returned=await run(page,'g=>g.visuals.inspect()[0]');
 expect(returned.requested).toBe('walk');expect(returned.resolved).toBe('Walk');
 expect(returned.locomotion.facing).toBeCloseTo(-Math.PI/2,4);
 await run(page,'g=>{for(let i=0;i<35;i++)g.step();}');
 expect(await run(page,'g=>g.visuals.inspect()[0].requested')).toBe('idle');
 const rest=await run(page,'g=>g.visuals.inspect()[0]');
 await run(page,'g=>{g.camera.alpha+=Math.PI/2;g.sync(0);}');
 const orbit=await run(page,'g=>g.visuals.inspect()[0]');
 expect(orbit.requested).toBe('idle');expect(orbit.row).not.toBe(rest.row);
 expect(orbit.locomotion).toEqual(rest.locomotion);
});

test('fixed row anchors and slope-aligned contact shadows follow shared terrain',async({page})=>{
 await open(page);await run(page,'g=>g.reset(6,40,35)');
 await run(page,'g=>{for(let i=0;i<20;i++)g.step({mx:1,mz:.4});}');
 const checks=await run(page,`g=>g.visuals.inspect().map(a=>{
  const actor=g.sim.state.party.find(m=>m.uid===a.uid),entry=g.visuals.actors.get(a.uid),asset=entry.avatar.asset;
  const V=g.camera.target.constructor,up=g.assets.billboardUp(),anchor=asset.anchors[a.row%asset.anchors.length]*entry.avatar.sprite.height/asset.meta.height;
  const foot=entry.avatar.sprite.position.subtract(up.scale(anchor));
  const expected=new V(actor.x,g.world.height(actor.x,actor.z),actor.z);
  const normal=V.TransformNormal(new V(0,0,1),entry.shadow.computeWorldMatrix(true)).normalize();
  const d=.3,hx=(g.world.height(actor.x+d,actor.z)-g.world.height(actor.x-d,actor.z))/(2*d),hz=(g.world.height(actor.x,actor.z+d)-g.world.height(actor.x,actor.z-d))/(2*d);
  return {id:actor.speciesId,footError:V.Distance(foot,expected),anchor:a.requested==='walk'&&actor.speciesId!==41?asset.anchors[a.row]-asset.bounds.bottoms[a.row]:0,normalError:V.Distance(normal,new V(hx,-1,hz).normalize()),shadowY:entry.shadow.position.y-expected.y};
 })`);
 for(const check of checks){
  expect(check.footError).toBeLessThan(.00001);expect(check.anchor).toBe(0);
  expect(check.normalError).toBeLessThan(.00001);expect(check.shadowY).toBeCloseTo(.045,5);
 }
});

test('late walk sheets join the current stride while paused and disposal rejects pending loads',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});let pending=0;
 await page.route('**/assets/pmd/**/Walk-Anim.png',async route=>{pending++;await held;await route.continue().catch(()=>{});});
 // reset waits for prewarming; wait only for the fixture to begin loading.
 await page.goto('/tests/browser/fixtures/locomotion.html');
 await expect.poll(()=>pending).toBeGreaterThan(0);release();
 await expect.poll(()=>page.evaluate(()=>!!(window as any).locomotion)).toBe(true);
 // A fresh isolated avatar lets its native sheet arrive after its travel sample.
 let releaseWalk!:()=>void;const walkHeld=new Promise<void>(resolve=>{releaseWalk=resolve;});
 await page.route('**/assets/pmd/0007/Walk-Anim.png',async route=>{await walkHeld;await route.continue().catch(()=>{});});
 await run(page,`g=>{
  const a=g.assets.create(7);g.late=a;
  a.update({x:0,z:0,facing:0,animation:'idle',size:2.8,trackTravel:true},0,0,0);
  a.update({x:.1,z:0,facing:0,animation:'walk',size:2.8,trackTravel:true},.02,0,0);
 }`);
 await page.waitForTimeout(150);
 const waiting=await run(page,'g=>g.late.inspect()');
 expect(waiting.visible).toBe(true);expect(waiting.resolved).not.toBe('Walk');
 releaseWalk();
 await expect.poll(()=>run(page,'g=>g.late.inspect().resolved')).toBe('Walk');
 const late=await run(page,'g=>g.late.inspect()');
 expect(late.visible).toBe(true);expect(late.requested).toBe('walk');expect(late.locomotion.walkTime).toBeGreaterThan(0);
 await page.waitForTimeout(100);expect(await run(page,'g=>g.late.inspect()')).toEqual(late);
 let releaseDisposed!:()=>void;const disposedHeld=new Promise<void>(resolve=>{releaseDisposed=resolve;});let disposePending=0;
 await page.route('**/assets/pmd/0008/*.png',async route=>{disposePending++;await disposedHeld;await route.continue().catch(()=>{});});
 await run(page,'g=>{g.late.dispose();const a=g.assets.create(8);a.dispose();}');
 await expect.poll(()=>disposePending).toBeGreaterThan(0);releaseDisposed();
 await page.waitForTimeout(200);
 expect(await run(page,'g=>g.late.inspect().visible')).toBe(false);expect(errors).toEqual([]);
});
