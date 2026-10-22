import test from 'node:test';
import assert from 'node:assert/strict';
import {getSpecies,starterChoices} from '../src/data/kanto.ts';
import {describeAttackMechanic,describeAttackUpgrade,getAttackProfile} from '../src/data/attacks.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {executePattern,type CombatVisual} from '../src/game/combat/patterns.ts';
import {addProjectile,stepProjectiles,type ProjectileSpawn} from '../src/game/combat/projectiles.ts';
import type {Enemy} from '../src/game/types.ts';

function arena(speciesId:number,rank=1){
 const sim=new Simulation(speciesId,47),state=sim.state;state.enemies=[];
 const member=state.party[0];member.attackLevel=rank;member.x=member.z=0;
 const add=(x:number,z=0)=>{
  const enemy=createEnemy(state,sim.rng,19,'normal',x,z);enemy.hp=enemy.maxHp=10000;enemy.speed=0;
  state.enemies.push(enemy);return enemy;
 };
 const hits:{enemy:Enemy;damage:number}[]=[],shots:ProjectileSpawn[]=[],visuals:CombatVisual[]=[];
 const profile=getAttackProfile(speciesId,rank);
 const cast=(target:Enemy)=>executePattern({member,target,enemies:state.enemies,profile,element:profile.element??getSpecies(speciesId).types[0],damage:100,crit:false,depth:0,radiusScale:1,extraProjectiles:0,extraPierce:0,extraChains:0,projectileSpeedScale:1,
  hit:(enemy,damage)=>hits.push({enemy,damage}),projectile:shot=>shots.push(shot),visual:visual=>visuals.push(visual),heal:()=>assert.fail('Offensive starter healed')});
 const launch=()=>{for(const shot of shots)addProjectile(state,shot);};
 const step=(dt:number)=>stepProjectiles(state,dt,{hit:(enemy,shot)=>hits.push({enemy,damage:shot.damage}),hurtPlayer:()=>assert.fail('Friendly fire')});
 return {state,member,add,hits,shots,visuals,cast,launch,step};
}

test('every starter has different handling and evolution ranks never remove earned attack capacity',()=>{
 const identities=starterChoices().map(id=>{const profile=getAttackProfile(id);return profile.pattern||profile.kind;});
 assert.equal(new Set(identities).size,starterChoices().length);
 for(const id of [...starterChoices(),2,3,5,6,8,9,11,12,17,18,26,28,38,44,45,53,59,64,65,67,68,93,94,134]){
  assert.ok(describeAttackMechanic(id).length>30);
  for(let rank=2;rank<=8;rank++){
   const previous=getAttackProfile(id,rank-1),current=getAttackProfile(id,rank);
   for(const field of ['projectiles','pierce','chains','bounces','strikes','splashRadius'] as const){
    assert.ok((current[field]||0)>=(previous[field]||0),`${getSpecies(id).name} lost ${field} at rank ${rank}`);
   }
  }
 }
 assert.match(describeAttackUpgrade(1,2,3),/Twin vine lanes/);
 assert.match(describeAttackUpgrade(7,1,2),/soaking splashes/);
 assert.match(describeAttackUpgrade(52,1,2),/bounce twice/);
 assert.match(describeAttackUpgrade(66,2,3),/Three-hit/);
 assert.equal(getAttackProfile(1).growth.projectilesEvery,0,'Vines inherit slash growth rather than old lob growth');
});

test('Magikarp physically tackles one nearby foe and Gyarados fires Hyper Beam',()=>{
 const fish=arena(129),target=fish.add(2.4),other=fish.add(2.4,1);
 fish.cast(target);
 assert.deepEqual(fish.hits.map(hit=>hit.enemy.uid),[target.uid]);
 assert.equal(fish.shots.length,0);
 assert.equal(fish.visuals[0].shape,'tackle');
 assert.equal(getAttackProfile(129).element,'normal');
 assert.equal(getAttackProfile(129).status.soak,undefined);
 assert.ok(!fish.hits.some(hit=>hit.enemy.uid===other.uid));
 assert.equal(getSpecies(130).moveName,'Hyper Beam');
 assert.equal(getAttackProfile(130).kind,'beam');
 assert.equal(getAttackProfile(130).element,'normal');
 assert.equal(getAttackProfile(130).status.soak,undefined);
});

