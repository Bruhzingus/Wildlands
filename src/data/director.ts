import type {Variant} from '../game/types.ts';
/** Discrete landmarks, with smooth pressure growth inside each phase. No render timing here. */
export const DIRECTOR_PHASES=[
 {id:'opening',title:'Quiet meadow',at:0,budget:18,interval:2.8,tier:'early',variants:[1,0,0,0,0]},
 {id:'stirring',title:'The wilds stir',at:180,budget:38,interval:1.8,tier:'mid',variants:[.83,.04,.035,.045,.05]},
 {id:'gathering',title:'Gathering danger',at:420,budget:66,interval:1.08,tier:'mid',variants:[.68,.085,.075,.085,.075]},
 {id:'pressure',title:'Deep wilds',at:660,budget:92,interval:.78,tier:'late',variants:[.54,.13,.115,.12,.095]},
 {id:'surge',title:'Legendary approach',at:780,budget:118,interval:.62,tier:'late',variants:[.46,.155,.15,.13,.105]},
 {id:'legendary',title:'Mewtwo awakened',at:900,budget:48,interval:1.8,tier:'late',variants:[.43,.16,.16,.14,.11]},
] as const;
export const DIRECTOR_VARIANTS:readonly Variant[]=['normal','dark','rocket','rabid','poisoned'];
export const BOSS_RULES={warningSeconds:15,volleyWindup:.7,ringWindup:1.1,summonWindup:1.5,
 ringSpeed:7.8,ringMaxRadius:29,ringWidth:1.1,ringDamage:46,maxRings:4,jumpClearance:.9,
 volleyDamage:32,volleySpeed:10.5,volleyCooldown:2.35,ringCooldown:2.85,summonCooldown:3,
 burstWindup:1.1,burstCooldown:4.2,burstRadius:6,
 summonCount:4,summonMinDistance:24,summonMaxDistance:31,baseHp:280000,hpPerLevel:5600,contactDamage:48,speed:3.6} as const;
