import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

test('all 151 species render all three states in the real eight-direction SpriteManager gallery',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?dev=1');await page.locator('.asset-gallery summary').click();
 const coverage=(await (await page.request.get('/assets/coverage-report.json')).json()).species;
 const representatives=await page.evaluate(async()=>{
  // Vite resolves the production gallery module in the browser.
  const module=await import('/src/ui/AssetGallery.ts');return module.REPRESENTATIVE_SPECIES as number[];
 });
 const screenshots:{id:number;name:string;state:string;image:string}[]=[],results:unknown[]=[];
 await mkdir('artifacts/browser',{recursive:true});
 for(let id=1;id<=151;id++){
  await page.selectOption('.asset-gallery [data-species]',String(id));
  for(const state of ['idle','walk','attack']){
   await page.selectOption('[data-animation]',state);
   const expected=coverage.find((s:any)=>s.id===id).animations[state];
   await expect.poll(()=>page.evaluate((expected:{sheet:string;columns:number;durations:number[]})=>{
    const d=(window as any).__WILDLANDS_ASSETS__.inspect();
    return d.actors.length===8&&d.actors.every((a:any)=>a.speciesId===d.speciesId&&a.requested===d.animation&&a.resolved===expected.sheet&&a.visible&&a.width>0&&a.height>0&&a.cellIndex===a.row*expected.columns+a.frame&&JSON.stringify(a.durations)===JSON.stringify(expected.durations));
   },expected),{timeout:12000,intervals:[20,50,100],message:`#${id} ${state} loads actual PMD sheet`}).toBe(true);
   const snapshot=await page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.inspect());
   expect(snapshot.actors.map((a:any)=>a.row)).toEqual([0,1,2,3,4,5,6,7]);
   expect(snapshot.actors.every((a:any)=>a.source.includes('/assets/pmd/'))).toBe(true);
   expect(snapshot.actors[0].durations).toEqual(expected.durations);
   expect(snapshot.actors.every((a:any)=>a.cellIndex===a.row*expected.columns+a.frame)).toBe(true);
   results.push({id,state,resolved:snapshot.actors[0].resolved,durations:snapshot.actors[0].durations,rows:snapshot.actors.map((a:any)=>a.row),size:[snapshot.actors[0].width,snapshot.actors[0].height]});
   if(representatives.includes(id)){
    const image=await page.locator('.asset-gallery canvas').screenshot();
    const name=await page.locator('.asset-gallery [data-species] option:checked').textContent();
    screenshots.push({id,name:name??String(id),state,image:image.toString('base64')});
   }
  }
  if(id%25===0){
   console.log(`Validated ${id}/151 species, ${results.length} requested states with source durations and 8 atlas rows`);
   await writeFile('artifacts/browser/asset-gallery-151-results.json',JSON.stringify({species:id,stateChecks:results.length,results},null,2));
   // Keep the audit's GPU cache bounded and exercise disposal repeatedly.
   await page.locator('.asset-gallery summary').click();await page.locator('.asset-gallery summary').click();
  }
 }
 await page.selectOption('.asset-gallery [data-species]','25');await page.selectOption('[data-animation]','walk');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.inspect().actors[0].resolved)).toBe('Walk');
 const initialFrame=await page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.inspect().actors[0].frame);
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.inspect().actors[0].frame)).not.toBe(initialFrame);
 await page.locator('[data-freeze]').click();
 const frozen=await page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.inspect().actors[0].frame);
 await page.waitForTimeout(200);expect(await page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.inspect().actors[0].frame)).toBe(frozen);
 await page.screenshot({path:'artifacts/browser/asset-gallery.png'});
 await page.locator('.asset-gallery summary').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.inspect().engineActive)).toBe(false);
 await page.locator('.asset-gallery summary').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.inspect().actors[0]?.resolved)).toBe('Walk');
 await page.locator('.asset-gallery summary').click();
 expect(errors).toEqual([]);
 await writeFile('artifacts/browser/asset-gallery-151-results.json',JSON.stringify({species:151,stateChecks:results.length,representativeScreenshots:screenshots.length,errors,results},null,2));
 const html=(items:typeof screenshots)=>`<!doctype html><style>body{background:#172015;color:#d8e3c7;font:12px monospace;margin:12px}main{display:grid;grid-template-columns:repeat(3,360px);gap:10px}figure{margin:0;background:#26301f;padding:5px}img{width:350px;height:119px;object-fit:contain;image-rendering:pixelated}figcaption{font-weight:bold}</style><main>${items.map(s=>`<figure><figcaption>${s.name} · ${s.state}</figcaption><img src="data:image/png;base64,${s.image}"></figure>`).join('')}</main>`;
 await writeFile('artifacts/browser/asset-contact-sheet.html',html(screenshots));
 const sheet=await page.context().newPage();await sheet.setViewportSize({width:1130,height:900});
 await sheet.setContent(html(screenshots));await sheet.screenshot({path:'artifacts/browser/asset-contact-sheet.png',fullPage:true});
 for(let i=0;i<3;i++){await sheet.setContent(html(screenshots.slice(i*36,(i+1)*36)));await sheet.screenshot({path:`artifacts/browser/asset-contact-sheet-${i+1}.png`,fullPage:true});}
 await sheet.close();
});

