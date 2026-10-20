import type {LootRarity,POI,RunState} from '../game/types.ts';

export const ECONOMY={chestBaseCost:45,chestCostIncrease:15,coinChance:.7,normalCoins:1,variantCoins:2,eliteCoins:12,
 itemDropChance:.002,eliteItemDropChance:.18,duplicateItemCoins:15,eliteRewardInterval:90} as const;

export function chestCost(state:RunState,poi:POI):number {
 return poi.price===undefined?0:Math.round(poi.price*CHEST_TIERS[chestRarity(state,poi)].cost)+(poi.uses??0)*ECONOMY.chestCostIncrease;
}

export const CHEST_TIERS={common:{cost:1,respawn:120,color:'#bad49a'},rare:{cost:1.6,respawn:180,color:'#72baff'},epic:{cost:2.4,respawn:240,color:'#cf95ff'}} as const;
export const SHRINE={duration:90,radius:24,respawn:240,retry:60,recommendedLevel:8} as const;
export const LOOT_RARITIES:readonly LootRarity[]=['common','rare','epic'];
/** Restocks and elapsed time promote a site's tier, never downgrade it. */
export function chestRarity(state:{stats:{elapsed:number}},poi:POI):LootRarity {
 const base=LOOT_RARITIES.indexOf(poi.rarity??'common');
 return LOOT_RARITIES[Math.min(2,base+Math.floor(state.stats.elapsed/360)+Math.floor((poi.uses??0)/2))];
}
export function shrineTier(state:RunState,poi:POI):number {
 return 1+Math.floor(state.stats.elapsed/300)+(poi.uses??0);
}
