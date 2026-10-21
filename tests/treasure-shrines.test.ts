import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {CHEST_TIERS,SHRINE,chestCost,chestRarity} from '../src/data/economy.ts';
import {createPOIs} from '../src/game/systems/environment.ts';
import {createGuardian} from '../src/game/systems/spawning.ts';
import {chestChoices} from '../src/game/systems/progression.ts';
import type {POI} from '../src/game/types.ts';
import {DESIGN} from '../src/data/config.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
function arena(kind:POI['kind']='shrine'){
 const sim=new Simulation(7,194),s=sim.state;
 const site:POI={uid:301,x:0,z:0,kind,used:false};
 s.pois=[site];s.enemies=[];s.recruitCount=5;s.player.iframes=10000;s.party[0].cooldown=10000;
 (sim as any).spawnAccum=-10000;
 return {sim,s,site,activate:()=>{(sim as any).activatePOI(site);}};
}

test('seeded treasure offers one chest of each tier and two permanent discovery caches',()=>{
 for(const seed of [1,194,999]){
  const treasure=createPOIs(seed).filter(p=>p.kind==='cache');
  assert.deepEqual(treasure.filter(p=>p.price!==undefined).slice(0,3).map(p=>p.rarity),['common','rare','epic']);
  assert.equal(treasure.filter(p=>p.price===undefined&&!p.availableAt).length,2);
 }
});

test('paid rewards honor their rarity, sort by rarity and respect unlocks and ownership',()=>{
 const {sim,s}=arena('cache'),rank={common:0,rare:1,epic:2,legendary:3};
 for(const rarity of ['common','rare','epic'] as const){
  const choices=chestChoices(s,sim.rng,rarity);
  assert.equal(choices.length,3);assert.equal(new Set(choices.map(c=>c.id)).size,3);
  assert.ok(choices.every(c=>c.kind==='item'&&rank[c.rarity]>=rank[rarity]));
  assert.deepEqual(choices.map(c=>rank[c.rarity]),choices.map(c=>rank[c.rarity]).sort((a,b)=>b-a));
 }
 s.itemUnlocks=['life-orb'];
 const limited=chestChoices(s,sim.rng,'epic');
 assert.equal(limited.filter(c=>c.kind==='item').length,1);
 s.items=['life-orb'];s.itemUnlocks=[];assert.ok(chestChoices(s,sim.rng,'epic').every(c=>c.kind==='stat'));
});

test('chests restock on game time, scale locally and cannot charge twice during a choice',()=>{
 const {sim,s,site,activate}=arena('cache');site.price=45;site.rarity='rare';s.coins=1000;
 const price=chestCost(s,site);activate();assert.equal(s.coins,1000-price);
 assert.equal(site.respawnAt,CHEST_TIERS.rare.respawn);
 const frozen=structuredClone(s);activate();sim.update(.04,idle);assert.deepEqual(s,frozen);
 sim.choose(s.upgradeChoices[0].id);
 s.stats.elapsed=site.respawnAt!-.02;sim.update(.04,idle);assert.equal(site.used,false);
 assert.equal(chestCost(s,site),price+15);
 s.stats.elapsed=360;assert.equal(chestRarity(s,site),'epic');
 assert.ok(chestCost(s,site)>price+15);
});

test('free discovery caches remain spent indefinitely without a respawn timer',()=>{
 const {sim,s,site,activate}=arena('cache');activate();
 assert.equal(site.respawnAt,undefined);sim.choose(s.upgradeChoices[0].id);
 s.stats.elapsed=800;(sim as any).updateExploration();
 assert.equal(site.used,true);const items=s.items.length;activate();assert.equal(s.items.length,items);assert.equal(s.phase,'playing');
});

