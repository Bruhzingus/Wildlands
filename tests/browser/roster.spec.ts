import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

test('content QA loads every species with all six variants and shows live roles/evolution rules',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?dev=1');await page.locator('.asset-gallery summary').click();
 await page.locator('[data-all-variants]').click();await page.selectOption('[data-animation]','attack');
 const results:unknown[]=[];
 for(let id=1;id<=151;id++){
  await page.selectOption('.asset-gallery [data-species]',String(id));
  await expect.poll(()=>page.evaluate(()=>{
   const view=(window as any).__WILDLANDS_ASSETS__.inspect();
   return view.compareVariants&&view.actors.length===6&&view.actors.every((actor:any)=>actor.speciesId===view.speciesId&&actor.requested==='attack'&&actor.resolved==='Attack'&&actor.visible&&actor.width>0&&actor.height>0&&actor.source.includes('/assets/pmd/'));
  }),{timeout:12000,intervals:[20,50,100],message:`Species ${id}: all six actual variant sheets`}).toBe(true);
  const view=await page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.inspect());
  expect(view.actors.map((actor:any)=>actor.variant)).toEqual(['normal','dark','rocket','rabid','poisoned','legendary']);
  results.push({id,variants:view.actors.map((actor:any)=>({variant:actor.variant,resolved:actor.resolved,source:actor.source}))});
  if(id%25===0){await page.locator('.asset-gallery summary').click();await page.locator('.asset-gallery summary').click();}
 }
 await page.selectOption('.asset-gallery [data-species]','133');
 await expect(page.locator('[data-evolutions]')).toContainText('Water Stone card');
 await expect(page.locator('[data-evolutions]')).toContainText('Thunder Stone card');
 await expect(page.locator('[data-evolutions]')).toContainText('Fire Stone card');
 await page.selectOption('.asset-gallery [data-species]','64');await expect(page.locator('[data-evolutions]')).toContainText('Squad bond');
 await page.selectOption('.asset-gallery [data-species]','129');await expect(page.locator('[data-roster]')).toContainText('Splash Shot');
 await page.locator('[data-all-variants]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.inspect().actors.length)).toBe(8);
 await page.locator('.asset-gallery summary').click();
 expect(await page.evaluate(()=>(window as any).__WILDLANDS_ASSETS__.inspect().engineActive)).toBe(false);
 expect(errors).toEqual([]);await mkdir('artifacts/browser',{recursive:true});
 await writeFile('artifacts/browser/phase11-roster-variants.json',JSON.stringify({species:151,variantChecks:906,errors,results},null,2));
});
