# Wildlands visual overhaul — Stage 00 baseline

> Historical Stage 00 snapshot. See [Stages 01–02 implementation and verification](VISUAL_OVERHAUL_STAGES_01_02.md) for the completed ground and vegetation work.
> See [Stages 03–04 implementation and verification](VISUAL_OVERHAUL_STAGES_03_04.md) for grouped rocks and sparse ground details.
> See [Stages 05–06 implementation and verification](VISUAL_OVERHAUL_STAGES_05_06.md) for landmark settings and the run-time atmosphere.

Audited 2026-10-22 against HEAD `e9adae2093dcee5a98ccfd029a4426afae5f6d45` **plus the current working tree**. Existing balance, catalogue, and test edits were already present and continued changing during the audit. This report describes the inspected working copy, not a clean checkout of that commit. The capture report records SHA-256 hashes of the main world/runtime files and lockfile.

Stage 00 adds this report and `scripts/visual-overhaul-baseline.mjs`. The game was launched and inspected in Chrome. No game source, gameplay, map IDs, assets, dependencies, or save formats were changed by this stage. Existing development hooks were sufficient; no new runtime map selector was needed.

## Reference inspection and actual map mapping

All four required PNGs were opened and visually inspected before the audit:

- Primary baseline: [current_wildlands_baseline.png](ART_OVERHAUL/references/current_wildlands_baseline.png).
- Supplementary targets: [wildlands_biome.png](ART_OVERHAUL/references/wildlands_biome.png), [pine_biome.png](ART_OVERHAUL/references/pine_biome.png), [volcanic_biome.png](ART_OVERHAUL/references/volcanic_biome.png).

The baseline has muted olive ground, teal conifers, pale faceted rocks, a flat blue pond, large unbroken ground areas, scattered objects, and vibrant pixel sprites. The Wildlands target adds broad subdued ground variation, mixed round/conical silhouettes, and small clusters. The forest target has taller, denser, darker pine silhouettes with clearings. The volcanic target has warm brown/charcoal ground, angular rocks, sparse dead wood, and orange accents. All targets have simple large forms and readable sprite contrast; their cliff detail, bridges, lava patterns, UI, and illustrated densities are not literal implementation requirements. Preserve simple Babylon primitives/materials and written budgets over generated detail.

**Repository correction:** `src/data/maps.ts` registers four IDs, representing two current visual families. The roadmap's assumption of three independently styled maps is not the current implementation.

| Existing ID | Current definition / seed | Art-direction relationship |
|---|---|---|
| `wildlands` | Rolling Wildlands; run seed from `Date.now() % 2147483647` | Balanced Wildlands target |
| `pinewood-route` | Wildlands definition spread; fixed seed **46837** | Closest existing ID for the pine target, but currently has the same palette/scenery as Wildlands |
| `ruins-route` | Wildlands definition spread; fixed seed **81073** | Preserve this additional route and its existing identity/access |
| `volcanic-ridge` | Separate palette, relief, landmarks, encounters; random run seed | Volcanic target; currently has a **blue crater lake**, brown conifers, and bushes, with no lava system |

`MAP_OPTIONS` in `src/data/unlocks.ts` derives from the registry. Fresh saves unlock Wildlands and Volcanic Ridge; achievements unlock Pinewood and Ruins. Preserve all four IDs, route seeds, unlock requirements, and selection validation. Future biome specialization should extend the existing definitions; do not rename serialization keys or invent a third registered map to match the brief.

## Architecture and safe extension points

Installed versions (`npm.cmd ls --depth=0`): Babylon.js **8.56.2**, TypeScript **5.9.3**, Vite **7.3.7**, Playwright **1.64.1**. Package version **0.3.0**, Node **24.11.1**, npm **11.6.2**. Use the existing lockfile and dependencies.

