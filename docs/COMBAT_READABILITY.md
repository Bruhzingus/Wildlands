# Combat readability follow-up

Requested changes implemented on 2026-10-18: simple Megabonk-inspired health bars, clearer attack animation and enemies spawning farther away.

- **Health bars:** Thin outlined bars above the player and up to 24 nearby enemies within 28 units. Muted green/red fills ease toward authoritative HP. No new labels, numbers or flashes. Shared mesh instances/materials are disposed on restart. Bounds from loaded sprite poses reserve clearance above airborne attacks; bars also follow jumping and camera rotation. Reduced motion disables fill easing.
- **Attack animation:** Party members retain their attack aim. Each swing fits its simulation window using the source's relative frame holds, completes once, and joins the correct frame if its sheet loads late. Enemy contact attacks and boss volleys have attack poses. Missing/aliased attack art gets a restrained push/recovery that respects reduced motion.
- **Spawning:** Opening enemies and regular waves use a 24–34 unit ring, replacing regular waves' 7.5–14 units. Bosses use 30–38 units. Bounded sampling and an inward fallback preserve spacing at map edges; spawn cadence and entity caps are unchanged by this follow-up.

Changed files: `src/data/config.ts`, `src/game/Game.ts`, `src/game/Simulation.ts`, `src/game/types.ts`, `src/game/render/HealthBars.ts`, `src/game/render/AssetLibrary.ts`, `src/game/render/animation.ts`, `src/game/systems/spawning.ts`, `tests/animation.test.ts`, `tests/combat-animation.test.ts`, `tests/healthbars.test.ts`, `tests/spawning.test.ts`, `tests/browser/combat.spec.ts`, `GAME_DESIGN_AND_ROADMAP.md`, this report.

The simulation owns HP, facing and attack timers; rendering owns bars and sprite playback. Health bar and attack presentation tuning lives in `src/data/config.ts`. This follow-up does not claim completion of later roadmap phases or a human balance/performance playtest.

## Verification

- Baseline `npm test`: 39/39 passed. After implementation, `npm test`: 56/56 passed.
- `npm run build`: passed after the initial implementation, with the existing Babylon bundle-size warning.
- `npx playwright test tests/browser/combat.spec.ts`: 3/3 passed after the sprite-clearance fix. Checks cover rendered bars, HP/easing, full pause, jumps/camera orbit, crowd limits, dead/distant actor removal, disposal, target facing, one-shot playback and farther spawns. Pixel-derived clearance checks cover eight facings and four attack progress points.
- Existing main gameplay browser smoke test passed separately, including actual controls, upgrades, interaction, pause and ten restarts.
- The follow-up's original combined rerun was interrupted by concurrent combat/build/progression implementation. That work is now complete: the final typecheck/build, 111 logic tests and 16 combined browser cases passed, including all three combat-readability cases. See [the phases 04–06 report](PHASES_04_06_REPORT.md) for current verification and its limits.

Screenshot: `artifacts/browser/combat.png` (ignored local artifact). No target-hardware FPS or subjective comfort claim is made.

## Additive attack animation extension

The existing PMD attack sprites now also have a small body pose layered over them: anticipation, one strike and a smooth recovery. Melee attacks lunge and lean, ranged attacks recoil, and casting/support attacks make a shallow lift. Ordinary enemy contacts use melee motion regardless of their species' player move. Genuine attack sheets receive a smaller addition than static/aliased fallbacks. World-unit offsets stay bounded for large enemies.

Enemy windups hold a ready pose and the first native attack frame until release. Release continues from readiness, avoiding a second preparation or duplicate swing. Body scale and rotation pivot at the resting feet; all added transforms reset at rest or when a windup is canceled. Authoritative attack timers drive the motion, so pause and fast attack speeds cannot accumulate offsets. Reduced motion retains the native attack frames and suppresses the additional body transforms.

Slash effects now use a short, directional, tapered crescent with a small sweep and independent fading. The existing shared geometry, instance limits and recycling remain in use. Reduced motion keeps this cue still. Area rings retain a thin vertical profile as their radius grows. Async sprite-sheet swaps initialize their current frame, dimensions and pose immediately, and a small physical separation between health fill and track prevents depth artifacts.

This extension changes presentation only. Added tuning is in `ATTACK_POSES` and `ATTACK_ANIMATION` in `src/data/config.ts`. Changed source: that config, `src/game/render/animation.ts`, `src/game/render/AssetLibrary.ts`, `src/game/render/Effects.ts` and `src/game/render/HealthBars.ts`. Regression coverage is in `tests/animation.test.ts`, `tests/effects.test.ts`, `tests/browser/attack-polish.spec.ts` and the existing combat screenshot fixture. New visual evidence is under ignored `artifacts/browser/attack-polish.png` and `artifacts/browser/attack-polish-contact-sheet.png`.

Extension verification:

- `npm test`: 145/145 passed, including pose bounds/continuity, real combat timing, pool recycling and disposal.
- `npm run build`: final TypeScript check and production build passed; the existing Babylon bundle-size warning remains.
- `npm run test:browser -- tests/browser/attack-polish.spec.ts tests/browser/combat.spec.ts`: 7/7 passed. Actual loaded sheets, foot anchoring, mirrored lean, recovery, pause, reduced motion, windup/release continuity, stun cancellation, health-bar clearance and WebGL crescent rendering/reuse were verified. The arranged screenshot fixture suppresses incidental ambient spawns.
- `npx playwright test tests/browser/assets.spec.ts --output artifacts/browser/attack-polish-assets-results`: 4/4 passed, including all 151 species across three states/eight facings, unavailable-asset fallback and disposal during pending requests. This source-playback check preceded the final charged-body progress mapping, which is covered by the subsequent browser suite.
- The attack screenshot and four-phase contact sheet were visually inspected. Subjective combat feel and target-hardware performance remain unmeasured.
