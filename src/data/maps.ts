import {BIOMES,LANDMARKS,LANDMARK_PROPS,WORLD,type WorldProp} from './world.ts';
import {RNG} from '../utils/random.ts';
import type {POI,Vec2} from '../game/types.ts';
import {ATMOSPHERES,type AtmosphereKey} from './atmosphere.ts';

export type MapId='wildlands'|'pinewood-route'|'ruins-route'|'volcanic-ridge';
export interface MapDefinition {
 id:MapId;title:string;description:string;seed?:number;geography:'rolling'|'ridge';encounterId:'wildlands'|'volcanic';
 palette:typeof BIOMES;waterColor:string;shoreColor:string;skyColor:string;fogColor:string;
 scenery:{bark:string;pine:string;bush:string;rock:string;flower:string;ruins:string;rockChance:number;rockHeight:number};
 /** Presentation only; these values never participate in scenery or collision RNG. */
 ground:{patchColor:string;earthColor:string;patchSize:number;patchDensity:number;patchStrength:number;earthStrength:number;shoreWidth:number;shoreStrength:number};
 vegetation:{pineWeight:number;tieredWeight:number;roundWeight:number;deadWeight:number;round:string;pineTip:string;dead:string};
 rocks:{clusters:number;minGroup:number;maxGroup:number;spread:number};
 /** Seeded scenery composition; collision and rendering consume the same layout. */
 placement:{regions:number;width:number;treeFloor:number;woodlandBoost:number;shrubKeep:number;flowerKeep:number;treeGap:number;openingRadius:number;attempts:number;horizonDensity:number;rockAffinity:'none'|'woodland'|'height'};
 surfaceDetails:{tufts:number;flowers:number;mushrooms:number;stumps:number;chips:number;grass:string;petals:string;cap:string;wood:string;chip:string};
 dressing:{shrineRadius:number;cacheRadius:number;groveRadius:number;approachWidth:number;clearingStrength:number;stone:string};
 atmosphere:readonly AtmosphereKey[];
 landmarks:typeof LANDMARKS;landmarkProps:readonly WorldProp[];
 changes:readonly {at:number;kind:POI['kind'];label:string;name:string}[];
 terrain:{ridgeHeight:number;clearingHeight:number;valleyDepth:number;clusterSpread:number};
 lighting:{sky:number;sun:number};
}
const changes:MapDefinition['changes']=[
 {at:180,kind:'cache',name:'Bloom cache',label:'The wilds bloom. A new discovery cache opens along the trails.'},
 {at:420,kind:'cache',name:'Storm salvage',label:'A passing storm uncovers a free salvage cache.'},
 {at:660,kind:'shrine',name:'Roaming shrine',label:'An ancient shrine awakens in the outer wilds.'},
];
const wildlands:MapDefinition={id:'wildlands',title:'Wildlands',description:'Shifting hills, four regions, 18 discoveries and changing trails. Mewtwo arrives at 15:00.',
 geography:'rolling',encounterId:'wildlands',palette:{...BIOMES,meadow:{...BIOMES.meadow,color:'#819365'},woodland:{...BIOMES.woodland,color:'#5d765b'},ruins:{...BIOMES.ruins,color:'#92917a'},lake:{...BIOMES.lake,color:'#788c6b'}},waterColor:'#638f98',shoreColor:'#b8a17b',skyColor:'#a1c4d1',fogColor:'#a2bbbd',
 ground:{patchColor:'#929b70',earthColor:'#ad9977',patchSize:29,patchDensity:.38,patchStrength:.48,earthStrength:.42,shoreWidth:5.6,shoreStrength:.85},
 vegetation:{pineWeight:.4,tieredWeight:.18,roundWeight:.42,deadWeight:0,round:'#638456',pineTip:'#52735a',dead:'#756752'},
 rocks:{clusters:14,minGroup:2,maxGroup:5,spread:5.5},
 placement:{regions:5,width:32,treeFloor:.12,woodlandBoost:.12,shrubKeep:.54,flowerKeep:.5,treeGap:2.4,openingRadius:36,attempts:48,horizonDensity:.66,rockAffinity:'none'},
 dressing:{shrineRadius:5.2,cacheRadius:3.6,groveRadius:4.2,approachWidth:2.4,clearingStrength:.58,stone:'#677064'},atmosphere:ATMOSPHERES.wildlands,
 surfaceDetails:{tufts:100,flowers:18,mushrooms:0,stumps:0,chips:0,grass:'#56734a',petals:'#c7bca0',cap:'#95725d',wood:'#76604b',chip:'#6b6568'},
 scenery:{bark:'#78604b',pine:'#375d47',bush:'#648561',rock:'#707c74',flower:'#debd74',ruins:'#747c6d',rockChance:0,rockHeight:.55},landmarks:LANDMARKS,landmarkProps:LANDMARK_PROPS,changes,
 terrain:{ridgeHeight:12,clearingHeight:8,valleyDepth:2.4,clusterSpread:16},lighting:{sky:.9,sun:.95}};
