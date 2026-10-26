# Expert Belt, Spillstone, Blood Pact and Berserker Emblem

Implemented October 26, 2026. These four families use the existing relic rewards, drops, build summary and catalogue. They are in the starting relic pool for both new and migrated collections.

| Relic | Rarities and values | Stacking / scope |
| --- | --- | --- |
| Expert Belt | Rare: +25% move damage against elites/bosses. Legendary: +50%. | Repeatable; bonuses add to the attacker's existing power pool only against an eligible target. Applies to signatures, learned attacks and specials. |
| Spillstone | Epic: transfer 20% of overkill damage. Legendary: 40%. | Repeatable; mixed rarities add their fractions into one transfer to the nearest other living enemy within 4m of the victim. Equal distances use the lowest enemy UID. |
| Blood Pact | Epic: double special damage, half special cooldown, 15% max-HP cost per cast. | Unique, leader only. Damage and cooldown factors apply after ordinary special damage/recharge bonuses. Unavailable for a leader with a healing-only special. |
| Berserker Emblem | Common: +20%; Rare: +30%; Epic: +40%; Legendary: +60%. | Repeatable across rarities. While leader HP is strictly below 50%, add the stated amount to leader movement speed, squad defense and squad attack damage. Ends at 50% or above. |

Blood Pact pays its exact max-HP cost before on-special healing and before the cast. Defense, deflection and invulnerability do not reduce the cost. It can defeat the leader; a lethal payment prevents the special and on-special healing. A successful payment that takes the leader below half health can enable Berserker Emblem. Followers retain their ordinary automatic specials and never charge the leader for Blood Pact.

Spillstone uses resolved native overkill, including the original hit's critical result. It does not roll a second crit or apply a second target matchup, and it never triggers on-hit, on-kill or further overkill relic effects. A spill kill still grants ordinary kill credit, XP and loot. Damage denied by a boss stage threshold produces no overkill. No suitable recipient means no transfer.

Expert Belt's additive calculation retains the source move's cast-time power for delayed hits, including projectiles and timed specials. The optional power snapshot is validated and survives suspend/resume; older snapshots without it use current power as a compatibility fallback. No new timers, currencies or persistent progression were added.

Cards preview Expert Belt's conditional power separately from ordinary power. Blood Pact previews its multiplier, actual special cooldown and HP cost. The catalogue includes all rarities, and sibling variants still cannot occupy the same normal offer. The estimated special DPS calculation includes Blood Pact's damage and recharge factors.

The existing boss/shrine throughput fixture now blocks random relic acquisitions, matching its stated fixed-build contract. Previously it froze XP and menus while still picking up gear; Blood Pact exposed this by adding self-damage to an incoming-damage-isolated trial. Shrine duration checks also verify no relic copies were acquired. This changes the benchmark, not ordinary-run rewards.

## Validation

New regression coverage exercises additive damage, learned/special hits, delayed projectiles, mixed rarity stacks, critical overkill, deterministic recipients, ordinary spill kill rewards, blocked recursion, boss thresholds, special cost ordering, lethal payment, follower isolation, eligibility, threshold recovery, previews, collection migration and deterministic suspend/resume. Browser coverage checks acquisition, narrow-screen card layout, tradeoff text and displayed copy counts.

- `npm.cmd test`: 612/612 passed, including 17 new relic regression tests.
- `npm.cmd run build -- --configLoader runner`: passed TypeScript and production compilation; Vite retains its existing large-chunk warning.
- `npm.cmd run test:browser -- tests/browser/new-relics.spec.ts`: 1/1 passed. Acquired the new relics through real choice cards, combined Berserker rarities, verified unique ownership, and checked the 390px Blood Pact layout without page errors.
- Regenerated `UPGRADE_CATALOGUE.md`; `git diff --check` passed.

These checks establish mechanics and integration; whole-run human balance remains unmeasured.
