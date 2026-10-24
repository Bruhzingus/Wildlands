import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,getItemDefinition,type ItemDefinition} from '../src/data/items.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {BUILD_STAT_CAPS,dispatchBuildEvent,getBuildModifiers,getBuildSummary} from '../src/game/systems/builds.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';

const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
const guaranteed={next:()=>0};
function arena(items:string[]=[]){
 const simulation=new Simulation(4,573),state=simulation.state;
 state.items=items;state.enemies=[];state.player.iframes=1000;state.party[0].cooldown=1000;
 return {simulation,state};
}
function learnedArena(items:string[],moveId='swift'){
 const result=arena(items),{simulation,state}=result;
 simulation.rng.next=()=>.99;
 state.player.hp=100;state.player.maxHp=200;
 state.party[0].learnedMoves=[{moveId,rank:1,cooldown:0}];
 const enemy=createEnemy(state,simulation.rng,19,'normal',8,0);
 Object.assign(enemy,{hp:100000,maxHp:100000,speed:0,hitCooldown:1000,attackCooldown:1000});state.enemies=[enemy];
 return {...result,enemy};
}

test('new rewards exclude one-off recruitment, evolution conditions and redundant stat-only items',()=>{
 const offered=new Set(ITEMS.map(item=>item.id));
 for(const id of ['welcome-basket','growth-charm','eviolite','nursery-stone','metal-coat','recovery-seed','quick-claw','float-stone','scope-lens','wide-lens','charged-band','lucky-egg']){
  assert.ok(getItemDefinition(id),`${id} remains readable by existing saves`);
  assert.ok(!offered.has(id),`${id} should never consume a new reward slot`);
 }
 for(const choice of ITEMS){
  const item=getItemDefinition(choice.id)!;
  assert.ok(!item.modifiers?.some(modifier=>modifier.evolution),`${item.id} must remain useful after evolving`);
  assert.ok(!item.effects?.some(effect=>effect.event==='onRecruit'||effect.event==='onEvolve'),`${item.id} must continue paying off throughout combat`);
 }
});

test('same-rarity stat passives never offer a strictly better version of another passive',()=>{
 const simple=ITEMS.map(item=>getItemDefinition(item.id)!).filter(item=>!item.effects?.length&&item.modifiers?.every(modifier=>!modifier.healthBelow&&!modifier.evolution));
 const stats=(item:ItemDefinition)=>new Map(item.modifiers!.map(modifier=>[`${modifier.stat}:${modifier.scale??'member'}`,modifier.amount]));
 for(const first of simple)for(const second of simple){
  if(first.id===second.id||first.rarity!==second.rarity)continue;
  const a=stats(first),b=stats(second),keys=[...new Set([...a.keys(),...b.keys()])];
  const dominates=keys.every(key=>(a.get(key)??0)>=(b.get(key)??0))&&keys.some(key=>(a.get(key)??0)>(b.get(key)??0));
  assert.equal(dominates,false,`${first.title} must not make ${second.title} obsolete at the same rarity`);
 }
});

test('critical effects scale with the actual hit without applying target multipliers twice',()=>{
 const {state}=arena(['static-orb']);
 const first=dispatchBuildEvent({state,rng:guaranteed},{kind:'onCrit',sourceId:1,damage:100})[0];
 assert.equal(first.kind,'chain');assert.ok(first.kind==='chain');close(first.damage,12.5);assert.equal(first.damageIsFinal,true);
 state.stats.elapsed=1;
 const stronger=dispatchBuildEvent({state,rng:guaranteed},{kind:'onCrit',sourceId:1,damage:400})[0];
 assert.ok(stronger.kind==='chain');close(stronger.damage,50);
});

test('death and special effects grow with primary move rank and percentage attack bonuses',()=>{
 const {state}=arena(['eruption-core','blast-seed']);
 const burst=()=>{
  state.stats.elapsed++;
  const action=dispatchBuildEvent({state,rng:guaranteed},{kind:'onSpecial',sourceId:1})[0];
  assert.ok(action.kind==='area');assert.equal(action.damageIsFinal,false);return action.damage;
 };
 const initial=burst();state.party[0].attackLevel=4;const ranked=burst();assert.ok(ranked>initial);
 state.buffs.power=.5;close(burst(),ranked*1.5);
 let death=dispatchBuildEvent({state,rng:guaranteed},{kind:'onDeath',sourceId:1});
 for(let index=0;index<3;index++)death=dispatchBuildEvent({state,rng:guaranteed},{kind:'onDeath',sourceId:1});
 assert.equal(death.length,1);assert.ok(death[0].kind==='area');assert.ok(death[0].damage>0);
});

