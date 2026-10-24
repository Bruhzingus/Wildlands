import test from 'node:test';
import assert from 'node:assert/strict';
import {KANTO,getSpecies} from '../src/data/kanto.ts';
import {ITEMS,ITEM_DEFINITIONS,getItemDefinition} from '../src/data/items.ts';
import {SYNERGIES,getActiveSynergies} from '../src/data/synergies.ts';
import {BUILD_LIMITS,BUILD_STAT_CAPS,dispatchBuildEvent,getBuildModifiers,getBuildSummary} from '../src/game/systems/builds.ts';
import type {Enemy,PartyMember,RunState} from '../src/game/types.ts';
import {RNG} from '../src/utils/random.ts';

function member(speciesId:number,uid=1):PartyMember{return {uid,speciesId,joinedAt:0,level:1,hp:100,maxHp:100,iframes:0,attackLevel:1,cooldown:0,x:0,z:0,facing:0,animation:'idle',attackTimer:0};}
function state(species:number[]= [1],items:string[]=[]):RunState{return {
 phase:'playing',result:null,seed:17,player:{x:0,z:0,y:0,vy:0,facing:0,hp:100,maxHp:120,iframes:0,poisonTime:0,dodgeTime:0,dodgeCooldown:0,specialCooldown:10,specialCharge:0},
 party:species.map((id,index)=>member(id,index+1)),enemies:[],projectiles:[],drops:[],pois:[],
 stats:{kills:0,recruits:0,evolutions:0,level:1,xp:0,xpToNext:50,elapsed:0,damageDealt:0,damageTaken:0,faints:0,bossKilled:false,highestCombo:0},
 items,buffs:{},recruitCount:0,pendingRecruit:false,upgradeChoices:[],choiceTitle:'',bossSpawned:false,endless:false,lastEnemySpawn:0,eventLog:[],idCounter:40,lastSpecialAt:-999,
};}
function enemy(uid=40):Enemy{return {uid,speciesId:19,variant:'normal',x:2,z:0,hp:100,maxHp:100,speed:0,damage:1,size:1,facing:0,animation:'idle',attackTimer:0,hitCooldown:0,attackCooldown:0,poisonTime:0,burnTime:0,slowTime:0,soakedTime:0,stunTime:0,elite:false,dead:false,isBoss:false};}
const guaranteed={next:()=>0};
const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);

test('item registry preserves legacy definitions while reward offers use the curated recurring passives',()=>{
 assert.ok(ITEM_DEFINITIONS.length>=30);assert.equal(new Set(ITEM_DEFINITIONS.map(item=>item.id)).size,ITEM_DEFINITIONS.length);
 assert.deepEqual(ITEMS.map(choice=>choice.id),ITEM_DEFINITIONS.filter(item=>item.offerable!==false).map(item=>item.id));
 for(const item of ITEM_DEFINITIONS){
  assert.equal(item.maxStacks,item.stacking==='unique'?1:Infinity);assert.match(item.description,/\d/);
  assert.ok(item.modifiers?.length||item.effects?.length||item.consecutiveTargetDamage||item.levelGain,`${item.id} must affect gameplay`);
  assert.equal(getItemDefinition(item.id),item);
 }
 for(const id of ['echo-bell','multi-lens','static-orb','leftovers','exp-share','life-orb','kings-rock','shell-bell','eviolite','charged-band'])assert.ok(getItemDefinition(id));
});

test('relic copies stack, unknown ids are ignored and buff aliases apply once',()=>{
 const s=state([1],['life-orb','life-orb','multi-lens','not-a-relic']);s.buffs={power:.18,haste:.14,crit:.06};
 const modifiers=getBuildModifiers(s);close(modifiers.power,.5);close(modifiers.haste,.14);close(modifiers.critChance,.11);
 assert.equal(modifiers.critDamage,1.85);assert.equal(modifiers.projectiles,.5);
 assert.deepEqual(getBuildSummary(s).items.map(item=>item.id),['life-orb','multi-lens']);
});

