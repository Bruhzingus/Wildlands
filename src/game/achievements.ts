import {ACHIEVEMENTS,type AchievementDefinition} from '../data/unlocks.ts';
import {getSpecies} from '../data/kanto.ts';
import type {RunState,Variant} from './types.ts';
import {grantReward,persist,safeCount,type SaveData} from './save.ts';

export interface ProgressionChange {earned:AchievementDefinition[];saved:boolean;}
let runSequence=0;
/** Session-owned, event-fed accounting. No browser listeners, clock timers or combat buffs. */
export class ProgressionTracker {
 readonly runId:string;
 private speciesByUid=new Map<number,number>();
 private evolvedLeader=false;private evolvedFollower=false;private readonly leaderUid:number;
 private rocketKills=0;private seenKills=new Set<number>();
 private endlessStartedAt:number|null=null;
 private awarded:AchievementDefinition[]=[];
 private save:SaveData;
 constructor(save:SaveData,initial:RunState,runId=`${Date.now().toString(36)}-${++runSequence}-${initial.seed}`){
  this.save=save;this.runId=runId;this.leaderUid=initial.party[0]?.uid??1;
  for(const member of initial.party)this.speciesByUid.set(member.uid,member.speciesId);
 }
 /** Call for a semantic, once-only enemy death, not for damage or despawn events. */
 onKill(variant:Variant,uid?:number):void {
  if(uid!==undefined){if(this.seenKills.has(uid))return;this.seenKills.add(uid);
   if(this.seenKills.size>2048)this.seenKills.delete(this.seenKills.values().next().value!);}
  if(variant==='rocket')this.rocketKills++;
 }
 observe(state:RunState):ProgressionChange {
  if(state.endless&&this.endlessStartedAt===null)this.endlessStartedAt=state.endlessStartedAt??state.stats.elapsed;
  for(const member of state.party){
   const before=this.speciesByUid.get(member.uid);
   if(before!==undefined&&before!==member.speciesId&&getSpecies(before).evolvesTo.includes(member.speciesId)){
    if(member.uid===this.leaderUid)this.evolvedLeader=true;else this.evolvedFollower=true;
   }
   this.speciesByUid.set(member.uid,member.speciesId);
  }
  const alive=state.party.filter(member=>member.uid===this.leaderUid?state.player.hp>0:member.hp>0);
  const previous=this.save.recentRuns.find(run=>run.id===this.runId);
  const victory=state.stats.bossKilled||state.result==='victory';
  const poisonTeam=alive.filter(member=>getSpecies(member.speciesId).types.includes('poison')).length>=2;
  const measures:Record<string,number>={
   'first-watch':state.stats.elapsed,'squad-assembly':alive.length,'trail-reader':state.pois.filter(poi=>poi.used).length,
   'growing-together':Number(this.evolvedLeader)+Number(this.evolvedFollower),
   'poison-patrol':poisonTeam?state.stats.elapsed:0,
   'rocket-patrol':this.save.totals.rocketKills+Math.max(0,this.rocketKills-(previous?.rocketKills??0)),
   'psychic-break':Number(victory),'everyone-home':Number(victory&&state.stats.faints===0),
   'relic-satchel':new Set(state.items).size,'beyond-the-watch':state.endless?Math.max(0,state.stats.elapsed-(this.endlessStartedAt??state.stats.elapsed)):0,
  };
  const earned:AchievementDefinition[]=[];
  for(const achievement of ACHIEVEMENTS){
   const value=Math.min(achievement.target,safeCount(measures[achievement.id]));
   this.save.achievementProgress[achievement.id]=Math.max(this.save.achievementProgress[achievement.id]??0,value);
   if(value>=achievement.target&&!this.save.achievements.includes(achievement.id)){
    this.save.achievements.push(achievement.id);grantReward(this.save,achievement.reward);earned.push(achievement);this.awarded.push(achievement);
   }
  }
  if(!earned.length)return {earned,saved:false};
  this.commit(state,false);return {earned,saved:persist(this.save)};
 }
 /** Result/restart checkpoint. Repeated victory -> endless -> defeat calls count one run and one win. */
 finish(state:RunState):ProgressionChange {
  const change=this.observe(state);this.commit(state,true);change.saved=persist(this.save);return change;
 }
 /** All achievements earned this run, for a result page even when awards occurred earlier. */
 earnedThisRun():readonly AchievementDefinition[]{return this.awarded;}
 private commit(state:RunState,finished:boolean):void {
  let record=this.save.recentRuns.find(run=>run.id===this.runId);
  if(!record){record={id:this.runId,kills:0,rocketKills:0,elapsed:0,finished:false,victory:false};this.save.recentRuns.push(record);this.save.recentRuns=this.save.recentRuns.slice(-32);}
  const kills=safeCount(state.stats.kills),rocket=safeCount(this.rocketKills),elapsed=safeCount(state.stats.elapsed);
  this.save.totals.kills=Math.min(Number.MAX_SAFE_INTEGER,this.save.totals.kills+Math.max(0,kills-record.kills));
  this.save.totals.rocketKills=Math.min(Number.MAX_SAFE_INTEGER,this.save.totals.rocketKills+Math.max(0,rocket-record.rocketKills));
  this.save.bestKills=Math.max(this.save.bestKills,kills);this.save.longestRun=Math.max(this.save.longestRun,elapsed);
  if(finished&&!record.finished){this.save.games++;record.finished=true;}
  if((state.stats.bossKilled||state.result==='victory')&&!record.victory){this.save.wins++;record.victory=true;}
  record.kills=Math.max(record.kills,kills);record.rocketKills=Math.max(record.rocketKills,rocket);record.elapsed=Math.max(record.elapsed,elapsed);
 }
}
