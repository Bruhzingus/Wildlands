import type {AttackKind} from './kanto.ts';
import type {AttackDefinition,StatusProc} from './attacks.ts';

export type CombatRole='ranged'|'skirmisher'|'area'|'control'|'piercing'|'support';
export interface SpeciesCombat {id:number;role:CombatRole;attack:AttackKind;moveName:string;power:number;}
/** One deliberate loadout per original Kanto species. These are arcade moves,
 * not a claim to reproduce cartridge learnsets or official base stats. Weak
 * species receive usable attacks; every evolution increases its power budget. */
const rows=`
1|area|lob|Vine Whip|11
2|area|lob|Razor Leaf|16
3|area|lob|Petal Blizzard|23
4|ranged|bolt|Ember|14
5|ranged|bolt|Flame Burst|19
6|area|burst|Flamethrower|27
7|ranged|bolt|Bubble|11
8|ranged|bolt|Water Gun|16
9|ranged|bolt|Hydro Cannon|23
10|control|bolt|String Shot|13
11|control|bolt|Bug Bite|18
12|area|lob|Pollen Puff|25
13|skirmisher|slash|Poison Sting|13
14|skirmisher|slash|Pin Missile|18
15|skirmisher|slash|Twineedle|25
16|ranged|bolt|Gust|12
17|ranged|bolt|Wing Attack|17
18|ranged|bolt|Air Cutter|24
19|skirmisher|slash|Quick Attack|13
20|skirmisher|slash|Hyper Fang|21
21|ranged|bolt|Peck|12
22|ranged|bolt|Drill Peck|21
23|control|aura|Wrap|13
24|control|aura|Gunk Shot|22
25|control|chain|Thunder Shock|14
26|control|chain|Thunderbolt|23
27|area|burst|Sand Attack|13
28|area|burst|Sand Tomb|22
29|control|bolt|Venoshock|12
30|control|bolt|Toxic|17
31|control|bolt|Earth Power|24
32|control|bolt|Horn Attack|12
33|control|bolt|Fury Attack|17
34|control|bolt|Bulldoze|24
35|ranged|bolt|Disarming Voice|15
36|ranged|bolt|Moonblast|24
37|ranged|bolt|Will-O-Wisp|13
38|area|burst|Fire Spin|25
39|control|aura|Sing|16
40|control|aura|Hyper Voice|25
41|skirmisher|slash|Bite|13
42|skirmisher|slash|Leech Life|22
43|area|lob|Absorb|13
44|area|lob|Mega Drain|18
45|area|lob|Petal Dance|25
46|skirmisher|slash|Scratch|13
47|skirmisher|slash|X-Scissor|22
48|control|bolt|Confusion|13
49|control|bolt|Bug Buzz|22
50|area|burst|Mud-Slap|14
51|area|burst|Earthquake|23
52|ranged|bolt|Pay Day|14
53|ranged|bolt|Power Gem|23
54|ranged|bolt|Water Pulse|13
55|ranged|bolt|Hydro Pump|22
56|skirmisher|slash|Karate Chop|14
57|skirmisher|slash|Close Combat|23
58|skirmisher|slash|Bite|14
59|skirmisher|slash|Fire Fang|26
60|ranged|bolt|Bubble Beam|12
61|ranged|bolt|Muddy Water|17
62|ranged|bolt|Dynamic Punch|24
63|piercing|beam|Stored Power|12
64|piercing|beam|Psybeam|17
65|piercing|beam|Psychic|24
66|skirmisher|slash|Low Kick|13
67|skirmisher|slash|Cross Chop|18
68|skirmisher|slash|Focus Blast|25
69|area|lob|Acid|12
70|area|lob|Leaf Tornado|17
71|area|lob|Leaf Storm|24
72|control|bolt|Acid Spray|13
73|control|bolt|Sludge Bomb|22
74|area|lob|Rock Throw|14
75|area|lob|Rock Slide|19
76|area|lob|Stone Edge|26
77|ranged|bolt|Flame Charge|14
78|ranged|bolt|Flare Blitz|23
79|control|bolt|Yawn|14
80|control|bolt|Scald|23
81|control|chain|Spark|14
82|control|chain|Discharge|23
83|skirmisher|slash|Cut|20
84|ranged|bolt|Double Hit|14
85|ranged|bolt|Tri Attack|23
86|control|bolt|Icy Wind|14
87|control|bolt|Aurora Beam|23
88|control|aura|Sludge|15
89|control|aura|Sludge Wave|24
90|ranged|bolt|Ice Shard|14
91|ranged|bolt|Spike Cannon|23
92|control|aura|Lick|14
93|control|aura|Night Shade|19
94|control|aura|Shadow Ball|26
95|area|lob|Rock Blast|20
96|piercing|beam|Dream Eater|14
97|piercing|beam|Psyshock|23
98|skirmisher|slash|Vise Grip|14
99|skirmisher|slash|Crabhammer|23
100|control|chain|Charge Beam|14
101|control|chain|Electro Ball|23
102|area|lob|Seed Bomb|14
103|area|lob|Barrage|23
104|area|lob|Bone Club|14
105|area|lob|Bonemerang|23
106|skirmisher|slash|Rolling Kick|21
107|skirmisher|slash|Comet Punch|21
108|area|aura|Slam|22
109|control|aura|Poison Gas|15
110|control|aura|Smog|24
111|area|burst|Horn Drill|15
112|area|burst|Rock Wrecker|24
113|support|heal|Heal Pulse|19
114|area|lob|Giga Drain|20
115|ranged|bolt|Dizzy Punch|21
116|ranged|bolt|Brine|13
117|ranged|bolt|Dragon Pulse|22
118|ranged|bolt|Waterfall|14
119|ranged|bolt|Aqua Tail|23
120|ranged|bolt|Swift|14
121|ranged|bolt|Dazzling Gleam|23
122|piercing|beam|Psywave|21
123|skirmisher|slash|Fury Cutter|21
124|control|beam|Draining Kiss|21
125|control|chain|Thunder Punch|21
126|area|burst|Lava Plume|22
127|skirmisher|slash|Guillotine|21
128|skirmisher|slash|Take Down|21
129|skirmisher|slash|Tackle|14
130|piercing|beam|Hyper Beam|25
131|piercing|beam|Ice Beam|22
132|ranged|bolt|Struggle|20
133|ranged|bolt|Swift|14
134|ranged|bolt|Surf|25
135|control|chain|Volt Switch|25
136|area|burst|Overheat|27
137|piercing|beam|Signal Beam|21
138|area|lob|Ancient Power|14
139|area|lob|Whirlpool|23
140|skirmisher|slash|Aqua Jet|14
141|skirmisher|slash|Slash|23
142|ranged|bolt|Air Slash|23
143|area|aura|Body Slam|24
144|piercing|beam|Blizzard|26
145|control|chain|Thunder|26
146|area|burst|Fire Blast|28
147|piercing|beam|Dragon Breath|14
148|piercing|beam|Dragon Rage|19
149|piercing|beam|Draco Meteor|26
150|piercing|beam|Psystrike|29
151|area|burst|Expanding Force|28`.trim().split('\n');
export const SPECIES_COMBAT:readonly SpeciesCombat[]=rows.map(row=>{
 const [id,role,attack,moveName,power]=row.split('|');
 return {id:Number(id),role:role as CombatRole,attack:attack as AttackKind,moveName,power:Number(power)};
});
const combatById=new Map(SPECIES_COMBAT.map(row=>[row.id,row]));
export function getSpeciesCombat(id:number):SpeciesCombat {const profile=combatById.get(id);if(!profile)throw Error(`Missing species loadout ${id}`);return profile;}
export const LEGENDARY_SPECIES:readonly number[]=[144,145,146,150,151];
export const GATED_RECRUIT_SPECIES:readonly number[]=[83,95,114,108,115,127,128,131,137,142,143];
export const ROLE_LABELS:Record<CombatRole,string>={ranged:'Ranged shots',skirmisher:'Close sweep',area:'Area pressure',control:'Crowd control',piercing:'Piercing line',support:'Squad healing'};

