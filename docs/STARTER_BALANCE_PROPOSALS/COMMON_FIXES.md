# Shared combat corrections before balance tuning

**Proposal, October 24, 2026. No gameplay changes have been applied.** These corrections are prerequisites for [Option A](OPTION_A_TUNING.md), [Option B](OPTION_B_IDENTITIES.md), and [Option C](OPTION_C_SYSTEMS.md). They address misleading upgrades and inconsistent delivery. Their implementation still changes practical strength, so regenerate the baseline after landing them and before judging a tuning package.

The original evidence is in [the starter audit](../STARTER_BALANCE_AUDIT.md) and [its measured tables](../STARTER_AUDIT_DATA.md). Current means the audited working tree, including its existing uncommitted gameplay changes.

## 1. Make targeted foxfire converge before it expires

**Problem.** Vulpix's primary wisps start around the target, with radius shrinking as `r(t) = r0 * exp(-0.75t)`. At rank 6, `r0 = 2.8m` and lifetime is 1.5s. The ending radius is approximately 0.909m. A size-0.8 enemy has a projectile collision threshold of `0.3 + 0.75 * 0.8 = 0.9m`. In the stationary fixture, the entire cast misses. Increasing radius can therefore remove all damage. This was reproduced at several simulation steps; it is not a claim that every moving enemy always evades it.

**Proposed delivery rule.** Retain the initial orbit, then finish at the target's center. For a newly created targeted foxfire projectile, store initial radius `R`, total lifetime `T`, and elapsed time `t`. Use this continuous curve:

```text
u = clamp(t / T, 0, 1)
if u <= 0.65:
    r = R * exp(-0.75 * t)
else:
    r65 = R * exp(-0.75 * 0.65 * T)
    r = r65 * (1 - u) / 0.35
```

Continue using the current angular speed and swept collision. This guarantees the trajectory reaches the current center by expiry; it does not create a separate guaranteed-damage callback. Collision, dead-target handling, piercing, status and damage attribution remain in the normal hit path. Stop advancing at remaining lifetime when a frame crosses expiry.

Use nullish defaults for radius (`??`), not `radius || 2`: zero is now a valid final radius. Do not apply this curve to owner-centered Gastly wisps or Q fire guards. They are different mechanics. If the target dies, retain the last valid center for the remaining trajectory; do not silently acquire a new target. Existing projectiles follow the current source-lifetime policy when their owner faints.

**State and files.** Add optional `orbitInitialRadius`, `orbitTotalLifetime`, and `orbitElapsed` fields to [Projectile](../../src/game/types.ts). Initialize them in [patterns.ts](../../src/game/combat/patterns.ts), advance the curve in [projectiles.ts](../../src/game/combat/projectiles.ts), and validate them in [runSnapshot.ts](../../src/game/runSnapshot.ts). Require the three fields together or all absent, finite `R >= 0`, `T > 0`, and `0 <= t <= T`. For old saved targeted wisps with positive remaining TTL, initialize a fresh remaining segment from `savedRadius ?? 2` and remaining TTL, with elapsed zero. This avoids a position jump and completes convergence within the saved lifetime. Already-expired projectiles are retired without evaluating `t/T`. Keep fields absent for unrelated projectiles.

**Alternatives considered.** Increasing lifetime enough to reach each target would retain the exponential spiral, but damage latency and live projectile count would grow with radius upgrades. Awarding damage on expiry would obscure actual geometry and risk duplicate hits. Shrinking the orbit milestone would repair one rank while leaving other radius bonuses vulnerable. The explicit convergence curve fixes the underlying monotonicity problem.

**Acceptance cases.** Ranks 1, 5, 6 and 8; radius bonuses 0%, 12.6%, 50% and 200%; sizes 0.8 and 4.4; stationary, approaching and transverse-moving targets; simulation steps 0.01, 1/60, 0.025 and 0.04s. A stationary acquired target must be hit at least once by each surviving wisp, never twice by that same wisp. Added radius must not turn the stationary target's full cast into zero damage. Test target death, save/load mid-orbit, and the last partial frame. Moving-target results should be recorded, not asserted identical across all paths.

