# Legendary upgrades and percentage previews

October 21, 2026.

The owner clarified that percentage bonuses add against the base stat:
`100 * (1 + 0.05 + 0.10) = 115`. Damage, HP and other additive bonus accumulation
retain that calculation. The initial compounding request was superseded by this
explicit clarification. Defense retains its existing remaining-damage rule;
critical chance and overflow retain their existing behavior. Previews show the
effective result of these rules rather than simply adding the printed numbers.

Training has Common/Rare/Epic/Legendary percentages at 1/2/3/4 times the common
amount, with no new mechanics. Base rarity weights are 55/35/9.5/0.5; legendary
probability is 0.5% when every rarity is eligible, before missing-bucket
renormalization. Rerolls retain rarity slots, including Legendary.

Every one of the 24 offerable relic families has a Legendary variant. Positive
stat bonuses and triggered strength double; drawbacks, triggers and cooldowns
retain their authored values. Retired relics receive no new variants. Owning
either version excludes its entire family; sibling versions cannot appear
together in a choice, reroll or pending ground drop. Variants inherit base unlocks,
including existing saves, without adding achievement requirements. Chests, caches,
enemy drops and shrine rewards support the new rarity.

Cards have gold Legendary frames and badges. Stat previews include existing
training, relic and active synergy bonuses. They use copied build state and the
actual purchase logic, with no RNG or combat-state changes. Conditional relics
show changes only when their condition currently applies. The pause summary uses
the same percentage precision. The catalogue generator includes all 36 training
variants and 48 relic offers. The pre-edit catalogue is preserved in ignored
`artifacts/UPGRADE_CATALOGUE.before-training.md`.

Changed implementation: `src/data/{progression,items,unlocks}.ts`,
`src/game/types.ts`, `src/game/systems/progression.ts`, the item-drop family checks
in `src/game/Simulation.ts`, `src/ui/{UI,upgradePreview}.ts`,
`src/ui/upgrades.css`, and `scripts/lib/run-metrics.ts`. Catalogue generation,
upgrade/telemetry tests, browser checks, and linked design documents were updated.
Existing evolution, terrain and animation work was preserved.

Validation:

- Baseline: `npm.cmd test` passed 407 tests.
- Final `npm.cmd test`: 416/416 passed (`artifacts/training-tests.log`).
- `npm.cmd run typecheck`: passed.
- Production build: `npm.cmd run build -- --configLoader runner` passed, including
  TypeScript. Existing large-chunk advisory remains (main chunk about 6.34 MB).
- `npm.cmd run content:audit`: 151 species/profiles, 72 evolution edges,
  453 animations, no issues.
- Chrome/WebGL: `npx.cmd playwright test tests/browser/upgrade-cards.spec.ts`
  passed 5/5 flows, including rarity styling, rerolls, reduced motion,
  authoritative purchases, additive previews, pause preservation and 320/390px
  layouts. Captures: `artifacts/browser/legendary-upgrades-{desktop,mobile}.png`.
- `node --experimental-strip-types scripts/generate-upgrade-catalogue.mjs`
  refreshes the complete catalogue and source fingerprint.

Balance and limits: Legendary rewards are stronger but very rare; no new runtime
actors or proc triggers were added. Offers and previews allocate bounded copies
only while preparing the paused choice screen. Telemetry records Legendary
separately, including CSV exports. No human full-run balance study was performed.
Existing stat/proc caps and critical-overflow rules remain future F3 work.
