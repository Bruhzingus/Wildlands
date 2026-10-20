import {parseArgs} from 'node:util';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,relative,join,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {runExperiment,normalizeExperiment,summarizeExperiments,metricsCSV,BEHAVIORS,BUILDS} from './lib/run-metrics.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const {values}=parseArgs({options:{
 help:{type:'boolean',short:'h'},runs:{type:'string',default:'240'},seconds:{type:'string',default:'1000'},seed:{type:'string',default:'1001'},stride:{type:'string',default:'197'},
 seeds:{type:'string'},starters:{type:'string',default:'1,4,7,25'},behaviors:{type:'string',default:'cautious,orbit,stationary'},builds:{type:'string',default:'balanced,offense,survival'},pools:{type:'string',default:'fresh'},
 assisted:{type:'boolean',default:false},endless:{type:'boolean',default:false},step:{type:'string',default:'.04'},out:{type:'string',default:'artifacts/telemetry/latest'},
 replay:{type:'string'},index:{type:'string',default:'0'},quiet:{type:'boolean',default:false},
}});
if(values.help){
 console.log(`Local headless balance experiments (no WebGL, storage, network or production analytics).
Usage: npm run balance:telemetry -- [options]
  --runs 240 --seconds 1000       Number of runs and active simulation seconds
  --seed 1001 --stride 197        Reproducible unique seed sequence
  --seeds 1001,1198               Explicit seeds; overrides runs/seed/stride
  --starters 1,4,7,25             Cycle explicit Kanto starter IDs (title locks ignored for QA)
  --pools fresh                  Fresh32-item pool, gated single-stage recruits excluded
  --pools legacy-full            Full36-item/first-stage recruit pools (legacy/unlocked QA)
  --behaviors ${BEHAVIORS.join(',')}   Cycle scripted movement policies
  --builds ${BUILDS.join(',')}        Cycle choice priorities
  --assisted                     Restore HP before each tick; progression only!
  --endless                      Continue after a genuine boss victory
  --step .04                     Simulation tick (.005–.04s)
  --out artifacts/telemetry/run   Output .json, .csv and .md stem
  --replay path.json --index 0    Replay one exact config from a prior report
  --quiet                        Suppress progress messages

Compare assisted and unassisted reports separately. Replays require matching sourceFingerprint.
Every report records complete seed/config manifests and per-level, per-minute and choice timelines.
Scripts do not measure human fun, visual clarity or a casual player's victory rate.`);
 process.exit(0);
}
const integer=(value,name,min,max)=>{const parsed=Number(value);if(!Number.isInteger(parsed)||parsed<min||parsed>max)throw Error(`${name} must be an integer ${min}–${max}`);return parsed;};
const list=(value,name)=>{const entries=value.split(',').map(entry=>entry.trim());if(!entries.length||entries.some(entry=>!entry))throw Error(`${name} must be a non-empty comma-separated list`);return entries;};
async function sourceFingerprint(){
 const paths=[];
 for(const base of ['src/data','src/game/combat','src/game/systems','src/utils','scripts/lib']){
  for(const entry of await readdir(join(root,base),{recursive:true,withFileTypes:true}))if(entry.isFile()&&['.ts','.mjs'].includes(extname(entry.name)))paths.push(join(entry.parentPath,entry.name));
 }
 paths.push(join(root,'src/game/Simulation.ts'),join(root,'src/game/types.ts'),fileURLToPath(import.meta.url));paths.sort();
 const hash=createHash('sha256');for(const path of paths){hash.update(relative(root,path).replaceAll('\\','/'));hash.update(await readFile(path));}
 return hash.digest('hex');
}
let configs,previousFingerprint=null;
if(values.replay){
 const previous=JSON.parse(await readFile(resolve(values.replay),'utf8')),index=integer(values.index,'index',0,100000);
 const config=previous.results?.[index]?.config;if(!config)throw Error(`No result at index ${index}`);
 configs=[normalizeExperiment({...config,pools:config.pools??'legacy-full'})];previousFingerprint=previous.sourceFingerprint;
}else{
 const count=integer(values.runs,'runs',1,10000),seed=integer(values.seed,'seed',1,0xffffffff),stride=integer(values.stride,'stride',1,0xffffffff);
 const seeds=values.seeds?list(values.seeds,'seeds').map(value=>integer(value,'seed',1,0xffffffff)):Array.from({length:count},(_,index)=>((seed-1+index*stride)%0xffffffff)+1);
 const starters=list(values.starters,'starters').map(value=>integer(value,'starter',1,151)),behaviors=list(values.behaviors,'behaviors'),builds=list(values.builds,'builds');
 configs=seeds.map((seed,index)=>normalizeExperiment({seed,starter:starters[index%starters.length],seconds:Number(values.seconds),behavior:behaviors[Math.floor(index/starters.length)%behaviors.length],
  build:builds[Math.floor(index/(starters.length*behaviors.length))%builds.length],maintainHealth:values.assisted,continueEndless:values.endless,step:Number(values.step),pools:values.pools}));
}
const fingerprint=await sourceFingerprint();
if(previousFingerprint&&previousFingerprint!==fingerprint)console.warn('Source fingerprint differs from the report. Seed/config replay is preserved; game behavior may have changed.');
const results=[],started=performance.now();
for(let index=0;index<configs.length;index++){
 results.push(runExperiment(configs[index]));
 if(!values.quiet&&(index===0||(index+1)%20===0||index===configs.length-1))console.log(`Completed ${index+1}/${configs.length} seeds (${((performance.now()-started)/1000).toFixed(1)} wall seconds)`);
}
const finalFingerprint=await sourceFingerprint(),sourceStable=finalFingerprint===fingerprint;
if(!sourceStable)console.warn('Gameplay or experiment source changed during this batch. Keep this report as provisional and rerun on settled source.');
const summary=summarizeExperiments(results),report={schemaVersion:1,sourceFingerprint:fingerprint,sourceStable,
 methodology:{simulation:'Authoritative Simulation, no WebGL, fixed active-time steps, choices selected immediately with paused time excluded.',
  scriptedBehaviors:'Cautious uses nearest-target spacing, boundary return, threat dodges and ring jumps; orbit uses periodic movement with close-range approach; stationary is a deliberately poor baseline. All use the real cooldown/input rules.',
  damage:'Leader damage is the exact cumulative RunStats damageTaken (including poison/self damage). Follower damage sums actual hit events plus sampled poison before passive healing; a terminal tick may include at most one tick of poison if the leader dies earlier in that tick.',
  censored:'Party at 15m is null on runs ending early. First-level/recruit averages include only runs reaching those events. Never treat health-maintained runs as survival evidence.',
  gaps:'Meaningful upgrades are accepted recruit/evolve/attack/stat/item choices. Gap includes opening and trailing active time. Shrine luck is not included, making this conservative.',
  pools:'fresh matches a new save:32 base items and gated single-stage recruits excluded; legacy-full leaves pools unrestricted for existing fully unlocked/legacy QA. Explicit starter IDs bypass title unlocks for content testing. Pools are part of every config and cohort.',
  humanPlaytests:'Not measured. A deterministic movement policy cannot establish human difficulty, readability, fun or comfort.'},
 summary,results};
