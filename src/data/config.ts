export const DESIGN = {
 runSeconds:900, bossAtSeconds:900, maxParty:6, expectedPartyAt15Min:4,
 recruitUnlockSeconds:[165,420,690,960,1200],
 // This means 5 total only in unusually good standard runs; sixth in endless mode.
 recruitUnlockLevels:[4,9,15,22,29],
 maxEnemies:190, maxProjectiles:220, mapRadius:115*1.25, pickupRadius:5.7, interactionRadius:4.5,
 playerSpeed:7.3, playerRadius:.62, acceleration:48, deceleration:62, jumpVelocity:8.2, gravity:22, dodgeSpeed:17, dodgeSeconds:.24,
 dodgeCooldown:2.8, specialCooldown:16,
 spawnStartInterval:2.8, spawnEndInterval:.7,
 maxActiveDrops:165,
} as const;
/** The opening damage ramp stays separate from the slower endurance increase
 * and capped party response in spawning.ts. Movement and tells stay stable. */
export const DIFFICULTY = {rampStartsAt:120,rampEndsAt:180,ordinaryDamage:1.20,healthAt15Minutes:1.4,partyHealthCap:.2,partyDamageCap:.08,eliteHp:5,eliteDamage:1.35,guardianBaseHp:600,guardianHpPerLevel:200,guardianHpPerSecond:1.5,guardianDamage:1.2} as const;
/** Extra endurance and damage from minute three, weighted toward natural
 * strength and encounter tier. Full bonuses arrive at the standard run's end. */
export const LATE_ENEMY_SCALING={startsAt:180,healthAtStart:.15,healthAtEnd:.6,damageAtStart:.08,damageAtEnd:.25,strengthWeight:.8,tierWeight:.6} as const;
export function ordinaryThreatScale(elapsed:number):number {
 const progress=Number.isFinite(elapsed)?Math.min(1,Math.max(0,(elapsed-DIFFICULTY.rampStartsAt)/(DIFFICULTY.rampEndsAt-DIFFICULTY.rampStartsAt))):0;
 return 1+(DIFFICULTY.ordinaryDamage-1)*progress*progress*(3-2*progress);
}
/** Short body poses add attack readability without changing damage or cooldowns. */
export const ATTACK_ANIMATION = {
 seconds:.32,specialSeconds:.4,bossSeconds:.42,cadenceFraction:.9,
 nativePoseScale:.65,
} as const;
/** World-unit offsets stay small even for large enemies; native sprite motion is retained. */
export const ATTACK_POSES = {
 melee:{anticipation:-.055,strike:.22,recovery:-.025,lift:.035,squash:.045,stretch:.035,lean:.06},
 ranged:{anticipation:.025,strike:-.16,recovery:.018,lift:.015,squash:.035,stretch:.025,lean:-.045},
 pulse:{anticipation:-.015,strike:.015,recovery:0,lift:.075,squash:.045,stretch:.04,lean:.015},
 quick:{anticipation:-.045,strike:.23,recovery:-.018,lift:.025,squash:.04,stretch:.03,lean:.06},
 heavy:{anticipation:-.11,strike:.32,recovery:-.035,lift:.055,squash:.09,stretch:.065,lean:.10},
 burst:{anticipation:.04,strike:-.22,recovery:.03,lift:.025,squash:.055,stretch:.035,lean:-.065},
 projectile:{anticipation:.025,strike:-.16,recovery:.018,lift:.06,squash:.06,stretch:.045,lean:-.045},
 explosive:{anticipation:-.015,strike:.02,recovery:0,lift:.10,squash:-.13,stretch:.12,lean:.015},
 lob:{anticipation:-.07,strike:.16,recovery:-.04,lift:.12,squash:.07,stretch:.07,lean:.10},
 heal:{anticipation:0,strike:0,recovery:0,lift:.18,squash:.03,stretch:.06,lean:0},
} as const;
export const HEALTH_BARS = {
 enemyRange:28,maxEnemyBars:24,playerWidth:2.7,smoothing:18,
 trackColor:'#18201c',playerColor:'#b6cc84',enemyColor:'#c67b70',
} as const;
/** Rendering caps are independent of combat damage, projectile and effect rules. */
export const COMBAT_VISUALS = {maxEffects:80,maxWindups:16,maxBossRings:8,maxPoolInstances:520,maxPoolPerKind:48,chainSeconds:.18,hitSeconds:.18,areaSeconds:.32} as const;
export const TYPE_MULTIPLIERS:Record<string,Record<string,number>>={
 fire:{grass:1.5,bug:1.5,ice:1.5,water:.75,rock:.75,fire:.75},
 water:{fire:1.5,ground:1.5,rock:1.5,water:.75,grass:.75},
 grass:{water:1.5,ground:1.5,rock:1.5,fire:.75,grass:.75,bug:.75},
 electric:{water:1.5,flying:1.5,ground:.5,electric:.75},
 fighting:{normal:1.4,rock:1.5,ice:1.5,ghost:.6,psychic:.8},
 ground:{fire:1.5,electric:1.5,poison:1.4,rock:1.5,flying:.5},
 psychic:{fighting:1.5,poison:1.5,psychic:.75},
 ice:{grass:1.5,ground:1.5,flying:1.5,dragon:1.5,fire:.75,water:.75},
 bug:{grass:1.4,psychic:1.4,fire:.7,flying:.7},
 ghost:{psychic:1.5,ghost:1.5,normal:.6},
 rock:{fire:1.4,ice:1.4,flying:1.4,bug:1.4,fighting:.8},
 poison:{grass:1.5,poison:.8,ground:.75},
 dragon:{dragon:1.5},flying:{grass:1.4,fighting:1.4,bug:1.4},
};
export function typeMultiplier(attacker:string,defenders:readonly string[]):number {
 return Math.min(2,Math.max(.45,defenders.reduce((m,t)=>m*(TYPE_MULTIPLIERS[attacker]?.[t]||1),1)));
}
