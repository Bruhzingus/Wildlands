import {test,expect,type Page} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';

const savedRunKey='wildlands-suspended-run-v1';
const state=(page:Page)=>page.evaluate(()=>{
 const g=(window as any).__WILDLANDS__,s=g.sim?.state;
 return s?{phase:s.phase,elapsed:s.stats.elapsed,items:[...s.items],x:s.player.x,z:s.player.z,
  pois:s.pois.filter((p:any)=>p.used).map((p:any)=>({uid:p.uid,kind:p.kind,respawnAt:p.respawnAt})),games:g.save.games}:null;
});

test('saving downloads a portable run, rewinds recent rewards and preserves map cooldowns after reload',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="7"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 const original=await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,sim=g.sim,s=sim.state;
  const {ITEMS}=await (new Function('return import("/src/data/items.ts")')() as Promise<any>);
  const input={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
  s.itemUnlocks=undefined;
  const advance=(until:number)=>{
   while(s.stats.elapsed<until){
    s.enemies=[];s.projectiles=[];s.player.iframes=100;
    if(s.phase==='choice')sim.choose(s.upgradeChoices[0].id);
    sim.update(.04,input);
   }
  };
  const acquire=(id:string)=>{
   const item=ITEMS.find((entry:any)=>entry.id===id);
   sim.enterChoice([item],'Browser continuity check','cache');
   if(!sim.choose(item.id))throw new Error(`Failed to acquire ${id}`);
  };
  advance(10);acquire('leftovers');
  const chest=s.pois.find((p:any)=>p.kind==='cache'),shrine=s.pois.find((p:any)=>p.kind==='shrine');
  Object.assign(chest,{used:true,respawnAt:210});Object.assign(shrine,{used:true,respawnAt:270});
  s.player.x=8;s.player.z=-5;
  advance(55);acquire('echo-bell');advance(71);
  return {elapsed:s.stats.elapsed,x:s.player.x,z:s.player.z,poiIds:[chest.uid,shrine.uid],games:g.save.games};
 });
 await page.keyboard.press('Escape');await expect(page.locator('#suspend-btn')).toBeVisible();
 const downloading=page.waitForEvent('download');await page.locator('#suspend-btn').click();
 const download=await downloading;
 expect(download.suggestedFilename()).toMatch(/\.json$/);
 await mkdir('artifacts/browser',{recursive:true});await download.saveAs('artifacts/browser/suspended-run.json');
 const json=await readFile((await download.path())!,'utf8'),file=JSON.parse(json);
 expect(file.format).toBe('wildlands-suspended-run');expect(file.version).toBe(1);
 const snapshot=file.snapshot.state;
 expect(snapshot.stats.elapsed).toBeLessThanOrEqual(original.elapsed-30);
 expect(snapshot.stats.elapsed).toBeGreaterThan(original.elapsed-32);
 expect(snapshot.items).toContain('leftovers');expect(snapshot.items).not.toContain('echo-bell');
 await expect(page.locator('#resume-run-btn')).toBeVisible();
 expect(await page.evaluate(key=>localStorage.getItem(key)!==null,savedRunKey)).toBe(true);
 await page.reload();await page.locator('#resume-run-btn').click();
 await expect(page.locator('#resume-btn')).toBeVisible();
 const resumed=(await state(page))!;
 expect(resumed.phase).toBe('paused');expect(resumed.elapsed).toBeCloseTo(snapshot.stats.elapsed,8);
 expect(resumed.items).toContain('leftovers');expect(resumed.items).not.toContain('echo-bell');
 expect(resumed.x).toBeCloseTo(original.x,8);expect(resumed.z).toBeCloseTo(original.z,8);
 expect(resumed.pois.filter((p:any)=>original.poiIds.includes(p.uid))).toEqual(expect.arrayContaining([
  expect.objectContaining({kind:'cache',respawnAt:210}),expect.objectContaining({kind:'shrine',respawnAt:270}),
 ]));
 expect(resumed.games).toBe(original.games);
 expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();
 const frozen=await state(page);await page.waitForTimeout(150);expect(await state(page)).toEqual(frozen);
 await page.screenshot({path:'artifacts/browser/f5-restored-pause.png'});
 await page.locator('#resume-btn').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect.poll(async()=>(await state(page))!.elapsed).toBeGreaterThan(resumed.elapsed);
 await page.keyboard.press('Escape');await page.reload();
 await page.locator('#discard-run-btn').click();await expect(page.locator('#resume-run-btn')).toHaveCount(0);
 expect(await page.evaluate(key=>localStorage.getItem(key),savedRunKey)).toBeNull();
 await page.locator('#import-run').setInputFiles({name:'portable-run.json',mimeType:'application/json',buffer:Buffer.from(json)});
 await expect(page.locator('#resume-run-btn')).toBeVisible();
 const preserved=await page.evaluate(key=>localStorage.getItem(key),savedRunKey);
 await page.locator('#import-run').setInputFiles({name:'damaged-run.json',mimeType:'application/json',buffer:Buffer.from('{"format":"wildlands-suspended-run","version":999}')});
 await expect(page.locator('#run-file-status')).toContainText(/invalid|incompatible|damaged|unsupported|could not/i);
 expect(await page.evaluate(key=>localStorage.getItem(key),savedRunKey)).toBe(preserved);
 await page.locator('#resume-run-btn').click();await expect(page.locator('#resume-btn')).toBeVisible();
 expect((await state(page))!.elapsed).toBeCloseTo(snapshot.stats.elapsed,8);
 expect(errors).toEqual([]);
});