const markdown=['# Local balance experiment',`Source fingerprint: \`${fingerprint}\``,
 `Source stable through batch: ${sourceStable?'yes':'NO — provisional; rerun required'}.`,
 `Runs: ${results.length}. Health assistance: ${results.some(run=>run.assistance!=='none')?'YES — progression experiment only':'none'}. No human playtest claim.`,
 '| Cohort | Runs | Mean seconds | Level | Kills/min | 15m runs | Party at 15m | Boss wins/reached | Mean longest upgrade gap |',
 '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
 ...summary.cohorts.map(cohort=>`| ${cohort.name} | ${cohort.runs} | ${cohort.meanSeconds} | ${cohort.meanLevel} | ${cohort.meanKillsPerMinute} | ${cohort.runsReaching15m} | ${cohort.meanPartyAt15m??'—'} | ${cohort.bossVictories}/${cohort.bossReached} | ${cohort.meanLongestUpgradeGap} |`),
 '', '| Hypothesis / regression | Result | Observed | Sample | Target |','|---|---|---:|---:|---|',
 ...summary.hypotheses.map(hypothesis=>`| ${hypothesis.id} | ${hypothesis.status} | ${hypothesis.observed??'—'} | ${hypothesis.sampleSize} | ${hypothesis.target} |`),
 '', 'All timeline details and per-minute pressure/damage counts are in the matching JSON. CSV uses one row per seed; null/censored values are blank.',
 'Use `npm run balance:telemetry -- --replay <report.json> --index <zero-based row>` to replay a seed/config. Compare source fingerprints before comparing outcomes.',
 'These policies do not represent casual player skill. Human observation is still required before changing survival or boss tuning.',
 ].join('\n')+'\n';
const output=resolve(root,values.out);await mkdir(resolve(output,'..'),{recursive:true});
await Promise.all([writeFile(output+'.json',JSON.stringify(report,null,2)+'\n'),writeFile(output+'.csv',metricsCSV(results)),writeFile(output+'.md',markdown)]);
console.log(markdown);console.log(`Reports: ${relative(root,output)}.{json,csv,md}`);
if(!sourceStable)process.exitCode=2;
else if(summary.all.validationFailures||summary.hypotheses.some(hypothesis=>hypothesis.kind==='regression'&&hypothesis.status==='fail'))process.exitCode=1;
