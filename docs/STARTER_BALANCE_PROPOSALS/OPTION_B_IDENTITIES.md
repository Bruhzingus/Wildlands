# Option B: distinct roles with a few targeted kit changes

**Proposal only, October 24, 2026. No proposed gameplay changes have been implemented or playtested.** Baseline measurements come from [the starter audit](../STARTER_BALANCE_AUDIT.md) and [its measurement tables](../STARTER_AUDIT_DATA.md). Numbers below are implementation candidates and arithmetic estimates, not new simulation results.

Choose this package if starters should feel noticeably different in survivability, preferred distance, control and evolution reward. This is a complete alternative balancing package; do not apply its numbers on top of another option. Apply the [shared correctness fixes](COMMON_FIXES.md) first: safe Vulpix convergence, truthful combo acquisition, effect-aware relic eligibility and consistent resolved attack-kind synergies. This document specifies everything beyond those fixes that belongs in B. The [comparison](README.md) and [shared evaluation protocol](EVIDENCE_AND_VALIDATION.md) place it alongside the other packages.

The main additions are a small inner damage pulse for Gastly, useful repeat strikes for Thunder Circuit, and a paired Gyarados beam. Other changes primarily reuse existing patterns. There is no new universal ability system, no extra button, no required timed input, and no extra persistent progression currency.

## Design contract

- Keep the current deterministic simulation, shared XP, optional evolution choices, recruitment rules, finite starter unlocks, evolution maturity requirements and normal milestone cadence.
- Keep uncapped percentage damage/speed/stat training. Existing finite projectile/pulse limits and finite mechanical milestones remain; these are separate from percentage growth.
- Keep the current outgoing type chart, incoming damage formula, critical system, learned-move slot gates and learnsets. Do not import canonical Pokemon abilities or immunities implicitly.
- Keep current level/rank damage multipliers, evolution power bonuses and stage/slash/ranged profile multipliers. Each tuning value below is a **raw authored value before those multipliers**, unless explicitly called resolved or measured. Do not multiply the proposals into the raw profile a second time.
- Use `getSpecies()`'s resolved power, not an unclamped row in `rosterContent.ts`, for budgets. For example, Pikachu resolves to power 15 and Venusaur to 25.
- Primary and Q changes apply equally to a leader and a recruited follower of that species. Q is manually cast by the leader and automatically cast by followers using current rules. Movement traits benefit the controlled leader; they do not grant a new follower aura or automatic dodge.
- Every unspecified field retains its current value. Every unspecified Q has its current 16-second base cooldown, rank scaling, duration, status rules, and at least 0.4 seconds of caster invulnerability. No added passive is implied by a species name.
- On evolution, retain current XP/rank/evolution bonuses and current/max-HP ratio behavior. Read the new species' health/defense/profile values. Ongoing attacks retain their cast-time profile; new casts use the evolved profile. No cooldown reset or free extra cast is granted by these proposals.

The intended ordering is a budget, not a universal DPS target: specialists with little range can retain about 1.5-2 times a generalist's useful single-target output; wide control/support kits can sit below it. Safety, healing, guaranteed targeting, cast delay and reliable multi-target delivery must be paid for. Starting strength and evolved strength are evaluated separately.

## Exact species stats

Values in each cell follow the named evolution order. These are **final resolved species stats** to encode with explicit overrides after the existing band calculation. Do not modify global stage bands to achieve them. The leader starts at `96 * health`; followers continue to use their existing HP formula with the same species health factor. Defense remains flat subtraction, not a percentage.

| Family / order | Power | Health factor | Flat defense | Starting leader HP | Decision |
| --- | --- | --- | --- | ---: | --- |
| Bulbasaur / Ivysaur / Venusaur | 11 / 18 / 25 | 1 / 1.25 / 1.5625 | 1.76 / 2.06 / 2.35 | 96 | Keep all species stats |
| Charmander / Charmeleon / Charizard | 14 / 19 / 27 | 1 / 1.25 / 1.5625 | 1.70 / 2.00 / 2.27 | 96 | Keep all species stats |
| Squirtle / Wartortle / Blastoise | 11 / 18 / 25 | 1.15 / 1.4375 / 1.796875 | 2.20 / 2.50 / 2.80 | 110.4 | Tank budget in exchange for lower evolved burst multiplication |
| Caterpie / Metapod / Butterfree | 13 / 18 / 25 | 1 / 1.25 / 1.5625 | 1.72 / 2.02 / 2.31 | 96 | Keep all species stats |
| Pidgey / Pidgeotto / Pidgeot | 12 / 18 / 25 | 1 / 1.25 / 1.5625 | 1.74 / 2.04 / 2.33 | 96 | Keep all species stats |
| Pikachu / Raichu | 15 / 23 | 1 / 1.25 | 1.88 / 2.14 | 96 | Pay for mobility, slightly stronger primary and useful boss Q |
| Sandshrew / Sandslash | 15 / 22 | 1.1 / 1.375 | 2.30 / 2.60 | 105.6 | Defensive ground controller |
| Vulpix / Ninetales | 15 / 24 | 1.1 / 1.375 | 1.90 / 2.12 | 105.6 | Keep stats; repair delivery before further buffs |
| Zubat / Golbat | 15 / 22 | 1 / 1.25 | 1.90 / 2.16 | 96 | Flight skirmisher trades some early damage/HP |
| Oddish / Gloom / Vileplume | 13 / 18 / 25 | 1.05 / 1.3125 / 1.640625 | 1.72 / 2.02 / 2.31 | 100.8 | Slightly sturdier support; restrained later pod multiplication |
| Meowth / Persian | 15 / 23 | 1.1 / 1.375 | 1.88 / 2.14 | 105.6 | Keep stats |
| Growlithe / Arcanine | 15 / 24 | 1.1 / 1.375 | 1.88 / 2.12 | 105.6 | Keep stats; pay for escape and reliable lane damage through attack tuning |
| Abra / Kadabra / Alakazam | 12 / 18 / 25 | 0.9 / 1.125 / 1.40625 | 1.74 / 2.04 / 2.33 | 86.4 | Frail family that retains teleport dodge |
| Machop / Machoke / Machamp | 13 / 18 / 25 | 1.1 / 1.375 / 1.71875 | 2.20 / 2.50 / 2.80 | 105.6 | Durable close fighter; lower peak combo damage |
| Gastly / Haunter / Gengar | 14 / 19 / 26 | 0.9 / 1.125 / 1.40625 | 1.70 / 2.00 / 2.29 | 86.4 | Reliable inner coverage pays with HP and weaker outer wisps |
| Magikarp / Gyarados | 6 / 29 | 0.85 / 1.6 | 1.00 / 2.30 | 81.6 | Smaller early hardship, stronger evolved native attack, less extreme evolved durability |
| Eevee | 15 | 1.1 | 1.88 | 105.6 | Keep base stats |
| Vaporeon | 24 | 1.5 | 2.40 | — | Durable homing splash branch |
| Jolteon | 24 | 1.2 | 1.90 | — | Fragile mobile chain branch |
| Flareon | 24 | 1.35 | 2.00 | — | Intermediate durability; close fire burst |

