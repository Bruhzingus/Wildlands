import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {ITEMS,ITEM_DEFINITIONS,getItemDefinition,relicFamily} from '../src/data/items.ts';
import {BASE_ITEMS} from '../src/data/unlocks.ts';
import {applyChoice,availableItemChoices,chestChoices,makeChoices,rerollChoices,weightedUpgradeChoices} from '../src/game/systems/progression.ts';
import {dispatchBuildEvent,getBuildModifiers} from '../src/game/systems/builds.ts';
import {RNG} from '../src/utils/random.ts';

const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

test('standard relic families have a legendary variant with original triggers and stronger benefits',()=>{
 const bases=ITEM_DEFINITIONS.filter(item=>item.offerable!==false&&!item.baseId);
 const authored=ITEM_DEFINITIONS.filter(item=>item.offerable!==false&&item.baseId&&getItemDefinition(item.baseId)?.baseId);
 assert.equal(ITEMS.length,bases.length*2+authored.length);
 for(const base of bases){
  const legendary=getItemDefinition(`${base.id}-legendary`)!;
  assert.ok(legendary);assert.equal(legendary.rarity,'legendary');assert.equal(legendary.baseId,base.id);
  assert.ok(legendary.description?.length);assert.equal(legendary.stacking,base.stacking);
  for(const [index,modifier] of (base.modifiers??[]).entries()){
   close(legendary.modifiers![index].amount,modifier.amount>0?modifier.amount*2:modifier.amount);
  }
  for(const [index,effect] of (base.effects??[]).entries()){
   const upgraded=legendary.effects![index];
   assert.equal(upgraded.event,effect.event);assert.equal(upgraded.chance,effect.chance);
   assert.equal(upgraded.every,effect.every);assert.equal(upgraded.cooldown,effect.cooldown);
   assert.equal(upgraded.action.kind,effect.action.kind);
  }
 }
});

test('legendary relics inherit base unlocks and both versions remain repeatable',()=>{
 const state=new Simulation(4,56,{itemUnlocks:BASE_ITEMS}).state;
 assert.ok(availableItemChoices(state).some(item=>item.id==='leftovers-legendary'));
 assert.ok(!availableItemChoices(state).some(item=>item.id==='life-orb-legendary'));
 for(const id of ['leftovers','leftovers-legendary']){
  const s=new Simulation(4,56,{itemUnlocks:['leftovers']}).state;
  const stale=availableItemChoices(s).find(item=>item.id!==id)!;
  assert.equal(applyChoice(s,availableItemChoices(s).find(item=>item.id===id)!).applied,true);
  assert.equal(availableItemChoices(s).length,2);
  assert.equal(applyChoice(s,stale).applied,true);
  close(getBuildModifiers(s).regenerationPercent,.024);
 }
});

test('legendary relic procs apply their stronger effect through the real event interpreter',()=>{
 const state=new Simulation(4,57).state;state.items=['static-orb-legendary','rescue-ribbon-legendary'];
 const arc=dispatchBuildEvent({state,rng:{next:()=>0}},{kind:'onCrit',sourceId:1,damage:100})[0];
 assert.ok(arc.kind==='chain');close(arc.damage,50);
 const heal=dispatchBuildEvent({state,rng:{next:()=>0}},{kind:'onSpecial',sourceId:1}).find(action=>action.kind==='heal');
 assert.ok(heal?.kind==='heal');close(heal.maxHpFraction!,.24);
});

test('relic rolls never show sibling variants together and preserve legendary slots on reroll',()=>{
 const state=new Simulation(4,58).state,rng=new RNG(7907);
 for(let roll=0;roll<1000;roll++){
  const choices=makeChoices(state,rng,'cache');
  assert.equal(new Set(choices.map(choice=>relicFamily(choice.id))).size,choices.length);
 }
 state.upgradeChoices=['leftovers-legendary','static-orb-legendary','rescue-ribbon-legendary'].map(id=>ITEMS.find(item=>item.id===id)!);
 state.phase='choice';state.choiceSource='cache';
 const rerolled=rerollChoices(state,new RNG(62))!;
 assert.equal(rerolled.length,3);assert.ok(rerolled.every(choice=>choice.rarity==='legendary'));
 assert.ok(rerolled.every(choice=>!state.upgradeChoices.some(old=>relicFamily(old.id)===relicFamily(choice.id))));
 const pool=['leftovers','leftovers-legendary'].map(id=>ITEMS.find(item=>item.id===id)!);
 assert.equal(weightedUpgradeChoices(pool,3,rng).length,1);
 const chest=chestChoices(state,new RNG(63),'epic');
 assert.ok(chest.every(choice=>choice.rarity==='epic'||choice.rarity==='legendary'));
});
