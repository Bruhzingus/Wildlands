# Evidence, progression costs, and how to validate a balance package

**October 24, 2026.** This document separates observed problems from proposed tuning targets. Read the [comparison](README.md) for the three complete alternatives and [common fixes](COMMON_FIXES.md) for delivery corrections. None of the proposals has been implemented in the game.

## What the existing measurements establish

The [original audit](../STARTER_BALANCE_AUDIT.md) measures 17 starters and 19 final forms using production attack geometry, damage formulas and Q execution. Its five fixtures distinguish a close small target, distant small target, large boss, forward group and surrounding group. The harness resolves a complete cast, then divides primary damage by its real interval. Fifty-three cross-checks against the full Simulation primary path passed. Exact numbers are in [STARTER_AUDIT_DATA.md](../STARTER_AUDIT_DATA.md).

The current evidence supports specific conclusions, rather than a universal tier list:

| Observation | Mechanism | Consequence for a proposal |
| --- | --- | --- |
| Blastoise reaches 1,870.49 primary DPS versus Gyarados's 295.34 at L30/R8 | Five reliable bubbles each carry a full damage packet; Gyarados has one beam | Changing base power alone misses the dominant multiplier |
| Vaporeon greatly outdamages the other Eevee branches | Overlapping homing explosions versus distributed chains and a spread fan | Compare each branch to the Eevee that actually evolves, including the gained rank |
| Zubat starts at 46 close DPS with 105.6 HP and flight | Strong slash scaling and short cadence | Close-range risk does not automatically justify stacking every advantage |
| Bulbasaur starts at 27.63 DPS at 17.5m | A long instant vine receives slash damage and range treatment | Safety and reliable delivery consume part of its offensive budget |
| Vulpix can fall to zero stationary small-target DPS at rank 6 | The wider orbit expires just outside collision radius | Fix delivery before compensating with damage |
| Gastly's rank-two orbit abandons the previous 3m target | A larger ring has a larger inner hole | Choose explicitly between positional ring, inner protection and full-disk damage |
| Magikarp starts at 6.5 DPS and 67.2 HP, with no independent learned attack available | Deliberate weak opening compounded by slow XP and evolution gating | A payoff buff alone may never be experienced by ordinary players |
| Pikachu's six-strike Q hits a lone boss only once | Distinct-target selection | A coverage count is not a boss multiplier |

These fixtures exclude random crits, DOT, types, items, learned attacks and team bonuses so geometry is legible. They include within-cast knockback. They do not model the positioning, repeated knockback, obstacles, incoming attacks or interrupted Q use of an entire run. Static DPS is an upper opportunity measure, not a prediction of survival or win rate.

## Why “give the weak starter 20% damage” is incomplete

### Same-target overlap creates different upgrade values

A full extra hit increases a one-hit cast by 100%, a two-hit cast by 50%, and a five-hit cast by 20%, before accuracy and targets are considered. Extra bubbles can hit the same enemy; extra vine lanes cannot revisit an enemy already hit by that cast. A chain upgrade adds a different enemy, and a wider flame fan can add a projectile that misses a small target completely.

This is why the alternatives differ structurally:

- **A** reduces outlier native counts/coefficients but retains full-value projectile additions. It preserves exciting item combinations and also preserves some build volatility.
- **B** limits repeated hits within a bubble cast while retaining distinct delivery mechanics elsewhere. It is a local change to the most problematic reliable overlap.
- **C** assigns an explicit cast budget, with a stated damage return from added projectiles. It changes what a projectile upgrade means across the combat system.

Do not combine C's normalized budgets with A/B's compensating coefficients. That would pay twice for the same correction.

### Signature ranks compete with stats, independent learned attacks and evolution

For a fixed species without a mechanical breakpoint, one signature rank changes primary DPS by:

```text
next/current = [(1 + 0.20r) * (1 + 0.08r)]
             / [(1 + 0.20(r - 1)) * (1 + 0.08(r - 1))]
```

Here `r` is the current rank. The two factors come from damage and cadence; extra hits, lanes, radius and Q changes are additional benefits.

| Rank transition | Signature-only primary DPS gain |
| --- | ---: |
| 1 to 2 | 29.60% |
| 2 to 3 | 25.31% |
| 3 to 4 | 22.17% |
| 5 to 6 | 17.85% |
| 8 to 9 | 13.89% |
| 12 to 13 | 10.77% |
| 20 to 21 | 7.47% |
| 50 to 51 | 3.51% |

At zero existing bonus, common +8% power or +8% haste produces an 8% gain in its affected automatic attacks. With +50% additive power already earned through two evolutions, another +8 percentage points of power is a **5.33% relative** increase. Common +4 percentage points of critical chance changes the baseline expected direct multiplier from 1.0425 to 1.0765, a **3.26%** gain; Q does not use ordinary critical rolls. These are comparisons for the same affected owner and ordinary noncritical-tier-boundary conditions, not a claim that a personal buff applies to the entire squad.

