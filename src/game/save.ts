import {starterChoices} from '../data/kanto.ts';
import {ITEM_DEFINITIONS} from '../data/items.ts';
import {ACHIEVEMENTS,BASE_ITEMS,CHALLENGE_OPTIONS,GATED_RECRUITS,MAP_OPTIONS,STARTING_PARTNERS,type RunOptions,type UnlockReward} from '../data/unlocks.ts';

/** Keep the original key so an upgrade discovers every existing local save. */
export const SAVE_KEY='wildlands-save-v1';
export const SAVE_VERSION=2;
export interface RunRecord {id:string;kills:number;rocketKills:number;elapsed:number;finished:boolean;victory:boolean;}
export interface SaveData {
 version:2;unlocked:number[];wins:number;bestKills:number;longestRun:number;games:number;
 settings:{volume:number;camera:number;quality:'low'|'high'};
 achievements:string[];achievementProgress:Record<string,number>;unlockedItems:string[];unlockedRecruits:number[];
 unlockedMaps:RunOptions['map'][];unlockedChallenges:RunOptions['challenge'][];selection:RunOptions;
 totals:{kills:number;rocketKills:number};recentRuns:RunRecord[];
}
export const DEFAULT_SAVE:SaveData={version:2,unlocked:[...STARTING_PARTNERS],wins:0,bestKills:0,longestRun:0,games:0,
 settings:{volume:.45,camera:28,quality:'high'},achievements:[],achievementProgress:{},unlockedItems:[...BASE_ITEMS],unlockedRecruits:[],
 unlockedMaps:['wildlands'],unlockedChallenges:['standard'],selection:{map:'wildlands',challenge:'standard'},totals:{kills:0,rocketKills:0},recentRuns:[]};
