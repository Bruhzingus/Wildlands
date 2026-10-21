# N1 implementation handoff

**PHASE: N1 — Improve Pokémon movement presentation**  
**Date:** October 21, 2026.

## What changed

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
- `src/game/render/locomotion.ts`: bounded travel sampling and directional deadband.
- `src/game/render/AssetLibrary.ts`: state selection, retained loop phases,
  cached transitions, grounded walk anchors, airborne frame holds, terrain
  shadows and read-only diagnostics. Existing evolution work is retained.
- `tests/locomotion.test.ts`: render-rate, speed, stop noise, pause, teleport,
  reversal and camera-row regression checks.
- `tests/browser/locomotion.spec.ts`, `tests/browser/fixtures/locomotion.{html,ts}`:
  repeatable real WebGL routes and lifecycle/terrain/attack checks.
- `IMPROVEMENT_DOC.md`, `GAME_DESIGN_AND_ROADMAP.md`, this handoff.

## Why the approach is maintainable

All added state belongs to each avatar and is released with it. There is one
previous position, a few scalar clocks, and at most three shared asset references
per avatar. Native sheet metadata remains the animation authority. No simulation,
combat, progression, control, recruitment or upgrade implementation was edited.
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
- `npm.cmd test`: **449/451 passed**, with the same two pre-existing failures.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build -- --configLoader runner`: passed. Existing large-chunk
  advisory remains; main chunk 6,381.79 kB / 1,432.54 kB gzip.
- `npm.cmd run assets:audit`: **151 species, 151 artwork/metadata/credits,
  453 available requested Idle/Walk/Attack states; zero missing assets**.
  This regenerated the missing ignored `public/assets/coverage-report.json`
  required by the existing browser gallery test; its tracked document is unchanged.

Further browser results and measured resource costs are recorded below.

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

- [Before/after video viewer](../artifacts/browser/n1/comparison.html).
- [Before clip](../artifacts/browser/n1/before.webm) and
  [after clip](../artifacts/browser/n1/after.webm).
- [Before snapshots](../artifacts/browser/n1/before.json) and
  [after snapshots](../artifacts/browser/n1/after.json), including complete run
  state and both RNG states at matching route stages.
- Matching `before-*` / `after-*` PNGs in `artifacts/browser/n1/`.

The baseline renderer was copied from the current working files before N1,
including the owner's existing evolution work, rather than reconstructed from
Git HEAD. Its ignored snapshot lives in `artifacts/n1-baseline/`. To repeat the
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

## Balance / performance impact

No gameplay values or authoritative movement were changed. Matching seeded
before/after routes compare complete simulation and RNG state, including position,
HP, timing and progression. Additional rendering stays O(visible actors), with
no extra actor meshes, effect instances, simulation timers or draw calls. Walk
prewarming can load one shared sheet earlier per encountered species. Terrain
shadow alignment adds four shared-height samples when an actor moves.

## Next recommended phase

N5 profiling on the owner's target hardware, followed by human review of the
same movement clips. N2's evolution presentation is already integrated; no
follower, controls or combat redesign is needed for this entry.

## Regression checklist

- Existing controls, camera, automatic targeting and follower formation preserved.
- Native attack one-shots, learned-move routing and Q priority preserved.
- Complete pause, reduced motion, late/missing art and disposal covered.
- Existing paused evolution presentation retained.
- No upgrade behavior changed; the upgrade catalogue requires no regeneration.
- Pre-existing boss/endless failures reported rather than claimed fixed.
