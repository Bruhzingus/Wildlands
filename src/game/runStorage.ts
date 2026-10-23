import {decodeRunFile} from './runSnapshot.ts';

export const SUSPENDED_RUN_KEY='wildlands-suspended-run-v1';
const BACKUP_KEY=`${SUSPENDED_RUN_KEY}-previous`;
export interface RunRecovery {json:string|null;error:string|null;}
/** localStorage writes are atomic. Retain a valid previous slot until the replacement succeeds. */
export function storeSuspendedRun(json:string):boolean {
 if(!decodeRunFile(json).ok)return false;
 try{
  const previous=localStorage.getItem(SUSPENDED_RUN_KEY);
  if(previous&&decodeRunFile(previous).ok)localStorage.setItem(BACKUP_KEY,previous);
  localStorage.setItem(SUSPENDED_RUN_KEY,json);return true;
 }catch{return false;}
}
export function loadSuspendedRun():RunRecovery {
 try{
  const current=localStorage.getItem(SUSPENDED_RUN_KEY);
  if(current&&decodeRunFile(current).ok)return {json:current,error:null};
  const previous=localStorage.getItem(BACKUP_KEY);
  if(previous&&decodeRunFile(previous).ok)return {json:previous,error:'The latest checkpoint could not be read. The previous saved checkpoint is available.'};
  return {json:null,error:current||previous?'The saved run is incompatible or damaged. Import a backup file or explicitly discard it.':null};
 }catch{return {json:null,error:'Browser storage is unavailable. You can still import and download run files.'};}
}
export function discardSuspendedRun():boolean {
 try{localStorage.removeItem(SUSPENDED_RUN_KEY);localStorage.removeItem(BACKUP_KEY);return true;}catch{return false;}
}