test('training stats grow past old caps while relic budgets and invalid-input guards remain',()=>{
 const s=state([1],['multi-lens','storm-coil','piercing-fang']);s.buffs={power:10,haste:10,crit:2,speed:10,radius:10,magnet:1e9,xp:1e9,armor:1e9};
 const modifiers=getBuildModifiers(s);
 for(const stat of ['power','haste','speed','radius'] as const)assert.equal(modifiers[stat],10);
 close(modifiers.critChance,2.05);close(modifiers.critDamage,1.85);
 for(const stat of ['magnet','xp'] as const)assert.equal(modifiers[stat],1e9);
 close(modifiers.armor,getSpecies(1).defense*(1+1e8));assert.equal(getBuildSummary(s).caps.length,0);
 s.buffs={power:Infinity,crit:NaN,speed:-999};const safe=getBuildModifiers(s);assert.equal(safe.power,0);assert.equal(safe.critChance,.05);assert.equal(safe.speed,-.5);
 assert.ok(Object.values(safe).every(Number.isFinite));
});

test('heavy attacks and unevolved investment have real, species-sensitive drawbacks',()=>{
 const s=state([1,3,83],['iron-ball','nursery-stone','eviolite']);
 close(getBuildModifiers(s,1).power,.325+.225+.11+.12);close(getBuildModifiers(s,1).haste,-.3);
 close(getBuildModifiers(s,2).power,.325-.2+.12);close(getBuildModifiers(s,3).power,.325-.2+.12);
 s.party[0].speciesId=3;close(getBuildModifiers(s,1).power,.325-.2+.12);
});

test('assigned item ownership follows a member and deactivates on permanent faint',()=>{
 const s=state([1,4],['life-orb','echo-bell']);
 s.build={counters:{},cooldownUntil:{},budgetWindow:-1,actionsInWindow:0,itemOwners:{'life-orb':2,'echo-bell':2}};
 assert.equal(getBuildModifiers(s,1).power,0);close(getBuildModifiers(s,2).power,.16);
 for(let i=0;i<10;i++)assert.deepEqual(dispatchBuildEvent({state:s,rng:guaranteed},{kind:'onAttack',sourceId:1,targetId:40}),[]);
 for(let i=0;i<4;i++)assert.deepEqual(dispatchBuildEvent({state:s,rng:guaranteed},{kind:'onAttack',sourceId:2,targetId:40}),[]);
 assert.equal(dispatchBuildEvent({state:s,rng:guaranteed},{kind:'onAttack',sourceId:2,targetId:40})[0]?.kind,'echo');
 s.party.splice(1,1);assert.equal(getBuildModifiers(s).power,0);assert.equal(getBuildSummary(s).items.length,0);
});

test('echo and life-orb use shared attack counters, healing bead uses per-member counters',()=>{
 const s=state([1,4],['echo-bell','life-orb','healing-bead']);let echo=0,cost=0,heals=0;
 for(let i=1;i<=25;i++){
  const actions=dispatchBuildEvent({state:s,rng:guaranteed},{kind:'onAttack',sourceId:i%2?1:2,targetId:40});
  echo+=actions.filter(action=>action.kind==='echo').length;cost+=actions.filter(action=>action.kind==='selfDamage').length;heals+=actions.filter(action=>action.kind==='heal').length;
 }
 assert.equal(echo,5);assert.equal(cost,1);assert.equal(heals,2);
 assert.ok(Object.keys(s.build!.counters).length<=6,'counter storage is bounded by owned rules and party slots');
});

