export class RNG {
  private state: number;
  constructor(seed = 123456789) { this.state = seed >>> 0 || 1; }
  next(): number { let s = this.state; s ^= s << 13; s ^= s >>> 17; s ^= s << 5; this.state = s >>> 0; return this.state / 4294967296; }
  between(a: number, b: number): number { return a + (b - a) * this.next(); }
  int(a: number, b: number): number { return Math.floor(this.between(a, b + 1)); }
  pick<T>(arr: readonly T[]): T { if (!arr.length) throw Error('Empty pick'); return arr[this.int(0, arr.length - 1)]; }
  shuffle<T>(arr: T[]): T[] { for(let i=arr.length-1;i>0;i--){ const j=this.int(0,i); [arr[i],arr[j]]=[arr[j],arr[i]];}return arr; }
}
export const clamp = (n:number,a:number,b:number) => Math.max(a,Math.min(b,n));
export const distance2 = (a:{x:number,z:number},b:{x:number,z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