export const MAP_DEFINITIONS:Readonly<Record<MapId,MapDefinition>>={
 wildlands,
 'pinewood-route':{...wildlands,id:'pinewood-route',title:'Pinewood route',description:'A repeatable expedition through the expanded Wildlands. Learn its geography and changing discoveries.',seed:46837,
  palette:{meadow:{...BIOMES.meadow,color:'#677d61'},woodland:{...BIOMES.woodland,color:'#4f6954'},ruins:{...BIOMES.ruins,color:'#7e8272'},lake:{...BIOMES.lake,color:'#637d70'}},
  shoreColor:'#938b70',ground:{...wildlands.ground,patchColor:'#75836a',earthColor:'#81785e',patchSize:25,patchDensity:.32,patchStrength:.38,earthStrength:.35,shoreWidth:4.8,shoreStrength:.7},
  scenery:{...wildlands.scenery,bark:'#6b5b4c',pine:'#37594a',bush:'#536e56',rock:'#66736e',ruins:'#65736a'},
  rocks:{clusters:10,minGroup:2,maxGroup:4,spread:5},
  placement:{...wildlands.placement,regions:6,width:35,treeFloor:.08,woodlandBoost:.3,shrubKeep:.42,horizonDensity:.8,rockAffinity:'woodland'},
  dressing:{...wildlands.dressing,stone:'#616d68',clearingStrength:.52},atmosphere:ATMOSPHERES.pine,
  surfaceDetails:{...wildlands.surfaceDetails,tufts:80,flowers:0,mushrooms:24,stumps:7,grass:'#46634b',cap:'#96725f',wood:'#665747'},
  vegetation:{pineWeight:.58,tieredWeight:.34,roundWeight:.08,deadWeight:0,round:'#54725c',pineTip:'#496956',dead:'#655e50'}},
 'ruins-route':{...wildlands,id:'ruins-route',title:'Ruins route',description:'A second repeatable expedition with its own terrain, sites and trail orientation.',seed:81073,
  ground:{...wildlands.ground,patchColor:'#959878',earthColor:'#a59c7d'},
  rocks:{...wildlands.rocks,clusters:16},
  placement:{...wildlands.placement,regions:4,width:34,horizonDensity:.62},
  surfaceDetails:{...wildlands.surfaceDetails,tufts:80,flowers:12},
  vegetation:{...wildlands.vegetation,pineWeight:.36,tieredWeight:.16,roundWeight:.48}},
 'volcanic-ridge':{...wildlands,id:'volcanic-ridge',title:'Volcanic Ridge',description:'Basalt ridges, ash groves and a crater lake. Fire and Rock encounters; Moltres descends at 15:00.',geography:'ridge',encounterId:'volcanic',
  terrain:{ridgeHeight:16,clearingHeight:10,valleyDepth:3,clusterSpread:13},
  lighting:{sky:.85,sun:1},
  palette:{meadow:{name:'Ashen Clearing',color:'#83776f',mapColor:'#998165'},woodland:{name:'Ember Grove',color:'#75655b',mapColor:'#6e594c'},ruins:{name:'Basalt Ridge',color:'#6a6268',mapColor:'#736a79'},lake:{name:'Crater Shore',color:'#877663',mapColor:'#947c68'}},
  ground:{patchColor:'#665f60',earthColor:'#9d765f',patchSize:32,patchDensity:.36,patchStrength:.38,earthStrength:.4,shoreWidth:4.5,shoreStrength:.65},
  vegetation:{pineWeight:0,tieredWeight:0,roundWeight:0,deadWeight:1,round:'#615c4f',pineTip:'#6b5b50',dead:'#61504a'},
  rocks:{clusters:26,minGroup:3,maxGroup:5,spread:6},
  placement:{...wildlands.placement,regions:3,width:26,treeFloor:.05,woodlandBoost:0,shrubKeep:.2,flowerKeep:0,treeGap:3,horizonDensity:.4,rockAffinity:'height'},
  dressing:{...wildlands.dressing,stone:'#4e474b',clearingStrength:.5},atmosphere:ATMOSPHERES.volcanic,
  surfaceDetails:{...wildlands.surfaceDetails,tufts:0,flowers:0,mushrooms:0,stumps:0,chips:90,chip:'#4f494f'},
  waterColor:'#70a6a5',shoreColor:'#b09773',skyColor:'#dbb49a',fogColor:'#b89e8b',
  scenery:{bark:'#665451',pine:'#6f5040',bush:'#9a7750',rock:'#59525e',flower:'#e2a45b',ruins:'#5b5360',rockChance:.28,rockHeight:1.15},
  landmarks:[{id:'ash-spire',name:'Ash Spire',initial:'A',biome:'woodland',x:-61,z:-50},{id:'cinder-gate',name:'Cinder Gate',initial:'C',biome:'ruins',x:61,z:-49},{id:'sun-stones',name:'Sun Stones',initial:'S',biome:'meadow',x:54,z:40},{id:'crater',name:'Crater Lake',initial:'L',biome:'lake',x:-44,z:70}],
  landmarkProps:[{kind:'rock',x:-61,z:-50,scale:2.8,scaleY:2.6,landmark:true},{kind:'rock',x:-65,z:-52,scale:1.5,landmark:true},
   {kind:'ruin',x:55.5,z:-49,scale:1.1,scaleY:3,landmark:true},{kind:'ruin',x:66.5,z:-49,scale:1.1,scaleY:3,landmark:true},
   {kind:'rock',x:50,z:40,scale:2.4,scaleY:1.5,landmark:true},{kind:'rock',x:56,z:44,scale:1.8,landmark:true},{kind:'rock',x:58,z:36,scale:1.3,landmark:true}],
  changes:[{at:180,kind:'cache',name:'Geothermal cache',label:'Geothermal pressure opens a new discovery cache.'},{at:420,kind:'cache',name:'Exposed relic cache',label:'An ash squall exposes a free relic cache.'},{at:660,kind:'shrine',name:'Cinder shrine',label:'A cinder shrine awakens on the ridge.'}],
 },
};
export const getMapDefinition=(id:MapId='wildlands')=>MAP_DEFINITIONS[id]??wildlands;
export interface TerrainForm extends Vec2 {length:number;width:number;angle:number;height:number;}
export interface WorldProfile {definition:MapDefinition;turn:number;hillShift:number;relief:number;lake:{x:number;z:number;waterRadius:number;shoreRadius:number;waterHeight:number};landmarks:typeof LANDMARKS;
 composition:{variant:number;forms:TerrainForm[];hubs:Vec2[];clusters:Vec2[]};}
