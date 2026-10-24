import {KANTO,RECRUIT_POOL,getSpecies,starterChoices,type Element} from '../data/kanto.ts';
import {ITEM_DEFINITIONS,type BuildStat} from '../data/items.ts';
import {PROGRESSION,TRAINING_UPGRADES,trainingVariants,trainingDescription} from '../data/progression.ts';
import {ACHIEVEMENTS,STARTING_PARTNERS,GATED_ITEMS,GATED_RECRUITS} from '../data/unlocks.ts';
import {LEARNABLE_MOVES,learnableMoves,moveLearnLevel,getLearnedMoveProfile,learnedMovePower} from '../data/moves.ts';
import {describeAttackMechanic,describeAttackUpgrade,getAttackProfile} from '../data/attacks.ts';
import {describeSpecialUpgrade,getSpecialProfile,specialAimMode} from '../data/specials.ts';
import {evolutionRequirement,evolutionRule} from '../data/evolutions.ts';
import {movementTraitLabel} from '../data/movementTraits.ts';
import {SYNERGIES} from '../data/synergies.ts';
import {DESIGN} from '../data/config.ts';
import {BUILD_STAT_CAPS,BUILD_LIMITS} from '../game/systems/builds.ts';
import type {UpgradeRarity} from '../game/types.ts';
import type {SaveData} from '../game/save.ts';

export const CATALOGUE_GROUPS=[
 {id:'training',title:'Stat training',number:'01',description:'Every family and rarity. Percentage bonuses add against the base stat.'},
 {id:'relics',title:'Relics',number:'02',description:'Current relics and their Legendary versions, with effects and unlock requirements.'},
 {id:'rules',title:'Move & reward rules',number:'03',description:'How rarity, personal levels, move slots and training ranks work.'},
 {id:'signatures',title:'Signature moves',number:'04',description:'All 151 Pokémon, including evolved forms. Train the selected owner; leader training also improves Q.'},
 {id:'learned',title:'Learned moves',number:'05',description:'Every extra move, its eligible Pokémon and rank growth. Each move has an independent cooldown.'},
 {id:'specials',title:'Q specials',number:'06',description:'Grouped by special family, as in the catalogue. Q grows with the leader’s signature rank.'},
 {id:'evolutions',title:'Evolutions',number:'07',description:'Every evolution branch, its requirements and permanent bonuses.'},
 {id:'recruitment',title:'Recruitment & starters',number:'08',description:'All recruitable Pokémon and start-of-run partners, with unlock requirements.'},
 {id:'synergies',title:'Team synergies',number:'09',description:'Automatic composition bonuses. Required contributions must come from distinct living members.'},
 {id:'limits',title:'Stat & effect limits',number:'10',description:'Current gameplay limits from the catalogue. These are reference entries, not upgrade cards.'},
] as const;
export type CatalogueGroup=typeof CATALOGUE_GROUPS[number]['id'];
export type CatalogueAvailability='all'|'current'|'unlocked'|'locked';
export type CatalogueSort='catalogue'|'name-asc'|'name-desc'|'rarity-desc'|'rarity-asc'|'level';
export interface CatalogueEntry {
 id:string;group:CatalogueGroup;title:string;subtitle:string;description:string;
 rarities:readonly UpgradeRarity[];elements:readonly Element[];
 stats:readonly {label:string;value:string}[];details:readonly {label:string;text:string}[];
 retired?:boolean;level?:number;unlock?:{kind:'items'|'recruits'|'starters';id:string|number;requirement:string};
}
export interface CatalogueFilters {
 search:string;group:CatalogueGroup|'all';rarity:UpgradeRarity|'none'|'all';
 element:Element|'all';availability:CatalogueAvailability;sort:CatalogueSort;
}
export const DEFAULT_CATALOGUE_FILTERS:CatalogueFilters={search:'',group:'all',rarity:'all',element:'all',availability:'all',sort:'catalogue'};
const n=(value:number)=>Number.isFinite(value)?String(Number(value.toFixed(2))):'Unlimited';
const pct=(value:number)=>`${n(value*100)}%`;
const stat=(label:string,value:string)=>({label,value});
const detail=(label:string,text:string)=>({label,text});
const names=(ids:readonly number[])=>ids.map(id=>getSpecies(id).name).join(', ');
function unlock(kind:'items'|'recruits'|'starters',id:string|number):NonNullable<CatalogueEntry['unlock']>{
 const achievement=ACHIEVEMENTS.find(entry=>(entry.reward[kind] as readonly (string|number)[]|undefined)?.includes(id));
 return {kind,id,requirement:achievement?`${achievement.title}: ${achievement.description}`:'Available from the start.'};
}
const STAT_NAMES:Record<BuildStat,string>={staminaRechargeReduction:'Stamina recharge time reduction',defense:'Defense bonus',deflection:'Deflection chance',staminaCapacity:'Extra dodge charges',critDamagePercent:'Critical damage bonus',power:'Damage bonus',specialPower:'Special ability damage bonus',haste:'Attack speed bonus',speed:'Movement speed bonus',armor:'Defense threshold',damageReduction:'Damage reduction',xp:'XP bonus',xpCatchup:'Catch-up XP bonus',critChance:'Critical chance',critDamage:'Critical damage multiplier',radius:'Attack reach / radius bonus',magnet:'Pickup radius bonus',specialHaste:'Special recharge bonus',stamina:'Dodge recovery bonus',regeneration:'Leader HP / sec',partyRegeneration:'Teammate HP / sec',regenerationPercent:'Leader max HP / sec',partyRegenerationPercent:'Teammate max HP / sec',projectiles:'Extra projectiles',pierce:'Extra pierces',chains:'Extra chain jumps',projectileSpeed:'Projectile speed bonus',duration:'Status duration bonus'};
const FLAT_STATS=new Set<BuildStat>(['staminaCapacity','armor','critDamage','magnet','regeneration','partyRegeneration','projectiles','pierce','chains']);

