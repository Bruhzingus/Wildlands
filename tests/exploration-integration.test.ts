import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,type GameEvent} from '../src/game/Simulation.ts';
import {createPOIs,rareEventFor,type ExplorationEvent} from '../src/game/systems/environment.ts';
import {getEnemySpeciesProfile} from '../src/data/enemySpecies.ts';
import {maximumEncounterThreat} from '../src/data/encounters.ts';
import {variantThreat} from '../src/data/variants.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
function eventFixture(kind:ExplorationEvent['kind']){
 for(let seed=1;seed<2000;seed++)for(const poi of createPOIs(seed))if(rareEventFor(seed,poi)?.kind===kind){
  const sim=new Simulation(7,seed),s=sim.state,site=s.pois.find(p=>p.uid===poi.uid)!;
  s.enemies=[];s.player.x=site.x;s.player.z=site.z;s.player.hp=20;s.player.specialCooldown=9;s.player.iframes=100;
  s.party.push({...s.party[0],uid:s.idCounter++,hp:20,x:site.x+1,z:site.z});
  const events:GameEvent[]=[];sim.onEvent=event=>events.push(event);return {sim,s,site,events};
 }
 throw Error(`No rare event found for ${kind}`);
}

test('rare spring and shrine rewards apply once through interaction and guardian defeat',()=>{
 for(const kind of ['wild-bloom','ancient-echo'] as const){
  const {sim,s,site,events}=eventFixture(kind);sim.update(.02,{...idle,interact:true});
  assert.equal(site.used,true);assert.equal(events.filter(e=>e.label===rareEventFor(s.seed,site)!.label).length,kind==='wild-bloom'?1:0);
  if(kind==='wild-bloom'){assert.equal(s.player.hp,87);assert.ok(s.party[1].hp>=80&&s.party[1].hp<80.1);}
  else {
   assert.equal(s.buffs.luck||0,0,'Shrines grant no blessing before victory');assert.ok(s.player.specialCooldown>0);
   const guardian=s.enemies.find(enemy=>enemy.shrineGuardian);assert.ok(guardian,'The shrine blessing is guarded');
   (sim as any).damageEnemy(guardian,guardian.maxHp*2,'normal',s.party[0].uid);
   assert.ok(Math.abs(s.buffs.luck-.07)<1e-9,'Defeating the guardian grants the separate shrine blessing');
   // Settle the miniboss XP levels before checking that another interaction
   // cannot grant the blessing or healing again. Loot has separate coverage.
   s.drops=[];sim.update(.02,idle);
   while(s.phase==='choice')sim.choose(s.upgradeChoices[0].id);
  }
  const hp=s.player.hp,luck=s.buffs.luck;sim.update(.02,idle);sim.update(.02,{...idle,interact:true});
  assert.equal(s.player.hp,hp);assert.equal(s.buffs.luck,luck);assert.equal(events.filter(e=>e.label===rareEventFor(s.seed,site)!.label).length,1);
 }
});

test('rare cache ambush respects distant spawns and the complete paused item selection',()=>{
 for(const elapsed of [0,120]){
  const {sim,s,site,events}=eventFixture('cache-ambush');s.stats.elapsed=elapsed;sim.update(.02,{...idle,interact:true});
  assert.equal(site.used,true);assert.equal(s.phase,'choice');assert.equal(s.upgradeChoices.length,3);assert.ok(s.upgradeChoices.every(choice=>choice.kind==='item'));
  assert.equal(s.enemies.length,2);
  assert.ok(s.enemies.every(enemy=>enemy.variant===(elapsed===0?'normal':'rocket')&&Math.hypot(enemy.x-s.player.x,enemy.z-s.player.z)>=24));
  assert.ok(s.enemies.every(enemy=>getEnemySpeciesProfile(enemy.speciesId).strength+variantThreat(enemy.variant)<=maximumEncounterThreat(s.stats.elapsed)),
   'Cache ambushes respect the threat window, using weak wild Pokemon before Rocket variants unlock');
  const frozen=structuredClone(s);for(let i=0;i<15;i++)sim.update(.04,{...idle,interact:true});assert.deepEqual(s,frozen);
  sim.choose(s.upgradeChoices[0].id);assert.equal(s.items.length,1);assert.equal(s.phase,'playing');
  assert.equal(events.filter(e=>e.label===rareEventFor(s.seed,site)!.label).length,1);
 }
});
