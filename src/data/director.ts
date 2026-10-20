import type {Variant} from '../game/types.ts';
/** Discrete landmarks, with smooth pressure growth inside each phase. No render timing here. */
export const DIRECTOR_PHASES=[
 {id:'opening',title:'Quiet meadow',at:0,budget:34,interval:1.35,tier:'early',variants:[.94,.015,.01,.015,.02]},
 {id:'stirring',title:'The wilds stir',at:180,budget:65,interval:1.05,tier:'mid',variants:[.83,.04,.035,.045,.05]},
 {id:'gathering',title:'Gathering danger',at:420,budget:108,interval:.72,tier:'mid',variants:[.70,.08,.07,.08,.07]},
 {id:'pressure',title:'Deep wilds',at:660,budget:145,interval:.49,tier:'late',variants:[.57,.12,.105,.115,.09]},
 {id:'surge',title:'Legendary approach',at:780,budget:175,interval:.34,tier:'late',variants:[.49,.145,.14,.125,.10]},
 {id:'legendary',title:'Mewtwo awakened',at:900,budget:64,interval:1.55,tier:'late',variants:[.43,.16,.16,.14,.11]},
] as const;
export const DIRECTOR_VARIANTS:readonly Variant[]=['normal','dark','rocket','rabid','poisoned'];
export const BOSS_RULES={warningSeconds:15,volleyWindup:.7,ringWindup:1.1,summonWindup:1.5,
 ringSpeed:7.8,ringMaxRadius:29,ringWidth:1.1,ringDamage:26,maxRings:4,jumpClearance:.9,
 volleyDamage:18,volleySpeed:10.5,volleyCooldown:2.35,ringCooldown:2.85,summonCooldown:3,
 summonCount:4,summonMinDistance:24,summonMaxDistance:31,baseHp:12000,hpPerLevel:250,contactDamage:26,speed:3.6} as const;
