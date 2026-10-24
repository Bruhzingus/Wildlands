/** Reproducible local balance audit. Uses production combat geometry, with no game edits. */
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
import {availableItemChoices} from '../src/game/systems/progression.ts';

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
 const a=arena(speciesId,rank,level,positions,options),profile=getSpecialProfile(speciesId,rank),element=profile.element??a.species.types[0];
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

const sourcePaths=['src/data/kanto.ts','src/data/attacks.ts','src/data/rosterContent.ts','src/data/specials.ts','src/data/movementTraits.ts','src/data/progression.ts','src/data/config.ts','src/data/items.ts','src/data/enemySpecies.ts','src/data/moves.ts','src/data/learnsets.ts','src/data/evolutions.ts','src/data/synergies.ts','src/game/Simulation.ts','src/game/combat/patterns.ts','src/game/combat/projectiles.ts','src/game/combat/specials.ts','src/game/combat/damage.ts','src/game/combat/cadence.ts','src/game/combat/targeting.ts','src/game/systems/builds.ts','src/game/systems/progression.ts','src/game/systems/movement.ts'];
const fingerprints=Object.fromEntries(await Promise.all(sourcePaths.map(async path=>[path,createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex')])));
const starters=starterChoices().map(id=>snapshot(id,1,1));
const trained=starterChoices().flatMap(id=>[3,6,8].map(rank=>snapshot(id,rank,1)));
const evolved=starterChoices().flatMap(id=>terminalIds(id).map(target=>snapshot(target,8,30,(getSpecies(target).stage-1)*.25)));
const probes={
 foxfire: [1,3,5,6,7,8].flatMap(rank=>[.6,.8,.85,1,1.4,4.4].map(size=>({rank,size,...primary(37,rank,1,[{x:8,z:0,size}])}))),
 foxfireRadius:[0,.126,.2,.378,.5].map(radiusBonus=>({radiusBonus,...primary(37,1,1,fixtures.distant,{radiusBonus})})),
 foxfireSteps:[.01,1/60,.025,.04].map(step=>({step,...primary(37,6,1,fixtures.distant,{step})})),
 gastlyDistances:[1,2,3,4,5,6,7,8].map(distance=>({distance,...primary(92,1,1,[{x:distance,z:0,size:.8}])})),
 gastlyRank2Distances:[1,2,3,4,5,6,7,8].map(distance=>({distance,...primary(92,2,1,[{x:distance,z:0,size:.8}])})),
 magikarpFlail:[1,.5,.1,.01].map(hpFraction=>({hpFraction,...special(129,1,1,fixtures.close,{hpFraction})})),
 zubatComboRange:[3,5,6,6.5].map(distance=>({distance,...primary(41,1,1,[{x:distance,z:0,size:.8}])})),
 machopComboRange:[5,5.7,6,6.5].map(distance=>({distance,...primary(66,1,1,[{x:distance,z:0,size:.8}])})),
 growlitheFollowup:[1,6].flatMap(rank=>[3,10,11.2,12].map(distance=>({rank,distance,...primary(58,rank,1,[{x:distance,z:0,size:.8}])}))),
 bulbasaurTargets:[1,2,3,6].map(rank=>({rank,...primary(1,rank,1,Array.from({length:12},(_,i)=>({x:2+i,z:0,size:.8})))})),
 extraProjectileEfficiency:starterChoices().map(id=>({id,name:getSpecies(id).name,baseline:primary(id),plusOne:primary(id,1,1,fixtures.close,{extraProjectiles:1})})),
 ineffectiveRelics:[7,129].map(id=>({id,name:getSpecies(id).name,
  offered:availableItemChoices(new Simulation(id,4701).state).filter(choice=>['multi-lens','piercing-fang'].includes(choice.id)).map(choice=>choice.id),
  baseline:primary(id,1,1,fixtures.lane),
  plusPierce:primary(id,1,1,fixtures.lane,{extraPierce:2}),
  plusProjectile:primary(id,1,1,fixtures.lane,{extraProjectiles:1})})),
 eeveeEvolution:[133,134,135,136].map(id=>({id,name:getSpecies(id).name,rank:id===133?8:9,
  close:primary(id,id===133?8:9,35,fixtures.close,{evolutionPower:id===133?0:.25}),
  distant:primary(id,id===133?8:9,35,fixtures.distant,{evolutionPower:id===133?0:.25}),
  boss:primary(id,id===133?8:9,35,fixtures.boss,{evolutionPower:id===133?0:.25})})),
 bossMatchups:starters.map(s=>({name:s.name,primary:s.element,q:s.qElement,mewtwoPrimary:typeMultiplier(s.element,getSpecies(150).types),mewtwoQ:typeMultiplier(s.qElement,getSpecies(150).types),moltresPrimary:typeMultiplier(s.element,getSpecies(146).types),moltresQ:typeMultiplier(s.qElement,getSpecies(146).types)})),
};
// Check important numerical contracts independently of presentation or the generated tables.
assert.equal(starters.length,17);
assert.equal(starters.find(s=>s.id===1).primary.close.damage,26.25);
assert.equal(starters.find(s=>s.id===66).primary.close.damage,33);
assert.equal(starters.find(s=>s.id===129).primary.close.damage,8.125);
assert.equal(starters.find(s=>s.id===25).special.boss.damage,33.6);
assert.equal(starters.find(s=>s.id===25).special.lane.targets,6);
assert.equal(starters.find(s=>s.id===43).special.close.healPerMember,10.5);
assert.equal(probes.foxfire.find(p=>p.rank===1&&p.size===.8).hits,2);
assert.equal(probes.foxfire.find(p=>p.rank===6&&p.size===.8).hits,0);
assert.ok(probes.foxfireSteps.every(probe=>probe.hits===0));
for(const probe of probes.ineffectiveRelics){
 assert.ok(probe.offered.includes('piercing-fang'));
 assert.equal(probe.baseline.damage,probe.plusPierce.damage);
 if(probe.id===129){assert.ok(probe.offered.includes('multi-lens'));assert.equal(probe.baseline.damage,probe.plusProjectile.damage);}
}
// Cross-check the isolated harness against Simulation's complete primary damage
// path. Dragon dummies are neutral to every starter attack in this arcade chart.
let simulationCrossChecks=0;
for(const row of [...starters,...trained.filter(s=>s.rank===6),...evolved]){
 const sim=new Simulation(row.id,4701),state=sim.state,member=state.party[0];
 member.level=row.level;member.attackLevel=row.rank;member.evolutionPower=(getSpecies(row.id).stage-1)*.25;
 sim.rng.next=()=>.999999; // Disable the independent crit roll; guaranteed statuses still apply.
 state.enemies=fixtures.close.map((position,index)=>({uid:1000+index,speciesId:147,hp:1e9,maxHp:1e9,dead:false,poisonTime:0,burnTime:0,slowTime:0,soakedTime:0,stunTime:0,...position}));
 const profile=getAttackProfile(row.id,row.rank),target=nearestEnemy(state.enemies,member,profile.range);
 if(target)sim.fireFromMember(member,target);
 for(let frame=0;state.projectiles.length&&frame<2000;frame++)sim.updateProjectiles(.01);
 assert.ok(Math.abs(state.stats.damageDealt-row.primary.close.damage)<.001,`${row.name} agrees with Simulation`);
 simulationCrossChecks++;
}
const report={schemaVersion:1,methodology:{fixtures,seed:4701,step:.01,crit:false,dots:false,matchups:false,items:false,synergies:false,
 immortality:true,enemyMovement:false,obstacles:false,simulationCrossChecks,description:'One cast through production patterns/projectiles/specials, divided by exact attack interval. Q reports total per cast and total/16. Knockback applies. L30/rank8 evolved comparisons include +25% additive power per evolution, no other upgrades. Not a human win-rate experiment.'},fingerprints,starters,trained,evolved,probes};
await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/starter-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const f=value=>typeof value==='number'?Number(value.toFixed(2)).toString():value;
const table=(headers,rows)=>[headers,headers.map(()=> '---'),...rows].map(row=>'| '+row.map(f).join(' | ')+' |').join('\n');
const appendix=[
 '# Starter audit: generated measurements',
 '',
 'Generated by `node --experimental-strip-types scripts/starter-audit.mjs`. Interpretation and limitations: [starter balance audit](STARTER_BALANCE_AUDIT.md). Raw fixtures, per-cast hits, profiles, learnsets, probes and source SHA-256 fingerprints: `artifacts/starter-audit.json` (local, ignored).',
 '',
 'All damage here excludes critical hits, damage over time, type matchups, items and synergies. These are controlled geometry comparisons, not full-run DPS. Small enemies use size 0.8; the boss uses the production spawned-boss size 4.4. Q assumes an unobstructed path. The close target is at 3m, the distant target at 8m, and the 12-enemy forward fixture is four rows at x=3/5.5/8/10.5m, with z=-1/0/1m.',
 '',
 '## Starting stats and primary attacks (level 1, rank 1)',
 '',
 table(['Starter','HP','Power','Defense','Hit damage','Interval (s)','Reach (m)','DPS at 3m','DPS at 8m','12-enemy forward DPS'],starters.map(s=>[s.name,s.leaderBaseHp,s.power,s.defense,s.damagePerHit,s.cooldown,s.range,s.primary.close.dps,s.primary.distant.dps,s.primary.lane.dps])),
 '',
 'Hit damage is one hit before combo, chain falloff or projectile multiplication. HP is actual leader HP; the separate party-member bookkeeping HP is not a second life bar.',
 '',
 '## Starting Q (total damage per cast; 16-second base cooldown)',
 '',
 table(['Starter','Q','Element','Small target at 3m','Boss at 8m','12-enemy forward total','Healing per living member'],starters.map(s=>[s.name,s.q.name,s.qElement,s.special.close.damage,s.special.boss.damage,s.special.lane.damage,s.special.close.healPerMember])),
 '',
 'Zero Q damage at 8m can mean a close-range ability cannot reach the fixture. Foxfire guards a ring around the caster. Magikarp is at full HP. Divide total Q damage by 16 for its ideal cooldown-averaged contribution; keep target count and geometry fixed.',
 '',
 '## Rank growth with species and personal level held fixed',
 '',
 table(['Starter','R1 at 3m','R3 at 3m','R6 at 3m','R8 at 3m','R8 at 8m','R8 boss at 8m'],starters.map(s=>{const at=rank=>trained.find(t=>t.id===s.id&&t.rank===rank);return [s.name,s.primary.close.dps,at(3).primary.close.dps,at(6).primary.close.dps,at(8).primary.close.dps,at(8).primary.distant.dps,at(8).primary.boss.dps];})),
 '',
 'Ranks above 1 at personal level 1 are laboratory normalization, not a claimed progression route. The Vulpix zeros are the reproduced small-target orbit failure. Gastly at 3m falls inside its 4m orbit after rank 2.',
 '',
 '## Fully evolved comparison (personal level 30, rank 8)',
 '',
 'Includes additive +25% power per evolution and the species health ratio; no other upgrades or learned attacks. Reaching this rank and final form uses seven milestone choices for both two- and three-stage families if every choice goes to the signature or evolution and maturity gates are satisfied. This controls choice count, not elapsed time or guaranteed survival.',
 '',
 table(['Final form','HP','Power','Defense','DPS at 3m','DPS at 8m','Boss DPS at 8m','12-enemy forward DPS','Q vs boss at 8m'],evolved.map(s=>[s.name,s.leaderHpAtLevel,s.power,s.defense,s.primary.close.dps,s.primary.distant.dps,s.primary.boss.dps,s.primary.lane.dps,s.special.boss.damage])),
 '',
 '## Current starter attack matchups against map bosses',
 '',
 table(['Starter','Primary element','Q element','Mewtwo primary','Mewtwo Q','Moltres primary','Moltres Q'],probes.bossMatchups.map(s=>[s.name,s.primary,s.q,s.mewtwoPrimary,s.mewtwoQ,s.moltresPrimary,s.moltresQ])),
 '',
 'These are the first-form elements. Golbat changes its primary from Normal to Poison; Arcanine changes its primary from Normal to Fire; Eevee branches adopt their evolved types. Defensive typing does not reduce incoming player damage.',
 '',
 '## Eevee evolution tradeoff (level 35; rank 8 before / rank 9 after evolution)',
 '',
 table(['Form','Rank','DPS at 3m','DPS at 8m','Boss DPS at 8m'],probes.eeveeEvolution.map(s=>[s.name,s.rank,s.close.dps,s.distant.dps,s.boss.dps])),
 '',
 `The audit also passed ${simulationCrossChecks} comparisons against Simulation's complete primary-damage path and verified effect expiry in every fixture. Full source fingerprints are retained in the JSON so a rerun can distinguish tuning changes.`,
 '',
];
await writeFile(new URL('../docs/STARTER_AUDIT_DATA.md',import.meta.url),appendix.join('\n'));
console.table(starters.map(s=>({name:s.name,hp:s.leaderBaseHp,power:s.power,def:s.defense,range:s.range,hit:s.damagePerHit,closeDPS:round(s.primary.close.dps),at8m:s.primary.distant.dps,boss8m:s.primary.boss.dps,lane12:s.primary.lane.dps,ring12:s.primary.ring.dps,qClose:s.special.close.damage,qBoss:s.special.boss.damage,qLane:s.special.lane.damage})));
console.log(`Audit checks and ${simulationCrossChecks} Simulation comparisons passed; detailed data: artifacts/starter-audit.json and docs/STARTER_AUDIT_DATA.md`);