test('starter HP is reduced by 20% and first-stage ranged signatures deal 20% less damage',()=>{
 const threeStage=new Simulation(4,4).state,twoStage=new Simulation(58,4).state,fish=new Simulation(129,4).state;
 assert.equal(threeStage.player.maxHp,120*.8);
 assert.equal(threeStage.party[0].maxHp,165*.8);
 assert.equal(twoStage.player.maxHp,120*.8*getSpecies(58).health);
 assert.equal(fish.player.maxHp,120*.8*getSpecies(129).health);
 assert.ok(fish.player.maxHp<threeStage.player.maxHp);
 assert.equal(getAttackProfile(4).damageScale,.48*.8);
 assert.equal(getAttackProfile(7).damageScale,.9*.8);
 assert.equal(getAttackProfile(25).damageScale,.8);
 assert.equal(getAttackProfile(58).damageScale,1.05*1.25);
});

test('Bulbasaur lashes through a lane while Charmander fires a spread and Squirtle bursts soaking bubbles',()=>{
 const vines=arena(1),near=vines.add(3),far=vines.add(7);vines.add(4,3);vines.add(-2);
 vines.cast(near);assert.deepEqual(vines.hits.map(hit=>hit.enemy.uid),[near.uid,far.uid]);assert.equal(vines.shots.length,0);assert.equal(vines.visuals[0].shape,'vine');
 const fire=arena(4),fireTarget=fire.add(7);fire.cast(fireTarget);assert.equal(fire.shots.length,3);
 assert.ok(fire.shots.every(shot=>shot.behavior==='straight'));assert.ok(fire.shots.some(shot=>shot.vz<0)&&fire.shots.some(shot=>shot.vz>0));
 fire.launch();fireTarget.z=100;const velocity=fire.state.projectiles[0].vz;fire.step(.04);assert.equal(fire.state.projectiles[0].vz,velocity,'Flames do not bend back into the same homing bolt');
 const water=arena(7),waterTarget=water.add(3),splashNeighbor=water.add(3,.65);water.add(3,2);
 water.cast(waterTarget);assert.equal(water.shots.length,1);assert.equal(water.shots[0].behavior,'homing');water.launch();
 for(let step=0;step<12;step++)water.step(.04);
 assert.deepEqual(new Set(water.hits.map(hit=>hit.enemy.uid)),new Set([waterTarget.uid,splashNeighbor.uid]));assert.equal(water.state.projectiles.length,0);
});

test('Pikachu jumps through clustered targets while Swift seeks separate targets independently',()=>{
 const lightning=arena(25),a=lightning.add(3),b=lightning.add(6),c=lightning.add(9);lightning.add(30);
 lightning.cast(a);assert.deepEqual(lightning.hits.map(hit=>hit.enemy.uid),[a.uid,b.uid,c.uid]);assert.equal(lightning.shots.length,0);
 assert.deepEqual(lightning.visuals.map(visual=>visual.shape),['chain','chain','chain']);
 const swift=arena(133),first=swift.add(4),second=swift.add(4,4);swift.cast(first);
 assert.equal(getSpecies(133).moveName,'Swift');
 assert.ok(swift.shots.every(shot=>shot.silhouette==='star'),'Swift shots carry their star silhouette');
 assert.deepEqual(swift.shots.map(shot=>shot.targetId),[first.uid,second.uid]);assert.ok(swift.shots.every(shot=>shot.behavior==='homing'));
 swift.launch();for(let step=0;step<30;step++)swift.step(.04);
 assert.deepEqual(new Set(swift.hits.map(hit=>hit.enemy.uid)),new Set([first.uid,second.uid]));
});

