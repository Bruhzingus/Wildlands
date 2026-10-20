interface PointerLockTarget {
 requestPointerLock(options?:{unadjustedMovement:boolean}):Promise<void>|void;
}

/** Prefer relative device input, avoiding the browser's adjusted cursor path.
 * The returned handler supports pointerlockerror on legacy, event-only browsers.
 * Promise browsers report failures through their rejection, allowing a raw-input
 * failure to fall back without the error event cancelling that fallback.
 */
export function requestCameraPointerLock(target:PointerLockTarget,isCurrent:()=>boolean,onFailure:()=>void):()=>void {
 let promisePending=false;
 const failed=(error:unknown,raw:boolean)=>{
  if(!isCurrent())return;
  promisePending=false;
  if(raw&&error!==null&&typeof error==='object'&&'name' in error&&error.name==='NotSupportedError')request(false);
  else onFailure();
 };
 const request=(raw:boolean)=>{
  if(!isCurrent())return;
  try{
   const result=raw?target.requestPointerLock({unadjustedMovement:true}):target.requestPointerLock();
   promisePending=!!result;
   if(result)Promise.resolve(result).catch(error=>failed(error,raw));
  }catch(error){failed(error,raw);}
 };
 request(true);
 return ()=>{if(!promisePending&&isCurrent())onFailure();};
}
