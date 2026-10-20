import {Scene,StandardMaterial,Color3,Color4,Mesh,MeshBuilder,Vector3,VertexBuffer,VertexData,TransformNode,DirectionalLight,HemisphericLight,AbstractMesh} from '@babylonjs/core';
import {DESIGN} from '../../data/config.ts';
import {BIOMES,WORLD} from '../../data/world.ts';
import {CHEST_TIERS,SHRINE,chestRarity} from '../../data/economy.ts';
import type {LootRarity,POI} from '../types.ts';
import {biomeAt,createEnvironment,explorationRoute,terrainHeight} from '../systems/environment.ts';
export class World{
 setQuality(quality:'low'|'balanced'|'high'){
  // These decorations have no collider. Solid props and navigation stay visible.
  for(const mesh of this.spawned)if(mesh.name.startsWith('flower-')||mesh.name.startsWith('bush-'))mesh.setEnabled(quality!=='low');
 }
 private spawned:AbstractMesh[]=[];private landmarks=new Map<number,{marker:TransformNode;mesh:AbstractMesh;body:AbstractMesh}>();
 private chestMaterials:Partial<Record<LootRarity,StandardMaterial>>={};
 private reusable:Mesh[]=[];private materials:StandardMaterial[]=[];private lights:(HemisphericLight|DirectionalLight)[]=[];private scene:Scene;
 constructor(scene:Scene,seed:number,pois:POI[]){this.scene=scene;this.buildTerrain(pois);this.buildEnvironment(seed,pois);this.buildLandmarks(pois);}
 height(x:number,z:number){return terrainHeight(x,z);}
 mat(name:string,hex:string,alpha=1){const m=new StandardMaterial(name,this.scene);m.diffuseColor=Color3.FromHexString(hex);m.emissiveColor=m.diffuseColor.scale(.13);m.specularColor=new Color3(.06,.07,.06);m.alpha=alpha;this.materials.push(m);return m;}
 private buildTerrain(pois:POI[]){
  const size=DESIGN.mapRadius*2;
  const ground=MeshBuilder.CreateGround('rolling forest terrain',{width:size,height:size,subdivisions:92},this.scene);
  const positions=ground.getVerticesData(VertexBuffer.PositionKind)!;const indices=ground.getIndices()!;
  const colors:number[]=[],palette=Object.fromEntries(Object.entries(BIOMES).map(([id,biome])=>[id,Color3.FromHexString(biome.color)]));
  const routes=pois.map(explorationRoute);
  for(let i=0;i<positions.length;i+=3){const x=positions[i],z=positions[i+2];positions[i+1]=this.height(x,z);
   const n=(Math.sin(x*.18)*Math.cos(z*.21)+1)/2;
   const biome=palette[biomeAt(x,z)];
   const path=routes.some(route=>route.slice(1).some((end,index)=>{
    const start=route[index],dx=end.x-start.x,dz=end.z-start.z,t=Math.max(0,Math.min(1,((x-start.x)*dx+(z-start.z)*dz)/(dx*dx+dz*dz||1)));
    return Math.hypot(x-start.x-t*dx,z-start.z-t*dz)<1.25;
   }));
   const blend=path?.28:0;
   colors.push(biome.r*(1-blend)+.57*blend+n*.04,biome.g*(1-blend)+.54*blend+n*.05,biome.b*(1-blend)+.38*blend+n*.03,1);
  }
  const normals=new Array(positions.length).fill(0);
  VertexData.ComputeNormals(positions,indices,normals);
  ground.setVerticesData(VertexBuffer.PositionKind,positions,true);ground.setVerticesData(VertexBuffer.NormalKind,normals,true);
  ground.setVerticesData(VertexBuffer.ColorKind,colors);
  const grass=this.mat('grass terrain','#ffffff');ground.useVertexColors=true;ground.material=grass;
  const lake=MeshBuilder.CreateDisc('Stillwater lake',{radius:WORLD.lake.waterRadius,tessellation:44},this.scene);lake.rotation.x=Math.PI/2;lake.position.set(WORLD.lake.x,WORLD.lake.waterHeight,WORLD.lake.z);
  const water=this.mat('lake','#638f98',.91);lake.material=water;water.disableLighting=true;water.emissiveColor=Color3.FromHexString('#638f98');
  const rim=MeshBuilder.CreateTorus('pond shore',{diameter:WORLD.lake.waterRadius*2+1.2,thickness:1.1,tessellation:48},this.scene);rim.position=lake.position.clone();rim.position.y-=.22;
  const shore=this.mat('shore','#a4a17b');rim.material=shore;shore.disableLighting=true;shore.emissiveColor=Color3.FromHexString('#a4a17b');
  this.spawned.push(ground,lake,rim);
  this.scene.clearColor=new Color4(.63,.77,.82,1);
  this.scene.fogMode=Scene.FOGMODE_EXP2;this.scene.fogDensity=.0064;this.scene.fogColor=Color3.FromHexString('#a2bbbd');
  const ambient=new HemisphericLight('ambient sky',new Vector3(0,1,0),this.scene);ambient.intensity=1.55;ambient.groundColor=new Color3(.28,.32,.24);
  const sun=new DirectionalLight('sun',new Vector3(-.5,-1,.4),this.scene);sun.intensity=1.05;sun.position.set(35,90,-60);
  this.lights.push(ambient,sun);
  // Lighting without live dynamic shadow maps is much cheaper for dense enemy scenes.
 }
 private buildEnvironment(seed:number,pois:POI[]){
  const bark=this.mat('bark','#78604b'), pine=this.mat('pine','#375d47'),pine2=this.mat('pine2','#648561'),rock=this.mat('stone','#8a978e'),flower=this.mat('wildflowers','#debd74'),ruins=this.mat('old masonry','#a4a18b');
  const trunk=MeshBuilder.CreateCylinder('tree trunk',{height:2.4,diameterTop:.42,diameterBottom:.73,tessellation:5},this.scene);trunk.material=bark;trunk.isVisible=false;
  const canopy=MeshBuilder.CreateCylinder('cone crown',{height:3.8,diameterTop:0,diameterBottom:3.4,tessellation:5},this.scene);canopy.material=pine;canopy.isVisible=false;
  const shrub=MeshBuilder.CreateIcoSphere('bush',{radius:1.1,subdivisions:0},this.scene);shrub.material=pine2;shrub.isVisible=false;
  const boulder=MeshBuilder.CreateIcoSphere('low-poly rock',{radius:1.25,subdivisions:1},this.scene);boulder.material=rock;boulder.isVisible=false;
  const smallRock=MeshBuilder.CreateBox('ruin block',{width:2.4,depth:1.8,height:2.2},this.scene);smallRock.material=ruins;smallRock.isVisible=false;
  const petal=MeshBuilder.CreateIcoSphere('flower',{radius:.26,subdivisions:0},this.scene);petal.material=flower;petal.isVisible=false;
  this.reusable.push(trunk,canopy,shrub,boulder,smallRock,petal);
  let id=0;
  for(const prop of createEnvironment(seed,pois).props){
   const {kind,x,z,scale}=prop,y=this.height(x,z);
   if(kind==='rock'){const m=boulder.createInstance(`${prop.landmark?'watchstone':'rock'}-${id++}`);m.position.set(x,y+.52*scale,z);m.scaling.set(scale,.55*scale,scale);this.spawned.push(m);}
   else if(kind==='bush'){const m=shrub.createInstance(`bush-${id++}`);m.position.set(x,y+.5,z);m.scaling.scaleInPlace(scale*.7);this.spawned.push(m);}
   else if(kind==='tree'){const t=trunk.createInstance(`trunk-${id++}`),c=canopy.createInstance(`${prop.landmark?'great-pine':'crown'}-${id++}`);t.position.set(x,y+1.2*scale,z);t.scaling.scaleInPlace(scale);c.position.set(x,y+3.2*scale,z);c.scaling.scaleInPlace(scale);this.spawned.push(t,c);}
   else if(kind==='flower'){const f=petal.createInstance(`flower-${id++}`);f.position.set(x,y+.22,z);f.scaling.scaleInPlace(scale);this.spawned.push(f);}
   else {const b=smallRock.createInstance(`${prop.landmark?'gate-pillar':'ruin'}-${id++}`);b.position.set(x,y+1.1*prop.scaleY!,z);b.scaling.set(scale,prop.scaleY!,1);b.rotation.y=prop.rotation!;this.spawned.push(b);}
  }
  for(let side=0;side<4;side++)for(let i=0;i<25;i++){
   const along=-115+i*230/24,bound=DESIGN.mapRadius+3;
   const x=side<2?along:(side===2?-bound:bound),z=side<2?(side===0?-bound:bound):along;
   const m=canopy.createInstance(`boundary-${side}-${i}`);m.position.set(x,this.height(x,z)+3.5,z);m.scaling.set(2.4,2.4,2.4);this.spawned.push(m);
  }
 }
 private buildLandmarks(pois:POI[]){
  for(const rarity of ['common','rare','epic'] as const)this.chestMaterials[rarity]=this.mat(`${rarity} treasure`,CHEST_TIERS[rarity].color);
  const mats={cache:this.mat('cache','#d8bb72'),shrine:this.mat('shrine','#aaa2c4'),elite:this.mat('elite','#ba8574'),healing:this.mat('healing','#88b39a')};
  const bases={cache:MeshBuilder.CreateBox('chest',{size:1.7},this.scene),shrine:MeshBuilder.CreateCylinder('obelisk',{height:2.8,diameterTop:.36,diameterBottom:1.7,tessellation:5},this.scene),elite:MeshBuilder.CreateIcoSphere('elite stone',{radius:1.15,subdivisions:1},this.scene),healing:MeshBuilder.CreateCylinder('healing spring',{height:.7,diameter:3,tessellation:8},this.scene)};
  const ringBases={} as Record<POI['kind'],Mesh>;
  for(const [key,mesh] of Object.entries(bases)){
   const kind=key as POI['kind'];mesh.material=mats[kind];mesh.isVisible=false;this.reusable.push(mesh);
   const ring=MeshBuilder.CreateTorus(`${kind} marker source`,{diameter:4,thickness:.13,tessellation:16},this.scene);
   ring.material=mats[kind];ring.isVisible=false;ringBases[kind]=ring;this.reusable.push(ring);
  }
  for(const poi of pois){const mesh=bases[poi.kind].clone(`POI ${poi.kind} ${poi.uid}`)!;mesh.isVisible=true;
   const root=new TransformNode(`landmark-${poi.uid}`,this.scene);mesh.parent=root;root.position.set(poi.x,this.height(poi.x,poi.z),poi.z);
   mesh.position.y={cache:.85,shrine:1.4,elite:1.15,healing:.35}[poi.kind];
   if(poi.price!==undefined)mesh.scaling.set(1.2,.8,1.2);
   const ring=ringBases[poi.kind].clone(`marker-ring-${poi.uid}`)!;ring.isVisible=true;ring.parent=root;ring.position.y=.08;
   if(poi.price!==undefined)mesh.material=ring.material=this.chestMaterials[poi.rarity??'common']!;
   this.landmarks.set(poi.uid,{marker:root,mesh:ring,body:mesh});this.spawned.push(mesh,ring);
  }
 }
 update(_dt:number,pois:POI[],elapsed=0){
  for(const poi of pois){const entry=this.landmarks.get(poi.uid);if(!entry)continue;
   entry.marker.setEnabled(!poi.used||poi.respawnAt!==undefined||!!poi.challenge);
   entry.body.scaling.y=poi.used?.35:poi.price!==undefined?.8:1;
   entry.mesh.scaling.set(poi.challenge?SHRINE.radius/2:1,1,poi.challenge?SHRINE.radius/2:1);
   if(poi.price!==undefined)entry.body.material=entry.mesh.material=this.chestMaterials[chestRarity({stats:{elapsed}},poi)]!;
  }
 }
 dispose(){for(const mesh of this.spawned)mesh.dispose();for(const root of this.landmarks.values())root.marker.dispose();for(const root of this.reusable)root.dispose();for(const material of this.materials)material.dispose();for(const light of this.lights)light.dispose();this.landmarks.clear();this.spawned=[];this.reusable=[];this.materials=[];this.lights=[];}
}
