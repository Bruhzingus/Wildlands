import {ACHIEVEMENTS,CHALLENGE_OPTIONS,MAP_OPTIONS,rewardLabels,type RunOptions} from '../data/unlocks.ts';
import {getSpecies,starterChoices} from '../data/kanto.ts';
import {exportSave,importSave,selectRunOptions,type SaveData} from '../game/save.ts';
import {TEMPORARY_FULL_CHARACTER_ACCESS} from '../game/characterAccess.ts';

const esc=(text:string)=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const time=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const displayProgress=(id:string,value:number,target:number,unit:string)=>unit==='seconds'?`${time(value)} / ${time(target)}`:`${Math.min(value,target)} / ${target}${id==='growing-together'?' roles':''}`;

/** Kept outside the title markup so the library can be reused on results. */
export function renderUnlockLibrary(save:SaveData):string {
 const starters=starterChoices();
 return `<details class="unlock-library"><summary>Collection / ${save.unlocked.length} of ${starters.length} partners / ${save.achievements.length} of ${ACHIEVEMENTS.length} achievements</summary>
  <p class="library-intro">${TEMPORARY_FULL_CHARACTER_ACCESS?'Temporary full character access is enabled for all partners and recruits. This collection tracks your earned unlocks.':'Collect partners by completing runs in different ways. Unlocks add choices; your starting HP and damage stay the same.'}</p>
  <ul class="partner-collection" aria-label="Partner collection">${starters.map(id=>{
   const unlocked=save.unlocked.includes(id),achievement=ACHIEVEMENTS.find(entry=>entry.reward.starters?.includes(id));
   return `<li class="${unlocked?'collected':'uncollected'}" data-collection-partner="${id}"><strong>${esc(getSpecies(id).name)}</strong><span>${unlocked?'COLLECTED':esc(achievement?.title??'Starting partner')}</span></li>`;
  }).join('')}</ul>
  <ol class="achievement-list">${ACHIEVEMENTS.map(achievement=>{
   const complete=save.achievements.includes(achievement.id),value=complete?achievement.target:Math.min(achievement.target,save.achievementProgress[achievement.id]??0);
   return `<li data-achievement="${achievement.id}" class="${complete?'is-complete':''}"><div class="achievement-heading"><strong>${complete?'✓ ':''}${esc(achievement.title)}</strong><span>${complete?'COMPLETE':displayProgress(achievement.id,value,achievement.target,achievement.unit)}</span></div><p>${esc(achievement.description)}</p><progress max="${achievement.target}" value="${value}" aria-label="${esc(achievement.title)} progress">${value} / ${achievement.target}</progress><small>Unlocks: ${rewardLabels(achievement.reward).map(esc).join(' · ')}</small></li>`;
  }).join('')}</ol>
  <div class="save-tools"><p>Saved on this device. Export a backup before moving browsers or importing another save.</p><div class="save-tool-buttons"><button type="button" class="btn btn-ghost" data-export-save>Export save</button><label class="btn btn-ghost save-import-label">Import save<input type="file" accept=".json,application/json" data-import-save aria-label="Import Wildlands save JSON"></label></div><div data-import-preview></div><p class="save-tool-status" data-save-status role="status" aria-live="polite"></p></div>
 </details>`;
}
export function renderRunOptions(save:SaveData):string {
 const map=MAP_OPTIONS.find(option=>option.id===save.selection.map)!,challenge=CHALLENGE_OPTIONS.find(option=>option.id===save.selection.challenge)!;
 return `<fieldset class="run-options"><legend>Expedition</legend><label>Route<select data-run-map aria-label="Expedition route">${MAP_OPTIONS.filter(option=>save.unlockedMaps.includes(option.id)).map(option=>`<option value="${option.id}" ${option.id===map.id?'selected':''}>${esc(option.title)}</option>`).join('')}</select></label><label>Rules<select data-run-challenge aria-label="Challenge rules">${CHALLENGE_OPTIONS.filter(option=>save.unlockedChallenges.includes(option.id)).map(option=>`<option value="${option.id}" ${option.id===challenge.id?'selected':''}>${esc(option.title)}</option>`).join('')}</select></label><p data-run-option-help>${esc(map.description)} ${esc(challenge.description)}</p></fieldset>`;
}
export function renderProgressionResult(earned:readonly {title:string;reward:Parameters<typeof rewardLabels>[0]}[]):string {
 if(!earned.length)return '';
 return `<div class="earned-unlocks" role="status"><strong>Collection updated</strong><ul>${earned.map(achievement=>`<li><b>${esc(achievement.title)}</b><span>${rewardLabels(achievement.reward).map(esc).join(' · ')}</span></li>`).join('')}</ul></div>`;
}
export interface ProgressionUICallbacks {onImport:(save:SaveData)=>void;onOptionsChange?:(options:RunOptions)=>void;}
/** Listeners live only on rendered children; replacing the overlay releases them. */
export function bindProgressionUI(root:HTMLElement,save:SaveData,callbacks:ProgressionUICallbacks):void {
 let importAttempt=0;
 const status=root.querySelector<HTMLElement>('[data-save-status]');
 const message=(text:string)=>{if(status)status.textContent=text;};
 const updateOptions=()=>{
  const map=root.querySelector<HTMLSelectElement>('[data-run-map]')?.value as RunOptions['map']|undefined;
  const challenge=root.querySelector<HTMLSelectElement>('[data-run-challenge]')?.value as RunOptions['challenge']|undefined;
  const options=selectRunOptions(save,{map,challenge});
  const help=root.querySelector('[data-run-option-help]');if(help)help.textContent=`${MAP_OPTIONS.find(option=>option.id===options.map)!.description} ${CHALLENGE_OPTIONS.find(option=>option.id===options.challenge)!.description}`;
  callbacks.onOptionsChange?.(options);
 };
 root.querySelector('[data-run-map]')?.addEventListener('change',updateOptions);
 root.querySelector('[data-run-challenge]')?.addEventListener('change',updateOptions);
 root.querySelector('[data-export-save]')?.addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([exportSave(save)],{type:'application/json'})),anchor=document.createElement('a');
  anchor.href=url;anchor.download='wildlands-save.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Save exported. Keep the JSON file as your backup.');
 });
 root.querySelector<HTMLInputElement>('[data-import-save]')?.addEventListener('change',async event=>{
  const input=event.currentTarget as HTMLInputElement,file=input.files?.[0],preview=root.querySelector<HTMLElement>('[data-import-preview]');
  const attempt=++importAttempt;
  if(!file||!preview)return;preview.replaceChildren();
  if(file.size>250_000){message('Save file is too large (250 KB maximum).');input.value='';return;}
  let json:string;try{json=await file.text();}catch{message('The save file could not be read.');input.value='';return;}
  if(!preview.isConnected||attempt!==importAttempt)return;
  const result=importSave(json);input.value='';
  if(!result.ok){message(result.error);return;}
  const description=document.createElement('p');description.textContent=`Import ${result.save.unlocked.length} partners, ${result.save.achievements.length} achievements and ${result.save.games} completed runs? This replaces the progress on this device.`;
  const confirm=document.createElement('button');confirm.type='button';confirm.className='btn btn-primary';confirm.textContent='Use imported save';confirm.dataset.confirmImport='';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='btn btn-ghost';cancel.textContent='Cancel';
  cancel.addEventListener('click',()=>{preview.replaceChildren();message('Import canceled. Your progress is unchanged.');});
  confirm.addEventListener('click',()=>{preview.replaceChildren();callbacks.onImport(result.save);});
  preview.append(description,confirm,cancel);message('Save checked. Review the collection above before replacing it.');confirm.focus();
 });
}
