# Shared move definitions

Implemented October 26, 2026. Signature and learned occurrences of the same named move now share base power, element, targeting, projectile shape, cooldown, status effects and rank milestones. Bite uses the authored pounce on both Zubat and Growlithe; Swift uses independently seeking Normal stars on both Staryu and Eevee and when learned. Thunder Circuit uses the same targeting and pulse progression on Pikachu, Raichu and Jolteon.

Pokémon power, evolution stage, personal level, move rank, training, relics and target matchups still affect damage. Signature and learned slots apply those caster bonuses through the same damage calculation. Each slot retains its own cooldown timer.

The shared move catalogue is in [moveDefinitions.ts](../src/data/moveDefinitions.ts). Existing signature handling supplies the common profile where available; moves available only through learning retain their authored profile. The unused alternative learned profiles have been removed. Both slots resolve rank growth through [attackDefinitions.ts](../src/data/attackDefinitions.ts).

Before critical hits and matchups, offensive move damage is:

```text
move base power
× ((species.power + 9) / 23)
× (1 + 0.12 × (evolution stage - 1))
× (0.8 for first-stage ranged attacks; otherwise 1)
× personal level multiplier
× (1 + 0.17 × (move rank - 1))
× (1 + damage bonuses)
× resolved move damage scale
```

The reference power of 23 preserves the existing baseline for signatures without a separate authored power value. Melee's shared 25% damage and geometry bonus remains part of the move profile. Ranked cooldowns already include the 7% casting-speed gain per rank; attack scheduling adds haste once.

This changes combat balance, including learned-move casting rates. The October 24 starter audit and proposal estimates predate this change. Their historical measurements are retained; regenerate the audit to measure the current build. Regression coverage includes the full roster, overlapping signature/learned definitions, actual damage delivery, cooldowns and upgrade descriptions.
