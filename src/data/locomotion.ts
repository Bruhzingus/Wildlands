/** Cosmetic tuning only. These values never limit simulation travel or stats. */
export const LOCOMOTION={
 referenceSpeed:7.3,startSpeed:.22,stopSpeed:.12,stopDelay:.08,rateResponse:.055,
 maxPlaybackRate:2.5,teleportDistance:6,directionDeadband:.045,shadowSample:.3,
} as const;
/** These native Walk sheets flap/levitate rather than step on the ground.
 * Preserve their authored lift and flap timing even at very low travel speed. */
export const NATIVE_HOVER_WALK_SPECIES:ReadonlySet<number>=new Set([12,15,41,42,81,82,92,93,109,110,142,144,145,146,151]);
