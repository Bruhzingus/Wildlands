import {getBuildModifiers} from '../src/game/systems/builds.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,type GameEvent} from '../src/game/Simulation.ts';
import {updateDirector,movingRingIntersects} from '../src/game/systems/director.ts';
import {createEnemy,lateEnemyScale} from '../src/game/systems/spawning.ts';
import {canRecruit} from '../src/game/systems/progression.ts';
import {variantRewardXP,getVariant} from '../src/data/variants.ts';
import {BOSS_RULES,DIRECTOR_PHASES} from '../src/data/director.ts';
import {tierEncounterChance} from '../src/data/encounters.ts';
import {DESIGN} from '../src/data/config.ts';
import type {PsychicRing} from '../src/game/types.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
function arena(){const sim=new Simulation(7,914),s=sim.state;s.enemies=[];s.party[0].cooldown=1e6;return {sim,s};}
function bossArena(){const {sim,s}=arena();s.bossSpawned=true;s.phase='boss';s.stats.elapsed=900;s.player.iframes=1000;
 const boss=createEnemy(s,sim.rng,150,'legendary',10,0,true,true);boss.hp=boss.maxHp=1e8;boss.speed=0;boss.attackCooldown=0;s.enemies=[boss];return {sim,s,boss};}
function ring(uid:number,radius=6):PsychicRing{return {uid,sourceId:99,x:0,z:0,radius,previousRadius:radius,maxRadius:29,speed:7,width:1.1,damage:20,hit:new Set()};}

test('director advances the dramatic arc at every configured boundary with inspectable spawn weights',()=>{
 const {s}=arena();let budget=0;
 for(const phase of DIRECTOR_PHASES){s.stats.elapsed=phase.at;const snapshot=updateDirector(s);
  assert.equal(snapshot.phaseId,phase.id);assert.equal(snapshot.title,phase.title);assert.equal(snapshot.speciesTier,phase.tier);
  assert.ok(snapshot.spawnInterval>0);assert.ok(snapshot.enemyBudget<=DESIGN.maxEnemies);
  assert.equal(snapshot.variantWeights.legendary,undefined);assert.ok(Math.abs(Object.values(snapshot.variantWeights).reduce((a,b)=>a+b,0)-1)<1e-10);
  if(phase.at<900){assert.ok(snapshot.enemyBudget>=budget);budget=snapshot.enemyBudget;}
 }
 assert.equal(s.director!.transitions,5);
 s.stats.elapsed=884.99;assert.equal(updateDirector(s).bossWarning,false);
 s.stats.elapsed=885;assert.equal(updateDirector(s).bossWarning,true);assert.equal(s.director!.bossCountdown,15);
 assert.equal(s.director!.enemyBudget,118,'The final approach holds its budget until the actual boss phase');
});

test('ordinary pacing grows smoothly through phase boundaries with single arrivals',()=>{
 const {s}=arena();
 const opening=updateDirector(s);assert.equal(opening.spawnInterval,DESIGN.spawnStartInterval);assert.equal(opening.enemyBudget,18);
 assert.equal(opening.variantWeights.normal,1,'The run begins with ordinary weak enemies');
 for(const phase of DIRECTOR_PHASES.slice(1,-1)){
  s.stats.elapsed=phase.at-.001;const before=updateDirector(s);
  s.stats.elapsed=phase.at;const after=updateDirector(s);
  assert.ok(Math.abs(before.spawnInterval-after.spawnInterval)<.001,`${phase.id} should not create a burst of arrivals`);
  assert.equal(before.enemyBudget,after.enemyBudget);
 }
 let previousInterval=Infinity,previousBudget=0;
 for(let elapsed=0;elapsed<900;elapsed++){
  s.stats.elapsed=elapsed;const snapshot=updateDirector(s);
  assert.ok(snapshot.spawnInterval<=previousInterval);assert.ok(snapshot.enemyBudget>=previousBudget);
  assert.equal(snapshot.batchSize,1,'Later difficulty comes from stronger enemies and gradual arrivals');
  previousInterval=snapshot.spawnInterval;previousBudget=snapshot.enemyBudget;
 }
 assert.equal(previousInterval,DESIGN.spawnEndInterval);
 s.stats.elapsed=900;s.bossSpawned=true;const boss=updateDirector(s);
 assert.ok(boss.enemyBudget<previousBudget);assert.ok(boss.spawnInterval>previousInterval);
});

