import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP_DEFINITIONS,worldProfile,worldPoint,localPoint,siteAvailable} from '../src/data/maps.ts';
import {WORLD} from '../src/data/world.ts';
import {DESIGN} from '../src/data/config.ts';
import {ENCOUNTER_DEFINITIONS,mapEncounter,selectEncounter} from '../src/data/encounters.ts';
import {KANTO,getSpecies} from '../src/data/kanto.ts';
import {Simulation,type GameEvent} from '../src/game/Simulation.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {createEnvironment,createPOIs,explorationRoute,ObstacleField,terrainHeight} from '../src/game/systems/environment.ts';
import {DEFAULT_SAVE,migrateSave,selectRunOptions} from '../src/game/save.ts';
import {RNG} from '../src/utils/random.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
test('every registered map is 25% wider with deterministic varied geography and more discoveries',()=>{
 assert.equal(DESIGN.mapRadius,115*1.25);assert.equal(WORLD.hardBoundary,113*1.25);
 const signatures=new Set<string>(),kinds=new Set<string>();
 for(const map of Object.values(MAP_DEFINITIONS))for(const seed of [1,4,12,100,301,808]){
  const profile=worldProfile(seed,map.id),pois=createPOIs(seed,map.id);
  assert.deepEqual(profile,worldProfile(seed,map.id));assert.deepEqual(pois,createPOIs(seed,map.id));
  assert.equal(pois.filter(p=>siteAvailable(p,0)).length,18);assert.equal(pois.length,21);
  signatures.add(JSON.stringify([profile.turn,profile.lake,profile.relief]));kinds.add(pois.slice(12,18).map(p=>p.kind).join(','));
  const point={x:42,z:-57},roundTrip=localPoint(worldPoint(point,profile),profile);assert.deepEqual(roundTrip,point);
  for(const mark of profile.landmarks)assert.ok(Math.abs(mark.x)<WORLD.hardBoundary&&Math.abs(mark.z)<WORLD.hardBoundary);
  const field=new ObstacleField(createEnvironment(seed,pois,map.id).obstacles);
  for(const poi of pois){
   assert.ok(Number.isFinite(terrainHeight(poi.x,poi.z,profile)));let position={x:0,z:0};
   for(const end of explorationRoute(poi,profile).slice(1)){
    for(let i=0;i<1800&&Math.hypot(position.x-end.x,position.z-end.z)>.01;i++){
     const distance=Math.hypot(end.x-position.x,end.z-position.z),step=Math.min(.35,distance);
     position=field.move(position,(end.x-position.x)/distance*step,(end.z-position.z)/distance*step);
    }
    assert.ok(Math.hypot(position.x-end.x,position.z-end.z)<.02,`${map.id}, seed ${seed}, site ${poi.uid}: route blocked`);
   }
  }
 }
 assert.ok(signatures.size>=6);assert.ok(kinds.size>=2);
});

test('timed discoveries stay unavailable and frozen while paused, then announce exactly once',()=>{
 for(const mapId of ['wildlands','volcanic-ridge'] as const){
  const sim=new Simulation(7,301,{mapId}),s=sim.state,events:GameEvent[]=[];sim.onEvent=e=>events.push(e);
  s.enemies=[];s.player.iframes=10000;s.party[0].cooldown=10000;(sim as any).spawnAccum=-10000;
  const discovery=s.pois.find(p=>p.availableAt===180)!;Object.assign(s.player,{x:discovery.x,z:discovery.z,hp:20});
  sim.update(.02,{...idle,interact:true});assert.equal(discovery.used,false);assert.equal(s.player.hp,20);
  s.stats.elapsed=179.99;sim.pause();const frozen=structuredClone(s);sim.update(.04,idle);assert.deepEqual(s,frozen);
  sim.pause();sim.update(.02,idle);assert.equal(discovery.announced,true);assert.equal(events.filter(e=>e.label===discovery.changeLabel).length,1);
  sim.update(.02,{...idle,interact:true});assert.equal(discovery.used,true);assert.equal(s.phase,'choice');sim.choose(s.upgradeChoices[0].id);
  sim.update(.02,idle);sim.update(.02,{...idle,interact:true});assert.equal(events.filter(e=>e.label===discovery.changeLabel).length,1);
  s.stats.elapsed=420;sim.update(.02,idle);const cache=s.pois.find(p=>p.availableAt===420)!;assert.equal(cache.price,undefined);assert.equal(cache.announced,true);
  s.stats.elapsed=660;s.recruitCount=5;sim.update(.02,idle);assert.equal(s.pois.find(p=>p.availableAt===660)!.announced,true);
 }
});

test('encounter registry preserves roster access and weights volcanic species without changing time tiers',()=>{
 for(const definition of Object.values(ENCOUNTER_DEFINITIONS)){
  assert.ok(KANTO.some(s=>s.id===definition.boss.speciesId));assert.ok(definition.boss.patterns.length>=3);
  for(const id of [...definition.favoredSpecies,...definition.guardians,...definition.boss.summons])assert.ok(KANTO.some(s=>s.id===id));
 }
 const rng=new RNG(15),favored=mapEncounter('volcanic-ridge').favoredSpecies;let count=0;
 for(let i=0;i<2000;i++){
  const encounter=selectEncounter(rng,0,'early',false,'volcanic-ridge');assert.equal(encounter.rare,false);assert.equal(getSpecies(encounter.speciesId).stage,1);
  if(favored.includes(encounter.speciesId))count++;
 }
 assert.ok(count>1000&&count<1600,`Favored species ${count}/2000`);
});

