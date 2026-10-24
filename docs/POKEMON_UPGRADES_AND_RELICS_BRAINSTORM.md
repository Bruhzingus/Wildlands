# Pokémon upgrades and relics: a full-run brainstorm

October 24, 2026. **Design ideas only. No gameplay changes or balance results.**

The aim is to make an early investment develop into a recognizable late-game build. A good upgrade should help when acquired, interact with later choices, and retain a useful job against elites and bosses. It does not have to be equally good in every encounter.

“The whole game” here means the opening, the first 15-minute boss, and extended endless play. The recommendation is to preserve uncapped percentage training and move ranks, while keeping attack shapes and extra objects readable and finite.

## What the current game gives us

The current working-tree code is the baseline; some older reports describe superseded rules.

| Current behavior | Design implication |
| --- | --- |
| Personal levels stop at 100; choices happen at 3, 5 and every five levels thereafter. | Uncapped move ranks need a continuing reward source after personal milestones end. |
| A move rank adds 20% of initial damage and 8% of initial casting speed. Many signature shape changes finish around ranks 6–8. | Numerical growth already continues. Later upgrades should deepen an identity without requiring endless additional projectiles. |
| Each Pokémon has a signature and up to three learned moves, with learned slots at levels 10/20/30. | Early upgrades must work with the signature alone. Multi-move relics need eligibility checks. |
| Evolution and learning end before personal level 45. | A build must keep developing through training and relics after its roster and moves settle. |
| Most numeric relics stack; Team Battery is currently unique. Critical chance supports multiple tiers. | New copies should increase an effect's strength, with explicit stacking rules. Another copy should not create another recursive trigger chain. |
| Poison deals 2.6 damage/second and burn 4, irrespective of source power. | Status duration alone cannot sustain a damage-over-time build against growing enemy HP. |
| Endless has recurring bosses, restocking chests and repeat elite rewards. Elite rewards currently offer squad stats; shops offer items/stats. | Use these existing opportunities to keep move training available, rather than introducing another currency or an extra stream of menus. |

Sources: [progression data](../src/data/progression.ts), [reward generation](../src/game/systems/progression.ts), [relic definitions](../src/data/items.ts), [status damage](../src/game/combat/damage.ts), [simulation](../src/game/Simulation.ts), and [chest economy](../src/data/economy.ts).

The [Option B identities](STARTER_BALANCE_PROPOSALS/OPTION_B_IDENTITIES.md) are a separate, unimplemented proposal. Its delivery fixes and per-target budgets are useful references, but this brainstorm does not assume B's stats or coefficients are active. Fix inaccurate targeting, missed convergence and unusable relic offers before treating their repair as a new upgrade reward.

## The scaling rules I would build around

1. **Keep the percentage engine.** Damage, attack speed, HP, recharge and relevant move power continue increasing. Do not exchange earned attack speed for a different stat at a dispatch limit.
2. **Add identity through a few meaningful mechanics.** A focused chain, a heavy combo finisher, a persistent fissure or better poison delivery creates a build. Another generic damage multiplier rarely does.
3. **Make secondary damage follow its source.** Use the triggering move's power or a defined share of a native hit. Avoid new flat-damage explosions, flat healing and enemy-max-HP damage that bypasses build investment.
4. **Pay for delivery and safety.** Better focus can cost crowd coverage; a delayed strike can cost immediate damage; close-range damage requires exposure. A targeting repair is not payment for a buff.
5. **Stack strength, not callbacks.** Three copies add three copies' coefficients to one effect. They do not create three chains that trigger each other.
6. **Separate boss damage from crowd control.** A control build should retain source-scaled damage when a boss resists displacement. Do not solve boss relevance with permanent stun or an automatic execute.
7. **Show the scope.** Distinguish a named Pokémon's training, squad relics and leader-only dodge effects. A follower must not need a manual action it cannot perform.

