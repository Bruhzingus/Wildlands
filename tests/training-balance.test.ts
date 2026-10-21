import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {TRAINING_UPGRADES,trainingVariants,trainingDescription} from '../src/data/progression.ts';
import {applyChoice,makeChoices} from '../src/game/systems/progression.ts';
import {getBuildModifiers} from '../src/game/systems/builds.ts';
import {upgradeStatPreview} from '../src/ui/upgradePreview.ts';
import {DESIGN} from '../src/data/config.ts';
import {RNG} from '../src/utils/random.ts';

const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
const definition=(id:string)=>TRAINING_UPGRADES.find(upgrade=>upgrade.id===id)!;
function card(id:string,rarity:'common'|'rare'|'epic'|'legendary',rank=1){
 const upgrade=definition(id),variant=trainingVariants(upgrade).find(variant=>variant.rarity===rarity)!;
 return {...upgrade,...variant,id:rarity==='common'?id:`${id}-${rarity}`,kind:'stat' as const,rank};
}

test('training applies exact authored rarity curves rather than linear rarity multipliers',()=>{
 for(const [id,values] of [
  ['power',[.08,.15,.25,.4]],['haste',[.08,.15,.25,.4]],['speed',[.08,.12,.2,.35]],
  ['health',[.1,.2,.3,.5]],['deflection',[.03,.05,.09,.15]],
 ] as const){
  const upgrade=definition(id);assert.deepEqual(trainingVariants(upgrade).map(variant=>variant.amount),values);
  for(const [index,rarity] of (['common','rare','epic','legendary'] as const).entries()){
   const s=new Simulation(4,211).state,choice=card(id,rarity);
   assert.equal(applyChoice(s,choice).applied,true);close(s.buffs[upgrade.stat],values[index]);
   assert.ok(trainingDescription(upgrade,rarity).includes(`${values[index]*100}%`));
  }
 }
});

test('Agility reduces actual stamina recharge time multiplicatively and previews both benefits',()=>{
 const sim=new Simulation(4,212),s=sim.state;s.enemies=[];s.pois=[];
 const first=card('speed','common'),preview=upgradeStatPreview(s,first);
 assert.ok(preview.some(row=>row.label==='Movement bonus'&&row.after==='8%'));
 assert.ok(preview.some(row=>row.label==='Stamina recharge time reduction'&&row.after==='5%'));
 assert.ok(preview.some(row=>row.label==='Dodge cooldown'));
 assert.equal(applyChoice(s,first).applied,true);
 assert.equal(applyChoice(s,card('speed','legendary',2)).applied,true);
 close(getBuildModifiers(s).staminaRechargeReduction,1-.95*.8);
 sim.update(.01,{...idle,dodge:true});close(s.player.dodgeCooldown,DESIGN.dodgeCooldown*.95*.8);
 assert.equal(s.player.dodgeCharges,0);
 for(let i=0;i<60;i++)sim.update(.04,idle);
 assert.equal(s.player.dodgeCharges,1);
});

test('Endure only offers Epic and Legendary capacity and rejects retired recovery cards',()=>{
 assert.deepEqual(trainingVariants(definition('stamina')).map(variant=>[variant.rarity,variant.amount]),[['epic',1],['legendary',3]]);
 const s=new Simulation(4,213).state;
 for(const rarity of ['common','uncommon','rare'] as const)assert.equal(applyChoice(s,{id:rarity==='common'?'stamina':`stamina-${rarity}`,kind:'stat',stat:'stamina',amount:.22,title:'Endure',description:'',rarity}).applied,false);
 assert.equal(applyChoice(s,card('stamina','epic')).applied,true);close(getBuildModifiers(s).staminaCapacity,1);
 assert.equal(applyChoice(s,card('stamina','legendary',2)).applied,true);close(getBuildModifiers(s).staminaCapacity,4);
 close(getBuildModifiers(s).stamina,0);
 for(let seed=1;seed<100;seed++)for(const choice of makeChoices(s,new RNG(seed),'squad'))if(choice.title==='Endure')assert.ok(choice.rarity==='epic'||choice.rarity==='legendary');
});

test('high rarity deflection caps its actual chance and disappears from rewards',()=>{
 const s=new Simulation(4,214).state;
 for(let rank=1;rank<=4;rank++)assert.equal(applyChoice(s,card('deflection','legendary',rank)).applied,true);
 close(getBuildModifiers(s).deflection,.5);
 assert.equal(applyChoice(s,card('deflection','common',5)).applied,false);
});
