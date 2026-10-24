import type {Element} from './kanto.ts';
import type {UpgradeChoice} from '../game/types.ts';

/** Percentage bonuses add against the base stat; flat amounts retain their units. */
export type BuildStat='staminaRechargeReduction'|'defense'|'deflection'|'staminaCapacity'|'critDamagePercent'|'power'|'specialPower'|'haste'|'speed'|'armor'|'damageReduction'|'xp'|'xpCatchup'|'critChance'|'critDamage'|'radius'|'magnet'|'specialHaste'|'stamina'|'regeneration'|'partyRegeneration'|'regenerationPercent'|'partyRegenerationPercent'|'projectiles'|'pierce'|'chains'|'projectileSpeed'|'duration';
export interface StatModifier {
 stat:BuildStat;amount:number;scale?:'party';evolution?:'unevolved'|'evolved';healthBelow?:number;
}
export type BuildEventKind='onAttack'|'onCrit'|'onHit'|'onDeath'|'onSpecial'|'onRecruit'|'onEvolve';
export type BuildStatus='stun'|'slow'|'poison'|'burn'|'soaked';
export type EffectAction=
 |{kind:'echo';damageScale:number}
 |{kind:'chain';damage?:number;damageScale?:number;jumps:number;range:number;element?:Element}
 |{kind:'area';damage?:number;damageScale?:number;radius:number;element?:Element}
 |{kind:'heal';amount:number;maxHpFraction?:number;target:'leader'|'squad'}
 |{kind:'selfDamage';amount:number}
 |{kind:'status';status:BuildStatus;duration:number}
 |{kind:'xp';amount:number}
 |{kind:'specialCharge';amount:number}
 |{kind:'specialCooldownPercent';amount:number};
export interface EffectRule {
 event:BuildEventKind;action:EffectAction;chance?:number;every?:number;cooldown?:number;
 /** Source counters belong to one attacker; squad counters combine all attacks. */
 counter?:'source'|'squad';element?:Element;targetStatus?:BuildStatus;maxDepth?:number;
}
export interface ItemDefinition {
 id:string;title:string;description:string;rarity:UpgradeChoice['rarity'];
 /** Legendary variants share ownership and unlocks with this base relic. */
 baseId?:string;
 ownership:'squad'|'leader';stacking:'stack'|'unique';maxStacks:number;
 /** Retired entries remain resolvable for existing runs, but never appear as new rewards. */
 offerable?:boolean;minimumParty?:number;
 modifiers?:readonly StatModifier[];effects?:readonly EffectRule[];
 /** A percentage added for each uninterrupted squad hit on one enemy. */
 consecutiveTargetDamage?:number;
 /** Levels granted on acquisition; a fractional part adds that share of the next level's XP. */
 levelGain?:number;
}
type ItemInput=Omit<ItemDefinition,'ownership'|'stacking'|'maxStacks'> & Partial<Pick<ItemDefinition,'ownership'|'stacking'|'maxStacks'>>;
const item=(definition:ItemInput):ItemDefinition=>({ownership:'squad',stacking:'stack',maxStacks:Infinity,...definition});

