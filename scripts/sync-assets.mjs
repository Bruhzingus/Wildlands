/** Optional local mirror. Rights and per-image creator credits remain with the sources. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseAnimationMetadata,PMD_SOURCE,ART_SOURCE} from '../src/game/render/animation.ts';
const dest=fileURLToPath(new URL('../public/assets/',import.meta.url));
const manifest=new Set(),failures=[],attributions=[];
let fetched=0,cached=0,index=1;
const isPNG=data=>data.length>24&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
async function save(url,relative,kind){
 const path=join(dest,relative);
 const valid=data=>kind==='png'?isPNG(data):kind==='xml'?!!parseAnimationMetadata(data.toString()):data.length>0;
 try{const data=await readFile(path);if(valid(data)){cached++;return data;}}catch{}
 for(let retry=0;retry<2;retry++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
   if(!response.ok){const error=Error(`HTTP ${response.status}`);error.permanent=response.status===404;throw error;}
   const data=Buffer.from(await response.arrayBuffer());if(!valid(data))throw Error('Invalid asset response');
   await mkdir(dirname(path),{recursive:true});await writeFile(path,data);fetched++;return data;
  }catch(error){
   if(retry===1||error.permanent){failures.push({url,reason:error.message});return;}
  }
 }
}
async function worker(){while(index<=151){
 const id=index++,code=String(id).padStart(4,'0'),base=`${PMD_SOURCE}/${code}`;
 const [xml,art,credits]=await Promise.all([
  save(`${base}/AnimData.xml`,`pmd/${code}/AnimData.xml`,'xml'),
  save(`${ART_SOURCE}/${id}.png`,`pokemon/${id}.png`,'png'),
  save(`${base}/credits.txt`,`pmd/${code}/credits.txt`,'text')
 ]);
 if(art)manifest.add(`pokemon/${id}.png`);
 if(credits)manifest.add(`${code}/credits.txt`);
 const metadata=xml?parseAnimationMetadata(xml.toString()):{};
 if(xml)manifest.add(`${code}/AnimData.xml`);
 const sheets=[...new Set(['Idle','Walk','Attack'].map(name=>metadata[name]?.name).filter(Boolean))];
 await Promise.all(sheets.map(async name=>{if(await save(`${base}/${name}-Anim.png`,`pmd/${code}/${name}-Anim.png`,'png'))manifest.add(`${code}/${name}-Anim.png`);}));
 attributions.push({id,pmdSource:`https://github.com/PMDCollab/SpriteCollab/tree/master/sprite/${code}`,artworkSource:`${ART_SOURCE}/${id}.png`,creditsSource:`${base}/credits.txt`,credits:credits?.toString().trim().split(/\r?\n/).map(line=>{const [date,creator,status,license,animations]=line.split('\t');return {date,creator,status,sourceNote:license,animations};})??[]});
 if(id%25===0)console.log(`${id}/151 species processed; ${fetched} downloaded, ${cached} cached`);
}}
await mkdir(dest,{recursive:true});
await Promise.all(Array.from({length:8},worker));
await save('https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/spritebot_credits.txt','pmd-creator-directory.txt','text');
await writeFile(join(dest,'manifest.json'),JSON.stringify([...manifest].sort(),null,2)+'\n');
await writeFile(join(dest,'asset-attributions.json'),JSON.stringify({
 sources:{pmd:'https://github.com/PMDCollab/SpriteCollab',pmdPolicy:'https://github.com/PMDCollab/SpriteCollab#submission-and-use-policy',format:'https://wiki.pmdo.pmdcollab.org/PMD_Sprite_Format',artwork:'https://github.com/PokeAPI/sprites',creatorDirectory:'pmd-creator-directory.txt'},
 rights:'Pokemon, official artwork and official PMD sprites retain their original rights holders (Nintendo / Creatures / GAME FREAK / The Pokemon Company / CHUNSOFT). Community submission terms require noncommercial use and attribution; these terms do not grant Pokemon IP permission.',
 species:attributions.sort((a,b)=>a.id-b.id)
},null,2)+'\n');
await writeFile(join(dest,'asset-download-report.txt'),`Downloaded: ${fetched}\nReused validated local files: ${cached}\nManifest files: ${manifest.size}\nMissing / failed requests: ${failures.length}\n${failures.map(f=>`${f.url}: ${f.reason}`).join('\n')}\n`);
console.log(`Done: ${manifest.size} validated manifest entries; ${failures.length} failed requests. Run npm run assets:audit for semantic animation coverage.`);
