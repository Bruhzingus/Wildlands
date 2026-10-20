/** Bounded development diagnostics; no observers, timers, storage or network. */
export class FrameMetrics {
 private samples:{frame:number;simulation:number;presentation:number;render:number}[]=[];
 private next=0;
 record(frame:number,simulation:number,presentation:number,render:number){
  if(![frame,simulation,presentation,render].every(Number.isFinite))return;
  const sample={frame,simulation,presentation,render};
  if(this.samples.length<240)this.samples.push(sample);else this.samples[this.next]=sample;
  this.next=(this.next+1)%240;
 }
 inspect(){
  const stat=(key:keyof typeof this.samples[number])=>{
   const values=this.samples.map(s=>s[key]).sort((a,b)=>a-b);
   return {median:values[Math.floor(values.length*.5)]??0,p95:values[Math.floor(values.length*.95)]??0,max:values.at(-1)??0};
  };
  return {samples:this.samples.length,frame:stat('frame'),simulation:stat('simulation'),presentation:stat('presentation'),render:stat('render')};
 }
 reset(){this.samples=[];this.next=0;}
}
