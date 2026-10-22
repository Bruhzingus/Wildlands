import type {LootRarity,POI,RunState} from '../game/types.ts';

export const ECONOMY={chestBaseCost:45,chestCostIncrease:15,coinChance:.7,normalCoins:1,variantCoins:2,eliteCoins:12,
 itemDropChance:.002,eliteItemDropChance:.18,duplicateItemCoins:15,eliteRewardInterval:90} as const;

export function chestCost(state:RunState,poi:POI):number {
 return poi.price===undefined?0:Math.round(poi.price*CHEST_TIERS[chestRarity(state,poi)].cost)+(poi.uses??0)*ECONOMY.chestCostIncrease;
}

export const CHEST_TIERS={common:{cost:1,respawn:120,color:'#bad49a'},rare:{cost:1.6,respawn:180,color:'#72baff'},epic:{cost:2.4,respawn:240,color:'#cf95ff'}} as const;
export const SHRINE={respawn:240,retry:60} as const;
export const LOOT_RARITIES:readonly LootRarity[]=['common','rare','epic'];
/** A stocked chest keeps its advertised tier until its next restock. */
export function chestRarity(_state:{stats:{elapsed:number}},poi:POI):LootRarity {
 return poi.rarity??'common';
}
/** Refill with a fresh tier; later runs lean toward rarer treasure. */
export function restockChestRarity(elapsed:number,roll:number):LootRarity {
 const progress=Math.min(1,Math.max(0,elapsed)/900),epic=.15+.2*progress,rare=.3+.1*progress;
 return roll<epic?'epic':roll<epic+rare?'rare':'common';
}
export function shrineTier(_state:RunState,poi:POI):number {
 return poi.challenge?.tier??poi.shrineTier??1;
}
