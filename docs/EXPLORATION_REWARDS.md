# Exploration rewards and shrine trials

Discovery caches are free, one use per run, and never respawn. Their rare ambush event also fires only once. Paid supply chests remain separate sites: the seeded world contains one common, one rare, and one epic chest, with matching colors in the world and minimap.

| Chest tier | Starting cost | Restock time | Relic quality |
| --- | --- | --- | --- |
| Common | 45 coins | 120 seconds | Common or better |
| Rare | 72 coins | 180 seconds | Rare or better |
| Epic | 108 coins | 240 seconds | Epic |

Prices increase by 15 coins per purchase **at that site**, rather than penalizing every chest globally. Every six minutes and every two purchases promote the site's tier, capped at epic. Offers prioritize three distinct, useful, unlocked and unowned relics, sorted by rarity. Available squad training fills remaining slots when that tier's relic pool is depleted. Fully exhausted sites take no coins and stay available.

Shrines recommend a level 8+ squad. Activating one starts a 90-second guardian fight within a visible 24m boundary; ordinary enemies remain active. Only one shrine trial may run at a time. Leaving the boundary or running out of time removes the guardian and its attacks without kill rewards. The shrine allows a fresh, full-health retry after 60 seconds.

Shrine guardians start above 2,000 HP and 24 damage, before defenses and type matchups. Health scales with living squad size, average level, elapsed time and challenge tier; damage scales with level and tier. Tier rises every five minutes and after each victory. Movement speed and attack tells retain established combat timing.

Victory grants the ordinary elite rewards, guaranteed rare-or-better relic loot (epic from tier 3), squad training, +4 percentage points of luck (40% shrine luck cap), and a refreshed special. If eligible relics are exhausted or already on the ground, the guaranteed extra loot becomes 30 coins per tier. Ancient echo rewards are deferred until victory and fire once per site. Successful shrines recharge for 240 seconds **after the guardian is defeated**.

All countdowns use active simulation time and freeze during pause and reward choices. Restocking sites stay visible in a spent state; nearby prompts display their countdown. Spent discovery caches disappear. Regression coverage: `tests/treasure-shrines.test.ts`, `tests/economy.test.ts`, and `tests/exploration-integration.test.ts`.

These are initial tuning values, verified by automated checks; human playtesting remains necessary to assess feel across starter and squad builds.
