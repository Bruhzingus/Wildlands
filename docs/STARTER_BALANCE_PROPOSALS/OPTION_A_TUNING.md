# Option A: rebalance the existing kits

**Proposed for review, October 24, 2026. Gameplay changes have not been applied.**

This package keeps the current controls, evolution choices, movement traits, learned-move pools and combat systems. It adjusts authored attack parameters, gives Magikarp a less punishing opening, reduces evolved water damage, and replaces Gastly's unreliable ring with the existing circular aura attack. It adds no passive system, resource, input or new learned move.

The intended result is a roster with distinguishable strengths: Machamp leads committed close combat; Blastoise delivers reliable ranged damage; Alakazam supplies long piercing lanes; Gyarados combines durability and strong beam damage; Oddish's line offers sustain; Pikachu and Pidgey retain their crowd-control value. These are design goals, not demonstrated win-rate outcomes.

This document builds on [the starter audit](../STARTER_BALANCE_AUDIT.md) and [its measured baseline](../STARTER_AUDIT_DATA.md). All values below are authored parameters before stage, melee, rank and level multipliers unless explicitly described as resolved or measured.

## Prerequisites and limits of the evidence

Apply the [common mechanical fixes](COMMON_FIXES.md) before balancing release candidates:

- Targeted foxfires must converge before expiry across supported enemy sizes, area bonuses and simulation steps.
- Combo acquisition must use `min(profile.range, profile.radius) * radiusScale`. Preserve the generic selected-target fallback outside the combo path; the combo should never select a victim that only that fallback can reach.
- Relic eligibility must reflect effects the current party can actually use. Resolve advertised bubble penetration without adding unbudgeted damage in this tuning pass.
- Attack-kind synergies must read the active attack definition consistently.

An isolated candidate probe was run using production attack patterns, projectile collision and Q execution. It changes exported data **in memory inside its own process**, leaving game files untouched. The reproducible source is [starter-balance-option-a.mjs](../../scripts/starter-balance-option-a.mjs); its local output is `artifacts/option-a-probe.json`. Run it in a separate Node process with:

```powershell
node --experimental-strip-types scripts/starter-balance-option-a.mjs
```

The probe compared 36 starting/final-form profiles before and after, each against five primary and five Q layouts, and checked twelve Eevee pre-evolution ranks. It **does not implement the common fixes**, run complete game loops, model critical hits, apply status damage, simulate moving targets or measure survival. Its exact outputs validate candidate data and geometry under those fixtures, not the complete release package. Output includes source fingerprints to identify the tested code. Do not import the probe into the same process as another audit: its module data mutations intentionally last until that process exits.

Labels used below:

- **Probe:** executed through production geometry with the candidate parameter changes.
- **Calculated:** formula-derived expectation, conditional on the stated hit count.
- **Proposed:** a design decision requiring implementation and validation.

## Exact primary-attack changes

Implement these in `src/data/rosterContent.ts`, in the final effective `SPECIES_ATTACK_PARAMETERS` entries or their family definitions. Fields omitted below retain their current effective values. An earlier object entry can be overwritten by `...starterSignatures`; edit the effective entry rather than an obsolete override. In particular, Flareon's effective current scale is **0.48**, not the earlier overwritten 0.97, and Ninetales' effective scale is 0.65, not 0.98.