| Concern | Current authority and extension point |
|---|---|
| Startup / registration | `src/main.ts` creates `Game`; `Game.start()` uses `MAP_OPTIONS`, constructs `Simulation` then `World` from its actual seed, POIs, map ID, and berry trees |
| Per-map configuration | `src/data/maps.ts`: `MapDefinition`, `MAP_DEFINITIONS`, `getMapDefinition()`, `worldProfile()`; already has terrain/scenery/lighting/palette/shore settings |
| Region and terrain data | `src/data/world.ts`: `WORLD`, `BIOMES`, authored `LANDMARKS` / `LANDMARK_PROPS`; `src/game/systems/environment.ts`: `biomeAt()`, `terrainHeight()`, `explorationRoute()` |
| Ground / colors | `src/game/render/World.ts`: `buildTerrain()` edits mesh positions, computes normals, blends biome vertex colors, adds low-amplitude variation and route tint; `mat()` owns shared `StandardMaterial`s |
| Placement / seeds | `environment.ts`: `createPOIs()`, `createEnvironment()`; existing seeded clusters, open spawn, POI/shore/route clearances, bounded placement attempts |
| Trees / rocks | `World.buildEnvironment()`: shared five-sided trunk/cone sources, ico bushes/boulders, box ruins, and ordinary scenery instances; extend these factories |
| Berry trees | `src/game/systems/berries.ts`: `createBerryTrees()` / `updateBerryTrees()`; `World.buildBerryTrees()` / `updateBerryArt()` render two canopies, fruit, and falling drops at authoritative tree positions |
| Collision / interaction | `environment.ts`: `ObstacleField`, shared x/z circles/rotated boxes; `Simulation` handles movement and distance-based `activatePOI()`, berry collection, and terrain-feature interactions |
| POI visuals | `World.buildLandmarks()` / `update()`; `render/TreasureChests.ts`, `render/ShrineStatues.ts`; retain POI UID, availability, tier, reward, challenge, and respawn state |
| Water | `worldProfile().lake`, `terrainHeight()` basin, `World.buildTerrain()` disc/shore, `createEnvironment()` circular collider, dry exploration routes, and minimap share the lake coordinates |
| Lighting / atmosphere | `World.buildTerrain()` sets static clear/fog colors and two lights; Stage 06 can extend per-map settings and use authoritative `state.stats.elapsed` through the active `World.update()` path |
| Sprites / camera | `render/AssetLibrary.ts` and `CharacterVisuals.sync()` own PMD directional sprites and terrain anchoring; `Game` owns the follow camera and pointer lock |
| Resource lifecycle | `Game.cleanupRun()` disposes per-run visuals, world, effects, labels, and assets; `World.dispose()` releases instances, sources, nodes, materials, and lights; `Game.dispose()` / HMR release scene, engine, UI, listeners, audio |
| Diagnostics / browser | `Game.inspectPerformance()`, `FrameMetrics` in `src/game/performance.ts`, `playwright.config.ts`, and existing `tests/browser/`; Vite DEV exposes `window.__WILDLANDS__` |

The current factories and generator can support the overhaul. Extend their small configuration objects and geometry sources; a replacement world-generation framework is unnecessary.

## Exact behavior to preserve

