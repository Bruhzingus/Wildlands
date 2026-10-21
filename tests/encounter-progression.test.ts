import test from 'node:test';
import assert from 'node:assert/strict';
import {KANTO} from '../src/data/kanto.ts';
import {getEnemySpeciesProfile} from '../src/data/enemySpecies.ts';
import {ENEMY_TIER_TUNING,getEnemyTier} from '../src/data/enemyTiers.ts';
import {ELITE_THREAT,ENCOUNTER_TABLES,RARE_ENCOUNTER,encounterWeight,maximumEncounterThreat,selectEncounter,tierEncounterChance} from '../src/data/encounters.ts';
import {LEGENDARY_SPECIES} from '../src/data/rosterContent.ts';
import {SPAWN_VARIANTS,variantThreat} from '../src/data/variants.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {updateDirector} from '../src/game/systems/director.ts';
import {rollVariant,spawnRandomEnemy} from '../src/game/systems/spawning.ts';
import {RNG} from '../src/utils/random.ts';

class LowestRoll extends RNG {override next(){return 0;}}

test('the opening progresses toward stronger ordinary species without early minibosses',()=>{
 let previous=0;
 for(const elapsed of [0,120,180,359.99]){
  const rng=new RNG(739),count=3000;let strength=0;
  for(let i=0;i<count;i++){
   const {speciesId,rare}=selectEncounter(rng,elapsed,undefined,false),profile=getEnemySpeciesProfile(speciesId);
   assert.equal(rare,false);assert.ok(profile.strength<maximumEncounterThreat(elapsed));
   assert.ok(getEnemyTier(speciesId)<=2,'A third-stage evolution cannot bypass the six-minute gate');
   strength+=profile.strength;
   if(elapsed>=180)assert.notEqual(speciesId,19,'Wild Rattata retires at three minutes');
   if(elapsed===0)assert.ok(profile.strength<=2.4,'The opening contains only weak species');
  }
  const average=strength/count;assert.ok(average>previous+.25,`${elapsed}s ordinary strength ${average} did not grow from ${previous}`);previous=average;
 }
});

test('minibosses begin sparsely and tier-two enemies remain the large majority late and in endless',()=>{
 for(const elapsed of [360,600,840,900,1800]){
  const rng=new RNG(739),count=12000;let ordinary=0,tierTwo=0,minibosses=0;
  for(let i=0;i<count;i++){
   const encounter=selectEncounter(rng,elapsed,undefined,false),tier=getEnemyTier(encounter.speciesId);
   assert.equal(encounter.rare,false);assert.ok(tier<=3);
   if(tier===3)minibosses++;
   else{ordinary++;if(tier===2)tierTwo++;}
   assert.notEqual(encounter.speciesId,19);
  }
  const chance=tierEncounterChance(3,elapsed);
  assert.ok(Math.abs(minibosses/count-chance)<.006,`${elapsed}s minibosses ${minibosses}/${count} should follow ${chance}`);
  assert.ok(ordinary/count>=.94,'Third-stage evolutions do not replace the ordinary population');
  if(elapsed>=600)assert.ok(tierTwo/count>=.94,'Tier-two Pokemon remain the late and endless population');
 }
 assert.equal(tierEncounterChance(3,359.99),0);assert.equal(tierEncounterChance(3,360),.01);
 assert.equal(tierEncounterChance(3,840),.05);
});

