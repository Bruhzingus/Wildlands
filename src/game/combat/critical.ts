/** A hit has whole guaranteed tiers and one fractional tier roll. No chance cap. */
export function criticalTier(chance:number,roll:()=>number):number {
 const safe=Number.isFinite(chance)?Math.max(0,chance):0,whole=Math.floor(safe),fraction=safe-whole;
 return whole+(fraction>0&&roll()<fraction?1:0);
}
export function criticalMultiplier(tier:number,multiplier:number):number {
 return Math.min(Number.MAX_VALUE,Math.pow(multiplier,tier));
}