test('all seven event hooks dispatch generic actions with damage attribution and depth',()=>{
 const s=state([25],['static-orb','prism-shard','kings-rock','shell-bell','rescue-ribbon','eruption-core','welcome-basket','growth-charm']);s.enemies=[enemy()];
 const context={state:s,rng:guaranteed};
 const crit=dispatchBuildEvent(context,{kind:'onCrit',targetId:40,damage:100,element:'electric'});
 assert.deepEqual(crit.map(action=>action.kind),['chain','area']);assert.equal(crit[0].sourceId,1);assert.equal(crit[0].element,'electric');assert.equal(crit[0].depth,1);
 assert.equal(crit.find(action=>action.kind==='area')?.damage,17.5);
 assert.equal(crit.find(action=>action.kind==='area')?.damageIsFinal,true,'percentages of an actual hit must not apply type/status multipliers again');
 assert.equal(crit.find(action=>action.kind==='chain')?.damage,12.5);
 assert.equal(crit.find(action=>action.kind==='chain')?.damageIsFinal,true,'arcs use a fraction of the final hit without repeating target multipliers');
 const hit=dispatchBuildEvent(context,{kind:'onHit',targetId:40});assert.equal(hit[0].kind,'status');
 s.stats.elapsed=.2;
 assert.deepEqual(dispatchBuildEvent(context,{kind:'onSpecial'}).map(action=>action.kind),['heal','area']);
 assert.deepEqual(dispatchBuildEvent(context,{kind:'onRecruit',sourceId:1}).map(action=>action.kind),['heal','xp']);
 assert.deepEqual(dispatchBuildEvent(context,{kind:'onEvolve',sourceId:1}).map(action=>action.kind),['heal','specialCharge']);
 s.stats.elapsed=.4;
 for(let i=0;i<14;i++)assert.equal(dispatchBuildEvent(context,{kind:'onDeath'}).length,0);
 const kill=dispatchBuildEvent(context,{kind:'onDeath'});assert.equal(kill[0]?.kind,'heal');
 const attackState=state([1],['echo-bell']);for(let i=0;i<4;i++)dispatchBuildEvent({state:attackState,rng:guaranteed},{kind:'onAttack'});
 assert.equal(dispatchBuildEvent({state:attackState,rng:guaranteed},{kind:'onAttack'})[0]?.kind,'echo');
});

test('proc recursion stays blocked while effect strength and duration keep scaling',()=>{
 const s=state([25],['kings-rock','frost-charm','toxic-barb','binding-thread','prism-shard']);s.enemies=[enemy()];
 const context={state:s,rng:guaranteed};let actions=0;
 for(let i=0;i<100;i++)actions+=dispatchBuildEvent(context,{kind:'onHit',targetId:40}).length;
 assert.equal(actions,300);
 s.stats.elapsed=.11;
 const next=dispatchBuildEvent(context,{kind:'onHit',targetId:40});assert.equal(next.length,3);
 const poison=next.find(action=>action.kind==='status'&&action.status==='poison');assert.ok(poison&&poison.kind==='status');close(poison.duration,1.8);
 for(const depth of [1,2,100,-1])assert.equal(dispatchBuildEvent(context,{kind:'onHit',targetId:40,depth}).length,0);
 const huge=dispatchBuildEvent(context,{kind:'onCrit',damage:1e12,targetId:40});assert.equal(huge[0]?.kind,'area');assert.ok(huge[0]?.kind==='area');assert.equal(huge[0].damage,1.75e11);
 assert.equal(dispatchBuildEvent(context,{kind:'onHit',sourceId:999,targetId:40}).length,0);
});

test('cooldowns are shared across squad members and random procs are reproducible',()=>{
 const s=state([25,7],['static-orb']);s.enemies=[enemy()];
 const context={state:s,rng:guaranteed};assert.equal(dispatchBuildEvent(context,{kind:'onCrit',sourceId:1,targetId:40}).length,1);
 assert.equal(dispatchBuildEvent(context,{kind:'onCrit',sourceId:2,targetId:40}).length,0);
 s.stats.elapsed=.151;assert.equal(dispatchBuildEvent(context,{kind:'onCrit',sourceId:2,targetId:40}).length,1);
 function sequence(seed:number){const run=state([1],['kings-rock','toxic-barb']);run.enemies=[enemy()];const rng=new RNG(seed),result=[];
  for(let i=0;i<100;i++){run.stats.elapsed=i*.11;result.push(dispatchBuildEvent({state:run,rng},{kind:'onHit',targetId:40}));}return result;}
 assert.deepEqual(sequence(1234),sequence(1234));assert.notDeepEqual(sequence(1234),sequence(1235));
});