| Family and forms | Exact changes | Ranks affected and reason |
| --- | --- | --- |
| Bulbasaur, Ivysaur, Venusaur; IDs 1–3 | `range: 14 → 11.2`; `damageScale: 1.05 → 0.95` | All ranks. Resolved opening reach becomes 14m instead of 17.5m after the slash multiplier. Keep piercing and lane milestones. Safe instant lanes should cost some damage and reach. |
| Charmander, Charmeleon, Charizard; IDs 4–6 | Retain `damageScale: 0.48`, `cooldown: 0.78`, `spread: 0.24`, three initial flames, five at rank 4, pierce at rank 7 | All ranks. Preserve the close-range shotgun and large-target advantage. Distant small-target damage remains an intentional weakness. |
| Squirtle, Wartortle; IDs 7–8 | Retain `damageScale: 0.9`, `cooldown: 0.9`, projectile schedule 1/2/3 at ranks 1/5/8 | All ranks. Their opening and middle evolution do not need the final-form nerf. |
| Blastoise; ID 9 | `damageScale: 0.9 → 0.75`; projectiles `3 → 1` initially, `4 → 2` at rank 5, `5 → 3` at rank 8 | Remove the special `+2` projectile override. Keep the family splash radii of 0.9 initially, 1.6 at rank 2, 2.3 at rank 8. Keep 0.9s cooldown. |
| Caterpie, Metapod, Butterfree; IDs 10–12 | `cooldown: 1.05 → 0.95` | All ranks. +10.53% direct throughput with the same guaranteed slow, piercing and later stun. |
| Pidgey, Pidgeotto, Pidgeot; IDs 16–18 | Add explicit `element: 'flying'` where currently absent | All ranks. Numeric neutral damage stays the same. Flying gains the existing 1.6× matchup against Grass, Fighting and Bug, subject to the shared type multiplier cap. |
| Pikachu; ID 25 | Retain primary parameters | Reliable chains, 105.6 opening HP and Run-up already make a useful opening. Change Q below. |
| Raichu; ID 26 | Add `damageScale: 1.15`, replacing inherited 1.0 | All ranks. +15% direct damage, including chain hits. Keep chain count, falloff, stun and movement. |
| Sandshrew, Sandslash; IDs 27–28 | `pierce: 15 → 7` | All ranks. One lane initially hits at most eight enemies rather than sixteen. Rank-4/6 extra lanes remain; their shared visited set still prevents duplicate hits. This restrains initial coverage while retaining later coverage growth. |
| Vulpix, Ninetales; IDs 37–38 | Retain `damageScale: 0.65`, 1.65s cooldown and projectile schedule 2/3/4 at ranks 1/3/6 | Apply the foxfire convergence fix first. Do not also compensate for its current missed hits with a damage buff. |
| Zubat; ID 41 | Add `damageScale: 0.95`, replacing inherited 1.15 | All ranks before evolution. Opening direct DPS falls 17.39%. Keep flight and health. |
| Golbat; ID 42 | Retain inherited `damageScale: 1.15` and 0.75s cooldown | All ranks after evolution. Its current final damage is competitive rather than exceptional. The Normal-to-Poison evolution change remains. |
| Oddish, Gloom; IDs 43–44 | Retain primary parameters | Their slow opening pays for healing, poison and control. |
| Vileplume; ID 45 | `damageScale: 0.9 → 0.82` | All ranks after final evolution. −8.89% direct pod damage preserves room for its strong healing/control budget. Keep three-pod progression and Q healing. |
| Meowth, Persian; IDs 52–53 | Retain primary parameters | Reliable coins, distinct-target bounces and strong focused Q form an adequate generalist kit. Distant second-coin misses remain a documented positioning tradeoff. |
| Growlithe; ID 58 | `range: 9 → 7.2`; `damageScale: 1.05 → 0.95` | All ranks before evolution. Resolved opening reach falls 11.25m → 9m; direct DPS falls 9.52%. Retain line sweep, knockback and rank-6 follow-up. |
| Arcanine; ID 59 | Retain `range: 9`, `damageScale: 0.98`, burn and follow-up | All evolved ranks. Keep its existing late primary budget; reduce the shared Q trail below. |
| Abra, Kadabra, Alakazam; IDs 63–65 | Retain primary parameters | High final piercing damage remains its specialty. No extra Shift teleport is added to Kadabra or Alakazam; Q already supplies teleportation. |
| Machop, Machoke, Machamp; IDs 66–68 | `damageScale: 0.6 → 0.55` | All ranks, after truthful combo acquisition. −8.33% complete-combo damage; preserve two/three/four-strike progression and finisher pushback. |
| Gastly, Haunter, Gengar; IDs 92–94 | Replace `pattern: 'haunt'` with no signature pattern; retain `kind: 'aura'`; `range: 8 → 4`; `radius: 0 → 4`; `projectiles: 2 → 0`; `cooldown: 2 → 1.35`; `damageScale: 0.7 → 1.1`; `growth.range: 0.22 → 0.1`; `growth.radius: 0 → 0.1`; explicit `projectilesEvery: 0`, `chainsEvery: 0` | Use the existing owner-centered aura path. Replace all old orbit milestones with rank 2 `status.slow: 0.45`, rank 5 `status.poison: 0.6`, rank 7 `damageScale: 1.2`. Initial status stays poison 0.35/slow 0.3. Remove unused orbit/lifetime/pierce presentation. At rank 8, acquisition and damage radius are both 4.7m. |
| Magikarp; ID 129 | `damageScale: 0.5 → 0.65` | All unevolved ranks. Combine with the base-stat changes below; preserve 1.25s cooldown, one target, Normal element, short reach and Splash leap. |
| Gyarados; ID 130 | `damageScale: 1.22 → 2.4`; inherited `cooldown: 1.3 → 1.15` | All evolved ranks. Retain one Normal piercing beam and current pierce. Raise damage per delivered beam rather than adding overlapping beams or a new proc system. |
| Eevee; ID 133 | Rank-8 projectile milestone `6 → 5` | Rank 8 and above. Keep two initially, three at rank 3 and four at rank 6, plus rank-6 piercing. Optional unevolved play remains viable; the final star breakpoint is slightly smaller. |
| Vaporeon; ID 134 | Same projectile and scale changes as Blastoise: scale `0.9 → 0.75`; projectile schedule `3/4/5 → 1/2/3` at ranks 1/5/8 | All evolved ranks. Retain homing, splash, soak and Tidal Rush. |
| Jolteon; ID 135 | Add `damageScale: 1.4`, replacing inherited 1.0 | All evolved ranks. Keep 0.94s cooldown, chains, 0.81 falloff and Run-up. Instant reliable damage and crowd coverage distinguish it from the other branches. |
| Flareon; ID 136 | `damageScale: 0.48 → 0.5`; `spread: 0.24 → 0.1` radians per fan offset | All evolved ranks. Keep three/five-flame counts, 0.78s cooldown and burn. A narrower fan delivers three flames to the 8m small fixture and five at 3m or against the large boss. |

