import test from 'node:test';
import assert from 'node:assert/strict';
import {getSpecialProfile,describeSpecialUpgrade,specialAimMode} from '../src/data/specials.ts';
import {KANTO,starterChoices} from '../src/data/kanto.ts';
import {Simulation,type GameEvent} from '../src/game/Simulation.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {createEnvironment} from '../src/game/systems/environment.ts';
import {DESIGN} from '../src/data/config.ts';
import {SPECIAL_LIMITS} from '../src/game/combat/specials.ts';
import {getMovementTrait} from '../src/data/movementTraits.ts';
import {getBuildModifiers} from '../src/game/systems/builds.ts';
import type {Enemy} from '../src/game/types.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
function arena(starter:number,rank=1){
 const sim=new Simulation(starter,194),s=sim.state,events:GameEvent[]=[];
 s.enemies=[];s.party[0].cooldown=1000;s.party[0].attackLevel=rank;
 s.stats.xpToNext=1e12;s.player.iframes=1000;sim.onEvent=event=>events.push(event);
 return {sim,s,events};
}
function foe(sim:Simulation,x:number,z:number):Enemy {
 const enemy=createEnemy(sim.state,sim.rng,19,'normal',x,z);
 Object.assign(enemy,{hp:100000,maxHp:100000,speed:0,hitCooldown:1000,attackCooldown:1000});
 sim.state.enemies.push(enemy);return enemy;
}
function advance(sim:Simulation,seconds:number){
 for(let remaining=seconds;remaining>1e-8;remaining-=.02)sim.update(Math.min(.02,remaining),idle);
}
const hits=(events:GameEvent[],enemy:Enemy)=>events.filter(event=>event.kind==='hit'&&event.damageTo==='enemy'&&event.targetId===enemy.uid);

test('each starter has a distinct special and movement combination and every species has a valid bounded profile',()=>{
 const starters=starterChoices();assert.equal(new Set(starters.map(id=>`${getSpecialProfile(id).kind}/${getMovementTrait(id).kind}`)).size,starters.length);
 for(const species of KANTO){
  const first=getSpecialProfile(species.id),last=getSpecialProfile(species.id,12);
  assert.ok(first.name.length>0&&first.description.length>20);
  for(const profile of [first,last,getSpecialProfile(species.id,999)]){
   assert.ok([profile.range,profile.radius,profile.duration,profile.damageScale,profile.cooldown,profile.angle,profile.knockback].every(Number.isFinite));
   assert.ok(profile.range>0&&profile.cooldown>0&&profile.damageScale>=0);
   assert.ok(profile.projectiles>=0&&profile.projectiles<=12&&profile.pulses>=1&&profile.pulses<=16);
  }
  assert.deepEqual(getSpecialProfile(species.id,NaN),first);
  first.radius=999;assert.notEqual(getSpecialProfile(species.id).radius,999,'Profiles must not expose shared mutable tuning');
 }
 for(const [base,evolved] of [[1,3],[4,6],[7,9],[25,26]]){
  assert.equal(getSpecialProfile(base).kind,getSpecialProfile(evolved).kind);
  assert.ok(getSpecialProfile(evolved).damageScale>getSpecialProfile(base).damageScale);
 }
 for(const [ids,name] of [[[10,11,12],'Electroweb'],[[27,28],'Fissure'],[[52,53],'Fury Swipes']] as const){
  for(const id of ids)assert.equal(getSpecialProfile(id).name,name);
 }
});

test('starter special upgrades grow different mechanics and describe the actual gains',()=>{
 const first=(id:number)=>getSpecialProfile(id),last=(id:number)=>getSpecialProfile(id,12);
 assert.ok(last(1).duration>first(1).duration&&last(1).pulses>first(1).pulses);
 assert.ok(last(4).angle>first(4).angle&&last(4).range>first(4).range);
 assert.ok(last(7).radius>first(7).radius&&last(7).knockback>first(7).knockback);
 assert.ok(last(25).pulses>first(25).pulses);assert.equal(last(25).projectiles,0);
 assert.ok(last(133).projectiles>first(133).projectiles);assert.equal(last(133).pulses,1);
 assert.match(describeSpecialUpgrade(1,1,12),/pulse.*duration/);
 assert.match(describeSpecialUpgrade(4,1,12),/wider flame cone/);
 assert.match(describeSpecialUpgrade(7,1,12),/stronger push/);
 assert.match(describeSpecialUpgrade(25,1,12),/lightning strike/);
 assert.match(describeSpecialUpgrade(133,1,12),/projectile/);
});

