import type {GameSettings} from './settings.ts';

export type Quality='low'|'balanced'|'high';
const levels:Quality[]=['low','balanced','high'];
export function initialQuality(cores=4,memory=4):Quality {
 return cores<=4||memory<=4?'low':cores>=8&&memory>=8?'high':'balanced';
}
/** Pixel ratio is bounded separately from the player's resolution preference. */
export function graphicsProfile(settings:Pick<GameSettings,'resolution'|'vfxDensity'|'graphicsQuality'>,automatic:Quality,dpr=1){
 const quality=settings.graphicsQuality==='auto'?automatic:settings.graphicsQuality;
 const pixelCap={low:1,balanced:1.5,high:2}[quality];
 const ratio=Math.max(.5,Math.min(Number.isFinite(dpr)?dpr:1,pixelCap))*settings.resolution;
 return {quality,hardwareScaling:1/ratio,effectDensity:settings.vfxDensity*{low:.5,balanced:.75,high:1}[quality]};
}
/** Sustained active frame intervals only. Warmup, hysteresis and bounded windows
 * keep asset loading and a single missed frame from changing the player's preset. */
export class AutomaticQuality {
 quality:Quality;private elapsed=0;private windowTime=0;private frames=0;private lastChange=0;
 constructor(quality:Quality){this.quality=quality;}
 update(seconds:number):Quality|undefined {
  if(!Number.isFinite(seconds)||seconds<=0||seconds>2)return;
  seconds=Math.min(.25,seconds);
  this.elapsed+=seconds;this.windowTime+=seconds;this.frames++;
  if(this.windowTime<8||this.frames<45)return;
  const ms=this.windowTime/this.frames*1000;this.windowTime=0;this.frames=0;
  const index=levels.indexOf(this.quality),since=this.elapsed-this.lastChange;
  const next=ms>27&&since>=8?Math.max(0,index-1):ms<17.5&&since>=32?Math.min(2,index+1):index;
  if(next===index)return;
  this.quality=levels[next];this.lastChange=this.elapsed;return this.quality;
 }
 resetWindow(){this.windowTime=0;this.frames=0;}
}