/** Rotation, lake position and relief share a seed across simulation, renderer and minimap. */
export function worldProfile(seed=0,mapId:MapId='wildlands'):WorldProfile {
 const definition=getMapDefinition(mapId),rng=new RNG(seed^0x5731abc),turn=seed===0?0:rng.int(0,3);
 const profile:WorldProfile={definition,turn,hillShift:seed===0?0:rng.between(-12,12),relief:seed===0?1:rng.between(.85,1.2),lake:{...WORLD.lake},landmarks:[],composition:{variant:0,forms:[],hubs:[],clusters:[]}};
 const center=worldPoint({x:-44+(seed===0?0:rng.between(-5,5)),z:70+(seed===0?0:rng.between(-5,5))},profile);
 profile.lake={...WORLD.lake,...center};
 profile.landmarks=definition.landmarks.map(mark=>({...mark,...(mark.biome==='lake'?center:worldPoint(mark,profile))}));
 const variant=rng.int(0,2),tuning=definition.terrain,shift=profile.hillShift;
 // Three compositions change the saddles, ridge orientation and trail junctions,
 // independently of quarter-turn orientation. Coordinates stay in map-local space.
 profile.composition={variant,forms:[
  {x:-63+shift*.4,z:-42,length:56,width:29,angle:[.2,.85,-.5][variant],height:tuning.ridgeHeight*.85},
  {x:63,z:-43+shift*.5,length:50,width:31,angle:[-.65,.1,.7][variant],height:tuning.ridgeHeight},
  {x:50-shift*.3,z:47,length:38,width:34,angle:0,height:tuning.clearingHeight},
  {x:[-23,12,25][variant],z:[-62,-68,52][variant],length:65,width:24,angle:[.1,-.3,.5][variant],height:-tuning.valleyDepth},
  {x:-74,z:55,length:47,width:30,angle:.55,height:tuning.clearingHeight*.5},
 ],hubs:[{x:-29-variant*3,z:-24+variant*4},{x:32-variant*4,z:-27-variant*3},{x:29+variant*4,z:29-variant*3},{x:-26+variant*3,z:29+variant*2}],
 clusters:Array.from({length:20},()=>({x:rng.between(-105,105),z:rng.between(-105,105)}))};
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
