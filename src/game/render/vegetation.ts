import type {MapDefinition} from '../../data/maps.ts';

export type TreeFamily='pine'|'tiered'|'round'|'dead';
type TreeWeights=Pick<MapDefinition['vegetation'],'pineWeight'|'tieredWeight'|'roundWeight'|'deadWeight'>;

/** Cosmetic choices never consume the generator or simulation RNG. */
export function treeVisual(seed:number,x:number,z:number,weights:TreeWeights,landmark=false):{family:TreeFamily;rotation:number;scale:number}{
 const noise=(salt:number)=>{
  let hash=seed^Math.imul(Math.round(x*4096),0x45d9f3b)^Math.imul(Math.round(z*4096),0x119de1f3)^salt;
  hash=Math.imul(hash^(hash>>>16),0x7feb352d);hash=Math.imul(hash^(hash>>>15),0x846ca68b);
  return ((hash^(hash>>>16))>>>0)/4294967296;
 };
 const roll=noise(0x34ae13),family:TreeFamily=landmark&&weights.deadWeight<1?'pine'
  :roll<weights.pineWeight?'pine':roll<weights.pineWeight+weights.tieredWeight?'tiered'
  :roll<weights.pineWeight+weights.tieredWeight+weights.roundWeight?'round':'dead';
 return {family,rotation:noise(0x17f498)*Math.PI*2,scale:.9+noise(0x72dbca)*.2};
}