test('tier-four variants and legendary encounters remain scarce and cannot appear before the final two minutes',()=>{
 for(const variant of SPAWN_VARIANTS)for(const elapsed of [0,180,360,600,779.99]){
  if(1+variantThreat(variant)>=maximumEncounterThreat(elapsed))continue;
  const rng=new LowestRoll();
  for(let i=0;i<20;i++){
   const {speciesId,rare}=selectEncounter(rng,elapsed,undefined,true,variant);
   assert.equal(rare,false);assert.ok(getEnemyTier(speciesId,variant)<4);
  }
 }
 assert.equal(tierEncounterChance(4,779.99),0);assert.equal(tierEncounterChance(4,780),.0005);
 assert.equal(tierEncounterChance(4,900),.003);
 for(const elapsed of [780,900,1800]){
  const rng=new RNG(421),count=20000;let elites=0;
  for(let i=0;i<count;i++){
   const {speciesId,rare}=selectEncounter(rng,elapsed,undefined,false,'rocket');
   assert.equal(rare,false);if(getEnemyTier(speciesId,'rocket')===4)elites++;
  }
  assert.ok(elites>0,'The late elite lottery is reachable');
  assert.ok(Math.abs(elites/count-tierEncounterChance(4,elapsed))<.001,`${elapsed}s tier-four arrivals ${elites}/${count}`);
  assert.ok(elites/count<.004,'Variants of minibosses remain rare even with an all-Rocket faction override');
 }
 const rng=new RNG(814),count=20000;let legendary=0;
 for(let i=0;i<count;i++){
  const encounter=selectEncounter(rng,900,undefined,true);
  if(encounter.rare){legendary++;assert.ok(ENCOUNTER_TABLES.rare.includes(encounter.speciesId));}
 }
 assert.ok(legendary>0&&Math.abs(legendary/count-RARE_ENCOUNTER.chance)<.0008);
 for(const limits of [{allowTier4:false},{allowTier3:false,allowTier4:false}]){
  for(const variant of ['normal','rocket'] as const){
   const encounter=selectEncounter(new LowestRoll(),900,undefined,true,variant,limits);
   assert.equal(encounter.rare,false);assert.ok(getEnemyTier(encounter.speciesId,variant)<4);
  }
 }
});

test('weak wild Pokemon retire while their stronger variants remain useful a little longer',()=>{
 for(const id of [10,13,19,129]){
  assert.ok(encounterWeight(id,0)>0);assert.equal(encounterWeight(id,180),0);
  assert.equal(encounterWeight(id,900),0);assert.equal(encounterWeight(id,3600),0);
  assert.ok(encounterWeight(id,240,'rocket')>0);assert.equal(encounterWeight(id,420,'rocket'),0);
 }
 assert.ok(encounterWeight(149,900)>0);assert.ok(encounterWeight(149,3600)>0,'Endless retains strong encounters');
 assert.equal(encounterWeight(12,359.99),0);assert.ok(encounterWeight(12,360)>0,'A modest third-stage species still has a miniboss window');
});

test('Dragonite variants obey both their late elite gate and natural threat eligibility',()=>{
 for(const variant of SPAWN_VARIANTS){
  const threatEarliest=(10+variantThreat(variant)-2.4)*85;
  const tierEarliest=variant==='normal'?ENEMY_TIER_TUNING.tier3.earliestSeconds:ENEMY_TIER_TUNING.tier4.earliestSeconds;
  const earliest=Math.max(threatEarliest,tierEarliest);
  for(const elapsed of [0,180,360,600,earliest-.01])assert.equal(encounterWeight(149,elapsed,variant),0);
  assert.ok(encounterWeight(149,earliest+30,variant)>0,`${variant} Dragonite has a genuine eligible window`);
 }
 const rocketEarliest=(10+variantThreat('rocket')-2.4)*85;
 assert.ok(rocketEarliest>830&&rocketEarliest<834);
 assert.equal(encounterWeight(149,rocketEarliest-.01,'rocket'),0);
 assert.ok(encounterWeight(149,rocketEarliest+.01,'rocket')>0);
 assert.equal(getEnemyTier(149,'rocket'),4);
 assert.ok(tierEncounterChance(4,900)<=.003,'Natural rarity is further constrained by the elite lottery');
});

test('live director spawns obey species, variant and elite threat ceilings without bypassing tier gates',()=>{
 const s=new Simulation(7,25).state;s.enemies=[];
 for(const elapsed of [0,15,60,180,359.99,360,660,779.99,840,900,1800]){
  s.stats.elapsed=elapsed;const director=updateDirector(s),rng=new RNG(991);
  for(let i=0;i<700;i++){
   const enemy=spawnRandomEnemy(s,rng,{speciesTier:director.speciesTier,variantWeights:director.variantWeights,allowRare:false})!;
   const threat=getEnemySpeciesProfile(enemy.speciesId).strength+variantThreat(enemy.variant)+(enemy.elite?ELITE_THREAT:0);
   assert.ok(threat<=maximumEncounterThreat(elapsed),`${elapsed}s #${enemy.speciesId} ${enemy.variant} exceeds the threat window`);
   if(elapsed<360)assert.ok(enemy.combatTier!<=2);
   if(elapsed<780)assert.ok(enemy.combatTier!<4);
   if(elapsed===0){assert.equal(enemy.variant,'normal');assert.equal(enemy.elite,false);}
   if(elapsed>=180&&enemy.variant==='normal')assert.notEqual(enemy.speciesId,19);
  }
 }
});

