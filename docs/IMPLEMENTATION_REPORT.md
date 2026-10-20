# Wildlands phases 00–02

Implemented on 2026-10-18 with Node 24.11.1, Babylon 8.56.2 and desktop Chromium. The first three roadmap steps are phases **00, 01 and 02**. The requested simpler game UI is included. Babylon, the existing simulation and the run/progression rules are preserved.

## PHASE: 00 — Clean checkout, honest verification

**What changed:** Fixed the renderer's TypeScript/API errors and exercised the real game in Chromium. Added reproducible browser automation, ignored screenshot/trace artifacts, and Vite watcher exclusions so test artifacts do not reload the game. Replaced the glass/gradient interface with flat olive panels, square borders, restrained monospace headings, concise menus and smaller HUD elements. Added keyboard focus handling, immediately visible portrait placeholders and safe saved-data loading. Fixed evolution cards confusing party UIDs with species IDs and prevented endless continuation from counting one run twice.

**Changed files:** `package.json`, `package-lock.json`, `.gitignore`, `vite.config.ts`, `playwright.config.ts`, `index.html`, `src/main.ts`, `src/game/Game.ts`, `src/game/save.ts`, `src/game/render/Effects.ts`, `src/ui/UI.ts`, `src/style.css`, `tests/input.test.ts`, `tests/save.test.ts`, `tests/world.test.ts`, `tests/browser/game.spec.ts`, `tests/browser/ui.spec.ts`, `README.md`, `GAME_DESIGN_AND_ROADMAP.md`, this report. Asset renderer fixes are listed under phase 01.

**Why the approach is maintainable:** Presentation still reads authoritative simulation state; controller and saved settings have small independent modules. Browser tests use development hooks, while an additional production smoke check runs without them. Lifecycle cleanup disposes listeners, UI timers, geometry, materials, lights, pending image work and textures.

**Tests run:** Baseline `npm test` passed 11/11; baseline `npm run typecheck` and `npm run build` failed. Final commands and observed results are listed below.

**Browser smoke steps:** Title → Pikachu starter → ready WebGL scene → A/D and W/S → persistent mouse orbit → jump → dodge/iframes → Q damage and held-key protection → completely frozen upgrade → numeric choice → E cache interaction → Escape pause/resume → blur clears movement → ten restarts. A separate check verifies stored sensitivity/invert-Y, pointer capture/release, Mewtwo at 15:00, actual boss defeat, squad retention in endless, and one saved game after later defeat. Small-screen checks cover visible offline portraits, evolution UID 999, menu bounds and keyboard focus wrapping.

**Known limitations:** Browser automation is not a human balance or comfort playtest. See shared limits below.

**Balance / performance impact:** Existing recruitment and boss pacing remain unchanged. Restart tests verify stable scene resources; no target-hardware FPS claim.

**Next recommended phase:** 03, after the two additional requested validation phases below.

**Regression checklist:** Starter selection, automatic combat, manual actions, upgrades, world interaction, pause/blur, save/unlocks, boss, victory, endless and restart verified.

## PHASE: 01 — 151-Pokémon asset coverage and animation accuracy

**What changed:** Synced and audited every species using actual PNG dimensions and XML metadata. Fixed alias resolution, eight-direction handedness, atlas column stride and unequal frame durations at the source's 60 Hz timing. Visible body bounds now control scale and stable resting anchors across differently padded sheets. Assets prefer local cache, then documented remote sources, then a generated visible canvas character. Abortable image fetch/decode and ready canvas textures prevent failed/canceled loads from leaving Babylon permanently unready. Failed requests remain cached, and stale asynchronous results cannot recreate disposed actors. Added shared contact shadows and a live developer-only gallery with 151 IDs, eight simultaneous facings, state/variant/orbit controls, freeze and creator/source information.

**Changed files:** `src/game/render/AssetLibrary.ts`, `src/game/render/animation.ts`, `src/ui/AssetGallery.ts`, `scripts/sync-assets.mjs`, `scripts/audit-assets.mjs`, `public/assets/manifest.json`, `public/assets/asset-attributions.json`, `public/assets/pmd-creator-directory.txt`, `public/assets/asset-download-report.txt`, `docs/ASSET_COVERAGE.md`, `tests/animation.test.ts`, `tests/browser/assets.spec.ts`; downloaded image/XML/creator caches under `public/assets/pmd/` and `public/assets/pokemon/` remain ignored.

**Why the approach is maintainable:** Renderer, sync, audit and tests share a pure metadata/parser/timing module. One species/sheet promise is shared by all actors, including failures. Generated art is immediately ready; no network request belongs in simulation logic.

**Tests run:** `npm run assets:sync`: 905 downloaded files, 904 manifest entries, zero failed requests. `npm run assets:audit`: 151/151 artworks, metadata, creator records and usable idle/walk/attack states. Parser, timing, alias, facing, layout and body-padding regressions pass in `npm test`. Full per-species coverage and sources are in [ASSET_COVERAGE.md](ASSET_COVERAGE.md).

