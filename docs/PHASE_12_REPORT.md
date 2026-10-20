# Phase 12 implementation and verification

PHASE: 12 — Run metrics, balance experiments and difficulty tuning

What changed: Added a local headless experiment runner around the actual authoritative `Simulation`. Seeds, Kanto starters, duration, fixed step, movement policies, choice priorities, health assistance and genuine-victory-to-endless continuation are configurable. Three deterministic policies (cautious, orbit/approach and stationary) and three build priorities (balanced, offense and survival) use the real movement, contact, cooldown, dodge, jump, special, progression and boss rules. Policy decisions do not consume simulation RNG. Invalid configuration fails before starting a run.

Each seed records time per level, per-minute kills/damage/enemy pressure, cumulative leader damage, follower hit/poison damage, follower faint rate, all recruit offer times/species/gates, selected upgrade timelines, living party at 15 minutes, evolutions, offered/selected item rarity, boss outcome/fight duration, longest selected-upgrade gap and peak enemy/projectile/drop counts. Early deaths produce null party-at-15m values, never fabricated four-member results. Gap calculations include opening and trailing active time and exclude menu time. Reports separate assistance and policy cohorts, record a source fingerprint and complete replay configs, and export JSON, flat CSV and Markdown tables. Gate/bound/numerical safety regressions make the command fail; design hypotheses are clearly marked for review rather than silently forcing balance.

Added an opt-in development-console recorder for real playtest sessions. Arm it on the title screen, select a starter with the actual UI, play normally, then finish/export local JSON and human observations. It preserves the existing simulation event handler and normal input/choice results, writes no HP/XP, sends no network requests and restores every wrapped method when finished/canceled. The application does not import these scripts, so they add no production telemetry, global listeners or background work.

Changed files: `scripts/lib/run-metrics.ts`, `scripts/lib/live-telemetry.ts`, `scripts/balance-telemetry.mjs`, `tests/telemetry.test.ts`, `tests/browser/telemetry.spec.ts`, `package.json` (`balance:telemetry` command), this report. Generated evidence is stored under `artifacts/telemetry/` and `artifacts/browser/12-telemetry-results/`.

Why the approach is maintainable: Simulation remains the source of truth. A passive recorder observes state/events/accepted choices, while scripted policies and report formatting live outside application code. Reports identify censored data, assistance, policy and source revision instead of mixing incompatible experiments. The same recorder supports a manually armed real-session capture. There is no analytics service, save migration, rendering dependency, duplicated combat engine or new package dependency.

Tests run: `node --experimental-strip-types --test tests/telemetry.test.ts` passed **11/11**. `npx tsc --noEmit --allowImportingTsExtensions --module nodenext --moduleResolution nodenext --target ES2022 --strict --skipLibCheck scripts/lib/run-metrics.ts scripts/lib/live-telemetry.ts` passed. `npm run test:browser -- tests/browser/telemetry.spec.ts --output artifacts/browser/12-telemetry-results` passed **1/1**. Final measured batch/replay commands and observations are recorded below.

Browser smoke steps: Loaded the recorder through a Vite development-only dynamic import, armed the actual title screen, clicked the Water starter, obtained native pointer lock, moved with real W input and observed advancing simulation metrics. Escape paused completely; the recording's elapsed time remained frozen. Finished a local report with automation explicitly labeled, verified no validation errors and no page errors. This verifies the recorder's browser wiring, not human balance or enjoyment.

Known limitations: No human playtest was represented as completed. Human readability, relaxing feel, casual victory rate and fun still need observed sessions using the supplied protocol. Cautious scripts react immediately to authoritative state and are not a model of human reaction time. Orbit/stationary scripts are intentionally poor baselines. Leader damage exactly follows cumulative `RunStats.damageTaken`, including self-damage/poison/overkill; follower damage adds hit events and poison sampled before passive healing. A terminal frame may count at most one tick of follower poison when the leader dies earlier in that tick. Shrine luck is not considered a selected upgrade, making reported upgrade gaps conservative. Reports compare like-for-like source fingerprints; changing game data can change a replay's outcome.

Balance / performance impact: The harness itself changes no gameplay values. Simulation timing measurements are headless CPU throughput, not browser GPU FPS. Measured results expose design hypotheses rather than automatically adjusting difficulty to scripts. The old first-level 30–50 second hypothesis is currently faster in scripted experiments; retaining early rewards pending human observation is deliberate. Phase-11 curated roster changes and phase-13 performance work can be measured with the same seed/config manifests.

Next recommended phase: 13 — Reliability, performance and memory tests.

Regression checklist: Eleven tests cover deterministic replay, observer non-mutation/RNG independence, paused time, exact recruit offers and restriction checks, fresh/legacy pool separation, accepted/rejected choices, opening/trailing upgrade gaps, follower damage/faint denominator, censored 15m data, real boss outcomes, policy/action taps, assistance cohorts, CSV null handling, invalid configs and real-session listener/method restoration. No native camera/input, pause, time gates, explicit evolutions, follower fainting, boss or endless rules were replaced.

## Reproducible experiments

