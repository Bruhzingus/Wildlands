import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,type MoveInput} from '../src/game/Simulation.ts';
import {DESIGN} from '../src/data/config.ts';
import {MOVEMENT_TRAITS,getMovementTrait} from '../src/data/movementTraits.ts';
import {isBurrowed,canReachAirbornePlayer} from '../src/game/systems/movement.ts';
import {ObstacleField} from '../src/game/systems/environment.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {addProjectile} from '../src/game/combat/projectiles.ts';

const idle:MoveInput={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
function arena(id=27){
 const sim=new Simulation(id,4),s=sim.state;s.enemies=[];s.pois=[];s.terrainFeatures=[];s.party[0].cooldown=10000;
 Object.assign(sim,{obstacles:new ObstacleField([]),spawnAccum:-10000});return sim;
}
function step(sim:Simulation,seconds:number,input:Partial<MoveInput>={}){for(let left=seconds;left>1e-8;left-=.02)sim.update(Math.min(.02,left),{...idle,...input});}

test('digging specialists use a slower, longer directional dash that spends a charge',()=>{
 for(const id of [27,28,50,51,95]){
  assert.equal(getMovementTrait(id).kind,'burrow');
  const sim=arena(id),p=sim.state.player;sim.update(.02,{...idle,mx:1,dodge:true});
  assert.equal(p.burrowTime,MOVEMENT_TRAITS.burrowSeconds);assert.equal(p.dodgeTime,0);assert.equal(p.dodgeCharges,0);
  assert.equal(p.x/.02,MOVEMENT_TRAITS.burrowSpeed);assert.ok(MOVEMENT_TRAITS.burrowSpeed<DESIGN.dodgeSpeed);
  assert.ok(MOVEMENT_TRAITS.burrowSeconds>DESIGN.dodgeSeconds);
  step(sim,.5,{mz:1,jump:true,special:true});assert.ok(isBurrowed(p));assert.equal(p.z,0);assert.equal(p.y,0);assert.equal(p.specialCooldown,0);
  step(sim,.4);assert.equal(isBurrowed(p),false);assert.ok(p.x>6);assert.equal(p.dodgeCharges,0);
  step(sim,4,{dodge:true});assert.equal(isBurrowed(p),false,'Holding Shift cannot repeatedly burrow');assert.equal(p.dodgeCharges,1);
 }
});

test('Sandshrew takes 30% longer to recharge stamina without changing other burrow users',()=>{
 const sandshrew=arena(27),sandslash=arena(28);
 sandshrew.update(.02,{...idle,dodge:true});sandslash.update(.02,{...idle,dodge:true});
 assert.equal(sandshrew.state.player.dodgeCooldown,DESIGN.dodgeCooldown*1.3);
 assert.equal(sandslash.state.player.dodgeCooldown,DESIGN.dodgeCooldown);
});

test('burrow prevents enemy contact, projectiles, blast damage, rings, poison and bypass damage throughout',()=>{
 const sim=arena(),s=sim.state,p=s.player;sim.update(.02,{...idle,dodge:true});
 const enemy=createEnemy(s,sim.rng,19,'normal',p.x,p.z);enemy.speed=0;enemy.attackCooldown=10000;s.enemies=[enemy];
 const hp=p.hp;p.iframes=0;
 assert.equal(canReachAirbornePlayer(enemy,s),false);enemy.isBoss=true;assert.equal(canReachAirbornePlayer(enemy,s),false);
 for(let i=0;i<32;i++){
  enemy.x=p.x;enemy.z=p.z;enemy.hitCooldown=0;
  addProjectile(s,{x:p.x,z:p.z,vx:0,vz:0,ttl:1,damage:12,size:.8,kind:i%2?'lob':'bolt',radius:3,type:'poison',penetration:0,friendly:false,sourceId:enemy.uid,poisonChance:1});
  s.psychicRings=[{uid:1000+i,sourceId:enemy.uid,x:p.x,z:p.z,radius:0,previousRadius:0,maxRadius:10,speed:50,width:2,damage:15,hit:new Set()}];
  p.poisonTime=1;p.iframes=0;sim.update(.02,idle);
  (sim as any).hurtPlayer(20,true,true,true,enemy.uid);
  assert.ok(isBurrowed(p));assert.equal(p.hp,hp);assert.equal(s.stats.damageTaken,0);
 }
 step(sim,.2);p.iframes=0;const before=p.hp;(sim as any).hurtPlayer(10,false);assert.ok(p.hp<before,'Protection ends when the Pokémon surfaces');
});

test('burrow uses active time, respects scenery and bounds, and ends on a species change',()=>{
 const sim=arena(),p=sim.state.player;
 Object.assign(sim,{obstacles:new ObstacleField([{kind:'circle',x:3,z:0,radius:1}])});
 sim.update(.02,{...idle,mx:1,dodge:true});sim.state.phase='paused';const frozen=structuredClone(sim.state);step(sim,1);assert.deepEqual(sim.state,frozen);
 sim.state.phase='playing';step(sim,.5);assert.ok(p.x<3-DESIGN.playerRadius);assert.ok(isBurrowed(p));
 sim.state.party[0].speciesId=7;sim.update(.02,idle);assert.equal(p.burrowTime,undefined);
 const edge=arena();edge.state.player.x=DESIGN.mapRadius-1;edge.update(.02,{...idle,mx:1,dodge:true});step(edge,.7);assert.ok(edge.state.player.x<=DESIGN.mapRadius-DESIGN.playerRadius);
});
