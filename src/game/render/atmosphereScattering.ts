import {MaterialPluginBase,Mesh,MeshBuilder,Scene,ShaderMaterial,StandardMaterial,UniformBuffer} from '@babylonjs/core';
import type {AtmosphereSample} from './atmosphere.ts';

/** Shared by the sky and scenery: a cool upper sky, low mist and a broad warm
 * aureole facing the sun. No textures, depth pass or fullscreen postprocess. */
const scattering=`
vec3 atmosphereColor(vec3 ray) {
 float elevation=clamp(ray.y,0.0,1.0);
 vec3 horizon=mix(wildFog,wildSky, smoothstep(-0.12,0.3,ray.y)*0.38);
 vec3 air=mix(horizon,wildSky*vec3(0.78,0.88,1.03),pow(elevation,0.55));
 float facing=max(0.0,dot(ray,normalize(vec3(0.5,0.72,-0.4))));
 float glow=pow(facing,6.0)*0.24;
 return mix(air,wildSun,glow);
}`;

/** Sparse flat banks, small puffs and taller cumulus. Each wrapped azimuth
 * cell has its own silhouette, proportions, placement and density, without
 * textures, noise octaves or a volumetric pass. */
const clouds=`
float cloudHash(float n) { return fract(sin(n*127.1+311.7)*43758.5453); }
float cloudLobe(vec2 p,vec2 radius) {
 return (length(p/radius)-1.0)*min(radius.x,radius.y);
}
float cloudShape(vec2 p,float seed) {
 float a=fract(seed*17.17),b=fract(seed*43.71),lean=(b-0.5)*0.28;
 float d;
 if(seed<0.32){
  // Broad, shallow banks with an uneven trailing edge.
  d=cloudLobe(p-vec2(0.0,0.20),vec2(0.80,0.16));
  d=min(d,cloudLobe(p-vec2(-0.44,0.25+a*0.06),vec2(0.31,0.17)));
  d=min(d,cloudLobe(p-vec2(0.03+lean,0.30+b*0.08),vec2(0.42,0.20)));
  d=min(d,cloudLobe(p-vec2(0.55,0.22),vec2(0.26,0.14)));
 }else if(seed<0.67){
  // Compact puffs leave noticeably more open sky around them.
  d=cloudLobe(p-vec2(0.0,0.18),vec2(0.57,0.21));
  d=min(d,cloudLobe(p-vec2(-0.32,0.31),vec2(0.24,0.26)));
  d=min(d,cloudLobe(p-vec2(lean,0.50+a*0.12),vec2(0.33,0.38)));
  d=min(d,cloudLobe(p-vec2(0.34,0.29+b*0.07),vec2(0.27,0.24)));
 }else{
  // A dominant offset crown gives cumulus a different silhouette each time.
  d=cloudLobe(p-vec2(0.0,0.18),vec2(0.75,0.23));
  d=min(d,cloudLobe(p-vec2(-0.40,0.37),vec2(0.32,0.29)));
  d=min(d,cloudLobe(p-vec2(-0.16+lean,0.60+a*0.10),vec2(0.32,0.43)));
  d=min(d,cloudLobe(p-vec2(0.28,0.38+b*0.08),vec2(0.32,0.34)));
  d=min(d,cloudLobe(p-vec2(0.60,0.22),vec2(0.25,0.18)));
 }
 return max(d,-p.y+(seed-0.5)*0.07*p.x-0.015);
}
vec3 cloudBank(vec3 air,vec3 ray,float azimuth,float cells,float offset,float base,float height,float opacity) {
 float cell=floor(azimuth*cells+offset);
 // Every variation comes from the wrapped cell, so +/- pi remains seamless.
 float id=mod(cell,cells)+cells*7.0;
 float seed=cloudHash(id),shape=cloudHash(id+23.7);
 vec4 variation=fract(vec4(seed,shape,seed+shape,seed-shape)*vec4(19.19,7.13,37.17,51.43));
 // Occasional gaps and offset centres break up the evenly spaced cell grid.
 float presence=smoothstep(0.14,0.24,fract(seed*71.73));
 if(presence<0.001)return air;
 vec2 p=vec2(((fract(azimuth*cells+offset)-0.5)*2.6-(variation.x-0.5)*0.30)/mix(0.48,1.12,variation.y),
             (ray.y-base-variation.z*0.14)*height/mix(0.55,1.28,variation.w));
 if(fract(shape*13.71)>0.5)p.x=-p.x;
 // Shape extent <= .85, width <= 1.12 and jitter <= .15 keep all
 // silhouettes inside the +/-1.30 cell, including the softened edge.
 float d=cloudShape(p,shape),softness=mix(0.018,0.042,variation.x);
 float mask=(1.0-smoothstep(-0.014,softness,d))*smoothstep(0.015,0.095,ray.y)*presence;
 float profileHeight=shape<0.32?0.58:shape<0.67?1.0:1.13;
 float cap=smoothstep(0.02,0.85,p.y/profileHeight);
 vec3 shade=mix(wildSky*vec3(0.78,0.84,0.94),wildFog,0.44);
 vec3 lit=mix(wildSun,vec3(1.0),0.30);
 vec3 body=mix(shade,lit,0.26+cap*0.66);
 // A narrow warm upper rim and a broad cool base suggest volume, while
 // remaining matte enough to sit behind the crisp sprites and scenery.
 float rim=(1.0-smoothstep(0.0,0.095,abs(d)))*smoothstep(0.25,0.65,p.y/profileHeight);
 body=mix(body,lit,rim*0.34);
 return mix(air,body,mask*opacity*mix(0.72,1.0,variation.w));
}
vec3 skyClouds(vec3 air,vec3 ray) {
 float azimuth=(atan(ray.z,ray.x)+3.14159265)/6.2831853;
 air=cloudBank(air,ray,azimuth,11.0,0.37,0.035,12.0,0.40);
 return cloudBank(air,ray,azimuth,9.0,0.0,0.085,6.2,0.84);
}`;

