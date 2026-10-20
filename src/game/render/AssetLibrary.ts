import {Scene,Sprite,SpriteManager,Texture,DynamicTexture,Color4,MeshBuilder,StandardMaterial,Color3,Vector3,Axis,Mesh,VertexData,type InstancedMesh} from '@babylonjs/core';
import type {PartyMember,Enemy,Variant} from '../types.ts';
import {getSpecies} from '../../data/kanto.ts';
import {getAttackProfile} from '../../data/attacks.ts';
import {getEnemyAttackProfile,getEliteAreaMove,type EnemyAttackRole} from '../../data/enemyAttacks.ts';
import {ATTACK_ANIMATION,ATTACK_POSES} from '../../data/config.ts';
import {getVariant,VARIANT_VISUALS,type VariantCue} from '../../data/variants.ts';
import {animationFrame,oneShotFrame,attackPose,attackStyle,enemyAttackStyle,parseAnimationMetadata,spriteDirection,validateAtlas,measureAtlas,PMD_SOURCE,ART_SOURCE,type AnimationMetadata,type AnimationMeta,type AnimationName,type AtlasBounds,type AttackStyle,type AttackPose} from './animation.ts';
export type {AnimationName} from './animation.ts';
interface SheetAsset {manager:SpriteManager;meta:AnimationMeta;columns:number;rows:number;bounds:AtlasBounds;source:string;}
interface AnimatedAsset extends SheetAsset {referenceHeight:number;anchors:number[];attackMotion:boolean;}
interface AvatarData {
 x:number;z:number;facing:number;animation:AnimationName;size:number;
 attackTimer?:number;attackDuration?:number;attackStyle?:AttackStyle;enemyRole?:EnemyAttackRole;windup?:Enemy['windup'];
}
const DESIGN_MAX_SPRITES=230;
const MAX_POSE_LEAN=Math.max(...Object.values(ATTACK_POSES).map(p=>Math.abs(p.lean)));
const MAX_POSE_STRETCH=Math.max(...Object.values(ATTACK_POSES).map(p=>Math.max(p.stretch,Math.abs(p.squash))));
/** One request per species and sheet per run, including failures. Local files take
 * priority over the documented remote hosts. Generated artwork is visible immediately. */