For perspective, the proposed Squirtle has about `110.4*20/(20-2.2) = 124.0` effective HP against repeated raw 20-damage hits, versus the present approximately 105.3. Proposed Machop has about 118.7 versus 105.0. Abra drops to approximately 94.6 from 105.1. These are simple hit-size examples; immunity windows, hazards, healing and overkill prevent treating them as survival forecasts.

## Four shared behavior specifications within B

### B1. Bubble volleys spend a per-target damage budget

**Scope:** only the authored `bubble-stream` signatures for Squirtle, Wartortle, Blastoise and Vaporeon. Do not silently apply this rule to all lobbed attacks, learned Water Pulse or other species' projectiles.

Each automatic cast receives a unique, deterministic `castId`. Against each enemy, the first connected bubble explosion deals 100% of its normal direct damage; every subsequent bubble explosion from that same cast deals **25%**. It is a flat quarter for every repeat, not exponential falloff. An explosion touching several enemies evaluates their ledgers independently. A missed bubble does not consume anyone's budget. Separate casts, even from the same owner, start fresh budgets.

For equal-damage bubbles, a single target hit by `n` bubbles receives `D * [1 + 0.25*(n-1)]`. Four bubbles therefore give 1.75 hits of direct damage, instead of four. This rule remains at all ranks and with extra-projectile relics. Damage, attack speed and other percentage upgrades continue scaling normally.

The first connected hit against each enemy can trigger normal on-hit relic effects. Repeats retain their critical multiplier, damage attribution and soak refresh, but do not advance on-hit/on-crit counters or generate a second Metronome/King's Rock opportunity. Capture the Metronome multiplier returned for that cast-target's first hit and reuse it for the quarter-damage repeats without advancing or resetting the shared streak. Cast-based items still count one cast. Secondary damage generated by an allowed first hit uses existing recursion rules; it is not itself inserted into the bubble ledger.

Do not implement this by setting the current combined `allowProcs=false` flag alone: that also removes Metronome damage and suppresses ordinary lethal-hit effects in `killEnemy`. Split permission to advance hit/crit effects from permission to dispatch the one legitimate death event. A native repeat that kills an enemy still receives normal kill credit, XP/loot and eligible on-death effects once; proc-created attacks retain their existing recursion restrictions. Store the captured Metronome multiplier with the cast-target ledger for save/resume. Use the same distinction for B2 lightning repeats.

Blastoise and Vaporeon use **2 / 3 / 4** projectiles at ranks **1 / 5 / 8**. Squirtle and Wartortle retain **1 / 2 / 3**. Keep existing splash-radius milestones: 0.9 initially, 1.6 at rank 2, 2.3 at rank 8. Set bubble `pierce=0` and remove misleading piercing text; explosions terminate on their first impact. Extra piercing is useful only if another current attack actually consumes it. Extra bubbles still improve coverage, redundancy and boss damage and remain eligible.

**Ownership/lifetime:** the budget belongs to the cast, not to the species or the whole party. Store target hit counts until every logical projectile from that cast has resolved or expired. Preserve it across a suspend/restore. A newly evolved owner does not reset a flying volley's ledger. Do not use wall-clock time, target array order or rendering events to assign IDs or choose full-damage hits; resolve equal-time impacts by stable projectile UID and enemy UID.

**Projectile-pool requirement:** the existing `addProjectile` pool can merge repeated friendly casts into one stream. A visual stream must not erase this rule. Never merge different `castId`s into one logical damage contribution; never collapse `hitCount=n` into one budget lookup. Each contribution must retain cast identity and be resolved as its logical hits. Same-cast merged hits consume `1, .25, .25, ...`; two separate casts each retain their own first full hit. Do not fold cast identity into the existing 32-source attribution overflow bucket: damage attribution may aggregate independently, but combat budgets cannot. A safe implementation can separate bounded visuals from logical contribution records. Simply disabling all merging and dropping projectiles at the current pool cap is not an acceptable balance implementation: attack-speed upgrades must continue adding attacks under the existing overflow policy. Stress and snapshot tests are a release requirement.

**Why choose this over a flat damage nerf?** Halving the entire family would make one-bubble Squirtle worse and preserve disproportionate projectile relic scaling. Keeping only one bubble would remove the visible evolved identity. This keeps several splashes and their crowd coverage while controlling stacked damage and procs on one enemy. It is the highest implementation cost in B and can be postponed only by postponing the entire B package's water-family tuning.

### B2. Thunder Circuit can finish an isolated target

Apply to Pikachu, Raichu and Jolteon Q. Preserve their current pulse counts, rank growth, base damageScale 1.05, ranges, durations and 16-second cooldowns.

On each scheduled pulse, prefer a living in-range enemy never hit by this Q cast. If there is no unhit candidate, select an already-hit candidate with the **fewest hits from this cast**, then nearest distance to the cast origin, then lowest UID. An enemy can take **at most three strikes per cast**. The first deals 100% damage and uses the current guaranteed stun. The second and third deal **60% damage** each and do not apply stun or trigger on-hit procs. If all eligible targets are at their cap, that pulse produces no hit. Newly arriving unhit enemies retain priority on later pulses. Do not recycle spent pulses after the effect ends.

A rank-one Pikachu Q against one stationary surviving target becomes `32*1.05*(1+.6+.6) = 73.92` direct damage, versus 33.6 now. Six distinct enemies still take 33.6 each, totaling 201.6. Two isolated enemies receive three hits each. Rank scaling increases base Q damage and available crowd strikes but never removes the three-strike-per-target ceiling. Repeats reuse their target's first-strike Metronome multiplier without advancing its counter, and retain legitimate native on-death effects as specified in B1. This adds boss usefulness without turning surplus chain targets into unlimited boss multiplication.

