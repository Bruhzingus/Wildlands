import {starterChoices} from '../data/kanto.ts';
import {GATED_RECRUITS} from '../data/unlocks.ts';
import type {SaveData} from './save.ts';

/** Temporary playtest access. Set to false to restore earned character unlocks. */
export const TEMPORARY_FULL_CHARACTER_ACCESS=true;

/** Resolve access without granting permanent unlocks or changing exported saves. */
export function availableStarters(save:Pick<SaveData,'unlocked'>,fullAccess:boolean=TEMPORARY_FULL_CHARACTER_ACCESS):number[] {
 return starterChoices().filter(id=>fullAccess||save.unlocked.includes(id));
}

export function availableRecruitUnlocks(save:Pick<SaveData,'unlockedRecruits'>,fullAccess:boolean=TEMPORARY_FULL_CHARACTER_ACCESS):number[] {
 return [...(fullAccess?GATED_RECRUITS:save.unlockedRecruits)];
}