No changes to global slash bonuses or stage-one ranged penalties are included. Those affect many non-starter species and learned attacks; species-local tuning is the smaller first intervention. The ineffective `growth.damage` field is not used as a balancing knob.

## HP, defense and special attacks

Keep all existing species power, health and defense values except Magikarp. That retains the current broad progression bands: most three-stage starters have 96 starting HP and their finals have 237 HP at level 30; ordinary two-stage starters have 105.6 HP and their finals have 208.56 HP. Gyarados retains 265.44 HP. Do not flatten those budgets while tuning attack delivery.

In `src/data/kanto.ts`, change the explicit ID-129 overrides:

| Stat | Current → proposed | Practical effect |
| --- | --- | --- |
| Power | `4 → 7` | Signature base before profile multipliers changes from 13 to 16. Learned moves have their own base power; this is not a universal learned-move buff. |
| Health factor | `0.7 → 0.85` | Starting leader HP 67.2 → 81.6, still below the ordinary 96-HP budget. |
| Defense | `0.5 → 0.8` | A raw 20-damage hit becomes 19.2 instead of 19.5. Effective HP against repeated 20-damage hits rises from about 68.92 to 85.00 together with the HP change. |

Do not change Gyarados's health factor of 1.75. Evolution should continue scaling current/max HP by the destination/source factor: the ratio becomes `1.75 / 0.85`, about 2.059, instead of 2.5. The evolved absolute health budget stays the same, and evolution preserves the pre-evolution health fraction.

Flat defense is a poor substitute for fixing failed attack delivery. For example, adding 0.2 defense reduces a raw 20-damage hit by only 1%; small fast hits benefit more. Broad defense buffs would change enemy-hit-size relationships without addressing the roster's main damage and reliability issues.

Implement the following in `src/data/specials.ts`. Keep **16s base cooldown**, rank growth, invulnerability and current controls for every special.

