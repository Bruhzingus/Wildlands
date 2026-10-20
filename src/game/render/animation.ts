import {ATTACK_POSES} from '../../data/config.ts';
import type {AttackKind} from '../../data/kanto.ts';
import type {EnemyAttackRole} from '../../data/enemyAttacks.ts';

export type AnimationName = 'idle' | 'walk' | 'attack';
export type AttackStyle = keyof typeof ATTACK_POSES;
export interface AttackPose {forward:number;lift:number;scaleX:number;scaleY:number;lean:number;}

export function attackStyle(kind:AttackKind):AttackStyle {
 return kind==='slash'?'melee':kind==='bolt'||kind==='beam'||kind==='lob'?'ranged':'pulse';
}
/** A ranged caster, heavy swing, thrown bomb and healing pulse each retain a
 * distinct silhouette while native Pokémon attack frames are playing. */
export function enemyAttackStyle(role:EnemyAttackRole):AttackStyle {
 const styles:Record<EnemyAttackRole,AttackStyle>={
  'melee-fast':'quick','melee-slow':'heavy','ranged-burst':'burst','ranged-projectile':'projectile',
  'explosive-suicide':'explosive','explosive-bomb':'lob',healer:'heal',
 };
 return styles[role];
}

/** Add anticipation, one strike and recovery to the existing frames. All values
 * are sampled from authoritative progress, so pausing and repeated renders cannot drift. */
export function attackPose(progress:number,style:AttackStyle,windup=false):AttackPose {
 const p=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0,profile=ATTACK_POSES[style];
 if(p===0||(!windup&&p===1))return {forward:0,lift:0,scaleX:1,scaleY:1,lean:0};
 const smooth=(t:number)=>t*t*(3-2*t);
 let ready=0,strike=0,recovery=0;
 if(windup)ready=smooth(Math.min(1,p/.45));
 else if(p<.16)ready=smooth(p/.16);
 else if(p<.42){const t=smooth((p-.16)/.26);ready=1-t;strike=t;}
 else if(p<.72){const t=smooth((p-.42)/.30);strike=1-t;recovery=t;}
 else recovery=1-smooth((p-.72)/.28);
 return {
  forward:ready*profile.anticipation+strike*profile.strike+recovery*profile.recovery,
  lift:strike*profile.lift,
  scaleX:1+ready*profile.squash*.7-strike*profile.stretch*.5+recovery*profile.stretch*.2,
  scaleY:1-ready*profile.squash+strike*profile.stretch-recovery*profile.stretch*.2,
  lean:profile.lean*(-ready*.4+strike-recovery*.2),
 };
}
export interface AnimationMeta {
 name: string;
 width: number;
 height: number;
 /** PMD duration ticks are 1/60 second, including unequal frame holds. */
 durations: number[];
}
export type AnimationMetadata = Record<string, AnimationMeta>;

/** Parse SpriteCollab's small, documented XML vocabulary without browser-only APIs.
 * Shared by the renderer, developer gallery, asset sync and offline coverage audit. */
