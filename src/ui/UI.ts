import {version as gameVersion} from '../../package.json';
import {getSpecies,ELEMENT_COLORS} from '../data/kanto.ts';
import {DESIGN} from '../data/config.ts';
import {PARTY_DAMAGE_COLORS} from '../data/damageNumbers.ts';
import type {UpgradeChoice,RunState,PartyMember} from '../game/types.ts';
import {persist,type SaveData} from '../game/save.ts';
import {availableStarters} from '../game/characterAccess.ts';
import {bindProgressionUI,renderProgressionResult,renderRunOptions,renderUnlockLibrary} from './UnlockLibrary.ts';
import type {AchievementDefinition} from '../data/unlocks.ts';
import './unlocks.css';
import './upgrades.css';
import './pokemonProgression.css';
import './evolution.css';
import './movement.css';
import './berries.css';
import type {EvolutionReceipt} from '../game/evolution.ts';
import {loadSettings,saveSettings,type GameSettings} from '../game/settings.ts';
import {getBuildSummary,getBuildModifiers} from '../game/systems/builds.ts';
import {distance2} from '../utils/random.ts';
import {worldProfile,siteAvailable,type WorldProfile} from '../data/maps.ts';
import {bossEncounter,mapEncounter,scheduledBossEncounter} from '../data/encounters.ts';
import {biomeAt} from '../game/systems/environment.ts';
import {layoutMapMarkers,projectMapPoint,MAP_SIZE,type MapMarker} from './minimap.ts';
import {VARIANTS,SPAWN_VARIANTS} from '../data/variants.ts';
import {upgradeIcon} from './upgradeIcons.ts';
import {getMoveDefinition} from '../data/moves.ts';
import {describeAttackMechanic} from '../data/attacks.ts';
import {getSpecialProfile} from '../data/specials.ts';
import {getMovementTrait,MOVEMENT_TRAITS} from '../data/movementTraits.ts';
import {PROGRESSION,nextMilestone} from '../data/progression.ts';
import {CHEST_TIERS,chestCost,chestRarity,shrineTier} from '../data/economy.ts';
import {SHRINE_RULES,shrineContents,shrineForPOI,shrineLevelAllowed} from '../data/shrines.ts';
import {formatPercent,upgradeStatPreview} from './upgradePreview.ts';
import {rerollChoices,xpThreshold} from '../game/systems/progression.ts';
import {UpgradeCatalogue} from './UpgradeCatalogue.ts';
import {BERRIES,BERRY_ORDER} from '../data/berries.ts';
import {downloadJSON} from './runFiles.ts';
import {runAnalyticsReport} from '../game/analytics.ts';
import {renderDamageAnalysis} from './damageAnalysis.ts';
import './runAnalysis.css';
import {RUN_FILE_MAX_BYTES} from '../game/runSnapshot.ts';

const q=<T extends Element=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const fmt=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const esc=(s:string)=>s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c));
const percent=(value:number,max:number)=>Math.min(100,Math.max(0,max>0?100*value/max:0));
const controls='WASD move · Arrow keys / Mouse look · Space jump · Shift dodge · Q special · E use · Esc pause';

export class UI {
 private catalogue:UpgradeCatalogue|null=null;
 isCatalogueOpen(){return this.catalogue!==null;}
 private clearCatalogue(){this.catalogue?.dispose();this.catalogue=null;this.overlay.classList.remove('catalogue-mode');}
 private openCatalogue(state?:RunState){
  this.clearCatalogue();this.clearDetachedImages();this.overlay.classList.add('catalogue-mode');
  this.catalogue=new UpgradeCatalogue(this.content,this.save,()=>{
   this.clearCatalogue();
   if(state?.phase==='paused')this.showPause(state);else this.showTitle();
   cancelAnimationFrame(this.focusFrame);this.content.querySelector<HTMLElement>('[data-open-catalogue]')?.focus();
  });
  this.clearDetachedImages();this.focusFirst();
 }
 private bindCatalogue(state?:RunState){this.content.querySelector('[data-open-catalogue]')?.addEventListener('click',()=>this.openCatalogue(state));}
 showEvolution(receipt:EvolutionReceipt){
  const from=getSpecies(receipt.from),to=getSpecies(receipt.to);
  const banner=q('#evolution-announcement');
  banner.style.setProperty('--evolution-color',ELEMENT_COLORS[to.types[0]]);
  banner.innerHTML=`<span class="evolution-kicker">EVOLUTION</span><strong>${esc(from.name)} <span aria-hidden="true">→</span> ${esc(to.name)}</strong><small>+${Math.round(receipt.powerGain*100)}% attack · ${Math.round(receipt.hpAfter-receipt.hpBefore)} max HP</small>`;
  banner.classList.remove('hidden');
 }
 clearEvolution(){const banner=q('#evolution-announcement');banner.classList.add('hidden');banner.textContent='';}
 private overlay=q('#overlay');private content=q('#overlay-content');private hud=q('#hud');
 private lastPhase='';private lastChoices='';private toastTimer=0;private focusFrame=0;private listeners=new AbortController();
 private imageLoads=new Map<HTMLImageElement,HTMLImageElement>();
 private captureHint='Use arrow keys or the mouse to look. Enter on Resume continues play. Esc pauses.';
 private mapBase:HTMLCanvasElement|null=null;private mapSeed:string|null=null;private mapProfile:WorldProfile|null=null;
 private previousParty=new Map<number,string>();private previousFaints=0;private previousElapsed=0;
 private faintNotice='';private faintUntil=0;private readyUntil=0;private readyNotice='';private cooldowns:Record<string,boolean>={};
 onStart:(id:number)=>void=()=>{};onPick:(id:string)=>void=()=>{};onResume:()=>void=()=>{};onRestart:()=>void=()=>{};onEndless:()=>void=()=>{};
 onSettingsChange:(settings:GameSettings)=>void=()=>{};
 onReroll:()=>void=()=>{};
 onSuspend:()=>void=()=>{};onResumeSaved:()=>void=()=>{};onDiscardSaved:()=>void=()=>{};onImportRun:(json:string)=>void=()=>{};
 private runRecovery={summary:null as string|null,hasStored:false,error:null as string|null};
 setRunRecovery(summary:string|null,hasStored:boolean,error:string|null=null){this.runRecovery={summary,hasStored,error};if(this.lastPhase==='title')this.showTitle();}
 setRunFileStatus(message:string){const status=this.content.querySelector('#run-file-status');if(status)status.textContent=message;this.toast(message);}
 settings=loadSettings();
 private save:SaveData;
 private progressionResult='';
 private toastPriority=0;private toastExpires=0;
 setProgressionResult(earned:readonly AchievementDefinition[]){this.progressionResult=renderProgressionResult(earned);}