- World scale is **1.25**; ground is **287.5 × 287.5**, with **116** subdivisions (**13,689** vertices, **26,912** triangles). Terrain normals are computed; the ground uses vertex color and a shared white material. Actor physics is x/z collision, not slope physics: actor jump/flight Y is an offset over sampled terrain.
- Safe-spawn clearance is **17** units; POI clearance **5**; POI spacing **17**; route half-width **2.1**. World soft/hard boundaries are **131.25 / 141.25**. `createEnvironment()` makes at most **1,640** placement attempts and **820** props, plus **100** rendered boundary canopies. Generated flower props currently have no corresponding renderer branch; do not count them as visible flowers.
- `worldProfile()` uses `RNG(seed ^ 0x5731abc)` for quarter-turn orientation, shifted lake, relief, terrain forms, route hubs, and density clusters. `worldPoint()` / `localPoint()` must remain the coordinate authority. Seed zero special-cases orientation/relief, but still has seeded composition.
- POIs use `RNG(seed ^ 0x6ac690c5)`; scenery uses `RNG(seed)`; initial berries use `RNG(seed ^ 0x23a164fc)`; simulation and loot have their existing streams. `createEnvironment()` is regenerated by simulation and twice by the renderer, so identical inputs and deterministic call ordering are essential.
- There are **18** initial POIs and **3** timed discoveries at **180 / 420 / 660** game seconds. Current change kinds are cache/cache/shrine. Four authored landmark markers per map retain their transforms; Wildlands-family landmarks use six authored props and Volcanic uses seven. Initial free discovery caches differ from paid/restocking chests; shrine challenges and their hazards remain gameplay-owned.
- Up to **16** berry trees are selected from existing non-landmark scenery trees, at least **17** units apart. They replace generic tree visuals at the exact same coordinates while keeping original colliders, IDs, variant state, drops, and timers. Their one-to-three fruit and three-minute variant changes remain authoritative gameplay.
- The lake has water radius **22.5**, shore radius **27.5**, and water Y **0.18**. Rendering is a 44-segment horizontal disc with alpha **0.91**, plus a 48-segment torus shore. The collider radius is **21.5**, including flight blocking. No swimming, reflections, refraction, or lava hazard is implemented here.
- Static EXP2 fog density is **0.0064**. Hemispheric/directional light intensities are **0.9 / 0.95** for Wildlands-family maps, **0.85 / 1.0** for Volcanic. There is no time-of-day controller or live dynamic shadow map; actors use shared contact-shadow discs.
- Normal start camera: alpha **-π/2**, beta **1.05**, saved radius default **28**, target terrain height + **2**. Limits are radius **14–48**, beta **0.48–1.43**. Mouse orbit and camera-relative movement must stay intact.
- Local-first PMD atlases use nearest sampling, camera-relative directional rows, and shared sprite managers. Preserve the actual sprite assets, filtering, billboarding, animation, and contrast. Generated fallback art does not establish pixel-sprite visual acceptance.
- Gameplay/world updates require playing/boss phase and captured pointer. Pause and choices freeze authoritative time and scenery animations. Frame delta clamps at **0.08s**, simulation substeps at most **0.02s**. Enemy/projectile caps remain **190 / 220**; art changes must not lower them.

## High-risk couplings

1. **Height:** `terrainHeight()` feeds rendered ground, camera, actors, health bars, damage labels, chests, berries, shrine hazards, and FX. A decorative mesh-only elevation change will detach these consumers. Stage 01 must leave terrain positions/heights unchanged.
2. **Placement and berries:** changing scenery types/density or RNG consumption changes colliders and which trees become berry trees. Isolate purely cosmetic color/geometry work from authoritative placement. Preserve exclusion masks and dry approach routes.
3. **Spawn surfaces:** `enemySpawnPosition()` currently checks the x/z boundary, not slopes, water, or all props. Subsequent movement resolves obstacles. Do not assume a general navigation/surface-validation system already exists.
4. **Collider/visual agreement:** tree collision radius is `.37 * scale`, rock radius `1.25 * scale`; ruin proxies use half-width `1.2 * scale`, half-depth `.9`, and rotation. Enlarging a canopy is not permission to enlarge its gameplay footprint.
5. **Water:** basin heights, water/shore meshes, collision, routes, and minimap must agree. Shore dressing must follow existing sampled terrain without moving the water or changing its bounds.
6. **Camera/readability:** taller trees and ridges can occlude sprites or clip the normal camera. Compare at the existing camera rather than moving the camera to improve an art screenshot.
7. **Save/minimap:** retain `wildlands-save-v1` with version-2 data and all four map IDs. Controls/graphics use `wildlands-controls-v1`. Minimap uses world coordinates, +Z north, size **166**, inset **10**, and caches the shared profile by `seed:mapId`; do not introduce a separate decorative map transform.
8. **Materials/disposal:** reuse world-owned palettes and primitive sources; do not allocate geometry/materials per frame. Retain cleanup ownership across restarts, map selection, async sprite loads, and HMR.

## Browser evidence and performance baseline

