import type {UpgradeChoice} from '../game/types.ts';

/** Recruitment gates remain in DESIGN. Evolution and upgrade tuning live here. */
export const PROGRESSION = {
 rerolls:{starting:2,intervalSeconds:300},
 leveling:{maxLevel:100,trainingFocusLevel:45,healthPerLevel:.02,powerPerLevel:.02,firstMilestone:3,milestoneInterval:5,xpBase:80,xpLinear:10,xpQuadratic:1.6},
 evolution: {firstLevel:5, finalLevel:10, twoStageLevel:12, maturitySeconds:170, twoStageMaturitySeconds:240, healthGain:.25, powerGain:.25, moveRankGain:1},
 moves: {maxRank:Infinity, soloMaxRank:Infinity, soloTrainingLevel:5, soloRankGain:2, learnedSlots:3,learnLevels:[10,20,30],newMoveOfferChance:.3,damagePerRank:.2,speedPerRank:.08,rangePerRank:.06,maxCastPacketsPerStep:32},
 rarityWeights: {common:55, uncommon:10, rare:35, epic:9.5, legendary:.5},
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
 training:'Add percentage stat bonuses with Common, Rare, Epic and very rare Legendary versions.',
 item:'Stack relic bonuses; each copy adds its stated benefit.',
} as const;

export interface TrainingUpgrade {
 id:string; stat:string; amount:number; title:string; description:string;
 rarity:UpgradeChoice['rarity'];
 amounts?:Partial<Record<UpgradeChoice['rarity'],number>>;
 rechargeReduction?:Partial<Record<UpgradeChoice['rarity'],number>>;
}

/** Authored rarity curves override the default progression; missing rarities are never offered. */
export const TRAINING_UPGRADES:readonly TrainingUpgrade[] = [
 {id:'power',stat:'power',amount:.08,amounts:{common:.08,rare:.15,epic:.25,legendary:.4},title:'Swords Dance',description:'+8% attack damage, including learned moves.',rarity:'common'},
 {id:'haste',stat:'haste',amount:.08,amounts:{common:.08,rare:.15,epic:.25,legendary:.4},title:'Tailwind',description:'+8% attack speed for every move. Attacks fire more often.',rarity:'common'},
 {id:'speed',stat:'speed',amount:.08,amounts:{common:.08,rare:.12,epic:.2,legendary:.35},rechargeReduction:{common:.05,rare:.1,epic:.15,legendary:.2},title:'Agility',description:'+8% leader movement speed.',rarity:'common'},
 {id:'health',stat:'health',amount:.1,amounts:{common:.1,rare:.2,epic:.3,legendary:.5},title:'HP Up',description:'+10% of base maximum HP for every squad member. Keeps current health percentages.',rarity:'common'},
 {id:'stamina',stat:'staminaCapacity',amount:1,amounts:{epic:1,legendary:3},title:'Endure',description:'+1 maximum stamina (dodge charge).',rarity:'epic'},
 {id:'special',stat:'specialHaste',amount:.25,title:'Calm Mind',description:'+25% special ability recharge speed.',rarity:'common'},
 {id:'wise-glasses',stat:'specialPower',amount:.1,amounts:{common:.1,uncommon:.2,rare:.3,epic:.5,legendary:1},title:'Wise Glasses',description:'+10% damage for your special ability. Only appears when your special can deal damage.',rarity:'common'},
 {id:'crit',stat:'crit',amount:.04,title:'Focus Energy',description:'+4% critical strike chance. Each full 100% guarantees another critical tier.',rarity:'common'},
 {id:'deflection',stat:'deflection',amount:.03,amounts:{common:.03,rare:.05,epic:.09,legendary:.15},title:'Deflection',description:'+3% chance to deflect attacks completely. Maximum 50%.',rarity:'common'},
 {id:'radius',stat:'radius',amount:.126,title:'Expanding Force',description:'+12.6% attack reach and area radius for every move.',rarity:'common'},
];

export const TRAINING_RARITY_MULTIPLIERS={common:1,uncommon:1.5,rare:2,epic:3,legendary:4} as const;

/** Explicit curves and availability are shared by offers, validation and catalogues. */
export function trainingVariants(upgrade:TrainingUpgrade):Array<{rarity:UpgradeChoice['rarity'];amount:number;rechargeReduction:number}> {
 return (Object.keys(TRAINING_RARITY_MULTIPLIERS) as Array<keyof typeof TRAINING_RARITY_MULTIPLIERS>).flatMap(rarity=>{
  const amount=upgrade.amounts?upgrade.amounts[rarity]:rarity==='uncommon'?undefined:upgrade.amount*TRAINING_RARITY_MULTIPLIERS[rarity];
  return amount===undefined?[]:[{rarity,amount:Number(amount.toFixed(4)),rechargeReduction:upgrade.rechargeReduction?.[rarity]??0}];
 });
}
export function trainingDescription(upgrade:TrainingUpgrade,rarity:UpgradeChoice['rarity']):string {
 const variant=trainingVariants(upgrade).find(entry=>entry.rarity===rarity);if(!variant)return '';
 const percent=(value:number)=>`${Number((value*100).toFixed(2))}%`;
 if(upgrade.stat==='staminaCapacity')return `+${variant.amount} maximum stamina (dodge ${variant.amount===1?'charge':'charges'}).`;
 const primary=upgrade.description.replace(/\d+(?:\.\d+)?%/,percent(variant.amount));
 return primary+(variant.rechargeReduction?` Stamina recharge takes ${percent(variant.rechargeReduction)} less time. Stacks multiplicatively.`:'');
}