test('healing effects preserve each target max-HP fraction and recovery has shared safety caps',()=>{
 const {state}=arena(['rescue-ribbon','leftovers']);
 const heal=dispatchBuildEvent({state,rng:guaranteed},{kind:'onSpecial'})[0];
 assert.ok(heal.kind==='heal');assert.equal(heal.amount,0);assert.equal(heal.maxHpFraction,.06);assert.equal(heal.target,'squad');
 close(getBuildModifiers(state).regenerationPercent,.004);close(getBuildModifiers(state).partyRegenerationPercent,.004);
 state.buffs={damageReduction:1e9,regenerationPercent:1e9,partyRegenerationPercent:1e9};
 const capped=getBuildModifiers(state);
 for(const stat of ['regenerationPercent','partyRegenerationPercent'] as const)close(capped[stat],1e9+.004);
 assert.ok(capped.defense>=1e9);assert.equal(capped.damageReduction,0);
 assert.ok(!getBuildSummary(state).caps.includes('Damage reduction capped at 60%'));
 assert.equal(getBuildSummary(state).caps.length,0);
 state.buffs={damageReduction:NaN,regenerationPercent:Infinity,partyRegenerationPercent:-9};
 const safe=getBuildModifiers(state);assert.equal(safe.damageReduction,0);close(safe.regenerationPercent,.004);assert.equal(safe.partyRegenerationPercent,0);
});

test('Leftovers restores the same fraction for differently sized party members in real simulation',()=>{
 const baseline=arena(),upgraded=arena(['leftovers']);
 for(const {simulation,state} of [baseline,upgraded]){
  state.player.hp=80;state.player.maxHp=200;
  state.party.push({...state.party[0],uid:2,speciesId:7,hp:100,maxHp:400});simulation.update(.02,idle);
 }
 close(upgraded.state.player.hp-baseline.state.player.hp,200*.004*.02);
 close(upgraded.state.party[1].hp-baseline.state.party[1].hp,400*.004*.02);
});

test('Heal Bell restores each member own max-HP percentage when a special is used',()=>{
 const baseline=arena(),upgraded=arena(['rescue-ribbon']);
 for(const {simulation,state} of [baseline,upgraded]){
  state.player.hp=80;state.player.maxHp=200;
  state.party.push({...state.party[0],uid:2,speciesId:7,hp:100,maxHp:400});simulation.update(.02,{...idle,special:true});
 }
 close(upgraded.state.player.hp-baseline.state.player.hp,12);
 close(upgraded.state.party[1].hp-baseline.state.party[1].hp,24);
});

test('Big Root counts twelve learned casts separately for each attacker',()=>{
 const {simulation,state}=learnedArena(['healing-bead']);
 state.party.push({...state.party[0],uid:2,speciesId:7,learnedMoves:[{moveId:'swift',rank:1,cooldown:0}]});
 for(let index=0;index<11;index++){
  for(const member of state.party)member.learnedMoves![0].cooldown=0;
  simulation.update(.01,idle);
 }
 close(state.player.hp,100);
 for(const member of state.party)member.learnedMoves![0].cooldown=0;
 simulation.update(.01,idle);close(state.player.hp,103);
});

test('Life Orb combines learned casts and primary attacks in its squad counter',()=>{
 const {simulation,state}=learnedArena(['life-orb']);
 state.party.push({...state.party[0],uid:2,speciesId:7,learnedMoves:[{moveId:'swift',rank:1,cooldown:0}]});
 for(let index=0;index<12;index++){
  for(const member of state.party)member.learnedMoves![0].cooldown=0;
  simulation.update(.01,idle);
 }
 close(state.player.hp,100);
 for(const member of state.party)member.learnedMoves![0].cooldown=1000;
 state.party[0].cooldown=0;simulation.update(.01,idle);
 close(state.player.hp,98);close(state.stats.damageTaken,2);
});

test('Metronome repeats the learned attack at its scaled damage without counting echoes as new casts',()=>{
 const {simulation,state,enemy}=learnedArena(['echo-bell']);
 for(let index=0;index<9;index++){
  state.party[0].learnedMoves![0].cooldown=0;simulation.update(.01,idle);
 }
 assert.equal(state.projectiles.length,30,'nine Swift casts plus one three-projectile repeat');
 assert.ok(state.projectiles.every(projectile=>projectile.moveName==='Swift'),'a learned echo must never become the primary move');
 const echoes=state.projectiles.filter(projectile=>projectile.allowProcs===false);
 assert.equal(echoes.length,3);assert.ok(echoes.every(projectile=>Math.abs(projectile.damage-6.5)<1e-9));
 // Let only the repeated center star hit. A guaranteed King's Rock roll must still stay inactive.
 const center=echoes.find(projectile=>Math.abs(projectile.vz)<1e-9)!;
 state.projectiles=[center];state.items=['kings-rock'];simulation.rng.next=()=>0;
 state.party[0].learnedMoves![0].cooldown=1000;enemy.x=3;enemy.z=0;
 for(let index=0;index<15;index++)simulation.update(.02,idle);
 assert.ok(enemy.hp<enemy.maxHp);assert.equal(enemy.stunTime,0,'echoed projectiles cannot trigger on-hit items');
});

test('a learned echo retargets after the original target dies',()=>{
 const {simulation,state,enemy}=learnedArena(['echo-bell'],'body-slam');enemy.x=1;
 for(let index=0;index<4;index++){
  state.party[0].learnedMoves![0].cooldown=0;simulation.update(.01,idle);
 }
 enemy.hp=1;
 const next=createEnemy(state,simulation.rng,19,'normal',6.5,0);
 Object.assign(next,{hp:1000,maxHp:1000,speed:0,hitCooldown:1000,attackCooldown:1000});state.enemies.push(next);
 state.party[0].learnedMoves![0].cooldown=0;simulation.update(.01,idle);
 assert.equal(enemy.dead,true);close(next.hp,1000-30*.8*.325);
});
