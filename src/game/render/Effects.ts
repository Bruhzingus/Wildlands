import {Scene,MeshBuilder,Mesh,type InstancedMesh,StandardMaterial,Color3} from '@babylonjs/core';
import {ELEMENT_COLORS} from '../../data/kanto.ts';
import {Vector3,Color4} from '@babylonjs/core';
import {COMBAT_VISUALS,DESIGN} from '../../data/config.ts';
import type {RunState} from '../types.ts';
import type {GameEvent} from '../Simulation.ts';
import type {World} from './World.ts';
import {ThreatIndicators} from './ThreatIndicators.ts';

type Shape='orb'|'needle'|'beam'|'lob'|'ring'|'slash'|'dust'|'cone'|'zone'|'column'|'shield'|'wave'|'cloud'|'dart'|'leaf'|'spark'|'egg';
interface Visual{mesh:InstancedMesh;key:string;tint?:Color4;}
interface Fx{visual:Visual;life:number;max:number;sx:number;sy:number;sz:number;grow:number;rise:number;fixed?:boolean;alpha?:number;travel?:{x:number;z:number;toX:number;toZ:number;startRadius?:number;endRadius?:number};sweep?:{x:number;z:number;facing:number;radius:number};}
interface Wave{mesh:Mesh;paths:Vector3[][];}
type VisualEvent=GameEvent&{toX?:number;toZ?:number;duration?:number;radius?:number;endRadius?:number;shape?:string;facing?:number;angle?:number;};

