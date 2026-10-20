import {getSpecies,starterChoices} from './kanto.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {GATED_RECRUIT_SPECIES} from './rosterContent.ts';

export type MapId='wildlands'|'pinewood-route'|'ruins-route';
export type ChallengeId='standard'|'quickened'|'famine';
export interface RunOptions {map:MapId;challenge:ChallengeId;}
export interface UnlockReward {starters?:readonly number[];items?:readonly string[];recruits?:readonly number[];maps?:readonly MapId[];challenges?:readonly ChallengeId[];}
export interface AchievementDefinition {id:string;title:string;description:string;target:number;unit:string;reward:UnlockReward;}
export const STARTING_PARTNERS=[1,4,7,25] as const;
export const GATED_ITEMS=['echo-bell','life-orb','iron-ball','prism-shard'] as const;
export const GATED_RECRUITS=GATED_RECRUIT_SPECIES;
export const BASE_ITEMS=ITEM_DEFINITIONS.filter(item=>!(GATED_ITEMS as readonly string[]).includes(item.id)).map(item=>item.id);
export const MAP_OPTIONS:readonly {id:MapId;title:string;description:string;seed?:number}[]=[
 {id:'wildlands',title:'Wildlands',description:'A fresh seed every run. Four familiar regions and landmarks.'},
 {id:'pinewood-route',title:'Pinewood route',description:'A fixed expedition seed through the same Wildlands. Learn its cache and shrine routes.',seed:46837},
 {id:'ruins-route',title:'Ruins route',description:'A second fixed expedition seed through the same Wildlands. Plan a different supply route.',seed:81073},
];
export const CHALLENGE_OPTIONS:readonly {id:ChallengeId;title:string;description:string}[]=[
 {id:'standard',title:'Standard',description:'The original survival rules.'},
 {id:'quickened',title:'Quickened',description:'Enemies move 20% faster. No extra rewards or permanent stats.'},
 {id:'famine',title:'No healing',description:'Field healing and regeneration disabled. Max-HP upgrades and evolution still add new HP.'},
];
/** Finite accomplishments unlock choices, never permanent combat-stat bonuses. */
export const ACHIEVEMENTS:readonly AchievementDefinition[]=[
 {id:'first-watch',title:'First watch',description:'Survive for 3 minutes.',target:180,unit:'seconds',reward:{starters:[16,27]}},
 {id:'squad-assembly',title:'Squad assembly',description:'Have 4 living squad members together.',target:4,unit:'members',reward:{starters:[43,52],recruits:[83,95,114]}},
 {id:'trail-reader',title:'Trail reader',description:'Use 4 discoveries in one run.',target:4,unit:'discoveries',reward:{starters:[37,58],maps:['pinewood-route']}},
 {id:'growing-together',title:'Growing together',description:'Evolve your leader and at least one follower in the same run.',target:2,unit:'roles',reward:{starters:[63,66]}},
 {id:'poison-patrol',title:'Poison patrol',description:'Reach 15 minutes with at least 2 living Poison-type members.',target:900,unit:'seconds',reward:{starters:[92]}},
 {id:'rocket-patrol',title:'Rocket patrol',description:'Defeat 100 Rocket enemies across your runs.',target:100,unit:'defeated',reward:{starters:[133],items:['iron-ball'],recruits:[108,115,127,128,131,137,142,143]}},
 {id:'psychic-break',title:'Psychic break',description:'Defeat Mewtwo.',target:1,unit:'victory',reward:{starters:[10],items:['prism-shard']}},
 {id:'everyone-home',title:'Everyone home',description:'Defeat Mewtwo without a follower fainting.',target:1,unit:'victory',reward:{items:['life-orb'],challenges:['quickened']}},
 {id:'relic-satchel',title:'Relic satchel',description:'Carry 8 different relics in one run.',target:8,unit:'relics',reward:{items:['echo-bell']}},
 {id:'beyond-the-watch',title:'Beyond the watch',description:'Survive 20 minutes in endless after defeating Mewtwo.',target:1200,unit:'seconds',reward:{maps:['ruins-route'],challenges:['famine']}},
];
export const ALL_STARTERS=()=>starterChoices();
export function rewardLabels(reward:UnlockReward):string[]{
 return [...(reward.starters??[]).map(id=>`${getSpecies(id).name} partner`),
  ...(reward.items??[]).map(id=>`${ITEM_DEFINITIONS.find(item=>item.id===id)?.title??id} relic`),
  ...(reward.recruits?.length?[`${reward.recruits.length} recruit species`]:[]),
  ...(reward.maps??[]).map(id=>MAP_OPTIONS.find(option=>option.id===id)!.title),
  ...(reward.challenges??[]).map(id=>`${CHALLENGE_OPTIONS.find(option=>option.id===id)!.title} challenge`)];
}