 constructor(save:SaveData){this.save=save;
  this.overlay.addEventListener('keydown',event=>{
   if(event.key!=='Tab')return;
   const items=Array.from(this.content.querySelectorAll<HTMLElement>('button,input,select,summary,a[href]')).filter(el=>!el.hasAttribute('disabled')&&el.getClientRects().length>0);
   const first=items[0],last=items[items.length-1];if(!first)return;
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  },{signal:this.listeners.signal});
  this.showTitle();
 }

 showTitle(){
  this.clearCatalogue();
  this.clearEvolution();
  clearTimeout(this.toastTimer);this.toastPriority=0;this.toastExpires=0;q('#toast').classList.remove('show');
  this.previousParty.clear();this.previousFaints=0;this.previousElapsed=0;this.faintUntil=0;this.faintNotice='';this.cooldowns={};this.readyNotice='';this.readyUntil=0;
  this.lastPhase='title';this.hud.classList.add('hidden');this.overlay.classList.remove('hidden');
  const options=availableStarters(this.save);
  this.content.innerHTML=`<div class="front-page"><div class="eyebrow">KANTO SURVIVAL / <span class="game-version">v${esc(gameVersion)}</span></div><h1>WILD<span>LANDS</span></h1><p class="subtitle">Survive 15 minutes. Build your squad.</p><div class="front-launch"><button id="play-btn" class="btn btn-primary" type="button">Play as ${esc(getSpecies(options[0]).name)}</button><p>Choose a partner below to start with them.</p></div><h2>Choose your partner</h2><div class="starter-grid">${options.map(id=>this.pokemonCard(id)).join('')}</div>${renderRunOptions(this.save)}${renderUnlockLibrary(this.save)}<p class="control-help">${controls}</p>${this.settingsPanel()}<p class="disclaimer">Unofficial, noncommercial fan prototype. Pokémon names and artwork belong to their respective owners.</p></div>`;
  let selectedStarter=options[0];
  const play=this.content.querySelector<HTMLButtonElement>('#play-btn')!;
  play.addEventListener('click',()=>this.onStart(selectedStarter));
  this.content.querySelectorAll<HTMLElement>('[data-starter]').forEach(el=>{
   el.addEventListener('focus',()=>{selectedStarter=Number(el.dataset.starter);play.textContent=`Play as ${getSpecies(selectedStarter).name}`;});
   el.addEventListener('click',()=>this.onStart(Number(el.dataset.starter)));
  });
  this.content.querySelector('.starter-grid')!.insertAdjacentHTML('afterend','<div class="catalogue-menu-link"><button type="button" class="btn btn-ghost" data-open-catalogue>Browse all upgrades</button></div>');
  this.bindCatalogue();this.bindSettings();this.imageFallbacks(this.content);this.focusFirst();
  this.bindRunFiles();
  bindProgressionUI(this.content,this.save,{onImport:imported=>{Object.assign(this.save,imported);const saved=persist(this.save);this.showTitle();this.toast(saved?'Save imported. Collection updated.':'Save imported for this session. Browser storage is unavailable.');}});
 }