/** Bounded shared geometry and recycled instances; simulation owns damage and tells. */
export class Effects{
 private scene:Scene;private world:Pick<World,'height'>;
 private projectiles=new Map<number,Visual>();private projectileAccents=new Map<number,Visual>();private drops=new Map<number,Visual>();private waves=new Map<number,Wave>();private effects:Fx[]=[];
 private indicators:ThreatIndicators;
 private materials=new Map<string,StandardMaterial>();private prototypes=new Map<string,Mesh>();
 private free=new Map<string,Visual[]>();private freeWaves:Wave[]=[];private allocated=new Set<InstancedMesh|Mesh>();
 private previousPosition:{x:number;z:number}|null=null;private lastDodge=false;private stepDistance=0;
 private state:RunState|null=null;private reducedMotion:boolean;
 private density=1;private cosmeticSequence=0;
 constructor(scene:Scene,world:Pick<World,'height'>,reducedMotion=typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){this.scene=scene;this.world=world;this.reducedMotion=reducedMotion;this.indicators=new ThreatIndicators(scene,(x,z)=>world.height(x,z));}
 setPresentation(density:number,reducedMotion:boolean){this.density=Math.max(.15,Math.min(1,density));this.reducedMotion=reducedMotion;}
 private material(color:string,fading=false){
  const key=fading?`${color}/fade`:color;let material=this.materials.get(key);if(material)return material;
  material=new StandardMaterial(`combat-${key}`,this.scene);material.diffuseColor=Color3.FromHexString(color);
  material.emissiveColor=material.diffuseColor.clone();material.disableLighting=true;material.specularColor=Color3.Black();
  if(fading){material.transparencyMode=StandardMaterial.MATERIAL_ALPHABLEND;material.disableDepthWrite=true;}
  this.materials.set(key,material);return material;
 }
 private visualKey(shape:Shape,color:string,angle=Math.PI/2){return `${shape}/${color}${shape==='cone'?`/${angle.toFixed(3)}`:''}`;}
 private source(shape:Shape,color:string,angle=Math.PI/2){
  const key=this.visualKey(shape,color,angle);let mesh=this.prototypes.get(key);if(mesh)return mesh;
  const fading=['slash','cone','zone','column','shield','ring','wave','cloud'].includes(shape),material=this.material(color,fading);
  if(shape==='slash'){
   // One tapered arc in front of the actor; shared by every pooled slash instance.
   const paths=[-1,1].map(side=>Array.from({length:17},(_,i)=>{
    const progress=i/16,angle=(progress-.5)*1.7,width=.018+Math.sin(progress*Math.PI)*.32,radius=1+side*width/2;
    return new Vector3(Math.sin(angle)*radius,0,Math.cos(angle)*radius);
   }));
   mesh=MeshBuilder.CreateRibbon(`combat-source-${key}`,{pathArray:paths,sideOrientation:Mesh.DOUBLESIDE},this.scene);
  }
  else if(shape==='cone'){
   const paths=[0,1].map(radius=>Array.from({length:25},(_,i)=>{
    const facing=(i/24-.5)*angle;return new Vector3(Math.sin(facing)*radius,0,Math.cos(facing)*radius);
   }));
   mesh=MeshBuilder.CreateRibbon(`combat-source-${key}`,{pathArray:paths,sideOrientation:Mesh.DOUBLESIDE},this.scene);
  }
  else if(shape==='wave'){
   const paths=[0,1].map(edge=>Array.from({length:17},(_,i)=>{
    const x=i/8-1,crest=1-x*x;return new Vector3(x,edge*(.45+crest*.35),crest*.3);
   }));
   mesh=MeshBuilder.CreateRibbon(`combat-source-${key}`,{pathArray:paths,sideOrientation:Mesh.DOUBLESIDE},this.scene);
  }
  else if(shape==='ring')mesh=MeshBuilder.CreateTorus(`combat-source-${key}`,{diameter:2,thickness:.045,tessellation:32},this.scene);
  else if(shape==='zone'||shape==='column')mesh=MeshBuilder.CreateCylinder(`combat-source-${key}`,{diameter:2,height:1,tessellation:24},this.scene);
  else if(shape==='shield')mesh=MeshBuilder.CreateSphere(`combat-source-${key}`,{diameter:2,segments:12,slice:.5,sideOrientation:Mesh.DOUBLESIDE},this.scene);
  else if(shape==='dart'){
   mesh=MeshBuilder.CreateCylinder(`combat-source-${key}`,{height:2,diameterTop:0,diameterBottom:.8,tessellation:5},this.scene);
   mesh.rotation.x=Math.PI/2;mesh.bakeCurrentTransformIntoVertices();mesh.rotation.setAll(0);
  }
  else if(shape==='leaf'||shape==='spark'){
   mesh=MeshBuilder.CreateIcoSphere(`combat-source-${key}`,{radius:1,subdivisions:0},this.scene);
   mesh.scaling.set(shape==='leaf'?.65:.45,.2,1.4);mesh.bakeCurrentTransformIntoVertices();mesh.scaling.setAll(1);
  }
  else if(shape==='egg')mesh=MeshBuilder.CreateSphere(`combat-source-${key}`,{diameter:2,segments:8},this.scene);
  else if(shape==='beam'||shape==='needle')mesh=MeshBuilder.CreateBox(`combat-source-${key}`,{width:1,height:1,depth:1},this.scene);
  else if(shape==='cloud')mesh=MeshBuilder.CreateSphere(`combat-source-${key}`,{diameter:2,segments:8},this.scene);
  else mesh=MeshBuilder.CreateIcoSphere(`combat-source-${key}`,{radius:1,subdivisions:shape==='orb'?1:0},this.scene);
  if(fading){mesh.registerInstancedBuffer('instanceColor',4);mesh.instancedBuffers.instanceColor=new Color4(1,1,1,1);}
  mesh.material=material;mesh.isVisible=false;mesh.isPickable=false;this.prototypes.set(key,mesh);return mesh;
 }
 private reserve(){
  if(this.allocated.size<COMBAT_VISUALS.maxPoolInstances-COMBAT_VISUALS.maxWindups*3)return true;
  for(const candidates of this.free.values())if(candidates.length){const old=candidates.pop()!;old.mesh.dispose();this.allocated.delete(old.mesh);return true;}
  return false;
 }
 private acquire(shape:Shape,color:string,name:string,angle?:number):Visual|undefined{
  const key=this.visualKey(shape,color,angle),pool=this.free.get(key);let visual=pool?.pop();
  if(!visual){
   if(!this.reserve())return;
   const mesh=this.source(shape,color,angle).createInstance(name);this.allocated.add(mesh);visual={mesh,key};
  }
  const mesh=visual.mesh;mesh.name=name;mesh.setEnabled(true);mesh.isVisible=true;mesh.isPickable=false;
  if(mesh.sourceMesh.instancedBuffers?.instanceColor){visual.tint??=new Color4(1,1,1,.8);visual.tint.a=.8;mesh.instancedBuffers.instanceColor=visual.tint;}
  mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.billboardMode=0;mesh.scaling.set(1,1,1);return visual;
 }
 private release(visual:Visual){
  visual.mesh.isVisible=false;visual.mesh.setEnabled(false);
  const pool=this.free.get(visual.key)??[];
  if(pool.length>=COMBAT_VISUALS.maxPoolPerKind){visual.mesh.dispose();this.allocated.delete(visual.mesh);return;}
  pool.push(visual);this.free.set(visual.key,pool);
 }
 private transient(visual:Visual|undefined,duration:number,grow=0,rise=0){
  if(!visual)return;
  if(this.effects.length>=COMBAT_VISUALS.maxEffects){this.release(visual);return;}
  const scale=visual.mesh.scaling;
  this.effects.push({visual,life:duration,max:duration,sx:scale.x,sy:scale.y,sz:scale.z,grow,rise});
 }
 private coverage(visual:Visual|undefined,duration:number,alpha=.3){
  if(!visual)return;
  if(this.effects.length>=COMBAT_VISUALS.maxEffects){this.release(visual);return;}
  if(visual.tint)visual.tint.a=alpha;
  const scale=visual.mesh.scaling;
  const effect:Fx={visual,life:duration,max:duration,sx:scale.x,sy:scale.y,sz:scale.z,grow:0,rise:0,fixed:true,alpha};this.effects.push(effect);return effect;
 }
 private line(visual:Visual,x:number,z:number,toX:number,toZ:number,width:number,height=1.2){
  const dx=toX-x,dz=toZ-z;
  visual.mesh.position.set((x+toX)/2,this.world.height((x+toX)/2,(z+toZ)/2)+height,(z+toZ)/2);
  visual.mesh.rotation.y=Math.atan2(dx,dz);visual.mesh.scaling.set(width,width,Math.max(.04,Math.hypot(dx,dz)));
 }
 private slashFacing(event:VisualEvent){
  if(event.facing!==undefined)return event.facing;
  if(event.toX!==undefined&&event.toZ!==undefined)return Math.atan2(event.toX-event.x!,event.toZ-event.z!);
  const source=this.state?.party.find(actor=>actor.uid===event.sourceId)??this.state?.enemies.find(actor=>actor.uid===event.sourceId);
  if(source)return source.facing;
  const target=this.state?.enemies.find(actor=>actor.uid===event.targetId);
  return target?Math.atan2(target.x-event.x!,target.z-event.z!):this.state?.player.facing??0;
 }
 onEvent(event:VisualEvent){
  if(event.kind==='cast'||event.kind==='jump')return;
  if(event.kind==='dash')event={...event,kind:'attack'};
  if(event.x===undefined||event.z===undefined||this.effects.length>=COMBAT_VISUALS.maxEffects)return;
  if(event.kind==='hit'&&this.effects.length>=Math.ceil(COMBAT_VISUALS.maxEffects*this.density))return;
  // Sample decorative hit puffs only; projectiles, drops, attack shapes and
  // boss telegraphs retain their complete authoritative coverage at every preset.
  if(event.kind==='hit'&&((this.cosmeticSequence++*.61803398875)%1)>this.density)return;
  const kind:string=event.kind;if(kind==='tell'||kind==='status')return;
  const color=event.color??'#e5e8bc';
  const radius=event.radius??(kind==='special'?event.amount??9:kind==='attack'?event.amount??1.2:kind==='interact'?2:kind==='hit'?.16:1);
  const duration=event.duration??COMBAT_VISUALS.areaSeconds;
  if(event.shape==='muzzle'||event.shape==='throw'||event.shape==='psychic-cross'){
   const bead=this.acquire('orb',color,`combat-${kind}-release`);
   if(bead){bead.mesh.position.set(event.x,this.world.height(event.x,event.z)+1.1,event.z);bead.mesh.scaling.setAll(Math.min(.45,radius*.4));this.transient(bead,.16,.8);}
   return;
  }
  if(event.shape==='heal'){
   // A rising cross on the recipient identifies healing without a screen-wide link.
   const x=event.toX??event.x,z=event.toZ??event.z;
   for(let i=0;i<2;i++){
    const cross=this.acquire('beam','#85ffc0',`combat-heal-${i}`);if(!cross)continue;
    cross.mesh.position.set(x,this.world.height(x,z)+1.3,z);cross.mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;
    cross.mesh.scaling.set(i?.16:.65,i?.65:.16,.12);this.transient(cross,.5,0,.9);
   }
   return;
  }
  if(event.shape==='explosion'||event.shape==='burst'||event.shape==='slam'){
   const shell=this.acquire('shield',color,'combat-blast');
   if(shell){shell.mesh.position.set(event.x,this.world.height(event.x,event.z)+.12,event.z);shell.mesh.scaling.set(radius,radius*.4,radius);this.coverage(shell,.18,.4);}
   for(let i=0;i<6;i++){
    const a=i*Math.PI/3,x=event.x+Math.sin(a)*radius*.55,z=event.z+Math.cos(a)*radius*.55;
    const puff=this.acquire('cloud',color,'combat-blast-puff');if(!puff)break;
    puff.mesh.position.set(x,this.world.height(x,z)+.5,z);puff.mesh.scaling.set(radius*.24,radius*.3,radius*.24);this.transient(puff,.36,.5,.5);
   }
   return;
  }
  if(event.shape==='garden'||event.shape==='sleep'||event.shape==='curse'){
   const shape=event.shape,fill=this.acquire('zone',color,`combat-${kind}-${shape}`);
   if(fill){fill.mesh.position.set(event.x,this.world.height(event.x,event.z)+.09,event.z);fill.mesh.scaling.set(radius,.04,radius);this.coverage(fill,duration,shape==='sleep'?.08:.13);}
   if(shape==='garden'){
    for(let i=0;i<4;i++){
     const angle=i*Math.PI/2+.35,x=event.x+Math.sin(angle)*radius*.9,z=event.z+Math.cos(angle)*radius*.9;
     const vine=this.acquire('beam',color,`combat-${kind}-garden-vine`);
     if(vine){this.line(vine,event.x,event.z,x,z,.12,.19);vine.mesh.scaling.y=.08;this.coverage(vine,duration);}
     const thorn=this.acquire('needle',color,`combat-${kind}-garden-thorn`);
     if(thorn){thorn.mesh.position.set(x,this.world.height(x,z)+.43,z);thorn.mesh.rotation.set(.35*Math.sin(angle),0,-.35*Math.cos(angle));thorn.mesh.scaling.set(.11,.75,.11);this.coverage(thorn,duration);}
    }
   }else if(shape==='sleep'){
    for(let i=0;i<5;i++){
     const angle=i*Math.PI*.4,x=event.x+Math.sin(angle)*radius*.45,z=event.z+Math.cos(angle)*radius*.45;
     const cloud=this.acquire('cloud',color,`combat-${kind}-sleep-wisp`);
     if(cloud){cloud.mesh.position.set(x,this.world.height(x,z)+.65+(i%2)*.35,z);cloud.mesh.scaling.set(radius*.53,.48,radius*.4);this.coverage(cloud,duration,.18);}
    }
   }else{
    const edge=this.acquire('ring',color,`combat-${kind}-curse-rune`);
    if(edge){edge.mesh.position.set(event.x,this.world.height(event.x,event.z)+.17,event.z);edge.mesh.scaling.set(radius,1,radius);this.coverage(edge,duration,.8);}
    for(let i=0;i<5;i++){
     const a=i*Math.PI*.4,b=(i+2)*Math.PI*.4,mark=this.acquire('beam',color,`combat-${kind}-curse-sigil`);
     if(mark){this.line(mark,event.x+Math.sin(a)*radius*.83,event.z+Math.cos(a)*radius*.83,event.x+Math.sin(b)*radius*.83,event.z+Math.cos(b)*radius*.83,.075,.2);mark.mesh.scaling.y=.04;this.coverage(mark,duration);}
    }
   }
   return;
  }
  if(event.shape==='zone'||event.shape==='shield'){
   const shape=event.shape,visual=this.acquire(shape,color,`combat-${kind}-${shape}`);
   if(visual){visual.mesh.position.set(event.x,this.world.height(event.x,event.z)+.08,event.z);visual.mesh.scaling.set(radius,shape==='zone'?.045:radius*.65,radius);this.coverage(visual,duration,shape==='zone'?.16:.23);}
   const edge=this.acquire('ring',color,`combat-${kind}-${shape}-edge`);
   if(edge){edge.mesh.position.set(event.x,this.world.height(event.x,event.z)+.13,event.z);edge.mesh.scaling.set(radius,1,radius);this.coverage(edge,duration,.75);}
   return;
  }
  if(event.shape==='column'){
   const column=this.acquire('column',color,`combat-${kind}-column`);
   if(column){column.mesh.position.set(event.x,this.world.height(event.x,event.z)+2.6,event.z);column.mesh.scaling.set(Math.max(.12,radius*.24),5.2,Math.max(.12,radius*.24));this.coverage(column,duration,.6);}
   const edge=this.acquire('ring',color,`combat-${kind}-strike`);
   if(edge){edge.mesh.position.set(event.x,this.world.height(event.x,event.z)+.13,event.z);edge.mesh.scaling.set(radius,1,radius);this.coverage(edge,duration,.8);}
   return;
  }
  if(event.shape==='cone'||event.shape==='gust'){
   const cone=this.acquire('cone',color,`combat-${kind}-${event.shape}`,event.angle??Math.PI*.65);
   if(cone){cone.mesh.position.set(event.x,this.world.height(event.x,event.z)+.2,event.z);cone.mesh.rotation.y=this.slashFacing(event);cone.mesh.scaling.set(radius,1,radius);this.coverage(cone,duration,.28);}
   return;
  }
  if(event.shape==='volley'){
   // Projectiles carry the attack; the cast cue stays compact at the actor.
   for(let i=0;i<3;i++){
    const spark=this.acquire('needle',color,`combat-${kind}-cast`);if(!spark)break;
    spark.mesh.position.set(event.x+(i-1)*.25,this.world.height(event.x,event.z)+1.25,event.z);spark.mesh.rotation.z=(i-1)*.55;spark.mesh.scaling.set(.07,.4,.07);this.transient(spark,.22,0,.4);
   }
   return;
  }
  if(event.shape==='wave'&&event.toX!==undefined&&event.toZ!==undefined){
   const wave=this.acquire('wave',color,`combat-${kind}-wave`);
   if(wave){
    wave.mesh.position.set(event.x,this.world.height(event.x,event.z)+.18,event.z);wave.mesh.rotation.y=this.slashFacing(event);wave.mesh.scaling.set(radius,1,1);
    const effect=this.coverage(wave,duration,.75);if(effect)effect.travel={x:event.x,z:event.z,toX:event.toX,toZ:event.toZ,startRadius:radius,endRadius:event.endRadius??radius};
   }
   return;
  }
  if(event.toX!==undefined&&event.toZ!==undefined){
   if(event.shape==='pounce'||event.shape==='combo'){
    const arc=this.acquire('slash',color,`combat-${kind}-${event.shape}`);
    if(arc){arc.mesh.position.set(event.x,this.world.height(event.x,event.z)+.8,event.z);arc.mesh.rotation.y=this.slashFacing(event);arc.mesh.scaling.set(radius,1,radius);this.coverage(arc,duration,.8);}return;
   }
   if(event.shape==='vine'||event.shape==='thread'||kind==='chain'){
    const dx=event.toX-event.x,dz=event.toZ-event.z,length=Math.hypot(dx,dz)||1,parts=kind==='chain'?7:9;
    const point=(t:number)=>{
     const bend=kind==='chain'?Math.sin(t*parts*Math.PI/2)*.35:Math.sin(t*Math.PI*2)*Math.sin(t*Math.PI)*.65;
     return {x:event.x!+dx*t-dz/length*bend,z:event.z!+dz*t+dx/length*bend};
    };
    for(let i=0;i<parts;i++){
     const a=point(i/parts),b=point((i+1)/parts),segment=this.acquire('beam',color,`combat-${event.shape}-segment`);if(!segment)break;
     this.line(segment,a.x,a.z,b.x,b.z,event.shape==='vine'?.18*(1-i/parts*.7):.06,1.0);
     this.transient(segment,.18,0);
     if(event.shape==='vine'&&i%3===1){
      const leaf=this.acquire('leaf',color,'combat-vine-leaf');if(leaf){leaf.mesh.position.set(a.x,this.world.height(a.x,a.z)+1.0,a.z);leaf.mesh.rotation.y=Math.atan2(dx,dz)+(i%2?1:-1);leaf.mesh.scaling.setAll(.3);this.transient(leaf,.18);}
     }
    }
    return;
   }
   const broad=event.shape==='sand-wave'||event.shape==='trail'||(event.shape==='beam'||kind==='special')&&(event.radius??0)>.5;
   const line=this.acquire('beam',color,`combat-${kind}-${event.shape??'line'}`);
   if(line){this.line(line,event.x,event.z,event.toX,event.toZ,broad?Math.max(.3,radius*2):kind==='chain'?.065:event.shape==='thread'?.035:.1,broad?.15:1.2);if(broad)line.mesh.scaling.y=.12;this.coverage(line,event.duration??COMBAT_VISUALS.chainSeconds,.8);}
   return;
  }
  const shape:Shape=event.shape==='slash'?'slash':kind==='hit'?'orb':'ring';
  const visual=this.acquire(shape,color,`combat-${kind}`);if(!visual)return;
  if(shape==='slash'){
   const facing=this.slashFacing(event),duration=event.duration??COMBAT_VISUALS.areaSeconds;
   visual.mesh.position.set(event.x,this.world.height(event.x,event.z)+.85,event.z);
   visual.mesh.rotation.y=facing-(this.reducedMotion?0:.5);visual.mesh.scaling.set(radius,1,radius);
   this.effects.push({visual,life:duration,max:duration,sx:radius,sy:1,sz:radius,grow:0,rise:0,sweep:{x:event.x,z:event.z,facing,radius}});return;
  }
  visual.mesh.position.set(event.x,this.world.height(event.x,event.z)+(kind==='hit'?1.1:.12),event.z);
  // Babylon tori already lie in XZ; keep their vertical thickness independent of range.
  visual.mesh.scaling.set(radius,shape==='ring'?1:radius,radius);
  this.transient(visual,event.duration??(kind==='hit'?COMBAT_VISUALS.hitSeconds:COMBAT_VISUALS.areaSeconds),kind==='hit'?.25:.3,kind==='hit'?.25:0);
 }
 private updateDust(state:RunState,dt:number){
  const p=state.player;
  if(dt>0&&this.previousPosition){
   const distance=Math.hypot(p.x-this.previousPosition.x,p.z-this.previousPosition.z);this.stepDistance+=Math.min(distance,1);
   const dodge=p.dodgeTime>0;
   if(p.y<.08&&((dodge&&!this.lastDodge)||this.stepDistance>.95)){
    this.stepDistance=0;
    for(let i=0;i<Math.ceil((dodge?5:2)*this.density)&&this.effects.length<Math.ceil(COMBAT_VISUALS.maxEffects*this.density);i++){
     const side=i%2?1:-1,back=.15+i*.16,x=p.x-Math.sin(p.facing)*back+Math.cos(p.facing)*side*.25,z=p.z-Math.cos(p.facing)*back-Math.sin(p.facing)*side*.25;
     const visual=this.acquire('dust','#b3b18a','combat-footstep');if(!visual)break;
     visual.mesh.position.set(x,this.world.height(x,z)+.12,z);visual.mesh.scaling.setAll(dodge?.16:.09);this.transient(visual,.28,-.6,.25);
    }
   }
   this.lastDodge=dodge;
  }
  this.previousPosition={x:p.x,z:p.z};
 }
 private updateWaves(state:RunState){
  const active=new Set<number>();
  for(const ring of (state.psychicRings??[]).slice(0,COMBAT_VISUALS.maxBossRings)){
   active.add(ring.uid);let wave=this.waves.get(ring.uid);
   if(!wave){
    wave=this.freeWaves.pop();
    if(!wave){
     if(!this.reserve())continue;
     const paths=[.5,1].map(radius=>Array.from({length:64},(_,i)=>new Vector3(Math.sin(i*Math.PI/32)*radius,0,Math.cos(i*Math.PI/32)*radius)));
     const material=this.material('#dec4e6'),mesh=MeshBuilder.CreateRibbon(`psychic-ring-${ring.uid}`,{pathArray:paths,closePath:true,updatable:true,sideOrientation:Mesh.DOUBLESIDE},this.scene);
     mesh.material=material;mesh.isPickable=false;this.allocated.add(mesh);wave={mesh,paths};
    }
    wave.mesh.name=`psychic-ring-${ring.uid}`;wave.mesh.setEnabled(true);wave.mesh.isVisible=true;this.waves.set(ring.uid,wave);
   }
   // Follow rolling terrain so no damaging part of the wave disappears inside a hill.
   for(let edge=0;edge<2;edge++)for(let i=0;i<64;i++){
    const radius=Math.max(.05,ring.radius+(edge?1:-1)*ring.width/2),angle=i*Math.PI/32;
    const x=ring.x+Math.sin(angle)*radius,z=ring.z+Math.cos(angle)*radius;
    wave.paths[edge][i].set(x,this.world.height(x,z)+.16,z);
   }
   MeshBuilder.CreateRibbon(wave.mesh.name,{pathArray:wave.paths,instance:wave.mesh,closePath:true});
  }
  for(const [uid,wave] of this.waves)if(!active.has(uid)){wave.mesh.isVisible=false;wave.mesh.setEnabled(false);this.freeWaves.push(wave);this.waves.delete(uid);}
 }
 update(state:RunState,dt:number){
  this.state=state;
  this.updateDust(state,dt);this.indicators.update(state);this.updateWaves(state);
  // Threats get the first available instances when a late-game build fills the pool.
  const shots=[...state.projectiles].sort((a,b)=>Number(a.friendly)-Number(b.friendly)).slice(0,DESIGN.maxProjectiles);
  const activeProjectiles=new Set(shots.map(shot=>shot.uid));
  for(const [uid,visual] of this.projectiles)if(!activeProjectiles.has(uid)){this.release(visual);this.projectiles.delete(uid);}
  for(const [uid,visual] of this.projectileAccents)if(!activeProjectiles.has(uid)){this.release(visual);this.projectileAccents.delete(uid);}
  for(const projectile of shots){
   let visual=this.projectiles.get(projectile.uid);
   if(!visual){
    let shape:Shape=projectile.silhouette??(projectile.kind==='beam'?'beam':projectile.kind==='lob'?'lob':projectile.friendly?'needle':'orb');
    if(!projectile.friendly){
     shape=projectile.kind==='lob'?(projectile.moveName==='Egg Bomb'?'egg':'lob'):
      projectile.type==='grass'?'leaf':projectile.type==='electric'?'spark':
      shape==='needle'?'dart':'orb';
    }
    const color=projectile.moveName==='Egg Bomb'?'#fff1c4':ELEMENT_COLORS[projectile.type];
    visual=this.acquire(shape,color,`combat-projectile-${projectile.uid}`);
    if(!visual)continue;this.projectiles.set(projectile.uid,visual);
   }
   const mesh=visual.mesh,shape=visual.key.split('/')[0],progress=projectile.duration?1-projectile.ttl/projectile.duration:0;
   const height=projectile.kind==='lob'?(projectile.duration ? .6+Math.sin(Math.max(0,Math.min(1,progress))*Math.PI)*3 : 1.5):1.2;
   mesh.position.set(projectile.x,this.world.height(projectile.x,projectile.z)+height,projectile.z);
   mesh.rotation.y=Math.atan2(projectile.vx,projectile.vz);
   if(shape==='beam')mesh.scaling.set(projectile.size*.5,projectile.size*.5,Math.max(.8,projectile.size*5));
   else if(shape==='needle')mesh.scaling.set(projectile.size*.55,projectile.size*.35,Math.max(.45,projectile.size*2.8));
   else if(shape==='dart')mesh.scaling.set(projectile.size*1.5,projectile.size*1.5,Math.max(.5,projectile.size*2.4));
   else if(shape==='leaf'||shape==='spark')mesh.scaling.setAll(Math.max(.3,projectile.size));
   else if(shape==='egg')mesh.scaling.set(projectile.size*1.2,projectile.size*1.6,projectile.size*1.2);
   else mesh.scaling.setAll(projectile.size*.85);
   if(!projectile.friendly){
    let accent=this.projectileAccents.get(projectile.uid);
    if(!accent&&this.projectileAccents.size<64){accent=this.acquire('ring','#ff8057',`combat-hostile-rim-${projectile.uid}`);if(accent)this.projectileAccents.set(projectile.uid,accent);}
    if(accent){
     accent.mesh.position.copyFrom(mesh.position);accent.mesh.rotation.set(Math.PI/2,mesh.rotation.y,0);
     const r=Math.max(.28,projectile.size*1.25);accent.mesh.scaling.set(r,2,r);
     if(accent.tint)accent.tint.a=.95;
    }
   }
  }
  const activeDrops=new Set<number>();
  for(const drop of state.drops.slice(0,DESIGN.maxActiveDrops)){
   activeDrops.add(drop.uid);let visual=this.drops.get(drop.uid);
   if(!visual){visual=this.acquire('lob',drop.kind==='xp'?'#9bdef5':'#a8f3a5',`combat-drop-${drop.uid}`);if(!visual)continue;this.drops.set(drop.uid,visual);}
   visual.mesh.position.set(drop.x,this.world.height(drop.x,drop.z)+.36+Math.sin(state.stats.elapsed*4+drop.uid)*.09,drop.z);visual.mesh.scaling.setAll(Math.min(.42,.22+drop.value*.003));
  }
  for(const [uid,visual] of this.drops)if(!activeDrops.has(uid)){this.release(visual);this.drops.delete(uid);}
  for(const fx of this.effects){
   fx.life-=dt;const progress=1-Math.max(0,fx.life/fx.max),scale=Math.max(.03,(1+progress*fx.grow)*(1-progress*.7));
   if(fx.fixed){
    // Gameplay areas keep their true extent for their complete active lifetime.
    if(fx.travel){
     const path=fx.travel,x=path.x+(path.toX-path.x)*progress,z=path.z+(path.toZ-path.z)*progress;fx.visual.mesh.position.set(x,this.world.height(x,z)+.18,z);
     if(path.startRadius!==undefined&&path.endRadius!==undefined)fx.visual.mesh.scaling.x=path.startRadius+(path.endRadius-path.startRadius)*progress;
    }
    if(fx.visual.tint)fx.visual.tint.a=(fx.alpha??.8)*Math.min(1,Math.max(0,fx.life)/Math.min(.25,fx.max));
    continue;
   }
   if(fx.sweep){
    const {x,z,facing,radius}=fx.sweep;
    if(!this.reducedMotion){
     const sweep=1-(1-progress)**2,push=Math.sin(progress*Math.PI)*radius*.08;
     fx.visual.mesh.rotation.y=facing-.5+sweep;
     fx.visual.mesh.position.x=x+Math.sin(facing)*push;fx.visual.mesh.position.z=z+Math.cos(facing)*push;
     fx.visual.mesh.scaling.set(radius*(1-progress*.08),1,radius*(1-progress*.08));
    }
    fx.visual.tint!.a=.8*(1-progress);continue;
   }
   fx.visual.mesh.scaling.set(fx.sx*scale,fx.sy*scale,fx.sz*scale);fx.visual.mesh.position.y+=dt*fx.rise;
   if(fx.visual.tint)fx.visual.tint.a=.8*(1-progress)**2;
  }
  this.effects=this.effects.filter(fx=>{if(fx.life>0)return true;this.release(fx.visual);return false;});
 }
 inspect(){return {projectiles:this.projectiles.size,drops:this.drops.size,effects:this.effects.length,windups:this.indicators.inspect().active,psychicRings:this.waves.size,allocated:this.allocated.size+this.indicators.inspect().allocated,pooled:this.indicators.inspect().pooled+this.freeWaves.length+[...this.free.values()].reduce((sum,pool)=>sum+pool.length,0),prototypes:this.prototypes.size};}
 dispose(){
  for(const mesh of this.allocated)mesh.dispose();for(const mesh of this.prototypes.values())mesh.dispose();for(const material of this.materials.values())material.dispose();
  this.allocated.clear();this.projectiles.clear();this.drops.clear();this.indicators.dispose();this.projectileAccents.clear();this.waves.clear();this.freeWaves=[];this.effects=[];this.prototypes.clear();this.materials.clear();this.free.clear();this.state=null;
 }
}
