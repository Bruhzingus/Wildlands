/** Diagnostic contact sheets for the actual authored shrine sculpture sources. */
import {chromium} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const output=resolve('artifacts/art-polish/statues');await mkdir(output,{recursive:true});
const browser=await chromium.launch({...(existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?{channel:'chrome'}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:420,height:420},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/?dev=1');await page.locator('[data-starter="7"]').click();
 const ids=await page.evaluate(async()=>{
  const g=window.__WILDLANDS__,{SHRINE_SPECIES}=await import('/src/data/shrines.ts');
  const {createShrineStatue}=await import('/src/game/render/ShrineStatues.ts');
  const {createShrinePlinth}=await import('/src/game/render/ShrinePlinth.ts');
  g.engine.stopRenderLoop();g.engine.setHardwareScalingLevel(1);
  for(const element of document.body.children)if(element.id!=='renderCanvas'&&element.tagName!=='SCRIPT')element.style.display='none';
  const canvas=document.getElementById('renderCanvas');document.body.appendChild(canvas);canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%';g.engine.resize();
  for(const mesh of g.scene.meshes)mesh.setEnabled(false);
  const stone=g.scene.getMaterialByName('weathered statue stone'),carving=g.scene.getMaterialByName('statue carvings');
  const species=[...new Set(SHRINE_SPECIES.flat())],statues=species.map(id=>createShrineStatue(g.scene,id,stone,carving));
  for(const statue of statues)statue.isVisible=false;
  const plinth=createShrinePlinth(g.scene,stone);plinth.position.y=.325;
  g.camera.lowerRadiusLimit=null;g.camera.upperRadiusLimit=null;g.camera.beta=1.11;g.camera.radius=9;g.camera.target.set(0,2.3,0);
  g.scene.fogDensity=0;g.scene.spritesEnabled=false;g.world.setAtmospherePreview(0);
  window.__STATUE_REVIEW__={g,statues,plinth};g.engine.runRenderLoop(()=>g.scene.render());return species;
 });
 const report=[];
 for(let index=0;index<ids.length;index++){
  const info=await page.evaluate(index=>{
   const q=window.__STATUE_REVIEW__;for(const mesh of q.statues)mesh.isVisible=false;
   const statue=q.statues[index];statue.isVisible=true;statue.computeWorldMatrix(true);
   const box=statue.getBoundingInfo().boundingBox,width=box.maximumWorld.x-box.minimumWorld.x,depth=box.maximumWorld.z-box.minimumWorld.z;
   q.g.camera.radius=Math.max(8.9,width*1.73,depth*1.73);q.g.camera.target.set((box.maximumWorld.x+box.minimumWorld.x)/2,2.3,0);
   return {speciesId:statue.metadata.speciesId,vertices:statue.getTotalVertices(),triangles:statue.getTotalIndices()/3,width,depth,submeshes:statue.subMeshes.length};
  },index);
  const views=[];
  for(const [name,alpha] of [['front',Math.PI/2],['oblique',Math.PI*.27],['reverse',-Math.PI/2]]){
   await page.evaluate(alpha=>{window.__STATUE_REVIEW__.g.camera.alpha=alpha;},alpha);
   await page.waitForFunction(()=>window.__STATUE_REVIEW__.g.scene.isReady());
   await page.waitForFunction(()=>{const q=window.__STATUE_REVIEW__,a=q.g.scene.getActiveMeshes();return a.data.slice(0,a.length).some(mesh=>q.statues.includes(mesh));});await page.waitForTimeout(50);
   const file=`${ids[index]}-${name}.png`;await page.screenshot({path:resolve(output,file)});views.push({name,file});
  }
  report.push({...info,views});
 }
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(resolve(output,'inventory.json'),JSON.stringify(report,null,2));
 for(let offset=0;offset<report.length;offset+=4){
  const rows=await Promise.all(report.slice(offset,offset+4).map(async entry=>`<section><h2>Species ${entry.speciesId} · ${entry.triangles} triangles</h2><div>${(await Promise.all(entry.views.map(async view=>`<figure><img src="data:image/png;base64,${(await readFile(resolve(output,view.file))).toString('base64')}"><figcaption>${view.name}</figcaption></figure>`))).join('')}</div></section>`));
  const sheet=await browser.newPage({viewport:{width:1260,height:900}});
  await sheet.setContent(`<style>body{margin:0;background:#243129;color:#e5e3cd;font:14px sans-serif}h2{margin:6px;font-size:16px}div{display:flex}figure{margin:0;width:420px}img{width:420px;height:420px}figcaption{padding:4px}section{border-bottom:2px solid #7a856b}</style><h1>Wildlands · actual shrine sculpture source geometry</h1>${rows.join('')}`);
  await sheet.screenshot({path:resolve(output,`sheet-${offset/4+1}.png`),fullPage:true});await sheet.close();
 }
 console.log(JSON.stringify({species:report.length,triangles:report.reduce((sum,s)=>sum+s.triangles,0),maxTriangles:Math.max(...report.map(s=>s.triangles)),errors}));
}finally{await browser.close();}