An additive percentage still has value when its relative gain becomes smaller. At +100% existing power, another +15 percentage points changes 2.00× base damage to 2.15×, a 7.5% increase in current damage. That is expected additive growth, not a reason to silently turn later copies into compounded multipliers.

### Existing rank growth is already substantial

Ignoring shape changes, buffs, crits, travel and missed hits, the present rank rules imply:

`relative move DPS = [1 + 0.20 × (rank − 1)] × [1 + 0.08 × (rank − 1)]`

| Rank | Per-hit power | Cast rate | Combined theoretical output |
| ---: | ---: | ---: | ---: |
| 1 | 1.00× | 1.00× | 1.00× |
| 8 | 2.40× | 1.56× | 3.74× |
| 12 | 3.20× | 1.88× | 6.02× |
| 20 | 4.80× | 2.52× | 12.10× |
| 50 | 10.80× | 4.92× | 53.14× |

These are arithmetic illustrations, not measured DPS. They explain why adding another full-strength projectile every few ranks would quickly dominate subtler upgrades. Keep later numerical growth; use finite behavior changes to determine where that strength goes.

## How the build should develop

| Run phase | What choices should accomplish | Example |
| --- | --- | --- |
| Opening, roughly 0–3 minutes | Make the signature reliable and establish a preference. No required partner or learned move. | Machop hits harder up close; Bulbasaur invests in useful vine coverage. |
| First partners, roughly 3–7 minutes | Add a second role or exploit a status that the squad can actually apply. | Squirtle supplies soak for Pikachu; Oddish supports a close fighter. |
| Build formation, roughly 7–11 minutes | Choose focus versus coverage and start getting value from learned moves. | Abra concentrates its crossing beams; a second attack element enables Prism Charm. |
| Legendary approach, roughly 11–15 minutes | Improve elite/boss damage and sustain without making ordinary waves irrelevant. | Expert Belt supports boss pressure; a source-scaled poison build still contributes damage. |
| Endless | Keep existing moves trainable and repeat relics useful; test combinations under recurring bosses. | More finisher power, stronger poison or a larger shield, with bounded visual work. |

These are design goals, not time locks. Rarity does not automatically mean “late-game only,” and move rank is separate from personal level.

### Keep an endless path for move upgrades

My preferred first experiment is to extend existing rewards **during endless**:

- Elite/boss reward: one upgrade to an existing move of a named living member, plus two squad-stat alternatives.
- Supply chest: one eligible relic, one squad-stat card and one existing-move upgrade, while retaining the chest's rarity/value rules.
- Rotate eligible move owners so a late recruit can develop. Preserve evolution's higher-priority choice rules wherever applicable.

This changes reward composition, not reward frequency. A level-100 party can continue training moves through exploration and combat. It avoids requiring a new post-100 level system for the first prototype.

XP relics can retain a finite purpose and leave offers when no member benefits. “Scales throughout the game” should mean the combat build keeps growing, not that every utility item must remain selectable forever. If a permanent XP-to-training track is wanted later, design it separately against this simpler baseline.

## Pokémon upgrade ideas

These are alternative experiments, not a package of free buffs. Existing rank growth continues under every candidate. The starting approach should be authored signature milestones or replacements for existing milestones. A new branching skill-tree interface is not required.

