import {getSpecies} from './kanto.ts';
import {PROGRESSION} from './progression.ts';

export interface EvolutionRule {method:'training'|'stone'|'bond';level:number;maturitySeconds:number;label:string;}
const STONES:Readonly<Record<number,string>>={26:'Thunder Stone',31:'Moon Stone',34:'Moon Stone',36:'Moon Stone',38:'Fire Stone',40:'Moon Stone',45:'Leaf Stone',59:'Fire Stone',62:'Water Stone',71:'Leaf Stone',91:'Water Stone',103:'Leaf Stone',121:'Water Stone',134:'Water Stone',135:'Thunder Stone',136:'Fire Stone'};
const TRADE_FORMS:readonly number[]=[65,68,76,94];
/** No trading service or consumable stone is required. A named evolution card
 * grants the stone / bond after the same explicit run training gates. */
export function evolutionRule(sourceId:number,targetId:number):EvolutionRule|null {
 const source=getSpecies(sourceId);if(!source.evolvesTo.includes(targetId))return null;
 const level=source.stage>=2?PROGRESSION.evolution.finalLevel:PROGRESSION.evolution.firstLevel;
 const method=STONES[targetId]?'stone':TRADE_FORMS.includes(targetId)?'bond':'training';
 return {method,level,maturitySeconds:PROGRESSION.evolution.maturitySeconds,
  label:method==='stone'?`${STONES[targetId]} card`:method==='bond'?'Squad bond (trade adapted)':'Run training'};
}
export function evolutionRequirement(sourceId:number,targetId:number):string {
 const rule=evolutionRule(sourceId,targetId);if(!rule)return 'Unavailable evolution';
 return `${rule.label}: Pokémon level ${rule.level}, ${rule.maturitySeconds}s since recruitment or last evolution`;
}
