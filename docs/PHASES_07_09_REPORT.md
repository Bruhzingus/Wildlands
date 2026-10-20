# Roadmap phases 07–09 implementation and verification

Continues the existing game without changing its control scheme or rebuilding the UI. Native mouse capture, camera-relative movement, full upgrade pause, the 36-item/12-synergy build system, permanent follower fainting and world health bars remain intact. Phase 03 is not marked complete by this request.

## PHASE: 07 — Enemy factions and special variant behaviours

What changed: Added one registry for normal, Dark, Rocket, Rabid, Poisoned and Legendary definitions. Factions configure HP, damage, speed, animation cadence, aggression, rarity and XP. Dark keeps its species types; Dark/Rocket/Rabid add no faction-specific attacks. Rabid is explicitly fragile and fast. Poisoned contact applies an exact-lifetime 4.5-second poison to either leader or followers, persists after separation and can permanently faint a follower. XP splits one faction-adjusted total between the immediate reward and drop. Five outlined shared glyphs identify variants without relying on color: diamond, R, double chevron, droplets and crown. Pause/results show an enemy-marker legend.

Changed files: `src/data/variants.ts`, `src/game/systems/spawning.ts`, `src/game/render/AssetLibrary.ts`, `src/game/Simulation.ts`, `src/game/types.ts`, `src/ui/UI.ts`, `src/style.css`, `tests/variants.test.ts`, `tests/director.test.ts`, `tests/browser/variants.spec.ts`.

Why the approach is maintainable: Species and factions remain independent data. Existing attack execution is shared; the simulation consumes generic multiplier/reward/poison helpers. Idle/walk animation speed may change, while one-shot attack poses still follow authoritative attack timers. Glyphs use five geometries, one shared material and recycled instances with no new textures.

Tests run: `node --experimental-strip-types --test tests/variants.test.ts` passed five cases covering all 151 species, 120,000 seeded rarity samples, reward multipliers, director overrides and glyph resource lifecycle. Integrated poison and XP-split checks pass in `tests/director.test.ts`. Full-suite and browser results are below.

Browser smoke steps: Verified all five variant glyphs render with real WebGL, follow the camera, remain frozen while paused, reuse their instances across twenty waves and disappear with their material on restart. The normal starter/Resume gestures still acquire native pointer lock.

Known limitations: The optional poison death patch was intentionally omitted. Ordinary contact attacks remain shared; elites retain the common telegraphed slam independently of faction. Legendaries are excluded from ordinary variant rolls.

Balance / performance impact: Nearby identifying glyphs are capped at 72 within 42m; free lists retain at most 24 per kind. Rabid HP is 0.82× and speed 1.75×; Dark and Rocket durability/power are 1.5× and 1.7×. These numbers remain tuning data and need human comfort/balance sessions.

Next recommended phase: 08 — implemented in this same request.

Regression checklist: Species typing, first-stage recruit restrictions, shared attacks, one-shot animation, permanent follower fainting, pause semantics, entity budgets, native mouse capture and restart disposal remain covered.

## PHASE: 08 — Multi-biome map polish and useful exploration

What changed: Added shared meadow, woodland, ruins and lake-edge definitions, modest rolling terrain, Great Pine/Broken Gate/Watchstones/Stillwater landmarks and twelve seeded optional sites. The central clearing is safe from scenery; generated routes preserve clear approaches to every site. A shallow shoreline and pond collider prevent the player disappearing under the water disc. Soft boundaries slow outward motion before the hard square edge without blocking inward or tangential movement. Optional sites can trigger rare wild-bloom, cache-ambush or ancient-echo events, with no mandatory objective/checklist. POIs sit on shared terrain. The minimap now shows the actual square map, north, biome colors, distinct POI symbols and overlap-protected markers with small connector offsets.

Changed files: `src/data/world.ts`, `src/game/systems/environment.ts`, `src/game/render/World.ts`, `src/game/Simulation.ts`, `src/ui/UI.ts`, `src/ui/minimap.ts`, `src/style.css`, `index.html`, `tests/environment.test.ts`, `tests/world.test.ts`, `tests/minimap.test.ts`, `tests/exploration-integration.test.ts`, `tests/browser/world-boss.spec.ts`.

Why the approach is maintainable: Pure helpers own seed-based placement, routes, biome queries, terrain height, collision geometry and rare-event selection. Rendering and simulation use the same layout/height data. Simulation interprets the optional event hooks. Minimap layout is independent of Canvas drawing and caches its static biome background per run.

Tests run: `node --experimental-strip-types --test tests/environment.test.ts tests/world.test.ts` passed eight cases. An additional 10,000-seed placement audit checked 120,000 sites for spacing, safe area, bounds and shoreline clearance. Six representative seeds traverse all twelve routes using actual player collision. Minimap tests cover square corners, north/east orientation and overlapping symbols. Actual-interaction tests cover one-shot rare healing/shrine rewards and a distant cache ambush during completely frozen item selection.

Browser smoke steps: Visited and captured all four rendered biomes, checked region labels and world landmark instances, interacted with a real cache through E, verified complete choice pause and selected an item with automatic cursor recapture. Screenshots are listed below.

