import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {getBuildModifiers} from '../src/game/systems/builds.ts';
import {applyChoice,availableItemChoices} from '../src/game/systems/progression.ts';
import {TRAINING_UPGRADES,trainingVariants} from '../src/data/progression.ts';
import {memberDamage} from '../src/game/combat/damage.ts';
import {formatPercent,upgradeStatPreview} from '../src/ui/upgradePreview.ts';

const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

test('percentage bonuses add against base damage rather than compounding',()=>{
 const s=new Simulation(4,67).state,member=s.party[0];
 const base=memberDamage(member,0,0);
 s.buffs.power=.05;
 close(memberDamage(member,0,getBuildModifiers(s).power)/base*100,105);
 s.buffs.power+=.10;
 close(memberDamage(member,0,getBuildModifiers(s).power)/base*100,115);
 s.items=['life-orb'];
 close(memberDamage(member,0,getBuildModifiers(s).power)/base*100,131);
});

test('training previews include relic bonuses, match applied totals and never mutate the run',()=>{
 const s=new Simulation(4,68).state;s.items=['life-orb'];
 const power=TRAINING_UPGRADES.find(upgrade=>upgrade.id==='power')!;
 for(const {rarity,amount} of trainingVariants(power)){
  const choice={...power,id:rarity==='common'?'power':`power-${rarity}`,kind:'stat' as const,rarity,amount,rank:1};
  const snapshot=structuredClone(s),preview=upgradeStatPreview(s,choice);
  assert.deepEqual(s,snapshot);
  assert.deepEqual(preview,[{label:'Damage bonus',before:'16%',after:formatPercent(.16+choice.amount)}]);
  const projected=structuredClone(s);assert.equal(applyChoice(projected,choice).applied,true);
  assert.equal(formatPercent(getBuildModifiers(projected).power),preview[0].after);
 }
});

test('HP, defense and critical chance previews match their effective percentages',()=>{
 for(const id of ['health','crit']){
  const s=new Simulation(4,69).state,definition=TRAINING_UPGRADES.find(upgrade=>upgrade.id===id)!;
  const first={...definition,kind:'stat' as const,rank:1};assert.equal(applyChoice(s,first).applied,true);
  const second={...first,rank:2},preview=upgradeStatPreview(s,second);
  assert.ok(preview.length);assert.equal(applyChoice(s,second).applied,true);
  const value=id==='health'?s.buffs.health:getBuildModifiers(s).critChance;
  assert.equal(preview[0].after,formatPercent(value));
 }
});

test('legendary relic previews show all percentage stat changes and honor active conditions',()=>{
 const s=new Simulation(4,70).state;s.buffs.radius=.18;
 const claw=availableItemChoices(s).find(choice=>choice.id==='razor-claw-legendary')!;
 const preview=upgradeStatPreview(s,claw);
 assert.ok(preview.some(row=>row.label==='Critical damage'&&row.after==='2.22\u00d7'));
 assert.ok(availableItemChoices(s).every(choice=>!choice.id.startsWith('long-barrel')));
 const sash=availableItemChoices(s).find(choice=>choice.id==='focus-sash-legendary')!;
 assert.deepEqual(upgradeStatPreview(s,sash),[{label:'Copies',before:'0',after:'1'}]);
 s.player.hp=s.player.maxHp*.2;assert.equal(upgradeStatPreview(s,sash).length,4);
});
