/** Isolated, close-up review of the actual world geometries/materials. Gameplay
 * camera screenshots remain in the stage reports; these diagnostic views use a
 * fitted camera so tiny details can be inspected without changing game assets. */
import {chromium} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const baseURL=process.env.WILDLANDS_BASE_URL??'http://127.0.0.1:5173';
const output=resolve(process.env.WILDLANDS_ASSET_REVIEW_DIR??'artifacts/visual-overhaul/asset-review');
const expectPolished=process.env.WILDLANDS_ASSET_EXPECT_POLISHED==='1';
await mkdir(output,{recursive:true});
const sourceHashes={};
for(const file of ['src/data/maps.ts','src/game/render/World.ts','src/game/render/groundDetails.ts','src/game/render/LandmarkDressing.ts','src/game/render/terrainOrientation.ts','src/game/render/atmosphere.ts','src/game/render/terrainPalette.ts']){
 sourceHashes[file]=existsSync(file)?createHash('sha256').update(await readFile(file)).digest('hex'):null;
}
await writeFile(resolve(output,'capture.json'),JSON.stringify({baseRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHashes,
 conditions:{baseURL,viewport:[440,320],renderer:'Chrome SwiftShader',camera:'fitted diagnostic radius; gameplay beta 1.11; front/day, front/dusk, reverse/day',assets:'actual shared world geometry/materials, isolated from other scenery'}},null,2));
