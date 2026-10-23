import {worldPoint,type WorldProfile} from '../../data/maps.ts';
import {RNG} from '../../utils/random.ts';
import type {BerryTree,POI} from '../types.ts';
import {biomeAt,sceneryClearance,terrainHeight,type EnvironmentLayout} from './environment.ts';
import {sceneryDensity} from './sceneryDensity.ts';

export type SurfaceDetailKind='tuft'|'flower'|'mushroom'|'stump'|'chip';
export interface SurfaceDetail {kind:SurfaceDetailKind;x:number;z:number;y:number;scale:number;rotation:number;}

/** Bounded, isolated cosmetic RNG. Never enters props, collision, targeting or
 * the simulation RNG, so switching detail visibility cannot change a run. */
export function createSurfaceDetails(seed:number,profile:WorldProfile,pois:readonly POI[],layout:EnvironmentLayout,berries:readonly BerryTree[]=[]):SurfaceDetail[]{
 const tuning=profile.definition.surfaceDetails,rng=new RNG(seed^0x71c4e392),details:SurfaceDetail[]=[];
 const rocks=layout.props.filter(p=>p.rockCluster!==undefined);
 const clear=sceneryClearance(profile,pois,layout.obstacles,layout.features);
 const budgets:[SurfaceDetailKind,number][]=[['tuft',tuning.tufts],['flower',tuning.flowers],['mushroom',tuning.mushrooms],['stump',tuning.stumps],['chip',tuning.chips]];
 for(const [kind,budget] of budgets){
  let added=0;
  for(let attempt=0;attempt<budget*35&&added<budget;attempt++){
   let point=worldPoint({x:rng.between(-106,106),z:rng.between(-106,106)},profile);
   // Small clumps occupy the sides of broad patches, never a uniform carpet.
   if(kind==='flower'&&berries.length&&attempt%2===0){
    const tree=rng.pick(berries),angle=rng.between(0,Math.PI*2),reach=rng.between(4,9);
    point={x:tree.x+Math.sin(angle)*reach,z:tree.z+Math.cos(angle)*reach};
   }else if(kind==='chip'){
    if(rocks.length){const rock=rng.pick(rocks),angle=rng.between(0,Math.PI*2),reach=rng.between(2.5,6);point={x:rock.x+Math.sin(angle)*reach,z:rock.z+Math.cos(angle)*reach};}
   }
   const biome=biomeAt(point.x,point.z,profile),patch=sceneryDensity(point.x,point.z,profile);
   if((kind==='mushroom'||kind==='stump')&&biome!=='woodland')continue;
   if((kind==='tuft'||kind==='mushroom')&&rng.next()>patch)continue;
   const radius=kind==='stump'?.65:.6;
   if(!clear(point,radius)||details.some(p=>Math.hypot(p.x-point.x,p.z-point.z)<(p.kind===kind&&kind==='flower'?1.2:2.4)))continue;
   // Keep even tiny bases grounded on hills; reject abrupt shore/ridge edges.
   const y=terrainHeight(point.x,point.z,profile);
   if([[radius,0],[-radius,0],[0,radius],[0,-radius]].some(([dx,dz])=>Math.abs(terrainHeight(point.x+dx,point.z+dz,profile)-y)>.45))continue;
   details.push({kind,...point,y:y-.025,scale:rng.between(.8,1.15),rotation:rng.between(0,Math.PI*2)});added++;
  }
 }
 return details;
}
