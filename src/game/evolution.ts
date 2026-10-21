import type {PartyMember} from './types.ts';
import {getSpecies} from '../data/kanto.ts';
import {getMoveDefinition} from '../data/moves.ts';

/** Detached receipt of an already committed reward; never used to apply it. */
export interface EvolutionReceipt {
 uid:number;from:number;to:number;level:number;xp:number;hpBefore:number;hpAfter:number;
 powerGain:number;signatureBefore:number;signatureAfter:number;freedSlots:number;
 moves:{name:string;before:number;rank:number}[];
}
export function evolutionReceipt(before:PartyMember,after:PartyMember,hpBefore=before.maxHp,hpAfter=after.maxHp):EvolutionReceipt {
 return {uid:after.uid,from:before.speciesId,to:after.speciesId,level:after.level,xp:after.xp??0,
  hpBefore,hpAfter,powerGain:(after.evolutionPower??0)-(before.evolutionPower??0),
  signatureBefore:before.attackLevel,signatureAfter:after.attackLevel,
  freedSlots:(before.learnedMoves?.length??0)-(after.learnedMoves?.length??0),
  moves:[{name:getSpecies(after.speciesId).moveName,before:before.attackLevel,rank:after.attackLevel},...(after.learnedMoves??[]).map(move=>({name:getMoveDefinition(move.moveId)?.name??move.moveId,before:before.learnedMoves?.find(old=>old.moveId===move.moveId)?.rank??0,rank:move.rank}))]};
}
