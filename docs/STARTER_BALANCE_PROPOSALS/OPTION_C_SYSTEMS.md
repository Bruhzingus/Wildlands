# Option C: authored cast budgets and normalized progression

**Status: independent design proposal, October 24, 2026. No gameplay implementation.** This package is the largest of the alternatives: rebuild the accounting rules that cause repeated balance outliers, then author every starter against those rules. Choose it if predictable future balance and consistent upgrade value justify changes to the combat schema, progression, relic wording, and suspended-run handling.

Existing observations come from [the starter audit](../STARTER_BALANCE_AUDIT.md) and [its measured tables](../STARTER_AUDIT_DATA.md). Every numerical value below is a **proposed starting value**. Tables marked projection are arithmetic under the proposed formulas, not measurements of an implemented version or predictions of player win rates.

The central change is to author **damage for a complete cast**, then divide that damage between the cast's native projectiles, strikes, or pulses. Three bubbles, five stars, and four punches are different delivery mechanisms; they no longer accidentally multiply the same already-scaled damage budget. Crowd coverage remains explicit and useful. Percentage upgrades, move ranks, attack cadence, and critical tiers remain uncapped.

## 1. Why choose this system rather than another local fix?

Current examples explain why flat numerical changes alone will need repeated maintenance:

- Blastoise reaches 1,870.49 neutral signature DPS at level 30/rank 8, while Gyarados reaches 295.34. Native homing projectile count is a major multiplier on top of rank, species power, evolution power, and stage damage.
- Additional Loaded Dice projectiles double rank-one Squirtle's isolated damage but provide a smaller percentage gain to an already multi-projectile attack and no isolated-target gain to some visited-set attacks.
- Same-target hit streams amplify item effects independently of their listed damage. Changing damage alone leaves Metronome and hit-triggered item interactions unequal.
- Three-stage lines receive two additive evolution-power grants; two-stage lines receive one. Evolution also changes base power, damage scale, HP, profile geometry, and known-move ranks.
- The current slash modifier rewards Bulbasaur's 17.5m vine and Growlithe's 11.25m bite as if both required close engagement.

Three possible accounting mechanisms were considered:

| Mechanism | Concrete rule | Advantage | Cost / reason for the choice |
| --- | --- | --- | --- |
| Retain full hit damage; diminish secondary hits on the same enemy | First contact 100%, later contacts 25% per cast | Smaller migration; five bubbles become 2x instead of 5x | A five-hit move still receives twice a one-hit move's damage, while four punches lose a different proportion. Collision order changes damage. Every new count breakpoint needs retuning. |
| Conserve all native and relic projectiles inside one fixed budget | Each of N total projectiles receives 1/N of the cast | Stable isolated damage regardless of count | Loaded Dice can become a dead boss upgrade and can reduce damage when a wider fan misses. This conflicts with useful repeatable upgrades. |
| **Selected: conserve native delivery; give relic projectiles explicit additive packets** | Native contacts collectively deliver the authored cast budget; each bonus projectile adds a separate 20%-budget packet | Native breakpoints stop creating accidental exponential growth; each extra projectile has a known, uncapped contribution | Requires cast provenance and proc accounting. Relic descriptions and some breakpoint descriptions change. |

This is a different combat economy, not a coefficient layer to stack on top of the other options. Do not combine its form multipliers or budgets with another option's species-power buffs.

## 2. Exact formulas and schema

Let:

- `L` be personal level, and `R` the rank of the move actually casting.
- `P`, `A`, `S`, and `QH` be the additive power, attack-speed, special-power, and special-recharge bonuses already earned.
- `D` be the authored signature DPS coefficient, `C` its base interval, and `M` its form multiplier from the species table.
- `H` be the authored role HP in the table; `HM` is 1.00 for a first form, 1.25 for a middle form, and 1.60 for a final form.
- `Q` be the authored single-target direct-damage allowance for a complete Q cast.

```text
levelFactor       = 1 + 0.02 * (L - 1)
rankDamage        = 1 + 0.20 * (R - 1)
rankSpeed         = 1 + 0.08 * (R - 1)

signatureCastBase = D * C * M * levelFactor * rankDamage
signatureCast     = signatureCastBase * (1 + P)
signatureInterval = C / rankSpeed / (1 + A)

idealSignatureDPS = D * M * levelFactor * rankDamage * rankSpeed
                    * (1 + P) * (1 + A)

leaderMaxHP       = H * HM * levelFactor * (1 + additiveHealthBonus)
followerMaxHP     = leaderMaxHP * (155 / 96)

QCast             = Q * M * levelFactor * (1 + 0.12 * (signatureRank - 1))
                    * (1 + P) * (1 + S)
QInterval         = 16 / (1 + QH)
```

Use the existing personal-level limit; this proposal adds no rank or bonus limit. Preserve negative-bonus handling for reductions such as Iron Ball, including a positive rate denominator. Positive bonus accumulation must never be clamped to a gameplay ceiling. Ordinary percentage sources still add: +8% and +15% power give `1 + 0.08 + 0.15 = 1.23`, not `1.08 * 1.15`.

For periodic damaging Q fields/cones, a purchased duration bonus extends the field at the same pulse cadence and damage per pulse: total full-exposure damage becomes `QCast * (1 + durationBonus)`. Resolve a fractional terminal pulse by its exposed time fraction. Do not stretch the same fixed pulse count across a longer duration, which would make the duration card fail to add damage. Instant Q uses duration only for its applicable status timers. The tables assume zero duration bonus. Rank itself does not retain the legacy extra pulse/duration/damageScale growth on top of the formula: use the base counts/durations specified below, with rank damage in QCast and the retained range/radius growth. Extra visual pulses share the same native allocation.

Remove the following from **C-mode friendly signature damage only**, replacing them with the table and formulas: `species.power + 9`, the 1.25 slash damage bonus, stage-one ranged damage penalty, and stage-based 0.12 damage bonus. New C-mode runs also stop awarding +0.25 `evolutionPower` per evolution; this separately sourced bonus is omitted from P for both signatures and learned moves. Enemy encounter stats already use separate `enemySpecies.ts`, enemy-move and boss budgets. Keep those budgets unchanged for the initial comparison, and retain the existing species fields for legacy friendly runs and catalogue consumers.

Evolution still grants +1 to the signature and each known learned move. Its power/HP receipt instead displays the actual before/after result from `M`, the new form's coefficient, and `HM`. Keep current eligibility and maturity gates. Two-stage finals use the same 2.6 form multiplier as three-stage finals; their later single evolution delivers the accumulated progression at once. Their different timings still matter and must be tested.

