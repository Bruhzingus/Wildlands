/** Option A candidate probe. Mutates attack/species data only in this process; never writes src files. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {Simulation} from '../src/game/Simulation.ts';
import {getSpecies,starterChoices} from '../src/data/kanto.ts';
import {getAttackProfile} from '../src/data/attacks.ts';
import {getSpecialProfile} from '../src/data/specials.ts';
import {getMovementTrait} from '../src/data/movementTraits.ts';
import {learnableMoves} from '../src/data/moves.ts';
import {evolutionRule} from '../src/data/evolutions.ts';
import {typeMultiplier} from '../src/data/config.ts';
import {memberDamage} from '../src/game/combat/damage.ts';
import {attackInterval} from '../src/game/combat/cadence.ts';
import {executePattern} from '../src/game/combat/patterns.ts';
import {addProjectile,stepProjectiles} from '../src/game/combat/projectiles.ts';
import {nearestEnemy} from '../src/game/combat/targeting.ts';
import {castSpecial,stepSpecials} from '../src/game/combat/specials.ts';


const round=value=>Math.round(value*10000)/10000;
const fixtures={
 close:[{x:3,z:0,size:.8}],
 distant:[{x:8,z:0,size:.8}],
 boss:[{x:8,z:0,size:4.4,isBoss:true}],
 lane:[3,5.5,8,10.5].flatMap(x=>[-1,0,1].map(z=>({x,z,size:.8}))),
 ring:Array.from({length:12},(_,index)=>({x:3*Math.cos(index/12*Math.PI*2),z:3*Math.sin(index/12*Math.PI*2),size:.8})),
};
const template=new Simulation(1,4701).state;

function arena(speciesId,rank=1,level=1,positions=fixtures.close,options={}){
 const species=getSpecies(speciesId),member={...template.party[0],speciesId,attackLevel:rank,level,x:0,z:0,learnedMoves:[]};
 const state={...template,party:[member],player:{...template.player,x:0,z:0,hp:100,maxHp:100,aimFacing:Math.PI/2},enemies:positions.map((position,index)=>({
  uid:1000+index,speciesId:19,hp:1e9,maxHp:1e9,dead:false,poisonTime:0,burnTime:0,slowTime:0,soakedTime:0,stunTime:0,...position,
 })),projectiles:[],activeSpecials:[],idCounter:2000};
 if(options.hpFraction!==undefined)state.player.hp=state.player.maxHp*options.hpFraction;
 const hits=[],heals=[],evolutionPower=options.evolutionPower??0;
 const hit=(enemy,damage)=>{assert.ok(Number.isFinite(damage)&&damage>=0);hits.push({uid:enemy.uid,damage});};
 return {species,member,state,hits,heals,hit,evolutionPower};
}

/** One complete cast divided by its exact interval: no startup/last-projectile bias. */
function primary(speciesId,rank=1,level=1,positions=fixtures.close,options={}){
 const a=arena(speciesId,rank,level,positions,options),profile=getAttackProfile(speciesId,rank),radiusScale=1+(options.radiusBonus??0);
 const target=nearestEnemy(a.state.enemies,a.member,profile.range*radiusScale);
 let shots=0;
 if(target)executePattern({member:a.member,target,enemies:a.state.enemies,profile,element:profile.element??a.species.types[0],
  damage:memberDamage(a.member,profile.growth.damage,a.evolutionPower),crit:false,depth:0,radiusScale,
  extraProjectiles:options.extraProjectiles??0,extraPierce:options.extraPierce??0,extraChains:0,projectileSpeedScale:1,
  hit:a.hit,projectile:shot=>{shots++;assert.ok(addProjectile(a.state,shot));},visual:()=>{},heal:()=>assert.fail('Unexpected heal'),
 });
 for(let frame=0;a.state.projectiles.length&&frame<2000;frame++)stepProjectiles(a.state,options.step??.01,{hit:(enemy,shot)=>a.hit(enemy,shot.damage),hurtPlayer:()=>assert.fail('Friendly fire')});
 assert.equal(a.state.projectiles.length,0,'All primary projectiles expire');
 const damage=a.hits.reduce((sum,hit)=>sum+hit.damage,0),interval=attackInterval(profile.cooldown,0,rank);
 return {damage:round(damage),dps:round(damage/interval),hits:a.hits.length,targets:new Set(a.hits.map(hit=>hit.uid)).size,shots};
}

