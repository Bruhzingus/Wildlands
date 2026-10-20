import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {ATTACK_ANIMATION} from '../src/data/config.ts';
import {BOSS_RULES} from '../src/data/director.ts';
import {getEnemyAttackProfile} from '../src/data/enemyAttacks.ts';
const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};

function arena(){
 const sim=new Simulation(7,520),s=sim.state;
 s.enemies=[];s.party[0].cooldown=0;
 const foe=createEnemy(s,sim.rng,19,'normal',8,0);
 foe.speed=0;foe.hp=foe.maxHp=10000;s.enemies.push(foe);
 return {sim,s,foe,leader:s.party[0]};
}

test('party keeps attack aim while movement facing changes, then returns to movement',()=>{
 const {sim,s,leader}=arena();
 sim.update(.02,idle);
 assert.equal(leader.animation,'attack');assert.equal(leader.facing,Math.PI/2);
 const facing=leader.facing;
 for(let i=0;i<7;i++)sim.update(.04,{...idle,mz:-1});
 assert.equal(s.player.facing,Math.PI);assert.equal(leader.animation,'attack');
 assert.equal(leader.facing,facing);assert.ok(leader.attackTimer>0);
 sim.update(.04,{...idle,mz:-1});
 assert.equal(leader.animation,'walk');assert.equal(leader.attackTimer,0);
 assert.equal(leader.facing,s.player.facing);
});

test('follower attack aim is independent of leader and pauses with its timer',()=>{
 const {sim,s,leader}=arena();
 const follower={...leader,uid:s.idCounter++,x:-2,z:0,cooldown:0};s.party.push(follower);
 sim.update(.02,idle);assert.equal(follower.animation,'attack');
 const aim=follower.facing,timer=follower.attackTimer;
 s.phase='paused';sim.update(.04,{...idle,mz:-1});
 assert.equal(follower.attackTimer,timer);assert.equal(follower.facing,aim);
 s.phase='playing';sim.update(.04,{...idle,mz:-1});
 assert.equal(follower.facing,aim);assert.ok(follower.attackTimer<timer);
});

test('high attack speed completes each short pose before the next shot without slowing cadence',()=>{
 const {sim,s,leader}=arena();s.buffs.haste=10;
 sim.update(.02,idle);
 assert.equal(leader.cooldown,.2);
 assert.equal(leader.attackDuration,.2*ATTACK_ANIMATION.cadenceFraction);
 assert.equal(leader.attackTimer,leader.attackDuration);
 for(let i=0;i<19;i++)sim.update(.01,idle);
 assert.equal(leader.attackTimer,0);assert.notEqual(leader.animation,'attack');
 sim.update(.02,idle);assert.equal(leader.animation,'attack');
 assert.equal(leader.attackTimer,leader.attackDuration);
});

test('learned moves retain their own pose kind until recovery, then restore the primary move',()=>{
 const {sim,s,leader,foe}=arena();leader.speciesId=66;foe.x=3;leader.cooldown=10;
 leader.learnedMoves=[{moveId:'hyper-beam',rank:1,cooldown:0}];
 sim.update(.02,idle);
 assert.equal(leader.attackKind,'beam');assert.equal(leader.attackSpecial,undefined);
 assert.ok(s.projectiles.some(p=>p.moveName==='Hyper Beam'));
 const timer=leader.attackTimer;
 s.phase='choice';sim.update(.04,idle);
 assert.equal(leader.attackTimer,timer);assert.equal(leader.attackKind,'beam');
 s.phase='playing';for(let i=0;i<9;i++)sim.update(.04,idle);
 assert.equal(leader.attackTimer,0);assert.equal(leader.attackKind,undefined);
 leader.cooldown=0;sim.update(.02,idle);
 assert.equal(leader.attackKind,'slash');assert.equal(leader.animation,'attack');
});

test('overlapping learned and primary casts complete one motion without delaying independent attacks',()=>{
 const {sim,s,leader,foe}=arena();s.buffs.haste=10;
 leader.learnedMoves=[{moveId:'hyper-beam',rank:1,cooldown:0},{moveId:'swift',rank:1,cooldown:.1},{moveId:'water-pulse',rank:1,cooldown:.2}];
 let casts=0;sim.onEvent=event=>{if(event.kind==='cast'&&event.sourceId===leader.uid)casts++;};
 sim.update(.02,idle);
 const duration=leader.attackDuration!,facing=leader.facing;assert.equal(casts,2);
 assert.equal(leader.attackKind,'beam');
 foe.x=0;foe.z=8;
 for(let tick=1;tick<=12;tick++){
  sim.update(.02,idle);
  assert.ok(Math.abs(leader.attackTimer-(duration-tick*.02))<1e-10);
  assert.equal(leader.attackDuration,duration);assert.equal(leader.facing,facing);assert.equal(leader.attackKind,'beam');
 }
 assert.equal(casts,5,'All three learned attacks and two primary attacks fire on their own cooldowns');
 leader.cooldown=10;for(const learned of leader.learnedMoves)learned.cooldown=10;
 for(let i=0;i<5;i++)sim.update(.02,idle);
 assert.equal(leader.attackTimer,0);assert.notEqual(leader.animation,'attack');assert.equal(leader.attackKind,undefined);
});

