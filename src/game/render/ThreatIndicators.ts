import {Color3,Color4,Mesh,MeshBuilder,StandardMaterial,VertexBuffer,VertexData,type InstancedMesh,type Scene} from '@babylonjs/core';
import {getEnemyAttackProfile} from '../../data/enemyAttacks.ts';
import {COMBAT_VISUALS} from '../../data/config.ts';
import type {RunState} from '../types.ts';

const SEGMENTS=40,LAYERS=10,STRIDE=(SEGMENTS+1)*2;
interface Warning {mesh:Mesh;positions:Float32Array;colors:Float32Array;charge?:InstancedMesh;signature?:string;}
interface Cue {key:number;name:string;x:number;z:number;radius:number;angle:number;facing:number;progress:number;healing:boolean;source?:{x:number;z:number;size:number;color:string;progress:number};}

/** Terrain-following coverage + an expanding clock. The fixed edge is the hit
 * boundary; the bright inner edge reaches it exactly when the simulation fires.
 * Ranged cues are compact launch wedges, not a claim that the whole aim line hits. */
export class ThreatIndicators {
 private scene:Scene;private height:(x:number,z:number)=>number;
 private active=new Map<number,Warning>();private free:Warning[]=[];private freeCharges:InstancedMesh[]=[];
 private material:StandardMaterial|undefined;private chargeSource:Mesh|undefined;private chargeMaterial:StandardMaterial|undefined;
 constructor(scene:Scene,height:(x:number,z:number)=>number){this.scene=scene;this.height=height;}
 private create():Warning {
  if(!this.material){
   const material=new StandardMaterial('enemy-warning-material',this.scene);
   material.diffuseColor=Color3.White();material.emissiveColor=Color3.White();material.disableLighting=true;
   material.backFaceCulling=false;material.disableDepthWrite=true;material.transparencyMode=StandardMaterial.MATERIAL_ALPHABLEND;
   this.material=material;
  }
  const mesh=new Mesh('enemy-warning',this.scene),positions=new Float32Array(LAYERS*STRIDE*3),colors=new Float32Array(LAYERS*STRIDE*4),indices:number[]=[];
  for(let layer=0;layer<LAYERS;layer++)for(let i=0;i<SEGMENTS;i++){
   const v=layer*STRIDE+i*2;indices.push(v,v+1,v+2,v+1,v+3,v+2);
  }
  const data=new VertexData();data.positions=positions;data.colors=colors;data.indices=indices;data.applyToMesh(mesh,true);
  mesh.material=this.material;mesh.hasVertexAlpha=true;mesh.isPickable=false;
  return {mesh,positions,colors};
 }
 private charge(){
  const reused=this.freeCharges.pop();if(reused){reused.setEnabled(true);return reused;}
  if(!this.chargeSource){
   this.chargeMaterial=new StandardMaterial('enemy-charge-material',this.scene);
   this.chargeMaterial.diffuseColor=Color3.White();this.chargeMaterial.emissiveColor=Color3.White();this.chargeMaterial.disableLighting=true;
   this.chargeSource=MeshBuilder.CreateIcoSphere('enemy-charge-source',{radius:1,subdivisions:1},this.scene);
   this.chargeSource.material=this.chargeMaterial;this.chargeSource.isVisible=false;this.chargeSource.isPickable=false;
   this.chargeSource.registerInstancedBuffer('instanceColor',4);
   this.chargeSource.instancedBuffers.instanceColor=new Color4(1,1,1,1);
  }
  const mesh=this.chargeSource.createInstance('enemy-charge');mesh.isPickable=false;
  mesh.instancedBuffers.instanceColor=new Color4(1,1,1,1);return mesh;
 }
 private draw(cue:Cue){
  let warning=this.active.get(cue.key);
  if(!warning){warning=this.free.pop()??this.create();this.active.set(cue.key,warning);}
  const {mesh,positions,colors}=warning,p=Math.max(0,Math.min(1,cue.progress)),radius=Math.max(.1,cue.radius);
  mesh.name=cue.name;mesh.setEnabled(true);mesh.isVisible=true;
  const signature=[cue.name,cue.x,cue.z,radius,cue.angle,cue.facing,p,cue.healing,cue.source?.x,cue.source?.z,cue.source?.size,cue.source?.color,cue.source?.progress].join('/');
  if(warning.signature===signature)return;warning.signature=signature;
  const base=this.height(cue.x,cue.z);mesh.position.set(cue.x,base,cue.z);mesh.scaling.set(radius,1,radius);mesh.rotation.y=cue.facing;
  const c=cue.healing?[.27,1,.65]:[1,.25,.12],bright=cue.healing?[.75,1,.82]:[1,.92,.68];
  for(let layer=0;layer<LAYERS;layer++){
   const background=layer<4,fill=layer>=4&&layer<8,border=layer===8;
   const part=background?layer:layer-4;
   const inner=background?part/4:fill?part/4*p:border?Math.max(0,1-.13/radius):Math.max(0,p-.10/radius);
   const outer=background?(part+1)/4:fill?(part+1)/4*p:border?1:Math.max(.015,p);
   const alpha=background?.085:fill?.16:border?.85:.95;
   const color=layer===9?bright:c;
   for(let i=0;i<=SEGMENTS;i++)for(let edge=0;edge<2;edge++){
    const a=(i/SEGMENTS-.5)*cue.angle,r=edge?outer:inner,lx=Math.sin(a)*r,lz=Math.cos(a)*r;
    const wx=cue.x+(lx*Math.cos(cue.facing)+lz*Math.sin(cue.facing))*radius;
    const wz=cue.z+(-lx*Math.sin(cue.facing)+lz*Math.cos(cue.facing))*radius;
    const v=layer*STRIDE+i*2+edge;
    positions[v*3]=lx;positions[v*3+1]=this.height(wx,wz)-base+.07+layer*.004;positions[v*3+2]=lz;
    colors[v*4]=color[0];colors[v*4+1]=color[1];colors[v*4+2]=color[2];colors[v*4+3]=alpha;
   }
  }
  mesh.updateVerticesData(VertexBuffer.PositionKind,positions,true);mesh.updateVerticesData(VertexBuffer.ColorKind,colors);
  mesh.metadata={progress:p,radius,healing:cue.healing};
  if(cue.source){
   const source=cue.source;warning.charge??=this.charge();
   const charge=warning.charge;charge.name=`combat-charge-${cue.key}`;
   // A growing elemental bead at the Pokémon's front connects windup to release.
   charge.position.set(source.x+Math.sin(cue.facing)*source.size*.65,this.height(source.x,source.z)+source.size*.95,source.z+Math.cos(cue.facing)*source.size*.65);
   charge.scaling.setAll(.10+source.progress*.18);charge.rotation.y=cue.facing;
   // Babylon's built-in instanceColor buffer is used by the material shader.
   const color=Color3.FromHexString(source.color);
   const tint=charge.instancedBuffers.instanceColor as Color4|undefined;
   if(tint)tint.set(color.r,color.g,color.b,1);else charge.instancedBuffers.instanceColor=new Color4(color.r,color.g,color.b,1);
  }else if(warning.charge){warning.charge.setEnabled(false);this.freeCharges.push(warning.charge);warning.charge=undefined;}
 }
 update(state:RunState){
  const alive=new Set<number>(),cues:Cue[]=[],distance=(x:number,z:number)=>(x-state.player.x)**2+(z-state.player.z)**2;
  const enemies=state.enemies.filter(e=>!e.dead&&e.windup).sort((a,b)=>Number(b.isBoss)-Number(a.isBoss)||distance(a.x,a.z)-distance(b.x,b.z));
  for(const enemy of enemies.slice(0,COMBAT_VISUALS.maxWindups)){
   const w=enemy.windup!,role=w.role,melee=role==='melee-fast'||role==='melee-slow',ranged=role==='ranged-burst'||role==='ranged-projectile'||w.kind==='volley';
   const landing=w.kind==='slam'||role==='explosive-bomb',profile=getEnemyAttackProfile(enemy.speciesId);
   const flight=role==='explosive-bomb'?Math.max(.35,Math.hypot(w.x-enemy.x,w.z-enemy.z)/profile.projectileSpeed):0;
   alive.add(enemy.uid);
   cues.push({key:enemy.uid,name:`combat-windup-${enemy.uid}`,x:landing?w.x:enemy.x,z:landing?w.z:enemy.z,
    radius:ranged?2.3:(w.radius??enemy.size+1)+(melee?enemy.size*.3:0),
    angle:melee?2*Math.acos(.24):ranged?(role==='ranged-burst'?.7:.36):Math.PI*2,
    facing:w.facing,progress:1-(w.remaining+flight)/(w.duration+flight),healing:role==='healer'||w.kind==='summon',
    source:{x:enemy.x,z:enemy.z,size:enemy.size,color:profile.color,progress:1-w.remaining/w.duration}});
  }
  const bombs=state.projectiles.filter(p=>!p.friendly&&p.kind==='lob').sort((a,b)=>distance(a.blastX??a.x,a.blastZ??a.z)-distance(b.blastX??b.x,b.blastZ??b.z));
  for(const bomb of bombs.slice(0,COMBAT_VISUALS.maxWindups)){
   alive.add(-bomb.uid);
   cues.push({key:-bomb.uid,name:`combat-bomb-landing-${bomb.uid}`,x:bomb.blastX??bomb.x,z:bomb.blastZ??bomb.z,
    radius:bomb.radius??3,angle:Math.PI*2,facing:0,progress:1-bomb.ttl/(bomb.warningDuration??bomb.duration??bomb.ttl),healing:false});
  }
  for(const [key,warning] of this.active)if(!alive.has(key)){
   warning.mesh.setEnabled(false);warning.mesh.isVisible=false;
   if(warning.charge){warning.charge.setEnabled(false);this.freeCharges.push(warning.charge);warning.charge=undefined;}
   warning.signature=undefined;this.free.push(warning);this.active.delete(key);
  }
  // Retire before allocating: repeated waves stay at 32 areas + 16 charge beads.
  for(const cue of cues)this.draw(cue);
 }
 inspect(){return {active:this.active.size,allocated:this.active.size+this.free.length+this.freeCharges.length+[...this.active.values()].filter(w=>w.charge).length,pooled:this.free.length+this.freeCharges.length};}
 dispose(){
  for(const w of [...this.active.values(),...this.free]){w.mesh.dispose();w.charge?.dispose();}
  for(const charge of this.freeCharges)charge.dispose();
  this.chargeSource?.dispose();this.material?.dispose();this.chargeMaterial?.dispose();this.active.clear();this.free=[];this.freeCharges=[];
 }
}
