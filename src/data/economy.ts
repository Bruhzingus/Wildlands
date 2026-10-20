import type {POI,RunState} from '../game/types.ts';

export const ECONOMY={chestBaseCost:45,chestCostIncrease:15,coinChance:.7,normalCoins:1,variantCoins:2,eliteCoins:12,
 itemDropChance:.002,eliteItemDropChance:.18,duplicateItemCoins:15,eliteRewardInterval:90} as const;

export function chestCost(state:RunState,poi:POI):number {
 return poi.price===undefined?0:poi.price+(state.chestPurchases??0)*ECONOMY.chestCostIncrease;
}