| Q family | Exact change | Measured or calculated outcome |
| --- | --- | --- |
| Pidgey/Pidgeotto/Pidgeot Whirlwind | Add explicit `element: 'flying'` | Neutral damage unchanged. Matchups become consistent with Gust. |
| Pikachu/Raichu/Jolteon Thunder Circuit | `damageScale: 1.05 → 1.4` | Probe: Pikachu's isolated-target cast 33.6 → 44.8; Raichu/Jolteon level-30 rank-8 isolated cast 106.84 → 142.45. Each enemy is still hit once; a bigger coefficient also buffs crowd damage by 33.33%. |
| Growlithe/Arcanine Flame Charge | Trail `damageScale: 0.55 → 0.45` | Probe: opening ideal full path 120 → 104; Arcanine normalized full path 482.60 → 411.37. The initial dash uses a separate scale of 1 and remains intact. |
| Magikarp Flail | `damageScale: 0.28 → 0.4` | Probe at full HP: 17.92 → 25.6. Calculated at half HP: 35.84 → 51.2; near-zero-HP limit: 53.76 → 76.8. The existing linear missing-health multiplier stays unchanged. |
| Gyarados Hyper Beam | `damageScale: 3.2 → 4` | Probe: normalized cast 325.61 → 407.01, a 25% increase. |
| All other Q abilities | Retain current authored values | Keep Bulbasaur's garden, Charmander's sustained cone, Squirtle's Surf, Caterpie's Electroweb, Sandshrew's fissures, Vulpix's protective ring, Zubat's wings, Oddish's healing cloud, Meowth's focused strikes, Abra's teleport, Machop's flurry, Gastly's curse, Eevee's dash and the other branch specials. |

No new healing is added to Absorb, Leech Life or any other attack solely because of its name. Oddish retains its actual Q healing: 10.5 HP per living member at rank 1 and 35 at rank 8 before overheal and healing suppression. Keep movement traits, shared movement speed and dodge values unchanged; they already provide meaningful budget differences.

## Resulting direct damage in controlled fixtures

These are **probe results**, apart from the explicitly conditional foxfire expectation and the corrected combo-range interpretation. Starting values are level 1/rank 1. Final values are level 30/rank 8, including the existing additive evolution power. Values exclude learned attacks, critical hits, damage over time, matchups and items.

| Starter | Current → proposed DPS at 3m | Current → proposed DPS at 8m | Main retained advantage or cost |
| --- | --- | --- | --- |
| Bulbasaur | 27.63 → 25.00 | 27.63 → 25.00 | Instant piercing lanes and persistent garden |
| Charmander | 33.97 → 33.97 | 11.32 → 11.32 | Close overlap, burn and cone Q |
| Squirtle | 16.00 → 16.00 | 16.00 → 16.00 | Homing, soak and emergency displacement |
| Caterpie | 13.41 → 14.82 | 13.41 → 14.82 | Guaranteed slow and strong electric Q |
| Pidgey | 13.75 → 13.75 | 13.75 → 13.75 | Flight, piercing and knockback; now Flying damage |
| Pikachu | 20.43 → 20.43 | 20.43 → 20.43 | Instant chains, Run-up and stronger Q |
| Sandshrew | 20.87 → 20.87 | 20.87 → 20.87 | Burrow and wide front; opening 12-enemy fixture falls 250.43 → 166.96 |
| Vulpix | 15.13 → 15.13 | 15.13 → 15.13 | Convergence repair addresses later reliability |
| Zubat | 46.00 → 38.00 | 0 → 0 | Still strongest opening close DPS, with flight |
| Oddish | 11.31 → 11.31 | 11.31 → 11.31 | Healing, poison and control justify low raw DPS |
| Meowth | 20.27 → 20.27 | 20.27 → 20.27 | Accurate first coin and focused Q |
| Growlithe | 27.39 → 24.78 | 27.39 → 24.78 | Broad instant bite and repositioning Q |
| Abra | 17.42 → 17.42 | 17.42 → 17.42 | Long piercing cross and teleport |
| Machop | 34.74 → 31.84 | 0 → 0 | Close multi-hit scaling; corrected acquisition |
| Gastly | 16.10 → 18.74 | 0 → 0 | Full nearby disk coverage replaces ring positioning |
| Magikarp | 6.50 → 10.40 | 0 → 0 | Remains a weak short-range challenge; better eventual reward |
| Eevee | 25.60 → 25.60 | 25.60 → 25.60 | Accurate seeking stars and branch choice |