Known limitations: Landmark geography is authored; smaller sites, encounter rolls and decoration are seeded. The pond boundary stops the player rather than adding swimming. Scenery collision still applies to the player; enemies use the existing inexpensive movement. Human navigation/comfort sessions remain outstanding.

Balance / performance impact: Twelve sites preserve five caches, two shrines, two heals and three elite challenges. Rare hooks occurred at 346/4,500 eligible sites (7.69%) across 500 seeds against an 8% target. Decoration caps at 610 props and uses fewer than twenty shared geometries despite hundreds of instances. Ten repeated world constructions/disposals return resource counts to baseline. Optional exploration does not gate the main run.

Next recommended phase: 09 — implemented in this same request.

Regression checklist: Safe central spawn, clear interaction areas, deterministic layouts, shared terrain/collision, all POI kinds, one-use rewards, full pause, camera controls and resource disposal remain covered.

## PHASE: 09 — 15-minute pacing, legendary boss and endless difficulty

What changed: Added an inspectable director with transitions at 3/7/11/13/15 minutes, live faction/species weights, arrival intervals, density/HP adaptation, bounded actor budgets and accepted/denied spawn telemetry. A 15-second warning precedes Mewtwo at 15:00. Mewtwo cycles a fixed-aim seven-shot volley, an expanding psychic ring and a brief summon charge, each with a pausable, stunnable tell and a readable HUD hint. Rings use swept radial collision, jump clearance, dodge invulnerability and one hit per member; their pooled geometry follows the rolling terrain so the dangerous band stays visible. Summons arrive outside the immediate fight and respect budgets. Boss victory clears hostile projectiles/rings; continuing endless retains the party, HP, species, move ranks, items and buffs, then increases arrival pressure and enemy strength beyond 20 minutes. Existing late recruitment gates remain unchanged.

Changed files: `src/data/director.ts`, `src/game/systems/director.ts`, `src/game/Simulation.ts`, `src/game/types.ts`, `src/game/render/Effects.ts`, `src/data/config.ts`, `src/ui/UI.ts`, `src/style.css`, `index.html`, `tests/director.test.ts`, `tests/effects.test.ts`, `tests/browser/world-boss.spec.ts`, `scripts/progression-pacing.mjs`, `scripts/boss-pacing.mjs`, `README.md`, `GAME_DESIGN_AND_ROADMAP.md`, this report.

Why the approach is maintainable: Tuning data owns phase and boss parameters. The director returns an authoritative snapshot; simulation owns damage, hazards and transitions; the renderer consumes state. Future arrival adaptation never deletes or moves existing enemies. Boss phases reuse ordinary faction enemies and projectile execution. Terrain-following waves reuse bounded updatable ribbon meshes within the existing combat allocation budget.

Tests run: `tests/director.test.ts` covers phase boundaries, warning timing, spawn adaptation/budgets, all three boss behaviors, stun/pause cancellation, swept ring collision/jump/dodge, poison/XP integration, victory preservation and bounded simulation after 20 minutes. Effects tests check wave height against every terrain sample, exact pause, forty reuse cycles and disposal. Seeded experiments and final commands are below.

Browser smoke steps: Observed the approach warning and scheduled Mewtwo/HP bar; froze a psychic-ring tell, resumed into an actual expanding wave, paused the wave, observed/froze the summon tell and resumed into three reinforcements. Defeated the boss with Q, checked the real victory screen, continued endless with native cursor recapture and verified retained party/build/HP and cleared hazards. Existing aimed-volley and camera regressions also run in the combined suite.

Known limitations: Human 15-minute balance and target-hardware GPU FPS remain unmeasured. The isolated boss victories took 12.56–23.52 seconds, shorter than the roadmap's 30–75-second tuning hypothesis; the fire/melee trio lost. Existing ambient crowds persist when the boss-period arrival budget decreases. Subsequent legendary bosses are optional and not scheduled in this implementation.

Balance / performance impact: Opening budget is 34, rising through 65/108/145/175 before the boss. Boss-period future arrivals ease to a 64-enemy target and 1.55-second base interval to keep tells readable; existing enemies remain. Low HP reduces future pressure. Endless returns to a 175-enemy target, with the global 190-actor cap, faster bounded arrivals and rising HP/damage. Mewtwo has `3400 + 85 × player level` HP, with ordinary special cooldowns and damage rules. Exact experiment conditions are below.

Next recommended phase: 10.

Regression checklist: Exact recruit gates, first-stage-only choices, four-member standard-run progression, explicit evolutions, permanent follower fainting, all existing builds, complete pause, fixed projectile trajectories, native pointer lock, actual victory/endless transitions and restarts remain covered.

## Verification and measured limits

Baseline: 111 logic tests, TypeScript and the existing real-WebGL gameplay smoke test passed before implementation. Phase source freeze passed 139 logic tests. Additional attack-presentation changes arrived in the shared workspace during final validation and were preserved; the combined source now passes **145/145** with `npm test`. Full TypeScript checking and the production build pass. Vite still reports the existing large Babylon chunk, approximately 6.12 MB (1.36 MB gzip).

