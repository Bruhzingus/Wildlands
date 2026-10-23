import {Color3,Mesh,Scene,Vector3,VertexData} from '@babylonjs/core';
import {RNG} from '../../utils/random.ts';

/** Position-based cosmetic variation leaves placement and simulation RNG alone. */
export function sceneryVariant(seed:number,x:number,z:number,count:number):number{
 let hash=seed^Math.imul(Math.round(x*4096),0x45d9f3b)^Math.imul(Math.round(z*4096),0x119de1f3);
 hash=Math.imul(hash^(hash>>>16),0x7feb352d);hash=Math.imul(hash^(hash>>>15),0x846ca68b);
 return ((hash^(hash>>>16))>>>0)%count;
}

/** An asymmetric, flat-shaded stone with a buried base and chipped shoulders.
 * Explicit bounds let both round boulders and rectangular obstacle proxies
 * keep their original footprints. No textures or per-frame deformation. */
export function createStoneMesh(scene:Scene,name:string,seed:number,width:number,height:number,depth:number,tint='#ffffff',radiusLimit?:number):Mesh{
 const rng=new RNG(seed),sides=7,points:Vector3[]=[],angles:number[]=[],radii:number[]=[];
 const leanX=rng.between(-.22,.22),leanZ=rng.between(-.18,.18);
 for(let side=0;side<sides;side++){angles.push(side*Math.PI*2/sides+rng.between(-.13,.13));radii.push(rng.between(.8,1));}
 for(let ring=0;ring<3;ring++)for(let side=0;side<sides;side++){
  const angle=angles[side],radius=radii[side]*(ring===0?.82:ring===1?1:rng.between(.48,.76));
  const y=ring===0?0:ring===1?rng.between(.22,.47):rng.between(.73,.99);
  points.push(new Vector3(Math.cos(angle)*radius+leanX*y,y,Math.sin(angle)*radius+leanZ*y));
 }
 points.push(new Vector3(leanX,1,leanZ));
 const min=points.reduce((a,p)=>Vector3.Minimize(a,p),new Vector3(Infinity,Infinity,Infinity));
 const max=points.reduce((a,p)=>Vector3.Maximize(a,p),new Vector3(-Infinity,-Infinity,-Infinity));
 for(const point of points)point.set(((point.x-min.x)/(max.x-min.x)-.5)*width,point.y*height,((point.z-min.z)/(max.z-min.z)-.5)*depth);
 if(radiusLimit)for(const point of points){const radius=Math.hypot(point.x,point.z);if(radius>radiusLimit){point.x*=radiusLimit/radius;point.z*=radiusLimit/radius;}}
 const positions:number[]=[],indices:number[]=[],colors:number[]=[],color=Color3.FromHexString(tint);
 const face=(a:number,b:number,c:number)=>{
  const start=positions.length/3,shade=rng.between(.9,1.055);
  for(const index of [a,b,c]){positions.push(...points[index].asArray());colors.push(Math.min(1,color.r*shade),Math.min(1,color.g*shade),Math.min(1,color.b*shade),1);}
  indices.push(start,start+2,start+1);
 };
 for(let side=0;side<sides;side++){
  const next=(side+1)%sides;
  for(let ring=0;ring<2;ring++){
   const a=ring*sides+side,b=ring*sides+next,c=(ring+1)*sides+side,d=(ring+1)*sides+next;
   // Alternate diagonals so the fractures do not form repeating stripes.
   if((side+ring)%2){face(a,c,b);face(b,c,d);}else{face(a,d,b);face(a,c,d);}
  }
  face(2*sides+side,3*sides,2*sides+next);
 }
 for(let side=1;side<sides-1;side++)face(0,side,side+1);
 const mesh=new Mesh(name,scene),data=new VertexData();data.positions=positions;data.indices=indices;data.colors=colors;data.normals=[];
 VertexData.ComputeNormals(positions,indices,data.normals);data.applyToMesh(mesh);mesh.useVertexColors=true;mesh.isPickable=false;
 return mesh;
}

/** Two interlocking masses, merged once and then instanced like the old block. */
export function createStoneOutcrop(scene:Scene,name:string,variant:number):Mesh{
 const primary=createStoneMesh(scene,'outcrop crown',0x51ab+variant*137,1.85,2.2,1.8);
 primary.position.x=-.275;
 const shoulder=createStoneMesh(scene,'outcrop fractured shoulder',0x173f+variant*211,1.15,variant===1?1.62:1.12,1.46);
 shoulder.position.set(.625,0,variant===2?-.12:.14);
 const mesh=Mesh.MergeMeshes([primary,shoulder],true,false,undefined,false,false)!;
 mesh.name=name;mesh.isPickable=false;return mesh;
}
