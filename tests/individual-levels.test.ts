import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {xpThreshold} from '../src/game/systems/progression.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import type {PartyMember} from '../src/game/types.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
function arena(){
 const sim=new Simulation(25,721),s=sim.state;
 s.enemies=[];s.pois=[];s.player.iframes=10000;s.party[0].cooldown=10000;
 (sim as any).spawnAccum=-10000;
 return {sim,s};
}
function teammate(sim:Simulation):PartyMember {
 const s=sim.state,member={...s.party[0],uid:s.idCounter++,speciesId:7,level:1,xp:0,xpToNext:xpThreshold(1),learnedMoves:[]};
 s.party.push(member);return member;
}

test('shared XP is divided among living Pokémon and direct XP changes only its owner',()=>{
 const {sim,s}=arena(),follower=teammate(sim),dead={...follower,uid:s.idCounter++,hp:0};s.party.push(dead);
 sim.gainXP(60);
 assert.equal(s.party[0].xp,30);assert.equal(follower.xp,30);assert.equal(dead.xp,0);
 sim.gainXP(25,follower.uid);
 assert.equal(s.party[0].xp,30);assert.equal(follower.xp,55);assert.equal(s.stats.xp,30);
 sim.gainXP(Infinity);sim.gainXP(NaN);sim.gainXP(-100);sim.gainXP(40,dead.uid);
 assert.equal(follower.xp,55);assert.equal(dead.xp,0);
});

test('independent levels queue their own move rewards while combat remains paused',()=>{
 const {sim,s}=arena(),leader=s.party[0],follower=teammate(sim);
 sim.gainXP(xpThreshold(1)*2);sim.update(.04,idle);
 assert.equal(s.phase,'choice');assert.equal(leader.level,2);assert.equal(follower.level,2);
 assert.equal(s.levelUpMemberId,leader.uid);assert.deepEqual(s.pendingLevelUps,[follower.uid]);
 assert.ok(s.upgradeChoices.filter(choice=>choice.kind==='attack'||choice.kind==='learn').every(choice=>choice.speciesId===leader.uid));
 const before=s.stats.elapsed;sim.update(2,{...idle,jump:true});assert.equal(s.stats.elapsed,before);
 const upgrade=s.upgradeChoices.find(choice=>choice.kind==='attack'&&!choice.moveId)!;
 assert.equal(sim.choose(upgrade.id),true);assert.equal(leader.attackLevel,2);assert.equal(follower.attackLevel,1);
 assert.equal(s.phase,'choice');assert.equal(s.levelUpMemberId,follower.uid);
 const followerUpgrade=s.upgradeChoices.find(choice=>choice.kind==='attack'&&!choice.moveId)!;
 assert.equal(sim.choose(followerUpgrade.id),true);assert.equal(follower.attackLevel,2);assert.equal(s.phase,'playing');
 assert.equal(s.stats.level,3);assert.equal(s.levelUpMemberId,undefined);assert.deepEqual(s.pendingLevelUps,[]);
});

test('XP overflow earns each threshold once without losing XP or silently granting move ranks',()=>{
 const {sim,s}=arena(),leader=s.party[0];sim.gainXP(1500,leader.uid);sim.update(.04,idle);
 assert.equal(leader.attackLevel,1,'Leveling alone must not upgrade a move');
 let spent=0;
 while(s.phase==='choice'){
  const training=s.upgradeChoices.find(choice=>choice.kind==='stat')??s.upgradeChoices[0];
  assert.ok(sim.choose(training.id));assert.ok(++spent<20,'Finite XP must produce a finite reward sequence');
 }
 const spentXP=Array.from({length:leader.level-1},(_,index)=>xpThreshold(index+1)).reduce((sum,xp)=>sum+xp,0);
 close(spentXP+leader.xp!,1500);assert.equal(spent,leader.level-1);assert.equal(s.stats.xp,leader.xp);
 const earlyIncrease=xpThreshold(5)-xpThreshold(4),lateIncrease=xpThreshold(20)-xpThreshold(19);
 assert.ok(xpThreshold(1)>90);assert.ok(lateIncrease>earlyIncrease,'Later levels must require progressively larger XP increases');
});

test('cache selection keeps earned personal XP and opens the correct level reward afterwards',()=>{
 const {sim,s}=arena(),follower=teammate(sim);
 const item={id:'frost-charm',kind:'item' as const,title:'Icy Rock',description:'',rarity:'common' as const};
 sim.enterChoice([item],'Treasure cache: choose an item');sim.gainXP(xpThreshold(1),follower.uid);
 assert.equal(s.levelUpMemberId,undefined);assert.equal(sim.choose(item.id),true);
 assert.equal(s.levelUpMemberId,follower.uid);assert.equal(s.phase,'choice');assert.ok(s.items.includes(item.id));
 assert.ok(s.upgradeChoices.filter(choice=>choice.speciesId!==undefined).every(choice=>choice.speciesId===follower.uid));
 assert.equal(s.party[0].level,1);assert.equal(follower.level,2);
});

test('percentage defense and recovery scale with actual HP and incoming damage',()=>{
 const {sim,s}=arena(),follower=teammate(sim);s.buffs.damageReduction=.24;
 s.player.hp=s.player.maxHp=1000;s.player.iframes=0;
 (sim as any).hurtPlayer(100,false);close(s.player.hp,924);
 follower.hp=follower.maxHp=2000;follower.iframes=0;(sim as any).hurtCompanion(follower,100);close(follower.hp,1924);
 s.items=['leftovers'];s.player.hp=500;follower.hp=1000;
 (sim as any).updateRegeneration(1);close(s.player.hp,508);close(follower.hp,1016);
 s.items=['rescue-ribbon'];s.player.hp=500;follower.hp=1000;
 (sim as any).buildEvent({kind:'onSpecial',sourceId:s.party[0].uid});close(s.player.hp,620);close(follower.hp,1240);
 s.challenge='famine';(sim as any).updateRegeneration(1);close(s.player.hp,620);
});

test('a learned move upgrade increases real projectile damage and shortens its independent cooldown',()=>{
 const {sim,s}=arena(),leader=s.party[0];(sim.rng as any).next=()=>1;
 s.enemies=[createEnemy(s,sim.rng,19,'normal',3,0)];
 leader.learnedMoves=[{moveId:'swift',rank:1,cooldown:0}];
 (sim as any).updateLearnedMoves(leader,.04);
 const firstDamage=s.projectiles[0].damage,firstCooldown=leader.learnedMoves[0].cooldown;
 s.projectiles=[];leader.learnedMoves[0].rank=2;leader.learnedMoves[0].cooldown=0;
 (sim as any).updateLearnedMoves(leader,.04);
 close(s.projectiles[0].damage/firstDamage,1.2);assert.ok(leader.learnedMoves[0].cooldown<firstCooldown);
});