`npm run test:browser -- tests/browser/camera.spec.ts tests/browser/game.spec.ts tests/browser/ui.spec.ts tests/browser/combat.spec.ts tests/browser/phases.spec.ts tests/browser/variants.spec.ts tests/browser/world-boss.spec.ts --output artifacts/browser/07-09-final` passed **20/20**. This includes six native mouse-capture cases, existing movement/combat/progression/UI regressions, faction glyphs and three new exploration/boss cases.

Visual review then corrected washed-out lake/shore/effect colors by keeping those materials unlit. Constructing effect materials before their meshes also avoids an unintended Babylon default-material allocation. Nine Effects/World checks passed afterward, including the concurrently added slash/reduced-motion checks. A repeat browser run passed six of seven cases; its first case was interrupted by a shared-workspace hot reload. The final combined browser rerun therefore uses an ignored source snapshot on port 5174. A hash comparison confirmed snapshot source and workspace source match; the normal application remains on port 5173.

Concurrent attack-presentation edits in `src/game/render/animation.ts`, `src/game/render/AssetLibrary.ts`, `src/game/render/Effects.ts`, `tests/animation.test.ts`, `tests/effects.test.ts` and `tests/browser/attack-polish.spec.ts` are preserved and included in combined validation. They do not mark phase 10 complete.

The isolated combined run passed **24/24** with `npx playwright test --config artifacts/playwright.07-09.config.ts tests/browser/camera.spec.ts tests/browser/game.spec.ts tests/browser/ui.spec.ts tests/browser/combat.spec.ts tests/browser/phases.spec.ts tests/browser/variants.spec.ts tests/browser/world-boss.spec.ts tests/browser/attack-polish.spec.ts --output artifacts/browser/07-09-snapshot-final`. This includes all phase regressions plus actual GPU shader/fade and reduced-motion attack checks. The temporary config/snapshot are ignored QA artifacts; they preserve normal development and production behavior.

`npm run preview -- --port 4173 --strictPort`, followed by `node artifacts/production-smoke.mjs`, passed on the compiled bundle: starter/Resume native capture, relative mouse movement beyond the viewport, frozen pause, restart, no developer gallery without its flag and zero page/console errors.

A later shared-workspace edit adjusts only the added body pose after a charged attack releases. It is preserved, with **10/10** focused browser cases passing using `npx playwright test --config artifacts/playwright.07-09.config.ts tests/browser/attack-polish.spec.ts tests/browser/world-boss.spec.ts tests/browser/combat.spec.ts --output artifacts/browser/07-09-release-pose-final`. The source snapshot was refreshed for that change, the production build and smoke test passed again, and a final hash comparison confirmed all snapshot source files match the workspace. No further source edits were made during those final checks.

Reviewed screenshots: `phase-faction-markers.png`, `phase-map-meadow.png`, `phase-map-woodland.png`, `phase-map-ruins.png`, `phase-map-lake.png`, `phase-mewtwo-arrival.png`, `phase-mewtwo-ring-tell.png`, `phase-mewtwo-ring.png`, `phase-mewtwo-summon-tell.png` and `phase-mewtwo-victory.png` under `artifacts/browser/`. Lake water now stays teal, enemy glyphs remain outlined, and the psychic band remains visible on the terrain. Screenshots use controlled QA fixtures, including high HP/invulnerability where needed to inspect visuals; they are not balance evidence.

`node --experimental-strip-types scripts/progression-pacing.mjs` ran 24 seeded 15-minute routes: all reached four living members and three recruits, mean level 30.29, zero faints. This experiment maintains player/follower health to isolate progression. Close-range leaders approach enemies when outside their actual attack area; ranged leaders orbit. A constant fast orbit had previously outrun Ghastly's aura indefinitely in one seed. Recruitment gates, XP and the six-seed assertions were preserved. These results are not proof of casual-player survival.

`node --experimental-strip-types scripts/boss-pacing.mjs` ran four isolated fights in the clear meadow with level-20, rank-four teams, Quick Claw/Wide Lens/Scope Lens and scripted orbit/jumps/dodges. The scheduled boss is placed 12m away after spawning for a repeatable encounter. No HP maintenance or damage overrides are used. Results:

| Team species IDs | Result | Fight seconds | Leader HP remaining |
|---|---|---:|---:|
| 9 / 26 / 3 | Victory | 16.20 | 57.14 |
| 9 / 26 / 3 / 65 | Victory | 12.56 | 120 |
| 6 / 38 / 123 | Defeat; boss 395.1 HP remaining | 26.44 | 0 |
| 25 / 81 / 131 / 65 | Victory | 23.52 | 101.65 |

These are scripted scenarios with chosen builds, not a predicted win rate or complete-run balance acceptance. Local JSON artifacts are `artifacts/progression-pacing-07-09.json` and `artifacts/boss-pacing-07-09.json`. Browser screenshots/traces remain ignored under `artifacts/browser/`. No new external assets, runtime services, packages or publishing steps were introduced.
