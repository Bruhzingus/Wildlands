import {ELEMENT_COLORS,type AttackKind} from '../data/kanto.ts';
import {getAttackProfile} from '../data/attacks.ts';
import {getItemDefinition} from '../data/items.ts';
import {getMoveDefinition} from '../data/moves.ts';
import type {UpgradeChoice} from '../game/types.ts';

type IconName=AttackKind|'heart'|'shield'|'speed'|'magnet'|'lens'|'growth'|'relic'|'power'|'xp';
const paths:Record<IconName,string>={
 bolt:'<path d="m14 3-8 10h6l-2 8 8-11h-6z"/>',
 beam:'<path d="M3 9h18M3 15h18M6 12h12M17 6l4 3-4 3M17 12l4 3-4 3"/>',
 slash:'<path d="M5 19 19 5M4 13l7-8M11 20l8-8"/>',
 aura:'<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/>',
 burst:'<path d="m12 2 2 6 6-2-3 6 5 3-7 1-3 6-2-6-7 1 4-5-4-5 7 1z"/>',
 chain:'<circle cx="5" cy="6" r="2"/><circle cx="19" cy="9" r="2"/><circle cx="8" cy="19" r="2"/><path d="m7 6 9 2-6 9"/>',
 lob:'<path d="M3 16C5 1 18 1 20 15m-5-4 5 5 2-6"/><circle cx="6" cy="18" r="3"/>',
 heal:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
 heart:'<path d="M12 21 3 12C-1 4 8 0 12 7c4-7 13-3 9 5z"/>',
 shield:'<path d="m12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5zM8 12l3 3 5-6"/>',
 speed:'<path d="m5 5 7 7-7 7m7-14 7 7-7 7"/>',
 magnet:'<path d="M5 3v10a7 7 0 0 0 14 0V3h-5v10a2 2 0 0 1-4 0V3zM5 7h5m4 0h5"/>',
 lens:'<circle cx="10" cy="10" r="6"/><circle cx="10" cy="10" r="2"/><path d="m15 15 6 6"/>',
 growth:'<path d="M12 22V10M12 14C3 14 2 8 3 4c7 0 9 4 9 10Zm0 3c0-8 5-12 10-11 0 7-3 11-10 11Z"/>',
 relic:'<path d="m12 2 8 6-3 13H7L4 8zM4 8h16M8 8l4 13 4-13M8 8l4-6 4 6"/>',
 power:'<path d="m4 17 6-6 3 3 7-10m-6 0h6v6M4 21h16"/>',
 xp:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',
};

/** Semantic icons share one small SVG vocabulary rather than unrelated emoji. */
export function upgradeIconName(choice:UpgradeChoice):IconName {
 if(choice.kind==='learn'||choice.moveId)return getMoveDefinition(choice.moveId??'')?.profile.kind??'bolt';
 if(choice.kind==='attack')return choice.sourceSpeciesId?getAttackProfile(choice.sourceSpeciesId).kind:'bolt';
 if(choice.kind==='evolve'||choice.kind==='recruit')return 'growth';
 if(choice.kind==='stat')return ({staminaRechargeReduction:'speed',defense:'shield',deflection:'shield',staminaCapacity:'speed',health:'heart',armor:'shield',damageReduction:'shield',regenerationPercent:'heal',partyRegenerationPercent:'heal',speed:'speed',haste:'speed',stamina:'speed',specialHaste:'bolt',specialPower:'power',magnet:'magnet',crit:'lens',radius:'aura',xp:'xp',luck:'xp'} as Record<string,IconName>)[choice.stat??'']??'power';
 const item=getItemDefinition(choice.id);
 const effect=item?.effects?.[0]?.action.kind;
 if(effect)return ({echo:'chain',chain:'chain',area:'burst',heal:'heal',selfDamage:'heart',status:'aura',xp:'xp',specialCharge:'bolt',specialCooldownPercent:'bolt'} as const)[effect];
 const stat=item?.modifiers?.[0]?.stat;
 return ({staminaRechargeReduction:'speed',defense:'shield',deflection:'shield',staminaCapacity:'speed',critDamagePercent:'lens',power:'power',specialPower:'power',haste:'speed',speed:'speed',armor:'shield',damageReduction:'shield',critChance:'lens',critDamage:'lens',radius:'aura',magnet:'magnet',xp:'xp',regeneration:'heal',partyRegeneration:'heal',regenerationPercent:'heal',partyRegenerationPercent:'heal',projectiles:'bolt',pierce:'beam',chains:'chain',specialHaste:'bolt',projectileSpeed:'speed',duration:'aura'} as Record<string,IconName>)[stat??'']??'relic';
}

export function upgradeIcon(choice:UpgradeChoice):string {
 if(choice.kind==='learn'){
  const move=getMoveDefinition(choice.moveId??'');
  const element=move?.element??'normal';
  return `<svg class="upgrade-icon move-disc" data-move-type="${element}" style="--move-type:${ELEMENT_COLORS[element]}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle class="disc-rim" cx="32" cy="32" r="29"/><circle class="disc-face" cx="32" cy="32" r="25"/><path class="disc-band" d="M9 25h46v14H9z"/><circle class="disc-hub" cx="32" cy="32" r="8"/><circle class="disc-hole" cx="32" cy="32" r="3.5"/><path class="disc-glint" d="M17 18a23 23 0 0 1 16-7"/></svg>`;
 }
 const name=upgradeIconName(choice);
 return `<svg class="upgrade-icon" data-icon="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}
