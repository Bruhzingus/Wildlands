import {getSpecies} from './kanto.ts';
import {PROGRESSION} from './progression.ts';
import {ATTACK_DESCRIPTIONS,resolveAttackProfile} from './attackDefinitions.ts';
import {getSignatureMoveDefinition} from './moveDefinitions.ts';
export {ATTACK_ARCHETYPES,ELEMENT_PROCS} from './attackDefinitions.ts';
export {SPECIES_ATTACK_PARAMETERS as SPECIES_ATTACKS} from './rosterContent.ts';
export type {StatusProc,ProjectileShape,AttackPattern,AttackMilestone,AttackDefinition} from './attackDefinitions.ts';

export function getAttackProfile(speciesId:number,rank=1) {
 return resolveAttackProfile(getSignatureMoveDefinition(getSpecies(speciesId).moveName).profile,rank);
}
export function describeAttackMechanic(speciesId:number,rank=1):string {
 const profile=getAttackProfile(speciesId,rank);
 return profile.description||ATTACK_DESCRIPTIONS[profile.kind];
}
export function describeAttackUpgrade(speciesId:number,fromRank:number,toRank:number):string {
 const from=getAttackProfile(speciesId,fromRank),to=getAttackProfile(speciesId,toRank);
 const increase=(before:number,after:number)=>Math.round((after/before-1)*100),{damagePerRank}=PROGRESSION.moves;
 const parts=to.kind==='heal'?[`+${increase(5+fromRank*1.5,5+toRank*1.5)}% leader healing`,`+${increase(3+fromRank*.8,3+toRank*.8)}% squad healing`]:
  [`+${increase((1+damagePerRank*(fromRank-1))*from.damageScale,(1+damagePerRank*(toRank-1))*to.damageScale)}% damage`];
 parts.push(`+${increase(1/from.cooldown,1/to.cooldown)}% casting speed`);
 if(to.range>from.range)parts.push(`+${increase(from.range,to.range)}% reach`);
 if(to.radius>from.radius)parts.push(`+${increase(from.radius,to.radius)}% area radius`);
 if(to.projectiles>from.projectiles)parts.push(`+${to.projectiles-from.projectiles} projectile`);
 if(to.chains>from.chains)parts.push(`+${to.chains-from.chains} chain target`);
 if(to.pierce>from.pierce)parts.push(`+${to.pierce-from.pierce} pierce`);
 for(const milestone of to.milestones||[])if(milestone.rank>fromRank&&milestone.rank<=toRank)parts.push(milestone.description);
 return parts.join(', ')+'.';
}
