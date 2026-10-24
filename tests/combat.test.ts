import test from 'node:test';
import assert from 'node:assert/strict';
import {KANTO} from '../src/data/kanto.ts';
import {ATTACK_ARCHETYPES,getAttackProfile} from '../src/data/attacks.ts';
import {ITEM_DEFINITIONS} from '../src/data/items.ts';
import {DESIGN} from '../src/data/config.ts';
import {Simulation,type GameEvent} from '../src/game/Simulation.ts';
import {getLearnedMoveProfile} from '../src/data/moves.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {getBuildModifiers,BUILD_LIMITS} from '../src/game/systems/builds.ts';
import {chainTargets} from '../src/game/combat/targeting.ts';
import {elementalDamage,applyStatusProcs,tickEnemyStatuses,enemySpeedFactor} from '../src/game/combat/damage.ts';
import {addProjectile,stepProjectiles,type ProjectileSpawn} from '../src/game/combat/projectiles.ts';
import {executePattern,type PatternContext} from '../src/game/combat/patterns.ts';
import type {Enemy} from '../src/game/types.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
function arena(starter=7){
 const sim=new Simulation(starter,194),s=sim.state;s.enemies=[];s.party[0].cooldown=100;
 s.stats.xpToNext=1e12;s.player.iframes=1000;return {sim,s};
}
function foe(sim:Simulation,x:number,z=0):Enemy {
 const enemy=createEnemy(sim.state,sim.rng,19,'normal',x,z);enemy.hp=enemy.maxHp=10000;enemy.speed=0;enemy.hitCooldown=1000;
 sim.state.enemies.push(enemy);return enemy;
}
function shot(overrides:Partial<ProjectileSpawn>={}):ProjectileSpawn {
 return {x:0,z:0,vx:100,vz:0,ttl:1,damage:12,size:.2,kind:'bolt',type:'normal',penetration:0,friendly:true,sourceId:1,poisonChance:0,...overrides};
}

test('all 151 species use valid shared attack profiles, with stronger ranks and distinct signatures',()=>{
 assert.equal(Object.keys(ATTACK_ARCHETYPES).length,8);
 assert.equal(new Set(KANTO.map(species=>getAttackProfile(species.id).kind)).size,8);
 for(const species of KANTO){
  const first=getAttackProfile(species.id),last=getAttackProfile(species.id,12);
  assert.ok(first.cooldown>0&&first.range>0&&Number.isFinite(first.damageScale));
  assert.ok(last.range>first.range&&last.growth.damage>0);
 }
 assert.equal(getAttackProfile(9).projectiles,3);assert.equal(getAttackProfile(7).projectiles,1);
 assert.ok(getAttackProfile(135).chainRange>getAttackProfile(25).chainRange);
 assert.ok(getAttackProfile(123).cooldown<getAttackProfile(66).cooldown);
 assert.ok(getAttackProfile(115,12).range>getAttackProfile(115,8).range);
});

test('piercing projectiles hit in physical travel order and never hit one actor twice',()=>{
 const {sim,s}=arena(),far=foe(sim,8),near=foe(sim,2),middle=foe(sim,5),hits:number[]=[];
 addProjectile(s,shot({penetration:1}));
 stepProjectiles(s,.1,{hit:enemy=>hits.push(enemy.uid),hurtPlayer:()=>assert.fail('Friendly fire')});
 assert.deepEqual(hits,[near.uid,middle.uid]);assert.ok(!hits.includes(far.uid));assert.equal(s.projectiles.length,0);
 s.enemies=[near];near.x=3;addProjectile(s,shot({x:3,vx:0,penetration:5}));
 stepProjectiles(s,.04,{hit:enemy=>hits.push(enemy.uid),hurtPlayer:()=>{}});
 stepProjectiles(s,.04,{hit:enemy=>hits.push(enemy.uid),hurtPlayer:()=>{}});
 assert.equal(hits.filter(uid=>uid===near.uid).length,2,'One hit in each separate cast');
});

test('friendly projectiles cannot hit the leader or followers, and hostile shots cannot hit enemies',()=>{
 const {sim,s}=arena(),enemy=foe(sim,3),follower={...s.party[0],uid:99,x:3,z:0};s.party.push(follower);
 s.player.x=3;let enemyHits=0,leaderHits=0;
 addProjectile(s,shot());stepProjectiles(s,.05,{hit:()=>enemyHits++,hurtPlayer:()=>leaderHits++});
 assert.equal(enemyHits,1);assert.equal(leaderHits,0);assert.equal(follower.hp,follower.maxHp);
 addProjectile(s,shot({friendly:false,sourceId:enemy.uid}));
 stepProjectiles(s,.05,{hit:()=>enemyHits++,hurtPlayer:()=>leaderHits++});
 assert.equal(enemyHits,1);assert.equal(leaderHits,1);
});

