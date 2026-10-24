# Starter balance audit

For concrete follow-up changes, see the [three balance proposals and recommendation](STARTER_BALANCE_PROPOSALS/README.md). They compare conservative tuning, targeted kit redesigns, and a shared damage-budget system without applying gameplay changes.

**Audited October 24, 2026, against the current working tree, including existing uncommitted gameplay changes.** This is an evaluation of all 17 selectable starters and their evolution branches. Gameplay tuning was not changed. Exact tables and reproducible measurements are in [STARTER_AUDIT_DATA.md](STARTER_AUDIT_DATA.md); regenerate them with `node --experimental-strip-types scripts/starter-audit.mjs`.

The roster has substantial differences in real combat strength. **Bulbasaur and Growlithe have especially efficient early kits; Zubat is the strongest starting close-range damage dealer; Sandshrew is an exceptional forward crowd clearer. Squirtle/Blastoise and Eevee/Vaporeon have the strongest measured evolved single-target output. Vulpix has a reproducible upgrade regression, Gastly has a severe positioning constraint, and Magikarp's hardship is much larger than its eventual damage payoff.**

The ratings below are design judgments from damage, health, geometry, control, mobility, progression and build compatibility. They are not measured human win rates. A means broadly strong, B means useful with meaningful tradeoffs, C means comparatively weak or demanding, and D/F identify serious reliability or deliberate challenge concerns. A specialist can outperform an A-rated generalist in its preferred encounter.

| Starter | Starting strength | Evolved outlook | Main reason |
| --- | --- | --- | --- |
| Bulbasaur | A | A | Strong instant damage at 17.5m, piercing lanes, persistent Q control |
| Charmander | B; A at close range | A against large targets | Three-flame overlap drives damage; distant small targets catch one flame |
| Squirtle | B | A+, outstanding damage | Safe homing attack, team soak, pushback; Blastoise adds a huge projectile advantage |
| Caterpie | C for primary damage; B for control | B, strong control and Q | Guaranteed slow and electric Q; later stun and piercing |
| Pidgey | B | B+, strong crowd control | Gust piercing, repeated knockback and flight compensate for weak single-target opening |
| Pikachu | A for early crowd combat | B; weaker isolated bosses | Reliable chains, stun and Run-up; Q hits a lone enemy only once |
| Sandshrew | A against forward crowds | A for crowds; B for bosses | Wide instant coverage, slow and long burrow invulnerability |
| Vulpix | B- before the regression | D for reliable general use until repaired | Rank-6 wider orbit misses common isolated small enemies entirely |
| Zubat | A at close range | B+ | 46 opening DPS, extra HP and flight; loses its Normal attack on evolution |
| Oddish | B, good support | A for support and area damage | Poison/slow clouds, Q healing and repeated stun; later multiple pods |
| Meowth | B+ | B+ | Reliable first shot, bouncing crowd damage and focused Q; weaker distant coin overlap |
| Growlithe | A | A-, strong generalist | Safe 11.25m instant bite lane, broad hit coverage and powerful fire-trail Q |
| Abra | B+ | A | Long crossing beams, excellent eventual damage and strong repositioning Q |
| Machop | B; A when comfortably close | A for close damage; B when fighting at maximum reach | Combo output scales hard, but outer acquisition range loses most combo hits |
| Gastly | C for reliable general use | C, strong only with careful orbit positioning | Damage lives on a thin ring; enemies inside the ring are untouched |
| Magikarp | F by normal starter standards | B for durability/coverage; C relative to its hardship | Extremely weak opening; Gyarados has great base stats but modest signature throughput |
| Eevee | A | A+ through Vaporeon; other branches are tradeoffs | Accurate Swift, strong rank growth, branch choice; water branch dominates raw single-target damage |

## How the measurements were made

The audit uses production `executePattern`, `stepProjectiles`, `castSpecial`, `stepSpecials`, `memberDamage` and `attackInterval`. It resolves a complete cast, including every projectile and pulse, then divides primary damage by its exact cast interval. That avoids conflating startup delay or flight time with sustained throughput.

There are five controlled arrangements: one small enemy at 3m, one at 8m, one boss-sized enemy at 8m, twelve small enemies in a forward grid, and twelve around a 3m ring. Small size 0.8 is an actual size used by Caterpie, Weedle and Rattata enemies. Boss size 4.4 comes from the production boss spawn. Target HP is effectively unlimited. Knockback still applies during each cast. Q dashes and lances assume an unobstructed path.

These are geometry samples, not averages over maps or moving formations. Primary numbers exclude critical hits, damage over time, type matchups, items and team bonuses. This makes hit delivery and stat budgets comparable. Those additional factors are evaluated separately below. The 3m sample deliberately favors close combat; the 8m sample exposes reach and spread limitations. Neither column alone is an overall ranking.

The audit covers 87 species/rank/level profiles across the five primary and five Q arrangements, plus targeted probes. Fifty-three comparisons also run the complete `Simulation` primary-damage path and agree with the isolated harness. The Vulpix failure was repeated at 0.01s, 1/60s, 0.025s and the simulation's 0.04s maximum step.

