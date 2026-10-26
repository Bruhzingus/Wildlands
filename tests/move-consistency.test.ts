import test from 'node:test';
import assert from 'node:assert/strict';
import {KANTO,getSpecies} from '../src/data/kanto.ts';
import {getAttackProfile,describeAttackMechanic} from '../src/data/attacks.ts';
import {getLearnedMoveProfile,getMoveDefinition,LEARNABLE_MOVES} from '../src/data/moves.ts';
import {getSignatureMoveDefinition} from '../src/data/moveDefinitions.ts';
import {getSpecialProfile} from '../src/data/specials.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {makeChoices} from '../src/game/systems/progression.ts';
import {RNG} from '../src/utils/random.ts';

const ranks=[1,2,3,5,8,12,50];
const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('all species sharing a named signature use identical move mechanics at every rank',()=>{
 const firstByName=new Map<string,number>();
 for(const species of KANTO){
  const first=firstByName.get(species.moveName);
  if(first===undefined){firstByName.set(species.moveName,species.id);continue;}
  for(const rank of ranks)assert.deepEqual(getAttackProfile(species.id,rank),getAttackProfile(first,rank),`${species.moveName}, rank ${rank}`);
 }
 assert.equal(getAttackProfile(41).pattern,'pounce');
 assert.equal(getAttackProfile(120).pattern,'swift');
 assert.equal(getAttackProfile(120).element,'normal');
 assert.equal(getAttackProfile(16).element,'flying');
});

test('every learned move matching a signature shares its base power, element, mechanics and training',()=>{
 let matches=0;
 for(const move of LEARNABLE_MOVES){
  const users=KANTO.filter(species=>species.moveName===move.name);
  for(const species of users){
   matches++;
   assert.equal(getSignatureMoveDefinition(species.moveName),move);
   assert.equal(describeAttackMechanic(species.id),move.description);
   for(const rank of ranks)assert.deepEqual(getLearnedMoveProfile(move.id,rank),getAttackProfile(species.id,rank),`${move.name}, rank ${rank}`);
  }
 }
 assert.ok(matches>25,'Cover the entire overlapping move catalogue');
});

function cast(speciesId:number,moveId:string,rank:number,learned:boolean){
 const sim=new Simulation(speciesId,194),state=sim.state,member=state.party[0],combat=sim as any;
 member.x=member.z=0;member.attackLevel=rank;member.level=20;
 member.trainingBuffs={power:.3,haste:.2};state.buffs.crit=-1;
 const target=createEnemy(state,sim.rng,19,'normal',2,0);
 target.hp=target.maxHp=100000;target.speed=0;state.enemies=[target];
 sim.rng.next=()=>.99;
 if(learned)combat.fireLearnedMove(member,{moveId,rank,cooldown:0},target);
 else combat.fireFromMember(member,target);
 const shots=state.projectiles.map(shot=>({damage:shot.damage,type:shot.type,kind:shot.kind,silhouette:shot.silhouette,behavior:shot.behavior,status:shot.status}));
 for(let frame=0;frame<250&&state.projectiles.length;frame++)combat.updateProjectiles(.02);
 return {damage:target.maxHp-target.hp,shots};
}

test('signature and learned versions deliver the same actual hits and damage for the same caster',()=>{
 for(const [speciesId,moveId] of [[4,'ember'],[8,'water-gun'],[25,'thunder-shock'],[129,'tackle'],[133,'swift']] as const){
  for(const rank of [1,3,8,20]){
   const primary=cast(speciesId,moveId,rank,false),learned=cast(speciesId,moveId,rank,true);
   assert.ok(primary.damage>0,`${moveId} must hit at rank ${rank}`);
   assert.deepEqual(learned,primary,`${moveId} must retain its damage and delivery in either slot at rank ${rank}`);
  }
 }
});

test('Pokémon power still affects the shared move rather than changing its base definition',()=>{
 const eevee=cast(133,'swift',3,true),gyarados=cast(130,'swift',3,true);
 const ratio=(getSpecies(130).power+9)/(getSpecies(133).power+9)*1.12/.8;
 close(gyarados.damage/eevee.damage,ratio);
 assert.equal(getMoveDefinition('swift')!.power,getSignatureMoveDefinition('Swift').power);
});

test('both move slots apply ranked cooldowns exactly once',()=>{
 for(const rank of [1,8,50]){
  const sim=new Simulation(133,47),state=sim.state,member=state.party[0];
  member.x=member.z=0;member.attackLevel=rank;member.cooldown=0;
  member.learnedMoves=[{moveId:'swift',rank,cooldown:0}];state.buffs.haste=.4;
  const target=createEnemy(state,sim.rng,19,'normal',3,0);target.hp=target.maxHp=100000;state.enemies=[target];
  (sim as any).updateAttacks(.01);
  close(member.cooldown,member.learnedMoves[0].cooldown);
  close(member.cooldown+.01,1.05/(1+(rank-1)*.07)/1.4);
 }
});

test('shared learned-move milestones appear in their upgrade offers',()=>{
 const state=new Simulation(4,47).state,member=state.party[0];
 member.level=20;member.learnedMoves=[{moveId:'swift',rank:2,cooldown:0}];state.recruitCount=5;
 const card=Array.from({length:60},(_,seed)=>makeChoices(state,new RNG((seed+40)*7919))).flat().find(choice=>choice.kind==='attack'&&choice.moveId==='swift')!;
 assert.ok(card);assert.match(card.description,/Three independently seeking stars/);
 assert.match(card.description,/\+1 projectile/);
});

test('Thunder Circuit has the same intrinsic handling on Pikachu, Raichu and Jolteon',()=>{
 for(const rank of ranks){
  const {damageScale,...pikachu}=getSpecialProfile(25,rank);
  for(const id of [26,135]){
   const {damageScale:casterDamage,...profile}=getSpecialProfile(id,rank);
   assert.deepEqual(profile,pikachu);
   close(casterDamage/damageScale,1.12);
  }
 }
});

test('resolving a move for one caster cannot change its subsequent profiles',()=>{
 const before=getAttackProfile(133,8),profile=getLearnedMoveProfile('swift',8);
 profile.status.poison=1;profile.growth.range=100;profile.projectiles=100;
 assert.deepEqual(getAttackProfile(120,8),before);
 assert.deepEqual(getLearnedMoveProfile('swift',8),before);
});