Species `power` becomes a legacy friendly/old-run field, not a second hidden v2 friendly damage stat. The party catalogue should show the new cast damage, interval, primary element, and range; a displayed Power value may be derived from the cast budget but must not imply a separate multiplier.

### Defense and other percentage boundaries

Use the table's defense as an armor rating:

```text
armorRating = max(0, baseDefense * (1 + additiveDefenseBonus) + flatArmor)
afterArmor  = incoming / (1 + armorRating / 20)
afterDR     = afterArmor / (1 + max(0, damageReductionRating))
```

This replaces flat subtraction in C-mode. At 20 incoming damage, 1.8 defense prevents about 1.65 damage; 3.2 prevents about 2.76. Low-damage contact cannot become permanently zero through flat subtraction, and arbitrarily large finite positive defense bonuses continue helping. There is no minimum-damage floor. Preserve invulnerability, dodge, and airborne contact rules separately.

This package also replaces deflection's current 50% ceiling with `chance = rating / (1 + rating)`, retaining uncapped additive rating. Rewrite cards as “+N% deflection rating” with a preview of the actual chance; do not present rating points as a literal probability increase. This continues value toward the physical probability boundary. Percentage regeneration, movement speed, duration, radius, and recharge remain uncapped under their existing continuing-value rules. Armor, reduction, and deflection are chosen C rules, not optional additions to its numerical tables. These formulas must not silently alter v1 runs.

### Suggested data shape

```ts
interface FriendlyCombatBudget {
  version: 2;
  speciesId: number;
  formMultiplier: 1 | 1.6 | 2.6;
  healthMultiplier: 1 | 1.25 | 1.6;
  roleHP: number;
  baseDefense: number;
  signature: {
    dps: number;
    interval: number;
    range: number;
    element: Element;
    groups: DeliveryGroup[];
    procExposurePerTarget: number; // normally 1 per complete native cast
    extraProjectileWeight: 0.2;
  };
  q: {
    directBudget: number;
    cooldown: 16;
    groups: DeliveryGroup[];
    healMaxHPFraction?: number;
  };
}

interface DeliveryGroup {
  id: string;
  weight: number;             // fraction of the complete native cast
  delivery: 'focused' | 'fan' | 'lane' | 'splash' | 'chain' | 'orbit' | 'combo';
  repeatPolicy: 'split' | 'once-per-target';
  // Native counts and geometry remain authored by rank/form.
  firstTargetWeight: number;
  laterTargetWeight: number;
}
```

Keep the schema in a new friendly-budget data module rather than changing one shared number used by friendly and hostile species. Update `getAttackProfile` consumers so the combat resolver, progression preview, analytics, catalogue, and item-eligibility checks all use the same resolved profile. This package needs an explicit v2 adapter for recruited nonstarter species before shipping; the roster table below fully authors starter families, not all 151 species.

## 3. All species budgets

`D` is the full intended single-target signature DPS coefficient before form/level/rank/build multipliers. It is not damage per projectile. `Q` is total direct damage per full Q cast before its multipliers. HP values are role coefficients; actual HP uses `H * HM` at level 1. Defense does not receive an additional form multiplier.

`Range` is authored effective range in meters, before rank and player range bonuses. It excludes the removed hidden slash range multiplier. Apply the existing rank range factor `1 + 0.06 * (R - 1)` uniformly to acquisition and effective geometry, then multiply by `1 + radiusBonus`. Preserve collision consistency; do not expand an orbit's minimum radius as a substitute for useful extra reach.

| Species | M | D | C (s) | Range (m) | H | Defense | Q |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1: Bulbasaur | 1.0 | 22 | 0.95 | 14 | 96 | 1.8 | 72 |
| 2: Ivysaur | 1.6 | 23 | 0.95 | 14 | 96 | 2.1 | 76 |
| 3: Venusaur | 2.6 | 24 | 0.95 | 14 | 96 | 2.5 | 80 |
| 4: Charmander | 1.0 | 30 | 0.90 | 11 | 92 | 1.4 | 96 |
| 5: Charmeleon | 1.6 | 32 | 0.90 | 11 | 92 | 1.7 | 100 |
| 6: Charizard | 2.6 | 34 | 0.90 | 11 | 96 | 2.1 | 104 |
| 7: Squirtle | 1.0 | 22 | 0.95 | 15 | 108 | 2.4 | 64 |
| 8: Wartortle | 1.6 | 23 | 0.95 | 15 | 108 | 2.8 | 68 |
| 9: Blastoise | 2.6 | 24 | 0.95 | 15 | 112 | 3.2 | 72 |
| 10: Caterpie | 1.0 | 18 | 1.05 | 13 | 100 | 1.8 | 64 |
| 11: Metapod | 1.6 | 18 | 1.05 | 13 | 112 | 2.8 | 64 |
| 12: Butterfree | 2.6 | 20 | 1.05 | 13 | 92 | 1.8 | 68 |
| 16: Pidgey | 1.0 | 20 | 1.10 | 13 | 92 | 1.5 | 56 |
| 17: Pidgeotto | 1.6 | 21 | 1.10 | 13 | 96 | 1.8 | 60 |
| 18: Pidgeot | 2.6 | 22 | 1.10 | 13 | 100 | 2.1 | 64 |
| 25: Pikachu | 1.0 | 23 | 0.94 | 15 | 92 | 1.6 | 80 |
| 26: Raichu | 2.6 | 24 | 0.94 | 15 | 100 | 2.0 | 84 |
| 27: Sandshrew | 1.0 | 18 | 1.15 | 9 | 112 | 2.6 | 72 |
| 28: Sandslash | 2.6 | 20 | 1.15 | 9 | 120 | 3.2 | 80 |
| 37: Vulpix | 1.0 | 22 | 1.35 | 13 | 96 | 1.6 | 88 |
| 38: Ninetales | 2.6 | 24 | 1.35 | 13 | 100 | 2.1 | 96 |
| 41: Zubat | 1.0 | 32 | 0.85 | 5.5 | 92 | 1.3 | 88 |
| 42: Golbat | 2.6 | 32 | 0.85 | 5.5 | 100 | 1.8 | 96 |
| 43: Oddish | 1.0 | 17 | 1.40 | 14 | 100 | 1.8 | 32 |
| 44: Gloom | 1.6 | 18 | 1.40 | 14 | 104 | 2.1 | 34 |
| 45: Vileplume | 2.6 | 19 | 1.40 | 14 | 108 | 2.4 | 36 |
| 52: Meowth | 1.0 | 24 | 0.90 | 15 | 92 | 1.5 | 104 |
| 53: Persian | 2.6 | 25 | 0.90 | 15 | 96 | 2.0 | 112 |
| 58: Growlithe | 1.0 | 26 | 1.15 | 7 | 104 | 2.0 | 88 |
| 59: Arcanine | 2.6 | 27 | 1.15 | 7 | 112 | 2.5 | 96 |
| 63: Abra | 1.0 | 24 | 1.35 | 18 | 84 | 1.1 | 88 |
| 64: Kadabra | 1.6 | 25 | 1.35 | 18 | 88 | 1.4 | 92 |
| 65: Alakazam | 2.6 | 27 | 1.35 | 18 | 92 | 1.8 | 96 |
| 66: Machop | 1.0 | 34 | 1.00 | 5.5 | 112 | 2.4 | 112 |
| 67: Machoke | 1.6 | 35 | 1.00 | 5.5 | 116 | 2.7 | 116 |
| 68: Machamp | 2.6 | 36 | 1.00 | 5.5 | 120 | 3.0 | 120 |
| 92: Gastly | 1.0 | 26 | 1.40 | 7 | 88 | 1.2 | 88 |
| 93: Haunter | 1.6 | 27 | 1.40 | 7 | 92 | 1.5 | 92 |
| 94: Gengar | 2.6 | 28 | 1.40 | 7 | 96 | 1.8 | 96 |
| 129: Magikarp | 1.0 | 10 | 1.00 | 3.5 | 80 | 0.8 | 32 |
| 130: Gyarados | 2.6 | 36 | 1.80 | 15 | 120 | 3.0 | 120 |
| 133: Eevee | 1.0 | 24 | 1.05 | 15 | 100 | 1.8 | 72 |
| 134: Vaporeon | 2.6 | 24 | 0.95 | 15 | 116 | 2.6 | 76 |
| 135: Jolteon | 2.6 | 26 | 0.85 | 15 | 92 | 1.6 | 84 |
| 136: Flareon | 2.6 | 34 | 0.95 | 11 | 104 | 2.2 | 104 |

