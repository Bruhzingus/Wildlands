import {localPoint,type WorldProfile} from '../../data/maps.ts';
import {clamp} from '../../utils/random.ts';

/** A handful of broad, warped regions; sampled by trees, shrubs and tiny details.
 * Existing seed-authored centers supply variation without another gameplay RNG. */
export function sceneryDensity(x:number,z:number,profile:WorldProfile):number {
 const tuning=profile.definition.placement,point=localPoint({x,z},profile);
 const wx=point.x+7*Math.sin(point.z*.047+profile.hillShift),wz=point.z+6*Math.sin(point.x*.039-profile.hillShift);
 let density=0;
 for(const center of profile.composition.clusters.slice(0,tuning.regions)){
  const dx=(wx-center.x)/tuning.width,dz=(wz-center.z)/(tuning.width*.8);
  density=Math.max(density,Math.exp(-dx*dx-dz*dz));
 }
 // Soft forest bands retain gaps without a straight biome-border density step.
 const smooth=(value:number)=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
 const forest=Math.max(smooth((-24-point.z)/22)*(1-smooth((point.x-10)/28)),smooth((-45-point.x)/22)*(1-smooth((point.z-20)/28)));
 density+=tuning.woodlandBoost*forest;
 return clamp(tuning.treeFloor+(1-tuning.treeFloor)*density,0,1);
}
