import type {Vec2} from '../game/types.ts';

/** Swept projectile hits remain reliable when one frame crosses a whole actor. */
export function segmentDistanceSquared(point:Vec2,from:Vec2,to:Vec2):number {
 const dx=to.x-from.x,dz=to.z-from.z,length=dx*dx+dz*dz;
 const t=length?Math.max(0,Math.min(1,((point.x-from.x)*dx+(point.z-from.z)*dz)/length)):0;
 return (point.x-from.x-dx*t)**2+(point.z-from.z-dz*t)**2;
}
