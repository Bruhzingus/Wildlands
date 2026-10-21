import {Mesh,MeshBuilder,Scene,Vector3,VertexBuffer,VertexData} from '@babylonjs/core';

/** Small, shared silhouettes. No textures, per-frame geometry or random allocations. */
export type CraftedShape='star'|'foam'|'flame'|'bubble'|'crystal'|'gust'|'streak'|'tendril'|'lightning'|'coin';

export function combatGeometry(shape:string,name:string,scene:Scene):Mesh|undefined {
 const ribbon=(paths:Vector3[][])=>MeshBuilder.CreateRibbon(name,{pathArray:paths,sideOrientation:Mesh.DOUBLESIDE},scene);
 if(shape==='wave'||shape==='foam'){
  // Cross-section rises from the wake, curls forward, then folds under the lip.
  const section=[[-.95,0],[-.65,.15],[-.4,.48],[-.2,.85],[.08,1.16],[.38,1.22],[.58,1.05],[.57,.82],[.43,.72]];
  const rows=shape==='foam'?section.slice(3,8):section;
  const mesh=ribbon(rows.map(([z,y],row)=>Array.from({length:33},(_,i)=>{
   const x=i/16-1,edge=Math.sqrt(Math.max(0,1-x*x)),ripple=Math.sin(x*14+row*.45)*.035;
   const froth=shape==='foam';
   return new Vector3(x,(y+ripple+(froth?.055:0))*(.42+.58*edge),z+Math.sin(x*5)*.08+(1-edge)*.3-(froth?.045+Math.sin(x*23)*.025:0));
  })));
  if(shape==='wave'){
   const positions=mesh.getVerticesData(VertexBuffer.PositionKind)!,colors:number[]=[];
   for(let i=0;i<positions.length;i+=3){const t=Math.min(1,positions[i+1]/1.2);colors.push(.42+t*.46,.62+t*.36,.85+t*.15,1);}
   mesh.setVerticesData(VertexBuffer.ColorKind,colors);
  }
  return mesh;
 }
 if(shape==='star'){
  const positions=[0,0,.12],indices:number[]=[],colors=[1,1,.85,1];
  for(let i=0;i<10;i++){
   const angle=Math.PI/2+i*Math.PI/5,r=i%2?.43:1;
   positions.push(Math.cos(angle)*r,Math.sin(angle)*r,0);colors.push(1,i%2?.72:.95,i%2?.4:.7,1);
  }
  for(let i=0;i<10;i++)indices.push(0,i+1,(i+1)%10+1);
  const mesh=new Mesh(name,scene),data=new VertexData();data.positions=positions;data.indices=indices;data.colors=colors;
  const normals:number[]=[];VertexData.ComputeNormals(positions,indices,normals);data.normals=normals;data.applyToMesh(mesh);return mesh;
 }
 if(shape==='gust')return ribbon([-1,1].map(side=>Array.from({length:65},(_,i)=>{
  const t=i/64,a=t*Math.PI*5,r=.25+t*.75,width=.025+Math.sin(t*Math.PI)*.07;
  return new Vector3(Math.cos(a)*(r+side*width),t*1.6+side*width,Math.sin(a)*(r+side*width));
 })));
 if(shape==='streak'||shape==='tendril'||shape==='lightning')return ribbon([-1,1].map(side=>Array.from({length:25},(_,i)=>{
  const t=i/24,width=shape==='streak'?Math.sin(t*Math.PI)*.23:shape==='lightning'?.28:.5*(1-t*.75);
  const bend=shape==='lightning'?(i===0||i===24?0:Math.sin(i*2.4)*1.3):Math.sin(t*Math.PI*2)*(shape==='tendril'?1.8:.18);
  return new Vector3(bend+side*width,shape==='streak'?Math.sin(t*Math.PI)*.06:0,shape==='streak'?t-1:t-.5);
 })));
 if(shape==='leaf')return ribbon([-1,0,1].map(side=>Array.from({length:13},(_,i)=>{
  const t=i/12;return new Vector3(side*Math.sin(t*Math.PI)*.55,(1-Math.abs(side))*.18+Math.sin(t*Math.PI)*.15,(t-.5)*2);
 })));
 if(shape==='spark'||shape==='crystal'){
  const mesh=MeshBuilder.CreatePolyhedron(name,{type:1,size:1},scene);mesh.scaling.set(.45,.45,1.3);mesh.bakeCurrentTransformIntoVertices();mesh.scaling.setAll(1);return mesh;
 }
 if(shape==='flame'){
  const mesh=MeshBuilder.CreateSphere(name,{diameter:2,segments:8},scene),positions=mesh.getVerticesData(VertexBuffer.PositionKind)!,colors:number[]=[];
  for(let i=0;i<positions.length;i+=3){
   const y=positions[i+1],t=(y+1)/2;positions[i]*=.8*(1-t*.65);positions[i+2]*=.7*(1-t*.65);
   positions[i]+=.25*t*t;positions[i+1]=y*1.4;colors.push(1,.65+t*.35,.3+t*.65,1);
  }
  mesh.setVerticesData(VertexBuffer.PositionKind,positions);mesh.setVerticesData(VertexBuffer.ColorKind,colors);return mesh;
 }
 if(shape==='bubble'){
  const mesh=MeshBuilder.CreateSphere(name,{diameter:2,segments:12},scene),positions=mesh.getVerticesData(VertexBuffer.PositionKind)!,colors:number[]=[];
  for(let i=0;i<positions.length;i+=3){const t=(positions[i+1]+1)/2;colors.push(.5+t*.5,.75+t*.25,1,1);}
  mesh.setVerticesData(VertexBuffer.ColorKind,colors);return mesh;
 }
 if(shape==='coin')return MeshBuilder.CreateCylinder(name,{diameter:2,height:.2,tessellation:16},scene);
 if(shape==='beam'||shape==='needle'){
  const mesh=MeshBuilder.CreateCylinder(name,{height:1,diameterTop:shape==='needle'?0:.35,diameterBottom:1,tessellation:8},scene);
  mesh.rotation.x=Math.PI/2;mesh.bakeCurrentTransformIntoVertices();mesh.rotation.setAll(0);return mesh;
 }
 return;
}
