import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

test('crafted attack effects compile, freeze, recycle and produce a visual review sheet',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.setViewportSize({width:720,height:480});
 await page.goto('/tests/browser/fixtures/effects-gallery.html');
 await expect.poll(()=>page.evaluate(()=>Boolean((window as any).gallery))).toBe(true);
 await mkdir('artifacts/browser',{recursive:true});
 const frames:{name:string;image:string}[]=[];
 const groups=await page.evaluate(()=>(window as any).gallery.groups) as string[];
 for(const name of groups){
  await page.evaluate(name=>(window as any).gallery.show(name),name);
  await expect.poll(()=>page.evaluate(()=>{
   const {scene}= (window as any).gallery;scene.render();
   return scene.meshes.filter((m:any)=>m.isVisible&&m.isEnabled()).every((m:any)=>m.material.isReady(m.sourceMesh??m,Boolean(m.sourceMesh)));
  })).toBe(true);
  const frozen=await page.evaluate(()=>{
   const {scene,fx,state}=(window as any).gallery;
   const snapshot=()=>JSON.stringify(scene.meshes.filter((m:any)=>m.isEnabled()).map((m:any)=>[m.position.asArray(),m.rotation.asArray(),m.scaling.asArray(),m.instancedBuffers?.instanceColor]));
   const before=snapshot();fx.update(state,0);fx.update(state,0);return before===snapshot();
  });expect(frozen).toBe(true);
  frames.push({name,image:(await page.screenshot()).toString('base64')});
 }
 const html=`<!doctype html><meta charset="utf-8"><style>body{margin:12px;background:#172520}main{display:grid;grid-template-columns:repeat(3,480px);gap:12px}img{width:480px;height:320px}</style><main>${frames.map(f=>`<img alt="${f.name}" src="data:image/png;base64,${f.image}">`).join('')}</main>`;
 await writeFile('artifacts/browser/effects-polish.html',html);
 const sheet=await page.context().newPage();await sheet.setViewportSize({width:1488,height:1340});await sheet.setContent(html);
 await sheet.screenshot({path:'artifacts/browser/effects-polish.png',fullPage:true});await sheet.close();
 expect(errors).toEqual([]);
});
