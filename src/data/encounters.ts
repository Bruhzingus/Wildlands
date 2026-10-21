import {KANTO} from './kanto.ts';
import {getEnemySpeciesProfile} from './enemySpecies.ts';
import {ENEMY_TIER_TUNING,getEnemyTier,type EnemyTier} from './enemyTiers.ts';
import {LEGENDARY_SPECIES} from './rosterContent.ts';
import {variantThreat} from './variants.ts';
import type {Variant} from '../game/types.ts';
import {clamp} from '../utils/random.ts';
import type {RNG} from '../utils/random.ts';

export type SpeciesTier='early'|'mid'|'late';
const ordinary=KANTO.filter(species=>!LEGENDARY_SPECIES.includes(species.id));
/** Overlapping strength pools, never evolution-stage waves. The elapsed threat
 * window below controls which members actually arrive, including variants.
 * Legendary birds/Mew are scarce late elites; Mewtwo is the scheduled boss. */
export const ENCOUNTER_TABLES:Readonly<Record<SpeciesTier|'rare'|'boss',readonly number[]>>={
 early:ordinary.filter(species=>getEnemySpeciesProfile(species.id).strength<=4.6).map(species=>species.id),
 mid:ordinary.filter(species=>getEnemySpeciesProfile(species.id).strength<10).map(species=>species.id),
 late:ordinary.map(species=>species.id),
 rare:[144,145,146,151],boss:[150],
};
export const RARE_ENCOUNTER={earliestSeconds:ENEMY_TIER_TUNING.tier4.earliestSeconds,chance:.001} as const;
/** Variants and elites spend the same threat budget as natural species strength. */
export const ELITE_THREAT=2.5;
export function maximumEncounterThreat(elapsed:number):number{return 2.4+Math.max(0,elapsed)/85;}
export function encounterWeight(speciesId:number,elapsed:number,variant:Variant='normal'):number {
 const profile=getEnemySpeciesProfile(speciesId),time=Math.max(0,elapsed),threat=profile.strength+variantThreat(variant);
 const tier=getEnemyTier(speciesId,variant);
 if(tier>=3&&time<ENEMY_TIER_TUNING.tier3.earliestSeconds)return 0;
 if(tier>=4&&time<ENEMY_TIER_TUNING.tier4.earliestSeconds)return 0;
 const entry=clamp((maximumEncounterThreat(time)-threat)/.8,0,1);
 // A strength-1 wild Pokemon retires by 3:00; enhanced versions remain useful
 // longer. Freeze the lower window at 15:00 so endless retains a viable pool.
 const retirement=180+(threat-1)*100;
 const populationTime=Math.min(time,tier<=2?420:900);
 // Keep a tier-two population underneath the sparse miniboss rolls, including
 // in endless. Early prey still retires permanently rather than returning.
 const exit=tier>=3?1:clamp((retirement-populationTime)/90,0,1);
 const target=1.2+populationTime/105;
 return profile.rarity*entry*exit*exit*Math.exp(-.5*((threat-target)/1.65)**2);
}
export function tierEncounterChance(tier:3|4,elapsed:number):number {
 const tuning=tier===3?ENEMY_TIER_TUNING.tier3:ENEMY_TIER_TUNING.tier4;
 if(elapsed<tuning.earliestSeconds)return 0;
 return tuning.initialChance+(tuning.lateChance-tuning.initialChance)*clamp((elapsed-tuning.earliestSeconds)/(tuning.fullChanceSeconds-tuning.earliestSeconds),0,1);
}
export interface EncounterLimits {allowTier3?:boolean;allowTier4?:boolean;}
export function selectEncounter(rng:RNG,elapsed:number,tier?:SpeciesTier,allowRare=true,variant:Variant='normal',limits:EncounterLimits={}):{speciesId:number;rare:boolean} {
 const resolved=tier??(elapsed<180?'early':elapsed<660?'mid':'late');
 const rare=allowRare&&limits.allowTier4!==false&&resolved==='late'&&elapsed>=RARE_ENCOUNTER.earliestSeconds&&rng.next()<RARE_ENCOUNTER.chance;
 if(rare)return {speciesId:rng.pick(ENCOUNTER_TABLES.rare),rare:true};
 const buckets=new Map<EnemyTier,{speciesId:number;weight:number}[]>();
 for(const speciesId of ENCOUNTER_TABLES[resolved]){
  const category=getEnemyTier(speciesId,variant),weight=encounterWeight(speciesId,elapsed,variant);
  if(weight<=0||category===5)continue;
  const key=category<=2?2:category;
  const bucket=buckets.get(key)??[];bucket.push({speciesId,weight});buckets.set(key,bucket);
 }
 const rollTier=rng.next(),tier4Chance=limits.allowTier4!==false&&buckets.has(4)?tierEncounterChance(4,elapsed):0;
 const tier3Chance=limits.allowTier3!==false&&buckets.has(3)?tierEncounterChance(3,elapsed):0;
 const category=rollTier<tier4Chance?4:rollTier<tier4Chance+tier3Chance?3:2;
 const candidates=buckets.get(category)??[];
 const total=candidates.reduce((sum,candidate)=>sum+candidate.weight,0);
 let roll=rng.next()*total;
 for(const candidate of candidates){roll-=candidate.weight;if(roll<0)return {speciesId:candidate.speciesId,rare:false};}
 // A deliberately restricted debug tier can outlive its entire threat window.
 // Resume the live late pool rather than resurrecting retired weak enemies.
 if(resolved!=='late')return selectEncounter(rng,elapsed,'late',false,variant,limits);
 throw new Error(`No eligible ${variant} encounters at ${elapsed}s`);
}
