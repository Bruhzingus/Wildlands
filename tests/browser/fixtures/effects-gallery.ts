import {Engine,Scene,ArcRotateCamera,Vector3,MeshBuilder,StandardMaterial,Color3,Color4,HemisphericLight} from '@babylonjs/core';
import {Effects} from '../../../src/game/render/Effects.ts';
import {Simulation} from '../../../src/game/Simulation.ts';
import {ELEMENT_COLORS} from '../../../src/data/kanto.ts';

const engine=new Engine(document.querySelector('canvas')!,true),scene=new Scene(engine);
scene.clearColor=new Color4(.075,.12,.11,1);
const camera=new ArcRotateCamera('camera',-Math.PI*.65,.85,17,new Vector3(0,.5,0),scene);
new HemisphericLight('light',new Vector3(0,1,0),scene);
const floor=MeshBuilder.CreateGround('floor',{width:70,height:70},scene),mat=new StandardMaterial('floor',scene);
mat.diffuseColor=new Color3(.16,.24,.2);mat.specularColor=Color3.Black();floor.material=mat;
const state=new Simulation(7,12).state;state.enemies=[];state.projectiles=[];state.party=[];state.drops=[];
const fx=new Effects(scene,{height:()=>0},false);
const groups=['Surf','Swift','Flamethrower','Whirlwind','Razor Leaf','Bubble','Ice Beam','Thunder','Vine Whip','Hyper Beam','Flame Burst','Bramble Garden'];
const show=(name:string)=>{
 state.projectiles=[];fx.update(state,10);camera.alpha=-Math.PI*.65;camera.radius=name==='Swift'||name==='Razor Leaf'||name==='Bubble'||name==='Ice Beam'?10:17;
 document.querySelector('#label')!.textContent=name;
 if(['Swift','Razor Leaf','Bubble','Ice Beam','Hyper Beam','Flame Burst'].includes(name)){
  const type=name==='Razor Leaf'?'grass':name==='Bubble'?'water':name==='Ice Beam'?'ice':name==='Flame Burst'?'fire':'normal';
  state.projectiles=Array.from({length:3},(_,i)=>({uid:100+i,x:(i-1)*1.8,z:(i%2)*1.4,prevX:0,prevZ:0,vx:7,vz:8,ttl:1,damage:1,size:name==='Hyper Beam'?.65:.45,kind:name.includes('Beam')?'beam':'bolt',type,penetration:0,hit:new Set<number>(),friendly:true,sourceId:1,poisonChance:0,moveName:name,silhouette:name.includes('Beam')?'beam':'orb'}));
 }else{
  const base={kind:'special' as const,x:0,z:-2,radius:3.5,duration:1.2,label:name};
  if(name==='Surf'||name==='Whirlwind')fx.onEvent({...base,shape:'wave',toX:0,toZ:8,endRadius:name==='Surf'?3.5:5,color:name==='Surf'?ELEMENT_COLORS.water:ELEMENT_COLORS.flying});
  if(name==='Flamethrower')fx.onEvent({...base,shape:'cone',radius:8,angle:1.05,facing:0,color:ELEMENT_COLORS.fire});
  if(name==='Thunder')fx.onEvent({...base,shape:'column',radius:1.3,color:ELEMENT_COLORS.electric});
  if(name==='Vine Whip')fx.onEvent({...base,shape:'vine',x:-3,z:-2,toX:3,toZ:4,color:ELEMENT_COLORS.grass});
  if(name==='Bramble Garden')fx.onEvent({...base,shape:'garden',z:0,color:ELEMENT_COLORS.grass});
 }
 fx.update(state,.05);scene.render();
};
engine.runRenderLoop(()=>scene.render());
(window as any).gallery={scene,fx,state,show,groups};show('Surf');
