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

The first eight minutes keep the earlier time-based enemy tuning. From minute eight to fifteen, a continuous curved ramp multiplies newly spawned enemy HP up to 3x and damage up to 1.15x, on top of existing scaling. Scheduled bosses receive this ramp. Movement speed, attack cooldowns, and telegraph duration are unaffected by it.

Shrines retain fixed, advertised tier budgets independent of player builds and the clock. Their first three tiers are unchanged; later tiers now account for evolved squads and multiple trained moves. Following the two-minute fight target, tiers 9–15 have six times the health of the initial balance pass: Gyarados has 3,900,000 total HP and the level-90 Mewtwo shrine has 9,600,000. Their target duration is 105–135 seconds. Guardian trials now allow 180 seconds, leaving room to reposition and dodge during a two-minute fight. Rewards and hazards keep their existing rules.

Main bosses use 280,000 base HP plus 5,600 per average party level, before the existing time and chapter multipliers. This raises their endurance by about 4.67x relative to the initial balance pass. Attack damage, movement, telegraphs, and attack cooldowns keep their existing rules.

Endless ordinary arrivals now use separate health and damage multipliers. With `p = max(0, elapsedSeconds - 900) / 360`, health is multiplied by `(1 + p)^2` and damage by `1 + 0.55p`. At 33 minutes these factors are 16x health and 2.65x damage, replacing the former shared 2.8x factor. The former 8x spawn-stat ceiling is removed. Existing actors retain their spawn stats. Repeating bosses keep their separate chapter budgets.

## Reproducible checks

`node --experimental-strip-types scripts/late-run-balance.mjs` uses a fixed level-48 four-member party with rank-8 signatures, two rank-6 learned moves per member, twelve relics, and squad training, including automatic companion specials. Targets cannot retaliate and are held in place so repeated Surf knockback cannot move them outside attack range; XP and ordinary arrivals are disabled. Gyarados takes 118.72 seconds and Moltres takes 116.52 seconds, within the 105–135 second target. Each loses under 1% HP in the opening 0.2 seconds. These are throughput checks, not a recreation of the original build.

`node --experimental-strip-types scripts/endless-balance.mjs` reconstructs the five visible members, move ranks, and relic stacks from the reported 33-minute run. Personal training is estimated from the displayed totals. XP, upgrade selections, and bosses are excluded; ordinary arrivals, enemy attacks, automatic companion specials, healing, and relic drawbacks use the real simulation. The stationary case loses in 26.84 seconds; the existing cautious movement script lasts 77.04 seconds without taking upgrades. This establishes that passive recovery no longer sustains this composition indefinitely. It does not establish human survival balance.

Regression coverage checks personal and squad reward scopes, fractional relic bonuses, XP boundaries, capped streak batching, spawn scaling, fixed-build fight duration, and stationary endless survival. Human sessions should still check the difficulty of intermediate shrine tiers and the transition into endless with weaker builds.
