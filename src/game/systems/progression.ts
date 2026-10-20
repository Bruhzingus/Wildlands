import {GATED_RECRUIT_SPECIES} from '../../data/rosterContent.ts';
import {evolutionRule,evolutionRequirement} from '../../data/evolutions.ts';
import {DESIGN} from '../../data/config.ts';
import {describeAttackUpgrade,getAttackProfile,type AttackDefinition} from '../../data/attacks.ts';
import {describeSpecialUpgrade,getSpecialProfile} from '../../data/specials.ts';
import {ITEMS,getItemDefinition,type BuildStat} from '../../data/items.ts';
import {getLearnedMoveProfile,getMoveDefinition,learnableMoves,learnedMovePower,MAX_LEARNED_MOVES} from '../../data/moves.ts';
import {getSpecies,RECRUIT_POOL,type Species} from '../../data/kanto.ts';
import {PROGRESSION,TRAINING_UPGRADES,TRAINING_RARITY_MULTIPLIERS,type TrainingUpgrade} from '../../data/progression.ts';
import {RNG} from '../../utils/random.ts';
import {BUILD_STAT_CAPS,getBuildModifiers} from './builds.ts';
import type {LootRarity,PartyMember,RewardSource,RunState,UpgradeChoice} from '../types.ts';

export {ITEMS} from '../../data/items.ts';

export function xpThreshold(level:number):number {
 const {xpBase,xpLinear,xpQuadratic}=PROGRESSION.leveling;
 return Math.round(xpBase+xpLinear*level+xpQuadratic*level*level);
}

function inEvolutionLine(root:Species,speciesId:number):boolean {
 return root.id===speciesId||root.evolvesTo.some(id=>inEvolutionLine(getSpecies(id),speciesId));
}

function recruitPool(state:RunState):Species[] {
 const unlocks=state.recruitUnlocks;
 return RECRUIT_POOL.filter(species=>species.stage===1&&(!unlocks||!GATED_RECRUIT_SPECIES.includes(species.id)||unlocks.includes(species.id))&&!state.party.some(member=>inEvolutionLine(species,member.speciesId)));
}

export function canRecruit(state:RunState):boolean {
 const n=state.recruitCount;
 return Number.isInteger(n)&&n>=0&&n<DESIGN.recruitUnlockSeconds.length&&
  state.party.length<DESIGN.maxParty&&state.stats.elapsed>=DESIGN.recruitUnlockSeconds[n]&&
  state.stats.level>=DESIGN.recruitUnlockLevels[n]&&recruitPool(state).length>0;
}

export function eligibleEvolutions(state:RunState):number[] {
 return state.party.filter(member=>{
  const species=getSpecies(member.speciesId);
  return member.hp>0&&member.level<PROGRESSION.leveling.trainingFocusLevel&&species.evolvesTo.some(targetId=>{
   const rule=evolutionRule(species.id,targetId)!;
   return member.level>=rule.level&&state.stats.elapsed-(member.evolvedAt??member.joinedAt)>=rule.maturitySeconds;
  });
 }).map(member=>member.uid);
}

export function maxMoveRank(species:Species):number {
 return species.stage===1&&!species.evolvesTo.length?PROGRESSION.moves.soloMaxRank:PROGRESSION.moves.maxRank;
}

export function moveRankGain(_state:RunState,member:PartyMember,_fromRank=member.attackLevel):number {
 const species=getSpecies(member.speciesId);
 const gain=species.stage===1&&!species.evolvesTo.length&&member.level>=PROGRESSION.moves.soloTrainingLevel?PROGRESSION.moves.soloRankGain:1;
 return gain;
}

function growthDescription(species:Species):string {
 return species.stage===1&&!species.evolvesTo.length?
  `Single-stage mastery: moves keep growing; training grants +${PROGRESSION.moves.soloRankGain} ranks from Pokémon level ${PROGRESSION.moves.soloTrainingLevel}.`:
  `Evolution grants +${PROGRESSION.evolution.healthGain*100}% maximum HP, +${PROGRESSION.evolution.powerGain*100}% permanent attack damage and +${PROGRESSION.evolution.moveRankGain} rank to every known move.`;
}

