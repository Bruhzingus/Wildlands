import {getSpecies,type Element} from './kanto.ts';
import {getEnemySpeciesProfile} from './enemySpecies.ts';
import {enemyAttackLimit,getEnemyTier} from './enemyTiers.ts';
import type {Variant} from '../game/types.ts';

export type EnemyAttackRole='melee-fast'|'melee-slow'|'ranged-burst'|'ranged-projectile'|'explosive-suicide'|'explosive-bomb'|'healer';
export interface EnemyAttackProfile {
 speciesId:number;role:EnemyAttackRole;moveName:string;element:Element;color:string;
 cooldown:number;windup:number;range:number;radius:number;damageScale:number;projectileSpeed:number;shots:number;
}
export const ENEMY_ROLE_LABELS:Record<EnemyAttackRole,string>={
 'melee-fast':'Fast melee','melee-slow':'Heavy melee','ranged-burst':'Rapid burst','ranged-projectile':'Slow projectile',
 'explosive-suicide':'Self-destruct','explosive-bomb':'Bomb thrower',healer:'Healer',
};
/** Cooldown starts at release. Damage budgets include both anticipation and recovery.
 * Slow attacks commit to a direction or landing point so movement can evade them. */
const tuning:Record<EnemyAttackRole,Omit<EnemyAttackProfile,'speciesId'|'role'|'moveName'|'element'|'color'>>={
 'melee-fast':{cooldown:.85,windup:.24,range:2.4,radius:2.9,damageScale:.8,projectileSpeed:0,shots:1},
 'melee-slow':{cooldown:1.45,windup:.75,range:3.1,radius:3.7,damageScale:1.6,projectileSpeed:0,shots:1},
 'ranged-burst':{cooldown:1.65,windup:.5,range:15,radius:.24,damageScale:.55,projectileSpeed:17,shots:3},
 'ranged-projectile':{cooldown:1.9,windup:.65,range:18,radius:.58,damageScale:1.85,projectileSpeed:7.8,shots:1},
 'explosive-suicide':{cooldown:2,windup:1,range:4.4,radius:4.8,damageScale:2.1,projectileSpeed:0,shots:1},
 'explosive-bomb':{cooldown:2.2,windup:.7,range:17,radius:3.4,damageScale:2.1,projectileSpeed:5.8,shots:1},
 healer:{cooldown:4,windup:.8,range:9,radius:8,damageScale:0,projectileSpeed:0,shots:1},
};
const roleCodes:Record<string,EnemyAttackRole>={fast:'melee-fast',heavy:'melee-slow',burst:'ranged-burst',shot:'ranged-projectile',suicide:'explosive-suicide',bomb:'explosive-bomb',heal:'healer'};
/** Explicit assignments cover the entire roster. These are real Pokémon moves;
 * their arcade behavior adapts them to visible, avoidable battlefield roles. */