test('hostile projectiles retain their launched trajectory when targets move behind them',()=>{
 const {sim,s}=arena(),enemy=foe(sim,100);s.player.x=100;
 addProjectile(s,shot({vx:4,vz:3,friendly:false,targetId:enemy.uid}));
 stepProjectiles(s,.025,{hit:()=>assert.fail(),hurtPlayer:()=>assert.fail()});
 const projectile=s.projectiles[0];assert.equal(projectile.x,.1);assert.ok(Math.abs(projectile.z-.075)<1e-12);
 s.player.x=-100;enemy.x=-100;
 stepProjectiles(s,.025,{hit:()=>assert.fail(),hurtPlayer:()=>assert.fail()});
 assert.equal(projectile.x,.2);assert.ok(Math.abs(projectile.z-.15)<1e-12);assert.equal(projectile.vx,4);assert.equal(projectile.vz,3);
});

test('friendly homing turns smoothly toward a target behind it without losing speed',()=>{
 const {sim,s}=arena(),target=foe(sim,-20);addProjectile(s,shot({vx:10,targetId:target.uid}));
 const projectile=s.projectiles[0];
 for(let i=0;i<10;i++){
  const before={x:projectile.x,z:projectile.z};stepProjectiles(s,.04,{hit:()=>assert.fail(),hurtPlayer:()=>assert.fail()});
  assert.ok(Math.abs(Math.hypot(projectile.vx,projectile.vz)-10)<1e-9);
  assert.ok(Math.abs(Math.hypot(projectile.x-before.x,projectile.z-before.z)-.4)<1e-9);
 }
 assert.ok(projectile.vx<0,'Steering must eventually face a target directly behind the shot');
});

test('chain casts visit each living target at most once and stop at the configured link distance',()=>{
 const {sim,s}=arena(),a=foe(sim,0),b=foe(sim,2),c=foe(sim,4),d=foe(sim,30);
 const targets=chainTargets(s.enemies,a,100,4.7);
 assert.deepEqual(targets.map(enemy=>enemy.uid),[a.uid,b.uid,c.uid]);
 assert.equal(new Set(targets.map(enemy=>enemy.uid)).size,targets.length);assert.ok(!targets.includes(d));
 b.dead=true;assert.deepEqual(chainTargets(s.enemies,a,3,4.7).map(enemy=>enemy.uid),[a.uid,c.uid]);
});

test('poison and burn integrate exact remaining lifetime at different frame rates; slow expires',()=>{
 const {sim}=arena(),a=foe(sim,8),b=structuredClone(a);
 for(const enemy of [a,b]){enemy.poisonTime=.05;enemy.burnTime=.03;enemy.slowTime=.075;}
 let coarse=tickEnemyStatuses(a,.04);assert.equal(enemySpeedFactor(a),.57);
 coarse+=tickEnemyStatuses(a,.04);assert.equal(enemySpeedFactor(a),1);
 let fine=0;for(let i=0;i<80;i++)fine+=tickEnemyStatuses(b,.001);
 assert.ok(Math.abs(coarse-.25)<1e-9);assert.ok(Math.abs(fine-coarse)<1e-9);
 assert.equal(a.poisonTime,0);assert.equal(a.burnTime,0);
});

test('water-electric and poison-fire interactions multiply damage, and duration items affect elemental procs',()=>{
 const {sim,s}=arena(),enemy=foe(sim,8);
 assert.equal(elementalDamage(100,'electric',enemy,false),100);
 enemy.soakedTime=1;assert.equal(elementalDamage(100,'electric',enemy,false),135);
 enemy.poisonTime=1;assert.equal(elementalDamage(100,'fire',enemy,false),118);
 applyStatusProcs(enemy,{slow:1,poison:1},()=>0,1.4);
 assert.equal(enemy.slowTime,3.5);assert.equal(enemy.poisonTime,5.6);
 s.items=['binding-thread'];enemy.soakedTime=0;
 addProjectile(s,shot({vx:1000,type:'water',status:{soak:1}}));sim.update(.02,idle);
 assert.ok(Math.abs(enemy.soakedTime-3.84)<1e-9);
});

