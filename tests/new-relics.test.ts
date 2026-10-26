import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,type GameEvent} from '../src/game/Simulation.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {applyChoice,availableItemChoices,weightedUpgradeChoices} from '../src/game/systems/progression.ts';
import {dispatchBuildEvent,getBuildModifiers} from '../src/game/systems/builds.ts';
import {ITEMS,relicFamily} from '../src/data/items.ts';
import {getSpecialProfile} from '../src/data/specials.ts';
import {RNG} from '../src/utils/random.ts';
import {upgradeStatPreview} from '../src/ui/upgradePreview.ts';
import {estimatedBuildDps} from '../src/game/analytics.ts';
import {serializeRunState,isSimulationSnapshot} from '../src/game/runSnapshot.ts';
import {DEFAULT_SAVE,migrateSave} from '../src/game/save.ts';
import type {Enemy,PartyMember} from '../src/game/types.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
function arena(starter=1,items:string[]=[]){
 const sim=new Simulation(starter,8591),s=sim.state,events:GameEvent[]=[];
 s.items=items;s.enemies=[];s.pois=[];s.terrainFeatures=[];s.berryTrees=[];
 s.party[0].cooldown=1000;s.player.iframes=1000;s.buffs.crit=-1;
 sim.onEvent=event=>events.push(event);
 return {sim,s,events};
}
function foe(sim:Simulation,x=0,z=6,overrides:Partial<Enemy>={}){
 const enemy=createEnemy(sim.state,sim.rng,19,'normal',x,z);
 Object.assign(enemy,{hp:100000,maxHp:100000,speed:0,hitCooldown:1000,attackCooldown:1000},overrides);
 sim.state.enemies.push(enemy);return enemy;
}
function advance(sim:Simulation,seconds:number){
 for(let elapsed=0;elapsed<seconds-1e-9;elapsed+=.02)sim.update(Math.min(.02,seconds-elapsed),idle);
}
function acquire(s:Simulation['state'],id:string){
 const card=availableItemChoices(s).find(choice=>choice.id===id);assert.ok(card,`${id} should be available`);
 assert.equal(applyChoice(s,card).applied,true);return card;
}

test('Expert Belt adds target-conditioned power, including mixed rarity copies, without boosting normal enemies',()=>{
 const hit=(elite:boolean,items:string[])=>{
  const {sim,s}=arena(1,items);s.buffs.power=1;s.party[0].cooldown=0;
  const enemy=foe(sim,0,6,{elite});sim.update(.01,idle);return enemy.maxHp-enemy.hp;
 };
 close(hit(false,['expert-belt']),hit(false,[]));
 close(hit(true,['expert-belt'])/hit(true,[]),2.25/2);
 close(hit(true,['expert-belt','expert-belt-legendary'])/hit(true,[]),2.75/2);
 const {s}=arena(1,['expert-belt']);
 close(getBuildModifiers(s).power,0);
 close(getBuildModifiers(s,1,{elite:false,isBoss:true}).power,.25);
});

test('Expert Belt benefits learned attacks and specials rather than applying its bonus twice to derived damage',()=>{
 for(const kind of ['learned','special'] as const){
  const hit=(items:string[])=>{
   const {sim,s}=arena(kind==='special'?25:1,items);s.buffs.power=.5;
   const enemy=foe(sim,0,6,{elite:true});
   if(kind==='learned')s.party[0].learnedMoves=[{moveId:'razor-leaf',rank:1,cooldown:0}];
   sim.update(.01,{...idle,special:kind==='special'});advance(sim,.8);
   return enemy.maxHp-enemy.hp;
  };
  close(hit(['expert-belt'])/hit([]),1.75/1.5);
 }
 const {sim,s}=arena(1,['expert-belt','spillstone']);
 s.party[0].cooldown=0;const first=foe(sim,0,6,{hp:1,elite:true}),next=foe(sim,3,6,{elite:true});
 sim.update(.01,idle);
 const native=s.analytics!.sources.find(row=>row.source.origin==='signature')!;
 close(next.maxHp-next.hp,(native.attempted-1)*.2);
 assert.ok(first.dead);
});

