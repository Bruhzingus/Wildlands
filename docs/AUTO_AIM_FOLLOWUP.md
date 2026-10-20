PHASE: Automatic attack targeting correction — October 20, 2026

What changed:

Primary attacks, learned moves and repeat effects automatically select nearby
enemies for the leader and companions. Camera direction no longer overrides their
target, launch direction or attack pose, and offensive automatic attacks wait when
no enemy is in range. Overlapping attacks keep the animation recovery behavior
from the preceding animation follow-up.

Mouse aim is reserved for directional Q moves (cones, waves, fans, dashes and
lances) and placed Q fields (garden, powder and hex). Thunder Circuit, Foxfire
orbits and healing ignore mouse aim. `specialAimMode` explicitly assigns every
special to automatic, directional or placement targeting. Sustained cones can
still follow camera movement; automatic and learned attacks remain independent.

Changed files:

`src/game/Simulation.ts`, `src/game/combat/patterns.ts`,
`src/game/combat/specials.ts`, `src/data/specials.ts`, the input comment in
`src/game/Game.ts`, `tests/camera-aim.test.ts`, `tests/combat-animation.test.ts`,
`tests/specials.test.ts`, `tests/browser/auto-aim.spec.ts`,
`GAME_DESIGN_AND_ROADMAP.md`, `README.md`, `docs/STARTER_MOVE_IDENTITIES.md`,
and this report. Earlier uncommitted animation work is retained.

Why the approach is maintainable:

Normal patterns consume an automatically acquired enemy rather than optional
camera aim. The camera aim input is read by the special combat module according
to one exhaustive data-owned aiming policy. Special targeting and ordinary
targeting therefore cannot silently inherit each other's behavior.

Tests run:

- `npm run typecheck`: passed.
- `npm run build`: passed, with the existing large-bundle advisory.
- `node --experimental-strip-types --test tests/camera-aim.test.ts tests/combat-animation.test.ts tests/specials.test.ts`:
  38/38 passed.
- `npm test`: 298/298 passed against the final source and tests.
- `npx playwright test tests/browser/auto-aim.spec.ts tests/browser/party-attack-animation.spec.ts`:
  5/5 passed in actual Chrome/WebGL, with zero page errors.

Browser smoke steps:

The new cases consume the real Game input from camera rotation. They verify
primary and learned shots toward a closer enemy behind the view, unchanged
targeting when the camera turns, no shots in an empty arena, directional Surf and
placed Bramble Garden. The existing party-animation cases verify the retained
native frames, learned/primary pose routing, overlapping attacks, Q priority,
pause and reduced motion.

Known limitations:

Directional/placement specials retain their existing camera-relative targeting
and placement assistance; no new placement cursor or interaction is introduced.
Subjective combat feel and full-run balance remain unmeasured.

Balance / performance impact:

This restores automatic target selection; no damage, cooldown, growth, range,
enemy difficulty or performance budget values changed. Automatic moves can hit
enemies outside the camera direction and no longer fire at empty space.

Next recommended phase:

Human combat-feel review of automatic attacks with directed and placed Q moves.

Regression checklist:

Leader and companion targeting; learned moves; repeat effects; empty arenas;
per-cast effect directions during an active body pose; directional/placed Q moves;
automatic lightning/orbits/healing; sustained cone steering; pause and reduced
motion. Full-suite checks also cover progression, enemies, boss/endless behavior
and saves.
