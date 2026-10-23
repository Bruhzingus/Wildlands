import {Color3,Mesh,Scene,StandardMaterial,VertexData} from '@babylonjs/core';
import {DESIGN} from '../../data/config.ts';
import type {WorldProfile} from '../../data/maps.ts';
import {terrainHeight} from '../systems/environment.ts';
import {createTerrainPalette} from './terrainPalette.ts';

/** One continuous annulus closes all four sides and corners. Its inner row
 * matches the ground's 116 edge subdivisions exactly; everything outside is
 * scenic terrain behind the existing authoritative movement boundary. */
export function buildWorldPerimeter(scene:Scene,seed:number,profile:WorldProfile,material:StandardMaterial):Mesh {
 const mesh=new Mesh('scenic perimeter foothills',scene),data=new VertexData(),positions:number[]=[],indices:number[]=[],colors:number[]=[];
 const segments=116,count=segments*4,radius=DESIGN.mapRadius,bands=[0,7,20,43,75,118,178,260,410];
 const phase=(seed%65521)*.013,volcanic=profile.definition.geography==='ridge';
 const sample=createTerrainPalette(profile,seed),color=new Color3(),stone=Color3.FromHexString(profile.definition.scenery.rock);
 for(const [band,width] of bands.entries())for(let index=0;index<count;index++){
  const side=Math.floor(index/segments),t=(index%segments)/segments,along=-1+t*2;
  const u=side===0?along:side===1?1:side===2?-along:-1,v=side===0?-1:side===1?along:side===2?1:-along;
  const angle=Math.atan2(v,u),waves=.5+.24*Math.sin(angle*5+phase+band*.83)+.16*Math.sin(angle*11-phase*.7-band*.51)+.1*Math.cos(angle*19+phase+band);
  const distance=radius+width*(1+(band>1?(waves-.5)*.2:0)),x=u*distance,z=v*distance;
  const edgeHeight=terrainHeight(u*radius,v*radius,profile);
  const height=band===0?edgeHeight:band===1?terrainHeight(x,z,profile):
   band===2?edgeHeight+2+waves*4:band===3?edgeHeight+3+waves*(volcanic?24:13):
   band===4?3+waves*(volcanic?45:22):band===5?2+waves*(volcanic?65:35):
   band===6?4+waves*(volcanic?85:48):band===7?waves*(volcanic?60:38):-18;
  positions.push(x,height,z);sample(x,z,height,color);
  Color3.LerpToRef(color,stone,band===0?0:Math.min(.76,band*.09+(volcanic?.1:0)),color);colors.push(color.r,color.g,color.b,1);
  if(band){const a=(band-1)*count+index,b=(band-1)*count+(index+1)%count,c=band*count+index,d=band*count+(index+1)%count;indices.push(a,c,b,b,c,d);}
 }
 const normals:number[]=[];VertexData.ComputeNormals(positions,indices,normals);data.positions=positions;data.indices=indices;data.normals=normals;data.colors=colors;data.applyToMesh(mesh);
 mesh.material=material;mesh.useVertexColors=true;mesh.isPickable=false;mesh.checkCollisions=false;mesh.freezeWorldMatrix();
 return mesh;
}