test('late pressure grows after the calm opening and minibosses remain spaced',()=>{
 const {s}=arena();
 s.stats.elapsed=0;assert.equal(updateDirector(s).spawnInterval,2.8);
 s.stats.elapsed=180;assert.equal(updateDirector(s).spawnInterval,1.8);
 s.stats.elapsed=420;assert.equal(updateDirector(s).spawnInterval,1.08);
 s.stats.elapsed=780;assert.equal(updateDirector(s).spawnInterval,.62);
 assert.equal(tierEncounterChance(3,359),0);
 assert.equal(tierEncounterChance(3,840),.07);
 assert.equal(tierEncounterChance(4,359),0);
});

test('runtime budget adaptation delays future arrivals without despawning or moving existing enemies',()=>{
 const {sim,s}=arena();s.stats.elapsed=780;const calm=updateDirector(s);
 for(let i=0;i<calm.enemyBudget;i++){const e=createEnemy(s,sim.rng,19,'normal',60+i*.01,0);e.speed=0;s.enemies.push(e);}
 const positions=s.enemies.map(e=>[e.uid,e.x,e.z]),crowded=updateDirector(s);
 assert.ok(crowded.spawnInterval>calm.spawnInterval);assert.equal(crowded.batchSize,1);
 s.player.hp=25;const pressured=updateDirector(s);assert.ok(pressured.enemyBudget<crowded.enemyBudget);assert.ok(pressured.spawnInterval>crowded.spawnInterval);
 assert.deepEqual(s.enemies.map(e=>[e.uid,e.x,e.z]),positions);
 sim.update(.04,idle);assert.equal(s.enemies.length,positions.length);
});

test('early director stays calm, accounts denied spawns and never accumulates a spawn flood',()=>{
 const {sim,s}=arena();s.player.iframes=10000;
 // Isolate spawn accounting from bombers spending themselves without kill rewards.
 for(let i=0;i<4500;i++){sim.update(.04,idle);for(const enemy of s.enemies)enemy.speciesId=19;}
 assert.ok(s.enemies.length<=s.director!.enemyBudget);assert.ok(s.enemies.length<50);assert.ok(s.director!.denied>0);
 assert.equal(s.director!.spawned,s.enemies.length);
 s.enemies=[];sim.update(.04,idle);assert.ok(s.enemies.length<=1);
});

test('legendary warning emits once, spawn is distant and simultaneous level-up resumes boss phase',()=>{
 const {sim,s}=arena(),events:GameEvent[]=[];sim.onEvent=event=>events.push(event);
 s.stats.elapsed=884.99;sim.update(.02,idle);sim.update(.02,idle);
 assert.equal(events.filter(event=>event.label?.includes('psychic presence')).length,1);
 s.stats.elapsed=899.99;sim.debugLevel();sim.update(.02,idle);
 const boss=s.enemies.find(enemy=>enemy.isBoss)!;assert.equal(boss.speciesId,150);
 assert.ok(Math.hypot(boss.x-s.player.x,boss.z-s.player.z)>=30);assert.equal(s.phase,'choice');
 assert.equal(boss.hp,(BOSS_RULES.baseHp+BOSS_RULES.hpPerLevel)*lateEnemyScale(s.stats.elapsed,150,5).health,'Boss endurance uses party level and the late enemy boost, not aggregate reward counts');
 sim.choose(s.upgradeChoices[0].id);assert.equal(s.phase,'boss');
});

