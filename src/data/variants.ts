import {getSpecies} from './kanto.ts';
import {getEnemySpeciesProfile} from './enemySpecies.ts';
import {getEnemyTier} from './enemyTiers.ts';
import {clamp} from '../utils/random.ts';
import type {Enemy,Variant} from '../game/types.ts';

export type VariantCue='none'|'diamond'|'r'|'chevrons'|'droplets'|'crown';
export interface VariantDefinition {
 label:string;description:string;hp:number;damage:number;speed:number;animationSpeed:number;aggression:number;xp:number;
 /** Relative spawn weights interpolate over the first fifteen minutes. Bosses never enter this lottery. */
 spawnWeights:{opening:number;late:number};tint:readonly [number,number,number];cue:VariantCue;
 contactPoison?:{seconds:number;damagePerSecond:number};
}

/** Factions retain species typing; variants of miniboss species enter tier four. */
export const VARIANTS:Readonly<Record<Variant,VariantDefinition>>={
 normal:{label:'Wild',description:'Standard wild Pokémon.',hp:1,damage:1,speed:1,animationSpeed:1,aggression:1,xp:1,spawnWeights:{opening:1,late:.67},tint:[1,1,1],cue:'none'},
 dark:{label:'Dark',description:'Diamond marker · tougher and stronger; keeps its species types.',hp:1.5,damage:1.5,speed:1,animationSpeed:1.08,aggression:1.05,xp:1.5,spawnWeights:{opening:0,late:.10},tint:[.63,.70,.84],cue:'diamond'},
 rocket:{label:'Rocket',description:'R marker · tougher, stronger and more aggressive.',hp:1.7,damage:1.7,speed:1.03,animationSpeed:1.12,aggression:1.12,xp:1.7,spawnWeights:{opening:0,late:.08},tint:[.96,.72,.76],cue:'r'},
 rabid:{label:'Rabid',description:'Double chevron · fragile, fast and aggressive.',hp:.82,damage:1,speed:1.75,animationSpeed:1.6,aggression:1.2,xp:1.25,spawnWeights:{opening:0,late:.10},tint:[1,.70,.60],cue:'chevrons'},
 poisoned:{label:'Poisoned',description:'Droplet marker · contact poisons for 4.5 seconds.',hp:1.3,damage:1.3,speed:1,animationSpeed:.95,aggression:1,xp:1.3,spawnWeights:{opening:0,late:.05},tint:[.74,.96,.67],cue:'droplets',contactPoison:{seconds:4.5,damagePerSecond:1.6}},
 legendary:{label:'Legendary',description:'Crown marker · boss with telegraphed special attacks.',hp:5.5,damage:5.5,speed:1,animationSpeed:1,aggression:1,xp:1,spawnWeights:{opening:0,late:0},tint:[.94,.83,1],cue:'crown'},
};
export const SPAWN_VARIANTS=['normal','dark','rocket','rabid','poisoned'] as const;
export const VARIANT_VISUALS={maxVisible:72,maxPooledPerKind:24,range:42,size:.72,bossSize:1,sideGap:.36,headGap:.3} as const;
export type SpawnVariant=typeof SPAWN_VARIANTS[number];
export function getVariant(variant:Variant):VariantDefinition{return VARIANTS[variant];}
/** Combat modifiers count toward encounter progression, even on small species. */
export function variantThreat(variant:Variant):number {
 return {normal:0,poisoned:1,dark:1.65,rabid:1.3,rocket:2.2,legendary:8}[variant];
}
export function variantWeights(elapsed:number):Record<SpawnVariant,number>{
 const progress=clamp(elapsed/900,0,1);
 return Object.fromEntries(SPAWN_VARIANTS.map(variant=>{
  const {opening,late}=VARIANTS[variant].spawnWeights;return [variant,opening+(late-opening)*progress];
 })) as Record<SpawnVariant,number>;
}
/** Stronger species compensate for fewer encounters; opening prey and fixed boss
 * rewards keep their existing budgets. Instant XP and drops split this one total. */
export const ENCOUNTER_XP_MULTIPLIERS={tier3:18,tier4:36} as const;
export function variantRewardXP(enemy:Pick<Enemy,'speciesId'|'variant'|'elite'|'isBoss'>&Partial<Pick<Enemy,'combatTier'>>):number{
 const speciesReward=enemy.isBoss?1:1+clamp(getEnemySpeciesProfile(enemy.speciesId).strength-2.5,0,7.5)*.28;
 const tier=enemy.isBoss?5:enemy.combatTier??getEnemyTier(enemy.speciesId,enemy.variant);
 const encounterReward=tier===3?ENCOUNTER_XP_MULTIPLIERS.tier3:tier===4?ENCOUNTER_XP_MULTIPLIERS.tier4:1;
 return ((enemy.isBoss?90:enemy.elite?20:5)+getSpecies(enemy.speciesId).stage*2)*speciesReward*VARIANTS[enemy.variant].xp*encounterReward;
}
