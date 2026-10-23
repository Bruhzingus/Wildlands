# Visual overhaul — Stages 07 and 08

Implemented on 2026-10-23. This completes the placement integration and final review on **all four registered maps**: Wildlands, Pinewood, Ruins and Volcanic Ridge. The brief's three-biome wording does not remove the Ruins route. Earlier work is recorded in the [Stage 00 baseline](VISUAL_OVERHAUL_BASELINE.md), [Stages 01–02](VISUAL_OVERHAUL_STAGES_01_02.md), [Stages 03–04](VISUAL_OVERHAUL_STAGES_03_04.md) and [Stages 05–06](VISUAL_OVERHAUL_STAGES_05_06.md).

## Reference review

Opened every mandatory reference for both stages: `07_map_layout.png`, the three biome images, `reference_sheet_3_biomes.png`, `current_wildlands_baseline.png`, `reference_sheet_6_stages.png`, and individual references 01–06. The layout target's broad meadows, irregular forest pockets and small stone groups take priority over its illustrated path network. Retained primitive geometry, crisp PMD pixel sprites, the existing normal camera, gentle terrain, original crater lake and the game's visual identity. No lava hazard, cliff system, rendering dependency, model, texture, save format or gameplay content was added.

## Placement integration

The existing generator still authors terrain, POIs, landmarks, scenery candidates and tactical features with its established RNG. A bounded composition pass then moves ordinary, noninteractive trees toward a few broad regions and thins nonblocking bushes/flowers. Each moved tree retains its scale, array order and corresponding trunk proxy. A failed placement retains its original safe position. Ordinary rocks are grouped afterward against the resulting tree proxies; tiny ground details sample the same regional mask.

`systems/sceneryDensity.ts` samples a few existing seeded region centers with broad elliptical falloff, sinusoidal warping and softly blended forest bands. Wildlands retains meadow gaps and mixed tree silhouettes; Pinewood emphasizes forest bands; Ruins has fewer broad regions; Volcanic concentrates dead wood into smaller regions and strongly reduces scrub. There are no grid tiles, new roads or forced corridors. Existing dry optional-site approaches remain open. Dynamic combat does not regenerate scenery or consume placement RNG.

The coordinated clearance mask protects the player start, POIs including future discoveries, existing dry approaches, water/shore bounds, authored landmarks, tactical features and obstacle footprints. New tree positions also protect the 36-unit opening area and reject abrupt slopes. Their visual canopy margin exceeds the trunk collider; rocks keep their matching physical radii. The simulation and renderer independently generate the same deterministic layout and retain the existing world/minimap transform and shared ground-height sampler.

**Harvest preservation:** moving arbitrary trees can change spacing rejection during the existing berry selection. `createBerryTrees` can now optionally report the entire examined candidate prefix, including rejected candidates. Composition pins that prefix, preserves the total tree count/order, and therefore retains the original 16 harvest trees, IDs, berry variants, fruit offsets and RNG state. The ordinary gameplay call follows the same selection algorithm as before. Historical POI, berry, tactical-feature and terrain-height hashes still pass unchanged. Ordinary scenery hashes were retired in favor of explicit placement/collision/clearance invariants.

### New map controls

All controls live in `MapDefinition.placement`, alongside existing map palettes, vegetation weights, rock budgets, detail budgets, dressing and atmosphere curves.

| Control | Wildlands | Pinewood | Ruins | Volcanic |
|---|---:|---:|---:|---:|
| Broad regions | 5 | 6 | 4 | 3 |
| Region width, map-local units | 32 | 35 | 34 | 26 |
| Tree acceptance floor | .12 | .08 | .12 | .05 |
| Soft forest-band boost | .12 | .30 | .12 | 0 |
| Maximum shrub retention probability, scaled by density | .54 | .42 | .54 | .20 |
| Maximum legacy flower retention probability, scaled by density | .50 | .50 | .50 | 0 |
| Minimum relocation clearance margin, world units | 2.4 | 2.4 | 2.4 | 3 |
| New-tree opening exclusion radius, world units | 36 | 36 | 36 | 36 |
| Relocation attempts per eligible tree | 48 | 48 | 48 | 48 |
| Horizon silhouette retention probability | .66 | .80 | .62 | .40 |
| Rock center preference | None | Woodland | None | Elevation |

