import {getSpecies,type Element} from '../../data/kanto.ts';
import {getAttackProfile} from '../../data/attacks.ts';
import {getItemDefinition,type BuildEventKind,type BuildStat,type BuildStatus,type EffectAction,type EffectRule,type ItemDefinition,type StatModifier} from '../../data/items.ts';
import {getActiveSynergies} from '../../data/synergies.ts';
import type {Enemy,PartyMember,RunState} from '../types.ts';
import {memberDamage} from '../combat/damage.ts';

export type BuildModifiers=Record<BuildStat,number>;
export interface BuildRuntimeState {
 counters:Record<string,number>;cooldownUntil:Record<string,number>;
 /** Optional explicit assignments; an assigned relic follows its member and goes inactive on faint. */
 itemOwners?:Record<string,number>;
 budgetWindow:number;actionsInWindow:number;
 /** Metronome follows the shared hit stream, so swapping targets resets its ramp. */
 metronomeTargetId?:number;metronomeHits?:number;
}
export interface BuildEvent {kind:BuildEventKind;sourceId?:number;targetId?:number;damage?:number;element?:Element;depth?:number;count?:number;critTier?:number;}
interface ActionSource {sourceId:number;targetId?:number;element:Element;depth:number;}
export type BuildAction=ActionSource & (
 |{kind:'echo';damageScale:number}
 |{kind:'chain';damage:number;jumps:number;range:number;damageIsFinal?:boolean}
 |{kind:'area';damage:number;radius:number;damageIsFinal?:boolean}
 |{kind:'heal';amount:number;maxHpFraction?:number;target:'leader'|'squad'}
 |{kind:'selfDamage';amount:number}
 |{kind:'status';status:BuildStatus;duration:number;targetId:number}
 |{kind:'xp';amount:number}
 |{kind:'specialCharge';amount:number}
 |{kind:'specialCooldownPercent';amount:number}
);
export interface BuildContext {state:RunState;rng:{next():number};}
export interface BuildSummary {
 items:Array<{id:string;title:string;description:string;stacks:number}>;
 synergies:Array<{id:string;title:string;description:string}>;modifiers:BuildModifiers;caps:string[];
}
/** The shared window limits extra combat effects. Guaranteed resource changes always apply. */
export const BUILD_LIMITS={maxProcDepth:2,maxActionsPerEvent:128,windowSeconds:.1,maxActionsPerWindow:Infinity,maxEffectDamage:Infinity,maxEffectRadius:Infinity,maxEffectJumps:8,maxStatusSeconds:Infinity} as const;
export const BUILD_STAT_CAPS:BuildModifiers={staminaRechargeReduction:1,defense:Infinity,deflection:.5,staminaCapacity:Infinity,critDamagePercent:Infinity,power:Infinity,specialPower:Infinity,haste:Infinity,speed:Infinity,armor:Infinity,damageReduction:1,xp:Infinity,xpCatchup:Infinity,critChance:Infinity,critDamage:Infinity,radius:Infinity,magnet:Infinity,specialHaste:Infinity,stamina:Infinity,regeneration:Infinity,partyRegeneration:Infinity,regenerationPercent:Infinity,partyRegenerationPercent:Infinity,projectiles:Infinity,pierce:Infinity,chains:Infinity,projectileSpeed:Infinity,duration:Infinity};
const STAT_MIN:Partial<BuildModifiers>={power:-.6,haste:-1+Number.EPSILON,speed:-.5,critDamage:1,radius:-.5,projectileSpeed:-.5};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const finite=(value:number|undefined,fallback=0)=>value!==undefined&&Number.isFinite(value)?value:fallback;
const initialModifiers=():BuildModifiers=>({staminaRechargeReduction:0,defense:0,deflection:0,staminaCapacity:0,critDamagePercent:0,power:0,specialPower:0,haste:0,speed:0,armor:0,damageReduction:0,xp:0,xpCatchup:0,critChance:.05,critDamage:1.85,radius:0,magnet:0,specialHaste:0,stamina:0,regeneration:0,partyRegeneration:0,regenerationPercent:0,partyRegenerationPercent:0,projectiles:0,pierce:0,chains:0,projectileSpeed:0,duration:0});
const buffAliases:Record<string,BuildStat>={staminaRechargeReduction:'staminaRechargeReduction',defense:'defense',deflection:'deflection',staminaCapacity:'staminaCapacity',critDamagePercent:'critDamagePercent',duration:'duration',projectileSpeed:'projectileSpeed',critDamage:'critDamage',xpCatchup:'xpCatchup',projectiles:'projectiles',pierce:'pierce',chains:'chains',regeneration:'regeneration',partyRegeneration:'partyRegeneration',power:'power',specialPower:'specialPower',haste:'haste',speed:'speed',armor:'armor',damageReduction:'damageReduction',xp:'xp',crit:'critChance',radius:'radius',magnet:'magnet',stamina:'stamina',specialHaste:'specialHaste',regenerationPercent:'regenerationPercent',partyRegenerationPercent:'partyRegenerationPercent'};
export function itemStacks(state:RunState,id:string):number {
 const definition=getItemDefinition(id),count=state.itemStacks?.[id]??state.items.filter(owned=>owned===id).length;
 return definition?.stacking==='unique'?Math.min(1,count):count;
}