const rows=`
1|shot|Razor Leaf|grass
2|burst|Razor Leaf|grass
3|bomb|Seed Bomb|grass
4|shot|Ember|fire
5|burst|Ember|fire
6|shot|Flamethrower|fire
7|burst|Bubble|water
8|shot|Water Pulse|water
9|shot|Hydro Pump|water
10|heavy|Tackle|normal
11|heavy|Tackle|normal
12|heal|Pollen Puff|bug
13|burst|Poison Sting|poison
14|burst|Poison Sting|poison
15|fast|Twineedle|bug
16|burst|Gust|flying
17|fast|Wing Attack|flying
18|fast|Wing Attack|flying
19|fast|Quick Attack|normal
20|heavy|Hyper Fang|normal
21|fast|Peck|flying
22|heavy|Drill Peck|flying
23|fast|Bite|normal
24|heavy|Poison Fang|poison
25|burst|Thunder Shock|electric
26|shot|Thunderbolt|electric
27|fast|Scratch|normal
28|heavy|Slash|normal
29|burst|Poison Sting|poison
30|heavy|Bite|normal
31|shot|Earth Power|ground
32|fast|Peck|flying
33|heavy|Horn Attack|normal
34|heavy|Megahorn|bug
35|heal|Life Dew|water
36|heal|Life Dew|water
37|shot|Ember|fire
38|burst|Flamethrower|fire
39|heal|Wish|normal
40|heal|Wish|normal
41|fast|Bite|normal
42|fast|Leech Life|bug
43|shot|Absorb|grass
44|bomb|Sludge Bomb|poison
45|heal|Moonlight|normal
46|fast|Scratch|normal
47|bomb|Seed Bomb|grass
48|shot|Psybeam|psychic
49|burst|Gust|flying
50|fast|Scratch|normal
51|fast|Dig|ground
52|fast|Scratch|normal
53|fast|Slash|normal
54|shot|Water Gun|water
55|burst|Water Pulse|water
56|fast|Karate Chop|fighting
57|fast|Fury Swipes|normal
58|fast|Bite|normal
59|heavy|Fire Fang|fire
60|burst|Bubble|water
61|shot|Bubble Beam|water
62|heavy|Dynamic Punch|fighting
63|shot|Confusion|psychic
64|burst|Psybeam|psychic
65|shot|Psychic|psychic
66|heavy|Low Kick|fighting
67|heavy|Cross Chop|fighting
68|heavy|Dynamic Punch|fighting
69|shot|Acid|poison
70|burst|Acid|poison
71|bomb|Seed Bomb|grass
72|shot|Acid|poison
73|burst|Acid Spray|poison
74|bomb|Rock Throw|rock
75|suicide|Self-Destruct|normal
76|bomb|Rock Slide|rock
77|fast|Flame Charge|fire
78|fast|Flame Charge|fire
79|shot|Water Gun|water
80|shot|Scald|water
81|burst|Thunder Shock|electric
82|burst|Discharge|electric
83|fast|Cut|normal
84|fast|Peck|flying
85|fast|Drill Peck|flying
86|shot|Icy Wind|ice
87|shot|Aurora Beam|ice
88|bomb|Sludge|poison
89|bomb|Gunk Shot|poison
90|burst|Ice Shard|ice
91|burst|Icicle Spear|ice
92|shot|Shadow Ball|ghost
93|bomb|Shadow Ball|ghost
94|bomb|Shadow Ball|ghost
95|heavy|Slam|normal
96|shot|Confusion|psychic
97|shot|Psybeam|psychic
98|heavy|Vise Grip|normal
99|heavy|Crabhammer|water
100|suicide|Self-Destruct|normal
101|suicide|Explosion|normal
102|bomb|Egg Bomb|normal
103|bomb|Seed Bomb|grass
104|bomb|Bone Club|ground
105|bomb|Bonemerang|ground
106|heavy|High Jump Kick|fighting
107|fast|Mach Punch|fighting
108|heavy|Slam|normal
109|suicide|Self-Destruct|normal
110|suicide|Explosion|normal
111|heavy|Horn Attack|normal
112|heavy|Megahorn|bug
113|heal|Soft-Boiled|normal
114|shot|Energy Ball|grass
115|heavy|Dizzy Punch|normal
116|shot|Water Gun|water
117|burst|Bubble Beam|water
118|fast|Peck|flying
119|heavy|Horn Attack|normal
120|burst|Swift|normal
121|burst|Swift|normal
122|shot|Psybeam|psychic
123|fast|Fury Cutter|bug
124|shot|Ice Beam|ice
125|burst|Thunder Shock|electric
126|bomb|Fire Blast|fire
127|heavy|X-Scissor|bug
128|heavy|Take Down|normal
129|fast|Tackle|normal
130|shot|Hydro Pump|water
131|shot|Ice Beam|ice
132|fast|Struggle|normal
133|fast|Quick Attack|normal
134|shot|Water Pulse|water
135|burst|Pin Missile|bug
136|shot|Flamethrower|fire
137|burst|Tri Attack|normal
138|shot|Water Gun|water
139|bomb|Rock Blast|rock
140|fast|Scratch|normal
141|fast|Slash|normal
142|heavy|Bite|normal
143|heavy|Body Slam|normal
144|shot|Blizzard|ice
145|burst|Thunder|electric
146|bomb|Fire Blast|fire
147|shot|Dragon Rage|dragon
148|burst|Dragon Breath|dragon
149|heavy|Dragon Rush|dragon
150|shot|Psystrike|psychic
151|heal|Life Dew|water`.trim().split('\n');
const elementColors:Record<Element,string>={normal:'#e5c2a1',fire:'#ff9258',water:'#80ccec',grass:'#a5d77e',electric:'#f8df71',ice:'#b8edee',fighting:'#eead78',poison:'#cf9ae5',ground:'#d8b88b',flying:'#b8d9e4',psychic:'#e4a6e5',bug:'#c4d986',rock:'#ceb289',ghost:'#bd9be2',dragon:'#a79df0'};
export const ENEMY_ATTACK_PROFILES:readonly EnemyAttackProfile[]=rows.map(row=>{
 const [id,code,moveName,elementName]=row.split('|'),role=roleCodes[code],element=elementName as Element;
 return {speciesId:Number(id),role,moveName,element,color:role==='healer'?'#8be8ab':role==='explosive-suicide'?'#ff7864':role==='explosive-bomb'?'#f3ba71':elementColors[element],...tuning[role]};
});
const bySpecies=new Map(ENEMY_ATTACK_PROFILES.map(profile=>[profile.speciesId,profile]));
export function getEnemyAttackProfile(speciesId:number):EnemyAttackProfile {
 const profile=bySpecies.get(speciesId);if(!profile)throw Error(`Missing enemy attack profile ${speciesId}`);return profile;
}