Tree counts are conserved to preserve harvest selection. Density is a relocation/retention probability, not a per-map tree-count multiplier. The existing Low graphics preset hides cosmetic bushes and detail batches; it retains solid scenery, navigation and essential combat visuals. No extra setting was necessary.

## Final art review

The five leading mismatches were ranked by readability, consistency and implementation cost:

1. **Scattered tall props weaken clearings.** Grouped ordinary trees under the shared constraints, retaining open spawn and dry POI approaches. Priority: high readability; moderate implementation cost.
2. **Repeated shrubs fill otherwise useful negative space.** Reduced them through the same broad mask, especially on Volcanic. Priority: high consistency/readability; low cost.
3. **An evenly spaced perimeter repeats identical silhouettes.** Added seeded gaps, slight position variation and bounded scale variation beyond the playable boundary. Volcanic has the sparsest dead-wood horizon. Priority: medium consistency; low cost.
4. **Pale masonry competes with reward landmarks and sprites.** Muted ordinary Wildlands/Pine/Volcanic masonry through their existing map palettes. Original shrine sculptures remain focal objects. Priority: medium readability; low cost.
5. **Tiny accents follow a different spatial pattern from trees.** Tufts and mushrooms now sample the shared mask; flowers still favor existing harvest groves and volcanic chips favor existing stone groups. Priority: medium consistency; low cost.

Inspected actual normal-camera screenshots against the original references. Wildlands remains open and mixed; Pinewood is cooler with a strong conifer majority; Volcanic has warm ash earth, faceted stone groups and bare silhouettes. Crisp bright sprites and combat tells remain readable at dusk. Authored large landmarks can still occupy the foreground when approached closely; their locations, shapes and colliders remain preserved. The simplified terrain and crater lake deliberately remain less elaborate than the concept art's large cliffs and lava.

### Screenshots and gameplay evidence

The new browser scenarios save **40 normal-camera images** and eight validation JSON files in `artifacts/visual-overhaul/stage-07-08/review/`. Each map uses its normal reference seed plus seed 301:

| Map | Seeds | Representative images |
|---|---|---|
| Wildlands | 4, 301 | `wildlands-4-landscape.png`, `wildlands-301-poi.png` |
| Pinewood | 46837, 301 | `pinewood-route-46837-landscape.png`, `pinewood-route-301-shore.png` |
| Ruins | 81073, 301 | `ruins-route-81073-poi.png`, `ruins-route-301-combat-dusk.png` |
| Volcanic | 4, 301 | `volcanic-ridge-4-landscape.png`, `volcanic-ridge-301-poi.png` |

Every combination captures spawn, landscape, shrine, shoreline and combat at dusk. Camera alpha/beta/radius are asserted unchanged. Each traverses actual collision-aware site approaches for at least three **simulated** minutes with normal enemy arrivals, tests jump/dodge, verifies repeatable scenery/details and 16 berry trees, and triggers the actual map-specific legendary (Mewtwo or Moltres). Paused QA captures can retain the earlier HUD timer; filenames and JSON identify the atmosphere preview and simulated elapsed time. QA-only seed overrides stay inside isolated browser module contexts and do not change authored seeds or saves. Existing browser scenarios cover cache/shrine/berry interactions, pause, minimap, telegraphs and cleanup. This is automated traversal and interaction coverage; no human three-minute playtest or target-GPU session is claimed.

