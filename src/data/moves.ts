import {ATTACK_ARCHETYPES,ELEMENT_PROCS,type AttackDefinition} from './attacks.ts';
import {getSpecies,type AttackKind,type Element} from './kanto.ts';
import {PROGRESSION} from './progression.ts';
import {SPECIES_LEARNSETS} from './learnsets.ts';

export interface LearnableMove {
 id:string;name:string;element:Element;power:number;description:string;
 profile:AttackDefinition;
}
/** The species' signature attack occupies the first of four total move slots. */
export const MAX_LEARNED_MOVES=3;
/** Move training has no rank ceiling. */
export const MAX_LEARNED_MOVE_RANK=Math.max(PROGRESSION.moves.maxRank,PROGRESSION.moves.soloMaxRank);
type MoveInput={id:string;name:string;element:Element;kind:AttackKind;power:number;description:string;cooldown:number;overrides?:Partial<AttackDefinition>};
function move(input:MoveInput):LearnableMove {
 const base=ATTACK_ARCHETYPES[input.kind];
 return {id:input.id,name:input.name,element:input.element,power:input.power,description:input.description,
  profile:{...base,...input.overrides,cooldown:input.cooldown,
   growth:{...base.growth,damage:6,projectilesEvery:input.kind==='bolt'||input.kind==='lob'?2:0,chainsEvery:input.kind==='chain'?2:0,...input.overrides?.growth},
   status:{...ELEMENT_PROCS[input.element],...base.status,...input.overrides?.status}}};
}

/** Extra attacks run on independent cooldowns. Names and species eligibility
 * come from real learnsets; run-level gates and combat values are adapted. */