test('a defeat downloads minute-by-minute balancing data and reconciled damage attribution',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="7"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 const measured=await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,sim=g.sim,s=sim.state;
  const {ITEMS}=await (new Function('return import("/src/data/items.ts")')() as Promise<any>);
  const target=s.enemies[0];
  Object.assign(target,{speciesId:19,variant:'normal',hp:100000,maxHp:100000,damage:7,speed:0,stunTime:10000,attackCooldown:10000});
  const follower={...structuredClone(s.party[0]),uid:++s.idCounter,speciesId:16,hp:40,maxHp:40,joinedAt:s.stats.elapsed};
  s.party.push(follower);s.buffs.crit=.95;s.itemUnlocks=undefined;
  const acquire=(id:string)=>{
   const item=ITEMS.find((entry:any)=>entry.id===id);sim.enterChoice([item],'Browser report check','cache');
   if(!sim.choose(item.id))throw new Error(`Failed to acquire ${id}`);
  };
  for(let frame=0;frame<1625;frame++){
   s.enemies=[target];target.x=s.player.x+4;target.z=s.player.z;
   s.player.iframes=100;follower.iframes=100;
   if(frame===300)acquire('leftovers');if(frame===1000)acquire('echo-bell');
   if(frame===1400){follower.iframes=0;sim.hurtCompanion(follower,70,false,target.uid);}
   const special=frame===150||frame===650||frame===1150;if(special)s.player.specialCooldown=0;
   if(s.phase==='choice')sim.choose(s.upgradeChoices[0].id);
   sim.update(.04,{mx:0,mz:0,aimX:1,aimZ:0,jump:false,dodge:false,special,interact:false});
  }
  const hp=s.player.hp,damage=s.stats.damageDealt;
  s.player.iframes=0;sim.hurtPlayer(hp+25,false,true,true,target.uid);
  return {hp,damage,elapsed:s.stats.elapsed};
 });
 await expect(page.locator('#download-report-btn')).toBeVisible();
 await expect(page.locator('.damage-analysis')).toContainText(/damage|HP/i);
 const downloading=page.waitForEvent('download');await page.locator('#download-report-btn').click();
 const download=await downloading;
 expect(download.suggestedFilename()).toMatch(/balance.*\.json$/);
 await mkdir('artifacts/browser',{recursive:true});await download.saveAs('artifacts/browser/defeat-balancing-report.json');
 const report=JSON.parse(await readFile((await download.path())!,'utf8'));
 expect(report.format).toBe('wildlands-balancing-report');expect(report.version).toBe(1);expect(report.result).toBe('defeat');
 expect(report.elapsed).toBeCloseTo(measured.elapsed,8);
 expect(report.minuteSamples).toHaveLength(1);
 const minute=report.minuteSamples[0];expect(minute.at).toBe(60);expect(minute.windowSeconds).toBeCloseTo(60,0);
 expect(minute.dps.beforeCrits).toBeGreaterThan(0);expect(minute.dps.afterCrits).toBeGreaterThan(minute.dps.beforeCrits);
 expect(minute.dps.withAbility).toBeGreaterThan(minute.dps.afterCrits);
 expect(minute.build.estimatedDps.withAbility).toBeGreaterThan(minute.build.estimatedDps.afterCrits);
 expect(minute.build.items.map((item:any)=>item.id)).toEqual(expect.arrayContaining(['leftovers','echo-bell']));
 expect(minute.enemies.alive).toEqual(expect.arrayContaining([expect.objectContaining({speciesId:19,hpMax:100000,damageMax:7})]));
 expect(minute.director.spawnInterval).toBeGreaterThan(0);expect(minute.director.batchSize).toBeGreaterThan(0);
 const rewards=report.acquisitions.filter((entry:any)=>entry.kind==='item');
 expect(rewards.map((entry:any)=>entry.id)).toEqual(['leftovers','echo-bell']);
 expect(rewards[0].order).toBeLessThan(rewards[1].order);expect(rewards[0].at).toBeLessThan(rewards[1].at);
 const outgoing=report.outgoing.reduce((sum:number,row:any)=>sum+row.effective,0);
 const incoming=report.incoming.reduce((sum:number,row:any)=>sum+row.effective,0);
 expect(outgoing).toBeCloseTo(measured.damage,7);expect(outgoing).toBeCloseTo(report.totals.outgoing.effective,7);
 expect(incoming).toBeCloseTo(measured.hp+40,7);expect(incoming).toBeCloseTo(report.totals.incoming.effective,7);
 expect(report.totals.leaderIncoming.effective).toBeCloseTo(measured.hp,7);expect(report.totals.followerIncoming.effective).toBe(40);
 expect(report.totals.incoming.overkill).toBeGreaterThan(0);
 expect(report.outgoing.some((row:any)=>row.source.origin==='signature'&&row.source.name==='Squirtle')).toBe(true);
 expect(report.outgoing.some((row:any)=>row.source.origin==='q'&&row.source.move==='Surf')).toBe(true);
 expect(report.incoming.some((row:any)=>row.source.speciesId===19&&row.source.name==='Rattata')).toBe(true);
 expect(report.faints).toEqual(expect.arrayContaining([expect.objectContaining({speciesId:16,name:'Pidgey'})]));
 expect(report.recentHits.some((hit:any)=>hit.direction==='incoming'&&hit.hpAfter===0)).toBe(true);
 expect(report.sites.length).toBeGreaterThan(0);expect(report.finalPartialWindow.windowSeconds).toBeGreaterThan(0);
 await page.locator('.damage-analysis').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/browser/s4-results.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('.damage-analysis').scrollIntoViewIfNeeded();
 expect(await page.locator('#overlay-content').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);
 await page.screenshot({path:'artifacts/browser/s4-results-small.png'});
 expect(errors).toEqual([]);
});