```powershell
npm run balance:telemetry -- --runs 240 --seconds 1000 --pools fresh --out artifacts/telemetry/12-unassisted
npm run balance:telemetry -- --runs 54 --seconds 1000 --behaviors cautious,orbit --pools fresh --assisted --out artifacts/telemetry/12-progression
npm run balance:telemetry -- --runs 24 --seed 80001 --seconds 1000 --starters 10,13,129,132 --behaviors cautious --builds balanced --pools legacy-full --assisted --out artifacts/telemetry/12-weak-starters
npm run balance:telemetry -- --replay artifacts/telemetry/12-unassisted.json --index 0 --out artifacts/telemetry/12-replay
```

`--help` documents explicit seed lists, starter lists, pools, policies, build priorities, endless continuation and simulation step size. Default fresh-save experiments use the four actual starting partners, 32 base items and exclusion of 11 gated single-stage recruits. `legacy-full` uses unrestricted pools for existing fully unlocked/legacy content QA. Explicit starter IDs bypass title availability only for content experiments. Real-session reports record the actual save's pool arrays. Every JSON contains full per-level, per-minute, recruit and selected-upgrade details. The CSV is one row per seed; censored values are blank. Matching Markdown files provide cohort/hypothesis tables. Assisted reports must always remain separate from unassisted survival conclusions. Source files are fingerprinted at both ends; a changing-source batch is flagged provisional and exits with code 2.

Final evidence uses settled gameplay source fingerprint `505fedc833d0a5592774847227819c2a848c8c53fbd2f1f5c4c7d9ac07418a0d`. The source-stability guard rejected an earlier concurrent-edit batch; that provisional output was replaced by a clean rerun. The three cohorts deliberately answer different questions:

| Experiment | Runs | Reached 15m | Living party at 15m | Boss victories / reached | Longest upgrade gap |
|---|---:|---:|---:|---:|---:|
| Fresh save, unassisted, three policies/three build priorities | 240 unique seeds | 30 | 4 in all 30 | 27 / 30 | 75.2s |
| Fresh save, health maintained, cautious/orbit progression | 54 | 54 | 4 in all 54 | 52 / 54 | 90.12s |
| Weak-starter content QA, full pools, health maintained, cautious/balanced | 24 (six each of IDs 10/13/129/132) | 24 | 4 in all 24 | 24 / 24 | 58.2s |

All three cohorts pass recruit-time/species/pool gates, configured caps and numerical checks. They contain 535 actual recruitment offers with no early offer. The unassisted cohort averages level 13.888 and 69.462 kills/minute across all three movement policies; these broad averages include deliberately poor stationary/orbit policies. Its mean first level is 12.14 seconds and mean first recruit offer is 184.523 seconds among runs reaching those events. All 240 reached a first level. Cautious cohorts perform much better than the simple orbit, demonstrating that these results depend strongly on policy; the aggregate is not a human win rate.

All three batch commands above completed with exit code 0 and `sourceStable: true`. The single-seed replay command also completed with exit code 0 at the identical fingerprint. A comparison of the complete original result at index 0 with the replay result passed: every config, scalar metric, level/minute timeline, recruit offer and selected choice matched exactly.

The assisted 90.12-second gap occurs during the late boss encounter on seed 5335 with a Water starter/orbit policy, between an evolution at 899.24s and the next recruit at 989.36s. That route remains alive with the boss at the 1000-second limit. It is flagged for review instead of adding artificial XP or forcing recruitment. All other assisted fresh routes have gaps below 70 seconds. Caterpie/Weedle/Magikarp/Ditto results demonstrate mechanical progression viability after the curated roster changes, with no claim of unassisted human viability.

The first-level hypothesis currently misses the old 30–50 second window on the fast side. There is no evidence here that a slower first reward would be more enjoyable. No XP slowdown or survival nerf was applied solely to fit a historical hypothesis. Real sessions should compare first-30-second comprehension and early pressure before changing that cadence.

## Real playtest protocol

Run `npm run dev`, open the development game on its title screen, and use the developer console once:

```js
const telemetry = await import('/scripts/lib/live-telemetry.ts');
const session = telemetry.armPlaytest(window.__WILDLANDS__);
```

Choose the starter through the real UI and play without developer heal/time/level shortcuts. Menus, camera capture, settings and difficulty remain the game's normal behavior. After defeat/victory or a deliberate stop, pause and export:

```js
const report = session.finish({
  clarity: 'What the player understood or missed in the first 30 seconds',
  comfort: 'Camera, sound and effects observations',
  difficulty: 'When the player felt safe, pressured, or unable to react',
  buildIntent: 'What the player was trying to build',
  other: 'Any confusion, bug, or enjoyable moment'
});
telemetry.downloadPlaytest(report);
```

Use `session.cancel()` to remove the recorder without keeping a report. Record whether participants already know the controls, allow ordinary menu reading, and do not coach tactical movement. Compare starter, build intention, first recruit timing, losses, living party at 15m, boss duration and observed confusion. First observe multiple unassisted sessions; then change one tunable hypothesis and repeat the same protocol. Automated survival rates alone cannot establish a casual player's win rate.
