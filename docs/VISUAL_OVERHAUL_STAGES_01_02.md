# Visual overhaul — Stages 01 and 02

Implemented 2026-10-22, then tested together as requested. Stage 00's [baseline](VISUAL_OVERHAUL_BASELINE.md) remains the historical comparison. All four registered map IDs and their seeds are retained.

## References and implementation

Visually opened the primary [terrain](ART_OVERHAUL/references/01_terrain_paths.png) and [vegetation](ART_OVERHAUL/references/02_trees_vegetation.png) images, plus the [Wildlands](ART_OVERHAUL/references/wildlands_biome.png), [pine](ART_OVERHAUL/references/pine_biome.png), and [volcanic](ART_OVERHAUL/references/volcanic_biome.png) targets. The implementation follows their muted green/earth palettes, broad patches, simple conical/rounded silhouettes, chunky berry canopies and barren volcanic wood. Existing sprite scale, camera, materials and primitive budgets take precedence over generated cliff, prop-density, UI and lighting details.

**Stage 01:** `MapDefinition.ground` supplies independently tunable patch color, soil color, patch size/density/strength, soil strength, shore width and shore strength. `render/terrainPalette.ts` samples broad continuous, warped color masks from an isolated seed stream. `World.buildTerrain()` applies these colors to the existing vertices, with no textures, extra terrain meshes or per-frame work. The decorative continuous route tint is removed; authoritative dry routes and placement exclusions remain unchanged. The old raised torus shore is replaced by a vertex-color bank on the actual terrain, preserving water center, radius, height, alpha, collision and crater-lake behavior.

Wildlands uses sage/olive and warm soil, Pinewood has cooler/darker greens and subdued forest floor, Ruins retains the Wildlands family with stone/earth accents, and Volcanic uses warm grey, rust and charcoal. Pinewood now has its own visual settings under the existing `pinewood-route` ID. No route is renamed or added.

**Stage 02:** `render/vegetation.ts` selects cosmetic family, rotation and ±10% scale from a stateless position/seed hash. Existing tree positions, density, collider footprints, source gameplay RNG and berry-tree selection stay unchanged. Rendering reuses the existing trunk/cone geometry for a plain pine, nested two-tier pine, and a dead trunk with three short tapered limbs; one flattened low-poly canopy source supplies rounded trees. Materials are shared. The authored Great Pine keeps its silhouette and mesh-name identity.

| Map | Plain pine | Tiered pine | Round | Dead wood |
|---|---|---|---|---|
| `wildlands` | 40% | 18% | 42% | 0% |
| `pinewood-route` | 58% | 34% | 8% | 0% |
| `ruins-route` | 36% | 16% | 48% | 0% |
| `volcanic-ridge` | 0% | 0% | 0% | 100% |

These are configured family-selection weights for existing ordinary trees, not placement-density changes. Boundary art uses corresponding silhouettes with bases below the finite terrain edge; green horizon art omits unsupported trunks. Volcanic bushes become low ash-colored scrub. Existing volcanic harvest trees remain recognizable berry trees with subdued canopy tint, preserving their resources and accessibility.

Berry trees retain the same IDs, two canopy handles, five crown-fruit handles, type material names, dropped fruit and timers. Their canopies are chunkier and attached fruit is larger and positioned at outward edges. Actual berry-type colors remain authoritative. Berry count and positions are preserved on every map; broader density/placement changes belong to Stage 07.

## Preservation and testing

Before implementation, captured hashes of complete POIs, scenery props, colliders, terrain features, initial berry states and 100 terrain-height samples for each map's reference seed. `tests/visual-overhaul.test.ts` compares against those pre-edit fixtures, checks deterministic color and tree-family selection, verifies the original terrain/water geometry, and exercises repeated berry palette changes and disposal without resource growth. Existing world restart tests also pass.

The combined verification covers:

- `npm.cmd run typecheck` and `npm.cmd run build -- --configLoader native`: passed, with the existing large-bundle warning.
- `npm.cmd test`: **512/512 passed** after both stages, including the four new visual-overhaul tests.
- **16/16 targeted browser scenarios:** the new four-map normal-camera/shore cases and berry collection/regrowth case; existing berry-tree rendering; all six pointer/camera cases; normal movement over terrain, ridges and shore on Wildlands/Volcanic with seeds 4 and 808. The browser test uses the actual simulation collection/reward/regrowth path and verifies the 20-second buff, 180-second regrowth, observed-tree delay, stable ID/position, and updated fruit material.
- Capture helper: all four map IDs launch with zero page errors; keyboard movement, jump, dodge, complete pause, and repeatable layouts pass.

Commands for browser checks:

```powershell
npm.cmd run test:browser -- tests/browser/visual-overhaul.spec.ts tests/browser/berry-trees.spec.ts tests/browser/camera.spec.ts tests/browser/evolution-terrain.spec.ts --grep 'terrain, shore|redesigned berry|berry trees read|normal traversal|starter captures|pause and upgrade|losing browser|capture denial|cancels a pending'
```

The two old `phase15.spec.ts` failures documented in Stage 00 were not modified or included in these targeted runs. Full browser-suite, subjective human play and target-hardware GPU performance remain outside this verification.

## Visual evidence

The normal-camera captures were opened and visually compared with the original references. Review identified overly diffuse patch transitions and exposed distant boundary trunks; patch boundaries were tightened and horizon bases corrected before final verification. The berry preview selects an existing clear sightline without removing scenery or changing the camera. Pine/tiered/round trees are distinguishable, five type-colored edge fruits read on the layered berry tree, the shore stays on the ground, and ordinary volcanic trees have bare silhouettes. Layout, rock clusters, clutter density and dynamic atmosphere remain for their subsequent stages.

The before/after pairs below use the same map seed and gameplay camera. The capture folders also contain matching `-gameplay.png`, `-ridge.png` and `-shore.png` views.

| Map / seed | Stage 00 | Stages 01–02 |
|---|---|---|
| Wildlands / 4 | [Before](../artifacts/visual-overhaul/stage-00/wildlands-spawn.png) | [After](../artifacts/visual-overhaul/stage-01-02/wildlands-spawn.png) |
| Pinewood / 46837 | [Before](../artifacts/visual-overhaul/stage-00/pinewood-route-spawn.png) | [After](../artifacts/visual-overhaul/stage-01-02/pinewood-route-spawn.png) |
| Ruins / 81073 | [Before](../artifacts/visual-overhaul/stage-00/ruins-route-spawn.png) | [After](../artifacts/visual-overhaul/stage-01-02/ruins-route-spawn.png) |
| Volcanic / 4 | [Before](../artifacts/visual-overhaul/stage-00/volcanic-ridge-spawn.png) | [After](../artifacts/visual-overhaul/stage-01-02/volcanic-ridge-spawn.png) |

Additional comparison: [berry tree at normal camera](../artifacts/browser/visual-overhaul-berry-normal-camera.png), [Pinewood shore](../artifacts/browser/visual-overhaul-pinewood-route-shore.png), [Volcanic shore](../artifacts/browser/visual-overhaul-volcanic-ridge-shore.png). Raw timing/draw-call/resource measurements and source fingerprints are in [metrics.json](../artifacts/visual-overhaul/stage-01-02/metrics.json).

Reproduce the separate final capture after tests finish:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort --configLoader native
# In another repository-root terminal:
$env:WILDLANDS_CAPTURE_DIR='artifacts/visual-overhaul/stage-01-02'
node scripts/visual-overhaul-baseline.mjs
```

This retains Stage 00 evidence and uses isolated browser storage, High preset, 1440×900/DPR 1, actual normal camera, original route seeds and seed 4 on the random maps. Measurements use 120 early active frames with natural enemies, Chrome SwiftShader software WebGL, muted audio and local PMD sprites. They are diagnostics rather than target-GPU FPS or late-wave measurements. Materials and geometry counts also include variable live actors/effects.

| Map | Mean / p95 frame interval (ms) | Mean draw calls (Stage 00 → final) | Final meshes / geometries / materials |
|---|---|---|---|
| Wildlands | 32.93 / 47.00 | 77.64 → 81.19 | 1700 / 46 / 78 |
| Pinewood | 27.85 / 30.80 | 94.12 → 95.82 | 1718 / 43 / 75 |
| Ruins | 29.51 / 32.20 | 93.51 → 94.40 | 1790 / 43 / 75 |
| Volcanic | 30.10 / 32.70 | 78.03 → 76.20 | 2357 / 38 / 70 |

Each map captured with zero page errors and unchanged generation checks. Extra tree parts are shared instances, so the additional silhouettes have modest draw-call impact despite the larger volcanic mesh count. Final source hashes match the files used for capture. Timing variation is not evidence of a guaranteed performance improvement.

## Files and rollback

Changed `src/data/maps.ts`, `src/game/render/World.ts`, and the existing capture helper. Added `src/game/render/terrainPalette.ts`, `src/game/render/vegetation.ts`, `tests/visual-overhaul.test.ts`, `tests/browser/visual-overhaul.spec.ts`, and this report; linked the report from the historical baseline. No dependencies were installed and no gameplay modules or save formats were edited for these stages.

The original `maps.ts` and `World.ts` were copied before editing to `artifacts/visual-overhaul/stage-01-02/before/`. These are task-specific recovery copies, not a whole-worktree checkpoint. The artifact folder is ignored by Git. Review overlaps before restoring either file, and preserve the user's unrelated balance/catalogue/test work. Revert only this stage's known edits if rollback is needed.