test('Bramble Garden repeatedly damages its remote footprint after the player leaves it',()=>{
 const {sim,s,events}=arena(1),target=foe(sim,0,9),neighbor=foe(sim,2,10),outside=foe(sim,0,17);
 sim.update(.02,{...idle,special:true});const nearPlayer=foe(sim,0,-2);
 s.player.x=-6;advance(sim,1.8);
 assert.ok(hits(events,target).length>=2,'The garden must pulse more than once');
 assert.ok(hits(events,neighbor).length>=2);assert.ok(target.slowTime>0);
 assert.equal(outside.hp,outside.maxHp);assert.equal(nearPlayer.hp,nearPlayer.maxHp);
 assert.ok(events.some(event=>event.shape==='garden'&&Math.hypot(event.x??0,event.z??0)>5));
});

test('Flamethrower sustains damage in a forward cone without hitting enemies behind or beside it',()=>{
 const {sim,s,events}=arena(4),front=foe(sim,0,6),behind=foe(sim,0,-8),side=foe(sim,8,4);
 sim.update(.02,{...idle,special:true});advance(sim,1.2);
 assert.ok(hits(events,front).length>=3);assert.ok(front.burnTime>0);
 assert.equal(behind.hp,behind.maxHp);assert.equal(side.hp,side.maxHp);
 assert.ok(events.some(event=>event.shape==='cone'));
 assert.ok((s.activeSpecials?.length??0)>0,'The breath must persist across frames');
});

test('Surf travels through a corridor, soaking and pushing each enemy only once',()=>{
 const {sim,s,events}=arena(7),near=foe(sim,0,5),far=foe(sim,0,15),side=foe(sim,8,9),behind=foe(sim,0,-8);
 sim.update(.02,{...idle,special:true});assert.equal(far.hp,far.maxHp,'A distant foe cannot be hit before the wave reaches it');
 advance(sim,1.4);
 assert.equal(hits(events,near).length,1);assert.equal(hits(events,far).length,1);
 assert.ok(near.z>5&&far.z>15);assert.ok(near.soakedTime>0&&far.soakedTime>0);
 assert.equal(side.hp,side.maxHp);assert.equal(behind.hp,behind.maxHp);assert.equal(s.projectiles.length,0);
});

test('traveling waves exclude nearby enemies behind the cast even when their width overlaps them',()=>{
 for(const starter of [7,16]){
  const {sim}=arena(starter),front=foe(sim,0,5);
  sim.update(.02,{...idle,special:true});const behind=foe(sim,0,-2);advance(sim,.8);
  assert.ok(front.hp<front.maxHp);assert.equal(behind.hp,behind.maxHp);
 }
});

test('forward dashes retain their width without hitting behind the cast origin',()=>{
 for(const starter of [58,133]){
  const {sim}=arena(starter),front=foe(sim,0,7),side=foe(sim,1.2,5),rear=foe(sim,0,-.75);
  sim.update(.02,{...idle,aimX:0,aimZ:1,special:true});
  assert.ok(front.hp<front.maxHp);assert.ok(side.hp<side.maxHp,'The dash still hits the width beside its forward path');
  assert.equal(rear.hp,rear.maxHp,'The initial sweep must exclude the rounded overlap behind its origin');
 }
});

test('Flame Charge trail pulses hit forward newcomers while excluding the rear overlap',()=>{
 const {sim}=arena(58);foe(sim,0,7);
 sim.update(.02,{...idle,aimX:0,aimZ:1,special:true});
 const front=foe(sim,0,4),side=foe(sim,1.2,6),rear=foe(sim,0,-.75);
 advance(sim,.7);
 assert.ok(front.hp<front.maxHp);assert.ok(side.hp<side.maxHp,'The retained fire trail keeps its full width');
 assert.equal(rear.hp,rear.maxHp,'A later trail pulse must preserve the original forward boundary');
});

