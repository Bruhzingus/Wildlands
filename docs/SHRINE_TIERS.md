# Shrine encounters

Shrines are stone sculptures of the Pokémon they summon. Each nearby preview shows the species, count, hazards, tier and recommended level. The preview appears within 12m; press E within 4.5m to begin. The leader must be within 10 levels of the recommendation, including both endpoints. The first six tiers have multiple species variants; each site's sculpture, preview and guardians use the same variant.

| Tier | Encounter | Recommended level | Arena radius | Hazards | Total HP | Dust |
|---|---|---:|---:|---|---:|---|
| 1 | 1 Machop, Geodude or Mankey | 5 | 20m | None | 1,350 | Pale mint |
| 2 | 3 Pikachu, Growlithe or Eevee | 9 | 20m | None | 1,500 | Pale cyan |
| 3 | 2 Arbok, Ekans or Zubat | 13 | 18m | Poison | 1,800 | Soft blue |
| 4 | 3 Sandslash or Raticate | 17 | 17m | Slow ground | 2,200 | Blue |
| 5 | 3 Haunter or Gengar | 22 | 19m | Poison | 2,800 | Lavender |
| 6 | 2 Machamp or Primeape | 27 | 16m | None | 3,400 | Violet |
| 7 | 2 Ninetales | 32 | 19m | Fire | 4,200 | Dusky pink |
| 8 | 3 Golem | 38 | 16m | Slow ground | 5,400 | Crimson |
| 9 | 1 Gyarados | 44 | 22m | Poison | 6,500 | Deep red |
| 10 | 2 Venusaur | 50 | 18m | Poison, slow ground | 8,200 | Dark rose |
| 11 | 2 Charizard | 56 | 20m | Fire | 10,000 | Dark red |
| 12 | 2 Dragonite | 63 | 17m | Fire, slow ground | 12,500 | Burgundy |
| 13 | 1 Articuno | 70 | 18m | Slow ground | 16,000 | Dark plum |
| 14 | 2 Zapdos | 80 | 17m | Fire, poison | 20,000 | Near-black violet |
| 15 | 1 Mewtwo | 90 | 16m | Slow ground, poison, fire | 26,000 | Black |

The opening sites offer tiers 1 and 2. All former elite map sites are now tiered shrines. Each site keeps its species variant across retries and tier changes. Sites keep their tier while it is within the leader's level window. An outgrown, inactive site moves into that window. A completed site recharges for four minutes and advances one tier if the new tier is allowed. Failed trials retry after one minute at the same tier. Active encounters keep their original tier and reward multiplier.

Defeat every guardian within 60 seconds and stay inside the marked arena. HP and attack damage are authored per tier, rather than growing with elapsed time or the player's damage upgrades. The opening encounter targets 20–35 seconds with a special ability; later encounters target 15–45 seconds, with type matchups and builds affecting the result. A deterministic level-5 Charmander with rank-2 attacks, aimed specials and evasive movement clears the opening encounter at approximately 23 seconds when started at 2:00, without health assistance. This is a repeatable combat check, not a human difficulty measurement.

Hazard pockets show a pulsing warning for 1.25 seconds, activate for 1.75 seconds, and repeat every four seconds. They leave safe ground. Slow ground reduces grounded movement by 35%. Poison deals `4 + tier × 0.3` HP per second and fire deals `7 + tier × 0.3`. Jumping or dodging avoids ground damage. Companions can take ground damage too. All hazard geometry and damage use the same zone calculation.

Each guardian awards the XP of a normal Pokémon with the same species and combat rank, multiplied by `2 + (tier - 1) / 14`. The multiplier then increases or decreases by 2.5% per level of difference at entry, capped at ±25%. A shrine ten levels above the leader awards 25% extra; one ten levels below awards 25% less. The usual instant/drop split applies once. The final guardian also awards one squad-training reward, a relic, +4% luck and a special reset. Retreat or expiry removes the remaining guardians and their attacks without granting completion rewards.

The sculptures use shared, static mesh geometry. Species have distinct carved silhouettes; dust and hazard meshes share source geometry. Restarting the world releases these resources.
