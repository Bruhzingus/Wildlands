import {Color3,Mesh,MeshBuilder,MultiMaterial,Scene,StandardMaterial,TransformNode,VertexData} from '@babylonjs/core';
import {CHEST_TIERS,chestRarity} from '../../data/economy.ts';
import {siteAvailable} from '../../data/maps.ts';
import type {LootRarity,POI} from '../types.ts';

interface ChestView {root:TransformNode;hinge:TransformNode;wood:Mesh[];lock:Mesh;ring:Mesh;}

/** Shared wooden shells have real hollow interiors and lids hinged at the back. */
export class TreasureChests {
 private views=new Map<number,ChestView>();private sources:Mesh[]=[];private materials:StandardMaterial[]=[];
 private composites:MultiMaterial[]=[];
 private woods=new Map<LootRarity,StandardMaterial>();private rings=new Map<LootRarity,StandardMaterial>();
 private scene:Scene;
 constructor(scene:Scene,pois:POI[],ground:(x:number,z:number)=>number){
  this.scene=scene;
  const wood=this.material('weathered chest wood','#896343'),grain=this.material('chest wood grain','#4b382b');
  const iron=this.material('worn chest iron','#4c5153'),brass=this.material('chest lock brass','#d1ad62');
  const inside=this.material('empty chest interior','#352b23'),scratches=this.material('scuffed chest edges','#b7956b');
  const gold=this.material('discovery gold glow','#f4cb72',.24);gold.disableLighting=true;gold.emissiveColor=gold.diffuseColor;
  for(const rarity of ['common','rare','epic'] as const){
   const m=this.material(`${rarity} stained chest wood`,CHEST_TIERS[rarity].color);m.diffuseColor.scaleInPlace(.68);this.woods.set(rarity,m);
   const ring=this.material(`${rarity} chest marker`,CHEST_TIERS[rarity].color,.38);ring.disableLighting=true;ring.emissiveColor=ring.diffuseColor;this.rings.set(rarity,ring);
  }
  const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,material:StandardMaterial)=>{
   const m=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.position.set(x,y,z);m.material=material;return m;
  };
  const merge=(name:string,parts:Mesh[])=>{
   const mesh=Mesh.MergeMeshes(parts,true,true,undefined,false,true)!;mesh.name=name;mesh.isVisible=false;mesh.isPickable=false;if(mesh.material instanceof MultiMaterial)this.composites.push(mesh.material);this.sources.push(mesh);return mesh;
  };
  const shell:Mesh[]=[],seams:Mesh[]=[],trim:Mesh[]=[],lid:Mesh[]=[],lidTrim:Mesh[]=[],wear:Mesh[]=[];
  shell.push(box('wooden floor',2.32,.15,1.58,0,.18,0,wood));
  for(let row=0;row<3;row++){
   const y=.36+row*.235;
   for(const z of [-.73,.73])shell.push(box('horizontal chest plank',2.34,.22,.16,0,y,z,wood));
   for(const x of [-1.09,1.09])shell.push(box('side chest plank',.16,.22,1.3,x,y,0,wood));
   for(const z of [-.818,.818])for(const side of [-1,1]){
    const g=box('wood grain',.46+row*.14,.012,.008,side*.49,y+.035*(side+row-1),z,grain);g.rotation.z=side*.035;seams.push(g);
   }
  }
  for(const y of [.22,.94]){
   trim.push(box('front iron rim',2.43,.075,.08,0,y,-.83,iron),box('back iron rim',2.43,.075,.08,0,y,.83,iron));
   for(const x of [-1.2,1.2])trim.push(box('side iron rim',.08,.075,1.72,x,y,0,iron));
  }
  for(const x of [-.77,.77]){
   for(const z of [-.835,.835])trim.push(box('secure iron band',.13,.72,.055,x,.58,z,iron));
   trim.push(box('bottom iron band',.13,.065,1.66,x,.10,0,iron));
  }
  // Seven curved boards form a barrel lid, with a visible seam between boards.
  for(let i=0;i<7;i++){
   const angle=-Math.PI/2+(i+.5)*Math.PI/7,z=Math.sin(angle)*.77,y=Math.cos(angle)*.43;
   const panel=box('arched lid plank',2.34,.11,.34,0,y,z,wood);panel.rotation.x=Math.atan2(.43*Math.sin(angle),.77*Math.cos(angle));lid.push(panel);
   for(const x of [-.77,.77]){
    const band=box('arched iron lid strap',.13,.035,.35,x,y+.065,z,iron);band.rotation.x=panel.rotation.x;lidTrim.push(band);
   }
  }
  for(const x of [-1.1,1.1]){
   const positions=[x,0,0],indices:number[]=[];
   for(let i=0;i<=10;i++){const a=-Math.PI/2+i*Math.PI/10;positions.push(x,.43*Math.cos(a),.77*Math.sin(a));if(i)indices.push(0,i,i+1);}
   const cap=new Mesh('wooden lid end',scene),data=new VertexData();data.positions=positions;data.indices=indices;
   const normals:number[]=[];VertexData.ComputeNormals(positions,indices,normals);data.normals=normals;data.uvs=new Array(positions.length/3*2).fill(0);data.applyToMesh(cap);cap.material=wood;lid.push(cap);
  }
  lidTrim.push(box('lid hasp',.19,.32,.08,0,-.06,-.83,brass));
  for(const x of [-.77,.77])trim.push(box('back hinge',.27,.13,.14,x,.95,.82,brass));
  const locks=[box('padlock body',.43,.36,.19,0,.7,-.96,brass),box('lock keyhole',.055,.115,.012,0,.7,-1.063,inside)];
  const shackle=MeshBuilder.CreateTorus('closed lock shackle',{diameter:.3,thickness:.065,tessellation:12},scene);shackle.rotation.x=Math.PI/2;shackle.position.set(0,.91,-.96);shackle.material=iron;locks.push(shackle);
  for(let i=0;i<9;i++){
   const m=box('scratched wood',.12+(i%3)*.06,.018,.012,-.93+(i*37%180)/100,.31+(i*19%53)/100,-.823,scratches);m.rotation.z=-.25+(i%4)*.17;wear.push(m);
  }
  const bodySource=merge('chest hollow wooden shell',shell),grainSource=merge('chest plank grain',seams),trimSource=merge('chest iron binding',trim);
  const lidSource=merge('chest arched wooden lid',lid),lidTrimSource=merge('chest lid binding',lidTrim),lockSource=merge('chest secured padlock',locks),wearSource=merge('chest worn scratches',wear);
  bodySource.material=lidSource.material=wood;
  const floor=box('empty chest floor',1.98,.035,1.27,0,.275,0,inside);floor.isVisible=false;this.sources.push(floor);
  const ring=MeshBuilder.CreateTorus('chest marker source',{diameter:3.8,thickness:.065,tessellation:32},scene);ring.material=gold;ring.isVisible=false;this.sources.push(ring);
  const glow=this.glow(gold);this.sources.push(glow);
  for(const poi of pois.filter(p=>p.kind==='cache')){
   const root=new TransformNode(`landmark-${poi.uid}`,scene);root.position.set(poi.x,ground(poi.x,poi.z),poi.z);
   const discovery=poi.price===undefined;root.scaling.setAll(discovery?.88:1);root.rotation.y=discovery?(poi.uid%3-1)*.12:0;
   const clone=(source:Mesh,name:string,parent:TransformNode=root)=>{const m=source.clone(`${name}-${poi.uid}`,parent)!;m.isVisible=true;m.isPickable=false;return m;};
   const body=clone(bodySource,'chest-body');clone(grainSource,'chest-grain');clone(trimSource,'chest-binding');clone(floor,'chest-empty-floor');
   if(discovery)clone(wearSource,'chest-scuffs');
   const hinge=new TransformNode(`chest-hinge-${poi.uid}`,scene);hinge.parent=root;hinge.position.set(0,.98,.77);
   const top=clone(lidSource,'chest-lid',hinge),bands=clone(lidTrimSource,'chest-lid-binding',hinge);top.position.z=bands.position.z=-.77;
   const lock=clone(lockSource,'chest-lock'),marker=clone(ring,'marker-ring');marker.position.y=.07;
   if(discovery){const halo=clone(glow,'discovery-glow');halo.position.y=.035;}
   lock.setEnabled(!discovery);
   this.views.set(poi.uid,{root,hinge,wood:[body,top],lock,ring:marker});
  }
 }
 private material(name:string,color:string,alpha=1){
  const m=new StandardMaterial(name,this.scene);m.diffuseColor=Color3.FromHexString(color);m.emissiveColor=m.diffuseColor.scale(.08);m.specularColor=new Color3(.1,.09,.07);m.alpha=alpha;m.backFaceCulling=false;this.materials.push(m);return m;
 }
 private glow(material:StandardMaterial){
  const mesh=new Mesh('discovery glow source',this.scene),positions=[0,0,0],colors=[1,1,1,.65],indices:number[]=[];
  for(let i=0;i<=32;i++){const a=i*Math.PI/16;positions.push(Math.cos(a)*2.5,0,Math.sin(a)*2.5);colors.push(1,1,1,0);if(i)indices.push(0,i,i+1);}
  const data=new VertexData();data.positions=positions;data.indices=indices;data.colors=colors;data.applyToMesh(mesh);mesh.hasVertexAlpha=true;mesh.material=material;mesh.isVisible=false;mesh.isPickable=false;return mesh;
 }
 update(pois:POI[],elapsed:number){
  for(const poi of pois){const v=this.views.get(poi.uid);if(!v)continue;
   const paid=poi.price!==undefined;v.root.setEnabled(siteAvailable(poi,elapsed)&&(paid||!poi.used));
   v.hinge.rotation.x=poi.used?Math.PI*.64:0;v.lock.setEnabled(paid&&!poi.used);
   if(paid){const rarity=chestRarity({stats:{elapsed}},poi);for(const mesh of v.wood)mesh.material=this.woods.get(rarity)!;v.ring.material=this.rings.get(rarity)!;}
   v.ring.visibility=poi.used?.3:1;
  }
 }
 dispose(){for(const v of this.views.values())v.root.dispose();this.views.clear();for(const m of this.sources)m.dispose();for(const m of this.composites)m.dispose();for(const m of this.materials)m.dispose();this.sources=[];this.materials=[];this.composites=[];}
}