All ordinary movement remains at 7.3m/s before earned movement bonuses. Retain standard jump/dodge mechanics and existing leader-only movement traits unless a row in the next section explicitly changes them. There are no new permanent damage passives hidden outside this table.

### Arithmetic projections at level 30 / rank 8

These projections use no items, critical hits, statuses, matchups, or other bonuses. The shared signature factor is `2.6 * 1.58 * 2.4 * 1.56 = 15.380352`; the Q factor is `2.6 * 1.58 * 1.84 = 7.55872`.

“Full signature” requires all native delivery portions to connect, within that move's effective range. Charizard's distant small-target coefficient is 60% of full; Flareon's is 75%. Close-only abilities cannot be read as 8m damage. Q totals assume its complete intended exposure and range.

| Final form | Full signature DPS | Leader HP | Q direct damage/cast |
| --- | --- | --- | --- |
| Venusaur | 369.1 | 242.7 | 604.7 |
| Charizard | 522.9 | 242.7 | 786.1 |
| Blastoise | 369.1 | 283.1 | 544.2 |
| Butterfree | 307.6 | 232.6 | 514.0 |
| Pidgeot | 338.4 | 252.8 | 483.8 |
| Raichu | 369.1 | 252.8 | 634.9 |
| Sandslash | 307.6 | 303.4 | 604.7 |
| Ninetales | 369.1 | 252.8 | 725.6 |
| Golbat | 492.2 | 252.8 | 725.6 |
| Vileplume | 292.2 | 273.0 | 272.1 |
| Persian | 384.5 | 242.7 | 846.6 |
| Arcanine | 415.3 | 283.1 | 725.6 |
| Alakazam | 415.3 | 232.6 | 725.6 |
| Machamp | 553.7 | 303.4 | 907.0 |
| Gengar | 430.6 | 242.7 | 725.6 |
| Gyarados | 553.7 | 303.4 | 907.0 |
| Vaporeon | 369.1 | 293.2 | 574.5 |
| Jolteon | 399.9 | 232.6 | 634.9 |
| Flareon | 522.9 | 262.9 | 786.1 |

Consequences to test:

- Blastoise becomes 369.1 full-delivery signature DPS instead of the measured 1,870.5. This is an approximately 80% reduction in this isolated comparison, and **is not a small balance patch**.
- Gyarados becomes 553.7, or 1.50 times Blastoise; it matches Machamp's full-delivery coefficient while paying the weak Magikarp opening and a charged beam windup.
- Raichu, Ninetales, and Vaporeon each land in the 369.1 ranged band, but damage geometry, control, HP, Q, and traversal differ.
- Charizard becomes 313.8 against a distant small target and 522.9 with full fan overlap. Flareon becomes 392.2 against a distant small target and 522.9 with full overlap.
- Three independent learned moves and automatic follower Q casts are still additional output. This table alone cannot determine encounter difficulty.

## 4. Delivery, Q, and identity decisions for each family

The budgets above apply to **each named form in its row**. Below, “B” means that form's complete, scaled signature cast budget; “T” means its complete, scaled Q budget. Percentage portions below are authored delivery coefficients, not earned-stat caps.

Native projectile counts already visible in a family may be retained as visuals and delivery improvements. Where explicitly authored counts below differ, use these counts. Rank improvements keep their shared damage and cadence gains; geometry milestones add coverage or reliability rather than another accidental full same-target damage multiplier.

