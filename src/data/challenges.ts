export type ChallengeId='standard'|'quickened'|'famine'|'onslaught'|'volatile';
export interface ChallengeDefinition {id:ChallengeId;title:string;description:string;speedScale:number;damageScale:number;spawnIntervalScale:number;}
const standard:ChallengeDefinition={id:'standard',title:'Standard',description:'The original survival rules.',speedScale:1,damageScale:1,spawnIntervalScale:1};
export const CHALLENGE_DEFINITIONS:Readonly<Record<ChallengeId,ChallengeDefinition>>={
 standard,
 quickened:{...standard,id:'quickened',title:'Quickened',description:'Enemies move 20% faster. No extra rewards or permanent stats.',speedScale:1.2},
 famine:{...standard,id:'famine',title:'No healing',description:'Field healing and regeneration disabled. Max-HP upgrades and evolution still add new HP.'},
 onslaught:{...standard,id:'onslaught',title:'Onslaught',description:'Enemies arrive 25% more often. Existing enemy and projectile caps still apply.',spawnIntervalScale:.8},
 volatile:{...standard,id:'volatile',title:'Volatile',description:'Enemy attacks deal 25% more damage, including legendary attacks.',damageScale:1.25},
};
export const challengeRules=(id:ChallengeId='standard')=>CHALLENGE_DEFINITIONS[id]??standard;
