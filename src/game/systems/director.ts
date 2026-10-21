import {DESIGN} from '../../data/config.ts';
import {DIRECTOR_PHASES,DIRECTOR_VARIANTS,BOSS_RULES} from '../../data/director.ts';
import type {RunState,Variant} from '../types.ts';
import {clamp} from '../../utils/random.ts';
import {mapEncounter} from '../../data/encounters.ts';
import {challengeRules} from '../../data/challenges.ts';

export interface DirectorSnapshot {
 phaseId:string;title:string;elapsed:number;spawnInterval:number;batchSize:number;enemyBudget:number;
 speciesTier:'early'|'mid'|'late';variantWeights:Partial<Record<Variant,number>>;density:number;pressure:number;
 endlessScale:number;bossWarning:boolean;bossCountdown:number;spawned:number;denied:number;transitions:number;
}
/** Authoritative, inspectable director. Adapt future arrivals; never remove or move living actors. */
export function updateDirector(state:RunState):DirectorSnapshot {
 const elapsed=state.stats.elapsed,previous=state.director;
 let index=0;for(let i=1;i<DIRECTOR_PHASES.length;i++)if(elapsed>=DIRECTOR_PHASES[i].at)index=i;
 const phase=DIRECTOR_PHASES[index],next=DIRECTOR_PHASES[index+1];
 const progress=next?clamp((elapsed-phase.at)/(next.at-phase.at),0,1):0;
 // Interpolate the quiet opening into later pressure without a boundary burst.
 // The boss keeps its own lower arrival rate instead of easing the final approach.
 const nextPressure=next&&next.at<DESIGN.bossAtSeconds?next:undefined;
 const pacingProgress=progress*progress*(3-2*progress);
 const endlessScale=state.endless?1+Math.max(0,elapsed-DESIGN.bossAtSeconds)/600:1;
 const phaseId=state.endless?'endless':phase.id;
 const pressure=clamp(1-state.player.hp/state.player.maxHp,0,1);
 const accessibility=pressure>.7?.85:1;
 const baseBudget=state.endless?140:phase.budget+(nextPressure?(nextPressure.budget-phase.budget)*pacingProgress:0);
 const enemyBudget=Math.min(DESIGN.maxEnemies,Math.round(baseBudget*accessibility));
 const living=state.enemies.reduce((count,enemy)=>count+(enemy.dead?0:1),0),density=living/Math.max(1,enemyBudget);
 const baseInterval=state.endless?Math.max(.32,.62/Math.sqrt(endlessScale)):phase.interval+(nextPressure?(nextPressure.interval-phase.interval)*pacingProgress:0);
 const interval=baseInterval*(density>.78?1+(density-.78)*1.6:1)*(pressure>.7?1.18:1);
 const variantWeights:Partial<Record<Variant,number>>={};
 DIRECTOR_VARIANTS.forEach((variant,i)=>{variantWeights[variant]=phase.variants[i]+(next?(next.variants[i]-phase.variants[i])*progress:0);});
 if(state.endless){variantWeights.normal=Math.max(.18,.43-.07*(endlessScale-1));variantWeights.rocket=.20;variantWeights.dark=.20;variantWeights.rabid=.17;variantWeights.poisoned=.14;}
 const snapshot:DirectorSnapshot={phaseId,title:state.endless?'Endless wilds':phase.id==='legendary'?`${mapEncounter(state.mapId).boss.name} awakened`:phase.title,elapsed,spawnInterval:interval*challengeRules(state.challenge).spawnIntervalScale,
  batchSize:1,enemyBudget,speciesTier:phase.tier,variantWeights,density,pressure,endlessScale,
  bossWarning:!state.bossSpawned&&elapsed>=DESIGN.bossAtSeconds-BOSS_RULES.warningSeconds,
  bossCountdown:Math.max(0,DESIGN.bossAtSeconds-elapsed),spawned:previous?.spawned||0,denied:previous?.denied||0,
  transitions:(previous?.transitions||0)+(previous&&previous.phaseId!==phaseId?1:0)};
 state.director=snapshot;return snapshot;
}
export function recordDirectorSpawn(state:RunState,accepted:boolean){const snapshot=state.director;if(snapshot){if(accepted)snapshot.spawned++;else snapshot.denied++;}}

/** Exact swept intersection against a linearly expanding radial band and moving actor. */
export function movingRingIntersects(from:{x:number;z:number},to:{x:number;z:number},center:{x:number;z:number},oldRadius:number,radius:number,padding:number):boolean {
 const x=from.x-center.x,z=from.z-center.z,vx=to.x-from.x,vz=to.z-from.z,vr=radius-oldRadius;
 const candidates=[0,1];
 for(const offset of [-padding,padding]){
  const r=oldRadius+offset,a=vx*vx+vz*vz-vr*vr,b=2*(x*vx+z*vz-r*vr),c=x*x+z*z-r*r;
  if(Math.abs(a)<1e-10){if(Math.abs(b)>1e-10)candidates.push(-c/b);}
  else {const discriminant=b*b-4*a*c;if(discriminant>=0){const root=Math.sqrt(discriminant);candidates.push((-b-root)/(2*a),(-b+root)/(2*a));}}
 }
 return candidates.some(t=>t>=0&&t<=1&&Math.abs(Math.hypot(x+vx*t,z+vz*t)-(oldRadius+vr*t))<=padding+1e-7);
}