test('a restored pending reward stays paused until Resume and grants its choice once',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="7"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 const json=await page.evaluate(async()=>{
  const g=(window as any).__WILDLANDS__,sim=g.sim;
  const {ITEMS}=await (new Function('return import("/src/data/items.ts")')() as Promise<any>);
  const {encodeRunFile}=await (new Function('return import("/src/game/runSnapshot.ts")')() as Promise<any>);
  sim.state.itemUnlocks=undefined;
  sim.enterChoice(ITEMS.filter((item:any)=>['leftovers','echo-bell'].includes(item.id)),'Pending saved cache','cache');
  const snapshot=sim.exportSnapshot(),account=snapshot.metadata.progression;
  return encodeRunFile(snapshot,{runId:account.runId,starterId:7,rocketKills:account.rocketKills,victoryRecorded:false});
 });
 await page.reload();
 await page.locator('#import-run').setInputFiles({name:'pending-choice.json',mimeType:'application/json',buffer:Buffer.from(json)});
 await page.locator('#resume-run-btn').click();await expect(page.locator('#resume-btn')).toBeVisible();
 expect((await state(page))!.items).toEqual([]);expect((await state(page))!.phase).toBe('paused');
 await page.locator('#resume-btn').click();await expect(page.locator('.choice-card')).toHaveCount(2);
 await expect(page.locator('.choice-screen')).toContainText('Pending saved cache');
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement)).toBeNull();
 const before=await state(page);await page.waitForTimeout(150);expect(await state(page)).toEqual(before);
 await page.locator('[data-choice="leftovers"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 expect((await state(page))!.items).toEqual(['leftovers']);
 expect(await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__;
  return {accepted:g.sim.choose('leftovers'),items:[...g.sim.state.items],games:g.save.games};
 })).toEqual({accepted:false,items:['leftovers'],games:0});
 expect(errors).toEqual([]);
});
