# PROMPT 04 — Sparse tiny ground details (no grass shader)

## Nonnegotiable constraints (apply for every run)
You are working on an existing, playable Babylon.js/TypeScript Pokémon-inspired browser roguelite with THREE existing maps. Inspect the current repository and map keys before making changes. Preserve all existing gameplay (map selection, player controls, animations, enemies, XP, items, POIs, berry gathering, minimap, collision, seeds, pause, boss events and saves). Use buildable low-poly primitives / existing mesh factories, shared materials and seeded placements; no new rendering libraries, realism or expensive downloaded 3D assets. Do not invent filenames or change other systems unnecessarily. Run existing checks and test representative behavior in all three maps. Record unverified tests honestly. The art-reference images are style examples and do not override implementation-simplicity constraints.

## MANDATORY VISUAL REFERENCE

**Primary visual target:** `docs/ART_OVERHAUL/references/04_ground_details.png`  
**Supplementary visual targets:** `docs/ART_OVERHAUL/references/wildlands_biome.png`, `docs/ART_OVERHAUL/references/pine_biome.png`, `docs/ART_OVERHAUL/references/volcanic_biome.png`

Before implementation, locate and open every file above with an image-viewing capability and actually inspect it; do not rely on filenames or written descriptions. Analyze colors, silhouettes, proportions, geometry complexity, object density, and overall art direction. Treat the primary image as the sparse ground-detail visual target and the biome images as map-specific context, while preserving the existing Pokemon sprite aesthetic and Wildlands identity. They are not literal assets: prioritize the written technical specification, simple low-poly geometry/materials, existing architecture, performance, and gameplay over impractical generated detail. Never substitute complex models, detailed textures, or elaborate shaders merely to imitate a reference. After implementation, capture an actual normal-gameplay-camera screenshot and compare it with the original primary and supplementary images; identify and correct significant visual discrepancies before completion. If an image cannot be opened or visually inspected, or a screenshot cannot be captured, explicitly report that limitation.

## Stage task (copy into Codex)


Implement Stage 04: a deliberately minimalist ground-detail kit with no external meshes and no material-heavy grass system. Read the reference image for silhouette/density but follow these simpler construction limits: each tuft at most 2–3 low-poly blades; flowers at most 3–5 petal facets; mushroom 1 tiny stem + 1 low-sided cap; stump 1 low-sided short cylinder. Use **one or two material variations per class**, shared across copies. Don't add alpha-blended sprite billboards, high-poly grass, sway animation, textures or new libraries.

Make distribution controlled by biome profile and world seed. Balanced Wildlands: sparse tufts along patches, occasional tiny flower clumps, more around berry groves; pine forest: sparse dark grass, occasional mushrooms/logs in forest patches; volcanic: negligible green details, a few dark stone chips/small ash-colored fragments. Avoid decorating centers of active combat clearings; use exclusion zones around player starts, POIs, water edges, and existing collision objects.

Make all details **non-collidable, non-targetable and non-interactive**; they must never accidentally intercept a raycast meant for a cache/shrine/enemy. Parent or register them for reliable disposal on map unload. Use mesh merging/instances/thin instances for repeated static low-detail props, but keep the code maintainable and avoid huge CPU placement loops at each frame. Low visual priority and no tiny dynamic shadows. Keep everything readable from existing camera; no scenery should look like Pokémon XP orb drops or combat telegraphs.

**Validation:** compare screenshots with details toggled on/off (debug flag if easy), at starter spawn, in forest, at shoreline, and at boss/spawn combat area. Verify no grass density overwhelms frame; verify no impact on clicks, interactions, frame time or raycasts. Build/typecheck/tests, document biome density values.
