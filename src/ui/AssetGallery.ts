import {Engine,Scene,ArcRotateCamera,Vector3,Color4} from '@babylonjs/core';
import {AssetLibrary,type Avatar,type AnimationName} from '../game/render/AssetLibrary.ts';
import {KANTO,getSpecies} from '../data/kanto.ts';
import {getAttackProfile} from '../data/attacks.ts';
import {getSpeciesCombat,ROLE_LABELS} from '../data/rosterContent.ts';
import {evolutionRequirement} from '../data/evolutions.ts';
import {PROGRESSION} from '../data/progression.ts';
import {ENCOUNTER_TABLES} from '../data/encounters.ts';
import type {Variant} from '../game/types.ts';

export const REPRESENTATIVE_SPECIES=[1,2,3,4,5,6,7,8,9,10,16,25,39,41,50,63,74,81,95,109,123,129,130,131,132,133,134,135,136,143,144,145,146,149,150,151];

/** Developer-only view of the exact Babylon SpriteManager implementation used in play.
 * Opening pauses the run via wildlands:gallery-open. Closing releases its engine,
 * render loop, scene, textures and pending asset work. */
export class AssetGallery {
 private root:HTMLDetailsElement|null=null;private engine:Engine|null=null;private scene:Scene|null=null;
 private assets:AssetLibrary|null=null;private avatars:Avatar[]=[];private previous=0;private clock=0;
 private speciesId=25;private animation:AnimationName='idle';private variant:Variant='normal';private offset=0;private frozen=false;
 private compareVariants=false;
 private creditRows=new Map<number,string>();
 constructor(parent:HTMLElement=document.body) {
  if(new URLSearchParams(location.search).get('dev')!=='1')return;
  const root=document.createElement('details');this.root=root;root.className='asset-gallery';
  root.innerHTML=`<style>
   .asset-gallery{position:fixed;right:12px;bottom:12px;z-index:1000;width:min(700px,calc(100vw - 24px));max-height:85vh;overflow:auto;color:#e5e8d8;background:#22291f;border:2px solid #88946c;border-radius:2px;font:13px/1.45 monospace;box-shadow:3px 3px 0 #10140e}
   .asset-gallery:not([open]){width:auto}.asset-gallery summary{padding:7px 12px;cursor:pointer;font-weight:bold;user-select:none;list-style-position:inside}
   .asset-gallery .gallery-body{padding:8px 12px 12px}.asset-gallery .gallery-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}
   .asset-gallery label{display:flex;gap:5px;align-items:center}.asset-gallery select,.asset-gallery button{font:inherit;color:#e5e8d8;background:#303a29;border:1px solid #7f8b65;border-radius:1px;padding:4px 6px;min-height:29px;cursor:pointer}
   .asset-gallery canvas{width:100%;height:230px;display:block;touch-action:none;background:#182017}
   .asset-gallery .gallery-directions{display:grid;grid-template-columns:repeat(8,1fr);font-size:10px;text-align:center;color:#bdc9a6;margin:4px 0 8px}
   .asset-gallery output{display:block;white-space:pre-wrap;overflow-wrap:anywhere}.asset-gallery p{margin:8px 0 0;font:inherit}.asset-gallery a{color:#d3dda7;text-decoration:underline}
   .asset-gallery :focus-visible{outline:2px solid #e6d58c;outline-offset:2px}
  </style><summary>DEV · ASSET GALLERY</summary><div class="gallery-body">
  <div class="gallery-controls"><label>Species <select data-species aria-label="Asset species">${KANTO.map(p=>`<option value="${p.id}" ${p.id===25?'selected':''}>${String(p.id).padStart(3,'0')} ${p.name}</option>`).join('')}</select></label>
  <label>State <select data-animation aria-label="Animation state"><option>idle</option><option>walk</option><option>attack</option></select></label>
  <label>Variant <select data-variant aria-label="Asset variant">${['normal','dark','rocket','rabid','poisoned','legendary'].map(v=>`<option>${v}</option>`).join('')}</select></label></div>
  <div class="gallery-controls"><button type="button" data-previous>← ID</button><button type="button" data-next>ID →</button><button type="button" data-representative>Next sample (36)</button><button type="button" data-freeze>Freeze frames</button><label>Orbit <select data-orbit aria-label="Preview camera direction">${[0,45,90,135,180,225,270,315].map(d=>`<option value="${d}">${d}°</option>`).join('')}</select></label></div>
  <div class="gallery-controls"><button type="button" data-all-variants>Compare all 6 variants</button></div>
  <canvas aria-label="Live species and variant animation preview"></canvas>
  <div class="gallery-directions">${['↓','↘','→','↗','↑','↖','←','↙'].map((d,i)=>`<span>${i} ${d}</span>`).join('')}</div>
  <output data-status aria-live="polite">Loading preview…</output><p data-roster></p><p data-evolutions></p><p data-credits></p>
  <p><a data-source target="_blank" rel="noreferrer">SpriteCollab source and credits</a> · <a href="${import.meta.env.BASE_URL}assets/asset-attributions.json" target="_blank" rel="noreferrer">Full attribution</a> · <a href="${import.meta.env.BASE_URL}assets/coverage-report.json" target="_blank" rel="noreferrer">151-species audit</a></p></div>`;
  parent.append(root);
  root.addEventListener('keydown',e=>e.stopPropagation());root.addEventListener('keyup',e=>e.stopPropagation());
  root.addEventListener('pointerdown',e=>e.stopPropagation());root.addEventListener('wheel',e=>e.stopPropagation());
  root.addEventListener('toggle',()=>{if(root.open){window.dispatchEvent(new Event('wildlands:gallery-open'));this.open();}else this.close();});
  root.querySelector<HTMLSelectElement>('[data-species]')!.addEventListener('change',e=>this.select(Number((e.target as HTMLSelectElement).value)));
  root.querySelector<HTMLSelectElement>('[data-animation]')!.addEventListener('change',e=>{this.animation=(e.target as HTMLSelectElement).value as AnimationName;});
  root.querySelector<HTMLSelectElement>('[data-variant]')!.addEventListener('change',e=>{this.variant=(e.target as HTMLSelectElement).value as Variant;this.rebuild();});
  root.querySelector<HTMLSelectElement>('[data-orbit]')!.addEventListener('change',e=>{this.offset=Number((e.target as HTMLSelectElement).value)*Math.PI/180;});
  root.querySelector('[data-next]')!.addEventListener('click',()=>this.select(this.speciesId%151+1));
  root.querySelector('[data-previous]')!.addEventListener('click',()=>this.select((this.speciesId+149)%151+1));
  root.querySelector('[data-representative]')!.addEventListener('click',()=>{const i=REPRESENTATIVE_SPECIES.indexOf(this.speciesId);this.select(REPRESENTATIVE_SPECIES[(i+1)%REPRESENTATIVE_SPECIES.length]);});
  root.querySelector<HTMLButtonElement>('[data-freeze]')!.addEventListener('click',e=>{this.frozen=!this.frozen;(e.currentTarget as HTMLButtonElement).textContent=this.frozen?'Resume frames':'Freeze frames';});
  root.querySelector<HTMLButtonElement>('[data-all-variants]')!.addEventListener('click',e=>{
   this.compareVariants=!this.compareVariants;(e.currentTarget as HTMLButtonElement).textContent=this.compareVariants?'Show 8 directions':'Compare all 6 variants';
   const directions=root.querySelector<HTMLElement>('.gallery-directions')!;
   directions.style.gridTemplateColumns=`repeat(${this.compareVariants?6:8},1fr)`;
   directions.innerHTML=(this.compareVariants?['Wild','Dark ◇','Rocket R','Rabid »','Poisoned •','Legendary ♛']:['0 ↓','1 ↘','2 →','3 ↗','4 ↑','5 ↖','6 ←','7 ↙']).map(label=>`<span>${label}</span>`).join('');
   root.querySelector<HTMLSelectElement>('[data-variant]')!.disabled=this.compareVariants;this.rebuild();
  });
  void fetch(`${import.meta.env.BASE_URL}assets/asset-attributions.json`).then(r=>r.ok?r.json():null).then((data:{species?:{id:number;credits:{creator:string}[]}[]}|null)=>{
   for(const row of data?.species??[])this.creditRows.set(row.id,[...new Set(row.credits.map(c=>c.creator))].join(', '));this.refreshLabel();
  }).catch(()=>{});
  (window as Window&{__WILDLANDS_ASSETS__?:AssetGallery}).__WILDLANDS_ASSETS__=this;
 }
 private open() {
  if(!this.root||this.engine)return;
  const canvas=this.root.querySelector('canvas')!;
  this.engine=new Engine(canvas,true,{stencil:false},false);this.scene=new Scene(this.engine);this.scene.clearColor=new Color4(.094,.125,.09,1);
  new ArcRotateCamera('gallery-camera',-Math.PI/2,Math.PI/2,25,new Vector3(0,1.4,0),this.scene);
  this.assets=new AssetLibrary(this.scene);this.rebuild();this.previous=performance.now();this.engine.resize();
  this.engine.runRenderLoop(()=>{
   if(!this.engine||!this.scene)return;
   const now=performance.now(),dt=Math.min(.05,(now-this.previous)/1000);this.previous=now;
   for(let i=0;i<this.avatars.length;i++)this.avatars[i].update({x:(i-(this.avatars.length-1)/2)*(this.compareVariants?3.5:3),z:0,facing:Math.PI-(this.compareVariants?0:i*Math.PI/4),animation:this.animation,size:2.8},this.frozen?0:dt,this.offset,0);
   this.clock+=dt;if(this.clock>.25){this.clock=0;this.refreshLabel();}
   this.scene.render();
  });
 }
 private close() {
  this.engine?.stopRenderLoop();for(const avatar of this.avatars)avatar.dispose();this.avatars=[];
  this.assets?.dispose();this.assets=null;this.scene?.dispose();this.scene=null;this.engine?.dispose();this.engine=null;
 }
 private rebuild(){for(const avatar of this.avatars)avatar.dispose();this.avatars=this.assets?(this.compareVariants?(['normal','dark','rocket','rabid','poisoned','legendary'] as Variant[]).map(variant=>this.assets!.create(this.speciesId,variant)):Array.from({length:8},()=>this.assets!.create(this.speciesId,this.variant))):[];this.refreshLabel();}
 select(id:number){if(!Number.isInteger(id)||id<1||id>151)return;this.speciesId=id;if(this.root)this.root.querySelector<HTMLSelectElement>('[data-species]')!.value=String(id);this.rebuild();}
 private refreshLabel() {
  if(!this.root)return;const actor=this.avatars[0]?.inspect(),name=getSpecies(this.speciesId).name;
  this.root.querySelector('output')!.textContent=actor?`#${this.speciesId} ${name} · ${this.animation} → ${actor.resolved} · frame ${actor.frame+1}/${actor.durations.length||1} · ${actor.durations.length?actor.durations.join(', ')+' ticks @ 60 Hz':'artwork fallback'}\n${actor.source}`:`#${this.speciesId} ${name} · Preview closed`;
  this.root.querySelector<HTMLElement>('[data-credits]')!.textContent=`Sprite creators: ${this.creditRows.get(this.speciesId)??'See source credit records'}. Pokémon assets retain their original rights holders.`;
  const species=getSpecies(this.speciesId),combat=getSpeciesCombat(this.speciesId),profile=getAttackProfile(this.speciesId);
  const encounters=Object.entries(ENCOUNTER_TABLES).filter(([,ids])=>ids.includes(species.id)).map(([table])=>table).join(', ');
  this.root.querySelector<HTMLElement>('[data-roster]')!.textContent=`${species.types.join(' / ').toUpperCase()} · Stage ${species.stage} · ${ROLE_LABELS[combat.role]} · ${species.moveName} (${profile.kind})\nArcade power ${species.power} · cadence ${profile.cooldown.toFixed(2)}s · reach ${profile.range.toFixed(1)}m · encounters: ${encounters}`;
  this.root.querySelector<HTMLElement>('[data-evolutions]')!.textContent=species.evolvesTo.length?species.evolvesTo.map(id=>`${getSpecies(id).name}: ${evolutionRequirement(species.id,id)}.`).join(' '):species.stage===1?`Single-stage mastery: moves keep growing; training grants +${PROGRESSION.moves.soloRankGain} ranks from Pokémon level ${PROGRESSION.moves.soloTrainingLevel}.`:`Final evolved form: move training has no rank limit.`;
  this.root.querySelector<HTMLAnchorElement>('[data-source]')!.href=`https://github.com/PMDCollab/SpriteCollab/tree/master/sprite/${String(this.speciesId).padStart(4,'0')}`;
 }
 inspect(){return {open:this.root?.open??false,speciesId:this.speciesId,animation:this.animation,variant:this.variant,compareVariants:this.compareVariants,actors:this.avatars.map(a=>a.inspect()),engineActive:!!this.engine};}
 dispose(){this.close();this.root?.remove();this.root=null;delete (window as Window&{__WILDLANDS_ASSETS__?:AssetGallery}).__WILDLANDS_ASSETS__;}
}