function ownedItems(state:RunState,source?:number):ItemDefinition[]{
 const leader=state.party[0]?.uid;
 return [...new Set(state.items)].flatMap(id=>{
  const definition=getItemDefinition(id);if(!definition)return [];
  const assignment=state.build?.itemOwners?.[id];
  if(assignment!==undefined&&(!state.party.some(member=>member.uid===assignment&&member.hp>0)||source!==undefined&&assignment!==source))return [];
  if(definition.ownership==='leader'&&source!==undefined&&source!==leader)return [];
  return [definition];
 });
}
function applyModifiers(target:BuildModifiers,modifiers:readonly StatModifier[]|undefined,state:RunState,owner:PartyMember|undefined,scale=1,penalties?:{haste:number}){
 for(const modifier of modifiers||[]){
  if(modifier.evolution){
   if(!owner)continue;
   const unevolved=getSpecies(owner.speciesId).evolvesTo.length>0;
   if((modifier.evolution==='unevolved')!==unevolved)continue;
  }
  if(modifier.healthBelow!==undefined&&state.player.hp/Math.max(1,state.player.maxHp)>=modifier.healthBelow)continue;
  const amount=finite(modifier.amount)*scale*(modifier.scale==='party'?state.party.filter(member=>member.hp>0).length:1);
  if(modifier.stat==='haste'&&modifier.amount<0&&penalties)penalties.haste*=Math.pow(1+finite(modifier.amount),scale);
  else if(modifier.stat==='damageReduction')target.damageReduction=1-(1-target.damageReduction)*Math.pow(1-finite(modifier.amount),scale);
  else target[modifier.stat]+=amount;
 }
}
function rawModifiers(state:RunState,owner?:PartyMember|number):BuildModifiers{
 const member=typeof owner==='number'?state.party.find(candidate=>candidate.uid===owner):owner||state.party[0];
 const modifiers=initialModifiers(),penalties={haste:1};
 modifiers.power+=finite(member?.evolutionPower);
 for(const [buff,stat] of Object.entries(buffAliases))if(stat!=='damageReduction')modifiers[stat]+=finite(state.buffs[buff])+finite(member?.trainingBuffs?.[buff]);
 for(const item of ownedItems(state,member?.uid))applyModifiers(modifiers,item.modifiers,state,member,itemStacks(state,item.id),penalties);
 for(const synergy of getActiveSynergies(state)){
  applyModifiers(modifiers,synergy.modifiers,state,member,1,penalties);
  const required=Math.min(...synergy.requirements.map(requirement=>requirement.count));
  applyModifiers(modifiers,synergy.extraMatchModifiers,state,member,Math.max(0,synergy.matches-required),penalties);
 }
 if(penalties.haste!==1)modifiers.haste=(1+modifiers.haste)*penalties.haste-1;
 return modifiers;
}
/** Buffs and team bonuses are included. critChance and critDamage include their base values. */
export function getBuildModifiers(state:RunState,owner?:PartyMember|number):BuildModifiers{
 const modifiers=rawModifiers(state,owner);
 // Legacy armor and reduction now contribute percentage defense growth.
 const member=typeof owner==='number'?state.party.find(candidate=>candidate.uid===owner):owner||state.party[0];
 const baseDefense=member?getSpecies(member.speciesId).defense:0;
 modifiers.defense+=Math.max(0,finite(state.buffs.damageReduction))+Math.max(0,finite(member?.trainingBuffs?.damageReduction))+modifiers.damageReduction+modifiers.armor/10;
 modifiers.armor=baseDefense*(1+modifiers.defense);
 modifiers.critDamage*=1+Math.max(0,modifiers.critDamagePercent);
 for(const stat of Object.keys(modifiers) as BuildStat[]){
  modifiers[stat]=clamp(modifiers[stat],STAT_MIN[stat]??0,BUILD_STAT_CAPS[stat]);
  if(stat==='projectiles'||stat==='pierce'||stat==='chains')modifiers[stat]=Math.floor(modifiers[stat]);
 }
 modifiers.damageReduction=0;
 return modifiers;
}
function runtime(state:RunState):BuildRuntimeState{
 return state.build??= {counters:{},cooldownUntil:{},budgetWindow:-1,actionsInWindow:0};
}
/** Returns the average damage multiplier for this hit packet and advances its shared target streak. */
export function metronomeDamageMultiplier(state:RunState,targetId:number,hits=1):number{
 const bonus=ownedItems(state).reduce((total,item)=>total+(item.consecutiveTargetDamage??0)*itemStacks(state,item.id),0);
 if(bonus<=0||!Number.isFinite(targetId))return 1;
 const build=runtime(state),count=Math.max(1,Math.floor(finite(hits,1)));
 const previous=build.metronomeTargetId===targetId?Math.max(0,build.metronomeHits??0):0;
 build.metronomeTargetId=targetId;build.metronomeHits=previous+count;
 return 1+bonus*(previous+(count-1)/2);
}
const STATUS_FIELDS:Record<BuildStatus,keyof Pick<Enemy,'stunTime'|'slowTime'|'poisonTime'|'burnTime'|'soakedTime'>>={stun:'stunTime',slow:'slowTime',poison:'poisonTime',burn:'burnTime',soaked:'soakedTime'};
function resolveAction(action:EffectAction,event:BuildEvent,state:RunState,sourceId:number,depth:number,scale=1):BuildAction|undefined{
 const source=state.party.find(member=>member.uid===sourceId);
 const element=('element' in action?action.element:undefined)||event.element||(source?getSpecies(source.speciesId).types[0]:'normal');
 const origin:ActionSource={sourceId,targetId:event.targetId,element,depth:depth+1};
 if(action.kind==='echo')return {...origin,kind:action.kind,damageScale:Math.max(0,finite(action.damageScale))*scale};
 if(action.kind==='chain'||action.kind==='area'){
  // Hit procs reuse the resolved hit; death/special procs scale with the source's move instead.
  const profile=source&&event.damage===undefined&&finite(action.damageScale)>0?getAttackProfile(source.speciesId,source.attackLevel):undefined;
  const sourceDamage=source&&profile?memberDamage(source,profile.growth.damage,getBuildModifiers(state,source).power)*profile.damageScale:0;
  const damage=Math.min(Number.MAX_VALUE,Math.max(0,(finite(action.damage)+finite(event.damage,sourceDamage)*finite(action.damageScale))*scale));
  const damageIsFinal=event.damage!==undefined&&finite(action.damageScale)>0&&!finite(action.damage);
  if(damage<=0)return;
  const radiusScale=1+getBuildModifiers(state,sourceId).radius;
  if(action.kind==='chain')return {...origin,kind:action.kind,damage,damageIsFinal,jumps:clamp(Math.floor(finite(action.jumps)),1,BUILD_LIMITS.maxEffectJumps),range:Math.max(.1,finite(action.range)*radiusScale)};
  return {...origin,kind:action.kind,damage,damageIsFinal,radius:Math.max(.1,finite(action.radius)*radiusScale)};
 }
 if(action.kind==='status'){
  if(event.targetId===undefined)return;
  const duration=clamp(finite(action.duration)*(1+getBuildModifiers(state,sourceId).duration),0,BUILD_LIMITS.maxStatusSeconds);
  return {...origin,kind:action.kind,targetId:event.targetId,status:action.status,duration};
 }
 const amount=Math.max(0,finite(action.amount))*scale;
 if(action.kind==='heal')return {...origin,kind:action.kind,amount,maxHpFraction:Math.max(0,finite(action.maxHpFraction))*scale,target:action.target};
 return {...origin,kind:action.kind,amount};
}