/** Strong species have authored coverage moves with different battlefield shapes.
 * These are cycled one at a time, each with its own tell and recovery. Variants
 * unlock more of this species repertoire without changing their elemental type. */
const extraRows=`
3|fast|Vine Whip|grass;shot|Sludge Bomb|poison;burst|Razor Leaf|grass
6|heavy|Dragon Claw|dragon;bomb|Fire Blast|fire;burst|Air Slash|flying
9|heavy|Skull Bash|normal;burst|Bubble Beam|water;bomb|Surf|water
12|shot|Psybeam|psychic;burst|Gust|flying;fast|Tackle|normal
15|burst|Poison Sting|poison;shot|Pin Missile|bug;heavy|Poison Jab|poison
18|burst|Gust|flying;shot|Air Slash|flying;bomb|Hurricane|flying
31|heavy|Body Slam|normal;bomb|Sludge Bomb|poison;burst|Poison Sting|poison
34|shot|Earth Power|ground;bomb|Sludge Bomb|poison;fast|Double Kick|fighting
36|shot|Psychic|psychic;heavy|Body Slam|normal;burst|Swift|normal
38|fast|Quick Attack|normal;bomb|Fire Blast|fire;shot|Extrasensory|psychic
40|heavy|Body Slam|normal;burst|Hyper Voice|normal;shot|Ice Beam|ice
45|burst|Petal Dance|grass;shot|Acid|poison;bomb|Seed Bomb|grass
59|shot|Flamethrower|fire;bomb|Fire Blast|fire;fast|Extreme Speed|normal
62|burst|Bubble Beam|water;shot|Hydro Pump|water;bomb|Surf|water
65|fast|Psycho Cut|psychic;bomb|Shadow Ball|ghost;burst|Psybeam|psychic
68|shot|Focus Blast|fighting;bomb|Rock Slide|rock;fast|Bullet Punch|normal
71|fast|Vine Whip|grass;shot|Acid|poison;burst|Razor Leaf|grass
73|heavy|Poison Jab|poison;bomb|Sludge Bomb|poison;shot|Hydro Pump|water
76|heavy|Rock Smash|fighting;shot|Rock Blast|rock;burst|Rock Throw|rock
78|shot|Flamethrower|fire;bomb|Fire Blast|fire;heavy|Stomp|normal
80|heavy|Headbutt|normal;bomb|Psychic|psychic;burst|Water Pulse|water
82|shot|Tri Attack|normal;bomb|Zap Cannon|electric;fast|Tackle|normal
85|burst|Tri Attack|normal;shot|Air Slash|flying;heavy|Drill Peck|flying
87|heavy|Aqua Tail|water;burst|Ice Shard|ice;bomb|Surf|water
89|heavy|Poison Jab|poison;shot|Sludge Wave|poison;burst|Acid Spray|poison
91|heavy|Clamp|water;bomb|Hydro Pump|water;shot|Aurora Beam|ice
94|fast|Shadow Punch|ghost;shot|Psychic|psychic;burst|Sludge Wave|poison
95|shot|Rock Throw|rock;bomb|Rock Slide|rock;fast|Iron Tail|normal
99|burst|Bubble Beam|water;shot|Mud Shot|ground;bomb|Surf|water
103|shot|Psychic|psychic;heavy|Stomp|normal;burst|Bullet Seed|grass
106|shot|Focus Blast|fighting;bomb|Rock Slide|rock;fast|Double Kick|fighting
107|shot|Focus Blast|fighting;heavy|Fire Punch|fire;burst|Vacuum Wave|fighting
110|bomb|Sludge Bomb|poison;shot|Smog|poison;burst|Sludge Wave|poison
112|bomb|Rock Slide|rock;shot|Rock Blast|rock;fast|Horn Attack|normal
113|heavy|Double Slap|normal;shot|Ice Beam|ice;burst|Swift|normal
115|shot|Focus Blast|fighting;bomb|Rock Slide|rock;fast|Fake Out|normal
121|shot|Psychic|psychic;bomb|Surf|water;heavy|Rapid Spin|normal
123|shot|Air Slash|flying;burst|Vacuum Wave|fighting;heavy|Slash|normal
124|heavy|Ice Punch|ice;burst|Powder Snow|ice;bomb|Psychic|psychic
125|heavy|Thunder Punch|electric;shot|Thunderbolt|electric;bomb|Thunder|electric
126|heavy|Fire Punch|fire;shot|Flamethrower|fire;burst|Ember|fire
127|shot|Focus Blast|fighting;bomb|Rock Slide|rock;fast|Fury Cutter|bug
128|shot|Hyper Beam|normal;bomb|Rock Slide|rock;fast|Horn Attack|normal
130|heavy|Aqua Tail|water;bomb|Hurricane|flying;burst|Dragon Breath|dragon
131|heavy|Body Slam|normal;bomb|Surf|water;burst|Ice Shard|ice
134|fast|Quick Attack|normal;bomb|Surf|water;burst|Bubble Beam|water
135|heavy|Thunder Fang|electric;bomb|Thunder|electric;shot|Thunderbolt|electric
136|heavy|Fire Fang|fire;bomb|Fire Blast|fire;burst|Ember|fire
139|heavy|Ancient Power|rock;shot|Hydro Pump|water;burst|Water Gun|water
141|shot|Aqua Jet|water;bomb|Rock Slide|rock;heavy|X-Scissor|bug
142|shot|Air Slash|flying;bomb|Rock Slide|rock;burst|Ancient Power|rock
143|shot|Hyper Beam|normal;bomb|Rock Slide|rock;fast|Lick|ghost
144|heavy|Wing Attack|flying;bomb|Hurricane|flying;burst|Ice Shard|ice
145|heavy|Drill Peck|flying;bomb|Thunder|electric;shot|Thunderbolt|electric
146|heavy|Wing Attack|flying;shot|Flamethrower|fire;burst|Air Slash|flying
149|shot|Dragon Pulse|dragon;bomb|Hurricane|flying;shot|Hyper Beam|normal
150|heavy|Psycho Cut|psychic;bomb|Shadow Ball|ghost;burst|Aura Sphere|fighting
151|shot|Psychic|psychic;bomb|Ancient Power|rock;burst|Swift|normal`.trim().split('\n');
const authoredExtras=new Map(extraRows.map(row=>{
 const [id,...parts]=row.split('|'),moves=parts.join('|').split(';');
 return [Number(id),moves.map(move=>{
  const [code,moveName,elementName]=move.split('|');
  return {role:roleCodes[code],moveName,element:elementName as Element};
 })] as const;
}));
const coverageMoves:Record<Element,readonly [EnemyAttackRole,string][]>= {
 normal:[['melee-slow','Body Slam'],['ranged-projectile','Swift'],['ranged-burst','Hyper Voice'],['explosive-bomb','Egg Bomb']],
 fire:[['melee-slow','Fire Fang'],['ranged-projectile','Flamethrower'],['explosive-bomb','Fire Blast'],['ranged-burst','Ember']],
 water:[['melee-slow','Aqua Tail'],['ranged-projectile','Water Pulse'],['explosive-bomb','Surf'],['ranged-burst','Bubble Beam']],
 grass:[['melee-fast','Vine Whip'],['ranged-projectile','Energy Ball'],['explosive-bomb','Seed Bomb'],['ranged-burst','Razor Leaf']],
 electric:[['melee-slow','Thunder Fang'],['ranged-projectile','Thunderbolt'],['explosive-bomb','Thunder'],['ranged-burst','Discharge']],
 ice:[['melee-slow','Ice Fang'],['ranged-projectile','Ice Beam'],['explosive-bomb','Blizzard'],['ranged-burst','Ice Shard']],
 fighting:[['melee-fast','Mach Punch'],['ranged-projectile','Focus Blast'],['explosive-bomb','Focus Blast'],['ranged-burst','Vacuum Wave']],
 poison:[['melee-slow','Poison Jab'],['ranged-projectile','Sludge'],['explosive-bomb','Sludge Bomb'],['ranged-burst','Poison Sting']],
 ground:[['melee-slow','Dig'],['ranged-projectile','Mud Shot'],['explosive-bomb','Mud Bomb'],['ranged-burst','Mud Slap']],
 flying:[['melee-fast','Wing Attack'],['ranged-projectile','Air Slash'],['explosive-bomb','Hurricane'],['ranged-burst','Gust']],
 psychic:[['melee-fast','Psycho Cut'],['ranged-projectile','Psychic'],['explosive-bomb','Psyshock'],['ranged-burst','Psybeam']],
 bug:[['melee-fast','Fury Cutter'],['ranged-projectile','Signal Beam'],['explosive-bomb','Bug Buzz'],['ranged-burst','Pin Missile']],
 rock:[['melee-slow','Rock Smash'],['ranged-projectile','Rock Blast'],['explosive-bomb','Rock Slide'],['ranged-burst','Rock Throw']],
 ghost:[['melee-fast','Shadow Punch'],['ranged-projectile','Shadow Ball'],['explosive-bomb','Night Shade'],['ranged-burst','Hex']],
 dragon:[['melee-slow','Dragon Rush'],['ranged-projectile','Dragon Pulse'],['explosive-bomb','Draco Meteor'],['ranged-burst','Dragon Breath']],
};
function extraProfile(speciesId:number,role:EnemyAttackRole,moveName:string,element:Element):EnemyAttackProfile {
 const profile={speciesId,role,moveName,element,color:elementColors[element],...tuning[role]};
 // The strongest fourth-slot finisher is deliberately slower and easier to read.
 return moveName==='Hyper Beam'?{...profile,windup:1.15,cooldown:2.8,damageScale:2.7,radius:.8,projectileSpeed:12}:profile;
}
const fullLoadouts=new Map(ENEMY_ATTACK_PROFILES.map(base=>{
 const moves=[base],used=new Set([base.moveName]);
 for(const authored of authoredExtras.get(base.speciesId)??[]){
  if(!used.has(authored.moveName)){moves.push(extraProfile(base.speciesId,authored.role,authored.moveName,authored.element));used.add(authored.moveName);}
 }
 // Weak species only use these if an encounter explicitly promotes their tier.
 // Coverage never grants another self-destruct or replaces a healing primary.
 const elements=[...getSpecies(base.speciesId).types,base.element];
 for(const element of elements)for(const [role,moveName] of coverageMoves[element]){
  if(moves.length>=4)break;
  if(!used.has(moveName)){moves.push(extraProfile(base.speciesId,role,moveName,element));used.add(moveName);}
 }
 return [base.speciesId,Object.freeze(moves.slice(0,4))] as const;
}));
/** Every actual repertoire move is available to the renderer's label atlas. */
export const ENEMY_MOVE_PROFILES:readonly EnemyAttackProfile[]=Object.freeze([...fullLoadouts.values()].flat());
export interface EnemyAttackIdentity {
 speciesId:number;variant:Variant;isBoss:boolean;combatTier?:ReturnType<typeof getEnemyTier>;hardShrine?:boolean;attackIndex?:number;
}
export function getEnemyAttackLoadout(enemy:EnemyAttackIdentity,elapsed:number):readonly EnemyAttackProfile[]{
 const tier=enemy.combatTier??getEnemyTier(enemy.speciesId,enemy.variant,enemy.isBoss);
 const limit=enemyAttackLimit(tier,elapsed,getEnemySpeciesProfile(enemy.speciesId).strength,enemy.hardShrine??false);
 return fullLoadouts.get(enemy.speciesId)!.slice(0,limit);
}
/** Resolve from the whole repertoire so an already committed tell survives a
 * clock/tier change while paused, or a restored save with a different move slot. */
