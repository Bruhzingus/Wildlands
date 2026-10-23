/** Babylon's default world is left-handed: camera-forward +Z means right +X. */
export function cameraAimDirection(alpha:number){return {aimX:-Math.cos(alpha),aimZ:-Math.sin(alpha)};}
export function cameraRelativeMovement(alpha:number,forward:number,right:number){
 if(forward===0&&right===0)return {mx:0,mz:0};
 const fx=-Math.cos(alpha),fz=-Math.sin(alpha);
 let mx=fx*forward+fz*right,mz=fz*forward-fx*right;
 const length=Math.hypot(mx,mz);
 if(length>1){mx/=length;mz/=length;}
 return {mx,mz};
}

/** FPS mouse convention: move right to turn right, move up to look up. */
export function mouseLook(alpha:number,beta:number,dx:number,dy:number,sensitivity:number,invertY:boolean){
 return {
  alpha:alpha-dx*.0025*sensitivity,
  beta:Math.max(.48,Math.min(1.43,beta-dy*.0025*sensitivity*(invertY?-1:1))),
 };
}

/** Arrow-key look uses radians per second, independent of mouse preferences. */
export function keyboardLook(alpha:number,beta:number,right:number,up:number,dt:number){
 return {
  alpha:alpha-right*1.8*dt,
  beta:Math.max(.48,Math.min(1.43,beta+up*1.2*dt)),
 };
}
