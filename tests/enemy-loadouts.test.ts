import test from 'node:test';
import assert from 'node:assert/strict';
import {KANTO,getSpecies} from '../src/data/kanto.ts';
import {ENEMY_MOVE_PROFILES,getEnemyAttackLoadout,resolveCommittedEnemyProfile} from '../src/data/enemyAttacks.ts';
import {getEnemyTier,speciesEnemyTier} from '../src/data/enemyTiers.ts';
import {Simulation,type GameEvent} from '../src/game/Simulation.ts';
import {chooseEnemyAttack,enemyMovementIntent,prepareEnemyMove,resolveEnemyMove,type EnemyMoveHooks} from '../src/game/combat/enemies.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import type {Enemy,Variant} from '../src/game/types.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
const identity=(speciesId:number,variant:Variant='normal')=>({speciesId,variant,isBoss:false});
function arena(variant:Variant='normal',elapsed=600){
 const sim=new Simulation(7,414),s=sim.state;
 s.enemies=[];s.pois=[];s.stats.elapsed=elapsed;s.party[0].cooldown=10000;sim.spawnAccum=-1000;
 const enemy=createEnemy(s,sim.rng,149,variant,2,0);
 Object.assign(enemy,{speed:0,attackCooldown:0,hp:100000,maxHp:100000,elite:false});s.enemies=[enemy];
 s.player.hp=s.player.maxHp=100000;
 const events:GameEvent[]=[];sim.onEvent=event=>events.push(event);
 return {sim,s,enemy,events};
}
function releaseNext(sim:Simulation,enemy:Enemy){
 enemy.attackCooldown=0;sim.update(.01,idle);assert.equal(enemy.windup?.kind,'enemyMove');
 const name=enemy.windup!.moveName;
 for(let step=0;enemy.windup&&step<100;step++)sim.update(.02,idle);
 assert.equal(enemy.windup,undefined);return name;
}

test('tier one/two keep one move and every tier three has two distinct authored attacks',()=>{
 for(const species of KANTO){
  const tier=speciesEnemyTier(species.id),moves=getEnemyAttackLoadout(identity(species.id),1200);
  assert.equal(moves.length,tier<=2?1:tier===3?2:4,`${species.name} respects its tier budget`);
  assert.equal(new Set(moves.map(move=>move.moveName)).size,moves.length);
  if(tier===3){
   assert.notEqual(moves[0].role,moves[1].role,`${species.name} has distinct battlefield attacks`);
   assert.ok(moves.every(move=>move.role!=='explosive-suicide'),`${species.name} survives its own miniboss cycle`);
  }
  for(const move of moves)assert.ok(ENEMY_MOVE_PROFILES.includes(move));
 }
});

test('tier four repertoire grows with elapsed time and very hard shrines can unlock its full budget',()=>{
 const dragonite=identity(149,'rocket');
 assert.equal(getEnemyAttackLoadout(dragonite,780).length,2);
 assert.equal(getEnemyAttackLoadout(dragonite,840).length,3);
 assert.equal(getEnemyAttackLoadout(dragonite,1080).length,4);
 assert.equal(getEnemyAttackLoadout({...dragonite,hardShrine:true},300).length,4);
 assert.equal(getEnemyAttackLoadout({...identity(3,'dark'),hardShrine:true},300).length,2,'Weaker tier-four species retain their lower attack budget');
 assert.equal(getEnemyAttackLoadout(identity(149),1200).length,2,'A normal tier-three remains a two-move miniboss');
 assert.equal(getEnemyAttackLoadout(identity(144),890).length,3,'Late legendary birds have three attacks');
 assert.equal(getEnemyAttackLoadout(identity(19,'rocket'),1200).length,1,'A variant does not promote a weak species to a miniboss');
});

test('variants unlock the same authored species moves without changing species typing',()=>{
 const species=getSpecies(149),types=[...species.types];
 for(const variant of ['normal','dark','rocket','rabid','poisoned'] as const){
  const moves=getEnemyAttackLoadout({...identity(149,variant),hardShrine:true},1200);
  assert.equal(getEnemyTier(149,variant),variant==='normal'?3:4);
  assert.deepEqual(moves.map(move=>move.moveName),['Dragon Rush','Dragon Pulse','Hurricane','Hyper Beam'].slice(0,variant==='normal'?2:4));
  assert.ok(moves.every(move=>move.speciesId===149));
  assert.deepEqual(species.types,types);
 }
});

