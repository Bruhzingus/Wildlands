# Late-run balance update

This pass addresses a level-48 party deleting the level-44 Gyarados shrine, a ten-second Moltres fight, and a minute-33 run with a level-87 Blastoise that could clear ordinary enemies while standing still.

- All positive relic bonuses and triggered strengths are halved, including authored rarity curves, Legendary variants, healing, XP, Rare Candy, and special cooldown recovery. Trigger frequencies, proc chances, effect geometry, and drawbacks retain their previous values. Status relics have half their former duration.
- Loaded Dice contributes 0.5 extra projectiles per copy: one copy has a 50% chance of an extra shot, two guarantee one, and further copies combine the same way. Whole bonuses are guaranteed; only the remaining fraction is rolled. This applies to signatures, learned moves, and compatible specials.
- Team Battery grants one dodge charge per two living members, rounded down; its Legendary version grants one per member. Rare Candy grants 0.5 / 1 / 1.5 / 2.5 levels by rarity. Fractional levels add that fraction of the relevant level's XP requirement, including existing XP progress.
- Personal stat training is reduced by 15%, rounded to whole percentage points or dodge charges, with a minimum of one. Swords Dance and Tailwind now give 7 / 13 / 21 / 34%; HP Up gives 9 / 17 / 26 / 43%. Squad reward training keeps its authored values. Offers, validation, descriptions, previews, and both catalogues distinguish these scopes.
- Move rank growth changes from 20% to 17% damage, 8% to 7% casting speed, and 6% to 5% learned-move reach per rank. Evolution and ordinary level bonuses retain their existing rules.
- Metronome now adds 5% per prior uninterrupted hit, capped at 100% extra damage per copy after 20 hits. Changing targets resets the streak; batched casts preserve the same average damage as individual hits.

## Party gates

Both elapsed time and squad progression are required. Fainting never resets the gates.

| Total members | Earliest time | Squad progression |
| --- | --- | --- |
| 2 | 2:45 | 4 |
| 3 | 9:00 | 12 |
| 4 | 14:00 | 22 |
| 5 | 19:00 | 32 |
| 6 | 24:00 | 42 |

## Enemy endurance

The first eight minutes keep the earlier time-based enemy tuning. From minute eight to fifteen, a continuous curved ramp multiplies newly spawned ordinary enemy HP up to 3x and damage up to 1.15x, on top of existing scaling. Endless boss chapters retain this ramp; the first map boss has a separate health budget. Movement speed, attack cooldowns, and telegraph duration are unaffected by it.

Shrines retain fixed, advertised tier budgets independent of player builds and the clock. Tiers 1–8 retain their existing health. Tiers 9–15 now grow from 300,000 to 1,000,000 total HP, calibrated against the reported ordinary build and modest later training. Their duration target is 60–150 seconds within the existing 180-second deadline. Guardian damage, hazards, rewards, level windows and ordinary arrival rules keep their existing behavior.

### Shrine progression calibration

The old jump from tier 8's 220,000 HP to tier 9's 3,900,000 HP required 17.73 times the damage for six recommended levels. With real guardian movement and endless arrivals, the reported level-40 party removed only about 11% of tier 9's old HP and 18% of tier 10's before timeout, even with normal enemy hits suppressed. Isolated, stationary-target tests substantially overstated output: they did not account for damage diverted to ordinary enemies or guardian movement.

The new curve below uses total encounter HP, divided evenly between guardians. These measurements use seed 1883105034 and the recommended leader level. Regression coverage also runs seed 8841.

| Tier | Recommended level | Old total HP | New total HP | Duration with modest growth |
| --- | ---: | ---: | ---: | ---: |
| 9 — Gyarados | 44 | 3,900,000 | 300,000 | 111.56s |
| 10 — Venusaur | 50 | 4,800,000 | 500,000 | 82.32s |
| 11 — Charizard | 56 | 5,700,000 | 700,000 | 100.36s |
| 12 — Dragonite | 63 | 6,600,000 | 750,000 | 95.60s |
| 13 — Articuno | 70 | 7,500,000 | 800,000 | 133.08s |
| 14 — Zapdos | 80 | 8,400,000 | 900,000 | 70.24s |
| 15 — Mewtwo | 90 | 9,600,000 | 1,000,000 | 129.32s |

`scripts/shrine-balance.mjs` reconstructs the saved 23:08 party, including its exact signature/learned ranks, personal training, evolution power and relic stacks; estimated single-target output is 3,032.62 DPS. That level-40 party clears the new tiers 9 and 10 in 121.68s and 112.00s respectively. Later fixtures retain the same five members and relic stacks. Each twenty gained levels adds two signature ranks, one rank to the first learned move, and one common 7% power/haste training choice, alternating between those stats. This fits the four five-level milestones; Koffing is assumed evolved by level 35. Extra relics, a sixth recruit and further learned moves are not assumed. Elapsed time advances by twelve seconds per projected leader level (about level 90 at 33 minutes). These are conservative progression scenarios, not measurements of the user's future run.

