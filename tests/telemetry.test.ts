import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.ts';
import {makeChoices} from '../src/game/systems/progression.ts';
import {runExperiment,normalizeExperiment,RunMetricRecorder,metricsCSV,summarizeExperiments,scriptedInput,selectScriptedChoice,CSV_COLUMNS} from '../scripts/lib/run-metrics.ts';
import type {UpgradeChoice} from '../src/game/types.ts';
import {armPlaytest} from '../scripts/lib/live-telemetry.ts';
import {GATED_RECRUITS,GATED_ITEMS} from '../src/data/unlocks.ts';
import {DESIGN} from '../src/data/config.ts';
import {ITEMS} from '../src/data/items.ts';

const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
const fakeChoice:UpgradeChoice={id:'power',kind:'stat',title:'Power',description:'Test',rarity:'common',stat:'power',amount:.18};

test('headless seed replay has identical state-derived metrics with no renderer or browser globals',()=>{
 const config={seed:7117,starter:7,seconds:90,behavior:'cautious' as const,build:'balanced' as const};
 const a=runExperiment(config),b=runExperiment(config);
 assert.deepEqual(a,b);assert.equal(a.config.seed,7117);assert.equal(a.assistance,'none');
 assert.equal(a.partyAt15m,null);assert.equal(a.bossOutcome,'not-reached');
 assert.ok(a.levels.length>0);assert.equal(a.validationErrors.length,0);
 assert.ok(a.minutes.every(minute=>minute.seconds>0&&minute.seconds<=60.001));
 assert.ok(Math.abs(a.minutes.reduce((sum,minute)=>sum+minute.leaderDamage,0)-a.leaderDamage)<.003);
});

test('telemetry observation neither consumes simulation RNG nor mutates state or paused time',()=>{
 const config=normalizeExperiment({seed:1234,seconds:2}),sim=new Simulation(7,1234),control=new Simulation(7,1234);
 const recorder=new RunMetricRecorder(config,sim.state);sim.onEvent=event=>recorder.event(event);
 for(let tick=0;tick<50;tick++){
  recorder.beforeStep(sim.state,.04);sim.update(.04,idle);control.update(.04,idle);recorder.sample(sim.state);
  recorder.offered(sim.state);
 }
 const before=structuredClone(sim.state);recorder.finish(sim.state);
 assert.deepEqual(sim.state,before);assert.deepEqual(sim.state,control.state);assert.equal(sim.rng.next(),control.rng.next());
 sim.state.phase='choice';const elapsed=sim.state.stats.elapsed;sim.update(.04,idle);assert.equal(sim.state.stats.elapsed,elapsed);
});

test('recruit offers are counted once at actual offer time with gate and species regression checks',()=>{
 const config=normalizeExperiment(),sim=new Simulation(7,17),s=sim.state,recorder=new RunMetricRecorder(config,s);
 s.stats.elapsed=165;s.stats.level=4;s.upgradeChoices=makeChoices(s,sim.rng);s.phase='choice';
 recorder.offered(s);recorder.offered(s);
 const choice=s.upgradeChoices[0],accepted=sim.choose(choice.id);recorder.selected(s,choice,accepted);recorder.sample(s);
 const result=recorder.finish(s);
 assert.equal(result.recruitOffers.length,1);assert.equal(result.recruitOffers[0].at,165);assert.equal(result.recruitOffers[0].ordinal,1);
 assert.equal(result.recruits,1);assert.equal(result.choices[0].kind,'recruit');assert.deepEqual(result.validationErrors,[]);
 const invalid=new RunMetricRecorder(config,s);s.stats.elapsed=100;s.phase='choice';s.upgradeChoices=[{...choice,speciesId:6}];invalid.offered(s);
 const errors=invalid.finish(s).validationErrors;assert.ok(errors.includes('recruit-offered-before-time-gate'));assert.ok(errors.includes('recruit-offered-evolved-species'));
});