Use a per-active-effect count map keyed by enemy UID, serialized as UID/count pairs. Different casters and separate Q casts have separate maps. A follower uses the same targeting rules; there is no leader-only damage bonus. The existing first-hit set may be retained for compatibility, but it is not enough to count repeats. Repeat strikes are visually thinner and have no stun flash.

Alternative rejected: simply let every unused lightning pulse hit the boss for full damage. That would multiply boss Q damage by six or more while preserving every crowd advantage, and it scales too strongly with later pulse milestones.

### B3. Gastly casts a weak inner pulse as well as outer wisps

Keep `haunt` and its owner-following ring. On each primary cast, emit **one immediate Ghost damage pulse** centered on the caster, with radius equal to that cast's **resolved orbit radius**: 3m initially, 4m from rank 2, multiplied by the normal area/range scale that already affects the ring. Use the existing `enemiesInRadius` rule: enemy-center distance is less than or equal to the pulse radius, with no added body-size margin. This closes the entire interior instead of moving a narrow blind spot to another radius.

The pulse uses raw damageScale **0.55**, and each outer wisp uses raw damageScale **0.35** instead of 0.7. Apply the same species stage, personal level, signature rank, power and cast critical multiplier to both. Do not take the already scaled wisp damage and multiply by 0.55 again. The pulse applies **no intrinsic poison or slow**. It may trigger normal on-hit relics once per enemy because it is one actual primary hit. It cannot recursively cast another pulse. The wisps retain their existing poison 35% / slow 30% chances and one-hit-per-enemy-per-wisp sets.

Keep two wisps initially, three at rank 5, four at rank 7; keep 2.2-second wisp lifetime, 2-second base primary interval, orbit speed 3 and current piercing milestones. Existing overlapping casts are separate attacks with separate hit sets. Attack-speed bonuses speed pulse casts and wisp generation together. No separate pulse cooldown, stack, debuff, healing or enemy mark is added.

A level-one enemy wholly inside the ring receives `23*.55/2 = 6.325` direct DPS. A ring-edge enemy hit by the pulse and both wisps can receive `23*(.55+2*.35)/2 = 14.375` before crits/status, versus 16.1 from the present two wisps. The inner pulse offers reliable minimum damage; the ring remains the preferred damage position. Actual wisp contact is still geometry-dependent, so 14.375 is a delivery assumption, not a measurement.

The leader's pulse follows player coordinates; a follower's follows that member. The pulse is instantaneous and needs no persistent per-member state. Wisp state remains per projectile. Gastly, Haunter and Gengar all inherit the behavior. Their 10% HP reduction funds the substantial improvement in contact coverage. Q remains Haunting Hex, including its current delayed damage, poison, slow, range and scaling.

Alternatives rejected: permanent full-damage aura duplicates a different archetype and erases positioning; expanding the ring alone preserves the failure; guaranteed invulnerability or ghost phasing adds a second defensive system. An inward-moving ring is attractive visually but still needs angular coverage tests and can miss a stationary enemy between spokes. The explicit pulse provides a testable minimum.

### B4. Flame fans have a stronger aimed core

Apply only to Charmander, Charmeleon, Charizard and Flareon authored `flame-fan` attacks. Keep the existing fan angles and projectile counts. The index-zero aimed flame has **1.5 times** normal projectile damage; every lateral flame has **0.75 times** normal projectile damage. Relic-added flames are lateral and use 0.75. These multipliers are part of attack construction, before normal per-hit type/critical handling; each connected projectile otherwise retains existing status and proc behavior.

Three connected flames total `1.5+.75+.75 = 3` ordinary flame hits, so a three-flame close hit keeps its previous total. A small distant enemy catching only the center gains 50%. If all five base flames connect after rank 4, the total is 4.5 ordinary hits instead of five. Increasing projectile count still adds positive damage when it connects. No counters, timers, extra RNG or persistent state are added.

This preserves shotgun identity while paying for reliable central damage with weaker wings. Narrowing the entire fan would also raise boss overlap and reduce crowd identity; a flat damage buff would leave the distant small-target problem proportionally unchanged.

## Exact recipes for every starter

### 1. Bulbasaur: ranged lane control

**Keep:** vine pattern, Grass primary, Grass/Poison typing, existing lane/piercing rank milestones, Bramble Garden and all learned moves. **Change:** family raw `range:14 -> 10.4`, `cooldown:.95 -> 1.05`, `damageScale:1.05 -> .84`. Preserve `.4` rank range growth and existing width/radius growth. With the existing slash multiplier, initial effective range becomes **13m**, not 10.4m, and initial neutral primary DPS is approximately **20.0**, from 27.63. This is still a reliable instant lane.

**Add:** nothing. No passive healing, Overgrow or root trigger. Garden keeps five initial pulses over four seconds, damageScale .52, repeated slow and 16-second cooldown. Its existing area support is the identity. Ivysaur and Venusaur inherit all three tuning changes; their higher stats, stage scaling and normal evolution grants remain. The cost of piercing and long reach is a slower, weaker primary.

### 2. Charmander: aggressive fire fan

**Keep:** family raw damageScale .48, cooldown .78, three flames, range 10, rank-4 five flames, rank-7 piercing/burn, Flamethrower Q and existing stats. **Change:** apply B4 aimed-core weighting. Starting expected small-target damage at 8m rises from 11.32 to approximately **16.98 DPS** if the center connects; the three-hit 3m fixture remains approximately **33.97**. Do not claim every rank-4 flame will connect with a small target.

**Add:** no passive and no flight in the recommended package. Charmeleon and Charizard retain the same fan weighting; Charizard keeps ordinary movement even though it has Flying typing. Q retains eight initial pulses over two seconds at .35, guaranteed burn, 13m initial range, and 16-second cooldown. Close overlap, burn and large-target damage remain its rewards. A separately costed optional flight variant appears below.

### 3. Squirtle: durable team enabler

**Keep:** raw bubble damageScale .9, cooldown .9, range 16, homing, guaranteed soak and Surf. **Change:** apply B1; replace Blastoise's +2-projectile advantage with the **2/3/4** projectile schedule, while Squirtle/Wartortle retain **1/2/3**. Apply the explicit tank stats above. No extra attack or shield is added.

