import test from 'node:test';
import assert from 'node:assert/strict';
import {KANTO} from '../src/data/kanto.ts';
import {ENEMY_ATTACK_PROFILES,getEnemyAttackProfile} from '../src/data/enemyAttacks.ts';
import {Simulation,type GameEvent} from '../src/game/Simulation.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {enemyMovementIntent} from '../src/game/combat/enemies.ts';
import {addProjectile,stepProjectiles} from '../src/game/combat/projectiles.ts';
import type {Enemy} from '../src/game/types.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
function arena(speciesId:number,x:number,z=0){
 const sim=new Simulation(7,414),s=sim.state;
 s.enemies=[];s.pois=[];s.party[0].cooldown=1000;
 const enemy=createEnemy(s,sim.rng,speciesId,'normal',x,z);
 Object.assign(enemy,{speed:0,attackCooldown:0,hp:10000,maxHp:10000});s.enemies=[enemy];
 const events:GameEvent[]=[];sim.onEvent=e=>events.push(e);
 return {sim,s,enemy,events};
}
function release(sim:Simulation,enemy:Enemy){
 sim.update(.01,idle);assert.ok(enemy.windup);
 const windup=enemy.windup!;for(let i=0;i<=Math.ceil(windup.duration/.02);i++)sim.update(.02,idle);
}

test('all 151 species have one explicit, named attack in one of seven battlefield roles',()=>{
 assert.equal(ENEMY_ATTACK_PROFILES.length,151);
 const roles=new Set<string>();
 for(const species of KANTO){
  const profile=getEnemyAttackProfile(species.id);roles.add(profile.role);
  assert.equal(profile.speciesId,species.id);assert.ok(profile.moveName.length>2);
  assert.ok(profile.windup>0&&profile.cooldown>0&&profile.range>0);
 }
 assert.equal(roles.size,7);
 assert.equal(getEnemyAttackProfile(100).moveName,'Self-Destruct');
 assert.equal(getEnemyAttackProfile(102).moveName,'Egg Bomb');
 assert.equal(getEnemyAttackProfile(113).moveName,'Soft-Boiled');
});

test('fast and heavy melee commit to a visible direction and can be sidestepped',()=>{
 for(const species of [19,20]){
  const {sim,s,enemy,events}=arena(species,1.5);
  sim.update(.01,idle);assert.equal(s.player.hp,s.player.maxHp);
  assert.equal(enemy.windup?.kind,'enemyMove');assert.equal(events[0].label,getEnemyAttackProfile(species).moveName);
  const windup=structuredClone(enemy.windup);s.phase='paused';sim.update(.04,idle);assert.deepEqual(enemy.windup,windup);
  s.phase='playing';s.player.x=5;
  for(let i=0;i<=Math.ceil(windup!.duration/.02);i++)sim.update(.02,idle);
  assert.equal(s.player.hp,s.player.maxHp,'Escaping behind the committed strike avoids damage');
  assert.equal(enemy.windup,undefined);
 }
});

test('stunning a charging enemy cancels the move without damage or projectiles',()=>{
 for(const species of [19,20,25,26,100,102]){
  const {sim,s,enemy}=arena(species,2);
  sim.update(.01,idle);assert.ok(enemy.windup);enemy.stunTime=.5;sim.update(.01,idle);
  assert.equal(enemy.windup,undefined);assert.equal(s.player.hp,s.player.maxHp);
  assert.equal(s.projectiles.length,0);assert.equal(enemy.dead,false);
 }
});

