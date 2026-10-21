import test from 'node:test';
import assert from 'node:assert/strict';
import {ECONOMY,chestCost} from '../src/data/economy.ts';
import {DESIGN} from '../src/data/config.ts';
import {ITEMS} from '../src/data/items.ts';
import {TRAINING_UPGRADES} from '../src/data/progression.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {createEnemy,createGuardian} from '../src/game/systems/spawning.ts';
import {xpThreshold} from '../src/game/systems/progression.ts';
import type {POI} from '../src/game/types.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
function arena(){
 const sim=new Simulation(7,194),s=sim.state;s.enemies=[];s.pois=[];s.recruitCount=5;s.player.iframes=10000;
 (sim as any).spawnAccum=-10000;s.party[0].cooldown=10000;return {sim,s};
}
const chest=(uid=301):POI=>({uid,x:0,z:0,kind:'cache',used:false,price:ECONOMY.chestBaseCost});

test('enemy coins and rare items are real pickups that collect without opening an upgrade menu',()=>{
 const {sim,s}=arena();(sim as any).lootRng.next=()=>0;
 const enemy=createEnemy(s,sim.rng,19,'normal',2,0);s.enemies=[enemy];
 (sim as any).damageEnemy(enemy,10000,'normal',s.party[0].uid);
 assert.equal(s.coins,0);assert.equal(s.items.length,0);
 assert.ok(s.drops.some(drop=>drop.kind==='coin'));assert.ok(s.drops.some(drop=>drop.kind==='item'&&drop.itemId));
 sim.update(.04,idle);
 assert.equal(s.coins,ECONOMY.normalCoins);assert.equal(s.items.length,1);assert.equal(s.phase,'playing');
 assert.equal(s.drops.length,0);
});

test('paid chests reject insufficient coins, charge once, and preserve queued Pokémon milestones',()=>{
 const {sim,s}=arena(),poi=chest();s.pois=[poi];
 sim.update(.04,{...idle,interact:true});assert.equal(s.phase,'playing');assert.equal(poi.used,false);assert.equal(s.coins,0);
 sim.update(.04,idle);s.coins=45;sim.update(.04,{...idle,interact:true});
 assert.equal(s.phase,'choice');assert.equal(s.choiceSource,'shop');assert.equal(poi.used,true);assert.equal(s.coins,0);
 assert.equal(s.chestPurchases,1);assert.equal(chestCost(s,chest(302)),45);assert.equal(chestCost(s,poi),60);
 assert.ok(s.upgradeChoices.length>0&&s.upgradeChoices.every(choice=>choice.kind==='stat'||choice.kind==='item'));
 sim.gainXP(xpThreshold(1)+xpThreshold(2));assert.ok(sim.choose(s.upgradeChoices[0].id));
 assert.equal(s.phase,'choice');assert.equal(s.choiceSource,'level');assert.equal(s.levelUpMemberId,1);assert.equal(s.party[0].level,3);
 assert.equal(sim.choose(s.upgradeChoices.find(choice=>choice.kind==='attack')!.id),true);
 sim.update(.04,idle);sim.update(.04,{...idle,interact:true});assert.equal(s.coins,0);assert.equal(s.chestPurchases,1);
});

test('paid chests keep offering training after collecting every relic',()=>{
 const {sim,s}=arena(),poi=chest();s.pois=[poi];s.coins=100;s.items=ITEMS.map(item=>item.id);s.itemUnlocks=[];
 for(const training of TRAINING_UPGRADES)s.buffs[training.stat]=training.amount*30;
 sim.update(.04,{...idle,interact:true});assert.equal(s.coins,55);assert.equal(poi.used,true);assert.equal(s.phase,'choice');
 assert.equal(s.upgradeChoices.length,3);assert.ok(s.upgradeChoices.every(choice=>choice.kind==='stat'));
 assert.equal(sim.choose(s.upgradeChoices[0].id),true);
});

test('elite rewards train the squad separately and cannot consume an earned personal milestone',()=>{
 const {sim,s}=arena();s.stats.elapsed=200;
 const elite=createGuardian(s,sim.rng,26,8,0,true);s.enemies=[elite];
 (sim as any).damageEnemy(elite,100000,'normal',1);
 sim.update(.04,idle);assert.equal(s.choiceSource,'squad');assert.equal(s.phase,'choice');
 assert.ok(s.upgradeChoices.every(choice=>choice.kind==='stat'));assert.equal(s.levelUpMemberId,undefined);
 sim.gainXP(xpThreshold(1)+xpThreshold(2));sim.choose(s.upgradeChoices[0].id);
 assert.equal(s.choiceSource,'level');assert.equal(s.levelUpMemberId,1);
 assert.ok(s.upgradeChoices.some(choice=>choice.kind==='attack'));assert.ok(s.upgradeChoices.some(choice=>choice.kind==='stat'));
});

test('drop budgets retain XP and coins and repeat gear adds a stored copy',()=>{
 const {sim,s}=arena();
 for(let i=0;i<DESIGN.maxActiveDrops;i++)s.drops.push({uid:s.idCounter++,x:90,z:90,kind:'xp',value:2,age:0});
 (sim as any).spawnDrop({x:0,z:0,kind:'xp',value:5});assert.equal(s.party[0].xp,5);
 (sim as any).spawnDrop({x:0,z:0,kind:'coin',value:3});assert.equal(s.coins,3);assert.equal(s.drops.length,DESIGN.maxActiveDrops);
 s.items.push('leftovers');(sim as any).collectItem('leftovers');assert.equal(s.coins,3);
 assert.equal(s.items.filter(id=>id==='leftovers').length,1);assert.equal(s.itemStacks?.leftovers,2);
});

test('enemy item drops respect the run’s unlocked item pool and normal elite reward cooldown',()=>{
 const {sim,s}=arena();s.itemUnlocks=[];(sim as any).lootRng.next=()=>0;
 for(let i=0;i<2;i++){
  const enemy=createEnemy(s,sim.rng,19,'normal',8,0,true);s.enemies.push(enemy);(sim as any).damageEnemy(enemy,100000,'normal',1);
 }
 assert.ok(s.drops.every(drop=>drop.kind!=='item'));assert.equal(s.pendingSquadRewards,1);
 s.stats.elapsed=ECONOMY.eliteRewardInterval;
 const enemy=createEnemy(s,sim.rng,19,'normal',8,0,true);s.enemies.push(enemy);(sim as any).damageEnemy(enemy,100000,'normal',1);
 assert.equal(s.pendingSquadRewards,2);
});