test('Teleport Lance pierces a distant target and lands Abra at the beam endpoint',()=>{
 const {sim,s,events}=arena(63),target=foe(sim,0,18);
 sim.update(.02,{...idle,special:true});
 const beam=events.find(event=>event.shape==='beam');
 assert.ok(target.hp<target.maxHp);assert.ok(beam&&(beam.toZ??0)>=18);
 assert.ok(Math.hypot(s.player.x-beam.toX!,s.player.z-beam.toZ!)<1e-8);
 assert.ok(events.some(event=>event.shape==='teleport'&&event.toZ===beam.toZ));
});

test('Abra dodges with an instant, longer teleport while other starters keep their moving dash',()=>{
 const abra=arena(63),ordinary=arena(19);
 for(const {sim} of [abra,ordinary])sim.update(.02,{...idle,mz:1,dodge:true});
 const abraDistance=abra.s.player.z,ordinaryDistance=ordinary.s.player.z;
 assert.ok(abraDistance>DESIGN.dodgeSpeed*DESIGN.dodgeSeconds,'Abra lands beyond the normal full dash range in one frame');
 assert.ok(ordinaryDistance<DESIGN.dodgeSpeed*.03,'The regular dash has only begun after one frame');
 assert.equal(abra.s.player.dodgeTime,0);assert.ok(ordinary.s.player.dodgeTime>0);
 assert.ok(abra.events.some(event=>event.kind==='dash'&&event.shape==='teleport'&&event.toZ===abra.s.player.z));
 assert.ok(ordinary.events.some(event=>event.kind==='dash'&&event.shape===undefined));
});

test('Abra teleport endpoints stop at solid scenery',()=>{
 const setup=()=>{
  const battle=arena(63),rock=createEnvironment(battle.s.seed,battle.s.pois).obstacles.find(obstacle=>obstacle.kind==='circle'&&obstacle.radius>.8)!;
  assert.equal(rock.kind,'circle');if(rock.kind!=='circle')throw new Error('Expected a rock');
  battle.s.player.x=rock.x-rock.radius-DESIGN.playerRadius-1;
  battle.s.player.z=rock.z;
  battle.s.party[0].x=battle.s.player.x;battle.s.party[0].z=battle.s.player.z;
  return {...battle,rock};
 };
 const dash=setup();dash.sim.update(.02,{...idle,mx:1,dodge:true});
 assert.ok(dash.s.player.x<dash.rock.x);
 assert.ok(Math.hypot(dash.s.player.x-dash.rock.x,dash.s.player.z-dash.rock.z)>=dash.rock.radius+DESIGN.playerRadius-1e-6);
 const lance=setup();lance.sim.update(.02,{...idle,aimX:1,aimZ:0,special:true});
 const beam=lance.events.find(event=>event.shape==='beam');
 assert.ok(beam);assert.ok(lance.s.player.x<lance.rock.x);
 assert.ok(Math.hypot(lance.s.player.x-beam.toX!,lance.s.player.z-beam.toZ!)<1e-8);
});

test('adding a projectile to Electroweb preserves a direct shot at the selected distant enemy',()=>{
 for(const starter of [10]){
  const {sim,s}=arena(starter);s.items=['multi-lens'];const target=foe(sim,0,16);
  sim.update(.02,{...idle,special:true});
  assert.equal(s.projectiles.length,getSpecialProfile(starter).projectiles+1);
  assert.ok(s.projectiles.every(projectile=>projectile.type==='electric'&&projectile.moveName==='Electroweb'));
  advance(sim,1.2);assert.ok(target.hp<target.maxHp,`Starter ${starter} must retain its aimed shot with an even fan`);
 }
});

test('Thunder Circuit strikes separate remote enemies over time and stuns its targets',()=>{
 const {sim,events}=arena(25),targets=[foe(sim,0,12),foe(sim,8,12),foe(sim,-8,12)];
 sim.update(.02,{...idle,special:true});
 assert.ok(targets.filter(enemy=>enemy.hp<enemy.maxHp).length<=1,'The circuit must not resolve all strikes in one frame');
 advance(sim,.5);assert.ok(targets.some(enemy=>enemy.stunTime>0));advance(sim,.9);
 assert.ok(targets.every(enemy=>enemy.hp<enemy.maxHp));
 assert.ok(events.filter(event=>event.shape==='column').length>=targets.length);
});

