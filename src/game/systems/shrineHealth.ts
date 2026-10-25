import {shrineDefinition} from '../../data/shrines.ts';
import type {RunState} from '../types.ts';

/** Resume old active trials with the new per-guardian budgets. Preserve damage,
 * defeated guardians and the trial clock; resolve completion through normal hits. */
export function migrateActiveShrineHealth(state:RunState):void {
 for(const site of state.pois){
  const trial=site.challenge;
  if(site.kind!=='shrine'||trial?.id!=='guardian')continue;
  const definition=shrineDefinition(trial.tier),maxHp=definition.health/definition.count;
  const ids=new Set(trial.guardianIds??(trial.guardianId===undefined?[]:[trial.guardianId]));
  for(const enemy of state.enemies){
   if(!enemy.shrineGuardian||enemy.dead||enemy.maxHp<=maxHp||
    (enemy.challengeSiteId!==site.uid&&!ids.has(enemy.uid)))continue;
   const damageDealt=Math.max(0,enemy.maxHp-enemy.hp);
   enemy.maxHp=maxHp;enemy.hp=Math.max(1,maxHp-damageDealt);
  }
 }
}
