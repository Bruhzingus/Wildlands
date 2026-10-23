import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MAP_DEFINITIONS,worldProfile,type MapId} from '../src/data/maps.ts';
import {createEnvironment,createPOIs,terrainHeight} from '../src/game/systems/environment.ts';
import {createBerryTrees} from '../src/game/systems/berries.ts';
import {Color3,NullEngine,Scene,VertexBuffer} from '@babylonjs/core';
import {World} from '../src/game/render/World.ts';
import {treeVisual,type TreeFamily} from '../src/game/render/vegetation.ts';
import {BERRY_ORDER} from '../src/data/berries.ts';
import {createTerrainPalette} from '../src/game/render/terrainPalette.ts';

// Rebaselined for the October 23 map expansion and four additional shrine
// clearings. These lock the resulting scenery; shrine-sites.test.ts also
// preserves the original 21 site identities before the added clearings.
const baseline:Record<MapId,{seed:number;pois:string;features:string;berries:string;heights:string}>={
 wildlands:{seed:4,
  pois:'94e9122f5d3a9f4857f19fabc2d3c754386bfc45a8e13078d656ec6eabf13823',
  features:'ac3f3ea01ee611f4ab9699c5e6648e28aba8b61467e91d9e2abed9a713bd2e77',
  berries:'43c3bb5d63b8022ca5a704a35ef1c95fd7705bf403e11fced238bd5cd55ff29a',
  heights:'d87d1fce3a3b222e3f6ee9a51aadebc29ff0b3a83409d35d686feaeca7c7e5d7'},
 'pinewood-route':{seed:46837,
  pois:'10355888e9676fd20a470bb0dbb6ca0749bbaa8dfadc3962eeeff26579a3069e',
  features:'8273018fa89c38bcdb34a61ffa73b4585348d8eeeec87f0638c265bd5372a9d0',
  berries:'407a4a32ca10f5306b8d615032f49110462769ab8dbe5bf20afe4635e07a1d41',
  heights:'0870abcec9afc357aa13d2e5c12d75830db9a85f82baef259b75a6de76b8c4ee'},
 'ruins-route':{seed:81073,
  pois:'6be2d588e104378740faff539c2dbc22eb8c58133acb3dfd54ba6f483d8922f7',
  features:'3ee4d7ae67060bdd4198b758203df7476865d032082ed3ccfeebe934afa1af2c',
  berries:'15bbb7573f131c108c4115df2eb1e3107f6db88d528b017ebed3cb7e40b4503d',
  heights:'69da5da51af96367753959dd366593034a87782093e04f89c29222001e4a1867'},
 'volcanic-ridge':{seed:4,
  pois:'de58024e0ce8c2220ec303fb1220274824b0b344ee3652be86b58842a3ca6c16',
  features:'5a3eee16e457257b242e5e5f66b521dbb06d87eaf021c85b80be2804c75f21d8',
  berries:'86d7db1d0a14efe9aa48531da0a406712b99ac7cb113a60abbd1ec7b7344bc29',
  heights:'7f1a456d570c928c44e2a10e2dcf30e4f68879dbb6d4ed5e03020d3feb34e619'},
};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const coordinates=[-141.25,-100,-66,-32,0,18,47,82,120,141.25];

test('visual stages preserve map IDs, authored seeds, POIs, tactical features, harvest state and heights',()=>{
 assert.deepEqual(Object.keys(MAP_DEFINITIONS),Object.keys(baseline));
 assert.equal(MAP_DEFINITIONS['pinewood-route'].seed,46837);
 assert.equal(MAP_DEFINITIONS['ruins-route'].seed,81073);
 for(const map of Object.values(MAP_DEFINITIONS)){
  const expected=baseline[map.id],seed=map.seed??4;
  assert.equal(seed,expected.seed);
  const profile=worldProfile(seed,map.id),pois=createPOIs(seed,map.id),layout=createEnvironment(seed,pois,map.id);
  const values={pois,features:layout.features,
   berries:createBerryTrees(layout.props,seed),heights:coordinates.flatMap(x=>coordinates.map(z=>terrainHeight(x,z,profile)))};
  for(const [kind,value] of Object.entries(values))assert.equal(hash(value),expected[kind as keyof typeof values],`${map.id}: ${kind} changed`);
 }
});

test('cosmetic tree families are deterministic, bounded and follow the independent biome mix',()=>{
 const families:TreeFamily[]=['pine','tiered','round','dead'];
 for(const family of families){
  const weights={pineWeight:0,tieredWeight:0,roundWeight:0,deadWeight:0};weights[`${family}Weight`]=1;
  assert.equal(treeVisual(4,25,-38,weights).family,family);
 }
 for(const map of Object.values(MAP_DEFINITIONS)){
  const counts={pine:0,tiered:0,round:0,dead:0};
  for(let index=0;index<4096;index++){
   const visual=treeVisual(index*7919,index*.73,-index*.41,map.vegetation);
   assert.deepEqual(visual,treeVisual(index*7919,index*.73,-index*.41,map.vegetation));
   assert.ok(visual.scale>=.9&&visual.scale<=1.1);
   assert.ok(visual.rotation>=0&&visual.rotation<Math.PI*2);
   counts[visual.family]++;
  }
  for(const family of families){
   const target=map.vegetation[`${family}Weight`];
   assert.ok(Math.abs(counts[family]/4096-target)<.035,`${map.id}: ${family} mix differs from configured weight`);
  }
 }
 const wild=MAP_DEFINITIONS.wildlands.vegetation,pine=MAP_DEFINITIONS['pinewood-route'].vegetation,volcano=MAP_DEFINITIONS['volcanic-ridge'].vegetation;
 assert.ok(wild.roundWeight>0&&wild.pineWeight+wild.tieredWeight>0);
 assert.ok(pine.pineWeight+pine.tieredWeight>wild.pineWeight+wild.tieredWeight);
 assert.ok(volcano.deadWeight>=.9);
 assert.equal(treeVisual(4,20,35,wild,true).family,'pine','authored great pine keeps its identity');
});