test('actual spawns enforce miniboss and elite spacing, alive caps and release capacity after a death',()=>{
 for(const [tier,variant,start] of [[3,'normal',360],[4,'rocket',840]] as const){
  const s=new Simulation(7,25).state;s.enemies=[];
  const tuning=tier===3?ENEMY_TIER_TUNING.tier3:ENEMY_TIER_TUNING.tier4;
  const spawnAt=(elapsed:number)=>{
   s.stats.elapsed=elapsed;
   const enemy=spawnRandomEnemy(s,new LowestRoll(),{variantWeights:{[variant]:1},allowRare:false});
   assert.ok(enemy);return enemy;
  };
  const first=spawnAt(start);assert.equal(first.combatTier,tier);s.enemies.push(first);
  if(tier===4)first.dead=true;
  assert.ok(spawnAt(start+tuning.minimumSpacingSeconds-.01).combatTier!<=2,'Spacing still applies when alive capacity is available');
  let time=start+tuning.minimumSpacingSeconds;
  while(s.enemies.filter(enemy=>!enemy.dead&&enemy.combatTier===tier).length<tuning.maxAlive){
   const next=spawnAt(time);assert.equal(next.combatTier,tier,'An arrival becomes eligible at the exact spacing boundary');
   s.enemies.push(next);time+=tuning.minimumSpacingSeconds;
  }
  assert.ok(spawnAt(time).combatTier!<=2,'Living minibosses prevent another arrival even after enough time passes');
  s.enemies.find(enemy=>!enemy.dead&&enemy.combatTier===tier)!.dead=true;
  assert.equal(spawnAt(time).combatTier,tier,'A dead enemy releases its tier capacity without waiting for array cleanup');
 }
});

test('Mewtwo suppresses new minibosses and elites, with both budgets restored after continuing endless',()=>{
 for(const variant of ['normal','rocket'] as const){
  const s=new Simulation(7,25).state;s.enemies=[];s.stats.elapsed=900;s.bossSpawned=true;
  for(let i=0;i<10;i++){
   const enemy=spawnRandomEnemy(s,new LowestRoll(),{variantWeights:{[variant]:1},allowRare:true});
   assert.ok(enemy);assert.ok(enemy.combatTier!<=2,'Neither the elite lottery nor legendary lottery may intrude on Mewtwo');
  }
  assert.equal(s.lastTier3Spawn,undefined);assert.equal(s.lastTier4Spawn,undefined);
  s.stats.bossKilled=true;s.endless=true;
  const enemy=spawnRandomEnemy(s,new LowestRoll(),{variantWeights:{[variant]:1},allowRare:false});
  assert.ok(enemy);assert.equal(enemy.combatTier,variant==='normal'?3:4);
 }
});

test('every ordinary species has a viable active-pool window and all faction draws remain viable',()=>{
 const seen=new Set<number>();
 for(let elapsed=0;elapsed<=900;elapsed+=15){
  const pool=elapsed<180?'early':elapsed<660?'mid':'late';
  for(const speciesId of ENCOUNTER_TABLES[pool])if(encounterWeight(speciesId,elapsed)>0)seen.add(speciesId);
  const rng=new RNG(700+elapsed);
  for(let i=0;i<150;i++){
   const variant=rollVariant(rng,elapsed,{normal:1,dark:1,rocket:1,rabid:1,poisoned:1});
   const encounter=selectEncounter(rng,elapsed,pool,false,variant);
   assert.ok(encounterWeight(encounter.speciesId,elapsed,variant)>0);
  }
 }
 assert.deepEqual([...seen].sort((a,b)=>a-b),KANTO.filter(species=>!LEGENDARY_SPECIES.includes(species.id)).map(species=>species.id));
});

test('restricted debug pools keep viable ordinary enemies without resurrecting weak species and seeds stay reproducible',()=>{
 const sample=(rng:RNG)=>Array.from({length:150},()=>selectEncounter(rng,900,'early',false,'normal',{allowTier3:false,allowTier4:false}));
 const encounters=sample(new RNG(272));assert.deepEqual(encounters,sample(new RNG(272)));
 assert.ok(encounters.every(({speciesId})=>getEnemyTier(speciesId)===2&&encounterWeight(speciesId,900)>0));
 for(const {speciesId} of encounters)assert.ok(![10,13,19,129].includes(speciesId));
});