export function trainingRank(state:RunState,upgrade:TrainingUpgrade):number {
 return state.trainingRanks?.[upgrade.id]??Math.max(0,Math.floor(((state.buffs[upgrade.stat]||0)+1e-9)/upgrade.amount));
}

function trainingChoices(state:RunState):UpgradeChoice[] {
 return TRAINING_UPGRADES.flatMap(upgrade=>(['common','rare','epic'] as const).map(rarity=>{
  const rank=trainingRank(state,upgrade)+1,amount=Number((upgrade.amount*TRAINING_RARITY_MULTIPLIERS[rarity]).toFixed(4));
  const description=upgrade.description.replace(/\d+%/,`${Math.round(amount*100)}%`);
  return {id:rarity==='common'?upgrade.id:`${upgrade.id}-${rarity}`,kind:'stat' as const,stat:upgrade.stat,amount,
   title:upgrade.title,description,rarity,category:'training',rank};
 }));
}

function levelUpMembers(state:RunState):PartyMember[] {
 const owner=state.levelUpMemberId===undefined?state.party[0]:state.party.find(member=>member.uid===state.levelUpMemberId);
 return owner?[owner]:[];
}

function moveChoices(state:RunState):UpgradeChoice[] {
 return levelUpMembers(state).flatMap(member=>{
  const species=getSpecies(member.speciesId),gain=moveRankGain(state,member),rank=member.attackLevel+gain;
  if(gain<=0||member.hp<=0)return [];
  return [{id:`attack-${member.uid}-${member.attackLevel}`,kind:'attack' as const,speciesId:member.uid,
   sourceSpeciesId:species.id,amount:gain,rank,category:'move',
   title:`${species.moveName} ${toRoman(rank)}`,
   description:`${species.name}: rank ${member.attackLevel} to ${rank}. ${describeAttackUpgrade(species.id,member.attackLevel,rank)}${member===state.party[0]?' '+describeSpecialUpgrade(species.id,member.attackLevel,rank):''}${gain>1?` Single-stage mastery: +${gain} ranks per training choice.`:''}`,
   rarity:member.attackLevel>=4||gain>1?'rare' as const:'common' as const}];
 });
}

export function learnedMoveSlots(member:PartyMember):number {
 return Math.min(MAX_LEARNED_MOVES,PROGRESSION.moves.learnedSlots,PROGRESSION.moves.learnLevels.filter(level=>member.level>=level).length);
}

function learnedMoveChoices(state:RunState):UpgradeChoice[] {
 return levelUpMembers(state).flatMap(member=>{
  if(member.hp<=0)return [];
  const species=getSpecies(member.speciesId),known=member.learnedMoves||[],choices:UpgradeChoice[]=[];
  if(member.level<PROGRESSION.leveling.trainingFocusLevel&&known.length<learnedMoveSlots(member))for(const move of learnableMoves(species.id,member.level)){
   if(known.some(learned=>learned.moveId===move.id))continue;
   choices.push({id:`learn-${member.uid}-${move.id}`,kind:'learn',speciesId:member.uid,sourceSpeciesId:species.id,
    moveId:move.id,title:move.name,description:`${species.name} learns move ${known.length+2}/4. ${move.description} Independent ${move.profile.cooldown.toFixed(1)}s cooldown.`,
    rarity:'rare',category:'new-move',rank:1});
  }
  for(const learned of known){
   const move=getMoveDefinition(learned.moveId),gain=moveRankGain(state,member,learned.rank);if(!move||gain<=0)continue;
   const rank=learned.rank+gain,from=getLearnedMoveProfile(move.id,learned.rank),to=getLearnedMoveProfile(move.id,rank);
   const powerGain=(learnedMovePower(move.id,rank)/learnedMovePower(move.id,learned.rank)-1)*100;
   const cooldownReduction=(1-to.cooldown/from.cooldown)*100,reachGain=(to.range/from.range-1)*100;
   const extras=[to.projectiles>from.projectiles?`+${to.projectiles-from.projectiles} projectile`:null,
    to.chains>from.chains?`+${to.chains-from.chains} chain target`:null].filter(Boolean);
   choices.push({id:`move-${member.uid}-${move.id}-${learned.rank}`,kind:'attack',speciesId:member.uid,sourceSpeciesId:species.id,
    moveId:move.id,amount:gain,title:`${move.name} ${toRoman(rank)}`,description:`${species.name}: +${powerGain.toFixed(1)}% damage, ${cooldownReduction.toFixed(1)}% shorter cooldown, +${reachGain.toFixed(1)}% reach${extras.length?`, ${extras.join(', ')}`:''}. Rank ${learned.rank} to ${rank}.${gain>1?` Single-stage mastery: +${gain} ranks per training choice.`:''}`,
    rarity:rank>=4||gain>1?'rare':'common',category:'move',rank});
  }
  return choices;
 });
}