test('Q starts its own special pose and automatic casts cannot reset it',()=>{
 const {sim,s,leader,foe}=arena();leader.speciesId=66;foe.x=3;
 sim.update(.02,idle);assert.equal(leader.attackKind,'slash');
 leader.learnedMoves=[{moveId:'hyper-beam',rank:1,cooldown:0}];leader.cooldown=0;
 sim.update(.02,{...idle,special:true});
 assert.equal(leader.attackSpecial,'flurry');assert.equal(leader.attackKind,undefined);
 assert.equal(leader.attackDuration,ATTACK_ANIMATION.specialSeconds);
 assert.ok(s.projectiles.some(p=>p.moveName==='Hyper Beam'),'The learned attack still fires during the special pose');
 const remaining=leader.attackTimer;leader.cooldown=0;
 sim.update(.04,idle);assert.ok(Math.abs(leader.attackTimer-(remaining-.04))<1e-10);
 assert.equal(leader.attackSpecial,'flurry');assert.equal(leader.attackKind,undefined);
 for(let i=0;i<10;i++)sim.update(.04,idle);
 assert.equal(leader.attackSpecial,undefined);assert.equal(leader.attackTimer,0);
});

test('a simultaneous slash effect retains its own aim while the body finishes an earlier cast',()=>{
 const {sim,leader,foe}=arena();leader.speciesId=123;leader.cooldown=10;
 leader.learnedMoves=[{moveId:'hyper-beam',rank:1,cooldown:0}];
 sim.update(.02,idle);
 const facing=leader.facing,events:{shape?:string;facing?:number}[]=[];
 sim.onEvent=event=>events.push(event);leader.cooldown=0;foe.x=0;foe.z=3;
 sim.update(.02,idle);
 assert.equal(leader.facing,facing);
 assert.equal(events.find(event=>event.shape==='slash')?.facing,0);
});

test('a learned beam acquires its current target while the body finishes an earlier melee cast',()=>{
 const {sim,s,leader,foe}=arena();leader.speciesId=123;foe.x=3;
 sim.update(.02,idle);assert.equal(leader.attackKind,'slash');
 const facing=leader.facing,timer=leader.attackTimer;
 leader.cooldown=10;leader.learnedMoves=[{moveId:'hyper-beam',rank:1,cooldown:0}];foe.x=0;foe.z=6;
 sim.update(.02,idle);
 assert.equal(leader.facing,facing);assert.equal(leader.attackKind,'slash');
 assert.ok(Math.abs(leader.attackTimer-(timer-.02))<1e-10);
 const beams=s.projectiles.filter(p=>p.moveName==='Hyper Beam');
 assert.equal(beams.length,1);assert.ok(beams[0].vz>0&&Math.abs(beams[0].vx)<1e-10);
});

test('enemy melee telegraphs before damage and keeps its release pose through recovery',()=>{
 const {sim,s,foe,leader}=arena();leader.cooldown=10;foe.x=1;foe.z=0;foe.attackCooldown=0;
 const profile=getEnemyAttackProfile(foe.speciesId);
 const hp=s.player.hp;
 sim.update(.02,idle);
 assert.equal(foe.animation,'attack');assert.equal(foe.facing,-Math.PI/2);
 assert.equal(foe.attackTimer,profile.windup);assert.equal(s.player.hp,hp);assert.equal(foe.windup?.moveName,'Quick Attack');
 for(let i=0;i<Math.ceil(profile.windup/.04);i++)sim.update(.04,idle);
 assert.ok(s.player.hp<hp);assert.equal(foe.windup,undefined);
 const after=s.player.hp;
 for(let i=0;i<9;i++)sim.update(.04,idle);
 assert.equal(foe.attackTimer,0);assert.equal(foe.animation,'idle');
 assert.equal(s.player.hp,after);assert.ok(foe.attackCooldown>0);
});

test('enemy facing and attacks follow the companion it is actually targeting',()=>{
 const {sim,s,leader,foe}=arena();leader.cooldown=10;
 const follower={...leader,uid:s.idCounter++,x:-1,z:-1,cooldown:10};s.party.push(follower);
 foe.uid=100;foe.x=-2;foe.z=-1;foe.attackCooldown=0;
 sim.update(.02,idle);
 assert.equal(foe.animation,'attack');
 const targetAngle=Math.atan2(follower.x-foe.x,follower.z-foe.z);
 assert.equal(foe.facing,targetAngle);assert.equal(follower.hp,follower.maxHp);
 for(let i=0;i<7;i++)sim.update(.04,idle);
 assert.ok(follower.hp<follower.maxHp);
});

test('boss volleys telegraph first, then keep seven shots and the special body pose',()=>{
 const {sim,s,leader,foe}=arena();leader.cooldown=10;
 foe.isBoss=true;foe.attackCooldown=0;
 sim.update(.02,idle);
 assert.equal(foe.animation,'attack');assert.equal(foe.windup?.kind,'volley');
 assert.equal(foe.attackDuration,foe.windup?.duration);
 assert.equal(s.projectiles.filter(p=>!p.friendly).length,0);
 for(let i=0;i<18;i++)sim.update(.04,idle);
 assert.equal(foe.windup,undefined);assert.equal(foe.attackDuration,ATTACK_ANIMATION.bossSeconds);
 assert.equal(s.projectiles.filter(p=>!p.friendly).length,7);
 assert.equal(foe.attackCooldown,BOSS_RULES.volleyCooldown);
 const aim=Math.atan2(foe.x-leader.x,foe.z-leader.z);
 sim.update(.02,{...idle,special:true});
 assert.equal(leader.animation,'attack');assert.equal(leader.attackDuration,ATTACK_ANIMATION.specialSeconds);
 assert.equal(leader.facing,aim);assert.ok(s.player.specialCooldown>0);
});
