# S4 damage analysis and F5 suspended runs

Implemented October 23, 2026. This extends the improvement document with the
owner's requested downloadable balancing data and a whole-run rollback when
saving. Existing collection saves and settings remain separate files/schemas.

## Player flows

- After defeat or victory, **Download balancing report** downloads a readable,
  versioned JSON report. The results page ranks incoming threats and outgoing
  attacks by actual HP removed, with source details, leader/follower totals,
  mitigation, overkill, the final damaging sequence, follower losses, and build
  acquisition history.
- Pause, then **Save & suspend**, downloads a portable JSON run file, attempts a
  local recovery copy, and returns to the title. **Resume saved run** restores
  paused; **Resume** requires a fresh gesture. **Import run file** accepts the
  portable file on another browser/device; **Discard saved run** explicitly
  removes local recovery copies. Collection import/export has its existing flow.
- Saving selects a complete checkpoint at least 30 seconds earlier, normally
  30–31.04 seconds with the one-second capture cadence. Before the first 30
  seconds, it selects the opening checkpoint. Immediately after importing or
  restoring, the earliest available checkpoint is the imported checkpoint until
  another 30 seconds of history exists. Newly acquired items, training, moves,
  recruits, evolutions, XP, coins, healing, and interactions all follow that
  checkpoint; saving never just subtracts time from a newer build.

The original map, seed, position, enemies, chests, shrines, berry trees and other
world state are restored. Time and cooldowns do not advance while the file is
closed. Changing the title's expedition selection does not alter a resumed run.

## Balancing report

Minute samples have nominal minute timestamps, actual observation times, elapsed
window lengths, and observed DPS before critical multipliers, after critical
multipliers, and including Q. Actual HP-removal DPS is also supplied. The first
two measures exclude Q and effects triggered by Q. The last incomplete minute
is a separate window. Build estimates are separately labelled with their
single-target assumptions; they are not measurements of real combat output.
Observed pre-crit DPS removes direct-hit critical multipliers; crit-triggered
procs/statuses retain their observed damage. It is not a second simulation with
criticals disabled.

Each sample includes the full squad, individual levels and move ranks, training,
relic copies/ownership, effective modifiers and synergies, plus live enemy
species/variants/tiers/stages, max-HP/contact-damage/speed ranges, progression
scales, and director pressure, spawn interval, batch size, capacity and spawn
counters. Ordered successful upgrade acquisitions retain simulation timestamps,
rarity, target and source. The final report also includes run rules, seed,
position, POI cooldowns and cumulative run statistics.

Damage attribution is captured at cast/launch time and carried through delayed
projectiles, Q fields, status refreshes, relic effects and enemy death. Burn and
poison retain separate latest-applier ownership. Received damage retains the
recipient and separates leader/follower losses; environmental and self damage
have explicit origins. Unknown sources stay labelled unknown. Reported effective
damage is clamped to HP available; attempted damage, mitigation and overkill
are separate measures. Existing aggregate gameplay counters keep their original
meaning.

Analytics do not draw random numbers or grant rewards. Source aggregation and
recent-hit/acquisition/minute/faint histories have explicit limits and report
dropped entries. This is bounded diagnostic history, not a frame-by-frame replay.
The limits are 2,048 detailed damage groups plus overflow groups, 80 recent hits
with incoming history protected against high outgoing DPS, 100 faint records,
20,000 acquisition records, and 1,440 rolling minute samples. Merged projectile
streams retain bounded provenance contributions while preserving existing pool
matching and combat behavior. Upgrade previews disable acquisition recording on
their projected state so browsing cards cannot write to the real run history.

## Snapshot and recovery contract

`runSnapshot.ts` defines suspended-run and simulation snapshot version 1.
Snapshots explicitly serialize hit sets, both RNG streams, unique IDs, spawn
accumulation, status ownership, movement velocity, director and navigation queues,
projectiles, boss stages/schedules, build counters, pending choices/rewards,
analytics, and run achievement accounting. Renderer/audio objects and held input
are excluded. A restored pending choice grants nothing until selected; restored
evolution reward deferral is released once without requiring a missing cosmetic
transition.

Up to 33 in-memory checkpoints are captured at roughly one-second simulation
intervals. Browser recovery writes occur every 30 seconds of active simulation
and on page hide, using the same rollback rule. A previous valid storage slot is
retained before replacing the current slot; damaged current storage can fall
back to it. Death clears this run's recovery copy. Starting another run leaves a
different saved expedition available until explicitly replacing or discarding it.