Run the existing server in one terminal, then the capture helper in another, from the repository root:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort --configLoader native
node scripts/visual-overhaul-baseline.mjs
```

Optional `WILDLANDS_BASE_URL` overrides the server URL. No packages are installed. The helper uses fresh browser contexts, isolated in-memory route unlocks, the normal map selector/starter click and pointer capture, seed **4** for random maps, and each route's actual fixed seed. It keeps the normal camera, pins High quality at 1440 × 900/DPR 1/resolution 1, mutes audio, blocks remote sprite fallback, and waits for local PMD art. Saved settings in the user's browser profile are untouched.

Per map, the helper collects **120 active gameplay frames**, then verifies WASD movement, jump, dodge, full pause, and repeatable POI/environment generation. It captures `{mapId}-spawn.png`, `-gameplay.png`, `-ridge.png`, and `-shore.png`. Ridge/shore inspection teleports only the isolated, paused QA run, with the original camera angles/radius and pause overlay temporarily hidden. These additional views do not prove walking access to those coordinates.

Evidence: [metrics.json](../artifacts/visual-overhaul/stage-00/metrics.json), [Wildlands](../artifacts/visual-overhaul/stage-00/wildlands-spawn.png), [Pinewood](../artifacts/visual-overhaul/stage-00/pinewood-route-spawn.png), [Ruins](../artifacts/visual-overhaul/stage-00/ruins-route-spawn.png), [Volcanic](../artifacts/visual-overhaul/stage-00/volcanic-ridge-spawn.png). All **16** screenshots exist; the four spawn views plus Wildlands shore and Volcanic ridge were visually opened and compared with the supplied references. Each map captured with zero page errors and repeatable generated layouts.

| Map / seed | Mean / p95 frame interval (ms) | Mean draw calls | Meshes / geometries / materials |
|---|---|---|---|
| Wildlands / 4 | 36.69 / 65.50 | 77.64 | 1634 / 48 / 78 |
| Pinewood / 46837 | 30.97 / 41.80 | 94.12 | 1589 / 43 / 73 |
| Ruins / 81073 | 33.14 / 36.00 | 93.51 | 1706 / 43 / 73 |
| Volcanic / 4 | 37.54 / 77.10 | 78.03 | 1612 / 44 / 73 |

These are **Chrome SwiftShader software-renderer diagnostics**, with 3–4 natural early enemies and one party member, not target-GPU FPS or late-wave performance. The helper ran after the separate browser suite completed. Draw calls come from Babylon `SceneInstrumentation`; average frame intervals use successive post-render timestamps. `Game.inspectPerformance()` additionally records its bounded frame/simulation/presentation/render median/p95/max, effects, resources, heap, audio, and actual populations. Asset loads and live combat vary, so compare identical camera/seed/preset/populations and review raw conditions rather than treating the table as a hard FPS guarantee. Repeat after asset warmup on target hardware for a GPU budget; existing `scripts/reliability-profile.mjs` provides complementary CPU/heap stress, not GPU measurements.

**Visual comparison:** the captured game retains the baseline's crisp sprites, simple cone trees, faceted rocks, broad flat ground and open spawn. The default camera is more downward-facing than the supplied wide baseline composition; capture keeps the actual playable camera. Current ground remains largely uninterrupted, ordinary rounded forms are shrubs rather than full round trees, and trees/rocks lack the target's clear size/group hierarchy. Pinewood is visibly another Wildlands seed, not the dark forest target. Volcanic has warm colors and purple-grey boulders, but still has brown cones and a blue pond rather than dead trees/lava. Nearby canopy obstruction is visible in its ridge inspection. These are documented differences for subsequent stages, not changes to perform in Stage 00.

## Verification results and limitations

| Command / check | Result |
|---|---|
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build -- --configLoader native` | Passed; existing large Babylon bundle warning |
| `npm.cmd test` (final run) | **508 / 508 passed**, including all-map terrain, collision, seed, berries, minimap, and ten-world-restart disposal tests |
| `node --check scripts/visual-overhaul-baseline.mjs` | Passed |
| `node scripts/visual-overhaul-baseline.mjs` | Four registered maps launched; all capture/movement/jump/dodge/pause/determinism checks passed; 16 screenshots and metrics saved |
| `npm.cmd run test:browser -- tests/browser/phase15.spec.ts tests/browser/berry-trees.spec.ts tests/browser/camera.spec.ts` | **8 passed / 2 failed**; failures below |

