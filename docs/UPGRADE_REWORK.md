# Pokémon levels, milestones and rewards

Every living Pokémon receives the full XP value of defeats and pickups and keeps its own level, XP and next-level requirement. Adding a recruit never reduces anyone else's XP. Recruits start at level 1; Exp. Share grants 35% extra shared XP to teammates below the leader's level. Personal XP rewards affect only their owner. Overflow survives choices, and simultaneous milestone rewards queue while combat remains paused.

Ordinary levels happen during combat without a menu, sound interruption or pause. Each level adds 2% of base HP and attack power, preserving health percentages. Signature attacks, learned attacks and the leader's special share this modest damage growth. Levels do not automatically add move ranks. The cap is level 100. Choices occur at personal levels **3, 5, 10, 15, 20…100**. Evolution and new-move choices end before level 45; milestones from 45 onward offer existing move upgrades and squad stats. Move and stat training have no rank ceiling, so rewards remain available in long runs.

The next level costs `round(80 + 10L + 1.6L²)` XP at personal level `L`, targeting **level 25–35 on the leader at 15 minutes**, with level 100 reserved for extended play. The aggregate run level counts all earned personal levels for existing recruitment gates; it is not the displayed leader level. Recruitment opens when its gates are met without consuming a Pokémon milestone. Evolution uses personal level 5 or 10, with the existing 170-second maturity requirement, and must be chosen below level 45.

## Moves and level rewards

- Four total moves: the species' starting attack plus at most three learned moves.
- Every move has an independent rank and cooldown, with no rank ceiling for any species.
- Each damage rank adds 20% of the move's initial power; casting speed also improves by 8% of base speed per rank. Learned moves gain 6% of base reach and radius per rank, with additional projectiles or chain targets at appropriate ranks.
- From the first milestone, selections prioritize an existing move upgrade and stat training. New moves are an occasional third option (30% chance when there is an eligible free slot and room after evolution), with extra slots unlocking at personal levels 10, 20 and 30. Every eligible evolution remains visible. Elite/chest rewards also supply training throughout. Eevee displays all three branches plus a fourth move-training alternative before the cutoff, so evolution remains optional; keys 1–4 select cards.
- Evolution preserves the earned level and XP, increases max HP and permanent attack damage by 25%, and grants +1 rank to every known move without a rank ceiling. It grants no extra slots or free attacks. If a learned move becomes the evolved species' starting move, the higher rank is retained before applying the bonus once, and the duplicate slot is freed.
- Single-stage species unlock mastery at personal level 5: a move training choice grants +2 ranks without a ceiling. Both signature and learned moves benefit; ordinary levels only improve stats. A rank-1 learned move trained to rank 3 gains 40% damage and a 13.8% shorter cooldown, versus 20% damage and a 7.4% shorter cooldown for a normal one-rank upgrade. At rank 12, learned moves deal 3.2 times their initial damage and cast 88% faster before squad bonuses.
- Basic move definitions become eligible at level 3, intermediate at 5 and advanced at 10, but learning additionally requires an unlocked extra slot (levels 10, 20 and 30). Random offers favor the species' types while varying within its legal learnset. Full move slots leave existing attacks available to train.
- Learned attacks trigger attack-based relics, including Big Root and Life Orb. Metronome repeats the move that triggered it without recursively triggering more relics.

## Useful percentage upgrades

Training comes from personal milestones from level 3, elite/boss rewards and paid supply chests. It covers damage, casting speed, movement, max HP, mitigation, dodge recovery, special recovery, crit and reach. All nine stats have Common, Rare and Epic versions worth 1×, 2× and 3× the base bonus, rolled at 55% / 35% / 10% before luck. Swords Dance grants +12% / +24% / +36% attack damage. Rarities share the same accumulated stat and training rank; two versions of the same stat never occupy the same normal offer.

Training and moves have no rank ceiling or fraction badge. Additive bonuses keep accumulating. HP training preserves health fractions and recruits inherit the bonus. Iron Defense multiplies remaining incoming damage by 92%, 84% or 76%, so every pick helps without crossing into negative damage. Critical chance above 100% becomes critical damage. Power, speed, reach, attack speed, dodge recovery and special recovery have no former build-stat ceiling. Existing projectile/proc budgets remain; attack speed beyond the safe casting cadence strengthens hits and healing instead of producing more casts. Percent descriptions use the % symbol.

