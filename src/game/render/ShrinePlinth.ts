import {Color3,Mesh,MeshBuilder,Scene,StandardMaterial,VertexBuffer} from '@babylonjs/core';

/** A single shared, vertex-tinted stone carving. Its origin matches the old
 * pedestal: bottom -.325, statue seat +.325, placed at y=.325 by World. */
export function createShrinePlinth(scene:Scene,stone:StandardMaterial){
 const parts:Mesh[]=[];
 const add=(mesh:Mesh,tint:string)=>{
  mesh.convertToFlatShadedMesh();const color=Color3.FromHexString(tint),colors:number[]=[];
  const positions=mesh.getVerticesData(VertexBuffer.PositionKind)!;
  for(let i=0;i<mesh.getTotalVertices();i++){
   const weather=1+Math.sin(positions[i*3]*9+positions[i*3+2]*13)*.025;
   colors.push(color.r*weather,color.g*weather,color.b*weather,1);
  }
  mesh.setVerticesData(VertexBuffer.ColorKind,colors);mesh.material=stone;parts.push(mesh);return mesh;
 };
 const tier=(name:string,y:number,height:number,top:number,bottom:number,tint:string)=>{
  const mesh=MeshBuilder.CreateCylinder(name,{height,diameterTop:top,diameterBottom:bottom,tessellation:8},scene);
  mesh.position.y=y;mesh.rotation.y=Math.PI/8;return add(mesh,tint);
 };
 tier('worn octagonal footing',-.245,.16,3.32,3.55,'#b8b9a8');
 tier('recessed pedestal waist',.02,.37,2.9,3.04,'#959e90');
 tier('beveled statue seat',.265,.12,3.13,3.32,'#d1d0bc');
 const plaque=(name:string,width:number,height:number,depth:number,angle:number,y:number,radius:number,tint:string)=>{
  const mesh=MeshBuilder.CreateBox(name,{width,height,depth},scene);
  mesh.position.set(Math.sin(angle)*radius,y,Math.cos(angle)*radius);mesh.rotation.y=angle;return add(mesh,tint);
 };
 for(let side=0;side<8;side++){
  const angle=side*Math.PI/4;
  plaque('incised pedestal border',.83,.028,.016,angle,.087,1.38,'#657365');
  plaque('incised pedestal border',.83,.022,.016,angle,-.105,1.42,'#707c6b');
  const diamond=plaque('carved diamond seal',.115,.115,.024,angle,-.012,1.425,'#c0c5ad');diamond.rotation.z=Math.PI/4;
  for(const sign of [-1,1]){
   const tick=plaque('small chisel mark',.035,.1,.018,angle,-.012,1.425,'#697564');
   tick.position.x+=Math.cos(angle)*sign*.255;tick.position.z-=Math.sin(angle)*sign*.255;
  }
  // Small lichen patches hug the lower stone instead of cluttering the clearing.
  if(side%3!==1){const moss=plaque('pedestal lichen',.18+side*.018,.045,.025,angle,-.23,1.62,'#819779');moss.rotation.z=.12;}
 }
 const mesh=Mesh.MergeMeshes(parts,true,true)!;mesh.name='shrine plinth';mesh.material=stone;
 mesh.useVertexColors=true;mesh.hasVertexAlpha=false;mesh.isPickable=false;mesh.checkCollisions=false;
 mesh.metadata={shrinePlinth:true};return mesh;
}
