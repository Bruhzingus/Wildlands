# Lighting, atmosphere and map edges — October 23, 2026

All four maps expand from 287.5 × 287.5 to **359.375 × 359.375 world units**.
“25% larger” means 25% more width and depth, giving 56.25% more area. The
shared `MAP_SCALE` controls playable bounds, terrain, landmark/lake positions,
seeded placement and minimap projection. Resource counts and combat arrival
cadence stay bounded. Routes retain their authored seeds, but their expanded
placements are intentionally different; geography fixtures were refreshed.

## Presentation

- Less emissive/hemispheric fill and a warmer directional key reveal more
  contrast between low-poly faces. Soft canopy/contact shade is baked into
  existing terrain colors, including both landmark-dressing variants.
- Scenery materials use a small shared material plugin: exponential distance
  falloff, a little extra mist in low areas, cool sky color above the horizon,
  and warmer scattering toward the sun. A matching gradient sky has subtle
  broad cloud wisps. The existing run clock drives the original map-specific
  day/dusk palettes and preview controls; pause and endless behavior are retained.
- Sprites and combat effects keep their existing materials and scene fog.
  Atmospheric changes do not tint sprite pixels or alter their filtering.
- A single continuous perimeter mesh adds gentle banks and successive outer
  ridges, with taller stone silhouettes on Volcanic Ridge. Its first vertex row
  matches every ground-edge subdivision, including corners. Trees at the edge
  now have rooted trunks. Existing soft slowdown and hard movement bounds keep
  the scenic extension outside gameplay, including during flight/dodge.

## Implementation and tuning

`src/data/world.ts` owns scale. `src/game/render/World.ts` owns material/light
tuning and construction. `terrainShade.ts` bakes shade at build time using a
small spatial grid; `worldPerimeter.ts` builds the outer terrain.
`atmosphereScattering.ts` contains the scenery blend and sky shader;
`atmosphere.ts` samples the run curve, shares colors and restores scene state
on disposal. There are no new textures, shadow-map passes or render observers.
The sky and perimeter add two geometry/material rendering batches (the
perimeter reuses the ground material); shade adds no meshes or frame work.

The expanded lake exposed a small mismatch between world-space candidate
clearance and map-local route padding. Candidate validation now scales that
padding, avoiding failed dry-route generation at some lake positions.

## Verification

Automated checks cover deterministic placement, reachable discoveries, expanded
edge/corner spawn rings, movement bounds, ground/perimeter joins and upward
normals, pause/preview/endless continuity, and resource cleanup across restarts.
Browser captures and shader checks cover all four maps at daylight and dusk,
all four sides, a corner, and the widest/shallowest gameplay camera.
Evidence is stored under ignored `artifacts/world-atmosphere/`.

Results: `npm test` passed **516/516**. After the final ground-shade/perimeter
tuning, the focused world, environment, visual and atmosphere suites passed
**18/18**. Typecheck and production build passed. The selected browser suites
passed **14/14** across the regression run and its three corrected-test reruns:
all-map atmosphere/interactions, gameplay/restarts, ten simulated movement
minutes, timed discovery, Moltres/endless, and challenge settings.

Three legacy browser expectations were updated to match existing game behavior:
the timed Geothermal discovery is now a cache, bosses absorb huge damage at
chapter thresholds, and material cleanup compares restarts with the complete
live world's resource count instead of an old absolute cap. No gameplay was
changed to satisfy those tests.

Target-device GPU timing and human play comfort are not measured by these
software-WebGL captures. The scenery is deliberately simple and static; the
new haze is inexpensive atmospheric color, not a volumetric weather simulation.