Squirtle still starts at **16 DPS**, but has 110.4 HP and 2.2 defense. Blastoise's approximate level-30/rank-8 neutral single-target output falls from 1,870.49 to **654.67**, assuming all four bubbles land and preserving all other audit conditions. Estimated final HP becomes **272.55**, from 237. Surf remains one 2.2-scale hit, soak/slow and 4m initial push over a 23m corridor, with its current rank growth and 16-second cooldown. Followers provide the same soak and damage budget; the health increase does not create a party shield.

### 4. Caterpie: control first, with enough regular damage

**Keep:** thread pattern, guaranteed primary slow, ranks 2/5 piercing and rank-7 45% stun, family stats and Butterfree's existing 1.5-second flight. **Change:** family primary raw `damageScale:.8 -> 1.05`. Q Electroweb raw `damageScale:1.1 -> .8`; keep its five initial projectiles, Electric element, piercing, slow, range 17 and 16-second cooldown.

Starting primary becomes approximately **17.60 DPS** instead of 13.41. Initial Q becomes **76.8** direct damage if three threads connect, or **128** if all five connect, instead of 105.6/176. This transfers budget from an unusually strong occasional electric volley into reliable basic combat. Metapod inherits the primary/Q exchange rather than receiving a separate armor stance; Butterfree inherits it and keeps its broader learnset. **Add:** nothing. Do not add poison, healing or an extra stun proc.

### 5. Pidgey: Flying corridor clearer

**Keep:** primary range 13, cooldown 1.1, piercing, knockback and lane milestones; Whirlwind movement/control values; the family's two-second flight and four-second recharge. **Change:** family primary raw `damageScale:.9 -> 1.0`; explicitly set **Flying** on both signature and Q. Starting neutral DPS becomes approximately **15.27**; type matchup changes must be measured separately.

**Add:** no passive or extra jump charge. The same values apply to Pidgeotto and Pidgeot; keep all stats. The identity remains low focused damage with strong displacement and traversal. The slightly stronger primary is still far below melee specialists. Pidgeot's three-lane overlap can exceed 1,000 neutral boss DPS under the old large-body geometry assumption; that is a release check, not a promise that this aerial controller is balanced already. Whirlwind remains 1.6 scale, one hit per enemy, 19m initial range and 6m initial push; only its element changes.

### 6. Pikachu: fragile mobile chain attacker

**Keep:** existing chain counts, falloff .81, ranges and stun milestones, plus +25% Pikachu / +18% Raichu Run-up. **Change:** raw primary `damageScale:1 -> 1.1` on both forms; apply B2 to Thunder Circuit; use lower HP factors 1 / 1.25 from the stats table. Starting primary becomes approximately **22.47 DPS** and isolated rank-one Q becomes **73.92** damage.

**Add:** useful Q repeat targeting only; no Static aura, new charge meter or attacks tied to manual dodge timing. Raichu retains its reduced Run-up boost and better chains. The family trades approximately 9.1% HP for better damage and boss utility. Its primary still cannot bounce back onto the same boss. Soak partners remain useful and must be tested with the unchanged 35% Electric bonus.

### 7. Sandshrew: armored forward controller

**Keep:** sand-wave pattern, range 9, width 1.7, slow chance .45, extra lanes at ranks 4/6, and all Fissure values. **Change:** family raw `damageScale:1 -> .9`, `cooldown:1.15 -> 1.2`, `pierce:15 -> 5`, so an initial lane hits **at most six enemies** rather than sixteen. Existing extra-pierce bonuses add capacity up to the current engine cap. Shared visited sets still prevent duplicate hits across lanes.

Increase defense to 2.3 / 2.6 as specified. Give **both** forms `staminaRechargeMultiplier:1.3`; Sandslash no longer sheds the original recharge cost. Burrow remains 0.8 seconds at 9m/s with its current invulnerability. Base recharge is therefore 3.64 seconds before shared modifiers. Starting primary becomes **18 DPS**. Fissure retains its five spatial ruptures, .9 initial scale with later-rupture scaling, one-second effect and 16-second cooldown.

**Add:** nothing. Armor, broad slow coverage and burrow already support the role. The trade is lower crowd saturation and damage, particularly before extra lanes, in return for sturdier contact defense. Do not compensate the low single-boss Fissure figure with five overlapping full-damage ruptures; its distributed coverage is intentional in B.

### 8. Vulpix: targeted delayed fire control

**Keep:** all authored stats, raw primary damageScale .65, interval 1.65, range 13, two initial flames, three at rank 3 and four at rank 6, lifetime 1.5, and existing orbit/piercing values. **Change:** only the shared safe-convergence repair before evaluating B. Selected surviving stationary small enemies must remain hittable after rank-6 radius growth and area upgrades. It is not a requirement that every orbiting flame survive unrelated intervening collisions or follow a target outside reach indefinitely.

**Add:** nothing. Ninetales inherits the corrected delivery, not an extra passive. Keep Ninefold Foxfire's owner-centered defensive ring, five initial flames, four-second duration, 1.05 raw damageScale, guaranteed burn and 16-second cooldown. The primary converges on a target; Q guards the caster. Those two behaviors must remain distinct in the description and renderer. Any additional numerical buff waits for corrected rank/area/movement measurements: the prior zero-DPS sample cannot justify a multiplier.

### 9. Zubat: mobile close skirmisher

**Keep:** normal-element Zubat Bite, Golbat's Poison conversion, close sweep geometry, flight 1.5 seconds / four-second recharge, and learned moves. **Change:** family primary raw `cooldown:.75 -> .85`; set raw damageScale **.90 for Zubat** and **1.10 for Golbat**, versus the shared slash archetype's 1.15. Apply HP factors 1 / 1.25. Q Wing Attack raw `damageScale:.75 -> 1.0`; keep two initial pulses over .5 seconds, Flying element, 5.5m range and 16-second cooldown.

Opening primary falls from 46 to approximately **31.76 DPS**, while Q rises from 48 to **64** if both initial strikes connect. Golbat's approximately **415.30** normalized primary DPS remains useful, with flight and Poison status as additional value. **Add:** no life drain in recommended B. Stronger focused Q and a better relative evolved damage coefficient replace the idea of healing on every slash. A bounded drain variant is specified below.

### 10. Oddish: sustain and area support

**Keep:** raw primary damageScale .9 initially, cooldown 1.4, poison/slow, pod travel, all learnsets and Sleep Powder's existing pulse damage/healing amounts. **Change:** rank-4 milestone also sets raw primary `damageScale:.8`; rank-7 milestone sets `.7`. Retain two pods at rank 4 and three at rank 7. Add the 5% health-factor increase listed above. Set family Sleep Powder base cooldown **16 -> 18 seconds**.

