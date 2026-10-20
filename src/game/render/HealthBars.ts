import {Axis,Color3,Mesh,MeshBuilder,Scene,StandardMaterial,TransformNode,Vector3,type InstancedMesh} from '@babylonjs/core';
import {getSpecies} from '../../data/kanto.ts';
import {HEALTH_BARS} from '../../data/config.ts';
import type {RunState} from '../types.ts';

type BarKind='player'|'enemy';
interface Bar {
 root:TransformNode;track:InstancedMesh;fill:InstancedMesh;kind:BarKind;
 ratio:number;displayedRatio:number;width:number;
}

/** Small world-space bars: shared geometry, no labels, flashes or damage numbers. */
export class HealthBars {
 private bars=new Map<number,Bar>();private up=Vector3.Up();
 private trackSource:Mesh;private playerSource:Mesh;private enemySource:Mesh;
 private materials:StandardMaterial[]=[];private scene:Scene;private reducedMotion:boolean;private headroom:(speciesId:number)=>number;
 constructor(scene:Scene,reducedMotion=false,headroom:(speciesId:number)=>number=()=>1){
  this.scene=scene;this.reducedMotion=reducedMotion;this.headroom=headroom;
  this.trackSource=this.source('health-track',HEALTH_BARS.trackColor);
  this.playerSource=this.source('health-player',HEALTH_BARS.playerColor,-2);
  this.enemySource=this.source('health-enemy',HEALTH_BARS.enemyColor,-2);
 }
 private source(name:string,color:string,zOffset=0){
  const material=new StandardMaterial(name,this.scene);
  material.diffuseColor=Color3.FromHexString(color);material.emissiveColor=material.diffuseColor;
  material.disableLighting=true;material.specularColor=Color3.Black();material.backFaceCulling=false;
  material.zOffset=zOffset;this.materials.push(material);
  const mesh=MeshBuilder.CreatePlane(`${name}-template`,{size:1},this.scene);
  mesh.material=material;mesh.isPickable=false;mesh.isVisible=false;return mesh;
 }
 sync(state:RunState,dt:number,ground:(x:number,z:number)=>number){
  this.scene.activeCamera?.getDirectionToRef(Axis.Y,this.up);
  const found=new Set<number>(),leader=state.party[0],p=state.player;
  if(leader&&p.hp>0){
   const size=(2.8+getSpecies(leader.speciesId).stage*.18)*this.headroom(leader.speciesId);
   this.update(leader.uid,'player',p.x,p.z,ground(p.x,p.z)+p.y,size,HEALTH_BARS.playerWidth,p.hp,p.maxHp,dt);found.add(leader.uid);
  }
  // Keep the immediate fight legible even at the full enemy budget.
  const nearby=state.enemies.filter(e=>!e.dead&&e.hp>0&&(e.x-p.x)**2+(e.z-p.z)**2<=HEALTH_BARS.enemyRange**2)
   .sort((a,b)=>((a.x-p.x)**2+(a.z-p.z)**2)-((b.x-p.x)**2+(b.z-p.z)**2)).slice(0,HEALTH_BARS.maxEnemyBars);
  for(const enemy of nearby){
   this.update(enemy.uid,'enemy',enemy.x,enemy.z,ground(enemy.x,enemy.z),1.65*enemy.size*this.headroom(enemy.speciesId),
    Math.min(3.4,1.45+enemy.size*.25),enemy.hp,enemy.maxHp,dt);found.add(enemy.uid);
  }
  for(const [uid,bar] of this.bars)if(!found.has(uid)){this.remove(bar);this.bars.delete(uid);}
 }
 private update(uid:number,kind:BarKind,x:number,z:number,y:number,size:number,width:number,hp:number,maxHp:number,dt:number){
  const ratio=maxHp>0?Math.max(0,Math.min(1,hp/maxHp)):0;let bar=this.bars.get(uid);
  if(!bar){
   const root=new TransformNode(`health-bar-${uid}`,this.scene);root.billboardMode=TransformNode.BILLBOARDMODE_ALL;
   const track=this.trackSource.createInstance(`health-track-${uid}`);
   const fill=(kind==='player'?this.playerSource:this.enemySource).createInstance(`health-fill-${uid}`);
   track.parent=root;fill.parent=root;track.isPickable=false;fill.isPickable=false;
   fill.position.z=-.02;
   bar={root,track,fill,kind,ratio,displayedRatio:ratio,width};this.bars.set(uid,bar);
  }
  bar.ratio=ratio;bar.width=width;
  const blend=this.reducedMotion?1:1-Math.exp(-HEALTH_BARS.smoothing*Math.max(0,dt));
  bar.displayedRatio+= (ratio-bar.displayedRatio)*blend;
  if(Math.abs(ratio-bar.displayedRatio)<.0001)bar.displayedRatio=ratio;
  const height=kind==='player'?.20:.17,insideWidth=width-.08,fillWidth=insideWidth*bar.displayedRatio;
  bar.track.scaling.set(width,height,1);bar.fill.scaling.set(Math.max(.0001,fillWidth),height-.065,1);
  bar.fill.position.x=(fillWidth-insideWidth)/2;bar.fill.setEnabled(bar.displayedRatio>0);
  const above=size+.3;bar.root.position.set(x+this.up.x*above,y+this.up.y*above,z+this.up.z*above);
 }
 /** Read-only diagnostics for browser checks and visual tuning. */
 inspect(){return [...this.bars].map(([uid,b])=>({uid,kind:b.kind,ratio:b.ratio,displayedRatio:b.displayedRatio,
  visible:b.root.isEnabled(),x:b.root.position.x,y:b.root.position.y,z:b.root.position.z,width:b.width}));}
 private remove(bar:Bar){bar.root.dispose();}
 dispose(){
  for(const bar of this.bars.values())this.remove(bar);this.bars.clear();
  this.trackSource.dispose();this.playerSource.dispose();this.enemySource.dispose();
  for(const material of this.materials)material.dispose();this.materials=[];
 }
}