test('Expert Belt retains cast-time additive scaling when power changes during projectile flight',()=>{
 const hit=(items:string[])=>{
  const {sim,s}=arena(1,items);const enemy=foe(sim,0,10,{elite:true});
  s.party[0].learnedMoves=[{moveId:'solar-beam',rank:1,cooldown:0}];
  sim.update(.01,idle);assert.ok(s.projectiles.length>0);s.buffs.power=3;
  advance(sim,1);return enemy.maxHp-enemy.hp;
 };
 close(hit(['expert-belt'])/hit([]),1.25);
});

test('Spillstone transfers actual overkill once, ignores the second target matchup and breaks nearest ties by UID',()=>{
 const {sim,s}=arena(1,['spillstone']);s.buffs.crit=2;s.party[0].cooldown=0;
 const first=foe(sim,0,6,{hp:5}),nearest=foe(sim,3,6,{speciesId:7}),tie=foe(sim,-3,6);
 s.enemies=[first,tie,nearest];sim.update(.01,idle);
 const native=s.analytics!.sources.find(row=>row.source.origin==='signature')!;
 close(nearest.maxHp-nearest.hp,(native.attempted-5)*.2);
 close(tie.hp,tie.maxHp);
 const spill=s.analytics!.sources.find(row=>row.source.effectId==='item:spillstone')!;
 assert.equal(spill.source.origin,'proc');assert.equal(spill.criticalHits,0);
 assert.equal(spill.source.actorId,1);assert.equal(spill.source.rootOrigin,'signature');
});

test('Spillstone copies combine into one transfer across rarities and preserve large hit packets',()=>{
 const {s}=arena(1,['spillstone','spillstone-legendary']);s.itemStacks={spillstone:3,'spillstone-legendary':2};
 const actions=dispatchBuildEvent({state:s,rng:new RNG(1)},{kind:'onOverkill',sourceId:1,targetId:40,damage:10000,count:100});
 assert.equal(actions.length,1);assert.equal(actions[0].kind,'spill');
 if(actions[0].kind==='spill'){close(actions[0].damage,14000);assert.equal(actions[0].range,4);}
 assert.equal(dispatchBuildEvent({state:s,rng:new RNG(1)},{kind:'onOverkill',sourceId:1,targetId:40,damage:10000,depth:1}).length,0);
});

test('Spillstone kills award ordinary XP and kill credit without on-death items or recursive spill',()=>{
 const {sim,s}=arena(1,['spillstone','blast-seed','shell-bell','metronome-ramp']);s.party[0].cooldown=0;
 foe(sim,0,6,{hp:1});const next=foe(sim,3,6,{hp:1}),third=foe(sim,3,9);
 sim.update(.01,idle);
 assert.ok(next.dead);assert.equal(s.stats.kills,2);assert.ok((s.party[0].xp??0)>0);
 close(third.hp,third.maxHp);
 assert.equal(s.build!.counters['item:blast-seed:0:squad'],1);
 assert.equal(s.build!.counters['item:shell-bell:0:squad'],1);
 assert.equal(s.build!.metronomeHits,1);
});

test('Spillstone has no transfer without overkill or without an in-range living target',()=>{
 for(const hp of [100000,1]){
  const {sim,s}=arena(1,['spillstone']);s.party[0].cooldown=0;
  foe(sim,0,6,{hp});const far=foe(sim,5,6);sim.update(.01,idle);
  close(far.hp,far.maxHp);assert.ok(!s.analytics!.sources.some(row=>row.source.effectId==='item:spillstone'));
 }
});