test('Mewtwo cycles aimed volley, psychic ring, bounded summons and a committed Psyshock burst',()=>{
 const {sim,s,boss}=bossArena(),events:GameEvent[]=[];sim.onEvent=event=>events.push(event);
 sim.update(.02,idle);assert.equal(boss.windup?.kind,'volley');assert.equal(s.projectiles.length,0);
 const volley=structuredClone(boss.windup);s.player.z=5;
 for(let i=0;i<18;i++)sim.update(.04,idle);
 assert.equal(s.projectiles.filter(p=>!p.friendly).length,7);
 assert.ok(Math.abs(s.projectiles[3].vz)<1e-8,'Volley keeps the target snapshot');assert.equal(volley!.facing,-Math.PI/2);
 boss.attackCooldown=0;sim.update(.02,idle);assert.equal(boss.windup?.kind,'psychicRing');assert.equal(s.psychicRings!.length,0);
 for(let i=0;i<28;i++)sim.update(.04,idle);
 assert.equal(s.psychicRings!.length,1);const wave=s.psychicRings![0];assert.ok(wave.radius>1);assert.equal(wave.x,10);
 boss.attackCooldown=0;sim.update(.02,idle);assert.equal(boss.windup?.kind,'summon');
 const existing=new Set(s.enemies.map(enemy=>enemy.uid));
 for(let i=0;i<38;i++)sim.update(.04,idle);
 const adds=s.enemies.filter(enemy=>!existing.has(enemy.uid));assert.ok(adds.length>=BOSS_RULES.summonCount);
 for(const add of adds)assert.ok(Math.hypot(add.x-s.player.x,add.z-s.player.z)>20,'Summons arrive at a safe distance and move normally');
 assert.equal(boss.bossCycle,3);
 boss.attackCooldown=0;sim.update(.02,idle);assert.equal(boss.windup?.kind,'slam');assert.equal(boss.windup?.moveName,'Psyshock');
 assert.equal(boss.windup?.radius,BOSS_RULES.burstRadius);
 const snapshot={x:boss.windup!.x,z:boss.windup!.z};s.player.x+=20;
 for(let i=0;i<56;i++)sim.update(.02,idle);
 assert.equal(boss.bossCycle,0);
 const burst=events.find(event=>event.kind==='attack'&&event.label==='Psyshock');assert.ok(burst);assert.equal(burst.x,snapshot.x);assert.equal(burst.z,snapshot.z);
 assert.deepEqual(events.filter(event=>event.kind==='tell').slice(0,4).map(event=>event.shape),['volley','psychicRing','summon','slam']);
});

test('all boss windups are paused and can be interrupted with stun without executing the attack',()=>{
 for(const cycle of [0,1,2,3]){const {sim,s,boss}=bossArena();boss.bossCycle=cycle;sim.update(.02,idle);
  s.phase='paused';const before=structuredClone(s);sim.update(.04,{...idle,special:true});assert.deepEqual(s,before);
  s.phase='boss';boss.stunTime=.5;sim.update(.02,idle);assert.equal(boss.windup,undefined);
  assert.equal(s.projectiles.length,0);assert.equal(s.psychicRings!.length,0);assert.equal(s.enemies.length,1);
 }
});

test('psychic ring collision sweeps radial movement and supports jump, dodge and one hit per actor',()=>{
 assert.ok(movingRingIntersects({x:7,z:0},{x:3,z:0},{x:0,z:0},4,5,.4));
 assert.equal(movingRingIntersects({x:7,z:0},{x:8,z:0},{x:0,z:0},4,5,.4),false);
 for(const avoidance of ['none','jump','dodge'] as const){const {sim,s}=arena();s.player.x=6.3;s.psychicRings=[ring(500)];
  if(avoidance==='jump')s.player.y=2;if(avoidance==='dodge')s.player.iframes=.3;
  const hp=s.player.hp;sim.update(.04,idle);
  assert.equal(s.player.hp,hp-(avoidance==='none'?20-getBuildModifiers(s).armor:0));assert.ok(s.psychicRings[0].hit.has(1));
  const after=s.player.hp;sim.update(.04,idle);assert.equal(s.player.hp,after);
  s.phase='choice';const frozen=structuredClone(s.psychicRings);sim.update(.04,idle);assert.deepEqual(s.psychicRings,frozen);
 }
});