test('missing hosts retain visible generated actors without repeated requests or unhandled errors',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const requests=new Map<string,number>();
 await page.route(/\/assets\/(pmd|pokemon)\/|raw\.githubusercontent\.com\/(PMDCollab|PokeAPI)\//,route=>{
  const url=route.request().url();if(/\/0151\/|\/151\.png/.test(url))requests.set(url,(requests.get(url)??0)+1);return route.fulfill({status:404,body:'asset unavailable'});
 });
 await page.goto('/?dev=1');await page.locator('.asset-gallery summary').click();
 await page.selectOption('.asset-gallery [data-species]','151');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.inspect().actors.length)).toBe(8);
 await page.waitForTimeout(500);
 for(const state of ['walk','attack','idle','walk','attack']){await page.selectOption('[data-animation]',state);await page.waitForTimeout(70);}
 const first=[...requests.entries()];await page.waitForTimeout(500);expect([...requests.entries()]).toEqual(first);
 expect(first.length).toBeGreaterThan(0);expect(first.every(([,count])=>count===1)).toBe(true);
 const diagnostics=await page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.inspect());
 expect(diagnostics.actors.every((a:any)=>a.visible&&a.resolved==='artwork')).toBe(true);expect(errors).toEqual([]);
 expect(await page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.scene.getWaitingItemsCount())).toBe(0);
 await page.screenshot({path:'artifacts/browser/asset-generated-fallback.png'});
 await page.locator('.asset-gallery summary').click();expect(await page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.inspect().engineActive)).toBe(false);
});

test('closing during pending image requests releases gallery engines and scene work',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let pending=0;
 await page.route(/\/assets\/(pmd\/.*\.png|pokemon\/25\.png)/,async route=>{
  pending++;await new Promise(resolve=>setTimeout(resolve,500));await route.fulfill({status:404,body:'unavailable'}).catch(()=>{});
 });
 await page.goto('/?dev=1');const baseline=await page.evaluate(()=>(window as any).__WILDLANDS__.engine.constructor.Instances.length);
 for(let cycle=0;cycle<5;cycle++){
  const before=pending;await page.locator('.asset-gallery summary').click();
  await expect.poll(()=>pending).toBeGreaterThan(before);
  expect(await page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.scene.getWaitingItemsCount())).toBe(0);
  await page.locator('.asset-gallery summary').click();
  expect(await page.evaluate(()=>(window as any).__WILDLANDS__.engine.constructor.Instances.length)).toBe(baseline);
 }
 await page.waitForTimeout(600);expect(errors).toEqual([]);
});

test('asset gallery is absent without the explicit developer query flag',async({page})=>{
 await page.goto('/');await expect(page.locator('.asset-gallery')).toHaveCount(0);expect(await page.evaluate(()=>'__WILDLANDS_ASSETS__' in window)).toBe(false);
});
