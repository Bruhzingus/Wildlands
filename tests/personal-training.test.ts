import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {TRAINING_UPGRADES} from '../src/data/progression.ts';
import {getBuildModifiers} from '../src/game/systems/builds.ts';
import {applyChoice,availableItemChoices,makeChoices,rerollChoices} from '../src/game/systems/progression.ts';
import {upgradeStatPreview} from '../src/ui/upgradePreview.ts';
import {RNG} from '../src/utils/random.ts';

const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function squad(){
 const sim=new Simulation(4,721),s=sim.state;
 s.recruitCount=5;
 s.party.push({...structuredClone(s.party[0]),uid:42,speciesId:7});
 return {sim,s,leader:s.party[0],follower:s.party[1]};
}
function training(s:Simulation['state'],id:string){
 const owner=s.party.find(member=>member.uid===s.levelUpMemberId)!;
 const definition=TRAINING_UPGRADES.find(upgrade=>upgrade.id===id)!;
 return {...definition,id:definition.rarity==='common'?id:`${id}-${definition.rarity}`,kind:'stat' as const,speciesId:owner.uid,rank:(owner.trainingRanks?.[id]??0)+1};
}

test('every level-up stat and its rank belongs only to the Pokémon earning it',()=>{
 for(const definition of TRAINING_UPGRADES){
  const {s,leader,follower}=squad();s.levelUpMemberId=leader.uid;
  makeChoices(s,new RNG(3));
  const other=structuredClone(follower),shared=structuredClone(s.buffs);
  assert.equal(applyChoice(s,training(s,definition.id)).applied,true);
  close(leader.trainingBuffs![definition.stat],definition.amount);
  assert.equal(leader.trainingRanks![definition.id],1);
  assert.deepEqual(follower,other);assert.deepEqual(s.buffs,shared);
  s.levelUpMemberId=follower.uid;
  assert.equal(applyChoice(s,training(s,'power')).applied,true);
  assert.equal(follower.trainingRanks!.power,1);
 }
});

test('follower HP and damage previews are personal and never mutate the run',()=>{
 const {s,leader,follower}=squad();s.levelUpMemberId=follower.uid;makeChoices(s,new RNG(3));
 follower.hp=follower.maxHp*.4;
 const player=structuredClone(s.player),other=structuredClone(leader),hp=follower.maxHp;
 for(const id of ['power','health']){
  const choice=training(s,id),snapshot=structuredClone(s),preview=upgradeStatPreview(s,choice);
  assert.deepEqual(s,snapshot);assert.ok(preview.length);
  assert.equal(applyChoice(s,choice).applied,true);
 }
 close(follower.maxHp,hp*1.1);close(follower.hp/follower.maxHp,.4);
 close(getBuildModifiers(s,follower).power,.08);close(getBuildModifiers(s,leader).power,0);
 assert.deepEqual(s.player,player);assert.deepEqual(leader,other);
});

test('cards and rerolls retain their milestone owner and reject stale owners',()=>{
 const {sim,s,leader,follower}=squad();s.levelUpMemberId=follower.uid;
 sim.enterChoice(makeChoices(s,new RNG(9)),undefined,'level');
 const old=s.upgradeChoices.find(choice=>choice.kind==='stat')!;
 for(const choice of [...s.upgradeChoices,...(rerollChoices(s,new RNG(8))??[])])if(choice.kind==='stat'){
  assert.equal(choice.speciesId,follower.uid);
  assert.ok(!['speed','staminaCapacity'].includes(choice.stat!));
 }
 s.levelUpMemberId=leader.uid;assert.equal(applyChoice(s,old).applied,false);
 s.levelUpMemberId=follower.uid;follower.hp=0;assert.equal(applyChoice(s,old).applied,false);
});

test('queued shrine training stays squad-wide alongside personal bonuses and relics',()=>{
 const {sim,s,leader,follower}=squad();s.levelUpMemberId=follower.uid;makeChoices(s,new RNG(3));
 assert.equal(applyChoice(s,training(s,'power')).applied,true);
 delete s.levelUpMemberId;
 s.pendingSquadRewards=1;(sim as any).openNextLevelUp();
 assert.equal(s.choiceSource,'squad');
 assert.ok(s.upgradeChoices.every(choice=>choice.speciesId===undefined));
 const power=TRAINING_UPGRADES.find(upgrade=>upgrade.id==='power')!;
 assert.equal(applyChoice(s,{...power,kind:'stat',rank:1}).applied,true);
 close(getBuildModifiers(s,leader).power,.08);close(getBuildModifiers(s,follower).power,.16);
 const item=availableItemChoices(s).find(choice=>choice.id==='life-orb')!;
 assert.equal(applyChoice(s,item).applied,true);
 close(getBuildModifiers(s,leader).power,.4);close(getBuildModifiers(s,follower).power,.48);
});

test('personal HP training is not inherited by recruits',()=>{
 const {s,leader}=squad();s.recruitCount=0;s.levelUpMemberId=leader.uid;
 makeChoices(s,new RNG(3));assert.equal(applyChoice(s,training(s,'health')).applied,true);
 delete s.levelUpMemberId;s.stats.elapsed=165;s.stats.level=4;
 const recruit=makeChoices(s,new RNG(4),'recruit')[0];
 assert.equal(applyChoice(s,recruit).applied,true);
 const member=s.party.at(-1)!;
 assert.equal(member.trainingBuffs,undefined);
 assert.equal(s.buffs.health??0,0);
});

test('companions can train their special recharge and damage with personal previews',()=>{
 const {s,leader,follower}=squad();s.levelUpMemberId=follower.uid;makeChoices(s,new RNG(3));
 const original=structuredClone(leader);
 for(const id of ['special','wise-glasses']){
  const choice=training(s,id),preview=upgradeStatPreview(s,choice);
  assert.ok(preview.length);
  if(id==='special')assert.ok(preview.some(row=>row.label==='Special cooldown'&&row.before!==row.after));
  if(id==='wise-glasses')assert.ok(preview.some(row=>row.label==='Special damage bonus'));
  assert.equal(applyChoice(s,choice).applied,true);
 }
 close(getBuildModifiers(s,follower).specialHaste,.25);close(getBuildModifiers(s,follower).specialPower,.1);
 assert.deepEqual(leader,original);
 follower.speciesId=113;
 assert.equal(applyChoice(s,training(s,'wise-glasses')).applied,false,'Support specials cannot use special damage training');
});