test('silk binds the first row target, gusts push through crowds, and ground waves leave the rear exposed',()=>{
 const silk=arena(10),front=silk.add(3);silk.add(6);silk.cast(front);
 assert.deepEqual(silk.hits.map(hit=>hit.enemy.uid),[front.uid]);assert.equal(silk.visuals[0].shape,'thread');assert.equal(getAttackProfile(10).status.slow,1);
 const trainedSilk=arena(10,5),first=trainedSilk.add(3),second=trainedSilk.add(6);trainedSilk.cast(first);
 assert.deepEqual(trainedSilk.hits.map(hit=>hit.enemy.uid),[first.uid,second.uid]);
 const wind=arena(16),windTarget=wind.add(3),next=wind.add(6);wind.cast(windTarget);wind.launch();
 for(let step=0;step<20;step++)wind.step(.04);
 assert.equal(wind.hits.length,2);assert.ok(windTarget.x>3&&next.x>6);
 const sand=arena(27),sandTarget=sand.add(3),far=sand.add(7);sand.add(-2);sand.add(3,5);sand.cast(sandTarget);
 assert.deepEqual(sand.hits.map(hit=>hit.enemy.uid),[sandTarget.uid,far.uid]);assert.equal(sand.visuals[0].shape,'sand-wave');
});

test('coins ricochet without revisiting a target, and trained spore pods scatter toward separate enemies',()=>{
 const coins=arena(52,2),a=coins.add(3),b=coins.add(3,3),c=coins.add(6,3);coins.cast(a);coins.launch();
 for(let step=0;step<30;step++)coins.step(.04);
 assert.deepEqual(coins.hits.map(hit=>hit.enemy.uid),[a.uid,b.uid,c.uid]);assert.ok(coins.hits[1].damage<coins.hits[0].damage);
 const spores=arena(43,4),first=spores.add(4),second=spores.add(4,6);spores.cast(first);
 assert.deepEqual(spores.shots.map(shot=>shot.targetId),[first.uid,second.uid]);assert.ok(spores.shots.every(shot=>shot.kind==='lob'&&shot.status?.poison));
});

test('pounces sweep the approach, chop combos repeat only in front, and psychic lances cross from separate origins',()=>{
 assert.equal(getSpecies(58).moveName,'Bite');
 const pounce=arena(58),approach=pounce.add(3),target=pounce.add(7);pounce.add(3,5);pounce.cast(target);
 assert.deepEqual(pounce.hits.map(hit=>hit.enemy.uid),[approach.uid,target.uid]);assert.ok(approach.x>3&&target.x>7);
 const chops=arena(66),front=chops.add(3);chops.add(-2);chops.cast(front);
 assert.deepEqual(chops.hits.map(hit=>hit.enemy.uid),[front.uid,front.uid]);
 const psychic=arena(63),focus=psychic.add(8);psychic.cast(focus);
 assert.equal(psychic.shots.length,2);assert.ok(psychic.shots[0].z*psychic.shots[1].z<0);
 for(const shot of psychic.shots){assert.equal(shot.behavior,'straight');assert.ok(shot.penetration>0);assert.ok(shot.z*shot.vz<0);}
});

test('foxfire spirals into its selected enemy while ghost wisps maintain an orbit around their moving owner',()=>{
 const fox=arena(37),target=fox.add(6);fox.cast(target);fox.launch();
 const initialRadius=fox.state.projectiles[0].orbitRadius!;fox.step(.04);
 assert.ok(fox.state.projectiles[0].orbitRadius!<initialRadius);
 for(let step=0;step<40;step++)fox.step(.04);
 assert.ok(fox.hits.some(hit=>hit.enemy.uid===target.uid),'The spiral reaches the selected enemy, rather than circling forever');
 const ghosts=arena(92),ghostTarget=ghosts.add(7);ghosts.cast(ghostTarget);ghosts.launch();
 ghosts.member.x=2;ghosts.member.z=3;ghosts.step(.04);
 for(const shot of ghosts.state.projectiles)assert.ok(Math.abs(Math.hypot(shot.x-2,shot.z-3)-3)<1e-9);
 assert.ok(ghosts.state.projectiles.every(shot=>shot.targetId===undefined));
});