/** Complete finite definitions; unbounded ranks use rules and representative transitions. */
export function createUpgradeCatalogue():readonly CatalogueEntry[]{
 const entries:CatalogueEntry[]=[];
 for(const training of TRAINING_UPGRADES)for(const {rarity,amount,rechargeReduction} of trainingVariants(training,true)){
  const curve=trainingVariants(training,true).map(variant=>variant.rarity+': +'+(training.stat==='staminaCapacity'?variant.amount+' stamina':pct(variant.amount))).join(' / ');
  entries.push({id:`training:${training.id}:${rarity}`,group:'training',title:training.title,subtitle:'Pokémon stat training',
   description:trainingDescription(training,rarity,true).replace('for every squad member','for the trained Pokémon'),rarities:[rarity],elements:[],
   stats:[stat('Per selection',training.stat==='staminaCapacity'?`+${amount} stamina`:`+${pct(amount)}`),...(rechargeReduction?[stat('Recharge time',`-${pct(rechargeReduction)}`)]:[]),stat('Rank limit',training.stat==='deflection'?'50% total chance':'Unlimited'),stat('Rank gain','+1')],
   details:[detail('Scope','Level-up training and ranks belong only to the Pokémon that earned the milestone. Shrine rewards apply to the whole squad. Movement, stamina and Q training appear only on leader milestones.'),detail('Stacking',training.stat==='staminaCapacity'?'Adds maximum dodge charges. Each spent charge recharges separately.':training.stat==='deflection'?'Adds attack deflection chance in percentage points, capped at 50%. Stops appearing at the cap.':training.stat==='crit'?'Adds critical chance in percentage points. Each full 100% guarantees another critical tier.':'Each selection adds its printed percentage against the base stat. Agility recharge reductions multiply the remaining recharge time.'),
    detail('Squad reward',trainingDescription(training,rarity)),
    detail('Rarity',curve+'. Personal bonuses are reduced by 15%, rounded to whole percentage points or charges. Base roll weights: Common 55 / Uncommon 10 / Rare 35 / Epic 9.5 / Legendary 0.5. Eligible pools and luck affect the final odds.')]});
 }
 for(const item of ITEM_DEFINITIONS.filter(item=>item.offerable!==false)){
  const baseId=item.baseId??item.id;
  entries.push({id:`relic:${item.id}`,group:'relics',title:item.title,subtitle:item.rarity==='legendary'?'Legendary relic':'Passive relic',description:item.description,
   rarities:[item.rarity],elements:[],
   ...((GATED_ITEMS as readonly string[]).includes(baseId)?{unlock:unlock('items',baseId)}:{}),
   stats:[stat('Scope',item.ownership==='squad'?'Squad':'Leader'),stat('Stacking',item.stacking==='unique'?'Unique':'Repeatable')],
   details:[detail('Availability',item.offerable===false?'Retired. Resolves in legacy runs; never appears in new offers.':item.stacking==='unique'?'Unique mechanic: one copy per family per run. Base and Legendary versions share this limit.':'Additional copies add their bonuses. Base and Legendary versions can be combined and share the base relic unlock.'),
    ...(item.minimumParty?[detail('Party requirement',`At least ${item.minimumParty} living members to acquire. Party scaling uses the current living party, including the leader.`)]:[]),
    ...(item.modifiers??[]).map(modifier=>detail(STAT_NAMES[modifier.stat],`${modifier.amount>=0?'+':''}${FLAT_STATS.has(modifier.stat)?n(modifier.amount):pct(modifier.amount)}${modifier.healthBelow===undefined?'':` while leader HP is below ${pct(modifier.healthBelow)}`}${modifier.evolution?`; ${modifier.evolution} members`:''}`)),
    ...(item.effects??[]).map(effect=>detail('Trigger',[effect.event.replace(/^on/,'On '),effect.every?`every ${effect.every}`:'',effect.chance===undefined?'':`${pct(effect.chance)} chance`,effect.cooldown?`${n(effect.cooldown)}s cooldown`:'',effect.counter==='source'?'per attacker':'squad event'].filter(Boolean).join(' · ')))]});
 }
 const rules=[
  {id:'signature',title:'Signature training',rarities:['common','rare'] as UpgradeRarity[],description:'Common at current rank 1–3 with +1 rank. Rare at current rank 4+ or with single-stage +2-rank mastery. No rank limit.'},
  {id:'learned',title:'Learned-move training',rarities:['common','rare'] as UpgradeRarity[],description:'Common when the resulting rank is below 4 with +1 rank. Rare at resulting rank 4+ or with +2-rank mastery. No rank limit.'},
  {id:'learning',title:'Learning a new move',rarities:['rare'] as UpgradeRarity[],description:`Learn at rank 1 with a free slot and valid species/level eligibility. Extra slots open at levels ${PROGRESSION.moves.learnLevels.join(', ')}. Learning choices stop at personal level ${PROGRESSION.leveling.trainingFocusLevel}.`},
  {id:'milestones',title:'Personal level milestones',rarities:[],description:`Choices at levels 3, 5, 10, 15… through ${PROGRESSION.leveling.maxLevel}. Ordinary levels add ${pct(PROGRESSION.leveling.healthPerLevel)} base HP and attack without pausing.`},
  {id:'mastery',title:'Single-stage mastery',rarities:['rare'] as UpgradeRarity[],description:`Species without evolutions gain +${PROGRESSION.moves.soloRankGain} move ranks per training choice from personal level ${PROGRESSION.moves.soloTrainingLevel}. Other species gain +1.`},
 ];
 for(const rule of rules)entries.push({id:`rule:${rule.id}`,group:'rules',title:rule.title,subtitle:'Progression rule',description:rule.description,rarities:rule.rarities,elements:[],stats:[],details:[]});
 for(const species of KANTO){
  const profile=getAttackProfile(species.id,1),learned=learnableMoves(species.id);
  entries.push({id:`signature:${species.id}`,group:'signatures',title:species.moveName,subtitle:`#${String(species.id).padStart(3,'0')} ${species.name} · ${profile.kind}`,
   description:describeAttackMechanic(species.id),rarities:['common','rare'],elements:species.types,level:1,
   stats:[stat('R1 core power',n(species.power+9)),stat('Base interval',`${n(profile.cooldown)}s`),stat('Reach / radius',`${n(profile.range)} / ${n(profile.radius)}m`)],
   details:[detail('Rank 1 → 2',describeAttackUpgrade(species.id,1,2)),detail('Rank 3 → 4',describeAttackUpgrade(species.id,3,4)),detail('Rank 4 → 5',describeAttackUpgrade(species.id,4,5)),
    detail('Authored milestones',(profile.milestones??[]).map(milestone=>`R${milestone.rank}: ${milestone.description}`).join(' · ')||'No separate behavior milestones; numeric training continues indefinitely.'),
    detail('Learnable moves',learned.map(move=>`${move.name} [LV ${moveLearnLevel(move.id)}]`).join(', ')||'None for this form.'),
    detail('Growth',`Core power grows by ${pct(PROGRESSION.moves.damagePerRank)} of rank-1 power per additional rank, before profile changes. Casting speed grows by ${pct(PROGRESSION.moves.speedPerRank)} per rank. Reach +${n(profile.growth.range)}m and radius +${n(profile.growth.radius)}m per rank. No rank limit.`)]});
 }
 const eligibleByMove=new Map(LEARNABLE_MOVES.map(move=>[move.id,KANTO.filter(species=>learnableMoves(species.id).some(candidate=>candidate.id===move.id)).map(species=>species.id)]));
 for(const move of LEARNABLE_MOVES){
  const level=moveLearnLevel(move.id),profile=getLearnedMoveProfile(move.id,1);
  entries.push({id:`learned:${move.id}`,group:'learned',title:move.name,subtitle:`Extra learned move · ${profile.kind}`,description:move.description,
   rarities:['common','rare'],elements:[move.element],level,
   stats:[stat('Min. level',String(level)),stat('R1 power',n(learnedMovePower(move.id,1))),stat('R1 interval',`${n(profile.cooldown)}s`)],
   details:[detail('Eligible Pokémon',names(eligibleByMove.get(move.id)!)),detail('Learning','New-move cards are Rare and start at rank 1. Requires a free learned slot; training uses Common or Rare cards and has no rank limit.'),
    ...[1,5,10,20,50,100].map(rank=>{const p=getLearnedMoveProfile(move.id,rank);return detail(`Rank ${rank}`,`Power ${n(learnedMovePower(move.id,rank))} · ${n(p.cooldown)}s interval · ${n(p.range)}m reach · ${n(p.radius)}m radius · ${p.projectiles} projectiles · ${p.chains} chain targets, before execution limits.`);})]});
 }
 const specialGroups=new Map<string,number[]>();
 for(const species of KANTO){const special=getSpecialProfile(species.id),key=`${special.kind}:${special.name}`;specialGroups.set(key,[...(specialGroups.get(key)??[]),species.id]);}
 for(const [key,ids] of specialGroups){
  const owner=getSpecies(ids[0]),special=getSpecialProfile(owner.id);
  entries.push({id:`special:${key}`,group:'specials',title:special.name,subtitle:`Q ability · ${specialAimMode(special.kind)} targeting`,description:special.description,
   rarities:[],elements:[...new Set(ids.flatMap(id=>{const {element}=getSpecialProfile(id);return element?[element]:getSpecies(id).types;}))],stats:[stat('Base cooldown',`${n(special.cooldown)}s`),stat('Representative',owner.name)],
   details:[detail('Pokémon',names(ids)),detail('Training','Grows with the leader’s signature rank; no independent rarity card. Values can vary by species and evolution.'),
    detail('Rank 1 → 2',describeSpecialUpgrade(owner.id,1,2)),detail('Rank 4 → 5',describeSpecialUpgrade(owner.id,4,5)),detail('Rank 9 → 10',describeSpecialUpgrade(owner.id,9,10)),
    ...[1,5,10].map(rank=>{const p=getSpecialProfile(owner.id,rank);return detail(`${owner.name} · rank ${rank}`,`${n(p.range)}m reach · ${n(p.radius)}m radius · ${n(p.duration)}s duration · ${p.pulses} pulses · ${p.projectiles} projectiles · damage scale ${n(p.damageScale)}x`);})]});
 }
 for(const source of KANTO)for(const targetId of source.evolvesTo){
  const target=getSpecies(targetId),rule=evolutionRule(source.id,targetId)!;
  entries.push({id:`evolution:${source.id}:${targetId}`,group:'evolutions',title:`${source.name} → ${target.name}`,subtitle:`Evolution · ${target.moveName}`,description:evolutionRequirement(source.id,targetId),
   rarities:['epic'],elements:target.types,level:rule.level,
   stats:[stat('Max HP',`+${pct(target.health/source.health-1)}`),stat('Permanent attack',`+${pct(PROGRESSION.evolution.powerGain)}`),stat('All known moves',`+${PROGRESSION.evolution.moveRankGain} rank`)],
   details:[detail('Preserved','Keeps personal level, XP, trained moves and current health fraction.'),detail('Movement when leading',`${movementTraitLabel(source.id)} → ${movementTraitLabel(targetId)}`),detail('Matching move','A learned move matching the new signature merges into the signature at the higher existing rank plus one, freeing its learned slot. No unrelated move is granted.') ]});
 }
 for(const species of RECRUIT_POOL)entries.push({id:`recruit:${species.id}`,group:'recruitment',title:`Recruit ${species.name}`,subtitle:`First-stage teammate · ${species.moveName}`,description:species.evolvesTo.length?`Evolution options: ${names(species.evolvesTo)}.`:'Single-stage mastery: unlimited move training with extra ranks from personal level 5.',
  rarities:['rare'],elements:species.types,level:1,...(GATED_RECRUITS.includes(species.id)?{unlock:unlock('recruits',species.id)}:{}),
  stats:[stat('Starting level','1'),stat('Starting moves','1 signature')],details:[detail('Recruitment gates',DESIGN.recruitUnlockSeconds.map((seconds,index)=>`Recruit ${index+1}: ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} and squad level ${DESIGN.recruitUnlockLevels[index]}`).join(' · ')),detail('Eligibility','Requires an unlocked first-stage species and an unrepresented evolution line. A faint does not reset recruitment count.')]});
 for(const id of starterChoices()){
  const species=getSpecies(id),available=(STARTING_PARTNERS as readonly number[]).includes(id);
  entries.push({id:`starter:${id}`,group:'recruitment',title:`Start with ${species.name}`,subtitle:'Start-of-run partner',description:`Signature: ${species.moveName}. Q special: ${getSpecialProfile(id).name}.`,
   rarities:[],elements:species.types,...(!available?{unlock:unlock('starters',id)}:{}),stats:[],details:[detail('Unlock',available?'Available on a fresh save.':unlock('starters',id).requirement)]});
 }
 for(const synergy of SYNERGIES)entries.push({id:`synergy:${synergy.id}`,group:'synergies',title:synergy.title,subtitle:'Automatic team bonus',description:synergy.description,rarities:[],
  elements:[...new Set(synergy.requirements.flatMap(requirement=>requirement.kind==='type'?[requirement.type]:[]))],stats:[stat('Minimum party',String(synergy.minimumParty))],
  details:[detail('Activation','Requires distinct living teammates. Bonuses disappear when the required composition is lost.'),...(synergy.extraMatchModifiers??[]).map(modifier=>detail('Each extra match',`+${pct(modifier.amount)} ${STAT_NAMES[modifier.stat].toLowerCase()}`))]});
 for(const [key,cap] of Object.entries(BUILD_STAT_CAPS))entries.push({id:`limit:stat:${key}`,group:'limits',title:STAT_NAMES[key as BuildStat],subtitle:'Current build-stat limit',
  description:key==='damageReduction'?'Legacy reduction is converted to a percentage defense bonus. Defense subtracts from attack damage, with a minimum of zero damage.':key==='critChance'?'Each full 100% guarantees another critical tier; the remaining fraction is the chance of one more. No chance cap.':'Current maximum modifier from the build calculation.',
  rarities:[],elements:[],stats:[stat('Upper limit',Number.isFinite(cap)?FLAT_STATS.has(key as BuildStat)?n(cap):pct(cap):'Unlimited')],details:[]});
 const limitLabels:Record<keyof typeof BUILD_LIMITS,string>={maxProcDepth:'Effect recursion depth',maxActionsPerEvent:'Extra actions per event',windowSeconds:'Effect budget window (seconds)',maxActionsPerWindow:'Extra actions per window',maxEffectDamage:'Triggered damage limit',maxEffectRadius:'Triggered radius limit (m)',maxEffectJumps:'Triggered chain-jump limit',maxStatusSeconds:'Triggered status duration (seconds)'};
 for(const [key,value] of Object.entries(BUILD_LIMITS))entries.push({id:`limit:effect:${key}`,group:'limits',title:limitLabels[key as keyof typeof BUILD_LIMITS],subtitle:'Current effect limit',description:'Reference for triggered relic and synergy effects.',rarities:[],elements:[],stats:[stat('Current value',n(value))],details:[]});
 return entries;
}

