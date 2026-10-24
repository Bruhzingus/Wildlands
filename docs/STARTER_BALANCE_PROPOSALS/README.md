# Starter balance proposals: three concrete alternatives

**October 24, 2026. These are design proposals, not applied gameplay changes.** They expand the [starter audit](../STARTER_BALANCE_AUDIT.md) into exact changes for all 17 starters, their intermediate forms, and all 19 final forms, including Eevee's branches.

**My recommendation is Option B as the design direction:** give the starters clearer strengths and costs, repair the largest scaling problems, and add a few useful behaviors where the current kit needs them. Choose **A** if the priority is a smaller implementation using existing mechanics. Choose **C** if the priority is rebuilding the combat rules so future species and upgrades are easier to balance. C is a substantially larger project with a different overall damage scale.

These are alternative packages. Apply the common correctness work, then select one package's numbers and rules. They are not three layers of buffs to combine.

## The documents

| Document | What it supplies |
| --- | --- |
| [Common fixes](COMMON_FIXES.md) | Exact foxfire convergence rule, truthful combo range including echoes, effect-aware relic eligibility, and consistent attack-kind synergies |
| [A: tune existing kits](OPTION_A_TUNING.md) | Current-to-proposed attack/stat/Q values, every family, measured candidate profiles, and alternatives for water, Magikarp and Eevee |
| [B: strengthen distinct roles](OPTION_B_IDENTITIES.md) | Exact HP/defense/offense budgets, four targeted attack-rule changes, individual recipes, and four optional new abilities with costs |
| [C: rebuild damage budgeting](OPTION_C_SYSTEMS.md) | Full-cast formulas, 45 species rows, all 41 learned-move coefficients, proc/relic rules, new defense model and versioned migration |
| [Evidence and validation](EVIDENCE_AND_VALIDATION.md) | Why raw DPS is insufficient, upgrade opportunity costs, Q/defense/progression analysis, build interactions and a staged acceptance plan |

## What actually needs balancing

The largest problem is **how often a full damage packet can hit the same enemy**, rather than just a species' power stat. Blastoise's five homing splashes multiply already substantial rank, evolution and cadence scaling. Meanwhile, chain attacks spend their extra hits on different enemies, and flame fans miss small distant targets. Equal per-projectile numbers would preserve these inequalities.

There are also different kinds of weakness. Magikarp is too frail and slow at earning its payoff. Gastly's ring leaves an inner dead zone. Vulpix has a genuine upgrade regression. Machop's displayed acquisition can exceed its complete combo reach. Thunder's unused crowd strikes do nothing against a lone boss. These deserve different solutions.

Health, movement and utility are real budgets. Flight, burrow, healing, reliable long range, soak and crowd displacement cannot all be free additions to the highest-damage kit. Each proposal states what is retained, what changes and what pays for an addition. None assumes cartridge abilities, defensive type resistance or flight merely from a Pokemon's name or typing.

## Side-by-side choice

| Decision | A: existing mechanics | B: distinct roles — recommended | C: common damage budgets |
| --- | --- | --- | --- |
| Main goal | Remove the worst outliers with a smaller patch | Make each starter's strengths and weaknesses more deliberate | Make delivery, progression and upgrade value consistent across future content |
| Water overlap | Blastoise/Vaporeon 3/4/5 bubbles become 1/2/3; scale .9 becomes .75 | 2/3/4 bubbles for final forms; first hit full, repeats 25%, one ordinary hit-proc opportunity per target/cast | Native bubbles divide one authored cast budget; extra relic projectiles add explicit 20%-budget packets |
| Squirtle identity | Current safety and soak, less extreme final damage | More HP/defense; soak and splash support with lower repeat-hit damage | Authored tank/support budget with conserved native damage |
| Gastly | Replace wisps with the existing full-disk aura | Retain wisps; add a weak inner pulse, reduce wisp damage and HP | Wisps guard briefly, then home; replace ring-only targeting |
| Thunder Q | Raise coefficient 1.05 to 1.4; still distinct targets | Prioritize new enemies, then allow two 60% repeat strikes without repeat stun | Separate focused and crowd portions with explicit total budgets |
| Fire fans | Keep Charmander; narrow Flareon's fan | Stronger aimed core and weaker side flames | Explicit central/flank shares of the cast budget |
| Gyarados | One stronger, faster beam and stronger Q | Two converging beams, stronger Q, reduced tank stats | High mature budget with a visible beam windup and Water Tidal Lance Q |
| Eevee branches | Reduce final Swift star count; tune branch damage/spread | Give branches separate HP, mobility and offensive budgets | Normalize mature progression and author explicit branch delivery budgets |
| Movement | Current traits | Evolved Abra retains teleport dodge; Sandslash retains burrow recharge cost; faster Jolteon Run-up | Mostly current traits; Gyarados's windup adds a movement tradeoff |
| Defense model | Existing flat subtraction | Existing flat subtraction, different species values | Armor and deflection ratings with explicit formulas |
| Added runtime complexity beyond common fixes | Small: reuse existing aura and tune data | Moderate: cast/target ledgers, hit-event permissions and a few reusable attack features | Large: damage/proc accounting, all friendly moves, resource saturation and old/new run versions |
| Biggest remaining risk | Item and hit-count advantages remain uneven | Bubble bookkeeping and proc handling; some specialist outliers remain | Encounter pacing changes, migration cost and bounded-state implementation |

