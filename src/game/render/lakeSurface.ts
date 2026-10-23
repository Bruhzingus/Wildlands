import {Color3,MaterialPluginBase,Mesh,StandardMaterial,UniformBuffer,VertexData} from '@babylonjs/core';
import type {AtmosphereSample} from './atmosphere.ts';

/** Restyle the existing XY disc without changing its transform or shoreline.
 * Use an unlit, opaque material with white emissive color: the baked colors
 * supply the depth wash; LakeSurface adds wavelets in the same opaque draw. */
export function styleLakeSurface(mesh:Mesh,radius:number,tint:string){
 const sides=64,rings=[.2,.4,.6,.76,.86,.92,.96,1],positions:number[]=[],indices:number[]=[],normals:number[]=[],colors:number[]=[],uvs:number[]=[];
 const base=Color3.FromHexString(tint),deep=base.multiply(new Color3(.62,.79,.85)),shallow=Color3.Lerp(base,Color3.FromHexString('#c3d7ad'),.53);
 const sample=(x:number,y:number)=>{
  // A broad, uneven depth wash avoids visible concentric bands.
  const r=Math.hypot(x,y),edge=Math.max(0,Math.min(1,(r-.2)/.8));
  const shoal=Math.max(0,Math.min(1,edge**3+.1*Math.sin(x*5+y*3)*r+.04*Math.cos(y*11-x*4)*r));
  return Color3.Lerp(deep,shallow,shoal).scaleInPlace(1+.025*Math.sin(x*7-y*4));
 };
 const vertex=(x:number,y:number)=>{
  const color=sample(x,y);
  positions.push(x*radius,y*radius,0);normals.push(0,0,-1);colors.push(color.r,color.g,color.b,1);uvs.push((x+1)/2,(1-y)/2);
  return positions.length/3-1;
 };
 vertex(0,0);
 for(const r of rings)for(let side=0;side<sides;side++){
  const angle=side*Math.PI*2/sides;vertex(Math.cos(angle)*r,Math.sin(angle)*r);
 }
 for(let side=0;side<sides;side++){
  const next=(side+1)%sides;indices.push(1+next,0,1+side);
  for(let ring=1;ring<rings.length;ring++){
   const a=1+(ring-1)*sides+side,b=1+(ring-1)*sides+next,c=1+ring*sides+side,d=1+ring*sides+next;
   indices.push(b,a,c,b,c,d);
  }
 }
 const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.colors=colors;data.uvs=uvs;data.applyToMesh(mesh);
 mesh.useVertexColors=true;mesh.hasVertexAlpha=false;
}

/** One opaque surface: painted depth, sky reflection and slow broken wavelets.
 * The run clock owns motion, so pausing, previews and saved runs stay coherent.
 * There are no render targets, textures, extra meshes or render observers. */
export class LakeSurface extends MaterialPluginBase {
 private seconds=0;
 private sample:AtmosphereSample;private center:{x:number;z:number;waterRadius:number};
 constructor(material:StandardMaterial,sample:AtmosphereSample,center:{x:number;z:number;waterRadius:number}){
  super(material,'wildlandsLake',170,{},true,true);this.sample=sample;this.center=center;
 }
 update(seconds:number){this.seconds=Number.isFinite(seconds)?Math.max(0,seconds):0;}
 getUniforms(){return {ubo:[{name:'lakeSky',size:3,type:'vec3'},{name:'lakeSun',size:3,type:'vec3'},{name:'lakeCenter',size:3,type:'vec3'},{name:'lakeTime',size:1,type:'float'}],
  fragment:'uniform vec3 lakeSky; uniform vec3 lakeSun; uniform vec3 lakeCenter; uniform float lakeTime;'};}
 bindForSubMesh(buffer:UniformBuffer){
  buffer.updateColor3('lakeSky',this.sample.sky);buffer.updateColor3('lakeSun',this.sample.sun);
  buffer.updateFloat3('lakeCenter',this.center.x,this.center.z,this.center.waterRadius);buffer.updateFloat('lakeTime',this.seconds);
 }
 getCustomCode(shaderType:string){return shaderType==='fragment'?{
  CUSTOM_FRAGMENT_BEFORE_FOG:`
   vec2 lakePoint=vPositionW.xz;
   vec2 lakeLocal=(lakePoint-lakeCenter.xy)/lakeCenter.z;
   float lakeEdge=length(lakeLocal);
   float lakePhase=lakePoint.y*0.93+sin(lakePoint.x*0.21+lakeTime*0.13)*0.85-lakeTime*0.42;
   float lakeBroken=smoothstep(0.25,0.85,sin(lakePoint.x*0.53+sin(lakePoint.y*0.19)+lakeTime*0.08));
   float lakeRipple=(1.0-smoothstep(0.025,0.14,abs(sin(lakePhase))))*lakeBroken;
   vec3 lakeNormal=normalize(vec3(sin(lakePoint.x*0.23+lakeTime*0.19)*0.035,1.0,cos(lakePhase)*0.045));
   vec3 lakeView=normalize(vEyePosition.xyz-vPositionW);
   float lakeFresnel=pow(1.0-max(0.0,dot(lakeView,lakeNormal)),3.0);
   vec3 lakeReflection=mix(lakeSky,vec3(0.88,0.9,0.76),0.22);
   color.rgb=mix(color.rgb,lakeReflection,0.12+lakeFresnel*0.34);
   float lakeSunlight=pow(max(0.0,dot(reflect(-lakeView,lakeNormal),normalize(vec3(0.5,0.72,-0.4)))),40.0);
   float lakeShine=lakeRipple*(0.10+lakeSunlight*0.36);
   color.rgb=mix(color.rgb,mix(vec3(0.76,0.87,0.81),lakeSun,0.35),lakeShine);
   // A narrow, interrupted pale rim ties the water to the existing sandy bank.
   float lakeShore=0.971+sin(lakeLocal.x*21.0+lakeLocal.y*17.0+lakeTime*0.3)*0.005;
   float lakeFoam=(1.0-smoothstep(0.002,0.009,abs(lakeEdge-lakeShore)))*smoothstep(-0.35,0.4,sin(lakeLocal.x*31.0-lakeLocal.y*19.0));
   color.rgb=mix(color.rgb,vec3(0.77,0.85,0.70),lakeFoam*0.43);
  `,
 }:null;}
}
