import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {makeChoices} from '../src/game/systems/progression.ts';
import {BUILD_LIMITS,dispatchBuildEvent,getBuildModifiers} from '../src/game/systems/builds.ts';
import type {UpgradeChoice} from '../src/game/types.ts';
const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
function exhaustOffensiveBudget(simulation:Simulation){
 const s=simulation.state;
 for(let i=0;i<4;i++)dispatchBuildEvent({state:s,rng:{next:()=>0}},{kind:'onHit',targetId:s.enemies[0].uid});
 assert.equal(s.build!.actionsInWindow,BUILD_LIMITS.maxActionsPerWindow);
}

test('selecting a real recruit applies welcome effects once using the newly expanded squad',()=>{
 const simulation=new Simulation(1,901),s=simulation.state;s.items=['welcome-basket','exp-share'];s.player.hp=50;s.stats.elapsed=165;s.stats.level=4;
 const choices=makeChoices(s,simulation.rng);assert.ok(choices.every(choice=>choice.kind==='recruit'));
 simulation.enterChoice(choices);simulation.choose(choices[0].id);
 assert.equal(s.party.length,2);assert.equal(s.stats.recruits,1);assert.equal(s.player.hp,74);
 assert.equal(s.party.reduce((total,member)=>total+(member.xp??0),0),48,'Both level-one members receive full welcome XP');
 assert.equal(s.stats.xp,24,'The leader receives the full shared XP amount');
 assert.equal(s.stats.elapsed,165);assert.equal(s.phase,'playing');
 const before={hp:s.player.hp,xp:s.stats.xp};simulation.choose(choices[0].id);
 assert.deepEqual({hp:s.player.hp,xp:s.stats.xp},before,'repeated UI input must not replay the recruitment reward');
});

test('selecting a real evolution fires growth effects once and immediately updates evolution-sensitive items',()=>{
 const simulation=new Simulation(1,902),s=simulation.state;s.items=['growth-charm','nursery-stone'];s.player.hp=20;s.player.specialCooldown=12;s.party[0].hp=27;s.stats.elapsed=170;s.party[0].level=5;
 assert.equal(getBuildModifiers(s).power,.45);
 const choice:UpgradeChoice={id:'evolve-1-2',kind:'evolve',title:'Evolve',description:'',rarity:'epic',speciesId:1,targetId:2,sourceSpeciesId:1};
 simulation.enterChoice([choice]);simulation.choose(choice.id);
 assert.equal(s.party[0].speciesId,2);assert.equal(s.stats.evolutions,1);assert.equal(s.player.hp,55);assert.equal(s.player.maxHp,150);
 assert.equal(s.party[0].hp,63.75);assert.equal(s.player.specialCooldown,4);assert.equal(s.stats.elapsed,170);
 assert.equal(getBuildModifiers(s).power,.7,'middle-stage members retain their legacy conditional bonus plus evolution power');
 const before={hp:s.player.hp,cooldown:s.player.specialCooldown,evolutions:s.stats.evolutions};
 simulation.enterChoice([choice]);simulation.choose(choice.id);
 assert.deepEqual({hp:s.player.hp,cooldown:s.player.specialCooldown,evolutions:s.stats.evolutions},before,'stale evolution cards cannot replay effects');
});

test('blocked recruitment does not fire item hooks or heal the party',()=>{
 const simulation=new Simulation(4,903),s=simulation.state;s.items=['welcome-basket'];s.player.hp=30;s.stats.level=9;s.stats.elapsed=164;
 const invalid:UpgradeChoice={id:'recruit-7',kind:'recruit',speciesId:7,title:'Recruit',description:'',rarity:'rare'};
 simulation.enterChoice([invalid]);simulation.choose(invalid.id);
 assert.equal(s.party.length,1);assert.equal(s.stats.recruits,0);assert.equal(s.player.hp,30);assert.equal(s.stats.xp,0);
 assert.equal(s.build,undefined,'failed choices should never even dispatch their acquisition hooks');
});

test('busy combat cannot suppress guaranteed recruit and evolution rewards during a paused choice',()=>{
 const simulation=new Simulation(1,904),s=simulation.state;s.items=['kings-rock','frost-charm','toxic-barb','welcome-basket','growth-charm'];
 s.player.hp=50;s.stats.elapsed=165;s.stats.level=4;exhaustOffensiveBudget(simulation);
 const choices=makeChoices(s,simulation.rng);simulation.enterChoice(choices);simulation.choose(choices[0].id);
 assert.equal(s.player.hp,74);assert.equal(s.stats.xp,24);assert.equal(s.party[1].xp,24);assert.equal(s.build!.actionsInWindow,BUILD_LIMITS.maxActionsPerWindow);
 s.stats.elapsed=170;s.party[0].level=5;s.player.specialCooldown=12;exhaustOffensiveBudget(simulation);
 const evolution:UpgradeChoice={id:'evolve-1-2',kind:'evolve',title:'Evolve',description:'',rarity:'epic',speciesId:1,targetId:2,sourceSpeciesId:1};
 simulation.enterChoice([evolution]);simulation.choose(evolution.id);
 assert.equal(s.player.hp,122.5);assert.equal(s.player.specialCooldown,4);assert.equal(s.stats.evolutions,1);
 assert.equal(s.build!.actionsInWindow,BUILD_LIMITS.maxActionsPerWindow,'guaranteed resources must not consume or reset the offensive quota');
 assert.deepEqual(dispatchBuildEvent({state:s,rng:{next:()=>0}},{kind:'onHit',targetId:s.enemies[0].uid}),[],'offensive procs remain capped after the reward');
});

test('an exhausted effect budget cannot waive the Life Orb HP cost on a real automatic attack',()=>{
 const simulation=new Simulation(1,905),s=simulation.state;s.items=['life-orb','kings-rock','frost-charm','toxic-barb'];
 s.stats.elapsed=165;s.player.hp=100;s.buffs.armor=12;s.enemies=[s.enemies[0]];Object.assign(s.enemies[0],{x:3,z:0,speed:0,hitCooldown:100});s.party[0].cooldown=0;
 for(let i=0;i<24;i++)dispatchBuildEvent({state:s,rng:{next:()=>0}},{kind:'onAttack',sourceId:1,targetId:s.enemies[0].uid});
 exhaustOffensiveBudget(simulation);simulation.update(.01,idle);
 assert.equal(s.player.hp,98);assert.equal(s.stats.damageTaken,2);assert.equal(s.build!.actionsInWindow,BUILD_LIMITS.maxActionsPerWindow);
 assert.ok(s.stats.damageDealt>0,'the vine attack still executes after paying its exact HP cost');
});
