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

// Captured from the current working tree before Stages 01/02 were implemented,
// not from HEAD (which predates the user's unrelated game/balance changes).
// Stages 03/07 intentionally compose ordinary scenery. Historical authoritative
// POI, tactical feature, harvest state and height fixtures still apply unchanged.
const baseline:Record<MapId,{seed:number;pois:string;features:string;berries:string;heights:string}>={
 wildlands:{seed:4,
  pois:'5c53be6bcf5bb7c213349a47f784c7de4d45a101251dc1466cd8a695ad26b967',
  features:'ee8eb7e064ed895f94890820d298c8178a535248a8eb69540dfac129219b7b10',
  berries:'422b0c20852ccd617f9a446235214e3c5c24f3fa9550fc49ce71b75caa400f80',
  heights:'131e195b61e5a0c078d78b6ab24981b9d8d23e2b2980fae0b5d1725961661c5a'},
 'pinewood-route':{seed:46837,
  pois:'3f2cbc9899dfdadfef96f09be8dd348e888ebf2340325fbf8eb11b658ba1ce68',
  features:'769bd9315db1318e7ef665b73f7fb7e25e2189ec481ae77499984cd4fd467db9',
  berries:'c31eb07307df664a7ed96245e11c6694c59fc57de6f188cfa0d0c64b37bd3882',
  heights:'6f0e3694fbeeaecd611339dcdda434039cc178d291190421cb4b51298789caad'},
 'ruins-route':{seed:81073,
  pois:'53c246424123b305aab7009b8db7b1f33dd957f3a1b9122758e2db5efcc85d45',
  features:'d36186f61ae9735899206cd24fe59a21d89a737bbd24fb3010451b4135056f57',
  berries:'db71d71b1c80a3bc1198c90b06dc31ae546b272f1810772cfb270fef1edfbb3c',
  heights:'7d226e1073258d52c6f3557f981e3368d0e1e560e5926fc0408d41dd3ba0fbee'},
 'volcanic-ridge':{seed:4,
  pois:'bf89875b2baa55853c18e095f02156eb784677c67a2dad13010c8ec795e7625a',
  features:'0ba56e8927a46f1a20588aebfdf7aff49fb3a9fb1cd18b4d4a1f409fbdfce4e6',
  berries:'91e9f436bbf47c4bdd2392c0db460d7e2e799f0ece3ef9eef657e1b956e0d531',
  heights:'cddd09986b98aa62730bf1012f41c0e21e3cbd06ebc8b1c54631526466a76021'},
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
     assert.equal(lake.material?.alpha,.91);
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