function special(speciesId,rank=1,level=1,positions=fixtures.close,options={}){
 const a=arena(speciesId,rank,level,positions,options),profile=optionASpecialProfile(speciesId,rank),element=profile.element??a.species.types[0];
 const hooks={hit:a.hit,visual:()=>{},heal:amount=>a.heals.push(amount)};
 castSpecial({state:a.state,member:a.member,profile,element,damage:(32+(rank-1)*2)*(1+.02*(level-1))*(1+a.evolutionPower),
  radiusScale:1,durationScale:1,extraProjectiles:0,
  move:(dx,dz)=>({x:a.state.player.x+dx,z:a.state.player.z+dz}),...hooks});
 for(let frame=0;(a.state.activeSpecials.length||a.state.projectiles.length)&&frame<2000;frame++){
  stepSpecials(a.state,.01,hooks);
  stepProjectiles(a.state,.01,{hit:(enemy,shot)=>a.hit(enemy,shot.damage),hurtPlayer:()=>assert.fail('Friendly fire')});
 }
 assert.equal(a.state.projectiles.length+a.state.activeSpecials.length,0,'All Q effects expire');
 const damage=a.hits.reduce((sum,hit)=>sum+hit.damage,0);
 return {damage:round(damage),amortizedDps:round(damage/profile.cooldown),hits:a.hits.length,targets:new Set(a.hits.map(hit=>hit.uid)).size,healPerMember:round(a.heals.reduce((sum,amount)=>sum+amount,0))};
}

function terminalIds(id){const s=getSpecies(id);return s.evolvesTo.length?s.evolvesTo.flatMap(terminalIds):[id];}
function snapshot(id,rank,level,evolutionPower=0){
 const species=getSpecies(id),attack=getAttackProfile(id,rank),q=getSpecialProfile(id,rank);
 return {id,name:species.name,rank,level,power:species.power,defense:species.defense,healthFactor:species.health,
  leaderBaseHp:round(96*species.health),leaderHpAtLevel:round(96*species.health*(1+.02*(level-1))),
  memberBookkeepingHp:round(132*species.health),element:attack.element??species.types[0],qElement:q.element??species.types[0],
  attackKind:attack.kind,catalogueAttackKind:species.attack,pattern:attack.pattern??attack.kind,
  damagePerHit:round(memberDamage({speciesId:id,level,attackLevel:rank},0,evolutionPower)*attack.damageScale),
  cooldown:round(attackInterval(attack.cooldown,0,rank)),range:round(attack.range),radius:round(attack.radius),
  projectiles:attack.projectiles,pierce:attack.pierce,chains:attack.chains,strikes:attack.strikes??1,status:attack.status,
  q:{name:q.name,kind:q.kind,cooldown:q.cooldown,range:q.range,radius:q.radius,pulses:q.pulses,projectiles:q.projectiles},movement:getMovementTrait(id),
  learnedMoves:learnableMoves(id,level).map(move=>({id:move.id,name:move.name,element:move.element})),
  evolutionRules:species.evolvesTo.map(target=>({target,...evolutionRule(id,target)})),
  primary:Object.fromEntries(Object.entries(fixtures).map(([name,positions])=>[name,primary(id,rank,level,positions,{evolutionPower})])),
  special:Object.fromEntries(Object.entries(fixtures).map(([name,positions])=>[name,special(id,rank,level,positions,{evolutionPower})])),
 };
}