test('at least eight distinct team compositions activate meaningful team rules',()=>{
 assert.ok(SYNERGIES.length>=8);assert.equal(new Set(SYNERGIES.map(synergy=>synergy.id)).size,SYNERGIES.length);
 const compositions:Array<[string,number[]]>=[['elemental-bond',[4,5]],['storm-circuit',[25,100]],['conductive-tide',[7,25]],['wildfire',[1,4]],['venom-flare',[23,4]],['permafrost',[7,124]],['shadow-focus',[63,92]],['guardian-line',[74,27]],['fighting-spirit',[66,19]]];
 for(const [id,party] of compositions){
  const synergy=getActiveSynergies(state(party)).find(active=>active.id===id);assert.ok(synergy,`${id} should activate`);
  assert.ok(synergy.modifiers?.length||synergy.effects?.length);assert.match(synergy.description,/\d/);
 }
 const healer=KANTO.find(species=>species.attack==='heal')!;assert.ok(healer);
 assert.ok(getActiveSynergies(state([1,healer.id])).some(synergy=>synergy.id==='restorative-roots'));
 const wide=KANTO.filter(species=>['slash','aura','burst'].includes(species.attack)).slice(0,2).map(species=>species.id);
 assert.ok(getActiveSynergies(state(wide)).some(synergy=>synergy.id==='wide-front'));
});

test('team synergies update immediately after recruitment, evolution and fainting',()=>{
 const s=state([4,5,6]);close(getBuildModifiers(s).power,.155);
 assert.equal(getActiveSynergies(state([74])).length,0,'one dual-type member cannot activate a team synergy alone');
 const water=state([7,133]);assert.ok(!getActiveSynergies(water).some(synergy=>synergy.id==='elemental-bond'));
 water.party[1].speciesId=134;assert.ok(getActiveSynergies(water).some(synergy=>synergy.id==='elemental-bond'));
 water.party[1].hp=0;assert.equal(getActiveSynergies(water).length,0);
 const electric=state([25]);assert.equal(getBuildModifiers(electric).chains,0);
 electric.party.push(member(100,2));assert.equal(getBuildModifiers(electric).chains,2);
 electric.party.splice(1,1);assert.equal(getBuildModifiers(electric).chains,0);
});

test('paired team requirements need distinct contributors even for dual-type members',()=>{
 assert.ok(!getActiveSynergies(state([74,25])).some(synergy=>synergy.id==='guardian-line'),'Geodude cannot supply both Rock and Ground alongside an unrelated member');
 assert.ok(!getActiveSynergies(state([131,25])).some(synergy=>synergy.id==='permafrost'),'Lapras cannot supply both Water and Ice alongside an unrelated member');
 assert.ok(getActiveSynergies(state([74,27])).some(synergy=>synergy.id==='guardian-line'));
 assert.ok(getActiveSynergies(state([131,7])).some(synergy=>synergy.id==='permafrost'),'assign Lapras to Ice and Squirtle to Water');
 assert.ok(getActiveSynergies(state([74,95])).some(synergy=>synergy.id==='guardian-line'),'two dual-type members can contribute one requirement each');
});

test('party changes refresh synergy contributors without leaking between runs or caching health-sensitive stats',()=>{
 const first=state([25,100],['focus-sash']),second=state([7,133]);
 assert.ok(getActiveSynergies(first).some(synergy=>synergy.id==='storm-circuit'));assert.ok(!getActiveSynergies(second).some(synergy=>synergy.id==='storm-circuit'||synergy.id==='elemental-bond'));
 first.party[1].uid=55;assert.ok(getActiveSynergies(first).find(synergy=>synergy.id==='storm-circuit')?.members.includes(55));
 assert.ok(!getActiveSynergies(first).find(synergy=>synergy.id==='storm-circuit')?.members.includes(2));
 close(getBuildModifiers(first).power,.12);first.player.hp=30;close(getBuildModifiers(first).power,.245);
 first.buffs.power=.18;close(getBuildModifiers(first).power,.425);first.items=[];close(getBuildModifiers(first).power,.3);
 first.party[1].hp=0;close(getBuildModifiers(first).power,.18);assert.equal(getBuildModifiers(first).chains,0);
 second.party[1].speciesId=134;close(getBuildModifiers(second).power,.12);
});