Source SHA-256 fingerprints, all profiles, individual fixture results, learnable move lists and probes are retained in local `artifacts/starter-audit.json`. The generated Markdown tables are versionable. No full human runs or human survival-rate measurements were performed.

## The stat rules that actually determine strength

These are original arcade stats, not cartridge Pokémon base stats. Attack, Special Attack, Speed, abilities such as Overgrow/Blaze/Torrent, STAB and canonical immunities are not implemented as the main-series systems. A species name or lore does not grant an undocumented passive.

**Health and defense.** Starting leader HP is `96 × species.health`. Most three-stage starters have 96 HP; two-stage starters have 105.6; Magikarp has 67.2. The leader's party record also starts with `132 × health`, but combat defeat is determined by `state.player.hp`. Those pools must not be added together. Recruited followers have a separate, larger starting HP budget and different incoming-damage treatment, so a follower rating is not interchangeable with a starter rating.

Defense subtracts a flat amount from each incoming hit: `max(0, incoming damage − species.defense × (1 + defense bonuses))`. It is not a percentage reduction. Against a raw 20-damage hit, a 96-HP Bulbasaur with 1.76 defense has about 105.3 effective HP; a 105.6-HP two-stage starter with 1.88 defense has about 116.6; Magikarp has about 68.9. Differences of 0.1–0.2 base defense are small compared with health, spacing, control and invulnerability.

Incoming player damage does not run through the outgoing Pokémon type chart. A Water starter does not receive a general defensive resistance to Fire damage, and Poison typing does not itself prevent player poison. Species types still affect offensive matchups and team synergies.

All starters share **7.3m/s base movement speed** before traits, terrain and upgrades. A normal dodge travels at 17m/s for 0.24s, grants 0.34s invulnerability, starts with one charge and has a 2.8s base recharge. These shared defenses matter more than tiny differences in base defense; the special movement exceptions are evaluated individually below.

**Primary damage.** The actual formula before critical hits and matchups is:

```text
hit = (species.power + 9)
    × [1 + 0.02 × (personal level − 1)]
    × [1 + 0.20 × (signature rank − 1)]
    × (1 + additive power bonuses)
    × resolved attack-profile damageScale

interval = profile.cooldown
         / (1 + attack-speed bonuses)
         / [1 + 0.08 × (signature rank − 1)]
```

Each profile also multiplies damage by `1 + 0.12 × (species.stage − 1)`. Slash profiles receive **+25% damage and reach/area**. Stage-one bolt, beam, lob and chain profiles receive **−20% damage**. That difference gives hybrids such as Bulbasaur's long vine and Growlithe's long bite a meaningful budget advantage. Sandshrew's instant ground wave uses `burst`, so it avoids the stage-one ranged penalty without receiving the slash multiplier.

The per-family `growth.damage` values are not an additional damage-growth system: `memberDamage` ignores that argument and uses the shared percentage formula. Rating one signature above another because its data says growth damage 4.5 rather than 3.0 would be incorrect.

Without a mechanical breakpoint, rank 1→2 increases primary DPS by `1.20 × 1.08 = 1.296`, or 29.6%. Rank 8 has 3.744 times the rank-one throughput before extra projectiles, combo hits or evolution. The latter changes create much larger differences.

Every starter has the same baseline 5% critical chance and 1.85× critical multiplier. The expected baseline direct-damage multiplier is 1.0425. Q does not roll these critical hits. Critical tiers can grow beyond 100% through the shared build system.

**Specials.** Every starter Q has a 16s base cooldown, with an initial ready cast. Its shared base damage is `(32 + 2 × (signature rank − 1)) × level multiplier × (1 + power) × (1 + specialPower)`. Each special then supplies its own scaling and geometry. Species base power is absent from that shared Q formula. Signature training also trains Q; there is no separate Q rank choice.

Attack speed speeds automatic and learned attacks. Special recharge uses `specialHaste` separately. All Q casts grant at least 0.4s of invulnerability to their caster, so even modest-damage Q abilities have defensive value. Rank growth is much less uniform for Q: some specials add hits on the same enemy, while others add coverage across different enemies.

**Statuses.** Burn deals 4 HP/s for 3s; poison deals 2.6 HP/s for 4s. They refresh one timer rather than adding a new independent damage stack per hit. Guaranteed slow lasts 2.5s and reduces movement to 57%; stun lasts 0.7s; soak lasts 3.2s and makes Electric hits deal 35% more damage. Fire hits against poisoned enemies deal 18% more damage. These direct interactions exist independently of whether the named team synergy is active. Flat burn/poison remain useful in the opening, but become a small fraction of high-rank damage.

## Evaluation of each starter

### Bulbasaur — unusually efficient ranged melee hybrid

At 96 HP, power 11 and defense 1.76, its paper stats look modest. Its actual signature is a slash profile: 26.25 per hit every 0.95s, **27.63 single-target DPS at 17.5m**. It hits instantly and pierces two enemies per lane at rank one. That is both safer and substantially stronger against a distant small enemy than Charmander's 11.32 or Squirtle's 16 DPS.

