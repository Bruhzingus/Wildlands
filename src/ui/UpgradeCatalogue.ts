import {ELEMENT_COLORS,type Element} from '../data/kanto.ts';
import type {SaveData} from '../game/save.ts';
import {CATALOGUE_GROUPS,DEFAULT_CATALOGUE_FILTERS,createUpgradeCatalogue,filterCatalogue,catalogueEntryLocked,
 type CatalogueEntry,type CatalogueFilters,type CatalogueGroup} from './upgradeCatalogueData.ts';
import './upgradeCatalogue.css';

const esc=(text:string)=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const titleCase=(text:string)=>text.charAt(0).toUpperCase()+text.slice(1);
const GROUP_COLORS:Record<CatalogueGroup,string>={training:'#b5d77c',relics:'#f0c662',rules:'#b6c5ce',signatures:'#eea287',learned:'#83cdd1',specials:'#cca4ee',evolutions:'#a1c2ff',recruitment:'#a8d5a2',synergies:'#e5b2d1',limits:'#b6c5ce'};
let entries:readonly CatalogueEntry[]|undefined;

/** A read-only menu. Its listeners belong to this view and are released on close. */
export class UpgradeCatalogue {
 private readonly root:HTMLElement;
 private readonly listeners=new AbortController();
 private readonly entries:readonly CatalogueEntry[];
 private filters:CatalogueFilters={...DEFAULT_CATALOGUE_FILTERS};
 constructor(parent:HTMLElement,private readonly save:SaveData,onClose:()=>void){
  this.entries=entries??=createUpgradeCatalogue();
  this.root=document.createElement('section');this.root.className='upgrade-catalogue';
  this.root.setAttribute('aria-label','Upgrade catalogue');
  this.root.innerHTML=`<header class="catalogue-header"><div><div class="eyebrow">FIELD GUIDE / UPGRADES</div><h1>Upgrade catalogue</h1><p>Every upgrade, move and team bonus. Browse a group or narrow the list.</p></div><button type="button" class="btn btn-ghost" data-catalogue-close>Back to menu <span aria-hidden="true">Esc</span></button></header>
   <div class="catalogue-controls">
    <label class="catalogue-search">Search upgrades<input type="search" data-catalogue-search placeholder="Name, Pokémon, effect…" autocomplete="off" spellcheck="false"></label>
    <label>Group<select data-catalogue-filter="group"><option value="all">All groups</option>${CATALOGUE_GROUPS.map(group=>`<option value="${group.id}">${group.number} · ${esc(group.title)}</option>`).join('')}</select></label>
    <label>Rarity<select data-catalogue-filter="rarity"><option value="all">All rarities</option>${['common','uncommon','rare','epic','legendary'].map(rarity=>`<option value="${rarity}">${titleCase(rarity)}</option>`).join('')}<option value="none">No rarity / automatic</option></select></label>
    <label>Pokémon type<select data-catalogue-filter="element"><option value="all">All types</option>${Object.keys(ELEMENT_COLORS).sort().map(element=>`<option value="${element}">${titleCase(element)}</option>`).join('')}</select></label>
    <label>Availability<select data-catalogue-filter="availability"><option value="all">All entries</option><option value="current">Current entries</option><option value="unlocked">Unlocked entries</option><option value="locked">Locked entries</option></select></label>
    <label>Sort within groups<select data-catalogue-filter="sort"><option value="catalogue">Catalogue order</option><option value="name-asc">Name: A–Z</option><option value="name-desc">Name: Z–A</option><option value="rarity-desc">Rarity: highest first</option><option value="rarity-asc">Rarity: lowest first</option><option value="level">Minimum level</option></select></label>
   </div>
   <div class="catalogue-toolbar"><p data-catalogue-count role="status" aria-live="polite" aria-atomic="true"></p><button type="button" data-catalogue-reset>Reset filters</button></div>
   <div class="catalogue-layout"><nav class="catalogue-nav" aria-label="Upgrade groups"><button type="button" data-catalogue-group="all" aria-pressed="true"><span>All groups</span><span>${this.entries.length}</span></button>${CATALOGUE_GROUPS.map(group=>`<button type="button" data-catalogue-group="${group.id}" style="--group-color:${GROUP_COLORS[group.id]}" aria-pressed="false"><span><small>${group.number}</small> ${esc(group.title)}</span><span data-group-count="${group.id}"></span></button>`).join('')}<div class="catalogue-legend"><strong>Rarity key</strong>${['common','uncommon','rare','epic','legendary'].map(rarity=>`<span class="catalogue-badge ${rarity}">${titleCase(rarity)}</span>`).join('')}<p>Labels accompany every colour. Expand an entry for progression and requirements.</p></div></nav><div class="catalogue-results" data-catalogue-results tabindex="0" role="region" aria-label="Scrollable upgrade list"></div></div>`;
  parent.replaceChildren(this.root);
  const signal=this.listeners.signal;
  this.root.addEventListener('click',event=>{
   const target=(event.target as HTMLElement).closest<HTMLElement>('button');if(!target)return;
   if(target.hasAttribute('data-catalogue-close'))onClose();
   else if(target.hasAttribute('data-catalogue-reset'))this.reset();
   else if(target.dataset.catalogueGroup){this.filters.group=target.dataset.catalogueGroup as CatalogueFilters['group'];this.syncControls();this.render();}
  },{signal});
  this.root.addEventListener('input',event=>{
   if(!(event.target as HTMLElement).hasAttribute('data-catalogue-search'))return;
   this.filters.search=(event.target as HTMLInputElement).value;this.render();
  },{signal});
  this.root.addEventListener('change',event=>{
   const select=event.target as HTMLSelectElement,key=select.dataset.catalogueFilter as keyof Omit<CatalogueFilters,'search'>|undefined;
   if(!key)return;
   this.filters={...this.filters,[key]:select.value};this.render();
  },{signal});
  this.root.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}
   else if(event.key!=='Tab')event.stopPropagation();
  },{signal});
  this.root.addEventListener('keyup',event=>event.stopPropagation(),{signal});
  this.root.addEventListener('wheel',event=>event.stopPropagation(),{signal,passive:true});
  this.render();
 }

 private syncControls(){
  this.root.querySelector<HTMLInputElement>('[data-catalogue-search]')!.value=this.filters.search;
  for(const select of Array.from(this.root.querySelectorAll<HTMLSelectElement>('[data-catalogue-filter]')))select.value=this.filters[select.dataset.catalogueFilter as keyof CatalogueFilters];
 }
 private reset(){this.filters={...DEFAULT_CATALOGUE_FILTERS};this.syncControls();this.render();this.root.querySelector<HTMLInputElement>('[data-catalogue-search]')!.focus();}
 private render(){
  const matches=filterCatalogue(this.entries,this.filters,this.save);
  const availableGroups=filterCatalogue(this.entries,{...this.filters,group:'all'},this.save);
  this.root.querySelector('[data-catalogue-count]')!.textContent=`${matches.length} of ${this.entries.length} entries · ${new Set(matches.map(entry=>entry.group)).size} groups`;
  for(const button of Array.from(this.root.querySelectorAll<HTMLElement>('[data-catalogue-group]')))button.setAttribute('aria-pressed',String(button.dataset.catalogueGroup===this.filters.group));
  for(const counter of Array.from(this.root.querySelectorAll<HTMLElement>('[data-group-count]')))counter.textContent=String(availableGroups.filter(entry=>entry.group===counter.dataset.groupCount).length);
  const results=this.root.querySelector<HTMLElement>('[data-catalogue-results]')!;
  results.innerHTML=matches.length?CATALOGUE_GROUPS.map(group=>{
   const rows=matches.filter(entry=>entry.group===group.id);if(!rows.length)return '';
   return `<section class="catalogue-group" data-catalogue-section="${group.id}" style="--group-color:${GROUP_COLORS[group.id]}" aria-labelledby="catalogue-${group.id}"><header class="catalogue-group-heading"><span class="catalogue-group-number">${group.number}</span><div><h2 id="catalogue-${group.id}">${esc(group.title)} <span>${rows.length}</span></h2><p>${esc(group.description)}</p></div></header><div class="catalogue-rows">${rows.map(entry=>this.renderEntry(entry)).join('')}</div></section>`;
  }).join(''):'<div class="catalogue-empty"><strong>No upgrades match these filters.</strong><p>Try a broader search or reset the filters to see every entry.</p><button type="button" class="btn btn-ghost" data-catalogue-reset>Reset filters</button></div>';
  results.scrollTop=0;
 }
 private renderEntry(entry:CatalogueEntry){
  const locked=catalogueEntryLocked(entry,this.save),rarity=entry.rarities.at(-1)??'reference';
  const badges=entry.rarities.map(value=>`<span class="catalogue-badge ${value}">${titleCase(value)}</span>`).join('')||'<span class="catalogue-badge reference">No rarity</span>';
  const typeBadges=entry.elements.map(element=>`<span class="catalogue-type" style="--type-color:${ELEMENT_COLORS[element as Element]}">${titleCase(element)}</span>`).join('');
  const details=[...(entry.unlock?[{label:locked?'Unlock requirement':'Unlocked',text:entry.unlock.requirement}]:[]),...entry.details];
  return `<article class="catalogue-entry ${entry.retired?'is-retired':''}" data-catalogue-entry="${esc(entry.id)}" data-rarity="${rarity}"><div class="catalogue-entry-top"><div><span class="catalogue-subtitle">${esc(entry.subtitle)}</span><h3>${esc(entry.title)}</h3></div><div class="catalogue-badges">${badges}${entry.retired?'<span class="catalogue-status retired">Retired</span>':locked?'<span class="catalogue-status locked">Locked</span>':''}</div></div><p class="catalogue-description">${esc(entry.description)}</p>${typeBadges?`<div class="catalogue-types" aria-label="Pokémon types">${typeBadges}</div>`:''}${entry.stats.length?`<dl class="catalogue-stats">${entry.stats.map(row=>`<div><dt>${esc(row.label)}</dt><dd>${esc(row.value)}</dd></div>`).join('')}</dl>`:''}${details.length?`<details class="catalogue-details"><summary>Details & progression</summary><dl>${details.map(row=>`<div><dt>${esc(row.label)}</dt><dd>${esc(row.text)}</dd></div>`).join('')}</dl></details>`:''}</article>`;
 }
 dispose(){this.listeners.abort();this.root.remove();}
}
