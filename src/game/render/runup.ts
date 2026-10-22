/** Original eight-direction quadruped gallops. Four independently planted paws,
 * a horizontal torso and forward head distinguish the boost from upright Walk. */
export const RUNUP_ATLAS={cell:64,frames:6,rows:8,durations:[5,5,5,5,5,5]} as const;
export function drawRunUpAtlas(ctx:CanvasRenderingContext2D,speciesId:number){
 const {cell,frames,rows}=RUNUP_ATLAS,raichu=speciesId===26,jolteon=speciesId===135;
 const outline='#493923',fur=raichu?'#ed9b35':jolteon?'#efd34b':'#f5d348',shade=raichu?'#bc722d':'#c39b32',light='#fff0b1';
 ctx.clearRect(0,0,cell*frames,cell*rows);ctx.imageSmoothingEnabled=false;
 for(let row=0;row<rows;row++)for(let frame=0;frame<frames;frame++){
  ctx.save();ctx.translate(frame*cell,row*cell);
  const a=row*Math.PI/4,fx=Math.sin(a),fz=Math.cos(a),phase=frame/frames*Math.PI*2,bob=Math.sin(phase*2)*.65;
  const point=(along:number,side:number,height:number):[number,number]=>[Math.round(32+fx*along+fz*side),Math.round(48+fz*along*.52-fx*side*.52-height)];
  const polygon=(points:[number,number][],color:string)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=outline;ctx.lineWidth=1.25;ctx.stroke();};
  const line=(points:[number,number][],color:string,width:number)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=outline;ctx.lineWidth=width+2;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();};
  const oval=(p:[number,number],rx:number,ry:number,color:string)=>{ctx.beginPath();ctx.ellipse(...p,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=outline;ctx.lineWidth=1.25;ctx.stroke();};
  // The tails are drawn behind the body and retain each species' silhouette.
  if(!jolteon){
   const sway=Math.sin(phase)*2;
   if(raichu){line([point(-8,0,11),point(-19,2,13+sway),point(-20,-2,23+sway)],'#69462e',1.5);polygon([point(-20,-2,23+sway),point(-27,-2,21+sway),point(-24,-2,28+sway),point(-18,-2,31+sway)],fur);}
   else polygon([point(-8,0,11),point(-17,0,16+sway),point(-14,0,20+sway),point(-24,0,23+sway),point(-20,0,29+sway),point(-10,0,24+sway),point(-14,0,21+sway),point(-7,0,16)],fur);
  }
  const legs=[{along:-7,side:-4},{along:8,side:-4},{along:-7,side:4},{along:8,side:4}].sort((l,r)=>point(l.along,l.side,0)[1]-point(r.along,r.side,0)[1]);
  const leg=(l:{along:number;side:number})=>{
   const t=phase+(l.along<0?Math.PI*.6:0)+(l.side<0?Math.PI:0),stride=Math.cos(t)*5,lift=Math.max(0,Math.sin(t))*4;
   line([point(l.along,l.side,11+bob),point(l.along+stride*.45,l.side,5+lift),point(l.along+stride,l.side,1+lift)],l.side<0?shade:fur,3);
   oval(point(l.along+stride+1,l.side,1+lift),3,1.8,l.side<0?shade:fur);
  };
  for(const l of legs.slice(0,2))leg(l);
  if(jolteon){
   const spikes:[number,number][]=[];for(let i=0;i<20;i++){const theta=i*Math.PI/10,r=i%2?1:1.26;spikes.push(point(Math.cos(theta)*12*r,Math.sin(theta)*6*r,12+bob));}polygon(spikes,fur);
  }else oval(point(-1,0,12+bob),7+Math.abs(fx)*6,6+Math.abs(fz)*2,fur);
  if(!jolteon){line([point(-4,-4,16+bob),point(-4,4,16+bob)],raichu?'#75472c':'#a77630',2);line([point(-8,-3,15+bob),point(-8,3,15+bob)],raichu?'#75472c':'#a77630',2);}
  for(const l of legs.slice(2))leg(l);
  if(jolteon){
   const ruff:[number,number][]=[];for(let i=0;i<16;i++){const theta=i*Math.PI/8,r=i%2?1:1.4;ruff.push(point(7+Math.cos(theta)*4*r,Math.sin(theta)*7*r,13+bob));}polygon(ruff,light);
  }else if(raichu)oval(point(5,0,10+bob),5+Math.abs(fx)*2,4,light);
  // Long ears trail back with the lowered head rather than standing upright.
  for(const side of [-1,1]){
   const base=point(9,side*5,21+bob),tip=point(raichu?2:4,side*(jolteon?10:9),raichu?31:35+bob);
   polygon([base,point(13,side*6,24+bob),tip,point(5,side*7,25+bob)],raichu?'#80502c':fur);
   if(!raichu)polygon([tip,point(6,side*8,29+bob),point(7,side*9,30+bob)],'#443b2b');
  }
  oval(point(11,0,17+bob),7.2,6.6,fur);
  if(fz>-.6){
   const sides=Math.abs(fx)<.2?[-1,1]:[fx>0?1:-1];
   for(const side of sides){
    const eye=point(14,side*4,19+bob);ctx.fillStyle='#292c26';ctx.fillRect(eye[0]-1,eye[1]-1,2,3);ctx.fillStyle='#fff8da';ctx.fillRect(eye[0],eye[1]-1,1,1);
    if(!jolteon){const cheek=point(13,side*6,15+bob);ctx.fillStyle=raichu?'#ffe77a':'#d35b35';ctx.fillRect(cheek[0]-1,cheek[1],3,2);}
   }
   const nose=point(17,0,16+bob);ctx.fillStyle=outline;ctx.fillRect(nose[0]-1,nose[1],2,1);
  }
  ctx.restore();
 }
}