function matchingSignatureMoves(member:PartyMember,target:Species) {
 return (member.learnedMoves||[]).filter(learned=>getMoveDefinition(learned.moveId)?.name===target.moveName);
}

function evolutionChoices(state:RunState):UpgradeChoice[] {
 const eligible=new Set(eligibleEvolutions(state));
 return levelUpMembers(state).filter(member=>eligible.has(member.uid)).flatMap(member=>{
  const species=getSpecies(member.speciesId);
  return species.evolvesTo.map(targetId=>{
   const target=getSpecies(targetId),merged=matchingSignatureMoves(member,target);
   const training=merged.length?
    `Keeps its level and XP. ${target.moveName} merges into its signature attack at rank ${Math.max(member.attackLevel,...merged.map(move=>move.rank))+PROGRESSION.evolution.moveRankGain}, freeing ${merged.length} move slot${merged.length===1?'':'s'}.`:
    'Keeps its level, XP and trained moves.';
   return {id:`evolve-${member.uid}-${targetId}`,kind:'evolve' as const,
   speciesId:member.uid,sourceSpeciesId:species.id,targetId,title:`Evolve into ${getSpecies(targetId).name}`,
   description:`${species.name} becomes ${target.name}. ${growthDescription(species)} ${training} Four total move slots. ${evolutionRequirement(species.id,targetId)}.`,
   rarity:'epic' as const,category:'evolution'};});
 });
}

/** Roll rarity first, then a candidate in that rarity. Missing buckets are renormalized. */
export function weightedUpgradeChoices(pool:readonly UpgradeChoice[],count:number,rng:RNG,luck=0):UpgradeChoice[] {
 const remaining=[...pool],selected:UpgradeChoice[]=[];
 const rarities=['common','rare','epic'] as const;
 const safeLuck=Math.max(0,Number.isFinite(luck)?luck:0);
 while(remaining.length&&selected.length<count){
  const weights=rarities.map(rarity=>remaining.some(choice=>choice.rarity===rarity)?
   PROGRESSION.rarityWeights[rarity]*(rarity==='rare'?1+safeLuck*PROGRESSION.luckRareScale:rarity==='epic'?1+safeLuck*PROGRESSION.luckEpicScale:1):0);
  let roll=rng.next()*weights.reduce((sum,weight)=>sum+weight,0),rarity:UpgradeChoice['rarity']='common';
  for(let i=0;i<rarities.length;i++){roll-=weights[i];if(roll<0){rarity=rarities[i];break;}}
  const candidates=remaining.filter(choice=>choice.rarity===rarity),chosen=rng.pick(candidates);
  selected.push({...chosen});
  for(let i=remaining.length-1;i>=0;i--)if(remaining[i].id===chosen.id||(chosen.category==='training'&&remaining[i].category==='training'&&remaining[i].stat===chosen.stat))remaining.splice(i,1);
 }
 return selected;
}