| Family | Upgrade idea | What changes in play | Cost or boundary |
| --- | --- | --- | --- |
| **Bulbasaur → Venusaur** | **Bramble Lanes** | Vine lanes leave a brief damaging strip, letting the player herd enemies through the same corridor. Strip damage follows the vine cast's power. | Transfer part of the immediate hit budget into the strip. Same-cast overlapping lanes share a per-target budget. No extra healing aura. |
| **Charmander → Charizard** | **Burning Pressure** | Fire hits build a reliable, source-scaled burn. Sustained focus keeps pressure on a durable target while the fan handles crowds. | Trade some immediate damage for the burn. Multiple flames refresh one burn rather than independently multiplying it. Use the status rework below. |
| **Squirtle → Blastoise** | **Undertow** | Splash edges slow ordinary enemies, making bubble placement a useful setup for the squad. | Reduce direct bubble damage to pay for control. Keep soak distinct from slow. Extra bubbles improve coverage under an explicit same-cast repeat budget. |
| **Caterpie → Butterfree** | **Woven Net** | A silk line ends in a small slowing net, creating a temporary chokepoint instead of simply adding more stun rolls. | Fewer line pierces or lower immediate damage. The net's damage follows source power; boss relevance comes from damage, not immobilization. |
| **Pidgey → Pidgeot** | **Shearing Gust** | A gust leaves a short wind cut through its struck corridor, rewarding enemies remaining in its path after the initial push. | Move part of the gust damage into a brief delayed cut. Bosses can take the cut without being repeatedly pushed. |
| **Pikachu → Raichu** | **Closed Circuit** | If a chain runs out of new targets, a limited amount of unused chain strength returns to its first target. More reliable against isolated elites. | Weaker initial strike; finite returns, reduced repeat damage and no repeat stun/proc rolls. A worked version appears below. |
| **Sandshrew → Sandslash** | **Fault Memory** | A sand wave leaves a fissure that ruptures once after a short delay. Kiting across a previous lane becomes valuable. | Redistribute part of the original wave damage into the rupture. Extra lanes cannot multiply damage through one shared crossing point. |
| **Vulpix → Ninetales** | **Foxfire Focus** | Flames converge sooner on the selected enemy instead of spending as long sweeping a wide orbit. | Give up outer crowd coverage. First fix current convergence reliability; this is a deliberate narrower pattern, not payment to make basic targeting work. |
| **Zubat → Golbat** | **Leech Bite** | A successful native bite occasionally restores a percentage of the caster's own max HP, supporting a risky close-range role. | Lower bite damage and use one serialized internal cooldown. No heal per victim, crit tier or extra slash; a follower heals itself. Builds on B's optional candidate. |
| **Oddish → Vileplume** | **Cultivated Spores** | Pods prefer enemies not already poisoned. If no fresh enemy exists, remaining pods reinforce delivery without creating independent poison stacks. | Lower immediate pod damage. Source-scaled poison is required; refreshing the current flat poison is insufficient. Keep healing in the existing special. |
| **Meowth → Persian** | **Called Shot** | Ricochets prefer an unvisited elite within legal bounce reach, retaining more strength on that important bounce. | Sacrifice a bounce or ordinary-target damage. Keep the moving ricochet identity and existing target limits; no bonus coin economy. |
| **Growlithe → Arcanine** | **Hunting Lunge** | If the pounce's first victim dies, its already-earned follow-up bite can acquire a nearby survivor along the lane. | Narrower lane coverage. Preserve the existing strike count and total damage budget; no extra attack or free movement reset. |
| **Abra → Alakazam** | **Lens Focus** | Concentrate more of the crossing lances' total damage at the selected intersection, with weaker damage farther along their paths. | Lose line-clearing power for better focus. Extra beam visuals do not each become another full boss hit. |
| **Machop → Machamp** | **Finisher Form** | Shift combo damage toward the last strike, making a completed close engagement rewarding. | Less front-loaded damage; no automatic execute or percentage-of-enemy-HP hit. The finisher inherits the combo's source power. |
| **Gastly → Gengar** | **Roving Haunt** | Trade the broad defensive wisp perimeter for a tighter sweep directed toward the selected enemy. | Lose coverage behind the caster. Resolve the existing inner-ring coverage problem separately; this modifier should not be required to hit nearby foes. |
| **Magikarp → Gyarados** | **Surging Form** | Give Gyarados a choice of a focused beam profile or a broad weaker sweep, with both using the ranks earned as Magikarp. | Mutually exclusive geometry; no additional free evolution multiplier. Magikarp's opening still needs separate viability tuning. |
| **Eevee and branches** | **Stellar Focus / elemental specialization** | Unevolved Eevee can concentrate part of Swift's existing star budget on a priority target. Vaporeon, Jolteon and Flareon develop water, chain and burn identities respectively. | Less independent crowd coverage for focused Swift. Map any acquired modifier explicitly across evolution; do not erase its value or add a second free passive. |

