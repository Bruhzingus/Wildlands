import {KANTO,getSpecies} from './kanto.ts';
import {getEnemySpeciesProfile} from './enemySpecies.ts';
import {ENEMY_TIER_TUNING,getEnemyTier,type EnemyTier} from './enemyTiers.ts';
import {LEGENDARY_SPECIES} from './rosterContent.ts';
import {variantThreat} from './variants.ts';
import type {Variant} from '../game/types.ts';
import {clamp} from '../utils/random.ts';
import type {RNG} from '../utils/random.ts';
import type {Element} from './kanto.ts';
import {BOSS_RULES} from './director.ts';
import {getMapDefinition,type MapId} from './maps.ts';

export type SpeciesTier='early'|'mid'|'late';
const ordinary=KANTO.filter(species=>!LEGENDARY_SPECIES.includes(species.id));
export const ENCOUNTER_TABLES:Readonly<Record<SpeciesTier|'rare'|'boss',readonly number[]>>={
 early:ordinary.filter(species=>getEnemySpeciesProfile(species.id).strength<=4.6).map(species=>species.id),
 mid:ordinary.filter(species=>getEnemySpeciesProfile(species.id).strength<10).map(species=>species.id),
 late:ordinary.map(species=>species.id),rare:[144,145,146,151],boss:[150],
};
export const RARE_ENCOUNTER={earliestSeconds:ENEMY_TIER_TUNING.tier4.earliestSeconds,chance:.001} as const;
export const ELITE_THREAT=2.5;
export function maximumEncounterThreat(elapsed:number):number{return 2.4+Math.max(0,elapsed)/85;}
export function encounterWeight(speciesId:number,elapsed:number,variant:Variant='normal'):number {
 const profile=getEnemySpeciesProfile(speciesId),time=Math.max(0,elapsed),threat=profile.strength+variantThreat(variant);
 const tier=getEnemyTier(speciesId,variant);
 if(tier>=3&&time<ENEMY_TIER_TUNING.tier3.earliestSeconds)return 0;
 if(tier>=4&&time<ENEMY_TIER_TUNING.tier4.earliestSeconds)return 0;
 const entry=clamp((maximumEncounterThreat(time)-threat)/.8,0,1),retirement=180+(threat-1)*100;
 const populationTime=Math.min(time,tier<=2?420:900),exit=tier>=3?1:clamp((retirement-populationTime)/90,0,1);
 const target=1.2+populationTime/105;
 return profile.rarity*entry*exit*exit*Math.exp(-.5*((threat-target)/1.65)**2);
}
export function tierEncounterChance(tier:3|4,elapsed:number):number {
 const tuning=tier===3?ENEMY_TIER_TUNING.tier3:ENEMY_TIER_TUNING.tier4;
 if(elapsed<tuning.earliestSeconds)return 0;
 return tuning.initialChance+(tuning.lateChance-tuning.initialChance)*clamp((elapsed-tuning.earliestSeconds)/(tuning.fullChanceSeconds-tuning.earliestSeconds),0,1);
}
export interface EncounterLimits {allowTier3?:boolean;allowTier4?:boolean;}
export type BossPattern='volley'|'psychicRing'|'summon';
export type BossEncounterId='mewtwo'|'moltres';
export interface BossStage {threshold:number;label:string;patterns:readonly BossPattern[];shots?:number;spread?:number;summonCount?:number;}
export interface EncounterDefinition {
 id:string;favoredSpecies:readonly number[];weight:number;guardians:readonly number[];
 boss:{speciesId:number;name:string;element:Element;color:string;patterns:readonly BossPattern[];moves:Record<BossPattern,string>;summons:readonly number[];
  rules:{[K in keyof typeof BOSS_RULES]:number};shots:number;spread:number;warning:string;};
}
export const ENCOUNTER_DEFINITIONS:Readonly<Record<'wildlands'|'volcanic',EncounterDefinition>>={
 wildlands:{id:'wildlands',favoredSpecies:[],weight:0,guardians:[26,38,59,65,76,94,112,130,143],
  boss:{speciesId:150,name:'Mewtwo',element:'psychic',color:'#c6a2dc',patterns:['volley','psychicRing','summon'],moves:{volley:'Psystrike',psychicRing:'Psychic',summon:'Teleport'},summons:[64,67,93,97],rules:BOSS_RULES,shots:7,spread:.18,warning:'A psychic presence approaches — Mewtwo awakens at 15:00'}},
 volcanic:{id:'volcanic',favoredSpecies:[4,5,6,37,38,58,59,74,75,76,77,78,95,111,112,126],weight:.55,guardians:[38,59,76,78,95,112,126],
  boss:{speciesId:146,name:'Moltres',element:'fire',color:'#f2ae6d',patterns:['volley','summon','psychicRing','volley'],moves:{volley:'Ember Fan',psychicRing:'Solar Flare',summon:'Ashen Flock'},summons:[5,37,77,126],
   rules:{...BOSS_RULES,volleyWindup:1,ringWindup:1.4,volleyCooldown:2.65,ringSpeed:6.6,ringMaxRadius:33,ringWidth:1.4,volleySpeed:9,volleyDamage:16,summonCount:3,speed:3.3},shots:9,spread:.22,warning:'Heat gathers above the ridge — Moltres descends at 15:00'}},
};
/** Boss identity, stage rhythm and scheduling are content data rather than map flags. */
export type BossEncounterDefinition=EncounterDefinition['boss']&{id:BossEncounterId;stages:readonly BossStage[];};
export const BOSS_ENCOUNTERS:Readonly<Record<BossEncounterId,BossEncounterDefinition>>={
 mewtwo:{id:'mewtwo',...ENCOUNTER_DEFINITIONS.wildlands.boss,stages:[
  {threshold:1,label:'Mind games',patterns:['volley','psychicRing','summon','volley']},
  {threshold:.5,label:'Psychic storm',patterns:['psychicRing','volley','summon','psychicRing'],shots:9,spread:.23,summonCount:3},
 ]},
 moltres:{id:'moltres',...ENCOUNTER_DEFINITIONS.volcanic.boss,stages:[
  {threshold:1,label:'Ashen flight',patterns:['volley','summon','psychicRing','volley']},
  {threshold:.5,label:'Firestorm',patterns:['psychicRing','volley','summon','volley'],shots:11,spread:.25,summonCount:2},
 ]},
};
export const bossEncounter=(id:BossEncounterId)=>BOSS_ENCOUNTERS[id];
/** First chapter follows the selected map; later chapters alternate, with no overlap. */
export function scheduledBossEncounter(mapId:MapId|undefined,round:number):BossEncounterDefinition {
 const initial=mapEncounter(mapId).boss.speciesId===146?'moltres':'mewtwo';
 return BOSS_ENCOUNTERS[round%2===0?initial:(initial==='mewtwo'?'moltres':'mewtwo')];
}
export const mapEncounter=(mapId?:MapId)=>ENCOUNTER_DEFINITIONS[getMapDefinition(mapId).encounterId];

