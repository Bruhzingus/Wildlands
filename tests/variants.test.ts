import test from 'node:test';
import assert from 'node:assert/strict';
import {FreeCamera,NullEngine,Scene,Vector3} from '@babylonjs/core';
import {VARIANTS,SPAWN_VARIANTS,variantRewardXP,variantWeights} from '../src/data/variants.ts';
import {KANTO,getSpecies} from '../src/data/kanto.ts';
import {DESIGN,typeMultiplier} from '../src/data/config.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {createEnemy,rollVariant,spawnRandomEnemy} from '../src/game/systems/spawning.ts';
import {VariantCues} from '../src/game/render/AssetLibrary.ts';
import {RNG} from '../src/utils/random.ts';
import type {Variant} from '../src/game/types.ts';

test('variant registry changes stats across all species without changing typing or adding attacks',()=>{
 const s=new Simulation(25,91).state,rng=new RNG(43);
 for(const sp of KANTO){
  const normal=createEnemy(s,rng,sp.id,'normal',2,3);
  for(const variant of Object.keys(VARIANTS) as Variant[]){
   const enemy=createEnemy(s,rng,sp.id,variant,2,3),definition=VARIANTS[variant];
   assert.equal(enemy.speciesId,sp.id);assert.deepEqual(getSpecies(enemy.speciesId).types,sp.types);
   assert.equal(typeMultiplier('electric',getSpecies(enemy.speciesId).types),typeMultiplier('electric',sp.types));
   assert.ok(Math.abs(enemy.maxHp/normal.maxHp-definition.hp)<1e-12);
   assert.ok(Math.abs(enemy.damage/normal.damage-definition.damage)<1e-12);
   assert.ok(Math.abs(enemy.speed/normal.speed-definition.speed)<1e-12);
   assert.equal(enemy.windup,undefined);assert.equal(enemy.isBoss,false);
  }
 }
 assert.ok(VARIANTS.rabid.hp<1);assert.equal(VARIANTS.rabid.speed,1.75);
 assert.deepEqual(VARIANTS.poisoned.contactPoison,{seconds:4.5,damagePerSecond:1.6});
 assert.equal(VARIANTS.dark.contactPoison,undefined);assert.equal(VARIANTS.rocket.contactPoison,undefined);assert.equal(VARIANTS.rabid.contactPoison,undefined);
 assert.equal(new Set(Object.values(VARIANTS).map(variant=>variant.cue)).size,6,'All five factions have different non-color-only silhouettes');
});

test('variant rarity follows configured early/late weights and legendary bosses never enter the lottery',()=>{
 for(const elapsed of [0,450,900,1800]){
  const rng=new RNG(4231),counts=new Map<Variant,number>(),n=30000;
  for(let i=0;i<n;i++){const variant=rollVariant(rng,elapsed);counts.set(variant,(counts.get(variant)??0)+1);}
  const weights=variantWeights(elapsed);
  for(const variant of SPAWN_VARIANTS)assert.ok(Math.abs((counts.get(variant)??0)/n-weights[variant])<.011,`${elapsed}s ${variant}`);
  assert.equal(counts.get('legendary'),undefined);
 }
 const rng=new RNG(4);for(let i=0;i<100;i++)assert.equal(rollVariant(rng,900,{rocket:3,legendary:1000}),'rocket');
 for(const weights of [{legendary:1},{rocket:-1},{poisoned:NaN},{normal:Infinity}])assert.equal(rollVariant(rng,900,weights),'normal');
 const one=new RNG(45),two=new RNG(45);assert.deepEqual(Array.from({length:100},()=>rollVariant(one,800)),Array.from({length:100},()=>rollVariant(two,800)));
});

test('XP rewards include stage, faction and elite/boss multipliers exactly once',()=>{
 const s=new Simulation(25,13).state,rng=new RNG(24);
 for(const variant of Object.keys(VARIANTS) as Variant[])for(const speciesId of [10,11,12]){
  const enemy=createEnemy(s,rng,speciesId,variant,4,0),stage=getSpecies(speciesId).stage,multiplier=VARIANTS[variant].xp;
  assert.equal(variantRewardXP(enemy),(5+stage*2)*multiplier);
  enemy.elite=true;assert.equal(variantRewardXP(enemy),(20+stage*2)*multiplier);
  enemy.isBoss=true;assert.equal(variantRewardXP(enemy),(90+stage*2)*multiplier);
 }
});

