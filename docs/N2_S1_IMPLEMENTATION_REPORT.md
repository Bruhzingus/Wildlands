# N2 / S1 implementation handoff

Implemented October 21, 2026. N2 adds a paused evolution presentation; S1 changes
terrain composition within the existing map bounds. Artistic acceptance still
needs the owner's playtest feedback.

## Behavior and decisions

Evolution is committed once by the existing progression rules. The simulation
emits a detached receipt containing the old/new species, stable UID, actual
maximum HP, permanent attack bonus, retained level/XP, final move ranks and any
signature merge. Leader HP comes from the combat player state; follower HP comes
from the member. Receipts never apply rewards or hold mutable move references.

The world retains the old avatar at its old species size and foot anchor, holds
it for at least 0.3 seconds, then crossfades to the new avatar over 0.65 seconds.
A slow sheet can hold the old body for up to 1.4 seconds before transitioning to
visible fallback art. Sheets arriving later join the current pose, dimensions,
anchor and opacity. Reduced motion uses a calm 0.25-second fade and static UI.
This reuses native sprites and the existing restrained evolution audio accent.

During the confirmation, combat, cooldowns, projectiles, progression, world time
and normal animation remain paused. Only the cosmetic transformation advances.
The player can skip it with Resume (click or Enter); existing mouse capture must
succeed before combat resumes. If another reward is queued, Next reward reveals
that choice while remaining paused. Number keys cannot select hidden choices.
Blur silences audio; hidden documents stop the transition clock. New run disposes
the retained avatar and pending loads through the existing run lifecycle.

Maps now combine elongated woodland/ruins ridges, an elevated meadow clearing, a
seeded valley/saddle and a raised outer water edge. Three structural compositions
change ridge orientation, saddle location and four shared trail junctions
independently of map rotation. Twenty seeded scenery cluster centers mix groves
and rock groups with sparse scatter. Biome boundaries bend slightly; vertex
colors blend neighboring regions and expose high ground. Lower environment
lighting makes slopes and primitive silhouettes more legible.

Terrain, props, actors, site placement and minimap regions continue to use the
shared seeded profile. Routes branch through junctions, detour around the real
lake and reserve full collision clearance. Spawn is level inside 17.5 world
meters, blending smoothly into relief. Map dimensions remain 287.5 × 287.5 m;
the prop, collision, enemy and effect budgets are unchanged. The fixed Pinewood
and Ruins seeds remain repeatable but their geography changes in this version.

## Changed files

- `src/game/evolution.ts`, `Simulation.ts`: observational evolution receipts.
- `src/game/Game.ts`: paused presentation, input/capture and audio lifecycle.
- `src/game/render/AssetLibrary.ts`: bounded retained avatars and opacity.
- `src/ui/UI.ts`, `evolution.css`: forms, actual gains, focus and confirmation.
- `src/data/maps.ts`, `src/game/systems/environment.ts`: composed terrain,
  clustered scenery, seeded region boundaries and branching dry routes.
- `src/game/render/World.ts`: blended ground colors and map-owned lighting.
- `tests/evolution-presentation.test.ts`, `terrain-composition.test.ts`: new
  deterministic reward, pause, slope, seed and route checks.
- `tests/environment.test.ts`, `world.test.ts`: new relief range and Float32
  coordinate tolerance (4 millionths of a world meter rather than 1 millionth).
- `tests/browser/evolution-terrain.spec.ts`: new real Chrome/WebGL flows.
- `tests/browser/phase15.spec.ts`: replace a stale absolute arrival-interval
  expectation with the actual Onslaught-to-Standard ratio of 0.8.
- `IMPROVEMENT_DOC.md`, `GAME_DESIGN_AND_ROADMAP.md`, this handoff.

## Verification

- Baseline `npm.cmd test`: **399/399 passed**.
- Baseline browser progression/phase-15 checks: 8/10 passed. One assertion used
  obsolete spawn pacing; one navigation was interrupted by a development reload.
  Both cases passed in the subsequent complete focused browser run.
- `node --experimental-strip-types --test tests/evolution-presentation.test.ts tests/terrain-composition.test.ts tests/environment.test.ts tests/world.test.ts tests/phase15.test.ts`:
  **22/22 passed**.