## 2. Align combo acquisition with the area that receives all strikes

**Problem.** Machop's primary chooses a target using resolved `profile.range`, but executes the combo inside resolved `profile.radius`. At rank one those are 6.75m and 5.625m. At rank eight they are 8.325m and 6.5m. The general melee fallback gives an acquired outer target one hit instead of the advertised two to four strikes. Players and bots can sit in a range where the move works at a fraction of its apparent damage.

**Proposed rule.** For `pattern === 'combo'` only, use:

```text
acquisitionReach = min(profile.range, profile.radius) * radiusScale
```

Use the same reach in leader and follower acquisition, effective-range UI, aim previews and audit fixtures. Keep full combo damage, the existing forward-angle condition, and selected-target commitment once a valid cast starts. Do not change the fallback for vine, pounce or generic slash moves. Do not enlarge the area as a side effect of this correction.

Treat an Echo Bell repeat as a new cast for reach validation. The previous combo can push its target outside the envelope before the echo reuses it. Revalidate that target against the same effective reach, reacquire a valid nearest enemy if necessary, and skip the echo if none is available. Apply this rule at every combo entry point, including the echo path in `Simulation.applyBuildAction`, rather than only the ordinary attack scheduler. Retain nearest-target acquisition's existing strict `< reach` boundary; the swept damage radius may remain inclusive for other already-valid victims.

This deliberately removes the outer one-hit poke. It is a clearer close-combat contract, not a free DPS buff. At a stationary 8m target, a rank-eight Machamp without radius bonuses will no longer start a combo. Its close-range performance is the relevant comparison. If playtests show that closing distance is too costly, increase authored combo reach and radius together in the selected balance package.

**Alternatives considered.** Extending the sweep to the old acquisition range would give the full combo an approximately 64% larger disk area at rank eight before the facing filter, a significant crowd buff. Guaranteeing every combo strike on the selected target outside the sweep would produce different reach rules for the primary and nearby targets. Either can be an intentional design, but neither is a neutral correctness fix.

**Files and acceptance.** Centralize effective acquisition reach alongside [attack-profile resolution](../../src/data/attacks.ts); consume it in [Simulation.ts](../../src/game/Simulation.ts), relevant previews and experiment scripts. Verify just inside, exactly on and just outside the effective boundary, at ranks 1/3/8 and with radius bonuses. Compare leader and follower behavior. Keep previously valid melee selected-target regression tests passing.

## 3. Offer modifier relics according to executed mechanics

**Problem.** [moveUsesModifier](../../src/game/systems/progression.ts) often treats any named pattern as supporting projectile count, piercing or projectile speed. Magikarp's one-target Tackle ignores all three. Bubble explosions and spore pods consume themselves on impact; added piercing does not make them continue through more enemies. Orbit movement replaces projectile velocity, making projectile-speed bonuses ineffective for those orbits.

**Proposed rule.** Introduce one capability resolver that describes what a resolved move actually consumes. Use it both for offer eligibility and modifier descriptions. Evaluate current living eligible members, their learned moves and their Q separately, preserving item ownership rules. A mixed-stat item is still eligible if at least one positive effect helps. A conditionally active but valid effect remains useful. Do not promise future compatibility with an evolution the party has not taken.

| Current primary mechanic | Extra projectiles | Extra pierce | Projectile speed |
| --- | --- | --- | --- |
| Tackle, combo, pounce | No | No | No |
| Vine, thread, sand wave | More lanes can hit previously unhit targets; never repeat damage to an already-hit enemy | More targets per lane | No |
| Flame fan, gust, Swift, crossing beams | Yes | Yes | Yes |
| Bubble stream, spore lob | Yes | No while first-impact explosion consumes the shot | Yes |
| Foxfire, haunt | Yes | Yes, for additional distinct enemies along each wisp's path | No under current orbit movement |
| Ricochet | Yes | Yes after bounce behavior, subject to the actual remaining path | Yes |
| Generic chain | No | No | No; chain count has its own modifier |
| Generic aura, burst or healing pulse | No | No | No |