Bramble Garden deals 83.2 direct damage over five pulses if an enemy remains inside, while repeatedly slowing the area. Planting it remotely lets the player move elsewhere. Rank 3 adds a second lane and rank 6 gives three lanes with four targets per lane; a shared visited set prevents multiple lanes from repeatedly hitting the same enemy. This keeps its boss scaling controlled while giving excellent crowd coverage.

Venusaur reaches **516.85 DPS at 8m** in the normalized level-30/rank-8 comparison, with 237 HP. Learned Solar Beam, Sludge Bomb and later Earthquake provide useful coverage. Grass/Poison offers several team-building routes, including Fire partners for range and poison/fire interactions. It has no special movement trait and loses damage against the fire-based map boss, but its safe, reliable opening makes it one of the best default choices. **Balance concern: decide whether this much reach should share the melee bonus and exemption from the ranged penalty.**

### Charmander — strong shotgun, weak distant small-target damage

It starts with 96 HP, power 14 and defense 1.70. Ember fires three straight flames. Each is only 8.832 damage, so catching all three at 3m gives **33.97 DPS**, but an isolated small enemy at 8m catches only the middle flame: **11.32 DPS**. A boss-sized target at that distance catches all three. Raw projectile count therefore substantially overstates ordinary ranged damage.

Flamethrower deals 89.6 direct damage over eight pulses at rank one, burns reliably, and can sweep a large forward crowd as the player repositions or changes aim. It offers very good damage for its cooldown when the cone remains on target. Automatic flame burn chance starts at 30%; rank 7 raises it to 55% and adds piercing. Rank 4's five-flame fan improves coverage, but does not automatically make all five flames connect with a small target.

Charizard is strong against large targets: **731.27 boss DPS at 8m**, compared with **243.76** against a small enemy there. Its evolved learnset is broad: Rock Slide, Dragon Pulse, Air Slash and Earthquake can fill weaknesses. Charizard has **no flight movement trait** despite its Flying type. It is a strong offensive choice for aggressive positioning, with pronounced target-size dependence rather than uniform ranged power.

### Squirtle — modest opening, extreme evolved projectile scaling

Squirtle has 96 HP, power 11 and defense 1.76. Bubble deals 14.4 every 0.9s: **16 DPS**. Its slow homing projectile is easier to deliver than a straight fan. The starting 0.9m splash is small; the forward grid does not happen to put another enemy inside it, so that fixture underestimates its value against tighter packs. Rank 2 enlarges splash, rank 5 adds a second bubble and rank 8 adds a third.

Surf deals 70.4 per enemy once, soaks, slows and pushes ordinary enemies by 4m. It is a dependable emergency corridor clear. Soak itself does not raise Squirtle's own damage, but is excellent with Electric followers. Learned Ice Beam, Blizzard, Water Pulse and coverage attacks make this a flexible family.

Blastoise starts with extra bubbles and gets **five homing splash projectiles at rank 8**, producing **1,870.49 DPS at 8m** in the evolved comparison. That is 6.33× Gyarados's signature output under the same level/rank conditions. This is the largest raw evolved damage outlier. **Balance concern: extra bubble count compounds with splash overlap, rank damage, attack speed and two evolution bonuses.** Its profile also advertises piercing, but the splash-resolution path destroys a bubble on its first explosion, so penetration does not provide the advertised continuation through a row.

### Caterpie — low primary damage, much better Q than its reputation suggests

Caterpie has 96 HP, power 13 and defense 1.72. String Shot is an instant Bug thread for **13.41 DPS**, hitting one enemy initially with guaranteed slow. It is a reliable control tool, but slower at generating kills than Bulbasaur and the high-damage melee starters. Rank 2 reaches two enemies; rank 5 reaches four; rank 7 adds a 45% stun chance.

The current Q is **Electroweb**, not the older documented Silk Snare. It fires five Electric threads with substantial piercing. Three hit the small 3m target for **105.6 damage**; all five hit the boss-sized 8m target for **176**. It therefore has much better isolated-boss Q damage than Pikachu, despite having much weaker basic damage. Electric coverage is especially useful against Moltres, while the Bug primary benefits against Mewtwo.

Butterfree keeps the binding-thread mechanic and gains 1.5s flight. At level 30/rank 8 it has **285.03 primary DPS**, with **743.52 boss Q damage per cast**, plus control and broad learned options including Air Slash, Bug Buzz, Psybeam and Shadow Ball. This is a playable control specialist rather than an efficient primary-damage starter. It should not be evaluated as a purely weak early Bug, but its primary damage is still significantly below the leading final forms.

### Pidgey — safety and crowd displacement over opening boss damage

Pidgey starts at 96 HP, power 12 and defense 1.74. Gust deals **13.75 DPS** to one small target, but pierces four enemies and pushes them by 1.6m. The forward crowd fixture takes **54.98 aggregate DPS**. Rank 3 improves knockback to 2.8m; ranks 5 and 8 add lanes. Since basic gusts are straight projectiles, moving enemies can evade them.