test('Fury Swipes repeatedly claws one aimed enemy without hitting its neighbors or firing coins',()=>{
 const {sim,s,events}=arena(52),target=foe(sim,0,5),neighbor=foe(sim,1,5),rear=foe(sim,0,-3),distant=foe(sim,0,12);
 sim.update(.02,{...idle,aimX:0,aimZ:1,special:true});advance(sim,.7);
 assert.equal(hits(events,target).length,3);
 for(const enemy of [neighbor,rear,distant])assert.equal(enemy.hp,enemy.maxHp);
 assert.equal(s.projectiles.length,0);assert.ok(events.some(event=>event.shape==='slash'));
});

test('trained Fury Swipes adds up to five hits and retargets after a foe falls',()=>{
 const {sim,events}=arena(52,7),first=foe(sim,0,4),next=foe(sim,0,6);first.hp=1;
 sim.update(.02,{...idle,aimX:0,aimZ:1,special:true});advance(sim,.7);
 assert.ok(first.dead);assert.equal(hits(events,first).length,1);assert.equal(hits(events,next).length,4);
 assert.equal(getSpecialProfile(52,999).pulses,5);
 assert.match(describeSpecialUpgrade(52,3,4),/Fury Swipes: \+1 combo hit/);
});

test('Thunder Circuit automatically chains on every side regardless of mouse aim',()=>{
 const {sim,s}=arena(25),rear=foe(sim,0,-3),front=foe(sim,0,10),side=foe(sim,9,0);
 assert.equal(specialAimMode(getSpecialProfile(25).kind),'automatic');
 sim.update(.02,{...idle,aimX:0,aimZ:1,special:true});
 assert.ok(rear.hp<rear.maxHp,'The closest automatic strike may be behind the mouse');
 assert.equal(s.activeSpecials?.[0].manualAim,false);
 for(let i=0;i<65;i++)sim.update(.02,{...idle,aimX:0,aimZ:1});
 assert.ok(front.hp<front.maxHp);assert.ok(side.hp<side.maxHp);
});

test('self-centered foxfire distributes its orbit around the leader independently of mouse aim',()=>{
 const launch=(aimX:number,aimZ:number)=>{
  const {sim,s}=arena(37);foe(sim,0,-8);foe(sim,0,12);
  sim.update(.02,{...idle,aimX,aimZ,special:true});
  return s.projectiles.map(({x,z,vx,vz,targetId,behavior,orbitCenterX,orbitCenterZ})=>({x,z,vx,vz,targetId,behavior,orbitCenterX,orbitCenterZ}));
 };
 const ahead=launch(0,1),behind=launch(0,-1);
 assert.equal(specialAimMode(getSpecialProfile(37).kind),'automatic');
 assert.deepEqual(ahead,behind);assert.equal(ahead.length,getSpecialProfile(37).projectiles);
 assert.ok(ahead.every(p=>p.behavior==='orbit'&&p.targetId===undefined&&p.orbitCenterX===0&&p.orbitCenterZ===0));
 assert.ok(ahead.some(p=>p.z>0)&&ahead.some(p=>p.z<0),'The orbit protects both sides of the leader');
});

test('Swift Step follows a swept obstacle-safe path and sends seeking stars at separate targets',()=>{
 const {sim,s}=arena(133),target=foe(sim,0,7);foe(sim,8,7);foe(sim,-8,7);
 sim.update(.02,{...idle,special:true});
 assert.ok(s.player.z>3);assert.ok(target.hp<target.maxHp,'The dash path itself must damage a crossed enemy');
 assert.ok(s.projectiles.length>=3);assert.ok(s.projectiles.every(projectile=>projectile.friendly&&projectile.targetId!==undefined));
 assert.ok(new Set(s.projectiles.map(projectile=>projectile.targetId)).size>=2);
 const blocked=arena(133),rock=createEnvironment(blocked.s.seed,blocked.s.pois).obstacles.find(obstacle=>obstacle.kind==='circle'&&obstacle.radius>.8)!;
 assert.equal(rock.kind,'circle');if(rock.kind!=='circle')return;
 blocked.s.player.x=rock.x-rock.radius-DESIGN.playerRadius-.2;blocked.s.player.z=rock.z;
 Object.assign(blocked.s.party[0],{x:blocked.s.player.x,z:blocked.s.player.z});foe(blocked.sim,rock.x+rock.radius+2,rock.z);
 blocked.sim.update(.02,{...idle,special:true});
 assert.ok(Math.hypot(blocked.s.player.x-rock.x,blocked.s.player.z-rock.z)>=rock.radius+DESIGN.playerRadius-1e-6);
 assert.ok(blocked.s.player.x<rock.x,'The dash must not tunnel through a blocking rock');
});

