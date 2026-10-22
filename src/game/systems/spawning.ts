import {getEnemySpeciesProfile} from '../../data/enemySpecies.ts';
import {ENEMY_TIER_TUNING,getEnemyTier,type EnemyTier} from '../../data/enemyTiers.ts';
import {ELITE_THREAT,maximumEncounterThreat,selectEncounter,type SpeciesTier} from '../../data/encounters.ts';
import {challengeRules} from '../../data/challenges.ts';
import {RNG,clamp} from '../../utils/random.ts';
import {DESIGN,DIFFICULTY,LATE_ENEMY_SCALING,ordinaryThreatScale} from '../../data/config.ts';
import {getVariant,SPAWN_VARIANTS,variantThreat,variantWeights} from '../../data/variants.ts';
import type {Enemy,Player,RunState,Variant,Vec2} from '../types.ts';
import {getBuildModifiers} from './builds.ts';
import {shrineDefinition,shrineXPMultiplier} from '../../data/shrines.ts';

export function averagePartyLevel(state:RunState):number {
 const living=state.party.filter((member,index)=>(index===0?state.player.hp:member.hp)>0);
 return living.length?living.reduce((sum,member)=>sum+member.level,0)/living.length:1;
}
/** Apply after durability floors so even the largest encounters receive the boost. */
export function lateEnemyScale(elapsed:number,speciesId:number,tier:EnemyTier):{health:number;damage:number} {
 const tuning=LATE_ENEMY_SCALING;
 if(elapsed<tuning.startsAt)return {health:1,damage:1};
 const progress=clamp((elapsed-tuning.startsAt)/(DESIGN.runSeconds-tuning.startsAt),0,1);
 const strength=clamp((getEnemySpeciesProfile(speciesId).strength-1)/9,0,1);
 const emphasis=1+strength*tuning.strengthWeight+(tier-1)/4*tuning.tierWeight;
 return {health:1+(tuning.healthAtStart+(tuning.healthAtEnd-tuning.healthAtStart)*progress)*emphasis,
  damage:1+(tuning.damageAtStart+(tuning.damageAtEnd-tuning.damageAtStart)*progress)*emphasis};
}
/** Time drives endurance. Party investment adds at most 20% HP and 8% damage,
 * only to newly spawned enemies; movement and attack timing remain readable. */