test('meaningful upgrade gaps include opening and trailing time, excluding rejected choices',()=>{
 const config=normalizeExperiment(),sim=new Simulation(7,25),s=sim.state,recorder=new RunMetricRecorder(config,s);
 s.stats.elapsed=20;recorder.selected(s,fakeChoice,true);
 s.stats.elapsed=65;recorder.selected(s,fakeChoice,false);
 s.stats.elapsed=80;recorder.selected(s,{...fakeChoice,kind:'item',id:'leftovers',rarity:'rare'},true);
 s.stats.elapsed=200;const result=recorder.finish(s);
 assert.equal(result.longestUpgradeGap,120);assert.equal(result.choices.length,2);assert.equal(result.itemRarity.rare,1);
 assert.equal(result.itemRarity.common,0);
});

test('follower hit and poison loss are counted before healing and faint denominator is recruited followers',()=>{
 const config=normalizeExperiment(),sim=new Simulation(7,19),s=sim.state,recorder=new RunMetricRecorder(config,s);
 s.party.push({...s.party[0],uid:2,poisonTime:.02});s.stats.recruits=2;s.stats.faints=1;
 recorder.event({kind:'hit',damageTo:'companion',amount:8});recorder.event({kind:'hit',damageTo:'enemy',amount:999});
 recorder.beforeStep(s,.04);s.stats.damageTaken=13.2;s.stats.elapsed=.04;recorder.sample(s);
 const result=recorder.finish(s);assert.equal(result.leaderDamage,13.2);assert.equal(result.followerHitDamage,8);
 assert.equal(result.followerPoisonDamage,.032);assert.equal(result.followerDamage,8.032);assert.equal(result.followerFaintRate,.5);
});

test('15m party and boss outcomes distinguish censored deaths, timed-out encounters and actual victory',()=>{
 const sim=new Simulation(7,19),s=sim.state,recorder=new RunMetricRecorder(normalizeExperiment(),s);
 s.stats.elapsed=899;s.result='defeat';assert.equal(recorder.finish(s).partyAt15m,null);assert.equal(recorder.finish(s).bossOutcome,'not-reached');
 s.stats.elapsed=900;s.bossSpawned=true;s.result=null;s.party.push({...s.party[0],uid:2});recorder.sample(s);
 s.stats.elapsed=930;recorder.sample(s);assert.equal(recorder.finish(s).bossOutcome,'alive-at-limit');assert.equal(recorder.finish(s).partyAt15m,2);
 s.stats.elapsed=945;s.stats.bossKilled=true;s.result='victory';recorder.sample(s);
 const result=recorder.finish(s);assert.equal(result.bossOutcome,'victory');assert.equal(result.bossFightSeconds,45);assert.equal(result.result,'victory');
});

test('scripted policies use actual action taps and configurable build priorities',()=>{
 const sim=new Simulation(7,19),s=sim.state;
 const stationary=scriptedInput(s,'stationary',0);assert.equal(stationary.mx,0);assert.equal(stationary.special,true);
 assert.equal(scriptedInput(s,'stationary',1).special,false);
 const moving=scriptedInput(s,'cautious',0);assert.ok(Number.isFinite(moving.mx+moving.mz));
 s.upgradeChoices=[fakeChoice,{...fakeChoice,id:'armor',stat:'armor'}];
 assert.equal(selectScriptedChoice(s,'offense')?.id,'power');assert.equal(selectScriptedChoice(s,'survival')?.id,'armor');
});

test('summaries retain assistance cohorts and never infer a human victory rate from scripts',()=>{
 const unassisted=runExperiment({seed:1,seconds:2}),assisted=runExperiment({seed:2,seconds:2,maintainHealth:true});
 const summary=summarizeExperiments([unassisted,assisted]);assert.equal(summary.cohorts.length,2);
 assert.equal(summary.all.runsReaching15m,0);assert.equal(summary.all.meanPartyAt15m,null);
 assert.equal(summary.hypotheses.find(h=>h.id==='human-casual-victory')?.status,'not-measured');
 assert.equal(summary.hypotheses.find(h=>h.id==='four-party-progression')?.status,'insufficient-data');
 const csv=metricsCSV([unassisted]);assert.equal(csv.trim().split('\n').length,2);assert.ok(csv.startsWith(CSV_COLUMNS.join(',')));
 assert.ok(csv.includes('"not-reached"'));assert.ok(!csv.includes('NaN'));assert.ok(!csv.includes('undefined'));
});