The comparison changes once learned attacks matter. If the signature contributes only 40% of an owner's automatic DPS, a 13.89% signature increase adds about 5.56% to that owner's total automatic DPS, while relevant power/haste affects all its attacks. Rare, epic and legendary stat offers also have larger values than common offers. Therefore do not globally increase common stats just because early signature training wins a one-move comparison. Measure choice value at realistic move shares and rarity.

All three packages retain uncapped signature rank and earned power/haste/radius/critical growth. Existing finite entity counts and bounded probability/avoidance rules are separate. A new cast-budget system must not become a hidden ceiling on earned percentage damage or casting speed.

### Q damage should be evaluated as burst, coverage and utility

For an isolated stationary target with perfect cooldown use, Q contributes `damage per cast / cooldown`. That is useful bookkeeping but omits emergency timing and invulnerability. Every normal Q cast also supplies at least 0.4s of invulnerability. Heal, displacement, stun, soak and repositioning can be more valuable than another small damage coefficient.

For example, rank-one Pikachu has 20.43 primary DPS and 33.6 isolated-boss Q damage every 16s. A common +25% special recharge bonus adds only 0.525 averaged DPS to this direct-damage model, about **2.33%** of primary plus Q. Caterpie's 176 boss Q damage supplies 11 averaged DPS; the same recharge bonus adds 2.75, about **11.27%** of its combined direct output. Equal cooldowns do not make special training equally attractive.

This is a reason to inspect Thunder's repeat-target behavior, not to multiply every Q by six. For Meowth, Machop and fire guards, range can be the binding constraint; more damage at unreachable targets adds nothing. For Oddish, Q damage alone omits healing to every living member. For Abra, movement and the beam share a cast and can be limited by terrain.

### Defensive value depends on the threat and the owner

For repeated identical raw hits `D` larger than defense `A`, a useful continuous estimate is `effective HP = HP * D / (D - A)`. It ignores integer hit breakpoints, dodge timing and other mitigation. At raw 20 damage, raising defense from 1.7 to 1.9 improves this estimate by about 1.1%; adding 10% maximum HP improves it by 10%. Against raw 5 damage, the same defense increase improves it by about 6.5%. Flat defense becomes much more powerful against small hits and sufficiently large stacked defense.

HP also changes percentage healing and evolution recovery amounts. A health-factor override applies to recruits as well as the leader unless a proposal expressly makes it leader-only. Followers start from a different health budget and receive different incoming treatment. Flight, Run-up, burrow and Abra's special dodge are leader movement traits; recruiting a species does not grant its traversal to the leader.

Consequently each package states HP/defense alongside damage. Adding flight to Charizard, drain to Golbat or damage suppression to Gyarados requires paying a specific cost; it cannot be treated as cosmetic lore completion.

### Progression can amplify a small opening disadvantage

Low damage means fewer kills, later XP milestones, slower recruitment qualification and a later evolution opportunity. A normalized L30/R8 chart deliberately removes this feedback, making it useful for kit comparison but insufficient for Magikarp's actual difficulty. Three-stage evolution also adds two power bonuses in the current system, while two-stage evolution adds one. C explicitly replaces that source of form-budget asymmetry; A/B retain it and tune around it.

Use two comparisons: equal level/rank/choice investment, and equal elapsed time under ordinary XP. The original final-form comparison spends seven milestone choices on evolution plus signature ranks when maturity allows. It does not assert every run reaches that state at the same minute. Check every middle form and before/after evolution pair, including rank breakpoints; a good final form can conceal a miserable Wartortle, Metapod or Kadabra phase.

## Additional builds that can overturn the raw chart

| Build or situation | What to inspect |
| --- | --- |
| Loaded Dice at 0, 1 and 3 copies | Same-target overlap, increased coverage, count saturation and B/C budget handling |
| King's Rock plus multi-hit signatures | Stun opportunities per target per cast; whether repeats incorrectly count as fresh proc opportunities |
| Metronome versus one boss and scattered enemies | Consecutive-hit ramp, target switching, kill transitions, weighted-hit policy in C |
| Big Root and Power Herb with high haste | Cast-event frequency, echo semantics and several learned attacks; hits are not casts |
| Water plus Electric | Soak's direct 35% Electric amplification and separately the Conductive Tide proc |
| Poison plus Fire | The direct 18% fire bonus against poisoned targets and separately Venom Flare |
| Oddish plus percentage healing or Q healing relics | Duplicated sustain, follower automation and Famine behavior |
| Wide Front and Critical Volley after the shared fix | Changed membership and the actual range/crit benefit |
| High attack speed at the projectile-pool limit | Logical damage preservation, ownership, independent casts and attribution |
| Rank 20/50 with high percentage bonuses | Numerical stability and retained scaling beyond the early authored milestones |

Secondary damage must retain the existing protection against recursive item effects. New casts, repeated projectiles, periodic pulses and replicated visuals must have explicit event semantics. At the 220-projectile pool limit, the current game can merge compatible friendly streams; any per-cast damage/proc ledger must survive that merge without treating unrelated casts as one or duplicating their allowances.

