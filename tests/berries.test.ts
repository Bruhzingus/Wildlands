import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {createBerryTrees,updateBerryTrees} from '../src/game/systems/berries.ts';
import {createEnvironment,createPOIs} from '../src/game/systems/environment.ts';
import {BERRIES,BERRY_CHANGE_SECONDS,BERRY_ORDER} from '../src/data/berries.ts';
import {RNG} from '../src/utils/random.ts';
import {NullEngine,Scene} from '@babylonjs/core';
import {World} from '../src/game/render/World.ts';
import {getSpecialProfile} from '../src/data/specials.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};

test('seeded berry trees use existing scenery and make one to three fruit per variant',()=>{
 let singles=0,others=0;
 for(let seed=1;seed<=20;seed++){
  const props=createEnvironment(seed,createPOIs(seed)).props,trees=createBerryTrees(props,seed);
  assert.deepEqual(trees,createBerryTrees(props,seed));assert.equal(trees.length,16);
  for(const tree of trees){
   assert.ok(props.some(prop=>prop.kind==='tree'&&prop.x===tree.x&&prop.z===tree.z));
   assert.ok(BERRY_ORDER.includes(tree.berry));assert.ok(tree.berries.length>=1&&tree.berries.length<=3);
   if(tree.berries.length===1)singles++;else others++;
  }
 }
 assert.ok(singles>others,'one fruit is the usual yield');
 assert.ok(BERRIES.oran.weight>BERRIES.leppa.weight&&BERRIES.leppa.weight>BERRIES.sitrus.weight&&BERRIES.sitrus.weight>BERRIES.pinap.weight&&BERRIES.pinap.weight>BERRIES['silver-pinap'].weight);
});

test('tree waits for the player to leave before a three minute variant change and single new drop',()=>{
 const tree=createBerryTrees(createEnvironment(12,createPOIs(12)).props,12)[0],rng=new RNG(9),old=tree.berry;
 tree.berries[0].collected=true;
 updateBerryTrees([tree],BERRY_CHANGE_SECONDS-1,{x:999,z:999},rng);
 assert.equal(tree.berry,old);assert.equal(tree.cycle,0);
 updateBerryTrees([tree],BERRY_CHANGE_SECONDS+10,{x:tree.x,z:tree.z},rng);
 assert.equal(tree.cycle,0);
 updateBerryTrees([tree],BERRY_CHANGE_SECONDS+11,{x:999,z:999},rng);
 assert.equal(tree.cycle,1);assert.notEqual(tree.berry,old);assert.ok(tree.berries.every(berry=>!berry.collected&&berry.droppedAt===BERRY_CHANGE_SECONDS+11));
 const fruit=structuredClone(tree.berries);
 updateBerryTrees([tree],BERRY_CHANGE_SECONDS+40,{x:999,z:999},rng);
 assert.deepEqual(tree.berries,fruit);assert.equal(tree.nextChangeAt,BERRY_CHANGE_SECONDS*2+11);
});

test('each berry adds a twenty-second timed stack and Pinap XP stacks',()=>{
 for(const kind of BERRY_ORDER){
  const sim=new Simulation(7,44),s=sim.state,tree=s.berryTrees![0];s.enemies=[];s.player.iframes=100;
  tree.berry=kind;tree.berries=[{x:s.player.x,z:s.player.z,collected:false,droppedAt:0}];
  s.player.hp=30;s.player.specialCooldown=9;
  const before=s.party[0].xp??0;sim.update(.02,idle);
  assert.equal(tree.berries[0].collected,true);
  assert.equal(s.berryBuffs?.[kind]?.length,1);assert.ok(Math.abs((s.berryBuffs?.[kind]?.[0]??0)-20.02)<1e-9);
  if(kind==='leppa')assert.ok(Math.abs(s.player.specialCooldown-7.184)<1e-9);
  if(kind==='pinap'||kind==='silver-pinap'){
   const start=s.party[0].xp??0;sim.gainXP(10);assert.equal((s.party[0].xp??0)-start,15);
   s.stats.elapsed=21;sim.gainXP(10);assert.equal((s.party[0].xp??0)-start,25);
   if(kind==='silver-pinap')assert.equal(start-before,25);
  }
  assert.equal(tree.berries[0].collected,true,'the same fruit cannot be picked twice');
 }
});