| Family | Signature delivery and exact change | Q and utility decision |
| --- | --- | --- |
| Bulbasaur / Ivysaur / Venusaur | Vine lanes deal B to the selected enemy and 0.65B to subsequent pierced enemies. Share the same per-target group across native lanes. Native lanes: 1 at R1, 2 at R3, 3 at R6; native total distinct targets per lane: 2/3/4 at those ranks. Effective starting reach becomes 14m. Grass element throughout. | Bramble Garden delivers T in 5 equal pulses over 3s. First target and every enemy inside receive the same T if fully exposed. Each pulse refreshes slow; keep 0.57 movement factor and 2.5s slow timer. No new heal or damage passive. |
| Charmander / Charmeleon / Charizard | Central flame carries 0.60B; the two side lanes share a 0.40B flank group per target. Either flank lane can redeem that group once, so adding wider coverage lanes never reduces an existing lane's damage. R4 adds two more outer coverage lanes; R7 adds one pierce. Native full same-target delivery remains B. Burn chance 30% per native cast-target exposure, rising to 55% at R7. | Flamethrower delivers T in 8 pulses over 1.2s in its forward cone, burns on contact. Preserve current ground movement for Charizard in this package; flight would require a separate safety tradeoff. Its higher fan-overlap damage and lower first-form HP are its choices. |
| Squirtle / Wartortle / Blastoise | Split B equally among 1/2/3 native bubbles for the forms; R5 and R8 each add one bubble and redistribute the same B. All native bubbles retain homing. Splash radius 1.2m, +0.4m at R2 and +0.4m at R6; splash victims receive 0.60 of that bubble's damage. Direct target never takes direct plus splash twice. Soak on direct hits. | Surf delivers T once to every crossed enemy, 4m push, 3.2s soak, 2.5s slow. Keep high HP/armor identity. Pierce allows continuation to distinct enemies; subsequent detonations share the cast-target budget and cannot repeatedly deal full bubble splash to one boss. |
| Caterpie / Metapod / Butterfree | Thread deals B to its first enemy, 0.65B to later enemies. Distinct targets: 1 at R1, 2 at R2, 4 at R5. Guaranteed slow. R7 stun chance becomes 25% per cast-target exposure, replacing 45% per repeated hit opportunities. Metapod explicitly trades increased armor/HP for no extra D coefficient; Butterfree restores offense/traversal. | Electroweb has a central route carrying T and outer coverage routes at 0.60T per distinct enemy, with a cast-target ledger preventing overlap multiplication. Guaranteed slow, no new stun on Q. Preserve Butterfree's 1.5s flight and broad existing evolved learnset. No new move required. |
| Pidgey / Pidgeotto / Pidgeot | Gust uses Flying explicitly. One full B can reach a target across all native lanes; later pierced targets receive 0.65B. Four distinct targets per lane; lanes 1 at R1, 2 at R5, 3 at R8. Knockback 1.6m, 2.4m from R3, replacing 2.8m. | Whirlwind uses Flying, delivers T once, pushes ordinary enemies 6m. Preserve 2s flight and 4s recharge after flight ends. Relatively low single-target budget pays for powerful safe traversal and displacement. |
| Pikachu / Raichu | First chain target B; each native later target 0.65B. Three total targets at R1, four at R3, five at R6. No repeated boss hits from base chains. Retain 0.20 stun chance per target exposure; chain range 4.7m. | Thunder Circuit's six visible strikes are two focused strikes of 0.50T each and four coverage strikes of 0.50T each against other enemies. Thus isolated damage is T and crowd total can reach 3T. Never reroute coverage strikes onto the focused target. Preserve Run-up +25% / +18% and 16s base Q recharge. |
| Sandshrew / Sandslash | Center-priority target receives B. Every other enemy in the 9m by 4m forward lane receives 0.65B; native lane max 16 distinct targets. Shared native-lane ledger prevents overlap. Slow chance 30%, replacing 45%. Retain wide crowd identity and high defense. | Fissure delivers T to its aimed enemy through one rupture anchored at that enemy; four other eruptions along the lane each deal 0.60T to distinct other enemies. Overlap cannot re-hit the same target. Preserve 0.8s invulnerable burrow and Sandshrew's 1.3x stamina recharge duration; Sandslash uses normal recharge. |
| Vulpix / Ninetales | Orbiting foxfire divides B among 2 / 3 native flames, adds one at R3 and one at R6. Flames orbit the selected target for 0.45s, then converge; reserve enough travel time before expiry to reach its center. No damage is lost when a target is inside the orbit. Burn chance 40% per full exposure. Orphan flames retarget nearest reachable enemy, uid tie-break. | Ninefold Foxfire distributes T across 9 flames, guarding for 0.8s before homing to reachable enemies inside 8m. Against one stationary target in range all 9 converge for T. Applies burn. No evasion, heal, or defensive aura added; reliability is the new benefit. |
| Zubat / Golbat | B split across the existing bite/sweep contacts, 5.5m effective reach. Every secondary enemy in the sweep receives 0.65B. Zubat's primary remains Normal; Golbat's is Poison. Starting D drops from measured 46 to 32 and first-form HP from 105.6 to 92. | Wing Attack delivers T in a 5.5m forward sweep, Flying element, no lifesteal. Preserve 1.5s flight. This intentionally pays for traversal through lower HP/armor instead of adding another sustain advantage. |
| Oddish / Gloom / Vileplume | B is the entire pod/cloud direct budget per target, split across 1/2/3 native pods by form; each pod bursts on its target. Other enemies in its 2.8m cloud receive 0.60 of its portion. Native overlap never adds more than B to one target. Guaranteed poison and 35% slow chance per native cast-target exposure. | Sleep Powder deals T over 4 pulses in 4s; initial application stuns 0.7s, later pulses refresh only slow. At cast, heal every living party member for 7.5% of that member's max HP times `(1 + 0.02 * (R - 1)) * (1 + S)`. Heal once; no duration-based repeats. Power P affects damage, not healing. No revive. |
| Meowth / Persian | First accurate coin delivers B to its focused enemy. Ricochets deal 0.65B to distinct secondary targets; 2 bounces at R1, 3 at R4, 4 at R7. Additional native coins redistribute the focus budget and coverage rather than multiplying boss damage. Keep Normal element and 7m bounce range. | Fury Swipes delivers T over 6 strikes to its 5.5m focused target; neighboring enemies in the sweep receive 0.50T over the full sequence. No new currency generation passive. Reliable ranged primary plus a higher-value close Q is the tradeoff. |
| Growlithe / Arcanine | Bite/pounce reach becomes 7m. Focus receives B, other sweep victims 0.65B. Native widening at R4 and R7 adds coverage; no extra damageScale multiplier at R6. Normal for Growlithe, Fire for Arcanine. | Flame Charge delivers 0.55T on passage and 0.45T across its 2s trail; each enemy's total is T. Keep collision-aware movement and burn. Do not add invulnerability beyond the shared 0.4s Q window. A strong reliable attacker with less extreme reach. |
| Abra / Kadabra / Alakazam | Two crossing beams share B on the focused target. Each beam can deliver 0.65B to distinct secondary enemies, with a shared target ledger preventing intersection duplication. 18m starting range. R5 adds an outer coverage beam without increasing focused damage. Low HP/armor pays for range. | Teleport Lance deals T along its collision-resolved forward path and stuns once for 0.7s. Keep Abra's teleport dodge only where currently authored; no automatic new invulnerable dodge for Kadabra/Alakazam. Q remains the line's shared reposition tool. |
| Machop / Machoke / Machamp | Split B across 2/3/4 native combo strikes; ranks add animation/coverage but not another full B. Each secondary sweep target receives 0.65B across the entire combo. Effective reach is 5.5m; both acquisition and every strike use the same rank/bonus-scaled envelope. | Close Combat delivers T across 6 strikes inside 5.5m, with 0.65T on secondary sweep enemies. Shared 0.4s Q invulnerability only. Higher HP/armor and the highest ordinary melee coefficient pay for commitment to close range. No self-heal or permanent damage ramp. |
| Gastly / Haunter / Gengar | Two/three/four wisps share B. Each guards a 2.5m orbit for 0.4s, then homes to the selected target within 7m. It can hit an adjacent target during homing; increasing rank/radius does not push the inner safe zone outward. Orbit-contact secondary targets receive 0.60 of the wisp's share. A target's contact plus homing portions cannot exceed its allocation. | Haunting Hex deals T across 5 pulses in 3s, slows and poisons on initial application. Keep ghost matchups and low defensive stats. The new inner coverage replaces the ring-only constraint; it does not add untargetability or a wall-phasing passive. |
| Magikarp / Gyarados | Magikarp Tackle becomes 10 DPS, 80 HP, 3.5m reach and 1s cadence. It remains the explicit weak opening. Gyarados has D=36, a 15m beam, and 1.8s base cycle including a 0.35s visible windup. During windup it moves at 80% of its normally modified speed; no hard movement-speed ceiling. Beam deals B to focus and 0.65B to up to 3 additional enemies. | Magikarp Flail delivers T times `1 + 1.5 * missingHPFraction` in its close area: 32 at full HP through 80 near zero HP before other scaling. Preserve Splash leap and empty pre-evolution learnset. Gyarados's existing lance-type Q becomes a Water torrent delivering T to each enemy along its path. The high mature damage/HP is its payoff; no free learned moves or extra evolution ranks. |
| Eevee / Vaporeon / Jolteon / Flareon | Eevee Swift shares B among 2 native accurate stars, adds one at R3/R6/R8, preserving one total native budget. Vaporeon follows the bubble rules with 2 native bubbles; Jolteon follows the chain rules with 4 native targets; Flareon has a 0.75B central lane and 0.25B flank group. Flareon full overlap D=34, distant small D=25.5. | Eevee Quick Attack deals T along its collision-aware dash. Vaporeon Surf follows Squirtle utility and adds no healing. Jolteon Circuit follows Pikachu's 1T focus/3T crowd structure and retains +18% Run-up. Flareon gets a short, forward Flamethrower Q using its T over 8 pulses in 1.2s; this **replaces** its close-only fire-ring special in C. Branches offer durability/soak, speed/chains, or cone/burn. |

