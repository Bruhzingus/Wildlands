import {getSpecies} from '../../data/kanto.ts';
import {selectEncounter,type SpeciesTier} from '../../data/encounters.ts';
import {RNG,clamp} from '../../utils/random.ts';
import {DESIGN,DIFFICULTY,ordinaryThreatScale} from '../../data/config.ts';
import {getVariant,SPAWN_VARIANTS,variantWeights} from '../../data/variants.ts';
import type {Enemy,Player,RunState,Variant,Vec2} from '../types.ts';
import {getBuildModifiers} from './builds.ts';

export function averagePartyLevel(state:RunState):number {
 const living=state.party.filter((member,index)=>(index===0?state.player.hp:member.hp)>0);
 return living.length?living.reduce((sum,member)=>sum+member.level,0)/living.length:1;
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
 const valid=SPAWN_VARIANTS.map(variant=>({variant,weight:Number.isFinite(table[variant])?Math.max(0,table[variant]??0):0}));
 const total=valid.reduce((sum,entry)=>sum+entry.weight,0);let roll=rng.next()*total;
 for(const entry of valid){roll-=entry.weight;if(roll<0)return entry.variant;}
 return 'normal';
}
export function createEnemy(state:RunState,rng:RNG,speciesId:number,variant:Variant,x:number,z:number,elite=false,boss=false):Enemy{
 const t=state.stats.elapsed/60;const sp=getSpecies(speciesId);
 const mod=getVariant(variant);
 const progression=enemyProgressionScale(state);
 const hp=(18+sp.stage*10+t*1.25)*(1+t*.07)*mod.hp*(elite?DIFFICULTY.eliteHp:1)*(boss?4.6:1)*progression.health;
 const damageScale=(boss?1.35:ordinaryThreatScale(state.stats.elapsed)*(elite?DIFFICULTY.eliteDamage:1))*progression.damage;
 return {uid:state.idCounter++,speciesId,variant,x,z,hp,maxHp:hp,speed:(2.7+sp.stage*.20+t*.055)*mod.speed*(state.challenge==='quickened'?1.20:1),damage:(6+sp.stage*2.7+t*.46)*mod.damage*damageScale,size:boss?4.4:elite?2.1:1+sp.stage*.18,hitCooldown:0,attackCooldown:rng.between(.3,1.9),poisonTime:0,burnTime:0,slowTime:0,soakedTime:0,stunTime:0,elite,dead:false,isBoss:boss,facing:Math.atan2(state.player.x-x,state.player.z-z),animation:'idle',attackTimer:0};
}
/** Optional landmark fights scale with the run's growing party and move budget. */
export function createGuardian(state:RunState,rng:RNG,speciesId:number,x:number,z:number,shrine=false):Enemy {
 const guardian=createEnemy(state,rng,speciesId,'rocket',x,z,true);
 guardian.hp=guardian.maxHp=Math.max(guardian.maxHp,DIFFICULTY.guardianBaseHp+averagePartyLevel(state)*DIFFICULTY.guardianHpPerLevel+state.stats.elapsed*DIFFICULTY.guardianHpPerSecond);
 guardian.damage*=DIFFICULTY.guardianDamage;guardian.attackCooldown=.7;
 guardian.shrineGuardian=shrine;guardian.landmarkGuardian=true;return guardian;
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
 const t=state.stats.elapsed,{speciesId:id,rare}=selectEncounter(rng,t,tuning.speciesTier,tuning.allowRare!==false);
 const {x,z}=enemySpawnPosition(state.player,rng);
 const variant=rare?'normal':rollVariant(rng,t,tuning.variantWeights);
 const enemy=createEnemy(state,rng,id,variant,x,z,rare||rng.next()<.009+t/50000);
 const scale=Number.isFinite(tuning.statScale)?clamp(tuning.statScale!, .25,8):1;
 enemy.hp*=scale;enemy.maxHp*=scale;enemy.damage*=scale;return enemy;
}
export function spawnInterval(t:number):number {return Math.max(DESIGN.spawnEndInterval,DESIGN.spawnStartInterval*Math.exp(-t/430));}