export class AssetLibrary {
 private managers=new Map<string,Promise<SheetAsset>>();private meta=new Map<number,Promise<AnimationMetadata>>();
 private manifest:Promise<Set<string>>;private disposed=false;private stop=new AbortController();
 private fallbacks=new Map<number,SpriteManager>();private fallbackSizes=new Map<number,{width:number;height:number;bounds:AtlasBounds}>();
 private shadowTemplate:Mesh|undefined;
 private headrooms=new Map<number,number>();
 private up=Vector3.Up();private right=Vector3.Right();
 private scene:Scene;
 readonly reducedMotion=typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 constructor(scene:Scene) {
  this.scene=scene;
  this.manifest=fetch(`${import.meta.env.BASE_URL}assets/manifest.json`,{signal:AbortSignal.any([this.stop.signal,AbortSignal.timeout(6000)])}).then(r=>r.ok?r.json():[]).then((j:unknown)=>new Set(Array.isArray(j)?j.filter((p):p is string=>typeof p==='string'):[])).catch(()=>new Set<string>());
 }
 private fallbackTexture(id:number):DynamicTexture {
  // A ready canvas texture avoids a race where disposing a still-loading SVG
  // image leaves Babylon's scene permanently waiting for obsolete pending data.
  const texture=new DynamicTexture(`generated-fallback-${id}`,{width:475,height:475},this.scene,false,Texture.BILINEAR_SAMPLINGMODE);
  const ctx=texture.getContext() as unknown as CanvasRenderingContext2D;
  ctx.scale(475/256,475/256);ctx.clearRect(0,0,256,256);
  ctx.fillStyle=['#b0d784','#f4a262','#87b4db','#d5b7e8'][id%4];ctx.strokeStyle='#273d4c';ctx.lineWidth=8;
  ctx.beginPath();ctx.ellipse(128,150,87,75,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#263845';for(const x of [97,160]){ctx.beginPath();ctx.arc(x,131,10,0,Math.PI*2);ctx.fill();}
  ctx.beginPath();ctx.moveTo(110,163);ctx.quadraticCurveTo(130,182,149,163);ctx.lineWidth=6;ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillText(getSpecies(id).name,128,48);ctx.fillText(`#${id}`,128,240);
  texture.update(false);return texture;
 }
 private async urls(id:number,file:string):Promise<string[]> {
  const code=id.toString().padStart(4,'0'),path=`${code}/${file}`,manifest=await this.manifest;
  return [...(manifest.has(path)?[`${import.meta.env.BASE_URL}assets/pmd/${path}`]:[]),`${PMD_SOURCE}/${path}`];
 }
 private metadata(id:number):Promise<AnimationMetadata> {
  if(!this.meta.has(id))this.meta.set(id,(async()=>{
   for(const url of await this.urls(id,'AnimData.xml')) {
    try {
     if(this.disposed)throw Error('Asset library disposed');
     const r=await fetch(url,{signal:AbortSignal.any([this.stop.signal,AbortSignal.timeout(6000)])});
     if(!r.ok)throw Error(`Animation metadata HTTP ${r.status}`);
     return parseAnimationMetadata(await r.text());
    } catch(error) {if(this.disposed)throw error;}
   }
   throw Error(`Animation metadata unavailable for #${id}`);
  })());
  return this.meta.get(id)!;
 }
 private async texture(url:string,sampling:number):Promise<{texture:DynamicTexture;width:number;height:number;pixels:Uint8ClampedArray}> {
  if(this.disposed)throw Error('Asset library disposed');
  const signal=AbortSignal.any([this.stop.signal,AbortSignal.timeout(8000)]);
  const response=await fetch(url,{signal});if(!response.ok)throw Error(`Texture HTTP ${response.status}: ${url}`);
  const bitmap=await createImageBitmap(await response.blob());let texture:DynamicTexture|undefined;
  try {
   if(this.disposed||signal.aborted)throw Error('Texture request canceled');
   texture=new DynamicTexture(url,{width:bitmap.width,height:bitmap.height},this.scene,false,sampling);
   const context=texture.getContext() as unknown as CanvasRenderingContext2D;
   context.drawImage(bitmap,0,0);const pixels=context.getImageData(0,0,bitmap.width,bitmap.height).data;
   texture.update(false);return {texture,width:bitmap.width,height:bitmap.height,pixels};
  }catch(error){texture?.dispose();throw error;}finally{bitmap.close();}
 }
 private sheet(id:number,meta:AnimationMeta):Promise<SheetAsset> {
  const key=`${id}-${meta.name}`;if(!this.managers.has(key))this.managers.set(key,this.load(id,meta));return this.managers.get(key)!;
 }
 private async load(id:number,meta:AnimationMeta):Promise<SheetAsset> {
  for(const source of await this.urls(id,`${meta.name}-Anim.png`)) {
   let texture:Texture|undefined;
   try {
    const decoded=await this.texture(source,Texture.NEAREST_SAMPLINGMODE);texture=decoded.texture;
    if(this.disposed)throw Error('Asset library disposed');
    const {width,height,pixels}=decoded,layout=validateAtlas(meta,width,height),bounds=measureAtlas(meta,width,height,pixels);
    const manager=new SpriteManager(`pmd-${id}-${meta.name}`,'',DESIGN_MAX_SPRITES,{width:meta.width,height:meta.height},this.scene,.01,Texture.NEAREST_SAMPLINGMODE);
    manager.texture=texture;
    return {manager,meta,...layout,bounds,source};
   } catch(error) {texture?.dispose();if(this.disposed)throw error;}
  }
  throw Error(`${meta.name} animation unavailable for #${id}`);
 }
 async get(id:number,anim:AnimationName):Promise<AnimatedAsset> {
  const metadata=await this.metadata(id),referenceMeta=metadata.Idle??metadata.Walk??metadata.Attack;
  const reference=referenceMeta?this.sheet(id,referenceMeta).catch(()=>undefined):Promise.resolve(undefined);
  for(const name of new Set([anim[0].toUpperCase()+anim.slice(1),'Idle','Walk'])) {
   const meta=metadata[name];if(!meta)continue;
   try{
    const sheet=await this.sheet(id,meta),rest=await reference??sheet;
    // Reserve stable head clearance across loaded poses and facings, including
    // attacks that rise above the resting body. Bars must not bounce per frame.
    const stretch=1+MAX_POSE_STRETCH,lean=MAX_POSE_LEAN;
    const clearance=Math.max(...sheet.bounds.tops.map((top,row)=>
     ((meta.height/2+rest.bounds.bottoms[row%rest.bounds.bottoms.length]-top)*stretch+meta.width/2*stretch*Math.sin(lean))/rest.bounds.visibleHeight));
    this.headrooms.set(id,Math.max(1,this.headrooms.get(id)??1,clearance));
    return {...sheet,referenceHeight:rest.bounds.visibleHeight,anchors:rest.bounds.bottoms,attackMotion:meta===metadata.Attack&&meta!==metadata.Idle&&meta!==metadata.Walk};
   }catch(error){if(this.disposed)throw error;}
  }
  throw Error(`No usable animation for #${id}`);
 }
 getFallback(id:number):SpriteManager {
  const existing=this.fallbacks.get(id);if(existing)return existing;
  const m=new SpriteManager(`official-artwork-${id}`,'',DESIGN_MAX_SPRITES,{width:475,height:475},this.scene,.01,Texture.BILINEAR_SAMPLINGMODE);
  m.texture=this.fallbackTexture(id);
  const generated=m.texture as DynamicTexture;
  this.fallbackSizes.set(id,{width:475,height:475,bounds:measureAtlas({name:'artwork',width:475,height:475,durations:[1]},475,475,generated.getContext().getImageData(0,0,475,475).data)});
  this.fallbacks.set(id,m);
  void (async()=>{
   const manifest=await this.manifest;
   const urls=[...(manifest.has(`pokemon/${id}.png`)?[`${import.meta.env.BASE_URL}assets/pokemon/${id}.png`]:[]),`${ART_SOURCE}/${id}.png`];
   for(const url of urls) {
    try {
     const decoded=await this.texture(url,Texture.BILINEAR_SAMPLINGMODE),t=decoded.texture;
     if(this.disposed){t.dispose();return;}
     const {width,height,pixels}=decoded,bounds=measureAtlas({name:'artwork',width,height,durations:[1]},width,height,pixels);
     const previous=m.texture;m.texture=t;m.cellWidth=width;m.cellHeight=height;
     this.fallbackSizes.set(id,{width,height,bounds});previous.dispose();return;
    }catch{if(this.disposed)return;}
   }
  })();
  return m;
 }
 create(speciesId:number,variant:Variant='normal'):Avatar{return new Avatar(this,speciesId,variant);}
 fallbackLayout(id:number){return this.fallbackSizes.get(id)!;}
 headroom(id:number){
  const native=this.headrooms.get(id);if(native!==undefined)return native;
  const fallback=this.fallbackSizes.get(id);
  return 1+MAX_POSE_STRETCH+(fallback?fallback.width/fallback.bounds.visibleHeight/2*Math.sin(MAX_POSE_LEAN):0);
 }
 billboardUp(){this.scene.activeCamera?.getDirectionToRef(Axis.Y,this.up);return this.up;}
 billboardRight(){this.scene.activeCamera?.getDirectionToRef(Axis.X,this.right);return this.right;}
 /** A shared material and low-sided discs avoid allocating a texture per actor. */
 createShadow(name:string,material:StandardMaterial):InstancedMesh {
  if(!this.shadowTemplate){
   this.shadowTemplate=MeshBuilder.CreateDisc('actor-shadow-template',{radius:1,tessellation:12},this.scene);
   this.shadowTemplate.rotation.x=Math.PI/2;this.shadowTemplate.material=material;this.shadowTemplate.isPickable=false;this.shadowTemplate.isVisible=false;
  }
  const mesh=this.shadowTemplate.createInstance(name);mesh.isPickable=false;return mesh;
 }
 createShadowMaterial():StandardMaterial {
  const material=new StandardMaterial('actor-contact-shadows',this.scene);
  material.diffuseColor=new Color3(.08,.1,.07);material.emissiveColor=new Color3(.08,.1,.07);
  material.disableLighting=true;material.alpha=.22;material.backFaceCulling=false;material.disableDepthWrite=true;return material;
 }
 createVariantCues():VariantCues{return new VariantCues(this.scene);}
 createMoveLabels():EnemyMoveLabels{return new EnemyMoveLabels(this.scene);}
 dispose() {
  if(this.disposed)return;this.disposed=true;this.stop.abort();
  for(const m of this.managers.values())void m.then(a=>a.manager.dispose()).catch(()=>{});
  this.managers.clear();this.meta.clear();this.headrooms.clear();for(const m of this.fallbacks.values())m.dispose();this.fallbacks.clear();this.fallbackSizes.clear();this.shadowTemplate?.dispose();this.shadowTemplate=undefined;
 }
 isDisposed(){return this.disposed;}
}
export class Avatar {
 private sprite:Sprite;private current:AnimationName='idle';private time=0;private requestId=0;
 private asset:AnimatedAsset|undefined;private gone=false;private row=0;private frame=0;private attackProgress=0;
 private pose:AttackPose=attackPose(0,'melee');private style:AttackStyle='melee';
 private posePhase:'idle'|'windup'|'attack'='idle';private windupStyle:AttackStyle|undefined;
 private lastData:AvatarData|undefined;private cameraAngle=0;private groundY=0;
 private library:AssetLibrary;private speciesId:number;private variant:Variant;
 constructor(library:AssetLibrary,speciesId:number,variant:Variant) {
  this.library=library;this.speciesId=speciesId;this.variant=variant;
  this.sprite=new Sprite(`pokemon-${speciesId}`,this.library.getFallback(speciesId));this.sprite.width=2.5;this.sprite.height=2.5;
  this.tint();this.requestAnimation('idle');
  // Prepare the short attack sheet while resting, so the first swing can use it.
  void this.library.get(speciesId,'attack').catch(()=>{});
 }
 private tint(){const [r,g,b]=getVariant(this.variant).tint;this.sprite.color=new Color4(r,g,b,1);}
 private requestAnimation(kind:AnimationName) {
  const seq=++this.requestId;void this.library.get(this.speciesId,kind).then(asset=>{
   if(this.gone||this.library.isDisposed()||seq!==this.requestId)return;
   if(this.asset?.manager===asset.manager)return;
   const old=this.sprite;this.sprite=new Sprite(old.name,asset.manager);this.sprite.position.copyFrom(old.position);
   this.sprite.width=old.width;this.sprite.height=old.height;this.sprite.angle=old.angle;old.dispose();
   this.asset=asset;this.tint();
   // A loaded sheet must immediately join the current pose, including while
   // paused. Never expose an atlas with the old artwork dimensions or no cell.
   if(this.lastData)this.update(this.lastData,0,this.cameraAngle,this.groundY);
  }).catch(()=>{/* Retain the last usable animation or visible artwork. Failed promises stay cached. */});
 }
 update(data:AvatarData,dt:number,cameraAngle:number,groundY:number) {
  if(this.gone)return;this.lastData=data;this.cameraAngle=cameraAngle;this.groundY=groundY;
  if(data.animation!==this.current){this.current=data.animation;this.time=0;this.requestAnimation(data.animation);}
  // Attack sheets follow authoritative one-shot progress; only looping idle/walk
  // playback speeds up for more agitated variants.
  this.time+=Math.max(0,dt)*getVariant(this.variant).animationSpeed;const a=this.asset;
  // Simulation owns attack time. A sheet arriving mid-swing joins at that point;
  // it never restarts a finished attack. Gallery previews still loop at source speed.
  this.attackProgress=data.attackTimer===undefined?0:Math.min(1,Math.max(0,1-data.attackTimer/(data.attackDuration??ATTACK_ANIMATION.seconds)));
  const attacking=data.animation==='attack'&&data.attackTimer!==undefined;
  if(!attacking)this.windupStyle=undefined;
  else if(data.windup){
   const role=data.windup.role??data.enemyRole;
   this.windupStyle=data.windup.kind==='enemyMove'&&role?enemyAttackStyle(role):data.windup.kind==='volley'?'ranged':data.windup.kind==='slam'?'heavy':'pulse';
  }
  this.style=this.windupStyle??data.attackStyle??attackStyle(getAttackProfile(this.speciesId).kind);
  this.posePhase=attacking?(data.windup?'windup':'attack'):'idle';
  const windupProgress=data.windup?1-data.windup.remaining/Math.max(.001,data.windup.duration):0;
  // A charged attack starts from the held ready pose. Its native frames still
  // play once from frame zero; only the added body pose skips repeated preparation.
  const releaseProgress=this.windupStyle ? .16+.84*this.attackProgress : this.attackProgress;
  const sample=attackPose(attacking?(data.windup?windupProgress:releaseProgress):0,this.style,!!data.windup);
  const weight=attacking&&!this.library.reducedMotion?(a?.attackMotion?ATTACK_ANIMATION.nativePoseScale:1):0;
  this.pose=weight?{forward:sample.forward*weight,lift:sample.lift*weight,scaleX:1+(sample.scaleX-1)*weight,scaleY:1+(sample.scaleY-1)*weight,lean:sample.lean*weight}:attackPose(0,this.style);
  this.row=a?.rows===1?0:spriteDirection(data.facing,cameraAngle);
  this.frame=a?attacking&&a.attackMotion?(data.windup?0:oneShotFrame(a.meta.durations,this.attackProgress)):animationFrame(a.meta.durations,this.time):0;
  this.sprite.cellIndex=a?this.row*a.columns+this.frame:0;
  const fallback=this.library.fallbackLayout(this.speciesId),referenceHeight=a?.referenceHeight??fallback.bounds.visibleHeight;
  this.sprite.width=data.size*(a?a.meta.width:fallback.width)/referenceHeight*this.pose.scaleX;
  this.sprite.height=data.size*(a?a.meta.height:fallback.height)/referenceHeight*this.pose.scaleY;
  const anchor=(a?.anchors[this.row%a.anchors.length]??fallback.bounds.bottoms[0])*data.size/referenceHeight*this.pose.scaleY;
  const up=this.library.billboardUp(),right=this.library.billboardRight(),fx=Math.sin(data.facing),fz=Math.cos(data.facing);
  this.sprite.angle=this.pose.lean===0?0:-this.pose.lean*(fx*right.x+fz*right.z);
  // Rotate and scale around the resting feet rather than the padded cell center.
  const anchorY=anchor*Math.cos(this.sprite.angle),anchorX=-anchor*Math.sin(this.sprite.angle);
  this.sprite.position.set(data.x+up.x*anchorY+right.x*anchorX+fx*this.pose.forward,
   groundY+up.y*anchorY+right.y*anchorX+this.pose.lift,data.z+up.z*anchorY+right.z*anchorX+fz*this.pose.forward);
 }
 /** Read-only diagnostics for the asset gallery and browser regression checks. */
 inspect(){return {speciesId:this.speciesId,variant:this.variant,requested:this.current,resolved:this.asset?.meta.name??'artwork',row:this.row,frame:this.frame,cellIndex:this.sprite.cellIndex,visible:!this.gone&&this.sprite.isVisible,width:this.sprite.width,height:this.sprite.height,source:this.asset?.source??'artwork/generated',durations:this.asset?.meta.durations??[],attackProgress:this.current==='attack'?this.attackProgress:null,attackStyle:this.style,posePhase:this.posePhase,pose:{...this.pose},angle:this.sprite.angle,position:{x:this.sprite.position.x,y:this.sprite.position.y,z:this.sprite.position.z}};}
 dispose(){this.gone=true;this.requestId++;this.sprite.dispose();}
}
const CUE_STROKES:Record<Exclude<VariantCue,'none'>,number[][]>={
 diamond:[[0,.36,.29,0,0,-.36,-.29,0,0,.36]],
 r:[[-.22,-.35,-.22,.35,.14,.35,.26,.22,.14,.05,-.22,.05],[-.04,.05,.28,-.35]],
 chevrons:[[-.33,.29,-.09,0,-.33,-.29],[.02,.29,.26,0,.02,-.29]],
 droplets:[[-.17,.33,-.35,.02,-.32,-.15,-.17,-.23,-.02,-.15,.01,.02,-.17,.33],[.22,.14,.09,-.08,.12,-.23,.23,-.29,.34,-.23,.36,-.08,.22,.14]],
 crown:[[-.36,-.27,-.42,.26,-.15,.02,0,.36,.15,.02,.42,.26,.36,-.27,-.36,-.27]],
};
/** Five shared glyphs replace per-enemy labels/textures. Nearby faction markers
 * share geometry/material and recycle their instances across successive waves. */
export class VariantCues {
 private scene:Scene;private sources=new Map<VariantCue,Mesh>();private material:StandardMaterial;
 private active=new Map<number,{variant:Variant;mesh:InstancedMesh}>();private free=new Map<VariantCue,InstancedMesh[]>();
 private up=Vector3.Up();private right=Vector3.Right();private allocated=0;
 readonly maxVisible=VARIANT_VISUALS.maxVisible;readonly maxPooledPerKind=VARIANT_VISUALS.maxPooledPerKind;readonly range=VARIANT_VISUALS.range;
 constructor(scene:Scene){
  this.scene=scene;this.material=new StandardMaterial('variant-markers',scene);
  this.material.diffuseColor=Color3.White();this.material.emissiveColor=Color3.White();this.material.specularColor=Color3.Black();
  this.material.disableLighting=true;this.material.backFaceCulling=false;this.material.zOffset=-3;
 }
 private source(cue:Exclude<VariantCue,'none'>):Mesh{
  let source=this.sources.get(cue);if(source)return source;
  const positions:number[]=[],indices:number[]=[],colors:number[]=[];
  for(const [width,color,z] of [[.115,[.10,.13,.11],.002],[.06,[.94,.91,.78],0]] as const){
   for(const points of CUE_STROKES[cue])for(let i=0;i<points.length-2;i+=2){
    const ax=points[i],ay=points[i+1],bx=points[i+2],by=points[i+3],length=Math.hypot(bx-ax,by-ay),nx=-(by-ay)/length*width/2,ny=(bx-ax)/length*width/2,index=positions.length/3;
    positions.push(ax+nx,ay+ny,z,ax-nx,ay-ny,z,bx-nx,by-ny,z,bx+nx,by+ny,z);indices.push(index,index+1,index+2,index,index+2,index+3);
    for(let v=0;v<4;v++)colors.push(...color,1);
   }
  }
  source=new Mesh(`variant-cue-source-${cue}`,this.scene);const vertexData=new VertexData();vertexData.positions=positions;vertexData.indices=indices;vertexData.colors=colors;vertexData.applyToMesh(source);
  source.material=this.material;source.isVisible=false;source.isPickable=false;this.sources.set(cue,source);return source;
 }
 private release(uid:number){
  const actor=this.active.get(uid);if(!actor)return;const cue=getVariant(actor.variant).cue,pool=this.free.get(cue)??[];
  actor.mesh.setEnabled(false);if(pool.length<this.maxPooledPerKind){pool.push(actor.mesh);this.free.set(cue,pool);}else{actor.mesh.dispose();this.allocated--;}
  this.active.delete(uid);
 }
 sync(enemies:Enemy[],origin:{x:number;z:number},ground:(x:number,z:number)=>number,headroom:(speciesId:number)=>number=()=>1){
  this.scene.activeCamera?.getDirectionToRef(Axis.Y,this.up);this.scene.activeCamera?.getDirectionToRef(Axis.X,this.right);
  const nearby=enemies.filter(enemy=>!enemy.dead&&enemy.hp>0&&getVariant(enemy.variant).cue!=='none'&&(enemy.x-origin.x)**2+(enemy.z-origin.z)**2<=this.range**2)
   .sort((a,b)=>(a.x-origin.x)**2+(a.z-origin.z)**2-((b.x-origin.x)**2+(b.z-origin.z)**2)).slice(0,this.maxVisible),found=new Set(nearby.map(enemy=>enemy.uid));
  // Release first, so replacements can reuse slots from defeated/remote actors.
  const variants=new Map(nearby.map(enemy=>[enemy.uid,enemy.variant]));
  for(const [uid,actor] of this.active)if(!found.has(uid)||variants.get(uid)!==actor.variant)this.release(uid);
  for(const enemy of nearby){
   const cue=getVariant(enemy.variant).cue;if(cue==='none')continue;let actor=this.active.get(enemy.uid);
   if(!actor){const pool=this.free.get(cue),mesh=pool?.pop()??this.source(cue).createInstance(`variant-cue-${cue}-${this.allocated++}`);
    mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;mesh.isPickable=false;mesh.setEnabled(true);actor={variant:enemy.variant,mesh};this.active.set(enemy.uid,actor);}
   const size=1.65*enemy.size,above=size*headroom(enemy.speciesId)+VARIANT_VISUALS.headGap,barWidth=Math.min(3.4,1.45+enemy.size*.25),side=-barWidth/2-VARIANT_VISUALS.sideGap;
   actor.mesh.scaling.setAll(enemy.isBoss?VARIANT_VISUALS.bossSize:VARIANT_VISUALS.size);
   actor.mesh.position.set(enemy.x+this.up.x*above+this.right.x*side,ground(enemy.x,enemy.z)+this.up.y*above+this.right.y*side,enemy.z+this.up.z*above+this.right.z*side);
  }
 }
 inspect(){return {active:[...this.active].map(([uid,actor])=>({uid,variant:actor.variant,cue:getVariant(actor.variant).cue,visible:actor.mesh.isEnabled(),x:actor.mesh.position.x,y:actor.mesh.position.y,z:actor.mesh.position.z})),allocated:this.allocated,pooled:[...this.free.values()].reduce((sum,pool)=>sum+pool.length,0),sources:this.sources.size};}
 dispose(){for(const actor of this.active.values())actor.mesh.dispose();this.active.clear();for(const pool of this.free.values())for(const mesh of pool)mesh.dispose();this.free.clear();for(const source of this.sources.values())source.dispose();this.sources.clear();this.material.dispose();this.allocated=0;}
}
const BOSS_MOVE_NAMES={volley:'Psystrike',psychicRing:'Psychic',summon:'Teleport',slam:'Earthquake'} as const;
/** One shared text atlas and at most sixteen sprites identify the move being
 * charged. No canvas, texture or mesh is allocated per enemy or per attack. */
class EnemyMoveLabels {
 private manager:SpriteManager|undefined;private cells=new Map<string,number>();
 private active=new Map<number,{sprite:Sprite;moveName:string}>();private free:Sprite[]=[];
 private up=Vector3.Up();private scene:Scene;
 readonly range=34;readonly maxVisible=16;
 constructor(scene:Scene){this.scene=scene;}
 private atlas():SpriteManager {
  if(this.manager)return this.manager;
  const moves=new Map<string,string>();
  for(let id=1;id<=151;id++){const profile=getEnemyAttackProfile(id),elite=getEliteAreaMove(id);moves.set(profile.moveName,profile.color);moves.set(elite.moveName,elite.color);}
  for(const name of Object.values(BOSS_MOVE_NAMES))moves.set(name,'#e2c7ff');
  const rows=2**Math.ceil(Math.log2(Math.max(1,Math.ceil(moves.size/4)))),width=1024,height=rows*64;
  const texture=new DynamicTexture('enemy-move-name-atlas',{width,height},this.scene,false,Texture.BILINEAR_SAMPLINGMODE);
  const ctx=texture.getContext() as unknown as CanvasRenderingContext2D;ctx.clearRect(0,0,width,height);
  ctx.font='bold 25px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  let cell=0;
  for(const [name,color] of moves){
   const x=cell%4*256,y=Math.floor(cell/4)*64;this.cells.set(name,cell++);
   ctx.fillStyle='rgba(18,25,29,.88)';ctx.fillRect(x+3,y+8,250,48);
   ctx.fillStyle=color;ctx.fillRect(x+3,y+52,250,4);ctx.fillStyle='#ffffff';ctx.fillText(name,x+128,y+31,236);
  }
  texture.update(false);
  this.manager=new SpriteManager('enemy-move-labels','',this.maxVisible,{width:256,height:64},this.scene,.001,Texture.BILINEAR_SAMPLINGMODE);
  this.manager.texture=texture;this.manager.renderingGroupId=2;return this.manager;
 }
 sync(enemies:Enemy[],origin:{x:number;z:number},ground:(x:number,z:number)=>number,headroom:(speciesId:number)=>number){
  this.scene.activeCamera?.getDirectionToRef(Axis.Y,this.up);
  const nearby=enemies.filter(enemy=>!enemy.dead&&enemy.hp>0&&enemy.windup&&enemy.windup.remaining>0&&(enemy.x-origin.x)**2+(enemy.z-origin.z)**2<=this.range**2)
   .sort((a,b)=>Number(b.isBoss)-Number(a.isBoss)||(a.x-origin.x)**2+(a.z-origin.z)**2-((b.x-origin.x)**2+(b.z-origin.z)**2)).slice(0,this.maxVisible);
  const found=new Set(nearby.map(enemy=>enemy.uid));
  for(const [uid,entry] of this.active)if(!found.has(uid)){entry.sprite.isVisible=false;this.free.push(entry.sprite);this.active.delete(uid);}
  for(const enemy of nearby){
   const windup=enemy.windup!,name=windup.moveName??(windup.kind==='enemyMove'?getEnemyAttackProfile(enemy.speciesId).moveName:BOSS_MOVE_NAMES[windup.kind]);
   const manager=this.atlas(),cell=this.cells.get(name)??this.cells.get(getEnemyAttackProfile(enemy.speciesId).moveName)!;
   let entry=this.active.get(enemy.uid);
   if(!entry){entry={sprite:this.free.pop()??new Sprite(`enemy-move-${enemy.uid}`,manager),moveName:name};this.active.set(enemy.uid,entry);}
   entry.moveName=name;entry.sprite.cellIndex=cell;entry.sprite.isVisible=true;
   entry.sprite.width=enemy.isBoss?3.8:2.6;entry.sprite.height=entry.sprite.width/4;
   // Some native sheets include effects far above the body. A move label belongs
   // to the Pokémon, rather than to the highest pixel of that entire animation.
   const above=enemy.size*1.65*Math.min(1.05,headroom(enemy.speciesId))+.25;
   entry.sprite.position.set(enemy.x+this.up.x*above,ground(enemy.x,enemy.z)+this.up.y*above,enemy.z+this.up.z*above);
  }
 }
 inspect(){return {active:[...this.active].map(([uid,entry])=>({uid,moveName:entry.moveName,visible:entry.sprite.isVisible})),allocated:this.active.size+this.free.length,atlases:this.manager?1:0};}
 dispose(){for(const entry of this.active.values())entry.sprite.dispose();for(const sprite of this.free)sprite.dispose();this.active.clear();this.free=[];this.manager?.dispose();this.manager=undefined;this.cells.clear();}
}
export class CharacterVisuals {
 private actors=new Map<number,{avatar:Avatar;speciesId:number;variant:Variant;shadow:InstancedMesh}>();private shadowMaterial:StandardMaterial;
 private assets:AssetLibrary;private cues:VariantCues;private moveLabels:EnemyMoveLabels;
 constructor(assets:AssetLibrary){this.assets=assets;this.shadowMaterial=assets.createShadowMaterial();this.cues=assets.createVariantCues();this.moveLabels=assets.createMoveLabels();}
 sync(party:PartyMember[],enemies:Enemy[],dt:number,cameraAngle:number,ground:(x:number,z:number)=>number,playerHeight=0) {
  const leader=party[0];if(!leader)return;const found=new Set<number>();
  for(const actor of party) {
   found.add(actor.uid);const sp=getSpecies(actor.speciesId);let v=this.actors.get(actor.uid);
   if(v&&v.speciesId!==actor.speciesId){v.avatar.dispose();v.shadow.dispose();this.actors.delete(actor.uid);v=undefined;}
   if(!v){v={avatar:this.assets.create(actor.speciesId),speciesId:actor.speciesId,variant:'normal',shadow:this.assets.createShadow(`shadow-${actor.uid}`,this.shadowMaterial)};this.actors.set(actor.uid,v);}
   const y=ground(actor.x,actor.z),size=actor.uid===leader.uid?2.8+sp.stage*.18:2.35+sp.stage*.18;
   v.avatar.update({...actor,size},dt,cameraAngle,y+(actor===leader?playerHeight:0));
   v.shadow.position.set(actor.x,y+.045,actor.z);v.shadow.scaling.set(size*.27,size*.18,1);
  }
  for(const enemy of enemies) {
   found.add(enemy.uid);let v=this.actors.get(enemy.uid);
   if(v&&(v.speciesId!==enemy.speciesId||v.variant!==enemy.variant)){v.avatar.dispose();v.shadow.dispose();this.actors.delete(enemy.uid);v=undefined;}
   if(!v){v={avatar:this.assets.create(enemy.speciesId,enemy.variant),speciesId:enemy.speciesId,variant:enemy.variant,shadow:this.assets.createShadow(`shadow-${enemy.uid}`,this.shadowMaterial)};this.actors.set(enemy.uid,v);}
   const size=1.65*enemy.size,y=ground(enemy.x,enemy.z);
   const role=getEnemyAttackProfile(enemy.speciesId).role;
   v.avatar.update({...enemy,size,enemyRole:role,attackStyle:enemy.isBoss?'ranged':enemyAttackStyle(role)},dt,cameraAngle,y);
   v.shadow.position.set(enemy.x,y+.045,enemy.z);v.shadow.scaling.set(size*.27,size*.18,1);
  }
  for(const [uid,v] of this.actors)if(!found.has(uid)){v.avatar.dispose();v.shadow.dispose();this.actors.delete(uid);}
  this.cues.sync(enemies,leader,ground,id=>this.assets.headroom(id));
  this.moveLabels.sync(enemies,leader,ground,id=>this.assets.headroom(id));
 }
 inspect(){return [...this.actors].map(([uid,actor])=>({uid,...actor.avatar.inspect()}));}
 inspectCues(){return this.cues.inspect();}
 inspectMoveLabels(){return this.moveLabels.inspect();}
 dispose(){for(const v of this.actors.values()){v.avatar.dispose();v.shadow.dispose();}this.actors.clear();this.cues.dispose();this.moveLabels.dispose();this.shadowMaterial.dispose();}
}
