export type OptionalChallengeId='guardian'|'holdout'|'ring-run';

/**
 * Small, authored rulesets for shrine invitations.  A POI owns its selected
 * ruleset, so a seed lays out the same invitations regardless of visit order.
 */
export interface OptionalChallengeDefinition {
 id:OptionalChallengeId; title:string; invitation:string; objective:string;
 duration:number; radius:number; reward:string; pressure:number;
}

export const OPTIONAL_CHALLENGES:Readonly<Record<OptionalChallengeId,OptionalChallengeDefinition>>={
 guardian:{id:'guardian',title:'Guardian trial',invitation:'Defeat the guardian before the ward fades.',objective:'Defeat the guardian',duration:90,radius:24,reward:'Relic + training',pressure:1},
 holdout:{id:'holdout',title:'Holdout trial',invitation:'Hold the shrine while bounded waves close in.',objective:'Hold the ward',duration:48,radius:20,reward:'Relic + recovery',pressure:4},
 'ring-run':{id:'ring-run',title:'Ring run',invitation:'Cross each expanding ward without leaving the shrine.',objective:'Cross 3 wards',duration:55,radius:22,reward:'Relic + training',pressure:0},
};

export const optionalChallenge=(id:OptionalChallengeId)=>OPTIONAL_CHALLENGES[id];
