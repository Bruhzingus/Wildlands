# Wildlands visual overhaul — how to use

1. Open `WILDLANDS_VISUAL_OVERHAUL_CODEX_PROMPTS.md` for the art brief, all 3 biome profiles, model/reasoning recommendations, and stage-by-stage acceptance criteria.
2. Keep this folder in your repository, e.g. `docs/art-overhaul/`, so Codex can access `references/`.
3. Run **Prompt 00** from `prompts/` first, using **GPT-6 Astra / High**. It must discover the *current* code structure, map registry, and collisions; don't skip it.
4. Run prompts 01–06 individually with **GPT-6.1 Sol** (Medium for simple meshes, High for terrain and cross-system work). Use **GPT-6 Astra / Extra High** for Prompt 07 and **Astra / High** for Prompt 08.
5. After each phase, inspect a screenshot on all three existing maps and commit a checkpoint. If Codex begins rewriting gameplay systems, stop and restate scope.

This is an implementation **brief and reference pack**, not a new source-code project or modifications to your current repository. The references are stylized concept images; obey the smaller primitive geometry specs if a pictured prop looks more elaborate.

## Visual Reference Workflow

Before implementing any stage, open and visually inspect the exact primary and supplementary image files named in that stage's **MANDATORY VISUAL REFERENCE** section. The images are achievable art-direction targets, not assets to insert into the game or literal modelling instructions. When a generated image suggests impractical geometry, detailed textures, or elaborate effects, the written technical specification, existing architecture, performance budget, and gameplay systems take priority. Preserve the crisp Pokemon-sprite aesthetic and the established Wildlands identity. Where browser screenshots are available, capture the implemented result from the normal gameplay camera and compare it with the named references; correct significant discrepancies before completing the stage. If an image or screenshot cannot be viewed, report that limitation explicitly.
