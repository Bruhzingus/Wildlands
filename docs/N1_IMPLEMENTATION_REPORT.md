# N1 implementation handoff

**PHASE: N1 — Improve Pokémon movement presentation**  
**Date:** October 22, 2026. Presentation baseline captured October 21.

## What changed

The owner extended N1 during implementation to request species movement
techniques, with more utility available to simpler/weaker kits. This explicitly
extends the original presentation-only scope. Innate traits affect the controlled
leader; followers retain their existing formation, movement and exposure.

| Leader species | Technique | Behavior / tradeoff |
| --- | --- | --- |
| Pikachu | Run-up | After 1s of actual straight travel, ramps to +25% speed over 0.35s. |
| Raichu, Jolteon | Run-up | Same technique, +18% for the stronger evolved kits. |
| Pidgey, Pidgeotto, Pidgeot | Short flight | Hold Space after takeoff for up to 2s of flight; release to descend; 4s recharge. |
| Zubat, Golbat, Butterfree | Short flight | Same controls, 1.5s airtime and 4s recharge. |
| Magikarp | Splash leap | Jump launch velocity is 1.35× normal, producing a higher, longer jump. |
| Abra | Teleport dodge | Existing Shift teleport is preserved. |

Run-up requires full movement intent and real progress, and resets on a turn
over 15 degrees, stopping, jumping or dodging. The reference heading stays fixed
until reset, so gradual circles cannot farm the bonus. A blocked character cannot
charge it. The multiplier continues to benefit uncapped percentage speed upgrades.

Flight starts after a 0.18s jump hold, approaches a restrained 3m height, and
requires a fresh takeoff to activate again. Holding Space cannot auto-repeat
jumps or refresh airtime. Flight and Splash leap clear scenery footprints and
ground contact/melee above 1.2m; ranged attacks, explosions, bosses and flying
foes remain threats. Water and map boundaries remain blocking, and normal ground
collision resumes during descent. All timers freeze with the simulation. A
species change resets incompatible movement state; restarting creates fresh state.

Magikarp becomes a selectable starter through **Trail reader** (four discoveries
in one run); Zubat through **Poison patrol** (15 minutes with two living Poison
members). Previously earned accomplishments backfill these partners through the
existing save migration/reward logic. There are still ten finite achievements,
four initial partners, and no permanent stat bonuses. The total starter roster
is now seventeen. Both new starters keep their existing attack/special numbers;
their descriptions now explain their handling. Sharing a canonical move name
is allowed when attack/movement handling differs; duplicate species/loadouts
and duplicate identities are still rejected by the content validator.

Starter cards, a compact HUD status, pause, evolution cards/confirmation and the
catalogues describe the traits. Evolution previews explicitly expose mobility
changes such as Run-up +25% → +18%, or Splash leap → standard movement.

