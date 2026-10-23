import {Color3,DirectionalLight,HemisphericLight,Scene} from '@babylonjs/core';
import type {AtmosphereKey} from '../../data/atmosphere.ts';
import {clamp} from '../../utils/random.ts';

export interface AtmosphereSample {
 sky:Color3;fog:Color3;ambient:Color3;sun:Color3;
 ambientScale:number;sunScale:number;fogStart:number;fogEnd:number;
}
export const createAtmosphereSample=():AtmosphereSample=>({sky:new Color3(),fog:new Color3(),ambient:new Color3(),sun:new Color3(),ambientScale:1,sunScale:1,fogStart:50,fogEnd:200});
export const compileAtmosphere=(keys:readonly AtmosphereKey[])=>keys.map(key=>({...key,sky:Color3.FromHexString(key.sky),fog:Color3.FromHexString(key.fog),ambient:Color3.FromHexString(key.ambient),sun:Color3.FromHexString(key.sun)}));
type Curve=ReturnType<typeof compileAtmosphere>;
export const atmosphereTime=(seconds:number)=>Number.isNaN(seconds)?0:clamp(seconds,0,900);

/** Deterministic, allocation-free interpolation into caller-owned colors. */
export function sampleAtmosphere(curve:Curve,seconds:number,result:AtmosphereSample):AtmosphereSample {
 const time=atmosphereTime(seconds);let index=0;
 while(index<curve.length-2&&time>curve[index+1].seconds)index++;
 const a=curve[index],b=curve[index+1],linear=clamp((time-a.seconds)/(b.seconds-a.seconds),0,1),t=linear*linear*(3-2*linear);
 Color3.LerpToRef(a.sky,b.sky,t,result.sky);Color3.LerpToRef(a.fog,b.fog,t,result.fog);
 Color3.LerpToRef(a.ambient,b.ambient,t,result.ambient);Color3.LerpToRef(a.sun,b.sun,t,result.sun);
 result.ambientScale=a.ambientScale+(b.ambientScale-a.ambientScale)*t;result.sunScale=a.sunScale+(b.sunScale-a.sunScale)*t;
 result.fogStart=a.fogStart+(b.fogStart-a.fogStart)*t;result.fogEnd=a.fogEnd+(b.fogEnd-a.fogEnd)*t;return result;
}

/** Owns only scene presentation. No observers, wall clocks, postprocessing or
 * sprite materials. Disposal restores the scene's previous background/fog. */
export class WorldAtmosphere {
 private readonly curve:Curve;private readonly sample=createAtmosphereSample();
 private readonly previous;private readonly ambientBase:number;private readonly sunBase:number;
 private lastElapsed=0;private appliedTime=-1;private preview:number|null=null;
 private scene:Scene;private ambient:HemisphericLight;private sun:DirectionalLight;
 constructor(scene:Scene,ambient:HemisphericLight,sun:DirectionalLight,keys:readonly AtmosphereKey[]){
  this.scene=scene;this.ambient=ambient;this.sun=sun;this.curve=compileAtmosphere(keys);this.ambientBase=ambient.intensity;this.sunBase=sun.intensity;
  this.previous={sky:scene.clearColor.clone(),fog:scene.fogColor.clone(),mode:scene.fogMode,start:scene.fogStart,end:scene.fogEnd,density:scene.fogDensity};this.update(0);
 }
 update(elapsed:number){
  this.lastElapsed=elapsed;const time=atmosphereTime(this.preview??elapsed);if(time===this.appliedTime)return;
  const state=sampleAtmosphere(this.curve,time,this.sample);this.appliedTime=time;
  this.scene.clearColor.set(state.sky.r,state.sky.g,state.sky.b,1);this.scene.fogColor.copyFrom(state.fog);
  this.scene.fogMode=Scene.FOGMODE_LINEAR;this.scene.fogStart=state.fogStart;this.scene.fogEnd=state.fogEnd;
  this.ambient.diffuse.copyFrom(state.ambient);this.sun.diffuse.copyFrom(state.sun);
  this.ambient.intensity=this.ambientBase*state.ambientScale;this.sun.intensity=this.sunBase*state.sunScale;
 }
 setPreview(seconds:number|null){this.preview=seconds;this.update(this.lastElapsed);}
 inspect(){return {seconds:this.appliedTime,preview:this.preview,sky:this.scene.clearColor.asArray(),fog:this.scene.fogColor.asArray(),fogStart:this.scene.fogStart,fogEnd:this.scene.fogEnd,ambient:this.ambient.intensity,sun:this.sun.intensity};}
 dispose(){const p=this.previous;this.scene.clearColor.copyFrom(p.sky);this.scene.fogColor.copyFrom(p.fog);this.scene.fogMode=p.mode;this.scene.fogStart=p.start;this.scene.fogEnd=p.end;this.scene.fogDensity=p.density;}
}