Opening damage remains approximately **11.31 DPS**. Under the audit's three-pod delivery assumption, Vileplume's normalized output becomes approximately **561.14**, from 721.47. Sleep Powder still initially damages/stuns/slows over three pulses in three seconds and heals **3.5 HP per pulse per living member** at rank one, totaling 10.5 per member when all pulses occur. Rank growth remains as implemented; the cooldown reduces ideal healing frequency by 11.1%. Multiple Oddish-family casters retain independent existing healing; no shared new stacking multiplier is added.

**Add:** no regeneration aura or drain passive. The current Q already supplies a valuable squad identity. A follower receives the same support behavior, so the extra health and lower later personal damage are not justified solely by leader survivability. Test a multi-healer party before release.

### 11. Meowth: predictable neutral ricochet damage

**Keep:** power/health/defense, raw damageScale .95, speed 23, range 16, ricochet counts/ranges/falloff and Fury Swipes. **Change:** family primary raw `cooldown:.9 -> .95` and explicitly `spread:0`. All emitted coins initially aim at the selected target; after impact each retains its own distinct-enemy ricochet set. Extra coins remain eligible for projectile relics.

This removes the arbitrary rank-8 twin-coin miss at 8m. The initial single-coin attack drops from 20.27 to approximately **19.20 DPS**, paying a modest tempo cost for the stronger later delivery. Persian's two-coin neutral output is approximately **530.03 DPS** both near and far if both first impacts connect. Coin bounces still cannot revisit the same enemy, and coin count is not an economy reward.

**Add:** nothing. Fury Swipes stays three initial 1.1-scale strikes over .6 seconds, a five-strike ceiling, range 7 and cooldown 16, with retargeting on death. Both leader and follower use the same rules. A bounded coin-reward experiment is separate below, because extra in-run chest purchases can make a mandatory farm starter even when combat is balanced.

### 12. Growlithe: shorter fire bruiser

**Keep:** pounce lane, existing rank growth and follow-up bite milestone, HP/defense, normal-element Growlithe and fire-element Arcanine. **Change:** both forms raw `range:9 -> 6.4`, giving **8m initial resolved reach**, and raw `damageScale:.9` instead of Growlithe's 1.05 / Arcanine's .98. Keep cooldown 1.15. Reduce Flame Charge trail pulse raw damageScale **.55 -> .40**; its separate initial pass remains the existing 1.0 base-Q-scale hit.

Starting primary becomes approximately **23.48 DPS**. A stationary rank-one target taking the pass and five trail pulses receives `32*(1+5*.4) = 96` direct Q damage rather than 120, before burn. Keep charge distance 10, trail duration 2.4, initial radius 2, knockback and 16-second cooldown. **Add:** no attack-speed aura, intimidation or teammate buff. Arcanine retains burn, follow-up bite and broad learnset; both forms pay for useful lane delivery and escape through shorter reach and lower damage.

### 13. Abra: fragile teleport artillery throughout evolution

**Keep:** initial two crossing beams, raw damageScale .7, interval 1.35, piercing milestones and current collision-aware teleport handling. **Change:** family raw primary `range:18 -> 16`. At rank 7, retain four beams but also set raw `damageScale:.6`. Apply 10% lower HP factors from the stats table. Add the existing `teleport` movement trait to **Kadabra and Alakazam**, matching Abra's Shift behavior and ordinary stamina recharge.

Reduce Teleport Lance raw damageScale **2.8 -> 2.4** for the whole family; keep range 19, radius 1.3, stun, collision-aware destination and 16-second cooldown. Starting primary remains about **17.42 DPS**, while Q becomes **76.8** direct damage from 89.6 before rank/stage scaling. Estimated final primary is **665.07**, from 775.91.

**Add:** retained teleport dodge on evolution only. It has no separate new cooldown, no retaliation projectile and no damage afterimage. Followers do not gain a free defensive teleport loop from the trait; their Q still uses the existing automatic cast. Abra's lower HP pays for preserving strong repositioning across the family. The shorter range and rank-7 coefficient pay for four reliable crossing lances.

### 14. Machop: sturdy true melee

**Keep:** two/three/four-hit milestones at ranks 1/3/8, current cone, radius growth and final-hit knockback. **Change:** raw family primary `damageScale:.6 -> .5`, alongside the shared acquisition clamp to `min(profile.range, profile.radius)*radiusScale`. Do not give extra reach to recover the old displayed number. Apply the 10% HP and higher defense values from the stats table. Q Close Combat raw `damageScale:1.1 -> 1.0`; retain three initial hits over .65 seconds, initial range 7, finisher push and 16-second cooldown.

Starting full-combo output becomes approximately **28.95 DPS**, from 34.74. Machamp's delivered close-combo estimate becomes **984.47**, from 1,181.36. The higher HP/defense improves time spent safely inside that radius. Initial Q becomes **96** if all three strikes land. **Add:** no stacking armor, block input or execute. Machoke/Machamp inherit the same trade. A target beyond effective sweep range must not be selected just to receive a misleading fallback-only hit; learned ranged moves remain the answer to distant enemies.

### 15. Gastly: ring fighter with inner contact damage

Apply **B3 in full** and the 10% HP reduction from the stats table. Keep all other signature values, Ghost primary, Ghost/Poison typing, ordinary movement and Haunting Hex. The added inner pulse is the only new behavior. It belongs to each primary cast, so leader and follower placement matter equally. No incoming Ghost immunity, heal, fear, dash or invisibility is granted.

At level 30/rank 8 under the audit's evolution assumptions, the estimated guaranteed inner pulse contribution is approximately **105.90 DPS**; a target touched by the pulse and all four wisps could receive approximately **375.47**. These are formula budgets, not a claim that every target receives four wisp contacts. Haunter and Gengar retain the same ring/pulse relationship; rank-2 area growth now expands inner coverage instead of abandoning previously covered inner positions.

### 16. Magikarp: challenge opening with a concrete Gyarados payoff

**Change Magikarp:** resolved power **4 -> 6**, health **.7 -> .85**, defense **.5 -> 1.0**. Tackle raw `damageScale:.5 -> .8`, `cooldown:1.25 -> 1.05`, `range:2.7 -> 3.2`; initial resolved reach becomes **4m**. Keep the one-target tackle pattern and Normal element. Starting primary becomes approximately **14.29 DPS** from 6.5. Keep Splash leap and its existing controls/recharge behavior. No additional learned move is guaranteed before evolution.

