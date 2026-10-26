import {resolveAttackProfile,type AttackDefinition} from './attackDefinitions.ts';
import {getSpecies} from './kanto.ts';
import {PROGRESSION} from './progression.ts';
import {SPECIES_LEARNSETS} from './learnsets.ts';
import {getSpecialProfile} from './specials.ts';
import {LEARNABLE_MOVES,getMoveDefinition,type LearnableMove} from './moveDefinitions.ts';
export {LEARNABLE_MOVES,getMoveDefinition} from './moveDefinitions.ts';
export type {LearnableMove} from './moveDefinitions.ts';

/** The species' signature attack occupies the first of four total move slots. */
export const MAX_LEARNED_MOVES=3;
/** Move training has no rank ceiling. */
export const MAX_LEARNED_MOVE_RANK=Math.max(PROGRESSION.moves.maxRank,PROGRESSION.moves.soloMaxRank);

export function moveLearnLevel(id:string):number {
 return ['hyper-beam','solar-beam','fire-blast','blizzard','earthquake','hurricane','future-sight','focus-blast','stone-edge'].includes(id)?10:
  ['razor-leaf','ember','water-gun','thunder-shock','gust','tackle','quick-attack','bug-bite','confusion','swift','water-pulse','mud-shot','psybeam','dragon-breath','poison-jab','pin-missile'].includes(id)?3:5;
}
export function learnableMoves(speciesId:number,level=Infinity):LearnableMove[] {
 const species=getSpecies(speciesId),special=getSpecialProfile(speciesId);
 const known=new Set(SPECIES_LEARNSETS[speciesId]||[]);
 return LEARNABLE_MOVES.filter(definition=>known.has(definition.id)&&definition.name!==species.moveName&&definition.name!==special.name&&moveLearnLevel(definition.id)<=level);
}
export function getLearnedMoveProfile(id:string,rank=1):AttackDefinition {
 const definition=getMoveDefinition(id);if(!definition)throw new Error(`Unknown learned move: ${id}`);
 return resolveAttackProfile(definition.profile,rank);
}
/** Every rank adds the shared damage-per-rank percentage before caster bonuses. */
export function learnedMovePower(id:string,rank=1):number {
 const definition=getMoveDefinition(id);if(!definition)throw new Error(`Unknown learned move: ${id}`);
 return definition.power*(1+Math.max(0,Number.isFinite(rank)?rank-1:0)*PROGRESSION.moves.damagePerRank);
}
export function evolutionMove(sourceId:number,targetId:number,knownIds:readonly string[]=[]):LearnableMove {
 const target=getSpecies(targetId),candidates=learnableMoves(targetId).filter(definition=>!knownIds.includes(definition.id));
 // Evolution does not grant a free move; this helper also supports previews.
 const matching=candidates.filter(definition=>definition.element===target.types[0]);
 const index=getSpecies(sourceId).stage>=2?1:0;
 const chosen=matching[Math.min(index,matching.length-1)]||candidates[0];
 if(!chosen)throw new Error(`No new evolution move available for ${target.name}`);
 return chosen;
}
