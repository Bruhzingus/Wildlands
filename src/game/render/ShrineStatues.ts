import {Mesh,MeshBuilder,Scene,StandardMaterial,Vector3,Quaternion} from '@babylonjs/core';
import {getSpecies} from '../../data/kanto.ts';

/** Carved, solid silhouettes. The identifying ears, tails, wings and limbs are
 * geometry, so the statue reads as stone from every camera angle. */
export function createShrineStatue(scene:Scene,speciesId:number,stone:StandardMaterial,carving:StandardMaterial):Mesh {
 const parts:Mesh[]=[];
 const ball=(x:number,y:number,z:number,sx:number,sy:number,sz:number,detail=false)=>{
  const mesh=MeshBuilder.CreateIcoSphere('carved stone',{radius:1,subdivisions:1},scene);
  mesh.position.set(x,y,z);mesh.scaling.set(sx,sy,sz);mesh.material=detail?carving:stone;parts.push(mesh);return mesh;
 };
 const rod=(a:number[],b:number[],width:number,tip=width,detail=false)=>{
  const start=Vector3.FromArray(a),end=Vector3.FromArray(b),delta=end.subtract(start);
  const mesh=MeshBuilder.CreateCylinder('stone limb',{height:delta.length(),diameterBottom:width*2,diameterTop:tip*2,tessellation:6},scene);
  mesh.position=start.add(end).scale(.5);mesh.rotationQuaternion=Quaternion.Identity();
  Quaternion.FromUnitVectorsToRef(Vector3.Up(),delta.normalize(),mesh.rotationQuaternion);
  mesh.material=detail?carving:stone;parts.push(mesh);return mesh;
 };
 const tail=(points:number[][],width=.18)=>points.slice(1).forEach((point,index)=>rod(points[index],point,width*(1-index/points.length),Math.max(.025,width*(1-(index+1)/points.length))));
 const eyes=(y:number,z:number,gap=.25)=>{for(const sign of [-1,1])ball(sign*gap,y,z,.09,.065,.035,true);};
 const feet=(four=false)=>{for(const x of [-.48,.48])for(const z of four?[-.5,.55]:[.1])ball(x,.25,z,.32,.25,.45);};
 const wings=(spiky=false)=>{for(const sign of [-1,1]){
  rod([sign*.4,1.65,0],[sign*1.45,2.35,-.1],.24,.15);
  for(let i=0;i<4;i++)rod([sign*(.8+i*.2),2+i*.1,-.1],[sign*(1.05+i*.4),spiky?1.25+(i%2)*.6:1.1+i*.2,-.28],.25,0);
 }};
 switch(speciesId){
 case 74: // Geodude: round rocky body, heavy fists and no legs.
  ball(0,1.4,0,.85,.8,.68);for(const sign of [-1,1]){rod([sign*.7,1.4,0],[sign*1.25,1.2,.1],.25,.23);ball(sign*1.46,1.15,.15,.38,.35,.38);}eyes(1.62,.66,.28);break;
 case 56:case 57: // Mankey / Primeape: bristled monkey with raised fists.
  ball(0,1.2,0,.72,.68,.57);ball(0,2,.3,.58,.5,.48);feet();
  for(const sign of [-1,1]){rod([sign*.58,1.4,0],[sign*1.1,1.75,.1],.2,.16);ball(sign*1.22,1.88,.18,.32,.3,.28);rod([sign*.33,2.35,.18],[sign*.62,2.7,.1],.13,.02);}
  tail([[0,.8,-.5],[.5,.8,-1],[.65,1.35,-1.15]],.14);eyes(2.1,.75,.27);break;
 case 58: // Growlithe: canine muzzle, pointed ears and curled tail.
  ball(0,1.05,0,.55,.55,.85);feet(true);ball(0,1.65,.62,.48,.44,.43);ball(0,1.47,1,.28,.19,.35);
  for(const sign of [-1,1]){rod([sign*.3,1.9,.56],[sign*.42,2.4,.5],.18,.015);}
  tail([[0,1,-.75],[.3,1.5,-1.2],[.6,1.9,-1.15],[.75,1.75,-.9]],.22);eyes(1.72,1,.25);break;
 case 133: // Eevee: oversized ears, neck ruff and bushy tail.
  ball(0,.95,0,.44,.56,.65);feet(true);ball(0,1.48,.42,.5,.43,.42);
  for(const sign of [-1,1]){rod([sign*.28,1.75,.45],[sign*.55,2.65,.4],.2,.04);ball(sign*.35,1.1,.45,.28,.28,.29,true);}
  tail([[0,.85,-.55],[.5,1.05,-1],[.75,1.55,-1.25]],.35);eyes(1.55,.82,.25);break;
 case 23: // Ekans: low coiled snake with a lifted head and forked tongue.
  {const coil=MeshBuilder.CreateTorus('snake coil',{diameter:1.55,thickness:.34,tessellation:18},scene);coil.position.y=.35;coil.material=stone;parts.push(coil);}
  rod([.25,.4,0],[0,1.75,.3],.19,.16);ball(0,1.82,.43,.36,.23,.39);tail([[0,1.82,.75],[0,1.62,1],[.15,1.57,1.18]],.09);eyes(1.9,.76,.2);break;
 case 41: // Zubat: winged body with wide ears and fangs.
  rod([0,.2,0],[0,1.2,0],.16,.12);ball(0,1.6,0,.4,.44,.33);wings();
  for(const sign of [-1,1]){rod([sign*.22,1.9,0],[sign*.35,2.48,0],.15,.02);rod([sign*.15,1.35,.3],[sign*.15,1.08,.48],.07,0,true);}break;
 case 20: // Raticate: hunched rodent, buck teeth and long thin tail.
  ball(0,.95,0,.65,.52,.9);feet(true);ball(0,1.38,.7,.53,.45,.47);ball(0,1.18,1.07,.37,.2,.29);
  for(const sign of [-1,1]){ball(sign*.39,1.76,.5,.25,.29,.13);ball(sign*.12,1.04,1.31,.1,.2,.06,true);}
  tail([[0,.7,-.75],[.5,.5,-1.2],[.9,.65,-1.65],[1.1,1,-1.95]],.13);eyes(1.5,1.05,.27);break;
 case 94: // Gengar: squat ghost with pointed ears, spines and clawed hands.
  ball(0,1.2,0,.82,.85,.68);ball(0,2,.18,.67,.52,.53);feet();
  for(const sign of [-1,1]){rod([sign*.5,2.28,.1],[sign*.75,2.78,-.05],.19,0);rod([sign*.7,1.3,.1],[sign*1.13,.9,.45],.22,.16);}
  for(let i=-2;i<=2;i++)rod([i*.25,1.8,-.45],[i*.31,2.25-Math.abs(i)*.12,-.7],.18,0);
  eyes(2.06,.66,.33);rod([-.32,1.68,.63],[.32,1.68,.63],.07,.07,true);break;
 case 27:case 28: // Sandshrew / Sandslash: plated back, pointed snout and digging claws.
  ball(0,1.05,0,.72,.85,.65);ball(0,1.85,.22,.52,.53,.48);ball(0,1.68,.62,.32,.23,.36);feet();
  for(const sign of [-1,1]){rod([sign*.38,2.08,.1],[sign*.5,2.55,.05],.2,.03);rod([sign*.5,1.3,.1],[sign*.86,.65,.5],.22,.16);
   for(let i=0;i<3;i++)rod([sign*.8+i*.06,.7,.5],[sign*.9+i*.06,.45,.77],.06,0);}
  if(speciesId===28)for(let i=0;i<9;i++){const angle=i*2.4;rod([Math.sin(angle)*.45,1.15+(i%3)*.3,-.35],[Math.sin(angle)*.9,1.65+(i%3)*.35,-1.05],.24,0);}
  else for(let i=0;i<4;i++)rod([-.55,.75+i*.3,-.43],[.55,.75+i*.3,-.43],.055,.055,true);
  tail([[0,.65,-.4],[0,.35,-1],[0,.55,-1.35]],.22);eyes(1.95,.63);break;
 case 25: // Pikachu: long ears and a lightning-bolt tail.
  ball(0,.95,0,.57,.75,.45);ball(0,1.8,.08,.62,.55,.48);feet();
  for(const sign of [-1,1]){rod([sign*.32,2.12,.05],[sign*.64,3.05,.02],.2,.07);rod([sign*.5,1.22,.1],[sign*.77,.85,.36],.16,.1);ball(sign*.45,1.6,.46,.14,.11,.05,true);}
  tail([[.3,.65,-.3],[1,.9,-.5],[.72,1.3,-.5],[1.4,1.65,-.5],[1.2,2.1,-.5]],.17);eyes(1.86,.52);break;
 case 24: // Arbok: coiled cobra and broad carved hood.
  {const coil=MeshBuilder.CreateTorus('cobra coil',{diameter:1.5,thickness:.45,tessellation:18},scene);coil.position.y=.3;coil.material=stone;parts.push(coil);}
  rod([0,.35,0],[0,2.1,0],.28,.33);ball(0,2,0,.95,.85,.26);ball(0,2.65,.13,.44,.35,.38);ball(0,2.52,.43,.36,.14,.25);
  for(const sign of [-1,1]){ball(sign*.49,2.05,.24,.24,.3,.04,true);ball(sign*.49,2.08,.29,.1,.14,.025);}
  eyes(2.72,.45);break;
 case 93: // Haunter: hovering spiked head and detached claws, on a carved smoke stem.
  rod([0,.1,0],[0,1.35,0],.35,.12);ball(0,1.8,0,.92,.73,.5);
  for(const sign of [-1,1]){for(let i=0;i<3;i++)rod([sign*.55,1.7+i*.2,0],[sign*(1.05-i*.08),1.7+i*.48,0],.22,0);
   ball(sign*1.2,1,.25,.3,.2,.27);for(let i=0;i<3;i++)rod([sign*1.25,1,.3],[sign*(1.5+i*.12),.8,.6-i*.17],.12,0);}
  eyes(1.98,.48,.38);rod([-.5,1.56,.42],[.5,1.56,.42],.09,.09,true);break;
 case 66:case 68: // Machop / Machamp: muscular limbs, belt and three head crests.
  ball(0,1.5,0,.7,.85,.42);ball(0,2.5,0,.42,.5,.36);
  for(const sign of [-1,1]){rod([sign*.32,.95,0],[sign*.57,.25,.12],.28,.24);ball(sign*.57,.15,.3,.3,.17,.4);
   for(const row of speciesId===68?[0,1]:[1]){const y=1.35+row*.6;rod([sign*.55,y,0],[sign*1.15,y+.22,-row*.2],.25,.22);rod([sign*1.15,y+.22,-row*.2],[sign*1.4,y+.65,.15],.23,.21);ball(sign*1.4,y+.7,.15,.29,.29,.28);}}
  for(const x of [-.23,0,.23])rod([x,2.7,0],[x,3.15,-.05],.1,0);ball(0,1.02,.35,.64,.15,.16,true);ball(0,1.02,.51,.18,.13,.04);eyes(2.55,.34);break;
 case 38: // Ninetales: fox muzzle, upright ears, nine fanned tails.
  ball(0,.95,0,.48,.55,.85);feet(true);ball(0,1.62,.6,.36,.45,.35);ball(0,1.5,.97,.23,.16,.3);
  for(const sign of [-1,1])rod([sign*.23,1.9,.5],[sign*.32,2.5,.4],.18,0);
  for(let i=0;i<9;i++){const a=(i-4)*.28;tail([[0,.9,-.6],[Math.sin(a)*1.1,1.3,-1.1],[Math.sin(a)*1.7,2.1+Math.cos(a)*.4,-1.4],[Math.sin(a)*1.9,2.7,-1.1]],.23);}
  eyes(1.73,.88,.2);break;
 case 76: // Golem: faceted shell, short head and thick limbs.
  ball(0,1.3,0,1,1,.9);ball(0,1.55,.87,.4,.4,.42);feet();
  for(const sign of [-1,1]){rod([sign*.75,1.3,0],[sign*1.25,.7,.5],.3,.26);for(let i=0;i<3;i++)rod([sign*1.2+i*.08,.7,.5],[sign*1.27+i*.08,.6,.8],.075,0);}
  for(let i=0;i<7;i++){const a=i*2.4;ball(Math.sin(a)*.76,1.35+Math.cos(a)*.75,-.3,.32,.32,.65);}
  eyes(1.65,1.23);break;
 case 130: // Gyarados: rising segmented serpent, fins, crown and whiskers.
  for(let i=0;i<13;i++){const t=i/12;ball(Math.sin(t*Math.PI*1.7)*.8,.25+t*3.2,-.5+Math.cos(t*Math.PI*1.7)*.6,.4-t*.08,.4,.38);if(i%3===0)rod([Math.sin(t*Math.PI*1.7)*.8,.4+t*3.2,-.7],[Math.sin(t*Math.PI*1.7)*.8,.8+t*3.2,-1.15],.2,0);}
  ball(-.65,3.6,0,.58,.42,.64);ball(-.65,3.3,.43,.44,.2,.4);
  for(const sign of [-1,1]){rod([-.65+sign*.3,3.9,0],[-.65+sign*.7,4.55,-.12],.15,0);tail([[-.65+sign*.42,3.5,.4],[-.65+sign*1.05,3.25,.8],[-.65+sign*1.2,3.65,.9]],.065);ball(-.65+sign*.32,3.7,.53,.09,.08,.04,true);}
  rod([-.65,3.96,.1],[-.65,4.5,.3],.14,0);break;
 case 3: // Venusaur: broad frog, leaves, trunk and huge flower.
  ball(0,.85,0,.95,.7,1);feet(true);ball(0,1,.85,.76,.5,.6);eyes(1.17,1.35,.4);
  rod([0,1.3,0],[0,2.3,0],.22,.18);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;const leaf=ball(Math.sin(a)*.65,1.65,Math.cos(a)*.65,.35,.13,.9);leaf.rotation.y=a;
   const petal=ball(Math.sin(a)*.48,2.35,Math.cos(a)*.48,.43,.16,.63,true);petal.rotation.y=a;}
  ball(0,2.5,0,.4,.26,.4);break;
 case 6:case 149: // Charizard / Dragonite: dragon wings, horns, stout legs and long tail.
  ball(0,1.15,0,speciesId===149?.75:.58,.93,.54);ball(0,2.24,.12,.42,.48,.4);ball(0,2.1,.53,.3,.2,.35);feet();wings();
  for(const sign of [-1,1]){rod([sign*.3,2.48,0],[sign*.5,3.05,-.18],.13,.02);rod([sign*.48,1.65,.08],[sign*.9,1.15,.4],.17,.13);}
  tail([[0,.65,-.4],[.7,.35,-1.1],[1.2,.55,-1.3],[1.4,1,-1.1]],.27);
  if(speciesId===6){ball(1.4,1.25,-1.1,.2,.45,.18,true);rod([1.4,1.4,-1.1],[1.5,1.95,-1.1],.16,0,true);}
  else {for(const sign of [-1,1])tail([[sign*.22,2.6,.1],[sign*.35,2.95,.27],[sign*.58,2.85,.45]],.06);ball(0,1.15,.48,.51,.72,.1,true);}
  eyes(2.33,.46);break;
 case 144:case 145: // Articuno / Zapdos: sweeping or jagged wings, crests and long tail plumes.
  ball(0,1.25,0,.48,.75,.45);ball(0,2.15,.12,.36,.4,.35);wings(speciesId===145);
  rod([0,2.12,.35],[0,2.08,.92],.17,0);for(const sign of [-1,1])rod([sign*.23,.8,0],[sign*.35,.1,.25],.09,.07);
  for(let i=0;i<3;i++){rod([(i-1)*.15,2.4,0],[(i-1)*.3,2.95-Math.abs(i-1)*.15,-.25],.13,0);
   tail([[(i-1)*.2,.95,-.25],[(i-1)*.45,.6,-1],[(i-1)*.6,.4,speciesId===144?-2.2:-1.5]],.18);}
  eyes(2.24,.36,.2);break;
 case 150: // Mewtwo: long thighs, narrow shoulders, two horns and a curled tail.
  ball(0,1.55,0,.4,.75,.35);ball(0,2.5,.03,.46,.45,.36);ball(0,2.34,.35,.29,.18,.25);
  for(const sign of [-1,1]){rod([sign*.31,2.76,-.03],[sign*.4,3.12,-.07],.15,.09);ball(sign*.45,.95,0,.36,.5,.36);
   rod([sign*.46,.72,0],[sign*.55,.2,.25],.16,.13);ball(sign*.55,.12,.46,.23,.14,.4);
   rod([sign*.36,1.98,0],[sign*.72,1.35,.22],.13,.09);ball(sign*.75,1.22,.27,.17,.2,.16);}
  tail([[0,1,-.25],[.6,.6,-.8],[1.3,.85,-1],[1.5,1.6,-.7],[1.15,2,-.5]],.24);eyes(2.55,.34);break;
 default:throw new Error(`Missing shrine sculpture for ${getSpecies(speciesId).name}`);
 }
 const statue=Mesh.MergeMeshes(parts,true,true,undefined,false,true)!;
 statue.name=`stone-statue-${speciesId}`;statue.refreshBoundingInfo({});
 const bounds=statue.getBoundingInfo().boundingBox,scale=3.8/(bounds.maximum.y-bounds.minimum.y);
 statue.scaling.setAll(scale);statue.position.y=.65-bounds.minimum.y*scale;statue.isPickable=false;
 statue.metadata={speciesId,stone:true};return statue;
}