For followers, attack modifiers use the follower's own position, rank and damage. Leader-only movement remains separate. Any evolution mapping needs an explicit rule before implementation, especially when Eevee changes attack family.

### Three upgrade prototypes worth comparing first

**Pikachu: Closed Circuit.** Trial values: reduce the native first-strike coefficient to 90% of its baseline. Each unused native jump may return 30% of that reduced first strike, with at most two returns. With two unused jumps, an isolated target receives `0.90 × (1 + 0.30 + 0.30) = 1.44` baseline hits. A target with no unused jumps receives 0.90. Returns consume existing chain opportunities, never bounce recursively, and apply no extra stun or relic proc. Initially exclude relic-added jumps from return conversion so Discharge cannot become a disguised unlimited boss multiplier. Rank/power/haste still strengthen the attack normally.

**Machop: Finisher Form.** Hold the full-combo damage budget constant and move a larger fraction into the final strike; for a four-hit combo, compare equal 25/25/25/25 weighting against 15/15/20/50. The second pattern rewards staying close long enough to finish and feels different without another global multiplier. Both patterns keep gaining damage and cadence from later ranks. Test small enemies and moving bosses: a finisher that regularly misses is a substantial cost.

**Oddish: Cultivated Spores.** First compare current pod targeting with deterministic unpoisoned-target priority, then tune a source-scaled poison version. Record native direct damage, poison damage and coverage separately. Do not simultaneously add unrestricted poison stacks, more pods and a regeneration aura; those changes would make the source of a balance difference impossible to identify.

## New relic shortlist

All values below are starting hypotheses. “+25% damage” means **+25 percentage points in the existing additive power calculation while eligible**, not multiplying current total damage by 1.25 per copy. Conditional damage relics share that convention.

Unless marked leader-only, these relics are squad-owned and evaluate each attacker independently. Copies add the stated numeric benefit to one rule. Proposed Legendary versions double the positive amount, keeping the same condition, duration and trigger count. No new family here grants extra independent critical rolls.

| Relic | First-copy idea | Why it can remain useful | Eligibility and stacking |
| --- | --- | --- | --- |
| **Expert Belt** | +25% native move damage against elites and bosses. | Helps optional guardians before the final boss and recurring threats later. Power investment continues contributing. | Require a damaging move. Copies add +25 points under the same condition. Ordinary enemies get no bonus. |
| **Impact Bracer** | +30% native move damage when the enemy is within 4m of its caster at impact. | Supports Machop, Zubat and close-range variants; stronger attacks retain the benefit. | Require a damaging move that can connect inside 4m. Copies add strength, not range. Ranged users can qualify by accepting exposure. |
| **Longshot Lens** | +25% native move damage when the enemy is more than 8m from its caster at impact. | Rewards maintaining distance instead of merely inflating reach. | Require an attack that can actually hit beyond 8m. Copies add strength. It never extends acquisition or collision range. |
| **Catalyst Stone** | +20% native direct damage against poisoned or burned enemies. | Turns reliable status coverage into pressure even after status uptime becomes high. | Require an available burn/poison source and direct damage. Copies add strength; two statuses do not double the condition. No effect on status ticks. |
| **Prism Charm** | +25% native direct damage if this caster's previous native cast to hit that enemy used a different element. | Gives independently trained learned moves a reason to coexist. | Require two damaging native move elements on one living member. Store the previous element per caster/target; same-cast extra hits cannot alternate it. Copies add strength. |
| **Relay Ribbon** | +20% native direct damage if a different living squad member hit that enemy within the previous 2 seconds. | Makes party composition and overlapping targeting valuable as the squad grows. | Require at least two living members capable of damage. One shared last-contributor record per target. No assist-triggered extra hit; copies add the conditional bonus. |
| **Reservoir Charm** | Casting a damaging special empowers that caster's next three automatic move casts with +30% native damage. | Creates a special-to-primary build distinct from Eruption's immediate burst. | Require a damaging special and automatic attack. A new special refreshes three charges rather than adding charges. Copies increase damage, not charges; misses consume a cast's charge. |
| **Guard Scale** | A manual dodge grants the leader a barrier equal to 5% of max HP for 3 seconds. | Scales with HP and rewards using a current defensive action. | Leader-only. Copies add barrier strength. New barriers replace the remainder rather than adding to it; expiry never converts to healing. Requires a new barrier mechanic. |
| **Anchor Stone** | +25% personal defense while at least one living enemy is within 4m. | Supports staying close rather than just acquiring more HP. Uses the current defense formula. | Evaluate each member's own position. Copies add defense points under the condition. No added deflection, invulnerability or follower aura. |
| **Mending Ribbon** | +20% healing received from Pokémon moves and specials. | Helps a deliberately chosen healer keep pace with growing max HP and pressure. | Require an active move/special healing source; suppress in No Healing. Exclude passive regeneration and relic-generated heals. Copies add to healing effectiveness; overheal creates nothing. |