test('invalid replay configs fail clearly instead of starting a stalled or unbounded run',()=>{
 for(const input of [{seed:0},{seconds:Infinity},{seconds:8000},{step:0},{starter:152},{behavior:'teleport'},{maintainHealth:'yes'},{pools:'imaginary'}])
  assert.throws(()=>normalizeExperiment(input as Parameters<typeof normalizeExperiment>[0]));
});

test('fresh-save and legacy-full pools are explicit replay settings and fresh reports respect unlock gates',()=>{
 const fresh=runExperiment({seed:1124,starter:7,seconds:300,maintainHealth:true,pools:'fresh'});
 assert.equal(fresh.config.pools,'fresh');assert.ok(fresh.recruitOffers.length>0);
 assert.ok(fresh.recruitOffers[0].at>=DESIGN.recruitUnlockSeconds[0]&&fresh.recruitOffers[0].at<=300);
 assert.ok(fresh.recruitOffers.every(offer=>offer.species.every(id=>!GATED_RECRUITS.includes(id))));
 const itemChoices=fresh.choices.filter(choice=>choice.kind==='item');
 assert.ok(itemChoices.length>0,'The replay visits caches and exercises the fresh item pool');
 assert.ok(itemChoices.every(choice=>!(GATED_ITEMS as readonly string[]).includes(choice.id)&&ITEMS.some(item=>item.id===choice.id)), 'Fresh caches exclude locked and retired relics');
 assert.equal(fresh.validationErrors.length,0);
 const legacy=runExperiment({seed:1124,seconds:1,pools:'legacy-full'});
 assert.equal(legacy.config.pools,'legacy-full');assert.equal(summarizeExperiments([fresh,legacy]).cohorts.length,2);
});

test('opt-in human session recorder preserves real listeners, input, pause, choice behavior and clean detachment',()=>{
 let events=0;
 const host:{sim:Simulation|null;ui:{onStart:(id:number)=>void}}={sim:null,ui:{onStart:id=>{host.sim=new Simulation(id,143);host.sim.onEvent=()=>events++;}}};
 const start=host.ui.onStart,capture=armPlaytest(host);assert.equal(capture.status(),'armed');host.ui.onStart(7);
 const sim=host.sim!;assert.equal(capture.status(),'recording');assert.equal(host.ui.onStart,start);
 sim.update(.04,{...idle,mx:1});assert.ok(sim.state.player.x>0);assert.ok(events>=0);
 const elapsed=sim.state.stats.elapsed;sim.pause();sim.update(.04,idle);assert.equal(sim.state.stats.elapsed,elapsed);sim.pause();
 sim.state.stats.elapsed=165;sim.state.stats.level=4;sim.state.phase='choice';sim.state.upgradeChoices=makeChoices(sim.state,sim.rng);
 assert.equal(sim.choose(sim.state.upgradeChoices[0].id),true);
 const report=capture.finish({clarity:'Observed clear health numbers'});
 assert.equal(capture.status(),'finished');assert.equal(report.kind,'local-human-playtest');assert.equal(report.metrics.config.behavior,'human');
 assert.equal(report.metrics.choices[0].kind,'recruit');assert.equal(report.notes.clarity,'Observed clear health numbers');
 assert.equal(sim.update,Simulation.prototype.update);assert.equal(sim.choose,Simulation.prototype.choose);
 assert.ok(events>0);const oldEvents=events;sim.emit({kind:'log',label:'Listener preserved'});assert.equal(events,oldEvents+1);
 assert.throws(()=>capture.finish());
 const secondHost={sim:null,ui:{onStart:start}},canceled=armPlaytest(secondHost);canceled.cancel();assert.equal(secondHost.ui.onStart,start);
});