## Proposed acceptance process

These are tests to perform when implementing a chosen option. They have **not** been executed against the new mechanics merely because their documents exist.

### Step 1: corrected geometry and exact contracts

Run the existing audit after the shared corrections. Extend its fixtures with targets at 1/3/5/8/12m; a size-0.8 target moving toward the caster at 3m/s; one moving transversely at 3m/s; a 4.4-size boss; a dense cluster; and a sparse chain of enemies. Run repeated casts for 30s so pushback and status uptime accumulate. Record first-hit latency, damage per target, aggregate damage, proc opportunities and time in range.

Use R1/2/3/4/5/6/7/8/12/20/50 and each actual form. For exact authored breakpoints, verify the preceding and following rank. Q tests need empty space, a lone target, two enemies, a large crowd, target death mid-cast and obstacles on movement paths. Test low-HP Flail at 100%, 50% and 10% health.

Hard gates: no beneficial radius/rank upgrade silently removes all reliable damage; no offer is useless for every eligible current move; no evolution loses advertised state; no non-finite damage; deterministic save/load preserves active casts and any per-target budgets. Boundary tests are correctness contracts, not arbitrary “DPS must be equal” tests.

### Step 2: compare meaningful investment and team contexts

Use fresh-save starting choices and fully unlocked choices as separate cohorts. Compare L1/R1, actual first evolution, actual final evolution, L30/R8, and the exact Eevee R8-to-branch-R9 choice. Use identical invested choice counts for signature-focused, learned-move-focused and survival builds. Then repeat at fixed elapsed times without granting extra XP or health.

Measure both solo leaders and a fixed mixed party. Run a second party comparison with the candidate as a follower and a common leader. Support effects, self-healing and leader movement must not be conflated. Include each available map and its actual typed boss; report neutral and typed damage separately. Do not infer defensive type resistance because it exists in the cartridge games.

### Step 3: matched automated runs with honest policies

Start with 30 paired seeds per starter/map for a baseline and candidate package. Use the same starting unlock pool, difficulty, step, upgrade policy and recruit policy. Report distributions and paired differences for survival at 180/600/900s, time to level 10/15/30, first/final evolution time, kills per minute, damage taken, follower faints and boss completion time. Record censored runs instead of discarding deaths. Bootstrap intervals can show uncertainty; 30 runs are an initial signal, not proof of small differences.

The existing [run-metrics policy](../../scripts/lib/run-metrics.ts) is not yet a fair universal balance judge: it groups slash/aura as close combat and approaches using `profile.radius`. That drives a long-ranged vine toward contact and can place Gastly inside its dead zone. It also does not represent skilled flight use or intentional emergency Q timing. Add kit-aware positioning policies using resolved effective reach and coverage, and test at least cautious and aggressive policies. Keep a simple fixed policy as a reproducible stress test, labelled as such. Health-maintained experiments must never be reported as survival wins.

### Step 4: short human comparisons and release criteria

For the shortlist, play matched runs with both a familiar and a less-experienced player. Capture whether attacks read clearly, useful upgrades feel positive, evolution feels rewarding, and mistakes have recoverable consequences. Repeat especially Vulpix/Gastly/Machop, the three Eevee branches and Magikarp/Gyarados. Check that Q and movement remain usable with the current controls.

Use these **review triggers**, not hard homogenization rules: investigate a generalist with more than 2x another generalist's reliable neutral single-target output at comparable investment; an evolution that loses over 10% primary output without an explicitly demonstrated utility/defense payoff; or a starter whose 180s survival is more than 15 percentage points below the cohort median. A deliberately labelled challenge starter may be an exception only if its measured reward is worth the hardship. Crowd specialists can exceed single-target specialists in aggregate crowd damage.

### Step 5: compatibility and performance

Run relevant starter, special, progression, item, movement, synergy, snapshot and damage-attribution tests, then the full suite and typecheck. Add browser coverage for changed preview text and new visual mechanics. Test snapshot round-trips during the longest active cast and stress the existing enemy/projectile/active-special limits. For B/C, compare logical damage and proc totals below and at the visual pool limit.

Keep a candidate package behind one explicit balance configuration/version during evaluation. Avoid mixing old and new budgets inside a resumed run. Retain a rollback path that restores the previous data and migration behavior without corrupting saved progression. No resets to permanent unlocks are needed to test starter balance.

## Evidence labels used in the proposals

- **Measured baseline:** current production mechanics exercised by the audit.
- **Measured candidate profile:** proposed data substituted only in an isolated process, using existing production geometry. Shared fixes and new mechanics are excluded unless explicitly implemented in that probe.
- **Formula projection:** calculated from a proposed rule with stated hit/position assumptions. This is an implementation target, not a successful playtest.
- **Design judgment:** an intended role, tradeoff or release preference that needs the validations above.

The prior audit's 570 passing repository tests describe the baseline at that time. They do not validate an unwritten balance patch. The present work supplies reviewable alternatives and checkable tuning math so a later implementation has a clear specification.