Whirlwind deals 51.2 once per enemy and pushes ordinary enemies by 6m in a widening corridor. It is more valuable for creating space than killing a lone boss. Two seconds of flight, with a 4s recharge after flight ends, materially improves routing and safety from ordinary ground contact/melee. Ranged attacks, explosions, bosses and Flying enemies remain threats.

Pidgeot has **306.08 DPS against a small enemy at 8m**, rising to **918.24** when all three wind lanes overlap a boss. Its small-target damage is restrained, but its crowd coverage and defense through displacement are strong. **Identity issue: both Gust and Whirlwind currently deal Normal damage**, because the family lacks a Flying-element override and resolves the species' first type. It gets no Flying matchup advantage from those attacks. This deserves an explicit design decision.

### Pikachu — excellent early routing and chains, weak isolated-boss Q

Despite being a familiar default starter, Pikachu uses the two-stage budget: **105.6 HP, power 15 and defense 1.88**. Thunder Shock deals 19.2 to the first enemy every 0.94s: **20.43 single-target DPS**. Three connected enemies receive progressively reduced damage with 0.81 falloff, for **50.37 aggregate DPS**. Instant delivery and a 16m acquisition range make the output reliable.

Thunder Circuit's six strikes must choose **different enemies**. Against one surviving boss it deals **33.6 total**, not 201.6, and does not return unused strikes to that boss. Its strength is clearing/stunning separated enemies. Run-up reaches +25% movement speed after sustained straight travel, or **9.125m/s** before other movement bonuses, but turns, stops, jumps, dodges and blocked movement reset it.

Raichu's run-up falls to +18%; its chains improve but isolated damage is only **281.93 DPS** in the evolved comparison. Water/Electric and additional Electric teammates are especially useful. Ground matchups weaken its primary. This remains a strong opening generalist and mobile crowd controller; its late isolated-target damage is below the leading families, and extra chain targets do not solve that weakness.

### Sandshrew — exceptional forward coverage and defensive utility

Sandshrew starts at **105.6 HP, power 15 and defense 1.90**. Sand Attack deals 24 every 1.15s, or **20.87 DPS**, in a broad 9m forward lane. It can hit up to sixteen enemies per lane and slows with 45% probability. All twelve forward-grid enemies are hit at rank one: **250.43 aggregate DPS**. That coverage advantage is much larger than its modest single-target number suggests.

Fissure creates five separate ruptures at increasing distances. Its scaling does not mean every rupture hits the same target. The 3m small enemy takes 28.8; the boss at 8m takes 32.256. The impressive later-rupture coefficients mostly reward placement and coverage, not universal boss burst.

Burrow makes the leader invulnerable for 0.8s, including against poison ticks, and travels at 9m/s. Sandshrew pays a longer **3.64s base stamina recharge**, versus 2.8s normally. Primary and learned casts stop while the leader is burrowed, so repeated burrowing costs offensive uptime. Sandslash keeps burrow but loses that extra recharge penalty. Its evolved **223.25 single-target DPS** is low, but forward crowd damage and safety remain excellent. Ground's Fire advantage is partly offset by Moltres's Flying resistance: the actual multiplier is **0.935**, not a clean advantage.

### Vulpix — upgrade reliability must be repaired before numerical tuning

Vulpix starts at 105.6 HP, power 15 and defense 1.90. Two targeted flames orbit and spiral into the chosen enemy, dealing **15.13 direct DPS** if both connect, plus potential burn. Rank 3 adds a third flame. Defensive Ninefold Foxfire supplies five non-homing orbiters around the caster; it deals **168** if a small enemy intersects all five, but zero to the isolated 8m fixture.

**At rank 6 the primary orbit expands from 2m to 2.8m while lifetime stays 1.5s.** Its final radius is approximately `2.8 × exp(−0.75 × 1.5) = 0.909m`. For a size-0.8 enemy, collision allowance is `0.3 + 0.75 × 0.8 = 0.9m`. The flames expire outside the target. The audit reproduces a fall from **53.91 DPS at rank 5 to zero at rank 6** against an isolated stationary common small enemy. Size 0.85 enemies are just large enough to be hit. Large bosses are unaffected. Target movement can change swept collisions, so this is a demonstrated reliability regression rather than a claim that every moving small enemy always takes zero damage.

The same failure occurs for Ninetales. A +50% area bonus also makes rank-one flames fail against the size-0.8 target, because it enlarges the orbit without increasing time to converge. This means an ostensibly beneficial upgrade can remove damage. Q's fixed ring also has an inner blind spot, and each projectile can hit each enemy only once; four seconds of orbit does not mean four seconds of repeated hits on one enemy.

Until convergence and area scaling are made safe, its average practical reliability is below what its data suggests. After that fix, reassess fire support, burn and its defensive ring without compensating for the bug through inflated damage.

### Zubat — strongest opening close damage, plus better health and flight

Zubat has **105.6 HP, power 15 and defense 1.90**. Bite uses the generic slash with the melee bonus: **34.5 per hit every 0.75s, or 46 DPS**, with a 6.75m acquisition range. That exceeds Machop's 34.74 opening combo DPS by 32.4%, while Zubat also has 10% more HP and 1.5s flight.