/** One catalogue drives offers, the effect interpreter and the pause build summary. */
const BASE_ITEM_DEFINITIONS:readonly ItemDefinition[]=[
 item({id:'echo-bell',title:'Echo Bell',description:'Every 5th squad attack repeats at 32.5% damage. Repeats cannot trigger more item effects.',rarity:'epic',effects:[{event:'onAttack',every:5,action:{kind:'echo',damageScale:0.325}}]}),
 item({id:'multi-lens',title:'Loaded Dice',description:'Bolt, beam and lob attacks have a 50% chance to fire +1 projectile.',rarity:'epic',modifiers:[{stat:'projectiles',amount:0.5}]}),
 item({id:'static-orb',title:'Zap Plate',description:'Critical hits arc for 12.5% of hit damage through up to 2 enemies within 4.7m. 0.15s cooldown.',rarity:'rare',effects:[{event:'onCrit',cooldown:.15,action:{kind:'chain',damageScale:0.125,jumps:2,range:4.7,element:'electric'}}]}),
 item({id:'leftovers',title:'Leftovers',description:'Each squad member restores 0.4% of their own max HP each second.',rarity:'rare',modifiers:[{stat:'regenerationPercent',amount:0.004},{stat:'partyRegenerationPercent',amount:0.004}]}),
 item({id:'exp-share',title:'Exp. Share',description:'Teammates below the leader’s level earn 17.5% more shared XP. Everyone already receives full shared XP.',rarity:'rare',modifiers:[{stat:'xpCatchup',amount:0.175}]}),
 item({id:'life-orb',title:'Life Orb',description:'+16% squad damage. Every 25 squad attacks costs the leader 2 HP.',rarity:'epic',modifiers:[{stat:'power',amount:0.16}],effects:[{event:'onAttack',every:25,action:{kind:'selfDamage',amount:2}}]}),
 item({id:'kings-rock',title:"King's Rock",description:'Hits have an 8% chance to stun for 0.35s. Item damage cannot trigger it.',rarity:'rare',effects:[{event:'onHit',chance:.08,action:{kind:'status',status:'stun',duration:0.35}}]}),
 item({id:'shell-bell',title:'Shell Bell',description:'Every 15 defeated enemies restore 5% of the leader\'s max HP.',rarity:'rare',effects:[{event:'onDeath',every:15,maxDepth:1,action:{kind:'heal',amount:0,maxHpFraction:0.05,target:'leader'}}]}),
 item({id:'eviolite',title:'Eviolite',description:'Squad members that can still evolve deal +11% damage.',rarity:'rare',offerable:false,modifiers:[{stat:'power',amount:0.11,evolution:'unevolved'}]}),
 item({id:'charged-band',title:'Leppa Berry',description:'Your special ability recharges 17.5% faster.',rarity:'rare',offerable:false,modifiers:[{stat:'specialHaste',amount:0.175}]}),
 item({id:'iron-ball',title:'Iron Ball',description:'+32.5% squad damage; attack speed is reduced by 30%. Slow, heavy attacks.',rarity:'epic',modifiers:[{stat:'power',amount:0.325},{stat:'haste',amount:-.3}]}),
 item({id:'nursery-stone',title:'Everstone',description:'Members that can still evolve deal +22.5% damage; fully evolved and single-stage members deal 20% less damage.',rarity:'epic',offerable:false,modifiers:[{stat:'power',amount:0.225,evolution:'unevolved'},{stat:'power',amount:-.2,evolution:'evolved'}]}),
 item({id:'scope-lens',title:'Scope Lens',description:'+4% critical hit chance. Each full 100% guarantees another critical tier.',rarity:'rare',offerable:false,modifiers:[{stat:'critChance',amount:0.04}]}),
 item({id:'razor-claw',title:'Razor Claw',description:'+10% critical damage.',rarity:'uncommon',modifiers:[{stat:'critDamagePercent',amount:0.1}]}),
 item({id:'wide-lens',title:'Wide Lens',description:'+14% attack range and area radius.',rarity:'rare',offerable:false,modifiers:[{stat:'radius',amount:0.14}]}),
 item({id:'long-barrel',offerable:false,title:'Zoom Lens',description:'+10% attack range and area radius; projectiles travel 15% faster.',rarity:'rare',modifiers:[{stat:'radius',amount:0.1},{stat:'projectileSpeed',amount:0.15}]}),
 item({id:'piercing-fang',title:'Drill Run',description:'Projectiles pierce +1 additional enemy.',rarity:'rare',modifiers:[{stat:'pierce',amount:1}]}),
 item({id:'storm-coil',title:'Discharge',description:'Chain attacks jump to +1 enemy.',rarity:'epic',modifiers:[{stat:'chains',amount:1}]}),
 item({id:'quick-claw',title:'Quick Claw',description:'+11% squad attack speed.',rarity:'common',offerable:false,modifiers:[{stat:'haste',amount:0.11}]}),
 item({id:'float-stone',title:'Float Stone',description:'+7.5% movement speed.',rarity:'common',offerable:false,modifiers:[{stat:'speed',amount:0.075}]}),
 item({id:'metal-coat',title:'Metal Coat',description:'+10% defense for every squad member.',rarity:'common',offerable:false,modifiers:[{stat:'defense',amount:0.1}]}),
 item({id:'recovery-seed',title:'Sitrus Berry',description:'Restore 0.6 leader HP and 0.4 follower HP each second.',rarity:'common',offerable:false,modifiers:[{stat:'regeneration',amount:0.6},{stat:'partyRegeneration',amount:0.4}]}),
 item({id:'magnet-stone',title:'Magnet',description:'+2m XP pickup radius, gathering drops from much farther away.',rarity:'common',modifiers:[{stat:'magnet',amount:2}]}),
 item({id:'lucky-egg',title:'Lucky Egg',description:'+12.5% XP earned from drops and defeats.',rarity:'rare',offerable:false,modifiers:[{stat:'xp',amount:0.125}]}),
 item({id:'focus-sash',title:'Focus Sash',description:'While the leader is below 35% HP: +12.5% squad damage and +9% defense.',rarity:'rare',modifiers:[{stat:'power',amount:0.125,healthBelow:.35},{stat:'defense',amount:0.09,healthBelow:.35}]}),
 item({id:'rescue-ribbon',title:'Heal Bell',description:'Using your special restores 6% of each squad member\'s own max HP.',rarity:'rare',effects:[{event:'onSpecial',action:{kind:'heal',amount:0,maxHpFraction:0.06,target:'squad'}}]}),
 item({id:'welcome-basket',title:'Soothe Bell',description:'+6% squad attack damage. Recruiting also restores 12 squad HP and grants 12 XP.',rarity:'common',offerable:false,modifiers:[{stat:'power',amount:0.06}],effects:[{event:'onRecruit',action:{kind:'heal',amount:12,target:'squad'}},{event:'onRecruit',action:{kind:'xp',amount:12}}]}),
 item({id:'growth-charm',title:'Rare Candy',description:'+10% special recharge speed. Evolving also restores 15 squad HP and removes 4s from your special cooldown.',rarity:'rare',offerable:false,modifiers:[{stat:'specialHaste',amount:0.1}],effects:[{event:'onEvolve',action:{kind:'heal',amount:15,target:'squad'}},{event:'onEvolve',action:{kind:'specialCharge',amount:4}}]}),
 item({id:'blast-seed',title:'Blast Seed',description:'Every 4th defeated enemy explodes for 40% of the attacker\'s primary-move damage in a 2.8m radius. Explosions cannot trigger other items.',rarity:'rare',effects:[{event:'onDeath',every:4,action:{kind:'area',damageScale:0.4,radius:2.8}}]}),
 item({id:'frost-charm',title:'Icy Rock',description:'Hits have a 14% chance to slow for 0.75s.',rarity:'common',effects:[{event:'onHit',chance:.14,action:{kind:'status',status:'slow',duration:0.75}}]}),
 item({id:'toxic-barb',title:'Toxic Barb',description:'Hits have a 16% chance to poison for 1.5s.',rarity:'rare',effects:[{event:'onHit',chance:.16,action:{kind:'status',status:'poison',duration:1.5}}]}),
 item({id:'critical-capacitor',title:'Adrenaline Orb',description:'Critical hits remove 0.25s from your special cooldown. 0.25s cooldown.',rarity:'rare',effects:[{event:'onCrit',cooldown:.25,action:{kind:'specialCharge',amount:0.25}}]}),
 item({id:'eruption-core',title:'Eruption',description:'Your special also bursts for 75% of your primary-move damage as Fire damage in a 5m radius.',rarity:'epic',effects:[{event:'onSpecial',action:{kind:'area',damageScale:0.75,radius:5,element:'fire'}}]}),
 item({id:'prism-shard',title:'Power Gem',description:'Critical hits burst for 17.5% of hit damage in a 2.4m radius. 0.6s cooldown.',rarity:'epic',effects:[{event:'onCrit',cooldown:.6,action:{kind:'area',damageScale:0.175,radius:2.4}}]}),
 item({id:'binding-thread',title:'Binding Band',description:'+20% duration for poison, burn, slow, soaked and stun from your squad.',rarity:'rare',modifiers:[{stat:'duration',amount:0.2}]}),
 item({id:'team-battery',title:'Team Battery',description:'+1 maximum stamina (dodge charge) per 2 current living party members, rounded down, including the leader. Requires at least 3 living members to acquire.',rarity:'rare',minimumParty:3,stacking:'unique',maxStacks:1,modifiers:[{stat:'staminaCapacity',amount:0.5,scale:'party'}]}),
 item({id:'healing-bead',title:'Big Root',description:'Every 12 attacks from each member restore 0.75% of the leader\'s max HP. Each member has their own attack counter.',rarity:'common',effects:[{event:'onAttack',every:12,counter:'source',action:{kind:'heal',amount:0,maxHpFraction:0.0075,target:'leader'}}]}),
 item({id:'power-herb',baseId:'power-herb',title:'Power Herb',description:'Every 3rd squad attack reduces your current special cooldown by 1.5%.',rarity:'rare',effects:[{event:'onAttack',every:3,action:{kind:'specialCooldownPercent',amount:0.015}}]}),
];