The two browser failures are recorded baseline issues, not fixed by Stage 00:

- `phase15.spec.ts:11`: test expects a timed **Geothermal spring** healing interaction; current definition produces **Geothermal cache · Open discovery cache**. The old expectation conflicts with the inspected map definition.
- `phase15.spec.ts:30`: injected Moltres damage did not produce the expected victory `.end-screen`. Boss/endless completion therefore remains unverified by that scenario; no cause is claimed beyond the observed assertion failure. Failure screenshots, contexts, and traces remain under `artifacts/browser/results/phase15-*`.

PowerShell blocks unsigned `npm.ps1` here; use `npm.cmd`. The default Vite bundled config loader hit an ancestor-directory access error; native loading passed without changing Vite configuration. The local dev-server bind required the available execution approval. No image-viewing limitation remained. Initial unit runs saw two failures while unrelated balance/test edits were changing; the final current-tree run passed all 508. No clean-HEAD regression comparison, full browser suite, human playtest, long rendered endurance, or target-hardware GPU benchmark was performed.

## Checkpoints, rollback, and implementation order

Before Stage 01, review the pre-existing worktree changes and make a checkpoint containing the user's intended current game state plus this audit. Do not reset or stash away unrelated edits automatically. Keep the Stage 00 screenshots/metrics: `artifacts/` is ignored, so preserve a separate copy if a durable review/rollback archive is needed. Source hashes in the capture report distinguish this working baseline from HEAD.

Keep each later stage in its own reviewed patch/commit. For rollback, revert only that stage's known changes; on a mixed uncommitted tree reverse its specific patch after checking overlaps. Restore configuration and rendering changes together when they share data. Never use a whole-tree reset to undo an art stage. Re-run typecheck/build/tests and the same-seed capture after rollback.

Order stays **00 audit → 01 ground/shore → 02 trees/berries → 03 rocks/ridges → 04 sparse details → 05 POI dressing → 06 atmosphere → 07 biome/placement integration → 08 final review**. Each run must visually open the exact images listed by its own mandatory-reference section and compare actual normal-camera results; the references do not authorize changing gameplay or increasing asset complexity.

### Concrete Stage 01 checklist

- [ ] Read this baseline and visually open `ART_OVERHAUL/references/01_terrain_paths.png`, `wildlands_biome.png`, `pine_biome.png`, and `volcanic_biome.png` before editing; record observed palette, proportions, silhouettes, complexity, density, and direction.
- [ ] Extend `MapDefinition` / the existing per-map palette only as needed; preserve all four IDs and fixed seeds. Specialize the existing Pinewood preset deliberately if applying forest-specific colors; preserve Ruins as a working route.
- [ ] Change ground color calculation/material tuning in `World.buildTerrain()` without changing mesh positions, `terrainHeight()`, `biomeAt()` authority, POIs, scenery RNG, obstacles, movement, encounters, or minimap transforms.
- [ ] Add broad low-contrast green/soil variation with deterministic masks and material reuse; localized scuffs/shore accents must not introduce a forced route network. Keep sprites and telegraphs more prominent than scenery.
- [ ] Improve the existing pond edge with simple conforming geometry/colors; preserve water center/radius/height, flight blocking, basin, and dry routes on every map. Preserve the volcanic crater lake; do not infer a lava system from the concept image.
- [ ] Re-capture all four maps at the baseline seeds and normal camera, including shore views. Compare with Stage 00 and the original references; correct significant stage-specific discrepancies and report any unavailable visual checks.
- [ ] Run typecheck, native-loader production build, and existing tests; verify unchanged heights/colliders/POI and berry positions, no floating patches/seams/Z-fighting/blocked approaches, correct disposal, and stable draw calls/resources under comparable conditions. Carry forward the two known browser failures explicitly until independently resolved.

Stage 00's architecture and safety mapping is complete. Stage 01 has not been implemented.
