# Visual overhaul — Stages 03 and 04

Implemented together on 2026-10-22, with testing after both stages as requested. The [Stage 00 baseline](VISUAL_OVERHAUL_BASELINE.md) and [Stages 01–02 report](VISUAL_OVERHAUL_STAGES_01_02.md) describe the preceding work.

## Art and scope

Visually inspected the original [rock](ART_OVERHAUL/references/03_rocks_elevation.png), [ground-detail](ART_OVERHAUL/references/04_ground_details.png), [Wildlands](ART_OVERHAUL/references/wildlands_biome.png), [pine](ART_OVERHAUL/references/pine_biome.png), and [volcanic](ART_OVERHAUL/references/volcanic_biome.png) PNGs. Followed their faceted stone, size hierarchy, muted colors, open clearings and simple sparse plants. The generated images' large cliffs, dense grass, lava and elaborate scenery do not override the written primitive, traversal and performance constraints.

**Stage 03:** ordinary rocks now form seeded groups of 2–5, using the existing faceted mesh and per-map stone material. Three shared scale classes are `.65`, `1.05`, and `1.75`; each group's first rock is medium or an occasional anchor. Cluster caps, group sizes and spread live in `MapDefinition.rocks`. Pine favors woodland gaps; Volcanic favors existing elevated ground and has the most groups. Authored Watchstones, Sun Stones and Ash Spire retain their original placement and size.

The existing terrain already supplies broad, walkable ridges. Its height function and mesh remain unchanged. A bounded pass replaces only ordinary rock positions and corresponding circle proxies after the established generation pass has finished. This retains its RNG consumption, trees, harvest selection, ruins, POIs, tactical features and landmark positions. Each new rock's collider radius is `1.25 * scale`, matching the shared source mesh. Its base uses the authoritative terrain sampler. Opening enemy spawn ring, player start, dry approaches, current/future POIs, tactical features, shore and other collision objects are excluded.

**Stage 04:** static tufts have three triangular blades; each flower has four flat petals and one short stem, with two flowers per clump; mushrooms have a short stem and seven-sided cap; stumps are single six-sided cylinders; volcanic chips reuse a 20-face faceted primitive. Vertex colors permit one opaque shared material per class. Active classes use one merged template and one thin-instance batch each, without textures, alpha blending, animation, tiny shadows or frame-time generation. Details never enter the simulation's props, colliders or interaction data. Both mesh picking and thin-instance picking are disabled.

`systems/surfaceDetails.ts` uses an isolated seeded RNG, bounded attempts, patch/group bias and the same new scenery clearance mask as rocks. It samples terrain height and rejects abrupt local slopes. Flowers can sit near existing berry groves; mushrooms and stumps stay in Pinewood's woodland regions. Volcanic receives only dark chips. Low quality hides all new details; balanced/high show them. `world.setGroundDetailsVisible(false/true)` supplies an unsaved presentation toggle for comparisons, respects Low quality, and never regenerates the world. Sources, buffers and materials belong to `World` and are disposed on unload.

## Tunable budgets

Counts below are whole-map caps, not per-screen targets. Placement may yield fewer objects if clear space is unavailable. Tuft and flower caps count clumps. The reference seeds reached all detail caps.

| Map / reference seed | Rock groups cap | Group size | Group spread | Ordinary rocks before → after | Tufts | Flowers | Mushrooms | Stumps | Chips | Detail batches |
|---|---:|---|---:|---|---:|---:|---:|---:|---:|---:|
| Wildlands / 4 | 14 | 2–5 | 5.5 | 153 → 59 | 100 | 18 | 0 | 0 | 0 | 2 |
| Pinewood / 46837 | 10 | 2–4 | 5 | 158 → 30 | 80 | 0 | 24 | 7 | 0 | 3 |
| Ruins / 81073 | 16 | 2–5 | 5.5 | 115 → 61 | 80 | 12 | 0 | 0 | 0 | 2 |
| Volcanic / 4 | 26 | 3–5 | 6 | 326 → 102 | 0 | 0 | 0 | 0 | 90 | 1 |

Colors and detail budgets live in `MapDefinition.surfaceDetails`. No map IDs, authored seeds, enemy budgets, save data, gameplay rules or dependencies changed.

## Verification

The updated historical fixtures still verify exact POIs, non-rock props/proxies, tactical features, berry state and terrain heights against pre-edit data. Ordinary rock hashes were intentionally replaced by non-rock preservation hashes captured before this task; new tests validate the changed rocks' sizes, grouping, bounds, proxies and exclusions instead. Existing world geometry limits retain their original allowance plus exactly one geometry per active detail batch.