| Final form | Current → proposed DPS, small target at 8m | Proposed complete close/boss damage where different | Interpretation |
| --- | --- | --- | --- |
| Venusaur | 516.85 → 467.62 | Same | Still excellent lane coverage |
| Charizard | 243.76 → 243.76 | 731.27 close/boss | Broad fan rewards overlap |
| Blastoise | 1,870.49 → 935.24 | Same | Remains strongest reliable small-target ranged signature in this package |
| Butterfree | 285.03 → 315.03 | Same | Control and Electroweb carry much of its budget |
| Pidgeot | 306.08 → 306.08 | 918.24 boss | Target size and three wind lanes matter |
| Raichu | 281.93 → 324.22 | Same | Chains and control take priority over lone-boss DPS |
| Sandslash | 223.25 → 223.25 | Same | Deliberately low isolated damage; strong front and burrow |
| Ninetales | 0 → **430.65 conditional** | Existing boss probe is 430.65 | Calculated if all four repaired flames reach one small enemy once; shared fix has not been probed here |
| Golbat | 492.07 → 492.07 | Same in this rank's selected-target reach | Flight remains valuable; no healing passive |
| Vileplume | 721.47 → 657.34 | Same | Strong pods plus healing and crowd control |
| Persian | 279.74 → 279.74 | 559.48 close/boss | Second coin depends on geometry |
| Arcanine | 480.35 → 480.35 | Same | Only its Q trail is reduced |
| Alakazam | 775.91 → 775.91 | Same | Strong distant damage, no extra tank stats |
| Machamp | 295.34 → **0 at 8m after range fix** | **1,082.91 inside full combo radius** | Rank-8 complete combo radius is 6.5m without area bonuses. The old distant hit came from the fallback. |
| Gengar | 0 → 0 | **342.31 inside 4.7m aura** | Gain consistent nearby coverage rather than ranged damage |
| Gyarados | 295.34 → 656.78 | Same | High HP, piercing, improved Q and broad learned coverage |
| Vaporeon | 1,366.49 → 683.24 | Same | Reliable water damage and splash remain its strengths |
| Jolteon | 290.74 → 407.04 | Same | Instant chains and Run-up |
| Flareon | 168.18 → 525.57 | **875.95 close/boss** | Narrower fan supplies a reliable middle and rewards closer overlap |

The large reduction in Machamp's *8m fixture* is truthful range enforcement, not loss of its close damage. The candidate probe without the common fix reports a remaining 270.73 fallback DPS at 8m; that value must **not** be used to describe the finished package. Its measured complete-combo value of 1,082.91 is unaffected by clamping acquisition.

Gastly's coverage change is the largest handling change in A. It gives up traveling wisps and their distant ring band, projectile-item compatibility and some multi-enemy orbit coverage. In return, enemies already touching the caster can be hit. Its 12-enemy forward fixture changes only 48.30 → 56.22 at the start and 1,078.28 → 1,026.93 for Gengar, even though the isolated 3m Gengar result rises from zero to 342.31. This is why a previously missed target cannot be described as a meaningful percentage damage buff.

## Why these solutions were selected over alternatives

### Water: fewer authored bubbles plus a modest coefficient reduction

The selected final-form change gives `3/5 × 0.75/0.9 = 0.5` of the current rank-8 direct damage when every bubble lands. It also reduces the base hit stream from five to three projectiles. That matters for on-hit effects and projectile pressure, not just DPS.

Three viable alternatives were considered:

| Alternative | Exact example | Benefit | Cost compared with selected A |
| --- | --- | --- | --- |
| Damage-only nerf | Keep final 3/4/5 bubbles; scale `0.9 → 0.45` | Also halves rank-8 direct damage; preserves spectacle | Keeps high hit counts and on-hit advantage. Earlier ranks are much stronger than selected A relative to its one/two/three-bubble curve. |
| Count-only nerf | Final 3/4/5 → 1/2/3; keep scale 0.9 | Simple; fewer overlapping hits | Rank-8 Blastoise remains 1,122.29 DPS and Vaporeon 819.89. Smaller correction leaves less room for the close-combat specialist. |
| One explosion per target per cast | Keep counts, add shared per-cast victim exclusion | Strongly curbs overlap and splash multiplication | New collision state and item interactions; risks making extra bubbles largely ineffective against bosses. This belongs to a systems redesign, not A. |

Selected A preserves full damage from each bubble that does land. Loaded Dice still has nonlinear value: one extra projectile is a 100% count gain on a one-bubble kit but 33.33% on three bubbles, until existing limits. This package reduces the outlier; it does not make every relic equally valuable for every attack.

### Magikarp: less severe hardship, stronger existing beam payoff

Selected A raises opening signature DPS by 60%, but 10.4 remains below most starters and comes with 81.6 HP, short one-target reach and no independent pre-evolution learned attack. It preserves the personal-level/maturity gate and the player's choice whether to evolve.

The Gyarados beam change multiplies direct signature output by `(2.4/1.22) × (1.3/1.15)`, about 2.224. At 656.78 it is a credible durable carry, while Blastoise is still the more damaging water-family signature at range. Gyarados's primary remains **Normal**, so this comparison does not grant it Water's offensive advantages merely because Gyarados is Water/Flying.

| Alternative | Concrete candidate | Why it was not selected for A |
| --- | --- | --- |
| Preserve maximum opening hardship | Keep current Magikarp stats and damage; apply only Gyarados buffs | Best for an explicitly labeled challenge mode, but still makes the unlock unusually punishing and XP acquisition slow. |
| Reach payoff sooner | Change two-stage Magikarp evolution gate from level 12/240s to a species-local level 10/170s | Changes the duration of the challenge more than its play quality; maturity and level-milestone interactions need separate run data. |
| Add pre-evolution offense | Offer a new independent attack in the first learned slot | Adds content and can change the species' intended identity; it also does not help before the level-10 slot gate without changing progression. |
| Add several evolved beams | Keep scale 1.22, add two or three projectiles | Recreates projectile overlap and proc-count issues seen in water kits. One stronger beam is easier to budget. |

A does not promise Gyarados will dominate every final form. It compensates the remaining hardship with above-standard health, useful damage, piercing and broad post-evolution coverage. If the desired fantasy is a deliberately miserable opening followed by the strongest damage carry, choose a more aggressive package instead of stacking that goal onto A.

### Eevee: preserve branch roles and remove the neutral damage cliff

At level 35, compare Eevee rank 8 with evolved branches at rank 9, including evolution's granted rank and additive power:

| Form | Current 8m small-target DPS | Proposed 8m small-target DPS | Proposed change from unevolved Eevee |
| --- | --- | --- | --- |
| Eevee | 483.07 | 402.55 | Baseline |
| Vaporeon | 1,654.77 | 827.39 | +105.53% |
| Jolteon | 352.08 | 492.91 | +22.45% |
| Flareon | 203.66 | 636.45 | +58.10% |

These are probe results. The same fixed-level comparison was checked at pre-evolution ranks 1–9, 12, 20 and 50; all three branches exceeded unevolved Eevee against this neutral 8m fixture. This does not guarantee every matchup or item build gains damage, and rank 50 is a growth stress case rather than an asserted normal evolution route.

Alternative 1 is to keep six-star Eevee and buff every branch more. That requires stronger Jolteon and further increases branch damage ceilings, while retaining unusually high base-form homing throughput. Alternative 2 is to preserve lower branch boss damage and sell the evolutions entirely through utility; that can be valid only with clear branch previews and a deliberately accepted neutral damage loss. Alternative 3 is to give Jolteon a repeating single-target thunder mechanic; this creates useful boss damage but adds targeting rules and follow-up balance work. A instead uses existing coefficients, fan spread and a smaller final Eevee count breakpoint.

