/** Live renderer review: normal gameplay framing plus explicitly marked closeups.
 * Run against Vite: node scripts/review-art-polish.mjs [output-directory]. */
import {chromium} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const output=resolve(process.argv[2]??'artifacts/art-polish');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({...(existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?{channel:'chrome'}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];
try{
 for(const map of ['wildlands','pinewood-route','ruins-route','volcanic-ridge']){
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/shader|compile|uniform|effect/i.test(message.text()))errors.push(message.text());});
  await page.addInitScript(()=>{Date.now=()=>4;localStorage.setItem('wildlands-controls-v1',JSON.stringify({graphicsQuality:'high',resolution:1,soundVolume:0,musicVolume:0}));});
  await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
  await page.goto('http://localhost:5173/?dev=1');
  await page.evaluate(()=>{const g=window.__WILDLANDS__;g.save.unlockedMaps=['wildlands','pinewood-route','ruins-route','volcanic-ridge'];g.ui.showTitle();});
  await page.locator('[data-run-map]').selectOption(map);await page.locator('[data-starter="25"]').click();
  await page.waitForFunction(()=>window.__WILDLANDS__.scene.isReady());
  await page.keyboard.press('Escape');await page.locator('#resume-btn').waitFor();
  await page.locator('#overlay').evaluate(element=>element.style.visibility='hidden');
  await page.evaluate(()=>{const g=window.__WILDLANDS__;g.sim.state.enemies=[];g.scene.skipFrustumClipping=false;});
  const views=[];
  for(const view of ['spawn','lake','lake-dusk','shrine','shrine-detail','sky','sky-dusk']){
   const info=await page.evaluate(async view=>{
    const g=window.__WILDLANDS__,s=g.sim.state,lake=g.world.profile.lake;
    const shrine=s.pois.find(p=>p.kind==='shrine'&&!p.availableAt);
    const p=view.startsWith('lake')?{x:lake.x,z:lake.z-lake.waterRadius-6}:view.startsWith('shrine')?{x:shrine.x,z:shrine.z-8}:{x:0,z:0};
    Object.assign(s.player,{...p,y:0});Object.assign(s.party[0],p);
    g.camera.target.set(p.x,g.world.height(p.x,p.z)+2,p.z);g.camera.alpha=-Math.PI/2;g.camera.beta=1.05;g.camera.radius=28;
    for(const mesh of g.scene.meshes)if(mesh.name.startsWith('health-track-')||mesh.name.startsWith('health-fill-'))mesh.isVisible=view!=='shrine-detail';
    if(view==='shrine-detail'){
     g.camera.lowerRadiusLimit=null;g.camera.upperRadiusLimit=null;g.camera.target.set(shrine.x,g.world.height(shrine.x,shrine.z)+2.1,shrine.z);g.camera.radius=11;g.camera.beta=1.18;
    }
    if(view.startsWith('sky')){g.camera.radius=48;g.camera.beta=1.43;g.camera.alpha=-0.65;}
    g.world.setAtmospherePreview(view.endsWith('dusk')?780:0);
    return {view,camera:[g.camera.alpha,g.camera.beta,g.camera.radius],resources:g.inspectPerformance().resources};
   },view);
   await page.waitForFunction(()=>window.__WILDLANDS__.scene.isReady());await page.waitForTimeout(180);
   await page.screenshot({path:resolve(output,`${map}-${view}.png`)});views.push(info);
  }
  reports.push({map,views,errors});
  if(errors.length)throw Error(`${map}: ${errors.join('\n')}`);
  await page.close();
 }
 await writeFile(resolve(output,'report.json'),JSON.stringify(reports,null,2));
 console.log(JSON.stringify(reports.map(({map,views,errors})=>({map,views:views.length,errors}))));
}finally{await browser.close();}