function moveUsesModifier(profile:AttackDefinition,stat:BuildStat,currentBonus:number):boolean {
 if(stat==='chains')return profile.kind==='chain'&&!profile.pattern&&profile.chains+currentBonus<16;
 if(stat==='projectiles'){
  const usesCount=profile.pattern?!['pounce','combo'].includes(profile.pattern):['bolt','beam','lob'].includes(profile.kind);
  return usesCount&&profile.projectiles+currentBonus<12;
 }
 if(stat==='pierce'){
  if(profile.pattern==='pounce'||profile.pattern==='combo')return false;
  if(profile.pattern&&['vine','thread','sand-wave'].includes(profile.pattern))return profile.pierce+currentBonus<15;
  return (Boolean(profile.pattern)||['bolt','beam','lob'].includes(profile.kind))&&profile.pierce+currentBonus<16;
 }
 if(stat==='projectileSpeed')return profile.pattern?!['vine','thread','sand-wave','pounce','combo'].includes(profile.pattern):['bolt','beam','lob'].includes(profile.kind);
 return true;
}

/** Relics should affect a move the squad can use now, rather than promise a
 * benefit only if the player later happens to learn a compatible move. */
function itemImprovesCurrentBuild(state:RunState,id:string):boolean {
 const item=getItemDefinition(id);if(!item)return false;
 const teammates=state.party.slice(1).filter(member=>member.hp>0);
 if(!teammates.length&&item.modifiers?.length&&item.modifiers.every(modifier=>['xpCatchup','partyRegeneration','partyRegenerationPercent'].includes(modifier.stat))&&!item.effects?.length)return false;
 if(item.effects?.length)return true;
 // A conditional bonus remains useful even while its condition is inactive.
 if(item.modifiers?.some(modifier=>modifier.healthBelow!==undefined||modifier.evolution))return true;
 const living=state.party.filter((member,index)=>(index===0?state.player.hp:member.hp)>0&&
  (item.ownership!=='leader'||index===0));
 return living.some(member=>{
  const modifiers=getBuildModifiers(state,member);
  const moves=[getAttackProfile(member.speciesId,member.attackLevel),
   ...(member.learnedMoves||[]).flatMap(move=>getMoveDefinition(move.moveId)?[getLearnedMoveProfile(move.moveId,move.rank)]:[])];
  return (item.modifiers||[]).some(modifier=>{
   const stat=modifier.stat;
   if(modifier.amount<=0||modifiers[stat]>=BUILD_STAT_CAPS[stat]-1e-9)return false;
   if(stat==='partyRegeneration'||stat==='partyRegenerationPercent')return member!==state.party[0];
   if(stat==='projectiles'&&member===state.party[0]){
    const special=getSpecialProfile(member.speciesId,member.attackLevel);
    if(['quickstep','web','foxfire','payday','volley'].includes(special.kind)&&special.projectiles+modifiers.projectiles<12)return true;
   }
   return moves.some(profile=>moveUsesModifier(profile,stat,modifiers[stat]));
  });
 });
}

export function availableItemChoices(state:RunState):UpgradeChoice[] {
 return ITEMS.filter(item=>(!state.itemUnlocks||state.itemUnlocks.includes(item.id))&&!state.items.includes(item.id)&&itemImprovesCurrentBuild(state,item.id)).map(item=>({...item,description:state.party.length===1?item.description.replace(/squad/g,'Pokémon'):item.description,category:'item'}));
}

/** Paid treasure prioritizes relics at the advertised rarity or better. Training
 * fills empty slots only after eligible relics run out; all cards remain valid. */
export function chestChoices(state:RunState,rng:RNG,rarity:LootRarity):UpgradeChoice[] {
 const rank={common:0,rare:1,epic:2};
 const items=availableItemChoices(state).filter(item=>rank[item.rarity]>=rank[rarity]);
 const chosen=weightedUpgradeChoices(items,3,rng,state.buffs.luck||0);
 const fallback=weightedUpgradeChoices(trainingChoices(state).filter(choice=>rank[choice.rarity]>=rank[rarity]),3-chosen.length,rng,state.buffs.luck||0);
 return [...chosen,...fallback].sort((a,b)=>rank[b.rarity]-rank[a.rarity]);
}

