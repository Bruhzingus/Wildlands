import {getSpecies} from './kanto.ts';
import type {POI,RunState,Vec2} from '../game/types.ts';

export type ShrineHazard='slow'|'poison'|'fire';
export interface ShrineDefinition {
 tier:number;speciesId:number;count:number;level:number;radius:number;health:number;damage:number;
 hazards:readonly ShrineHazard[];color:string;targetSeconds:readonly [number,number];
}
/** Total encounter health is authored, not scaled to the player's build or the clock. */
export const SHRINE_TIERS:readonly ShrineDefinition[]=[
 {tier:1,speciesId:66,count:1,level:5,radius:20,health:1350,damage:23,hazards:[],color:'#d1efe0',targetSeconds:[20,35]},
 {tier:2,speciesId:25,count:3,level:9,radius:20,health:1500,damage:18,hazards:[],color:'#b5e7ed',targetSeconds:[20,35]},
 {tier:3,speciesId:24,count:2,level:13,radius:18,health:1800,damage:24,hazards:['poison'],color:'#a8cfef',targetSeconds:[15,45]},
 {tier:4,speciesId:28,count:3,level:17,radius:17,health:2200,damage:26,hazards:['slow'],color:'#94b9e8',targetSeconds:[15,45]},
 {tier:5,speciesId:93,count:3,level:22,radius:19,health:2800,damage:29,hazards:['poison'],color:'#aa9ad9',targetSeconds:[15,45]},
 {tier:6,speciesId:68,count:2,level:27,radius:16,health:3400,damage:39,hazards:[],color:'#ad7dcc',targetSeconds:[15,45]},
 {tier:7,speciesId:38,count:2,level:32,radius:19,health:4200,damage:40,hazards:['fire'],color:'#c875aa',targetSeconds:[15,45]},
 {tier:8,speciesId:76,count:3,level:38,radius:16,health:5400,damage:43,hazards:['slow'],color:'#c35b78',targetSeconds:[15,45]},
 {tier:9,speciesId:130,count:1,level:44,radius:22,health:6500,damage:61,hazards:['poison'],color:'#b74758',targetSeconds:[15,45]},
 {tier:10,speciesId:3,count:2,level:50,radius:18,health:8200,damage:51,hazards:['poison','slow'],color:'#a23351',targetSeconds:[15,45]},
 {tier:11,speciesId:6,count:2,level:56,radius:20,health:10000,damage:57,hazards:['fire'],color:'#872439',targetSeconds:[15,45]},
 {tier:12,speciesId:149,count:2,level:63,radius:17,health:12500,damage:63,hazards:['fire','slow'],color:'#68233c',targetSeconds:[15,45]},
 {tier:13,speciesId:144,count:1,level:70,radius:18,health:16000,damage:82,hazards:['slow'],color:'#45213e',targetSeconds:[15,45]},
 {tier:14,speciesId:145,count:2,level:80,radius:17,health:20000,damage:75,hazards:['fire','poison'],color:'#271b30',targetSeconds:[15,45]},
 {tier:15,speciesId:150,count:1,level:90,radius:16,health:26000,damage:100,hazards:['slow','poison','fire'],color:'#09080e',targetSeconds:[15,45]},
];
export const SHRINE_RULES={levelWindow:10,previewRadius:12,timeLimit:60,hazardPeriod:4,hazardWarning:1.25,hazardActive:1.75} as const;
export function shrineDefinition(tier=1):ShrineDefinition{return SHRINE_TIERS[Math.max(0,Math.min(SHRINE_TIERS.length-1,Math.floor(tier)-1))];}
export function shrineLevelAllowed(playerLevel:number,definition:ShrineDefinition):boolean{return Math.abs(playerLevel-definition.level)<=SHRINE_RULES.levelWindow;}
export function shrineForPOI(poi:POI):ShrineDefinition{return shrineDefinition(poi.challenge?.tier??poi.shrineTier??1);}
export function shrineContents(definition:ShrineDefinition):string {
 const name=getSpecies(definition.speciesId).name;
 return `${name} Shrine - ${definition.count} ${name}${definition.hazards.map(hazard=>` + ${{slow:'Slow ground',poison:'Poison',fire:'Fire'}[hazard]}`).join('')}`;
}
/** A site keeps its identity within the level window. Recharges advance one tier;
 * an outgrown site selects a nearby tier, keeping all fifteen tiers reachable. */
export function refreshShrineTier(state:Pick<RunState,'party'>,poi:POI,promote=false):void {
 if(poi.kind!=='shrine'||poi.challenge)return;
 const level=state.party[0].level,eligible=SHRINE_TIERS.filter(def=>shrineLevelAllowed(level,def));
 const current=shrineDefinition(poi.shrineTier??1);
 if(!promote&&poi.shrineTier!==undefined&&shrineLevelAllowed(level,current))return;
 const desired=promote?current.tier+1:poi.shrineTier===undefined?1+(poi.uid%3):eligible[(poi.uid+Math.floor(level/10))%eligible.length].tier;
 poi.shrineTier=eligible.reduce((best,def)=>Math.abs(def.tier-desired)<Math.abs(best.tier-desired)?def:best,eligible[0]).tier;
}
/** 2–3x same-strength wild XP, then +/-2.5% per level, capped at +/-25%. */
export function shrineXPMultiplier(definition:ShrineDefinition,playerLevel:number):number {
 return (2+(definition.tier-1)/14)*(1+Math.max(-.25,Math.min(.25,(definition.level-playerLevel)*.025)));
}
export interface ShrineHazardZone extends Vec2 {kind:ShrineHazard;radius:number;warning:boolean;}
/** Three persistent pockets rotate between warning and damage, leaving safe lanes. */
export function shrineHazardZones(poi:POI,elapsed:number):ShrineHazardZone[] {
 const trial=poi.challenge;if(!trial||trial.id!=='guardian')return [];
 const definition=shrineForPOI(poi),age=Math.max(0,elapsed-(trial.startedAt??elapsed));
 return definition.hazards.map((kind,index)=>{
  const phase=(age+index*.8)%SHRINE_RULES.hazardPeriod;
  const angle=index*Math.PI*2/Math.max(1,definition.hazards.length)+poi.uid;
  return {kind,x:poi.x+Math.sin(angle)*definition.radius*.38,z:poi.z+Math.cos(angle)*definition.radius*.38,
   radius:definition.radius*.32,warning:phase<SHRINE_RULES.hazardWarning,phase};
 }).filter(zone=>zone.phase<SHRINE_RULES.hazardWarning+SHRINE_RULES.hazardActive);
}
