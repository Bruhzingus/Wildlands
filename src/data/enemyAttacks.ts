import type {Element} from './kanto.ts';

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
76|suicide|Explosion|normal
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
