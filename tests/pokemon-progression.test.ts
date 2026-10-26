import test from 'node:test';
import assert from 'node:assert/strict';
import {getLearnedMoveProfile,learnableMoves,learnedMovePower} from '../src/data/moves.ts';
import {PROGRESSION,TRAINING_UPGRADES} from '../src/data/progression.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {BUILD_STAT_CAPS,getBuildModifiers} from '../src/game/systems/builds.ts';
import {applyChoice,eligibleEvolutions,learnedMoveSlots,makeChoices,xpThreshold} from '../src/game/systems/progression.ts';
import type {PartyMember,RunState,UpgradeChoice} from '../src/game/types.ts';
import {RNG} from '../src/utils/random.ts';

const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} !== ${expected}`);
function learnCard(member:PartyMember,moveId:string):UpgradeChoice {
 return {id:`learn-${member.uid}-${moveId}`,kind:'learn',speciesId:member.uid,sourceSpeciesId:member.speciesId,moveId,
  title:'Learn',description:'',rarity:'rare',rank:1};
}
function allOffers(state:RunState):UpgradeChoice[]{
 return Array.from({length:60},(_,seed)=>makeChoices(state,new RNG((seed+40)*7919))).flat();
}
function cacheOffers(state:RunState):UpgradeChoice[]{
 return Array.from({length:60},(_,seed)=>makeChoices(state,new RNG(seed+40),'cache')).flat();
}

test('evolution improves all known moves and base stats while preserving level, XP and four slots',()=>{
 const state=new Simulation(4,8).state,member=state.party[0];
 state.recruitCount=5;member.level=30;state.stats.elapsed=300;
 const moves=learnableMoves(member.speciesId);
 assert.equal(learnedMoveSlots(member),3);
 for(const move of moves.slice(0,3))assert.equal(applyChoice(state,learnCard(member,move.id)).applied,true);
 assert.equal(applyChoice(state,learnCard(member,moves[3].id)).applied,false,'A fifth total move cannot be learned');
 assert.ok(allOffers(state).every(choice=>choice.kind!=='learn'));
 member.attackLevel=4;member.learnedMoves![0].rank=5;member.xp=71;
 const before=structuredClone(member),hpFraction=member.hp/member.maxHp;
 const evolution:UpgradeChoice={id:'evolve-1-5',kind:'evolve',speciesId:1,sourceSpeciesId:4,targetId:5,title:'Evolution',description:'',rarity:'epic'};
 assert.equal(applyChoice(state,evolution).applied,true);
 assert.equal(member.speciesId,5);assert.equal(member.level,before.level);assert.equal(member.xp,before.xp);
 assert.equal(member.attackLevel,before.attackLevel+1);
 assert.deepEqual(member.learnedMoves,before.learnedMoves!.map(move=>({...move,rank:move.rank+1})));
 close(getBuildModifiers(state,member).power,.25);
 assert.equal(learnedMoveSlots(member),3);close(member.maxHp,before.maxHp*1.25);close(member.hp/member.maxHp,hpFraction);
 assert.ok(allOffers(state).every(choice=>choice.kind!=='learn'));
});

test('evolution merges a duplicate signature move, preserves the highest rank, and frees its slot',()=>{
 for(const [signatureRank,learnedRank] of [[2,6],[7,3]]){
  const state=new Simulation(4,8).state,member=state.party[0];
  state.recruitCount=5;state.stats.elapsed=300;member.level=30;
  for(const moveId of ['swift','flame-burst','brick-break'])assert.equal(applyChoice(state,learnCard(member,moveId)).applied,true);
  member.attackLevel=signatureRank;member.learnedMoves![1].rank=learnedRank;
  const retained=structuredClone(member.learnedMoves!.filter(move=>move.moveId!=='flame-burst'));
  const rank=Math.min(8,Math.max(signatureRank,learnedRank)+1),evolution=allOffers(state).find(choice=>choice.targetId===5)!;
  assert.ok(evolution);assert.match(evolution.description,new RegExp(`signature attack at rank ${rank}, freeing 1 move slot`));
  const result=applyChoice(state,evolution);
  assert.equal(result.applied,true);assert.match(result.event,/1 move slot freed/);
  assert.equal(member.attackLevel,rank);assert.equal(member.level,30);
  assert.deepEqual(member.learnedMoves,retained.map(move=>({...move,rank:move.rank+1})));assert.equal(1+member.learnedMoves!.length,3);
  assert.ok(!member.learnedMoves!.some(move=>move.moveId==='flame-burst'));
  const newMove=allOffers(state).find(choice=>choice.kind==='learn')!;
  assert.ok(newMove);assert.notEqual(newMove.moveId,'flame-burst');assert.equal(applyChoice(state,newMove).applied,true);
  assert.equal(1+member.learnedMoves!.length,4);assert.ok(allOffers(state).every(choice=>choice.kind!=='learn'));
 }
});

test('evolution bonuses continue beyond old move caps and cannot be claimed twice',()=>{
 const state=new Simulation(4,8).state,member=state.party[0];
 state.recruitCount=5;member.level=30;state.stats.elapsed=300;member.attackLevel=8;
 member.learnedMoves=[{moveId:'swift',rank:8,cooldown:1.5},{moveId:'hyper-beam',rank:7,cooldown:2}];
 const evolution=allOffers(state).find(choice=>choice.kind==='evolve')!;
 assert.ok(evolution);assert.match(evolution.description,/\+1 rank to every known move/);
 assert.equal(applyChoice(state,evolution).applied,true);
 assert.equal(member.attackLevel,9);assert.deepEqual(member.learnedMoves.map(move=>move.rank),[9,8]);
 assert.deepEqual(member.learnedMoves.map(move=>move.cooldown),[1.5,2]);
 const after=structuredClone(member);
 assert.equal(applyChoice(state,evolution).applied,false);assert.deepEqual(member,after);
});

test('evolution merges a learned duplicate of its special and preserves its training',()=>{
 const state=new Simulation(8,8).state,member=state.party[0];
 state.recruitCount=5;state.stats.elapsed=300;member.level=30;member.attackLevel=2;
 // Older runs could learn Surf despite already having it as a special.
 member.learnedMoves=[{moveId:'surf',rank:6,cooldown:2},{moveId:'tackle',rank:3,cooldown:1}];
 const evolution=allOffers(state).find(choice=>choice.kind==='evolve'&&choice.targetId===9)!;
 assert.ok(evolution);assert.match(evolution.description,/Surf merges into its special ability at rank 7, freeing 1 move slot/);
 assert.equal(applyChoice(state,evolution).applied,true);
 assert.equal(member.attackLevel,7);
 assert.deepEqual(member.learnedMoves,[{moveId:'tackle',rank:4,cooldown:1}]);
 assert.ok(allOffers(state).every(choice=>choice.kind!=='learn'||choice.moveId!=='surf'));
});

test('single-stage mastery applies indefinitely to learned moves with accurate offers and stale-card guards',()=>{
 const state=new Simulation(123,31).state,member=state.party[0];state.recruitCount=5;member.level=30;
 for(const move of learnableMoves(member.speciesId,member.level).slice(0,3))assert.equal(applyChoice(state,learnCard(member,move.id)).applied,true);
 const learned=member.learnedMoves![0];
 const card=allOffers(state).find(choice=>choice.kind==='attack'&&choice.moveId===learned.moveId)!;
 assert.ok(card);assert.equal(card.amount,2);assert.equal(card.rank,3);assert.equal(card.maxRank,undefined);
 assert.match(card.description,/\+34\.0% damage/);assert.match(card.description,/12\.3% shorter cooldown/);
 assert.match(card.description,/Rank 1 to 3\./);
 assert.equal(applyChoice(state,{...card,amount:1,rank:2}).applied,false);
 assert.equal(applyChoice(state,card).applied,true);assert.equal(learned.rank,3);
 assert.equal(applyChoice(state,card).applied,false);
 learned.rank=11;
 const last=allOffers(state).find(choice=>choice.kind==='attack'&&choice.moveId===learned.moveId)!;
 assert.equal(last.amount,2);assert.equal(last.rank,13);assert.equal(applyChoice(state,last).applied,true);
 assert.ok(allOffers(state).some(choice=>choice.moveId===learned.moveId&&choice.rank===15));
 const normal=new Simulation(6,32).state;normal.recruitCount=5;normal.party[0].level=99;
 normal.party[0].learnedMoves=[{moveId:learned.moveId,rank:8,cooldown:0}];
 assert.ok(allOffers(normal).some(choice=>choice.moveId===learned.moveId&&choice.rank===9),'Fully evolved species keep training past rank 8');
});

test('milestone move cards target only their owner and include stat training',()=>{
 const state=new Simulation(1,9).state,leader=state.party[0];state.recruitCount=5;
 const follower={...structuredClone(leader),uid:42,speciesId:4,level:3};state.party.push(follower);state.levelUpMemberId=42;
 for(let seed=1;seed<=30;seed++){
  const choices=makeChoices(state,new RNG(seed));
  assert.equal(choices.length,3);assert.equal(new Set(choices.map(choice=>choice.id)).size,3);
  const moves=choices.filter(choice=>choice.kind==='learn'||choice.kind==='attack');
  assert.equal(moves.length,1);assert.ok(choices.some(choice=>choice.kind==='stat'));assert.ok(moves.every(choice=>choice.speciesId===42));
  assert.ok(moves.some(choice=>choice.kind==='attack'),'Existing moves remain a regular training option');
  assert.ok(choices.every(choice=>choice.kind!=='item'));
 }
 const wrongOwner=learnCard(leader,learnableMoves(leader.speciesId)[0].id);
 assert.equal(applyChoice(state,wrongOwner).applied,false);
 const offered=makeChoices(state,new RNG(11)).find(choice=>choice.kind==='attack')!;
 const previousLeader=leader.attackLevel;
 assert.equal(applyChoice(state,offered).applied,true);assert.equal(follower.attackLevel,2);assert.equal(leader.attackLevel,previousLeader);
 assert.match(state.choiceTitle,/Charmander level 3/);
});

test('evolution requires the Pokémon own level even when the squad level is high',()=>{
 const state=new Simulation(1,11).state;state.stats.level=99;state.stats.elapsed=300;
 assert.deepEqual(eligibleEvolutions(state),[]);
 state.party[0].level=PROGRESSION.evolution.firstLevel;
 assert.deepEqual(eligibleEvolutions(state),[1]);
});

test('HP training scales base health in percentages and recruits inherit the same bonus',()=>{
 const state=new Simulation(1,22).state,member=state.party[0];
 state.player.hp=state.player.maxHp*.35;member.hp=member.maxHp*.6;
 const baseLeader=state.player.maxHp,baseMember=member.maxHp,health=TRAINING_UPGRADES.find(upgrade=>upgrade.id==='health')!;
 for(let rank=1;rank<=2;rank++)assert.equal(applyChoice(state,{...health,kind:'stat',rank}).applied,true);
 close(state.player.maxHp,baseLeader*1.2);close(member.maxHp,baseMember*1.2);
 close(state.player.hp/state.player.maxHp,.35);close(member.hp/member.maxHp,.6);
 state.stats.level=4;state.stats.elapsed=165;
 const recruit=makeChoices(state,new RNG(4))[0];assert.equal(recruit.kind,'recruit');
 assert.equal(applyChoice(state,recruit).applied,true);
 const follower=state.party[1];close(follower.maxHp,155*1.2);
 assert.equal(follower.level,1);assert.equal(follower.xp,0);assert.equal(follower.xpToNext,xpThreshold(1));
});

test('learned move upgrades apply the percentage gains printed on their cards',()=>{
 const state=new Simulation(4,31).state,member=state.party[0];state.recruitCount=5;member.level=30;
 for(const move of learnableMoves(member.speciesId).slice(0,3))assert.equal(applyChoice(state,learnCard(member,move.id)).applied,true);
 const moveId=member.learnedMoves![0].moveId;
 const card=allOffers(state).find(choice=>choice.kind==='attack'&&choice.moveId===moveId)!;
 assert.ok(card);assert.match(card.description,/\+17\.0% damage/);assert.match(card.description,/6\.5% shorter cooldown/);assert.match(card.description,/\+2\.2% reach/);
 const from=getLearnedMoveProfile(moveId,1),basePower=learnedMovePower(moveId,1);
 assert.equal(applyChoice(state,card).applied,true);
 const to=getLearnedMoveProfile(moveId,2);
 close(learnedMovePower(moveId,2)/basePower,1.17);close(to.cooldown/from.cooldown,1/1.07);close(to.range/from.range,16.35/16);
 assert.equal(applyChoice(state,card).applied,false,'A stale rank cannot be purchased twice');
 assert.ok(learnedMovePower(moveId,999)>learnedMovePower(moveId,12));
});

test('training keeps improving the build beyond old stat and move limits',()=>{
 const state=new Simulation(4,41).state,member=state.party[0];state.recruitCount=5;member.attackLevel=80;
 member.trainingBuffs={};
 for(const upgrade of TRAINING_UPGRADES)member.trainingBuffs[upgrade.stat]=upgrade.amount*30;
 const choices=makeChoices(state,new RNG(1));assert.equal(choices.length,3);
 assert.ok(choices.some(choice=>choice.kind==='attack'&&choice.rank===81));
 const before=getBuildModifiers(state);
 const defense=TRAINING_UPGRADES.find(upgrade=>upgrade.id==='haste')!;
 assert.equal(applyChoice(state,{...defense,amount:.07,kind:'stat',speciesId:member.uid,rank:31}).applied,true);
 assert.ok(getBuildModifiers(state).haste>before.haste);
 assert.ok(allOffers(state).some(choice=>choice.stat==='haste'));
 const cache=makeChoices(state,new RNG(1),'cache');assert.ok(cache.every(choice=>choice.kind==='item'));
});

test('cache relics match current attack mechanics, including learned moves and leader specials',()=>{
 const state=new Simulation(66,63).state,member=state.party[0];state.recruitCount=5;
 state.itemUnlocks=['storm-coil','multi-lens','piercing-fang'];
 assert.ok(cacheOffers(state).every(choice=>choice.kind!=='item'),'Machop has no chain, projectile, or projectile special to improve');
 member.level=10;assert.equal(applyChoice(state,learnCard(member,'rock-slide')).applied,true);
 const withProjectiles=new Set(cacheOffers(state).map(choice=>choice.id));
 assert.ok(withProjectiles.has('multi-lens'));assert.ok(withProjectiles.has('piercing-fang'));assert.ok(!withProjectiles.has('storm-coil'));
 // A retained learned attack can differ from its owner's current element.
 member.learnedMoves!.push({moveId:'shock-wave',rank:1,cooldown:0});
 assert.ok(cacheOffers(state).some(choice=>choice.id==='storm-coil'));
 const charmander=new Simulation(4,64).state;charmander.itemUnlocks=['storm-coil'];
 assert.ok(cacheOffers(charmander).every(choice=>choice.id!=='storm-coil'));
 charmander.party.push({...structuredClone(charmander.party[0]),uid:42,speciesId:25});
 assert.ok(cacheOffers(charmander).some(choice=>choice.id==='storm-coil'));
 charmander.party[1].hp=0;assert.ok(cacheOffers(charmander).every(choice=>choice.id!=='storm-coil'),'Fainted chain attackers do not make a relic useful');
 const volley=new Simulation(21,65).state;volley.itemUnlocks=['multi-lens'];
 assert.ok(cacheOffers(volley).some(choice=>choice.id==='multi-lens'),'A leader projectile volley can use Loaded Dice');
});

test('cache stat relics disappear at caps while inactive conditional bonuses remain eligible',()=>{
 const state=new Simulation(66,67).state;state.itemUnlocks=['magnet-stone','focus-sash'];state.recruitCount=5;
 assert.ok(cacheOffers(state).some(choice=>choice.id==='magnet-stone'));
 state.buffs.magnet=10;
 const choices=cacheOffers(state);
 assert.ok(choices.some(choice=>choice.id==='magnet-stone'));
 assert.ok(choices.some(choice=>choice.id==='focus-sash'),'Full current HP does not invalidate a low-HP defensive relic');
});