/** Families with authored rarity curves instead of the normal base/Legendary pair. */
const AUTHORED_RARITY_VARIANTS:readonly ItemDefinition[]=[
 item({id:'metronome-ramp',baseId:'metronome-ramp',title:'Metronome',description:'Consecutive squad hits on the same enemy deal +5% damage per prior uninterrupted hit, up to +100% per copy after 20 hits.',rarity:'legendary',consecutiveTargetDamage:0.05}),
 item({id:'lucky-egg-xp',baseId:'lucky-egg-xp',title:'Lucky Egg',description:'+1.5% XP earned from drops and defeats.',rarity:'common',modifiers:[{stat:'xp',amount:0.015}]}),
 item({id:'lucky-egg-xp-rare',baseId:'lucky-egg-xp',title:'Lucky Egg',description:'+3% XP earned from drops and defeats.',rarity:'rare',modifiers:[{stat:'xp',amount:0.03}]}),
 item({id:'lucky-egg-xp-epic',baseId:'lucky-egg-xp',title:'Lucky Egg',description:'+4.5% XP earned from drops and defeats.',rarity:'epic',modifiers:[{stat:'xp',amount:0.045}]}),
 item({id:'lucky-egg-xp-legendary',baseId:'lucky-egg-xp',title:'Lucky Egg',description:'+10% XP earned from drops and defeats.',rarity:'legendary',modifiers:[{stat:'xp',amount:0.1}]}),
 item({id:'rare-candy',baseId:'rare-candy',title:'Rare Candy',description:'Every living party Pokemon gains XP equal to 50% of their current level requirement.',rarity:'common',levelGain:0.5}),
 item({id:'rare-candy-rare',baseId:'rare-candy',title:'Rare Candy',description:'Every living party Pokemon gains 1 level.',rarity:'rare',levelGain:1}),
 item({id:'rare-candy-epic',baseId:'rare-candy',title:'Rare Candy',description:'Every living party Pokemon gains 1 level plus XP equal to 50% of the following level requirement.',rarity:'epic',levelGain:1.5}),
 item({id:'rare-candy-legendary',baseId:'rare-candy',title:'Rare Candy',description:'Every living party Pokemon gains 2 levels plus XP equal to 50% of the following level requirement.',rarity:'legendary',levelGain:2.5}),
 item({id:'power-herb-epic',baseId:'power-herb',title:'Power Herb',description:'Every 3rd squad attack reduces your current special cooldown by 4%.',rarity:'epic',effects:[{event:'onAttack',every:3,action:{kind:'specialCooldownPercent',amount:0.04}}]}),
];