These are original game adaptations, not claims that official Pokémon games use
these exact timers or bonuses. Magikarp's mobility is grounded in its official
[Splash movement in Pokémon UNITE](https://www.pokemon.com/uk/pokemon-news/magikarp-evolves-into-gyarados-in-pokemon-unite)
and the [Magikarp jumping stories](https://www.pokemon.com/us/animation/seasons/23/episode-26-splash-dash-and-smash-for-the-crown-slowkings-crowning).
Run-up follows the owner's nimble-runner example; flight is assigned explicitly
to winged families, rather than every Flying-type or every powerful evolution.

Movement presentation now samples actual world-space travel. Grounded walk
playback follows speed relative to 7.3 m/s while retaining each native frame's
unequal duration. Small starts/stops use speed hysteresis and an 80 ms stop
hold, rather than repeatedly selecting Idle/Walk from the simulation's coarse
animation flag. Separate, bounded idle/walk clocks retain their phase across
stops, turns and attacks. Loop playback has a cosmetic 2.5× ceiling; simulation
speed, earned stats and travel remain unchanged.

Followers visually face their own travel, including formation adjustments and
reversals. Their actual formation, position, exposure, facing data and AI are
unchanged. Camera rotation only selects another view of that world heading. A
small angular deadband prevents row chatter near diagonal boundaries. No
sprite interpolation, extra bounce, lean or squash was added to locomotion.

Grounded Walk sheets now use their own fixed per-direction bottom envelope,
with the resting sheet's visible height retained as the scale reference. The
baseline reused Idle foot offsets even when Walk placed the feet lower: for
example Pikachu's back-facing anchor changed from 6 to 8 pixels, and Snorlax's
from 5 to 7 pixels. Per-frame native motion remains intact. Attack anchors and
authored hovering lift remain unchanged. Contact shadows use the same terrain
height and a local terrain normal instead of staying horizontal on slopes.

Grounded sprites hold their locomotion frame while airborne and resume it on
landing; the existing player jump height moves the body while its shadow stays
on the terrain. The curated native hover list retains authored wing/levitation
timing at slow travel speeds. Charizard and grounded birds keep their walking
behavior rather than receiving a blanket Flying-type treatment. Artwork
fallbacks remain static and visible, with no invented bouncing animation.

Attacks still take priority and follow authoritative one-shot progress, learned
move styles, Q priority, windups and recovery. Locomotion cannot restart them.
The first Walk sheet is prepared alongside Attack using the shared asset cache;
loaded sheets switch immediately and pending sheets join the current phase,
dimensions, anchor and opacity. Pause never advances the visual clocks. Reduced
motion keeps native travel/attack frames and continues to suppress added attack
body motion. The existing paused evolution sequence is preserved.

## Changed files

- `src/data/locomotion.ts`: cosmetic tuning and explicit native hover list.
- `src/data/movementTraits.ts`, `src/game/systems/movement.ts`: data-owned innate
  movement techniques and serializable, bounded leader state.
- `src/game/Simulation.ts`, `types.ts`, `Game.ts`: movement application, held
  Space input, pause and native flight playback.
- `src/game/systems/environment.ts`, `src/game/combat/enemies.ts`: airborne
  scenery traversal and selective ground-melee clearance.
- `src/data/kanto.ts`, `unlocks.ts`, `rosterContent.ts`, `validateRoster.ts`:
  two finite starter unlocks, handling descriptions and shared-name validation.
- `src/data/economy.ts`: mark the existing unused chest-rarity argument with
  an underscore while retaining its public signature, allowing TypeScript checks.
- `src/ui/UI.ts`, `movement.css`, `upgradePreview.ts`, `upgradeCatalogueData.ts`,
  `index.html`: trait explanations/status and truthful evolution previews.
- `scripts/generate-upgrade-catalogue.mjs`, `UPGRADE_CATALOGUE.md`: regenerated
  movement/evolution details; the previous catalogue was preserved under
  `artifacts/movement-traits/catalogue-before.md` before regeneration.
- `src/game/render/locomotion.ts`: bounded travel sampling and directional deadband.
- `src/game/render/AssetLibrary.ts`: state selection, retained loop phases,
  cached transitions, grounded walk anchors, airborne frame holds, terrain
  shadows and read-only diagnostics. Existing evolution work is retained.
- `tests/locomotion.test.ts`: render-rate, speed, stop noise, pause, teleport,
  reversal and camera-row regression checks.
- `tests/movement-traits.test.ts`, `tests/browser/movement-traits.spec.ts`:
  charge/turn/blocked movement, finite flight, ranged vulnerability, safe
  traversal/landing, higher jumps, unlock migration and evolution preview checks.
- `tests/specials.test.ts`, `tests/browser/starter-identity.spec.ts`,
  `tests/browser/starter-moves.spec.ts`: starter identity and seventeen-partner
  coverage updated for the new movement kits.
- `tests/browser/locomotion.spec.ts`, `tests/browser/fixtures/locomotion.{html,ts}`:
  repeatable real WebGL routes and lifecycle/terrain/attack checks.
- `IMPROVEMENT_DOC.md`, `GAME_DESIGN_AND_ROADMAP.md`, this handoff.

## Why the approach is maintainable

All added cosmetic state belongs to each avatar and is released with it. There is one
previous position, a few scalar clocks, and at most three shared asset references
per avatar. Native sheet metadata remains the animation authority. Gameplay
traits use a separate simulation-owned state record on the player; the renderer
only observes it. Movement tuning stays outside attack, item and reward formulas.
The developer gallery explicitly retains stationary source-speed previews.
Existing asset request caching, failure caching, aborts and stale-request guards
remain in place. Shadow normals are recomputed only when a body changes position;
geometry, materials and actor/entity limits are unchanged.

## Tests run

- Baseline `npm.cmd test`: **445/447 passed**. Existing failures in
  `tests/phase15.test.ts` (boss victory) and `tests/simulation.test.ts` (endless
  phase) were reproduced before renderer changes.
- `node --experimental-strip-types --test tests/locomotion.test.ts tests/animation.test.ts tests/combat-animation.test.ts`:
  **28/28 passed**.
- N1 presentation-only `npm.cmd test`: **449/451 passed**, with the same two
  pre-existing failures. After the owner extension and shared-name validator
  correction, `npm.cmd test`: **459/461 passed**, with those same two failures.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build -- --configLoader runner`: passed. Existing large-chunk
  advisory remains; owner-extension main chunk 6,387.89 kB / 1,434.85 kB gzip.
  A final current-workspace build, including concurrent content edits, also
  passed: main chunk 6,413.90 kB / 1,444.72 kB gzip. Its log is
  `artifacts/n1-final-current-build.log`.
- `npm.cmd run assets:audit`: **151 species, 151 artwork/metadata/credits,
  453 available requested Idle/Walk/Attack states; zero missing assets**.
  This regenerated the missing ignored `public/assets/coverage-report.json`
  required by the existing browser gallery test; its tracked document is unchanged.

- `node --experimental-strip-types --test tests/movement-traits.test.ts tests/specials.test.ts tests/starter-attacks.test.ts tests/meta-progression.test.ts tests/upgrade-preview.test.ts`:
  **54/54 passed**.
- `npm.cmd run content:audit`: **151 species/profiles, 72 evolution edges,
  151 spawn-reachable species, 453 animation states, zero issues**.
- `npx.cmd playwright test tests/browser/movement-traits.spec.ts tests/browser/locomotion.spec.ts tests/browser/input.spec.ts tests/browser/starter-identity.spec.ts tests/browser/evolution-terrain.spec.ts --output artifacts/browser/movement-traits-results`:
  **21/21 passed**, including actual held-Space flight over a real rock,
  release/landing, flight pause, Magikarp/Zubat selection and HUD explanations.
- Earlier presentation integration: **20/22 passed** initially. The missing
  ignored asset audit was regenerated; one smoke attempt lost its execution
  context to navigation. The stable-source rerun of assets/game/locomotion
  passed **12/12**, including all 151 species × three states × eight directions,
  ten restarts and ten simulated minutes. The initial concurrent baseline
  browser runners also shared an output directory and encountered trace cleanup
  interference; subsequent runs use separate output directories.

Concurrent shrine/burrow/content edits continued in the main workspace during
final verification and caused development reloads. A local review copy at
`artifacts/n1-review-snapshot/`, served with watching/HMR disabled on port 5174,
records the exact final browser inputs independently of those reloads. Its Vite
configuration reuses the already cached Babylon module because the sandbox
cannot rebuild the dependency cache from that nested directory. Snapshot and
main-workspace TypeScript checks passed. The snapshot is a review artifact,
not a second implementation or a replacement of the shared workspace.

`npx.cmd playwright test --config artifacts/n1-review.playwright.config.ts movement-traits.spec.ts starter-moves.spec.ts --output artifacts/browser/n1-review-traits-results`:
**4/4 passed**, including the complete seventeen-starter Q cast/render/pause/
damage check and all three live movement scenarios. The log is
`artifacts/n1-review-traits-browser.log`.

Final isolated renderer captures: **before 1/1 passed, after 1/1 passed**.
The after run used `N1_COMPARE_BASELINE=1` and verified equal complete run state
and both RNG states at all 28 matching stages. Logs:
`artifacts/n1-review-before.log`, `artifacts/n1-review-after-retry.log`.
The first after attempt exceeded the fixture's 12s readiness wait during cold
WebGL startup; the fixture now permits 60s for native-sheet/first-frame readiness.
Gameplay assertions and all route inputs are unchanged. The final before/after
JSON, PNG and WebM artifacts are in `artifacts/browser/n1/`.

## Browser smoke steps

Actual Chrome/WebGL with SwiftShader at 960 × 600 was used for the movement
fixture. Matched seed-4 routes inspect Pikachu, Snorlax, Zubat, Onix, Charizard
and Magikarp in one-, four- and six-member parties: idle, slow start, full walk,
diagonal travel, reversal, jump, dodge, Q/recovery, stop/camera orbit and slopes.
Grounded walk envelopes, scale, terrain anchors and shadow normals are checked
numerically. Separate normal/reduced-motion tests cover airborne frame holds,
native attack priority/recovery, pause and camera-only row changes. Delayed
sheets join the retained stride while paused; disposed avatars reject late work.

Local review artifacts are ignored, not required by the production game:

- Trait screenshots in `artifacts/browser/movement-traits/`: `runup.png`,
  `flight-over-rock.png`, `splash-leap.png`; these were visually inspected.

- [Before/after video viewer](../artifacts/browser/n1/comparison.html).
- [Before clip](../artifacts/browser/n1/before.webm) and
  [after clip](../artifacts/browser/n1/after.webm).
- [Before snapshots](../artifacts/browser/n1/before.json) and
  [after snapshots](../artifacts/browser/n1/after.json), including complete run
  state and both RNG states at matching route stages.
- Matching `before-*` / `after-*` PNGs in `artifacts/browser/n1/`.

The baseline renderer was copied from the current working files before N1,
including the owner's existing evolution work, rather than reconstructed from
Git HEAD. Both sides use the same simulation, including the requested traits;
the comparison isolates presentation. Its ignored snapshot lives in
`artifacts/n1-baseline/`. To repeat the
baseline capture in this workspace, set `$env:N1_BASELINE='1'` and run
`npx.cmd playwright test tests/browser/locomotion.spec.ts -g 'same seeded'`.
Remove that variable, set `$env:N1_COMPARE_BASELINE='1'`, then run the same
command for an explicit full-state/RNG comparison. Ordinary regression runs do
not depend on these ignored comparison files. Video setup/capture times can
differ; compare the same stage labels rather than absolute video timestamps.

## Known limitations

Native sheets retain their authored poses, asymmetric padding and frame counts.
These are pixel animations, so a change between Idle/Walk can still visibly
change silhouette. Foot alignment uses a fixed row envelope, not per-pixel foot
tracking; native hops, flaps, tails and attack movement remain visible. Artwork
fallbacks cannot show a native gait. No replacement art was authored.

Existing follower overlap/clipping and native size relationships remain. The
curated hover classification is data-owned and can be refined after species
review. Ground contact follows the shared smooth height query, with its existing
small difference from the triangulated rendered terrain. No human comfort or
artistic sign-off, target-GPU benchmark or new full-run balance session was
performed. The two baseline boss/endless unit failures remain outside N1.
Flight uses existing native Walk/wing frames, with visible height/shadow
separation; no dedicated Fly sheets were added. Scenery clearance uses height
against ground footprints, rather than full 3D canopy collision. Descent can
gently project the actor outside a scenery collider. This is an initial mobility
tuning pass, not a measured human win-rate or claim that every low-power kit is solved.

## Balance / performance impact

The owner-requested traits deliberately change leader traversal. Existing attack,
special, item and percentage-stat numbers were preserved. Matching seeded
renderer comparisons use the same simulation and compare complete run/RNG state.
Additional rendering stays O(visible actors), with
no extra actor meshes, effect instances, simulation timers or draw calls. Walk
prewarming can load one shared sheet earlier per encountered species. Terrain
shadow alignment adds four shared-height samples when an actor moves.

A local 200-sample CPU sync probe measured median/p95 milliseconds:

| Actors | Before | After | Resources, both sides |
| --- | --- | --- | --- |
| 6 | 0.1 / 0.1 | 0.1 / 0.2 | 6 sprites, 27 managers/textures, 1,340 scene meshes |
| 196 | 0.3 / 0.8 | 0.5 / 0.7 | 196 sprites, 28 managers/textures, 1,530 scene meshes |

See `artifacts/n1-render-profile.json`. These are local browser CPU sync timings,
not a target-GPU frame-rate benchmark; the small differences include scheduling
and timer-resolution noise. No resource growth was introduced by locomotion.

The rank-1 eight-target/four-meter-ring probe in
`artifacts/movement-traits/kit-probe.json` illustrates why species labels alone
cannot identify weak kits: eight seconds of auto attacks produced 132.3 damage
for Pidgey and 1,076.5 for Zubat in that crowded, melee-friendly arrangement.
Zubat therefore gets a shorter 1.5s flight budget than Pidgey's 2s. Pikachu's
run-up bonus is larger than Raichu/Jolteon's, whose attack budgets are greater.
This single arrangement does not establish general strength; Magikarp's higher
jump adds utility to a simple single-target kit rather than increasing its damage.

## Next recommended phase

N5 profiling on the owner's target hardware, followed by human review of the
same movement clips. N2's evolution presentation is already integrated; no
follower, controls or combat redesign is needed for this entry.

## Regression checklist

- Existing controls, camera, automatic targeting and follower formation preserved.
- Native attack one-shots, learned-move routing and Q priority preserved.
- Complete pause, reduced motion, late/missing art and disposal covered.
- Existing paused evolution presentation retained.
- Evolution mobility changes are previewed and the upgrade catalogue is regenerated.
- Pre-existing boss/endless failures reported rather than claimed fixed.
