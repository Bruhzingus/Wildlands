# Individual asset review after Stages 07–08

Reviewed on 2026-10-23 after [commit 96da242](https://github.com/Bruhzingus/Wildlands/commit/96da242c0b38aed9739098e380bb28e48992b82b) was pushed to `main`. This is the separate asset quality pass requested after Stage 08, with its own corrections and follow-up commit.

## How assets were inspected

Reviewed every asset entry produced by the overhaul's factories, across the four registered map palettes. `scripts/review-world-assets.mjs` isolates the actual shared geometries and materials from a real `World`, including individually forced previews of all five berry variants. It captures each entry in daylight, dusk and from the opposite side: **88 biome/asset entries and 264 images per pass**, arranged in 19 contact sheets.

Opened all 19 before sheets, then checked the corrected assets against their matching after views and the original art references. The fitted close-up camera is explicitly diagnostic: its radius varies to reveal small details, while its beta remains 1.11. Normal gameplay-camera views and actual terrain contact are checked separately in the map/browser scenarios. Translated close-up clones do not serve as proof of contact with the original terrain. No screenshot pixel matching is used.

Evidence is under `artifacts/visual-overhaul/asset-review/before/` and `after/`, with `<map>-<asset>-day/dusk/reverse.png`, `<map>-sheet-<n>.png` and `inventory.json`. The inventories record dimensions, parts, triangle counts, material names and page errors. The final `after/capture.json` records source fingerprints and camera conditions; those views use the isolated publication server. The capture rejects invalid bounds and retained thin-instance buffers, and verifies that the selected asset actually enters the scene's active mesh list. Images and logs are generated/ignored artifacts; the committed script reproduces the current review.

The isolated preview was restarted after copying the final source. Runtime template signatures explicitly verify 80-triangle shrubs, 20-triangle berry leaves and enabled two-sided plant lighting. Earlier cached preview outputs are retained with a `-cached` suffix and excluded from the final validation evidence.

## Issues corrected

1. **Washed-out stone facets:** ordinary Wildlands/Ruins stones were close to white in the daylight close-ups, and Pinewood inherited the same bright palette. Lowered the existing albedo values to `#707c74` and cool `#66736e`, retaining facet separation through daylight/dusk. Volcanic stone already had sufficient tonal range. This changes colors only, including the existing subtle high-ground stone blend; no collider, height or placement changed.
2. **Unexpectedly dense primitives:** Babylon's installed ico-sphere builder uses `(options.subdivisions || 4)`, so `0` produced its 320-triangle default. Changed decorative shrub/scrub sources to an explicit **80 triangles** and berry-leaf sources to **20 triangles**. Their recognizable round/faceted silhouettes and existing positions remain. No extra source, material or draw is added.
3. **Flower petals merged into a square:** four overlapping square discs read like a little tabletop. Smaller six-sided petals now produce four distinct lobes around each stem, with the existing subdued palette and no bright added center. The two-flower template changes from 64 to **80 triangles**, still using one opaque material and one batch.
4. **Plant backs used front-face lighting:** the two-sided plant materials disabled culling but left two-sided lighting off. Enabled the existing StandardMaterial lighting option so visible backs receive the correct normal orientation. The shared grove/cache plant copies inherit the correction.
5. **Small bases stayed horizontal on slopes:** ground details now align their static instance matrices to the sampled surface normal. Pavers and dressing plants use the same small orientation helper, including their seeded yaw; the old paver tilt discarded that yaw. Geometry positions, collision, interaction masks and seeds remain unchanged. Tests inspect the actual instance/world matrices against independently sampled ground normals.
6. **Stumps lacked a readable cut surface:** brightened only the existing top-cap vertex colors. The stump remains one six-sided cylinder, one material and 24 triangles, without rings, textures or extra meshes.

All corrections remain within the established primitive style. No new gameplay content, asset download, dependency, save field, shadow system or postprocess was added.

## Asset-by-asset disposition

“Pass” means the inspected geometry, material, silhouette and daylight/dusk response suit the current art brief. “Corrected” identifies the specific changes above; all applicable map palettes were checked. Shared-template entries are listed separately from their assembled settings.

| Asset | Maps / variants | Result and assessment |
|---|---|---|
| Single pine | Wildlands, Pinewood, Ruins | Pass: clear cone/trunk silhouette, subdued green, 40 triangles per ordinary tree. |
| Tiered pine | Wildlands, Pinewood, Ruins | Pass: two readable tiers, coherent tip tint, 60 triangles. |
| Round tree | Wildlands, Pinewood, Ruins | Pass: distinct faceted crown, sound trunk overlap, 40 triangles. |
| Great Pine | Three green maps | Pass: recognizable authored large silhouette and shared materials; 40 triangles. Existing close-range canopy obstruction remains part of its preserved size/location. |
| Dead tree and three limbs | Volcanic | Pass: joined asymmetric bare branches, warm muted bark, 80 triangles; no green conifer replacement. |
| Small rock | All four | Corrected daylight albedo in green maps; 20 faces, legible faceting and existing size/proxy agreement. |
| Medium rock | All four | Same correction; retains the group's middle scale and 20 faces. |
| Anchor rock | All four | Same correction; retains the group's large silhouette and 20 faces. |
| Green shrub | Three green maps | Corrected 320 → 80 triangles; rounded silhouette remains distinct from tree crowns and tiny pickups. |
| Flattened ash scrub | Volcanic | Corrected 320 → 80 triangles; retained low profile and dry-earth material. |
| Masonry / authored gate primitive | Existing map uses | Pass: simple box primitive, muted map material, stable contrast; 12 triangles. Its palettes had already been corrected in Stage 08. |
| Three-blade tuft | Green maps | Corrected two-sided lighting and slope orientation; still three triangles and deliberately quiet. |
| Two-flower clump | Wildlands, Ruins | Corrected four-lobed petals, lighting and base orientation; 80 triangles, subdued colors. |
| Mushroom | Pinewood | Cap/stem silhouette and brown palette pass; base orientation corrected. 48 triangles. |
| Stump | Pinewood | Corrected cut-top contrast and slope contact; 24 triangles, no new material. |
| Charcoal chip | Volcanic | Angular silhouette/palette pass; base orientation corrected. 20 triangles. |
| Flat paving stone | All four | Geometry and stone tints pass; sampled orientation now retains seeded yaw. 24 triangles. |
| Standing dressing stone | All four | Pass: small faceted vertical accent, suitable brightness, no interaction/collision ownership. 20 triangles. |
| Small cache/grove stone | All four | Pass: low subordinate shape and muted shared material. 20 triangles. |
| Grove/cache plant accent | Flower, mushroom, chip presets | Corrected shared flower/lighting/slope issues where applicable; no duplicate thin-instance buffers. |
| Oran tree, crown fruit, dropped fruit and leaf | All four | Color/shape pass; leaf budget corrected. Blue fruit remains readable against both green and ash canopies. |
| Leppa tree and fruit parts | All four | Color/shape pass; leaf budget corrected. Warm crown and orange fruit remain distinct. |
| Sitrus tree and fruit parts | All four | Color/shape pass; leaf budget corrected. Round yellow fruit and yellow-green crown retain their identity. |
| Pinap tree and fruit parts | All four | Color/shape pass; leaf budget corrected. Elongated yellow fruit remains distinct from Sitrus. |
| Silver Pinap tree and fruit parts | All four | Color/shape pass; leaf budget corrected. Bright rare fruit is an intentional interactive cue. |
| Shrine setting | All four | Pass after shared paver correction: low pavers and two uneven stones frame an open interaction center. |
| Cache setting | All four | Pass after shared plant corrections: modest side stones/plants retain the approach gap. |
| Berry-grove setting | All four | Pass after shared plant corrections: accents remain subordinate to the actual harvest tree/fruit. |
| Ground color patches / soil clearings | All four | Pass in normal-camera views: broad low-contrast variation, no tiled textures or raised decals. |
| Pond bank | All four | Pass: vertex color follows existing terrain, without an overlapping floating shore mesh. |
| Pond/crater water surface | All four | Pass: restrained flat water, original bounds and visual identity; no lava or new hazard. |
| Biome sky, ambient/sun colors and fog | Three biome curves, five key phases | Pass: readable dusk, clear combat foreground, distinct cool/warm tints, unchanged pixel-sprite filtering. |
| Horizon silhouettes | All four | Pass: reuse the reviewed trees/dead wood with Stage 07's seeded gaps/scales. |

The berry tree's trunk, two canopy pieces and five crown fruits total 164 triangles. A visible dropped fruit plus leaf now adds 40 rather than 340 triangles. Thus the inspected trees with one/two dropped fruits changed from **504/844 to 204/244 triangles**; the three-fruit maximum is 284 rather than 1184. Their actual reward state, fruit positions, rarity, pickup count and regrowth logic are preserved.

The pre-existing PMD sprite library was not remade by this overhaul. Stage 08 separately passed its complete **151 species × three animation states × eight atlas rows** gallery audit, and the current browser checks retain berry collection, native sprite filtering and normal-camera views.

## Validation

- Working-tree snapshot during this review: typecheck, production build and **529/529 unit tests passed**. The existing large-bundle advisory remains. Other sessions continue changing unrelated gameplay files; the isolated publication checks below validate the exact visual-only code being committed.
- Focused asset/surface tests pass, including strict primitive budgets, two-sided plant material behavior, brighter cut-top colors, actual detail/paver/plant matrices aligned to terrain, unchanged historical POI/berry/height fixtures, no per-frame resource growth and complete disposal.
- Isolated publication copy excluding concurrent balance/movement edits: typecheck, production build and **516/516 unit tests passed**.
- The close-up review completed all 88 entries / 264 views with **zero page errors** and preserved opaque shared templates/batches.
- The same publication copy passed **20/20 browser checks**: all four maps' landmark interactions/atmosphere, graphics controls, ten real restarts, above-budget rendering, eight map/seed scenarios, five normal-camera vegetation/shore/berry scenarios and actual berry rewards/regrowth.
- Final fixed-population capture passed all four maps with the same 150 enemies, six party members and 220 projectiles, stable paused simulation, unchanged draw/resource counts and zero page errors.

The final stress capture uses the same gameplay source hashes as the Stage 08 comparison, High quality, 1440×900, DPR 1, dusk, 30 warm-up frames and 120 measured frames. Raw evidence is `artifacts/visual-overhaul/asset-review/stress/metrics.json`. This is Chrome SwiftShader presentation timing with simulation paused; it excludes active combat CPU and does not establish target-hardware performance.

| Map | Draws, unchanged | Mean ms, Stage 08 → polished | p95 ms, Stage 08 → polished | Polished render median ms | Meshes / geometries / materials, unchanged |
|---|---:|---:|---:|---:|---:|
| Wildlands | 82 | 34.72 → 34.64 | 38.10 → 39.10 | 5.40 | 1991 / 42 / 74 |
| Pinewood | 97 | 32.00 → 32.32 | 34.30 → 34.40 | 5.10 | 1985 / 43 / 75 |
| Ruins | 94 | 32.53 → 32.52 | 34.20 → 34.30 | 5.20 | 2090 / 42 / 74 |
| Volcanic | 76 | 33.77 → 34.98 | 35.60 → 40.00 | 5.40 | 2295 / 41 / 73 |

Single-run means are similar; Volcanic's p95 is higher in this capture, so these numbers do not support a frame-time improvement claim. The reduced primitive counts are verified independently, and the corrections add no draws, meshes, materials, geometries or frame-time terrain sampling. Resource stability and disposal also pass the focused tests.

The full browser suite was already run for Stage 08; its **16 established unrelated failures** remain documented in [the Stage 07–08 report](VISUAL_OVERHAUL_STAGES_07_08.md). This asset-only pass does not claim to repair those old gameplay/UI/animation-label assertions or to establish target-hardware GPU performance.

Reproduce the asset review with the dev server running:

```powershell
$env:WILDLANDS_ASSET_REVIEW_DIR = 'artifacts/visual-overhaul/asset-review/current'
$env:WILDLANDS_ASSET_EXPECT_POLISHED = '1'
node scripts/review-world-assets.mjs
```

Changes are limited to `maps.ts`, `World.ts`, `groundDetails.ts`, `LandmarkDressing.ts`, the new `render/terrainOrientation.ts`, the review script, focused asset tests and this report. The follow-up commit preserves the unrelated balance, movement, catalogue and UI work in the shared working tree.