/** The fifth argument also accepts a map ID for the original map-aware API. */
export function selectEncounter(rng:RNG,elapsed:number,tier?:SpeciesTier,allowRare=true,variantOrMap:Variant|MapId='normal',limits:EncounterLimits={},mapId?:MapId):{speciesId:number;rare:boolean} {
 const map=variantOrMap==='wildlands'||variantOrMap==='pinewood-route'||variantOrMap==='ruins-route'||variantOrMap==='volcanic-ridge'?variantOrMap:mapId;
 const variant:Variant=map===variantOrMap?'normal':variantOrMap as Variant;
 const resolved=tier??(elapsed<180?'early':elapsed<660?'mid':'late');
 const rare=allowRare&&limits.allowTier4!==false&&resolved==='late'&&elapsed>=RARE_ENCOUNTER.earliestSeconds&&rng.next()<RARE_ENCOUNTER.chance;
 if(rare)return {speciesId:rng.pick(ENCOUNTER_TABLES.rare),rare:true};
 const encounter=mapEncounter(map),buckets=new Map<EnemyTier,{speciesId:number;weight:number}[]>();
 for(const speciesId of ENCOUNTER_TABLES[resolved]){
  if(speciesId===encounter.boss.speciesId)continue;
  if(map!==undefined&&resolved==='early'&&getSpecies(speciesId).stage!==1)continue;
  const category=getEnemyTier(speciesId,variant),weight=encounterWeight(speciesId,elapsed,variant);
  if(weight<=0||category===5)continue;
  const key=category<=2?2:category,bucket=buckets.get(key)??[];bucket.push({speciesId,weight});buckets.set(key,bucket);
 }
 const rollTier=rng.next(),tier4Chance=limits.allowTier4!==false&&buckets.has(4)?tierEncounterChance(4,elapsed):0;
 const tier3Chance=limits.allowTier3!==false&&buckets.has(3)?tierEncounterChance(3,elapsed):0;
 const category=rollTier<tier4Chance?4:rollTier<tier4Chance+tier3Chance?3:2,candidates=buckets.get(category)??[];
 const favored=candidates.filter(candidate=>encounter.favoredSpecies.includes(candidate.speciesId));
 const population=favored.length&&rng.next()<encounter.weight?favored:candidates,total=population.reduce((sum,candidate)=>sum+candidate.weight,0);
 let roll=rng.next()*total;
 for(const candidate of population){roll-=candidate.weight;if(roll<0)return {speciesId:candidate.speciesId,rare:false};}
 if(resolved!=='late')return selectEncounter(rng,elapsed,'late',false,variant,limits,map);
 throw new Error(`No eligible ${variant} encounters at ${elapsed}s`);
}
