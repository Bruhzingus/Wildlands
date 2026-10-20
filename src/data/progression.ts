import type {UpgradeChoice} from '../game/types.ts';

/** Recruitment gates remain in DESIGN. Evolution and upgrade tuning live here. */
export const PROGRESSION = {
 leveling:{maxLevel:100,trainingFocusLevel:45,healthPerLevel:.02,powerPerLevel:.02,firstMilestone:3,milestoneInterval:5,xpBase:80,xpLinear:10,xpQuadratic:1.6},
 evolution: {firstLevel:5, finalLevel:10, maturitySeconds:170, healthGain:.25, powerGain:.25, moveRankGain:1},
 moves: {maxRank:Infinity, soloMaxRank:Infinity, soloTrainingLevel:5, soloRankGain:2, learnedSlots:3,learnLevels:[10,20,30],newMoveOfferChance:.3,damagePerRank:.2,speedPerRank:.08,rangePerRank:.06,minimumCastInterval:.2,minimumLearnedCastInterval:.35},
 rarityWeights: {common:55, rare:35, epic:10},
 luckRareScale:2, luckEpicScale:4,
} as const;

export function isMilestone(level:number):boolean {
 return level===PROGRESSION.leveling.firstMilestone||level>=PROGRESSION.leveling.milestoneInterval&&level%PROGRESSION.leveling.milestoneInterval===0;
}
export function nextMilestone(level:number):number|null {
 const next=level<PROGRESSION.leveling.firstMilestone?PROGRESSION.leveling.firstMilestone:
  (Math.floor(level/PROGRESSION.leveling.milestoneInterval)+1)*PROGRESSION.leveling.milestoneInterval;
 return next<=PROGRESSION.leveling.maxLevel?next:null;
}
export function levelPowerMultiplier(level:number):number {
 return 1+Math.max(0,Math.min(PROGRESSION.leveling.maxLevel,level)-1)*PROGRESSION.leveling.powerPerLevel;
}

export const UPGRADE_TAXONOMY = {
 recruitment:'Add a first-stage teammate after the scheduled time and level gates.',
 evolution:'Change only the selected teammate into an explicitly named evolution.',
 move:'Train one of this Pokémon\'s four moves, or fill a free move slot with an independent attack.',
 training:'Keep stacking stats with stronger Common, Rare and Epic versions.',
 item:'One copy of each passive item per run.',
} as const;

export interface TrainingUpgrade {
 id:string; stat:string; amount:number; title:string; description:string;
 rarity:UpgradeChoice['rarity'];
}

/** Common values; Rare grants twice and Epic grants three times the bonus. */
export const TRAINING_UPGRADES:readonly TrainingUpgrade[] = [
 {id:'power',stat:'power',amount:.12,title:'Swords Dance',description:'+12% attack damage, including learned moves.',rarity:'common'},
 {id:'haste',stat:'haste',amount:.1,title:'Tailwind',description:'+10% attack speed for every move. Excess casting speed strengthens hits and healing.',rarity:'common'},
 {id:'speed',stat:'speed',amount:.12,title:'Agility',description:'+12% movement speed.',rarity:'common'},
 {id:'health',stat:'health',amount:.12,title:'HP Up',description:'+12% of base maximum HP for your Pokémon. Keeps current health percentages.',rarity:'common'},
 {id:'armor',stat:'damageReduction',amount:.08,title:'Iron Defense',description:'Take 8% less incoming damage. Repeated upgrades multiply together.',rarity:'common'},
 {id:'stamina',stat:'stamina',amount:.22,title:'Endure',description:'+22% stamina recovery: dodge recharges faster.',rarity:'common'},
 {id:'special',stat:'specialHaste',amount:.25,title:'Calm Mind',description:'+25% special ability recharge speed.',rarity:'common'},
 {id:'crit',stat:'crit',amount:.1,title:'Focus Energy',description:'+10% critical strike chance; chance above 100% becomes critical damage.',rarity:'common'},
 {id:'radius',stat:'radius',amount:.18,title:'Expanding Force',description:'+18% attack reach and area radius for every move.',rarity:'common'},
];

export const TRAINING_RARITY_MULTIPLIERS={common:1,rare:2,epic:3} as const;