const browser=await chromium.launch({...(existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?{channel:'chrome'}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];
try{
 for(const mapId of ['wildlands','pinewood-route','ruins-route','volcanic-ridge']){
  const context=await browser.newContext({viewport:{width:440,height:320},deviceScaleFactor:1}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(`${baseURL}/?dev=1`);
  const setup=await page.evaluate(async mapId=>{
   const g=window.__WILDLANDS__,{World}=await import('/src/game/render/World.ts'),{worldProfile}=await import('/src/data/maps.ts');
   const {createPOIs,createEnvironment}=await import('/src/game/systems/environment.ts'),{createBerryTrees}=await import('/src/game/systems/berries.ts'),{treeVisual}=await import('/src/game/render/vegetation.ts');
   g.engine.stopRenderLoop();g.engine.setHardwareScalingLevel(1);
   for(const element of document.body.children)if(element.id!=='renderCanvas'&&element.tagName!=='SCRIPT')element.style.display='none';
   const canvas=document.getElementById('renderCanvas');document.body.appendChild(canvas);canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%';g.engine.resize();
   if(canvas.getBoundingClientRect().width<400)throw Error('Review canvas is hidden or incorrectly sized');
   const seed=worldProfile(4,mapId).definition.seed??4,pois=createPOIs(seed,mapId),layout=createEnvironment(seed,pois,mapId),berries=createBerryTrees(layout.props,seed),world=new World(g.scene,seed,pois,mapId,berries);
   world.update(0,pois,2,layout.features,berries);
   const terrain=g.scene.getMeshByName('rolling forest terrain'),groups=[];
   const group=(name,meshes,center)=>{if(meshes.length)groups.push({name,meshes,center});};
   const at=(prop,prefix)=>g.scene.meshes.filter(m=>prefix.some(p=>m.name.startsWith(p))&&Math.hypot(m.position.x-prop.x,m.position.z-prop.z)<.001);
   for(const family of ['pine','tiered','round','dead']){
    const prop=layout.props.find(p=>p.kind==='tree'&&!p.landmark&&!berries.some(b=>b.x===p.x&&b.z===p.z)&&treeVisual(seed,p.x,p.z,world.profile.definition.vegetation).family===family);
    if(!prop)continue;
    group(`${family}-tree`,family==='dead'?g.scene.meshes.filter(m=>(m.name.startsWith('dead-trunk-')||m.name.startsWith('dead-branch-'))&&Math.hypot(m.position.x-prop.x,m.position.z-prop.z)<1.05*prop.scale):at(prop,['trunk-','crown-']),prop);
   }
   const great=layout.props.find(p=>p.landmark&&p.kind==='tree');if(great)group('great-pine',at(great,['trunk-','great-pine-']),great);
   for(const [size,scale] of [['small',.65],['medium',1.05],['anchor',1.75]]){
    const prop=layout.props.find(p=>p.rockCluster!==undefined&&p.scale===scale);if(prop)group(`${size}-rock`,at(prop,['rock-']),prop);
   }
   for(const kind of ['bush','ruin']){const prop=layout.props.find(p=>p.kind===kind&&!p.landmark);if(prop)group(kind,at(prop,[`${kind}-`]),prop);}
   for(const kind of ['tuft','flower','mushroom','stump','chip']){
    const mesh=g.scene.getMeshByName(`ground-detail-${kind}`);if(mesh)group(kind,[mesh],null);
   }
   for(const [name,kind] of [['paver','paver'],['standing-stone','post'],['cache-stone','rock'],['grove-plant','plant']]){
    const mesh=g.scene.meshes.find(m=>m.metadata?.landmarkDressing&&m.name.includes(`-${kind}-`)&&m.isEnabled());if(mesh){const p=mesh.getAbsolutePosition();group(name,[mesh],{x:p.x,z:p.z});}
   }
   const tree=berries[0];
   // Berry entries reuse the real view after changing only this isolated QA tree.
   for(const id of ['oran','leppa','sitrus','pinap','silver-pinap'])groups.push({name:`${id}-berry-tree`,meshes:[],center:tree,berry:id});
   for(const kind of ['shrine','cache','grove']){
    const root=g.scene.transformNodes.find(n=>n.name.startsWith(`dressing-${kind}-`));
    if(root)group(`${kind}-setting`,root.getChildMeshes(),{x:root.position.x,z:root.position.z});
   }
   const originals=[...g.scene.meshes];for(const mesh of originals)mesh.isVisible=mesh===terrain;
   g.camera.lowerRadiusLimit=null;g.camera.upperRadiusLimit=null;g.camera.alpha=-Math.PI/2;g.camera.beta=1.11;
   const state={g,world,pois,layout,berries,tree,groups,originals,clones:[],terrain};window.__WORLD_ASSET_REVIEW__=state;
   g.engine.runRenderLoop(()=>g.scene.render());
   return {inventory:groups.map(({name})=>name),runtime:{bushTriangles:g.scene.getMeshByName('bush').getTotalIndices()/3,
    leafTriangles:g.scene.getMeshByName('berry leaf source').getTotalIndices()/3,stone:world.profile.definition.scenery.rock,
    plantLighting:g.scene.meshes.filter(m=>m.name.startsWith('ground-detail-')).every(m=>m.material.twoSidedLighting)}};
  },mapId);
  if(expectPolished&&(setup.runtime.bushTriangles!==80||setup.runtime.leafTriangles!==20||!setup.runtime.plantLighting))throw Error(`${mapId}: stale or incorrect browser asset modules: ${JSON.stringify(setup.runtime)}`);
  const assets=[];
  for(const name of setup.inventory){
   const info=await page.evaluate(name=>{
    const q=window.__WORLD_ASSET_REVIEW__,{g,world}=q;for(const mesh of q.clones)mesh.dispose();q.clones=[];
    const entry=q.groups.find(entry=>entry.name===name);let meshes=entry.meshes;
    if(entry.berry){
     q.tree.berry=entry.berry;world.update(0,q.pois,2,q.layout.features,q.berries);
     meshes=g.scene.meshes.filter(m=>m.isEnabled()&&(m.name.startsWith(`berry-tree-${q.tree.uid}-`)||m.name.startsWith(`berry-${q.tree.uid}-`)||m.name.startsWith(`berry-leaf-${q.tree.uid}-`)));
    }
    const center=entry.center,ground=center?world.height(center.x,center.z):0;
    for(const mesh of meshes){
     const source=mesh.sourceMesh??mesh,clone=source.clone(`review-${name}-${q.clones.length}`,{doNotCloneChildren:true,cloneThinInstances:false});
     clone.parent=null;clone.unfreezeWorldMatrix();clone.setEnabled(true);clone.isVisible=true;clone.visibility=1;
     if(center){
      mesh.computeWorldMatrix(true);mesh.getWorldMatrix().decompose(clone.scaling,clone.rotationQuaternion??=g.camera.absoluteRotation.clone(),clone.position);
      clone.position.x-=center.x;clone.position.z-=center.z;clone.position.y-=ground;
     }else{clone.position.set(0,0,0);clone.rotation.set(0,0,0);clone.rotationQuaternion=null;clone.scaling.setAll(1);}
     clone.computeWorldMatrix(true);clone.refreshBoundingInfo();q.clones.push(clone);
    }
    for(const mesh of q.originals)mesh.isVisible=mesh===q.terrain;
    const bounds=q.clones.map(m=>m.getBoundingInfo().boundingBox),min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
    for(const box of bounds)for(const axis of ['x','y','z']){min[axis]=Math.min(min[axis],box.minimumWorld[axis]);max[axis]=Math.max(max[axis],box.maximumWorld[axis]);}
    const height=max.y-min.y,width=Math.max(max.x-min.x,max.z-min.z),size=Math.max(height,width,.65);
    g.camera.target.set((min.x+max.x)/2,(min.y+max.y)/2,(min.z+max.z)/2);g.camera.radius=Math.max(2.2,size*2.05);
    return {name,height,width,parts:q.clones.length,vertices:q.clones.reduce((sum,m)=>sum+m.getTotalVertices(),0),triangles:q.clones.reduce((sum,m)=>sum+m.getTotalIndices()/3,0),
     materials:[...new Set(q.clones.map(m=>m.material?.name))],thinInstances:q.clones.reduce((sum,m)=>sum+(m.thinInstanceCount??0),0)};
   },name);
   if(info.thinInstances)throw Error(`${mapId}/${name}: QA clone retained world instance buffers`);
   if(!Number.isFinite(info.height)||!Number.isFinite(info.width)||info.width>30)throw Error(`${mapId}/${name}: invalid QA bounds`);
   const views=[];
   for(const [view,time,alpha] of [['day',0,-Math.PI/2],['dusk',900,-Math.PI/2],['reverse',0,Math.PI/2]]){
    await page.evaluate(({time,alpha})=>{const q=window.__WORLD_ASSET_REVIEW__;q.world.setAtmospherePreview(time);q.g.camera.alpha=alpha;},{time,alpha});
    await page.waitForFunction(()=>window.__WILDLANDS__.scene.isReady());
    await page.waitForFunction(()=>{const q=window.__WORLD_ASSET_REVIEW__,active=q.g.scene.getActiveMeshes();return active.data.slice(0,active.length).some(mesh=>q.clones.includes(mesh));});
    await page.waitForTimeout(30);
    const file=`${mapId}-${name}-${view}.png`;await page.screenshot({path:resolve(output,file)});views.push({view,file});
   }
   assets.push({...info,views});
  }
  reports.push({mapId,runtime:setup.runtime,assets,errors});await writeFile(resolve(output,'inventory.json'),JSON.stringify(reports,null,2));
  if(errors.length)throw Error(`${mapId}: ${errors.join(', ')}`);
  // Five asset rows per sheet keep every source visible at useful resolution.
  for(let offset=0;offset<assets.length;offset+=5){
   const rows=await Promise.all(assets.slice(offset,offset+5).map(async asset=>`<section><h2>${asset.name} · ${asset.parts} parts · ${asset.triangles} triangles</h2><div>${(await Promise.all(asset.views.map(async view=>`<figure><img src="data:image/png;base64,${(await readFile(resolve(output,view.file))).toString('base64')}"><figcaption>${view.view}</figcaption></figure>`))).join('')}</div></section>`));
   const sheet=await context.newPage();await sheet.setViewportSize({width:1320,height:900});await sheet.setContent(`<style>body{margin:0;background:#18251f;color:#eef2dd;font:14px sans-serif}h1,h2{margin:8px}h2{font-size:16px}section div{display:flex}figure{margin:0;width:440px}img{width:440px;height:320px}figcaption{padding:4px}section{border-bottom:2px solid #819079}</style><h1>${mapId} · isolated actual assets · fitted diagnostic camera</h1>${rows.join('')}`);
   await sheet.screenshot({path:resolve(output,`${mapId}-sheet-${offset/5+1}.png`),fullPage:true});await sheet.close();
  }
  console.log(`${mapId}: ${assets.length} assets, ${assets.length*3} diagnostic views, zero page errors`);await context.close();
 }
}finally{await browser.close();}
