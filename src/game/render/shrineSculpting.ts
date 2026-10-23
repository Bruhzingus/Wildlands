import {Curve3,Mesh,MeshBuilder,Quaternion,Scene,StandardMaterial,Vector3,VertexData} from '@babylonjs/core';

type Point=readonly [number,number,number];
type Outline=readonly (readonly [number,number])[];

/** Small, solid stone forms. Every temporary piece is merged into the species
 * source once; the world then shares that source geometry between shrines. */
export class ShrineSculptor {
 readonly parts:Mesh[]=[];
 private scene:Scene;
 private stone:StandardMaterial;
 private carving:StandardMaterial;
 constructor(scene:Scene,stone:StandardMaterial,carving:StandardMaterial){this.scene=scene;this.stone=stone;this.carving=carving;}
 private add(mesh:Mesh,carved:boolean){mesh.material=carved?this.carving:this.stone;mesh.isPickable=false;this.parts.push(mesh);return mesh;}
 mass(x:number,y:number,z:number,sx:number,sy:number,sz:number,carved=false){
  const mesh=MeshBuilder.CreateIcoSphere('sculpted stone',{radius:1,subdivisions:2,flat:true},this.scene);
  mesh.position.set(x,y,z);mesh.scaling.set(sx,sy,sz);return this.add(mesh,carved);
 }
 limb(a:Point,b:Point,width:number,tip=width,carved=false){
  const start=Vector3.FromArray([...a]),end=Vector3.FromArray([...b]),delta=end.subtract(start);
  const mesh=MeshBuilder.CreateCylinder('chiseled stone',{height:delta.length(),diameterBottom:width*2,diameterTop:tip*2,tessellation:7},this.scene);
  mesh.position=start.add(end).scale(.5);mesh.rotationQuaternion=Quaternion.Identity();
  Quaternion.FromUnitVectorsToRef(Vector3.Up(),delta.normalize(),mesh.rotationQuaternion);
  mesh.convertToFlatShadedMesh();return this.add(mesh,carved);
 }
 curve(points:readonly Point[],width=.18,carved=false){
  return this.flow(points,points.map((_,i)=>Math.max(.02,width*(1-i/(points.length-.35)))),carved);
 }
 flow(points:readonly Point[],radii:readonly number[],carved=false){
  const path=Curve3.CreateCatmullRomSpline(points.map(p=>new Vector3(...p)),3).getPoints();
  const radiusFunction=(index:number)=>{
   const t=index/(path.length-1)*(radii.length-1),i=Math.min(radii.length-2,Math.floor(t));
   return radii[i]+(radii[i+1]-radii[i])*(t-i);
  };
  const mesh=MeshBuilder.CreateTube('flowing carved stone',{path,radiusFunction,tessellation:7,cap:Mesh.CAP_ALL},this.scene);
  mesh.convertToFlatShadedMesh();return this.add(mesh,carved);
 }
 /** Beveled, closed polygon slabs give ears, wings, tails and crests a designed
  * outline, broad lit faces and a real stone edge from the reverse camera. */
 plate(outline:Outline,z:number,depth=.14,carved=false){
  const positions:number[]=[],indices:number[]=[],normals:number[]=[];
  const center=outline.reduce((sum,p)=>[sum[0]+p[0]/outline.length,sum[1]+p[1]/outline.length],[0,0]);
  const front=outline.map(p=>[center[0]+(p[0]-center[0])*.88,center[1]+(p[1]-center[1])*.88,z+depth*.5]);
  const rim=outline.map(p=>[p[0],p[1],z]);
  const back=outline.map(p=>[center[0]+(p[0]-center[0])*.88,center[1]+(p[1]-center[1])*.88,z-depth*.5]);
  // Babylon's default left-handed normals require clockwise triangle indices.
  const face=(a:number[],b:number[],c:number[])=>{const i=positions.length/3;positions.push(...a,...b,...c);indices.push(i,i+2,i+1);};
  let area=0;for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];area+=a[0]*b[1]-b[0]*a[1];}
  const order=outline.map((_,i)=>i);if(area<0)order.reverse();
  const cross=(a:readonly number[],b:readonly number[],c:readonly number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const inside=(p:readonly number[],a:readonly number[],b:readonly number[],c:readonly number[])=>cross(a,b,p)>=-1e-8&&cross(b,c,p)>=-1e-8&&cross(c,a,p)>=-1e-8;
  const remaining=[...order];
  // Ear clipping preserves concave lightning bolts and scalloped membranes.
  while(remaining.length>2){
   let clipped=false;
   for(let i=0;i<remaining.length;i++){
    const a=remaining[(i+remaining.length-1)%remaining.length],b=remaining[i],c=remaining[(i+1)%remaining.length];
    if(cross(outline[a],outline[b],outline[c])<=1e-8)continue;
    if(remaining.some(j=>j!==a&&j!==b&&j!==c&&inside(outline[j],outline[a],outline[b],outline[c])))continue;
    face(front[a],front[b],front[c]);face(back[c],back[b],back[a]);remaining.splice(i,1);clipped=true;break;
   }
   if(!clipped)throw new Error('Invalid shrine sculpture outline');
  }
  for(let i=0;i<order.length;i++){
   const a=order[i],b=order[(i+1)%order.length];
   face(front[a],rim[a],rim[b]);face(front[a],rim[b],front[b]);
   face(rim[a],back[a],back[b]);face(rim[a],back[b],rim[b]);
  }
  VertexData.ComputeNormals(positions,indices,normals);
  const mesh=new Mesh('beveled stone relief',this.scene),data=new VertexData();
  data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=new Array(positions.length/3*2).fill(0);data.applyToMesh(mesh);return this.add(mesh,carved);
 }
 eye(x:number,y:number,z:number,width=.18,height=.11,tilt=0,yaw=0){
  const first=this.parts.length;
  const outline:Outline=[[-1,0],[-.58,.7],[.32,1],[1,.22],[.58,-.65],[-.4,-.65]].map(([px,py])=>[x+px*width,y+py*height+px*tilt]);
  this.plate(outline,z,.04,true);
  this.mass(x,y-.006,z+.028,width*.28,height*.63,.035);
  this.limb([x-width,y+height*.45-tilt,z+.035],[x+width*.9,y+height*.7+tilt,z+.035],.045,.06);
  for(const mesh of this.parts.slice(first))mesh.rotateAround(new Vector3(x,y,z),Vector3.Up(),yaw);
 }
 eyes(y:number,z:number,gap=.25,width=.17,height=.1,angry=false,x=0){
  for(const sign of [-1,1])this.eye(x+sign*gap,y,z,width,height,angry?sign*.045:sign*-.015,sign*.42);
 }
 nose(y:number,z:number,width=.13,x=0){
  this.plate([[x-width,y+.045],[x+width,y+.045],[x,y-width*.7]],z,.065,true);
 }
 mouth(points:readonly Point[],width=.025){for(let i=1;i<points.length;i++)this.limb(points[i-1],points[i],width,width,true);}
 paw(x:number,y:number,z:number,size=.27,claws=false){
  this.mass(x,y,z,size,size*.65,size*1.4);
  for(let i=-1;i<=1;i++){
   if(claws)this.limb([x+i*size*.58,y-.015,z+size*.87],[x+i*size*.67,y-.06,z+size*1.65],size*.14,0);
   else if(i!==1)this.mouth([[x+(i+.5)*size*.6,y+size*.12,z+size*1.15],[x+(i+.5)*size*.6,y+size*.4,z+size*.8]],.012);
  }
 }
 ear(x:number,y:number,z:number,tipX:number,tipY:number,width=.2){
  this.plate([[x-width,y],[x+width,y+.06],[tipX+.04,tipY],[tipX-.06,tipY+.015]],z,.19);
  this.plate([[x-width*.48,y+.16],[x+width*.42,y+.16],[tipX,tipY-.15]],z+.105,.035,true);
 }
 finish(speciesId:number){
  // Merge by material first: retaining every sculpting piece as a submesh would
  // turn a single detailed statue into dozens of draw calls.
  const groups=[...new Set([this.stone,this.carving])].map(material=>Mesh.MergeMeshes(this.parts.filter(part=>part.material===material),true,true)!);
  const mesh=Mesh.MergeMeshes(groups,true,true,undefined,false,true)!;
  mesh.name=`stone-statue-${speciesId}`;mesh.refreshBoundingInfo({});
  const bounds=mesh.getBoundingInfo().boundingBox,scale=3.8/(bounds.maximum.y-bounds.minimum.y);
  mesh.scaling.setAll(scale);mesh.position.y=.65-bounds.minimum.y*scale;mesh.isPickable=false;
  mesh.metadata={speciesId,stone:true,sculpture:'beveled-carved',vertices:mesh.getTotalVertices()};return mesh;
 }
}