Flail raw `damageScale:.28 -> .55`; retain two initial hits, .45-second duration, initial range 6.3, Normal element, cooldown 16 and the linear missing-HP multiplier `1 + 2*(1-currentHP/maxHP)`. It now deals **35.2** at full HP, **70.4** at half HP and approaches **105.6** near zero before rank scaling. It gains no invulnerability beyond the standard Q grant, so it is still dangerous to optimize around low health.

**Change Gyarados:** keep power 29; reduce health **1.75 -> 1.6** and defense **2.55 -> 2.3**. Replace the generic single primary beam with the existing reusable **`psychic-cross` pattern**, retaining Normal element and the Hyper Beam name. Author `kind:'beam'`, `projectiles:2`, `damageScale:1.45`, `cooldown:1.3`, `range:20`, `speed:28`, `lifetime:.72`, `pierce:5`, `radius:0`, `silhouette:'beam'`, `status:{}`, and no mechanical milestones. Keep existing beam growth range .35, radius 0 and projectile growth 0. The paired beams originate on opposite sides and converge on the selected target, as Abra's existing implementation does. It remains two beams at later native ranks; projectile relics use the existing crossing-pair placement rules and engine limit.

Gyarados Q remains the instant piercing Normal lance, with raw `damageScale:3.2 -> 3.6`, range 25, radius 1.3, existing rank width/range growth and cooldown 16. Estimated normalized primary becomes approximately **702.04 DPS**, versus 295.34, assuming both beams connect. Final level-30 HP becomes approximately **242.69**, versus 265.44. New repeated damage pays with some of its unusually high defensive budget.

**Keep progression:** personal level 12 plus 240-second maturity, optional milestone evolution and existing learned-move slot rules. Do not also make evolution earlier in this package. Evolution retains the current loss of Splash leap; preview it explicitly. **Add:** paired native beam only; no permanent enrage, intimidation aura or free learned move. The opening remains below generalists in safety and targeting, but the reward now includes an attack that works without winning a move-offer lottery. A player declining evolution keeps the improved challenge kit and existing uncapped training rather than being forced into Gyarados.

### 17. Eevee: a choice among three paid-for branches

**Base Eevee:** keep all stats, homing Swift, its distinct-target preference, cooldown 1.05, range 16 and Quick Attack. Raw primary `damageScale:.7 -> .65`; rank-8 milestone **six -> five stars**. Other native counts remain two initially, three at rank 3 and four at rank 6; retain rank-6 piercing. Starting primary becomes approximately **23.77 DPS**. This slightly reduces an especially efficient starting attack and makes retaining Eevee a reasonable but lower-power option.

Quick Attack retains its raw damage coefficient `1.3`, one collision-aware dash, initial range 9, radius 1.5, no bonus volley and cooldown 16. **Add:** no Adaptability, branch meter or hidden evolution bonus.

| Branch | Exact additional profile changes | Defensive / movement price | Intended payoff |
| --- | --- | --- | --- |
| Vaporeon | B1 bubble budget; 2/3/4 bubbles at ranks 1/5/8; raw damageScale **.95** instead of .9; other bubble fields as current | Health **1.5**, defense **2.4**, ordinary movement | Homing splash, soak and the highest branch durability |
| Jolteon | Raw primary chain damageScale **1.45** instead of 1; retain existing chain count/range/falloff and inherited chain rank growth; Q uses B2 | Health **1.2**, defense **1.9**; Run-up **.25** instead of .18 | Best routing, instant damage to scattered targets, useful isolated Q |
| Flareon | B4 aimed core; raw primary damageScale **.70** instead of .48; cooldown **.80** instead of .78; retain flame range/count/piercing/burn milestones | Health **1.35**, defense **2.0**, ordinary movement | Highest close neutral branch damage, lower distant small-target damage and a defensive fire ring |

Vaporeon retains Tidal Rush: raw damageScale 2.3, range 25, radius 4, 1.2-second duration, soak/slow, 4m push and cooldown 16. Jolteon retains its seven initial Q pulses, one-second duration and initial range 26, with B2's repeat cap and no-repeat stun/procs. Flareon retains Blazing Guard's six initial owner-centered flames, raw damageScale 1.1, initial radius 3.8, four-second duration, guaranteed burn and cooldown 16. No branch gains an additional passive.

At level 30/rank 8, estimated neutral single-target primary budgets are approximately **505 Vaporeon**, **422 Jolteon**, and **359 distant / 717 close Flareon**. Against a boss or broad crowd, their relative performance differs; these are not universal rankings. At the audit's actual level-35 evolution comparison, proposed Eevee rank 8 is approximately **374 DPS**; proposed rank-9 branches are approximately **611 Vaporeon**, **511 Jolteon**, **434 distant / 869 close Flareon**, assuming the same hit delivery as those samples. All three become defensible offensive choices while retaining different HP, mobility and coverage costs.

Branch previews must show the HP ratio, change of attack delivery and change of movement. Evolution is optional, so never label a branch “strictly stronger” when its range, projectile geometry, type matchup or durability changes. All branch values apply identically when recruited/evolved as a follower, except leader-only Run-up movement.

## Proposed starting budgets and important limits

All figures below are **estimates** using existing audit formulas and assumed delivered hits; they are not measurements of a patched build. Crits, status damage, Q, learned attacks and builds are excluded. Close means the original 3m small target, distant means 8m. The raw coefficients are the specification; these rounded estimates are explanatory checks.

| Starter | HP | Estimated primary DPS, close / distant | Budget supplied elsewhere |
| --- | ---: | ---: | --- |
| Bulbasaur | 96 | 20.00 / 20.00 | Reliable instant lane and remote Garden |
| Charmander | 96 | 33.97 / 16.98 | Close overlap, burn, sustained Q |
| Squirtle | 110.4 | 16.00 / 16.00 | Tank stats, homing and soak/Surf |
| Caterpie | 96 | 17.60 / 17.60 | Guaranteed slow; weaker but still useful Electric Q |
| Pidgey | 96 | 15.27 / 15.27 | Flight, piercing and repeated push |
| Pikachu | 96 | 22.47 / 22.47 | Chains, Run-up, isolated Q 73.92 |
| Sandshrew | 105.6 | 18.00 / 18.00 | Six targets per initial lane, armor and burrow |
| Vulpix | 105.6 | 15.13 / 15.13 if corrected flames connect | Delayed targeting, burn and defensive Q |
| Zubat | 96 | 31.76 / 0 | Flight and stronger short-range Q |
| Oddish | 100.8 | 11.31 / 11.31 | Poison/slow and squad sustain |
| Meowth | 105.6 | 19.20 / 19.20 | Ricochets and focused Q |
| Growlithe | 105.6 | 23.48 / 0 exactly at 8m; 23.48 just inside | Initial reach is exactly 8m; nearest-target acquisition uses a strict boundary |
| Abra | 86.4 | 17.42 / 17.42 | Crossing beams and retained teleport mobility |
| Machop | 105.6 | 28.95 / 0 | Strong armor and later combos within truthful reach |
| Gastly | 86.4 | Up to 14.38 / 0 | Inner minimum 6.33 within pulse, orbit control, Hex |
| Magikarp | 81.6 | 14.29 / 0 | Splash leap, low-health Flail and stronger later beam pair |
| Eevee | 105.6 | 23.77 / 23.77 | Accurate stars, dash and three meaningful branches |