- `npm.cmd run typecheck`: passed.
- `npm.cmd run build -- --configLoader native`: passed; existing large-bundle warning.
- `npm.cmd test`: **515/515 passed**, including deterministic rock/detail generation, opening spawn ring, POI/route/feature clearances, shared geometry, picking, quality toggles, per-frame resource stability and repeated cleanup.
- Initial targeted visual browser pass: **5/5 passed** across all four maps and berry reward/regrowth behavior.
- Full `npm.cmd run test:browser`: **93 passed / 22 failed** in 16.7 minutes. Five failures were environment setup errors before a page could open: Playwright's video helper was absent. Installed only the FFmpeg/Winldd test binaries under ignored `artifacts/playwright-browsers`, then reran all five locomotion scenarios: **5/5 passed**. No package/dependency/lockfile changes. Across the 115 scenarios, **98 pass and 17 existing failures remain**.
- The four-map visual/browser scenarios passed again after improving capture sightlines: **4/4 passed**. Berry collection, reward, observed regrowth, pointer capture, jump/dodge, all four fixed-seed Wildlands/Volcanic traversal cases, ten simulated minutes of movement, actual chest/shrine interactions, boss/endless rendering, above-budget combat effects and ten real resource-clean restarts passed in the full suite.

### Existing browser failures

Saved pre-task copies of `maps.ts`, `world.ts`, `environment.ts` and `World.ts` were run in an isolated source copy on port 5174, without restoring or changing the working tree. The following failures reproduce independently of Stages 03–04:

| Scenarios | Count | Existing issue / evidence |
|---|---:|---|
| `auto-aim.spec.ts:28` | 1 | Test searches for a `primary` projectile label that is now a named move. Same undefined-target assertion before this task. |
| `chests-movement.spec.ts:37,48` | 4 | Discovery glow handle is absent; three species resolve Walk instead of the expected Run sheet. Same failures before this task. |
| `combat.spec.ts:149` | 1 | Old 111-unit bound assertion conflicts with the expanded map; both builds report 120.767. |
| `evolution-terrain.spec.ts:32,58,73` | 3 | Older evolution menu/gain/restart selectors and expectations fail in both source versions. |
| `game.spec.ts:17` | 1 | Older end/restart UI expectation fails before this task too. |
| `game.spec.ts:88` | 1 | Intermittent extra reward overlay after boss/endless transition: **2 passed / 1 failed in three isolated repeats on each source version**, at the same capture/overlay assertion. |
| `phase14.spec.ts:9`, `phase15.spec.ts:11,30`, `phases.spec.ts:42,73` | 5 | Existing collection/evolution/discovery/boss assertions; the last expects 120 HP while the current starter has 105.6. All reproduce before this task. The two Phase 15 failures were also recorded in Stage 00. |
| `roster.spec.ts:4` | 1 | Old text expects Splash Shot; both current and pre-task menus display Tackle for Magikarp, with no world loaded. The 151-species/six-variant checks preceding that assertion completed. |

Raw evidence: [full suite log](../artifacts/visual-overhaul/stage-03-04/browser-all.log), [locomotion rerun](../artifacts/visual-overhaul/stage-03-04/locomotion.log), [baseline chest/gallop log](../artifacts/visual-overhaul/stage-03-04/baseline-browser.log), [baseline diagnostics](../artifacts/visual-overhaul/stage-03-04/baseline-diagnostics.log), [baseline extra cases](../artifacts/visual-overhaul/stage-03-04/baseline-extra.log), [baseline HP case](../artifacts/visual-overhaul/stage-03-04/baseline-hp.log), [baseline camera repeats](../artifacts/visual-overhaul/stage-03-04/baseline-camera.log), [current camera repeats](../artifacts/visual-overhaul/stage-03-04/current-camera.log), and [roster comparison](../artifacts/visual-overhaul/stage-03-04/roster-diagnostic.json). The first baseline auto-aim attempt timed out during setup; its later diagnostics run reproduces the actual assertion failure. These unrelated gameplay/UI/asset expectations were left unchanged.