test('simultaneous berry stacks add cooldown, XP, and recovery effects',()=>{
 const sim=new Simulation(7,44),s=sim.state,tree=s.berryTrees![0];s.enemies=[];s.player.iframes=100;
 tree.berry='leppa';tree.berries=[{x:0,z:0,collected:false,droppedAt:0},{x:0,z:0,collected:false,droppedAt:0}];s.player.specialCooldown=0;sim.update(.02,idle);
 assert.equal(s.berryBuffs?.leppa?.length,2);sim.update(.02,{...idle,special:true});
 const normal=(sim as any).state.player.specialCooldown;assert.ok(normal>0&&normal<getSpecialProfile(s.party[0].speciesId,s.party[0].attackLevel).cooldown*.61);
 tree.berry='pinap';tree.berries=[{x:0,z:0,collected:false,droppedAt:s.stats.elapsed},{x:0,z:0,collected:false,droppedAt:s.stats.elapsed}];sim.update(.02,idle);
 const xp=s.party[0].xp??0;sim.gainXP(10);assert.equal((s.party[0].xp??0)-xp,20);
 tree.berry='oran';tree.berries=[{x:0,z:0,collected:false,droppedAt:s.stats.elapsed},{x:0,z:0,collected:false,droppedAt:s.stats.elapsed}];s.player.hp=30;sim.update(.02,idle);const hp=s.player.hp;(sim as any).updateRegeneration(1);assert.ok(Math.abs(s.player.hp-hp-1)<1e-9);
});

test('berry fruit and tree markers render visibly and release with the world',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),sim=new Simulation(7,29),s=sim.state;
 const world=new World(scene,s.seed,s.pois,s.mapId,s.berryTrees);
 const tree=s.berryTrees![0],body=scene.getMeshByName(`berry-${tree.uid}-0`)!;
 assert.ok(body.isVisible&&body.isEnabled());assert.equal(body.material?.name,`${tree.berry} berry`);
 assert.ok(body.position.y>world.height(tree.berries[0].x,tree.berries[0].z));
 for(const kind of BERRY_ORDER){
  tree.berry=kind;world.update(0,s.pois,1,[],s.berryTrees);
  assert.equal(scene.getMeshByName(`berry-tree-${tree.uid}-trunk`)!.material?.name,`${kind} berry tree bark`);
  assert.equal(scene.getMeshByName(`berry-tree-${tree.uid}-lower`)!.material?.name,`${kind} berry tree lower canopy`);
  assert.equal(scene.getMeshByName(`berry-tree-${tree.uid}-upper`)!.material?.name,`${kind} berry tree upper canopy`);
 }
 tree.berries[0].collected=true;world.update(0,s.pois,1,[],s.berryTrees);
 assert.equal(body.isEnabled(),false);
 world.dispose();assert.equal(scene.getMeshByName(`berry-${tree.uid}-0`),null);
 scene.dispose();engine.dispose();
});

test('Famine blocks restorative berry stacks while Leppa remains active',()=>{
 const sim=new Simulation(7,51,{challenge:'famine'}),s=sim.state,tree=s.berryTrees![0];s.enemies=[];s.player.iframes=100;
 tree.berries=[{x:0,z:0,collected:false,droppedAt:0}];s.player.hp=30;tree.berry='oran';sim.update(.02,idle);assert.equal(s.player.hp,30);
 tree.berries=[{x:0,z:0,collected:false,droppedAt:0}];tree.berry='sitrus';sim.update(.02,idle);assert.equal(s.player.hp,30);
 tree.berries=[{x:0,z:0,collected:false,droppedAt:0}];tree.berry='leppa';s.player.specialCooldown=8;sim.update(.02,idle);assert.equal(s.berryBuffs?.leppa?.length,1);assert.ok(Math.abs(s.player.specialCooldown-6.384)<1e-9);
});