export function parseAnimationMetadata(xml: string): AnimationMetadata {
 if (!/<AnimData\b/.test(xml) || !/<\/AnimData>/.test(xml)) throw Error('Invalid animation XML');
 const entries = new Map<string, {copy?: string; meta?: AnimationMeta}>();
 const tag = (body: string, name: string) => body.match(new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`))?.[1]?.trim();
 for (const match of xml.matchAll(/<Anim\b[^>]*>([\s\S]*?)<\/Anim>/g)) {
  const body = match[1], name = tag(body, 'Name');
  if (!name || !/^[A-Za-z0-9_-]+$/.test(name)) continue;
  const copy = tag(body, 'CopyOf');
  if (copy) { entries.set(name, {copy}); continue; }
  const width = Number(tag(body, 'FrameWidth')), height = Number(tag(body, 'FrameHeight'));
  const durations = [...body.matchAll(/<Duration>\s*([^<]+)\s*<\/Duration>/g)].map(m => Number(m[1]));
  if (Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0 && durations.length && durations.every(n => Number.isInteger(n) && n > 0)) {
   entries.set(name, {meta: {name, width, height, durations}});
  }
 }
 const result: AnimationMetadata = {};
 const resolve = (name: string, seen = new Set<string>()): AnimationMeta | undefined => {
  if (seen.has(name)) return;
  seen.add(name);
  const entry = entries.get(name);
  return entry?.meta ?? (entry?.copy ? resolve(entry.copy, seen) : undefined);
 };
 for (const name of entries.keys()) { const meta = resolve(name); if (meta) result[name] = meta; }
 return result;
}

export function animationFrame(durations: readonly number[], seconds: number): number {
 const total = durations.reduce((sum, n) => sum + n, 0);
 if (total <= 0) return 0;
 let tick = ((Math.max(0, seconds) * 60) % total + total) % total;
 for (let i = 0; i < durations.length; i++) { if (tick < durations[i]) return i; tick -= durations[i]; }
 return 0;
}

/** Fit one full attack into its simulation window, retaining source frame-hold ratios.
 * Clamp at the final frame so a late-loaded sheet cannot wrap or start another swing. */
export function oneShotFrame(durations:readonly number[],progress:number):number {
 if(!durations.length)return 0;
 const total=durations.reduce((sum,n)=>sum+n,0);
 let tick=Math.min(1,Math.max(0,progress))*total;
 for(let i=0;i<durations.length-1;i++){if(tick<durations[i])return i;tick-=durations[i];}
 return durations.length-1;
}

/** PMD rows: down, down-right, right, up-right, up, up-left, left, down-left.
 * World facings use atan2(x,z); cameraAngle=0 is the default camera at -Z. */
export function spriteDirection(facing: number, cameraAngle: number): number {
 const turn = Math.PI * 2;
 return Math.round((((cameraAngle - facing + Math.PI) % turn) + turn) % turn / (Math.PI / 4)) % 8;
}

export function validateAtlas(meta: AnimationMeta, width: number, height: number): {columns: number; rows: number} {
 const columns = width / meta.width, rows = height / meta.height;
 if (!Number.isInteger(columns) || columns < meta.durations.length || (rows !== 1 && rows !== 8)) {
  throw Error(`Invalid ${meta.name} atlas ${width}x${height} for ${meta.width}x${meta.height}, ${meta.durations.length} frames`);
 }
 return {columns, rows};
}

export interface AtlasBounds {visibleHeight:number;bottoms:number[];tops:number[];}
/** Read a stable resting foot anchor for each facing, ignoring transparent padding.
 * Bounds span the resting frames; the anchor is reused during Walk/Attack so the
 * body does not change scale or lose its original animation motion. */
export function measureAtlas(meta:AnimationMeta,width:number,height:number,pixels:Uint8ClampedArray):AtlasBounds {
 const {columns,rows}=validateAtlas(meta,width,height);let visibleHeight=0;const bottoms:number[]=[],tops:number[]=[];
 for(let row=0;row<rows;row++) {
  let bottom=meta.height/2,top=meta.height;
  for(let frame=0;frame<meta.durations.length;frame++) {
   let first=meta.height,last=-1;
   for(let y=0;y<meta.height;y++)for(let x=0;x<meta.width;x++) {
    const index=((row*meta.height+y)*columns*meta.width+frame*meta.width+x)*4+3;
    if(pixels[index]>16){first=Math.min(first,y);last=Math.max(last,y);}
   }
   if(last>=0){visibleHeight=Math.max(visibleHeight,last-first+1);bottom=Math.max(bottom,last+1);top=Math.min(top,first);}
  }
  bottoms.push(bottom-meta.height/2);tops.push(top);
 }
 if(!visibleHeight)throw Error(`Empty ${meta.name} atlas`);
 return {visibleHeight,bottoms,tops};
}

export const PMD_SOURCE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite';
export const ART_SOURCE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';
