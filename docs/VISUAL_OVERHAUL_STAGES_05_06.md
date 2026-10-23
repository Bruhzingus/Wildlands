# Visual overhaul — Stages 05 and 06

Implemented together on 2026-10-23, with verification after both stages. Earlier work: [Stages 03–04](VISUAL_OVERHAUL_STAGES_03_04.md), [Stages 01–02](VISUAL_OVERHAUL_STAGES_01_02.md), and the historical [Stage 00 baseline](VISUAL_OVERHAUL_BASELINE.md).

## Reference review and scope

Opened the original [landmark](ART_OVERHAUL/references/05_landmarks.png), [atmosphere](ART_OVERHAUL/references/06_atmosphere.png), [Wildlands](ART_OVERHAUL/references/wildlands_biome.png), [pine](ART_OVERHAUL/references/pine_biome.png), and [volcanic](ART_OVERHAUL/references/volcanic_biome.png) PNGs before implementation. Used the simple stone settings, quiet earth clearings, warm/cool biome tints and soft distant haze. The reference's large structures, dramatic sun, long shadows and dense props do not override the written primitive and combat-readability limits.

All four existing map IDs, authored seeds, scenery/collision generation, terrain heights, berry trees and fruit, POI IDs, minimap coordinates, timers, rewards and gameplay logic remain intact. No new gameplay system, dependency, model, texture, UI setting or save field was added.

## Stage 05: small landmark settings

`systems/landmarkDressing.ts` derives a deterministic cosmetic setting after existing POIs and berry trees have been placed. Each shrine has up to four low hexagonal pavers and two uneven faceted standing stones. Caches have two small stones and two plant accents. Existing berry trees receive two tiny plant clumps and two stone accents; no harvest tree is added. Plants reuse the existing flower, woodland mushroom or volcanic charcoal template. Original shrine sculptures, tier dust, hazards, chest geometry and fruit stay authoritative focal objects.

The current generator places caches and shrines, plus independent harvest trees. There is no separate elite-arena POI to invent. The existing healing POI type is supported by the same quiet paver setting when supplied, but no healing station is spawned by this change. Existing shrine trials retain their combat rules and boundaries.

Settings use one additional shared paver geometry and one muted stone material. Stone and plant geometry is shared with the existing factories; the plant template clone explicitly excludes thin-instance buffers. Every setting has its own `dressing-<kind>-<uid>` root. Pieces are non-pickable, non-collidable, do not cast/receive tiny shadows, and never enter interaction or collision registries. Per-piece terrain sampling grounds the parts; pavers tilt to the local slope. Water, existing obstacles, tactical features, other POIs and a clear approach strip are excluded. The approach faces the final segment of the site's existing dry route.

Subtle soil clearings are baked into the existing terrain vertex colors. Two cached color buffers let `world.setLandmarkDressingVisible(false/true)` remove/restore the soil and meshes without regenerating gameplay or allocating new geometry. Soil footprints remain in the terrain after a site is spent; physical setting visibility follows the original site lifecycle: future sites stay hidden, free caches disappear when spent, paid caches remain while restocking, and shrine settings follow their existing marker availability. Grove accents remain static through fruit cycles.

| Tuning in `MapDefinition.dressing` | Value |
|---|---|
| Shrine footprint radius | 5.2 world units |
| Cache footprint radius | 3.6 |
| Berry-tree footprint radius | 4.2 |
| Clear approach width | 2.4 |
| Maximum added pieces per shrine / cache / tree | 6 / 4 / 4, fewer if excluded |
| Soil color | Existing biome earth color |
| Soil strength, Wildlands / Pine / Ruins / Volcanic | .58 / .52 / .58 / .50; grove masks use half strength |
| Dressing stone, Wildlands/Ruins / Pine / Volcanic | `#677064` / `#616d68` / `#4e474b` |

## Stage 06: run-time atmosphere

