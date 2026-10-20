export interface GameSettings {
 mouseSensitivity:number;
 invertY:boolean;
 soundVolume:number;
 musicVolume:number;
 screenShake:boolean;
 hitStop:boolean;
 reduceFlashes:boolean;
 graphicsQuality:'auto'|'low'|'balanced'|'high';
 resolution:number;
 vfxDensity:number;
}

const KEY='wildlands-controls-v1';
export const DEFAULT_SETTINGS:Readonly<GameSettings>=Object.freeze({mouseSensitivity:1,invertY:false,soundVolume:.18,musicVolume:.07,screenShake:true,hitStop:true,reduceFlashes:false,graphicsQuality:'auto',resolution:1,vfxDensity:1});

function storedSettings():Record<string,unknown> {
 const value=JSON.parse(localStorage.getItem(KEY)||'null');
 return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
}

function sanitize(value:unknown):GameSettings {
 const candidate=value&&typeof value==='object'?value as Partial<GameSettings>:{};
 const number=(key:'mouseSensitivity'|'soundVolume'|'musicVolume'|'resolution'|'vfxDensity',min:number,max:number)=>typeof candidate[key]==='number'&&Number.isFinite(candidate[key])?Math.min(max,Math.max(min,candidate[key])):DEFAULT_SETTINGS[key];
 const boolean=(key:'invertY'|'screenShake'|'hitStop'|'reduceFlashes')=>typeof candidate[key]==='boolean'?candidate[key]:DEFAULT_SETTINGS[key];
 return {
  mouseSensitivity:number('mouseSensitivity',.3,2.5),invertY:boolean('invertY'),
  soundVolume:number('soundVolume',0,1),musicVolume:number('musicVolume',0,1),
  screenShake:boolean('screenShake'),hitStop:boolean('hitStop'),reduceFlashes:boolean('reduceFlashes'),
  graphicsQuality:['auto','low','balanced','high'].includes(candidate.graphicsQuality??'')?candidate.graphicsQuality!:DEFAULT_SETTINGS.graphicsQuality,
  resolution:number('resolution',.5,1),vfxDensity:number('vfxDensity',.35,1),
 };
}

export function loadSettings():GameSettings {
 try{return sanitize(storedSettings());}
 catch{return {...DEFAULT_SETTINGS};}
}

/** Partial writes preserve camera, audio and comfort preferences when one panel changes. */
export function saveSettings(settings:Partial<GameSettings>):GameSettings {
 let previous:Record<string,unknown>={};try{previous=storedSettings();}catch{/** Damaged or unavailable storage uses defaults. */}
 const value=sanitize({...sanitize(previous),...settings});
 try{localStorage.setItem(KEY,JSON.stringify({...previous,...value}));}catch{/** Settings still apply when browser storage is unavailable. */}
 return value;
}
