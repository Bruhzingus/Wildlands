# N4: late-run encounter pressure

October 21, 2026. This is a small first tuning pass on the standard run. The opening through minute three, player movement, rewards, enemy HP, tells, boss schedule and optional challenge rules retain their existing values.

## Changes and rationale

- `src/data/director.ts`: After minute three, the arrival interval now reaches 1.08 s at 7:00, 0.78 s at 11:00 and 0.62 s at 13:00 (previously 1.20, 0.90 and 0.70). Smooth interpolation still avoids a phase-boundary burst. The ordinary variant share gradually falls from 70% to 46% at those landmarks; dark, Rocket, rabid and poisoned encounters become slightly more common. The living-enemy budget and single-arrival rule are unchanged.
- `src/data/enemyTiers.ts`: Tier-three miniboss chance grows from 1% at 6:00 to 7% at 14:00, previously 5%. Existing 18-second minimum spacing and three-alive limit remain. Tier-four rarity is unchanged.
- `src/data/config.ts`: The final spawn interval constant matches the director's 0.62 s landmark.
- `scripts/balance-telemetry.mjs` and `scripts/lib/run-metrics.ts`: A map ID is now an explicit, validated experiment parameter and appears in cohort labels and CSV. The earlier implicit default did not exercise the same early map filtering as a normal game run. Old reports without a map ID replay as Wildlands.
- Director, encounter and spawning assertions now cover the new values, smooth boundaries and opening timing.

These changes increase the number of threats and the share requiring different positioning, without raising every enemy's HP or filling the screen. They also add XP opportunities; that feedback needs human review.

## Matched scripted evidence

The reports are local, seeded authoritative simulations with 0.04-second ticks. **Health-maintained** scripts restore HP before each tick solely to observe the full progression arc. They cannot establish survival, win rate or player enjoyment. Each before/after pair uses the same seeds, starters, map, unlock pool, movement policy and choice priority. Fingerprints: before `4cc5b8cf08f4225ac14275a5e209002ddcbd9de2ee601eef8664629f413babd7`; after `cc451dfd8094cba5d648fb96c96e5505ca9192cb8331287e2f40a5c0b79f323d`. Reports marked source-stable during their own batch.

Representative commands (each was run once at the before fingerprint and once after, changing only `--out`):

```sh
node --experimental-strip-types scripts/balance-telemetry.mjs --runs 12 --seconds 960 --starters 1,4,7,25 --behaviors cautious --builds balanced,offense,survival --pools fresh --map wildlands --assisted --out artifacts/telemetry/n4-after-wildlands-builds --quiet
node --experimental-strip-types scripts/balance-telemetry.mjs --runs 12 --seconds 960 --starters 1,4,7,25 --behaviors cautious --builds balanced,offense,survival --pools legacy-full --map volcanic-ridge --assisted --out artifacts/telemetry/n4-after-volcanic-builds --quiet
```

Separate 12-run cohorts cycled cautious, orbit and stationary movement with balanced choices. The same four starters and seeds were also run unassisted on both maps.

| Map/pool; cautious movement; 4 starters per row | Kills/min before → after | Mean level before → after | Boss victories among reached before → after |
|---|---:|---:|---:|
| Wildlands/fresh, balanced | 52.44 → 57.55 | 94.25 → 95.50 | 0/4 → 0/4 |
| Wildlands/fresh, offense | 52.28 → 57.56 | 92.75 → 99.75 | 0/4 → 2/4 |
| Wildlands/fresh, survival | 49.78 → 57.39 | 84.25 → 101.00 | 0/3 → 0/4 |
| Volcanic/legacy-full, balanced | 51.99 → 57.27 | 101.75 → 99.00 | 0/4 → 0/4 |
| Volcanic/legacy-full, offense | 52.20 → 57.14 | 97.25 → 102.75 | 0/4 → 1/4 |
| Volcanic/legacy-full, survival | 52.13 → 57.17 | 93.50 → 104.50 | 0/4 → 0/4 |

All measured 15-minute parties had four living members. In the balanced, three-policy cohorts, mean living enemies at minute 13 increased from 8.82 to 12.01 on Wildlands and from 9.22 to 11.40 on Volcanic. Mean leader damage in that minute changed from 626 to 744 and 508 to 659 respectively, despite health assistance. Minute-one values were identical in matched pairs. The full minute records, recruit/upgrade timelines, incoming leader/follower damage, faints, peak entities and boss durations are in `artifacts/telemetry/n4-{before,after}-*.json`; CSV and Markdown companions are beside them. These artifacts are local and ignored by Git.

Unassisted scripts with balanced choices all died before recruitment, both before and after. The matched early Wildlands and Volcanic runs had identical elapsed times, confirming this pass did not create an opening spike. Those scripts are poor late-game evidence; their movement and upgrades do not reflect an experienced player. The assisted offensive boss victories after tuning may reflect faster XP and stronger builds, so they do **not** prove that the boss became harder. The fixed boss HP, windups and schedule did not change. The first-boss fight lengths in capped 60-second assisted runs mostly hit that observation limit; treat them as censored.

## Verification

- `npm.cmd test`: 417 passed after updating the expected tier-three share and arrival counts.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: TypeScript passed, then the standard Vite config loader hit `Cannot read directory "..": Access is denied` in this Windows workspace.
- `node_modules\\.bin\\vite.cmd build --configLoader runner`: passed.
- `node_modules\\.bin\\playwright.cmd test tests/browser/world-boss.spec.ts`: 3 passed, covering the map, 15-minute warning/bar, readable boss hazards, pause and endless continuation.
- Telemetry's finite-state and recruit-gate checks passed in the matched cohorts. Upgrade-gap hypotheses still need review; additional kills do not guarantee consistently shorter upgrade gaps.

## Limits and next review

No human sessions were observed. Healing, avoided damage per dodge, damage attribution by attack, and per-enemy time-to-kill are not isolated by the current batch recorder; total incoming damage, kill rates and boss duration are proxies, not substitutes. F3's uncapped percentage and multi-crit model is still pending, so this is provisional N4 tuning. Play a fresh and an unlocked run on both maps, noting when pressure becomes demanding, whether deaths are understandable, and whether extra XP cancels the intended difficulty. Recalibrate after F3 and N3 settle, without treating assisted scripts as human win rates.
