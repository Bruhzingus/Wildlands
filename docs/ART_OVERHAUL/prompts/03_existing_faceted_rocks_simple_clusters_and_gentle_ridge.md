# PROMPT 03 — Existing faceted rocks, simple clusters and gentle ridges

## Nonnegotiable constraints (apply for every run)
You are working on an existing, playable Babylon.js/TypeScript Pokémon-inspired browser roguelite with THREE existing maps. Inspect the current repository and map keys before making changes. Preserve all existing gameplay (map selection, player controls, animations, enemies, XP, items, POIs, berry gathering, minimap, collision, seeds, pause, boss events and saves). Use buildable low-poly primitives / existing mesh factories, shared materials and seeded placements; no new rendering libraries, realism or expensive downloaded 3D assets. Do not invent filenames or change other systems unnecessarily. Run existing checks and test representative behavior in all three maps. Record unverified tests honestly. The art-reference images are style examples and do not override implementation-simplicity constraints.

## MANDATORY VISUAL REFERENCE

**Primary visual target:** `docs/ART_OVERHAUL/references/03_rocks_elevation.png`  
**Supplementary visual targets:** `docs/ART_OVERHAUL/references/wildlands_biome.png`, `docs/ART_OVERHAUL/references/pine_biome.png`, `docs/ART_OVERHAUL/references/volcanic_biome.png`

Before implementation, locate and open every file above with an image-viewing capability and actually inspect it; do not rely on filenames or written descriptions. Analyze colors, silhouettes, proportions, geometry complexity, object density, and overall art direction. Treat the primary image as the rocks/ridges visual target and the biome images as map-specific context, while preserving the existing Pokemon sprite aesthetic and Wildlands identity. They are not literal assets: prioritize the written technical specification, simple low-poly geometry/materials, existing architecture, performance, and gameplay over impractical generated detail. Never substitute complex models, detailed textures, or elaborate shaders merely to imitate a reference. After implementation, capture an actual normal-gameplay-camera screenshot and compare it with the original primary and supplementary images; identify and correct significant visual discrepancies before completion. If an image cannot be opened or visually inspected, or a screenshot cannot be captured, explicitly report that limitation.

## Stage task (copy into Codex)


Implement Stage 03 using the current rock factories, terrain collision and world placement rules. Keep the faceted low-poly shapes already used in Wildlands; retain existing colors unless applying small biome-specific tints. Add **3 predictable size classes** to the existing rock variant pool and change grouping from uniform scattering toward sparse cluster centers. E.g., many clear areas, a small number of 2–5 rock groups, and an occasional larger boulder. Do this with **seeded map data**, not `Math.random()` in render paths. No realistic rock textures or high-poly sculpting.

Where needed and compatible with existing terrain, introduce a limited number of modest sloping ridges/outcrops, preferably using the existing heightfield/terrain sampling rather than tall collision-heavy separate meshes. Do not replace topography. Slope must remain walkable to the player where the original path was walkable. Terrain obstacles must not destroy enemy AI access, XP collection, shrine access, boss arena, or camera follow. If raising terrain causes Y-coordinate mismatch, fix grounded object placement through the existing terrain-height sampling pipeline, not an ad hoc offset.

Give volcanic map the most stone and exposed earth; pine forest uses occasional moss-neutral rock clusters along forest gaps; balanced Wildlands contains readable stone groups around minor hills with plenty of open meadow left. Place near shorelines only where they don't block intended interactions.

**Technical:** reuse meshes/materials, avoid one draw call per tiny stone, apply simplified static collision only when existing rocks are gameplay blockers; extra pebbles are decorative. Keep per-map instance counts configurable. Avoid shadows for all tiny stones. Preserve deterministic seeds and minimap logic.

**Validation:** Compare all 3 maps near a slope, rock cluster and open clearing. Run a movement/jump/dodge path across representative hills. Verify enemies can approach, collision proxies match visuals, terrain shadows don't black out sprites, and no spawn point is placed inside a blocking rock. Run existing tests/build. Report source file changes and screenshot locations.
