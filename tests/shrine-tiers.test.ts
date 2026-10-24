import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {DESIGN} from '../src/data/config.ts';
import {SHRINE_TIERS,SHRINE_SPECIES,SHRINE_RULES,refreshShrineTier,shrineContents,shrineDefinition,shrineForPOI,shrineHazardZones,shrineLevelAllowed,shrineXPMultiplier} from '../src/data/shrines.ts';
import {createPOIs} from '../src/game/systems/environment.ts';
import {variantRewardXP} from '../src/data/variants.ts';
import type {POI} from '../src/game/types.ts';
import {scriptedInput} from '../scripts/lib/run-metrics.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
function arena(tier=1,level=shrineDefinition(tier).level){
 const sim=new Simulation(7,194),s=sim.state,site:POI={uid:301,x:0,z:0,kind:'shrine',shrineTier:tier,used:false};
 s.pois=[site];s.enemies=[];s.terrainFeatures=[];s.party[0].level=level;s.recruitCount=5;
 s.player.iframes=10000;s.party[0].cooldown=10000;(sim as any).spawnAccum=-10000;
 return {sim,s,site,start:()=>{(sim as any).activatePOI(site);},kill:(index:number)=>{const enemy=s.enemies[index];(sim as any).damageEnemy(enemy,enemy.maxHp*10,'normal',1,{},false,false,false,false);}};
}

test('fifteen tiers vary species, count, arena and hazards and finish in black legendary dust',()=>{
 assert.equal(SHRINE_TIERS.length,15);assert.equal(new Set(SHRINE_TIERS.map(def=>def.speciesId)).size,15);
 assert.equal(SHRINE_SPECIES.length,SHRINE_TIERS.length);
 assert.ok(SHRINE_SPECIES.every((species,index)=>species[0]===SHRINE_TIERS[index].speciesId));
 assert.ok(new Set(SHRINE_TIERS.map(def=>def.radius)).size>=5);assert.ok(new Set(SHRINE_TIERS.map(def=>def.count)).size>=3);
 assert.deepEqual(new Set(SHRINE_TIERS.flatMap(def=>def.hazards)),new Set(['slow','poison','fire']));
 assert.equal(SHRINE_TIERS.at(-1)!.color,'#09080e');assert.equal(SHRINE_TIERS.at(-1)!.speciesId,150);
 assert.equal(shrineContents(shrineDefinition(6)),'Machamp Shrine - 2 Machamp');
 assert.equal(shrineContents(shrineDefinition(9)),'Gyarados Shrine - 1 Gyarados + Poison');
 for(let i=1;i<SHRINE_TIERS.length;i++)assert.ok(SHRINE_TIERS[i].level>SHRINE_TIERS[i-1].level);
});

test('early shrine sites show different statues and summon their advertised species',()=>{
 const sites=createPOIs(194).filter(poi=>poi.kind==='shrine'&&poi.shrineTier===1);
 assert.deepEqual(new Set(sites.map(poi=>shrineForPOI(poi).speciesId)),new Set(SHRINE_SPECIES[0]));
 for(const site of sites){
  const definition=shrineForPOI(site),a=arena(1);a.site.uid=site.uid;a.site.shrineVariant=site.shrineVariant;
  assert.equal(shrineContents(shrineForPOI(a.site)),shrineContents(definition));
  a.start();assert.ok(a.s.enemies.every(enemy=>enemy.speciesId===definition.speciesId));
 }
});

test('the level window is inclusive and invalid interactions do not consume a shrine',()=>{
 const definition=shrineDefinition(6);
 for(const difference of [-11,-10,0,10,11]){
  const a=arena(6,definition.level+difference);a.start();
  assert.equal(!!a.site.challenge,Math.abs(difference)<=10);assert.equal(a.site.used,Math.abs(difference)<=10);
  assert.equal(a.s.enemies.length,Math.abs(difference)<=10?definition.count:0);
 }
 const a=arena();for(let level=1;level<=100;level++){
  a.s.party[0].level=level;a.site.shrineTier=1;refreshShrineTier(a.s,a.site);
  assert.ok(shrineLevelAllowed(level,shrineDefinition(a.site.shrineTier)));
 }
 const tiers=new Set<number>();a.s.party[0].level=30;
 for(let uid=301;uid<310;uid++){a.site.uid=uid;a.site.shrineTier=1;refreshShrineTier(a.s,a.site);tiers.add(a.site.shrineTier!);}
 assert.ok(tiers.size>=3,'Outgrown sites should offer different encounters in the same level window');
});