export function catalogueEntryLocked(entry:CatalogueEntry,save:SaveData):boolean {
 if(!entry.unlock)return false;
 const {kind,id}=entry.unlock;
 return kind==='items'?!save.unlockedItems.includes(id as string):kind==='recruits'?!save.unlockedRecruits.includes(id as number):!save.unlocked.includes(id as number);
}
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
const rarityOrder:Record<UpgradeRarity,number>={common:1,uncommon:1.5,rare:2,epic:3,legendary:4};
const rarity=(entry:CatalogueEntry)=>Math.max(0,...entry.rarities.map(value=>rarityOrder[value]));
export function filterCatalogue(entries:readonly CatalogueEntry[],filters:CatalogueFilters,save:SaveData):CatalogueEntry[]{
 const words=normalize(filters.search.trim()).split(/\s+/).filter(Boolean);
 const filtered=entries.filter(entry=>{
  if(filters.group!=='all'&&entry.group!==filters.group)return false;
  if(filters.rarity!=='all'&&(filters.rarity==='none'?entry.rarities.length:!entry.rarities.includes(filters.rarity)))return false;
  if(words.some(word=>Object.hasOwn(rarityOrder,word)&&!entry.rarities.includes(word as UpgradeRarity)))return false;
  if(filters.element!=='all'&&!entry.elements.includes(filters.element))return false;
  const locked=catalogueEntryLocked(entry,save);
  if((filters.availability==='current'&&entry.retired)||
   (filters.availability==='locked'&&(!locked||entry.retired))||(filters.availability==='unlocked'&&(locked||entry.retired)))return false;
  if(words.length){
   const haystack=normalize([entry.title,entry.subtitle,entry.description,...entry.rarities,...entry.elements,...entry.stats.map(row=>`${row.label} ${row.value}`),...entry.details.map(row=>`${row.label} ${row.text}`),entry.unlock?.requirement??'',entry.retired?'retired':''].join(' '));
   if(!words.every(word=>haystack.includes(word)))return false;
  }
  return true;
 });
 const groupOrder=new Map(CATALOGUE_GROUPS.map((group,index)=>[group.id,index]));
 return filtered.sort((a,b)=>{
  const group=groupOrder.get(a.group)!-groupOrder.get(b.group)!;if(group)return group;
  if(filters.sort==='name-asc')return a.title.localeCompare(b.title)||a.subtitle.localeCompare(b.subtitle);
  if(filters.sort==='name-desc')return b.title.localeCompare(a.title)||a.subtitle.localeCompare(b.subtitle);
  if(filters.sort==='rarity-desc')return rarity(b)-rarity(a)||a.title.localeCompare(b.title);
  if(filters.sort==='rarity-asc')return rarity(a)-rarity(b)||a.title.localeCompare(b.title);
  if(filters.sort==='level')return (a.level??Infinity)-(b.level??Infinity)||a.title.localeCompare(b.title);
  return 0;
 });
}
