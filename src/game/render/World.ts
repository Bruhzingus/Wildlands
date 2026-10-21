import {Scene,StandardMaterial,Color3,Color4,Mesh,MeshBuilder,Vector3,VertexBuffer,VertexData,TransformNode,DirectionalLight,HemisphericLight,AbstractMesh} from '@babylonjs/core';
import {DESIGN} from '../../data/config.ts';
import {worldProfile,siteAvailable,type WorldProfile,type MapId} from '../../data/maps.ts';
import {CHEST_TIERS,SHRINE,chestRarity} from '../../data/economy.ts';
import type {LootRarity,POI,TerrainFeature} from '../types.ts';
import {biomeAt,createEnvironment,explorationRoute,terrainHeight} from '../systems/environment.ts';
export class World{
 setQuality(quality:'low'|'balanced'|'high'){
  // These decorations have no collider. Solid props and navigation stay visible.
  for(const mesh of this.spawned)if(mesh.name.startsWith('flower-')||mesh.name.startsWith('bush-'))mesh.setEnabled(quality!=='low');
 }
 private spawned:AbstractMesh[]=[];private landmarks=new Map<number,{marker:TransformNode;mesh:AbstractMesh;body:AbstractMesh}>();
 private terrainFeatures=new Map<number,{root:TransformNode;ring:AbstractMesh;body:AbstractMesh}>();
 private chestMaterials:Partial<Record<LootRarity,StandardMaterial>>={};
 private reusable:Mesh[]=[];private materials:StandardMaterial[]=[];private lights:(HemisphericLight|DirectionalLight)[]=[];private scene:Scene;
 readonly profile:WorldProfile;
 constructor(scene:Scene,seed:number,pois:POI[],mapId:MapId='wildlands'){this.scene=scene;this.profile=worldProfile(seed,mapId);this.buildTerrain(pois);this.buildEnvironment(seed,pois);this.buildLandmarks(pois);this.buildTerrainFeatures(createEnvironment(seed,pois,mapId).features);this.update(0,pois);}
 height(x:number,z:number){return terrainHeight(x,z,this.profile);}
 mat(name:string,hex:string,alpha=1){const m=new StandardMaterial(name,this.scene);m.diffuseColor=Color3.FromHexString(hex);m.emissiveColor=m.diffuseColor.scale(.13);m.specularColor=new Color3(.06,.07,.06);m.alpha=alpha;this.materials.push(m);return m;}
 private buildTerrain(pois:POI[]){
  const size=DESIGN.mapRadius*2,definition=this.profile.definition,pond=this.profile.lake;
  const ground=MeshBuilder.CreateGround('rolling forest terrain',{width:size,height:size,subdivisions:116},this.scene);
  const positions=ground.getVerticesData(VertexBuffer.PositionKind)!;const indices=ground.getIndices()!;
  const colors:number[]=[],palette=Object.fromEntries(Object.entries(definition.palette).map(([id,biome])=>[id,Color3.FromHexString(biome.color)]));
  const routes=pois.map(poi=>explorationRoute(poi,this.profile)),stone=Color3.FromHexString(definition.scenery.rock);
  for(let i=0;i<positions.length;i+=3){const x=positions[i],z=positions[i+2];positions[i+1]=this.height(x,z);
   const n=(Math.sin(x*.18)*Math.cos(z*.21)+1)/2;
   // Blend the shared regions across a narrow ecotone; height bands expose the
   // ridge shape without adding decals, geometry or additional draw calls.
   const biome=palette[biomeAt(x,z,this.profile)].scale(.4);
   for(const [dx,dz] of [[-4,0],[4,0],[0,-4],[0,4]])biome.addInPlace(palette[biomeAt(x+dx,z+dz,this.profile)].scale(.15));
   const exposed=Math.max(0,Math.min(.18,(positions[i+1]-5)*.018));
   Color3.LerpToRef(biome,stone,exposed,biome);
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
  const lake=MeshBuilder.CreateDisc('Stillwater lake',{radius:pond.waterRadius,tessellation:44},this.scene);lake.rotation.x=Math.PI/2;lake.position.set(pond.x,pond.waterHeight,pond.z);
  const water=this.mat('lake',definition.waterColor,.91);lake.material=water;water.disableLighting=true;water.emissiveColor=Color3.FromHexString(definition.waterColor);
  const rim=MeshBuilder.CreateTorus('pond shore',{diameter:pond.waterRadius*2+1.2,thickness:1.1,tessellation:48},this.scene);rim.position=lake.position.clone();rim.position.y-=.22;
  const shore=this.mat('shore',definition.shoreColor);rim.material=shore;shore.disableLighting=true;shore.emissiveColor=Color3.FromHexString(definition.shoreColor);
  this.spawned.push(ground,lake,rim);
  this.scene.clearColor=Color4.FromColor3(Color3.FromHexString(definition.skyColor));
  this.scene.fogMode=Scene.FOGMODE_EXP2;this.scene.fogDensity=.0064;this.scene.fogColor=Color3.FromHexString(definition.fogColor);
  const ambient=new HemisphericLight('ambient sky',new Vector3(0,1,0),this.scene);ambient.intensity=definition.lighting.sky;ambient.groundColor=new Color3(.28,.32,.24);
  const sun=new DirectionalLight('sun',new Vector3(-.5,-1,.4),this.scene);sun.intensity=definition.lighting.sun;sun.position.set(35,90,-60);
  this.lights.push(ambient,sun);
  // Lighting without live dynamic shadow maps is much cheaper for dense enemy scenes.
 }
 private buildEnvironment(seed:number,pois:POI[]){
  const palette=this.profile.definition.scenery;
  const bark=this.mat('bark',palette.bark), pine=this.mat('pine',palette.pine),pine2=this.mat('pine2',palette.bush),rock=this.mat('stone',palette.rock),flower=this.mat('wildflowers',palette.flower),ruins=this.mat('old masonry',palette.ruins);
  const trunk=MeshBuilder.CreateCylinder('tree trunk',{height:2.4,diameterTop:.42,diameterBottom:.73,tessellation:5},this.scene);trunk.material=bark;trunk.isVisible=false;
  const canopy=MeshBuilder.CreateCylinder('cone crown',{height:3.8,diameterTop:0,diameterBottom:3.4,tessellation:5},this.scene);canopy.material=pine;canopy.isVisible=false;
  const shrub=MeshBuilder.CreateIcoSphere('bush',{radius:1.1,subdivisions:0},this.scene);shrub.material=pine2;shrub.isVisible=false;
  const boulder=MeshBuilder.CreateIcoSphere('low-poly rock',{radius:1.25,subdivisions:1},this.scene);boulder.material=rock;boulder.isVisible=false;
  const smallRock=MeshBuilder.CreateBox('ruin block',{width:2.4,depth:1.8,height:2.2},this.scene);smallRock.material=ruins;smallRock.isVisible=false;
  const petal=MeshBuilder.CreateIcoSphere('flower',{radius:.26,subdivisions:0},this.scene);petal.material=flower;petal.isVisible=false;
  this.reusable.push(trunk,canopy,shrub,boulder,smallRock,petal);
  let id=0;
  for(const prop of createEnvironment(seed,pois,this.profile.definition.id).props){
   const {kind,x,z,scale}=prop,y=this.height(x,z);
   if(kind==='rock'){const height=palette.rockHeight*(prop.scaleY??1),m=boulder.createInstance(`${prop.landmark?'watchstone':'rock'}-${id++}`);m.position.set(x,y+height*.95*scale,z);m.scaling.set(scale,height*scale,scale);this.spawned.push(m);}
   else if(kind==='bush'){const m=shrub.createInstance(`bush-${id++}`);m.position.set(x,y+.5,z);m.scaling.scaleInPlace(scale*.7);this.spawned.push(m);}
   else if(kind==='tree'){const t=trunk.createInstance(`trunk-${id++}`),c=canopy.createInstance(`${prop.landmark?'great-pine':'crown'}-${id++}`);t.position.set(x,y+1.2*scale,z);t.scaling.scaleInPlace(scale);c.position.set(x,y+3.2*scale,z);c.scaling.scaleInPlace(scale);this.spawned.push(t,c);}
   else if(kind==='flower'){const f=petal.createInstance(`flower-${id++}`);f.position.set(x,y+.22,z);f.scaling.scaleInPlace(scale);this.spawned.push(f);}
   else {const b=smallRock.createInstance(`${prop.landmark?'gate-pillar':'ruin'}-${id++}`);b.position.set(x,y+1.1*prop.scaleY!,z);b.scaling.set(scale,prop.scaleY!,1);b.rotation.y=prop.rotation!;this.spawned.push(b);}
  }
  for(let side=0;side<4;side++)for(let i=0;i<25;i++){
   const along=-DESIGN.mapRadius+i*DESIGN.mapRadius*2/24,bound=DESIGN.mapRadius+3;
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
 private buildTerrainFeatures(features:TerrainFeature[]){
  const bramble=this.mat('bramble ground','#62713f',.72),beacon=this.mat('ruin beacon','#d49d50');
  // Reuse the landmark primitives; interaction markers must not turn seven
  // small objects into seven new geometries on every restart.
  const brambleSource=MeshBuilder.CreateDisc('bramble ground source',{radius:1,tessellation:14},this.scene);brambleSource.material=bramble;brambleSource.isVisible=false;this.reusable.push(brambleSource);
  const beaconSource=this.scene.getMeshByName('obelisk') as Mesh,ringSource=this.scene.getMeshByName('shrine marker source') as Mesh;
  for(const feature of features){const root=new TransformNode(`terrain-feature-${feature.uid}`,this.scene);root.position.set(feature.x,this.height(feature.x,feature.z)+.04,feature.z);
   const brambles=feature.kind==='bramble',body=brambles?brambleSource.createInstance(`bramble-${feature.uid}`):beaconSource.clone(`ruin-beacon-${feature.uid}`)!;
   body.rotation.x=brambles?Math.PI/2:0;body.position.y=brambles?.01:.9;body.scaling.set(brambles?feature.radius:.42,brambles?feature.radius:.7,brambles?1:.42);if(!brambles)body.material=beacon;body.parent=root;
   // Clones retain shared geometry but permit the beacon's distinctive material.
   const ring=brambles?ringSource.createInstance(`feature-ring-${feature.uid}`):ringSource.clone(`feature-ring-${feature.uid}`)!;if(!brambles)ring.material=beacon;ring.parent=root;ring.position.y=.05;ring.scaling.set(feature.radius/2,1,feature.radius/2);ring.isVisible=!brambles;
   this.terrainFeatures.set(feature.uid,{root,ring,body});this.spawned.push(body,ring);
  }
 }
 update(_dt:number,pois:POI[],elapsed=0,features:TerrainFeature[]=[]){
  for(const poi of pois){const entry=this.landmarks.get(poi.uid);if(!entry)continue;
   entry.marker.setEnabled(siteAvailable(poi,elapsed)&&(!poi.used||poi.respawnAt!==undefined||!!poi.challenge));
   entry.body.scaling.y=poi.used?.35:poi.price!==undefined?.8:1;
   entry.mesh.scaling.set(poi.challenge?SHRINE.radius/2:1,1,poi.challenge?SHRINE.radius/2:1);
   if(poi.price!==undefined)entry.body.material=entry.mesh.material=this.chestMaterials[chestRarity({stats:{elapsed}},poi)]!;
  }
  for(const feature of features){const view=this.terrainFeatures.get(feature.uid);if(!view)continue;view.root.setEnabled(feature.state!=='spent');if(feature.kind==='ruin-beacon')view.ring.scaling.set(feature.state==='arming'?1.18:1,1,feature.state==='arming'?1.18:1);}
 }
 dispose(){for(const mesh of this.spawned)mesh.dispose();for(const root of this.landmarks.values())root.marker.dispose();for(const root of this.terrainFeatures.values())root.root.dispose();for(const root of this.reusable)root.dispose();for(const material of this.materials)material.dispose();for(const light of this.lights)light.dispose();this.landmarks.clear();this.terrainFeatures.clear();this.spawned=[];this.reusable=[];this.materials=[];this.lights=[];}
}