test('director spawn tuning respects a reserved boss slot, hard budgets, species tiers and faction overrides',()=>{
 const s=new Simulation(25,91).state,rng=new RNG(14);s.enemies=[];
 for(let i=0;i<4;i++){const enemy=spawnRandomEnemy(s,rng,{capacity:5,speciesTier:'early',variantWeights:{rabid:1},statScale:1.4});assert.ok(enemy);assert.equal(enemy.variant,'rabid');assert.ok(![144,145,146,150,151].includes(enemy.speciesId));s.enemies.push(enemy);}
 assert.equal(spawnRandomEnemy(s,rng,{capacity:5}),null,'One slot remains for the scheduled boss');
 s.bossSpawned=true;assert.ok(spawnRandomEnemy(s,rng,{capacity:5}));
 assert.equal(spawnRandomEnemy(s,rng,{capacity:0}),null);
 s.enemies=Array.from({length:DESIGN.maxEnemies},()=>createEnemy(s,rng,19,'normal',0,0));
 assert.equal(spawnRandomEnemy(s,rng,{capacity:10000}),null);
 s.enemies=[];const normal=spawnRandomEnemy(s,new RNG(42),{variantWeights:{normal:1},statScale:1}),strong=spawnRandomEnemy(s,new RNG(42),{variantWeights:{normal:1},statScale:2});
 assert.ok(normal&&strong);assert.equal(strong.maxHp,normal.maxHp*2);assert.equal(strong.damage,normal.damage*2);assert.equal(strong.speed,normal.speed);
});

test('faction glyphs share five primitives, recycle instances, follow the camera and release every resource',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),camera=new FreeCamera('camera',new Vector3(0,15,-20),scene);camera.setTarget(Vector3.Zero());scene.activeCamera=camera;
 const cues=new VariantCues(scene),s=new Simulation(25,7).state,rng=new RNG(14),origin={x:0,z:0},variants=['dark','rocket','rabid','poisoned','legendary'] as const;
 try{
  let markers=variants.map((variant,index)=>createEnemy(s,rng,19,variant,index*2,5));
  cues.sync(markers,origin,()=>0);assert.equal(cues.inspect().active.length,5);assert.equal(cues.inspect().sources,5);assert.equal(cues.inspect().allocated,5);
  assert.equal(scene.meshes.length,10,'Five source glyphs and five shared instances');assert.equal(scene.textures.length,0,'No texture per variant or actor');
  for(let wave=0;wave<40;wave++){cues.sync([],origin,()=>0);markers=variants.map((variant,index)=>createEnemy(s,rng,19,variant,index*2,5));cues.sync(markers,origin,()=>0);}
  assert.equal(cues.inspect().allocated,5);assert.equal(scene.meshes.length,10);
  const before=cues.inspect();cues.sync(markers,origin,()=>0);assert.deepEqual(cues.inspect(),before);
  camera.position.set(15,15,-8);camera.setTarget(Vector3.Zero());camera.getViewMatrix(true);cues.sync(markers,origin,()=>0);
  assert.ok(cues.inspect().active.some((marker,i)=>Math.hypot(marker.x-before.active[i].x,marker.y-before.active[i].y,marker.z-before.active[i].z)>.1));
  markers[0].dead=true;markers[1].x=100;cues.sync(markers,origin,()=>0);assert.equal(cues.inspect().active.length,3);
  const crowd=Array.from({length:200},(_,i)=>createEnemy(s,rng,19,variants[i%5],i%5,5));cues.sync(crowd,origin,()=>0);
  assert.equal(cues.inspect().active.length,cues.maxVisible);assert.ok(cues.inspect().allocated<=cues.maxVisible+cues.maxPooledPerKind*5);
  cues.dispose();assert.equal(scene.meshes.length,0);assert.equal(scene.materials.length,0);assert.equal(cues.inspect().allocated,0);
 }finally{cues.dispose();scene.dispose();engine.dispose();}
});