The package deliberately does not equalize this column. Sandshrew's area and invulnerability, Oddish's party healing, or Pidgey's flight are not captured in its primary DPS. Likewise, one healing follower can affect the entire party while a damage follower benefits from a different HP pool. Measure leader and follower effectiveness separately.

Potential residual outliers are explicitly open: Pidgeot's multi-lane large-body overlap, repaired Ninetales with area/projectile relics, Machamp with repeated on-hit procs, and multiple Sleep Powder followers. B's numbers should fail release validation if those combinations dominate despite the intended costs.

## Optional new ability candidates, excluded from the recommended package

These are mutually independent design experiments, **not free extras to add to B**. Each row has a named replacement cost. Implement at most one at a time for evaluation. They require their own updated DPS/survival measurements.

| Candidate | Complete rule | Replacement cost and evolution/ownership | Why it is not in main B |
| --- | --- | --- | --- |
| **Golbat: Leech Bite** | On the first successful native primary hit while an internal timer is ready, heal the caster for **2% of its maximum HP**, capped at missing HP. Internal cooldown **4s** starts on that hit even if no healing was needed. One heal per cast; extra targets, crits, poison ticks, Q, learned moves and proc hits cannot add heals. No overheal/shield. Famine suppresses the heal; the qualifying hit still consumes the cooldown. Timer uses simulation time and is serialized. | Golbat only; lower its raw primary damageScale **1.10 -> .95**. Zubat receives no drain. Evolution starts the timer at **4s remaining**, avoiding a free immediate heal. A leader heals player HP; a follower heals only itself. The UI's leader record is bookkeeping, never a second heal. Timer is not reset by pause/restore. | Makes “Leech Life” literal and offers at most 0.5% max HP/s, but may remove meaningful attrition with heal modifiers. For this trait, apply no additional healing multiplier until explicitly balanced. Main B prefers stronger focused Q and fewer passive systems. |
| **Gyarados: Intimidating Emergence** | Immediately after an authorized evolution into Gyarados, enemies within **7m** receive the existing slow status for **2.5s**; no damage, stun, boss immunity bypass or healing. This is one event per actual evolution, no duration extension from power/rank and no future aura. Ordinary status refresh rules apply. Recruited/evolved followers use their own position. | Keep main B's paired beam but reduce Gyarados Q raw damageScale **3.6 -> 3.2**. The evolution event already occurs once, so it needs no repeat cooldown or per-target stacks. Loading a save must not replay it. | A cheap, readable transformation payoff; cannot correct poor sustained evolved damage by itself. A permanent attack-reduction aura was rejected because it needs a new defensive status and multiplies party survival. |
| **Charizard: Short Flight** | Reuse the current `flight` movement trait with **1.0s airtime**, existing hold threshold, four-second recharge, scenery clearance and current ranged/boss vulnerabilities. No attack-speed or damage bonus in air. Only the controlled leader uses flight. | Charizard only. Change only its health factor **1.5625 -> 1.40625**, approximately 10% lower max/current HP on evolution than main B. Charmander/Charmeleon stay unchanged; entering Charizard does not reset an active flight recharge. No second jump or dodge charge. | Fits the form and reuses tested movement, but gives an already strong large-target attacker another safety tool. Keeping it optional avoids assuming Flying typing should grant every species flight. |
| **Meowth/Persian: Pay Day coins** | First kill credited to this caster's **native primary direct hit** while a timer is ready creates exactly **1 existing ordinary coin pickup with value 1** at the defeated enemy. Internal cooldown **20s** starts on spawn. No coin from assists, status/proc damage, learned moves, Q, summons or non-enemy entities. The ordinary coin is collected and accounted for exactly like current enemy-drop coins, with no new currency. Counter and spawn use authoritative simulation state. | On both forms, raw primary damageScale **.95 -> .85**; keep B's .95s interval. Timer starts at 20s on recruitment/run start and carries through evolution, death/revival and suspend/restore; no reset exploit. Leader and follower each have an independent timer, so a six-member party can produce at most 18 bonus pickups/minute before collecting. | Makes economy a deliberate trade, but risks mandatory farming and leader attribution disputes. Profile the in-run supply-chest economy before accepting even this bounded reward. Current coin collection credits the pickup value directly; this does not add permanent currency or unlock progress. Main B keeps coins cosmetic and combat-focused. |

No candidate changes a permanent unlock requirement or adds permanent stat accumulation. Cosmetic names must describe the actual authored arcade mechanic, not imply broader canonical abilities.

## Implementation map and state requirements