test('burst and slow-projectile roles release different physical shots along the committed aim',()=>{
 for(const [species,count,silhouette] of [[25,3,'needle'],[26,1,'orb']] as const){
  const {sim,s,enemy}=arena(species,12);s.player.iframes=100;
  release(sim,enemy);
  const shots=s.projectiles.filter(p=>!p.friendly);assert.equal(shots.length,count);
  assert.ok(shots.every(p=>p.silhouette===silhouette&&p.vx<0));
  const first=shots[0],velocity={x:first.vx,z:first.vz};s.player.z=20;sim.update(.02,idle);
  assert.equal(first.vx,velocity.x);assert.equal(first.vz,velocity.z);
  assert.ok(shots.every(p=>p.moveName===getEnemyAttackProfile(species).moveName));
 }
});

test('ranged enemies hold distance while melee closes and healers seek wounded allies',()=>{
 const {s,enemy}=arena(25,7),target=s.player;
 assert.equal(enemyMovementIntent(enemy,target,s).speedScale,0);
 enemy.x=3;assert.ok(enemyMovementIntent(enemy,target,s).x>0,'Ranged retreats when approached');
 enemy.speciesId=19;assert.ok(enemyMovementIntent(enemy,target,s).x<0,'Melee advances');
 enemy.speciesId=113;enemy.x=15;
 const wounded=createEnemy(s,new Simulation(7,1).rng,19,'normal',25,0);wounded.hp=1;s.enemies.push(wounded);
 assert.ok(enemyMovementIntent(enemy,target,s).x>0,'Healer approaches the wounded ally');
});

test('self-destruct waits for its fuse, removes the bomber and awards no kill or XP',()=>{
 const {sim,s,enemy}=arena(100,2);
 sim.update(.01,idle);assert.equal(enemy.dead,false);assert.equal(s.player.hp,s.player.maxHp);
 for(let i=0;i<50;i++)sim.update(.02,idle);
 assert.equal(enemy.dead,true);assert.ok(s.player.hp<s.player.maxHp);
 assert.equal(s.stats.kills,0);assert.equal(s.stats.xp,0);assert.equal(s.drops.length,0);
 assert.ok(!s.enemies.includes(enemy));
});

test('slow bombs land at the marked snapshot, damaging only actors within the explosion',()=>{
 const {sim,s,enemy}=arena(102,10);s.player.iframes=100;
 release(sim,enemy);const bomb=s.projectiles.find(p=>!p.friendly&&p.kind==='lob')!;
 assert.ok(bomb);assert.equal(bomb.blastX,0);assert.equal(bomb.blastZ,0);assert.ok(bomb.ttl>1);
 const impacts:number[]=[],blasts:number[]=[];
 s.player.x=6;s.player.z=0;
 for(let i=0;i<150&&s.projectiles.length;i++)stepProjectiles(s,.02,{hit:()=>assert.fail(),hurtPlayer:damage=>impacts.push(damage),explode:p=>blasts.push(p.x)});
 assert.deepEqual(impacts,[]);assert.deepEqual(blasts,[0]);
 addProjectile(s,{...bomb,x:0,z:0,vx:0,vz:0,ttl:.01});s.player.x=0;
 stepProjectiles(s,.02,{hit:()=>assert.fail(),hurtPlayer:damage=>impacts.push(damage)});
 assert.equal(impacts.length,1);
});

test('hostile shots hit followers physically without damaging enemy allies',()=>{
 const {s,enemy}=arena(25,10);s.player.x=50;
 const follower={...s.party[0],uid:200,x:2,z:0};s.party.push(follower);
 addProjectile(s,{x:0,z:0,vx:20,vz:0,ttl:1,damage:10,size:.2,kind:'bolt',type:'electric',penetration:0,friendly:false,sourceId:enemy.uid,poisonChance:0});
 let followerHits=0;
 stepProjectiles(s,.2,{hit:()=>assert.fail(),hurtPlayer:()=>assert.fail(),hurtCompanion:member=>{assert.equal(member.uid,200);followerHits++;}});
 assert.equal(followerHits,1);assert.equal(enemy.hp,enemy.maxHp);assert.equal(s.projectiles.length,0);
});

