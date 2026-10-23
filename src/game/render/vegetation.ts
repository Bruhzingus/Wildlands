import {VertexBuffer,type Mesh} from '@babylonjs/core';
import type {MapDefinition} from '../../data/maps.ts';

export type TreeFamily='pine'|'tiered'|'round'|'dead';
type TreeWeights=Pick<MapDefinition['vegetation'],'pineWeight'|'tieredWeight'|'roundWeight'|'deadWeight'>;

/** Bake gentle warm crowns and mossy undersides into a shared source once.
 * These are multipliers for the map's own material, preserving biome colors
 * without extra materials, textures, instances or work during animation. */
export function tintVegetationSource(mesh:Mesh,kind:'foliage'|'bark'='foliage'):void{
 const positions=mesh.getVerticesData(VertexBuffer.PositionKind);
 if(!positions?.length)return;
 const normals=mesh.getVerticesData(VertexBuffer.NormalKind),colors=new Float32Array(positions.length/3*4);
 let bottom=Infinity,top=-Infinity;
 for(let i=1;i<positions.length;i+=3){bottom=Math.min(bottom,positions[i]);top=Math.max(top,positions[i]);}
 const height=Math.max(.001,top-bottom);
 for(let i=0;i<positions.length;i+=3){
  const rise=(positions[i+1]-bottom)/height,offset=i/3*4;
  // Upward facets catch a little more light; this stays independent of the
  // moving sun so the live lighting remains responsible for its direction.
  const facet=.98+Math.max(0,normals?.[i+1]??0)*.035;
  if(kind==='foliage'){
   const value=(.84+rise*.22)*facet;
   colors[offset]=value*(.97+rise*.1);
   colors[offset+1]=value*(1.02+rise*.025);
   colors[offset+2]=value*(1.04-rise*.15);
  }else{
   const value=(.83+rise*.22)*facet;
   colors[offset]=value*1.06;colors[offset+1]=value*.99;colors[offset+2]=value*.94;
  }
  colors[offset+3]=1;
 }
 mesh.setVerticesData(VertexBuffer.ColorKind,colors);mesh.useVertexColors=true;
}

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
