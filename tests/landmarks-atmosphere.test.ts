import test from 'node:test';
import assert from 'node:assert/strict';
import {Color3,Color4,NullEngine,Scene,VertexBuffer} from '@babylonjs/core';
import {ATMOSPHERES} from '../src/data/atmosphere.ts';
import {MAP_DEFINITIONS,worldProfile} from '../src/data/maps.ts';
import {createLandmarkDressing,landmarkClearings} from '../src/game/systems/landmarkDressing.ts';
import {createEnvironment,createPOIs} from '../src/game/systems/environment.ts';
import {createBerryTrees} from '../src/game/systems/berries.ts';
import {compileAtmosphere,createAtmosphereSample,sampleAtmosphere} from '../src/game/render/atmosphere.ts';
import {createTerrainPalette} from '../src/game/render/terrainPalette.ts';
import {World} from '../src/game/render/World.ts';
import {Simulation} from '../src/game/Simulation.ts';

test('dressing is seeded, bounded and keeps authoritative sites, resources, clear approaches and collision untouched',()=>{
 for(const map of Object.values(MAP_DEFINITIONS))for(const seed of [4,808]){
  const profile=worldProfile(seed,map.id),pois=createPOIs(seed,map.id),layout=createEnvironment(seed,pois,map.id),berries=createBerryTrees(layout.props,seed),before=JSON.stringify({pois,layout,berries});
  const sites=createLandmarkDressing(seed,profile,pois,berries,layout);
  assert.deepEqual(sites,createLandmarkDressing(seed,profile,pois,berries,layout));assert.equal(JSON.stringify({pois,layout,berries}),before);
  assert.equal(sites.length,pois.length+berries.length);
  for(const site of sites){
   assert.ok(site.parts.length<=6);assert.ok(site.parts.length>0,`${map.id}: site ${site.uid} has no dressing`);
   for(const part of site.parts){
    const dx=part.x-site.x,dz=part.z-site.z;
    assert.ok(Math.hypot(dx,dz)<site.radius);
    const along=dx*site.approach.x+dz*site.approach.z,lateral=Math.abs(dx*site.approach.z-dz*site.approach.x);
    assert.ok(along<=0||lateral>=map.dressing.approachWidth/2);
    assert.ok(!layout.obstacles.some(o=>o.x===part.x&&o.z===part.z));
   }
  }
  const plain=createTerrainPalette(profile,seed),dressed=createTerrainPalette(profile,seed,landmarkClearings(sites)),a=new Color3(),b=new Color3();
  const site=sites.find(s=>s.kind==='shrine')!;plain(site.x,site.z,0,a);dressed(site.x,site.z,0,b);assert.notDeepEqual(a,b);
  plain(0,0,0,a);dressed(0,0,0,b);assert.deepEqual(a,b,'spawn palette stays clear of POI masks');
 }
});

test('atmosphere sampling reuses colors, is deterministic and finite, and joins endless without a snap',()=>{
 for(const keys of Object.values(ATMOSPHERES)){
  const curve=compileAtmosphere(keys),before=JSON.stringify(curve),sample=createAtmosphereSample(),colors=[sample.sky,sample.fog,sample.ambient,sample.sun];
  for(const time of [-Infinity,-1,0,299.999,300,420,600,720,780,899.999,900,900.001,1200,1e9,Infinity,NaN]){
   assert.equal(sampleAtmosphere(curve,time,sample),sample);assert.deepEqual(sample,sampleAtmosphere(curve,time,createAtmosphereSample()));
   assert.ok(colors.every((color,i)=>color===[sample.sky,sample.fog,sample.ambient,sample.sun][i]));
   for(const color of colors)assert.ok(color.asArray().every(value=>Number.isFinite(value)&&value>=0&&value<=1));
   assert.ok(sample.ambientScale>=.9&&sample.sunScale>=.8);assert.ok(sample.fogStart>=44&&sample.fogEnd>=165);
  }
  assert.equal(JSON.stringify(curve),before);
  const end=sampleAtmosphere(curve,900,createAtmosphereSample()),near=sampleAtmosphere(curve,899.999,createAtmosphereSample());
  assert.ok(Math.hypot(end.sky.r-near.sky.r,end.sky.g-near.sky.g,end.sky.b-near.sky.b)<1e-8);assert.deepEqual(sampleAtmosphere(curve,3600,sample),end);
  assert.notDeepEqual(sampleAtmosphere(curve,0,sample).sky,end.sky,'run progression must be visibly meaningful');
 }
});