type AttackTuning=Partial<Omit<AttackDefinition,'growth'|'status'>> & {growth?:Partial<AttackDefinition['growth']>;status?:StatusProc};
/** Families select reusable mechanics and different rank breakpoints. Evolutions
 * keep their family's handling while gaining its larger base power budget. */
const starterFamilies:readonly [readonly number[],AttackTuning][]=[
 [[1,2,3],{pattern:'vine',kind:'slash',range:14,radius:.5,width:.5,projectiles:1,pierce:1,cooldown:.95,damageScale:1.05,
  description:'Vines lash through a narrow lane, piercing enemies. Training forks the lash into more lanes.',
  growth:{damage:3.5,range:.4,radius:.025},milestones:[{rank:3,description:'Twin vine lanes',projectiles:2},{rank:6,description:'Three lanes pierce four foes each',projectiles:3,pierce:3}]}],
 [[4,5,6,136],{pattern:'flame-fan',kind:'bolt',range:10,speed:17,lifetime:.65,projectiles:3,pierce:0,spread:.24,cooldown:.78,damageScale:.48,silhouette:'needle',turnRate:0,status:{burn:.3},
  description:'A short fan of straight flames. Close enemies can catch several flames; training widens and pierces the fan.',
  growth:{damage:3,range:.22,radius:0},milestones:[{rank:4,description:'Five-flame fan',projectiles:5},{rank:7,description:'Flames pierce two enemies',pierce:1,status:{burn:.55}}]}],
 [[7,8,9,134],{pattern:'bubble-stream',kind:'bolt',range:16,speed:11,lifetime:1.6,projectiles:1,spread:.09,turnRate:2.2,splashRadius:.9,cooldown:.9,damageScale:.9,silhouette:'orb',
  description:'Slow bubbles burst into soaking splashes. Training adds bubbles and larger impact splashes.',
  growth:{damage:3.5,range:.3,radius:0},milestones:[{rank:2,description:'Wider soaking splashes',splashRadius:1.6},{rank:5,description:'Twin bubble stream',projectiles:2},{rank:8,description:'Triple bubbles with broad splashes',projectiles:3,splashRadius:2.3}]}],
 [[10,11,12],{pattern:'thread',kind:'beam',range:14,width:.3,radius:.3,projectiles:1,pierce:0,cooldown:1.05,damageScale:.8,status:{slow:1},
  description:'A binding silk line slows the first enemy. Training lets the thread bind a whole row.',
  growth:{damage:2.6,range:.45,radius:.015},milestones:[{rank:2,description:'Silk binds two enemies',pierce:1},{rank:5,description:'Thick silk binds four enemies',pierce:3,width:.6},{rank:7,description:'Binding silk can stun',status:{stun:.45}}]}],
 [[16,17,18],{pattern:'gust',kind:'bolt',range:13,speed:15,projectiles:1,pierce:3,width:.7,knockback:1.6,cooldown:1.1,damageScale:.9,silhouette:'beam',turnRate:0,
  description:'A wide gust travels straight through crowds and pushes them back. Training splits it into wind lanes.',
  growth:{damage:3.2,range:.38,radius:0},milestones:[{rank:3,description:'Stronger gust knockback',knockback:2.8,width:1},{rank:5,description:'Twin gust lanes',projectiles:2,spread:.3},{rank:8,description:'Three gust lanes',projectiles:3,pierce:6}]}],
 [[27,28],{pattern:'sand-wave',kind:'burst',range:9,radius:1.7,width:1.7,projectiles:1,pierce:15,cooldown:1.15,damageScale:1,status:{slow:.45},
  description:'A broad ground wave hits enemies ahead while leaving the rear exposed. Training adds flanking waves.',
  growth:{damage:4.5,range:.3,radius:.08},milestones:[{rank:4,description:'Twin flanking ground waves',projectiles:2},{rank:6,description:'Three broad ground waves',projectiles:3,width:2.2}]}],
 [[37,38],{pattern:'foxfire',kind:'bolt',range:13,radius:0,projectiles:2,speed:10,lifetime:1.5,orbitRadius:2,orbitSpeed:4.8,pierce:2,cooldown:1.65,damageScale:.65,silhouette:'orb',
  description:'Foxfires spiral around the selected enemy, burning foes along their orbit. Training adds orbiting flames.',
  growth:{damage:3,range:.28,radius:0},milestones:[{rank:3,description:'Three orbiting foxfires',projectiles:3},{rank:6,description:'Four foxfires sweep a wider orbit',projectiles:4,orbitRadius:2.8,pierce:4}]}],
 [[43,44,45],{pattern:'spores',kind:'lob',range:15,radius:2.8,speed:9,lifetime:1.9,projectiles:1,cooldown:1.4,damageScale:.9,status:{poison:.7,slow:.6},
  description:'Spore pods lob into poisonous, slowing impact clouds. Training scatters pods across separate enemies.',
  growth:{damage:3.2,range:.25,radius:.13,projectilesEvery:0},milestones:[{rank:4,description:'Pods scatter toward two enemies',projectiles:2},{rank:7,description:'Three pods; every cloud poisons',projectiles:3,status:{poison:1}}]}],
 [[52,53],{pattern:'ricochet',kind:'bolt',range:16,speed:23,projectiles:1,bounces:1,bounceRange:5.5,turnRate:0,cooldown:.9,damageScale:.95,silhouette:'needle',
  description:'Coins ricochet between different enemies after impact. Training adds bounces and a second coin.',
  growth:{damage:3.6,range:.32,radius:0},milestones:[{rank:2,description:'Coins bounce twice',bounces:2},{rank:5,description:'Four ricochet bounces',bounces:4,bounceRange:7},{rank:8,description:'Twin ricochet coins',projectiles:2}]}],
 [[58,59],{pattern:'pounce',kind:'slash',range:9,radius:2.2,width:2.2,projectiles:1,strikes:1,cooldown:1.15,damageScale:1.05,knockback:1.8,
  description:'A lunging bite sweeps the path to its target and shoves enemies forward. Training adds a follow-up bite.',
  growth:{damage:4.5,range:.32,radius:.05},milestones:[{rank:3,description:'Longer, forceful pounce',knockback:3,width:2.7},{rank:6,description:'Follow-up bite on the target',strikes:2}]}],
 [[63,64,65],{pattern:'psychic-cross',kind:'beam',range:18,speed:30,projectiles:2,pierce:3,width:.32,cooldown:1.35,damageScale:.7,silhouette:'beam',turnRate:0,
  description:'Two piercing psychic lances cross at the target from opposing angles. Training adds another crossing pair.',
  growth:{damage:3.4,range:.45,radius:0},milestones:[{rank:4,description:'Crossing lances pierce six enemies',pierce:5},{rank:7,description:'Four crossing lances',projectiles:4}]}],
 [[66,67,68],{pattern:'combo',kind:'slash',range:5.4,radius:4.5,projectiles:0,strikes:2,cooldown:.95,damageScale:.6,
  description:'A close forward chop hits twice. Training adds a third strike and a heavy crowd-clearing finisher.',
  growth:{damage:4.2,range:.18,radius:.1},milestones:[{rank:3,description:'Three-hit chop combo',strikes:3},{rank:5,description:'Finisher pushes back the crowd',knockback:2},{rank:8,description:'Four-hit combo',strikes:4}]}],
 [[92,93,94],{pattern:'haunt',kind:'aura',range:8,radius:0,projectiles:2,speed:12,lifetime:2.2,orbitRadius:3,orbitSpeed:3,pierce:4,cooldown:2,damageScale:.7,silhouette:'orb',status:{poison:.35,slow:.3},
  description:'Ghost wisps orbit their owner, haunting enemies that cross the ring. Training adds wisps and widens the ring.',
  growth:{damage:3.4,range:.22,radius:0},milestones:[{rank:2,description:'Wider haunting orbit',orbitRadius:4},{rank:5,description:'Three ghost wisps',projectiles:3},{rank:7,description:'Four wisps reach more enemies',projectiles:4,pierce:7}]}],
 [[133],{pattern:'swift',kind:'bolt',range:16,speed:19,projectiles:2,pierce:0,turnRate:10,cooldown:1.05,damageScale:.7,silhouette:'star',
  description:'Swift stars seek separate enemies, spreading damage across the crowd. Training adds independent seeking stars.',
  growth:{damage:3.3,range:.35,radius:0},milestones:[{rank:3,description:'Three independently seeking stars',projectiles:3},{rank:6,description:'Four stars pierce once',projectiles:4,pierce:1},{rank:8,description:'Six seeking stars',projectiles:6}]}],
];
const starterSignatures=Object.fromEntries(starterFamilies.flatMap(([ids,tuning])=>ids.map(id=>[id,tuning]))) as Record<number,AttackTuning>;
/** Signatures select shared combat patterns; simulation never branches on species IDs. */
export const SPECIES_ATTACK_PARAMETERS:Readonly<Record<number,AttackTuning>>={
 1:{radius:2.3},3:{radius:3.9,cooldown:1.1},4:{speed:21,status:{burn:.28}},6:{radius:4.7,damageScale:1.08},
 7:{speed:18},10:{status:{slow:.35}},11:{status:{slow:.4}},12:{radius:3.2,damageScale:1,status:{slow:.35}},15:{cooldown:.59},
 38:{radius:4.6,damageScale:.98},65:{pierce:6},
 76:{radius:4.8},82:{chains:4},94:{radius:5,status:{poison:.22}},
 113:{cooldown:1.9},123:{range:6,radius:5.1,cooldown:.57},130:{pierce:5,damageScale:1.22,element:'normal'},131:{pierce:5,status:{slow:.4}},
 135:{chains:4,chainRange:5.6},136:{damageScale:.97},143:{radius:5.4},149:{pierce:6,projectiles:2},150:{pierce:7},
 ...starterSignatures,
 41:{element:'normal',description:'A close Bite strikes enemies ahead without a poison burst.'},
 58:{...starterSignatures[58],element:'normal',status:{burn:0}},
 59:{...starterSignatures[59],damageScale:.98,status:{burn:.35},description:'A flaming fang lunges through enemies, biting and sometimes burning them.'},
 129:{pattern:'tackle',kind:'slash',element:'normal',range:2.7,radius:1.5,cooldown:1.25,damageScale:.5,description:'A weak close-range body tackle hits the foe directly. Splash leap helps Magikarp reach or escape enemies.'},
 9:{...starterSignatures[9],projectiles:3,pierce:1,milestones:starterSignatures[9].milestones?.map(step=>({...step,...(step.projectiles?{projectiles:step.projectiles+2,description:`${step.projectiles+2}-bubble hydro stream`}:{} )}))},
 25:{chains:3,chainRange:4.7,status:{stun:.08},description:'Lightning jumps between nearby enemies. Training adds longer chains and stronger stuns.',growth:{damage:3.8,range:.3,chainsEvery:0},milestones:[{rank:3,description:'Four-target chain',chains:4},{rank:5,description:'Longer arcs can stun',chainRange:6,status:{stun:.22}},{rank:7,description:'Six-target chain',chains:6,status:{stun:.4}}]},
 26:{chains:4,chainRange:5.3,status:{stun:.12},description:'Lightning jumps between nearby enemies. Training adds longer chains and stronger stuns.',growth:{damage:3.8,range:.3,chainsEvery:0},milestones:[{rank:3,description:'Five-target chain',chains:5},{rank:5,description:'Longer arcs can stun',chainRange:6.5,status:{stun:.28}},{rank:7,description:'Seven-target chain',chains:7,status:{stun:.45}}]},
 134:{...starterSignatures[134],projectiles:3,milestones:starterSignatures[134].milestones?.map(step=>({...step,...(step.projectiles?{projectiles:step.projectiles+2,description:`${step.projectiles+2}-bubble aqua stream`}:{} )}))},
};