Bite's sweep reaches 5.625m, but the generic slash commitment guarantees one hit on the selected target out to the 6.75m acquisition range. This makes Zubat less sensitive to the outer-range problem that removes Machop's extra combo strikes. Wing Attack deals 48 over two close forward hits and uses Flying damage. The starting Bite is explicitly **Normal**, so it does not inflict a poison burst.

Golbat's primary becomes **Poison** and gains the normal Poison status proc despite its Leech Life name. It does not drain health. Its **492.07 normalized DPS** and retained flight make it useful, but no longer the close-damage leader. The element change also makes it worse into Poison/Ground enemies. **Balance concern: Zubat currently combines the strongest immediate close damage with extra health and specialized traversal, while its more melee-focused competitors pay larger early tradeoffs.**

### Oddish — weak raw opening, valuable healing and area control

Oddish starts at 96 HP, power 13 and defense 1.72. Its pod deals **11.31 DPS** to one enemy, with a 2.8m blast, 70% poison and 60% slow. It deals **67.89 aggregate direct DPS** in the forward grid, before poison. Its basic move's Absorb/Mega Drain names do not grant self-healing.

Sleep Powder deals 33.6 direct damage over three pulses and repeatedly stuns/slows the cloud. It also heals **10.5 HP per living member per cast**, independent of whether enemies remain in the cloud. At four living members that is up to 42 total party HP per cast, before overheal. Damage, power and Wise Glasses do not multiply this healing. At rank 8 it provides five heals of 7 HP, or **35 HP per member**, while maintaining its control role. Famine suppresses this healing.

Additional pods at ranks 4 and 7 improve damage and crowd distribution, and all three can converge on a lone target. Vileplume reaches **721.47 normalized single-target DPS** and has 237 HP. Poison and Grass typings also enable several team synergies. It lacks special mobility and is less explosive early, but becomes one of the strongest support-oriented all-rounders. A purely opening-DPS tier list would significantly underrate it.

### Meowth — steady ranged opening, useful crowd bounces and focused Q

Meowth has 105.6 HP, power 15 and defense 1.88. Pay Day deals **20.27 DPS** to the first enemy. The initial extra bounce raises two-target total to **37.29 DPS**, with 0.84 damage retention per bounce. A coin cannot revisit an already hit enemy, so bounces improve crowd throughput rather than isolated-boss DPS. Rank 2 adds another bounce, rank 5 reaches four bounces, and rank 8 adds a second coin.

The current Q is **Fury Swipes**, not a Pay Day volley. It deals **105.6** to an aimed nearby enemy over three hits, can switch after a kill, and reaches five hits by rank 7. It concentrates damage better than Pikachu's Q, but has a shorter reach and gives no additional healing, traversal or crowd control by itself.

Persian reaches **559.48 DPS at 3m or against a large 8m boss**, but only **279.74** against a small target at 8m because the offset second coin misses. Normal damage has no favorable multipliers in this arcade table, but also no authored offensive resistance row, so it is dependable. Learned Water Pulse, Shock Wave, Shadow Ball and other coverage are valuable. It is a solid, understandable generalist with less defensive utility than the strongest starters.

### Growlithe — strong safe bite and an unusually productive Q

Growlithe starts with 105.6 HP, power 15 and defense 1.88. Its instant Bite lane delivers **27.39 DPS at 11.25m**. Unlike a true melee lunge, the automatic pounce mechanic does not move the caster: it sweeps the line to the target and pushes enemies. This supplies considerable safety while retaining the melee bonus. Multiple enemies along the approach can each take full damage.

Flame Charge does move the caster along a collision-aware path. The initial pass deals a full shared Q base hit, then the trail supplies five burning pulses. A stationary enemy remaining on the clear path takes **120 direct damage** at rank one. The full forward grid takes 1,440. Real scenery and enemies leaving the trail reduce that ideal total. It is still a powerful combination of escape, area damage and guaranteed burn.

Rank 6 adds a 65% follow-up Bite on the selected enemy. Arcanine changes the primary to Fire, adds burn and reaches **480.35 normalized single-target DPS**. Dragon attacks and broad fire/grass/poison synergies give build options. This is an especially efficient starter before evolution. Its later evolution and smaller final health budget are meaningful limitations, but its opening safety and damage are already strong.

### Abra — long piercing damage, movement that changes on evolution

Abra starts at 96 HP, power 12 and defense 1.74. Two crossing beams give **17.42 DPS at 18m** with good line penetration. Their converging origins help land both on the selected target; their additional paths also hit surrounding lines. Rank 4 improves piercing and rank 7 adds another pair, a major damage breakpoint.

Shift teleports Abra approximately **5.51m** in its movement direction, subject to world collision, with normal stamina recharge. Teleport Lance Q fires and moves along a collision-limited line for **89.6 direct damage**, with guaranteed stun. It lands at the resolved endpoint in front of the caster; it is not a guaranteed blink backward to safety. Aim and terrain therefore matter.

