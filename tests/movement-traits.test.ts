import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,type MoveInput,type GameEvent} from '../src/game/Simulation.ts';
import {cameraAimDirection,cameraRelativeMovement} from '../src/game/input.ts';
import {DESIGN} from '../src/data/config.ts';
import {WORLD} from '../src/data/world.ts';
import {getMovementTrait,MOVEMENT_TRAITS} from '../src/data/movementTraits.ts';
import {airborneTraversal,canReachAirbornePlayer} from '../src/game/systems/movement.ts';
import {ObstacleField,type Obstacle} from '../src/game/systems/environment.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {chooseEnemyAttack,prepareEnemyMove} from '../src/game/combat/enemies.ts';
import {addProjectile} from '../src/game/combat/projectiles.ts';
import {migrateSave,exportSave,importSave} from '../src/game/save.ts';
import {upgradeStatPreview} from '../src/ui/upgradePreview.ts';
import {runAnalyticsReport} from '../src/game/analytics.ts';
const idle:MoveInput={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
function arena(id:number,obstacles:Obstacle[]=[]){
 const sim=new Simulation(id,4),s=sim.state;s.enemies=[];s.terrainFeatures=[];s.party[0].cooldown=10000;
 Object.assign(sim,{obstacles:new ObstacleField(obstacles),spawnAccum:-10000});return sim;
}
function step(sim:Simulation,seconds:number,input:Partial<MoveInput>={}){for(let left=seconds;left>1e-8;left-=.02)sim.update(Math.min(.02,left),{...idle,...input});}
function target(sim:Simulation){
 const s=sim.state,enemy=createEnemy(s,sim.rng,19,'normal',s.player.x+3,s.player.z);
 Object.assign(enemy,{hp:1e6,maxHp:1e6,speed:0,stunTime:10000,attackCooldown:10000,hitCooldown:10000});s.enemies.push(enemy);
 return enemy;
}
function attackArena(runTime=1.6){
 const sim=arena(25);step(sim,runTime,{mx:1});Object.assign(sim.rng,{next:()=>.99});
 const enemy=target(sim),hits:GameEvent[]=[];
 sim.onEvent=event=>{if(event.kind==='hit'&&event.damageTo==='enemy')hits.push(event);};
 return {sim,s:sim.state,enemy,hits};
}
test('straight travel builds a bounded run-up only after one second and preserves percentage speed gains',()=>{
 const sim=arena(25),normal=arena(1);step(sim,.98,{mx:1});assert.equal(sim.state.player.movement?.boost,0);
 step(sim,.7,{mx:1});step(normal,1.68,{mx:1});
 assert.equal(sim.state.player.movement?.boost,.25);assert.ok(sim.state.player.x>normal.state.player.x+.3);
 const x=sim.state.player.x;step(sim,.2,{mx:1});assert.ok(Math.abs((sim.state.player.x-x)/.2-DESIGN.playerSpeed*1.25)<1e-8);
 sim.state.buffs.speed=2;step(sim,.5,{mx:1});const fast=sim.state.player.x;
 step(sim,.1,{mx:1});assert.ok(Math.abs((sim.state.player.x-fast)/.1-DESIGN.playerSpeed*3*1.25)<1e-8);
 assert.ok(getMovementTrait(25).boost!>getMovementTrait(26).boost!,'Early lower-power kits have the larger traversal budget');
});
test('sharp turns, stops, dodges, jumps and blocked travel reset run-up',()=>{
 for(const input of [{mx:-1},{mz:1},{},{mx:1,dodge:true},{mx:1,jump:true}]){
  const sim=arena(25);step(sim,1.6,{mx:1});assert.ok(sim.state.player.movement!.boost>0);
  sim.update(.02,{...idle,...input});assert.equal(sim.state.player.movement?.boost,0);
 }
 const blocked=arena(25,[{kind:'circle',x:4,z:0,radius:2}]);step(blocked,3,{mx:1});assert.equal(blocked.state.player.movement?.boost,0);
});

test('mouse look, gradual curves and successive 45 degree steering preserve run-up without diagonal overspeed',()=>{
 for(const id of [25,26,135]){
  const sim=arena(id),boost=getMovementTrait(id).boost;
  // Sweep the camera through full rotations during both charge-up and running.
  for(let i=0;i<200;i++){
   const alpha=-Math.PI/2+i*.04;
   sim.update(.02,{...idle,...cameraRelativeMovement(alpha,1,0),...cameraAimDirection(alpha)});
   if(i>75)assert.equal(sim.state.player.movement?.boost,boost);
  }
  const alpha=-Math.PI/2+199*.04;
  for(const [forward,right] of [[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1],[1,0]]){
   const input={...cameraRelativeMovement(alpha,forward,right),...cameraAimDirection(alpha)};
   step(sim,.2,input);assert.equal(sim.state.player.movement?.boost,boost);
   const before={...sim.state.player};step(sim,.02,input);
   assert.ok(Math.abs(Math.hypot(sim.state.player.x-before.x,sim.state.player.z-before.z)/.02-DESIGN.playerSpeed*(1+boost!))<1e-8);
  }
 }
 const curve=arena(25);for(let i=0;i<200;i++)curve.update(.02,{...idle,mx:Math.cos(i*.02),mz:Math.sin(i*.02)});
 assert.equal(curve.state.player.movement?.boost,.25);
});

test('run-up charges basic, learned and special attacks, then ends when the attack fires',()=>{
 for(const mode of ['basic','learned','special']){
  for(const runTime of [1.1,1.6]){
   const damage:number[]=[];
   for(const charged of [false,true]){
    const {sim,s,hits}=attackArena(runTime);
    if(!charged){s.player.movement!.straightTime=0;s.player.movement!.boost=0;}
    const expectedBonus=Math.min(1,(runTime+.02-MOVEMENT_TRAITS.runupDelay)/MOVEMENT_TRAITS.runupRamp)*MOVEMENT_TRAITS.runupAttackBonus;
    if(mode==='basic')s.party[0].cooldown=0;
    if(mode==='learned')s.party[0].learnedMoves=[{moveId:'quick-attack',rank:1,cooldown:0}];
    sim.update(.02,{...idle,mx:1,special:mode==='special'});
    assert.equal(hits.length,1,`${mode} must land`);damage.push(hits[0].amount!);
    const report=runAnalyticsReport(s),row=report.outgoing[0];
    assert.equal(row.source.origin,mode==='basic'?'signature':mode==='special'?'q':'learned');
    assert.equal(row.source.actorId,s.party[0].uid);assert.equal(row.source.speciesId,25);
    assert.ok(Math.abs(report.totals.outgoing.effective-hits[0].amount!)<1e-8);
    assert.equal(s.player.movement?.boost,0);assert.equal(s.player.movement?.straightTime,0);
    step(sim,.1,{mx:1});assert.equal(s.player.movement?.straightTime,0,'Attack recovery cannot charge a run-up');
    if(charged)assert.ok(Math.abs(damage[1]/damage[0]-(1+expectedBonus))<1e-8,`${mode}: ${damage}`);
   }
  }
 }
});

test('only the next leader attack is charged when several moves are ready together',()=>{
 const {sim,s,hits}=attackArena();s.party[0].cooldown=0;
 s.party[0].learnedMoves=[{moveId:'thunder-shock',rank:1,cooldown:0}];
 sim.update(.02,{...idle,mx:1});assert.equal(hits.length,2);
 const learnedDamage=hits[0].amount!,basicDamage=hits[1].amount!;
 // Both moves can fire again immediately, but the consumed charge cannot repeat.
 s.party[0].cooldown=0;s.party[0].learnedMoves[0].cooldown=0;
 sim.update(.02,{...idle,mx:1});assert.equal(hits.length,4);
 assert.ok(Math.abs(learnedDamage/hits[2].amount!-1.5)<1e-8);
 assert.equal(basicDamage,hits[3].amount);
});

test('idle attack checks, companion casts and existing projectiles do not consume the leader charge',()=>{
 const sim=arena(25),s=sim.state;s.party[0].cooldown=0;
 s.party[0].learnedMoves=[{moveId:'thunder-shock',rank:1,cooldown:0}];
 step(sim,1.6,{mx:1});assert.equal(s.player.movement?.boost,.25,'No target means no attack');
 s.party[0].cooldown=10000;s.party[0].learnedMoves[0].cooldown=10000;
 const enemy=target(sim),companion={...s.party[0],uid:s.idCounter++,x:enemy.x,z:enemy.z-2,cooldown:0,learnedMoves:[]};s.party.push(companion);
 addProjectile(s,{x:enemy.x-1,z:enemy.z,vx:100,vz:0,ttl:1,damage:10,size:.2,kind:'bolt',type:'normal',penetration:0,friendly:true,sourceId:s.party[0].uid,poisonChance:0});
 sim.update(.02,{...idle,mx:1});assert.ok(enemy.hp<enemy.maxHp);assert.ok(companion.attackTimer>0);
 assert.equal(s.player.movement?.boost,.25);assert.equal(s.player.movement?.straightTime,MOVEMENT_TRAITS.runupDelay+MOVEMENT_TRAITS.runupRamp);
 s.phase='paused';const before=structuredClone(s);step(sim,2,{mx:1,special:true});assert.deepEqual(s,before);
});

test('batched rapid casts apply the run-up bonus to a single cast',()=>{
 const damage:number[]=[];
 for(const charged of [false,true]){
  const {sim,s,hits}=attackArena();
  if(!charged){s.player.movement!.straightTime=0;s.player.movement!.boost=0;}
  s.buffs.haste=1000;s.party[0].cooldown=0;
  sim.update(.02,{...idle,mx:1});damage.push(hits.reduce((sum,hit)=>sum+hit.amount!,0));
  assert.equal(s.player.movement?.boost,0);
 }
 const {sim,s,hits}=attackArena();s.player.movement!.straightTime=0;s.player.movement!.boost=0;s.party[0].cooldown=0;
 sim.update(.02,{...idle,mx:1});assert.equal(hits.length,1);
 assert.ok(Math.abs(damage[1]-damage[0]-hits[0].amount!*MOVEMENT_TRAITS.runupAttackBonus)<1e-8);
});
test('holding jump sustains a finite flight; release, recharge and a fresh takeoff are required',()=>{
 const sim=arena(16),p=sim.state.player;sim.update(.02,{...idle,jump:true,jumpHeld:true});
 step(sim,.3,{jumpHeld:true});assert.equal(p.movement?.flying,true);assert.ok(p.y>MOVEMENT_TRAITS.clearance);
 step(sim,1,{jumpHeld:true});assert.ok(p.y>2.8&&p.y<=3);assert.ok(p.movement!.flightRemaining<1.1);
 const paused=JSON.stringify(sim.state);sim.state.phase='paused';const frozen=JSON.stringify(sim.state);step(sim,5,{jumpHeld:true});assert.equal(JSON.stringify(sim.state),frozen);
 sim.state.phase='playing';assert.equal(JSON.stringify(sim.state),paused);
 step(sim,2,{jumpHeld:true});assert.equal(p.movement?.flying,false);assert.equal(p.y,0);assert.ok(p.movement!.flightCooldown>0);
 step(sim,5,{jumpHeld:true});assert.equal(p.y,0,'Holding cannot repeatedly take off');
 sim.update(.02,{...idle,jump:true,jumpHeld:true});step(sim,.3,{jumpHeld:true});assert.equal(p.movement?.flying,true);
 step(sim,.02,{jumpHeld:false});assert.equal(p.movement?.flying,false);assert.equal(p.movement?.flightCooldown,MOVEMENT_TRAITS.flightRecharge);
});
test('flight crosses scenery, lands outside colliders, respects water/bounds, and still takes ranged hits',()=>{
 const obstacles:Obstacle[]=[{kind:'circle',x:4,z:0,radius:1}];const sim=arena(16,obstacles),p=sim.state.player;
 sim.update(.02,{...idle,jump:true,jumpHeld:true});step(sim,.4,{jumpHeld:true});step(sim,1,{mx:1,jumpHeld:true});assert.ok(p.x>6);
 step(sim,1,{jumpHeld:false});assert.equal(p.y,0);assert.ok(new ObstacleField(obstacles).move(p,0,0).x===p.x);
 const field=new ObstacleField([{kind:'circle',x:4,z:0,radius:1,blocksFlight:true}]);assert.ok(field.move({x:0,z:0},8,0,DESIGN.playerRadius,true).x<3);
 assert.ok(field.move({x:WORLD.hardBoundary-1,z:0},20,0,DESIGN.playerRadius,true).x<=WORLD.hardBoundary);
 sim.update(.02,{...idle,jump:true,jumpHeld:true});step(sim,.3,{jumpHeld:true});
 // Allow the exhausted recharge to recover, then start a fresh flight.
 step(sim,5);sim.update(.02,{...idle,jump:true,jumpHeld:true});step(sim,.4,{jumpHeld:true});assert.ok(airborneTraversal(p,16));
 const enemy=createEnemy(sim.state,sim.rng,19,'normal',p.x,p.z);enemy.speed=0;enemy.attackCooldown=0;sim.state.enemies=[enemy];
 assert.equal(canReachAirbornePlayer(enemy,sim.state),false);enemy.speciesId=41;assert.equal(canReachAirbornePlayer(enemy,sim.state),true);enemy.speciesId=19;
 const hp=p.hp;p.iframes=0;
 addProjectile(sim.state,{x:p.x-1,z:p.z,vx:100,vz:0,ttl:1,damage:10,size:.2,kind:'bolt',type:'normal',penetration:0,friendly:false,sourceId:enemy.uid,poisonChance:0});
 sim.update(.02,{...idle,jumpHeld:true});assert.ok(p.hp<hp,'Flight grants no projectile invulnerability');
});
test('Magikarp leaps higher without auto-jumping, and unassigned species and Abra retain their controls',()=>{
 const fish=arena(129),normal=arena(7);for(const sim of [fish,normal])sim.update(.02,{...idle,jump:true});
 let fishTop=0,normalTop=0;for(let i=0;i<90;i++){
  fish.update(.02,{...idle,jump:true});normal.update(.02,{...idle,jump:true});fishTop=Math.max(fishTop,fish.state.player.y);normalTop=Math.max(normalTop,normal.state.player.y);
 }
 assert.ok(fishTop>normalTop*1.6);assert.equal(fish.state.player.y,0);assert.equal(normal.state.player.y,0);
 assert.equal(normal.state.player.movement,undefined);
 const abra=arena(63);abra.update(.02,{...idle,mx:1,dodge:true});assert.ok(abra.state.player.x>5);assert.equal(abra.state.player.dodgeTime,0);
 const p=fish.state.player;fish.state.party[0].speciesId=130;step(fish,.02);assert.equal(p.movement,undefined,'Evolution cannot retain another species movement state');
});
test('Pidgey flight and Magikarp leap clear committed ground melee while high enough',()=>{
 for(const speciesId of [16,129])for(const enemyId of [19,20,113]){
  const sim=arena(speciesId),s=sim.state,p=s.player;
  const enemy=createEnemy(s,sim.rng,enemyId,'normal',1.5,0);
  enemy.speed=0;enemy.attackCooldown=100;s.enemies=[enemy];
  sim.update(.02,{...idle,jump:true,jumpHeld:true});
  step(sim,.32,{jumpHeld:true});
  assert.ok(airborneTraversal(p,speciesId),`${speciesId} must reach melee clearance`);
  const profile=chooseEnemyAttack(enemy,s);
  assert.ok(profile.role==='melee-fast'||profile.role==='melee-slow');
  enemy.windup=prepareEnemyMove(enemy,p,profile);enemy.windup.remaining=.01;
  const hp=p.hp;p.iframes=0;
  sim.update(.02,{...idle,jumpHeld:true});
  assert.equal(p.hp,hp,`${speciesId} must evade ${enemyId}'s melee strike`);
  assert.equal(enemy.windup,undefined);
  assert.ok(enemy.attackCooldown>0,'Evaded melee still consumes the enemy attack');
  for(let i=0;i<150&&p.y>0;i++)sim.update(.02,idle);
  assert.equal(p.y,0);
  enemy.windup=prepareEnemyMove(enemy,p,profile);enemy.windup.remaining=.01;
  p.iframes=0;
  sim.update(.02,idle);
  assert.ok(p.hp<hp,'The same melee attack hits after landing');
 }
});
test('Magikarp can leap again on landing without a cooldown',()=>{
 const sim=arena(129),p=sim.state.player;
 sim.update(.02,{...idle,jump:true});
 for(let i=0;i<100&&p.y>0;i++)sim.update(.02,idle);
 assert.equal(p.y,0);
 assert.equal(p.movement?.flightCooldown,0);
 p.dodgeCooldown=10;
 sim.update(.02,{...idle,jump:true});
 assert.ok(p.y>0,'A fresh Space press launches the next leap immediately');
 assert.equal(p.movement?.flightCooldown,0);
});
test('movement traits are deterministic and reset with a fresh run',()=>{
 const a=arena(16),b=arena(16);
 for(let i=0;i<240;i++){const input={...idle,mx:i<100?1:0,mz:i>=100?1:0,jump:i===0||i===220,jumpHeld:i<90||i>=220};a.update(.02,input);b.update(.02,input);}
 assert.deepEqual(a.state,b.state);assert.equal(new Simulation(16,4).state.player.movement,undefined);
});
test('existing finite achievements backfill playable movement partners and survive save round trips',()=>{
 const save=migrateSave({version:2,unlocked:[1,4,7,25],achievements:['trail-reader','poison-patrol']})!;
 assert.ok(save.unlocked.includes(129));assert.ok(save.unlocked.includes(41));assert.ok(save.unlocked.includes(92));
 const imported=importSave(exportSave(save));assert.ok(imported.ok);if(imported.ok)assert.deepEqual(imported.save.unlocked,save.unlocked);
});
test('evolution previews expose movement tradeoffs without applying them',()=>{
 const sim=arena(25),before=JSON.stringify(sim.state);
 assert.deepEqual(upgradeStatPreview(sim.state,{id:'evolve',kind:'evolve',title:'',description:'',rarity:'epic',speciesId:1,targetId:26}),[{label:'Movement when leading',before:'Run-up +25%',after:'Run-up +18%'}]);
 assert.equal(JSON.stringify(sim.state),before);
});