test('every tier spawns exactly its advertised encounter with a fixed health budget',()=>{
 for(const definition of SHRINE_TIERS){
  const a=arena(definition.tier);a.start();
  assert.equal(a.s.enemies.length,definition.count);assert.ok(a.s.enemies.every(enemy=>enemy.speciesId===definition.speciesId&&enemy.challengeSiteId===a.site.uid&&!enemy.isBoss));
  assert.ok(Math.abs(a.s.enemies.reduce((sum,enemy)=>sum+enemy.maxHp,0)-definition.health)<1e-6);
  assert.equal(a.site.challenge!.endsAt-a.s.stats.elapsed,SHRINE_RULES.timeLimit);
  const original=a.site.shrineTier;a.s.party[0].level=100;refreshShrineTier(a.s,a.site,true);assert.equal(a.site.shrineTier,original,'active encounters keep their tier');
 }
});

test('a late shrine allows a two-minute fight and fails only at its three-minute deadline',()=>{
 const a=arena(9);a.start();
 assert.equal(a.site.challenge!.endsAt,180);
 for(const elapsed of [60,120,179.99]){
  a.s.stats.elapsed=elapsed;(a.sim as any).updateExploration();
  assert.ok(a.site.challenge,`The shrine must remain active after ${elapsed}s`);
  assert.ok(a.s.enemies.some(enemy=>!enemy.dead));
 }
 a.s.stats.elapsed=180;(a.sim as any).updateExploration();
 assert.equal(a.site.challenge,undefined);assert.ok(a.s.enemies.every(enemy=>enemy.dead));
});

test('multi-guardian trials award completion once, after the last guardian, and reserve all slots',()=>{
 const a=arena(6);a.start();a.kill(0);assert.ok(a.site.challenge);assert.equal(a.s.pendingSquadRewards,0);assert.equal(a.s.buffs.luck??0,0);
 assert.equal(a.s.drops.filter(drop=>drop.kind==='coin'||drop.kind==='item').length,0,'individual guardians cannot award shrine loot');
 a.kill(1);assert.equal(a.site.challenge,undefined);assert.equal(a.site.uses,1);assert.equal(a.s.pendingSquadRewards,1);assert.equal(a.s.buffs.luck,.04);
 assert.equal(a.s.drops.filter(drop=>drop.kind==='coin'||drop.kind==='item').length,1,'the completed shrine awards one total loot prize');
 a.kill(1);assert.equal(a.s.pendingSquadRewards,1);
 const crowded=arena(2);crowded.s.enemies=Array.from({length:DESIGN.maxEnemies-3},(_,index)=>({...a.s.enemies[0],uid:1000+index,dead:false}));
 crowded.start();assert.equal(crowded.site.used,false);assert.equal(crowded.site.challenge,undefined);
});

test('XP applies the tier bonus and level adjustment once across instant and dropped XP',()=>{
 for(const tier of [1,6,15])for(const difference of [-10,0,10]){
  const definition=shrineDefinition(tier),level=definition.level+difference;if(level<1)continue;
  const a=arena(tier,level);a.start();const guardian=a.s.enemies[0];
  const expected=variantRewardXP({...guardian,elite:false})*shrineXPMultiplier(definition,level),before=a.s.party[0].xp??0;
  a.kill(0);const actual=(a.s.party[0].xp??0)-before+a.s.drops.filter(drop=>drop.kind==='xp').reduce((sum,drop)=>sum+drop.value,0);
  const collectible=level>=100?expected*.48:expected;
  assert.ok(Math.abs(actual-collectible)<1e-6,`tier ${tier}, gap ${difference}: ${actual} vs ${collectible}`);
 }
 const definition=shrineDefinition(15);
 assert.equal(shrineXPMultiplier(definition,80),3*1.25);assert.equal(shrineXPMultiplier(definition,100),3*.75);
});

test('hazards warn before damage, integrate damage by time, and allow jumping or dodging',()=>{
 const a=arena(3);a.start();const warning=shrineHazardZones(a.site,0)[0];assert.equal(warning.warning,true);
 a.s.player.x=warning.x;a.s.player.z=warning.z;const hp=a.s.player.hp;(a.sim as any).updateShrineHazards(.5);assert.equal(a.s.player.hp,hp);
 a.s.stats.elapsed=1.5;assert.equal(shrineHazardZones(a.site,1.5)[0].warning,false);
 (a.sim as any).updateShrineHazards(.5);const damage=hp-a.s.player.hp;assert.ok(damage>0);
 a.s.player.hp=hp;(a.sim as any).updateShrineHazards(.25);(a.sim as any).updateShrineHazards(.25);assert.ok(Math.abs(hp-a.s.player.hp-damage)<1e-6);
 a.s.player.hp=hp;a.s.player.y=1;(a.sim as any).updateShrineHazards(.5);assert.equal(a.s.player.hp,hp);
 a.s.player.y=0;a.s.player.dodgeTime=.2;(a.sim as any).updateShrineHazards(.5);assert.equal(a.s.player.hp,hp);
 a.sim.pause();const before=structuredClone(a.s);a.sim.update(.04,idle);assert.deepEqual(a.s,before);
});

