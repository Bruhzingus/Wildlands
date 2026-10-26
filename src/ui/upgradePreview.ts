import {getItemDefinition,type BuildStat} from '../data/items.ts';
import type {RunState,UpgradeChoice} from '../game/types.ts';
import {getBuildModifiers,itemStacks} from '../game/systems/builds.ts';
import {applyChoice} from '../game/systems/progression.ts';
import {getAttackProfile} from '../data/attacks.ts';
import {getSpecies} from '../data/kanto.ts';
import {getLearnedMoveProfile,getMoveDefinition} from '../data/moves.ts';
import {getSpecialProfile} from '../data/specials.ts';
import {DESIGN} from '../data/config.ts';
import {attackInterval,specialInterval} from '../game/combat/cadence.ts';
import {movementTraitLabel} from '../data/movementTraits.ts';

export const formatPercent=(value:number)=>`${Number((value*100).toFixed(2))}%`;
const labels:Partial<Record<BuildStat,string>>={staminaRechargeReduction:'Stamina recharge time reduction',defense:'Defense bonus',deflection:'Deflection chance',staminaCapacity:'Extra dodge charges',critDamagePercent:'Critical damage bonus',power:'Damage bonus',specialPower:'Special damage bonus',specialAmplification:'Special damage multiplier',specialRate:'Special cooldown factor',specialHealthCost:'Max HP cost per special',haste:'Attack speed bonus',speed:'Movement bonus',
 damageReduction:'Damage reduction',xp:'XP bonus',xpCatchup:'Catch-up XP bonus',critChance:'Critical chance',
 critDamage:'Critical damage',radius:'Reach / radius bonus',specialHaste:'Special recharge bonus',stamina:'Dodge recovery bonus',
 projectileSpeed:'Projectile speed bonus',duration:'Status duration bonus',regenerationPercent:'Max HP / sec',partyRegenerationPercent:'Teammate max HP / sec',
 projectiles:'Extra projectiles',pierce:'Extra pierces',chains:'Extra chain jumps',magnet:'Pickup radius (m)',armor:'Defense threshold',regeneration:'Leader HP / sec',partyRegeneration:'Teammate HP / sec'};
const flat=new Set<BuildStat>(['staminaCapacity','projectiles','pierce','chains','magnet','armor','regeneration','partyRegeneration']);
export interface StatPreview {label:string;before:string;after:string;}

/** Project the actual choice on copied build state. Never touches combat state or RNG. */
export function upgradeStatPreview(state:RunState,choice:UpgradeChoice):StatPreview[]{
 if(choice.kind==='evolve'&&choice.targetId){
  const member=state.party.find(m=>m.uid===choice.speciesId);if(!member)return [];
  const before=movementTraitLabel(member.speciesId),after=movementTraitLabel(choice.targetId);
  return before===after?[]:[{label:'Movement when leading',before,after}];
 }
 if(choice.kind!=='stat'&&choice.kind!=='item')return [];
 const projected:RunState={...state,analytics:undefined,buffs:{...state.buffs},trainingRanks:{...state.trainingRanks},
  player:{...state.player},party:state.party.map(member=>({...member,trainingBuffs:{...member.trainingBuffs},trainingRanks:{...member.trainingRanks}})),items:[...state.items],itemStacks:{...state.itemStacks}};
 if(!applyChoice(projected,choice).applied)return [];
 const owner=choice.kind==='stat'?choice.speciesId:undefined;
 const personal=state.party.find(member=>member.uid===owner),projectedPersonal=projected.party.find(member=>member.uid===owner);
 const before=getBuildModifiers(state,owner),after=getBuildModifiers(projected,owner),rows:StatPreview[]=[];
 if(choice.kind==='item')rows.push({label:'Copies',before:String(itemStacks(state,choice.id)),after:String(itemStacks(projected,choice.id))});
 if(choice.stat==='health')rows.push({label:'Max HP bonus',before:formatPercent((1+(state.buffs.health||0))*(1+(personal?.trainingBuffs?.health||0))-1),after:formatPercent((1+(projected.buffs.health||0))*(1+(projectedPersonal?.trainingBuffs?.health||0))-1)});
 for(const [key,label] of Object.entries(labels)){
  const stat=key as BuildStat;
  if(Math.abs(before[stat]-after[stat])<1e-12)continue;
  const format=stat==='specialAmplification'?(value:number)=>`${Number((1+value).toFixed(3))}×`:stat==='specialRate'?(value:number)=>`${Number((1/(1+value)).toFixed(3))}×`:stat==='critDamage'?(value:number)=>`${Number(value.toFixed(3))}×`:flat.has(stat)?(value:number)=>String(Number(value.toFixed(2))):formatPercent;
  rows.push({label:label!,before:format(before[stat]),after:format(after[stat])});
 }
 if(choice.kind==='item'&&getItemDefinition(choice.id)?.modifiers?.some(modifier=>modifier.target)){
  const elite={elite:true,isBoss:false};
  rows.push({label:'Damage bonus vs elites / bosses',before:formatPercent(getBuildModifiers(state,owner,elite).power),after:formatPercent(getBuildModifiers(projected,owner,elite).power)});
 }
 if(before.specialHealthCost!==after.specialHealthCost)rows.push({label:'HP spent per special',before:`${Number((state.player.maxHp*before.specialHealthCost).toFixed(2))} HP`,after:`${Number((projected.player.maxHp*after.specialHealthCost).toFixed(2))} HP`});
 const leader=personal??state.party[0],rate=(interval:number)=>`${Number((1/interval).toFixed(2))} / sec`,seconds=(value:number)=>`${Number(value.toFixed(2))}s`;
 if(after.haste!==before.haste&&leader){
  const profile=getAttackProfile(leader.speciesId,leader.attackLevel);
  rows.push({label:`${getSpecies(leader.speciesId).moveName} rate`,before:rate(attackInterval(profile.cooldown,before.haste)),after:rate(attackInterval(profile.cooldown,after.haste))});
  for(const move of leader.learnedMoves??[]){const profile=getLearnedMoveProfile(move.moveId,move.rank);rows.push({label:`${getMoveDefinition(move.moveId)!.name} rate`,before:rate(attackInterval(profile.cooldown,before.haste)),after:rate(attackInterval(profile.cooldown,after.haste))});}
 }
 if(after.stamina!==before.stamina||after.staminaRechargeReduction!==before.staminaRechargeReduction)rows.push({label:'Dodge cooldown',before:seconds(Math.max(.01,DESIGN.dodgeCooldown*(1-before.staminaRechargeReduction)/(1+before.stamina))),after:seconds(Math.max(.01,DESIGN.dodgeCooldown*(1-after.staminaRechargeReduction)/(1+after.stamina)))});
 if((after.specialHaste!==before.specialHaste||after.specialRate!==before.specialRate)&&leader){const special=getSpecialProfile(leader.speciesId,leader.attackLevel),berry=Math.max(.2,1-.2*(state.berryBuffs?.leppa?.length??0));rows.push({label:leader===state.party[0]?'Q cooldown':'Special cooldown',before:seconds(specialInterval(special.cooldown,before.specialHaste,before.specialRate)*berry),after:seconds(specialInterval(special.cooldown,after.specialHaste,after.specialRate)*berry)});}
 if(choice.stat==='health')rows.push({label:personal?'Pokémon max HP':'Leader max HP',before:String(Number((personal??state.player).maxHp.toFixed(1))),after:String(Number((projectedPersonal??projected.player).maxHp.toFixed(1)))});
 return rows;
}