`data/atmosphere.ts` defines independent Wildlands, Pine and Volcanic curves, selected through the existing map definition; Ruins shares the Wildlands curve. Common key times are **0, 5, 10, 13 and 15 minutes**. A pure smoothstep sampler interpolates precompiled colors into caller-owned objects. It clamps negative/invalid input and holds the last dusk phase indefinitely in endless mode, with no 15-minute discontinuity.

`render/atmosphere.ts` adjusts the existing ambient and directional lights, scene background and linear fog. It uses only authoritative elapsed run time already passed to `World.update`; no browser clock, timer, observer, sun model, shadow maps or postprocess is added. Repeating the same elapsed time skips work. Foreground fog starts at 44–60 units; far fog ends at 165–220 depending on biome and phase. Dusk retains at least 92% of base ambient intensity in Wildlands, 94% in Pine/Volcanic, and 84–87% of base sunlight, with gentle color changes. Sprite materials, variant colors and nearest-neighbor filtering remain unchanged.

The game's existing active-run update gate freezes the atmosphere through pause, choice screens and results; hit-stop also holds its authoritative time. `world.setAtmospherePreview(seconds)` previews a phase without changing simulation or saves; `null` returns to the current run time. `world.inspectAtmosphere()` exposes read-only diagnostic values. Disposal restores the scene's previous sky, fog color, mode, distances and density, and the original world cleanup releases its lights.

## Verification and evidence

These results describe the completed **Stages 05–06 source snapshot**. After its successful final build/unit/browser runs, concurrent Stages 07–08 and movement edits changed shared files and interrupted a repeat live-server capture through hot reload. Those edits were preserved. Remaining measurements use ignored `artifacts/visual-overhaul/stage-05-06/verified-snapshot` on port 5186; all 15 recorded implementation/runtime/lockfile fingerprints match the completed pre-concurrency capture exactly ([snapshot validation](../artifacts/visual-overhaul/stage-05-06/snapshot-validation.json)). This report does not claim to validate the later concurrent edits.

