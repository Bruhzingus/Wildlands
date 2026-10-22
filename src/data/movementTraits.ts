export type MovementTraitKind='normal'|'runup'|'flight'|'leap'|'teleport'|'burrow';
export interface MovementTrait {kind:MovementTraitKind;name:string;description:string;boost?:number;airtime?:number;}
export const MOVEMENT_TRAITS={
 runupDelay:1,runupRamp:.35,turnTolerance:Math.PI/12,
 flightHold:.18,flightSeconds:2,flightRecharge:4,flightHeight:3,clearance:1.2,
 leapJumpMultiplier:1.35,
 burrowSeconds:.8,burrowSpeed:9,
} as const;
const traits=new Map<number,MovementTrait>();
// Weak early skirmishers/ranged kits receive the larger traversal advantage.
// Strong evolved kits retain the identity with a smaller speed bonus.
for(const [id,boost] of [[25,.25],[26,.18],[135,.18]])traits.set(id,{
 kind:'runup',name:'Run-up',boost,
 description:`Run straight for 1s to run on all fours with up to +${Math.round(boost*100)}% movement speed. Turning, stopping, jumping or dodging resets the boost.`,
});
for(const [id,airtime] of [[12,1.5],[16,2],[17,2],[18,2],[41,1.5],[42,1.5]])traits.set(id,{
 kind:'flight',name:'Short flight',airtime,
 description:`Hold Space after jumping to fly for up to ${airtime}s over scenery and ground foes. Release to descend; 4s recharge. Ranged attacks still hit.`,
});
traits.set(129,{kind:'leap',name:'Splash leap',description:'Space launches a higher Splash jump, clearing scenery and ground foes while high enough. Ranged attacks still hit.'});
traits.set(63,{kind:'teleport',name:'Teleport dodge',description:'Shift teleports a short distance in your movement direction, using a dodge charge.'});
// Digging specialists retain their burrow when evolving; Ground typing alone
// does not make a species a tunneller (for example, Cubone).
for(const id of [27,28,50,51,95])traits.set(id,{kind:'burrow',name:'Burrow dash',description:'Shift burrows underground for 0.8s, moving more slowly than a normal dash. You cannot take damage while burrowed. Uses a dodge charge.'});
const normal:MovementTrait={kind:'normal',name:'Standard movement',description:'Space jumps; Shift dodges.'};
export function getMovementTrait(speciesId:number):MovementTrait{return traits.get(speciesId)??normal;}
export function movementTraitLabel(speciesId:number):string {const trait=getMovementTrait(speciesId);return trait.kind==='runup'?`${trait.name} +${Math.round(trait.boost!*100)}%`:trait.kind==='flight'?`${trait.name} (${trait.airtime}s)`:trait.name;}
export const MOVEMENT_TRAIT_SPECIES:readonly number[]=[...traits.keys()];
