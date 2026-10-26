import {ATTACK_ARCHETYPES,ATTACK_DESCRIPTIONS,ELEMENT_PROCS,type AttackDefinition} from './attackDefinitions.ts';
import {KANTO,type AttackKind,type Element} from './kanto.ts';
import {SPECIES_ATTACK_PARAMETERS} from './rosterContent.ts';
import {PROGRESSION} from './progression.ts';

export interface LearnableMove {
 id:string;name:string;element:Element;power:number;description:string;
 profile:AttackDefinition;
}
/** Reference move power for signatures without a separate authored power value. */
export const SIGNATURE_BASE_POWER=23;

// Prefer an authored pattern over a generic archetype when a move is shared.
// Bite uses Growlithe's pounce; Swift uses Eevee's seeking stars for every caster.
const signatureSources=new Map<string,(typeof KANTO)[number]>();
for(const species of KANTO){
 const previous=signatureSources.get(species.moveName);
 if(!previous||!SPECIES_ATTACK_PARAMETERS[previous.id]?.pattern&&SPECIES_ATTACK_PARAMETERS[species.id]?.pattern)
  signatureSources.set(species.moveName,species);
}
function signatureProfile(name:string,element?:Element):AttackDefinition|undefined {
 const species=signatureSources.get(name);if(!species)return;
 const override=SPECIES_ATTACK_PARAMETERS[species.id]||{},base=ATTACK_ARCHETYPES[override.kind||species.attack];
 const type=element??override.element??species.types[0];
 return {...base,...override,element:type,description:override.description??ATTACK_DESCRIPTIONS[base.kind],growth:{...base.growth,...override.growth},
  status:{...ELEMENT_PROCS[type],...base.status,...override.status}};
}
type MoveInput={id:string;name:string;element:Element;kind:AttackKind;power:number;description:string;cooldown:number;overrides?:Partial<AttackDefinition>};
function signatureMove(input:Pick<LearnableMove,'id'|'name'|'element'|'power'>):LearnableMove {
 const profile=signatureProfile(input.name,input.element);
 if(!profile)throw new Error(`Missing signature profile: ${input.name}`);
 return {...input,description:profile.description!,profile};
}
function move(input:MoveInput):LearnableMove {
 const base=ATTACK_ARCHETYPES[input.kind];
 const profile={...base,...input.overrides,element:input.element,cooldown:input.cooldown,
  growth:{...base.growth,damage:6,range:(input.overrides?.range??base.range)*PROGRESSION.moves.rangePerRank,
   radius:(input.overrides?.radius??base.radius)*PROGRESSION.moves.rangePerRank,
   projectilesEvery:input.kind==='bolt'||input.kind==='lob'?2:0,chainsEvery:input.kind==='chain'?2:0,...input.overrides?.growth},
  status:{...ELEMENT_PROCS[input.element],...base.status,...input.overrides?.status}};
 return {id:input.id,name:input.name,element:input.element,power:input.power,description:profile.description??input.description,profile};
}

/** Extra attacks run on independent cooldowns. Names and species eligibility
 * come from real learnsets; run-level gates and combat values are adapted. */
