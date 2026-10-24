import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {TRAINING_UPGRADES,trainingVariants,trainingDescription} from '../src/data/progression.ts';
import {ITEMS} from '../src/data/items.ts';
import {applyChoice,xpThreshold} from '../src/game/systems/progression.ts';
import {createEnemy,spawnRandomEnemy,lateEnemyScale} from '../src/game/systems/spawning.ts';
import {getBuildModifiers,metronomeDamageMultiplier,METRONOME_MAX_HITS} from '../src/game/systems/builds.ts';
import {updateDirector} from '../src/game/systems/director.ts';
import {createUpgradeCatalogue} from '../src/ui/upgradeCatalogueData.ts';
import {upgradeStatPreview} from '../src/ui/upgradePreview.ts';
import {RNG} from '../src/utils/random.ts';
import {runLateRunExperiment} from '../scripts/late-run-balance.mjs';
import {runEndlessExperiment} from '../scripts/endless-balance.mjs';

const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

test('personal training uses rounded smaller bonuses in validation, descriptions, previews and catalogue',()=>{
 const power=TRAINING_UPGRADES.find(upgrade=>upgrade.id==='power')!;
 assert.deepEqual(trainingVariants(power,true).map(variant=>variant.amount),[.07,.13,.21,.34]);
 assert.deepEqual(trainingVariants(power).map(variant=>variant.amount),[.08,.15,.25,.4]);
 for(const upgrade of TRAINING_UPGRADES)for(const variant of trainingVariants(upgrade,true)){
  close(variant.amount*(upgrade.stat==='staminaCapacity'?1:100),Math.round(variant.amount*(upgrade.stat==='staminaCapacity'?1:100)));
  close(variant.rechargeReduction*100,Math.round(variant.rechargeReduction*100));
 }
 const s=new Simulation(9,511).state;s.choiceSource='level';s.levelUpMemberId=1;
 const card={id:'power',title:power.title,description:trainingDescription(power,'common',true),kind:'stat' as const,
  stat:'power',amount:.07,rarity:'common' as const,speciesId:1,rank:1};
 assert.match(card.description,/\+7%/);
 assert.deepEqual(upgradeStatPreview(s,card),[{label:'Damage bonus',before:'0%',after:'7%'}]);
 assert.equal(applyChoice(s,{...card,amount:.08}).applied,false);
 assert.equal(applyChoice(s,card).applied,true);close(getBuildModifiers(s).power,.07);
 const catalogue=createUpgradeCatalogue().find(entry=>entry.id==='training:power:common')!;
 assert.ok(catalogue.stats.some(stat=>stat.label==='Per selection'&&stat.value==='+7%'));
 assert.ok(catalogue.details.some(detail=>detail.label==='Squad reward'&&detail.text.includes('+8%')));
});

test('one half-strength Loaded Dice can add a projectile and two copies guarantee it',()=>{
 for(const [copies,roll,expected] of [[1,.49,2],[1,.5,1],[2,.99,2],[3,.49,3],[3,.5,2]]){
  const sim=new Simulation(7,512),s=sim.state;s.items=Array(copies).fill('multi-lens');
  const enemy=createEnemy(s,sim.rng,19,'normal',6,0);s.enemies=[enemy];sim.rng.next=()=>roll;
  (sim as any).fireFromMember(s.party[0],enemy);
  assert.equal(s.projectiles.length,expected);
 }
});

test('Rare Candy fractional levels retain XP progress and respect the cap and fainted members',()=>{
 const sim=new Simulation(9,513),s=sim.state;
 s.party[0].xp=20;
 s.party.push({...structuredClone(s.party[0]),uid:2,hp:0});
 const candy=ITEMS.find(item=>item.id==='rare-candy')!;
 assert.equal(applyChoice(s,candy).applied,true);
 close(s.party[0].xp!,20+xpThreshold(1)*.5);close(s.party[1].xp!,20);
 assert.equal(applyChoice(s,candy).applied,true);
 (sim as any).queueLevelUps();assert.equal(s.party[0].level,2);close(s.party[0].xp!,20);
 s.party[0].level=99;s.party[0].xp=20;s.party[0].xpToNext=xpThreshold(99);
 assert.equal(applyChoice(s,ITEMS.find(item=>item.id==='rare-candy-legendary')!).applied,true);
 (sim as any).queueLevelUps();assert.equal(s.party[0].level,100);
 assert.equal(applyChoice(s,candy).applied,false);
});

test('Metronome caps sustained and batched hits identically and resets on a new target',()=>{
 const single=new Simulation(9,514).state,batched=new Simulation(9,514).state;
 single.items=batched.items=['metronome-ramp'];
 for(const count of [1,2,25,100000]){
  let sum=0;for(let hit=0;hit<count;hit++)sum+=metronomeDamageMultiplier(single,77);
  close(metronomeDamageMultiplier(batched,77,count),sum/count);
 }
 assert.equal(single.build!.metronomeHits,METRONOME_MAX_HITS);
 close(metronomeDamageMultiplier(single,77),2);close(metronomeDamageMultiplier(single,78),1);
});

test('minute-eight endurance growth is continuous and endless health keeps outpacing damage past the former cap',()=>{
 const before=lateEnemyScale(480,19,1),after=lateEnemyScale(480.001,19,1);
 assert.ok(after.health>before.health&&after.health-before.health<.0001);
 const s=new Simulation(9,515).state;s.endless=true;s.stats.elapsed=1980;
 const director=updateDirector(s);close(director.endlessScale,16);close(director.endlessDamageScale,2.65);
 const tuning={speciesTier:'late' as const,allowRare:false};
 const plain=spawnRandomEnemy(structuredClone(s),new RNG(2),tuning)!;
 const scaled=spawnRandomEnemy(structuredClone(s),new RNG(2),{...tuning,healthScale:director.endlessScale,damageScale:director.endlessDamageScale})!;
 assert.equal(plain.speciesId,scaled.speciesId);close(scaled.maxHp/plain.maxHp,16);close(scaled.damage/plain.damage,2.65);
 assert.equal(scaled.speed,plain.speed);assert.equal(scaled.attackCooldown,plain.attackCooldown);
 s.stats.elapsed=2700;const later=updateDirector(s);close(later.endlessScale,36);close(later.endlessDamageScale,3.75);
 assert.equal(scaled.maxHp,plain.maxHp*16,'Existing enemies keep their spawn stats');
});

test('a developed level-48 squad needs about two minutes for the Gyarados shrine and Moltres',()=>{
 for(const result of runLateRunExperiment()){
  assert.equal(result.defeated,true,JSON.stringify(result));
  assert.ok(result.seconds>=105&&result.seconds<=135,JSON.stringify(result));
  assert.ok(result.openingBurstFraction<.05,JSON.stringify(result));
 }
});

test('the reported endless composition cannot sustain standing still against ordinary enemies',()=>{
 const result=runEndlessExperiment();assert.equal(result.result,'defeat',JSON.stringify(result));
 assert.ok(result.seconds<60&&result.damageHits>0,JSON.stringify(result));
});