- `npm.cmd test`: **407/407 passed**.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build -- --configLoader runner`: passed; the existing large-chunk
  advisory remains. The runner avoids the previously observed config-bundler
  sandbox issue.
- `npx.cmd playwright test tests/browser/evolution-terrain.spec.ts tests/browser/pokemon-progression.spec.ts tests/browser/phase15.spec.ts tests/browser/world-boss.spec.ts tests/browser/game.spec.ts`:
  **23/23 passed**, including ten restarts, ten simulated minutes, both bosses,
  victory/endless, map regions, discovery interaction and original progression UI.
- The final leader-HP receipt and keyboard-resume refinements were followed by
  another **407/407** unit run, successful typecheck/build and **3/3** evolution
  browser cases (`node node_modules/@playwright/test/cli.js test tests/browser/evolution-terrain.spec.ts --grep 'freezes authority|first/final|missing evolution'`).

New browser checks inspect Charmander → Charmeleon, follower Charmeleon →
Charizard and all three Eevee branches, including a learned Flame Burst merge,
simultaneous squad rewards, exactly one audio cue, complete state freeze,
slow/missing local sheets, unavailable remote assets, narrow layout, early skip,
and restart both during and after the transformation. Missing artwork remains a
visible generated fallback. Unit checks reject stale/fainted evolution and verify
that receipts cannot change RNG, HP fraction, XP, ranks, IDs or grant accounting.

For both environment families, seeds 4 and 808 are asserted in the browser.
Checks use ordinary WASD, then scripted normal-speed movement along a complete
route to an elevated site, without jump or dodge. Existing collision tests walk
every site on all four maps across six seeds; placement checks still cover 250
seeds. Sampled gradients remain below 0.85 rise/run across the tested profiles;
representative dense samples measure up to about 0.68 on Volcanic Ridge.
Rendering checks compare shared heights, site anchors, map extent, timed sites
and complete world disposal. Minimap projection and world-edge tests pass.

Local evidence is ignored under `artifacts/`: `n2-s1-tests-final.log`,
`n2-s1-build-final.log`, `n2-s1-browser-final.log`, `n2-s1-evolution-final.log`,
the focused/lighting logs, `n2-s1-compare.log` and renderer measurements.

## Captures, cost and limits

Evolution captures: `artifacts/browser/n2-before-choice.png`,
`n2-transformation.png`, `n2-after-evolution.png` and
`n2-missing-art-mobile.png`. Terrain captures are
`artifacts/browser/s1-{wildlands|volcanic-ridge}-{4|808}-{ridge|shore}.png`.
Matched seed-4 comparisons restore the pre-change world modules from Git and
use the same camera, species and local coordinates:
`s1-compare-{wildlands|volcanic-ridge}-4-{ridge|shore}-{before|after}.png`.
Comparison captures retain the current HUD. Captures were visually inspected.

Terrain stays at **13,689 vertices / 17 shared world geometries**, with at most
820 props and two environment lights. NullEngine world-only mesh counts:

| Family / seed | Before | After |
| --- | ---: | ---: |
| Wildlands / 4 | 1,325 | 1,318 |
| Wildlands / 808 | 1,324 | 1,337 |
| Volcanic Ridge / 4 | 1,204 | 1,234 |
| Volcanic Ridge / 808 | 1,206 | 1,233 |

The difference comes from tree instances having separate trunks/crowns, not an
increased prop ceiling. In the sequential NullEngine probe, construction changed
from 65–148 ms to 81–153 ms; extra terrain/color evaluation is paid mainly at
construction. These are single local measurements, with warm-up variance.
Browser scene-render timings and resources are recorded in
`artifacts/n2-s1-render-comparison.json`. A separate 90-frame seed-4 sample after
shader readiness/warm-up measured median / p95 submission times in milliseconds:

| Family | Before | After |
| --- | ---: | ---: |
| Wildlands | 1.5 / 3.7 | 0.9 / 12.9 |
| Volcanic Ridge | 4.0 / 27.5 | 3.2 / 5.1 |

The inconsistent tails show local scheduling variance. SwiftShader CPU submission
timing is not a target-GPU frame-rate benchmark or evidence of a performance improvement.
An evolution retains at most one extra sprite per transitioning member, with no
additional world geometry, gameplay entities or simulation timers.

No combat values, evolution prerequisites, reward formulas, automatic targeting,
follower movement or controls were retuned. Longer branching exploration paths
and different scenery placement can change encounter positioning. Terrain remains
traversable smooth hills rather than cliffs or platforming. This is still two
environment families using the existing primitive kit. Missing assets can use
fallback art before late native sheets join; no new transformation artwork was
authored. No human balance/comfort session, artistic sign-off or target-hardware
GPU benchmark was performed. S2 enemy/terrain interactions and S3 exploration
extensions remain separate future work. Upgrade mechanics did not change, so the
owner's upgrade catalogue was preserved.
