import {Mesh,MeshBuilder,Scene,StandardMaterial} from '@babylonjs/core';
import {getSpecies} from '../../data/kanto.ts';
import {ShrineSculptor} from './shrineSculpting.ts';

/** Authored silhouettes and broad relief details stay readable at the gameplay
 * camera. Solid bevels, inset stone eyes and chiseled mouths replace the old
 * round primitives and rod-only wings, without textures or new materials. */
export function createShrineStatue(scene:Scene,speciesId:number,stone:StandardMaterial,carving:StandardMaterial):Mesh {
 const sculpt=new ShrineSculptor(scene,stone,carving);
 const ball=sculpt.mass.bind(sculpt),rod=sculpt.limb.bind(sculpt),tail=sculpt.curve.bind(sculpt),plate=sculpt.plate.bind(sculpt);
 const eyes=sculpt.eyes.bind(sculpt),nose=sculpt.nose.bind(sculpt),mouth=sculpt.mouth.bind(sculpt),paw=sculpt.paw.bind(sculpt),ear=sculpt.ear.bind(sculpt);
 const feet=(four=false,claws=false)=>{for(const x of [-.43,.43])for(const z of four?[-.5,.55]:[.15]){rod([x,four?.79:.57,z-.05],[x,.27,z],.16,.13);paw(x,.21,z,.26,claws);}};
 const coil=(diameter:number,thickness:number,y:number)=>{
  const mesh=MeshBuilder.CreateTorus('carved serpent coil',{diameter,thickness,tessellation:24},scene);
  mesh.position.y=y;mesh.material=stone;mesh.convertToFlatShadedMesh();sculpt.parts.push(mesh);
 };
 const grin=(y:number,z:number,width:number)=>{
  plate([[-width,y+.07],[-width*.55,y-.07],[0,y-.12],[width*.55,y-.07],[width,y+.07],[width*.68,y-.22],[0,y-.31],[-width*.68,y-.22]],z,.07,true);
  for(let i=-2;i<=2;i++)plate([[i*width*.26-.065,y-.025],[i*width*.26+.065,y-.025],[i*width*.26+.04,y-.16],[i*width*.26-.04,y-.16]],z+.045,.04);
 };
 const dragonWings=(small=false)=>{for(const sign of [-1,1]){
  const k=small?.64:1;
  const contour=[[.4,1.65],[.72,2.58],[1.38,3.05],[2.02,2.5],[1.75,1.46],[1.38,1.83],[1.14,1.3],[.88,1.62]].map(([x,y])=>[sign*x*k,1.6+(y-1.6)*k] as [number,number]);
  plate(contour,-.22,.18);
  for(const [tipX,tipY] of [[1.73,2.46],[1.54,1.7],[1.13,1.54]]){
   plate([[sign*.79*k,1.6+.8*k],[sign*(tipX-.12)*k,1.6+(tipY-1.6)*k],[sign*1.07*k,1.6+.13*k]],-.106,.025,true);
   rod([sign*.76*k,1.6+.94*k,-.12],[sign*tipX*k,1.6+(tipY-1.6)*k,-.12],.055,.025);
  }
  rod([sign*.43*k,1.65,-.18],[sign*.75*k,1.6+.98*k,-.18],.13,.075);
  rod([sign*.75*k,1.6+.98*k,-.18],[sign*1.38*k,1.6+1.45*k,-.18],.08,.025);
 }};
 const birdWings=(jagged=false)=>{for(const sign of [-1,1]){
  ball(sign*.52,1.78,-.02,.4,.32,.26);rod([sign*.35,1.65,0],[sign*1.15,2.23,-.04],.23,.16);
  if(jagged){
   plate([[sign*.52,1.68],[sign*1.03,2.65],[sign*1.22,2.3],[sign*1.91,2.94],[sign*1.72,2.32],[sign*2.55,2.55],[sign*2.1,1.98],[sign*2.75,1.82],[sign*1.87,1.57],[sign*2.14,1.18],[sign*1.35,1.51],[sign*1.38,.92],[sign*.79,1.42]],-.1,.2);
   for(let i=0;i<3;i++)rod([sign*(.75+i*.3),1.72+i*.09,.025],[sign*(1.28+i*.42),1.34+i*.25,.025],.055,.025,true);
  }else{
   for(let i=0;i<6;i++){
    const rootX=.65+i*.16,rootY=1.75+i*.09,endX=1.08+i*.3,endY=.74+i*.23;
    plate([[sign*(rootX-.15),rootY],[sign*(rootX+.14),rootY+.16],[sign*(endX+.19),endY+.17],[sign*endX,endY-.11],[sign*(endX-.12),endY+.16]],-.13-i*.022,.17);
    rod([sign*rootX,rootY,-.025-i*.022],[sign*endX,endY+.05,-.025-i*.022],.026,.012,true);
   }
  }
 }};
 const leaf=(x:number,y:number,z:number,angle:number,size:number,carved=false)=>{
  const mesh=plate([[0,-.12],[-.27,.22],[-.43,.7],[0,1.3],[.43,.7],[.27,.22]],0,.16,carved);
  mesh.rotation.set(Math.PI*.42,angle,0);mesh.position.set(x,y,z);mesh.scaling.setAll(size);return mesh;
 };
 switch(speciesId){
 case 74:
  // The legless guardian rises from a small rubble support; this keeps its wide
  // fists proportionate to the pedestal instead of scaling the body to 8m wide.
  ball(0,.31,-.03,.59,.39,.46);ball(-.32,.18,.04,.32,.25,.3);ball(.34,.16,-.05,.32,.23,.31);
  ball(0,1.27,0,.85,.76,.65);
  for(const sign of [-1,1]){
   ball(sign*.72,1.4,-.04,.29,.29,.35);rod([sign*.72,1.35,0],[sign*1.17,1.08,.12],.23,.19);ball(sign*1.31,1.19,.17,.36,.36,.31);
   for(let i=0;i<3;i++)ball(sign*(1.18+i*.12),1.38,.38,.1,.15,.1);
   mouth([[sign*1.15,1.12,.44],[sign*1.42,1.12,.44]],.025);plate([[sign*.2,1.87],[sign*.68,1.72],[sign*.51,1.51]],.49,.16);
  }
  eyes(1.53,.57,.3,.18,.085,true);mouth([[-.37,1.09,.59],[0,1.03,.67],[.37,1.09,.59]],.035);
  plate([[-.55,1.95],[-.36,2.13],[-.07,1.97]],-.08,.3);break;
 case 56:case 57: {
  const prime=speciesId===57;
  ball(0,1.3,0,prime?.82:.65,prime?.78:.62,.58);ball(0,1.59,.25,.55,.5,.45);
  for(const sign of [-1,1]){
   rod([sign*.36,.94,0],[sign*.48,.39,.14],.17,.13);paw(sign*.49,.22,.27,.23);
   ball(sign*.59,1.52,.02,.23,.3,.27);rod([sign*.59,1.47,.02],[sign*1.01,1.32,.16],.17,.14);
   rod([sign*1.01,1.32,.16],[sign*1.13,1.86,.31],.14,.13);ball(sign*1.13,1.95,.31,.25,.27,.23);
   for(let i=0;i<2;i++)mouth([[sign*1.13+(i-.5)*.13,1.96,.52],[sign*1.13+(i-.5)*.13,2.1,.48]],.014);
   ear(sign*.42,1.91,.1,sign*.63,2.24,.17);
  }
  for(let i=0;i<9;i++){const a=i*Math.PI*2/9;plate([[Math.sin(a)*.48,1.3+Math.cos(a)*.5],[Math.sin(a+.17)*.72,1.3+Math.cos(a+.17)*.72],[Math.sin(a+.08)*.94,1.3+Math.cos(a+.08)*.88]],-.07,.3);}
  if(!prime)tail([[0,1,-.45],[.65,.83,-.75],[1,.98,-.7],[1.09,1.28,-.6],[.91,1.4,-.6]],.12);
  else for(const sign of [-1,1]){ball(sign*.44,.48,.12,.21,.12,.2,true);ball(sign*1.1,1.72,.28,.16,.08,.16,true);}
  ball(0,1.48,.66,.27,.2,.17);for(const sign of [-1,1])ball(sign*.1,1.48,.805,.047,.065,.025,true);
  eyes(1.78,.61,.28,.17,.09,true);break;
 }
 case 58:
  ball(0,.98,-.09,.53,.52,.81);feet(true);ball(0,1.4,.42,.5,.61,.4);ball(0,1.82,.59,.48,.44,.43);ball(0,1.64,.98,.31,.22,.3);
  for(const sign of [-1,1]){
   ear(sign*.29,2.01,.5,sign*.43,2.53,.2);plate([[sign*.25,1.44],[sign*.63,1.2],[sign*.48,.88],[sign*.28,1.03],[sign*.12,.77],[0,1.1]],.66,.19);
   for(let i=0;i<3;i++)plate([[sign*.48,1.25-i*.14],[sign*.55,1.2-i*.14],[sign*.43,1.11-i*.14]],-.2+i*.32,.05,true);
  }
  tail([[0,1.03,-.75],[.15,1.54,-1],[.4,1.93,-1.08],[.73,1.95,-1.02],[.85,1.68,-.9],[.63,1.56,-.83]],.27);
  ball(0,2.21,.46,.24,.2,.22);eyes(1.88,.94,.26,.17,.1);nose(1.72,1.24,.16);mouth([[-.2,1.54,1.15],[0,1.48,1.23],[.2,1.54,1.15]],.021);break;
 case 133:
  ball(0,.87,0,.43,.49,.63);feet(true);ball(0,1.49,.42,.52,.46,.43);
  for(const sign of [-1,1]){
   ear(sign*.3,1.77,.38,sign*.6,2.72,.22);
   for(let i=0;i<3;i++)plate([[sign*(.12+i*.15),1.23],[sign*(.42+i*.1),1.08],[sign*(.31+i*.07),.76],[sign*(.18+i*.06),.96]],.56-i*.08,.22);
  }
  plate([[-.22,1.19],[.22,1.19],[.29,.99],[0,.65],[-.29,.99]],.67,.18);
  tail([[0,.84,-.56],[.45,.95,-.99],[.78,1.34,-1.11],[.91,1.72,-1.04]],.31);ball(.65,1.15,-1,.33,.38,.3);
  eyes(1.56,.81,.27,.17,.13);ball(0,1.3,.83,.24,.16,.18);nose(1.37,1.005,.11);mouth([[-.14,1.27,.96],[0,1.23,.995],[.14,1.27,.96]],.018);break;
 case 23:
  coil(1.36,.36,.28);coil(.86,.32,.47);tail([[.4,.32,-.3],[.79,.36,-.56],[.98,.48,-.48]],.16);
  tail([[.03,.5,0],[-.2,.87,.04],[-.15,1.3,.17],[0,1.72,.31]],.25);ball(0,1.76,.46,.39,.23,.43);ball(0,1.62,.68,.31,.1,.23);
  eyes(1.84,.78,.24,.12,.07,true);nose(1.72,.87,.06);mouth([[-.28,1.64,.71],[0,1.6,.91],[.28,1.64,.71]],.018);
  for(let i=0;i<3;i++)rod([-.15,1.04+i*.17,.3],[.15,1.04+i*.17,.3],.026,.026,true);break;
 case 41:
  rod([0,.13,-.03],[0,.9,0],.25,.13);ball(0,1.3,0,.32,.53,.28);ball(0,1.71,.02,.41,.42,.34);
  for(const sign of [-1,1]){
   ear(sign*.24,1.94,-.02,sign*.45,2.65,.2);
   plate([[sign*.22,1.56],[sign*.75,2.35],[sign*1.38,2.47],[sign*2.05,1.42],[sign*1.64,1.54],[sign*1.49,.98],[sign*1.12,1.32],[sign*.8,.89],[sign*.55,1.29]],-.03,.15);
   plate([[sign*.65,1.56],[sign*.84,2.15],[sign*1.25,2.25],[sign*1.68,1.61],[sign*1.4,1.2],[sign*1.12,1.49],[sign*.86,1.14]],.056,.02,true);
   rod([sign*.25,1.56,.03],[sign*.77,2.32,.03],.11,.06);rod([sign*.77,2.32,.03],[sign*1.37,2.46,.03],.065,.025);
   for(const [x,y] of [[1.49,1.01],[2.05,1.43],[.8,.92]])rod([sign*.8,2.28,.06],[sign*x,y,.06],.045,.015);
   rod([sign*.17,1.04,0],[sign*.27,.74,.1],.075,.025);
  }
  plate([[-.29,1.79],[0,1.88],[.29,1.79],[.21,1.38],[0,1.3],[-.21,1.38]],.34,.07,true);
  for(const sign of [-1,1])plate([[sign*.1,1.8],[sign*.22,1.77],[sign*.13,1.5]],.405,.05);break;
 case 20:
  ball(0,.9,-.16,.66,.63,.87);feet(true);ball(0,1.4,.58,.53,.49,.45);
  for(const sign of [-1,1]){
   ball(sign*.45,1.03,.17,.33,.41,.39);ball(sign*.42,1.78,.39,.26,.29,.15);ball(sign*.42,1.79,.53,.14,.17,.025,true);ball(sign*.3,1.21,.93,.31,.23,.25);
   for(let i=0;i<2;i++)rod([sign*.41,1.25,.95],[sign*(.85+i*.09),1.2+i*.13,1.03],.025,.01);
   plate([[sign*.02,1.16],[sign*.2,1.16],[sign*.19,.82],[sign*.035,.85]],1.19,.12);
  }
  tail([[0,.72,-.9],[.55,.49,-1.19],[.98,.59,-1.53],[1.18,.93,-1.65],[1.07,1.14,-1.57]],.125);eyes(1.53,.97,.28,.15,.095,true);nose(1.39,1.19,.15);break;
 case 94:
  ball(0,1.15,0,.88,1.01,.65);feet();
  for(const sign of [-1,1]){
   ear(sign*.52,1.84,-.04,sign*.76,2.58,.23);ball(sign*.74,1.16,.04,.24,.29,.28);rod([sign*.76,1.13,.1],[sign*1.08,.78,.35],.2,.15);paw(sign*1.08,.79,.43,.2,true);
   plate([[sign*.63,1.63],[sign*1.01,1.67],[sign*.72,1.37]],-.16,.3);
  }
  for(let i=-2;i<=2;i++)rod([i*.22,1.72,-.4],[i*.27,2.33-Math.abs(i)*.11,-.57],.16,0);
  eyes(1.69,.55,.33,.22,.11,true);grin(1.32,.65,.59);break;
 case 27:case 28: {
  const slash=speciesId===28;ball(0,1,0,.66,.79,.6);ball(0,1.77,.22,.49,.47,.44);ball(0,1.62,.59,.33,.22,.32);feet(false,true);
  for(const sign of [-1,1]){ear(sign*.33,2,.1,sign*.49,2.39,.19);ball(sign*.5,1.1,.09,.26,.34,.24);rod([sign*.55,1.09,.1],[sign*.75,.66,.45],.2,.15);paw(sign*.75,.65,.5,.22,true);}
  for(let i=0;i<4;i++){
   const width=.39-Math.abs(i-1.5)*.035;plate([[-width,.67+i*.21],[width,.67+i*.21],[width+.025,.81+i*.21],[-width-.025,.81+i*.21]],.535,.06);mouth([[-width,.66+i*.21,.566],[width,.66+i*.21,.566]],.014);
  }
  if(slash)for(let i=0;i<11;i++){const a=i*2.4,x=Math.sin(a)*.42,y=.8+(i%4)*.3;plate([[x-.18,y],[x+.18,y+.04],[x+Math.sin(a)*.46,y+.87]],-.55-(i%2)*.1,.24);}
  else for(let row=0;row<4;row++)for(let side=-1;side<=1;side++){const x=side*.34+(row%2)*.1;mouth([[x-.12,.68+row*.29,-.49],[x,.88+row*.29,-.59],[x+.17,.9+row*.29,-.53]],.022);}
  tail([[0,.65,-.4],[0,.35,-.93],[.18,.5,-1.35]],.23);eyes(1.83,.63,.26,.15,.1,true);nose(1.69,.85,.085);break;
 }
 case 25:
  ball(0,.94,0,.57,.69,.45);ball(0,1.78,.09,.62,.52,.47);feet();ear(-.3,2.12,.03,-.59,3.08,.18);ear(.31,2.1,.04,.73,2.94,.18);
  plate([[.29,.66],[.7,.9],[.5,1.24],[.98,1.47],[.83,1.82],[1.48,2.11],[1.29,1.37],[.87,1.14],[1,.83],[.48,.55]],-.48,.2);
  for(const sign of [-1,1]){rod([sign*.48,1.22,.06],[sign*.73,.93,.38],.14,.1);paw(sign*.72,.95,.42,.14);ball(sign*.46,1.57,.45,.135,.12,.05,true);}
  eyes(1.86,.525,.27,.14,.125);nose(1.7,.575,.07);mouth([[-.19,1.58,.55],[-.08,1.54,.581],[0,1.58,.59],[.08,1.54,.581],[.19,1.58,.55]],.017);
  for(const sign of [-1,1])plate([[sign*.5,2.73],[sign*.68,2.88],[sign*.65,3.015],[sign*.58,3.03]],.105,.035,true);break;
 case 24:
  coil(1.38,.43,.3);tail([[0,.42,0],[.16,.93,-.05],[0,1.47,0],[0,2.19,.05]],.31);
  plate([[-.32,.93],[-.78,1.19],[-1.04,1.81],[-.95,2.24],[-.45,2.58],[0,2.7],[.45,2.58],[.95,2.24],[1.04,1.81],[.78,1.19],[.32,.93]],.02,.36);
  for(const sign of [-1,1]){
   plate([[sign*.3,2.11],[sign*.62,2.24],[sign*.84,2.1],[sign*.77,1.78],[sign*.46,1.72],[sign*.31,1.84]],.225,.045,true);
   plate([[sign*.45,2.08],[sign*.64,2.13],[sign*.7,1.97],[sign*.56,1.86]],.257,.03);
  }
  mouth([[-.55,1.48,.22],[0,1.27,.265],[.55,1.48,.22]],.047);ball(0,2.6,.19,.44,.33,.4);ball(0,2.45,.46,.33,.12,.27);eyes(2.68,.51,.25,.15,.07,true);
  for(let i=0;i<4;i++)rod([-.16,.65+i*.19,.29],[.16,.65+i*.19,.29],.028,.028,true);
  for(const sign of [-1,1])rod([sign*.16,2.44,.65],[sign*.13,2.28,.69],.045,0);break;
 case 93:
  tail([[0,.15,-.1],[-.22,.53,-.07],[.12,.93,-.02],[0,1.27,0]],.32);ball(0,1.76,0,.89,.66,.49);
  for(const sign of [-1,1]){
   plate([[sign*.55,1.44],[sign*1.16,1.67],[sign*.79,1.9],[sign*1.21,2.28],[sign*.62,2.17],[sign*.52,2.61],[sign*.21,2.18]],-.02,.28);
   tail([[sign*.45,1.13,-.1],[sign*.9,.83,-.08],[sign*1.19,1.05,.18]],.09);ball(sign*1.25,1.08,.25,.28,.18,.25);
   for(let i=-1;i<=1;i++)tail([[sign*(1.2+i*.1),1.08,.29],[sign*(1.48+i*.1),.98,.49-i*.1],[sign*(1.43+i*.1),.78,.61-i*.1]],.08);
  }
  eyes(1.95,.46,.36,.24,.125,true);grin(1.58,.49,.63);break;
 case 66:case 68: {
  const champ=speciesId===68;ball(0,1.39,0,champ?.61:.47,.64,.36);ball(0,1.88,.03,champ?.7:.51,.39,.4);ball(0,2.41,.06,.38,.43,.33);ball(0,2.23,.31,.32,.18,.25);
  for(const sign of [-1,1]){
   ball(sign*.32,.83,0,.28,.42,.29);rod([sign*.33,.8,0],[sign*.48,.27,.15],.21,.17);paw(sign*.49,.14,.29,.25,true);
   for(const row of champ?[0,1]:[1]){
    const y=1.33+row*.56,elbowY=y+(row?.06:-.25),fistY=y+(row?.57:-.05);
    ball(sign*.6,y,0,.27,.3,.29);rod([sign*.6,y,0],[sign*1.03,elbowY,.02-row*.16],.22,.19);ball(sign*.89,(y+elbowY)/2,.01,.28,.25,.25);
    rod([sign*1.03,elbowY,.02-row*.16],[sign*1.31,fistY,.19],.2,.17);ball(sign*1.31,fistY,.19,.25,.27,.23);
    for(let i=0;i<2;i++)mouth([[sign*1.31+(i-.5)*.14,fistY-.05,.4],[sign*1.31+(i-.5)*.14,fistY+.12,.38]],.016);
   }
  }
  for(const x of [-.2,0,.2]){const crest=plate([[-.12,2.61],[-.17,2.94],[.04,3.12],[.14,2.7]],0,.11);crest.rotation.y=Math.PI*.5;crest.position.x=x;}
  if(champ){ball(0,.99,.03,.53,.22,.38,true);ball(0,1.07,.39,.21,.15,.075);plate([[-.075,1.07],[0,1.15],[.075,1.07],[0,1]],.473,.025,true);}
  mouth([[-.23,1.8,.37],[0,1.71,.42],[.23,1.8,.37]],.022);eyes(2.45,.37,.21,.14,.08,true);mouth([[-.21,2.18,.48],[0,2.13,.53],[.21,2.18,.48]],.022);break;
 }
 case 38:
  ball(0,.94,0,.44,.53,.77);feet(true);ball(0,1.5,.47,.38,.54,.34);ball(0,1.84,.58,.35,.35,.34);ball(0,1.69,.91,.23,.16,.3);
  for(const sign of [-1,1]){ear(sign*.2,2.02,.5,sign*.33,2.52,.15);plate([[sign*.08,1.43],[sign*.42,1.39],[sign*.37,.93],[sign*.18,1.13],[0,.94]],.58,.18);}
  for(let i=0;i<9;i++){const a=(i-4)*.32,x=Math.sin(a),height=2.32+Math.cos(a)*.55;sculpt.flow([[x*.15,.85,-.6],[x*.75,1.15,-1.02],[x*1.35,height-.53,-1.25],[x*1.63,height,-1.11],[x*1.56,height+.23,-.96]],[.12,.23,.26,.17,.02]);}
  eyes(1.92,.86,.2,.13,.075);nose(1.75,1.17,.09);mouth([[-.13,1.62,1.1],[0,1.59,1.16],[.13,1.62,1.1]],.016);break;
 case 76:
  ball(0,1.22,-.06,.94,.93,.84);feet(false,true);
  for(let i=0;i<12;i++){
   const a=i*2.4,y=.8+(i%3)*.38,x=Math.sin(a)*.67,z=Math.cos(a)*.63;ball(x,y,z,.37,.35,.28);if(z>.1)mouth([[x-.15,y+.1,z+.23],[x,y+.23,z+.25],[x+.17,y+.08,z+.22]],.02);
  }
  ball(0,1.47,.79,.39,.37,.36);ball(0,1.28,1.02,.33,.16,.24);
  for(const sign of [-1,1]){ball(sign*.82,1.15,.02,.3,.35,.34);rod([sign*.84,1.08,.1],[sign*1.1,.67,.48],.25,.2);paw(sign*1.1,.61,.58,.23,true);}
  eyes(1.57,1.075,.23,.14,.08,true);mouth([[-.25,1.26,1.15],[0,1.2,1.26],[.25,1.26,1.15]],.025);break;
 case 130:
  for(let i=0;i<12;i++){
   const t=i/11,x=Math.sin(t*Math.PI*1.7)*.73,y=.32+t*3.03,z=-.5+Math.cos(t*Math.PI*1.7)*.5;ball(x,y,z,.4-t*.065,.35,.37);
   if(i>1){const scale=plate([[x-.24,y-.17],[x+.24,y-.17],[x+.28,y+.07],[x,y+.2],[x-.28,y+.07]],z+.33,.055);scale.rotation.x=-.12;}
   if(i%3===0)plate([[x-.19,y],[x+.19,y+.03],[x+.04,y+.58]],z-.3,.2);
  }
  ball(-.62,3.52,-.08,.55,.37,.57);ball(-.62,3.62,.26,.49,.23,.39);ball(-.62,3.26,.37,.43,.13,.39);ball(-.62,3.42,.51,.39,.16,.11,true);
  for(const sign of [-1,1]){
   plate([[-.62+sign*.27,3.83],[-.62+sign*.63,4.42],[-.62+sign*.54,3.69]],-.02,.19);plate([[-.62+sign*.37,3.62],[-.62+sign*.91,3.68],[-.62+sign*.63,3.27]],.04,.15);
   tail([[-.62+sign*.37,3.39,.51],[-.62+sign*.8,3.16,.75],[-.62+sign*.98,3.43,.78]],.065);
   for(let i=0;i<2;i++)plate([[-.62+sign*(.14+i*.18)-.04,3.56],[-.62+sign*(.14+i*.18)+.04,3.56],[-.62+sign*(.14+i*.18),3.37]],.63,.065);
  }
  plate([[-.76,3.85],[-.62,4.47],[-.48,3.85]],.11,.16);eyes(3.73,.56,.3,.15,.08,true,-.62);break;
 case 3:
  ball(0,.83,0,.92,.66,.98);ball(0,.96,.83,.73,.47,.57);
  for(const x of [-.64,.64])for(const z of [-.58,.61]){ball(x,.42,z,.37,.4,.4);paw(x,.21,z+.13,.27,true);}
  for(const sign of [-1,1]){ear(sign*.49,1.19,.71,sign*.6,1.57,.18);ball(sign*.42,1.29,1.05,.29,.16,.15);}
  eyes(1.16,1.3,.4,.2,.095,true);mouth([[-.53,.79,1.16],[0,.68,1.39],[.53,.79,1.16]],.028);
  for(const sign of [-1,1])rod([sign*.37,.8,1.27],[sign*.34,.65,1.31],.055,0);rod([0,1.25,0],[0,2.05,0],.25,.18);
  for(let i=0;i<7;i++){const angle=i*Math.PI*2/7;leaf(Math.sin(angle)*.1,1.43,Math.cos(angle)*.1,angle,1);}
  for(let i=0;i<6;i++){
   const angle=i*Math.PI/3,petal=plate([[0,-.04],[-.32,.21],[-.5,.61],[-.33,.94],[0,1.07],[.33,.94],[.5,.61],[.32,.21]],0,.2);
   petal.rotation.set(Math.PI*.35,angle,0);petal.position.set(Math.sin(angle)*.06,2.07,Math.cos(angle)*.06);ball(Math.sin(angle)*.46,2.37,Math.cos(angle)*.46,.13,.055,.13,true);
  }
  ball(0,2.29,0,.34,.26,.34);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;rod([Math.sin(a)*.16,2.42,Math.cos(a)*.16],[Math.sin(a)*.2,2.65,Math.cos(a)*.2],.075,.045);}break;
 case 6:case 149: {
  const dragonite=speciesId===149;ball(0,1.14,0,dragonite?.73:.56,.89,.53);ball(0,2.01,.01,dragonite?.33:.26,.44,.3);ball(0,2.4,.13,dragonite?.43:.37,.41,.36);
  ball(0,2.25,.48,dragonite?.32:.3,.2,.34);feet(false,true);dragonWings(dragonite);
  for(const sign of [-1,1]){
   rod([sign*.48,1.62,.06],[sign*.77,1.29,.35],.18,.13);paw(sign*.8,1.26,.41,.16,true);
   if(!dragonite)ear(sign*.25,2.62,-.04,sign*.44,3.13,.13);
   else{tail([[sign*.22,2.68,.06],[sign*.32,3.01,.22],[sign*.53,2.94,.4]],.065);ball(sign*.16,2.91,.02,.1,.18,.1);}
  }
  const belly=plate([[-.24,1.95],[-.44,1.35],[-.4,.8],[0,.58],[.4,.8],[.44,1.35],[.24,1.95]],.47,.12);if(!dragonite)belly.scaling.x=.83;
  for(let i=0;i<5;i++){const width=.29+(i<3?i:4-i)*.025;mouth([[-width,.87+i*.19,.54],[0,.83+i*.19,.565],[width,.87+i*.19,.54]],.015);}
  tail([[0,.64,-.35],[.52,.39,-.92],[1.05,.51,-1.24],[1.35,.95,-1.19]],.28);
  if(!dragonite)plate([[1.24,.88],[1.04,1.28],[1.25,1.24],[1.3,1.89],[1.52,1.56],[1.65,1.71],[1.64,1.16],[1.43,.93]],-1.16,.2);
  else for(let i=0;i<3;i++)plate([[-.13,1.59+i*.27],[.13,1.59+i*.27],[0,1.9+i*.27]],-.51,.16);
  eyes(2.47,.455,.23,.145,.095,!dragonite);nose(2.32,.76,.1);mouth([[-.21,2.15,.64],[0,2.1,.77],[.21,2.15,.64]],.022);break;
 }
 case 144:case 145: {
  const zapdos=speciesId===145;ball(0,1.2,0,.48,.65,.43);ball(0,1.78,.02,.31,.46,.29);ball(0,2.14,.14,.34,.35,.32);birdWings(zapdos);
  plate([[-.15,2.16],[0,2.2],[.15,2.16],[0,1.99]],.49,.12);rod([0,2.16,.43],[0,2.1,zapdos?1.1:.95],.14,0);
  for(const sign of [-1,1]){rod([sign*.2,.76,0],[sign*.3,.22,.19],.1,.075);for(let i=-1;i<=1;i++)rod([sign*.3,.2,.18],[sign*.3+i*.12,.12,.52],.045,0);}
  for(let i=-1;i<=1;i++){
   plate([[i*.17-.11,2.35],[i*.17+.1,2.36],[i*(zapdos?.4:.23),2.97-Math.abs(i)*.16]],-.02,.14);
   if(zapdos)plate([[i*.16-.1,.95],[i*.16+.1,.95],[i*.42+.18,-.05],[i*.3,.3],[i*.5,-.31]],-.38,.16);
   else tail([[i*.16,.95,-.28],[i*.36,.57,-.84],[i*.55,.42,-1.54],[i*.48,.48,-2.03],[i*.36,.68,-2.2]],.16);
  }
  if(zapdos)for(const sign of [-1,1])plate([[sign*.2,2.38],[sign*.71,2.61],[sign*.4,2.15]],-.03,.2);
  eyes(2.24,.405,.2,.13,.075,true);break;
 }
 case 150:
  ball(0,1.52,0,.36,.68,.31);ball(0,1.95,.02,.4,.32,.32);ball(0,2.53,.05,.44,.43,.35);ball(0,2.36,.34,.28,.18,.24);
  for(const sign of [-1,1]){
   ear(sign*.28,2.79,-.04,sign*.37,3.15,.13);ball(sign*.42,.94,0,.34,.49,.34);rod([sign*.44,.77,0],[sign*.51,.22,.24],.17,.12);paw(sign*.52,.13,.44,.22);
   rod([sign*.35,1.94,0],[sign*.65,1.52,.12],.13,.1);rod([sign*.65,1.52,.12],[sign*.84,1.64,.34],.11,.085);ball(sign*.87,1.64,.36,.14,.15,.13);
   for(let i=-1;i<=1;i++){rod([sign*.88,1.65,.38],[sign*(1.02+(i+1)*.06),1.62+i*.13,.47],.055,.045);ball(sign*(1.02+(i+1)*.06),1.62+i*.13,.47,.07,.07,.065);}
  }
  tail([[0,.98,-.22],[.6,.62,-.76],[1.22,.79,-1],[1.49,1.28,-.94],[1.42,1.85,-.67],[1.09,2.06,-.5]],.24);rod([0,2.34,-.27],[0,1.94,-.3],.13,.1);
  eyes(2.58,.365,.24,.16,.085,true);nose(2.4,.56,.065);mouth([[-.16,2.26,.45],[0,2.22,.54],[.16,2.26,.45]],.018);break;
 default:throw new Error(`Missing shrine sculpture for ${getSpecies(speciesId).name}`);
 }
 return sculpt.finish(speciesId);
}
