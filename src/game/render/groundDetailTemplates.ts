import {Color3,Matrix,Mesh,MeshBuilder,Scene,VertexBuffer,VertexData} from '@babylonjs/core';
import type {MapDefinition} from '../../data/maps.ts';
import type {SurfaceDetailKind} from '../systems/surfaceDetails.ts';
import {RNG} from '../../utils/random.ts';
import {createStoneMesh} from './stoneFormations.ts';

const tint=(base:string,target:string,amount:number)=>Color3.Lerp(Color3.FromHexString(base),Color3.FromHexString(target),amount).toHexString();
function paint(mesh:Mesh,hex:string,topScale=1):Mesh{
 const color=Color3.FromHexString(hex),colors:number[]=[],normals=mesh.getVerticesData(VertexBuffer.NormalKind);
 for(let index=0;index<mesh.getTotalVertices();index++){
  const shade=normals&&normals[index*3+1]>.5?topScale:1;
  colors.push(Math.min(1,color.r*shade),Math.min(1,color.g*shade),Math.min(1,color.b*shade),1);
 }
 mesh.setVerticesData(VertexBuffer.ColorKind,colors);return mesh;
}

export function createDetailTemplate(scene:Scene,kind:SurfaceDetailKind,variant:number,tuning:MapDefinition['surfaceDetails']):Mesh{
 const parts:Mesh[]=[],rng=new RNG(0x79bc+variant*131);
 if(kind==='tuft'){
  const mesh=new Mesh('splayed grass blades',scene),data=new VertexData(),positions:number[]=[],indices:number[]=[],colors:number[]=[];
  for(let blade=0;blade<3+variant;blade++){
   const angle=blade*2.4+variant*.7,reach=rng.between(.18,.4),width=rng.between(.07,.13),height=rng.between(.34,.78)*(variant===1?.7:1);
   const x=Math.cos(angle),z=Math.sin(angle),base=positions.length/3;
   // A folded blade catches light on two planes rather than a flat triangle.
   positions.push(-z*width,0,x*width,z*width,0,-x*width,x*reach*.42,height*.42,z*reach*.42,x*reach,height,z*reach);
   indices.push(base,base+2,base+1,base,base+3,base+2,base+2,base+3,base+1);
   const color=Color3.FromHexString(tint(tuning.grass,blade%2?'#a2ad68':'#344f3e',.12+variant*.05));
   for(let i=0;i<4;i++)colors.push(color.r,color.g,color.b,1);
  }
  data.positions=positions;data.indices=indices;data.colors=colors;data.normals=[];VertexData.ComputeNormals(positions,indices,data.normals);data.applyToMesh(mesh);parts.push(mesh);
 }else if(kind==='flower'){
  for(let flower=0;flower<variant+1;flower++){
   const x=(flower-variant/2)*.27,z=flower%2*.2,height=.26+flower*.09;
   const stem=MeshBuilder.CreateCylinder('flower stem',{height,diameter:.04,tessellation:4},scene);stem.position.set(x,height/2,z);parts.push(paint(stem,tuning.grass));
   const leaf=MeshBuilder.CreateDisc('flower leaf',{radius:.11,tessellation:4},scene);leaf.scaling.set(1,.4,1);leaf.rotation.set(.8,flower,.5);leaf.position.set(x+.07,height*.4,z);parts.push(paint(leaf,tuning.grass));
   for(let petal=0;petal<5;petal++){
    const angle=petal*Math.PI*2/5+flower,mesh=MeshBuilder.CreateDisc('flower petal',{radius:.095,tessellation:5},scene);
    mesh.rotation.x=Math.PI/2;mesh.position.set(x+Math.sin(angle)*.105,height,z+Math.cos(angle)*.105);parts.push(paint(mesh,tint(tuning.petals,variant===2?'#d49a93':'#fff0d3',variant===0?.25:.45)));
   }
   const center=MeshBuilder.CreateCylinder('pollen center',{height:.025,diameter:.08,tessellation:5},scene);center.position.set(x,height+.008,z);parts.push(paint(center,'#c1a05e'));
  }
 }else if(kind==='mushroom'){
  const capColor=variant===0?tint(tuning.cap,'#ba5b4c',.7):variant===1?tint(tuning.cap,'#bb985f',.65):tint(tuning.cap,'#826958',.25);
  for(let mushroom=0;mushroom<variant+1;mushroom++){
   const size=mushroom===0?1:.58+mushroom*.04,x=mushroom===0?-.1:.19+mushroom*.025,z=mushroom===2?.22:mushroom===1?-.1:0;
   const stemHeight=(variant===1?.4:.25)*size,radius=(variant===2?.24:.31)*size,capHeight=(variant===1?.3:.2)*size;
   const stem=MeshBuilder.CreateCylinder('tapered mushroom stem',{height:stemHeight,diameterBottom:.14*size,diameterTop:.085*size,tessellation:5},scene);stem.position.set(x,stemHeight/2,z);stem.rotation.z=mushroom%2?-.13:.08;parts.push(paint(stem,'#c6baa0'));
   const cap=new Mesh('domed mushroom cap',scene),data=new VertexData(),positions:number[]=[],indices:number[]=[],sides=7;
   for(const [ringRadius,ringHeight] of [[1,0],[.78,.55],[.28,.96]])for(let side=0;side<sides;side++){
    const angle=side*Math.PI*2/sides;positions.push(x+Math.cos(angle)*radius*ringRadius,stemHeight+capHeight*ringHeight,z+Math.sin(angle)*radius*ringRadius*.9);
   }
   positions.push(x,stemHeight+capHeight,z);
   for(let side=0;side<sides;side++){
    const next=(side+1)%sides;
    for(let ring=0;ring<2;ring++){const a=ring*sides+side,b=ring*sides+next,c=a+sides,d=b+sides;indices.push(a,b,c,b,d,c);}
    indices.push(2*sides+side,2*sides+next,3*sides);
   }
   data.positions=positions;data.indices=indices;data.normals=[];VertexData.ComputeNormals(positions,indices,data.normals);data.applyToMesh(cap);cap.convertToFlatShadedMesh();parts.push(paint(cap,capColor,1.12));
   const underside=MeshBuilder.CreateCylinder('cap underside',{height:.035*size,diameter:radius*1.9,tessellation:7},scene);underside.position.set(x,stemHeight-.012*size,z);parts.push(paint(underside,'#aa967b'));
   if(variant===0)for(let spot=0;spot<3;spot++){
    const angle=spot*2.4+.3,reach=radius*(spot===0?.2:.52),mark=MeshBuilder.CreateDisc('cream cap fleck',{radius:.035*size,tessellation:5,sideOrientation:Mesh.DOUBLESIDE},scene);
    mark.rotation.x=Math.PI/2;mark.position.set(x+Math.cos(angle)*reach,stemHeight+capHeight*(spot===0?.98:.78)+.004,z+Math.sin(angle)*reach*.9);parts.push(paint(mark,'#e1d5b6'));
   }
  }
 }else if(kind==='stump'){
  const height=.35+variant*.12,stump=MeshBuilder.CreateCylinder('flared weathered stump',{height,diameterTop:.48,diameterBottom:.76,tessellation:7},scene);
  stump.position.y=height/2;parts.push(paint(stump,tint(tuning.wood,'#403b33',variant*.1),1.18));
  for(let ring=0;ring<3;ring++){
   const cut=MeshBuilder.CreateCylinder('cut wood rings',{height:.012,diameter:.47-ring*.13,tessellation:7},scene);cut.position.set(.015,height+ring*.006,0);parts.push(paint(cut,tint(tuning.wood,ring%2?'#493e32':'#d0af7d',ring%2?.25:.55)));
  }
  for(let root=0;root<3;root++){
   const angle=root*2.1+variant,mesh=createStoneMesh(scene,'stump root',root+151,.22,.18,.42,tuning.wood);mesh.position.set(Math.sin(angle)*.25,0,Math.cos(angle)*.25);mesh.rotation.y=angle;parts.push(mesh);
  }
 }else{
  for(let stone=0;stone<variant+1;stone++){
   const size=stone===0?1:.42+stone*.08;
   const chip=createStoneMesh(scene,'weathered pebble',0x13ac+variant*17+stone,.55*size,(variant===1?.18:.32)*size,(variant===2?.68:.45)*size,tint(tuning.chip,stone%2?'#a99c89':'#655e66',.15+variant*.1));
   chip.position.set(stone===0?-.12:.22,0,stone===2?.22:stone===1?-.14:0);chip.rotation.y=stone*1.3;parts.push(chip);
  }
 }
 // Custom facets and Babylon primitives must expose the same attributes.
 // These templates use vertex colors only, so texture coordinates are unused.
 for(const part of parts)part.removeVerticesData(VertexBuffer.UVKind);
 const mesh=Mesh.MergeMeshes(parts,true,false,undefined,false,false)!;
 if(kind==='mushroom')mesh.bakeTransformIntoVertices(Matrix.Scaling(1.2,1.35,1.2));
 return mesh;
}