Import validates version, JSON bounds, finite numbers, known content IDs,
authoritative state shapes, damage metadata and run identity before replacing a
live run. Files are limited to 12 MB. Browser quota/read/write failure leaves
the live session usable; explicit saving still offers the downloaded file and
an in-memory copy. Collection rewards remain monotonic, while stable run IDs and
restored accounting prevent repeated resume/result calls from counting a run or
victory twice in the existing bounded recent-run ledger.

## Changed code

- `src/game/analytics.ts`, combat modules, `Simulation.ts`, `types.ts`,
  `systems/builds.ts` and `systems/progression.ts`: damage provenance, accounting,
  acquisition history and minute samples.
- `src/game/runSnapshot.ts`, `runStorage.ts`, `utils/random.ts`,
  `systems/navigation.ts`, `achievements.ts` and `Simulation.ts`: explicit snapshot
  and recovery lifecycle.
- `src/game/Game.ts`, `src/ui/UI.ts`, `damageAnalysis.ts`, `runFiles.ts` and
  `runAnalysis.css`: local file controls, fresh-gesture restoration, and results.
  `upgradePreview.ts` isolates projections from real acquisition history.
- Targeted unit/browser tests cover attribution, state continuity, corruption,
  local storage failures and the actual download/import/resume controls.

## Verification

Baseline: 531/531 unit tests, TypeScript and the existing live-telemetry browser
test passed before implementation.

- `npm.cmd test`: **552/552 passed**, 90.98 seconds while browser/build checks
  were also running. Includes exact seeded continuation through JSON restoration,
  both future RNG streams, navigation FIFO, interrupted evolution, pending rewards,
  boss/endless state, complete rollback, malformed imports and storage failure.
- `npm.cmd run typecheck`: **passed**.
- `npm.cmd run build -- --configLoader runner`: **passed**, 15.07 seconds;
  main chunk 6,507.04 kB / 1,476.93 kB gzip. The existing large-chunk advisory
  remains.
- `npm.cmd run test:browser -- tests/browser/run-continuity.spec.ts tests/browser/ui.spec.ts tests/browser/game.spec.ts`:
  **7/7 passed**, 2.6 minutes. The three new browser cases verify downloaded JSON,
  a 71-second timeline rolling back recent relics while preserving older relics,
  position and shrine/chest cooldowns, reload/import/discard, corrupt-import
  preservation, paused time/capture/audio lifecycle, and a restored pending choice
  granting its reward exactly once. The report case reconciles real automatic
  attacks, critical hits, Surf, Echo Bell, a follower faint and a lethal enemy hit.
  Existing cases cover pause/input, ten restarts, victory/endless continuity,
  ten simulated minutes and UI choices/settings.
- Additional in-memory boss/self-damage probe: a huge hit advanced exactly one
  boss stage, effective damage equalled measured HP loss, stage-gated damage was
  classified as mitigation, and Life Orb self-damage retained its source.

The full regression run first exposed live analytics being shared into the
existing shallow upgrade preview projection. That was fixed by excluding
analytics from the projection; the existing non-mutation tests now pass. New
analytics tests independently reconcile effective damage, armor, invulnerability,
deflection, overkill, follower faint, delayed/source-death ownership, crit/proc
accounting, source aggregation limits, acquisition ordering and minute samples.
A 900-frame comparison produces identical gameplay state and RNG with analytics
enabled or disabled.

Browser artifacts in ignored `artifacts/browser/` include
`suspended-run.json`, `defeat-balancing-report.json`, `f5-restored-pause.png`,
`s4-results.png` and `s4-results-small.png`. These are scripted correctness and
readability checks; they do not establish human balance or target-device GPU
performance. Results tables were visually inspected at 1440×900 and 390×844;
the narrow viewport had no horizontal overlay overflow. Test/build logs are
`artifacts/s4-f5-tests-final.log` and `artifacts/s4-f5-build-final.log`.

## Limits and follow-up

Local JSON files are editable and copyable; this is a single-player continuity
feature, not an anti-cheat or cloud account system. A user can intentionally
reimport an older downloaded file. Snapshot version changes require an explicit
migration; incompatible files are rejected without overwriting collection data.
Very long endless runs can exceed browser storage quota or the file-size limit;
failures are surfaced, and downloaded files should be kept for portability.
Minute sampling and checkpoint work add bounded CPU/memory overhead. No combat
tuning, new stat limits, controls redesign, or art changes are part of this work.