These create different reasons to choose a relic. Expert Belt is weak against normal waves; Impact Bracer and Longshot Lens favor different positioning; Prism Charm needs move diversity; Relay Ribbon needs overlapping teammates. Test their rates of activation rather than assuming a conditional +30% is equivalent to an unconditional +30%.

### Two more ambitious relics to hold for a later pass

**Spillstone:** a native killing hit sends 20% of its overkill damage to one different enemy within 4m. Extra copies increase that fraction. It is a crowd-clearing alternative to Blast Seed, with little value against an isolated boss. It needs reliable pre-overkill damage, target-specific damage accounting and strict exclusion of all secondary hits from new item/kill triggers. Test before adopting; clearing weak adds must not create an accidental boss one-shot engine.

**Vitality Prism:** store 15% of effective HP restored by Pokémon healing moves as bonus damage for the healed recipient's next native attack. Copies increase the conversion fraction. Excess healing stores nothing; one pending amount per recipient replaces an unbounded event list. This could give a support-heavy squad offense, but should wait until healing attribution and the barrier/status foundations are stable. Its release consumes the stored value once, never once per projectile or victim, and cannot produce more healing or relic effects.

I would start with **Expert Belt, Impact Bracer, Catalyst Stone and Relay Ribbon**. They cover boss hunting, close combat, status setup and teamwork without requiring another control or resource. Guard Scale is a stronger follow-up experiment if a visible barrier is worth the added system.

## The status change that makes the poison/fire builds credible

The current fixed 2.6/4 damage per second is the clearest scaling gap. Longer duration helps uptime, but cannot make a fixed tick competitive with enemy HP growing over a long run.

Recommended first experiment:

- Each burn/poison snapshots a **noncritical source-move power multiplier** when applied. Include relevant level, rank, evolution and damage investment, without projectile counts, extra victims or critical tiers.
- Multiply a calibrated starting tick by that multiplier. A source whose relevant power grows tenfold should produce roughly tenfold tick damage, before any separately chosen status bonuses.
- Preserve a stable reference across evolution and save/restore; learning or evolving must not reset the reference to the current stronger power. Tune starting potency against the current 2.6/4 DPS before evaluating late output.
- Keep one active potency per status per enemy for the initial prototype. A stronger application replaces potency and ownership; a weaker one may refresh duration but cannot steal damage attribution or lower potency.
- Refresh remaining duration using the existing maximum/refresh model. Do not accumulate unlimited future ticks every time a multihit attack lands.
- Do not let tick damage crit again, trigger on-hit relics or reapply itself. A legitimate death still resolves once with its proper owner and loot.

