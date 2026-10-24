import {DESIGN} from './config.ts';
import {getSpecies,type Element} from './kanto.ts';

export type SpecialKind='garden'|'flamethrower'|'surf'|'thunder'|'quickstep'|'web'|'whirlwind'|'fissure'|'foxfire'|'sleep'|'payday'|'charge'|'teleport'|'flurry'|'fury-swipes'|'curse'|'lance'|'volley'|'mend';
export type SpecialAimMode='automatic'|'directional'|'placement';
const SPECIAL_AIM_MODES:Readonly<Record<SpecialKind,SpecialAimMode>>={
 garden:'placement',flamethrower:'directional',surf:'directional',thunder:'automatic',quickstep:'directional',web:'directional',
 whirlwind:'directional',fissure:'directional',foxfire:'automatic',sleep:'placement',payday:'directional',charge:'directional',
 teleport:'directional',flurry:'directional','fury-swipes':'directional',curse:'placement',lance:'directional',volley:'directional',mend:'automatic',
};
/** Only specials with a direction or remote footprint consume the player's aim. */
export function specialAimMode(kind:SpecialKind):SpecialAimMode {return SPECIAL_AIM_MODES[kind];}
export interface SpecialProfile {
 kind:SpecialKind;name:string;description:string;range:number;radius:number;duration:number;pulses:number;projectiles:number;
 damageScale:number;cooldown:number;angle:number;knockback:number;element?:Element;
}
type SpecialTuning=Pick<SpecialProfile,'kind'|'name'|'description'>&Partial<Omit<SpecialProfile,'kind'|'name'|'description'>>;
const families:readonly [readonly number[],SpecialTuning][]=[
 [[1,2,3],{kind:'garden',name:'Bramble Garden',description:'Plant a distant vine garden that repeatedly damages and slows enemies inside.',range:18,radius:4,duration:4,pulses:5,damageScale:.52}],
 [[4,5,6],{kind:'flamethrower',name:'Flamethrower',description:'Breathe a sustained cone of fire toward the nearest enemy; reposition to sweep it.',range:13,radius:0,angle:1.05,duration:2,pulses:8,damageScale:.35}],
 [[7,8,9],{kind:'surf',name:'Surf',description:'Send a wide traveling wave through the enemy line, soaking and pushing each foe once.',range:23,radius:3.5,duration:1.2,pulses:1,damageScale:2.2,knockback:4}],
 [[10,11,12],{kind:'web',name:'Electroweb',description:'Fan out piercing electric threads that damage and slow enemies along separate lanes.',element:'electric',range:17,radius:0,projectiles:5,damageScale:1.1}],
 [[41,42],{kind:'flurry',name:'Wing Attack',description:'Beat forward with close wing strikes against enemies ahead.',range:5.5,angle:1.3,duration:.5,pulses:2,damageScale:.75,element:'flying'}],
 [[16,17,18],{kind:'whirlwind',name:'Whirlwind',description:'Launch a widening cyclone that carries enemies away from your route.',range:19,radius:2.4,duration:1.8,pulses:1,damageScale:1.6,knockback:6}],
 [[25,26],{kind:'thunder',name:'Thunder Circuit',description:'Call successive remote lightning strikes on different enemies, briefly stunning each.',range:24,radius:1.3,duration:1.2,pulses:6,damageScale:1.05}],
 [[27,28],{kind:'fissure',name:'Fissure',description:'Rupture the ground in a sequence toward distant foes; later ruptures hit harder.',range:20,radius:2,duration:1,pulses:5,damageScale:.9}],
 [[37,38],{kind:'foxfire',name:'Ninefold Foxfire',description:'Summon orbiting flames that guard you and burn enemies they touch.',range:16,radius:3.2,duration:4,projectiles:5,damageScale:1.05}],
 [[43,44,45],{kind:'sleep',name:'Sleep Powder',description:'Drop a distant sleep cloud that stuns a crowd, then restores squad health over time.',range:18,radius:5,duration:3,pulses:3,damageScale:.35}],
 [[52,53],{kind:'fury-swipes',name:'Fury Swipes',description:'Rake one enemy ahead with rapid claw strikes, switching targets if it falls. Training adds hits up to five.',range:7,radius:0,angle:Math.PI/3,duration:.6,pulses:3,damageScale:1.1}],
 [[58,59],{kind:'charge',name:'Flame Charge',description:'Rush toward a foe through a damaging fire trail that keeps burning behind you.',range:10,radius:2,duration:2.4,pulses:5,damageScale:.55,knockback:2}],
 [[63,64,65],{kind:'teleport',name:'Teleport Lance',description:'Fire a piercing psychic lance toward your aim, then teleport to its endpoint.',range:19,radius:1.3,damageScale:2.8}],
 [[66,67,68],{kind:'flurry',name:'Close Combat',description:'Unleash three heavy forward strikes; the final blow launches enemies away.',range:7,radius:0,angle:1.7,duration:.65,pulses:3,damageScale:1.1,knockback:4}],
 [[92,93,94],{kind:'curse',name:'Haunting Hex',description:'Mark a distant cluster, then detonate the curse after a delay and leave them poisoned.',range:20,radius:4.5,duration:1,pulses:1,damageScale:2.6}],
 [[129],{kind:'flurry',name:'Flail',description:'Strike nearby enemies; damage rises linearly up to 3× as Magikarp loses HP.',range:6.3,angle:1.2,duration:.45,pulses:2,damageScale:.28,element:'normal'}],
 [[130],{kind:'lance',name:'Hyper Beam',description:'Fire a powerful straight beam through the enemy line.',range:25,radius:1.3,damageScale:3.2,element:'normal'}],
 [[133],{kind:'quickstep',name:'Quick Attack',description:'Dash quickly through enemies in a straight line.',range:9,radius:1.5,projectiles:0,damageScale:1.3,element:'normal'}],
 [[134],{kind:'surf',name:'Tidal Rush',description:'Sweep a long corridor with a traveling wave that soaks and pushes foes.',range:25,radius:4,duration:1.2,damageScale:2.3,knockback:4}],
 [[135],{kind:'thunder',name:'Thunder Circuit',description:'Strike separate distant enemies in a rapid lightning circuit.',range:26,radius:1.4,duration:1,pulses:7,damageScale:1.05}],
 [[136],{kind:'foxfire',name:'Blazing Guard',description:'Orbit with a ring of seeking fire that burns enemies crossing its path.',radius:3.8,duration:4,projectiles:6,damageScale:1.1}],
];
const bySpecies=new Map(families.flatMap(([ids,tuning])=>ids.map(id=>[id,tuning] as const)));
const fallback:Record<string,SpecialTuning>={
 beam:{kind:'lance',name:'Focused Lance',description:'Fire a wide piercing lance through a distant enemy line.',range:25,radius:1.2,damageScale:2.8},
 slash:{kind:'flurry',name:'Fierce Combo',description:'Deliver successive forward strikes with a launching final blow.',range:7,angle:1.7,pulses:3,duration:.65,damageScale:1.1,knockback:4},
 chain:{kind:'thunder',name:'Arc Circuit',description:'Strike different distant enemies in quick succession.',range:24,radius:1.3,pulses:6,duration:1.2,damageScale:1.05},
 heal:{kind:'mend',name:'Team Sanctuary',description:'Restore the squad and briefly guard every living partner.',radius:5,damageScale:0},
 burst:{kind:'curse',name:'Delayed Hex',description:'Mark a distant cluster, then strike after a short delay.',range:20,radius:4.5,duration:1,damageScale:2.6},
 aura:{kind:'garden',name:'Control Field',description:'Create a distant field that damages and slows approaching enemies.',range:18,radius:4,duration:4,pulses:5,damageScale:.52},
 lob:{kind:'volley',name:'Scatter Volley',description:'Launch several seeking shots toward separate enemies.',range:20,projectiles:6,damageScale:1.2},
 bolt:{kind:'volley',name:'Seeking Volley',description:'Launch several seeking shots toward separate enemies.',range:20,projectiles:6,damageScale:1.2},
};

