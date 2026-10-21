import {getSpecies,type Element} from '../../data/kanto.ts';
import {typeMultiplier} from '../../data/config.ts';
import {PROGRESSION,levelPowerMultiplier} from '../../data/progression.ts';
import type {StatusProc} from '../../data/attacks.ts';
import type {Enemy,PartyMember} from '../types.ts';

export function memberDamage(member:PartyMember,_growthDamage:number,power:number):number {
 return (getSpecies(member.speciesId).power+9)*levelPowerMultiplier(member.level)*(1+PROGRESSION.moves.damagePerRank*Math.max(0,member.attackLevel-1))*(1+power);
}
export function elementalDamage(amount:number,type:Element,enemy:Enemy,matchup=true):number {
 let total=amount*(matchup?typeMultiplier(type,getSpecies(enemy.speciesId).types):1);
 if(type==='electric'&&enemy.soakedTime>0)total*=1.35;
 if(type==='fire'&&enemy.poisonTime>0)total*=1.18;
 return Math.max(0,Number.isNaN(total)?0:Math.min(Number.MAX_VALUE,total));
}
const durations={burn:3,poison:4,slow:2.5,soak:3.2,stun:.7} as const;
const timers={burn:'burnTime',poison:'poisonTime',slow:'slowTime',soak:'soakedTime',stun:'stunTime'} as const;
export function applyStatusProcs(enemy:Enemy,procs:StatusProc,roll:()=>number,durationScale=1):string[]{
 const applied:string[]=[];
 for(const key of Object.keys(timers) as (keyof StatusProc)[]){
  const chance=procs[key]||0;if(chance<=0||roll()>=chance)continue;
  const timer=timers[key];enemy[timer]=Math.max(enemy[timer],durations[key]*durationScale);applied.push(key);
 }
 return applied;
}
/** Integrated remaining time prevents frame rate and expiry boundary damage changes. */
export function tickEnemyStatuses(enemy:Enemy,dt:number):number {
 const damage=Math.min(dt,enemy.poisonTime)*2.6+Math.min(dt,enemy.burnTime)*4;
 for(const timer of Object.values(timers))enemy[timer]=Math.max(0,enemy[timer]-dt);
 return damage;
}
export function enemySpeedFactor(enemy:Enemy):number{return enemy.slowTime>0?.57:1;}
