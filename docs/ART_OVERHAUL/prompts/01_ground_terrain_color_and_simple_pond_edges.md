# PROMPT 01 — Ground, terrain color and simple pond edges

## Nonnegotiable constraints (apply for every run)
You are working on an existing, playable Babylon.js/TypeScript Pokémon-inspired browser roguelite with THREE existing maps. Inspect the current repository and map keys before making changes. Preserve all existing gameplay (map selection, player controls, animations, enemies, XP, items, POIs, berry gathering, minimap, collision, seeds, pause, boss events and saves). Use buildable low-poly primitives / existing mesh factories, shared materials and seeded placements; no new rendering libraries, realism or expensive downloaded 3D assets. Do not invent filenames or change other systems unnecessarily. Run existing checks and test representative behavior in all three maps. Record unverified tests honestly. The art-reference images are style examples and do not override implementation-simplicity constraints.

## MANDATORY VISUAL REFERENCE

**Primary visual target:** `docs/ART_OVERHAUL/references/01_terrain_paths.png`  
**Supplementary visual targets:** `docs/ART_OVERHAUL/references/wildlands_biome.png`, `docs/ART_OVERHAUL/references/pine_biome.png`, `docs/ART_OVERHAUL/references/volcanic_biome.png`

Before implementation, locate and open every file above with an image-viewing capability and actually inspect it; do not rely on filenames or written descriptions. Analyze colors, silhouettes, proportions, geometry complexity, object density, and overall art direction. Treat the primary image as the terrain/shore visual target and the biome images as map-specific context, while preserving the existing Pokemon sprite aesthetic and Wildlands identity. They are not literal assets: prioritize the written technical specification, simple low-poly geometry/materials, existing architecture, performance, and gameplay over impractical generated detail. Never substitute complex models, detailed textures, or elaborate shaders merely to imitate a reference. After implementation, capture an actual normal-gameplay-camera screenshot and compare it with the original primary and supplementary images; identify and correct significant visual discrepancies before completion. If an image cannot be opened or visually inspected, or a screenshot cannot be captured, explicitly report that limitation.

## Stage task (copy into Codex)


Implement Stage 01 of the Wildlands visual overhaul. Read `docs/VISUAL_OVERHAUL_BASELINE.md`, current map configs and the specified reference images first. **Retain the three existing maps and existing terrain generation algorithm** unless there is a demonstrated failure; add a small reusable per-biome palette abstraction where the current architecture calls for it. Improve the appearance of the ground without changing terrain height, traversal speed, movement, gravity, collision, enemy spawn data, minimap coords, or saved map IDs.

For the balanced Wildlands map, replace overwhelming uninterrupted flat green with **sparse, broad, irregular patches** of subtly different green, olive, and warm soil. Use low-frequency seeded procedural masks, mesh vertex colors, existing material layers, or a handful of conforming low-poly patches—choose the *least invasive* option based on current terrain. Patch shapes must not visibly float or Z-fight; if using decals/meshes, offset minimally and sample actual terrain Y. Patches are decorative, not roads and not collision obstacles. Keep the central combat field open.

Apply related but independent palettes to the existing pine and volcanic maps. Pine has deeper greens / cooler neutral forest floor; volcanic is muted warm gray and earthy rust with occasional charcoal, and does NOT become lush. Resist bright neon hues, pixelation overlays, displacement textures, noise maps with high frequency, or realistic materials. Prefer `StandardMaterial`/existing materials and material reuse over one material per patch.

If a lake/pond already exists, preserve the surface bounds and water functionality while improving the visual edge: make a simple light sand/mud band as a conforming polygon/ring, or an understated shoreline gradient if supported by existing mesh. The bank should be short, clean, and not interfere with actual collision. Do not add swimming, rivers, hydrodynamics, expensive reflection/refraction, or new shaders. Preserve whichever water/lava features each map currently has.

Put editable colors, patch density, patch size, and shore settings in the biome configuration. Use seeded reproducible randomness; if there is no shared seed system, reuse current deterministic map seed rather than installing a new generator. Preserve the current map selection and terrain disposal sequence.

**Validation:** capture side-by-side screenshots of each existing map at the same seed/camera. Verify there are no floating patches, seam discontinuities, terrain holes, camera clipping changes, water collision regressions, new blocked movement lanes, or dramatic extra draw calls. Run tests/typecheck/build. Keep file changes isolated and report tunable parameters.