/** Specials inherit their caster's move rank, but grow along their own mechanical paths. */
export function getSpecialProfile(speciesId:number,rank=1):SpecialProfile {
 const species=getSpecies(speciesId),r=Math.max(1,Number.isFinite(rank)?Math.floor(rank):1);
 const profile:SpecialProfile={range:16,radius:2,duration:0,pulses:1,projectiles:0,damageScale:1,cooldown:DESIGN.specialCooldown,angle:1,knockback:0,...(bySpecies.get(speciesId)??fallback[species.attack])};
 // Evolution strengthens the existing identity instead of replacing it with a shared blast.
 profile.damageScale*=1+(species.stage-1)*.12;
 switch(profile.kind){
  case 'garden':profile.duration+=Math.floor((r-1)/2)*.5;profile.pulses+=Math.floor((r-1)/2);profile.radius+=Math.floor((r-1)/4)*.8;break;
  case 'flamethrower':profile.range+=(r-1)*.45;profile.angle+=Math.floor((r-1)/3)*.14;profile.pulses+=Math.floor((r-1)/3)*2;break;
  case 'surf':case 'whirlwind':profile.radius+=Math.floor((r-1)/2)*.45;profile.range+=(r-1)*.7;profile.knockback+=Math.floor((r-1)/4);break;
  case 'thunder':profile.pulses+=Math.floor((r-1)/2);profile.range+=(r-1)*.5;break;
  case 'quickstep':profile.range+=Math.floor((r-1)/3);break;
  case 'web':case 'payday':case 'volley':profile.projectiles+=Math.floor((r-1)/3)*2;break;
  case 'foxfire':profile.projectiles+=Math.floor((r-1)/2);profile.duration+=Math.floor((r-1)/3);break;
  case 'fissure':profile.pulses+=Math.floor((r-1)/3);profile.range+=(r-1)*.6;break;
  case 'sleep':profile.duration+=Math.floor((r-1)/3);profile.pulses+=Math.floor((r-1)/3);profile.radius+=Math.floor((r-1)/2)*.4;break;
  case 'charge':profile.duration+=Math.floor((r-1)/3)*.5;profile.pulses+=Math.floor((r-1)/3);profile.radius+=Math.floor((r-1)/3)*.4;break;
  case 'teleport':case 'lance':profile.radius+=Math.floor((r-1)/2)*.25;profile.range+=(r-1)*.6;break;
  case 'flurry':profile.pulses+=Math.floor((r-1)/3);profile.range+=Math.floor((r-1)/2)*.4;break;
  case 'fury-swipes':profile.pulses=Math.min(5,profile.pulses+Math.floor((r-1)/3));profile.range+=Math.floor((r-1)/2)*.4;break;
  case 'curse':profile.radius+=Math.floor((r-1)/2)*.5;profile.damageScale*=1+(r-1)*.07;break;
  case 'mend':break;
 }
 profile.projectiles=Math.min(12,profile.projectiles);profile.pulses=Math.min(16,profile.pulses);
 return profile;
}

