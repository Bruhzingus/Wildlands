import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseAnimationMetadata,validateAtlas} from '../src/game/render/animation.ts';
import {getSpecies} from '../src/data/kanto.ts';
const root=fileURLToPath(new URL('../public/assets/',import.meta.url));
const docs=fileURLToPath(new URL('../docs/',import.meta.url));
await mkdir(root,{recursive:true});await mkdir(docs,{recursive:true});
let files=[];try{files=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));}catch{}
const set=new Set(files),rows=[];
async function png(path){
 const b=await readFile(path);
 if(b.length<24||!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Invalid PNG');
 return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
}
for(let id=1;id<=151;id++){
 const code=String(id).padStart(4,'0'),issues=[];let metadata={},staticArtwork=false,hasMetadata=false,credits=false;
 try{if(!set.has(`pokemon/${id}.png`))throw Error('not in manifest');await png(join(root,'pokemon',`${id}.png`));staticArtwork=true;}catch(error){issues.push(`artwork: ${error.message}`);}
 try{if(!set.has(`${code}/AnimData.xml`))throw Error('not in manifest');metadata=parseAnimationMetadata(await readFile(join(root,'pmd',code,'AnimData.xml'),'utf8'));hasMetadata=true;}catch(error){issues.push(`metadata: ${error.message}`);}
 try{credits=!!(await readFile(join(root,'pmd',code,'credits.txt'),'utf8')).trim();}catch{issues.push('missing creator credit file');}
 const animations={};
 for(const name of ['Idle','Walk','Attack']){
  const meta=metadata[name];
  if(!meta){animations[name.toLowerCase()]={available:false,reason:'not defined in metadata'};continue;}
  try{
   if(!set.has(`${code}/${meta.name}-Anim.png`))throw Error('sheet not in manifest');
   const size=await png(join(root,'pmd',code,`${meta.name}-Anim.png`)),layout=validateAtlas(meta,size.width,size.height);
   animations[name.toLowerCase()]={available:true,sheet:meta.name,frames:meta.durations.length,durations:meta.durations,cycleSeconds:meta.durations.reduce((a,b)=>a+b,0)/60,frameWidth:meta.width,frameHeight:meta.height,...size,...layout};
  }catch(error){animations[name.toLowerCase()]={available:false,sheet:meta.name,reason:error.message};issues.push(`${name}: ${error.message}`);}
 }
 rows.push({id,name:getSpecies(id).name,staticArtwork,metadata:hasMetadata,credits,generatedFallback:true,animations,issues});
}
const totals={species:151,staticArtwork:rows.filter(r=>r.staticArtwork).length,metadata:rows.filter(r=>r.metadata).length,credits:rows.filter(r=>r.credits).length,idle:rows.filter(r=>r.animations.idle.available).length,walk:rows.filter(r=>r.animations.walk.available).length,attack:rows.filter(r=>r.animations.attack.available).length,generatedFallback:151};
const output={totals,validation:'Manifest presence, readable files, PNG signatures and dimensions, metadata aliases, positive 60 Hz durations, frame columns and one/eight direction rows. Does not claim a human visual review of every sheet.',species:rows,missing:rows.filter(r=>!r.staticArtwork||Object.values(r.animations).some(a=>!a.available))};
await writeFile(join(root,'coverage-report.json'),JSON.stringify(output,null,2)+'\n');
const cell=a=>a.available?`${a.frames}f / ${a.rows} dirs${a.sheet.toLowerCase()!==''?' ('+a.sheet+')':''}`:`MISSING: ${a.reason}`;
await writeFile(join(docs,'ASSET_COVERAGE.md'),`# Kanto asset coverage\n\nReproduce with \`npm run assets:sync\` and \`npm run assets:audit\`. This report validates actual files, not just manifest names. Generated fallback visibility is provided by code for all 151 IDs. Browser verification is recorded in the implementation report separately.\n\n${Object.entries(totals).map(([key,value])=>`- ${key}: ${value}`).join('\n')}\n\nPMD timing follows [the source format](https://wiki.pmdo.pmdcollab.org/PMD_Sprite_Format): durations are 1/60 second; sheets may contain one or eight direction rows. Aliases refer to the original named sheet. Creator attribution and per-image source URLs are in [asset-attributions.json](../public/assets/asset-attributions.json); raw contributor records are mirrored alongside each species and the creator directory. Official Pokemon assets retain their original rights holders.\n\n| ID | Species | Art | Idle | Walk | Attack | Credits |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows.map(r=>`| ${r.id} | ${r.name} | ${r.staticArtwork?'yes':'missing'} | ${cell(r.animations.idle)} | ${cell(r.animations.walk)} | ${cell(r.animations.attack)} | ${r.credits?'yes':'missing'} |`).join('\n')}\n`);
console.table(totals);console.log(`${output.missing.length} species missing at least one requested asset. Reports: public/assets/coverage-report.json and docs/ASSET_COVERAGE.md`);
if(totals.staticArtwork!==151)console.warn('Missing local artwork uses remote artwork or generated fallback.');
if(rows.some(r=>r.issues.length))console.warn('Audit found file/metadata issues; see per-species issues.');