test('variant contact poison persists on followers and can faint them without bypassing recruit gates',()=>{
 const {sim,s}=arena();const follower={...s.party[0],uid:200,hp:20,x:-1,z:-1};s.party.push(follower);s.recruitCount=1;
 const enemy=createEnemy(s,sim.rng,19,'poisoned',-1,-1);enemy.uid=100;enemy.speed=0;enemy.damage=1;enemy.attackCooldown=0;s.enemies=[enemy];
 sim.update(.02,idle);assert.equal(follower.poisonTime??0,0);
 for(let i=0;i<6;i++)sim.update(.04,idle);
 assert.equal(follower.poisonTime,getVariant('poisoned').contactPoison!.seconds);
 s.enemies=[];follower.hp=.001;s.player.iframes=0;sim.update(.02,idle);
 assert.equal(s.party.length,1);assert.equal(s.stats.faints,1);assert.equal(s.recruitCount,1);assert.equal(canRecruit(s),false);
});

test('variant rewards split one exact XP total between instant and drop portions',()=>{
 const {sim,s}=arena();const enemy=createEnemy(s,sim.rng,19,'rocket',2,0);enemy.hp=1;enemy.speed=0;s.enemies=[enemy];
 const total=variantRewardXP(enemy);sim.update(.02,{...idle,special:true});
 assert.ok(Math.abs(s.stats.xp+s.drops.filter(drop=>drop.kind==='xp').reduce((sum,drop)=>sum+drop.value,0)-total)<1e-9);
});

test('boss defeat preserves complete party/build state into endless and clears hostile boss hazards',()=>{
 const {sim,s,boss}=bossArena();boss.hp=1;boss.x=2;s.player.hp=77;s.player.iframes=0;s.items=['echo-bell','wide-lens'];s.party[0].attackLevel=6;
 s.psychicRings=[ring(500)];
 sim.update(.02,{...idle,special:true});assert.equal(s.result,'victory');assert.equal(s.phase,'result');assert.equal(s.psychicRings!.length,0);
 const before=structuredClone({party:s.party,items:s.items,hp:s.player.hp});
 sim.continueEndless();assert.deepEqual({party:s.party,items:s.items,hp:s.player.hp},before);assert.equal(s.phase,'playing');assert.equal(s.director!.phaseId,'endless');
});

test('endless remains bounded beyond twenty minutes while late recruitment gates stay intact',()=>{
 const {sim,s}=arena();s.stats.bossKilled=true;s.bossSpawned=true;s.result='victory';s.stats.elapsed=900;sim.continueEndless();
 const early=updateDirector(s);s.stats.elapsed=1200;const late=updateDirector(s);
 assert.ok(late.endlessScale>early.endlessScale);assert.ok(late.spawnInterval<early.spawnInterval);assert.ok(late.enemyBudget<=DESIGN.maxEnemies);
 s.recruitCount=4;s.stats.level=29;s.stats.elapsed=1199;assert.equal(canRecruit(s),false);s.stats.elapsed=1200;assert.equal(canRecruit(s),true);
 s.player.iframes=1000;for(let i=0;i<1500;i++){if(s.phase==='choice')sim.choose(s.upgradeChoices[0].id);sim.update(.04,idle);assert.ok(s.enemies.length<=DESIGN.maxEnemies);assert.ok(Number.isFinite(s.player.x+s.stats.elapsed));}
 assert.ok(s.stats.elapsed>=1259.9);assert.equal(s.result,null);assert.equal(s.phase,'playing');
});