1. **Species stats:** add a clearly named per-species resolved-stat override table in [kanto.ts](../../src/data/kanto.ts), applied after stage-band calculation. Preserve the specified power values explicitly where necessary. Tests must cover both leader start HP and evolved ratios; follower HP continues using its current larger base, not `96*health`.
2. **Primary profiles:** edit [rosterContent.ts](../../src/data/rosterContent.ts). Pay attention to spread order: `...starterSignatures` currently overwrites earlier per-species values. Encode each final override after the family spread. Extend [attacks.ts](../../src/data/attacks.ts) with typed reusable optional fields for fan core/side weighting, inner pulse scale and bubble repeated-hit policy. Do not hard-code new species IDs in combat execution.
3. **Attack execution:** add B3 pulse and B4 weights in [patterns.ts](../../src/game/combat/patterns.ts), preserving base damage, critical provenance and appropriate per-hit status overrides. Gyarados reuses crossing-beam execution. The inner pulse needs a way to call the primary damage path with empty intrinsic status without erasing the ordinary wisp status. Do not temporarily mutate the shared profile object to achieve this.
4. **Projectiles / damage:** implement B1 cast identity, per-target budget and proc suppression in [projectiles.ts](../../src/game/combat/projectiles.ts), [types.ts](../../src/game/types.ts) and the authoritative [Simulation.ts](../../src/game/Simulation.ts) hit path. All hits, analytics, critical accounting and overflow contributions must see the reduced direct damage exactly once. Proc suppression must occur before relic counters, not merely hide the final proc visual.
5. **Q profiles and execution:** apply coefficients/cooldowns in [specials.ts](../../src/data/specials.ts), and B2 hit counts/priority in [combat/specials.ts](../../src/game/combat/specials.ts). Author the repeat policy as optional data on thunder profiles so nonparticipating fallback specials do not silently gain it. Existing special active-effect/pulse limits remain enforced.
6. **Movement:** use [movementTraits.ts](../../src/data/movementTraits.ts) for evolved Abra teleport, Sandslash recharge and Jolteon Run-up. No new control mapping or movement implementation is needed for the recommended package.
7. **Snapshots:** [runSnapshot.ts](../../src/game/runSnapshot.ts) currently serializes selected `Set`s and declares version 1; adding a `Map` to an effect is not automatically safe. Serialize bubble ledgers and thunder hit counts as validated arrays of numeric pairs; persist deterministic cast IDs and any overflow contribution IDs. Rebuild lookup maps on restore. Use bounded integer/count validation, clean up resolved cast ledgers and reject orphan/malformed references. Add a schema version or explicit backward-default migration; older snapshots lacking these fields must preserve old in-flight behavior until expiry, then create new-policy attacks. Do not retroactively grant an imported effect an unused full-hit budget. A simple supported migration is to mark legacy in-flight bubble/thunder effects `legacy` and preserve their old execution only for those effects. New casts use B. Document the changed balance revision in suspended-run metadata.
8. **UI / descriptions:** update starter cards, evolution previews, attack/rank text and Q summaries. Show Flying Gust/Whirlwind, the bubble repeat rule, weaker fan wings, Gastly pulse radius, retained teleport, lower Sandshrew lane target count, and the real Magikarp/Gyarados trade. For an uncapped percentage upgrade above the last mechanical breakpoint, continue showing its actual percentage gain. Never promise a projectile count equals that many full boss hits.

For B1, preferred storage is a run-level map of active cast ledgers plus lightweight cast references on projectile contributions. A member-level ledger is incorrect when multiple volleys overlap. For B2, the ledger belongs to one `ActiveSpecial`. B3/B4 and the recommended Gyarados beam require no new persistent per-member timers. Only optional Leech Bite/Pay Day need member cooldown state; do not add that state unless the corresponding candidate is selected.

## Validation and acceptance before implementation can ship

The previous audit's 570 passing tests establish a baseline; they do **not** validate this proposal. Re-run the existing audit on the implementation and add behavioral regression coverage where the package changes semantics.

- **Delivery and monotonicity:** rank 1 through 12 and representative 20/50/100 profiles; every finite mechanical milestone; 0.01, 1/60, .025 and .04s steps; size .8 and boss size 4.4; area multipliers 1/1.5/2/4. Test stationary, approaching and crossing targets. Extra area/rank/projectiles must not remove an already delivered base attack unless an explicitly displayed evolution trade changes the move.
- **Bubble ledger:** one cast/four hits totals 1.75 base hits; two overlapping four-bubble casts total 3.5; different owners remain separate; every new enemy starts full; a miss spends nothing; repeated splashes refresh soak but do not trigger counters. Compare direct execution with pool overflow/merged contribution execution. Suspend after one full hit, restore, and verify later hits remain quarter damage. Test a target dying and a new UID appearing at the same position. Ensure expired casts release state without forgetting live overflow contributions.
- **Thunder:** one enemy gets 1 + .6 + .6 with only one stun/proc opportunity; two enemies split six pulses correctly; six fresh enemies receive six full strikes. A newly arriving unhit enemy takes priority; dead/out-of-range targets are excluded; UID ties are stable. Suspend between strikes without allowing a fourth same-target hit. Verify followers and every evolved thunder profile.
- **Gastly:** pulse at rank 1 covers the interior through the ring boundary; rank 2 expands it without removing old coverage. No intrinsic pulse poison/slow. Wisps retain one-hit sets and reduced coefficients; multiple casts remain independent. The renderer's pulse radius and damage radius match. Leader/member positions are authoritative, and a follower's pulse cannot accidentally center on the player.
- **Fan / coins / Gyarados:** aimed core and lateral weights total 3 for three connections and 4.5 for five; item-added flames are lateral. Both Persian coins converge while maintaining independent bounce histories. Both native Gyarados beams intersect a stationary selected small enemy; no hidden Psychic type/status is inherited from the reused pattern. Check geometric obstructions and maximum acquisition distance.
- **Stats and evolution:** exact stat rows; current/max health ratio; no accidental double application of stage overrides; HP bookkeeping is not extra health. Evolution grants and optional refusal remain intact. A level-35 Eevee evolution comparison should approximate the reported relative budgets without inventing extra training choices. All Q cooldown changes and movement changes appear in previews.
- **Whole-run evaluation:** compare identical seed sets and policies for every starter as leader, then fixed-party follower substitutions. Record time to first follower, first/last evolution, kills, HP lost, healing, boss-clear time, damage per source and each evolution's offered/taken rate. Include ordinary builds, no-relic builds, Loaded Dice / King's Rock / Metronome builds, Electric + soak, poison + Fire, and multiple healers. Log area and target-size distributions; an 8m stationary target is not a real run.
- **Playtest acceptance:** after mechanics pass, collect at least ten paired seeded runs per starter across two movement policies (safe kiting and close engagement), then human tests of changed controls/clarity. This is an initial comparison, not a statistically proven win-rate ranking. Investigate a greater than 20% median boss-clear advantage or survival advantage against comparable roles, and any build combination beating peer damage by more than 50% without a visible cost. Preserve intended specialist wins; do not automatically tune every kit to the mean.

Ship the corrected hit delivery first, then this entire package in one internally consistent balance revision. Record new measurements and revise the arithmetic projections where real geometry, status uptime or follower AI changes the outcome. The decision presented here is whether to pursue these stronger identities and limited new attack behaviors; the exact final shipping numbers require that implementation evidence.
