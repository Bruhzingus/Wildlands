import {getSpeciesCombat,LEGENDARY_SPECIES} from './rosterContent.ts';
/** Entire Generation 1 species catalog, guaranteed ID->name/type resolution without an API call.
 * Gameplay stats/roles are intentionally original arcade balance values, NOT official combat stats.
 * PokéAPI is an optional data-enrichment source, not a runtime dependency. */
export type Element = 'normal'|'fire'|'water'|'grass'|'electric'|'ice'|'fighting'|'poison'|'ground'|'flying'|'psychic'|'bug'|'rock'|'ghost'|'dragon';
export type AttackKind = 'bolt'|'burst'|'slash'|'aura'|'chain'|'beam'|'lob'|'heal';
export interface Species { id:number; name:string; types:Element[]; stage:number; evolvesTo:number[]; attack:AttackKind; power:number; defense:number; health:number; moveName:string; recruitable:boolean; }
const raw = `
Bulbasaur|grass,poison
Ivysaur|grass,poison
Venusaur|grass,poison
Charmander|fire
Charmeleon|fire
Charizard|fire,flying
Squirtle|water
Wartortle|water
Blastoise|water
Caterpie|bug
Metapod|bug
Butterfree|bug,flying
Weedle|bug,poison
Kakuna|bug,poison
Beedrill|bug,poison
Pidgey|normal,flying
Pidgeotto|normal,flying
Pidgeot|normal,flying
Rattata|normal
Raticate|normal
Spearow|normal,flying
Fearow|normal,flying
Ekans|poison
Arbok|poison
Pikachu|electric
Raichu|electric
Sandshrew|ground
Sandslash|ground
Nidoran♀|poison
Nidorina|poison
Nidoqueen|poison,ground
Nidoran♂|poison
Nidorino|poison
Nidoking|poison,ground
Clefairy|normal
Clefable|normal
Vulpix|fire
Ninetales|fire
Jigglypuff|normal
Wigglytuff|normal
Zubat|poison,flying
Golbat|poison,flying
Oddish|grass,poison
Gloom|grass,poison
Vileplume|grass,poison
Paras|bug,grass
Parasect|bug,grass
Venonat|bug,poison
Venomoth|bug,poison
Diglett|ground
Dugtrio|ground
Meowth|normal
Persian|normal
Psyduck|water
Golduck|water
Mankey|fighting
Primeape|fighting
Growlithe|fire
Arcanine|fire
Poliwag|water
Poliwhirl|water
Poliwrath|water,fighting
Abra|psychic
Kadabra|psychic
Alakazam|psychic
Machop|fighting
Machoke|fighting
Machamp|fighting
Bellsprout|grass,poison
Weepinbell|grass,poison
Victreebel|grass,poison
Tentacool|water,poison
Tentacruel|water,poison
Geodude|rock,ground
Graveler|rock,ground
Golem|rock,ground
Ponyta|fire
Rapidash|fire
Slowpoke|water,psychic
Slowbro|water,psychic
Magnemite|electric
Magneton|electric
Farfetch'd|normal,flying
Doduo|normal,flying
Dodrio|normal,flying
Seel|water
Dewgong|water,ice
Grimer|poison
Muk|poison
Shellder|water
Cloyster|water,ice
Gastly|ghost,poison
Haunter|ghost,poison
Gengar|ghost,poison
Onix|rock,ground
Drowzee|psychic
Hypno|psychic
Krabby|water
Kingler|water
Voltorb|electric
Electrode|electric
Exeggcute|grass,psychic
Exeggutor|grass,psychic
Cubone|ground
Marowak|ground
Hitmonlee|fighting
Hitmonchan|fighting
Lickitung|normal
Koffing|poison
Weezing|poison
Rhyhorn|ground,rock
Rhydon|ground,rock
Chansey|normal
Tangela|grass
Kangaskhan|normal
Horsea|water
Seadra|water
Goldeen|water
Seaking|water
Staryu|water
Starmie|water,psychic
Mr. Mime|psychic
Scyther|bug,flying
Jynx|ice,psychic
Electabuzz|electric
Magmar|fire
Pinsir|bug
Tauros|normal
Magikarp|water
Gyarados|water,flying
Lapras|water,ice
Ditto|normal
Eevee|normal
Vaporeon|water
Jolteon|electric
Flareon|fire
Porygon|normal
Omanyte|rock,water
Omastar|rock,water
Kabuto|rock,water
Kabutops|rock,water
Aerodactyl|rock,flying
Snorlax|normal
Articuno|ice,flying
Zapdos|electric,flying
Moltres|fire,flying
Dratini|dragon
Dragonair|dragon
Dragonite|dragon,flying
Mewtwo|psychic
Mew|psychic`.trim().split('\n');
export const EVOLUTION_CHAINS: readonly (readonly number[])[] = [
[1,2,3],[4,5,6],[7,8,9],[10,11,12],[13,14,15],[16,17,18],[19,20],[21,22],[23,24],
[25,26],[27,28],[29,30,31],[32,33,34],[35,36],[37,38],[39,40],[41,42],[43,44,45],[46,47],[48,49],
[50,51],[52,53],[54,55],[56,57],[58,59],[60,61,62],[63,64,65],[66,67,68],[69,70,71],[72,73],
[74,75,76],[77,78],[79,80],[81,82],[84,85],[86,87],[88,89],[90,91],[92,93,94],[96,97],[98,99],
[100,101],[102,103],[104,105],[109,110],[111,112],[116,117],[118,119],[120,121],[129,130],[133,134],
[133,135],[133,136],[138,139],[140,141],[147,148,149]
];
const parents = new Map<number,number>(); const childMap = new Map<number,number[]>();
const familyLengthByRoot=new Map<number,number>();
for(const chain of EVOLUTION_CHAINS)familyLengthByRoot.set(chain[0],Math.max(chain.length,familyLengthByRoot.get(chain[0])??1));
for(const chain of EVOLUTION_CHAINS) for(let i=0;i<chain.length-1;i++){
 const a=chain[i],b=chain[i+1]; parents.set(b,a); childMap.set(a,[...(childMap.get(a)||[]),b]);
}
/** Arcade stat bands preserve a clear ladder across two- and three-stage lines. */
const STAGE_BANDS:Record<string,{min:number;max:number;defense:number;health:number}>={
 '3-1':{min:11,max:14,defense:1.7,health:1},'3-2':{min:18,max:20,defense:1.98,health:1.25},'3-3':{min:25,max:27,defense:2.27,health:1.5625},
 '2-1':{min:15,max:16,defense:1.84,health:1.1},'2-2':{min:22,max:24,defense:2.12,health:1.375},
};
export const KANTO: Species[] = raw.map((line,i)=>{
 const [name,t]=line.split('|');const id=i+1;const types=t.split(',') as Element[];
 let p=id,stage=1;while(parents.has(p)){ p=parents.get(p)!;stage++; }
 const combat=getSpeciesCombat(id);
 const band=STAGE_BANDS[`${familyLengthByRoot.get(p)??1}-${stage}`];
 const power=id===129?4:id===130?29:band?Math.max(band.min,Math.min(band.max,combat.power)):combat.power;
 const defense=id===129?.5:id===130?2.55:band?Number((band.defense+Math.max(0,band.max-combat.power)*.02).toFixed(2)):Number(Math.max(.5,Math.min(3,3.5-combat.power/12)).toFixed(2));
 const health=id===129?.7:id===130?1.75:band?.health??1;
 return {id,name,types,stage,evolvesTo:childMap.get(id)||[],attack:combat.attack,power,defense,health,moveName:combat.moveName,recruitable:!parents.has(id)&&!LEGENDARY_SPECIES.includes(id)};
});
if(KANTO.length!==151) throw new Error(`Expected 151 Pokémon, got ${KANTO.length}`);
export const SPECIES = new Map(KANTO.map(p=>[p.id,p]));
export function getSpecies(id:number):Species {const species=SPECIES.get(id);if(!species)throw Error(`Unknown Pokémon ${id}`);return species;}
export const RECRUIT_POOL = KANTO.filter(p=>p.recruitable);
export const ELEMENT_COLORS:Record<Element,string>={normal:'#DBD4C1',fire:'#ff9748',water:'#4aabf4',grass:'#8edb70',electric:'#ffdb5b',ice:'#94ecf9',fighting:'#eb857a',poison:'#b185ec',ground:'#d5b36e',flying:'#a9d3fe',psychic:'#f68ed4',bug:'#a4d057',rock:'#b6ac95',ghost:'#a29cf8',dragon:'#7a9cff'};
export function starterChoices(){return [1,4,7,10,16,25,27,37,41,43,52,58,63,66,92,129,133];}