test('DoT kills award XP and count damage exactly once without flooding hit visuals',()=>{
 const {sim,s}=arena(),enemy=foe(sim,8);enemy.hp=.05;enemy.poisonTime=.1;
 const events:GameEvent[]=[];sim.onEvent=event=>events.push(event);sim.update(.04,idle);
 assert.equal(s.stats.kills,1);assert.equal(s.stats.damageDealt,.05);assert.ok(s.stats.xp>0);
 assert.equal(s.drops.filter(drop=>drop.kind==='xp').length,1);assert.equal(s.enemies.length,0);
 assert.equal(events.filter(event=>event.kind==='hit'&&event.amount!==undefined).length,0);
 sim.update(.04,idle);assert.equal(s.stats.kills,1);
});

test('slash sweeps a forward cone, aura pulses around its owner, and burst detonates at its target',()=>{
 const {sim,s}=arena(),front=foe(sim,3),back=foe(sim,-2),distant=foe(sim,10),distantNeighbor=foe(sim,11);
 const hits:number[]=[],projectiles:ProjectileSpawn[]=[];
 const context:PatternContext={member:s.party[0],target:front,enemies:s.enemies,profile:getAttackProfile(56),element:'normal',damage:10,crit:false,depth:0,radiusScale:1,extraProjectiles:0,extraPierce:0,extraChains:0,projectileSpeedScale:1,
  hit:enemy=>hits.push(enemy.uid),projectile:projectile=>projectiles.push(projectile),visual:()=>{},heal:()=>{}};
 executePattern(context);assert.deepEqual(hits,[front.uid]);
 hits.length=0;executePattern({...context,profile:getAttackProfile(23)});assert.deepEqual(hits,[front.uid,back.uid]);
 hits.length=0;executePattern({...context,profile:getAttackProfile(50),target:distant});assert.deepEqual(hits,[distant.uid,distantNeighbor.uid]);
 hits.length=0;executePattern({...context,profile:getAttackProfile(63)});
 assert.equal(hits.length,0);assert.equal(projectiles[0].silhouette,'beam');assert.ok(projectiles[0].penetration>0);
});

test('a selected melee target is hit even after leaving the sweep',()=>{
 const {sim,s}=arena(),target=foe(sim,3),other=foe(sim,-2),hits:number[]=[];
 const context:PatternContext={member:s.party[0],target,enemies:s.enemies,profile:getAttackProfile(56),element:'normal',damage:10,crit:false,depth:0,radiusScale:1,extraProjectiles:0,extraPierce:0,extraChains:0,projectileSpeedScale:1,
  hit:enemy=>hits.push(enemy.uid),projectile:()=>{},visual:()=>{},heal:()=>{}};
 target.x=30;executePattern(context);
 assert.deepEqual(hits,[target.uid]);assert.ok(!hits.includes(other.uid));
 hits.length=0;executePattern({...context,profile:getAttackProfile(58)});
 assert.deepEqual(hits,[target.uid]);
 hits.length=0;executePattern({...context,profile:getAttackProfile(66)});
 assert.deepEqual(hits,[target.uid]);
});

test('player melee reaches 25% farther and its starting damage is 25% stronger',()=>{
 const primary=getAttackProfile(56),base=ATTACK_ARCHETYPES.slash;
 assert.equal(primary.range,base.range*1.25);
 assert.equal(primary.radius,base.radius*1.25);
 assert.equal(primary.damageScale,base.damageScale*1.25);
 const learned=getLearnedMoveProfile('tackle');
 assert.equal(learned.range,base.range*1.25);
 assert.equal(learned.radius,base.radius*1.25);
 assert.equal(learned.damageScale,base.damageScale*1.25);
});

test('lobs explode on impact and expanded attack range has enough projectile lifetime to reach its target',()=>{
 const {sim,s}=arena(1),a=foe(sim,5),b=foe(sim,6),c=foe(sim,10);const hits:number[]=[];
 addProjectile(s,shot({kind:'lob',radius:2.1,vx:100}));stepProjectiles(s,.05,{hit:enemy=>hits.push(enemy.uid),hurtPlayer:()=>{}});
 assert.deepEqual(hits,[a.uid,b.uid]);assert.ok(!hits.includes(c.uid));assert.equal(s.projectiles.length,0);
 s.items=['wide-lens','long-barrel'];s.party[0].speciesId=7;s.party[0].cooldown=0;a.x=19;b.dead=true;c.dead=true;
 sim.rng.next=()=>.99;sim.update(.02,idle);
 const projectile=s.projectiles[0],range=getAttackProfile(7).range*(1+getBuildModifiers(s).radius);
 assert.ok(projectile.ttl*Math.hypot(projectile.vx,projectile.vz)>=range-.6);
});