The pre-task layout comparison also checked three seeds per map against saved source/layout snapshots: exact POIs, tactical features and all berry state survived all twelve comparisons. Raw evidence is `artifacts/visual-overhaul/stage-07-08/placement.json`.

| Map / reference seed | World props before → after | Trees retained | Trees moved |
|---|---:|---:|---:|
| Wildlands / 4 | 726 → 489 | 335 | 174 |
| Pinewood / 46837 | 692 → 466 | 290 | 118 |
| Ruins / 81073 | 766 → 527 | 376 | 182 |
| Volcanic / 4 | 596 → 368 | 244 | 149 |

Counts include authored props; detail instances and landmark settings are separate. Counts are bounded, deterministic outcomes rather than exact placement targets.

## Verification and performance

The working tree contains concurrent balance and movement edits. The publication check starts from Git HEAD and overlays only the visual overhaul files, without restoring, stashing or committing those unrelated edits.

- Current working tree: typecheck and native-loader production build passed; **527/527 unit tests passed**.
- Isolated visual-only publication copy: typecheck, native-loader production build and **514/514 unit tests passed**.
- That same publication copy passed **15/15 browser checks** covering all four maps' landmark interactions/atmosphere, graphics controls, ten real restarts, above-budget actor/projectile rendering and the eight new map/seed scenarios.
- New browser integration checks: **8/8 passed**, with zero page errors and all map/seed traversal and legendary assertions passing.
- Full browser suite: **110 passed / 17 failed** in 19.8 minutes. Sixteen failures match the pre-existing scenarios documented in the [Stages 03–04 report](VISUAL_OVERHAUL_STAGES_03_04.md): old primary-move labels, chest glow/run-sheet expectations, the expanded-map bound, evolution/menu assertions, collection/evolution/boss assertions and the outdated Magikarp move label. The previously intermittent `game.spec.ts:88` scenario passed this time. All new overhaul cases, real site/berry interactions, both legendary paths, ten resource-clean restarts, above-budget rendering and five locomotion scenarios passed.
- The seventeenth failure was the 151-species developer gallery: its selector became hidden mid-run and the case exhausted its five-minute timeout before any world was started. Its isolated rerun **passed in 43.9 seconds**, covering all 151 species, three animation states and eight atlas rows. Across the suite plus this rerun, **111 scenarios passed and 16 established baseline failures remain**. Raw logs: `browser-all.log` and `gallery-rerun.log` under the task artifact directory.

Both builds retain the existing large-bundle advisory. No dependency or lockfile changes were needed.

Generation is bounded by the existing candidate/prop caps and 48 relocation attempts per eligible tree. A 12-sample comparison after two warmups per map measured mean environment generation at 17.6 / 11.8 / 32.8 / 22.7 ms (Wildlands/Pinewood/Ruins/Volcanic), with p95 49.9 / 21.2 / 56.8 / 26.6 ms. The corresponding before means were 10.8 / 12.9 / 19.5 / 15.9 ms. This adds some run-start CPU cost, especially on Ruins, and adds no per-frame placement work. These local Node measurements ran alongside browser QA and are diagnostic, not hard timing guarantees. Raw data: `artifacts/visual-overhaul/stage-07-08/generation-timings.json`.

`scripts/visual-overhaul-baseline.mjs` retains the historical normal-camera live-gameplay capture and supports `WILDLANDS_CAPTURE_SEED` for a throwaway alternate-seed run. `scripts/visual-overhaul-stress.mjs` uses 150 enemies, six party sprites and 220 projectiles, 30 warmup frames and 120 measured frames at the original camera/High/1440×900/DPR 1. Its clock is paused at 30 minutes with dusk presentation, isolating comparable rendering/presentation costs; it explicitly excludes active late-wave simulation CPU. Neither software-renderer result establishes target-hardware FPS.

### Fixed-population comparison