test('Spillstone cannot turn damage denied by a boss stage threshold into overkill',()=>{
 const {sim,s}=arena(1,['spillstone']);s.buffs.power=1000;s.party[0].cooldown=0;
 const boss=foe(sim,0,6,{isBoss:true,elite:true,hp:100,maxHp:100}),nearby=foe(sim,3,6);
 sim.update(.01,idle);
 assert.ok(boss.hp>0&&boss.hp<100);assert.ok(!boss.dead);
 close(nearby.hp,nearby.maxHp);assert.ok(!s.analytics!.sources.some(row=>row.source.effectId==='item:spillstone'));
});

test('Blood Pact doubles special damage and halves cooldown after existing special training and berry bonuses',()=>{
 const cast=(items:string[])=>{
  const {sim,s}=arena(25,items);s.buffs.specialPower=.7;s.buffs.specialHaste=1.5;
  s.berryBuffs={leppa:[100]};const enemy=foe(sim);
  sim.update(.01,{...idle,special:true});
  return {s,sim,enemy,damage:enemy.maxHp-enemy.hp};
 };
 const normal=cast([]),pact=cast(['blood-pact']);
 close(pact.damage,normal.damage*2);
 close(pact.s.player.specialCooldown,normal.s.player.specialCooldown/2);
 close(pact.s.player.hp,pact.s.player.maxHp*.85);
 close(pact.s.stats.damageTaken,pact.s.player.maxHp*.15);
 const before=pact.s.player.hp;pact.sim.update(.01,{...idle,special:true});close(pact.s.player.hp,before);
 const source=pact.s.analytics!.sources.find(row=>row.source.effectId==='item:blood-pact')!;
 assert.equal(source.source.origin,'self');
});

test('Blood Pact health cost bypasses defense, iframes and deflection, and is paid before other special effects',()=>{
 const {sim,s}=arena(25,['blood-pact','rescue-ribbon','berserker-emblem']);
 s.player.hp=s.player.maxHp*.6;s.buffs.defense=1e6;s.buffs.deflection=.5;foe(sim);
 sim.update(.01,{...idle,special:true});
 close(s.stats.damageTaken,s.player.maxHp*.15);
 close(s.player.hp,s.player.maxHp*.51);
 // Heal Bell then restores health above the threshold; the cost is still exact.
 close(getBuildModifiers(s).power,0);
});

test('Blood Pact can be lethal and cannot be bypassed by on-special healing',()=>{
 const {sim,s}=arena(25,['blood-pact','rescue-ribbon']);s.player.hp=s.player.maxHp*.1;
 const enemy=foe(sim);sim.update(.01,{...idle,special:true});
 assert.equal(s.result,'defeat');assert.equal(s.player.hp,0);
 assert.equal(s.activeSpecials?.length??0,0);close(enemy.hp,enemy.maxHp);
});

test('Blood Pact is unique, is withheld for healing-only specials and leaves follower specials unchanged',()=>{
 const {sim,s}=arena(25);acquire(s,'blood-pact');
 assert.ok(!availableItemChoices(s).some(choice=>choice.id==='blood-pact'));
 assert.equal(applyChoice(s,ITEMS.find(choice=>choice.id==='blood-pact')!).applied,false);
 const support=arena(113).s;assert.equal(getSpecialProfile(113).damageScale,0);
 assert.ok(!availableItemChoices(support).some(choice=>choice.id==='blood-pact'));
 const member:PartyMember={...structuredClone(s.party[0]),uid:s.idCounter++,x:2,z:0,specialCooldown:0};
 s.party.push(member);s.player.specialCooldown=1000;foe(sim);const hp=s.player.hp;
 sim.update(.01,idle);close(s.player.hp,hp);
 close(member.specialCooldown!,getSpecialProfile(member.speciesId).cooldown);
 close(getBuildModifiers(s,member).specialAmplification,0);
});

