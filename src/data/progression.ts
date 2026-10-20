import type {UpgradeChoice} from '../game/types.ts';

/** Recruitment gates remain in DESIGN. Evolution and upgrade tuning live here. */
export const PROGRESSION = {
 evolution: {firstLevel:5, finalLevel:10, maturitySeconds:170, offerChance:.85, healthGain:.25, powerGain:.25},
 moves: {maxRank:8, soloMaxRank:8, soloCatchupSeconds:420, soloRankGain:1, learnedSlots:3, learnedMaxRank:8,damagePerRank:.2,speedPerRank:.08,rangePerRank:.06},
 rarityWeights: {common:70, rare:25, epic:5},
 luckRareScale:2, luckEpicScale:4,
} as const;

export const UPGRADE_TAXONOMY = {
 recruitment:'Add a first-stage teammate after the scheduled time and level gates.',
 evolution:'Change only the selected teammate into an explicitly named evolution.',
 move:'Train one of this Pokémon\'s four moves, or fill a free move slot with an independent attack.',
 training:'Stack a squad stat up to its listed rank limit.',
 item:'One copy of each passive item per run.',
} as const;

export interface TrainingUpgrade {
 id:string; stat:string; amount:number; title:string; description:string;
 rarity:UpgradeChoice['rarity']; maxRank:number;
}

/** Descriptions report additive changes, rather than compounded percentages. */
export const TRAINING_UPGRADES:readonly TrainingUpgrade[] = [
 {id:'power',stat:'power',amount:.24,title:'Swords Dance',description:'+24 percentage points of squad attack damage, including learned moves.',rarity:'common',maxRank:8},
 {id:'haste',stat:'haste',amount:.2,title:'Tailwind',description:'+20 percentage points of squad attack speed for every move.',rarity:'common',maxRank:6},
 {id:'speed',stat:'speed',amount:.12,title:'Agility',description:'+12 percentage points of movement speed.',rarity:'common',maxRank:4},
 {id:'health',stat:'health',amount:.2,title:'HP Up',description:'+20% of base maximum HP for the squad. Keeps current health percentages.',rarity:'common',maxRank:6},
 {id:'armor',stat:'damageReduction',amount:.08,title:'Iron Defense',description:'Reduce incoming damage by an additional 8% for the whole squad.',rarity:'common',maxRank:5},
 {id:'stamina',stat:'stamina',amount:.22,title:'Endure',description:'+22 percentage points of stamina recovery: dodge recharges faster.',rarity:'common',maxRank:5},
 {id:'special',stat:'specialHaste',amount:.25,title:'Calm Mind',description:'+25 percentage points of special ability recharge speed.',rarity:'common',maxRank:5},
 {id:'crit',stat:'crit',amount:.1,title:'Focus Energy',description:'+10 percentage points of critical strike chance.',rarity:'rare',maxRank:5},
 {id:'radius',stat:'radius',amount:.18,title:'Expanding Force',description:'+18 percentage points of attack reach and area radius for every move.',rarity:'rare',maxRank:5},
];