export const LEARNABLE_MOVES:readonly LearnableMove[]=[
 signatureMove({id:'razor-leaf',name:'Razor Leaf',element:'grass',power:22}),
 signatureMove({id:'ember',name:'Ember',element:'fire',power:22}),
 signatureMove({id:'water-gun',name:'Water Gun',element:'water',power:23}),
 signatureMove({id:'thunder-shock',name:'Thunder Shock',element:'electric',power:21}),
 signatureMove({id:'gust',name:'Gust',element:'flying',power:22}),
 signatureMove({id:'tackle',name:'Tackle',element:'normal',power:23}),
 signatureMove({id:'quick-attack',name:'Quick Attack',element:'normal',power:24}),
 signatureMove({id:'bug-bite',name:'Bug Bite',element:'bug',power:25}),
 signatureMove({id:'confusion',name:'Confusion',element:'psychic',power:24}),
 signatureMove({id:'swift',name:'Swift',element:'normal',power:20}),
 signatureMove({id:'body-slam',name:'Body Slam',element:'normal',power:30}),
 signatureMove({id:'hyper-beam',name:'Hyper Beam',element:'normal',power:43}),
 move({id:'double-edge',name:'Double-Edge',element:'normal',kind:'slash',power:39,cooldown:3.8,description:'Strikes a wide arc with heavy close-range damage.',overrides:{radius:6,range:7,damageScale:1.3}}),
 signatureMove({id:'flame-burst',name:'Flame Burst',element:'fire',power:29}),
 signatureMove({id:'fire-blast',name:'Fire Blast',element:'fire',power:38}),
 signatureMove({id:'water-pulse',name:'Water Pulse',element:'water',power:28}),
 signatureMove({id:'surf',name:'Surf',element:'water',power:33}),
 signatureMove({id:'seed-bomb',name:'Seed Bomb',element:'grass',power:30}),
 move({id:'solar-beam',name:'Solar Beam',element:'grass',kind:'beam',power:44,cooldown:4.7,description:'Fires a long beam through several enemies.',overrides:{pierce:6,range:23}}),
 move({id:'shock-wave',name:'Shock Wave',element:'electric',kind:'chain',power:24,cooldown:3.2,description:'Arcs between three enemies.',overrides:{chains:3}}),
 signatureMove({id:'discharge',name:'Discharge',element:'electric',power:32}),
 signatureMove({id:'ice-beam',name:'Ice Beam',element:'ice',power:32}),
 signatureMove({id:'blizzard',name:'Blizzard',element:'ice',power:35}),
 move({id:'brick-break',name:'Brick Break',element:'fighting',kind:'slash',power:34,cooldown:2.9,description:'Delivers a heavy, close-range chopping strike.',overrides:{radius:5.8,range:6.5}}),
 signatureMove({id:'focus-blast',name:'Focus Blast',element:'fighting',power:42}),
 signatureMove({id:'sludge-bomb',name:'Sludge Bomb',element:'poison',power:29}),
 move({id:'poison-jab',name:'Poison Jab',element:'poison',kind:'slash',power:31,cooldown:2.7,description:'Quickly jabs nearby enemies with poison.',overrides:{status:{poison:.5}}}),
 move({id:'mud-shot',name:'Mud Shot',element:'ground',kind:'bolt',power:25,cooldown:2.7,description:'Fires slowing mud projectiles.',overrides:{projectiles:2,speed:14,status:{slow:.5}}}),
 signatureMove({id:'earthquake',name:'Earthquake',element:'ground',power:40}),
 signatureMove({id:'air-slash',name:'Air Slash',element:'flying',power:29}),
 move({id:'hurricane',name:'Hurricane',element:'flying',kind:'burst',power:37,cooldown:4.2,description:'Catches groups of enemies in a wide wind blast.',overrides:{radius:6}}),
 signatureMove({id:'psybeam',name:'Psybeam',element:'psychic',power:28}),
 move({id:'future-sight',name:'Future Sight',element:'psychic',kind:'lob',power:42,cooldown:4.6,description:'Sends a slow psychic blast that erupts on impact.',overrides:{speed:9,radius:4.2}}),
 signatureMove({id:'pin-missile',name:'Pin Missile',element:'bug',power:19}),
 signatureMove({id:'bug-buzz',name:'Bug Buzz',element:'bug',power:31}),
 signatureMove({id:'rock-slide',name:'Rock Slide',element:'rock',power:32}),
 signatureMove({id:'stone-edge',name:'Stone Edge',element:'rock',power:34}),
 signatureMove({id:'shadow-ball',name:'Shadow Ball',element:'ghost',power:32}),
 move({id:'shadow-claw',name:'Shadow Claw',element:'ghost',kind:'slash',power:33,cooldown:2.9,description:'Rakes a broad arc with spectral claws.',overrides:{radius:5.7,range:6.5}}),
 signatureMove({id:'dragon-pulse',name:'Dragon Pulse',element:'dragon',power:35}),
 signatureMove({id:'dragon-breath',name:'Dragon Breath',element:'dragon',power:27}),
];
const BY_ID=new Map(LEARNABLE_MOVES.map(definition=>[definition.id,definition]));
export function getMoveDefinition(id:string):LearnableMove|undefined{return BY_ID.get(id);}

const BY_NAME=new Map(LEARNABLE_MOVES.map(definition=>[definition.name,definition]));
for(const [name,species] of signatureSources){
 if(BY_NAME.has(name))continue;
 const profile=signatureProfile(name)!;
 BY_NAME.set(name,{id:`signature-${species.id}`,name,element:profile.element!,power:SIGNATURE_BASE_POWER,
  description:profile.description??name,profile});
}
/** One definition supplies every signature and learned occurrence of a named move. */
export function getSignatureMoveDefinition(name:string):LearnableMove {
 const definition=BY_NAME.get(name);if(!definition)throw new Error(`Unknown signature move: ${name}`);
 return definition;
}