export function makeChoices(state:RunState,rng:RNG,source:RewardSource='level'):UpgradeChoice[] {
 state.choiceSource=source;
 state.pendingRecruit=canRecruit(state);
 if((source==='recruit'||source==='level')&&state.pendingRecruit){
  state.choiceSource='recruit';
  state.choiceTitle='Choose a new teammate';
  return rng.shuffle(recruitPool(state)).slice(0,3).map(species=>({id:`recruit-${species.id}`,kind:'recruit',speciesId:species.id,
   title:`Recruit ${species.name}`,description:`${species.types.join(' / ').toUpperCase()} · ${species.moveName}. Starts at level 1 with its own XP and four move slots. ${growthDescription(species)}`,
   rarity:'rare',category:'recruitment',rank:state.recruitCount+1,maxRank:DESIGN.recruitUnlockSeconds.length}));
 }
 if(source==='recruit')return [];
 const items=availableItemChoices(state),stats=trainingChoices(state),luck=state.buffs.luck||0;
 if(source==='cache'){
  state.choiceTitle='Discovery cache: choose an item';
  return weightedUpgradeChoices(items.length?items:stats,3,rng,luck);
 }
 if(source==='squad'||source==='shop'){
  state.choiceTitle=source==='shop'?'Supply chest: choose your purchase':'Elite reward: strengthen your squad';
  return weightedUpgradeChoices(source==='shop'?[...items,...stats]:stats,3,rng,luck);
 }
 const moves=[...moveChoices(state),...learnedMoveChoices(state)];
 const owner=levelUpMembers(state)[0];
 state.choiceTitle=owner?`${getSpecies(owner.speciesId).name} level ${owner.level}: milestone choice`:'Pokémon milestone: choose an upgrade';
 if(owner&&owner.level>=PROGRESSION.leveling.trainingFocusLevel)state.choiceTitle=`${getSpecies(owner.speciesId).name} level ${owner.level}: move and stat training`;
 const evolutions=evolutionChoices(state),chosen:UpgradeChoice[]=[];
 const upgrades=moves.filter(choice=>choice.kind==='attack');
 // Preserve every evolution branch and an alternative that keeps training.
 if(evolutions.length>1){
  state.choiceTitle=`Choose ${getSpecies(owner!.speciesId).name}'s evolution or keep training`;
  return [...evolutions,...weightedUpgradeChoices(upgrades.length?upgrades:stats,1,rng,luck)];
 }
 if(evolutions.length)chosen.push(evolutions[0]);
 // Existing moves and stats are always available; learning is an occasional option.
 chosen.push(...weightedUpgradeChoices(upgrades,1,rng,luck));
 chosen.push(...weightedUpgradeChoices(stats,1,rng,luck));
 const learning=moves.filter(choice=>choice.kind==='learn');
 if(chosen.length<3&&learning.length&&rng.next()<PROGRESSION.moves.newMoveOfferChance){
  const thematic=learning.filter(choice=>getSpecies(owner!.speciesId).types.includes(getMoveDefinition(choice.moveId!)!.element));
  chosen.push(...weightedUpgradeChoices(thematic.length&&rng.next()<.65?thematic:learning,1,rng,luck));
 }
 const remaining=stats.filter(choice=>!chosen.some(selected=>selected.stat===choice.stat));
 return rng.shuffle([...chosen,...weightedUpgradeChoices(remaining,3-chosen.length,rng,luck)]);
}