export function describeSpecialUpgrade(speciesId:number,fromRank:number,toRank:number):string {
 const a=getSpecialProfile(speciesId,fromRank),b=getSpecialProfile(speciesId,toRank),parts:string[]=[];
 if(b.kind==='mend'&&toRank>fromRank)parts.push(`+${(toRank-fromRank)*3} squad healing`);
 if(b.projectiles>a.projectiles)parts.push(`+${b.projectiles-a.projectiles} ${b.kind==='foxfire'?'orbiting flame':'special projectile'}${b.projectiles-a.projectiles===1?'':'s'}`);
 if(b.pulses>a.pulses)parts.push(`+${b.pulses-a.pulses} ${b.kind==='thunder'?'lightning strike':b.kind==='flurry'||b.kind==='fury-swipes'?'combo hit':'pulse'}${b.pulses-a.pulses===1?'':'s'}`);
 if(b.duration>a.duration)parts.push(`+${(b.duration-a.duration).toFixed(1)}s duration`);
 if(b.radius>a.radius)parts.push(`+${(b.radius-a.radius).toFixed(1)}m width`);
 if(b.range>a.range)parts.push(`+${(b.range-a.range).toFixed(1)}m reach`);
 if(b.angle>a.angle)parts.push('wider flame cone');
 if(b.knockback>a.knockback)parts.push('stronger push');
 if(b.damageScale>a.damageScale)parts.push('stronger curse');
 return parts.length?`Q ${b.name}: ${parts.join(', ')}.`:'';
}