test('both map legendaries arrive at fifteen minutes, execute configured patterns and preserve endless builds',()=>{
 for(const mapId of ['wildlands','volcanic-ridge'] as const){
  const sim=new Simulation(25,21,{mapId}),s=sim.state,bossDefinition=mapEncounter(mapId).boss;
  s.stats.elapsed=899.99;s.enemies=[];s.player.iframes=10000;s.party[0].cooldown=10000;s.recruitCount=5;(sim as any).spawnAccum=-10000;
  sim.update(.02,idle);const boss=s.enemies.find(e=>e.isBoss)!;assert.equal(boss.speciesId,bossDefinition.speciesId);assert.equal(s.phase,'boss');
  boss.speed=0;boss.x=s.player.x+15;boss.z=s.player.z;boss.hp=boss.maxHp=100000;
  for(let index=0;index<bossDefinition.patterns.length;index++){
   boss.bossCycle=index;boss.attackCooldown=0;delete boss.windup;s.projectiles=[];s.psychicRings=[];
   sim.update(.02,idle);assert.equal(boss.windup?.kind,bossDefinition.patterns[index]);
   const before=structuredClone(s);sim.pause();sim.update(.04,idle);sim.pause();assert.deepEqual(s,before);
   boss.windup!.remaining=.01;sim.update(.02,idle);
   if(bossDefinition.patterns[index]==='volley'){
    assert.equal(s.projectiles.length,bossDefinition.shots);assert.ok(s.projectiles.every(p=>p.type===bossDefinition.element&&p.moveName===bossDefinition.moves.volley));
   }else if(bossDefinition.patterns[index]==='psychicRing')assert.equal(s.psychicRings[0].color,bossDefinition.color);
   else {const adds=s.enemies.filter(e=>!e.isBoss);assert.ok(adds.length>=bossDefinition.rules.summonCount);assert.ok(adds.every(e=>bossDefinition.summons.includes(e.speciesId)));}
  }
  s.items=['wide-lens'];s.player.hp=77;
  // Each stage reserves its own HP threshold, even against an overwhelming hit.
  for(let hit=0;hit<3&&!boss.dead;hit++)(sim as any).damageEnemy(boss,boss.maxHp*100,'normal',1);
  assert.equal(s.result,'victory');assert.equal(s.stats.bossKilled,true);assert.equal(s.projectiles.filter(p=>!p.friendly).length,0);
  sim.continueEndless();assert.equal(s.endless,true);assert.equal(s.player.hp,77);assert.deepEqual(s.items,['wide-lens']);
  sim.update(.02,idle);assert.equal(s.enemies.filter(e=>e.isBoss&&!e.dead).length,0);
  while(s.phase==='choice')sim.choose(s.upgradeChoices[0].id);assert.equal(s.phase,'playing');
 }
});

test('new mutations change actual arrival rate and ordinary and boss damage; old saves gain only the new choices',()=>{
 const standard=new Simulation(25,31),onslaught=new Simulation(25,31,{challenge:'onslaught'}),volatile=new Simulation(25,31,{challenge:'volatile'});
 assert.equal(onslaught.state.director!.spawnInterval,standard.state.director!.spawnInterval*.8);
 assert.equal(volatile.state.enemies[0].damage,standard.state.enemies[0].damage*1.25);
 for(const mapId of ['wildlands','volcanic-ridge'] as const){
  const sim=new Simulation(25,1,{mapId,challenge:'volatile'}),s=sim.state,boss=mapEncounter(mapId).boss;
  s.enemies=[createEnemy(s,sim.rng,boss.speciesId,'legendary',10,10,true,true)];s.bossSpawned=true;
  (sim as any).bossVolley(s.enemies[0],0);assert.equal(s.projectiles[0].damage,boss.rules.volleyDamage*1.25);
 }
 for(const version of [1,2]){
  const saved=migrateSave({version,unlocked:[1,4,7,25,133],unlockedMaps:['wildlands','pinewood-route'],wins:2,games:7})!;
  assert.equal(saved.games,7);assert.equal(saved.wins,2);assert.ok(saved.unlocked.includes(133));assert.ok(saved.unlockedMaps.includes('pinewood-route'));
  assert.ok(saved.unlockedMaps.includes('volcanic-ridge'));assert.ok(saved.unlockedChallenges.includes('onslaught'));assert.ok(saved.unlockedChallenges.includes('volatile'));
  selectRunOptions(saved,{map:'volcanic-ridge',challenge:'onslaught'});assert.deepEqual(saved.selection,{map:'volcanic-ridge',challenge:'onslaught'});
 }
 assert.equal(DEFAULT_SAVE.unlockedMaps.includes('volcanic-ridge'),true);
});
