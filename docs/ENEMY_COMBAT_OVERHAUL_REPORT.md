PHASE: Enemy combat, readable attacks and difficulty overhaul

What changed:

- All 151 species now have an explicit battlefield role: 31 fast melee, 28 heavy
  melee, 27 rapid burst, 35 slow projectile, 6 self-destruct, 16 bomb throwers and
  8 healers. The complete mapping is in [ENEMY_ATTACK_ROLES.md](ENEMY_ATTACK_ROLES.md).
- Melee commits to a visible cone before striking. Ranged enemies maintain
  distance and release physical, non-homing shots. Bomb throwers mark a fixed
  landing point, throw an arcing bomb and retain the warning through flight.
  Self-destruct attackers show a fuse and spend themselves without kill/XP rewards.
  Healers seek and heal wounded enemies. Stun cancels a committed windup.
- Enemies have seven distinct body poses, direction-specific sprite attacks,
  element-colored effects and real Pokémon move labels from a pooled text atlas.
  Hostile projectiles can hit followers; poisoned faction shots keep their poison.
  Variant aggression still changes attack recovery without shortening warnings.
- Ordinary enemy damage keeps its existing opening value through 120 seconds,
  then smoothly reaches +20% at 180 seconds. Ordinary HP, speed and spawn rates
  receive no additional multiplier from this change. Existing time-based scaling,
  variants and the director remain active.
- Wild elites have 5× base HP and 1.35× damage. Optional landmark guardians have
  a larger level/time-based HP floor and alternate an elemental area move with
  their role attack. Shrine blessings require defeating their guardian; the
  separate existing rare Ancient Echo event retains its own immediate bonus.
- Mewtwo has 12000 + 250 per run level HP, stronger volleys/rings, four summons
  and shorter recovery between patterns. Existing .7/1.1/1.5-second warnings
  remain. Boss attacks are named Psystrike, Psychic and Teleport.

Changed files:

- `src/data/enemyAttacks.ts`, `config.ts`, `director.ts`, `rosterContent.ts`
- `src/game/combat/enemies.ts`, `projectiles.ts`
- Enemy/boss sections of `src/game/Simulation.ts` and enemy/projectile fields in
  `src/game/types.ts` (both shared with concurrent player-side changes)
- `src/game/systems/spawning.ts`
- `src/game/render/animation.ts`, `AssetLibrary.ts`, enemy sections of `Effects.ts`
- `scripts/boss-pacing.mjs`
- `tests/enemy-combat.test.ts`, `difficulty.test.ts`, enemy assertions in
  `combat-animation.test.ts`, `director.test.ts`, `simulation.test.ts`, `effects.test.ts`
- `tests/browser/enemy-roles.spec.ts`, `attack-polish.spec.ts`, `world-boss.spec.ts`
- This report, the role table, and the shared-workspace coordination note.

Why the approach is maintainable:

The roster holds data, shared combat helpers own role behavior, Simulation owns
damage/rewards/timing, and rendering observes state. Enemy move geometry and
labels are pooled. Difficulty and boss values are explicit configuration.
Player progression, XP, specials and upgrade UI are being completed by the other
chat; their live edits were preserved.

Tests run:

- Focused enemy tests: `node --experimental-strip-types --test tests/enemy-combat.test.ts tests/combat-animation.test.ts tests/difficulty.test.ts tests/effects.test.ts tests/animation.test.ts tests/spawning.test.ts` — **47/47 passed**.
- Browser: `npx playwright test tests/browser/enemy-roles.spec.ts tests/browser/world-boss.spec.ts tests/browser/attack-polish.spec.ts` — **9/9 passed**, including actual WebGL rendering.
- `npm run typecheck`: passed.
- `npm run build`: passed; existing large-bundle advisory remains.
- `npm run content:audit`: 151 species, 151 profiles, 72 evolution edges, all
  species spawn-reachable, 453 animation entries, no issues.
- Latest full `npm test`: 272/274 passed during concurrent player work. The two
  outstanding player sound/special assertions are identified in the coordination note.
- Move names were compared with the English names in PokeAPI's move-name CSV;
  every enemy, primary and learned move matched.

Browser smoke steps:

Real Chrome/WebGL verified all seven poses, native attack frames, pooled labels,
label priority/caps/reuse/disposal, directional slash geometry, reduced motion,
windup cancellation, actual Egg Bomb casting/flight/landing markers, paused
hazards, boss warning/bar/ring/summons, victory and endless retention. The bomb
capture is `artifacts/browser/enemy-egg-bomb.png`.

Known limitations:

- The requested 15–25% overall difficulty is a playtest target. This implements
  +20% ordinary attack damage after the opening; different attacks, player build
  changes and skill affect actual survival difficulty.
- Human sessions and target-device performance measurements remain outstanding.
- The full shared suite has two player-side failures while the other chat works.
- Evolution adding a move must be reconciled with the other chat's four-move
  limit; this report does not claim that player-side requirement is finished.

Balance / performance impact:

`node --experimental-strip-types scripts/boss-pacing.mjs` uses four fixed seeded
teams, scripted orbit/jump/dodge movement, no health maintenance and disabled XP
to retain the fixed build. With final settings, wins took 29.16, 42.76 and 53.48
seconds; the fourth team lost at 31.20 seconds with 4339.69 boss HP remaining.
These results are not a human win rate. Enemy labels use one texture atlas and
at most 16 active labels; combat rendering retains the existing pool budget.

Next recommended phase:

Finish the other chat's upgrades/evolution/move pass, resolve the shared suite's
remaining failures, then playtest full runs with the combined changes.

Regression checklist:

- All 151 species classified and given real named attacks.
- All seven roles execute distinct attacks rather than contact-only damage.
- Physical hostile shots and timed bomb landings; no enemy homing.
- Paused windups, projectiles, labels and rings remain frozen.
- Stun, poison, follower damage and permanent fainting remain active.
- Spawn/entity caps, 15-minute boss timing and optional endless retention remain.
- Native sprite animation, reduced motion and pooled renderer disposal remain.