test('element and target-status requirements keep interaction procs specific',()=>{
 const s=state([7,25]);s.enemies=[enemy()];const context={state:s,rng:guaranteed};
 assert.equal(dispatchBuildEvent(context,{kind:'onHit',sourceId:2,targetId:40,element:'electric',damage:80}).length,0);
 s.enemies[0].soakedTime=3;
 assert.equal(dispatchBuildEvent(context,{kind:'onHit',sourceId:2,targetId:40,element:'normal',damage:80}).length,0);
 const actions=dispatchBuildEvent(context,{kind:'onHit',sourceId:2,targetId:40,element:'electric',damage:80});
 assert.equal(actions.length,1);assert.equal(actions[0].kind,'chain');assert.ok(actions[0].kind==='chain');assert.equal(actions[0].damage,20);assert.equal(actions[0].jumps,2);
});

test('build summary is deterministic, serializable and reflects actual owned definitions',()=>{
 const s=state([25,100],['storm-coil','multi-lens','storm-coil']);const before=JSON.stringify(s);const summary=getBuildSummary(s);
 assert.deepEqual(summary,getBuildSummary(s));assert.equal(JSON.stringify(s),before,'reading a summary must not mutate the run');
 assert.equal(summary.items.length,2);assert.equal(summary.items.find(item=>item.id==='storm-coil')!.stacks,2);assert.ok(summary.synergies.some(synergy=>synergy.id==='storm-circuit'));
 assert.equal(summary.modifiers.chains,4);assert.equal(summary.modifiers.projectiles,.5);assert.ok(JSON.parse(JSON.stringify(summary)));
 assert.equal(getSpecies(s.party[0].speciesId).types[0],'electric');
});

test('death healing counts triggered kills while offensive death effects cannot recurse',()=>{
 const s=state([1],['shell-bell','blast-seed']);const context={state:s,rng:guaranteed};
 for(let i=0;i<14;i++)assert.deepEqual(dispatchBuildEvent(context,{kind:'onDeath',targetId:40,depth:1}),[]);
 const actions=dispatchBuildEvent(context,{kind:'onDeath',targetId:40,depth:1});assert.equal(actions.length,1);assert.equal(actions[0].kind,'heal');assert.equal(actions[0].depth,2);
 assert.equal(Object.keys(s.build!.counters).length,1,'triggered kills never increment the explosion counter');
});

test('six-member all-item storm has bounded proc output and bounded runtime storage',()=>{
 const s=state([25,100,7,1,4,92],ITEMS.map(item=>item.id));s.enemies=Array.from({length:240},(_,index)=>({...enemy(40+index),soakedTime:3,poisonTime:3}));
 const rng=new RNG(777);let produced=0;
 for(let window=0;window<100;window++){
  s.stats.elapsed=window*.101;let inWindow=0;
  for(let event=0;event<120;event++){
   const source=s.party[event%6],kind=event%7===0?'onAttack':event%7===1?'onCrit':event%7===2?'onDeath':event%7===3?'onSpecial':'onHit';
   const actions=dispatchBuildEvent({state:s,rng},{kind,sourceId:source.uid,targetId:40+event%240,damage:500,element:getSpecies(source.speciesId).types[0]});
   assert.ok(actions.length<=BUILD_LIMITS.maxActionsPerEvent);inWindow+=actions.filter(action=>['echo','chain','area','status'].includes(action.kind)).length;
   for(const action of actions)assert.ok(action.depth<=BUILD_LIMITS.maxProcDepth);
  }
  assert.ok(inWindow<=BUILD_LIMITS.maxActionsPerWindow);produced+=inWindow;
 }
 assert.ok(produced>100);assert.ok(JSON.stringify(s.build).length<4000,'runtime bookkeeping must not grow with hit targets or run duration');
});