test('retreat removes every guardian, projectile and ring and permits a fresh retry',()=>{
 const a=arena(6);a.start();const ids=a.s.enemies.map(enemy=>enemy.uid);
 a.s.projectiles=ids.map((sourceId,index)=>({uid:900+index,sourceId,friendly:false}) as any);
 a.s.psychicRings=ids.map((sourceId,index)=>({uid:910+index,sourceId}) as any);
 a.s.player.x=shrineDefinition(6).radius+.01;(a.sim as any).updateExploration();
 assert.ok(a.s.enemies.every(enemy=>enemy.dead));assert.equal(a.s.projectiles.length,0);assert.equal(a.s.psychicRings!.length,0);
 assert.equal(a.s.drops.length,0);assert.equal(a.s.stats.kills,0);assert.equal(a.site.uses,undefined);assert.equal(a.site.challenge,undefined);
 a.s.player.x=0;a.s.stats.elapsed=a.site.respawnAt!;(a.sim as any).updateExploration();a.start();
 assert.equal(a.site.challenge!.tier,6);assert.ok(a.s.enemies.filter(enemy=>!enemy.dead).every(enemy=>enemy.hp===enemy.maxHp&&!ids.includes(enemy.uid)));
});

test('a failed repeat trial keeps its tier when it reopens',()=>{
 const a=arena(6);a.start();a.kill(0);a.kill(1);a.s.stats.elapsed=a.site.respawnAt!;(a.sim as any).updateExploration();
 assert.equal(a.site.shrineTier,7);a.start();a.s.player.x=30;(a.sim as any).updateExploration();
 a.s.player.x=0;a.s.stats.elapsed=a.site.respawnAt!;(a.sim as any).updateExploration();a.start();assert.equal(a.site.challenge!.tier,7);
});

test('slow ground reduces movement only while its pocket is active',()=>{
 const movement=(elapsed:number)=>{
  const a=arena(4);a.start();a.s.stats.elapsed=elapsed;const zone=shrineHazardZones(a.site,elapsed)[0];
  a.s.player.x=zone.x;a.s.player.z=zone.z;const origin=a.s.player.x;
  for(let i=0;i<20;i++)(a.sim as any).movePlayer(.04,{...idle,mx:1});
  return a.s.player.x-origin;
 };
 assert.ok(movement(1.5)<movement(.2)*.8,'Active slow ground should reduce travel compared with the warning');
});

test('an opening shrine can be beaten at two minutes in 20–35 seconds using the special',()=>{
 const fight=(special:boolean)=>{
  const sim=new Simulation(4,194),s=sim.state,site:POI={uid:301,x:0,z:0,kind:'shrine',shrineTier:1,used:false};
  s.pois=[site];s.enemies=[];s.terrainFeatures=[];s.stats.elapsed=120;s.party[0].level=5;s.party[0].attackLevel=2;s.recruitCount=5;(sim as any).spawnAccum=-10000;
  (sim as any).activatePOI(site);
  for(let tick=0;tick<1500&&site.challenge&&s.result===null;tick++){
   const input=scriptedInput(s,'cautious',tick);input.interact=false;input.special=special&&input.special;
   const distance=Math.hypot(s.player.x,s.player.z);if(distance>13){input.mx=-s.player.x/distance;input.mz=-s.player.z/distance;input.dodge=false;}
   const target=s.enemies.find(enemy=>!enemy.dead);if(target){input.aimX=target.x-s.player.x;input.aimZ=target.z-s.player.z;}
   sim.update(.04,input);while(s.phase==='choice')sim.choose(s.upgradeChoices[0].id);
  }
  assert.equal(site.uses,1);assert.equal(s.result,null);return s.stats.elapsed-120;
 };
 const withSpecial=fight(true),withoutSpecial=fight(false);
 assert.ok(withSpecial>=20&&withSpecial<=35,`Opening fight took ${withSpecial}s`);assert.ok(withSpecial<withoutSpecial-2);
});
