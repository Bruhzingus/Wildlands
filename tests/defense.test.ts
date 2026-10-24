import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {KANTO,getSpecies} from '../src/data/kanto.ts';
import {TRAINING_UPGRADES} from '../src/data/progression.ts';
import {ITEMS,getItemDefinition} from '../src/data/items.ts';
import {getBuildModifiers} from '../src/game/systems/builds.ts';
import {applyChoice,availableItemChoices,makeChoices} from '../src/game/systems/progression.ts';
import {RNG} from '../src/utils/random.ts';

const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const input={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};

test('species start with small thresholds and weaker attacks receive more defense',()=>{
 assert.ok(KANTO.every(species=>species.defense>=.5&&species.defense<=3));
 assert.ok(getSpecies(10).power<getSpecies(4).power);
 assert.ok(getSpecies(10).defense>getSpecies(4).defense);
 const sim=new Simulation(4,113),s=sim.state,base=getSpecies(4).defense;
 (sim as any).hurtPlayer(10,false);close(s.player.maxHp-s.player.hp,10-base);
 s.player.iframes=0;s.buffs.defense=.5;
 const hp=s.player.hp;(sim as any).hurtPlayer(10,false);close(hp-s.player.hp,10-base*1.5);
 s.player.iframes=0;(sim as any).hurtPlayer(.1,false);close(s.player.hp,hp-(10-base*1.5));
 const follower={...s.party[0],uid:2,speciesId:10,hp:100,maxHp:100,iframes:0};s.party.push(follower);
 (sim as any).hurtCompanion(follower,10);close(100-follower.hp,10-getSpecies(10).defense*1.5);
});

test('deflection upgrades add their rarity bonus, cap at fifty and stop being offered',()=>{
 const s=new Simulation(4,114).state,upgrade=TRAINING_UPGRADES.find(entry=>entry.id==='deflection')!;
 for(let i=0;i<17;i++)assert.equal(applyChoice(s,{...upgrade,kind:'stat',rank:i+1}).applied,true);
 close(getBuildModifiers(s).deflection,.5);
 assert.equal(applyChoice(s,{...upgrade,kind:'stat'}).applied,false);
 for(let seed=1;seed<30;seed++)assert.ok(makeChoices(s,new RNG(seed),'squad').every(choice=>choice.stat!=='deflection'));
 s.buffs.deflection=100;close(getBuildModifiers(s).deflection,.5);
});

test('deflected enemy attacks prevent damage and poison while self damage still applies',()=>{
 const sim=new Simulation(4,115),s=sim.state;s.buffs.deflection=.5;sim.rng.next=()=>0;
 const hp=s.player.hp;(sim as any).hurtPlayer(20,true,false,false,99);
 close(s.player.hp,hp);close(s.player.poisonTime,0);close(s.stats.damageTaken,0);
 (sim as any).hurtPlayer(2,false,true,true);close(s.player.hp,hp-2);
 const follower={...s.party[0],uid:2,hp:100,iframes:0};s.party.push(follower);
 (sim as any).hurtCompanion(follower,20,true,99);close(follower.hp,100);assert.ok(!follower.poisonTime);
 sim.rng.next=()=>.99;s.player.iframes=0;(sim as any).hurtPlayer(20,false,false,false,99);assert.ok(s.player.hp<hp-2);
});

test('Team Battery requires three living members and scales dodge capacity with current party',()=>{
 const sim=new Simulation(4,116),s=sim.state,choice=ITEMS.find(item=>item.id==='team-battery')!;
 assert.equal(applyChoice(s,choice).applied,false);
 for(let uid=2;uid<=3;uid++)s.party.push({...s.party[0],uid});
 assert.ok(availableItemChoices(s).some(item=>item.id===choice.id));
 assert.equal(applyChoice(s,choice).applied,true);close(getBuildModifiers(s).staminaCapacity,1.5);
 s.enemies=[];s.pois=[];
 for(let i=0;i<4;i++){sim.update(.01,{...input,dodge:true});sim.update(.01,input);}
 assert.equal(s.player.dodgeCharges,0);
 sim.update(.01,{...input,dodge:true});assert.equal(s.player.dodgeCharges,0);
 for(let i=0;i<80;i++)sim.update(.05,input);
 assert.equal(s.player.dodgeCharges,1);
 s.party.pop();close(getBuildModifiers(s).staminaCapacity,1);
 assert.equal(applyChoice(s,choice).applied,false);
});

test('relic and reach balance changes are reflected in effective stats and offers',()=>{
 const s=new Simulation(4,117).state,base=getBuildModifiers(s).critDamage;
 const claw=getItemDefinition('razor-claw')!;assert.equal(claw.rarity,'uncommon');
 s.buffs.critDamage=.5;const before=getBuildModifiers(s).critDamage;
 s.items=['razor-claw'];close(getBuildModifiers(s).critDamage,before*1.1);
 s.items=['razor-claw-legendary'];close(getBuildModifiers(s).critDamage,before*1.2);
 assert.ok(base>1);assert.ok(ITEMS.every(item=>!item.id.startsWith('long-barrel')));
 const radius=TRAINING_UPGRADES.find(entry=>entry.id==='radius')!;close(radius.amount,.18*.7);
 assert.equal(applyChoice(s,{...radius,kind:'stat'}).applied,true);close(getBuildModifiers(s).radius,.126);
});
