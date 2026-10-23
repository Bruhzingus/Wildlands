import {Color3,Matrix,Mesh,MeshBuilder,Quaternion,Scene,StandardMaterial,Vector3,VertexBuffer,VertexData} from '@babylonjs/core';
import type {MapDefinition} from '../../data/maps.ts';
import type {SurfaceDetail,SurfaceDetailKind} from '../systems/surfaceDetails.ts';
import {terrainOrientation} from './terrainOrientation.ts';

/** A handful of opaque, vertex-colored primitives per template; one material
 * and one thin-instance batch per active class, no shadows or frame updates. */
export function buildGroundDetails(scene:Scene,details:readonly SurfaceDetail[],tuning:MapDefinition['surfaceDetails'],material:(name:string,color:string)=>StandardMaterial,ground?:(x:number,z:number)=>number):Mesh[]{
 const result:Mesh[]=[];
 const paint=(mesh:Mesh,hex:string,topScale=1)=>{
  const color=Color3.FromHexString(hex),colors:number[]=[],normals=topScale===1?null:mesh.getVerticesData(VertexBuffer.NormalKind);
  for(let index=0;index<mesh.getTotalVertices();index++){
   const shade=normals&&normals[index*3+1]>.5?topScale:1;
   colors.push(Math.min(1,color.r*shade),Math.min(1,color.g*shade),Math.min(1,color.b*shade),1);
  }
  mesh.setVerticesData(VertexBuffer.ColorKind,colors);return mesh;
 };
 for(const kind of ['tuft','flower','mushroom','stump','chip'] as SurfaceDetailKind[]){
  const placements=details.filter(detail=>detail.kind===kind);if(!placements.length)continue;
  const parts:Mesh[]=[];
  if(kind==='tuft'){
   const mesh=new Mesh('three blade tuft',scene),data=new VertexData();
   data.positions=[-.32,0,0,.08,0,0,-.17,.55,.05, -.12,0,-.17,.13,0,.15,.03,.8,.01, .03,0,0,.34,0,0,.3,.48,-.12];
   data.indices=[0,1,2,3,4,5,6,7,8];data.normals=[];VertexData.ComputeNormals(data.positions,data.indices,data.normals);data.applyToMesh(mesh);
   parts.push(paint(mesh,tuning.grass));
  }else if(kind==='flower'){
   // Two modest four-petal flowers, without bright orb-like centers.
   for(const [index,x] of [-.22,.22].entries()){
    const height=.3+index*.12,stem=MeshBuilder.CreateCylinder('short flower stem',{height,diameter:.045,tessellation:4},scene);stem.position.set(x,height/2,index*.12);parts.push(paint(stem,tuning.grass));
    for(let petal=0;petal<4;petal++){
     const angle=petal*Math.PI/2,mesh=MeshBuilder.CreateDisc('flat petal',{radius:.105,tessellation:6},scene);
     mesh.rotation.x=Math.PI/2;mesh.position.set(x+Math.sin(angle)*.12,height,index*.12+Math.cos(angle)*.12);parts.push(paint(mesh,tuning.petals));
    }
   }
  }else if(kind==='mushroom'){
   const stem=MeshBuilder.CreateCylinder('mushroom stem',{height:.27,diameter:.13,tessellation:5},scene);stem.position.y=.135;parts.push(paint(stem,'#afa18b'));
   const cap=MeshBuilder.CreateCylinder('seven sided cap',{height:.22,diameterTop:.22,diameterBottom:.58,tessellation:7},scene);cap.position.y=.32;parts.push(paint(cap,tuning.cap));
  }else if(kind==='stump'){
   const stump=MeshBuilder.CreateCylinder('six sided stump',{height:.46,diameterTop:.56,diameterBottom:.7,tessellation:6},scene);stump.position.y=.23;parts.push(paint(stump,tuning.wood,1.35));
  }else{
   const chip=MeshBuilder.CreateIcoSphere('charcoal shard',{radius:1,subdivisions:1},scene);chip.position.y=.12;chip.scaling.set(.28,.23,.4);parts.push(paint(chip,tuning.chip));
  }
  const mesh=Mesh.MergeMeshes(parts,true,false,undefined,false,false)!;
  const detailMaterial=material(`ground detail ${kind}`,'#ffffff');detailMaterial.backFaceCulling=false;detailMaterial.twoSidedLighting=true;
  mesh.name=`ground-detail-${kind}`;mesh.material=detailMaterial;mesh.useVertexColors=true;
  mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;mesh.metadata={surfaceDetail:kind,count:placements.length};
  const matrices=new Float32Array(placements.length*16);
  for(const [index,detail] of placements.entries()){
   const rotation=ground?terrainOrientation(detail.x,detail.z,detail.rotation,ground):Quaternion.RotationAxis(Vector3.Up(),detail.rotation);
   Matrix.Compose(new Vector3(detail.scale,detail.scale,detail.scale),rotation,new Vector3(detail.x,detail.y,detail.z)).copyToArray(matrices,index*16);
  }
  mesh.thinInstanceSetBuffer('matrix',matrices,16,true);mesh.thinInstanceEnablePicking=false;mesh.thinInstanceRefreshBoundingInfo();mesh.freezeWorldMatrix();result.push(mesh);
 }
 return result;
}