const LEGENDARY_DESCRIPTIONS:Record<string,string>={
 'echo-bell':'Every 5th squad attack repeats at 65% damage. Repeats cannot trigger more item effects.',
 'multi-lens':'Bolt, beam and lob attacks fire +1 projectile.',
 'static-orb':'Critical hits arc for 25% of hit damage through up to 2 enemies within 4.7m. 0.15s cooldown.',
 'leftovers':'Each squad member restores 0.8% of their own max HP each second.',
 'exp-share':'Teammates below the leader’s level earn 35% more shared XP. Everyone already receives full shared XP.',
 'life-orb':'+32% squad damage. Every 25 squad attacks costs the leader 2 HP.',
 'kings-rock':'Hits have an 8% chance to stun for 0.7s. Item damage cannot trigger it.',
 'shell-bell':'Every 15 defeated enemies restore 10% of the leader\'s max HP.',
 'iron-ball':'+65% squad damage; attack speed is reduced by 30%. Slow, heavy attacks.',
 'razor-claw':'+20% critical damage.',
 'team-battery':'+1 maximum stamina (dodge charge) per current living party member, including the leader. Requires at least 3 living members to acquire.',
 'long-barrel':'+20% attack range and area radius; projectiles travel 30% faster.',
 'piercing-fang':'Projectiles pierce +2 additional enemies.',
 'storm-coil':'Chain attacks jump to +2 enemies.',
 'magnet-stone':'+4m XP pickup radius, gathering drops from much farther away.',
 'focus-sash':'While the leader is below 35% HP: +25% squad damage and +18% defense.',
 'rescue-ribbon':'Using your special restores 12% of each squad member\'s own max HP.',
 'blast-seed':'Every 4th defeated enemy explodes for 80% of the attacker\'s primary-move damage in a 2.8m radius. Explosions cannot trigger other items.',
 'frost-charm':'Hits have a 14% chance to slow for 1.5s.',
 'toxic-barb':'Hits have a 16% chance to poison for 3s.',
 'critical-capacitor':'Critical hits remove 0.5s from your special cooldown. 0.25s cooldown.',
 'eruption-core':'Your special also bursts for 150% of your primary-move damage as Fire damage in a 5m radius.',
 'prism-shard':'Critical hits burst for 35% of hit damage in a 2.4m radius. 0.6s cooldown.',
 'binding-thread':'+40% duration for poison, burn, slow, soaked and stun from your squad.',
 'healing-bead':'Every 12 attacks from each member restore 1.5% of the leader\'s max HP. Each member has their own attack counter.',
};

