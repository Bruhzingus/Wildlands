import {getSpecies,type AttackKind,type Element} from './kanto.ts';
import type {RunState} from '../game/types.ts';
import type {EffectRule,StatModifier} from './items.ts';

export type TeamRequirement=
 |{kind:'type';type:Element;count:number}
 |{kind:'attack';attacks:readonly AttackKind[];count:number}
 |{kind:'sharedType';count:number};
export interface SynergyDefinition {
 id:string;title:string;description:string;minimumParty:number;requirements:readonly TeamRequirement[];
 modifiers?:readonly StatModifier[];effects?:readonly EffectRule[];
 /** An extra matching member adds this much above the required match count. */
 extraMatchModifiers?:readonly StatModifier[];
}
export interface ActiveSynergy extends SynergyDefinition {matches:number;members:number[];}
const PARTY_SYNERGY_CACHE=new WeakMap<object,{signature:string;active:readonly ActiveSynergy[]}>();

export const SYNERGIES:readonly SynergyDefinition[]=[
 {id:'elemental-bond',title:'Elemental Bond',description:'2 members sharing a type: +12% damage, then +3.5% per additional matching member.',minimumParty:2,requirements:[{kind:'sharedType',count:2}],modifiers:[{stat:'power',amount:.12}],extraMatchModifiers:[{stat:'power',amount:.035}]},
 {id:'storm-circuit',title:'Storm Circuit',description:'2 Electric members: chain attacks jump to +2 enemies; +4% critical chance.',minimumParty:2,requirements:[{kind:'type',type:'electric',count:2}],modifiers:[{stat:'chains',amount:2},{stat:'critChance',amount:.04}]},
 {id:'conductive-tide',title:'Conductive Tide',description:'Water + Electric: Electric hits against soaked targets have an 18% chance to arc for 25% damage to 2 enemies. 0.6s cooldown.',minimumParty:2,requirements:[{kind:'type',type:'water',count:1},{kind:'type',type:'electric',count:1}],effects:[{event:'onHit',element:'electric',targetStatus:'soaked',chance:.18,cooldown:.6,action:{kind:'chain',damageScale:.25,jumps:2,range:4.7,element:'electric'}}]},
 {id:'wildfire',title:'Wildfire',description:'Grass + Fire: +20% attack range and area radius; +25% status duration.',minimumParty:2,requirements:[{kind:'type',type:'grass',count:1},{kind:'type',type:'fire',count:1}],modifiers:[{stat:'radius',amount:.2},{stat:'duration',amount:.25}]},
 {id:'venom-flare',title:'Venom Flare',description:'Poison + Fire: Fire hits on poisoned targets have a 30% chance to burst for 30% damage in 2.5m. 1s cooldown.',minimumParty:2,requirements:[{kind:'type',type:'poison',count:1},{kind:'type',type:'fire',count:1}],effects:[{event:'onHit',element:'fire',targetStatus:'poison',chance:.3,cooldown:1,action:{kind:'area',damageScale:.3,radius:2.5,element:'fire'}}]},
 {id:'permafrost',title:'Permafrost',description:'Water + Ice: hits have a 20% chance to slow for 1.8s. 0.3s cooldown.',minimumParty:2,requirements:[{kind:'type',type:'water',count:1},{kind:'type',type:'ice',count:1}],effects:[{event:'onHit',chance:.2,cooldown:.3,action:{kind:'status',status:'slow',duration:1.8}}]},
 {id:'shadow-focus',title:'Shadow Focus',description:'Psychic + Ghost: +12% critical chance and +0.3 critical damage multiplier.',minimumParty:2,requirements:[{kind:'type',type:'psychic',count:1},{kind:'type',type:'ghost',count:1}],modifiers:[{stat:'critChance',amount:.12},{stat:'critDamage',amount:.3}]},
 {id:'guardian-line',title:'Guardian Line',description:'Rock + Ground: +2 squad armor.',minimumParty:2,requirements:[{kind:'type',type:'rock',count:1},{kind:'type',type:'ground',count:1}],modifiers:[{stat:'armor',amount:2}]},
 {id:'fighting-spirit',title:'Fighting Spirit',description:'Fighting + Normal: +16% squad attack speed.',minimumParty:2,requirements:[{kind:'type',type:'fighting',count:1},{kind:'type',type:'normal',count:1}],modifiers:[{stat:'haste',amount:.16}]},
 {id:'restorative-roots',title:'Restorative Roots',description:'Grass + a healing attacker: restore 0.6 leader and follower HP each second.',minimumParty:2,requirements:[{kind:'type',type:'grass',count:1},{kind:'attack',attacks:['heal'],count:1}],modifiers:[{stat:'regeneration',amount:.6},{stat:'partyRegeneration',amount:.6}]},
 {id:'wide-front',title:'Wide Front',description:'2 slash, aura or burst attackers: +20% attack range and area radius.',minimumParty:2,requirements:[{kind:'attack',attacks:['slash','aura','burst'],count:2}],modifiers:[{stat:'radius',amount:.2}]},
 {id:'critical-volley',title:'Critical Volley',description:'2 bolt or beam attackers: +0.35 critical damage multiplier.',minimumParty:2,requirements:[{kind:'attack',attacks:['bolt','beam'],count:2}],modifiers:[{stat:'critDamage',amount:.35}]},
];

/** A dual-type member fills one requirement slot; every partner contributes. */
function hasDistinctContributors(groups:number[][],requirements:readonly TeamRequirement[]):boolean {
 const slots=groups.flatMap((group,index)=>Array.from({length:requirements[index].count},()=>group)).sort((a,b)=>a.length-b.length);
 const assigned=new Set<number>();
 const assign=(index:number):boolean=>{
  if(index===slots.length)return true;
  for(const uid of slots[index]){
   if(assigned.has(uid))continue;
   assigned.add(uid);if(assign(index+1))return true;assigned.delete(uid);
  }
  return false;
 };
 return assign(0);
}

/** Cache only composition; mutation of species, member identity or living status invalidates it. */
export function getActiveSynergies(state:Pick<RunState,'party'>):readonly ActiveSynergy[]{
 const signature=state.party.map(member=>`${member.uid}:${member.speciesId}:${member.hp>0?1:0}`).join('|');
 const cached=PARTY_SYNERGY_CACHE.get(state);if(cached?.signature===signature)return cached.active;
 const members=state.party.filter(member=>member.hp>0).map(member=>({member,species:getSpecies(member.speciesId)}));
 const typeMembers=new Map<Element,number[]>();
 for(const {member,species} of members)for(const type of species.types){const matching=typeMembers.get(type)||[];matching.push(member.uid);typeMembers.set(type,matching);}
 const shared=[...typeMembers.values()].sort((a,b)=>b.length-a.length)[0]||[];
 const active:ActiveSynergy[]=[];
 for(const definition of SYNERGIES){
  if(members.length<definition.minimumParty)continue;
  const groups=definition.requirements.map(requirement=>{
   if(requirement.kind==='sharedType')return shared;
   if(requirement.kind==='type')return typeMembers.get(requirement.type)||[];
   return members.filter(({species})=>requirement.attacks.includes(species.attack)).map(({member})=>member.uid);
  });
  if(!groups.every((group,index)=>group.length>=definition.requirements[index].count)||!hasDistinctContributors(groups,definition.requirements))continue;
  const matches=Math.min(...groups.map(group=>group.length));
  active.push({...definition,matches,members:[...new Set(groups.flat())]});
 }
 const result=Object.freeze(active);PARTY_SYNERGY_CACHE.set(state,{signature,active:result});return result;
}
