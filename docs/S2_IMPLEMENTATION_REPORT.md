# S2 implementation handoff

Implemented October 21, 2026. S2 adds two seeded, simulation-owned interactions
without changing follower formation, controls, static obstacle collision, routes,
or lake boundaries.

- **Bramble ground**: four readable patches per map slow both the player and
  non-boss enemies. They create a clear kiting decision: crossing is possible,
  but pulling ordinary enemies through a patch costs the player's own mobility.
  Bosses intentionally ignore brambles so a single terrain tile cannot trivialize
  the encounter.
- **Ruin beacons**: three route-clear, one-use beacons per map. Press `E` nearby
  to arm one; after a short warning it damages ordinary enemies in its ring and
  the player still inside it. Bosses are not eligible. A beacon becomes spent
  permanently, preventing XP/coin farming.

The shared `createEnvironment` layout owns deterministic feature placement and
the run state owns each feature's ready/arming/spent state. Rendering mirrors that
state only. Feature events carry an `environmentId`, while enemy damage is credited
to the activating leader; this leaves a stable provenance seam for S4 without
introducing analytics state now. Per-frame work is bounded to seven features and
the local enemy list; no global pathfinding or rigidbody system was added.

Static trees, rocks, ruins, and lake collision were existing behavior and remain
separate from S2. Features are kept off optional-site clearances, authored routes,
the safe spawn, and the lake approach. Restart rebuilds both the deterministic
layout and visual nodes; pausing freezes all feature state because it freezes the
simulation.

Validation:

- `npm.cmd run typecheck` — passed.
- `npm.cmd test` — 444/444 passed. Focused environment/simulation coverage includes
  deterministic layout, route/lake/site clearance, ordinary-vs-boss bramble
  response, one-shot beacon state, repeat activation prevention, and renderer
  geometry/disposal budgets.
- `npm.cmd run build -- --configLoader runner` — passed.
- `npm.cmd run test:browser -- tests/browser/evolution-terrain.spec.ts --grep "S2 terrain"`
  — 1/1 passed; verified the markers render, a beacon spends once, ordinary enemies
  take its blast, and a boss does not.

Remaining manual review: browser-play the two maps to tune bramble visibility,
beacon damage, and warning duration against real player positioning. No GPU claim
or human balance conclusion is made by the automated tests.
