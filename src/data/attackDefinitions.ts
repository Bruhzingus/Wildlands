import type {AttackKind,Element} from './kanto.ts';
import {PROGRESSION} from './progression.ts';

export interface StatusProc {burn?:number;poison?:number;slow?:number;soak?:number;stun?:number}
export type ProjectileShape='orb'|'needle'|'beam'|'lob'|'star';
export type AttackPattern='vine'|'flame-fan'|'bubble-stream'|'thread'|'gust'|'sand-wave'|'foxfire'|'spores'|'ricochet'|'pounce'|'psychic-cross'|'combo'|'haunt'|'swift'|'tackle';
export interface AttackMilestone {
 rank:number;description:string;projectiles?:number;pierce?:number;chains?:number;chainRange?:number;
 width?:number;spread?:number;splashRadius?:number;knockback?:number;bounces?:number;bounceRange?:number;
 orbitRadius?:number;orbitSpeed?:number;strikes?:number;damageScale?:number;status?:StatusProc;
}
export interface AttackDefinition {
 kind:AttackKind;cooldown:number;range:number;projectiles:number;pierce:number;radius:number;
 element?:Element;
 speed:number;lifetime:number;damageScale:number;chains:number;chainRange:number;
 growth:{damage:number;range:number;radius:number;projectilesEvery:number;chainsEvery:number};
 status:StatusProc;silhouette:ProjectileShape;
 pattern?:AttackPattern;description?:string;milestones?:readonly AttackMilestone[];
 width?:number;spread?:number;splashRadius?:number;knockback?:number;bounces?:number;bounceRange?:number;
 orbitRadius?:number;orbitSpeed?:number;strikes?:number;turnRate?:number;
}
/** Shared mechanics: species select parameters, never their own combat implementation. */
export const ATTACK_ARCHETYPES:Record<AttackKind,AttackDefinition>={
 bolt:{kind:'bolt',cooldown:.83,range:16,projectiles:1,pierce:0,radius:0,speed:18,lifetime:1.2,damageScale:1,chains:0,chainRange:0,growth:{damage:4,range:.32,radius:0,projectilesEvery:0,chainsEvery:0},status:{},silhouette:'orb'},
 burst:{kind:'burst',cooldown:1.05,range:12,projectiles:0,pierce:0,radius:3.5,speed:0,lifetime:0,damageScale:.8,chains:0,chainRange:0,growth:{damage:4,range:.3,radius:.12,projectilesEvery:0,chainsEvery:0},status:{},silhouette:'orb'},
 slash:{kind:'slash',cooldown:.75,range:5.4,projectiles:0,pierce:0,radius:4.5,speed:0,lifetime:0,damageScale:1.15,chains:0,chainRange:0,growth:{damage:4,range:.18,radius:.1,projectilesEvery:0,chainsEvery:0},status:{},silhouette:'needle'},
 aura:{kind:'aura',cooldown:1.25,range:5.2,projectiles:0,pierce:0,radius:4.1,speed:0,lifetime:0,damageScale:.7,chains:0,chainRange:0,growth:{damage:4,range:.18,radius:.13,projectilesEvery:0,chainsEvery:0},status:{},silhouette:'orb'},
 chain:{kind:'chain',cooldown:.94,range:16,projectiles:0,pierce:0,radius:0,speed:0,lifetime:0,damageScale:1,chains:2,chainRange:4.7,growth:{damage:4,range:.3,radius:0,projectilesEvery:0,chainsEvery:2},status:{},silhouette:'needle'},
 beam:{kind:'beam',cooldown:1.3,range:18,projectiles:1,pierce:4,radius:0,speed:28,lifetime:.72,damageScale:1,chains:0,chainRange:0,growth:{damage:4,range:.35,radius:0,projectilesEvery:0,chainsEvery:0},status:{},silhouette:'beam'},
 lob:{kind:'lob',cooldown:.96,range:16,projectiles:1,pierce:0,radius:2.1,speed:13,lifetime:1.65,damageScale:.9,chains:0,chainRange:0,growth:{damage:4,range:.35,radius:.1,projectilesEvery:4,chainsEvery:0},status:{},silhouette:'lob'},
 heal:{kind:'heal',cooldown:2.1,range:16,projectiles:0,pierce:0,radius:5,speed:0,lifetime:0,damageScale:0,chains:0,chainRange:0,growth:{damage:1.5,range:.15,radius:.1,projectilesEvery:0,chainsEvery:0},status:{},silhouette:'orb'},
};
export const ELEMENT_PROCS:Partial<Record<Element,StatusProc>>={water:{soak:1},fire:{burn:.22},ice:{slow:.24},poison:{poison:.3}};
export const ATTACK_DESCRIPTIONS:Record<AttackKind,string>={bolt:'Aimed homing shots.',burst:'A blast centered on the target.',slash:'A close forward sweep.',aura:'A pulse around its owner.',chain:'Lightning jumps between nearby enemies.',beam:'A straight piercing lance.',lob:'Arcing shots explode on impact.',heal:'Restores leader and squad health.'};

/** Rank and melee rules belong to the move, independently of its caster or slot. */
export function resolveAttackProfile(base:AttackDefinition,level=1):AttackDefinition {
 const rank=Math.max(0,Number.isFinite(level)?level-1:0),growth={...base.growth};
 let profile:AttackDefinition={...base,growth,status:{...base.status}};
 for(const milestone of profile.milestones||[]){
  if(milestone.rank>rank+1)continue;
  const {rank:_rank,description:_description,status,...changes}=milestone;
  profile={...profile,...changes,status:{...profile.status,...status}};
 }
 const melee=profile.kind==='slash'?1.25:1;
 return {...profile,cooldown:profile.cooldown/(1+rank*PROGRESSION.moves.speedPerRank),damageScale:profile.damageScale*melee,
  range:(profile.range+rank*growth.range)*melee,radius:(profile.radius+rank*growth.radius)*melee,
  width:profile.width===undefined?undefined:(profile.width+rank*growth.radius)*melee,
  projectiles:profile.projectiles+(growth.projectilesEvery?Math.floor(rank/growth.projectilesEvery):0),
  chains:profile.chains+(growth.chainsEvery?Math.floor((rank+1)/growth.chainsEvery):0)};
}