/** Interprets declarative rules. The simulation consumes the returned actions once. */
export function dispatchBuildEvent(context:BuildContext,event:BuildEvent):BuildAction[]{
 const {state,rng}=context,depth=finite(event.depth);
 if(depth<0||depth>=BUILD_LIMITS.maxProcDepth)return [];
 const sourceId=event.sourceId??state.party[0]?.uid;
 if(sourceId===undefined||!state.party.some(member=>member.uid===sourceId&&member.hp>0))return [];
 const build=runtime(state),now=finite(state.stats.elapsed),window=Math.floor(now/BUILD_LIMITS.windowSeconds);
 if(build.budgetWindow!==window){build.budgetWindow=window;build.actionsInWindow=0;}
 const effects:Array<{key:string;rules:readonly EffectRule[];stacks:number}>=ownedItems(state,sourceId).filter(item=>item.effects).map(item=>({key:`item:${item.id}`,rules:item.effects!,stacks:itemStacks(state,item.id)}));
 effects.push(...getActiveSynergies(state).filter(synergy=>synergy.effects).map(synergy=>({key:`synergy:${synergy.id}`,rules:synergy.effects!,stacks:1})));
 const result:BuildAction[]=[];
 for(const {key,rules,stacks} of effects)for(let index=0;index<rules.length;index++){
  const rule=rules[index];
  if(rule.event!==event.kind||depth>(rule.maxDepth??0)||rule.element&&rule.element!==event.element)continue;
  if(rule.targetStatus){
   const target=state.enemies.find(enemy=>enemy.uid===event.targetId);
   if(!target||target[STATUS_FIELDS[rule.targetStatus]]<=0)continue;
  }
  const counterKey=`${key}:${index}:${rule.counter==='source'?sourceId:'squad'}`;
  const occurrences=Math.max(1,event.count??1);let triggers=occurrences;
  if(rule.every){const count=(build.counters[counterKey]||0)+occurrences;build.counters[counterKey]=count%rule.every;triggers=Math.floor(count/rule.every);}
  if(!triggers)continue;
  if((build.cooldownUntil[counterKey]??-1)>now)continue;
  if(result.length>=BUILD_LIMITS.maxActionsPerEvent)continue;
  if(rule.cooldown)triggers=1;
  if(rule.chance!==undefined){
   const chance=1-Math.pow(1-rule.chance,stacks),expected=triggers*chance,whole=Math.floor(expected);
   triggers=whole+(rng.next()<expected-whole?1:0);if(!triggers)continue;
  }
  const perHit=event.damage===undefined?event:{...event,damage:event.damage/occurrences};
  const resolved=resolveAction(rule.action,perHit,state,sourceId,depth,(rule.action.kind==='status'?1:stacks)*triggers);if(!resolved)continue;
  if(rule.cooldown)build.cooldownUntil[counterKey]=now+rule.cooldown;
  result.push(resolved);build.actionsInWindow++;
 }
 return result;
}

export function getBuildSummary(state:RunState):BuildSummary{
 const modifiers=getBuildModifiers(state);
 return {
  items:ownedItems(state).map(item=>({id:item.id,title:item.title,description:item.description,stacks:itemStacks(state,item.id)})),
  synergies:getActiveSynergies(state).map(({id,title,description})=>({id,title,description})),modifiers,caps:[],
 };
}