Flareon's narrower fan reduces broad angular coverage. It also makes boss overlap stronger, reaching 875.95 in the normalized comparison. That is an intended offensive identity, but it is a priority for moving-boss and close-contact tests. It receives no new flight, healing or damage resistance to offset that increased output.

## Implementation boundaries and acceptance checks

The tuning portion requires three authored-data files: `rosterContent.ts`, `kanto.ts` and `specials.ts`. Update attack descriptions, milestone text, evolution previews and the relevant tests alongside those edits. Gastly should describe a periodic nearby pulse; Flareon should describe a narrow fan; water milestones should show the actual one/two/three counts; Pikachu's Q must still say that strikes seek different enemies. No new assets are required for the existing aura path, though visual inspection must confirm its radius communicates the new footprint.

The proposal intentionally keeps additive percentage growth uncapped. It changes neither the shared `+20%` damage per signature rank, `+8%` casting-speed growth, `+2%` level multiplier nor additive evolution/build power. Existing structural projectile and effect limits remain technical constraints. New species passives, damage caps and special-case multiplicative growth are outside A.

Apply data changes to leader and follower combat alike. Do not add leader-only damage branches. Followers keep automatic Q casting, their existing health rules and the same learned-move behavior. This matters especially for Gyarados and Vileplume: recruiting them later must not bypass an undisclosed alternate version of their kit.

Before accepting implementation:

1. Re-run the original measurement harness with deliberately updated assertions and versioned candidate output. Preserve the old baseline for comparison. Its existing hard-coded baseline assertions are expected to need review after tuning; deleting assertions to get a green run is not validation.
2. Verify the exact authored schedules and their boundary transitions: water ranks 4→5 and 7→8, Eevee 7→8, Gastly 1→2/4→5/6→7, Machop 2→3/7→8, and every evolution with its granted rank. Include intermediate forms, not only the 36 profiles measured here.
3. Validate Gastly at distances 0, 0.5, 1, 2, 3 and 4m, with enemies in front and behind. Test area bonuses, movement, follower positions, multiple targets and the existing projectile relic eligibility after its pattern change.
4. Validate complete combos just inside and outside the resolved sweep radius at ranks 1, 3 and 8. The selected enemy receives all intended strikes inside; no fallback-only acquisition occurs outside.
5. Validate repaired Vulpix/Ninetales at ranks 5→6 and with large area bonuses, moving/dead targets, several enemy sizes and normal simulation step sizes. Re-measure actual hits before treating the conditional 430.65 expectation as a release result.
6. Verify new Magikarp starting HP, current/max HP scaling on evolution, missing-health Flail, follower health treatment and an unchanged Gyarados final health budget.
7. Test extra projectiles, attack speed, on-hit procs, multiple relic copies, soak/electric interactions and the projectile cap. Smaller authored counts create more headroom for relic growth; base DPS alone does not characterize these builds.
8. Run starter/special/progression/movement/build tests and the full repository test suite after implementation. Check deterministic replay of the same seeds, bounded projectile/effect counts and finite positive damage at ranks above 8.
9. Play matched runs with novice and experienced movement on both maps. Log first-three-minute damage/HP losses, XP and first evolution times, boss damage, learned moves, party composition and deaths. Compare like builds and gates. Do not infer survival changes from this stationary harness.

Initial playtest priorities are Magikarp's ability to reach evolution, Gastly's all-around safety, Flareon's concentrated fan and whether repaired Vulpix feels competitive. Reconsider numbers when those tests show a consistent problem; do not automatically bring every starter to the same single-target DPS.

**Tradeoff:** A has the smallest engine scope and uses measurable existing mechanics, but several identities remain intentionally uneven. Sandshrew still struggles against isolated bosses, Caterpie still wins through control, Charizard remains target-size dependent, and Gyarados is a durable carry rather than the universal damage champion. If those tradeoffs are undesirable, the stronger alternative is a kit redesign rather than another round of coefficient equalization.
