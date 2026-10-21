import {Engine,Scene,ArcRotateCamera,Vector3,Color4} from '@babylonjs/core';
import {Simulation,type MoveInput} from '../../../src/game/Simulation.ts';
import {World} from '../../../src/game/render/World.ts';
import {getSpecies} from '../../../src/data/kanto.ts';

// The optional baseline is an ignored snapshot of the working renderer taken
// before N1, rather than Git HEAD (which would omit the owner's other work).
const baseline=new URLSearchParams(location.search).has('baseline');
const modulePath=baseline?'/artifacts/n1-baseline/AssetLibrary.ts':'/src/game/render/AssetLibrary.ts';
const {AssetLibrary,CharacterVisuals}=await import(/* @vite-ignore */ modulePath);
const engine=new Engine(document.querySelector('canvas')!,true),scene=new Scene(engine);
scene.clearColor=new Color4(.075,.12,.11,1);
const camera=new ArcRotateCamera('camera',-Math.PI/2,1.0,21,new Vector3(0,1,0),scene);
const sim=new Simulation(25,4),world=new World(scene,4,sim.state.pois);
let assets=new AssetLibrary(scene),visuals=new CharacterVisuals(assets);
const idle:MoveInput={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
const species=[25,143,41,95,6,129];
function sync(dt=0){
 const s=sim.state;
 camera.target.set(s.player.x,world.height(s.player.x,s.player.z)+1,s.player.z);
 camera.getViewMatrix(true);
 visuals.sync(s.party,s.enemies,dt,-camera.alpha-Math.PI/2,(x:number,z:number)=>world.height(x,z),s.player.y);
 scene.render();
}
async function reset(count=6,x=0,z=0){
 const s=sim.state,template=s.party[0];
 visuals.dispose();assets.dispose();assets=new AssetLibrary(scene);visuals=new CharacterVisuals(assets);
 Object.assign(s.player,{x,z,y:0,vy:0,facing:0,hp:120,iframes:10000,dodgeTime:0,dodgeCooldown:0,dodgeCharges:1,specialCooldown:0});
 Object.assign(sim,{velocity:{x:0,z:0},spawnAccum:-10000});
 s.party=species.slice(0,count).map((speciesId,i)=>({...structuredClone(template),uid:i+1,speciesId,x:x+(i?Math.sin((i-1)*Math.PI*2/Math.max(3,count-1))*2.15:0),z:z-(i?Math.cos((i-1)*Math.PI*2/Math.max(3,count-1))*2.15:0),hp:10000,maxHp:10000,animation:'idle' as const,attackTimer:0,cooldown:10000,learnedMoves:[]}));
 s.enemies=[];s.projectiles=[];s.drops=[];s.phase='playing';
 await Promise.all(s.party.flatMap(m=>['idle','walk','attack'].map(a=>assets.get(m.speciesId,a).catch(()=>{}))));
 camera.alpha=-Math.PI/2;sync();await new Promise(resolve=>setTimeout(resolve,0));sync();
}
function step(input:Partial<MoveInput>={},dt=.02){sim.update(dt,{...idle,...input});sync(dt);}
function label(text:string){document.querySelector('#label')!.textContent=`${baseline?'Before':'After'} · ${text} · ${sim.state.party.map(m=>getSpecies(m.speciesId).name).join(', ')}`;}
await reset();
engine.runRenderLoop(()=>scene.render());
(window as any).locomotion={sim,world,scene,camera,step,sync,reset,label,get assets(){return assets;},get visuals(){return visuals;}};
