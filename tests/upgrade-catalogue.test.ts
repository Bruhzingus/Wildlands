import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOGUE_GROUPS,DEFAULT_CATALOGUE_FILTERS,createUpgradeCatalogue,filterCatalogue,catalogueEntryLocked} from '../src/ui/upgradeCatalogueData.ts';
import {ITEM_DEFINITIONS} from '../src/data/items.ts';
import {KANTO,RECRUIT_POOL,starterChoices} from '../src/data/kanto.ts';
import {TRAINING_UPGRADES,trainingVariants} from '../src/data/progression.ts';
import {LEARNABLE_MOVES} from '../src/data/moves.ts';
import {SYNERGIES} from '../src/data/synergies.ts';
import {getSpecialProfile} from '../src/data/specials.ts';
import {migrateSave} from '../src/game/save.ts';

const entries=createUpgradeCatalogue(),fresh=()=>migrateSave({version:2})!;

test('menu catalogue includes every upgrade definition and all documented groups without duplicate IDs',()=>{
 const counts=new Map(CATALOGUE_GROUPS.map(group=>[group.id,entries.filter(entry=>entry.group===group.id).length]));
 assert.equal(counts.get('training'),TRAINING_UPGRADES.reduce((sum,definition)=>sum+trainingVariants(definition).length,0));
 assert.equal(counts.get('relics'),ITEM_DEFINITIONS.filter(item=>item.offerable!==false).length);
 assert.equal(counts.get('signatures'),KANTO.length);assert.equal(counts.get('learned'),LEARNABLE_MOVES.length);
 assert.equal(counts.get('evolutions'),KANTO.reduce((sum,species)=>sum+species.evolvesTo.length,0));
 assert.equal(counts.get('recruitment'),RECRUIT_POOL.length+starterChoices().length);
 assert.equal(counts.get('synergies'),SYNERGIES.length);assert.equal(counts.get('specials'),new Set(KANTO.map(species=>{const special=getSpecialProfile(species.id);return `${special.kind}:${special.name}`;})).size);
 assert.ok([...counts.values()].every(count=>count>0));
 assert.equal(new Set(entries.map(entry=>entry.id)).size,entries.length);
 for(const entry of entries){assert.ok(entry.title&&entry.description);assert.doesNotMatch(JSON.stringify(entry),/undefined|NaN/);}
});

test('search combines words, rarity, element and group filters, including owner names and progression',()=>{
 const save=fresh();
 const legendary=filterCatalogue(entries,{...DEFAULT_CATALOGUE_FILTERS,search:'focus energy',rarity:'legendary'},save);
 assert.deepEqual(legendary.map(entry=>entry.id),['training:crit:legendary']);
 assert.deepEqual(filterCatalogue(entries,{...DEFAULT_CATALOGUE_FILTERS,search:'legendary life orb'},save).map(entry=>entry.id),['relic:life-orb-legendary']);
 const bulbasaur=filterCatalogue(entries,{...DEFAULT_CATALOGUE_FILTERS,search:'Bulbasaur',group:'signatures',element:'grass'},save);
 assert.deepEqual(bulbasaur.map(entry=>entry.id),['signature:1']);
 const learned=filterCatalogue(entries,{...DEFAULT_CATALOGUE_FILTERS,search:'Bulbasaur',group:'learned'},save);
 assert.ok(learned.length>0);assert.ok(learned.every(entry=>entry.details.some(row=>row.label==='Eligible Pokémon'&&row.text.includes('Bulbasaur'))));
 assert.ok(filterCatalogue(entries,{...DEFAULT_CATALOGUE_FILTERS,search:'does-not-exist'},save).length===0);
 const electroweb=filterCatalogue(entries,{...DEFAULT_CATALOGUE_FILTERS,search:'Electroweb',group:'specials',element:'electric'},save);
 assert.equal(electroweb.length,1);assert.ok(electroweb[0].details.some(row=>row.label==='Pokémon'&&row.text.includes('Caterpie')));
 assert.ok(filterCatalogue(entries,{...DEFAULT_CATALOGUE_FILTERS,rarity:'none'},save).every(entry=>entry.rarities.length===0));
});

test('retired relics are absent and legendary unlock state follows the base relic',()=>{
 const save=fresh(),legendary=entries.find(entry=>entry.id==='relic:life-orb-legendary')!;
 assert.equal(catalogueEntryLocked(legendary,save),true);
 assert.ok(filterCatalogue(entries,{...DEFAULT_CATALOGUE_FILTERS,availability:'locked'},save).includes(legendary));
 save.unlockedItems.push('life-orb');assert.equal(catalogueEntryLocked(legendary,save),false);
 assert.ok(filterCatalogue(entries,{...DEFAULT_CATALOGUE_FILTERS,availability:'unlocked'},save).includes(legendary));
 for(const retired of ITEM_DEFINITIONS.filter(item=>item.offerable===false))assert.ok(entries.every(entry=>entry.id!==`relic:${retired.id}`));
 assert.ok(filterCatalogue(entries,{...DEFAULT_CATALOGUE_FILTERS,search:'Zoom Lens'},save).length===0);
 assert.ok(filterCatalogue(entries,{...DEFAULT_CATALOGUE_FILTERS,availability:'current'},save).every(entry=>!entry.retired));
});

test('sorting orders entries within each document group and keeps the complete inventory intact',()=>{
 const save=fresh(),groupOrder=CATALOGUE_GROUPS.map(group=>group.id);
 for(const sort of ['name-asc','name-desc','rarity-desc','rarity-asc','level'] as const){
  const results=filterCatalogue(entries,{...DEFAULT_CATALOGUE_FILTERS,sort},save);
  assert.equal(results.length,entries.length);
  for(let i=1;i<results.length;i++)assert.ok(groupOrder.indexOf(results[i].group)>=groupOrder.indexOf(results[i-1].group));
 }
 const sorted=filterCatalogue(entries,{...DEFAULT_CATALOGUE_FILTERS,group:'training',sort:'rarity-desc'},save);
 assert.ok(sorted.slice(0,TRAINING_UPGRADES.length).every(entry=>entry.rarities[0]==='legendary'));
 const names=filterCatalogue(entries,{...DEFAULT_CATALOGUE_FILTERS,group:'relics',sort:'name-asc'},save).map(entry=>entry.title);
 assert.deepEqual(names,[...names].sort((a,b)=>a.localeCompare(b)));
});
