import {pathToFileURL} from 'node:url';
import {Simulation} from '../src/game/Simulation.ts';
import {getAttackProfile} from '../src/data/attacks.ts';

const starters=[1,4,7,25,92,123];
const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};

/** A controlled progression experiment, not evidence of human survival balance. */
export function runPacingExperiment({seeds=Array.from({length:24},(_,index)=>1001+index*197),seconds=900,maintainHealth=true,preferNewMoves=false}={}){
 return seeds.map((seed,index)=>{
  const starter=starters[index%starters.length],sim=new Simulation(starter,seed),state=sim.state;
  let choices=0;const rewardCounts={level:0,recruit:0,squad:0,cache:0,shop:0};
  while(state.stats.elapsed+1e-8<seconds&&state.phase!=='result'){
   if(state.phase==='choice'){
    const priority=choice=>choice.kind==='recruit'?100:choice.kind==='evolve'?90:preferNewMoves&&choice.kind==='learn'?85:choice.kind==='attack'?80:
     choice.kind==='stat'?({power:75,haste:74,xp:73,radius:65,armor:60,health:55}[choice.stat]??40):50;
    const chosen=[...state.upgradeChoices].sort((a,b)=>priority(b)-priority(a))[0];
    if(chosen){const source=state.choiceSource??'level';if(sim.choose(chosen.id)){choices++;rewardCounts[source]++;}}else break;
   }
   if(maintainHealth){state.player.hp=state.player.maxHp;for(const member of state.party)member.hp=member.maxHp;}
   // Keep ranged leaders on a clear orbit; close-range leaders approach targets when
   // outside their actual attack area. A fixed fast orbit can outrun an aura forever.
   const angle=state.stats.elapsed*.6;
   let mx=Math.cos(angle),mz=Math.sin(angle);
   const profile=getAttackProfile(state.party[0].speciesId,state.party[0].attackLevel);
   if(profile.kind==='aura'||profile.kind==='slash'){
    let target,distance=Infinity;
    for(const enemy of state.enemies){if(enemy.dead)continue;const d=Math.hypot(enemy.x-state.player.x,enemy.z-state.player.z);if(d<distance){target=enemy;distance=d;}}
    if(target&&distance>profile.radius*.7){mx=(target.x-state.player.x)/distance;mz=(target.z-state.player.z)/distance;}
   }
   sim.update(.04,{...idle,mx,mz,special:Math.floor(state.stats.elapsed*25)%425===0});
  }
  return {seed,starter,elapsed:Math.round(state.stats.elapsed),level:state.stats.level,kills:state.stats.kills,
   recruits:state.recruitCount,living:state.party.filter(member=>member.hp>0).length,faints:state.stats.faints,choices,rewardCounts,levelGains:state.stats.level-1,
   evolutions:state.stats.evolutions,pokemon:state.party.map(member=>({speciesId:member.speciesId,level:member.level,moves:1+(member.learnedMoves?.length??0),moveRanks:[member.attackLevel,...(member.learnedMoves??[]).map(move=>move.rank)]})),
   survived:state.player.hp>0,phase:state.phase};
 });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const maintainHealth=!process.argv.includes('--unassisted'),runs=runPacingExperiment({maintainHealth});
 const mean=key=>Number((runs.reduce((sum,run)=>sum+Number(run[key]),0)/runs.length).toFixed(2));
 console.log(JSON.stringify({experiment:maintainHealth?'Health-maintained deterministic orbit/approach; progression only, not human balance proof':'Unassisted deterministic orbit/approach; a scripted route, not human play',
  runs:runs.length,meanLiving:mean('living'),meanRecruits:mean('recruits'),meanLevel:mean('level'),meanFaints:mean('faints'),
  survivors:runs.filter(run=>run.survived&&run.elapsed>=900).length,results:runs},null,2));
}