- `npm.cmd run typecheck` and `npm.cmd run build -- --configLoader native`: passed; existing large-bundle warning.
- `npm.cmd test`: **520/520 passed**, including deterministic settings, approach/size constraints, exact preservation fixtures for existing gameplay generation, source/material reuse, zero per-frame resource growth, POI visibility, preview isolation, interpolation boundaries, pause/choice/result freeze, endless continuity, restart cleanup and restoration of previous scene fog/sky.
- New four-map browser scenarios: **4/4 passed**. Each walks existing collision-aware routes to free/paid caches and shrines, opens the caches, verifies costs/rewards, completes a shrine through the real damage/reward path, collects a berry, checks spent/restock visibility, and checks actual reward-choice and pause freezes. Preview captures preserve run time, save state, camera, sprite colors/filtering and allocated resource counts.
- **43/43 selected browser regressions passed**: shared vegetation/terrain/berry rendering, all six pointer/camera cases, combat windup and thrown-projectile readability, native attack/effect compilation and pause, shrine/chest interaction, collision-aware traversal for two seeds per terrain family, held input, flying/jumping/dodging, quality settings, ten actual resource-clean restarts, above-budget rendering, boss/endless behavior and all five video-enabled locomotion scenarios. [Raw regression log](../artifacts/visual-overhaul/stage-05-06/regressions.log).
- This stage ran the full unit suite and **47 targeted browser scenarios**, followed by a refresh of the four new captures after the final stone-color adjustment. The full browser suite was not repeated. Its 17 previously verified existing failures are documented in the [Stages 03–04 report](VISUAL_OVERHAUL_STAGES_03_04.md#existing-browser-failures); those unrelated gameplay/UI expectations were not changed here. The three known failing evolution-menu cases in the selected terrain spec were explicitly excluded.

The new browser cases save raw per-map validation as `artifacts/visual-overhaul/stage-05-06/<map>-validation.json`, plus these normal-camera images:

- `<map>-spawn-0m/7m/12m/15m.png` and matching shoreline/elevated-ridge views.
- `<map>-shrine/cache/grove-dressing-on/off.png`, at identical camera positions.
- `<map>-combat-15m.png`, showing a real Egg Bomb windup and PMD sprites at dusk.

The preview filename records atmosphere time; the HUD's timer intentionally remains at the unchanged authoritative run time. Pre-existing scenery is not removed and camera angles/zoom are not adjusted to make the captures look better.

Opened the final captures and compared them with the original primary/biome targets. The added stone was darkened after review so pavers stay secondary to the existing shrine sculpture. Elevated views make the sky progression visible without changing the normal camera. Foreground sprites, type-colored berries, chest silhouettes, attack labels and the red Egg Bomb warning remain readable at dusk. All four maps have zero page errors in the complete capture and new browser scenarios.

| Map | Shrine setting on / off | Morning / 7m / 12m / dusk | Dusk combat |
|---|---|---|---|
| Wildlands | [On](../artifacts/visual-overhaul/stage-05-06/wildlands-shrine-dressing-on.png), [off](../artifacts/visual-overhaul/stage-05-06/wildlands-shrine-dressing-off.png) | [0m](../artifacts/visual-overhaul/stage-05-06/wildlands-ridge-0m.png), [7m](../artifacts/visual-overhaul/stage-05-06/wildlands-ridge-7m.png), [12m](../artifacts/visual-overhaul/stage-05-06/wildlands-ridge-12m.png), [15m](../artifacts/visual-overhaul/stage-05-06/wildlands-ridge-15m.png) | [View](../artifacts/visual-overhaul/stage-05-06/wildlands-combat-15m.png) |
| Pinewood | [On](../artifacts/visual-overhaul/stage-05-06/pinewood-route-shrine-dressing-on.png), [off](../artifacts/visual-overhaul/stage-05-06/pinewood-route-shrine-dressing-off.png) | [0m](../artifacts/visual-overhaul/stage-05-06/pinewood-route-ridge-0m.png), [7m](../artifacts/visual-overhaul/stage-05-06/pinewood-route-ridge-7m.png), [12m](../artifacts/visual-overhaul/stage-05-06/pinewood-route-ridge-12m.png), [15m](../artifacts/visual-overhaul/stage-05-06/pinewood-route-ridge-15m.png) | [View](../artifacts/visual-overhaul/stage-05-06/pinewood-route-combat-15m.png) |
| Ruins | [On](../artifacts/visual-overhaul/stage-05-06/ruins-route-shrine-dressing-on.png), [off](../artifacts/visual-overhaul/stage-05-06/ruins-route-shrine-dressing-off.png) | [0m](../artifacts/visual-overhaul/stage-05-06/ruins-route-ridge-0m.png), [7m](../artifacts/visual-overhaul/stage-05-06/ruins-route-ridge-7m.png), [12m](../artifacts/visual-overhaul/stage-05-06/ruins-route-ridge-12m.png), [15m](../artifacts/visual-overhaul/stage-05-06/ruins-route-ridge-15m.png) | [View](../artifacts/visual-overhaul/stage-05-06/ruins-route-combat-15m.png) |
| Volcanic | [On](../artifacts/visual-overhaul/stage-05-06/volcanic-ridge-shrine-dressing-on.png), [off](../artifacts/visual-overhaul/stage-05-06/volcanic-ridge-shrine-dressing-off.png) | [0m](../artifacts/visual-overhaul/stage-05-06/volcanic-ridge-ridge-0m.png), [7m](../artifacts/visual-overhaul/stage-05-06/volcanic-ridge-ridge-7m.png), [12m](../artifacts/visual-overhaul/stage-05-06/volcanic-ridge-ridge-12m.png), [15m](../artifacts/visual-overhaul/stage-05-06/volcanic-ridge-ridge-15m.png) | [View](../artifacts/visual-overhaul/stage-05-06/volcanic-ridge-combat-15m.png) |

Matching `-cache-dressing-on/off.png`, `-grove-dressing-on/off.png`, spawn and shore phases are in the same artifact directory. [New browser log](../artifacts/visual-overhaul/stage-05-06/browser.log), [unit log](../artifacts/visual-overhaul/stage-05-06/unit-tests.log), [build log](../artifacts/visual-overhaul/stage-05-06/build.log).

## Performance measurements and limits

The complete [live capture metrics](../artifacts/visual-overhaul/stage-05-06/metrics.json) retain all four maps, zero page errors, movement/jump/dodge/pause success and repeated deterministic layouts. Setup matches the prior capture: High quality, 1440×900/DPR 1, Chrome SwiftShader software WebGL, fixed seeds, local PMD assets and 120 early active frames. All recorded source hashes match the verified Stages 05–06 snapshot.

| Map | Mean draws: Stages 03–04 → 05–06 | Mean interval, ms: before → after | Final p95, ms |
|---|---|---|---:|
| Wildlands | 83.31 → 89.28 | 33.77 → 51.53 | 157.30 |
| Pinewood | 98.89 → 103.57 | 28.89 → 48.04 | 131.10 |
| Ruins | 96.55 → 99.53 | 30.29 → 58.72 | 159.10 |
| Volcanic | 77.31 → 84.68 | 30.66 → 66.17 | 155.80 |

Those frame times were much noisier/slower than the historical run while other work/captures were active on the shared host. They are preserved rather than interpreted as the new art's causal cost. A repeat live-server run was interrupted by concurrent source hot reload; its partial timings are excluded ([interrupted log](../artifacts/visual-overhaul/stage-05-06/capture-interrupted.log)).

To isolate the new presentation, an additional [controlled comparison](../artifacts/visual-overhaul/stage-05-06/presentation-comparison.json) ran against the verified snapshot in one frozen scene per map, with no enemies and the unchanged normal camera. It used **off/on/on/off**, discarding 40 warm-up frames and measuring 100 frames per sample. Off hides dressing, restores plain terrain colors and the historical white lights/EXP2 fog; on restores the new dressing/daytime atmosphere. Source meshes remain allocated in both states.

| Map | Mean ms, off | Mean ms, on | Draws, off → on |
|---|---:|---:|---|
| Wildlands | 54.18 | 53.16 | 75 → 78 |
| Volcanic | 55.03 | 54.91 | 69 → 72 |

The consistent measured addition is **three draws** in those scenes. The small timing differences are within variation and do not establish a speedup; host/software-renderer timing was unsuitable for a reliable target-GPU FPS claim. New dressing adds one shared geometry/material, and atmosphere adds no geometry, observers or per-frame material/color allocations. The full unit suite and ten-restart browser scenario show stable resource cleanup. No subjective human free-roam session or hardware GPU benchmark was performed.

Reproduce the isolated comparison:

```powershell
npm.cmd run dev -- --config artifacts/visual-overhaul/stage-05-06/snapshot.vite.config.mjs --configLoader native --host 127.0.0.1
# In a second terminal:
$env:WILDLANDS_BASE_URL = 'http://127.0.0.1:5186'
node artifacts/visual-overhaul/stage-05-06/profile-presentation.mjs
```

## Files and recovery

New implementation files: `src/data/atmosphere.ts`, `src/game/systems/landmarkDressing.ts`, `src/game/render/LandmarkDressing.ts`, and `src/game/render/atmosphere.ts`. Integration edits: `src/data/maps.ts`, `src/game/render/World.ts`, and `src/game/render/terrainPalette.ts`. Verification: `tests/landmarks-atmosphere.test.ts`, `tests/browser/landmarks-atmosphere.spec.ts`, the existing world geometry budget (one extra shared paver), and capture-helper fingerprints.

Pre-task copies of overlapping files are under ignored `artifacts/visual-overhaul/stage-05-06/before/`. They are a task-specific recovery copy, not a whole-worktree checkpoint. Preserve the user's unrelated balance/catalogue edits and earlier art stages when reverting changes. No commit was created.
