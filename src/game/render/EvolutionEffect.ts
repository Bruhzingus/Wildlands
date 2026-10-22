import {Color3,MeshBuilder,Scene,StandardMaterial,TransformNode,type Mesh} from '@babylonjs/core';
import type {PartyMember} from '../types.ts';

/** A short world-space flourish that follows the evolving teammate. */
export class EvolutionEffect {
 private root:TransformNode;
 private rings:Mesh[]=[];
 private sparks:Mesh[]=[];
 private materials:StandardMaterial[]=[];
 private elapsed=0;
 readonly uid:number;

 constructor(scene:Scene,uid:number,fromColor:Color3,toColor:Color3){
  this.uid=uid;this.root=new TransformNode(`evolution-${uid}`,scene);
  for(let i=0;i<2;i++){
   const material=new StandardMaterial(`evolution-ring-${uid}-${i}`,scene);
   material.disableLighting=true;material.emissiveColor=i?toColor:fromColor;material.alpha=.8;material.backFaceCulling=false;
   const ring=MeshBuilder.CreateTorus(`evolution-ring-${uid}-${i}`,{diameter:2.8+i*.35,thickness:.055,tessellation:40},scene);
   ring.material=material;ring.parent=this.root;this.rings.push(ring);this.materials.push(material);
  }
  for(let i=0;i<12;i++){
   const material=new StandardMaterial(`evolution-spark-${uid}-${i}`,scene);
   material.disableLighting=true;material.emissiveColor=i%2?toColor:fromColor;material.alpha=.9;
   const spark=MeshBuilder.CreateSphere(`evolution-spark-${uid}-${i}`,{diameter:.08+i%3*.025,segments:4},scene);
   spark.material=material;spark.parent=this.root;this.sparks.push(spark);this.materials.push(material);
  }
 }

 update(dt:number,member:PartyMember|undefined,ground:(x:number,z:number)=>number){
  if(!member)return;
  this.elapsed+=Math.max(0,dt);
  this.root.position.set(member.x,ground(member.x,member.z)+.12,member.z);
  for(let i=0;i<this.rings.length;i++){
   const phase=(this.elapsed*.95+i*.52)%1;
   this.rings[i].scaling.setAll(.55+phase*1.1);
   this.rings[i].position.y=.05+phase*.55;
   this.materials[i].alpha=(1-phase)*.75;
  }
  for(let i=0;i<this.sparks.length;i++){
   const phase=(this.elapsed*.65+i/12)%1,angle=i*Math.PI*2/12+this.elapsed*(i%2?1:-1)*1.3;
   const radius=.5+phase*.85;
   this.sparks[i].position.set(Math.cos(angle)*radius,.2+phase*2.7,Math.sin(angle)*radius);
   this.materials[i+2].alpha=Math.sin(Math.PI*phase)*.85;
  }
 }

 dispose(){this.root.dispose(false,true);for(const material of this.materials)material.dispose();}
}
