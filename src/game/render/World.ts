import {Scene,StandardMaterial,Color3,Mesh,MeshBuilder,Vector3,VertexBuffer,VertexData,TransformNode,DirectionalLight,HemisphericLight,AbstractMesh} from '@babylonjs/core';
import {DESIGN} from '../../data/config.ts';
import {worldProfile,siteAvailable,type WorldProfile,type MapId} from '../../data/maps.ts';
import {TreasureChests} from './TreasureChests.ts';
import {SHRINE_TIERS,shrineForPOI,shrineHazardZones,type ShrineHazard} from '../../data/shrines.ts';
import {createShrineStatue} from './ShrineStatues.ts';
import type {BerryTree,POI,TerrainFeature} from '../types.ts';
import {BERRIES,BERRY_ORDER,type BerryId} from '../../data/berries.ts';
import {createEnvironment,terrainHeight,type EnvironmentLayout} from '../systems/environment.ts';
import {createSurfaceDetails} from '../systems/surfaceDetails.ts';
import {buildGroundDetails} from './groundDetails.ts';
import {createTerrainPalette} from './terrainPalette.ts';
import {treeVisual} from './vegetation.ts';
import {createLandmarkDressing,landmarkClearings,type Clearing} from '../systems/landmarkDressing.ts';
import {LandmarkDressing} from './LandmarkDressing.ts';
import {WorldAtmosphere} from './atmosphere.ts';
import {RNG} from '../../utils/random.ts';
const BERRY_TREE_PALETTES:Record<BerryId,{bark:string;lower:string;upper:string}>={
 oran:{bark:'#6f6250',lower:'#4d896f',upper:'#73aa8e'},
 leppa:{bark:'#825f46',lower:'#8d7948',upper:'#b4985d'},
 sitrus:{bark:'#7d6541',lower:'#708d45',upper:'#a6b85a'},
 pinap:{bark:'#765b3d',lower:'#608a43',upper:'#91b854'},
 'silver-pinap':{bark:'#676b6d',lower:'#668286',upper:'#a0bab6'},
};
export class World{
 private dressing:LandmarkDressing|undefined;private atmosphere:WorldAtmosphere|undefined;
 private terrain:Mesh|undefined;private plainColors:Float32Array|undefined;private dressedColors:Float32Array|undefined;
 private lastPois:readonly POI[]=[];private lastElapsed=0;
 setLandmarkDressingVisible(visible:boolean){
  this.dressing?.setVisible(visible);this.dressing?.update(this.lastPois,this.lastElapsed);
  const colors=visible?this.dressedColors:this.plainColors;if(colors)this.terrain?.updateVerticesData(VertexBuffer.ColorKind,colors);
 }
 setAtmospherePreview(seconds:number|null){this.atmosphere?.setPreview(seconds);}
 inspectAtmosphere(){return this.atmosphere?.inspect();}
 private groundDetails:Mesh[]=[];private detailsVisible=true;private quality:'low'|'balanced'|'high'='high';
 /** Read-only presentation toggle for reference captures; no generation changes. */
 setGroundDetailsVisible(visible:boolean){this.detailsVisible=visible;for(const mesh of this.groundDetails)mesh.setEnabled(visible&&this.quality!=='low');}
 setQuality(quality:'low'|'balanced'|'high'){
  this.quality=quality;this.setGroundDetailsVisible(this.detailsVisible);
  // These decorations have no collider. Solid props and navigation stay visible.
  for(const mesh of this.spawned)if(mesh.name.startsWith('bush-'))mesh.setEnabled(quality!=='low');
 }
 private spawned:AbstractMesh[]=[];private landmarks=new Map<number,{marker:TransformNode;body:AbstractMesh;statue?:Mesh;speciesId?:number;dust?:AbstractMesh[];hazards?:AbstractMesh[]}>();
 private shrineMaterials:StandardMaterial[]=[];private shrineStone!:StandardMaterial;private shrineCarving!:StandardMaterial;
 private statueSources=new Map<number,Mesh>();
 private hazardMaterials={} as Record<ShrineHazard,StandardMaterial>;
 private terrainFeatures=new Map<number,{root:TransformNode;ring:AbstractMesh;body:AbstractMesh}>();
 private berryViews=new Map<number,{trunk:AbstractMesh;lower:AbstractMesh;upper:AbstractMesh;crown:Mesh[];ground:{body:Mesh;leaf:Mesh}[]}>();
 private berryMaterials={} as Record<BerryId,StandardMaterial>;
 private berryTreeMaterials={} as Record<BerryId,{bark:StandardMaterial;lower:StandardMaterial;upper:StandardMaterial}>;
 private chests:TreasureChests|undefined;
 private reusable:Mesh[]=[];private materials:StandardMaterial[]=[];private lights:(HemisphericLight|DirectionalLight)[]=[];private scene:Scene;
 readonly profile:WorldProfile;
 constructor(scene:Scene,seed:number,pois:POI[],mapId:MapId='wildlands',berryTrees:BerryTree[]=[]){
  this.scene=scene;this.profile=worldProfile(seed,mapId);const layout=createEnvironment(seed,pois,mapId),sites=createLandmarkDressing(seed,this.profile,pois,berryTrees,layout);
  this.buildTerrain(seed,landmarkClearings(sites));this.buildEnvironment(seed,layout,berryTrees);
  this.groundDetails=buildGroundDetails(scene,createSurfaceDetails(seed,this.profile,pois,layout,berryTrees),this.profile.definition.surfaceDetails,(name,color)=>this.mat(name,color),(x,z)=>this.height(x,z));this.reusable.push(...this.groundDetails);
  this.buildBerryTrees(berryTrees);this.buildLandmarks(pois);
  this.dressing=new LandmarkDressing(scene,sites,this.mat('landmark dressing stone',this.profile.definition.dressing.stone),(x,z)=>this.height(x,z));
  this.buildTerrainFeatures(layout.features);this.update(0,pois,0,[],berryTrees);
 }
 height(x:number,z:number){return terrainHeight(x,z,this.profile);}
 mat(name:string,hex:string,alpha=1){const m=new StandardMaterial(name,this.scene);m.diffuseColor=Color3.FromHexString(hex);m.emissiveColor=m.diffuseColor.scale(.13);m.specularColor=new Color3(.06,.07,.06);m.alpha=alpha;this.materials.push(m);return m;}
 private buildTerrain(seed:number,clearings:readonly Clearing[]){
  const size=DESIGN.mapRadius*2,definition=this.profile.definition,pond=this.profile.lake;
  const ground=MeshBuilder.CreateGround('rolling forest terrain',{width:size,height:size,subdivisions:116},this.scene);
  const positions=ground.getVerticesData(VertexBuffer.PositionKind)!;const indices=ground.getIndices()!;
  const colors:number[]=[],plain:number[]=[],color=new Color3(),sampleColor=createTerrainPalette(this.profile,seed,clearings),samplePlain=createTerrainPalette(this.profile,seed);
  for(let i=0;i<positions.length;i+=3){const x=positions[i],z=positions[i+2];positions[i+1]=this.height(x,z);
   sampleColor(x,z,positions[i+1],color);colors.push(color.r,color.g,color.b,1);
   samplePlain(x,z,positions[i+1],color);plain.push(color.r,color.g,color.b,1);
  }
  const normals=new Array(positions.length).fill(0);
  VertexData.ComputeNormals(positions,indices,normals);
  ground.setVerticesData(VertexBuffer.PositionKind,positions,true);ground.setVerticesData(VertexBuffer.NormalKind,normals,true);
  this.terrain=ground;this.plainColors=new Float32Array(plain);this.dressedColors=new Float32Array(colors);ground.setVerticesData(VertexBuffer.ColorKind,this.dressedColors,true);
  const grass=this.mat('grass terrain','#ffffff');ground.useVertexColors=true;ground.material=grass;
  const lake=MeshBuilder.CreateDisc('Stillwater lake',{radius:pond.waterRadius,tessellation:44},this.scene);lake.rotation.x=Math.PI/2;lake.position.set(pond.x,pond.waterHeight,pond.z);
  const water=this.mat('lake',definition.waterColor,.91);lake.material=water;water.disableLighting=true;water.emissiveColor=Color3.FromHexString(definition.waterColor);
  this.spawned.push(ground,lake);
  const ambient=new HemisphericLight('ambient sky',new Vector3(0,1,0),this.scene);ambient.intensity=definition.lighting.sky;ambient.groundColor=new Color3(.28,.32,.24);
  const sun=new DirectionalLight('sun',new Vector3(-.5,-1,.4),this.scene);sun.intensity=definition.lighting.sun;sun.position.set(35,90,-60);
  this.lights.push(ambient,sun);
  this.atmosphere=new WorldAtmosphere(this.scene,ambient,sun,definition.atmosphere);
  // Lighting without live dynamic shadow maps is much cheaper for dense enemy scenes.
 }
 private buildEnvironment(seed:number,layout:EnvironmentLayout,berryTrees:readonly BerryTree[]=[]){
  const palette=this.profile.definition.scenery,vegetation=this.profile.definition.vegetation,barren=vegetation.deadWeight===1;
  const bark=this.mat('bark',palette.bark),pine=this.mat('pine',palette.pine),pine2=this.mat('pine2',vegetation.pineTip),round=this.mat('round foliage',vegetation.round),dead=this.mat('dead wood',vegetation.dead),scrub=this.mat('scrub',barren?vegetation.dead:palette.bush),rock=this.mat('stone',palette.rock),ruins=this.mat('old masonry',palette.ruins);
  const trunk=MeshBuilder.CreateCylinder('tree trunk',{height:2.4,diameterTop:.42,diameterBottom:.73,tessellation:5},this.scene);trunk.material=bark;trunk.isVisible=false;
  const canopy=MeshBuilder.CreateCylinder('cone crown',{height:3.8,diameterTop:0,diameterBottom:3.4,tessellation:5},this.scene);canopy.material=pine;canopy.isVisible=false;
  const tip=canopy.clone('tiered crown tip source')!;tip.material=pine2;
  const rounded=MeshBuilder.CreateIcoSphere('round crown source',{radius:1,subdivisions:1},this.scene);rounded.material=round;rounded.isVisible=false;
  const deadTrunk=trunk.clone('dead wood source')!;deadTrunk.material=dead;
  // Zero means Babylon's default (320 faces), not an unsubdivided primitive.
  const shrub=MeshBuilder.CreateIcoSphere('bush',{radius:1.1,subdivisions:2},this.scene);shrub.material=scrub;shrub.isVisible=false;
  const boulder=MeshBuilder.CreateIcoSphere('low-poly rock',{radius:1.25,subdivisions:1},this.scene);boulder.material=rock;boulder.isVisible=false;
  const smallRock=MeshBuilder.CreateBox('ruin block',{width:2.4,depth:1.8,height:2.2},this.scene);smallRock.material=ruins;smallRock.isVisible=false;
  this.reusable.push(trunk,canopy,tip,rounded,deadTrunk,shrub,boulder,smallRock);
  let id=0;
  // Sources share geometry/materials; the authoritative trunk collider remains in
  // createEnvironment. Decorative foliage and branches never add collision.
  const instance=(source:Mesh,name:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,rotation=0)=>{
   const mesh=source.createInstance(name);mesh.position.set(x,y,z);mesh.scaling.set(sx,sy,sz);mesh.rotation.y=rotation;mesh.isPickable=false;this.spawned.push(mesh);return mesh;
  };
  const tree=(x:number,z:number,scale:number,landmark=false,boundary?:string)=>{
   const visual=treeVisual(seed,x,z,vegetation,landmark),s=scale*(landmark?1:visual.scale),yaw=visual.rotation;
   // Horizon props sit beyond the finite ground mesh. Sink their silhouette
   // bases below its edge so distant trunks never terminate in empty sky.
   const y=this.height(x,z)-(boundary?(visual.family==='dead'?.9:2.1)*s:0);
   const name=boundary??(landmark?`great-pine-${id++}`:`crown-${visual.family}-${id++}`);
   if(visual.family==='dead'){
    instance(deadTrunk,boundary??`dead-trunk-${id++}`,x,y+2.1*s,z,s,1.75*s,s,yaw);
    // Three short tapered limbs give an asymmetric silhouette with four cheap
    // instances of the same five-sided cylinder, rather than a complex model.
    for(let branch=0;branch<3;branch++){
     const angle=yaw+branch*2.5,reach=(branch===2?.3:.5)*s;
     const limb=instance(deadTrunk,`${boundary??'dead-branch'}-${id++}`,x+Math.cos(angle)*reach,y+(2.15+branch*.57)*s,z-Math.sin(angle)*reach,.32*s,(branch===2?.55:.68)*s,.32*s,angle);
     limb.rotation.z=-(branch===2?.48:.85);
    }
    return;
   }
   if(!boundary)instance(trunk,`trunk-${id++}`,x,y+1.2*s,z,s,s,s,yaw);
   if(visual.family==='round')instance(rounded,name,x,y+3.15*s,z,1.65*s,1.35*s,1.65*s,yaw);
   else if(visual.family==='tiered'){
    instance(canopy,name,x,y+2.5*s,z,.98*s,.72*s,.98*s,yaw);
    instance(tip,`${boundary??'crown-tiered-tip'}-${id++}`,x,y+3.65*s,z,.7*s,.75*s,.7*s,yaw+.3);
   }else instance(canopy,name,x,y+3.2*s,z,s,s,s,yaw);
  };
  const berryTreePositions=new Set(berryTrees.map(tree=>`${tree.x}/${tree.z}`));
  for(const prop of layout.props){
   const {kind,x,z,scale}=prop,y=this.height(x,z);
   if(kind==='tree'&&berryTreePositions.has(`${x}/${z}`))continue;
   if(kind==='rock'){const height=palette.rockHeight*(prop.scaleY??1);instance(boulder,`${prop.landmark?'watchstone':'rock'}-${id++}`,x,y+height*.95*scale,z,scale,height*scale,scale,prop.rotation);}
   else if(kind==='bush'){const s=scale*.7;instance(shrub,`bush-${id++}`,x,y+(barren?.22:.5),z,s,barren?s*.34:s,s,prop.rotation);}
   else if(kind==='tree')tree(x,z,scale,prop.landmark);
   else if(kind==='ruin'){const b=smallRock.createInstance(`${prop.landmark?'gate-pillar':'ruin'}-${id++}`);b.position.set(x,y+1.1*prop.scaleY!,z);b.scaling.set(scale,prop.scaleY!,1);b.rotation.y=prop.rotation!;this.spawned.push(b);}
  }
  const horizonRng=new RNG(seed^0x3f2a61cb),horizonDensity=this.profile.definition.placement.horizonDensity;
  for(let side=0;side<4;side++)for(let i=0;i<25;i++){
   if(horizonRng.next()>horizonDensity)continue;
   const along=-DESIGN.mapRadius+i*DESIGN.mapRadius*2/24+horizonRng.between(-3,3),bound=DESIGN.mapRadius+3;
   const x=side<2?along:(side===2?-bound:bound),z=side<2?(side===0?-bound:bound):along;
   // Sparse, irregular silhouettes beyond the playable boundary; no colliders.
   tree(x,z,(barren?1.85:1.7)*horizonRng.between(.8,1.22),false,`boundary-${side}-${i}`);
  }
 }
 private buildBerryTrees(trees:BerryTree[]){
  const bodySource=MeshBuilder.CreateIcoSphere('berry body source',{radius:.42,subdivisions:1},this.scene);
  const leafSource=MeshBuilder.CreateIcoSphere('berry leaf source',{radius:.18,subdivisions:1},this.scene);
  const trunkSource=MeshBuilder.CreateCylinder('berry tree trunk source',{height:1.05,diameterTop:.34,diameterBottom:.48,tessellation:6},this.scene);
  const lowerCanopySource=MeshBuilder.CreateIcoSphere('berry tree lower canopy source',{radius:1,subdivisions:1},this.scene);
  const upperCanopySource=MeshBuilder.CreateIcoSphere('berry tree upper canopy source',{radius:1,subdivisions:1},this.scene);
  bodySource.isVisible=leafSource.isVisible=trunkSource.isVisible=lowerCanopySource.isVisible=upperCanopySource.isVisible=false;
  this.reusable.push(bodySource,leafSource,trunkSource,lowerCanopySource,upperCanopySource);
  const leafMaterial=this.mat('berry leaves','#64a655');leafSource.material=leafMaterial;
  const vegetation=this.profile.definition.vegetation;
  // Existing volcanic harvest trees keep their interaction identity, but their
  // muted canopy belongs to the ash grove rather than an ordinary green forest.
  const canopyTint=vegetation.deadWeight===1?Color3.FromHexString(vegetation.dead):Color3.FromHexString(vegetation.round);
  for(const id of BERRY_ORDER){
   const palette=BERRY_TREE_PALETTES[id];this.berryMaterials[id]=this.mat(`${id} berry`,BERRIES[id].color);
   this.berryTreeMaterials[id]={bark:this.mat(`${id} berry tree bark`,palette.bark),lower:this.mat(`${id} berry tree lower canopy`,palette.lower),upper:this.mat(`${id} berry tree upper canopy`,palette.upper)};
   for(const material of [this.berryTreeMaterials[id].lower,this.berryTreeMaterials[id].upper]){
    Color3.LerpToRef(material.diffuseColor,canopyTint,vegetation.deadWeight===1?.7:.18,material.diffuseColor);material.emissiveColor=material.diffuseColor.scale(.13);
   }
  }
  for(const tree of trees){
   const trunk=trunkSource.clone(`berry-tree-${tree.uid}-trunk`)!,lower=lowerCanopySource.clone(`berry-tree-${tree.uid}-lower`)!,upper=upperCanopySource.clone(`berry-tree-${tree.uid}-upper`)!;
   trunk.isVisible=lower.isVisible=upper.isVisible=true;trunk.isPickable=lower.isPickable=upper.isPickable=false;this.spawned.push(trunk,lower,upper);
   const crown=Array.from({length:5},(_,index)=>{
    const berry=bodySource.clone(`berry-tree-${tree.uid}-fruit-${index}`)!;
    berry.isVisible=true;berry.isPickable=false;this.spawned.push(berry);return berry;
   });
   const ground=Array.from({length:3},(_,index)=>{
    const body=bodySource.clone(`berry-${tree.uid}-${index}`)!,leaf=leafSource.clone(`berry-leaf-${tree.uid}-${index}`)!;
    body.isVisible=leaf.isVisible=true;leaf.material=leafMaterial;
    body.isPickable=leaf.isPickable=false;this.spawned.push(body,leaf);return {body,leaf};
   });
   this.berryViews.set(tree.uid,{trunk,lower,upper,crown,ground});
  }
 }
 private updateBerryArt(trees:BerryTree[],elapsed:number){
  for(const tree of trees){const view=this.berryViews.get(tree.uid);if(!view)continue;
   const color=this.berryMaterials[tree.berry],palette=this.berryTreeMaterials[tree.berry],silver=tree.berry==='silver-pinap',pinap=tree.berry==='pinap'||silver;
   const variation=.94+(tree.uid%5)*.025,scale=tree.scale*variation,ground=this.height(tree.x,tree.z);
   view.trunk.position.set(tree.x,ground+.525*scale,tree.z);view.trunk.scaling.set(scale,scale,scale);view.trunk.material=palette.bark;
   view.lower.position.set(tree.x,ground+1.58*scale,tree.z);view.lower.scaling.set(1.3*scale,.8*scale,1.3*scale);view.lower.material=palette.lower;
   view.upper.position.set(tree.x,ground+2.48*scale,tree.z);view.upper.scaling.set(.9*scale,.78*scale,.9*scale);view.upper.material=palette.upper;
   for(const [index,mesh] of view.crown.entries()){
    // Fruit centers sit on outward canopy edges so saturated type colors read
    // from the gameplay camera instead of disappearing inside the foliage.
    const angle=index*Math.PI/2+tree.uid*.37,ring=index===4?.89:1.3,high=index===4?2.6:1.62+(index%2)*.25;
    mesh.position.set(tree.x+Math.sin(angle)*ring*scale,ground+high*scale,tree.z+Math.cos(angle)*ring*scale);
    mesh.scaling.set((pinap?.62:.55)*scale,(pinap?.78:.55)*scale,.55*scale);mesh.material=color;
   }
   for(const [index,{body,leaf}] of view.ground.entries()){
    const berry=tree.berries[index],visible=!!berry&&!berry.collected;
    body.setEnabled(visible);leaf.setEnabled(visible);if(!berry||!visible)continue;
    const fall=Math.max(0,1-(elapsed-berry.droppedAt)/.85),height=this.height(berry.x,berry.z)+.45+fall*2.7*tree.scale;
    body.position.set(berry.x,height,berry.z);body.scaling.set(pinap?.42:.4,pinap?.54:.4,.4);body.material=color;
    leaf.position.set(berry.x,height+(pinap?.33:.27),berry.z);leaf.scaling.set(.85,.45,.65);
   }
  }
 }
 private buildLandmarks(pois:POI[]){
  this.shrineStone=this.mat('weathered statue stone','#92978f');this.shrineCarving=this.mat('statue carvings','#555b57');
  this.shrineMaterials=SHRINE_TIERS.map(definition=>{const material=this.mat(`tier-${definition.tier} magic dust`,definition.color,.68);material.emissiveColor=Color3.FromHexString(definition.color).scale(.3);return material;});
  for(const [kind,color] of Object.entries({slow:'#7bafe1',poison:'#a275bf',fire:'#e57844'}))this.hazardMaterials[kind as ShrineHazard]=this.mat(`shrine ${kind} ground`,color,.35);
  const beacon=MeshBuilder.CreateCylinder('obelisk',{height:2.8,diameterTop:.36,diameterBottom:1.7,tessellation:5},this.scene);beacon.material=this.shrineStone;beacon.isVisible=false;this.reusable.push(beacon);
  const dustSource=MeshBuilder.CreatePolyhedron('shrine dust source',{type:1,size:.055},this.scene),hazardSource=MeshBuilder.CreateDisc('shrine hazard source',{radius:1,tessellation:32,sideOrientation:Mesh.DOUBLESIDE},this.scene);
  dustSource.isVisible=hazardSource.isVisible=false;this.reusable.push(dustSource,hazardSource);
  this.chests=new TreasureChests(this.scene,pois,(x,z)=>this.height(x,z));
  const mats={shrine:this.mat('shrine','#aaa2c4'),healing:this.mat('healing','#88b39a')};
  const bases={shrine:MeshBuilder.CreateCylinder('shrine plinth',{height:.65,diameterTop:2.8,diameterBottom:3.4,tessellation:8},this.scene),healing:MeshBuilder.CreateCylinder('healing spring',{height:.7,diameter:3,tessellation:8},this.scene)};
  for(const [key,mesh] of Object.entries(bases)){
   const kind=key as Exclude<POI['kind'],'cache'>;mesh.material=mats[kind];mesh.isVisible=false;this.reusable.push(mesh);
  }
  for(const poi of pois){if(poi.kind==='cache')continue;const mesh=bases[poi.kind].clone(`POI ${poi.kind} ${poi.uid}`)!;mesh.isVisible=true;
   const root=new TransformNode(`landmark-${poi.uid}`,this.scene);mesh.parent=root;root.position.set(poi.x,this.height(poi.x,poi.z),poi.z);
   mesh.position.y={shrine:.325,healing:.35}[poi.kind];
   const entry:{marker:TransformNode;body:AbstractMesh;dust?:AbstractMesh[];hazards?:AbstractMesh[]}={marker:root,body:mesh};
   if(poi.kind==='shrine'){
    mesh.material=this.shrineStone;
    entry.dust=Array.from({length:10},(_,index)=>{const mote=dustSource.clone(`shrine-dust-${poi.uid}-${index}`)!;mote.isVisible=true;mote.parent=root;mote.isPickable=false;this.spawned.push(mote);return mote;});
    entry.hazards=Array.from({length:3},(_,index)=>{const zone=hazardSource.clone(`shrine-hazard-${poi.uid}-${index}`)!;zone.isVisible=true;zone.rotation.x=Math.PI/2;zone.parent=root;zone.isPickable=false;zone.setEnabled(false);this.spawned.push(zone);return zone;});
   }
   this.landmarks.set(poi.uid,entry);this.spawned.push(mesh);
  }
 }
 private buildTerrainFeatures(features:TerrainFeature[]){
  const bramble=this.mat('bramble ground','#62713f',.72),beacon=this.mat('ruin beacon','#d49d50');
  // Share one source mesh per feature shape so every marker reuses geometry.
  const brambleSource=MeshBuilder.CreateDisc('bramble ground source',{radius:1,tessellation:14},this.scene);brambleSource.material=bramble;brambleSource.isVisible=false;this.reusable.push(brambleSource);
  const beaconSource=this.scene.getMeshByName('obelisk') as Mesh;
  const ringSource=MeshBuilder.CreateTorus('terrain feature ring source',{diameter:4,thickness:.13,tessellation:16},this.scene);
  ringSource.isVisible=false;this.reusable.push(ringSource);
  for(const feature of features){const root=new TransformNode(`terrain-feature-${feature.uid}`,this.scene);root.position.set(feature.x,this.height(feature.x,feature.z)+.04,feature.z);
   const brambles=feature.kind==='bramble',body=brambles?brambleSource.createInstance(`bramble-${feature.uid}`):beaconSource.clone(`ruin-beacon-${feature.uid}`)!;
   body.rotation.x=brambles?Math.PI/2:0;body.position.y=brambles?.01:.9;body.scaling.set(brambles?feature.radius:.42,brambles?feature.radius:.7,brambles?1:.42);if(!brambles)body.material=beacon;body.parent=root;
   // Clones retain shared geometry but permit the beacon's distinctive material.
   const ring=brambles?ringSource.createInstance(`feature-ring-${feature.uid}`):ringSource.clone(`feature-ring-${feature.uid}`)!;if(!brambles)ring.material=beacon;ring.parent=root;ring.position.y=.05;ring.scaling.set(feature.radius/2,1,feature.radius/2);ring.isVisible=!brambles;
   this.terrainFeatures.set(feature.uid,{root,ring,body});this.spawned.push(body,ring);
  }
 }
 update(_dt:number,pois:POI[],elapsed=0,features:TerrainFeature[]=[],berryTrees:BerryTree[]=[]){
  this.lastPois=pois;this.lastElapsed=elapsed;this.atmosphere?.update(elapsed);this.dressing?.update(pois,elapsed);
  this.updateBerryArt(berryTrees,elapsed);
  this.chests?.update(pois,elapsed);
  for(const poi of pois){const entry=this.landmarks.get(poi.uid);if(!entry)continue;
   entry.marker.setEnabled(siteAvailable(poi,elapsed)&&(!poi.used||poi.respawnAt!==undefined||!!poi.challenge));
   entry.body.scaling.y=poi.used?.35:1;
   if(poi.kind==='shrine'){
    const definition=shrineForPOI(poi),material=this.shrineMaterials[definition.tier-1];
    if(entry.speciesId!==definition.speciesId){
     entry.statue?.dispose();let source=this.statueSources.get(definition.speciesId);
     if(!source){source=createShrineStatue(this.scene,definition.speciesId,this.shrineStone,this.shrineCarving);source.isVisible=false;this.statueSources.set(definition.speciesId,source);}
     entry.statue=source.clone(`shrine-statue-${poi.uid}`)!;entry.statue.isVisible=true;entry.statue.rotation.y=Math.PI;entry.statue.parent=entry.marker;entry.speciesId=definition.speciesId;
    }
    for(const [index,mote] of (entry.dust??[]).entries()){
     const phase=(elapsed*.17+index/10)%1,angle=index*2.4+elapsed*.18,radius=1.1+Math.sin(index*7)*.55;
     mote.position.set(Math.sin(angle)*radius,.7+phase*3.6,Math.cos(angle)*radius);mote.rotation.set(phase*3,angle,phase*5);mote.scaling.setAll(.5+Math.sin(phase*Math.PI)*.8);
     mote.material=material;mote.setEnabled(!poi.used||!!poi.challenge);
    }
    const zones=shrineHazardZones(poi,elapsed);
    for(const [index,mesh] of (entry.hazards??[]).entries()){
     const zone=zones[index];mesh.setEnabled(!!zone);if(!zone)continue;
     mesh.position.set(zone.x-poi.x,this.height(zone.x,zone.z)-entry.marker.position.y+.12,zone.z-poi.z);
     mesh.scaling.setAll(zone.radius*(zone.warning?.88+Math.sin(elapsed*8)*.04:1));mesh.material=this.hazardMaterials[zone.kind];mesh.visibility=zone.warning?.45:1;
    }
   }
  }
  for(const feature of features){const view=this.terrainFeatures.get(feature.uid);if(!view)continue;view.root.setEnabled(feature.state!=='spent');if(feature.kind==='ruin-beacon')view.ring.scaling.set(feature.state==='arming'?1.18:1,1,feature.state==='arming'?1.18:1);}
 }
 dispose(){this.dressing?.dispose();this.dressing=undefined;this.atmosphere?.dispose();this.atmosphere=undefined;this.chests?.dispose();for(const mesh of this.spawned)mesh.dispose();for(const root of this.landmarks.values())root.marker.dispose();for(const root of this.terrainFeatures.values())root.root.dispose();for(const source of this.statueSources.values()){const material=source.material;source.dispose();material?.dispose();}this.statueSources.clear();for(const root of this.reusable)root.dispose();for(const material of this.materials)material.dispose();for(const light of this.lights)light.dispose();this.landmarks.clear();this.terrainFeatures.clear();this.berryViews.clear();this.spawned=[];this.reusable=[];this.groundDetails=[];this.materials=[];this.lights=[];this.terrain=undefined;this.plainColors=undefined;this.dressedColors=undefined;this.lastPois=[];}
}
