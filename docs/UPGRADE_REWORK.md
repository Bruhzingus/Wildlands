# Individual Pokémon progression and upgrades

Each living Pokémon owns its level, XP and next-level requirement. Defeats and XP pickups contribute one shared XP pool, split evenly across living teammates before each member's XP bonuses. Recruits start at level 1. XP is retained across choices and excess XP is carried into later levels. Simultaneous rewards stay paused and identify each Pokémon as its choice opens.

The next level costs `round(60 + 28L + 30L²)` XP at Pokémon level `L`. The aggregate run level still tracks total earned squad levels for recruitment gates and world progression; the HUD shows actual individual levels and separate move ranks. Evolution uses the Pokémon's own level: 5 for the first form and 10 for the final form, with the existing 170-second maturity requirement.

## Moves and level rewards

- Four total moves: the species' starting attack plus at most three learned moves.
- Every move has an independent rank, capped at 8, and independent cooldown.
- Each damage rank adds 20% of the move's initial power; casting speed also improves by 8% of base speed per rank. Learned moves gain 6% of base reach and radius per rank, with additional projectiles or chain targets at appropriate ranks.
- Normal level selections reserve two move options when available, plus squad training or evolution. Named Eevee branches use a dedicated evolution choice.
- Evolution preserves the earned level, XP and trained ranks, grants no extra slots or free attacks, and increases max HP and attack damage by 25%. If a learned move becomes the evolved species' starting move, the higher rank is retained and the duplicate slot is freed.
- Learned attacks trigger attack-based relics, including Big Root and Life Orb. Metronome repeats the move that triggered it without recursively triggering more relics.

## Useful percentage upgrades

Squad training covers damage, attack speed, movement, max HP, mitigation, dodge recovery, special recovery, critical chance and reach. Max-HP training adds 20% of base max HP per rank, preserving current health percentage and applying equally to later recruits. Iron Defense adds 8 percentage points of mitigation per rank. Overall build caps still apply.

Relics come from caches. Twelve weak, redundant, recruitment-only or evolution-dependent relics are retired from new offers, including Soothe Bell/Welcome Basket, Rare Candy/Growth Charm, Eviolite, Everstone, Metal Coat and Sitrus Berry/Recovery Seed. Their IDs remain resolvable for saved collection data and existing builds. Twenty-four recurring relics remain in the catalogue. Cache choices exclude mechanics the current squad cannot use and unconditional bonuses already at their cap.

Examples: Leftovers restores 0.8% of each member's own max HP per second; Heal Bell restores 12% on a special; Zap Plate scales its chain from critical hit damage; Blast Seed and Eruption scale with the attacker's move power. Counts, extra projectiles, pickup distance and durations remain flat where that makes the effect clearer.

## Verification

Regression coverage includes individual XP sharing and ownership, queued level rewards, XP conservation, four-move limits, evolution duplicate merging, actual move damage/cooldown improvements, percentage mitigation and healing, recurring relics, applicable cache offers, and attack-triggered effects on learned moves. Browser checks cover real XP pickup, named owner cards, queued selections, four-slot summaries, narrow layouts, rarity animations, reduced motion and Space protection.

The health-maintained, scripted 15-minute pacing experiment initially produced 38–41 selections across four seeds. The steeper final curve produced 20–25 selections, three recruits and four living Pokémon in those same runs. The script now reports each Pokémon's level, move count and ranks. This is a controlled progression check rather than a measurement of human survival balance.
