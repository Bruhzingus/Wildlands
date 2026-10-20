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
}
export interface BuildEvent {kind:BuildEventKind;sourceId?:number;targetId?:number;damage?:number;element?:Element;depth?:number;}
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
);
export interface BuildContext {state:RunState;rng:{next():number};}
export interface BuildSummary {
 items:Array<{id:string;title:string;description:string;stacks:number}>;
 synergies:Array<{id:string;title:string;description:string}>;modifiers:BuildModifiers;caps:string[];
}
/** The shared window limits extra combat effects. Guaranteed resource changes always apply. */
export const BUILD_LIMITS={maxProcDepth:2,maxActionsPerEvent:8,windowSeconds:.1,maxActionsPerWindow:12,maxEffectDamage:2000,maxEffectRadius:12,maxEffectJumps:8,maxStatusSeconds:8} as const;
export const BUILD_STAT_CAPS:BuildModifiers={power:Infinity,haste:Infinity,speed:Infinity,armor:12,damageReduction:.6,xp:1.5,xpCatchup:1,critChance:1,critDamage:Infinity,radius:Infinity,magnet:10,specialHaste:Infinity,stamina:Infinity,regeneration:12,partyRegeneration:6,regenerationPercent:.04,partyRegenerationPercent:.03,projectiles:3,pierce:6,chains:6,projectileSpeed:1,duration:1.5};
const CAP_DESCRIPTIONS:Record<BuildStat,string>={
 power:'Damage bonus capped at +400%',haste:'Attack speed bonus capped at +400%',speed:'Movement speed bonus capped at +75%',
 armor:'Armor capped at 12',damageReduction:'Damage reduction capped at 60%',xp:'XP bonus capped at +150%',xpCatchup:'Catch-up XP bonus capped at +100%',critChance:'Critical chance capped at 80%',critDamage:'Critical damage capped at 4x',
 radius:'Attack range and area bonus capped at +125%',magnet:'Pickup radius bonus capped at +10m',specialHaste:'Special recharge bonus capped at +150%',stamina:'Dodge recovery bonus capped at +150%',
 regeneration:'Leader recovery capped at 12 HP/s',partyRegeneration:'Follower recovery capped at 6 HP/s',regenerationPercent:'Leader recovery capped at 4% max HP/s',partyRegenerationPercent:'Follower recovery capped at 3% max HP/s',projectiles:'Extra projectiles capped at +3',
 pierce:'Extra projectile pierces capped at +6',chains:'Extra chain jumps capped at +6',projectileSpeed:'Projectile speed bonus capped at +100%',duration:'Status duration bonus capped at +150%',
};
const STAT_MIN:Partial<BuildModifiers>={power:-.6,haste:-.65,speed:-.5,critDamage:1,radius:-.5,projectileSpeed:-.5};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const finite=(value:number|undefined,fallback=0)=>value!==undefined&&Number.isFinite(value)?value:fallback;
const initialModifiers=():BuildModifiers=>({power:0,haste:0,speed:0,armor:0,damageReduction:0,xp:0,xpCatchup:0,critChance:.05,critDamage:1.85,radius:0,magnet:0,specialHaste:0,stamina:0,regeneration:0,partyRegeneration:0,regenerationPercent:0,partyRegenerationPercent:0,projectiles:0,pierce:0,chains:0,projectileSpeed:0,duration:0});
const buffAliases:Record<string,BuildStat>={power:'power',haste:'haste',speed:'speed',armor:'armor',damageReduction:'damageReduction',xp:'xp',crit:'critChance',radius:'radius',magnet:'magnet',stamina:'stamina',specialHaste:'specialHaste',regenerationPercent:'regenerationPercent',partyRegenerationPercent:'partyRegenerationPercent'};

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
function applyModifiers(target:BuildModifiers,modifiers:readonly StatModifier[]|undefined,state:RunState,owner:PartyMember|undefined,scale=1){
 for(const modifier of modifiers||[]){
  if(modifier.evolution){
   if(!owner)continue;
   const unevolved=getSpecies(owner.speciesId).evolvesTo.length>0;
   if((modifier.evolution==='unevolved')!==unevolved)continue;
  }
  if(modifier.healthBelow!==undefined&&state.player.hp/Math.max(1,state.player.maxHp)>=modifier.healthBelow)continue;
  const amount=finite(modifier.amount)*scale*(modifier.scale==='party'?state.party.filter(member=>member.hp>0).length:1);
  target[modifier.stat]+=amount;
 }
}
function rawModifiers(state:RunState,owner?:PartyMember|number):BuildModifiers{
 const member=typeof owner==='number'?state.party.find(candidate=>candidate.uid===owner):owner||state.party[0];
 const modifiers=initialModifiers();
 modifiers.power+=finite(member?.evolutionPower);
 for(const [buff,stat] of Object.entries(buffAliases))modifiers[stat]+=finite(state.buffs[buff]);
 for(const item of ownedItems(state,member?.uid))applyModifiers(modifiers,item.modifiers,state,member);
 for(const synergy of getActiveSynergies(state)){
  applyModifiers(modifiers,synergy.modifiers,state,member);
  const required=Math.min(...synergy.requirements.map(requirement=>requirement.count));
  applyModifiers(modifiers,synergy.extraMatchModifiers,state,member,Math.max(0,synergy.matches-required));
 }
 return modifiers;
}
/** Buffs and team bonuses are included. critChance and critDamage include their base values. */
export function getBuildModifiers(state:RunState,owner?:PartyMember|number):BuildModifiers{
 const modifiers=rawModifiers(state,owner);
 // Training remains useful indefinitely. Defense stacks multiply remaining
 // incoming damage; critical chance above 100% adds critical damage instead.
 const defense=Math.max(0,finite(state.buffs.damageReduction));
 const damageTaken=finite(state.buffs.trainingDamageTaken,Math.pow(.92,defense/.08));
 const reduction=1-(1-clamp(modifiers.damageReduction-defense,0,BUILD_STAT_CAPS.damageReduction))*damageTaken;
 const criticalOverflow=Math.max(0,modifiers.critChance-1);
 modifiers.critDamage+=criticalOverflow;
 for(const stat of Object.keys(modifiers) as BuildStat[]){
  modifiers[stat]=clamp(modifiers[stat],STAT_MIN[stat]??0,BUILD_STAT_CAPS[stat]);
  if(stat==='projectiles'||stat==='pierce'||stat==='chains')modifiers[stat]=Math.floor(modifiers[stat]);
 }
 modifiers.damageReduction=reduction;
 return modifiers;
}
function runtime(state:RunState):BuildRuntimeState{
 return state.build??= {counters:{},cooldownUntil:{},budgetWindow:-1,actionsInWindow:0};
}
const STATUS_FIELDS:Record<BuildStatus,keyof Pick<Enemy,'stunTime'|'slowTime'|'poisonTime'|'burnTime'|'soakedTime'>>={stun:'stunTime',slow:'slowTime',poison:'poisonTime',burn:'burnTime',soaked:'soakedTime'};
function usesOffensiveBudget(rule:EffectRule):boolean {
 return rule.action.kind==='echo'||rule.action.kind==='chain'||rule.action.kind==='area'||rule.action.kind==='status'||
  rule.chance!==undefined&&rule.chance<1;
}
function resolveAction(action:EffectAction,event:BuildEvent,state:RunState,sourceId:number,depth:number):BuildAction|undefined{
 const source=state.party.find(member=>member.uid===sourceId);
 const element=('element' in action?action.element:undefined)||event.element||(source?getSpecies(source.speciesId).types[0]:'normal');
 const origin:ActionSource={sourceId,targetId:event.targetId,element,depth:depth+1};
 if(action.kind==='echo')return {...origin,kind:action.kind,damageScale:clamp(finite(action.damageScale),0,2)};
 if(action.kind==='chain'||action.kind==='area'){
  // Hit procs reuse the resolved hit; death/special procs scale with the source's move instead.
  const profile=source&&event.damage===undefined&&finite(action.damageScale)>0?getAttackProfile(source.speciesId,source.attackLevel):undefined;
  const sourceDamage=source&&profile?memberDamage(source,profile.growth.damage,getBuildModifiers(state,source).power)*profile.damageScale:0;
  const damage=clamp(finite(action.damage)+finite(event.damage,sourceDamage)*finite(action.damageScale),0,BUILD_LIMITS.maxEffectDamage);
  const damageIsFinal=event.damage!==undefined&&finite(action.damageScale)>0&&!finite(action.damage);
  if(damage<=0)return;
  if(action.kind==='chain')return {...origin,kind:action.kind,damage,damageIsFinal,jumps:clamp(Math.floor(finite(action.jumps)),1,BUILD_LIMITS.maxEffectJumps),range:clamp(finite(action.range),.1,BUILD_LIMITS.maxEffectRadius)};
  return {...origin,kind:action.kind,damage,damageIsFinal,radius:clamp(finite(action.radius),.1,BUILD_LIMITS.maxEffectRadius)};
 }
 if(action.kind==='status'){
  if(event.targetId===undefined)return;
  const duration=clamp(finite(action.duration)*(1+getBuildModifiers(state,sourceId).duration),0,BUILD_LIMITS.maxStatusSeconds);
  return {...origin,kind:action.kind,targetId:event.targetId,status:action.status,duration};
 }
 const amount=clamp(finite(action.amount),0,action.kind==='xp'?500:100);
 if(action.kind==='heal')return {...origin,kind:action.kind,amount,maxHpFraction:clamp(finite(action.maxHpFraction),0,1),target:action.target};
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
 const effects:Array<{key:string;rules:readonly EffectRule[]}>=ownedItems(state,sourceId).filter(item=>item.effects).map(item=>({key:`item:${item.id}`,rules:item.effects!}));
 effects.push(...getActiveSynergies(state).filter(synergy=>synergy.effects).map(synergy=>({key:`synergy:${synergy.id}`,rules:synergy.effects!})));
 const result:BuildAction[]=[];
 for(const {key,rules} of effects)for(let index=0;index<rules.length;index++){
  const rule=rules[index];
  if(rule.event!==event.kind||depth>(rule.maxDepth??0)||rule.element&&rule.element!==event.element)continue;
  if(rule.targetStatus){
   const target=state.enemies.find(enemy=>enemy.uid===event.targetId);
   if(!target||target[STATUS_FIELDS[rule.targetStatus]]<=0)continue;
  }
  const counterKey=`${key}:${index}:${rule.counter==='source'?sourceId:'squad'}`;
  if(rule.every){
   const count=(build.counters[counterKey]||0)+1;build.counters[counterKey]=count%rule.every;
   if(count%rule.every!==0)continue;
  }
  if((build.cooldownUntil[counterKey]??-1)>now)continue;
  const budgeted=usesOffensiveBudget(rule);
  if(result.length>=BUILD_LIMITS.maxActionsPerEvent||budgeted&&build.actionsInWindow>=BUILD_LIMITS.maxActionsPerWindow)continue;
  if(rule.chance!==undefined&&rng.next()>=rule.chance)continue;
  const resolved=resolveAction(rule.action,event,state,sourceId,depth);if(!resolved)continue;
  if(rule.cooldown)build.cooldownUntil[counterKey]=now+rule.cooldown;
  result.push(resolved);if(budgeted)build.actionsInWindow++;
 }
 return result;
}

export function getBuildSummary(state:RunState):BuildSummary{
 const raw=rawModifiers(state),modifiers=getBuildModifiers(state);
 raw.damageReduction-=Math.max(0,finite(state.buffs.damageReduction));
 const caps=(Object.keys(raw) as BuildStat[]).filter(stat=>stat!=='critChance'&&raw[stat]>BUILD_STAT_CAPS[stat]).map(stat=>CAP_DESCRIPTIONS[stat]);
 return {
  items:ownedItems(state).map(item=>({id:item.id,title:item.title,description:item.description,stacks:1})),
  synergies:getActiveSynergies(state).map(({id,title,description})=>({id,title,description})),modifiers,caps,
 };
}
