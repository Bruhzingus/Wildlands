import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {TRAINING_UPGRADES,PROGRESSION} from '../src/data/progression.ts';
import {ITEMS,getItemDefinition} from '../src/data/items.ts';
import {getAttackProfile} from '../src/data/attacks.ts';
import {getLearnedMoveProfile} from '../src/data/moves.ts';
import {getBuildModifiers,getBuildSummary,dispatchBuildEvent} from '../src/game/systems/builds.ts';
import {makeChoices,applyChoice,availableItemChoices} from '../src/game/systems/progression.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {attackInterval,scheduleCasts} from '../src/game/combat/cadence.ts';
import {criticalTier,criticalMultiplier} from '../src/game/combat/critical.ts';
import {applyStatusProcs} from '../src/game/combat/damage.ts';
import {upgradeStatPreview} from '../src/ui/upgradePreview.ts';
import {RNG} from '../src/utils/random.ts';

const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('Iron Defense is absent from all new rewards and stale defense cards are rejected',()=>{
 assert.ok(TRAINING_UPGRADES.every(upgrade=>!['armor','defense'].includes(upgrade.id)&&upgrade.title!=='Iron Defense'));
 const s=new Simulation(4,814).state;s.buffs.damageReduction=.16;
 for(const source of ['level','squad','shop','cache'] as const)for(let seed=1;seed<50;seed++)assert.ok(makeChoices(s,new RNG(seed),source).every(choice=>!['damageReduction','defense'].includes(choice.stat??'')&&choice.title!=='Iron Defense'));
 assert.equal(applyChoice(s,{id:'armor',kind:'stat',stat:'damageReduction',amount:.08,title:'Iron Defense',description:'',rarity:'common'}).applied,false);
 assert.equal(applyChoice(s,{id:'defense',kind:'stat',stat:'defense',amount:.2,title:'Iron Defense',description:'',rarity:'common'}).applied,false);
 assert.ok(getBuildModifiers(s).defense>0,'Existing legacy defense is preserved');
});

test('haste continues firing more attacks with unchanged damage per hit for signatures and learned moves',()=>{
 for(const learned of [false,true]){
  const results=[];
  for(const haste of [10,20,100]){
   const sim=new Simulation(7,815),s=sim.state,member=s.party[0];s.buffs.haste=haste;sim.rng.next=()=>.99;
   s.enemies=[createEnemy(s,sim.rng,19,'normal',6,0)];member.learnedMoves=learned?[{moveId:'swift',rank:1,cooldown:0}]:[];
   let hits=0;const damages=new Set<number>();
   for(let step=0;step<200;step++){
    if(learned)(sim as any).updateLearnedMoves(member,.01);else (sim as any).updateAttacks(.01);
    for(const projectile of s.projectiles){hits+=projectile.hitCount??1;damages.add(projectile.damage);}s.projectiles=[];
   }
   assert.equal(damages.size,1);results.push({hits,damage:[...damages][0]});
  }
  assert.ok(results[1].hits>results[0].hits);assert.ok(results[2].hits>results[1].hits);
  close(results[0].damage,results[1].damage);close(results[1].damage,results[2].damage);
 }
 close(attackInterval(1,9),.1);close(attackInterval(1,19),.05);
 assert.ok(attackInterval(getLearnedMoveProfile('swift',1).cooldown,100)<.35);
 assert.ok(attackInterval(getAttackProfile(7).cooldown,100)<.2);
});

test('extreme cadence keeps logical casts and counters while packet work stays bounded',()=>{
 const plan=scheduleCasts(0,.04,.0000001),casts=plan.packets.reduce((sum,count)=>sum+count,0);
 assert.equal(casts,400001);assert.ok(plan.packets.length<=PROGRESSION.moves.maxCastPacketsPerStep);
 const s=new Simulation(4,816).state;s.items=['healing-bead','healing-bead'];
 const actions=dispatchBuildEvent({state:s,rng:{next:()=>.99}},{kind:'onAttack',sourceId:1,count:casts});
 const heal=actions.find(action=>action.kind==='heal');assert.ok(heal?.kind==='heal');
 close(heal.maxHpFraction!,Math.floor(casts/12)*.03);
});