export function toRoman(n:number):string {
 n=Math.max(1,Math.floor(n));
 if(n>=40)return String(n);
 let result='';
 for(const [value,symbol] of [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']] as const){
  while(n>=value){result+=symbol;n-=value;}
 }
 return result;
}

/** Compatibility helper for single-link species; branching evolutions require an explicit card. */
export function selectEvolution(species:Species):number {return species.evolvesTo.length===1?species.evolvesTo[0]:species.id;}

export interface ChoiceResult {event:string;applied:boolean;speciesChanged?:number;sourceUid?:number;}
const unavailable=(event='Upgrade unavailable'):ChoiceResult=>({event,applied:false});

export function applyChoice(state:RunState,choice:UpgradeChoice):ChoiceResult {
 const member=state.party.find(candidate=>candidate.uid===choice.speciesId);
 if((choice.kind==='learn'||choice.kind==='attack'||choice.kind==='evolve')&&
  state.levelUpMemberId!==undefined&&member?.uid!==state.levelUpMemberId)return unavailable('This Pokémon did not level up');
 switch(choice.kind){
  case 'recruit': {
   const species=recruitPool(state).find(candidate=>candidate.id===choice.speciesId);
   if(!canRecruit(state)||!species||choice.id!==`recruit-${species.id}`||
    (choice.rank!==undefined&&choice.rank!==state.recruitCount+1))return unavailable('Recruitment unavailable');
   const uid=state.idCounter++;
   const hp=155*(1+(state.buffs.health||0));
   state.party.push({uid,speciesId:species.id,joinedAt:state.stats.elapsed,level:1,xp:0,xpToNext:xpThreshold(1),hp,maxHp:hp,iframes:0,attackLevel:1,cooldown:0,learnedMoves:[],
    x:state.player.x+1.2,z:state.player.z+1.2,facing:0,animation:'idle',attackTimer:0});
   state.stats.recruits++;state.recruitCount++;state.pendingRecruit=false;
   return {event:`${species.name} joined the party!`,applied:true,speciesChanged:species.id,sourceUid:uid};
  }
  case 'evolve': {
   if(!member||!eligibleEvolutions(state).includes(member.uid))return unavailable('Evolution unavailable');
   const old=getSpecies(member.speciesId);
   const target=choice.targetId??selectEvolution(old);
   const legacy=choice.id===`evolve-${member.uid}`&&old.stage===1&&old.evolvesTo.length===1&&choice.targetId===undefined;
   if(!old.evolvesTo.includes(target)||(!legacy&&choice.id!==`evolve-${member.uid}-${target}`)||
    (choice.sourceSpeciesId!==undefined&&choice.sourceSpeciesId!==old.id))return unavailable('Evolution unavailable');
   const targetSpecies=getSpecies(target),hpMultiplier=1+PROGRESSION.evolution.healthGain;
   const merged=matchingSignatureMoves(member,targetSpecies);
   if(merged.length){
    member.attackLevel=Math.max(member.attackLevel,...merged.map(move=>move.rank));
    member.learnedMoves=member.learnedMoves!.filter(move=>!merged.includes(move));
   }
   // Merge first so a shared signature receives the evolution bonus only once.
   const rankGain=PROGRESSION.evolution.moveRankGain;
   member.attackLevel=member.attackLevel+rankGain;
   for(const learned of member.learnedMoves||[])learned.rank=learned.rank+rankGain;
   member.speciesId=target;member.evolvedAt=state.stats.elapsed;
   member.evolutionPower=(member.evolutionPower||0)+PROGRESSION.evolution.powerGain;
   member.maxHp*=hpMultiplier;member.hp*=hpMultiplier;state.stats.evolutions++;
   if(member===state.party[0]){state.player.maxHp*=hpMultiplier;state.player.hp*=hpMultiplier;}
   const mergeEvent=merged.length?` ${targetSpecies.moveName} training merged at rank ${member.attackLevel}; ${merged.length} move slot${merged.length===1?'':'s'} freed.`:'';
   return {event:`${old.name} evolved into ${targetSpecies.name}! Known moves gained +${rankGain} rank.${mergeEvent}`,applied:true,speciesChanged:target,sourceUid:member.uid};
  }
  case 'learn': {
   if(!member||member.hp<=0||member.level>=PROGRESSION.leveling.trainingFocusLevel||!choice.moveId)return unavailable('Move unavailable');
   const move=learnableMoves(member.speciesId,member.level).find(definition=>definition.id===choice.moveId),known=member.learnedMoves||[];
   if(!move||known.length>=learnedMoveSlots(member)||known.some(learned=>learned.moveId===move.id)||
    choice.id!==`learn-${member.uid}-${move.id}`||(choice.sourceSpeciesId!==undefined&&choice.sourceSpeciesId!==member.speciesId)||
    (choice.rank!==undefined&&choice.rank!==1))return unavailable('Move unavailable');
   (member.learnedMoves??=[]).push({moveId:move.id,rank:1,cooldown:.25});
   return {event:`${getSpecies(member.speciesId).name} learned ${move.name}!`,applied:true,sourceUid:member.uid};
  }
  case 'attack': {
   if(!member||member.hp<=0)return unavailable();
   if(choice.moveId){
    const move=getMoveDefinition(choice.moveId),learned=member.learnedMoves?.find(learned=>learned.moveId===choice.moveId);
    const gain=learned?moveRankGain(state,member,learned.rank):0;
    if(!move||!learned||gain<=0||choice.amount!==gain||
     choice.id!==`move-${member.uid}-${move.id}-${learned.rank}`||
     (choice.rank!==undefined&&choice.rank!==learned.rank+gain)||(choice.sourceSpeciesId!==undefined&&choice.sourceSpeciesId!==member.speciesId))return unavailable();
    learned.rank+=gain;
    return {event:`${move.name} upgraded to rank ${learned.rank}!`,applied:true,sourceUid:member.uid};
   }
   const gain=moveRankGain(state,member),rank=member.attackLevel+gain;
   const legacy=choice.id===`attack-${member.uid}`&&choice.rank===undefined;
   if(gain<=0||(!legacy&&choice.id!==`attack-${member.uid}-${member.attackLevel}`)||choice.amount!==gain||
    (choice.rank!==undefined&&choice.rank!==rank)||(choice.sourceSpeciesId!==undefined&&choice.sourceSpeciesId!==member.speciesId))return unavailable();
   member.attackLevel=rank;
   return {event:`${getSpecies(member.speciesId).moveName} upgraded to rank ${rank}!`,applied:true,sourceUid:member.uid};
  }
  case 'item': {
   const item=ITEMS.find(candidate=>candidate.id===choice.id);
   if(!item||!itemImprovesCurrentBuild(state,item.id)||state.items.includes(item.id)||(state.itemUnlocks&&!state.itemUnlocks.includes(item.id)))return unavailable('Item unavailable');
   state.items.push(item.id);
   return {event:`Obtained ${item.title}!`,applied:true};
  }
  case 'stat': {
   const offered=trainingChoices(state).find(candidate=>candidate.id===choice.id&&candidate.stat===choice.stat&&candidate.rarity===choice.rarity);
   const upgrade=TRAINING_UPGRADES.find(candidate=>candidate.stat===choice.stat);
   if(!offered||!upgrade||choice.amount!==offered.amount||(choice.rank!==undefined&&choice.rank!==offered.rank))return unavailable();
   const rank=offered.rank!;
   const previous=state.buffs[upgrade.stat]||0;
   if(upgrade.stat==='damageReduction'){
    state.buffs.trainingDamageTaken=(state.buffs.trainingDamageTaken??Math.pow(.92,previous/.08))*(1-offered.amount!);
   }
   state.buffs[upgrade.stat]=previous+offered.amount!;
   (state.trainingRanks??={})[upgrade.id]=rank;
   if(upgrade.stat==='health'){
    const multiplier=(1+state.buffs.health)/(1+previous);
    state.player.maxHp*=multiplier;state.player.hp*=multiplier;
    for(const member of state.party){
     member.maxHp*=multiplier;member.hp*=multiplier;
    }
   }
   return {event:`${upgrade.title} rank ${rank} acquired!`,applied:true};
  }
 }
 return unavailable();
}