Relics come from caches, supply chests and rare enemy drops. Twelve weak, redundant, recruitment-only or evolution-dependent relics remain retired from new offers, while their IDs remain resolvable for saved collections and existing builds. Twenty-four recurring relics remain. Offers and drops respect unlocks and exclude mechanics the current squad cannot use or unconditional relic bonuses already at their cap. Teammate-only effects, including Exp. Share, require a living follower, and stale cards are rejected after losing that follower. Bonuses that help the leader remain available solo and are labeled for your Pokémon.

Examples: Leftovers restores 0.8% of each member's own max HP per second; Heal Bell restores 12% on a special; Zap Plate scales its chain from critical hit damage; Blast Seed and Eruption scale with the attacker's move power. Counts, extra projectiles, pickup distance and durations remain flat where that makes the effect clearer.

## Species learnsets

Species eligibility is cached in `src/data/learnsets.ts`, generated with `node scripts/sync-learnsets.mjs` from the [pinned PokeAPI database](https://github.com/PokeAPI/pokeapi/blob/227b573712414a86ba299d322fa398fbb2893edc/data/v2/csv/pokemon_moves.csv). It uses level-up, egg, tutor and TM learnsets across main-series versions for all original 151 species. Combat values and run-level unlocks are adapted; eligibility is never inferred from typing. The 41 implemented learned moves require no runtime network requests. Species with very limited legal options rely on signature training and evolution rather than invented learnsets.

## Drops and purchases

Elite and boss rewards offer squad training without consuming a milestone. Landmark guardians always grant one; random elites can grant a reward at most every 90 active seconds to limit interruptions. Boss rewards remain queued for endless continuation.

Coins collect without pausing: ordinary enemies have a 70% chance to drop one, variants drop two, and elites drop twelve. Rare items grant an eligible unlocked relic on pickup without a choice. Normal item chance is 0.2%; elite chance is 18%. Duplicate or no-longer-useful gear converts to 15 coins. A separate seeded loot RNG avoids consuming combat RNG.

The map has two free item caches and three paid supply chests. The first purchase costs 45 coins; every paid purchase adds 15 to remaining chest prices. Paid chests offer items or squad training. Unaffordable or exhausted chests take no coins and remain available. A successful purchase charges once and consumes that chest. Coins reset each run. The HUD shows coins, affordability, individual XP bars and next milestones; free caches and supply chests have different minimap colors.

Drop rendering stays within existing budgets. At capacity, XP and coins are delivered directly; rare gear can replace an XP drop while preserving its value. Item drops remain for 120 seconds; other pickups expire after 45 seconds.

## Enemy balance and verification

Time remains the main difficulty driver. New enemy endurance gradually gains up to 40% by 15 minutes. Living-party investment contributes at most another 20% health and 8% damage, applying to future spawns. Boss and guardian scaling uses average personal level so aggregate squad levels do not inflate fights disproportionately. Movement and attack tells stay stable. Specials follow the same 2%-per-level growth instead of adding five flat damage each level.

Regression coverage includes non-pausing levels, modest real damage/HP gains, full XP sharing and catch-up, milestone queues, overflow conservation, real learnsets and move gates, optional branching evolution, unlimited ranks, rarity scaling/distribution, gradual slot gates, teammate-only eligibility, enemy scaling bounds, elite rewards, drops and purchase accounting. Browser checks cover level 2 without a menu, milestone ownership, queue pauses, coin/item pickups, supply purchases and narrow layouts.

`scripts/progression-pacing.mjs` reports the leader's actual level (`leaderLevel`), aggregate squad progress (`level`), personal levels, move ranks and choices by source. `preferNewMoves:true` exercises a learning-focused route. Health-maintained scripted routes measure progression and repeatability, not human survival or final balance. Playtesting should tune the XP curve, item drop rate and enemy endurance together.

The level-100 curve was checked across 12 routes: six seeds each for signature training and varied learned moves. That earlier tuning pass put every leader at level 29 at 15 minutes, within the 25–35 target, with four living teammates; it predates the unlimited-training refinement. These routes do not exercise manual chest exploration. The six-seed regression test asserts the actual leader level stays within the target range.

The October 20 training refinement passed `npm test` (341 tests), `npm run build`, and `npx playwright test tests/browser/upgrade-cards.spec.ts tests/browser/pokemon-progression.spec.ts` (10 tests). Browser checks cover actual solo rewards, rarity amounts and labels, applying a Rare upgrade, desktop/mobile layouts, milestone ownership, evolution and purchase flow. Seeded checks cover rarity frequencies, unlimited training, gradual learning gates, teammate-only eligibility and continued damage growth after reaching the casting budget. Human balance over a full run still needs playtesting; the production build retains Vite's large-chunk warning.
