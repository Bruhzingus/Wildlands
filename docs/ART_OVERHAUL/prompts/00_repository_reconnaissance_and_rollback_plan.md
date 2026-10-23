# PROMPT 00 — Repository reconnaissance and rollback plan

## Nonnegotiable constraints (apply for every run)
You are working on an existing, playable Babylon.js/TypeScript Pokémon-inspired browser roguelite with THREE existing maps. Inspect the current repository and map keys before making changes. Preserve all existing gameplay (map selection, player controls, animations, enemies, XP, items, POIs, berry gathering, minimap, collision, seeds, pause, boss events and saves). Use buildable low-poly primitives / existing mesh factories, shared materials and seeded placements; no new rendering libraries, realism or expensive downloaded 3D assets. Do not invent filenames or change other systems unnecessarily. Run existing checks and test representative behavior in all three maps. Record unverified tests honestly. The art-reference images are style examples and do not override implementation-simplicity constraints.

## MANDATORY VISUAL REFERENCE

**Primary visual target:** `docs/ART_OVERHAUL/references/current_wildlands_baseline.png`  
**Supplementary visual targets:** `docs/ART_OVERHAUL/references/wildlands_biome.png`, `docs/ART_OVERHAUL/references/pine_biome.png`, `docs/ART_OVERHAUL/references/volcanic_biome.png`

Before the audit, locate and open every file above with an image-viewing capability and actually inspect it; do not rely on filenames or written descriptions. Analyze colors, silhouettes, proportions, geometry complexity, object density, and overall art direction. The primary image establishes the current visual baseline; the supplementary images establish the intended three-biome direction. They are visual targets, not literal assets. Preserve the existing Pokemon sprite aesthetic and Wildlands identity, and prioritize the written technical requirements, realistic simple low-poly geometry/materials, architecture, performance, and gameplay over any impractical generated detail. Never substitute complex models, detailed textures, or elaborate shaders to imitate a reference. This audit makes no visual implementation change: when browser screenshots are available, capture the actual normal-camera baseline and compare it with the primary image for the report. If any named image cannot be opened or visually inspected, or a baseline screenshot cannot be captured, explicitly report that limitation.

## Stage task (copy into Codex)


You are lead technical artist and senior gameplay engineer working on my actively developed Pokémon Wildlands browser game. Inspect the WHOLE CURRENT REPOSITORY before editing anything. The game already has three distinct maps (balanced Wildlands, pine forest, volcanic/mountainous), Pokemon Mystery Dungeon-style 2D sprites, low-poly 3D environment, auto-combat, interactable shrines/caches/berries, a minimap and a time-limited run. Our art target is muted Megabonk + recognizable Pokémon pixel-sprite charm, without adding realism.

**Audit and report:** (1) actual engine and package versions; (2) all existing map registration keys; (3) each map generation/preset entry point; (4) terrain-mesh and vertex-color/material creation; (5) procedural object placement and seed system; (6) tree/rock/berry tree mesh factories and placement; (7) collision/interaction model; (8) current landmark placement; (9) lake/water rendering and collision; (10) lighting/fog/day-night code; (11) asset lifecycle/disposal; (12) performance instrumentation; (13) screenshot/browser testing capabilities. Locate *existing* tests and build scripts. Never guess class names.

**Before refactoring**, determine whether we can implement this visual overhaul by extending current factories and generator configs. Identify what should be reused. Name probable high-risk coupling: terrain Y sampling, enemy spawn surface, collision proxies, camera clipping, geometry materials, seed determinism, serialization map names, minimap transform.

Add a concise `docs/VISUAL_OVERHAUL_BASELINE.md` documenting map key mapping, target code locations, exact baseline behavior, performance measurement procedure, and implementation order. If safe and useful, add a read-only debug configuration to switch among the **existing** three maps with stable seeds; never break normal selection or saves. Do not replace the generator, change game balance, create new models, or add dependencies.

**Tests:** run package build/typecheck/test commands if they exist; if a local browser is accessible, capture screenshots for all three maps from the normal camera. Record baseline frame timing/draw calls if instrumentation is available. Report precise commands/results, whether game launch was actually verified, and a concrete checklist for Stage 01.
