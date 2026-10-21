import test from 'node:test';
import assert from 'node:assert/strict';
import {createPOIs} from '../src/game/systems/environment.ts';
import {Simulation} from '../src/game/Simulation.ts';
import type {POI} from '../src/game/types.ts';
import {DESIGN} from '../src/data/config.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
function shrine(kind:NonNullable<POI['challengeKind']>){
 const sim=new Simulation(25,828),s=sim.state,site:POI={uid:801,x:0,z:0,kind:'shrine',challengeKind:kind,used:false};
 s.pois=[site];s.enemies=[];s.player.iframes=1e6;s.party[0].cooldown=1e6;(sim as any).spawnAccum=-1e6;
 (sim as any).activatePOI(site);return {sim,s,site};
}

test('F1 shrine invitations are seeded and offer three distinct, bounded decisions',()=>{
 const a=createPOIs(94).filter(p=>p.kind==='shrine').map(p=>[p.uid,p.challengeKind]);
 const b=createPOIs(94).filter(p=>p.kind==='shrine').map(p=>[p.uid,p.challengeKind]);
 assert.deepEqual(a,b);assert.deepEqual(new Set(a.map(([,kind])=>kind)),new Set(['guardian','holdout','ring-run']));
 const {sim,s,site}=shrine('holdout');assert.equal(site.challenge?.id,'holdout');assert.equal(s.enemies.length,4);
 s.stats.elapsed=site.challenge!.endsAt;(sim as any).updateExploration();assert.equal(site.challenge,undefined);assert.equal(site.uses,1);
 const rewards=s.drops.length;(sim as any).updateExploration();assert.equal(s.drops.length,rewards,'completion is once-only');
 sim.pause();const frozen=structuredClone(s);sim.update(.04,idle);assert.deepEqual(s,frozen,'challenges freeze while paused');
 const ring=shrine('ring-run');assert.equal(ring.s.psychicRings!.length,3);ring.s.player.x=22;ring.s.player.z=0;
 for(let i=0;i<190;i++)ring.sim.update(.04,idle);
 assert.ok((ring.site.challenge?.progress??0)>0,'ring run demands positioning through visible wards');
});

test('F2 stages absorb a threshold skip and endless schedules a different recurring boss',()=>{
 const sim=new Simulation(25,619),s=sim.state;s.enemies=[];s.stats.elapsed=DESIGN.bossAtSeconds;s.player.iframes=1e6;s.party[0].cooldown=1e6;(sim as any).spawnAccum=-1e6;
 sim.update(.04,idle);const first=s.enemies.find(enemy=>enemy.isBoss)!;assert.equal(first.speciesId,150);
 (sim as any).damageEnemy(first,first.maxHp*4,'normal',1);assert.equal(first.dead,false);assert.equal(first.bossStage,1);assert.ok(first.hp<=first.maxHp*.5+1e-6);
 (sim as any).damageEnemy(first,first.maxHp*4,'normal',1);assert.equal(s.result,'victory');sim.continueEndless();
 s.stats.elapsed=s.nextBossAt!;sim.update(.04,idle);const recurring=s.enemies.find(enemy=>enemy.isBoss&&!enemy.dead)!;
 assert.equal(recurring.speciesId,146);assert.equal(s.stats.bossesDefeated,1);
});