function legendaryAction(action:EffectAction):EffectAction {
 switch(action.kind){
  case 'echo':return {...action,damageScale:action.damageScale*2};
  case 'chain':case 'area':return {...action,damage:action.damage===undefined?undefined:action.damage*2,damageScale:action.damageScale===undefined?undefined:action.damageScale*2};
  case 'heal':return {...action,amount:action.amount*2,maxHpFraction:action.maxHpFraction===undefined?undefined:action.maxHpFraction*2};
  case 'status':return {...action,duration:action.duration*2};
  case 'xp':case 'specialCharge':case 'specialCooldownPercent':return {...action,amount:action.amount*2};
  case 'selfDamage':return {...action};
 }
}

/** Same triggers and drawbacks; twice the positive bonus or triggered strength. */
export const ITEM_DEFINITIONS:readonly ItemDefinition[]=[...BASE_ITEM_DEFINITIONS,...AUTHORED_RARITY_VARIANTS,
 ...BASE_ITEM_DEFINITIONS.filter(base=>!base.baseId&&(base.offerable!==false||base.id==='long-barrel')).map(base=>({...base,
  id:`${base.id}-legendary`,baseId:base.id,title:`Legendary ${base.title}`,rarity:'legendary' as const,
  description:LEGENDARY_DESCRIPTIONS[base.id],
  modifiers:base.modifiers?.map(modifier=>({...modifier,amount:modifier.amount>0?modifier.amount*2:modifier.amount})),
  effects:base.effects?.map(effect=>({...effect,action:legendaryAction(effect.action)})),
 }))];

export const ITEMS:UpgradeChoice[]=ITEM_DEFINITIONS.filter(item=>item.offerable!==false).map(({id,title,description,rarity})=>({id,kind:'item',title,description,rarity}));
const ITEM_BY_ID=new Map(ITEM_DEFINITIONS.map(definition=>[definition.id,definition]));
export function getItemDefinition(id:string):ItemDefinition|undefined{return ITEM_BY_ID.get(id);}
export function relicFamily(id:string):string{return getItemDefinition(id)?.baseId??id;}