test('poisoned ranged variants retain their poison and faction aggression affects recovery',()=>{
 const {sim,s,enemy}=arena(26,10);enemy.variant='poisoned';
 release(sim,enemy);const shot=s.projectiles[0];assert.equal(shot.type,'electric');assert.equal(shot.poisonChance,1);
 s.player.x=shot.x;s.player.z=shot.z;
 let poisoned=false;stepProjectiles(s,.01,{hit:()=>assert.fail(),hurtPlayer:(_damage,poison)=>{poisoned=poison;}});assert.equal(poisoned,true);
 const wild=arena(19,1.5),rabid=arena(19,1.5);rabid.enemy.variant='rabid';
 release(wild.sim,wild.enemy);release(rabid.sim,rabid.enemy);
 assert.ok(rabid.enemy.attackCooldown<wild.enemy.attackCooldown);
});

test('healers restore nearby wounded enemy allies without healing themselves or attacking the player',()=>{
 const {sim,s,enemy}=arena(113,7),ally=createEnemy(s,sim.rng,19,'normal',9,0);
 ally.hp=1;ally.attackCooldown=100;ally.speed=0;s.enemies.push(ally);s.player.hp=50;
 release(sim,enemy);
 assert.ok(ally.hp>1&&ally.hp<=ally.maxHp);assert.equal(s.player.hp,50);assert.equal(s.projectiles.length,0);
 assert.equal(enemy.hp,enemy.maxHp);
});

test('healers use Quick Attack when no nearby injured ally needs support',()=>{
 const {sim,s,enemy,events}=arena(113,1.5);s.player.hp=100;
 release(sim,enemy);
 assert.ok(s.player.hp<100,'The healer falls back to a close-range attack');
 assert.equal(events[0].label,'Quick Attack');
 assert.equal(events[0].shape,'melee-fast');
});

test('healers do not cast a heal for only their own missing HP',()=>{
 const {sim,s,enemy,events}=arena(113,1.5);enemy.hp=1;s.player.hp=100;
 release(sim,enemy);
 assert.ok(s.player.hp<100);
 assert.equal(enemy.hp,1);
 assert.equal(events[0].label,'Quick Attack');
});

test('elite guardians alternate an elemental area move and their own named role move',()=>{
 const {sim,enemy}=arena(26,6);enemy.elite=true;
 sim.update(.01,idle);assert.equal(enemy.windup?.moveName,'Discharge');
 for(let i=0;i<34;i++)sim.update(.02,idle);assert.equal(enemy.bossCycle,1);
 enemy.attackCooldown=0;sim.update(.01,idle);assert.equal(enemy.windup?.kind,'enemyMove');assert.equal(enemy.windup?.moveName,'Thunderbolt');
 for(let i=0;i<33;i++)sim.update(.02,idle);
 enemy.attackCooldown=0;sim.update(.01,idle);assert.equal(enemy.windup?.kind,'slam');
});

test('a shrine spawns a durable guardian and grants its blessing only after defeat',()=>{
 const sim=new Simulation(7,414),s=sim.state,shrine=s.pois.find(p=>p.kind==='shrine')!;
 s.pois=[shrine];s.enemies=[];s.party[0].cooldown=100;s.player.x=shrine.x;s.player.z=shrine.z;s.player.specialCooldown=10;
 sim.update(.01,{...idle,interact:true});
 const guardian=s.enemies.find(e=>e.shrineGuardian)!;assert.ok(guardian);assert.ok(guardian.maxHp>=500);assert.equal(shrine.used,true);
 assert.ok((s.buffs.luck??0)<.04,'The guardian reward is withheld during the fight');
 const luck=s.buffs.luck??0;guardian.hp=.001;guardian.poisonTime=1;s.player.specialCooldown=10;
 sim.update(.01,idle);assert.equal(guardian.dead,true);assert.ok(Math.abs((s.buffs.luck??0)-luck-.04)<1e-9);assert.equal(s.player.specialCooldown,0);
});