Alakazam reaches **775.91 normalized single-target DPS** and 237 HP. Its Psychic damage is resisted by Mewtwo at 0.65×, so neutral laboratory output overstates that matchup; Shadow Ball and other learned coverage can help. **Kadabra and Alakazam lose Abra's special Shift teleport**, because that movement trait is assigned only to species 63, while the Q teleport remains. A strong, safe ranged family overall, with evolution changing movement as well as damage.

### Machop — excellent scaling when every combo hit can reach

Machop has 96 HP, power 13 and defense 1.72. Its two 16.5-damage chops give **34.74 DPS** when the target is within the 5.625m sweep. Rank 3 adds a third hit, rank 5 adds pushback and rank 8 adds a fourth. Those extra hits also make it a strong on-hit build user.

The important limitation is that its **6.75m acquisition range exceeds its combo area**. A target at 6m receives only the generic selected-target fallback hit: **17.37 DPS**, half the expected opening combo. At rank 8 the outer 8m target receives only one of four hits, **65.03 DPS versus 260.11 at 3m** before evolution. This is a large practical loss at an apparently valid targeting distance.

Close Combat Q deals 105.6 over three forward strikes and knocks enemies away on the final hit. Unlike Fury Swipes, it can hit several enemies in the cone. Machamp reaches **1,181.36 DPS when all four chops connect**, but only **295.34 at 8m**, with 237 HP. Fighting is useful against common Normal enemies, but is reduced to 0.65× against Mewtwo. Earthquake, Fire Blast and Rock Slide can help coverage. It is a high-damage specialist, but the attack-range/combo-area mismatch should be resolved or made explicit before ranking it solely by maximum DPS.

### Gastly — useful hex, severe ring-positioning requirement

Gastly has 96 HP, power 14 and defense 1.70. Lick spawns two owner-centered wisps on a **3m ring**, lasting 2.2s with a 2s base cast interval. The two wisps give **16.1 direct DPS** against a small enemy on that ring, with poison/slow chances and multiple distinct-enemy hits. A wisp cannot repeatedly hit the same enemy during its lifetime.

The signature does **zero damage** to the isolated small targets at 1m, 2m, 4m, 5m, 6m or 7m in the rank-one probes. Acquisition range is 8m, but it is not damage reach. **Rank 2 expands the ring to 4m and removes the damage against the previous 3m target.** Radius bonuses further move the useful band outward. Movement can sweep the ring across enemies, but enemies already beside the player are not protected against by the wisps.

Haunting Hex is much more dependable: 83.2 direct damage after a 1s delay, plus guaranteed poison/slow in the selected area. Ghost gets 1.7× damage against Mewtwo and is reduced against Normal enemies. Gengar has strong statistics and rank-seven extra wisps, but the normalized 3m ring fixture sits inside its widened ring and takes zero automatic damage. It gains no special movement trait or Ghost defensive immunity. This is a demanding positioning specialist whose close-contact failure is much larger than its aura-like presentation suggests. It needs a clear mechanical decision about inner protection, convergence or alternate targeting before a simple damage buff.

### Magikarp — deliberate challenge with insufficient automatic-damage payoff

Magikarp starts with **67.2 HP, power 4 and defense 0.5**. Tackle deals 8.125 every 1.25s: **6.5 DPS**, to one enemy, with only **3.375m acquisition reach**. It receives no Water soak because both Tackle and Flail explicitly use Normal. Its only cached learned move is Tackle, which is filtered out as its existing signature: **it cannot gain an independent learned attack before evolving**.

Flail deals **17.92** across two hits at full HP. Its missing-health multiplier is linear, reaching 35.84 at half HP and approaching 53.76 near zero. That is a small reward for operating with a tiny health budget. Splash leap helps escape ground enemies and scenery, but does not protect against ranged attacks or boss contact. It also does not grant a passive damage increase.

Evolution requires personal level 12 and 240s maturity, usually making level 15 the first eligible normal milestone. Weak opening damage also slows the XP needed to reach that gate. Gyarados gains exceptional base stats: power 29, defense 2.55, health factor 1.75, for **265.44 HP at level 30**. Its health multiplier from Magikarp is 2.5×, and its learned options become broad.

However, its single Hyper Beam gives only **295.34 normalized primary DPS**, compared with Blastoise's 1,870.49. Its Q is a useful piercing beam, but does not fix the automatic-damage gap. It also loses Splash leap and receives no replacement flight trait. The reward is excellent durability and coverage potential, not exceptional native damage. **If the intended bargain is a miserable opening followed by a dominant evolved carry, the current kit does not fulfill it.** Preserve it as an explicit challenge or strengthen its payoff after the high-impact geometry issues are fixed.

### Eevee — strong base kit, sharply unequal evolution branches

Eevee starts with 105.6 HP, power 15 and defense 1.88. Two accurate Swift stars deal **25.6 DPS** against a lone enemy; with several enemies they seek separate targets. Rank 3 adds a third, rank 6 adds a fourth and piercing, and rank 8 gives six. Homing makes those count increases much more reliable than widening a straight flame fan.

Quick Attack deals 41.6 along its collision-aware dash path and is a useful repositioning tool. The base version does not fire a bonus volley. Eevee itself has no Run-up; only Jolteon acquires it. Fighting/Normal teams can add attack speed, while learned Shadow Ball and other coverage address the limited element identity.

