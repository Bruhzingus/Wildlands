# Water, sky and shrine polish — October 23, 2026

The recent terrain, vegetation, rock and chest work exposed three weaker areas:
the lake read as a painted disc, the sky's faint sine bands had little cloud
shape, and shrine sculptures lacked the anatomy and carved detail of the other
crafted assets. Shrine density also felt sparse across the expanded maps.

## Changes

- Water retains the existing lake position, height and circular collision
  boundary. A deeper blue centre blends into uneven green shallows. Slow,
  broken wavelets, a restrained sky reflection, sunlight glints and interrupted
  shoreline highlights are drawn in the same opaque surface. Motion follows
  the run clock and presentation preview; pause freezes it.
- Two sparse cloud layers mix flat banks, compact puffs and taller asymmetric
  cumulus, with varied sizes, altitude, spacing and opacity. Their shaded bases
  and warm caps adapt to each silhouette. A small sun disc and broad halo share
  the existing lighting direction.
  Day/dusk colours still come from each map's original atmosphere curve.
- All 24 shrine species have authored stone silhouettes, sculpted faces and
  distinctive ears, tails, wings, claws or crests. Stone wings have thickness
  and bevels, including feather, bat, dragon and lightning shapes. Eyes and
  carved relief use the existing two stone materials.
- Shrine bases have a stepped octagonal footing, a beveled seat, incised
  borders, diamond seals and small lichen patches. Spent shrine pedestals
  retain their shape so their sculptures remain seated on stone.
- Four permanent shrine sites are added per new run, one in each region.
  There are now 22 discoveries available initially and 25 total, including
  at least 12 shrines. The original 21 sites retain their positions, UIDs,
  cache stock and timed discoveries. Additional clearings and routes affect
  scenery placement, so scenery fingerprints were refreshed.

## Rendering and scope

No new dependencies, image textures, render targets, shadow maps or render
observers. The lake remains one mesh/material, with 960 triangles; its material
adds a small procedural fragment calculation and scalar clock update. Clouds
share the existing sky draw. Sculptures merge temporary pieces once per species,
then share source geometry and materials between sites. The plinth is one
shared mesh with baked vertex colours. The extra sites use existing encounter
tiers, variants, interactions and rewards.

Each sculpture uses exactly two submeshes/material batches, rather than a batch
per sculpting piece. The largest of the 24 sources is 3,462 triangles.

Normal gameplay and diagnostic closeups are captured separately. Reference
direction remains the warm low-poly Wildlands artwork, with crisp sprite pixels.
Software WebGL captures do not establish target-hardware GPU performance.

## Reproducible review

Run Vite, then `node scripts/review-art-polish.mjs` for all-map daylight/dusk,
water, shrine and horizon screenshots. Output is under ignored
`artifacts/art-polish/`. `scripts/review-shrine-statues.mjs` provides isolated
front, oblique and reverse sculpture views.

Automated coverage includes original-site preservation, 256 seeded map layouts,
dry access and spacing, closed lake geometry, pedestal seat height, all shrine
species, world cleanup and water clock/preview rendering.

## Verification results

- Complete unit suite: **557/557 passed** (`npm test`).
- Final statue, lake, pedestal and world cleanup checks: **7/7 passed** after
  the last sculpture adjustment.
- Selected browser regressions: **16/16 passed**, combining the main run and
  focused reruns. Coverage includes all four map palettes, shores and horizons,
  paused water/preview restoration, normal camera invariance, berry harvesting,
  timed discoveries, both legendary/endless flows, movement and ten restarts.
- TypeScript and production build passed (`npm run build -- --configLoader runner`).
- **28** all-map presentation screenshots and **72** isolated sculpture views
  were captured without shader errors. Daylight/dusk map captures and all six
  sculpture contact sheets were visually reviewed.

The shrine count expectation was updated from 18 to 22 in the timed-discovery
browser test. The gameplay input test now uses a fixed seed and waits for
observed movement instead of assuming a short wall-clock key hold contains a
rendered game frame. Gameplay code was not changed for these test adjustments.

Logs are in `artifacts/art-polish/`: `unit-tests-final.log`, `focused-final.log`,
`browser-tests-final.log`, `browser-rerun.log`, `browser-game-final.log` and
`build-final.log`. The main browser run passed 14 checks; its two outstanding
checks passed after updating the shrine count and stabilizing the input check.