test('shore color follows the configured lake bank and leaves distant terrain unchanged',()=>{
 for(const map of Object.values(MAP_DEFINITIONS)){
  const seed=map.seed??4,profile=worldProfile(seed,map.id),sample=createTerrainPalette(profile,seed);
  const withoutShore=createTerrainPalette({...profile,definition:{...map,ground:{...map.ground,shoreStrength:0}}},seed);
  const shore=Color3.FromHexString(map.shoreColor),distance=(color:Color3)=>Math.hypot(color.r-shore.r,color.g-shore.g,color.b-shore.b);
  for(const offset of [map.ground.shoreWidth*.2,map.ground.shoreWidth+2]){
   const x=profile.lake.x+profile.lake.waterRadius+offset,z=profile.lake.z,y=terrainHeight(x,z,profile);
   const colored=new Color3(),plain=new Color3();
   assert.equal(sample(x,z,y,colored),colored,'sampler reuses its caller-owned result');withoutShore(x,z,y,plain);
   if(offset<map.ground.shoreWidth)assert.ok(distance(colored)<distance(plain),`${map.id}: configured bank color is absent`);
   else assert.deepEqual(colored,plain,`${map.id}: shore color spills beyond its bank`);
  }
 }
});

test('all maps keep the terrain and lake geometry, use deterministic vertex color shores, and reuse berry resources',()=>{
 const engine=new NullEngine(),scene=new Scene(engine);void scene.defaultMaterial;
 const resources=()=>({meshes:scene.meshes.length,materials:scene.materials.length,geometries:scene.geometries.length,lights:scene.lights.length,transforms:scene.transformNodes.length});
 const empty=resources();
 try{
  for(const map of Object.values(MAP_DEFINITIONS)){
   const seed=map.seed??4,profile=worldProfile(seed,map.id),pois=createPOIs(seed,map.id),layout=createEnvironment(seed,pois,map.id),trees=createBerryTrees(layout.props,seed);
   let firstColors:number[]|undefined;
   for(let restart=0;restart<2;restart++){
    const world=new World(scene,seed,pois,map.id,trees);
    try{
     const terrain=scene.getMeshByName('rolling forest terrain')!,positions=terrain.getVerticesData(VertexBuffer.PositionKind)!,colors=terrain.getVerticesData(VertexBuffer.ColorKind)!;
     assert.equal(positions.length,13689*3);assert.equal(terrain.getTotalIndices(),26912*3);
     assert.equal(colors.length,13689*4);assert.ok(colors.every(value=>Number.isFinite(value)&&value>=0&&value<=1));
     for(let index=0;index<positions.length;index+=3*137){
      const x=positions[index],z=positions[index+2];
      assert.ok(Math.abs(positions[index+1]-terrainHeight(x,z,profile))<.000004,`${map.id}: terrain elevation changed`);
     }
     assert.equal(scene.getMeshByName('pond shore'),null,'shore color must conform to the ground without the old floating torus');
     const lake=scene.getMeshByName('Stillwater lake')!;
     assert.deepEqual(lake.position.asArray(),[profile.lake.x,profile.lake.waterHeight,profile.lake.z]);
     assert.ok(Math.abs(lake.getBoundingInfo().boundingBox.extendSize.x-profile.lake.waterRadius)<.000004);
     assert.equal(lake.material?.alpha,1,'baked lake depth and glints use one opaque surface');
     if(firstColors)assert.deepEqual(Array.from(colors),firstColors,`${map.id}: color mask changes on rebuild`);
     else firstColors=Array.from(colors);
     const initial=resources();
     for(let frame=0;frame<120;frame++){
      const berry=BERRY_ORDER[Math.floor(frame/24)];
      for(const tree of trees)tree.berry=berry;
      world.update(1/60,pois,frame/60,layout.features,trees);
      if(frame%24===0){
       const tree=trees[0];
       for(let fruit=0;fruit<5;fruit++)assert.equal(scene.getMeshByName(`berry-tree-${tree.uid}-fruit-${fruit}`)?.material?.name,`${berry} berry`);
       assert.equal(scene.getMeshByName(`berry-tree-${tree.uid}-lower`)?.material?.name,`${berry} berry tree lower canopy`);
      }
     }
     assert.deepEqual(resources(),initial,`${map.id}: updates/berry variants allocate GPU resources`);
    }finally{world.dispose();}
    assert.deepEqual(resources(),empty,`${map.id}: restart leaked resources`);
   }
  }
 }finally{scene.dispose();engine.dispose();}
});
