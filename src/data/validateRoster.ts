import {KANTO,type Species} from './kanto.ts';
import {getAttackProfile,ATTACK_ARCHETYPES} from './attacks.ts';
import {ENCOUNTER_TABLES} from './encounters.ts';
import {SPECIES_COMBAT,LEGENDARY_SPECIES,type SpeciesCombat} from './rosterContent.ts';
import {memberDamage} from '../game/combat/damage.ts';
export interface RosterReference {id:number;name:string;types:string[];parent:number|null;}
export function validateRoster(reference:readonly RosterReference[],species:readonly Species[]=KANTO,combat:readonly SpeciesCombat[]=SPECIES_COMBAT):string[] {
 const issues:string[]=[],byId=new Map(species.map(row=>[row.id,row]));
 if(species.length!==151||byId.size!==151)issues.push('Roster must contain 151 unique species IDs');
 if(combat.length!==151||new Set(combat.map(row=>row.id)).size!==151)issues.push('Loadouts must contain 151 unique species IDs');
 const normalized=(name:string)=>name.replace(/[’']/g,"'");
 for(let id=1;id<=151;id++){
  const row=byId.get(id),expected=reference.find(row=>row.id===id),loadouts=combat.filter(row=>row.id===id);
  if(!row){issues.push(`Missing species ${id}`);continue;}
  if(!expected){issues.push(`Missing reference ${id}`);continue;}
  if(normalized(row.name)!==normalized(expected.name))issues.push(`#${id} name differs from original roster`);
  if(JSON.stringify(row.types)!==JSON.stringify(expected.types))issues.push(`#${id} historical Gen 1 types differ`);
  const parents=species.filter(parent=>parent.evolvesTo.includes(id)).map(parent=>parent.id);
  if(JSON.stringify(parents)!==JSON.stringify(expected.parent?[expected.parent]:[]))issues.push(`#${id} evolution parent differs`);
  if(row.stage!==1+(expected.parent?byId.get(expected.parent)?.stage??0:0))issues.push(`#${id} invalid evolution stage`);
  if(row.evolvesTo.some(target=>!byId.has(target)||target===id)||new Set(row.evolvesTo).size!==row.evolvesTo.length)issues.push(`#${id} invalid or duplicate evolution target`);
  if(loadouts.length!==1){issues.push(`#${id} missing or duplicate move entry`);continue;}
  const loadout=loadouts[0],move=loadout.moveName.trim().toLowerCase();
  // Shared move names are valid and resolve to the same mechanics for all users.
  if(!move||loadout.moveName!==row.moveName)issues.push(`#${id} empty, incorrect or duplicate authored move name for species`);
  if(!ATTACK_ARCHETYPES[loadout.attack]||loadout.attack!==row.attack||loadout.power<10||loadout.power>32||row.power<4||row.power>32)issues.push(`#${id} invalid arcade combat parameters`);
  if(row.recruitable!==(row.stage===1&&!LEGENDARY_SPECIES.includes(id)))issues.push(`#${id} invalid first-stage recruitment flag`);
 }
 const reachable=new Set(Object.values(ENCOUNTER_TABLES).flat());
 for(const id of byId.keys())if(!reachable.has(id))issues.push(`#${id} unreachable in enemy encounter tables`);
 for(const key of ['early','mid','late'] as const)if(ENCOUNTER_TABLES[key].some(id=>LEGENDARY_SPECIES.includes(id)))issues.push(`Legendary in ordinary ${key} pool`);
 // One-target cadence is a conservative lower bound; area/chain/projectile
 // signatures can improve crowd output further. Check both equal ranks.
 for(const parent of KANTO)for(const target of parent.evolvesTo)for(const rank of [1,8]){
  const child=KANTO.find(row=>row.id===target)!,a=getAttackProfile(parent.id,rank),b=getAttackProfile(target,rank);
  const output=(row:Species,profile:typeof a)=>memberDamage({speciesId:row.id,level:1,attackLevel:rank},0,0)*profile.damageScale/profile.cooldown;
  if(output(child,b)+1e-9<output(parent,a)*1.02)issues.push(`#${parent.id}→${target} rank ${rank} loses attack output`);
 }
 return issues;
}