export function enemyProgressionScale(state:RunState):{health:number;damage:number;party:number} {
 const living=state.party.filter((member,index)=>(index===0?state.player.hp:member.hp)>0);
 const average=(value:(member:RunState['party'][number])=>number)=>living.reduce((sum,member)=>sum+value(member),0)/Math.max(1,living.length);
 const investment=Math.max(0,living.length-1)*.025+Math.max(0,average(member=>member.level)-1)*.004+
  average(member=>Math.max(0,member.attackLevel-1)+(member.learnedMoves?.length??0)*2)*.005+Math.max(0,getBuildModifiers(state).power)*.015;
 const party=clamp(investment,0,DIFFICULTY.partyHealthCap);
 const elapsed=clamp((state.stats.elapsed-120)/(DESIGN.runSeconds-120),0,1);
 return {health:(1+(DIFFICULTY.healthAt15Minutes-1)*elapsed)*(1+party),damage:1+party/DIFFICULTY.partyHealthCap*DIFFICULTY.partyDamageCap,party};
}
export function rollVariant(rng:RNG,elapsed:number,weights?:Partial<Record<Variant,number>>):Variant{
 const table=weights??variantWeights(elapsed);
 const valid=SPAWN_VARIANTS.map(variant=>({variant,weight:1+variantThreat(variant)<maximumEncounterThreat(elapsed)&&Number.isFinite(table[variant])?Math.max(0,table[variant]??0):0}));
 const total=valid.reduce((sum,entry)=>sum+entry.weight,0);let roll=rng.next()*total;
 for(const entry of valid){roll-=entry.weight;if(roll<0)return entry.variant;}
 return 'normal';
}
export function createEnemy(state:RunState,rng:RNG,speciesId:number,variant:Variant,x:number,z:number,elite=false,boss=false,tierOverride?:EnemyTier):Enemy{
 const t=state.stats.elapsed/60,profile=getEnemySpeciesProfile(speciesId);
 const mod=getVariant(variant);
 const progression=enemyProgressionScale(state);
 const combatTier=tierOverride??getEnemyTier(speciesId,variant,boss),tuning=combatTier===3?ENEMY_TIER_TUNING.tier3:combatTier===4?ENEMY_TIER_TUNING.tier4:undefined;
 const baseHp=(22+profile.strength*5+t*.75)*(1+t*.035)*profile.health*mod.hp*(elite&&combatTier<=2?DIFFICULTY.eliteHp:1)*(boss?4.6:1)*progression.health;
 const floor=tuning?(tuning.minimumHealth+state.stats.elapsed*tuning.healthPerSecond)*(.65+profile.strength*.055)*(1+progression.party):0;
 const late=lateEnemyScale(state.stats.elapsed,speciesId,combatTier);
 const hp=Math.max(baseHp*(tuning?.healthMultiplier??1),floor)*late.health;
 const damageScale=(boss?1.35:ordinaryThreatScale(state.stats.elapsed)*(elite?DIFFICULTY.eliteDamage:1))*progression.damage*challengeRules(state.challenge).damageScale*late.damage;
 return {uid:state.idCounter++,speciesId,variant,combatTier,attackIndex:0,x,z,hp,maxHp:hp,speed:(2.8+t*.035)*profile.speed*mod.speed*challengeRules(state.challenge).speedScale,damage:(6+profile.strength*1.2+t*.3)*profile.damage*mod.damage*damageScale*(tuning?.damageMultiplier??1),size:boss?4.4:profile.size*(elite?1.22:1)*(tuning?.sizeMultiplier??1),hitCooldown:0,attackCooldown:rng.between(.3,1.9),poisonTime:0,burnTime:0,slowTime:0,soakedTime:0,stunTime:0,elite,dead:false,isBoss:boss,facing:Math.atan2(state.player.x-x,state.player.z-z),animation:'idle',attackTimer:0};
}
/** Shrines have fixed tier budgets; elite landmarks scale with the run. */
export function createGuardian(state:RunState,rng:RNG,speciesId:number,x:number,z:number,shrine=false,tier=1):Enemy {
 if(shrine){
  const definition=shrineDefinition(tier),combatTier=Math.min(4,getEnemyTier(speciesId)) as EnemyTier;
  const guardian=createEnemy(state,rng,speciesId,'normal',x,z,true,false,combatTier);
  guardian.hp=guardian.maxHp=definition.health/definition.count;
  guardian.damage=definition.damage*challengeRules(state.challenge).damageScale;
  guardian.speed=3.15*getEnemySpeciesProfile(speciesId).speed*challengeRules(state.challenge).speedScale;
  guardian.attackCooldown=.9;guardian.hardShrine=tier>=13;
  guardian.shrineGuardian=true;guardian.landmarkGuardian=true;
  guardian.shrineXPScale=shrineXPMultiplier(definition,state.party[0].level);
  return guardian;
 }
 const guardianTier=Math.max(3,getEnemyTier(speciesId)) as EnemyTier;
 const guardian=createEnemy(state,rng,speciesId,'normal',x,z,true,false,guardianTier);
 const late=lateEnemyScale(state.stats.elapsed,speciesId,guardianTier);
 guardian.hardShrine=false;
 guardian.hp=guardian.maxHp=Math.max(guardian.maxHp,(DIFFICULTY.guardianBaseHp+averagePartyLevel(state)*DIFFICULTY.guardianHpPerLevel+state.stats.elapsed*DIFFICULTY.guardianHpPerSecond)*late.health);
 guardian.damage*=DIFFICULTY.guardianDamage;guardian.attackCooldown=.7;
 guardian.shrineGuardian=false;guardian.landmarkGuardian=true;return guardian;
}
export function enemySpawnPosition(player:Pick<Player,'x'|'z'|'facing'>,rng:RNG,minDistance=24,maxDistance=34):Vec2{
 const bound=DESIGN.mapRadius-4;
 for(let attempt=0;attempt<8;attempt++){
  const angle=attempt===0&&rng.next()<.78?player.facing+rng.between(-1.25,1.25):rng.next()*Math.PI*2;
  const radius=rng.between(minDistance,maxDistance);
  const x=player.x+Math.sin(angle)*radius,z=player.z+Math.cos(angle)*radius;
  // Reject instead of clamping: clamping can place a new enemy beside the player at an edge.
  if(Math.abs(x)<=bound&&Math.abs(z)<=bound)return {x,z};
 }
 // Point into the arena if all sampled directions faced a nearby boundary.
 const angle=Math.atan2(-player.x,-player.z),radius=rng.between(minDistance,maxDistance);
 return {x:player.x+Math.sin(angle)*radius,z:player.z+Math.cos(angle)*radius};
}
export interface SpawnTuning {variantWeights?:Partial<Record<Variant,number>>;capacity?:number;speciesTier?:SpeciesTier;statScale?:number;allowRare?:boolean;}
export function spawnRandomEnemy(state:RunState,rng:RNG,tuning:SpawnTuning={}):Enemy|null{
 // Reserve one actor for the scheduled boss instead of exceeding the entity budget.
 const capacity=Number.isFinite(tuning.capacity)?clamp(Math.floor(tuning.capacity!),0,DESIGN.maxEnemies):DESIGN.maxEnemies;
 if(state.enemies.filter(enemy=>!enemy.dead).length>=Math.max(0,capacity-(state.bossSpawned?0:1)))return null;
 const t=state.stats.elapsed,rolledVariant=rollVariant(rng,t,tuning.variantWeights);
 const living=state.enemies.filter(enemy=>!enemy.dead),bossActive=state.bossSpawned&&!state.stats.bossKilled&&!state.endless;
 const limits={
  allowTier3:!bossActive&&t-(state.lastTier3Spawn??-Infinity)>=ENEMY_TIER_TUNING.tier3.minimumSpacingSeconds&&living.filter(enemy=>(enemy.combatTier??getEnemyTier(enemy.speciesId,enemy.variant,enemy.isBoss))===3).length<ENEMY_TIER_TUNING.tier3.maxAlive,
  allowTier4:!bossActive&&t-(state.lastTier4Spawn??-Infinity)>=ENEMY_TIER_TUNING.tier4.minimumSpacingSeconds&&living.filter(enemy=>(enemy.combatTier??getEnemyTier(enemy.speciesId,enemy.variant,enemy.isBoss))===4).length<ENEMY_TIER_TUNING.tier4.maxAlive,
 };
 const {speciesId:id,rare}=selectEncounter(rng,t,tuning.speciesTier,tuning.allowRare!==false,rolledVariant,limits,state.mapId);
 const {x,z}=enemySpawnPosition(state.player,rng);
 const variant=rare?'normal':rolledVariant;
 const canBeElite=t>=180&&getEnemySpeciesProfile(id).strength+variantThreat(variant)+ELITE_THREAT<=maximumEncounterThreat(t);
 const enemy=createEnemy(state,rng,id,variant,x,z,rare||(canBeElite&&rng.next()<.003+t/200000));
 if(enemy.combatTier===3)state.lastTier3Spawn=t;
 if(enemy.combatTier===4)state.lastTier4Spawn=t;
 const scale=Number.isFinite(tuning.statScale)?clamp(tuning.statScale!, .25,8):1;
 enemy.hp*=scale;enemy.maxHp*=scale;enemy.damage*=scale;return enemy;
}
export function spawnInterval(t:number):number {return Math.max(DESIGN.spawnEndInterval,DESIGN.spawnStartInterval*Math.exp(-t/430));}