The comparison sources use the same Git-HEAD gameplay runtime and identical populations, camera, sprite sources and quality. Before restores the pre-task art source copies; after uses the exact visual-only publication copy. Runtime fingerprints match between them. Measurements ran sequentially after browser QA ended. Every scene remained deterministic/frozen with zero page errors. Raw evidence: `stress-before/metrics.json`, `stress-after/metrics.json` and matching map PNGs in the task artifact directory.

| Map | Draws before → after | Mean frame interval, ms, before → after | p95 interval, ms, before → after | Meshes before → after |
|---|---|---|---|---|
| Wildlands | 83 → 82 | 37.50 → 34.72 | 42.10 → 38.10 | 2172 → 1991 |
| Pinewood | 99 → 97 | 33.33 → 32.00 | 34.80 → 34.30 | 2167 → 1985 |
| Ruins | 95 → 94 | 35.04 → 32.53 | 37.30 → 34.20 | 2312 → 2090 |
| Volcanic | 77 → 76 | 35.75 → 33.77 | 40.40 → 35.60 | 2709 → 2295 |

Geometry/material counts are unchanged in these pairs: **42/74, 43/75, 42/74 and 41/73** respectively. The consistent structural improvement is fewer scene meshes and one or two fewer draws. The small timing improvements are local software-renderer observations, not a target-GPU speed guarantee. Existing above-budget browser coverage separately rendered 210 enemies, seven party members and capped projectiles through active frame updates.

The final historical-style capture also passed movement, jump, dodge, pause and determinism on all four maps with zero page errors. It used 120 active frames and **3–4 natural enemies** per map, the Stage 00 camera/quality/viewport and local PMD sprites. Its gameplay, ridge, shoreline and detail on/off PNGs plus fingerprints and timing data are in `final-capture/` under the task artifact directory.

| Map | Stage 00 → final mean draws | Final mean / p95 frame interval, ms | Final meshes / geometries / materials |
|---|---|---|---|
| Wildlands | 77.64 → 84.86 | 30.22 / 35.90 | 1579 / 41 / 73 |
| Pinewood | 94.12 → 98.90 | 27.72 / 40.40 | 1578 / 47 / 79 |
| Ruins | 93.51 → 97.48 | 28.14 / 33.90 | 1683 / 46 / 78 |
| Volcanic | 78.03 → 79.29 | 31.12 / 35.00 | 1881 / 40 / 72 |

The complete overhaul adds some draws over Stage 00 for new silhouettes, tiny details and landmark settings. These live runs include variable combat/asset resources and concurrent gameplay changes, so their counts are diagnostic; the frozen matched-runtime comparison above better isolates Stage 07's structural cost. No active late-wave CPU endurance or hardware GPU performance guarantee is claimed.

Reproduce a current presentation stress capture with the dev server running:

```powershell
$env:WILDLANDS_CAPTURE_DIR = 'artifacts/visual-overhaul/stage-07-08/stress'
node scripts/visual-overhaul-stress.mjs
```

## Files and recovery

Stage 07/08 code: `src/game/systems/sceneryDensity.ts`, `src/game/systems/environment.ts`, `src/game/systems/berries.ts`, `src/game/systems/surfaceDetails.ts`, `src/data/maps.ts`, and the horizon in `src/game/render/World.ts`. Verification: `tests/scenery-integration.test.ts`, `tests/browser/scenery-integration.spec.ts`, updated preservation fixtures in `tests/visual-overhaul.test.ts`, and the capture/stress scripts. The commit also needs the previously uncommitted Stage 00–06 source, tests and reference pack on which these changes depend.

Pre-task overlapping-file copies and layout snapshots live under `artifacts/visual-overhaul/stage-07-08/before/`. The isolated publication and comparison sources are under the same ignored task directory. These are targeted recovery copies, not permission to reset unrelated files. Roll back the reviewed visual commit or its specific patch; preserve concurrent balance, movement and catalogue work. Screenshot/log artifacts are ignored; the committed scripts, reference pack, invariants and this report make the checks reproducible.