const object=(value:unknown):Record<string,unknown>|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
export const safeCount=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?Math.min(Number.MAX_SAFE_INTEGER,Math.floor(value)):0;
function finiteRange(value:unknown,min:number,max:number,fallback:number){return typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;}
function allowedArray<T extends string|number>(value:unknown,allowed:readonly T[],base:readonly T[]=[]):T[]{return [...new Set([...base,...(Array.isArray(value)?value.filter((id):id is T=>allowed.includes(id)):[])])];}
export function grantReward(save:SaveData,reward:UnlockReward):void {
 for(const [key,values] of [['unlocked',reward.starters],['unlockedItems',reward.items],['unlockedRecruits',reward.recruits],['unlockedMaps',reward.maps],['unlockedChallenges',reward.challenges]] as const){
  if(!values)continue;const target=save[key] as (string|number)[];for(const value of values)if(!target.includes(value))target.push(value);
 }
}
/** Parse unknown data at one boundary; callers always receive a complete schema. */
export function migrateSave(value:unknown):SaveData|null {
 const read=object(value);if(!read||(read.version!==1&&read.version!==2))return null;
 const save=structuredClone(DEFAULT_SAVE),settings=object(read.settings),legacy=read.version===1;
 save.unlocked=allowedArray(read.unlocked,starterChoices(),save.unlocked);
 for(const key of ['wins','bestKills','longestRun','games'] as const)save[key]=safeCount(read[key]);
 save.settings={volume:finiteRange(settings?.volume,0,1,save.settings.volume),camera:finiteRange(settings?.camera,14,48,save.settings.camera),quality:settings?.quality==='low'?'low':'high'};
 // Previous players keep the full item/recruit pools they could already find.
 save.unlockedItems=allowedArray(read.unlockedItems,ITEM_DEFINITIONS.map(item=>item.id),legacy?ITEM_DEFINITIONS.map(item=>item.id):BASE_ITEMS);
 save.unlockedRecruits=allowedArray(read.unlockedRecruits,GATED_RECRUITS,legacy?GATED_RECRUITS:[]);
 save.unlockedMaps=allowedArray(read.unlockedMaps,MAP_OPTIONS.map(option=>option.id),['wildlands']);
 save.unlockedChallenges=allowedArray(read.unlockedChallenges,CHALLENGE_OPTIONS.map(option=>option.id),['standard']);
 save.achievements=allowedArray(read.achievements,ACHIEVEMENTS.map(achievement=>achievement.id));
 const progress=object(read.achievementProgress);
 for(const achievement of ACHIEVEMENTS){
  const count=Math.min(achievement.target,safeCount(progress?.[achievement.id]));
  if(count)save.achievementProgress[achievement.id]=count;
  if(save.achievements.includes(achievement.id)){save.achievementProgress[achievement.id]=achievement.target;grantReward(save,achievement.reward);}
 }
 // Historic wins are real accomplishments; do not fabricate team composition or kills.
 if(legacy&&save.wins>0&&!save.achievements.includes('psychic-break')){
  save.achievements.push('psychic-break');save.achievementProgress['psychic-break']=1;
  grantReward(save,ACHIEVEMENTS.find(achievement=>achievement.id==='psychic-break')!.reward);
 }
 const totals=object(read.totals);save.totals={kills:safeCount(totals?.kills),rocketKills:safeCount(totals?.rocketKills)};
 const selection=object(read.selection);
 save.selection={map:save.unlockedMaps.includes(selection?.map as RunOptions['map'])?selection!.map as RunOptions['map']:'wildlands',challenge:save.unlockedChallenges.includes(selection?.challenge as RunOptions['challenge'])?selection!.challenge as RunOptions['challenge']:'standard'};
 if(Array.isArray(read.recentRuns))for(const candidate of read.recentRuns.slice(-32)){
  const run=object(candidate);if(!run||typeof run.id!=='string'||!run.id.length||run.id.length>100||save.recentRuns.some(record=>record.id===run.id))continue;
  save.recentRuns.push({id:run.id,kills:safeCount(run.kills),rocketKills:safeCount(run.rocketKills),elapsed:safeCount(run.elapsed),finished:run.finished===true,victory:run.victory===true});
 }
 return save;
}
export function loadSave():SaveData {
 try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return structuredClone(DEFAULT_SAVE);return migrateSave(JSON.parse(raw))??structuredClone(DEFAULT_SAVE);}
 catch{return structuredClone(DEFAULT_SAVE);}
}
/** False means storage is unavailable; the caller can still keep playing in memory. */
export function persist(save:SaveData):boolean {try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));return true;}catch{return false;}}
/** Backward-compatible score recording for tools which do not own a run tracker. */
export function recordRun(save:SaveData,time:number,kills:number,victory:boolean):void {
 save.games++;save.bestKills=Math.max(save.bestKills,safeCount(kills));save.longestRun=Math.max(save.longestRun,safeCount(time));
 save.totals.kills=Math.min(Number.MAX_SAFE_INTEGER,save.totals.kills+safeCount(kills));
 if(victory){save.wins++;for(const id of [10,16,27,37,43,52,58,63,66,92,133])if(!save.unlocked.includes(id)){save.unlocked.push(id);break;}
  if(!save.achievements.includes('psychic-break')){save.achievements.push('psychic-break');save.achievementProgress['psychic-break']=1;grantReward(save,ACHIEVEMENTS.find(achievement=>achievement.id==='psychic-break')!.reward);}}
 persist(save);
}
export function selectRunOptions(save:SaveData,options:Partial<RunOptions>):RunOptions {
 if(options.map&&save.unlockedMaps.includes(options.map))save.selection.map=options.map;
 if(options.challenge&&save.unlockedChallenges.includes(options.challenge))save.selection.challenge=options.challenge;
 persist(save);return {...save.selection};
}
export function exportSave(save:SaveData):string{return JSON.stringify(migrateSave(save)??structuredClone(DEFAULT_SAVE),null,2);}
export type ImportResult={ok:true;save:SaveData}|{ok:false;error:string};
/** Import never alters the current save unless its structure and version are recognized. */
export function importSave(json:string):ImportResult {
 if(json.length>250_000)return {ok:false,error:'Save file is too large (250 KB maximum).'};
 let value:unknown;try{value=JSON.parse(json);}catch{return {ok:false,error:'This file is not valid JSON.'};}
 const candidate=object(value);if(!candidate||!Array.isArray(candidate.unlocked))return {ok:false,error:'This file does not contain a Wildlands partner collection.'};
 const save=migrateSave(value);if(!save)return {ok:false,error:'This is not a supported Wildlands save (versions 1 and 2).'};
 return {ok:true,save};
}