test('a tier-three Dragonite actually alternates committed melee and projectile releases',()=>{
 const {sim,s,enemy,events}=arena();
 assert.equal(releaseNext(sim,enemy),'Dragon Rush');
 assert.ok(s.player.hp<s.player.maxHp);
 enemy.x=10;
 assert.equal(releaseNext(sim,enemy),'Dragon Pulse');
 assert.ok(s.projectiles.some(shot=>!shot.friendly&&shot.moveName==='Dragon Pulse'));
 enemy.x=2;
 assert.equal(releaseNext(sim,enemy),'Dragon Rush');
 assert.deepEqual(events.filter(event=>event.kind==='tell').map(event=>event.label),['Dragon Rush','Dragon Pulse','Dragon Rush']);
});

test('a very hard Rocket Dragonite releases four bounded attacks in sequence',()=>{
 const {sim,s,enemy,events}=arena('rocket',600);enemy.hardShrine=true;
 const names=Array.from({length:4},(_,index)=>{enemy.x=index===0?2:10;return releaseNext(sim,enemy);});
 assert.deepEqual(names,['Dragon Rush','Dragon Pulse','Hurricane','Hyper Beam']);
 assert.equal(events.filter(event=>event.kind==='tell').length,4);
 assert.ok(events.some(event=>event.kind==='attack'&&event.label==='Hurricane'&&event.shape==='throw'));
 assert.ok(events.some(event=>event.kind==='attack'&&event.label==='Hyper Beam'&&event.shape==='muzzle'));
 assert.ok(s.projectiles.filter(shot=>!shot.friendly).length<=3,'Each move releases at most its own bounded projectile budget');
 assert.ok(!enemy.dead);
});

test('a selected melee move approaches even when the primary move is ranged',()=>{
 const {s,enemy}=arena();enemy.speciesId=6;enemy.attackIndex=1;enemy.x=8;
 const profile=chooseEnemyAttack(enemy,s);assert.equal(profile.moveName,'Dragon Claw');
 assert.ok(enemyMovementIntent(enemy,s.player,s).x<0,'A ranged-primary species closes for its selected melee move');
});

test('pause and stun preserve the selected slot until an attack actually releases',()=>{
 const {sim,s,enemy}=arena();enemy.attackIndex=1;
 sim.update(.01,idle);assert.equal(enemy.windup?.moveName,'Dragon Pulse');
 const windup=structuredClone(enemy.windup);s.phase='paused';sim.update(.04,idle);
 assert.deepEqual(enemy.windup,windup);assert.equal(enemy.attackIndex,1);assert.equal(s.projectiles.length,0);
 s.phase='playing';enemy.stunTime=.5;sim.update(.01,idle);
 assert.equal(enemy.windup,undefined);assert.equal(enemy.attackIndex,1);assert.equal(s.projectiles.length,0);
 enemy.stunTime=0;
 assert.equal(releaseNext(sim,enemy),'Dragon Pulse');assert.notEqual(enemy.attackIndex,1);
});

test('a committed advanced move keeps its name, element and projectile budget if the encounter cap changes',()=>{
 const {s,enemy}=arena('rocket',1100);enemy.attackIndex=3;
 const profile=chooseEnemyAttack(enemy,s),windup=prepareEnemyMove(enemy,s.player,profile);
 assert.equal(profile.moveName,'Hyper Beam');
 enemy.variant='normal';s.stats.elapsed=500;
 const restored=resolveCommittedEnemyProfile(enemy,windup,s.stats.elapsed);
 assert.equal(restored.moveName,'Hyper Beam');assert.equal(restored.element,'normal');assert.equal(restored.windup,1.15);
 const shots:Parameters<EnemyMoveHooks['projectile']>[0][]=[];
 const hooks:EnemyMoveHooks={animate:()=>{},projectile:shot=>shots.push(shot),hurtPlayer:()=>{},hurtCompanion:()=>{},visual:()=>{},suicide:()=>assert.fail()};
 resolveEnemyMove(enemy,windup,s,hooks);
 assert.equal(shots.length,1);assert.equal(shots[0].moveName,'Hyper Beam');assert.equal(shots[0].type,'normal');
});

test('an unlabelled restored windup resolves the correct slot after multiple complete rotations',()=>{
 const {s,enemy}=arena();enemy.attackIndex=5;
 const profile=chooseEnemyAttack(enemy,s);
 const restored=resolveCommittedEnemyProfile(enemy,{moveIndex:enemy.attackIndex},s.stats.elapsed);
 assert.equal(profile.moveName,'Dragon Pulse');assert.equal(restored.moveName,profile.moveName);
});