test('active specials fully freeze during pause, choices and results, then expire after resuming',()=>{
 for(const starter of [1,4,7,25]){
  const {sim,s}=arena(starter);foe(sim,0,9);sim.update(.02,{...idle,special:true});
  assert.ok((s.activeSpecials?.length??0)>0);
  for(const phase of ['paused','choice','result'] as const){
   s.phase=phase;const frozen=structuredClone(s);sim.update(.04,{...idle,special:true});assert.deepEqual(s,frozen);
  }
  s.phase='playing';advance(sim,9);assert.equal(s.activeSpecials?.length??0,0);
 }
});

test('special cooldown, held input and onSpecial relic effects apply once per actual cast',()=>{
 for(const starter of [1,4,7,25,133]){
  const {sim,s,events}=arena(starter);s.items=['charged-band','rescue-ribbon'];s.player.hp=40;foe(sim,0,8);
  sim.update(.02,{...idle,special:true});const healed=s.player.hp-40;assert.ok(healed>0);
  assert.ok(Math.abs(s.player.specialCooldown-getSpecialProfile(starter).cooldown/(1+getBuildModifiers(s).specialHaste))<1e-9);
  const casts=events.filter(event=>event.kind==='special').length;assert.equal(casts,1);
  s.player.specialCooldown=0;for(let i=0;i<5;i++)sim.update(.02,{...idle,special:true});
  assert.equal(events.filter(event=>event.kind==='special').length,casts);assert.equal(s.player.hp,40+healed);
  sim.update(.02,idle);sim.update(.02,{...idle,special:true});assert.ok(Math.abs(s.player.hp-(40+healed*2))<1e-9);
  assert.equal(events.filter(event=>event.kind==='special').length,casts+1);
 }
});

test('mixed maximum-rank special casts keep active effects and projectiles bounded and release expired state',()=>{
 const {sim,s}=arena(1,12),starters=starterChoices();s.items=['multi-lens','binding-thread'];
 for(let i=0;i<24;i++)foe(sim,Math.sin(i*Math.PI/12)*12,Math.cos(i*Math.PI/12)*12);
 for(const enemy of s.enemies)enemy.hp=enemy.maxHp=1e9;
 for(let cast=0;cast<240;cast++){
  s.party[0].speciesId=starters[cast%starters.length];s.player.specialCooldown=0;
  sim.update(.02,{...idle,special:true});sim.update(.02,idle);
  assert.ok((s.activeSpecials?.length??0)<=SPECIAL_LIMITS.active);
  assert.ok(s.projectiles.length<=DESIGN.maxProjectiles);
  for(const effect of s.activeSpecials??[]){
   assert.ok(effect.profile.pulses<=SPECIAL_LIMITS.pulses);assert.ok(effect.hit.size<=s.enemies.length);
   assert.ok([effect.age,effect.x,effect.z,effect.dx,effect.dz].every(Number.isFinite));
  }
  assert.ok(s.projectiles.every(projectile=>[projectile.x,projectile.z,projectile.vx,projectile.vz,projectile.ttl].every(Number.isFinite)));
 }
 s.enemies=[];advance(sim,25);assert.equal(s.activeSpecials?.length??0,0);
 assert.ok(s.projectiles.every(projectile=>!projectile.friendly),'Expired special shots must release their storage');
});

test('Famine suppresses healing from the Sleep Powder special and onSpecial relics',()=>{
 for(const famine of [false,true]){
  const {sim,s}=arena(43);s.challenge=famine?'famine':'standard';s.items=['rescue-ribbon'];s.player.hp=30;
  s.party.push({...s.party[0],uid:s.idCounter++,speciesId:7,hp:30,maxHp:155});foe(sim,0,8);
  sim.update(.02,{...idle,special:true});advance(sim,3.4);
  if(famine){assert.equal(s.player.hp,30);assert.equal(s.party[1].hp,30);}
  else {assert.ok(s.player.hp>38);assert.ok(s.party[1].hp>38);}
 }
});
