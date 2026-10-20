# Shared workspace coordination

The user confirmed on October 19, 2026 that two chats are editing this workspace.

This chat is finishing **enemy roles, real enemy move names, attack animations and
telegraphs, hostile projectiles, shrine guardians, elite/Mewtwo difficulty**.
The other chat should own **upgrade choices, individual Pokémon XP, four move
slots, player move growth, evolutions, player specials, item balance, and UI**.

Please preserve each other's changes. This is a coordination note, not a new
design specification. The user's current requests take priority.

## Enemy/combat files being finished here

- `src/data/enemyAttacks.ts` — explicit seven-role assignments for all 151 Pokémon.
- `src/game/combat/enemies.ts` — movement, committed windups, damage/heal/bomb casts.
- `src/game/combat/projectiles.ts` — physical hostile shots and fixed bomb landings.
- `src/game/render/AssetLibrary.ts`, `src/game/render/animation.ts` — role poses and pooled move name labels.
- `src/game/render/Effects.ts` — enemy windup cones, aim lines, bomb landing rings and arcs; preserve the other chat's player special visuals.
- `src/data/config.ts`, `src/data/director.ts`, `src/game/systems/spawning.ts` — +20% ordinary damage ramp after 120 seconds and tougher elites/Mewtwo.
- `src/game/Simulation.ts` — only enemy AI, projectile hooks, boss attacks and shrine sections being edited here now; preserve the other chat's XP/player special/learned move work.
- Tests specifically covering these enemy mechanics.

## Integration already applied

- `EnemyWindup.kind` includes `enemyMove`; optional `role` and `moveName`.
- Hostile bombs use `Projectile.blastX`, `blastZ`, `duration`, and `moveName`.
- Enemy hit callbacks hit the leader or followers; their shots never home.
- Shrine interaction creates a guardian; its luck/special reward is granted on defeat.
- Elites alternate Earthquake with their species' role move.
- Boss patterns keep the existing readable windup durations, with stronger damage,
  shorter recovery and larger HP. All tuning is in `BOSS_RULES`.

## Upgrade work originally started here, handed over

The user's original request explicitly says evolutions should be more significant
**and add a move**. Please reconcile that with the four move limit in the other chat.
This chat's earlier evolution-granted-move implementation was replaced by concurrent
edits; current evolution code only changes HP/power and species. Do not silently
claim the extra evolution move requirement is complete.

Earlier additions here included real upgrade names, primary stat choices,
`stamina` as dodge recovery, independent learned-move cooldowns and item names.
Those are now owned by the other chat, including their final design and tests.

The old tests assume global XP, flat evolution HP, contact damage without a
windup, and old player specials. Enemy-related assertions will be updated here;
please update XP/progression/item/special tests in the other chat.

## Verification status

Baseline before either change: 204 unit tests passed. During concurrent work,
typecheck passed and 228/245 tests passed; failures included both outdated enemy
contact assertions and the other chat's in-progress progression changes.
Enemy role WebGL smoke passed once with all seven poses and pooled move labels.
Final enemy-side results are recorded in [ENEMY_COMBAT_OVERHAUL_REPORT.md](ENEMY_COMBAT_OVERHAUL_REPORT.md).

## Latest handoff to the other chat

- Production build, typecheck and content audit pass. All 151 enemy move names
  and all current primary/learned move names match the PokeAPI English move list.
- Final enemy-focused suite: **47/47 passed**; final Chrome/WebGL enemy/boss
  browser suite: **9/9 passed**. This chat's enemy/boss work is complete.
- Latest full suite: **272/274 pass**. Remaining failures belong to ongoing
  player work: `tests/audio.test.ts:133` (one species' sound frequency is outside
  the test's range) and `tests/simulation.test.ts:120` (holding special with no
  enemies emits zero special events under the new targeting behavior).
- Please retain four boss summons in the browser test and the current named
  boss tells. `BOSS_RULES` now uses **12000 + 250 per run level** HP. The smaller
  first tuning still died in 13–24 seconds with the current player attack growth.
  Final isolated scripted wins take 29–53 seconds; one of four teams loses.
- Landmark guardian HP is at least **600 + 200 per run level + 1.5 per elapsed
  second**. Both shrine and elite landmarks use `createGuardian`.
- Elite area attacks now use a suitable elemental move (for example Raichu's
  Discharge), alternating with the assigned role move. Preserve the cycle increment.
- `scripts/boss-pacing.mjs` disables XP during the isolated fight to keep its
  stated fixed build and avoid an unhandled paused choice under individual XP.
- `Toxic Barb` is not a main-series English item name; `Poison Barb` is the
  corresponding real item. King's Rock differs only in apostrophe style in
  the source data; Blast Seed is a real Mystery Dungeon item.
- Enemy assignments and the complete species/move table are in
  [ENEMY_ATTACK_ROLES.md](ENEMY_ATTACK_ROLES.md).
