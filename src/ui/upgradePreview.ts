import type {BuildStat} from '../data/items.ts';
import type {RunState,UpgradeChoice} from '../game/types.ts';
import {getBuildModifiers,itemStacks} from '../game/systems/builds.ts';
import {applyChoice} from '../game/systems/progression.ts';
import {getAttackProfile} from '../data/attacks.ts';
import {getSpecies} from '../data/kanto.ts';
import {getLearnedMoveProfile,getMoveDefinition} from '../data/moves.ts';
import {getSpecialProfile} from '../data/specials.ts';
import {DESIGN} from '../data/config.ts';
import {attackInterval} from '../game/combat/cadence.ts';
import {movementTraitLabel} from '../data/movementTraits.ts';

export const formatPercent=(value:number)=>`${Number((value*100).toFixed(2))}%`;
const labels:Partial<Record<BuildStat,string>>={staminaRechargeReduction:'Stamina recharge time reduction',defense:'Defense bonus',deflection:'Deflection chance',staminaCapacity:'Extra dodge charges',critDamagePercent:'Critical damage bonus',power:'Damage bonus',haste:'Attack speed bonus',speed:'Movement bonus',
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
 const projected:RunState={...state,buffs:{...state.buffs},trainingRanks:{...state.trainingRanks},
  player:{...state.player},party:state.party.map(member=>({...member})),items:[...state.items],itemStacks:{...state.itemStacks}};
 if(!applyChoice(projected,choice).applied)return [];
 const before=getBuildModifiers(state),after=getBuildModifiers(projected),rows:StatPreview[]=[];
 if(choice.kind==='item')rows.push({label:'Copies',before:String(itemStacks(state,choice.id)),after:String(itemStacks(projected,choice.id))});
 if(choice.stat==='health')rows.push({label:'Max HP bonus',before:formatPercent(state.buffs.health||0),after:formatPercent(projected.buffs.health||0)});
 for(const [key,label] of Object.entries(labels)){
  const stat=key as BuildStat;
  if(Math.abs(before[stat]-after[stat])<1e-12)continue;
  const format=stat==='critDamage'?(value:number)=>`${Number(value.toFixed(3))}×`:flat.has(stat)?(value:number)=>String(Number(value.toFixed(2))):formatPercent;
  rows.push({label:label!,before:format(before[stat]),after:format(after[stat])});
 }
 const leader=state.party[0],rate=(interval:number)=>`${Number((1/interval).toFixed(2))} / sec`,seconds=(value:number)=>`${Number(value.toFixed(2))}s`;
 if(after.haste!==before.haste&&leader){
  const profile=getAttackProfile(leader.speciesId,leader.attackLevel);
  rows.push({label:`${getSpecies(leader.speciesId).moveName} rate`,before:rate(attackInterval(profile.cooldown,before.haste,leader.attackLevel)),after:rate(attackInterval(profile.cooldown,after.haste,leader.attackLevel))});
  for(const move of leader.learnedMoves??[]){const profile=getLearnedMoveProfile(move.moveId,move.rank);rows.push({label:`${getMoveDefinition(move.moveId)!.name} rate`,before:rate(attackInterval(profile.cooldown,before.haste)),after:rate(attackInterval(profile.cooldown,after.haste))});}
 }
 if(after.stamina!==before.stamina||after.staminaRechargeReduction!==before.staminaRechargeReduction)rows.push({label:'Dodge cooldown',before:seconds(Math.max(.01,DESIGN.dodgeCooldown*(1-before.staminaRechargeReduction)/(1+before.stamina))),after:seconds(Math.max(.01,DESIGN.dodgeCooldown*(1-after.staminaRechargeReduction)/(1+after.stamina)))});
 if(after.specialHaste!==before.specialHaste&&leader){const special=getSpecialProfile(leader.speciesId,leader.attackLevel);rows.push({label:'Q cooldown',before:seconds(special.cooldown/(1+before.specialHaste)),after:seconds(special.cooldown/(1+after.specialHaste))});}
 if(choice.stat==='health')rows.push({label:'Leader max HP',before:String(Number(state.player.maxHp.toFixed(1))),after:String(Number(projected.player.maxHp.toFixed(1)))});
 return rows;
}