Trials retain real guardian movement, slow ground, arena limits and ordinary endless arrivals, with no XP/upgrades during the fight. Enemy hits and hazard damage are suppressed to measure duration independently of survival; slow ground still affects movement. The original investigation allowed hazard damage while suppressing normal enemy hits, so its temporary 300k/500k candidate times were slightly different. Faster kills by well-equipped or favorably matched parties are allowed. Entering ten levels below a shrine's recommendation can still be difficult; eligibility does not promise a win.

Saved active guardian trials also receive the smaller per-guardian budget on restore. Damage already dealt, defeated guardians and the original trial timer are retained. A guardian whose accumulated damage exceeds its new budget resumes at 1 HP so the usual hit/completion/reward path runs once. The correction is idempotent and included in the first rewind checkpoint. Finished trials, other challenge types, unrelated enemies and shrines already using the new health are unaffected.

### Scheduled bosses

The first Mewtwo or Moltres has **160,000 HP**, independent of party level, training, relics and elapsed time. Attack damage, movement, telegraphs and attack cooldowns keep their existing rules. Endless boss chapters retain 280,000 base HP plus 5,600 per average party level, the capped party multiplier, late-enemy scaling and the chapter multiplier of `1 + 0.18 × bossesDefeated`.

### First-boss calibration from a reported run

Run `mvn14c7y-1-1883105034` is the average-to-below-average benchmark. Mewtwo had 3,621,745.68 maximum HP and 3,185,545.55 remaining at 23:08.185, having arrived at 15:00. That is 436,200.13 damage over 488.185 seconds, or **893.514 effective boss DPS** including movement and damage diverted to adds. The former pool implies a 67.56-minute fight at that rate.

A three-minute target gives `893.514 × 180 = 160,832.47 HP`. Rounding to 160,000 predicts 179.07 seconds. At 75% of that output the fight takes 238.76 seconds; at 125% it takes 143.25 seconds. These are constant-output estimates, not survival predictions. HP is fixed at spawn and does not rise when the party improves.

The build was weaker when the boss actually arrived: level-29 Raichu, level-29 Kingler, level-26 Chansey and level-11 Bulbasaur, with signature ranks 4/5/5/3 and three learned moves of ranks 1/1/3. `scripts/boss-balance.mjs` reconstructs the 15:00 telemetry, including its relic stacks and personal training, and freezes XP/upgrades. Its estimated single-target DPS is 924.14, matching the report. With normal arrivals, summons, boss movement, both stages and a scripted 8m circling policy, Mewtwo takes **173.24–178.08 seconds** across two seeds. Moltres takes **118.84–120.08 seconds** with the same party, which has advantageous Water coverage. Incoming hits are disabled to isolate duration; this does not establish human survival balance.

Imported unfinished runs also receive the correction. Only an oversized, living first scheduled boss is reduced. Damage already dealt is retained in absolute HP; if it exceeds the new pool, the boss remains at 1 HP until the next hit resolves normal victory and rewards. Reloading or immediately suspending again cannot reapply the correction or restore the old pool. The reported save has already dealt more than 160,000 damage and therefore resumes with Mewtwo at 1 HP.

Endless ordinary arrivals now use separate health and damage multipliers. With `p = max(0, elapsedSeconds - 900) / 360`, health is multiplied by `(1 + p)^2` and damage by `1 + 0.55p`. At 33 minutes these factors are 16x health and 2.65x damage, replacing the former shared 2.8x factor. The former 8x spawn-stat ceiling is removed. Existing actors retain their spawn stats. Repeating bosses keep their separate chapter budgets.

## Reproducible checks

`node --experimental-strip-types scripts/boss-balance.mjs` reproduces the first-boss calculation and the four reported-build encounters above. It optionally accepts a suspended-run JSON path to recompute observed boss DPS from that save.

`node --experimental-strip-types scripts/shrine-balance.mjs` reproduces the level-40 shrine checks and the later progression table above, including ongoing endless arrivals and guardian movement.

`node --experimental-strip-types scripts/late-run-balance.mjs` uses a fixed level-48 four-member party with rank-8 signatures, two rank-6 learned moves per member, twelve relics, and squad training, including automatic companion specials. Targets cannot retaliate and are held in place so repeated Surf knockback cannot move them outside attack range; XP and ordinary arrivals are disabled. This unusually strong party is allowed to defeat both the tier-9 shrine and first map boss quickly; its output no longer sets the health floor for ordinary parties. These are throughput checks, not a recreation of the original build.

`node --experimental-strip-types scripts/endless-balance.mjs` reconstructs the five visible members, move ranks, and relic stacks from the reported 33-minute run. Personal training is estimated from the displayed totals. XP, upgrade selections, and bosses are excluded; ordinary arrivals, enemy attacks, automatic companion specials, healing, and relic drawbacks use the real simulation. The stationary case loses in 26.84 seconds; the existing cautious movement script lasts 77.04 seconds without taking upgrades. This establishes that passive recovery no longer sustains this composition indefinitely. It does not establish human survival balance.

Regression coverage checks personal and squad reward scopes, fractional relic bonuses, XP boundaries, capped streak batching, spawn scaling, fixed-build fight duration, and stationary endless survival. Human sessions should still check the difficulty of intermediate shrine tiers and the transition into endless with weaker builds.
