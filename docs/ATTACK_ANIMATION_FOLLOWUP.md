PHASE: Attack animation integration follow-up — October 20, 2026

What changed:

Recovered the local handoffs in `COMBAT_READABILITY.md` and
`COMBAT_OVERHAUL_COORDINATION.md`. Native attack playback, additive body poses,
enemy roles and directional crescents were already implemented in the committed
code. This follow-up completes the integration with independently cooling learned
moves and the newer starter specials:

- Party pose state records the actual move kind or special kind. Machop casting
  Hyper Beam now recoils rather than using its primary melee lunge. Specials have
  explicit casting, ranged, charging, heavy-strike and healing pose mappings.
- An automatic cast starts a body motion when the previous recovery finishes.
  Overlapping casts share that motion and retain their own effects, damage and
  cooldowns. They cannot repeatedly reset preparation or native frame playback.
  Q takes immediate presentation priority. No deferred animation queue is added.
- Both pose selectors clear at rest. Native frames, foot anchors, pause and
  reduced motion still use the existing renderer and authoritative timer.
- Slash events carry their own facing, so a later slash can aim independently
  while the body finishes an earlier shot.
- The baseline suite exposed a separate forward-dash collision bug: Flame Charge
  could hit enemies behind its origin through the rounded collision capsule.
  Flame Charge and Swift Step now clip initial hits to their forward direction;
  the retained Flame Charge trail applies the same rule. Attack width is retained.

Changed files:

- `src/game/types.ts`
- `src/game/Simulation.ts`
- `src/game/combat/patterns.ts`
- `src/game/combat/specials.ts`
- `src/game/render/animation.ts`
- `src/game/render/AssetLibrary.ts`
- `tests/animation.test.ts`
- `tests/combat-animation.test.ts`
- `tests/specials.test.ts`
- `tests/browser/party-attack-animation.spec.ts`
- `tests/browser/combat.spec.ts`
- `GAME_DESIGN_AND_ROADMAP.md`
- This report.

Why the approach is maintainable:

Simulation stores only the active cast's semantic kind and timing; rendering maps
that kind to existing configured poses. Special mappings are exhaustive over
`SpecialKind`. The presentation overlap policy does not schedule or delay combat.
Enemy animation behavior continues through its existing windup/release path.

Tests run:

- Baseline `npm test`: 285/286 passed; the forward-dash regression above was the
  sole failure.
- `node --experimental-strip-types --test tests/combat-animation.test.ts tests/animation.test.ts`:
  23/23 passed.
- `node --experimental-strip-types --test tests/specials.test.ts tests/camera-aim.test.ts`:
  23/23 passed.
- `npm test`: 293/293 passed.
- `npm run typecheck`: passed.
- `npm run build`: passed, with the existing large-bundle advisory.
- `npm run assets:sync`: 904 validated manifest entries; zero failed requests.
  Downloaded images are local verification assets, not source changes.
- `npx playwright test tests/browser/attack-polish.spec.ts tests/browser/combat.spec.ts tests/browser/enemy-roles.spec.ts`:
  attack-polish 4/4 and enemy roles 2/2 passed. One older combat fixture failed
  because it allowed only 0.2 seconds for a committed windup plus release.
  It now uses a fixed Quick Attack enemy and waits through the full recovery.
- `npx playwright test tests/browser/party-attack-animation.spec.ts tests/browser/combat.spec.ts`:
  6/6 passed, including the updated combat fixture. Together these runs verify
  12 distinct browser cases.

Browser smoke steps:

The focused browser cases use actual local PMD sheets and controlled simulation
steps to compare learned recoil with primary melee, overlapping cast/frame
continuity, six special families, recovery, complete pause and reduced motion.
Screenshots are generated at `artifacts/browser/party-learned-ranged.png` and
`artifacts/browser/party-primary-melee.png`. Existing attack-polish cases also
regenerate `artifacts/browser/attack-polish-contact-sheet.png`. These captures were
visually inspected. Browser cases passed in real Chrome/WebGL, with zero page
errors in the focused animation cases.

Known limitations:

The species' native Attack sheet is reused for learned moves and specials; this
does not add new move-specific sprite artwork. Simultaneous automatic casts share
one body motion, while each cast keeps its effects. Long-lived special effects
retain their existing behavior after the initial cast pose. Human combat feel and
target-device performance remain unmeasured.

Balance / performance impact:

No damage values, cooldowns, move slots, progression or spawn tuning changed.
Forward dashes no longer damage enemies behind their starting point. Pose state is
constant per party member and introduces no effect allocations or animation queue.
No frame-rate or balance improvement is claimed.

Next recommended phase:

Human combat-feel review with several learned moves and high attack speed before
adding more animation effects or artwork.

Regression checklist:

Native one-shot playback; attack facing; independent learned/primary cooldowns;
special priority; authoritative pause; reduced motion; enemy windups/cancellation;
foot anchoring; directional effects and pool reuse are covered by focused checks.
The complete logic suite also exercises progression, permanent fainting, spawning,
boss timing, victory/endless retention and save handling.
