import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {availableItemChoices,makeChoices,rerollChoices} from '../src/game/systems/progression.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};

test('runs start with two rerolls and earn one at each five-minute boundary',()=>{
 const sim=new Simulation(1,511),s=sim.state;
 assert.equal(s.rerolls,2);
 sim.debugAdvance(299.98);assert.equal(s.rerolls,2);
 s.phase='paused';sim.update(.04,idle);assert.equal(s.stats.elapsed,299.98);
 s.phase='choice';sim.update(.04,idle);assert.equal(s.rerolls,2);
 s.phase='playing';sim.update(.04,idle);assert.equal(s.rerolls,3);
 sim.debugAdvance(600);assert.equal(s.rerolls,5);
 sim.update(.04,idle);assert.equal(s.rerolls,5);
});

test('rerolls replace all cards, preserve rarity slots, and consume exactly one charge',()=>{
 for(let seed=1;seed<=30;seed++){
  const sim=new Simulation(1,seed),s=sim.state;
  sim.enterChoice(makeChoices(s,sim.rng,'squad'),undefined,'squad');
  const before=s.upgradeChoices,title=s.choiceTitle;
  s.pendingLevelUps=[1];s.levelUpMemberId=1;s.coins=70;
  assert.equal(sim.reroll(),true);
  assert.deepEqual(s.upgradeChoices.map(c=>c.rarity),before.map(c=>c.rarity));
  assert.ok(s.upgradeChoices.every(c=>!before.some(old=>old.id===c.id||old.stat===c.stat)));
  assert.equal(new Set(s.upgradeChoices.map(c=>c.stat)).size,3);
  assert.equal(s.rerolls,1);assert.equal(s.phase,'choice');assert.equal(s.choiceTitle,title);
  assert.deepEqual(s.pendingLevelUps,[1]);assert.equal(s.levelUpMemberId,1);assert.equal(s.coins,70);
  assert.equal(sim.reroll(),true);assert.equal(s.rerolls,0);
  const final=s.upgradeChoices;
  assert.equal(sim.reroll(),false);assert.equal(s.upgradeChoices,final);
 }
});

test('item rerolls exclude every old item and retain their original rarity',()=>{
 const sim=new Simulation(1,152),s=sim.state;
 const rare=availableItemChoices(s).filter(c=>c.rarity==='rare').slice(0,3);
 assert.equal(rare.length,3);sim.enterChoice(rare,undefined,'cache');
 assert.equal(sim.reroll(),true);
 assert.ok(s.upgradeChoices.every(c=>c.kind==='item'&&c.rarity==='rare'&&!rare.some(old=>old.id===c.id)));
 assert.equal(new Set(s.upgradeChoices.map(c=>c.id)).size,3);
});

test('a cache with the only Uncommon relic can reroll by upgrading its rarity',()=>{
 const sim=new Simulation(1,153),s=sim.state;
 const ids=['razor-claw','toxic-barb','magnet-stone'];
 const offers=availableItemChoices(s);
 const old=ids.map(id=>offers.find(choice=>choice.id===id)!);
 assert.ok(old.every(Boolean));sim.enterChoice(old,undefined,'cache');
 const before=structuredClone(s),available=rerollChoices(s);
 assert.ok(available);assert.deepEqual(s,before,'Availability check must leave state untouched');
 assert.equal(sim.reroll(),true);assert.equal(s.rerolls,1);
 assert.equal(s.upgradeChoices.length,3);
 const rank={common:0,uncommon:1,rare:2,epic:3,legendary:4};
 for(const [index,choice] of s.upgradeChoices.entries()){
  assert.equal(choice.kind,'item');assert.ok(rank[choice.rarity]>=rank[old[index].rarity]);
  assert.ok(!ids.some(id=>choice.id===id||choice.id===`${id}-legendary`));
 }
 assert.ok(rank[s.upgradeChoices[0].rarity]>rank.uncommon);
});

test('impossible replacements and invalid phases never spend rerolls or mutate choices',()=>{
 const sim=new Simulation(1,93),s=sim.state;
 const items=availableItemChoices(s).filter(c=>c.rarity==='rare').slice(0,3);
 s.itemUnlocks=items.map(c=>c.id);sim.enterChoice(items,undefined,'cache');
 const snapshot=JSON.stringify(s);
 assert.equal(rerollChoices(s),null);assert.equal(sim.reroll(),false);
 assert.equal(JSON.stringify(s),snapshot);
 s.phase='playing';assert.equal(sim.reroll(),false);assert.equal(s.rerolls,2);
});

test('recruit rerolls retain recruitment source and offer new eligible teammates',()=>{
 const sim=new Simulation(1,431),s=sim.state;
 s.stats.elapsed=200;s.stats.level=10;
 sim.enterChoice(makeChoices(s,sim.rng,'recruit'),undefined,'recruit');
 const old=s.upgradeChoices;
 assert.equal(sim.reroll(),true);
 assert.equal(s.choiceSource,'recruit');assert.equal(s.recruitCount,0);
 assert.ok(s.upgradeChoices.every(c=>c.kind==='recruit'&&!old.some(previous=>previous.id===c.id)));
});
