import {KANTO} from './kanto.ts';
import {LEGENDARY_SPECIES} from './rosterContent.ts';
import type {RNG} from '../utils/random.ts';

export type SpeciesTier='early'|'mid'|'late';
/** Every original species is reachable. Legendary birds/Mew are scarce late
 * elites; Mewtwo belongs exclusively to the scheduled boss encounter. */
export const ENCOUNTER_TABLES:Readonly<Record<SpeciesTier|'rare'|'boss',readonly number[]>>={
 early:[10,13,16,19,21,29,32,41,43,46,50,60,69,74,81,98,100],
 mid:KANTO.filter(species=>species.stage<=2&&!LEGENDARY_SPECIES.includes(species.id)).map(species=>species.id),
 late:KANTO.filter(species=>!LEGENDARY_SPECIES.includes(species.id)).map(species=>species.id),
 rare:[144,145,146,151],boss:[150],
};
export const RARE_ENCOUNTER={earliestSeconds:720,chance:.001} as const;
export function selectEncounter(rng:RNG,elapsed:number,tier?:SpeciesTier,allowRare=true):{speciesId:number;rare:boolean} {
 const resolved=tier??(elapsed<210?'early':elapsed<570?'mid':elapsed<840?(rng.next()<.35?'late':'mid'):'late');
 const rare=allowRare&&resolved==='late'&&elapsed>=RARE_ENCOUNTER.earliestSeconds&&rng.next()<RARE_ENCOUNTER.chance;
 return {speciesId:rng.pick(ENCOUNTER_TABLES[rare?'rare':resolved]),rare};
}