## Concrete numerical comparison

The table below compares **neutral primary DPS against a stationary small enemy at 8m, level 30/rank 8**, with no learned attacks, crits, DOT, items or team bonuses. A/B include the current earned evolution-power grants; C replaces those grants with its authored form multiplier. That is an intentional system difference.

**Current values are measured. A values come from an isolated production-geometry probe. B/C values are formula projections under their proposed delivery rules.** New mechanics have not been implemented or measured. The common fixes are not included in A's probe; none of the rows below depends on the foxfire/combo corrections.

| Final form | Current | A | B | C |
| --- | ---: | ---: | ---: | ---: |
| Blastoise | 1,870 | 935 | 655 | 369 |
| Gyarados | 295 | 657 | 702 | 554 |
| Vaporeon | 1,366 | 683 | 505 | 369 |
| Jolteon | 291 | 407 | 422 | 400 |
| Flareon | 168 | 526 | 359 | 392 |

This table is not an overall tier list. For example, B's Flareon reaches about **717 close DPS**, while B's Machamp reaches about **984 inside its combo radius**. C's lower signature figures accompany different Q and learned-move budgets. A stationary comparison also misses HP, incoming damage, crowd control and the time needed to reach evolution.

| Defensive comparison at L30 | Current HP | A HP | B HP | C HP |
| --- | ---: | ---: | ---: | ---: |
| Blastoise | 237.0 | 237.0 | 272.6 | 283.1 |
| Gyarados | 265.4 | 265.4 | 242.7 | 303.4 |

C also changes mitigation, so its HP is not directly equivalent to A/B effective durability. B specifically moves Blastoise toward a tank role and pays for Gyarados's beam improvement with some of its unusually high defensive budget.

Magikarp's proposed openings illustrate the different philosophies:

| | Current | A | B | C |
| --- | ---: | ---: | ---: | ---: |
| Starting leader HP | 67.2 | 81.6 | 81.6 | 80.0 |
| Full delivered primary DPS | 6.5 | 10.4 | 14.3 | 10.0 |
| Effective starting reach | 3.375m | 3.375m | 4m | 3.5m |

All retain optional evolution and the current maturity gate. A preserves more opening hardship. B makes the opening more playable and gives a clear attack payoff. C preserves a challenge opening while making Gyarados one of the highest-budget mature attackers. None relies on receiving a lucky learned move to make Gyarados useful.

## What each starter receives

The detailed documents contain exact coefficients and evolution inheritance. This overview makes the differences easier to scan.

| Starter family | A | B | C |
| --- | --- | --- | --- |
| Bulbasaur | Shorter, slightly weaker vine | Larger reach/tempo reduction; keep Garden role | Explicit focused/crowd lane budget |
| Charmander | Keep shotgun behavior | Better central flame; same three-hit close total | Strong focused core and separately budgeted flanks |
| Squirtle | Reduce final bubble multiplication | Tank stats and diminished repeated bubble damage | Conserved bubble budget, tank role |
| Caterpie | Faster primary | Stronger primary paid for by weaker Electroweb | Control budget, tougher Metapod, explicit Q allocation |
| Pidgey | Flying primary/Q element | Flying element and modest primary buff | Flying lanes with restrained overlap and clear crowd budget |
| Pikachu | Stronger Q coefficient; modest Raichu buff | Lower HP, stronger primary, useful boss Q repeats | Fixed chain and Q target budgets |
| Sandshrew | Lower opening lane target capacity | More armor, lower damage/coverage, recharge cost on both forms | High armor rating, controlled secondary damage, focused Fissure hit |
| Vulpix | Delivery fix; no compensating damage buff | Delivery fix; preserve distinct primary/Q behavior | Short orbit then homing; more dependable ranged Q |
| Zubat | Lower initial slash damage | Lower primary/HP, stronger close Q | Lower opening damage and explicit flight-versus-defense cost |
| Oddish | Slight Vileplume damage trim | Smaller later pod coefficients, slower Q, slightly more HP | Support budget and once-per-Q percentage healing |
| Meowth | Keep current kit | Accurate twin coins, slightly slower cadence | Whole-cast ricochet budget and stronger focused Q |
| Growlithe | Shorter/weaker opening; weaker Q trail | Shorter family reach and lower trail damage | Explicit bruiser lane and passage/trail budgets |
| Abra | Keep current kit | Less HP/range/Q damage; teleport dodge survives evolution | Frail long-range artillery budget |
| Machop | Slight damage trim and truthful reach | More HP/armor, lower peak damage, truthful reach | Explicit close-combat budget and normalized combo hits |
| Gastly | Existing aura replaces ring | Weak inner pulse plus lower-damage outer wisps | Guard-then-home delivery |
| Magikarp | Modest opening relief, stronger single Gyarados beam | Larger opening relief, paired Gyarados beam | Challenge opening, normalized high mature payoff |
| Eevee | Smaller final star breakpoint and branch tuning | Distinct defensive/mobility/offense prices for each branch | Shared mature progression with distinct water/chain/fire delivery |