 private bindRunFiles(){
  const launch=this.content.querySelector('.front-launch');if(!launch)return;
  launch.insertAdjacentHTML('beforebegin',`<section class="run-file-tools" aria-label="Saved expedition"><h2>Saved expedition</h2>${this.runRecovery.summary?`<p>${esc(this.runRecovery.summary)}</p>`:'<p>Save from the pause menu to return later. Each saved checkpoint rolls the whole run back at least 30 seconds, including recent upgrades.</p>'}<div class="save-tool-buttons">${this.runRecovery.summary?'<button id="resume-run-btn" class="btn btn-primary" type="button">Resume saved run</button>':''}<label class="btn btn-ghost save-import-label">Import run file<input id="import-run" type="file" accept=".json,application/json" aria-label="Import suspended run JSON"></label>${this.runRecovery.hasStored?'<button id="discard-run-btn" class="btn btn-ghost" type="button">Discard saved run</button>':''}</div><p id="run-file-status" class="subtle" role="status">${esc(this.runRecovery.error??'Run files are separate from your partner collection.')}</p></section>`);
  this.content.querySelector('#resume-run-btn')?.addEventListener('click',()=>this.onResumeSaved());
  this.content.querySelector('#discard-run-btn')?.addEventListener('click',()=>this.onDiscardSaved());
  this.content.querySelector<HTMLInputElement>('#import-run')?.addEventListener('change',async event=>{
   const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];if(!file)return;
   const status=this.content.querySelector('#run-file-status');
   if(file.size>RUN_FILE_MAX_BYTES){if(status)status.textContent=`Run file is too large (${RUN_FILE_MAX_BYTES/1_000_000} MB maximum).`;input.value='';return;}
   try{const json=await file.text();if(input.isConnected)this.onImportRun(json);}catch{if(status?.isConnected)status.textContent='The run file could not be read.';}
   input.value='';
  });
 }

 private pokemonCard(id:number){const s=getSpecies(id),special=getSpecialProfile(id),primary=describeAttackMechanic(id),movement=getMovementTrait(id);const color=ELEMENT_COLORS[s.types[0]];
  const trait=movement.kind==='normal'?'':`<span class="starter-move"><span class="starter-move-key">MOVEMENT</span><strong>${esc(movement.name)}</strong><span>${esc(movement.description)}</span></span>`;
  return `<button class="starter-card" data-starter="${id}" style="--accent:${color}" aria-label="Start with ${esc(s.name)}" aria-describedby="starter-moves-${id}">${this.portrait(id)}<span class="starter-name">${esc(s.name)}</span><small>${s.types.join(' / ').toUpperCase()}</small><span class="starter-moves" id="starter-moves-${id}"><span class="starter-move"><span class="starter-move-key">AUTO</span><strong>${esc(s.moveName)}</strong><span>${esc(primary)}</span></span><span class="starter-move"><span class="starter-move-key">Q SPECIAL</span><strong>${esc(special.name)}</strong><span>${esc(special.description)}</span></span>${trait}</span></button>`;
 }

 private portrait(id:number,className=''){const species=getSpecies(id);
  return `<img class="${className}" data-species="${id}" src="${this.placeholder(id)}" alt="${esc(species.name)}" width="104" height="104">`;
 }

 private placeholder(id:number){const species=getSpecies(id);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="104" height="104" viewBox="0 0 104 104"><rect width="104" height="104" fill="#202820"/><path d="M27 76V46l9-20 14 12 16-12 12 20v30z" fill="${ELEMENT_COLORS[species.types[0]]}"/><path d="M40 51h5v6h-5zm20 0h5v6h-5z" fill="#202820"/><text x="52" y="94" text-anchor="middle" font-family="monospace" font-size="11" fill="#e6e9d4">#${String(id).padStart(3,'0')}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
 }

 private clearDetachedImages(){
  for(const [target,probe] of this.imageLoads)if(!target.isConnected){probe.onload=null;probe.onerror=null;probe.removeAttribute('src');this.imageLoads.delete(target);}
 }

 private imageFallbacks(root:Element){
  this.clearDetachedImages();
  root.querySelectorAll<HTMLImageElement>('img[data-species]').forEach(img=>{
   const probe=new Image(),id=Number(img.dataset.species);let stage=0;this.imageLoads.set(img,probe);
   const done=()=>{probe.onload=null;probe.onerror=null;this.imageLoads.delete(img);};
   probe.onload=()=>{if(img.isConnected)img.src=probe.src;done();};
   probe.onerror=()=>{if(stage++===0)probe.src=`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;else done();};
   probe.src=`${import.meta.env.BASE_URL}assets/pokemon/${id}.png`;
  });
 }

 private settingsPanel(){return `<fieldset class="settings-panel"><legend>Settings</legend>
  <div class="setting-range"><label for="sound-volume">Sound <output id="sound-value">${Math.round(this.settings.soundVolume*100)}%</output></label><input id="sound-volume" type="range" min="0" max="1" step="0.01" value="${this.settings.soundVolume}" aria-label="Sound volume"></div>
  <div class="setting-range"><label for="music-volume">Music <output id="music-value">${Math.round(this.settings.musicVolume*100)}%</output></label><input id="music-volume" type="range" min="0" max="1" step="0.01" value="${this.settings.musicVolume}" aria-label="Music volume"></div>
  <div class="setting-range"><label class="sensitivity-label" for="mouse-sensitivity">Mouse <output id="sensitivity-value">${this.settings.mouseSensitivity.toFixed(1)}×</output></label><input id="mouse-sensitivity" type="range" min="0.3" max="2.5" step="0.1" value="${this.settings.mouseSensitivity}" aria-label="Mouse sensitivity"></div>
  <div class="graphics-settings"><label for="graphics-quality">Graphics <select id="graphics-quality">${(['auto','low','balanced','high'] as const).map(value=>`<option value="${value}" ${this.settings.graphicsQuality===value?'selected':''}>${{auto:'Automatic',low:'Low',balanced:'Balanced',high:'High'}[value]}</option>`).join('')}</select></label><label for="render-resolution">Resolution <select id="render-resolution">${[1,.75,.5].map(value=>`<option value="${value}" ${this.settings.resolution===value?'selected':''}>${Math.round(value*100)}%</option>`).join('')}</select></label></div>
  <div class="setting-range"><label for="vfx-density">Effects <output id="vfx-value">${Math.round(this.settings.vfxDensity*100)}%</output></label><input id="vfx-density" type="range" min="0.35" max="1" step="0.05" value="${this.settings.vfxDensity}" aria-label="Effect density"></div>
  <div class="comfort-settings"><label><input id="screen-shake" type="checkbox" ${this.settings.screenShake?'checked':''}> Camera shake</label><label><input id="hit-stop" type="checkbox" ${this.settings.hitStop?'checked':''}> Hit pause</label><label><input id="reduce-flashes" type="checkbox" ${this.settings.reduceFlashes?'checked':''}> Reduce flashes</label><label class="invert-label"><input id="invert-y" type="checkbox" ${this.settings.invertY?'checked':''}> Invert Y</label></div>
  <p class="settings-hint">System reduced motion disables camera shake and hit pause.</p></fieldset>`;}

 private bindSettings(){
   const bindRange=(id:string,key:'mouseSensitivity'|'soundVolume'|'musicVolume'|'vfxDensity',output:string,format:(value:number)=>string)=>{
   const input=this.content.querySelector<HTMLInputElement>(`#${id}`);if(!input)return;
   input.addEventListener('input',()=>{this.settings=saveSettings({...this.settings,[key]:Number(input.value)});this.content.querySelector(output)!.textContent=format(this.settings[key]);this.onSettingsChange({...this.settings});});
  };
  bindRange('mouse-sensitivity','mouseSensitivity','#sensitivity-value',value=>`${value.toFixed(1)}×`);
  bindRange('sound-volume','soundVolume','#sound-value',value=>`${Math.round(value*100)}%`);
  bindRange('music-volume','musicVolume','#music-value',value=>`${Math.round(value*100)}%`);
  bindRange('vfx-density','vfxDensity','#vfx-value',value=>`${Math.round(value*100)}%`);
  for(const id of ['graphics-quality','render-resolution'])this.content.querySelector<HTMLSelectElement>(`#${id}`)?.addEventListener('change',event=>{
   const value=(event.currentTarget as HTMLSelectElement).value;
   this.settings=saveSettings({...this.settings,...(id==='graphics-quality'?{graphicsQuality:value as GameSettings['graphicsQuality']}:{resolution:Number(value)})});this.onSettingsChange({...this.settings});
  });
  for(const [id,key] of [['invert-y','invertY'],['screen-shake','screenShake'],['hit-stop','hitStop'],['reduce-flashes','reduceFlashes']] as const){
   const input=this.content.querySelector<HTMLInputElement>(`#${id}`);input?.addEventListener('change',()=>{this.settings=saveSettings({...this.settings,[key]:input.checked});this.onSettingsChange({...this.settings});});
  }
 }

 private focusFirst(){cancelAnimationFrame(this.focusFrame);this.focusFrame=requestAnimationFrame(()=>{if(!this.overlay.classList.contains('hidden'))this.content.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});});}

 update(s:RunState){const choices=s.phase==='choice'?JSON.stringify([s.upgradeChoices,s.rerolls,s.levelUpMemberId,s.party.find(member=>member.uid===s.levelUpMemberId)?.level,s.pendingLevelUps?.length,s.choiceTitle]):'';
  if(this.catalogue){if(s.phase==='paused')return;this.clearCatalogue();}
  if(s.phase!==this.lastPhase||choices!==this.lastChoices){this.lastPhase=s.phase;this.lastChoices=choices;this.displayPhase(s);}
  if(s.phase==='playing'||s.phase==='boss'||s.phase==='choice')this.refresh(s);
 }

 private displayPhase(s:RunState){
  const phase=s.phase;this.hud.classList.toggle('hidden',phase==='title');this.overlay.classList.toggle('hidden',phase==='playing'||phase==='boss');
  if(phase==='choice')this.showChoices(s);
  if(phase==='paused')this.showPause(s);
  if(phase==='result')this.showResult(s);
  this.clearDetachedImages();
 }

 private showChoices(s:RunState){this.overlay.classList.remove('hidden');
  const owner=s.party.find(member=>member.uid===s.levelUpMemberId),queued=s.pendingLevelUps?.length??0;
  const context=owner?`<div class="choice-pokemon" data-level-owner="${owner.uid}">${this.portrait(owner.speciesId)}<div><strong>${esc(getSpecies(owner.speciesId).name)} <span>LV ${owner.level}</span></strong><span>${1+(owner.learnedMoves?.length??0)} / 4 moves${queued?` · ${queued} more milestone ${queued===1?'reward':'rewards'}`:''}</span></div></div>`:'';
  this.content.innerHTML=`<div class="choice-screen"><div class="eyebrow">${owner?'POKÉMON MILESTONE':'SQUAD UPGRADE'} / GAME PAUSED</div>${context}<h2>${esc(s.choiceTitle)}</h2><div class="choices">${s.upgradeChoices.map((c,i)=>this.upgradeCard(c,i,s)).join('')}</div><p class="subtle">Click a card or press ${s.upgradeChoices.map((_,i)=>i+1).join(', ')} to choose</p></div>`;
  this.content.querySelectorAll<HTMLElement>('[data-choice]').forEach(el=>el.addEventListener('click',()=>this.onPick(el.dataset.choice!)));
  const canReroll=(s.rerolls??0)>0&&rerollChoices(s)!==null;
  this.content.querySelector('.choice-screen')!.insertAdjacentHTML('beforeend',`<div class="choice-reroll"><button type="button" data-reroll ${canReroll?'':'disabled'}>Reroll (${s.rerolls??0})</button><p class="subtle">+1 reroll every 5 minutes of play · Next in ${fmt(PROGRESSION.rerolls.intervalSeconds-s.stats.elapsed%PROGRESSION.rerolls.intervalSeconds)}<br>All options change. Rarities stay the same or improve.${(s.rerolls??0)>0&&!canReroll?'<br>No complete set of new options is available.':''}</p></div>`);
  this.content.querySelector('[data-reroll]')!.addEventListener('click',()=>this.onReroll());
  this.imageFallbacks(this.content);this.focusFirst();
 }

 private upgradeCard(c:UpgradeChoice,index:number,s:RunState){const tags={recruit:'RECRUIT',evolve:'EVOLUTION',attack:'MOVE',learn:'NEW MOVE',stat:'TRAINING',item:'RELIC'};
  const cardType=c.kind==='item'?'relic':c.kind==='learn'?'new-move':c.kind==='stat'?'training':c.kind==='attack'?'move':c.kind;
  const cardNote=c.kind==='item'?'CARRY A RELIC':c.kind==='learn'?'LEARN A NEW MOVE':c.kind==='stat'?(c.speciesId!==undefined?'TRAIN THIS POKÉMON':'TRAIN YOUR SQUAD'):'UPGRADE';
  const portraitId=c.kind==='evolve'?c.targetId:c.kind==='recruit'?c.speciesId:undefined;
  const p=portraitId?getSpecies(portraitId):null;
  const img=p?this.portrait(p.id,'upgrade-pokemon'):`<div class="upgrade-glyph" aria-hidden="true">${upgradeIcon(c)}</div>`;
  const rank=c.rank!==undefined&&(c.kind==='stat'||c.kind==='attack')?`<span class="choice-rank">RANK ${c.rank}</span>`:'';
  const member=c.kind!=='recruit'?s.party.find(member=>member.uid===c.speciesId):undefined;
  const owner=member?`${getSpecies(member.speciesId).name} · LV ${member.level}`:c.kind==='recruit'?'NEW TEAMMATE':s.party.length>1?'SQUAD BONUS':'YOUR POKÉMON';
  const slot=member&&(c.kind==='learn'||c.kind==='attack')?` · MOVE ${c.kind==='learn'?2+(member.learnedMoves?.length??0):c.moveId?(member.learnedMoves?.findIndex(move=>move.moveId===c.moveId)??0)+2:1} / 4`:'';
  const raritySymbol={uncommon:'\u25c6+',common:'◆',rare:'◆◆',epic:'◆◆◆',legendary:'◆◆◆◆'}[c.rarity];
  const preview=upgradeStatPreview(s,c).map(row=>`<span class="choice-stat"><span>${esc(row.label)}</span><strong>${esc(row.before)} → ${esc(row.after)}</strong></span>`).join('');
  return `<button type="button" class="choice-card ${c.rarity} card-${cardType}" data-card-type="${cardType}" style="--choice-order:${index}" data-choice="${esc(c.id)}"${member?` data-choice-member="${member.uid}"`:''} aria-keyshortcuts="${index+1}"><span class="choice-header"><span class="choice-kind">${tags[c.kind]}</span><span class="choice-index">${index+1}</span></span><span class="choice-art">${img}</span><strong class="choice-title">${esc(c.title)}</strong><span class="choice-owner">${esc(owner+slot)}</span><span class="choice-rarity"><span class="rarity-symbol" aria-hidden="true">${raritySymbol}</span><span class="rarity-label">${c.rarity.toUpperCase()}</span><span class="rarity-rule" aria-hidden="true"></span></span>${rank}<p>${esc(c.description)}</p>${preview?`<span class="choice-preview" aria-label="Stat changes">${preview}</span>`:''}<span class="choice-footer"><span>${cardNote}</span><span>SELECT &rarr;</span></span></button>`;
 }

 setCaptureHint(message:string){this.captureHint=message;const help=this.content.querySelector('#capture-help');if(help)help.textContent=message;}

 private showPause(s:RunState){this.content.innerHTML=`<div class="pause-screen"><div class="eyebrow">${fmt(s.stats.elapsed)} / ${s.stats.kills} DEFEATED</div><h2>Paused</h2><div class="pause-buttons"><button id="resume-btn" class="btn btn-primary">Resume</button><button id="restart-btn" class="btn btn-ghost">New run</button></div>${this.buildSummary(s)}${this.settingsPanel()}<p class="control-help">${controls}</p><p id="capture-help" class="subtle" role="status">${esc(this.captureHint)}</p></div>`;
  this.content.querySelector('.pause-buttons')!.insertAdjacentHTML('beforeend','<button type="button" class="btn btn-ghost" data-open-catalogue>Browse all upgrades</button>');
  this.content.querySelector('.pause-buttons')!.insertAdjacentHTML('beforeend','<button id="suspend-btn" type="button" class="btn btn-ghost">Save &amp; suspend</button>');
  this.content.querySelector('#suspend-btn')!.addEventListener('click',()=>this.onSuspend());
  this.content.querySelector('.pause-buttons')!.insertAdjacentHTML('afterend','<p class="subtle">Saving downloads a run file and keeps a copy on this device. The whole run returns to a checkpoint at least 30 seconds earlier, or the earliest available checkpoint, removing recent items and upgrades. This replaces the saved run on this device.</p>');
  q('#resume-btn').addEventListener('click',()=>this.onResume());q('#restart-btn').addEventListener('click',()=>this.onRestart());this.bindCatalogue(s);this.bindSettings();this.imageFallbacks(this.content);this.focusFirst();
 }

 private showResult(s:RunState){const victory=s.result==='victory';
  this.content.innerHTML=`<div class="end-screen"><div class="eyebrow">RUN COMPLETE</div><h2>${victory?'Victory':'Game over'}</h2><p>${victory?`${mapEncounter(s.mapId).boss.name} defeated. Keep going?`:'Choose a partner and try again.'}</p><div class="result-stats"><div><strong>${fmt(s.stats.elapsed)}</strong><span>TIME</span></div><div><strong>${s.stats.kills}</strong><span>DEFEATED</span></div><div><strong>${s.party.length}</strong><span>PARTY</span></div><div><strong>${s.stats.faints}</strong><span>FAINTED</span></div></div><div class="pause-buttons">${victory?'<button id="endless-btn" class="btn btn-primary">Continue endless</button>':''}<button id="restart-btn" class="btn ${victory?'btn-ghost':'btn-primary'}">New run</button></div>${this.buildSummary(s)}${this.progressionResult}</div>`;
  this.content.querySelector('.end-screen')!.insertAdjacentHTML('beforeend',`<button id="download-report-btn" class="btn btn-ghost" type="button">Download balancing report</button>${renderDamageAnalysis(s)}`);
  this.content.querySelector('#download-report-btn')!.addEventListener('click',()=>downloadJSON(JSON.stringify(runAnalyticsReport(s),null,2),`wildlands-balance-${s.seed}-${Math.floor(s.stats.elapsed)}s.json`));
  q('#restart-btn').addEventListener('click',()=>this.onRestart());if(victory)q('#endless-btn').addEventListener('click',()=>this.onEndless());this.imageFallbacks(this.content);this.focusFirst();
 }

 private buildSummary(s:RunState){
  const build=getBuildSummary(s),m=build.modifiers;
  const leader=s.party[0],special=getSpecialProfile(leader.speciesId,leader.attackLevel);
  const bonus=(value:number)=>`${value>=0?'+':''}${formatPercent(value)}`;
  return `<details class="build-summary" open><summary>Build / ${build.items.reduce((total,item)=>total+item.stacks,0)} relic copies / ${build.synergies.length} synergies</summary>
   <div class="build-modifiers"><span>Leader damage ${bonus(m.power)}</span><span>Attack speed ${bonus(m.haste)}</span><span>Max HP ${Math.ceil(s.player.maxHp)}</span><span>Defense ${Number(m.armor.toFixed(2))}</span><span>Deflection ${formatPercent(m.deflection)}</span><span>Stamina ${s.player.dodgeCharges??1} / ${1+Math.floor(m.staminaCapacity)}</span><span>Movement ${bonus(m.speed)}</span><span>Stamina recharge time -${formatPercent(m.staminaRechargeReduction)}</span><span>Dodge recovery ${bonus(m.stamina)}</span><span>Special recovery ${bonus(m.specialHaste)}</span><span>Crit ${formatPercent(m.critChance)}</span><span>Area ${bonus(m.radius)}</span></div>
   <p class="progression-help">Full shared XP for every living teammate. Levels add 2% HP and attack up to level ${PROGRESSION.leveling.maxLevel}; choices happen at levels 3, 5, 10, 15… Extra move slots unlock at levels 10, 20 and 30. Training stacks without a rank limit. Choose evolutions and new moves before level ${PROGRESSION.leveling.trainingFocusLevel}; later choices train moves and stats. Coins buy extra upgrades from supply chests.</p><div class="build-party pokemon-team" aria-label="Pokémon levels and moves">${s.party.map(member=>this.pokemonSummary(member,s)).join('')}</div>
   <div class="build-special"><strong>Q / ${esc(special.name)}</strong><span>${esc(special.description)}</span><span>${special.cooldown.toFixed(0)}s base cooldown · Rank ${leader.attackLevel}</span></div>
   <div class="build-movement"><strong>Movement / ${esc(getMovementTrait(leader.speciesId).name)}</strong><span>${esc(getMovementTrait(leader.speciesId).description)}</span></div>
   <div class="build-synergies">${build.synergies.length?build.synergies.map(synergy=>`<div data-synergy="${esc(synergy.id)}"><strong>${esc(synergy.title)}</strong><span>${esc(synergy.description)}</span></div>`).join(''):'<p>No active team synergies yet.</p>'}</div>
   <div class="build-items">${build.items.length?build.items.map(item=>`<div data-item="${esc(item.id)}"><strong>${esc(item.title)}${item.stacks>1?` ×${item.stacks}`:''}</strong><span>${item.stacks>1?'Per copy: ':''}${esc(item.description)}</span></div>`).join(''):'<p>Find discovery caches for relics.</p>'}</div>
   ${build.caps.length?`<p class="build-caps">${build.caps.map(esc).join(' · ')}</p>`:''}</details>${this.variantLegend()}`;
 }

 private pokemonMoves(member:PartyMember){
  return [{name:getSpecies(member.speciesId).moveName,rank:member.attackLevel},...(member.learnedMoves??[]).slice(0,3).map(move=>({name:getMoveDefinition(move.moveId)?.name??move.moveId,rank:move.rank}))];
 }

 private pokemonSummary(member:PartyMember,state:RunState){
  const moves=this.pokemonMoves(member),xp=member.xp??0,next=member.xpToNext??xpThreshold(member.level),milestone=nextMilestone(member.level);
  const species=getSpecies(member.speciesId),evolution=member.level>=PROGRESSION.leveling.trainingFocusLevel?' · Move / stat training':species.evolvesTo.length?` · Evolution: LV ${species.stage>=2?PROGRESSION.evolution.finalLevel:PROGRESSION.evolution.firstLevel} + ${PROGRESSION.evolution.maturitySeconds}s training, before LV ${PROGRESSION.leveling.trainingFocusLevel}`:'';
  return `<section class="pokemon-summary" data-summary-member="${member.uid}"><div class="pokemon-summary-heading">${this.portrait(member.speciesId)}<div><strong>${esc(species.name)}</strong><span>LV ${member.level} · ${Math.floor(xp)} / ${next} XP</span><div class="pokemon-xp-track" aria-hidden="true"><span style="width:${percent(xp,next)}%"></span></div><span>${milestone?`Next choice: LV ${milestone}`:'MAX LEVEL'}${evolution}</span></div><small>Defense ${Number(getBuildModifiers(state,member).armor.toFixed(2))} | ${moves.length} / 4 MOVES</small></div><ol class="pokemon-moves">${Array.from({length:4},(_,index)=>{const move=moves[index];return `<li class="pokemon-move-slot${move?'':' empty'}" data-move-slot="${index+1}"><span class="move-slot-number">${index+1}</span><span class="move-slot-name">${move?esc(move.name):'Open move slot'}</span>${move?`<span class="move-slot-rank">RANK ${move.rank}</span>`:'<span class="move-slot-rank">LEARN</span>'}</li>`;}).join('')}</ol></section>`;
 }

 private variantLegend(){const glyphs={none:'',diamond:'◇',r:'R',chevrons:'»',droplets:'◦◦',crown:'♛'};
  return `<div class="variant-key" aria-label="Enemy markers">${[...SPAWN_VARIANTS.filter(v=>v!=='normal'),'legendary' as const].map(v=>`<span title="${esc(VARIANTS[v].description)}">${glyphs[VARIANTS[v].cue]} ${esc(VARIANTS[v].label)}</span>`).join('')}</div>`;
 }

 refresh(s:RunState){const p=s.player,stats=s.stats,boss=s.enemies.find(e=>e.isBoss&&!e.dead);
  q('#clock').textContent=fmt(stats.elapsed);q('#kills').textContent=String(stats.kills);
  q('#coins').textContent=String(s.coins??0);
  q('#progress-fill').style.width=`${Math.min(100,stats.elapsed/900*100)}%`;
  const scheduled=scheduledBossEncounter(s.mapId,s.stats.bossesDefeated??0);
  q('#danger').textContent=boss?'LEGENDARY ENCOUNTER':s.director?.bossWarning?`${scheduled.name.toUpperCase()} APPROACHES / ${Math.ceil(s.director.bossCountdown)}s`:(s.director?.title??'QUIET MEADOW').toUpperCase();
  const profile=this.profile(s),biome=profile.definition.palette[biomeAt(p.x,p.z,profile)];q('#map-region').textContent=biome.name.toUpperCase();
  q('#leader-name').textContent=getSpecies(s.party[0].speciesId).name.toUpperCase();
  q('#health-text').textContent=`${Math.ceil(p.hp)} / ${Math.ceil(p.maxHp)}${p.poisonTime>0?' / POISON':''}`;q('#hp-fill').style.width=`${percent(p.hp,p.maxHp)}%`;
  const critical=p.hp/p.maxHp<.25;
  q('.leader-panel').classList.toggle('critical-health',critical);
  q('#health-status').textContent=critical?'! CRITICAL':p.poisonTime>0?'POISONED':'';
  const leader=s.party[0],leaderXP=leader.xp??stats.xp,leaderNext=leader.xpToNext??xpThreshold(leader.level);
  q('#level-label').textContent=`LV ${leader.level}`;q('#xp-text').textContent=`${Math.floor(leaderXP)} / ${leaderNext} XP`;
  q('#xp-fill').style.width=`${percent(leaderXP,leaderNext)}%`;
  const milestone=nextMilestone(leader.level);q('#next-milestone').textContent=milestone?`NEXT ${milestone>=PROGRESSION.leveling.trainingFocusLevel?'TRAINING':'CHOICE'}: LV ${milestone}`:`MAX LEVEL ${PROGRESSION.leveling.maxLevel}`;
  const berryBuffs=BERRY_ORDER.flatMap(kind=>{const active=(s.berryBuffs?.[kind]??[]).filter(expiresAt=>expiresAt>stats.elapsed);return active.length?[`${BERRIES[kind].name.replace(' Berry','').toUpperCase()} x${active.length} ${Math.ceil(Math.max(...active)-stats.elapsed)}s`]:[];});
  q('#berry-buff').textContent=berryBuffs.length?`BERRIES · ${berryBuffs.join(' · ')}`:'';
  const special=getSpecialProfile(leader.speciesId,leader.attackLevel),specialTile=q('#special-cd');
  const specialLabel=specialTile.querySelector('span:not(.kbd)')!;if(specialLabel.textContent!==special.name.toUpperCase())specialLabel.textContent=special.name.toUpperCase();
  specialTile.title=`${special.description} (${special.cooldown.toFixed(0)}s base cooldown)`;
  specialTile.dataset.special=special.kind;
  this.refreshCooldown('special-cd',p.specialCooldown,`Q ${special.name} ready`,stats.elapsed);
  this.refreshCooldown('dodge-cd',(p.dodgeCharges??0)>0?0:p.dodgeCooldown,`Shift dodge ready (${p.dodgeCharges??1} stamina)`,stats.elapsed);
  const trait=getMovementTrait(leader.speciesId),movement=p.movement,traitStatus=q('#movement-trait');
  traitStatus.classList.toggle('hidden',trait.kind==='normal');traitStatus.dataset.trait=trait.kind;traitStatus.title=trait.description;
  const traitText=trait.kind==='runup'?(movement?.boost?`${trait.name.toUpperCase()} +${Math.round(movement.boost*100)}% SPEED / NEXT ATTACK +${Math.round(movement.boost/(trait.boost??1)*MOVEMENT_TRAITS.runupAttackBonus*100)}%`:`RUN ${Math.min(MOVEMENT_TRAITS.runupDelay,movement?.straightTime??0).toFixed(1)} / ${MOVEMENT_TRAITS.runupDelay.toFixed(1)}s`)
   :trait.kind==='flight'?(movement?.flying?`FLYING ${movement.flightRemaining.toFixed(1)}s`:movement?.flightCooldown?`FLIGHT RECHARGE ${movement.flightCooldown.toFixed(1)}s`:p.y>0&&!movement?.flightEligible?'FLIGHT / LAND FOR TAKEOFF':`HOLD SPACE / FLY ${trait.airtime}s`)
   :trait.kind==='burrow'?((p.burrowTime??0)>0?`BURROWED ${(p.burrowTime??0).toFixed(1)}s / PROTECTED`:'SHIFT / BURROW DASH')
   :trait.kind==='leap'?'SPACE / SPLASH LEAP':trait.kind==='teleport'?'SHIFT / TELEPORT':'';
  if(traitStatus.textContent!==traitText)traitStatus.textContent=traitText;
  const ready=q('#ability-ready');const readyLabel=stats.elapsed<this.readyUntil?this.readyNotice:'';if(ready.textContent!==readyLabel)ready.textContent=readyLabel;
  const strip=q('#party-strip');const signature=s.party.map(v=>`${v.uid}/${v.speciesId}/${v.attackLevel}/${v.learnedMoves?.map(m=>`${m.moveId}:${m.rank}`).join(';')??''}`).join(',');
  if(strip.dataset.signature!==signature){strip.dataset.signature=signature;strip.innerHTML=Array.from({length:6},(_,i)=>{
   const member=s.party[i];if(!member)return `<div class="party-empty"><span>—</span><small>${i+1}</small></div>`;
   const spec=getSpecies(member.speciesId);return `<div class="party-unit ${i===0?'leader':''}" data-member="${member.uid}">${this.portrait(spec.id)}<span class="party-damage-color" style="--damage-color:${PARTY_DAMAGE_COLORS[i]}" title="Damage color; ! marks critical hits"></span><span class="party-level" title="Pokémon level">L${member.level}</span><span class="party-rank" title="Base move rank">R${member.attackLevel}</span><span class="party-critical" aria-hidden="true">!</span><span class="party-poison" aria-label="Poisoned">P</span><span class="party-hp"></span><span class="party-health"></span><span class="party-xp-track"><span class="party-xp"></span></span></div>`;
  }).join('');this.imageFallbacks(strip);}
  s.party.forEach((member,index)=>{const unit=strip.querySelector<HTMLElement>(`[data-member="${member.uid}"]`);if(!unit)return;
   const hp=index===0?p.hp:member.hp,maxHp=index===0?p.maxHp:member.maxHp,low=hp/maxHp<.25;
   unit.querySelector<HTMLElement>('.party-health')!.style.width=`${percent(hp,maxHp)}%`;
   unit.querySelector<HTMLElement>('.party-hp')!.textContent=`${Math.ceil(hp)} HP`;
   const xp=member.xp??0,next=member.xpToNext??xpThreshold(member.level),moves=this.pokemonMoves(member);
   unit.querySelector<HTMLElement>('.party-level')!.textContent=`L${member.level}`;
   unit.querySelector<HTMLElement>('.party-xp')!.style.width=`${percent(xp,next)}%`;
   const milestone=nextMilestone(member.level);
   const summary=`${getSpecies(member.speciesId).name} · Lv ${member.level}\n${Math.floor(xp)} / ${next} XP · ${moves.length} / 4 moves\n${milestone?`Next milestone choice: level ${milestone}`:'Maximum level'}\n${Array.from({length:4},(_,index)=>`${index+1}. ${moves[index]?`${moves[index].name} (Rank ${moves[index].rank})`:'Open move slot'}`).join('\n')}`;
   const track=unit.querySelector<HTMLElement>('.party-xp-track')!;track.setAttribute('role','progressbar');track.setAttribute('aria-label',`${getSpecies(member.speciesId).name} experience`);track.setAttribute('aria-valuenow',String(Math.min(next,Math.floor(xp))));track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(next));
   if(unit.title!==summary)unit.title=summary;
   unit.classList.toggle('low-health',low);unit.classList.toggle('is-poisoned',index===0?p.poisonTime>0:(member.poisonTime??0)>0);
   unit.setAttribute('aria-label',`${summary.replace(/\n/g,', ')}, ${Math.ceil(hp)} of ${Math.ceil(maxHp)} HP${low?', critical health':''}`);
  });
  this.refreshPartyAlert(s);
  const near=s.pois.find(poi=>siteAvailable(poi,stats.elapsed)&&(!poi.used||poi.respawnAt!==undefined)&&distance2(p,poi)<DESIGN.interactionRadius)??s.pois.find(poi=>poi.challenge)??s.pois.find(poi=>poi.kind==='shrine'&&siteAvailable(poi,stats.elapsed)&&distance2(p,poi)<SHRINE_RULES.previewRadius);
  const nearBerry=!near?(s.berryTrees??[]).find(tree=>distance2(p,tree)<6&&tree.berries.some(berry=>!berry.collected)):undefined;
  const interaction=q('#interaction');interaction.classList.toggle('hidden',!near&&!nearBerry);
  if(near){const cost=chestCost(s,near),affordable=(s.coins??0)>=cost,seconds=Math.ceil((near.challenge?.endsAt??near.respawnAt??0)-s.stats.elapsed),definition=shrineForPOI(near),allowed=near.kind!=='shrine'||shrineLevelAllowed(s.party[0].level,definition),inReach=distance2(p,near)<DESIGN.interactionRadius,remaining=s.enemies.filter(enemy=>!enemy.dead&&enemy.challengeSiteId===near.uid).length,signature=`${near.uid}/${cost}/${affordable}/${seconds}/${near.used}/${shrineTier(s,near)}/${allowed}/${inReach}/${remaining}`;
   if(interaction.dataset.poi!==signature){interaction.dataset.poi=signature;
    const label=near.challenge?`${esc(shrineContents(definition))}<small>${remaining} left · ${seconds}s · Stay within ${definition.radius}m</small>`
     :near.used?`${near.kind==='shrine'?'Shrine recharges':'Chest restocks'} in ${seconds}s`
     :near.kind==='cache'&&near.price!==undefined?`${chestRarity(s,near).toUpperCase()} chest · ${affordable?'Choose relic':'Need'} ${cost} coins`
    :({cache:'Open discovery cache · One use',shrine:`${esc(shrineContents(definition))}<small>Tier ${definition.tier} · Recommended Lv ${definition.level} · ${definition.radius}m arena${allowed?'':' · Must be within 10 levels'}</small>`,healing:'Recover HP'})[near.kind];
    interaction.innerHTML=`${near.used||!allowed||!inReach?'':'<span class="kbd">E</span> '}<span class="poi-copy">${near.name?`${esc(near.name)} · `:''}${label}</span>`;interaction.classList.toggle('unaffordable',(!affordable||!allowed)&&!near.used);
   }
  }else if(nearBerry){
   const berry=BERRIES[nearBerry.berry],signature=`berry-${nearBerry.uid}-${nearBerry.cycle}`;
   if(interaction.dataset.poi!==signature){interaction.dataset.poi=signature;interaction.innerHTML=`<span class="poi-copy">${esc(berry.name)} · ${esc(berry.rarity)}<small>${esc(berry.description)} Walk over fallen berries to collect.</small></span>`;interaction.classList.remove('unaffordable');}
  }
  this.drawMap(s);
  q('#boss-bar').classList.toggle('hidden',!boss);
  if(boss){
   q('#boss-hp-fill').style.width=`${percent(boss.hp,boss.maxHp)}%`;
   const encounter=bossEncounter(s.activeBossEncounterId??(mapEncounter(s.mapId).boss.speciesId===146?'moltres':'mewtwo'));
   const hints={volley:`${encounter.moves.volley.toUpperCase()} · Move off the aim line`,psychicRing:`${encounter.moves.psychicRing.toUpperCase()} · Jump or dodge through the wave`,summon:`${encounter.moves.summon.toUpperCase()} · Reinforcements incoming`,slam:`${(boss.windup?.moveName??'Psyshock').toUpperCase()} · Leave the marked area`,enemyMove:`${boss.windup?.moveName??'ATTACK'} · Leave the marked area`};
   const stage=encounter.stages[Math.min(boss.bossStage??s.bossStage??0,encounter.stages.length-1)];
   q('#boss-action').textContent=boss.windup?hints[boss.windup.kind]:(s.psychicRings?.length?`${encounter.moves.psychicRing.toUpperCase()} RING · Jump or dodge through the wave`:`${encounter.name.toUpperCase()} / STAGE ${(boss.bossStage??s.bossStage??0)+1}: ${stage.label.toUpperCase()}`);
  }
 }

 private refreshCooldown(id:string,remaining:number,label:string,elapsed:number){
  const tile=q(`#${id}`),ready=remaining<=0;
  tile.querySelector('small')!.textContent=ready?'READY':`${remaining.toFixed(1)}s`;
  tile.classList.toggle('is-ready',ready);tile.setAttribute('aria-label',ready?label:`${label.replace(' ready','')} recharges in ${remaining.toFixed(1)} seconds`);
  if(ready&&this.cooldowns[id]===false){this.readyNotice=label;this.readyUntil=elapsed+2.5;}
  this.cooldowns[id]=ready;
 }

 private refreshPartyAlert(s:RunState){
  const elapsed=s.stats.elapsed;
  if(elapsed<this.previousElapsed){this.previousParty.clear();this.previousFaints=s.stats.faints;this.faintUntil=0;}
  if(s.stats.faints>this.previousFaints){
   const living=new Set(s.party.map(member=>member.uid));const names=[...this.previousParty].filter(([uid])=>!living.has(uid)).map(([,name])=>name);
   this.faintNotice=`${names.length?names.join(', '):'A teammate'} fainted · Squad ${s.party.length} / 6`;this.faintUntil=elapsed+6;
  }
  const critical=s.party.filter((member,index)=>(index===0?s.player.hp/s.player.maxHp:member.hp/member.maxHp)<.25);
  let label='';
  if(elapsed<this.faintUntil)label=this.faintNotice;
  else if(critical.length)label=`! Critical HP: ${critical.slice(0,2).map(member=>getSpecies(member.speciesId).name).join(', ')}${critical.length>2?` +${critical.length-2}`:''}`;
  const alert=q('#party-alert');if(alert.textContent!==label)alert.textContent=label;alert.classList.toggle('hidden',!label);alert.dataset.kind=elapsed<this.faintUntil?'faint':'critical';
  this.previousParty=new Map(s.party.map(member=>[member.uid,getSpecies(member.speciesId).name]));this.previousFaints=s.stats.faints;this.previousElapsed=elapsed;
 }

 private profile(s:RunState){
  const key=`${s.seed}:${s.mapId??'wildlands'}`;
  if(!this.mapProfile||this.mapSeed!==key){this.mapProfile=worldProfile(s.seed,s.mapId);this.mapSeed=key;this.mapBase=null;}
  return this.mapProfile;
 }
 private drawMap(s:RunState){
  const canvas=q<HTMLCanvasElement>('#minimap');if(!canvas)return;
  const context=canvas.getContext('2d');if(!context)return;
  const profile=this.profile(s);
  if(!this.mapBase){
   this.mapBase=document.createElement('canvas');this.mapBase.width=MAP_SIZE;this.mapBase.height=MAP_SIZE;
   const base=this.mapBase.getContext('2d')!;base.fillStyle='#1c261f';base.fillRect(0,0,MAP_SIZE,MAP_SIZE);
   const scale=146/(DESIGN.mapRadius*2);
   for(let x=10;x<156;x+=4)for(let y=10;y<156;y+=4){base.fillStyle=profile.definition.palette[biomeAt((x-83)/scale,(83-y)/scale,profile)].mapColor;base.fillRect(x,y,4,4);}
   const pond=projectMapPoint(profile.lake);base.fillStyle=profile.definition.waterColor;base.beginPath();base.arc(pond.x,pond.y,profile.lake.waterRadius*scale,0,Math.PI*2);base.fill();
   base.strokeStyle='#bcc4a5';base.lineWidth=1;base.strokeRect(9.5,9.5,147,147);
   base.fillStyle='#e8ebda';base.font='bold 8px monospace';base.textAlign='center';base.fillText('N',83,8);
  }
  context.clearRect(0,0,MAP_SIZE,MAP_SIZE);context.drawImage(this.mapBase,0,0);
  const boss=s.enemies.find(e=>e.isBoss&&!e.dead),markers:MapMarker[]=[{...s.player,id:'player',kind:'player',priority:3,radius:6},
   ...s.pois.filter(p=>siteAvailable(p,s.stats.elapsed)&&(!p.used||p.respawnAt!==undefined||p.challenge)).map(p=>({...p,rarity:chestRarity(s,p),id:`poi-${p.uid}`,priority:p.challenge?2:1,kind:p.kind,radius:3.5})),
   ...(s.berryTrees??[]).map(tree=>({...tree,id:`berry-${tree.uid}`,kind:'berry' as const,priority:.5,radius:2.5,label:BERRIES[tree.berry].name,used:tree.berries.every(berry=>berry.collected)})),
   ...profile.landmarks.map(p=>({...p,id:p.id,kind:'landmark' as const,priority:0,radius:4,label:p.initial}))];
  if(boss)markers.push({...boss,id:'boss',kind:'boss',priority:2,radius:5});
  const placed=layoutMapMarkers(markers);canvas.dataset.markers=String(placed.length);
  for(const marker of [...placed].reverse()){
   const {mapX:x,mapY:y,kind}=marker;
   if(Math.hypot(x-marker.anchorX,y-marker.anchorY)>1){context.strokeStyle='#e8ebda';context.lineWidth=.6;context.beginPath();context.moveTo(x,y);context.lineTo(marker.anchorX,marker.anchorY);context.stroke();}
   context.save();context.globalAlpha=marker.used?.45:1;context.translate(x,y);context.lineWidth=1.4;context.strokeStyle='#172019';context.fillStyle='#e9cc78';context.beginPath();
   if(kind==='player'){context.rotate(s.player.facing);context.moveTo(0,-6);context.lineTo(-4.5,4.5);context.lineTo(4.5,4.5);context.closePath();context.fillStyle='#f4f2d9';context.fill();context.stroke();}
   else if(kind==='cache'){context.fillStyle=marker.price===undefined?'#bad49a':CHEST_TIERS[marker.rarity??'common'].color;context.rect(-3,-3,6,6);context.fill();context.stroke();if(marker.price!==undefined){context.moveTo(-2,0);context.lineTo(2,0);context.stroke();}}
   else if(kind==='shrine'||kind==='boss'){context.moveTo(0,-4);context.lineTo(4,0);context.lineTo(0,4);context.lineTo(-4,0);context.closePath();context.fillStyle=kind==='boss'?'#e0c2ed':'#bda5db';context.fill();context.stroke();}
   else if(kind==='healing'){context.fillStyle='#d0e5ba';context.fillRect(-3.5,-1.2,7,2.4);context.fillRect(-1.2,-3.5,2.4,7);}
   else if(kind==='berry'){context.fillStyle='#83b467';context.arc(0,0,3,0,Math.PI*2);context.fill();context.stroke();context.fillStyle='#da8c7c';context.beginPath();context.arc(1,-1,1.2,0,Math.PI*2);context.fill();}
   else {context.font='bold 9px monospace';context.textAlign='center';context.textBaseline='middle';context.lineWidth=2;context.strokeText(marker.label??'',0,0);context.fillStyle='#e8ebda';context.fillText(marker.label??'',0,0);}
   context.restore();
  }
 }

 toast(label:string,priority=1){
  const now=performance.now();if(now<this.toastExpires&&priority<this.toastPriority)return;
  const el=q('#toast');this.toastPriority=priority;this.toastExpires=now+3100;el.textContent=label;el.classList.add('show');
  clearTimeout(this.toastTimer);this.toastTimer=window.setTimeout(()=>{el.classList.remove('show');this.toastPriority=0;},3100);
 }
 handleNumber(key:string,s:RunState):boolean{if(s.phase!=='choice'||!['1','2','3','4'].includes(key))return false;const choice=s.upgradeChoices[Number(key)-1];if(choice)this.onPick(choice.id);return true;}
 dispose(){this.clearCatalogue();this.listeners.abort();clearTimeout(this.toastTimer);cancelAnimationFrame(this.focusFrame);for(const probe of this.imageLoads.values()){probe.onload=null;probe.onerror=null;probe.removeAttribute('src');}this.imageLoads.clear();this.content.replaceChildren();const strip=q('#party-strip');strip.replaceChildren();delete strip.dataset.signature;}
}