test('boss and elite hard attacks keep a fixed, pausable windup before damage or projectiles',()=>{
 const {sim,s}=arena(),enemy=foe(sim,8);enemy.isBoss=true;enemy.attackCooldown=0;let tells=0;
 sim.onEvent=event=>{if(event.kind==='tell')tells++;};sim.update(.02,idle);
 assert.equal(tells,1);assert.equal(s.projectiles.length,0);const windup=structuredClone(enemy.windup);
 assert.ok(windup&&windup.remaining>=.6);s.phase='paused';sim.update(.04,idle);assert.deepEqual(enemy.windup,windup);
 s.phase='playing';s.player.z=8;
 for(let i=0;i<18;i++)sim.update(.04,idle);
 assert.equal(s.projectiles.length,7);assert.ok(s.projectiles.every(projectile=>projectile.silhouette==='needle'));
 const middle=s.projectiles[3];assert.ok(middle.vx<0&&Math.abs(middle.vz)<1e-8,'Volley uses the original target snapshot');
 const elite=foe(sim,6);enemy.dead=true;elite.elite=true;elite.attackCooldown=0;s.player.z=0;sim.update(.02,idle);
 assert.equal(elite.windup?.kind,'slam');assert.equal(elite.windup?.x,s.player.x);assert.equal(elite.windup?.radius,3.3);
});

test('event-driven items affect actual attacks, critical procs, kills and the leader special',()=>{
 const {sim,s}=arena(25),a=foe(sim,4),b=foe(sim,6);s.items=['static-orb','rescue-ribbon','critical-capacitor'];s.player.hp=60;s.player.specialCooldown=8;
 s.party[0].cooldown=0;sim.rng.next=()=>0;const events:GameEvent[]=[];sim.onEvent=event=>events.push(event);
 sim.update(.02,idle);assert.ok(a.hp<a.maxHp&&b.hp<b.maxHp);assert.ok(events.some(event=>event.kind==='chain'));
 assert.ok(s.player.specialCooldown<7.98,'Critical hits reduce the ability cooldown');
 s.player.specialCooldown=0;sim.update(.02,{...idle,special:true});assert.equal(s.player.hp,60+s.player.maxHp*.06);
 const kills=arena();kills.s.player.hp=50;kills.s.items=['shell-bell'];const baseHp=kills.s.player.maxHp;
 for(let i=0;i<15;i++){const enemy=foe(kills.sim,3);enemy.hp=1;}
 addProjectile(kills.s,shot({vx:1000,penetration:20}));kills.sim.update(.02,idle);
 assert.equal(kills.s.stats.kills,15);
 assert.ok(Math.abs(kills.s.player.hp/kills.s.player.maxHp-(50/baseHp+.05))<1e-9,'Shell Bell healing retains its percentage through an automatic level');
});

test('a percentage-of-hit proc keeps its stated fraction after type and wet damage are resolved',()=>{
 const {sim,s}=arena(25),enemy=foe(sim,4);enemy.soakedTime=3;s.items=['prism-shard'];s.party[0].cooldown=0;
 const events:GameEvent[]=[];sim.onEvent=event=>events.push(event);sim.rng.next=()=>0;sim.update(.02,idle);
 const hits=events.filter(event=>event.kind==='hit'&&event.targetId===enemy.uid&&event.amount!==undefined);
 assert.equal(hits.length,2);assert.equal(hits[0].shape,'crit');
 assert.ok(Math.abs(hits[1].amount!-.175*hits[0].amount!)<1e-9,'The secondary hit must not multiply soaked/type bonuses twice');
});