## New abilities worth considering

I would not add a passive to every species. Many already have a complete identity through Q, movement, status or geometry. B's recommended additions solve identifiable kit problems and use the existing controls.

Four optional experiments are fully specified in [B's optional ability section](OPTION_B_IDENTITIES.md#optional-new-ability-candidates-excluded-from-the-recommended-package). They are excluded from B's default figures:

| Optional addition | Exact core benefit | Cost |
| --- | --- | --- |
| Golbat Leech Bite | First native primary hit when ready heals self for 2% max HP; 4s internal cooldown; suppressed by Famine | Golbat raw primary scale 1.10 to .95 |
| Gyarados Intimidating Emergence | Evolution applies 2.5s slow within 7m, once | Q raw scale 3.6 to 3.2 |
| Charizard Short Flight | Reuse current flight for 1s, with 4s recharge | Charizard health factor 1.5625 to 1.40625 |
| Meowth/Persian Pay Day | One extra value-1 coin pickup on an eligible primary kill, at most once per 20s per owner | Raw primary scale .95 to .85 |

These include ownership, evolution, cooldown, stacking and save rules. Start with **Golbat drain or Charizard flight** if adding a new species trait is a priority: their benefits are easy to read and their costs are direct. Treat coin generation as a separate economy experiment; it can buy more supply-chest upgrades even when its combat DPS is lower. The one-time Gyarados slow is a transformation flourish and cannot replace adequate sustained damage.

## Why I recommend B

B addresses more than a ranking. Squirtle becomes deliberately durable; Machop pays for melee commitment with better defenses; Abra stays fragile but keeps its movement identity after evolving; Gastly gains contact coverage without losing its ring; Thunder becomes useful against a lone boss; and Eevee's branches have different costs rather than one overwhelming damage winner.

Its implementation still needs care. Native repeat hits must retain kill credit without repeatedly triggering hit-based relics. Cast identities must survive projectile merging and save/load. The documents specify those contracts. B's remaining Pidgeot boss overlap, multi-healer sustain and high-rank proc builds need explicit validation before the proposed values can become shipping values.

A is the practical alternative when implementation scope matters more than those richer identities. Its data-only candidate has already been exercised through existing geometry. Its compromises are visible: Gastly becomes a simpler aura, Thunder stays mainly a crowd special, and projectile relic value remains uneven. That is a valid smaller release, not evidence that it solves every long-term balance concern.

C offers the strongest structural foundation, but changes combat progression, relic value, defense and many learned moves together. It still requires v2 budgets for recruitable nonstarter species and a proven bounded representation for high-cadence casts. Its large Blastoise reduction also demands full-run encounter tuning. I would keep it as an experimental branch until those requirements are solved.

## Recommended implementation sequence

1. Land the shared corrections independently and regenerate the baseline.
2. Implement the selected package as one coherent candidate. If moving from an A experiment to B later, replace A's values with B's specification rather than accumulating both sets of changes.
3. Validate exact damage, target/proc semantics, HP/evolution ratios and snapshots. Compare intermediate forms and realistic item/learned-move choices.
4. Run matched seeds and human sessions using the [validation plan](EVIDENCE_AND_VALIDATION.md), then adjust named coefficients against the observed role outcomes.
5. Evaluate an optional new ability separately after the base package is stable.

Current verification covers the original audit, A's isolated profile probe, and arithmetic/coverage checks on these documents. It does not establish that B or C is implemented or that any proposal has balanced human win rates. Gameplay files were not changed by this proposal work.