Reproduce the video-enabled suite after the local binary install:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'artifacts\playwright-browsers'
npm.cmd run test:browser
```

## Evidence and recovery

Normal-camera comparison pairs use `artifacts/browser/stage-03-04-<map>-<spawn|forest|rocks>-details-<on|off>.png`, with additional shoreline pairs. The same camera, scenery, simulation state and terrain are retained when toggling details. The capture helper also records live gameplay, ridges, shoreline, deterministic counts, source fingerprints and same-state detail timing/draw calls under `artifacts/visual-overhaul/stage-03-04/`.

Opened the final gameplay, ridge, rock-group, woodland and shore screenshots and compared them with the original primary and biome references. Corrected the capture sightlines where an existing Great Pine, POI or map edge obscured the subject, without changing world placement or camera angles. Rock groups have visible size hierarchy and clear surroundings; mushroom/tuft/chip accents remain subordinate to sprites and reward objects. Opening combat clearings and shore approaches stay bare. Dense forest composition and POI set dressing remain for their later stages.

| Map | Opening / gameplay | Stone groups | Details on / off |
|---|---|---|---|
| Wildlands | [Opening](../artifacts/visual-overhaul/stage-03-04/wildlands-spawn.png), [gameplay](../artifacts/visual-overhaul/stage-03-04/wildlands-gameplay.png) | [Rocks](../artifacts/browser/stage-03-04-wildlands-rocks-details-on.png) | [On](../artifacts/browser/stage-03-04-wildlands-forest-details-on.png), [off](../artifacts/browser/stage-03-04-wildlands-forest-details-off.png) |
| Pinewood | [Opening](../artifacts/visual-overhaul/stage-03-04/pinewood-route-spawn.png), [gameplay](../artifacts/visual-overhaul/stage-03-04/pinewood-route-gameplay.png) | [Rocks](../artifacts/browser/stage-03-04-pinewood-route-rocks-details-on.png) | [On](../artifacts/browser/stage-03-04-pinewood-route-forest-details-on.png), [off](../artifacts/browser/stage-03-04-pinewood-route-forest-details-off.png) |
| Ruins | [Opening](../artifacts/visual-overhaul/stage-03-04/ruins-route-spawn.png), [gameplay](../artifacts/visual-overhaul/stage-03-04/ruins-route-gameplay.png) | [Rocks](../artifacts/browser/stage-03-04-ruins-route-rocks-details-on.png) | [On](../artifacts/browser/stage-03-04-ruins-route-forest-details-on.png), [off](../artifacts/browser/stage-03-04-ruins-route-forest-details-off.png) |
| Volcanic | [Opening](../artifacts/visual-overhaul/stage-03-04/volcanic-ridge-spawn.png), [gameplay](../artifacts/visual-overhaul/stage-03-04/volcanic-ridge-gameplay.png) | [Rocks](../artifacts/browser/stage-03-04-volcanic-ridge-rocks-details-on.png) | [On](../artifacts/browser/stage-03-04-volcanic-ridge-forest-details-on.png), [off](../artifacts/browser/stage-03-04-volcanic-ridge-forest-details-off.png) |

Each map's capture folder also contains `-ridge.png`, `-shore.png` and `-shore-details-on/off.png`. The final helper confirms identical repeated layouts, expected detail budgets, keyboard movement/jump/dodge, complete pause, and **zero page errors on all four maps**. All recorded source fingerprints match the final implementation files.

## Measured performance

[Raw metrics](../artifacts/visual-overhaul/stage-03-04/metrics.json) and [capture log](../artifacts/visual-overhaul/stage-03-04/capture.log). These separate captures ran after all browser tests ended, using the same setup as Stages 01–02: Chrome SwiftShader software WebGL, High quality, 1440×900, DPR 1, local PMD sheets, 120 early active frames with natural enemies, seed 4 on random maps and the routes' authored seeds. Live actors/effects vary, so resource counts are diagnostic rather than exact static-world totals.

| Map | Mean draws: Stages 01–02 → 03–04 | Mean frame interval, ms: before → after | Final p95 interval, ms | Final meshes / geometries / materials |
|---|---|---|---:|---|
| Wildlands | 81.19 → 83.31 | 32.93 → 33.77 | 56.00 | 1608 / 48 / 80 |
| Pinewood | 95.82 → 98.89 | 27.85 → 28.89 | 45.80 | 1593 / 46 / 78 |
| Ruins | 94.40 → 96.55 | 29.51 → 30.29 | 36.20 | 1738 / 45 / 77 |
| Volcanic | 76.20 → 77.31 | 30.10 → 30.66 | 35.00 | 2134 / 39 / 71 |

The extra details cost exactly **2 / 3 / 2 / 1 draws** in a separate 80-frame on/off comparison at the same paused shoreline state and camera. Ordered on/off mean interval differences were +2.08 / −0.16 / +1.16 / +0.12 ms respectively. Geometry and material overhead is one per active detail class; rock instance counts fall substantially. Software timing is noisy: p95 worsened on some maps, and these samples do not establish target-GPU or late-wave FPS. No human three-minute free-roam session or target-hardware GPU benchmark was performed; automated traversal, combat/boss coverage and above-budget browser rendering are the available regression evidence.

Reproduce the capture with the dev server already running and other browser tests stopped:

```powershell
$env:WILDLANDS_CAPTURE_DIR = 'artifacts/visual-overhaul/stage-03-04'
node scripts/visual-overhaul-baseline.mjs
```

Main implementation files: `src/data/maps.ts`, `src/data/world.ts`, `src/game/systems/environment.ts`, `src/game/systems/surfaceDetails.ts`, `src/game/render/World.ts`, and `src/game/render/groundDetails.ts`. Verification changes: `tests/scenery.test.ts`, `tests/visual-overhaul.test.ts`, `tests/world.test.ts`, `tests/browser/visual-overhaul.spec.ts`, and `scripts/visual-overhaul-baseline.mjs`.

Pre-edit copies of overlapping files and the non-rock fixture hashes are in `artifacts/visual-overhaul/stage-03-04/before/`. This ignored artifact directory is a task-specific recovery copy, not a full-worktree checkpoint. Preserve the user's pre-existing balance/catalogue work and earlier art stages when reverting changes. No commit was created.