**Vaporeon is the strongest raw-damage branch**: multiple homing splash bubbles give **1,366.49 normalized single-target DPS** plus a better Surf-style Q. Jolteon gives **290.74 DPS**, longer chains, Electric team support and +18% Run-up, but its Q retains the one-hit-per-enemy restriction. Flareon gives **504.55 DPS against a close enemy or large boss**, falling to **168.18** against the small 8m target; its orbiting Q guards nearby space.

The imbalance is visible even in a before/after evolution comparison that includes the granted rank. At level 35, Eevee rank 8 delivers **483.07 DPS** to a neutral small enemy at 8m. Evolving to rank-9 Vaporeon raises it to **1,654.77**; rank-9 Jolteon drops it to **352.08**; rank-9 Flareon drops it to **203.66** there. New matchup advantages, control and movement may justify choosing the latter branches, but evolution is not an automatic single-target damage increase. Branch previews should reflect these tradeoffs.

## Progression, teammates and builds change the practical ranking

**Evolution timing is part of the cost.** Three-stage lines use personal-level gates 5 and 10, with 170s maturity after joining and again after evolving. Two-stage lines require level 12 and 240s. Since normal milestone choices occur at levels 3, 5, 10, 15, etc., the level-12 requirement normally resolves at level 15; reaching an HP/power gate alone does not instantly evolve the Pokémon. Evolution must be selected and stops being offered from personal level 45. Stones and trade adaptations are named cards, not extra consumables or an external service.

Each evolution changes base power/defense, scales max and current HP by the species health ratio, adds +25% additive power and grants +1 rank to all known moves. Two evolutions therefore supply +50% additive power, not `1.25²`, plus two free move ranks. Three-stage final health factor is 1.5625 versus 1.375 for ordinary two-stage final forms. Evolving into stage 2 also removes the first-stage ranged damage penalty, which gives ranged families a particularly large first evolution spike.

The level-30/rank-8 final-form table controls level, signature rank and the seven milestone choices needed for signature training/evolution. It deliberately does not control elapsed time, nor model alternative stat/learned-move purchases. Opening kill speed, deaths, discoveries and different maturity gates can keep an actual run far from that state.

**Learned attacks are independent damage sources.** Extra slots open at personal levels 10, 20 and 30; move-specific minimum levels can be lower but do not bypass those slot gates. A new move is an occasional offer, not a guaranteed attack at the slot-unlock level. Each learned attack has its own cooldown, shares relevant power/haste/range/critical bonuses and receives ranks on evolution. Its base power comes from the move, so species base power does not determine its damage. Learning coverage can therefore matter more than small species-stat differences.

The early Caterpie/Metapod family is particularly limited until Butterfree's much broader pool, and Magikarp has none before evolution. Squirtle, Charmander, Sandshrew and Machop have especially broad coverage choices. Oddish's pool is narrower but its existing control/heal kit reduces the need to solve every weakness with another attack. None of these families receives the single-stage mastery bonus: all starters have evolution paths.

**Followers dilute a starter-only late-game ranking.** The first follower is time-gated at 165s plus its level requirement. Recruitment checks use squad progression; evolution checks use the individual's level. All living members get full shared XP, so recruits do not divide an XP pool. Followers also use their own automatic attacks and automatically cast their Q specials. Defensive movement traits apply to the leader, while offensive species kits and support Q abilities can be obtained through recruitment. Oddish's support, for example, can be valuable without choosing Oddish as the original leader.

**Unlock difficulty does not track raw power.** A fresh save has Bulbasaur, Charmander, Squirtle and Pikachu. Surviving 3 minutes unlocks Pidgey/Sandshrew; four living members unlock Oddish/Meowth; four discoveries in a run unlock Vulpix/Growlithe/Magikarp; evolving the leader and a follower unlocks Abra/Machop; reaching 15 minutes with two living Poison members unlocks Zubat/Gastly; 100 cumulative Rocket defeats unlock Eevee; defeating a map boss unlocks Caterpie. These are finite partner unlocks, not permanent stat bonuses. Caterpie's relatively demanding unlock buys a control/electric-Q playstyle rather than a stronger basic attack; Magikarp is an explicit hardship option alongside much stronger rewards from the same achievement.

**Build compatibility is uneven.** Loaded Dice doubles rank-one Squirtle's small-target damage, while adding only 50% to two-star Eevee or two-lance Abra, and no isolated-target damage to a visited-set vine lane. Extra chain targets do not add boss hits; extra ricochet bounces cannot revisit a boss. Additional flame-fan projectiles may miss a small target entirely. In contrast, multiple bubbles can all explode on the same target. These asymmetries compound through repeated relic copies.

Fast casts and multi-hit attacks are different advantages. Big Root and Power Herb count casts; King's Rock and Metronome react to hits. Machop combos, Eevee stars and Blastoise bubbles are powerful same-target hit streams; chain/ricochet builds can keep resetting Metronome by changing targets. Q hits can trigger on-hit effects but do not roll normal critical strikes. Heal Bell supplies healing on Q use and can reduce the uniqueness of Oddish's sustain in a developed build, though the support timing and control still differ.