export function resolveCommittedEnemyProfile(enemy:EnemyAttackIdentity,windup:{moveName?:string;role?:EnemyAttackRole;moveIndex?:number},elapsed:number):EnemyAttackProfile {
 const full=fullLoadouts.get(enemy.speciesId)!;
 const loadout=getEnemyAttackLoadout(enemy,elapsed),index=(windup.moveIndex??enemy.attackIndex??0)%loadout.length;
 const profile=full.find(move=>move.moveName===windup.moveName)??loadout[index]??full[0];
 return withEnemyAttackRole(profile,windup.role??profile.role);
}
/** Support enemies retain their named healing move, but use this lightweight
 * fallback profile when there is nobody nearby to support. */
export function withEnemyAttackRole(profile:EnemyAttackProfile,role:EnemyAttackRole):EnemyAttackProfile {
 if(role===profile.role)return profile;
 return {...profile,...tuning[role],role,moveName:'Quick Attack'};
}

const ELITE_AREA_MOVES:Record<Element,string>={normal:'Body Slam',fire:'Heat Wave',water:'Surf',grass:'Petal Blizzard',electric:'Discharge',ice:'Blizzard',fighting:'Force Palm',poison:'Sludge Wave',ground:'Earthquake',flying:'Air Slash',psychic:'Psychic',bug:'Bug Buzz',rock:'Rock Slide',ghost:'Shadow Ball',dragon:'Dragon Pulse'};
/** Elite area attacks retain the species' element and use a recognizable move. */
export function getEliteAreaMove(speciesId:number):{moveName:string;element:Element;color:string}{
 const profile=getEnemyAttackProfile(speciesId);
 return {moveName:ELITE_AREA_MOVES[profile.element],element:profile.element,color:elementColors[profile.element]};
}