test('movement, regeneration and XP use passive modifiers while recruit and evolve hooks apply real rewards',()=>{
 const base=arena(),fast=arena();fast.s.items=['float-stone','leftovers','lucky-egg','welcome-basket','growth-charm'];
 fast.s.player.hp=50;fast.sim.gainXP(20);assert.equal(fast.s.stats.xp,22.5);
 for(let i=0;i<20;i++){base.sim.update(.04,{...idle,mx:1});fast.sim.update(.04,{...idle,mx:1});}
 assert.ok(fast.s.player.x>base.s.player.x);assert.ok(Math.abs(fast.s.player.hp-(50+fast.s.player.maxHp*.004*.8))<1e-8);
 fast.s.stats.level=8;fast.s.stats.elapsed=190;fast.sim.debugLevel();fast.sim.update(.02,idle);
 const choice=fast.s.upgradeChoices[0];assert.equal(choice.kind,'recruit');const beforeXP=fast.s.stats.xp,beforeHP=fast.s.player.hp;
 fast.sim.choose(choice.id);assert.equal(fast.s.party.length,2);assert.equal(fast.s.player.hp,beforeHP+12);assert.ok(fast.s.stats.xp>beforeXP);
 fast.s.party[0].speciesId=1;fast.s.party[0].level=5;fast.s.player.specialCooldown=12;
 fast.sim.enterChoice([{id:'evolve-1-2',kind:'evolve',speciesId:1,targetId:2,sourceSpeciesId:1,title:'Evolve',description:'',rarity:'epic'}]);
 const hp=fast.s.player.hp;fast.sim.choose('evolve-1-2');assert.equal(fast.s.party[0].speciesId,2);assert.equal(fast.s.player.specialCooldown,8);assert.equal(fast.s.player.hp,Math.min(fast.s.player.maxHp,hp*1.25+15));
});

test('an invalidated choice refreshes valid offers while the run stays paused',()=>{
 const {sim,s}=arena();s.items=['multi-lens'];s.itemUnlocks=[];sim.enterChoice([{id:'multi-lens',kind:'item',title:'Multi Lens',description:'',rarity:'epic'}],'Treasure cache');
 sim.choose('multi-lens');assert.equal(s.phase,'choice');assert.ok(s.upgradeChoices.length>0);assert.ok(s.upgradeChoices.every(choice=>choice.id!=='multi-lens'));
 const time=s.stats.elapsed;sim.update(.04,idle);assert.equal(s.stats.elapsed,time);
});

test('an echo follows the normal cast and retargets after a lethal area attack',()=>{
 const {sim,s}=arena(50),first=foe(sim,3),next=foe(sim,10);s.items=['echo-bell'];sim.rng.next=()=>.99;
 for(let i=0;i<4;i++){s.party[0].cooldown=0;sim.update(.02,idle);}
 assert.equal(next.hp,next.maxHp);first.hp=1;s.party[0].cooldown=0;sim.update(.02,idle);
 assert.ok(first.dead);assert.ok(next.hp<next.maxHp,'The main cast kills the first target, then the echo reaches another target');
});

test('Life Orb pays its stated HP cost through armor and stops combat immediately if lethal',()=>{
 const {sim,s}=arena(),enemy=foe(sim,8);enemy.hp=enemy.maxHp=1e6;s.items=['life-orb','metal-coat'];sim.rng.next=()=>.99;
 for(let i=0;i<25;i++){s.party[0].cooldown=0;sim.update(.02,idle);}
 assert.equal(s.player.hp,s.player.maxHp-2);
 for(let i=0;i<24;i++){s.party[0].cooldown=0;sim.update(.02,idle);}
 s.player.hp=1;s.party[0].cooldown=0;const damage=s.stats.damageDealt;
 sim.update(.02,idle);assert.equal(s.result,'defeat');assert.equal(s.player.hp,0);assert.equal(s.stats.damageDealt,damage);
});

test('stacked builds keep projectiles and proc actions bounded during a crowded deterministic fight',()=>{
 const {sim,s}=arena(9);s.items=ITEM_DEFINITIONS.map(item=>item.id);s.buffs.haste=999;s.buffs.radius=999;s.player.hp=s.player.maxHp;s.party[0].attackLevel=12;
 for(const id of [25,26,65,94,123])s.party.push({...s.party[0],uid:s.idCounter++,speciesId:id,cooldown:0});
 for(let i=0;i<DESIGN.maxEnemies;i++)foe(sim,3+(i%16),Math.floor(i/16)*.7);
 sim.rng.next=()=>0;
 for(let i=0;i<150;i++){
  sim.update(.04,idle);assert.ok(s.projectiles.length<=DESIGN.maxProjectiles);
  assert.ok((s.build?.actionsInWindow||0)<=BUILD_LIMITS.maxActionsPerWindow);assert.ok(Number.isFinite(s.stats.damageDealt));
 }
 assert.ok(s.stats.damageDealt>1000);assert.ok(JSON.stringify(s.build).length<6000);
});
