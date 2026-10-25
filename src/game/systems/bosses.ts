import {ENDLESS_BOSS_HEALTH} from '../../data/director.ts';
import {bossEncounter,mapEncounter,type BossEncounterDefinition} from '../../data/encounters.ts';
import type {RunState} from '../types.ts';
import {averagePartyLevel,enemyProgressionScale,lateEnemyScale} from './spawning.ts';

/** The first boss is calibrated against an ordinary four-member run at 15:00.
 * Upgrades improve its kill time rather than increasing the boss's health. */
export function scheduledBossHealth(state:RunState,boss:BossEncounterDefinition):number {
 const round=state.stats.bossesDefeated??0;
 if(round===0)return boss.rules.baseHp;
 const rules=ENDLESS_BOSS_HEALTH;
 return (rules.baseHp+averagePartyLevel(state)*rules.hpPerLevel)*(1+enemyProgressionScale(state).party)*
  lateEnemyScale(state.stats.elapsed,boss.speciesId,5).health*(1+round*rules.chapterGrowth);
}

/** Old saves can contain multi-million-HP first bosses. Keep damage already
 * dealt; if it exceeds the new budget, the next hit completes the encounter. */
export function migrateFirstBossHealth(state:RunState):void {
 if(state.endless||(state.stats.bossesDefeated??0)>0)return;
 const boss=bossEncounter(state.activeBossEncounterId??(mapEncounter(state.mapId).boss.speciesId===146?'moltres':'mewtwo'));
 const maxHp=scheduledBossHealth(state,boss);
 for(const enemy of state.enemies){
  if(!enemy.isBoss||enemy.dead||enemy.speciesId!==boss.speciesId||enemy.maxHp<=maxHp)continue;
  const damageDealt=Math.max(0,enemy.maxHp-enemy.hp);
  enemy.maxHp=maxHp;enemy.hp=Math.max(1,maxHp-damageDealt);
 }
}
