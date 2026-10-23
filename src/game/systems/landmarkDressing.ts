import type {WorldProfile} from '../../data/maps.ts';
import {RNG} from '../../utils/random.ts';
import type {BerryTree,POI,Vec2} from '../types.ts';
import {explorationRoute,terrainHeight,type EnvironmentLayout} from './environment.ts';

export interface Clearing extends Vec2 {radius:number;strength:number;}
export interface DressingPart extends Vec2 {kind:'paver'|'post'|'rock'|'plant';sx:number;sy:number;sz:number;rotation:number;}
export interface DressingSite extends Vec2 {uid:number;kind:POI['kind']|'grove';radius:number;approach:Vec2;parts:DressingPart[];}

/** Cosmetic layout only: no POI, berry, obstacle or simulation RNG mutations. */
export function createLandmarkDressing(seed:number,profile:WorldProfile,pois:readonly POI[],berries:readonly BerryTree[],layout:EnvironmentLayout):DressingSite[]{
 const tuning=profile.definition.dressing,sites:DressingSite[]=[];
 for(const site of [...pois,...berries.map(tree=>({...tree,kind:'grove' as const}))]){
  const grove=site.kind==='grove',radius=grove?tuning.groveRadius:site.kind==='cache'?tuning.cacheRadius:tuning.shrineRadius;
  const route=grove?[{x:0,z:0},site]:explorationRoute(site,profile),from=route[route.length-2];
  const distance=Math.hypot(from.x-site.x,from.z-site.z)||1,forward={x:(from.x-site.x)/distance,z:(from.z-site.z)/distance},right={x:forward.z,z:-forward.x};
  const rng=new RNG(seed^Math.imul(site.uid,0x1f3d5b79)),parts:DressingPart[]=[];
  const add=(kind:DressingPart['kind'],side:number,back:number,sx:number,sy:number,sz=sx)=>{
   const point={x:site.x+right.x*side-forward.x*back,z:site.z+right.z*side-forward.z*back},footprint=kind==='plant'?.6:kind==='paver'?Math.max(sx,sz):Math.max(sx,sz)*1.25;
   const approach=(point.x-site.x)*forward.x+(point.z-site.z)*forward.z,lateral=Math.abs((point.x-site.x)*right.x+(point.z-site.z)*right.z);
   if(approach>0&&lateral<tuning.approachWidth/2+footprint)return;
   if(Math.hypot(point.x-profile.lake.x,point.z-profile.lake.z)<profile.lake.shoreRadius+footprint)return;
   if(layout.obstacles.some(o=>Math.hypot(point.x-o.x,point.z-o.z)<footprint+(o.kind==='circle'?o.radius:Math.hypot(o.halfWidth,o.halfDepth))+.25))return;
   if(layout.features.some(f=>Math.hypot(point.x-f.x,point.z-f.z)<f.radius+footprint))return;
   if(pois.some(p=>p.uid!==site.uid&&Math.hypot(point.x-p.x,point.z-p.z)<5+footprint))return;
   if(Math.abs(terrainHeight(point.x,point.z,profile)-terrainHeight(site.x,site.z,profile))>1.5)return;
   parts.push({...point,kind,sx,sy,sz,rotation:rng.between(0,Math.PI*2)});
  };
  if(grove){
   add('plant',-2.8,1.4,.85,.85);add('plant',2.9,1.1,.9,.9);
   add('rock',-2.4,2.8,.24,.17);add('rock',2.5,2.7,.3,.2);
  }else if(site.kind==='cache'){
   add('rock',-2.4,1.25,.4,.3);add('rock',2.4,1.5,.32,.25);
   add('plant',-2.9,-.8,.8,.8);add('plant',2.8,-.75,.75,.75);
  }else{
   for(const [side,back] of [[-2.1,.1],[-1.6,2.3],[1.5,2.4],[2.2,0]])add('paver',side,back,.65+rng.next()*.12,.09,.5+rng.next()*.12);
   add('post',-3.35,2.5,.44,.64);add('post',3.3,2.6,.4,.82);
  }
  sites.push({uid:site.uid,kind:site.kind,x:site.x,z:site.z,radius,approach:forward,parts});
 }
 return sites;
}

export const landmarkClearings=(sites:readonly DressingSite[]):Clearing[]=>sites.map(site=>({x:site.x,z:site.z,radius:site.radius,strength:site.kind==='grove'?.5:1}));
