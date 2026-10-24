import {pathToFileURL} from 'node:url';
import {Simulation} from '../src/game/Simulation.ts';
import {xpThreshold} from '../src/game/systems/progression.ts';
import {scriptedInput} from './lib/run-metrics.ts';

/** Reconstructs the five visible members, moves and combat relic stacks from the
 * reported 33-minute run. Personal training is estimated from the shown totals.
 * No XP, upgrade selections or boss fights; healing and incoming damage are real. */
export function createEndlessStressRun(){
 const sim=new Simulation(9,3387),s=sim.state;
 sim.gainXP=()=>{};sim.openNextLevelUp=()=>false;
 s.enemies=[];s.pois=[];s.terrainFeatures=[];s.berryTrees=[];s.recruitCount=5;
 s.stats.elapsed=1980;s.stats.level=87;s.stats.bossKilled=true;
 s.endless=true;s.bossSpawned=true;s.nextBossAt=1e9;s.itemUnlocks=[];
 s.buffs={power:1.19,haste:.64,crit:.44,deflection:.38,radius:1.61,speed:.27,specialHaste:1.91,staminaRechargeReduction:.2};
 const stacks={'kings-rock':3,'blast-seed':1,'power-herb':2,'magnet-stone':2,'toxic-barb':2,'echo-bell':3,
  'life-orb':5,'eruption-core':7,'lucky-egg-xp':1,'blast-seed-legendary':1,'lucky-egg-xp-epic':7,'shell-bell':1,
  'rare-candy-rare':2,'multi-lens':9,'rare-candy-epic':7,'razor-claw':1,'iron-ball':3,'power-herb-epic':8,
  'lucky-egg-xp-rare':1,'rare-candy-legendary':1,'healing-bead':1,'team-battery-legendary':1,'prism-shard':2,'static-orb':1};
 s.items=Object.keys(stacks);s.itemStacks=stacks;
 const template=s.party[0];
 const members=[
  {speciesId:9,level:87,attackLevel:7,moves:[['water-gun',1],['brick-break',2]]},
  {speciesId:113,level:87,attackLevel:9,moves:[['ice-beam',9],['blizzard',5]]},
  {speciesId:71,level:86,attackLevel:10,moves:[['hyper-beam',4]]},
  {speciesId:65,level:86,attackLevel:13,moves:[]},
  {speciesId:130,level:83,attackLevel:10,moves:[]},
 ];
 s.party=members.map(({moves,...member},index)=>({...structuredClone(template),...member,uid:index?s.idCounter++:1,
  xp:0,xpToNext:xpThreshold(member.level),evolutionPower:index===1?0:.5,hp:index?700:637,maxHp:index?700:637,
  learnedMoves:moves.map(([moveId,rank])=>({moveId,rank,cooldown:0})),x:0,z:0,cooldown:0}));
 s.player.hp=s.player.maxHp=637;
 return sim;
}

export function runEndlessExperiment({seconds=120,active=false}={}){
 const sim=createEndlessStressRun(),s=sim.state;
 let peakEnemies=0,damageHits=0;
 sim.onEvent=event=>{if(event.kind==='hit'&&event.damageTo==='player'&&(event.amount??0)>0)damageHits++;};
 for(let tick=0;tick<seconds*25&&s.result===null;tick++){
  const input=active?{...scriptedInput(s,'cautious',tick),interact:false}:{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
  sim.update(.04,input);
  peakEnemies=Math.max(peakEnemies,s.enemies.length);
 }
 return {seconds:Number((s.stats.elapsed-1980).toFixed(2)),result:s.result??'survived',
  active,hp:Number(s.player.hp.toFixed(2)),kills:s.stats.kills,damageTaken:Number(s.stats.damageTaken.toFixed(2)),damageHits,
  faints:s.stats.faints,peakEnemies,enemyHealthScale:s.director?.endlessScale,enemyDamageScale:s.director?.endlessDamageScale};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify({
 conditions:'Screenshot-inspired minute-33 party, existing relic stacks under new tuning, estimated personal training. Stationary and scripted movement cases; neither takes upgrades. Real ordinary arrivals, attacks and healing; bosses excluded. Simulation only.',
 results:[runEndlessExperiment(),runEndlessExperiment({active:true})],
},null,2));
