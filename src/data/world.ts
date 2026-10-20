export type BiomeId='meadow'|'woodland'|'ruins'|'lake';
export const BIOMES:Readonly<Record<BiomeId,{name:string;color:string;mapColor:string}>>={
 meadow:{name:'Open Meadow',color:'#789352',mapColor:'#7e925b'},
 woodland:{name:'Pinewood',color:'#49674b',mapColor:'#405c47'},
 ruins:{name:'Old Ruins',color:'#969773',mapColor:'#949476'},
 lake:{name:'Lake Edge',color:'#6d8c77',mapColor:'#668a85'},
};
export const WORLD={safeSpawnRadius:17,poiClearance:5,poiSpacing:17,routeHalfWidth:2.1,softBoundaryStart:105,hardBoundary:113,
 lake:{x:-44,z:70,waterRadius:18,shoreRadius:22,waterHeight:.18},rareEventChance:.08,propAttempts:1050,maxProps:610,
} as const;
/** Fixed silhouettes give directions meaning; loot and smaller encounters move each run. */
export const LANDMARKS:readonly {id:string;name:string;initial:string;biome:BiomeId;x:number;z:number}[]=[
 {id:'great-pine',name:'Great Pine',initial:'P',biome:'woodland',x:-61,z:-50},
 {id:'broken-gate',name:'Broken Gate',initial:'G',biome:'ruins',x:61,z:-49},
 {id:'watchstones',name:'Watchstones',initial:'W',biome:'meadow',x:54,z:40},
 {id:'stillwater',name:'Stillwater',initial:'L',biome:'lake',x:-44,z:70},
];