import {SPECIES_ATTACKS} from '../src/data/attacks.ts';
let proposed=false;
function optionASpecialProfile(id,rank){
 const p=getSpecialProfile(id,rank);
 if(!proposed)return p;
 if([25,26,135].includes(id))p.damageScale*=1.4/1.05;
 if([58,59].includes(id))p.damageScale*=.45/.55;
 if(id===129)p.damageScale*=.4/.28;
 if(id===130)p.damageScale*=4/3.2;
 if([16,17,18].includes(id))p.element='flying';
 return p;
}
const ids=starterChoices().flatMap(id=>[id,...terminalIds(id)]);
const baseline=new Map(ids.map(id=>[id,snapshot(id,getSpecies(id).stage===1?1:8,getSpecies(id).stage===1?1:30,(getSpecies(id).stage-1)*.25)]));
const baselineEevee=[133,134,135,136].map(id=>({id,...primary(id,id===133?8:9,35,fixtures.distant,{evolutionPower:id===133?0:.25})}));
const patch=(id,changes)=>{SPECIES_ATTACKS[id]={...SPECIES_ATTACKS[id],...changes}};
for(const id of [1,2,3])patch(id,{range:11.2,damageScale:.95});
for(const id of [9,134])patch(id,{projectiles:1,damageScale:.75,milestones:SPECIES_ATTACKS[7].milestones.map(m=>({...m}))});
for(const id of [10,11,12])patch(id,{cooldown:.95});
for(const id of [16,17,18])patch(id,{element:'flying'});
patch(26,{damageScale:1.15});
for(const id of [27,28])patch(id,{pierce:7});
patch(41,{damageScale:.95});
patch(45,{damageScale:.82});
patch(58,{range:7.2,damageScale:.95});
for(const id of [66,67,68])patch(id,{damageScale:.55});
for(const id of [92,93,94])patch(id,{pattern:undefined,kind:'aura',range:4,radius:4,projectiles:0,damageScale:1.1,cooldown:1.35,growth:{damage:3.4,range:.1,radius:.1,projectilesEvery:0,chainsEvery:0},milestones:[{rank:2,status:{slow:.45}},{rank:5,status:{poison:.6}},{rank:7,damageScale:1.2}]});
Object.assign(getSpecies(129),{power:7,defense:.8,health:.85});
patch(129,{damageScale:.65});
patch(130,{damageScale:2.4,cooldown:1.15});
patch(133,{milestones:SPECIES_ATTACKS[133].milestones.map(m=>m.rank===8?{...m,projectiles:5}:m)});
patch(135,{damageScale:1.4});
patch(136,{spread:.1,damageScale:.5});
proposed=true;
const result=ids.map(id=>{
 const old=baseline.get(id),n=snapshot(id,old.rank,old.level,(getSpecies(id).stage-1)*.25);
 return {id,name:n.name,rank:n.rank,level:n.level,hp:[old.leaderHpAtLevel,n.leaderHpAtLevel],close:[old.primary.close.dps,n.primary.close.dps],distant:[old.primary.distant.dps,n.primary.distant.dps],boss:[old.primary.boss.dps,n.primary.boss.dps],lane:[old.primary.lane.dps,n.primary.lane.dps],qClose:[old.special.close.damage,n.special.close.damage],qBoss:[old.special.boss.damage,n.special.boss.damage]};
});
const afterEevee=[133,134,135,136].map(id=>({id,close:primary(id,id===133?8:9,35,fixtures.close,{evolutionPower:id===133?0:.25}),distant:primary(id,id===133?8:9,35,fixtures.distant,{evolutionPower:id===133?0:.25}),boss:primary(id,id===133?8:9,35,fixtures.boss,{evolutionPower:id===133?0:.25})}));
const branchProgression=[1,2,3,4,5,6,7,8,9,12,20,50].map(rank=>({rank,eevee:primary(133,rank,35,fixtures.distant).dps,branches:[134,135,136].map(id=>({id,dps:primary(id,rank+1,35,fixtures.distant,{evolutionPower:.25}).dps}))}));
const sourcePaths=['src/data/kanto.ts','src/data/attacks.ts','src/data/rosterContent.ts','src/data/specials.ts','src/data/progression.ts','src/game/combat/damage.ts','src/game/combat/cadence.ts','src/game/combat/patterns.ts','src/game/combat/projectiles.ts','src/game/combat/targeting.ts','src/game/combat/specials.ts'];
const fingerprints=Object.fromEntries(await Promise.all(sourcePaths.map(async path=>[path,createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex')])));
const output={fingerprints,branchProgression,label:'Isolated Option A candidate. Shared delivery fixes are NOT implemented in this probe.',rows:result,baselineEevee,afterEevee};
await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/option-a-probe.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
assert.equal(result.length,36);
assert.ok(branchProgression.every(row=>row.branches.every(branch=>branch.dps>row.eevee)));
console.log(JSON.stringify({profiles:result.length,fixturesPerProfile:Object.keys(fixtures).length,branchRanks:branchProgression.length,output:'artifacts/option-a-probe.json',sharedFixesIncluded:false},null,2));



