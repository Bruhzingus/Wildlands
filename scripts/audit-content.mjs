import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {validateRoster} from '../src/data/validateRoster.ts';
import {KANTO} from '../src/data/kanto.ts';
import {ENCOUNTER_TABLES} from '../src/data/encounters.ts';
import {parseAnimationMetadata,validateAtlas} from '../src/game/render/animation.ts';

export async function auditContent(){
 const reference=JSON.parse(await readFile(new URL('../tests/fixtures/kanto-reference.json',import.meta.url),'utf8'));
 const issues=validateRoster(reference.species),assets=[];
 const root=fileURLToPath(new URL('../public/assets/',import.meta.url));
 for(const species of KANTO){
  const code=String(species.id).padStart(4,'0'),row={id:species.id,name:species.name,animations:[],issues:[]};
  try{
   const metadata=parseAnimationMetadata(await readFile(join(root,'pmd',code,'AnimData.xml'),'utf8'));
   for(const state of ['Idle','Walk','Attack']){
    const meta=metadata[state];if(!meta)throw Error(`Missing ${state} metadata`);
    const png=await readFile(join(root,'pmd',code,`${meta.name}-Anim.png`));
    if(!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error(`${state}: invalid PNG signature`);
    const layout=validateAtlas(meta,png.readUInt32BE(16),png.readUInt32BE(20));
    row.animations.push({state,sheet:meta.name,frames:meta.durations.length,directions:layout.rows});
   }
   if(!(await readFile(join(root,'pmd',code,'credits.txt'),'utf8')).trim())throw Error('Missing creator credits');
  }catch(error){row.issues.push(error.message);issues.push(`#${species.id} asset: ${error.message}`);}
  assets.push(row);
 }
 return {species:KANTO.length,combatProfiles:KANTO.length,evolutionEdges:KANTO.reduce((total,row)=>total+row.evolvesTo.length,0),spawnReachable:new Set(Object.values(ENCOUNTER_TABLES).flat()).size,animations:assets.reduce((total,row)=>total+row.animations.length,0),issues,referenceSources:reference.sources,assets};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const report=await auditContent();await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
 await writeFile(new URL('../artifacts/content-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({species:report.species,profiles:report.combatProfiles,evolutionEdges:report.evolutionEdges,spawnReachable:report.spawnReachable,animations:report.animations,issues:report.issues},null,2));
 if(report.issues.length)process.exitCode=1;
}