export const LEARNABLE_MOVES:readonly LearnableMove[]=[
 move({id:'razor-leaf',name:'Razor Leaf',element:'grass',kind:'bolt',power:22,cooldown:3.2,description:'Fires two sharp leaves through nearby targets.',overrides:{projectiles:2,pierce:1,silhouette:'needle'}}),
 move({id:'ember',name:'Ember',element:'fire',kind:'lob',power:22,cooldown:3.1,description:'Lobs a small burning ember.',overrides:{radius:2.4}}),
 move({id:'water-gun',name:'Water Gun',element:'water',kind:'beam',power:23,cooldown:3,description:'Fires a narrow stream through two enemies.',overrides:{pierce:2}}),
 move({id:'thunder-shock',name:'Thunder Shock',element:'electric',kind:'chain',power:21,cooldown:3.2,description:'Shocks two nearby enemies.',overrides:{chains:2}}),
 move({id:'gust',name:'Gust',element:'flying',kind:'beam',power:22,cooldown:3.1,description:'Sends a piercing gust through a line of enemies.',overrides:{pierce:2}}),
 move({id:'tackle',name:'Tackle',element:'normal',kind:'slash',power:23,cooldown:2.6,description:'Strikes nearby enemies with a quick body charge.'}),
 move({id:'quick-attack',name:'Quick Attack',element:'normal',kind:'slash',power:24,cooldown:2.5,description:'Sweeps nearby enemies with a fast close-range strike.'}),
 move({id:'bug-bite',name:'Bug Bite',element:'bug',kind:'slash',power:25,cooldown:2.8,description:'Bites enemies in a short forward sweep.'}),
 move({id:'confusion',name:'Confusion',element:'psychic',kind:'burst',power:24,cooldown:3,description:'Strikes a small area with psychic force.'}),
 move({id:'swift',name:'Swift',element:'normal',kind:'bolt',power:20,cooldown:2.7,description:'Fires a quick three-star spread.',overrides:{projectiles:3,speed:23}}),
 move({id:'body-slam',name:'Body Slam',element:'normal',kind:'burst',power:30,cooldown:3.4,description:'Slams nearby enemies and can briefly stun them.',overrides:{range:7,radius:4.8,status:{stun:.22}}}),
 move({id:'hyper-beam',name:'Hyper Beam',element:'normal',kind:'beam',power:43,cooldown:4.8,description:'Fires a powerful piercing beam.',overrides:{pierce:6,range:22}}),
 move({id:'double-edge',name:'Double-Edge',element:'normal',kind:'slash',power:39,cooldown:3.8,description:'Strikes a wide arc with heavy close-range damage.',overrides:{radius:6,range:7,damageScale:1.3}}),
 move({id:'flame-burst',name:'Flame Burst',element:'fire',kind:'lob',power:29,cooldown:3.2,description:'Lobs a fireball that explodes and can burn.',overrides:{radius:3.1}}),
 move({id:'fire-blast',name:'Fire Blast',element:'fire',kind:'burst',power:38,cooldown:4.5,description:'Blasts a wide area around its target with fire.',overrides:{radius:5.4}}),
 move({id:'water-pulse',name:'Water Pulse',element:'water',kind:'lob',power:28,cooldown:3.1,description:'Explodes in a soaking splash.',overrides:{radius:3.3}}),
 move({id:'surf',name:'Surf',element:'water',kind:'beam',power:33,cooldown:3.9,description:'Sends a piercing wave through enemy lines.',overrides:{pierce:6,speed:17,range:19}}),
 move({id:'seed-bomb',name:'Seed Bomb',element:'grass',kind:'lob',power:30,cooldown:3.3,description:'Throws a seed that bursts across a wide area.',overrides:{radius:3.4}}),
 move({id:'solar-beam',name:'Solar Beam',element:'grass',kind:'beam',power:44,cooldown:4.7,description:'Fires a long beam through several enemies.',overrides:{pierce:6,range:23}}),
 move({id:'shock-wave',name:'Shock Wave',element:'electric',kind:'chain',power:24,cooldown:3.2,description:'Arcs between three enemies.',overrides:{chains:3}}),
 move({id:'discharge',name:'Discharge',element:'electric',kind:'aura',power:32,cooldown:3.8,description:'Electrifies nearby enemies with a chance to stun.',overrides:{radius:6.5,range:7,status:{stun:.25}}}),
 move({id:'ice-beam',name:'Ice Beam',element:'ice',kind:'beam',power:32,cooldown:3.5,description:'Pierces enemy lines and can slow targets.'}),
 move({id:'blizzard',name:'Blizzard',element:'ice',kind:'burst',power:35,cooldown:4.3,description:'Covers a broad area in slowing ice.',overrides:{radius:6,status:{slow:.65}}}),
 move({id:'brick-break',name:'Brick Break',element:'fighting',kind:'slash',power:34,cooldown:2.9,description:'Delivers a heavy, close-range chopping strike.',overrides:{radius:5.8,range:6.5}}),
 move({id:'focus-blast',name:'Focus Blast',element:'fighting',kind:'lob',power:42,cooldown:4.1,description:'Launches a slow, powerful blast of fighting energy.',overrides:{radius:3.6,speed:11}}),
 move({id:'sludge-bomb',name:'Sludge Bomb',element:'poison',kind:'lob',power:29,cooldown:3.3,description:'Bursts into a poisonous splash.',overrides:{radius:3.4,status:{poison:.65}}}),
 move({id:'poison-jab',name:'Poison Jab',element:'poison',kind:'slash',power:31,cooldown:2.7,description:'Quickly jabs nearby enemies with poison.',overrides:{status:{poison:.5}}}),
 move({id:'mud-shot',name:'Mud Shot',element:'ground',kind:'bolt',power:25,cooldown:2.7,description:'Fires slowing mud projectiles.',overrides:{projectiles:2,speed:14,status:{slow:.5}}}),
 move({id:'earthquake',name:'Earthquake',element:'ground',kind:'aura',power:40,cooldown:4.5,description:'Shakes a large area around the attacker.',overrides:{radius:7.5,range:8}}),
 move({id:'air-slash',name:'Air Slash',element:'flying',kind:'beam',power:29,cooldown:3.1,description:'Slices through targets with a blade of air.',overrides:{pierce:3,status:{stun:.2}}}),
 move({id:'hurricane',name:'Hurricane',element:'flying',kind:'burst',power:37,cooldown:4.2,description:'Catches groups of enemies in a wide wind blast.',overrides:{radius:6}}),
 move({id:'psybeam',name:'Psybeam',element:'psychic',kind:'beam',power:28,cooldown:3,description:'Pierces enemies with psychic energy.',overrides:{pierce:3}}),
 move({id:'future-sight',name:'Future Sight',element:'psychic',kind:'lob',power:42,cooldown:4.6,description:'Sends a slow psychic blast that erupts on impact.',overrides:{speed:9,radius:4.2}}),
 move({id:'pin-missile',name:'Pin Missile',element:'bug',kind:'bolt',power:19,cooldown:3,description:'Fires a spread of five piercing needles.',overrides:{projectiles:5,pierce:1,silhouette:'needle'}}),
 move({id:'bug-buzz',name:'Bug Buzz',element:'bug',kind:'aura',power:31,cooldown:3.6,description:'Strikes surrounding enemies with a sonic pulse.',overrides:{radius:6.2,range:7}}),
 move({id:'rock-slide',name:'Rock Slide',element:'rock',kind:'lob',power:32,cooldown:3.6,description:'Throws rocks that burst and can stun.',overrides:{radius:3.8,status:{stun:.25}}}),
 move({id:'stone-edge',name:'Stone Edge',element:'rock',kind:'bolt',power:34,cooldown:3.3,description:'Fires a spread of three piercing stone spikes.',overrides:{projectiles:3,pierce:2,silhouette:'needle'}}),
 move({id:'shadow-ball',name:'Shadow Ball',element:'ghost',kind:'lob',power:32,cooldown:3.5,description:'Explodes in a wide burst of spectral energy.',overrides:{radius:3.8}}),
 move({id:'shadow-claw',name:'Shadow Claw',element:'ghost',kind:'slash',power:33,cooldown:2.9,description:'Rakes a broad arc with spectral claws.',overrides:{radius:5.7,range:6.5}}),
 move({id:'dragon-pulse',name:'Dragon Pulse',element:'dragon',kind:'beam',power:35,cooldown:3.6,description:'Fires a powerful piercing dragon pulse.',overrides:{pierce:5}}),
 move({id:'dragon-breath',name:'Dragon Breath',element:'dragon',kind:'bolt',power:27,cooldown:3.1,description:'Fires two dragon bolts that can briefly stun.',overrides:{projectiles:2,status:{stun:.35}}}),
];
const BY_ID=new Map(LEARNABLE_MOVES.map(definition=>[definition.id,definition]));
export function getMoveDefinition(id:string):LearnableMove|undefined{return BY_ID.get(id);}
export function moveLearnLevel(id:string):number {
 return ['hyper-beam','solar-beam','fire-blast','blizzard','earthquake','hurricane','future-sight','focus-blast','stone-edge'].includes(id)?10:
  ['razor-leaf','ember','water-gun','thunder-shock','gust','tackle','quick-attack','bug-bite','confusion','swift','water-pulse','mud-shot','psybeam','dragon-breath','poison-jab','pin-missile'].includes(id)?3:5;
}
export function learnableMoves(speciesId:number,level=Infinity):LearnableMove[] {
 const species=getSpecies(speciesId);
 const known=new Set(SPECIES_LEARNSETS[speciesId]||[]);
 return LEARNABLE_MOVES.filter(definition=>known.has(definition.id)&&definition.name!==species.moveName&&moveLearnLevel(definition.id)<=level);
}
export function getLearnedMoveProfile(id:string,rank=1):AttackDefinition {
 const definition=getMoveDefinition(id);if(!definition)throw new Error(`Unknown learned move: ${id}`);
 const base=definition.profile,level=Math.max(0,Number.isFinite(rank)?rank-1:0),growth=base.growth;
 const melee=base.kind==='slash'?1.25:1;
 return {...base,growth:{...growth},status:{...base.status},cooldown:base.cooldown/(1+level*PROGRESSION.moves.speedPerRank),damageScale:base.damageScale*melee,
  range:base.range*(1+level*PROGRESSION.moves.rangePerRank)*melee,radius:base.radius*(1+level*PROGRESSION.moves.rangePerRank)*melee,
  projectiles:base.projectiles+(growth.projectilesEvery?Math.floor(level/growth.projectilesEvery):0),
  chains:base.chains+(growth.chainsEvery?Math.floor(level/growth.chainsEvery):0)};
}
/** Every rank adds 20% of the move's initial power, independently of squad buffs. */
export function learnedMovePower(id:string,rank=1):number {
 const definition=getMoveDefinition(id);if(!definition)throw new Error(`Unknown learned move: ${id}`);
 return definition.power*(1+Math.max(0,Number.isFinite(rank)?rank-1:0)*PROGRESSION.moves.damagePerRank);
}
export function evolutionMove(sourceId:number,targetId:number,knownIds:readonly string[]=[]):LearnableMove {
 const target=getSpecies(targetId),candidates=learnableMoves(targetId).filter(definition=>!knownIds.includes(definition.id));
 // Evolution does not grant a free move; this helper also supports previews.
 const matching=candidates.filter(definition=>definition.element===target.types[0]);
 const index=getSpecies(sourceId).stage>=2?1:0;
 const chosen=matching[Math.min(index,matching.length-1)]||candidates[0];
 if(!chosen)throw new Error(`No new evolution move available for ${target.name}`);
 return chosen;
}
