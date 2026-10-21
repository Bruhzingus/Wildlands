import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,type MoveInput} from '../src/game/Simulation.ts';
import {DESIGN} from '../src/data/config.ts';
import {getMovementTrait,MOVEMENT_TRAITS} from '../src/data/movementTraits.ts';
import {airborneTraversal,canReachAirbornePlayer} from '../src/game/systems/movement.ts';
import {ObstacleField,type Obstacle} from '../src/game/systems/environment.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {addProjectile} from '../src/game/combat/projectiles.ts';
import {migrateSave,exportSave,importSave} from '../src/game/save.ts';
import {upgradeStatPreview} from '../src/ui/upgradePreview.ts';
const idle:MoveInput={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
function arena(id:number,obstacles:Obstacle[]=[]){
 const sim=new Simulation(id,4),s=sim.state;s.enemies=[];s.terrainFeatures=[];s.party[0].cooldown=10000;
 Object.assign(sim,{obstacles:new ObstacleField(obstacles),spawnAccum:-10000});return sim;
}
function step(sim:Simulation,seconds:number,input:Partial<MoveInput>={}){for(let left=seconds;left>1e-8;left-=.02)sim.update(Math.min(.02,left),{...idle,...input});}
test('straight travel builds a bounded run-up only after one second and preserves percentage speed gains',()=>{
 const sim=arena(25),normal=arena(1);step(sim,.98,{mx:1});assert.equal(sim.state.player.movement?.boost,0);
 step(sim,.7,{mx:1});step(normal,1.68,{mx:1});
 assert.equal(sim.state.player.movement?.boost,.25);assert.ok(sim.state.player.x>normal.state.player.x+.3);
 const x=sim.state.player.x;step(sim,.2,{mx:1});assert.ok(Math.abs((sim.state.player.x-x)/.2-DESIGN.playerSpeed*1.25)<1e-8);
 sim.state.buffs.speed=2;step(sim,.5,{mx:1});const fast=sim.state.player.x;
 step(sim,.1,{mx:1});assert.ok(Math.abs((sim.state.player.x-fast)/.1-DESIGN.playerSpeed*3*1.25)<1e-8);
 assert.ok(getMovementTrait(25).boost!>getMovementTrait(26).boost!,'Early lower-power kits have the larger traversal budget');
});
test('turns, stops, dodges, blocked travel and gradual curves cannot retain or farm a run-up',()=>{
 for(const input of [{mx:-1},{},{mx:1,dodge:true},{mx:1,jump:true}]){
  const sim=arena(25);step(sim,1.6,{mx:1});assert.ok(sim.state.player.movement!.boost>0);
  sim.update(.02,{...idle,...input});assert.equal(sim.state.player.movement?.boost,0);
 }
 const blocked=arena(25,[{kind:'circle',x:4,z:0,radius:2}]);step(blocked,3,{mx:1});assert.equal(blocked.state.player.movement?.boost,0);
 const curve=arena(25);for(let i=0;i<200;i++)curve.update(.02,{...idle,mx:Math.cos(i*.02),mz:Math.sin(i*.02)});
 assert.equal(curve.state.player.movement?.boost,0);
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
 assert.ok(field.move({x:140,z:0},20,0,DESIGN.playerRadius,true).x<=113*1.25);
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