test('level one shrine guardians are dangerous and scale with time, levels, squad and repeat tier',()=>{
 const {sim,s}=arena();const first=createGuardian(s,sim.rng,26,7,0,true);
 assert.ok(first.maxHp>=2000);assert.ok(first.damage>=24);
 s.party[0].level=12;s.stats.elapsed=300;
 s.party.push({...s.party[0],uid:2});
 const later=createGuardian(s,sim.rng,26,7,0,true,3);
 assert.ok(later.maxHp>first.maxHp*2);assert.ok(later.damage>first.damage);
 assert.equal(later.speed,createGuardian(s,sim.rng,26,7,0,false).speed,'Keep movement and tells readable');
});

test('retreat and timeout fail trials without loot, remove hostile attacks and permit a full-health retry',()=>{
 for(const retreat of [true,false]){
  const {sim,s,site,activate}=arena();activate();const trial=site.challenge!,guardian=s.enemies[0];
  guardian.hp=1;
  s.projectiles.push({uid:900,sourceId:guardian.uid,friendly:false} as any);
  s.psychicRings=[{uid:901,sourceId:guardian.uid} as any];
  if(retreat)s.player.x=SHRINE.radius+1;else s.stats.elapsed=trial.endsAt;
  (sim as any).updateExploration();
  assert.equal(guardian.dead,true);assert.equal(site.challenge,undefined);assert.equal(site.used,true);
  assert.equal(s.stats.kills,0);assert.equal(s.drops.length,0);assert.equal(s.buffs.luck||0,0);assert.equal(s.pendingSquadRewards,0);
  assert.equal(s.projectiles.length,0);assert.equal(s.psychicRings.length,0);
  assert.equal(site.respawnAt,s.stats.elapsed+SHRINE.retry);
  s.player.x=0;s.stats.elapsed=site.respawnAt!;(sim as any).updateExploration();activate();
  const retry=s.enemies.find(e=>!e.dead)!;assert.notEqual(retry.uid,guardian.uid);assert.equal(retry.hp,retry.maxHp);
 }
});

test('shrine victory starts recharge on defeat and guarantees a relic plus training; repeat fights grow',()=>{
 const {sim,s,site,activate}=arena();activate();const guardian=s.enemies[0];
 assert.equal(site.respawnAt,undefined);assert.equal(s.buffs.luck||0,0);
 s.phase='paused';const paused=structuredClone(s);sim.update(.04,idle);assert.deepEqual(s,paused);s.phase='playing';
 s.stats.elapsed=30;(sim as any).damageEnemy(guardian,guardian.maxHp*2,'normal',1);
 assert.equal(site.challenge,undefined);assert.equal(site.respawnAt,30+SHRINE.respawn);assert.equal(site.uses,1);
 assert.ok(s.drops.some(d=>d.kind==='item'));assert.equal(s.pendingSquadRewards,1);assert.ok(s.buffs.luck>=.04);
 s.stats.elapsed=site.respawnAt!;(sim as any).updateExploration();activate();
 assert.equal(site.challenge!.tier,2);assert.ok(s.enemies.find(e=>!e.dead)!.maxHp>guardian.maxHp);
});

test('a killing blow on the expiry frame cannot grant kill loot or training',()=>{
 const {sim,s,site,activate}=arena();activate();const guardian=s.enemies[0];
 s.stats.elapsed=site.challenge!.endsAt;
 (sim as any).damageEnemy(guardian,guardian.maxHp*2,'normal',1);
 assert.equal(guardian.dead,true);assert.equal(s.stats.kills,0);assert.equal(s.drops.length,0);
 assert.equal(s.pendingSquadRewards,0);assert.equal(s.buffs.luck||0,0);assert.equal(site.challenge,undefined);
});

test('only one shrine trial can run and entity limits never consume a shrine',()=>{
 const {sim,s,site,activate}=arena();activate();
 const other:POI={...site,uid:302,used:false,challenge:undefined};s.pois.push(other);
 (sim as any).activatePOI(other);assert.equal(other.used,false);assert.equal(s.enemies.length,1);
 const crowded=arena();
 crowded.s.enemies=Array.from({length:DESIGN.maxEnemies},(_,index)=>({...s.enemies[0],uid:1000+index}));
 crowded.activate();assert.equal(crowded.site.used,false);assert.equal(crowded.site.challenge,undefined);
});