export class SceneryAtmosphere extends MaterialPluginBase {
 private sample:AtmosphereSample;
 constructor(material:StandardMaterial,sample:AtmosphereSample){
  super(material,'wildlandsAtmosphere',180,{},true,true);this.sample=sample;
  // Scenery receives the height/direction-aware blend below. Sprites and combat
  // effects retain Babylon's scene fog and their original material pipelines.
  material.fogEnabled=false;
 }
 getUniforms(){return {ubo:[{name:'wildSky',size:3,type:'vec3'},{name:'wildFog',size:3,type:'vec3'},{name:'wildSun',size:3,type:'vec3'},{name:'wildFogRange',size:2,type:'vec2'}],
  fragment:'uniform vec3 wildSky; uniform vec3 wildFog; uniform vec3 wildSun; uniform vec2 wildFogRange;'};}
 bindForSubMesh(buffer:UniformBuffer){
  const s=this.sample;buffer.updateColor3('wildSky',s.sky);buffer.updateColor3('wildFog',s.fog);buffer.updateColor3('wildSun',s.sun);buffer.updateFloat2('wildFogRange',s.fogStart,s.fogEnd);
 }
 getCustomCode(shaderType:string){return shaderType==='fragment'?{
  CUSTOM_FRAGMENT_DEFINITIONS:scattering,
  CUSTOM_FRAGMENT_BEFORE_FOG:`
   vec3 airVector=vPositionW-vEyePosition.xyz;
   float airDistance=length(airVector);
   vec3 airRay=airVector/max(airDistance,0.001);
   float airDepth=max(0.0,airDistance-wildFogRange.x)/max(1.0,wildFogRange.y-wildFogRange.x);
   // Exponential falloff preserves successive silhouettes instead of reaching
   // an opaque, uniform wall at fogEnd. Low valleys gather a little more mist.
   float lowMist=exp(-max(vPositionW.y,0.0)*0.055);
   float airAmount=1.0-exp(-pow(airDepth,1.55)*(0.92+lowMist*0.28));
   vec3 airColor=atmosphereColor(airRay);
   airColor=mix(airColor,wildFog,lowMist*0.12);
   color.rgb=mix(color.rgb,airColor,airAmount);
  `,
 }:null;}
}

export class AtmosphereSky {
 private mesh:Mesh;private material:ShaderMaterial;
 constructor(scene:Scene){
  this.mesh=MeshBuilder.CreateSphere('atmosphere sky',{diameter:1800,segments:16,sideOrientation:Mesh.BACKSIDE},scene);
  this.mesh.isPickable=false;this.mesh.checkCollisions=false;this.mesh.infiniteDistance=true;this.mesh.alwaysSelectAsActiveMesh=true;
  this.material=new ShaderMaterial('gradient sky',scene,{
   vertexSource:'precision highp float; attribute vec3 position; uniform mat4 worldViewProjection; varying vec3 skyRay; void main(){skyRay=position;gl_Position=worldViewProjection*vec4(position,1.0);}',
   fragmentSource:`precision highp float; varying vec3 skyRay; uniform vec3 wildSky; uniform vec3 wildFog; uniform vec3 wildSun; ${scattering} ${clouds}
    void main(){vec3 ray=normalize(skyRay);vec3 air=atmosphereColor(ray);
     float sunFacing=max(0.0,dot(ray,normalize(vec3(0.5,0.72,-0.4))));
     air=mix(air,wildSun,pow(sunFacing,38.0)*0.18);
     float sunDisc=smoothstep(0.9987,0.9991,sunFacing);
     air=mix(air,mix(wildSun,vec3(1.0),0.45),sunDisc*0.92);
     gl_FragColor=vec4(skyClouds(air,ray),1.0);}`,
  },{attributes:['position'],uniforms:['worldViewProjection','wildSky','wildFog','wildSun']});
  this.material.backFaceCulling=false;this.material.disableDepthWrite=true;this.mesh.material=this.material;
 }
 update(sample:AtmosphereSample){this.material.setColor3('wildSky',sample.sky);this.material.setColor3('wildFog',sample.fog);this.material.setColor3('wildSun',sample.sun);}
 dispose(){this.mesh.dispose();this.material.dispose();}
}
