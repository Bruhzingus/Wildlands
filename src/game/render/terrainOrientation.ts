import {Quaternion,Vector3} from '@babylonjs/core';

/** Static decoration follows the sampled surface while keeping its seeded yaw.
 * Geometry/physics heights remain authoritative; no frame-time terrain work. */
export function terrainOrientation(x:number,z:number,yaw:number,ground:(x:number,z:number)=>number):Quaternion {
 const dx=(ground(x+.3,z)-ground(x-.3,z))/.6,dz=(ground(x,z+.3)-ground(x,z-.3))/.6;
 const length=Math.hypot(dx,1,dz),nx=-dx/length,ny=1/length,nz=-dz/length;
 const tilt=new Quaternion(nz,0,-nx,1+ny).normalize();
 return tilt.multiply(Quaternion.RotationAxis(Vector3.Up(),yaw));
}
