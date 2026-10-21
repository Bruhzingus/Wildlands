import {PROGRESSION} from '../../data/progression.ts';

export function attackInterval(base:number,haste:number,rank=1):number {
 return base/Math.max(Number.EPSILON,1+haste)/(1+PROGRESSION.moves.speedPerRank*Math.max(0,rank-1));
}
/** All elapsed casts are preserved; only their visual/physics representation is grouped. */
export function scheduleCasts(cooldown:number,elapsed:number,interval:number):{cooldown:number;packets:number[]} {
 const remaining=cooldown-elapsed;
 if(remaining>0)return {cooldown:remaining,packets:[]};
 if(!(interval>0)||!Number.isFinite(interval))return {cooldown:0,packets:[]};
 const casts=Math.min(Number.MAX_SAFE_INTEGER,1+Math.floor(-remaining/interval+1e-10));
 const packets=Math.min(casts,PROGRESSION.moves.maxCastPacketsPerStep),each=Math.floor(casts/packets),extra=casts%packets;
 return {cooldown:Math.max(0,remaining+casts*interval),packets:Array.from({length:packets},(_,index)=>each+(index<extra?1:0))};
}
