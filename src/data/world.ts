export type BiomeId='meadow'|'woodland'|'ruins'|'lake';
export type WorldProp={kind:'rock'|'bush'|'tree'|'flower'|'ruin';x:number;z:number;scale:number;scaleY?:number;rotation?:number;landmark?:boolean;rockCluster?:number};
/** Shared by the renderer and collision; tiny cosmetic chips are separate. */
export const ROCK_SCALES={small:.65,medium:1.05,anchor:1.75} as const;
export const BIOMES:Readonly<Record<BiomeId,{name:string;color:string;mapColor:string}>>={
 meadow:{name:'Open Meadow',color:'#789352',mapColor:'#7e925b'},
 woodland:{name:'Pinewood',color:'#49674b',mapColor:'#405c47'},
 ruins:{name:'Old Ruins',color:'#969773',mapColor:'#949476'},
 lake:{name:'Lake Edge',color:'#6d8c77',mapColor:'#668a85'},
};
export const WORLD={scale:1.25,safeSpawnRadius:17,poiClearance:5,poiSpacing:17,routeHalfWidth:2.1,softBoundaryStart:105*1.25,hardBoundary:113*1.25,
 lake:{x:-44*1.25,z:70*1.25,waterRadius:18*1.25,shoreRadius:22*1.25,waterHeight:.18},rareEventChance:.08,propAttempts:1640,maxProps:820,
} as const;
/** Fixed silhouettes give directions meaning; loot and smaller encounters move each run. */
export const LANDMARKS:readonly {id:string;name:string;initial:string;biome:BiomeId;x:number;z:number}[]=[
 {id:'great-pine',name:'Great Pine',initial:'P',biome:'woodland',x:-61,z:-50},
 {id:'broken-gate',name:'Broken Gate',initial:'G',biome:'ruins',x:61,z:-49},
 {id:'watchstones',name:'Watchstones',initial:'W',biome:'meadow',x:54,z:40},
 {id:'stillwater',name:'Stillwater',initial:'L',biome:'lake',x:-44,z:70},
];
export const LANDMARK_PROPS:readonly WorldProp[]=[
 {kind:'tree',x:-61,z:-50,scale:3.1,landmark:true},
 {kind:'ruin',x:55.5,z:-49,scale:1.1,scaleY:3,rotation:0,landmark:true},
 {kind:'ruin',x:66.5,z:-49,scale:1.1,scaleY:3,rotation:0,landmark:true},
 {kind:'rock',x:50,z:40,scale:2.4,landmark:true},
 {kind:'rock',x:56,z:44,scale:1.8,landmark:true},
 {kind:'rock',x:58,z:36,scale:1.3,landmark:true},
];
