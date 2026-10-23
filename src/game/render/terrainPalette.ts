import {Color3} from '@babylonjs/core';
import {localPoint,type WorldProfile} from '../../data/maps.ts';
import {RNG,clamp} from '../../utils/random.ts';
import {biomeAt} from '../systems/environment.ts';
import type {Clearing} from '../systems/landmarkDressing.ts';

const smooth=(a:number,b:number,value:number)=>{const t=clamp((value-a)/(b-a),0,1);return t*t*(3-2*t);};

/** Color-only study of broad earth/olive patches. Own RNG stream leaves gameplay
 * generation untouched; continuous masks avoid tiled textures or floating decals. */
export function createTerrainPalette(profile:WorldProfile,seed:number,clearings:readonly Clearing[]=[]){
 const {definition,lake}=profile,tuning=definition.ground,rng=new RNG(seed^0x18b6ad45);
 const phase=[rng.between(-Math.PI,Math.PI),rng.between(-Math.PI,Math.PI),rng.between(-Math.PI,Math.PI)];
 const palette=Object.fromEntries(Object.entries(definition.palette).map(([id,biome])=>[id,Color3.FromHexString(biome.color)]));
 const patch=Color3.FromHexString(tuning.patchColor),earth=Color3.FromHexString(tuning.earthColor),shore=Color3.FromHexString(definition.shoreColor),stone=Color3.FromHexString(definition.scenery.rock);
 return (x:number,z:number,height:number,result:Color3)=>{
  const biome=palette[biomeAt(x,z,profile)];result.copyFrom(biome).scaleInPlace(.4);
  for(const [dx,dz] of [[-4,0],[4,0],[0,-4],[0,4]]){
   const neighbour=palette[biomeAt(x+dx,z+dz,profile)];
   result.r+=neighbour.r*.15;result.g+=neighbour.g*.15;result.b+=neighbour.b*.15;
  }
  Color3.LerpToRef(result,stone,clamp((height-5)*.018,0,.18),result);
  const p=localPoint({x,z},profile),size=tuning.patchSize;
  // Wavelengths are tens of world units: a patch spans several tree widths.
  const u=p.x/size+.17*Math.sin(p.z/size*1.3+phase[1]),v=p.z/size+.2*Math.sin(p.x/size+phase[0]);
  const field=.5+.26*Math.sin(u*2.1+phase[0])+.17*Math.cos(v*2.7+phase[1])+.07*Math.sin((u+v)*3.1+phase[2]);
  const mask=smooth(1-tuning.patchDensity-.04,1-tuning.patchDensity+.05,field);
  Color3.LerpToRef(result,patch,mask*tuning.patchStrength,result);
  const soil=smooth(.76,.86,.5+.3*Math.sin(u*2.6+phase[2])+.2*Math.cos(v*2.1-phase[0]));
  Color3.LerpToRef(result,earth,soil*tuning.earthStrength,result);
  // Quiet patches of sun-dried grass at a smaller scale keep open combat
  // clearings from becoming a single flat swatch. Color only, baked once;
  // no extra props, textures, terrain displacement or simulation RNG.
  const meadow=.5+.28*Math.sin(x*.19+phase[0]+Math.sin(z*.11))+.22*Math.cos(z*.23+phase[2]);
  Color3.LerpToRef(result,patch,smooth(.43,.85,meadow)*.16,result);
  result.scaleInPlace(.975+.05*meadow);
  let clearing=0;
  for(const site of clearings){const distance=Math.hypot(x-site.x,z-site.z);if(distance<site.radius)clearing=Math.max(clearing,(1-smooth(site.radius*.48,site.radius,distance))*site.strength);}
  // A quiet earth anchor on the real heightfield; no floating decal geometry.
  Color3.LerpToRef(result,earth,clearing*definition.dressing.clearingStrength,result);
  // Shore lives on the exact original terrain vertices; water/collider bounds
  // and terrain heights remain authoritative. No overlay or raised torus.
  const distance=Math.hypot(x-lake.x,z-lake.z),edge=lake.waterRadius;
  const bank=smooth(edge-1,edge+.5,distance)*(1-smooth(edge+tuning.shoreWidth*.45,edge+tuning.shoreWidth,distance));
  Color3.LerpToRef(result,shore,bank*tuning.shoreStrength,result);
  return result;
 };
}