This produces a clear baseline before considering per-caster stacks or a new status multiplier relic. It also makes the limitation of multiple poison specialists explicit: they can spread coverage, but do not multiply one boss's poison damage merely by existing.

Control remains useful through coverage, duration and damage delivery. It does not require increasing slow beyond its physical limit or bypassing every boss resistance.

## A few build directions these ideas enable

| Build | Pokémon/upgrades | Relics to look for | Desired strength and limitation |
| --- | --- | --- | --- |
| **Close finisher** | Machop's Finisher Form; Oddish supplies recovery. | Impact Bracer, Anchor Stone, Mending Ribbon. | Strong sustained close engagement; interrupted combos and ranged pressure remain dangerous. |
| **Storm partnership** | Squirtle supplies soak; Pikachu chooses better isolated-target conversion. | Relay Ribbon, Expert Belt; existing Zap Plate. | Water/Electric teamwork with a boss contribution; repeat strikes must not multiply proc opportunities. |
| **Venom garden** | Oddish spreads source-scaled poison; Bulbasaur shapes approaching crowds. | Catalyst Stone; existing Binding Band. | Strong sustained coverage and positioning; shared poison potency prevents free multiplication from duplicate healers. |
| **Precision artillery** | Abra's Lens Focus plus a legal second-element learned move. | Longshot Lens, Prism Charm, Expert Belt. | Good priority-target pressure at distance; positioning and reduced broad coverage matter. |
| **Ricochet pack** | Meowth's elite-seeking bounce with a second damage dealer. | Relay Ribbon; later, Spillstone as a separate experiment. | Efficient mixed-wave clearing; fewer bounce targets reduce its advantage on a lone boss. |

These are intended playstyles, not measured best builds. Learned moves must remain inside each species' existing legal learnset.

## What to prove before implementing a large catalogue

Compare the same seeds and choice budgets at the opening, first partner, pre-boss, first boss, and multiple endless chapters. Also inspect personal levels 45/100 and ranks 12/20/50: a clock checkpoint alone does not prove late progression works.

Record useful direct/status/relic damage, boss-clear time, HP lost, effective healing, follower faints, eligible offers, activation uptime and time spent in choice menus. Keep damage to already-dead HP separate from useful damage. Compare equal-cost builds and similar roles rather than requiring every starter to have identical DPS.

The important failure cases are:

- A rank, extra projectile or larger radius makes a previously hittable target miss.
- A relic works only with three learned moves but appears before the first learned slot.
- A multihit cast advances a conditional counter once per visual particle and dominates a single-hit move for no intended cost.
- Critical tiers are applied again to already-critical secondary damage.
- Duplicate status casters multiply boss damage or healing beyond their displayed rules.
- Attack-speed/projectile saturation drops earned logical casts, loses cast identity or duplicates conditional charges.
- A barrier, status owner, previous element or empowered-cast charge resets on pause, evolution or resume.
- Endless offers contain no way to train a capped-level member's existing move.

New mechanics must carry the required state through deterministic snapshots. Bounded visuals may represent many logical casts, but cannot silently erase their damage or trigger budgets. Re-run the existing starter audit only after a candidate is implemented; documentation arithmetic is not a playtest.

## Suggested first slice

1. Settle source-scaled burn/poison and continuing endless move rewards.
2. Prototype one focused attacker, one close attacker and one status specialist: Pikachu, Machop and Oddish.
3. Compare the four initial relics: Expert Belt, Impact Bracer, Catalyst Stone and Relay Ribbon.
4. Evaluate full-run behavior before expanding to more species, shields or healing-to-damage conversion.

The decision to make first is which playstyles feel worth pursuing. Exact coefficients should follow measured delivery and whole-run play, while the existing uncapped growth contract stays intact.