test('world dressing follows existing POI lifecycle and toggles without GPU growth or changing gameplay; unload restores fog and sky',()=>{
 const engine=new NullEngine(),scene=new Scene(engine);void scene.defaultMaterial;
 scene.clearColor=new Color4(.2,.3,.4,.7);scene.fogColor=new Color3(.6,.5,.4);scene.fogMode=Scene.FOGMODE_EXP2;scene.fogStart=12;scene.fogEnd=123;scene.fogDensity=.03;
 const presentation=()=>[scene.clearColor.asArray(),scene.fogColor.asArray(),scene.fogMode,scene.fogStart,scene.fogEnd,scene.fogDensity];
 const resources=()=>[scene.meshes.length,scene.geometries.length,scene.materials.length,scene.transformNodes.length,scene.lights.length];
 const original=presentation(),empty=resources();
 try{
  for(const map of Object.values(MAP_DEFINITIONS)){
   const seed=map.seed??4,sim=new Simulation(25,seed,{mapId:map.id}),s=sim.state,untouched=JSON.stringify(s),world=new World(scene,seed,s.pois,map.id,s.berryTrees);
   try{
    const meshes=scene.meshes.filter(m=>m.metadata?.landmarkDressing);
    assert.ok(meshes.length>30);assert.ok(meshes.every(m=>!m.isPickable&&!m.checkCollisions&&!m.receiveShadows));
    assert.equal(JSON.stringify(s),untouched);
    const terrain=scene.getMeshByName('rolling forest terrain')!,dressed=Array.from(terrain.getVerticesData(VertexBuffer.ColorKind)!),initial=resources();
    world.setLandmarkDressingVisible(false);assert.ok(meshes.every(m=>!m.isEnabled()));assert.notDeepEqual(Array.from(terrain.getVerticesData(VertexBuffer.ColorKind)!),dressed);
    world.setLandmarkDressingVisible(true);assert.deepEqual(Array.from(terrain.getVerticesData(VertexBuffer.ColorKind)!),dressed);assert.equal(JSON.stringify(s),untouched);
    const future=s.pois.find(p=>p.availableAt===180)!,root=scene.getTransformNodeByName(`dressing-cache-${future.uid}`)!;
    assert.equal(root.isEnabled(),false);world.update(0,s.pois,180,[],s.berryTrees);assert.equal(root.isEnabled(),true);
    future.used=true;world.update(0,s.pois,181,[],s.berryTrees);assert.equal(root.isEnabled(),false);
    const paid=s.pois.find(p=>p.price!==undefined)!;paid.used=true;world.update(0,s.pois,182,[],s.berryTrees);assert.equal(scene.getTransformNodeByName(`dressing-cache-${paid.uid}`)!.isEnabled(),true);
    world.setAtmospherePreview(900);assert.equal(world.inspectAtmosphere()!.seconds,900);world.setAtmospherePreview(null);assert.equal(world.inspectAtmosphere()!.seconds,182);
    for(let i=0;i<120;i++)world.update(1/60,s.pois,i*10,[],s.berryTrees);
    assert.deepEqual(resources(),initial);
   }finally{world.dispose();}
   assert.deepEqual(resources(),empty);assert.deepEqual(presentation(),original);
  }
 }finally{scene.dispose();engine.dispose();}
});

test('authoritative run pauses and choices freeze atmospheric time, and preview never advances the run',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),sim=new Simulation(25,4),s=sim.state,world=new World(scene,4,s.pois,s.mapId,s.berryTrees);
 const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
 try{
  s.stats.elapsed=420;world.update(0,s.pois,s.stats.elapsed,[],s.berryTrees);
  for(const phase of ['paused','choice','result'] as const){
   s.phase=phase;const before=world.inspectAtmosphere();
   for(let i=0;i<30;i++){sim.update(.04,idle);world.update(.04,s.pois,s.stats.elapsed,[],s.berryTrees);}
   assert.deepEqual(world.inspectAtmosphere(),before);assert.equal(s.stats.elapsed,420);
  }
  const state=JSON.stringify(s);for(const seconds of [0,300,600,780,900])world.setAtmospherePreview(seconds);assert.equal(JSON.stringify(s),state);
  world.setAtmospherePreview(null);assert.equal(world.inspectAtmosphere()!.seconds,420);
 }finally{world.dispose();scene.dispose();engine.dispose();}
});
