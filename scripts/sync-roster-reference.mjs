import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
const base='https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';
const names=['pokemon_species','pokemon_species_names','pokemon_types','pokemon_types_past','types'];
function csv(text){
 const lines=text.trim().split(/\r?\n/),split=line=>(line.match(/("(?:[^"]|"")*"|[^,]*)(,|$)/g)||[]).slice(0,-1).map(cell=>cell.replace(/,$/,'').replace(/^"|"$/g,'').replace(/""/g,'"'));
 const header=split(lines.shift());return lines.map(line=>Object.fromEntries(split(line).map((value,index)=>[header[index],value])));
}
const sources=await Promise.all(names.map(async name=>{
 const url=`${base}${name}.csv`,response=await fetch(url);if(!response.ok)throw Error(`${url}: HTTP ${response.status}`);
 const text=await response.text();return {name,url,sha256:createHash('sha256').update(text).digest('hex'),rows:csv(text)};
}));
const data=Object.fromEntries(sources.map(source=>[source.name,source.rows]));
const typeNames=new Map(data.types.map(row=>[row.id,row.identifier]));
const english=new Map(data.pokemon_species_names.filter(row=>row.local_language_id==='9').map(row=>[row.pokemon_species_id,row.name]));
const species=data.pokemon_species.filter(row=>row.generation_id==='1'&&Number(row.id)<=151).map(row=>{
 const past=data.pokemon_types_past.filter(type=>type.pokemon_id===row.id),generation=past.length?Math.min(...past.map(type=>Number(type.generation_id))):null;
 const types=(generation===null?data.pokemon_types.filter(type=>type.pokemon_id===row.id):past.filter(type=>Number(type.generation_id)===generation)).sort((a,b)=>Number(a.slot)-Number(b.slot)).map(type=>typeNames.get(type.type_id));
 return {id:Number(row.id),name:english.get(row.id),types,parent:Number(row.evolves_from_species_id)>0&&Number(row.evolves_from_species_id)<=151?Number(row.evolves_from_species_id):null};
});
if(species.length!==151||species.some(row=>!row.name||!row.types.length))throw Error('Incomplete roster reference');
await mkdir(new URL('../tests/fixtures/',import.meta.url),{recursive:true});
await writeFile(new URL('../tests/fixtures/kanto-reference.json',import.meta.url),JSON.stringify({retrieved:new Date().toISOString(),note:'Gen 1 species and historical typing. Later-generation pre-evolutions excluded. Official game names are reference data; arcade loadouts are authored separately.',sources:sources.map(({name,url,sha256})=>({name,url,sha256})),species},null,2)+'\n');
console.log(`Cached ${species.length} original species and historical types from ${sources.length} PokeAPI source tables.`);