test('Berserker Emblem activates strictly below half health, stacks mixed rarities, and expires on recovery',()=>{
 const {s}=arena(1);acquire(s,'berserker-emblem');acquire(s,'berserker-emblem');acquire(s,'berserker-emblem-rare');
 s.player.hp=s.player.maxHp*.5;close(getBuildModifiers(s).speed,0);
 s.player.hp-=.001;const active=getBuildModifiers(s);
 for(const stat of ['speed','defense','power'] as const)close(active[stat],.7);
 s.player.hp=s.player.maxHp*.8;
 for(const stat of ['speed','defense','power'] as const)close(getBuildModifiers(s)[stat],0);
 s.player.hp=s.player.maxHp*.4;
 for(const id of ['berserker-emblem-epic','berserker-emblem-legendary'])acquire(s,id);
 close(getBuildModifiers(s).power,1.7);
});

test('Blood Pact crossing half health immediately enables Berserker Emblem for that special',()=>{
 const cast=(items:string[])=>{
  const {sim,s}=arena(25,items);s.player.hp=s.player.maxHp*.6;const enemy=foe(sim);
  sim.update(.01,{...idle,special:true});return enemy.maxHp-enemy.hp;
 };
 close(cast(['blood-pact','berserker-emblem'])/cast(['blood-pact']),1.2);
});

test('new relic previews show conditional damage and exact special cooldown/cost without mutating state',()=>{
 const {s}=arena(1);s.buffs.specialHaste=1;
 const snapshot=structuredClone(s),pact=upgradeStatPreview(s,ITEMS.find(choice=>choice.id==='blood-pact')!);
 assert.deepEqual(s,snapshot);
 assert.ok(pact.some(row=>row.label==='Q cooldown'&&row.before==='8s'&&row.after==='4s'));
 assert.ok(pact.some(row=>row.label==='Special damage multiplier'&&row.after==='2×'));
 assert.ok(pact.some(row=>row.label==='HP spent per special'&&row.after==='14.4 HP'));
 const belt=upgradeStatPreview(s,ITEMS.find(choice=>choice.id==='expert-belt')!);
 assert.ok(belt.some(row=>row.label==='Damage bonus vs elites / bosses'&&row.after==='25%'));
 acquire(s,'blood-pact');const before=estimatedBuildDps(snapshot),after=estimatedBuildDps(s);
 close(after.ability,before.ability*4);
});

test('new relic families are available to existing saves and sibling rarities never share an offer',()=>{
 const old=structuredClone(DEFAULT_SAVE);old.unlockedItems=old.unlockedItems.filter(id=>!['expert-belt','spillstone','blood-pact','berserker-emblem'].includes(id));
 const save=migrateSave(old)!;
 for(const family of ['expert-belt','spillstone','blood-pact','berserker-emblem'])assert.ok(save.unlockedItems.includes(family));
 const pool=ITEMS.filter(choice=>relicFamily(choice.id)==='berserker-emblem');
 assert.equal(weightedUpgradeChoices(pool,3,new RNG(124)).length,1);
 const support=arena(113).s;assert.ok(!availableItemChoices(support).some(choice=>['expert-belt','spillstone'].includes(relicFamily(choice.id))));
});

test('new relics and a paid ongoing special resume deterministically without paying HP a second time',()=>{
 const {sim,s}=arena(25);for(const id of ['expert-belt','spillstone','blood-pact','berserker-emblem-rare'])acquire(s,id);
 s.player.hp=s.player.maxHp*.6;foe(sim);sim.update(.01,{...idle,special:true});
 const snapshot=sim.exportSnapshot();assert.ok(isSimulationSnapshot(snapshot));
 const restored=Simulation.restore(JSON.parse(JSON.stringify(snapshot)),{paused:false});
 for(let i=0;i<40;i++){sim.update(.02,idle);restored.update(.02,idle);}
 assert.deepEqual(JSON.parse(JSON.stringify(serializeRunState(restored.state))),JSON.parse(JSON.stringify(serializeRunState(s))));
 close(s.stats.damageTaken,s.player.maxHp*.15);
});
