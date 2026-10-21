import {getSpecies} from './kanto.ts';
import {getEnemySpeciesProfile} from './enemySpecies.ts';
import type {Variant} from '../game/types.ts';

/** Encounter ranks are independent of an evolution's authored combat stats. */
export type EnemyTier=1|2|3|4|5;

/** Shared budgets for the encounter director and the enemies it creates. The
 * ordinary population stays in tiers 1/2; these rolls introduce individual
 * minibosses among it rather than replacing it with a stronger wave. */
export const ENEMY_TIER_TUNING={
 tier3:{
  earliestSeconds:360,fullChanceSeconds:840,initialChance:.01,lateChance:.07,
  minimumSpacingSeconds:18,maxAlive:3,
  healthMultiplier:4,minimumHealth:900,healthPerSecond:4,
  damageMultiplier:1.15,sizeMultiplier:1.12,
 },
 tier4:{
  earliestSeconds:780,fullChanceSeconds:900,initialChance:.0005,lateChance:.003,
  minimumSpacingSeconds:60,maxAlive:1,
  healthMultiplier:10,minimumHealth:3500,healthPerSecond:9,
  damageMultiplier:1.35,sizeMultiplier:1.22,
 },
 attacks:{thirdAttackSeconds:840,thirdAttackStrength:8,fourthAttackSeconds:1080,fourthAttackStrength:9.5,hardShrineFourthAttackStrength:8},
} as const;

/** Stage-three evolutions are minibosses even when their natural strength is
 * modest. Strong two-stage final forms and strong standalone species join them;
 * a strong middle evolution still belongs in the ordinary tier-two population. */
export function speciesEnemyTier(speciesId:number):EnemyTier {
 if(speciesId===150)return 5;
 if(speciesId===144||speciesId===145||speciesId===146||speciesId===151)return 4;
 const species=getSpecies(speciesId),strength=getEnemySpeciesProfile(speciesId).strength;
 if(species.stage>=3||(!species.evolvesTo.length&&strength>=6))return 3;
 return species.stage>=2||strength>=3.5?2:1;
}

/** Variants of a miniboss belong to the scarce, late elite population. */
export function getEnemyTier(speciesId:number,variant:Variant='normal',boss=false):EnemyTier {
 if(boss)return 5;
 const tier=speciesEnemyTier(speciesId);
 return tier===3&&variant!=='normal'?4:tier;
}

/** Number of distinct attacks an enemy may carry, never simultaneous casts.
 * Four-attack ordinary elites are an endless-run threat. Very hard shrines can
 * deliberately opt into that challenge before the ordinary encounter window. */
export function enemyAttackLimit(tier:EnemyTier,elapsed:number,strength:number,hardShrine=false):number {
 if(tier===5)return 4;
 if(tier<=2)return 1;
 if(tier===3)return 2;
 const tuning=ENEMY_TIER_TUNING.attacks;
 if((hardShrine&&strength>=tuning.hardShrineFourthAttackStrength)||
  (elapsed>=tuning.fourthAttackSeconds&&strength>=tuning.fourthAttackStrength))return 4;
 if(elapsed>=tuning.thirdAttackSeconds&&strength>=tuning.thirdAttackStrength)return 3;
 return 2;
}