test('repeat normal and legendary relics add stats and produce accurate stack previews',()=>{
 const s=new Simulation(4,817).state;
 for(const id of ['life-orb','life-orb','life-orb-legendary'])assert.equal(applyChoice(s,ITEMS.find(choice=>choice.id===id)!).applied,true);
 close(getBuildModifiers(s).power,1.28);
 assert.deepEqual(getBuildSummary(s).items.map(item=>[item.id,item.stacks]),[['life-orb',2],['life-orb-legendary',1]]);
 assert.ok(availableItemChoices(s).some(choice=>choice.id==='life-orb'));
 const snapshot=structuredClone(s),preview=upgradeStatPreview(s,ITEMS.find(choice=>choice.id==='life-orb')!);
 assert.deepEqual(s,snapshot);assert.ok(preview.some(row=>row.label==='Copies'&&row.before==='2'&&row.after==='3'));
 assert.ok(preview.some(row=>row.label==='Damage bonus'&&row.before==='128%'&&row.after==='160%'));
});

test('stacked relic procs add effect strength without multiplying callbacks or losing drawbacks',()=>{
 const s=new Simulation(4,818).state;s.items=['static-orb','static-orb','static-orb-legendary','life-orb','life-orb'];
 const arc=dispatchBuildEvent({state:s,rng:{next:()=>0}},{kind:'onCrit',sourceId:1,damage:100});
 close(arc.reduce((sum,action)=>sum+(action.kind==='chain'?action.damage:0),0),100);
 const costs=dispatchBuildEvent({state:s,rng:{next:()=>0}},{kind:'onAttack',sourceId:1,count:25});
 assert.equal(costs.length,1);assert.ok(costs[0].kind==='selfDamage');close(costs[0].amount,4);
 s.items=['kings-rock'];assert.equal(dispatchBuildEvent({state:s,rng:{next:()=>.1}},{kind:'onHit',sourceId:1,targetId:3}).length,0);
 s.items.push('kings-rock');assert.equal(dispatchBuildEvent({state:s,rng:{next:()=>.1}},{kind:'onHit',sourceId:1,targetId:3}).length,1);
});

test('percentage stats and triggered damage keep their value past former hidden caps',()=>{
 const sim=new Simulation(4,819),s=sim.state;s.buffs={xp:3,regenerationPercent:.08,duration:5};s.items=['long-barrel','long-barrel','long-barrel','long-barrel'];
 const mod=getBuildModifiers(s);close(mod.xp,3);close(mod.regenerationPercent,.08);close(mod.projectileSpeed,1.2);close(mod.duration,5);
 const enemy=createEnemy(s,sim.rng,19,'normal',3,0);applyStatusProcs(enemy,{poison:1},()=>0,6);close(enemy.poisonTime,24);
 s.items=['prism-shard','prism-shard'];const burst=dispatchBuildEvent({state:s,rng:{next:()=>0}},{kind:'onCrit',sourceId:1,damage:100000})[0];
 assert.ok(burst.kind==='area');close(burst.damage,70000);
});

test('critical chance gives uncapped tiers and one fractional roll instead of changing critical damage',()=>{
 for(const [chance,low,high] of [[0,0,0],[.5,1,0],[1,1,1],[1.5,2,1],[2.5,3,2],[5,5,5]]){
  assert.equal(criticalTier(chance,()=>.25),low);assert.equal(criticalTier(chance,()=>.75),high);
 }
 close(criticalMultiplier(3,1.85),1.85**3);
 const s=new Simulation(4,820).state;s.buffs.crit=2.45;
 close(getBuildModifiers(s).critChance,2.5);close(getBuildModifiers(s).critDamage,1.85);
 assert.ok(Number.isFinite(criticalMultiplier(10000,1.85)));
});

test('offers reject dead benefits in no-healing and fully levelled builds',()=>{
 const s=new Simulation(4,821).state;s.challenge='famine';
 const offers=availableItemChoices(s);
 for(const id of ['leftovers','healing-bead','rescue-ribbon','shell-bell'])assert.ok(!offers.some(choice=>choice.id===id));
 s.challenge='standard';s.party[0].level=100;s.party.push({...s.party[0],uid:9});
 assert.ok(!availableItemChoices(s).some(choice=>choice.id==='exp-share'));
 assert.ok(getItemDefinition('echo-bell')?.stacking==='stack');
 const iron=ITEMS.find(choice=>choice.id==='iron-ball')!;
 assert.equal(applyChoice(s,iron).applied,true);
 assert.equal(applyChoice(s,iron).applied,true,'Numeric heavy-attack bonuses and drawbacks also stack');
 assert.equal(applyChoice(s,ITEMS.find(choice=>choice.id==='iron-ball-legendary')!).applied,true);
 close(getBuildModifiers(s).power,2.72);close(1+getBuildModifiers(s).haste,.7**3);
 s.buffs.haste=.4;close(1+getBuildModifiers(s).haste,1.4*.7**3);
 s.items.reverse();close(1+getBuildModifiers(s).haste,1.4*.7**3);
});
