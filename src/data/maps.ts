import {BIOMES,LANDMARKS,LANDMARK_PROPS,WORLD,type WorldProp} from './world.ts';
import {RNG} from '../utils/random.ts';
import type {POI,Vec2} from '../game/types.ts';

export type MapId='wildlands'|'pinewood-route'|'ruins-route'|'volcanic-ridge';
export interface MapDefinition {
 id:MapId;title:string;description:string;seed?:number;geography:'rolling'|'ridge';encounterId:'wildlands'|'volcanic';
 palette:typeof BIOMES;waterColor:string;shoreColor:string;skyColor:string;fogColor:string;
 scenery:{bark:string;pine:string;bush:string;rock:string;flower:string;ruins:string;rockChance:number;rockHeight:number};
 landmarks:typeof LANDMARKS;landmarkProps:readonly WorldProp[];
 changes:readonly {at:number;kind:POI['kind'];label:string;name:string}[];
}
const changes:MapDefinition['changes']=[
 {at:180,kind:'healing',name:'Bloom spring',label:'The wilds bloom. A new healing spring opens along the trails.'},
 {at:420,kind:'cache',name:'Storm salvage',label:'A passing storm uncovers a free salvage cache.'},
 {at:660,kind:'elite',name:'Roaming champion',label:'A roaming champion settles in the outer wilds. Challenge it for training.'},
];
const wildlands:MapDefinition={id:'wildlands',title:'Wildlands',description:'Shifting hills, four regions, 18 discoveries and changing trails. Mewtwo arrives at 15:00.',
 geography:'rolling',encounterId:'wildlands',palette:BIOMES,waterColor:'#638f98',shoreColor:'#a4a17b',skyColor:'#a1c4d1',fogColor:'#a2bbbd',
 scenery:{bark:'#78604b',pine:'#375d47',bush:'#648561',rock:'#8a978e',flower:'#debd74',ruins:'#a4a18b',rockChance:0,rockHeight:.55},landmarks:LANDMARKS,landmarkProps:LANDMARK_PROPS,changes};
export const MAP_DEFINITIONS:Readonly<Record<MapId,MapDefinition>>={
 wildlands,
 'pinewood-route':{...wildlands,id:'pinewood-route',title:'Pinewood route',description:'A repeatable expedition through the expanded Wildlands. Learn its geography and changing discoveries.',seed:46837},
 'ruins-route':{...wildlands,id:'ruins-route',title:'Ruins route',description:'A second repeatable expedition with its own terrain, sites and trail orientation.',seed:81073},
 'volcanic-ridge':{...wildlands,id:'volcanic-ridge',title:'Volcanic Ridge',description:'Basalt ridges, ash groves and a crater lake. Fire and Rock encounters; Moltres descends at 15:00.',geography:'ridge',encounterId:'volcanic',
  palette:{meadow:{name:'Ashen Clearing',color:'#8e7759',mapColor:'#998165'},woodland:{name:'Ember Grove',color:'#695c50',mapColor:'#6e594c'},ruins:{name:'Basalt Ridge',color:'#6a6268',mapColor:'#736a79'},lake:{name:'Crater Shore',color:'#877663',mapColor:'#947c68'}},
  waterColor:'#70a6a5',shoreColor:'#b09773',skyColor:'#dbb49a',fogColor:'#b89e8b',
  scenery:{bark:'#665451',pine:'#6f5040',bush:'#9a7750',rock:'#59525e',flower:'#e2a45b',ruins:'#796976',rockChance:.28,rockHeight:1.15},
  landmarks:[{id:'ash-spire',name:'Ash Spire',initial:'A',biome:'woodland',x:-61,z:-50},{id:'cinder-gate',name:'Cinder Gate',initial:'C',biome:'ruins',x:61,z:-49},{id:'sun-stones',name:'Sun Stones',initial:'S',biome:'meadow',x:54,z:40},{id:'crater',name:'Crater Lake',initial:'L',biome:'lake',x:-44,z:70}],
  landmarkProps:[{kind:'rock',x:-61,z:-50,scale:2.8,scaleY:2.6,landmark:true},{kind:'rock',x:-65,z:-52,scale:1.5,landmark:true},
   {kind:'ruin',x:55.5,z:-49,scale:1.1,scaleY:3,landmark:true},{kind:'ruin',x:66.5,z:-49,scale:1.1,scaleY:3,landmark:true},
   {kind:'rock',x:50,z:40,scale:2.4,scaleY:1.5,landmark:true},{kind:'rock',x:56,z:44,scale:1.8,landmark:true},{kind:'rock',x:58,z:36,scale:1.3,landmark:true}],
  changes:[{at:180,kind:'healing',name:'Geothermal spring',label:'Geothermal pressure opens a new healing spring.'},{at:420,kind:'cache',name:'Exposed relic cache',label:'An ash squall exposes a free relic cache.'},{at:660,kind:'elite',name:'Cinder champion',label:'A cinder champion arrives at the ridge. An optional battle awaits.'}],
 },
};
export const getMapDefinition=(id:MapId='wildlands')=>MAP_DEFINITIONS[id]??wildlands;
export interface WorldProfile {definition:MapDefinition;turn:number;hillShift:number;relief:number;lake:{x:number;z:number;waterRadius:number;shoreRadius:number;waterHeight:number};landmarks:typeof LANDMARKS;}
/** Rotation, lake position and relief share a seed across simulation, renderer and minimap. */
export function worldProfile(seed=0,mapId:MapId='wildlands'):WorldProfile {
 const definition=getMapDefinition(mapId),rng=new RNG(seed^0x5731abc),turn=seed===0?0:rng.int(0,3);
 const profile:WorldProfile={definition,turn,hillShift:seed===0?0:rng.between(-12,12),relief:seed===0?1:rng.between(.85,1.2),lake:{...WORLD.lake},landmarks:[]};
 const center=worldPoint({x:-44+(seed===0?0:rng.between(-5,5)),z:70+(seed===0?0:rng.between(-5,5))},profile);
 profile.lake={...WORLD.lake,...center};
 profile.landmarks=definition.landmarks.map(mark=>({...mark,...(mark.biome==='lake'?center:worldPoint(mark,profile))}));
 return profile;
}
export function worldPoint(point:Vec2,profile:WorldProfile):Vec2 {
 const {x,z}=point,s=WORLD.scale;
 return profile.turn===1?{x:-z*s,z:x*s}:profile.turn===2?{x:-x*s,z:-z*s}:profile.turn===3?{x:z*s,z:-x*s}:{x:x*s,z:z*s};
}
export function localPoint(point:Vec2,profile:WorldProfile):Vec2 {
 const {x,z}=point,s=WORLD.scale;
 return profile.turn===1?{x:z/s,z:-x/s}:profile.turn===2?{x:-x/s,z:-z/s}:profile.turn===3?{x:-z/s,z:x/s}:{x:x/s,z:z/s};
}
export const DEFAULT_WORLD=worldProfile();
export const siteAvailable=(poi:POI,elapsed:number)=>(poi.availableAt??0)<=elapsed;