**Some currently offerable relics have no immediate benefit for a solo starter.** The audit confirms that solo Magikarp is offered both Loaded Dice and Drill Run, although its one-target Tackle and Flail use neither projectile count nor piercing. Solo Squirtle is offered Drill Run even though bubbles explode and expire before penetration can continue. These become useful after recruiting or changing moves, but that contradicts the item eligibility code's stated goal of improving the current build. This is a concrete upgrade-quality problem, particularly for an already disadvantaged Magikarp opening.

**Synergy classification has an important inconsistency.** Team attack-kind requirements currently read `getSpecies(id).attack`, while actual combat can use `getAttackProfile(id).kind`. Bulbasaur is catalogued as lob but fights with slash, Charizard is catalogued as burst but fires bolts, and Ninetales is catalogued as burst but uses orbiting bolts. As a result, Wide Front and Critical Volley can classify a member differently from its active mechanics. Elemental team synergies still use species types. This mismatch should be resolved before balancing teams around the displayed combat roles.

## Findings to address, in order

1. **Repair beneficial upgrades that remove Vulpix/Ninetales hits.** Ensure targeted orbiters converge before expiry for every supported enemy size and area multiplier. Preserve the crowd-orbit identity; do not hide the problem behind more damage. Validate rank 5→6, common size-0.8 targets, movement, area bonuses and normal simulation step sizes.
2. **Decide the intended inner coverage for Gastly's wisps.** The current ring is a specialist positional weapon, not protection against adjacent enemies. Either make that tradeoff clear and rewarding or change delivery so range/rank upgrades do not abandon enemies already in contact.
3. **Align combo acquisition and hit delivery.** Machop can select an enemy while only a fallback hit reaches it; rank 8 can lose 75% of its expected combo. Make effective reach truthful without accidentally adding free repeated hits outside intended geometry.
4. **Audit real scaling before applying flat damage buffs.** Blastoise and Vaporeon's homing splash counts, Eevee's accurate star growth, and Machop's combo counts dominate later throughput. Gyarados has high stats but no comparable multiplier. Balance representative rank/evolution states and both small/large targets, rather than equalizing rank-one damage alone.
5. **Review early risk/reward.** Zubat has more opening close DPS, health and traversal than Machop. Bulbasaur and Growlithe get melee multipliers at substantial safe reach. Sandshrew gets enormous forward coverage and burrow. Check whether their existing constraints actually pay for those benefits before increasing weaker starters globally.
6. **Make special totals and evolution tradeoffs truthful.** Thunder Circuit's six strikes are six distinct targets; Fissure's ruptures occupy different places; Foxfire hits each enemy at most once per projectile; Jolteon/Flareon can reduce Eevee's small-target damage even after the evolution rank bonus.
7. **Resolve element, synergy and item eligibility inconsistencies.** Choose Pidgey's intended attack elements; use a consistent source for actual attack-kind synergies; avoid offering/advertising piercing benefits that the bubble splash path cannot use, and projectile/pierce relics for solo Magikarp's non-projectile kit. Update older starter documentation for Electroweb, Fissure, Fury Swipes and the actual forward Teleport Lance behavior.

These are recommended follow-up changes, not tuning applied by this audit. Fix hit-delivery regressions first, then measure full runs with representative human movement and builds. Raw damage increases made before those fixes could leave repaired kits substantially overtuned.

## Validation and source map

- `node --experimental-strip-types scripts/starter-audit.mjs`: passed, including numerical contracts, effect expiry, the four-step-size Vulpix reproduction and 53 complete-Simulation primary comparisons.
- Focused starter/special/movement/learnset/progression tests: **67 passed, 0 failed**.
- `npm.cmd test`: **570 passed, 0 failed**. Local log: `artifacts/starter-audit-tests.log`.
- No browser or full human playtest was run; this audit changes only analysis documents and its local measurement script. The passing existing tests do not invalidate the new balance/reliability findings, because their coverage checks different invariants.

Primary code references: [species bands and roster](../src/data/kanto.ts), [authored signatures](../src/data/rosterContent.ts), [resolved attack multipliers](../src/data/attacks.ts), [damage and status rules](../src/game/combat/damage.ts), [geometry](../src/game/combat/patterns.ts), [projectile collision and orbit behavior](../src/game/combat/projectiles.ts), [Q profiles](../src/data/specials.ts), [Q execution](../src/game/combat/specials.ts), [simulation damage/health/automatic casting](../src/game/Simulation.ts), [progression tuning](../src/data/progression.ts), [choice and evolution rules](../src/game/systems/progression.ts), [movement traits](../src/data/movementTraits.ts), [movement execution](../src/game/systems/movement.ts), [learned moves](../src/data/moves.ts), [synergies](../src/data/synergies.ts), [build modifiers](../src/game/systems/builds.ts), [relics](../src/data/items.ts), [starter unlocks](../src/data/unlocks.ts), and [reproducible audit](../scripts/starter-audit.mjs).
