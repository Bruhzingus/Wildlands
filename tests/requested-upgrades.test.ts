import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {getItemDefinition,ITEMS} from '../src/data/items.ts';
import {getSpecialProfile} from '../src/data/specials.ts';
import {applyChoice,xpThreshold} from '../src/game/systems/progression.ts';
import {dispatchBuildEvent,getBuildModifiers,metronomeDamageMultiplier} from '../src/game/systems/builds.ts';

const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} !== ${expected}`);

test('requested relic rarity curves are active and retain their authored values',()=>{
 const lucky=['lucky-egg-xp','lucky-egg-xp-rare','lucky-egg-xp-epic','lucky-egg-xp-legendary'];
 assert.deepEqual(lucky.map(id=>getItemDefinition(id)?.modifiers?.[0].amount),[.015,.03,.045,.1]);
 const candy=['rare-candy','rare-candy-rare','rare-candy-epic','rare-candy-legendary'];
 assert.deepEqual(candy.map(id=>getItemDefinition(id)?.levelGain),[.5,1,1.5,2.5]);
 assert.equal(getItemDefinition('metronome-ramp')?.rarity,'legendary');
 assert.deepEqual(['power-herb','power-herb-epic'].map(id=>getItemDefinition(id)?.effects?.[0].action),[
  {kind:'specialCooldownPercent',amount:.015},{kind:'specialCooldownPercent',amount:.04},
 ]);
});

test('Metronome ramps only while the squad stays on the same target',()=>{
 const state=new Simulation(1,730).state;state.items=['metronome-ramp'];
 close(metronomeDamageMultiplier(state,41),1);
 close(metronomeDamageMultiplier(state,41),1.05);
 close(metronomeDamageMultiplier(state,42),1);
 close(metronomeDamageMultiplier(state,42,2),1.075);
});

test('Rare Candy grants the advertised shared level progress and Power Herb reduces remaining cooldown',()=>{
 const simulation=new Simulation(1,731),state=simulation.state;
 const legendaryCandy=ITEMS.find(item=>item.id==='rare-candy-legendary')!;
 assert.equal(applyChoice(state,legendaryCandy).applied,true);
 assert.equal(state.party[0].xp,xpThreshold(1)+xpThreshold(2)+xpThreshold(3)*.5);
 state.items=['power-herb'];
 for(let i=0;i<2;i++)assert.equal(dispatchBuildEvent({state,rng:{next:()=>.5}},{kind:'onAttack',sourceId:1}).length,0);
 const action=dispatchBuildEvent({state,rng:{next:()=>.5}},{kind:'onAttack',sourceId:1})[0];
 assert.deepEqual(action,{kind:'specialCooldownPercent',amount:.015,sourceId:1,targetId:undefined,element:'grass',depth:1});
});

test('Wise Glasses improves damaging specials and is rejected for a non-damaging Q',()=>{
 const damaging=new Simulation(1,732).state;
 const common={id:'wise-glasses',kind:'stat' as const,stat:'specialPower',amount:.1,title:'Wise Glasses',description:'',rarity:'common' as const,rank:1};
 assert.equal(applyChoice(damaging,common).applied,true);close(getBuildModifiers(damaging).specialPower,.1);
 const support=new Simulation(113,733).state;
 assert.equal(getSpecialProfile(support.party[0].speciesId).damageScale,0);
 assert.equal(applyChoice(support,common).applied,false);
});
