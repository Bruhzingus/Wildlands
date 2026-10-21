import {test,expect} from '@playwright/test';

test('damage numbers distinguish party sources and crits, merge hits and bound crowded fights',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('[data-starter="25"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await page.keyboard.press('Escape');await expect(page.locator('#resume-btn')).toBeVisible();
 const result=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  g.damageNumbers.dispose();
  // Clear any opening hits while preserving the production constructor.
  g.damageNumbers=new g.damageNumbers.constructor(g.scene,(x:number,z:number)=>g.world.height(x,z));
  const first=s.party[0];s.party=Array.from({length:6},(_,i)=>({...first,uid:i+1}));
  g.camera.alpha=-Math.PI/2;g.camera.beta=.82;g.camera.radius=24;
  g.camera.target.set(s.player.x,g.world.height(s.player.x,s.player.z)+2,s.player.z);g.scene.render();
  const hit=(sourceId:number,targetId:number,crit=false,amount=20)=>g.event({kind:'hit',damageTo:'enemy',sourceId,targetId,amount,x:s.player.x,z:s.player.z+2,shape:crit?'crit':'impact'});
  hit(1,100);hit(1,100);hit(1,100,true);hit(2,100);
  s.phase='playing';g.ui.update(s);s.phase='paused';g.damageNumbers.update(0,true);
  return g.damageNumbers.inspect();
 });
 expect(result).toHaveLength(3);
 expect(result.map((label:any)=>[label.slot,label.amount,label.crit])).toEqual([[0,40,false],[0,20,true],[1,20,false]]);
 expect(await page.locator('.damage-number').allTextContents()).toEqual(['40','20!','20']);
 await expect(page.locator('.party-damage-color')).toHaveCount(6);
 const visible=await page.locator('.damage-number').evaluateAll(nodes=>nodes.filter(node=>getComputedStyle(node).visibility==='visible').map(node=>{
  const rect=node.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom};
 }));
 expect(visible).toHaveLength(3);
 for(let i=1;i<visible.length;i++)expect(visible[i].bottom).toBeLessThanOrEqual(visible[i-1].top);
 await page.evaluate(()=>{(document.querySelector('#overlay') as HTMLElement).style.visibility='hidden';});
 await page.screenshot({path:'artifacts/browser/damage-numbers.png'});
 const bounded=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,s=g.sim.state;
  for(let i=0;i<1000;i++)g.event({kind:'hit',damageTo:'enemy',sourceId:i%6+1,targetId:i+200,amount:12345,x:s.player.x,z:s.player.z+2});
  g.damageNumbers.update(0);return g.damageNumbers.inspect();
 });
 expect(bounded.length).toBeLessThanOrEqual(18);
 for(let source=1;source<=6;source++)expect(bounded.filter((label:any)=>label.sourceId===source).length).toBeLessThanOrEqual(3);
 await page.evaluate(()=>{const g=(window as any).__WILDLANDS__;g.damageNumbers.update(.71);});
 await expect(page.locator('.damage-number')).toHaveCount(0);
 expect(errors).toEqual([]);
});