Apply existing count limits to actual added value: extra lanes/projectiles cannot exceed 12, and per-lane/per-projectile penetration uses the relevant existing limit. Do not confuse a coverage upgrade with a single-target damage upgrade. Do not add new caps to percentage growth.

For Q, inspect the actual execution branch. A Quickstep profile with zero native volley projectiles does not gain a volley merely because a modifier is present; treat that as unsupported. Eevee can still benefit from extra projectiles through Swift. Check all Q branches rather than a loose kind-name list.

**Acceptance cases.** Solo Magikarp must not receive a pure projectile-count, piercing or projectile-speed offer for Tackle/Flail. A current compatible learned move or living teammate can make a squad-owned item useful. Solo Squirtle must not receive pure piercing on the strength of Bubble/Surf alone. Test healing-only squads, dead followers, leader-owned items, mixed-stat items, cap boundaries and challenge restrictions. Update Loaded Dice's current bolt/beam/lob wording if instant lanes are intentionally included in its supported capabilities.

## 4. Classify attack synergies by the resolved signature

**Problem.** [synergies.ts](../../src/data/synergies.ts) tests `species.attack`, while combat executes the resolved profile. Bulbasaur is catalogued as lob but uses a slash vine; Butterfree is catalogued as lob but uses a beam thread; Charizard and Ninetales have similar catalogue/execution disagreements. Wide Front and Critical Volley can activate for the wrong composition.

**Proposed rule.** An attack-kind requirement uses `getAttackProfile(member.speciesId, member.attackLevel).kind`. A member contributes one signature kind; learned moves and Q do not grant additional role slots. Keep species type requirements and distinct-contributor rules unchanged. The cache key includes member identity, species, living state and signature rank, so a future rank-based kind change cannot leave stale results. Resolve this without importing build/synergy calculation back into profile resolution.

**Acceptance cases.** Test each mismatched species, evolution transitions, faint/revive and party replacement. A Bulbasaur plus a second real slash/aura/burst attacker can satisfy Wide Front. A Charizard plus a real bolt/beam partner can satisfy Critical Volley. The same member cannot fill both required contributors. Compare tooltip and actual active modifiers.

## 5. Make displays describe the selected behavior

After choosing a package, update affected move descriptions, evolution previews and starter summaries from the resolved data. Show an actual strength and limitation: “piercing wind; pushes enemies away,” “close cone; four punches,” or “orbits converge on the target.” Do not label a non-draining move as healing, promise flight to Charizard/Gyarados without adding it, or show the leader's bookkeeping HP as another life bar.

Pidgey's Normal-versus-Flying attack element is a design choice, not a universal bug fix. Thunder's inability to repeat on a lone target is likewise a valid current coverage mechanic. Each option must state whether it changes those rules. Preserve autoattack controls, follower autonomy and the current offensive-only type-chart model unless a proposal explicitly budgets a change.

## Recommended delivery order

1. Add focused regression cases demonstrating foxfire misses, combo reach mismatch and false-positive offers.
2. Implement each correction separately with its UI and save consequences; retain deterministic hit attribution.
3. Rerun the production geometry audit and compare the corrected baseline to the original. A changed synergy or reliable foxfire can raise damage before any tuning.
4. Implement exactly one balance option against that corrected baseline. Use the [validation plan](EVIDENCE_AND_VALIDATION.md) to decide whether its numeric targets survive moving combat and ordinary progression.

These fixes do not themselves normalize the water-family damage outlier, solve Eevee branch incentives, or give Magikarp an adequate payoff. They make those balance decisions measurable.