**Browser smoke steps:** Live gallery checks, screenshots and failure/cancellation results are recorded in the final evidence below. Gameplay readiness probe reports `scene.isReady() === true`, zero pending data, ready textures/meshes and zero console/page errors. Isolated idle sprites were visually checked against ground shadows; attack animation movement remains intact.

**Known limitations:** Beedrill (#15) and Dragonair (#148) use their source's explicit Idle → Walk alias; no invented Idle sheet is claimed. Downloaded binaries are local cache, not tracked source. A fresh checkout needs asset sync for the same offline coverage; remote availability can change.

**Balance / performance impact:** Body scale uses opaque bounds instead of transparent cell size, so loaded sprites remain readable. Contact shadows use shared instances/material. PNG decoding happens once per cached sheet; browser sweep periodically disposes its gallery cache.

**Next recommended phase:** 03; phase 02 is also included in this delivery.

**Regression checklist:** All 151 species resolve locally; source duration, alias and atlas rules validated; generated actors stay visible when hosts fail; canceled work cannot resurrect disposed resources; gallery is absent without `?dev=1`.

## PHASE: 02 — Camera, movement and environmental collision feel

**What changed:** Corrected camera-relative right/left movement and removed the camera-target setter that canceled mouse rotation every frame. Added captured relative mouse look, wheel zoom, persistent sensitivity/invert-Y, smooth grounded camera follow, acceleration/braking, locked dodge direction and one action per key press. The camera follow-up below replaces the original optional capture with automatic capture on start/resume/choices. Substeps consume action taps once. Blur, menus and deliberate pointer release clear input safely. Player collision uses lightweight circles/rotated boxes from the same seeded environment layout as rendering; spawn and landmark approaches remain clear. Added ground shadows and capped step/dodge dust. Fixed immediate cache freeze, lethal damage ordering, swept projectile hits, endless resume phase, invalid upgrade guards and entity-budget enforcement.

**Changed files:** `src/game/Game.ts`, `src/game/input.ts`, `src/game/settings.ts`, `src/game/Simulation.ts`, `src/game/render/World.ts`, `src/game/render/Effects.ts`, `src/game/systems/environment.ts`, `src/game/systems/progression.ts`, `src/game/systems/spawning.ts`, `src/data/config.ts`, `src/utils/geometry.ts`, `tests/input.test.ts`, `tests/simulation.test.ts`, `tests/world.test.ts`, `tests/browser/game.spec.ts`. Camera settings and contact visuals integrate through the UI/asset files listed above.

**Why the approach is maintainable:** Movement intent remains world-space input to a pure authoritative simulation. One seeded prop generator describes render geometry and colliders. Movement, interaction distance and budgets live in config. No heavyweight physics, sprint or stamina system was introduced.

**Tests run:** Input handedness and diagonal speed; acceleration/braking; held jump/dodge/Q; dodge direction; seeded environment/collision sliding; full pause state; immediate cache freeze; lethal poison/contact; swept and expiring projectiles; boss/level-up simultaneity; upgrade guards; finite frame durations; actual victory/endless and enemy budgets all pass. Ten NullEngine World construction/disposal cycles return mesh/material/light/transform/geometry counts to baseline. Browser automation advances 18,000 frames over ten simulated minutes with jump/dodge and rotating movement, checking finite coordinates, bounds and upgrade progression.

**Browser smoke steps:** Actual keyboard/mouse checks and ten restarts pass in Chromium; pointer capture and inversion are exercised. Ten simulated minutes are accelerated simulation, not a claim of a ten-minute human movement playtest.

**Known limitations:** Static collision currently constrains the player against large obstacles; followers/enemies keep lightweight existing movement. No ledges require coyote time in this terrain. Human movement comfort remains unmeasured.

**Balance / performance impact:** Existing tuning gates are retained. A development stress run of 45,000 updates over 30 simulated minutes, with health maintained for reliability testing, kept finite state, unique IDs and budgets: peak 190 enemies and 14 projectiles. This is not a balance or hardware benchmark.

**Next recommended phase:** 03 — Character visuals, formations and follower survival.

**Regression checklist:** Recruitment still requires time + level and first-stage species; fainted followers remain removed; evolution branches still work; upgrades completely freeze simulation; boss still appears at 15:00; victory/endless preserve the team and items.

## Final verification evidence

- `npm test` — **39/39 passed**, including the camera follow-up regression.
- `npm run typecheck` — passed with zero TypeScript errors.
- `npm run build` — passed. Vite reports a large Babylon bundle warning (about 6.06 MB minified / 1.33 MB gzip); this is a build-size optimization for later work, not a runtime/build failure.
- `npm run assets:sync` and `npm run assets:audit` — complete source/cache validation; 0 species missing any requested asset.
- `npx playwright test tests/browser/camera.spec.ts tests/browser/game.spec.ts --output artifacts/browser/camera-results` — **9/9 passed** after the camera follow-up: native pointer capture, continuous mouse movement beyond screen edges, natural/inverted pitch, capture loss/retry, both upgrade gestures, Escape/restart cancellation with late browser grants, gameplay, settings, victory/endless and ten simulated minutes.
- `npm run test:browser -- tests/browser/ui.spec.ts --output artifacts/browser/camera-ui-results` — **1/1 passed** after the camera follow-up.
- `npx playwright test tests/browser/assets.spec.ts --output artifacts/browser/asset-results` — **4/4 passed**: all 151 species × 3 requested states = 453 exact sheet/duration/stride checks in eight directions; 108 screenshots for 36 representative species; timed animation/freeze; gallery close/reopen; failed-host fallback without repeated requests; five cancellation/disposal cycles; gallery absent without the developer flag. Zero page errors. Detailed machine results: `artifacts/browser/asset-gallery-151-results.json`.
- `node artifacts/production-smoke.mjs` against `npm run preview -- --port 4173 --strictPort` — passed: production scene/assets, keyboard and mouse input, pause/resume, restart, developer-gallery absence and zero console/page errors. The one-off probe is in ignored artifacts.

Screenshots and retained failure traces are under ignored `artifacts/browser/`. Desktop title/gameplay/upgrade/pause, 390×844 title/upgrade/pause and the three sprite contact sheets covering all 36 representatives were visually inspected. Rendering uses Chromium's software WebGL backend in automation; hardware FPS, repeated human 15-minute playthroughs and subjective balance remain unmeasured.

## Observed baseline errors and repairs

| Finding | Repair / verification |
| --- | --- |
| Invalid `Texture.LINEAR_SAMPLINGMODE` (two TypeScript errors) | Supported bilinear/nearest sampling; final typecheck/build pass. |
| `Mesh` maps receiving `InstancedMesh` and resulting undefined/type errors in Effects | Correct instance types, capped VFX and explicit resource cleanup. |
| A and D reversed | Correct left-handed camera basis; pure and actual keyboard regressions. |
| Mouse orbit reset during movement | Update follow target in place instead of the angle-rebuilding setter; persistent-orbit browser assertion. |
| Disposed loading SVGs left scene forever unready | Ready generated canvas textures and abortable image loading; readiness/cancellation checks. |
| World geometry/materials/lights accumulated on restart | Complete disposal; ten browser restarts plus ten deterministic NullEngine cycles. |
| Opening a cache still advanced enemies in the same frame | Stop update immediately when choice opens; state regression. |
| Lethal contact/poison could be followed by attacks/healing | Immediate defeat ordering; deterministic regression. |
| Fast or expiring projectiles skipped crossed actors | Swept segment collision including final partial lifetime. |
| Evolution portrait used party UID as catalog ID | Use evolution target species; browser UID 999 regression. |
| Endless resumed as a boss phase and could double-count run statistics | Active-boss phase checks; one saved game with updated endless best scores. |
| Test traces triggered repeated Vite reloads | Ignore artifact directories in the file watcher. |

These checks establish the observed behavior; they do not establish that every possible gameplay bug is absent.

## Camera follow-up — automatic FPS-style mouse capture

The original implementation still allowed an unlocked cursor to rotate the camera and only requested pointer lock after a separate canvas click. Its test accepted that behavior instead of requiring capture from the starter gesture. This follow-up corrects both the interaction and its regression coverage.

- Starting a run, clicking Resume, selecting an upgrade by mouse or number, and continuing endless now request native pointer lock directly from that user gesture. Simulation remains paused until the browser actually grants capture.
- Mouse look, movement and wheel zoom require ownership of `document.pointerLockElement`. Losing capture pauses and clears input immediately. Normal cursor motion over an unlocked game cannot move the camera.
- Escape releases capture and pauses; Resume captures again. Menus receive a normal cursor. Failed capture shows an explicit retry message in the pause menu, with no silent unlocked gameplay.
- Pending requests are invalidated on Escape, blur, restart and disposal. A stale grant is released instead of starting a paused run or capturing the title screen.
- Default vertical mouse movement follows FPS conventions; moving up looks toward the horizon and moving down looks toward the ground. Existing sensitivity and invert-Y settings apply.

Changed files: `src/game/Game.ts`, `src/game/input.ts`, `src/ui/UI.ts`, `tests/input.test.ts`, `tests/browser/camera.spec.ts`, `tests/browser/game.spec.ts`, `README.md`, `GAME_DESIGN_AND_ROADMAP.md`, this report.

Verification: `npm test` passed **39/39**; `npm run typecheck` and `npm run build` passed. The camera/game browser suite passed **9/9**, and the UI regression passed **1/1**. A production Chromium smoke check verified native capture on starter/Resume, relative movement beyond viewport boundaries, frozen pause, restart and zero console/page errors. Focused browser checks additionally exercise natural/inverted pitch, both upgrade gestures, external capture loss, denied capture/retry, and actual late browser grants following Escape or restart.

Browsers require a user gesture to acquire pointer lock. When the host prevents capture, gameplay stays paused with the retry message; the game does not pretend an ordinary cursor is captured.