For Q geometry not overridden here, retain the existing authored profile geometry and the shared 0.4s invulnerability. The family rules specify full damage allocation and new behavior; the implementation must derive each pulse/contact's amount from T rather than retaining legacy per-hit damageScale on top. In particular, Gyarados uses Water for the proposed Q even if its legacy profile resolves otherwise; this is a deliberate content change to make its payoff and team identity readable.

**Windup and cadence.** Gyarados's 0.35s is a base windup within its 1.8s base cycle. Scale both by `1 / [rankSpeed * (1 + A)]`; otherwise sufficiently high haste would leave a fixed windup longer than the complete interval. During a windup, apply one 0.80 movement factor, never multiply it repeatedly for overlapping logical casts. The windup does not lock dodge, Q or learned attacks. At release, revalidate the captured target and reacquire a reachable enemy if needed; an empty release spends its scheduled cast without inventing a hit. Save the remaining scheduled release and source budget.

**Duration bonuses.** T describes complete exposure at the authored base duration. For persistent damaging fields/cones/trails (Garden, Flamethrower including Flareon, Sleep Powder, Haunting Hex and Flame Charge's trail), retain the base pulse spacing and per-pulse damage when duration is increased. Added duration schedules additional pulses, with a proportional final partial pulse where needed, rather than spreading the original T more thinly. For Flame Charge, only its 0.45T trail allocation extends; its initial 0.55T passage remains once. Oddish's once-per-cast heal remains once. Other one-pass waves, dashes, strikes and projectile volleys retain their stated native damage allocation; duration can extend their active window and relevant status timers, not create extra full-damage contacts implicitly. Represent long effects logically beyond the visual pulse limit. If the active-special pool must coalesce effects, preserve independent casts and their remaining allocations just as for projectiles.

C's delayed homing orbit design deliberately supersedes the common minimal orbit repair's convergence/frozen-target behavior: Vulpix uses a 0.45s guard then homes, Gastly uses a 0.4s guard then homes, and orphan flames/wisps retarget the nearest reachable enemy with uid tie-breaking. Apply the common fix as a baseline before comparing options, then substitute this selected C delivery policy rather than layering both movement curves. Gyarados's Water Q is renamed **Tidal Lance**; do not display Hyper Beam while applying a new Water element.

### Crowd coefficients are not a global damage ceiling

A 0.65B secondary target still receives its full coefficient multiplied by all applicable power, rank, critical, type, and relic bonuses. Hitting 12 genuinely different enemies still generates substantial total damage. There is no 12-enemy or 16-enemy *percentage-stat* cap: native target counts are authored attack behavior; extra pierce/chains can add logical contacts.

Because a uniform 0.65 secondary coefficient is conservative, do not also apply the current chain falloff or another global AoE penalty. The table is the authority for this package.

### Status damage decision

Keep baseline burn 4/s for 3s and poison 2.6/s for 4s in the first C implementation. Timers refresh rather than stack; Binding Band extends duration without a hard duration ceiling. This avoids simultaneously changing every status budget while replacing direct-damage accounting. At high power/rank, status **direct damage** becomes a smaller contribution; poison/fire +18% and soaked/electric +35% remain relevant multiplicative interactions.

Do not grant a new attack-scaling burn/poison passive without rebudgeting the relevant D/Q values. If telemetry later proves that direct poison/burn must scale, treat it as a separate proposal with its own source attribution, noncritical DoT policy, and stacking rules.

## 5. Learned moves and evolution rewards

Learned attacks retain independent cooldowns, their current eligibility sets, and the three slots unlocking at personal levels 10/20/30. They share the new budget accounting, so “five needles” does not automatically have five times the damage budget of “one beam.” Each move keeps its current base cooldown, range, shape, element, status, and authored native target behavior unless the common correctness fixes require a change.

Set learned-move D coefficients by the following complete mapping of the current 41-move catalogue:

| Proposed D | Move IDs |
| --- | --- |
| 8 | razor-leaf, ember, water-gun, thunder-shock, gust, confusion, swift, water-pulse, shock-wave, sludge-bomb, mud-shot, psybeam, pin-missile, dragon-breath |
| 10 | tackle, quick-attack, bug-bite, body-slam, flame-burst, surf, seed-bomb, discharge, ice-beam, blizzard, poison-jab, air-slash, bug-buzz, rock-slide, shadow-ball |
| 12 | hyper-beam, double-edge, fire-blast, solar-beam, brick-break, focus-blast, earthquake, hurricane, future-sight, stone-edge, shadow-claw, dragon-pulse |

For a learned move, `castBase = D * currentBaseCooldown * M * levelFactor * rankDamage`; interval uses its current base cooldown and the same rankSpeed and A formula. Native multi-projectiles split its one target budget; straight piercing and chain secondary targets use 0.65 of the appropriate portion; splash secondary targets use 0.60. Status chances receive cast exposure accounting, preventing five needles from producing five times the intended status chance.

This gives a final-form level-30 rank-one learned move **32.9, 41.1, or 49.3** ideal DPS. At rank eight it gives **123.0, 153.8, or 184.6**. Three fully trained learned attacks can therefore materially exceed the signature budget, but each consumes slots and training choices. They are not free additions to the seven-choice signature/evolution comparison.

Evolution still trains known attacks by one rank, and keeps the existing signature/known-move merge behavior: merge matching innate moves using the maximum rank, then apply the single rank grant. Never apply two grants because a learned move became innate. All percentage power upgrades affect signatures and learned attacks through the same P pool; learned moves no longer depend indirectly on whether the family received one or two evolutionPower grants.

Do not add a general “all starters receive a passive” system in C. The meaningful additions are target-safe orbit delivery, better-focused Circuit/Fissure, percentage support healing, a deliberate Flareon Q, explicit Gyarados payoff, and consistent damage/proc accounting.

## 6. Relics, critical tiers, procs, and team composition

### Extra projectiles

Each added Loaded Dice projectile creates a new packet worth **0.20B** before matchup/critical and earned power are applied. Its focus target uses the same aiming rules as the native move; if it is an eligible projectile move, the extra packet is aimed reliably at the focused target, not arbitrarily scattered outside the attack's effective cone. All earned copies add:

```text
full single-target budget with E bonus projectiles = B * (1 + 0.20 * E)
```

E remains uncapped. At E=1/2/10/100, full delivery is 1.2/1.4/3/21 times native B. Native B is never divided by `nativeCount + E`; that would dilute an existing projectile whenever a relic is added.

Rewrite Loaded Dice: “Eligible projectile moves fire +1 focused projectile carrying 20% of that move's full cast damage.” Legendary +2 is +40%. This is a deliberate change to relic value, not an unchanged item under a new implementation. It applies to eligible Q projectile patterns using T instead of B; it does not add projectiles to a melee Tackle or nonprojectile Q. The extra packet inherits the cast's element and critical tier; Q continues not to crit.

### Pierce, chains, and ricochets

- Drill Run adds its stated number of distinct logical target contacts, at the move's secondary-target coefficient. No new same-target contact is created. A bubble pierces by continuing after detonation; all detonation contacts for a target remain attributed to that original packet.
- Discharge adds its stated distinct chain targets at 0.65B per complete native chain. Extra targets are not fed back into the focused boss. If fewer enemies exist, unused target capacity has no immediate value; this is physical encounter scarcity, not a hidden bonus cap.
- Keep Loaded Dice, Drill Run, and Discharge gated on **presently supported resolved profiles**, including learned moves and current Q. For a solo Magikarp with no eligible attack, those offers remain absent until recruitment/evolution makes them useful.
- Classify attack-kind synergies from the resolved active signature, and elemental synergies from species types. Count a living member once per synergy, not once per learned move.

### Critical hits

Retain the required critical-tier formula:

```text
tier = floor(chance) + Bernoulli(frac(chance))
multiplier = critDamage ^ tier
```

Use one critical-tier roll per logical native cast, as the current automatic-attack path does, and apply that tier to its portions and bonus-projectile packets. No tier cap and no conversion of critical chance overflow into a different stat. Q, status ticks, and proc-created damage retain their existing noncrit policy unless an effect explicitly inherits the source damage's critical multiplier.

A landed logical hit emits one onCrit event carrying the tier; three guaranteed tiers do not emit three onCrit callbacks. Persist precritical/critical amounts and provenance in analytics. At normal .05 chance and 1.85 multiplier, expected direct damage is still 1.0425 times the noncritical amount.

### Native multi-hit proc exposure

Introduce `procExposure` separate from physical collision count. Each cast-target entry has a normalized exposure-unit budget `U`: B for a focused signature target, T for a focused Q target, or that move's authored full secondary-target allocation such as 0.65B or 0.60T. U includes the cast's applicable damage modifiers and critical multiplier, but excludes the proc effect's own damageScale. A delivered portion earns `portionDamage / U` exposure before matchup; matchups apply to direct and proc damage in their respective normal paths.

- One complete native cast hitting one enemy has exposure 1, split between its native portions in proportion to their damage allocation. A partially delivered cast earns only the portion delivered: a distant central flame worth 0.60B earns 0.60 exposure with U=B.
- Each +20% relic packet contributes exposure 0.20 to that target and uses the same U. More projectiles still increase proc value; five cosmetic/native portions do not silently create five full triggers.
- A fully delivered native cast against a secondary enemy also earns exposure 1, but uses that enemy's smaller U, such as 0.65B. Do not both reduce exposure by 0.65 and then reduce the proc's unit damage by 0.65. Area weapons retain a crowd proc advantage because they genuinely affect more targets.
- Q uses the same exposure policy and still emits one onSpecial per logical cast. On-attack relics count casts, not native projectile count.

For **counted effects**, add exposure to the appropriate counter and trigger on each integer threshold crossing; carry its fractional remainder. Big Root and Power Herb remain cast-counted and do not use hit exposure.

For **chance-based per-hit effects**, preserve expectation with weighted trials: `floor(exposure)` ordinary trials plus one fractional trial with probability `fraction * listedChance`. For every unit of cumulative cast-target-effect exposure, draw one seeded uniform z in [0,1). If z is below the listed probability p, place its trigger threshold at z/p within that exposure unit; otherwise that unit never triggers. Emit when delivered exposure crosses the threshold. At partial exposure w, the chance is exactly p*w; at a full unit it is p. Native fractions belonging to the same cast/target/effect consume the same threshold, so splitting a five-hit cast does not reroll it five times. Bonus packets can extend exposure into later units. Save the random seed/cursor and consumed exposure so resume and packet coalescing preserve the same result. An incomplete cast never receives undelivered exposure.

Metronome becomes “Consecutive squad **cast hits** on one enemy add +10% damage per prior uninterrupted cast hit.” Each native cast-target entry counts once when it first lands; bonus projectile exposure contributes fractional additional count. The focus sequence resets when a different target receives a new native cast-target entry, keeping the current squad-wide focus tradeoff. The accumulated percentage remains uncapped and additive. Multi-hit Q does not build six full stacks simply because its animation uses six cuts.

When a chance-based damage proc triggers, scale its damage from **U**, not the triggering physical fragment. For five B/5 contacts, combined exposure is 1 and the trial probability is p; resulting proc damage is `U * effect.damageScale = B * effect.damageScale`. Using B/5 again would penalize splitting twice. A bonus-only 0.20B contact earns probability 0.20p and still uses U=B, so its expected proc damage is exactly 0.20pB times the effect scale. For a fully delivered secondary target with U=0.65B and exposure 1, expected proc damage is 0.65pB times that scale. Q uses its own T-based U. This changes burst timing/variance compared with independent physical-hit rolls and must be stated in telemetry and balance review.

Zap Plate and Power Gem are onCrit damage effects with cooldowns, rather than chance-on-hit effects. A critical cast-target unit makes one eligible event with normalized U after one full unit of delivered exposure; partial exposure carries forward within that cast and, on expiry, emits one fractional event with damage scaled by its delivered fraction. Bonus packets contribute later fractional units. Emit at most once per native unit, retain the source tier, and enforce each item's existing cooldown in simulation time. Do not charge full U for each visual contact. This intentionally moves some proc timing toward the end of a combo; test that feel rather than treating it as a numerically invisible change.

Eruption and Blast Seed, whose wording references primary damage, use **one complete signature cast's precritical focused budget B**, not an arbitrary first projectile. Their changed strength needs explicit comparison: 80% of B for Blast Seed and 150% of B for Eruption, with existing elemental rules and nonrecursive proc depth. Retain relic stack arithmetic and existing cooldown semantics; do not cap percentage-of-hit damage.

### Followers and support

Use the same offensive budgets and learned-move rules for leader and followers. Keep the current follower-to-leader initial HP ratio 155/96, shared full XP, recruitment gates, automatic Q casts, existing follower-specific incoming-hit scaling, and existing follower regen. Do not give followers leader-only traversal defenses.

Oddish-line healing uses each recipient's own current max HP, so follower HP and health training scale correctly. Heal Bell still adds its own existing max-HP heal on Q. Famine continues suppressing all such healing, including the new once-per-cast percentage heal; neither extra ranks nor duration bypasses it. Multiple healer followers can create a sustain-heavy composition; evaluate three- and four-member teams before deciding whether healing needs lower *authored* coefficients. Do not add an unannounced global percentage-heal cap.

The following exact team samples are required: solo each starter; water + Pikachu; Oddish + Growlithe; Machop + ranged support; three Oddish-family healers; three same-family projectile attackers; and Eevee leader with each branch. Include leader and follower swaps: a species whose safety only comes from a leader movement trait should have a different survival profile when recruited.

## 7. Bounded state and saturation without discarding earned value

The current physical limits include 220 projectiles, 190 enemies, six active specials, twelve visual projectiles per authored cast, and 32 cast packets per step. These are execution constraints, not permission to cap damage, haste, range, or duration.

A v2 contact needs `castId`, `sourceUid`, `moveId`, `budgetGroupId`, `packetOrdinal`, `logicalCastCount`, `damageWeight`, `procExposure`, `critTier`, and captured provenance. A cast-target ledger tracks already delivered native group allocation and proc thresholds. IDs must survive save/load; deterministic ordering uses cast creation order, packet ordinal, then target uid.

**Do not reuse the existing saturated-projectile merge test unchanged.** It currently finds a compatible friendly stream by source/move/kind/type/target/damage/tier and increments hitCount. Equal damage does not imply one cast. Merging two independent casts into one budget ledger would incorrectly suppress one cast's hits/procs; treating a visual representative as two unrestricted fresh native groups could instead duplicate damage.

Required aggregation contract:

1. Merge *representation* only when collision paths, target routing, native group, timing bucket, critical tier, and remaining contact eligibility are equivalent. Carry a multiplicity of independent cast budgets and their attributed contributions; never share one consumed native allowance across different logical casts.
2. Keep budget accounting independent of render entities. If two distinct contributions share a picture, collision delivery must still resolve two logical casts. A partial already-hit volley cannot merge into a fresh volley unless its independent remaining-budget vector is retained.
3. Carry source attribution for both damage and proc exposure. Existing `damageContributions` and critical-multiplier metadata must not be replaced by one anonymous pooled amount.
4. Maintain ledger storage only for active logical streams and living target IDs. Retire records once every delivery portion has expired or completed; remove dead enemy IDs. Do not keep historical hit lists for the whole run.
5. Use fixed-size time/geometry cohorts and numeric multiplicities for repeated identical scheduled casts. More haste changes logical cast count and timestamp distribution, never multiplies a single slower hit as a substitute for attack speed. Effects with cooldowns evaluate the represented timestamps; cast-counted effects see all casts.
6. Long-duration field pulses are represented by start time, next-pulse time, pulse interval, and outstanding multiplicity, not one object per pulse. Extending duration must keep creating useful scheduled exposure.
7. Above finite precision, saturate arithmetic monotonically at the representable numeric limit; never turn Infinity/NaN into zero damage. This is numerical safety, not an authored gameplay cap.

There is a real engineering constraint: arbitrary independent projectile paths and independent random histories cannot all be exactly represented by one constant-size object. The implementation must declare which streams are equivalent and supply a bounded simulation representation for the others. **Do not ship C on the assumption that hitCount alone solves this.** Its release gate includes adversarial saturated-pool fixtures with mixed cast ages, paths, critical tiers, and partially consumed budgets. If those cannot pass with the chosen representation, keep C experimental and deliver a smaller option first.

## 8. Versioning and migration

Current persistent progression uses save version 2; suspended simulation snapshots and run files use version 1. These are separate schemas.

Recommended migration:

- New runs choose `combatRulesVersion: 2` and serialize it with the run. Existing suspended runs remain explicitly `combatRulesVersion: 1` and continue under the legacy rules until completed. Do not retroactively remove evolutionPower or redistribute an in-flight attack.
- Extend the run/snapshot schema to serialize cast counters, budget/proc ledgers, aggregated contributions, scheduled casts, and any seeded proc thresholds. Increment the snapshot/run-file version with a v1 reader; do not merely add fields that the validator silently drops.
- Preserve unlocked starters, map/challenge unlocks, achievements, wins, and settings. There is no need to erase persistent progression to adopt a new combat model.
- Existing v1 trainingBuffs, item counts, level/rank, and evolutionPower remain intact in v1 resumed runs. New v2 runs do not award evolutionPower. A direct v1-to-v2 in-progress conversion is explicitly excluded from this package.
- Keep the old power accounting traceable: `rawModifiers` currently adds `member.evolutionPower` before `state.buffs.power`, `member.trainingBuffs.power`, relics, and synergies. The v2 resolver omits only that separately identified evolutionPower source for new v2 runs; it must not subtract 0.25 per inferred evolution from the total P pool or edit either earned-buff record. Record power-source contributions in the migration fixture and assert that all non-evolution sources are identical before and after deserialization.
- Replay/checkpoint tests must include the existing 30-second rewind and 33 retained checkpoint behavior. No duplicate evolution rank grant, heal, death proc, or paid upgrade may occur after resume.
- Both combat versions must know retired item IDs already supported by old saves. Different relic descriptions are selected by the run's rules version.
- Back up migration fixtures for a partial Vulpix orbit, two merged same-target bubble casts, a half-completed Machop combo, a ready Oddish heal, and critical chance 250%. Validate exact post-resume event/damage sequences, not only successful JSON parsing.

This policy increases temporary maintenance cost but avoids silently weakening an already-invested live run. If retaining two engines is unacceptable, ship the new system only after legacy runs can be finished/exported; that product choice needs to be made explicitly.

## 9. Staged implementation plan

1. **Lock the baseline.** Record code fingerprints, regenerate current audit data, and keep the common geometry/eligibility corrections in their own measured baseline. Do not infer post-fix damage from this document's arithmetic.
2. **Add isolated v2 budgeting.** Create the data schema and pure budget calculators; author the 45 rows and all 41 learned moves; verify tooltips and formulas. Keep old runs on v1.
3. **Implement provenance before rebalancing.** Add native/bonus packet identity, per-target group consumption, proc exposure, saturated-stream accounting, snapshot serialization, and analytics. Use synthetic one- and multi-cast cases before changing starter values.
4. **Port family delivery and Q.** Port one representative from each geometry class, then all 17 families and branches. Update status probabilities, elements, milestones, item eligibility, and synergy classification together.
5. **Complete the rest of the friendly roster.** Author or explicitly calibrate v2 budgets for recruitable nonstarter species. Do not combine v2 starter/follower budgets with uncatalogued legacy damage formulas, since full-party comparisons would then be misleading.
6. **Validate encounter pacing.** Run paired seeds under identical decision policies and then human sessions. Freeze enemy tuning initially to expose how much the new offense scale changes survival, XP pace, and boss TTK.
7. **Choose release coefficients from evidence.** If median three-member boss TTK exceeds the reference by more than 20% across the supported map/challenge set, adjust a named global *authored encounter HP* parameter or the whole v2 form budget once, then rerun. Do not buff only Blastoise back to its old outlier because it used to kill fastest.
8. **Roll out new-run-only.** Keep an explicit rules version in telemetry and exports. Compare win/abandonment rates separately from old runs; remove v1 support only with a separately reviewed migration strategy.

## 10. Acceptance criteria

These are design acceptance thresholds, not achieved results.

### Deterministic mechanics

- At L1/R1, L10/R3, L20/R6, and L30/R8, all fully delivered single-target signature budgets agree with the formula within 0.5%; isolated budgets and the full Simulation agree within 1%.
- Exercise rank 1 through 20 and then 50/100 for every family, plus every actual geometry breakpoint. A beneficial rank/radius increase cannot remove damage from a previously hittable stationary target. Test size 0.8 and boss size 4.4 at 0/1/3/5/8/12/18m where applicable, moving targets, and dt 0.01, 1/60, 0.025, 0.04.
- Focused bonus-projectile delivery at E=0/1/2/10/100 follows `1 + 0.20E`; at resource saturation the same logical damage and exposure remain within 1% of the unsaturated reference. Native count changes leave the authored single-target total unchanged.
- Crit fixtures at 0/50/100/150/250/500% and very large finite chance preserve guaranteed tiers, fractional rolls, precritical attribution, and one event per logical hit. Q and DoT do not accidentally acquire normal crit rolls.
- P/A/QH/radius/duration/defense/healing bonuses at 0/100/500/5,000% continue to affect their intended outcome. A display-only increase with unchanged effective behavior fails.
- Splitting one native cast into 1/2/5/10 equivalent contact portions preserves total damage and item exposure. Combining two independent casts into one render stream preserves two casts' value and proc identity.
- Save/resume preserves exact damage, death, acquisition, crit-tier, and item-counter outcomes from the checkpoint onward for seeded fixtures.

### Balance and progression

- At the first 165s recruitment gate, all ordinary starters should complete a basic fixed-route survival scenario; target median kill count within 25% of the ordinary-starter median. Magikarp is exempt from the kill-count band but must be survivable without receiving an eligible ranged relic by luck.
- At equal level/rank/choice investment, ordinary final-form ideal focused signature DPS should stay within the proposed 292–554 band; melee/shotgun users must demonstrate actual geometry and safety tradeoffs. This is a coefficient review band, not a runtime clamp.
- Every Eevee branch must improve neutral 8m small-target signature damage across evolution at the same elapsed state including the granted rank, and offer at least one distinct payoff: Vaporeon durability/soak, Jolteon speed/chains, Flareon cone burst/burn.
- Gyarados must achieve at least 1.35x Blastoise focused signature DPS in a stationary 8m fixture and at least 1.15x in a moving-target fixture, after its windup. Its pre-evolution opening must remain measurably weaker; do not label the branch balanced solely because the final number is high.
- A four-member team with three healers must still take meaningful damage in representative boss patterns; use incoming damage, overheal, faints, and interrupt frequency to judge it, not raw healing totals.
- Compare each role on fixed seed families, single and multiple enemies, moving targets, both maps, first/second boss, solo and 3–4 members, no relics, Loaded Dice, Drill Run/Discharge, crit, Metronome, and support-heavy builds. Include signature-focused and learned-move-focused purchase policies.
- Require at least 20 paired deterministic seeds per core scenario plus human testing for orbit positioning, melee commitment, and movement traits. Report median and p10/p90 outcomes, not one favorable seed. No claim of balanced human win rates follows from this sample alone.

## Recommendation

Choose C when the priority is a coherent foundation for adding species, moves, and repeatable upgrades. Its strongest benefits are predictable native projectile scaling, comparable final-form budgets, clear build contribution, and a real Magikarp payoff. Its principal costs are a new combat accounting layer, changed relic value, large reductions to current outliers, and legacy-run compatibility.

For a near-term release, C should remain a separately versioned experiment until saturated-cast accounting and full-party pacing pass. The common correctness fixes are useful regardless of which balance package is selected.

