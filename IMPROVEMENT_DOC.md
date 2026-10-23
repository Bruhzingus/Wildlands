# IMPROVEMENT_DOC

Wildlands improvement plan and detailed future implementation handoffs.

**S4 / F5 (October 23, 2026): implemented.** Results now include ranked damage
analysis and a downloadable balancing report with minute samples, critical-hit
and Q DPS, enemy pressure, and ordered upgrade history. Pause → Save & suspend
downloads a portable local run file and rolls the complete simulation back about
30 seconds, including recent upgrades and world interactions. Title controls
resume, import and discard saved runs. See the
[S4/F5 handoff](docs/S4_F5_IMPLEMENTATION_REPORT.md) for schemas, recovery rules,
verification and the earliest-checkpoint behavior after import.

**N1 movement presentation (October 21, 2026): implemented.** Locomotion now
follows actual world travel, keeps walk phase through stops/attacks, and uses
stable directional selection. Grounded walk sheets use their own foot anchors;
native hovering motion, attack priority and reduced-motion behavior are retained.
Contact shadows follow terrain slopes. See [the N1 handoff](docs/N1_IMPLEMENTATION_REPORT.md)
for matching before/after clips, verification and native-sheet limitations.

**Owner movement extension (October 22, 2026): implemented.** N1 now also includes
innate leader movement traits: straight-line Run-up for Pikachu/Raichu/Jolteon,
brief hold-Space flight for Pidgey/Zubat families and Butterfree, and Magikarp's
higher Splash leap. These deliberately extend the original presentation-only
scope at the owner's request. Magikarp and Zubat are finite starter unlocks from
existing accomplishments. Cards, HUD, evolution previews and the catalogue
explain the traits and their tradeoffs. See the updated N1 handoff for tuning.

**N3 upgrade rework (October 21, 2026): implemented.** Attack speed now keeps
shortening actual cast intervals; it no longer turns into stronger hits/healing.
Iron Defense is removed. The current inventory has nine training families / 34 rarity variants, including Deflection from the concurrent defense work.
All 24 numeric relic families support repeated normal/Legendary copies; their
drawbacks stack as well. Previews show copies, actual attack rates and
recharge times. Relevant percentage/proc caps and crit-overflow conversion were
removed; critical tiers now resolve directly. The disposition of every family,
scripted comparisons and F3/performance limits are in
[the N3 report](docs/N3_IMPLEMENTATION_REPORT.md). This supersedes the older
one-copy relic policy and haste-overflow wording below.

**Implementation follow-up (October 21, 2026): N2, S1 and S2 are implemented; N4 has an initial measured tuning pass.** See
[the N2/S1 implementation report](docs/N2_S1_IMPLEMENTATION_REPORT.md),
[the S2 implementation report](docs/S2_IMPLEMENTATION_REPORT.md) and
[the N4 tuning report](docs/N4_IMPLEMENTATION_REPORT.md) for verification and
remaining human review. The starting-point evidence below remains the original handoff.

**Upgrade follow-up (October 21, 2026):** The owner clarified additive percentage
bonuses: `100 * (1 + 0.05 + 0.10) = 115`. Training now has 36 rarity variants,
including very rare Legendary cards. The 24 offerable relic families each have a
Legendary variant (48 total offers); both versions share unlocks and one ownership
slot. Upgrade cards preview current and resulting effective percentages. See
[the upgrade report](docs/LEGENDARY_UPGRADES_REPORT.md) and the refreshed catalogue.
This implements the rarity and preview changes; the broader F3 cap/crit-tier work
remains outstanding.

**Menu catalogue (October 21, 2026):** “Browse all upgrades” is available from
the title and pause menus. It includes all ten document groups with a scrollable
list, search, sorting, rarity/type/availability filters, colour-coded labels and
expandable progression details. See [the menu report](docs/UPGRADE_CATALOGUE_MENU_REPORT.md).

**Updated:** October 21, 2026. **Status:** Refined from the owner's answers. Each of the three sections contains five priorities and a copy/paste implementation prompt. Gameplay changes are future work; this assignment produced documentation and the complete [upgrade catalogue](UPGRADE_CATALOGUE.md).

**The intended game:** a chill experience that naturally becomes more demanding. Keep the existing controls, followers and automatic targeting. Improve movement and evolution presentation, make upgrade choices worth considering, create less predictable and more interactive environments, and add understandable run statistics. Future growth should support optional challenges, distinctive recurring bosses, uncapped percentage upgrades, unlockable Pokémon and suspended runs.

**Owner decisions that supersede the initial draft**

| Topic from the questions | Recorded answer / resulting requirement |
| --- | --- |
| Followers / fainting | The current behavior is fine. Preserve formation, exposure, lightweight movement and permanent fainting; collision clipping is not an assigned redesign. |
| Controls | Current controls are fine. No rebinding, controller or camera-control redesign is requested. |
| Character presentation | Focus on movement and evolution. Keep the existing art architecture unless improving these states requires a small justified extension. |
| Difficulty | Runs currently lean easy. Increase challenge through a natural ramp; no numerical win-rate target was supplied. |
| Performance | No observed problems. Optimize generally using measurements; no particular hardware/browser target or offline requirement was supplied. |
| Q / threat previews | Additional aim/placement previews are not wanted. Preserve the current aiming experience. |
| Upgrade decisions | Some choices are never selected or do not make sense. Supply a complete list of every upgrade and its actual rarity/tier behavior before deciding replacements. |
| World | Improve scenery, relief, routes, biome identity and exploration rewards. The map feels too flat/predictable; enemies need meaningful map interactions. |
| Learning / results | No onboarding project. Add detailed damage taken/dealt analysis, including the strongest damage sources and the player's most effective attacks. |
| Audio / impact | A chill experience that ramps naturally. Preserve restrained defaults. |
| World events | Prioritize optional challenges. |
| Bosses | Recurring, more distinct bosses; multiple stages are a desired direction to develop. |
| Stat growth | Percentage-based increases must remain uncapped. Crit above 100% must enable multiple crit tiers on one attack; reaching 100% should be much harder. |
| Metaprogression | Keep it limited for now, primarily unlockable Pokémon. |
| Continuity | Support pausing/suspending a run and resuming it later. |

The entry IDs below now identify the revised implementation priorities. Rejected or deprioritized initial proposals have been replaced, rather than kept as work that the owner supposedly requested.

**Verified starting point and limitations**

- `npm.cmd test`: **399/399 passed** in the initial review.
- `npm.cmd run content:audit`: **151 species, 151 combat profiles, 72 evolution edges, 151 spawn-reachable species, 453 validated Idle/Walk/Attack states, zero issues**.
- `npm.cmd run build -- --configLoader runner`: **passed**, including TypeScript. Main chunk **6,327.42 kB / 1,416.00 kB gzip**; a large-chunk advisory remains. The default config bundler encountered a sandbox directory-access error; the runner succeeded. This is not a diagnosed game defect.
- Focused actual Chrome/WebGL smoke: **1/1 passed**, covering movement/camera/actions, damage, full upgrade pause, choices, E interaction, pause/blur/resume and ten restarts. The full browser suite was not rerun.
- Locally reproduced follower scenery penetration and the inability to activate a focused menu button with Space (Enter works). These remain recorded observations, **outside the owner's selected work**. Do not turn them into a follower/input overhaul.
- Basic character sheets are present. Movement/evolution quality is a presentation task, not a claim that the 151-species basic asset set is missing.
- Existing features include distinct primary attacks/Q specials, learned moves, rerolls, relics, synergies, health bars, damage numbers, audio/comfort controls, adaptive graphics, achievements and save export/import. Phase 15 adds two environment families, fixed routes, larger maps, Mewtwo/Moltres and challenge rules. Older roadmap summaries contain obsolete descriptions.
- The refreshed catalogue finds **9 training families / 36 rarity variants, 24 offerable relic families / 48 variants, 12 retired relic definitions, 151 signatures, 41 learned moves, 72 evolutions, 74 recruitable species and 12 synergies**.
- No new human full-run balance session, target-GPU benchmark, subjective listening study or physical input-device assessment was performed. The owner's “easy” and “flat/predictable” assessments are product feedback; scripted evidence does not replace them.

Initial evidence lives in ignored `artifacts/improvement-analysis-*.log`, `artifacts/content-audit.json`, `artifacts/improvement-analysis-probes.mjs` and refreshed browser captures. Node was `v26.5.0`; the documented Node 22+ minimum was not separately checked. Documentation-only follow-up does not imply these gameplay checks were rerun after implementation changes, because no gameplay implementation occurred.

**Complete upgrade review resource**

Open [UPGRADE_CATALOGUE.md](UPGRADE_CATALOGUE.md). It includes all training Common/Rare/Epic/Legendary values and repetition formulas; all base, Legendary and retired relics; move-card rarity rules; all 151 signatures and authored milestones; all 41 learned moves with rank samples and complete species eligibility; all Q families/scaling; every evolution/recruit option; starter unlocks; all synergies; and the current cap/wording audit. Unbounded ranks use exact growth formulas and representative values rather than pretending an infinite list can be enumerated.

Regenerate with `node --experimental-strip-types scripts/generate-upgrade-catalogue.mjs`. The generator reads current source and records a source fingerprint. Preserve an annotated copy before regeneration if the owner marks rows for removal or redesign. The catalogue describes **current behavior**; F3 describes the **requested replacement rules**.

**Shared contract inherited by every prompt**

1. Read this document, `GAME_DESIGN_AND_ROADMAP.md`, relevant recent reports and current code. These owner decisions override older roadmap assumptions. Reproduce the current baseline before implementation; implement one coherent entry rather than rebuilding the game.
2. Preserve Babylon/TypeScript, authoritative deterministic simulation, data-owned tuning, existing controls/camera, current follower behavior, automatic primary/learned attacks and current Q targeting. No added aiming preview, mandatory tutorial, new input scheme or follower redesign.
3. Preserve complete pause, first-stage recruitment gates, optional evolution, permanent follower fainting, fifteen-minute first map boss and victory/endless continuity unless an entry explicitly extends the relevant system. Keep Pokémon unlocks finite; no permanent between-run combat-stat inflation.
4. Percentage-based progression must keep providing value without a hard maximum. F3 specifies the implementation. Entity counts, draw calls, pooled effects and scheduling work remain bounded, with mathematically meaningful aggregation/conversion where needed; a performance limit must not silently become a percentage-stat cap. Do not introduce new stat caps while implementing other entries.
5. Keep cosmetic state out of combat authority and combat state out of renderers. Preserve simulation RNG, IDs, HP, damage timing, pause and reward accounting. New UI/telemetry must observe without changing outcomes. Every new state must have bounded storage or explicit lifecycle ownership.
6. Validate changed behavior with meaningful targeted checks, then run `npm test`, `npm run typecheck`, `npm run build`, and actual browser flows when visuals/input/runtime state change. Windows `.cmd` wrappers or the observed Vite config-loader workaround may be needed. Documentation-only changes need catalogue/link/completeness checks, not another full gameplay test run.
7. Follow the roadmap handoff format: changed files, decisions, exact commands/results, browser observations, known limits, balance/performance effects and remaining work. Distinguish human feedback, scripted balance and measured GPU performance. Update the catalogue when upgrade behavior changes.

## 1. Things that need to be worked on

### N1 — Improve Pokémon movement presentation

**October 22 owner extension:** Add a small set of lore-inspired movement
techniques, using movement utility to help differentiate weaker or simpler
attack/special kits. Requested examples are a speed boost after running straight
for more than a second and brief hold-jump flight over foes/scenery. Existing
Abra teleport remains. The original handoff below documents the visual scope;
the explicit owner extension also authorizes the leader mechanics now recorded
in [the N1 report](docs/N1_IMPLEMENTATION_REPORT.md).

**Priority and purpose:** High. Movement is one of the owner's two most unfinished-looking areas, and is visible throughout every run. **Dependencies:** Coordinate with N5 performance and N2 shared visual state.

**Evidence / current scope:** [AssetLibrary.ts](src/game/render/AssetLibrary.ts) and [animation.ts](src/game/render/animation.ts) already resolve native idle/walk/attack frames, facing, foot anchors, shadows and attack poses. [Simulation.ts](src/game/Simulation.ts) supplies movement state and the existing lightweight party formation. Preserve that formation and movement logic; the owner considers followers and controls acceptable.

**Recorded direction:** Improve how locomotion looks and transitions. Do not interpret this as permission to change acceleration, collision policy, follower exposure, input mapping or recruitment/fainting rules.

**Implementation handoff**

```text
Implement N1 under the shared contract. Capture a baseline of leader and follower
idle/walk transitions, slow starts/stops, camera orbit without movement, diagonals,
direction reversals, slopes, jump/dodge and the return from an attack. Include
small, large, flying and elongated species plus 1/4/6-member parties. Identify
specific visual faults rather than adding uniform bounce to every Pokémon.

Preserve native sprite timing and directional rows. Improve presentation state
selection, transition continuity, stable ground contact and shadow/foot alignment.
Where useful, derive walk playback from actual travel speed so feet do not cycle
at full speed while almost stationary. Flying species may use a restrained
species-appropriate treatment. Avoid jitter, skating, repeated frame resets or
camera rotation causing a false locomotion direction.

Retain one-shot attacks, learned-move pose routing, Q priority and recovery; walk
polish must not repeatedly interrupt native attack frames. Keep additions subtle
in the pixel-sprite/low-poly world and provide reduced-motion behavior. Do not
replace sprites, change follower positions/AI or redesign movement controls.

Acceptance: compare before/after short clips for the same species, route and
camera. Confirm animation agrees with travel, feet remain grounded on shared
terrain, and stopping/turning does not flicker between states. Test pause/resume,
late-loading sheets, fallback art, rapid attack/walk changes and restart disposal.
Simulation position/damage/progression must match the baseline for identical
inputs. Report which species were inspected and any remaining native-sheet limits.
```

### N2 — Make evolution feel visible, coherent and rewarding

**Priority and purpose:** High. Evolution is explicitly called unfinished and should be a memorable team milestone. **Dependencies:** Shared rendering transitions with N1; N3 catalogue supplies truthful evolution effects.

**Evidence / current scope:** Evolution rules and branches already work in [progression.ts](src/game/systems/progression.ts) and [evolutions.ts](src/data/evolutions.ts). The renderer replaces the old avatar when its species changes. There is no complete dedicated evolution presentation sequence. Evolution already grants HP, damage and move-rank gains; those mechanics are not being redesigned here.

**Recorded direction:** Improve the transformation presentation, including the relationship between selection, old form, new form and the actual upgrade. Preserve optional evolution and existing branch decisions.

**Implementation handoff**

```text
Implement N2 as a clear restrained evolution sequence integrated with the existing
choice and render lifecycle. Inspect current choice application, evolve event,
species replacement, asset readiness, HUD portraits and audio. Show the old form,
the transition and the new form clearly enough to feel intentional, without a
screen-filling cutscene or repeated input demands.

Commit the gameplay evolution exactly once using current rules. Keep level/XP,
HP fraction, known-move merge/rank handling and stable party UID correct. Any old
form retained for a visual transition is cosmetic and cannot attack, take hits or
receive rewards. Ensure a late-loading new sheet joins the correct state without
an invisible actor, fallback flash or old geometry at the wrong size.

Coordinate a short visual/audio accent with an understandable confirmation of
species and actual gains. Define pause semantics explicitly: prefer a brief
transition while safely paused, then resume through the existing capture gesture
flow. Avoid a live invulnerability exploit or a presentation-dependent combat
delay. Multiple earned choices/evolutions must queue or replace cleanly, never
multiply the granted reward. Reduced motion uses a calm equivalent.

Acceptance: exercise first/final evolutions, all Eevee branches, leader/follower,
learned-signature merge, simultaneous pending rewards, missing/slow sheets and
restart during transition. Demonstrate before/after captures and correct HUD,
sprite scale/anchor and audio cleanup. Confirm no automatic evolution, lost move
rank, double grant, resurrected faint or altered combat timing. Report remaining
presentation compromises honestly.
```

### N3 — Audit every upgrade and replace nonsensical or unrewarding choices

**Priority and purpose:** High. The owner identifies choices they never take and wants to inspect the complete catalogue before naming replacements. **Dependencies:** [UPGRADE_CATALOGUE.md](UPGRADE_CATALOGUE.md), F3 stat model, N4 difficulty.

**Current scope:** N3 has audited the eight original retained training families, the removed Iron Defense family, all active relic families and every move/reward category. See the implementation report for keep/clarify/retune/rework/retire decisions. The current inventory, including concurrent defense changes, has nine training families / 34 variants, 24 relic families / 48 offers and 14 retired definitions. Relics can repeat, actual cadence keeps increasing, and previews describe the resulting build. Human item preferences and the measured long upgrade gaps remain explicit follow-up work.

**Recorded direction:** Supply the list now (completed in the linked catalogue). Future implementation must evaluate why an option is ignored and propose concrete useful changes, rather than indiscriminately increasing every number or deleting unfamiliar choices.

**Implementation handoff**

```text
Implement N3 using the catalogue and any owner annotations made after this handoff.
Regenerate the catalogue first and reconcile active/retired entries and actual
rarity variants. Produce a disposition for every active training family, relic and
move-offer category: keep, clarify, retune, rework or retire, with the reason and
specific proposed result. Retired legacy definitions are not current weak offers.

Classify problems as no compatible benefit, dominated same-rarity choice, weak
tradeoff, poor wording/scope, late-run dead growth, excessive interruption or an
effect too small to notice. Reproduce the relevant state. Do not treat a low pick
rate alone as proof that a niche option should disappear. Preserve identities and
support unusual but viable builds.

Implement coherent replacements in shared data/build hooks, with explicit owner,
stacking, trigger, rarity, drawback and scaling. Show accurate before/after values,
move/party ownership and relevant synergy consequences. Coordinate with F3 so
percentage gains never become dead offers at a hidden cap. Resolve HP Up's actual
squad scope and stale cap/crit wording. Keep all evolution branches and meaningful
keep-training alternatives; preserve reroll rarity and existing gating protections.

Acceptance: every displayed effect matches actual application. Verify fresh and
unlocked pools, solo/support/melee/ranged parties, no usable new moves, high ranks,
fainted owners and stale choices. Compare representative builds and upgrade gaps
before/after. Refresh the complete catalogue, record every changed/retired entry,
and identify unresolved taste decisions without pretending the owner already
rejected a named item. No additional metaprogression grind or stat ceilings.
```

### N4 — Raise difficulty while preserving a chill opening and natural ramp

**Priority and purpose:** High, after core stat/economy changes settle. **Dependencies:** N3/F3; use S4 attribution to diagnose unfair damage when available.

**Evidence / current scope:** The owner reports that runs lean easy. [director.ts](src/game/systems/director.ts), species threat, time/party scaling, follower sustain, dodge and boss tuning already interact. Historical telemetry exists but predates several changes and does not measure current human enjoyment.

**Recorded direction:** A calmer beginning should become more demanding through the run. No fixed desired victory percentage was supplied; do not manufacture one or meet it with sudden unavoidable damage.

**Implementation handoff**

```text
Implement N4 from current-run measurements and the owner's “too easy” feedback.
Establish fingerprinted fresh/unlocked baselines across starters, both environment
families, normal/strong/awkward builds and several movement policies. Keep assisted
scripts separate from unassisted outcomes and real sessions. Record minute-by-
minute pressure, incoming damage, healing, dodge usefulness, recruit/upgrade timing,
living party, time-to-kill and boss duration.

Find the actual sources of low threat: damage/sustain, weak encounter mix, very
forgiving tells, overperforming upgrades, predictable movement or scaling that
fails to follow a competent build. Increase meaningful decisions over time through
small data-owned changes. Preserve readable windups and counterplay. Prefer a
smooth increase in encounter demands to filling the screen or raising all enemy
HP until combat is tedious. Keep normal travel/exploration viable.

Preserve the opening's welcoming feel, current recruit gates and a plausible
three/four-member first boss. Test difficulty with F3's uncapped scaling rather
than secretly capping builds to make tuning easier. Do not use constant rubber-
banding that erases the benefit of a good build. Keep optional challenge rules
meaningfully different from standard play.

Acceptance: show before/after pressure and survival curves, damage-source changes,
boss engagement times and upgrade cadence for matched cohorts. Seek human feedback
on when the run becomes demanding and whether failure was understandable. Report
scripted results as scripts, not human win rates. No new one-hit trap, unavoidable
opening damage spike, forced six-member build or change from chill-to-ramping
intent. Record tuning hypotheses and what remains uncertain.
```

### N5 — Maintain efficient loading, rendering and long-session behavior

**Priority and purpose:** Ongoing quality work; no reported performance incident. **Dependencies:** Reprofile N1/N2 and world/boss work as it lands.

**Evidence / current scope:** Adaptive graphics, resource pools, lifecycle checks and a telemetry harness already exist. The build still has a large main chunk. The current browser evidence uses software WebGL and is not a target-GPU benchmark. Local complete sprite caching is different from first-load delivery on a fresh machine.

**Recorded direction:** Optimize generally and keep the game lightweight. No new platform expansion, offline subsystem or arbitrary minimum-device guarantee is assigned.

**Implementation handoff**

```text
Implement N5 as measured optimization. Profile cold/warm startup, native starter
sheet readiness, ordinary combat, six-member late combat, recurring bosses when
available and repeated restarts. Separate network, parse/compile, simulation,
presentation, rendering and asset memory. State browser, viewport and actual GPU
renderer whenever reporting frames per second.

Investigate Babylon dependency imports, dev-only gallery/diagnostic inclusion,
asset readiness, repeated per-frame allocations/DOM updates and genuine collision
hot paths. Change the demonstrated expensive paths first. Use meaningful lazy
boundaries rather than splitting bundles merely to suppress a warning. Preserve
base-path URLs, visible fallbacks and bounded retries; do not fetch gameplay data
from the network during combat.

Keep actor/effect/resource budgets and restart disposal. Coordinate with F3:
uncapped percentage strength does not require unbounded rendered projectiles or
one loop per crit tier. Aggregate work without discarding the earned gameplay
value. Preserve hostile tells at every graphics preset. Do not add a physics,
backend or caching subsystem without a measured need.

Acceptance: provide reproducible before/after timings, allocations/resource counts,
production-preview startup behavior and stable restart/endless cleanup. Verify
slow/missing art fallback and reduced-quality readability. Report hardware not
available for measurement as unverified; do not promise universal FPS from
SwiftShader. All gameplay outcomes and earned scaling must remain intact for
equivalent inputs unless another explicitly assigned gameplay change applies.
```

## 2. Things that should be worked on

### S1 — Give maps meaningful relief and stronger biome composition

**Purpose:** Address flat, predictable terrain and repetitive scenery. **Dependencies:** N5; coordinate S2 terrain interactions and S3 routes.

**Evidence / current scope:** [maps.ts](src/data/maps.ts), [environment.ts](src/game/systems/environment.ts) and [World.ts](src/game/render/World.ts) share seeded rolling terrain, regions and primitive scenery. The two environment families reuse a world kit; existing height variation has not delivered the owner's desired feeling of relief.

**Recorded direction:** Improve scenery, routes/landmarks and biome identity together. Larger dimensions or more props alone do not solve predictability.

**Implementation handoff**

```text
Implement S1 within the existing map size and low-poly visual language. Inspect
normal-height traversal through both map families across multiple seeds. Identify
where terrain reads as flat, landmarks repeat and regions blend together. Preserve
shared seeded terrain/collision/minimap authority and safe spawn.

Author stronger terrain compositions: readable ridges, shallow valleys, elevated
clearings, water-edge relief and distinct region silhouettes. These are candidate
forms to combine into a coherent map, not a demand for all of them. Use shared
height/region data so hills are real terrain, not props floating over flat ground.
Keep slopes traversable with current controls, avoid unexpected vertical walls or
mandatory platforming, and retain useful sight lines for combat.

Improve prop clusters, restrained ground variation, landmark approaches and biome
transitions. Add seeded structural variation that changes the route experience,
not just rotation or random trees. Keep a navigable route network and optional
clearings. Do not enlarge the map again or add decorative collision that traps
actors. Coordinate future interactive terrain with S2.

Acceptance: demonstrate normal traversal and screenshots showing relief and biome
identity from gameplay camera height, on both families and multiple seeds. Verify
render/collision heights, site reachability, minimap projection, camera visibility,
boss/spawn placement and world edges. Record prop/geometry/frame-cost changes.
Use owner feedback to judge whether the map feels less flat and predictable;
passing a height-vertex test alone is not sufficient artistic acceptance.
```

### S2 — Make enemies and terrain affect one another

**Purpose:** Turn the map into part of combat rather than a decorative backdrop. **Dependencies:** S1 common geometry, S4 attribution, N5 work budgets.

**Evidence / current scope:** Ordinary enemies already use scenery collision in [Simulation.ts](src/game/Simulation.ts). That is existing behavior, not a new feature to claim. The missing depth is readable interaction with environment features: meaningful routes, hazards, cover or terrain opportunities. Follower movement stays as the owner currently prefers.

**Recorded direction:** Enemies should interact with the map. The exact two first interaction types are implementation design choices; favor a small maintainable set that makes positioning interesting.

**Implementation handoff**

```text
Implement S2 with two clearly different, reusable environment interactions. First
document the existing obstacle behavior and identify what enemies currently ignore.
Choose interactions that fit the world and current controls: for example a terrain
hazard affecting enemies, or destructible/usable cover changing a route. Explain
why the chosen pair creates different movement decisions. Do not call existing
tree collision a completed interaction feature.

Represent interaction eligibility and state in shared map/simulation data. Give
enemies explicit readable responses to those features, with bounded local decision
work; avoid a full rigidbody or global pathfinding rewrite. Synchronize visual,
collision and damage state when a feature changes. Preserve intentional routes
around lakes and world boundaries, and define bosses' responses separately.

Telegraph dangerous state changes and allow the player to exploit the same clear
rules. Keep environmental damage attributable to its feature/initiator for S4.
Prevent farming infinite XP/coins from a repeatable interaction, permanently
stranded enemies and a trivial safe tile that defeats the whole run. Preserve
the existing follower model unless a tiny compatibility fix is unavoidable.

Acceptance: actual browser encounters show enemies respond and the player's
positioning choices matter. Verify deterministic layout/state, interaction once-
only rules, pause, actor death, simultaneous contact, boss eligibility, restart
cleanup and finite per-frame work. Compare ordinary combat with and without the
feature; document both useful tactics and exploits tested. Readability and fair
counterplay matter more than the number of interactive objects added.
```

### S3 — Make optional exploration rewarding and less predictable

**Purpose:** Give improved terrain a reason to explore without creating chores. **Dependencies:** S1/S2 map, N3 reward catalogue, N4 pacing; F1 adds challenge encounters later.

**Evidence / current scope:** Eighteen initial sites, timed discoveries, caches, supply chests, springs, elites and shrines already exist. Fixed landmarks and several reveal times are predictable. More supplies can inadvertently make an already-easy run easier.

**Recorded direction:** Improve routes, landmarks, biome differences and exploration rewards. Keep discovery optional and avoid flooding the run with extra permanent power.

**Implementation handoff**

```text
Implement S3 by auditing travel time, navigation cues, site risk and reward value
across the current expanded maps. Record whether a detour produces an interesting
decision or just another predictable cache. Preserve the option to stay near
spawn and complete the standard run without a checklist.

Make site types recognizable at normal camera distance, improve landmark/trail
guidance and minimap used/unused/cost clarity. Vary seeded route-to-reward patterns
and some discovery timing/eligibility within explicit bounds. Avoid making every
reward visible from spawn or guaranteeing the same sequence every run. Retain
repeatability for earned fixed routes and reproducible seeds.

Use reward identity as well as quantity: a useful choice, optional challenge,
recovery opportunity or Pokémon unlock progress can justify a detour without
simply handing out more damage. Coordinate with N3 and F1/F4 rather than creating
another inventory/currency. Match risk and travel cost to benefit; avoid mandatory
exploration to meet recruit levels or repeated site farming.

Acceptance: compare several seeds and both map families, including a player who
ignores sites and one who explores actively. Check site reachability, actor budgets,
prices/restocks, pause/reward resolution and simultaneous level-up/boss events.
Show that exploratory runs create different decisions and memorable destinations,
not merely more loot. Report changes to supply density, power and difficulty so
N4 can keep the intended natural ramp.
```

### S4 — Add detailed damage taken, damage dealt and death analysis

**Purpose:** Make defeats and build performance explainable. **Dependencies:** Combat attribution/event paths, future F3 crit tiers and F5 snapshots.

**Evidence / current scope:** [RunState](src/game/types.ts) has aggregate damage counters and the result screen shows basic totals. Many events carry member/target IDs, but detailed species/move/status/relic provenance must be preserved through delayed hits and source death. Current aggregate `damageTaken` is not automatically the correct definition for actual HP lost because attempted damage/overkill can differ.

**Recorded direction:** A detailed death list ranked by damage received, and an offensive breakdown of what the player/squad did the most damage with. No tutorial or aim UI project.

**Implementation handoff**

```text
Implement S4 as bounded read-only run analytics. Define effective HP damage,
attempted damage, mitigation and overkill separately. Make the default tables
report actual HP removed, with explicit labels for other values. For received
damage retain enemy species, variant, move/attack, boss/environment/self source,
status cause and recipient. For dealt damage retain party member identity/form,
signature versus learned move versus Q, relic/proc/status/environment origin,
critical tier, hit/kill counts and relevant damage type.

Carry immutable provenance through projectiles, persistent fields, chains, damage
over time and post-source-death effects. Distinguish a proc from its triggering
attack so totals are not counted twice. Define refresh/replacement ownership for
statuses and record unknown attribution honestly. Include follower losses and
separate leader/follower incoming totals. Aggregate finite keys and keep a bounded
recent-hit window; no per-frame unbounded combat log or simulation RNG consumption.

Add a detailed result/death panel with ranked incoming sources and outgoing
members/moves, totals/percentages, final damaging sequence and build summary.
Offer drilldown without obscuring the default readable view. Optional pause-time
access may reuse the same snapshot. Keep standard HUD quiet. Include metrics in
run snapshots/history only through their versioned interfaces.

Acceptance: reconcile incoming/outgoing breakdown sums to independently measured
effective damage. Cover armor, immunity/iframes, overheal, overkill, poison after
source death, same-name moves from different members, proc chains, self-damage,
boss stages and follower faint. Analytics on/off must yield identical gameplay.
Verify result/endless continuity, pause, restart disposal and readable tables.
Demonstrate that the owner can identify the leading threat and strongest attacks.
```

### S5 — Keep sound and impact calm early, richer as the run develops

**Purpose:** Support the intended emotional arc without exhausting the player. **Dependencies:** N1/N2 presentation and N4 phase tuning.

**Evidence / current scope:** Procedural species sounds, quiet music, voice reservation, attenuation, gesture unlock and comfort settings already exist. Full-run listening remains unverified. This is tuning and musical/atmospheric development, not replacing the sound system.

**Recorded direction:** A chiller experience that naturally ramps up. Avoid constant aggressive impact or a sudden wall of audio at a time threshold.

**Implementation handoff**

```text
Implement S5 around the existing audio/feedback engine. Listen through opening,
first partner, mid-run build, late pressure and both bosses. Log repetition,
fatigue, masking, abrupt transitions and whether important cues remain audible.
Use headphones and speakers where available and label unperformed listening.

Preserve quiet defaults and space between routine cues. Let music/ambience gain
restrained layers, variation or harmonic tension as the run develops, without
simply raising overall volume. Smooth transitions around pauses, bosses, defeat
and endless. Coordinate evolution and rare-milestone accents with N2 so they
feel rewarding without making ordinary attacks compete for attention.

Retain cast-based attack audio, voice reservation, distance/overlap attenuation,
gesture unlock and complete pause/blur cleanup. Align hit pause/shake/flash choices
with the calm tone; preserve independent comfort toggles and reduced motion.
Keep safety-critical information available visually and avoid adding more warning
noise than the player can interpret. Use original/approved materials if extending
the sound palette; external downloads are not required by this task.

Acceptance: provide a repeatable full-arc listening sequence, documented before/
after mix choices and browser gesture/pause/restart checks. Confirm no doubled
casts, cut-off music, voice growth or audio continuing behind menus. Ask whether
the beginning feels relaxed and later escalation feels natural. Waveform/voice
tests prove signal/lifecycle behavior, not subjective musical quality.
```

## 3. Future features and things that should eventually be built

### F1 — Optional in-world challenges with clear stakes

**Purpose:** Add chosen risk and variety to exploration. **Dependencies:** S1–S3 world/rewards and N4 standard difficulty.

**Recorded direction:** Challenges, rather than a broad quest or random-secret system. Existing shrines/elites are the foundation; new challenges must create different decisions.

**Implementation handoff**

```text
Implement F1 with a small initial catalogue of genuinely distinct optional
challenges, reusing current POI/shrine/elite systems. Start with three types that
demand different play, such as a short holdout, a positioning/terrain trial and a
special guardian encounter. These are design examples, not compulsory objectives;
choose a coherent low-cost set and explain each one's decision and counterplay.

Each definition needs eligibility/placement, a visible invitation, rules/stakes,
start/abandon/complete/fail state, active-time limit if any, bounded enemy pressure,
reward and cleanup. Keep timers fully paused in menus and avoid removing control
for mandatory instructions. Show enough risk/reward information before committing.
Limit overlap and protect scheduled boss/recruitment transitions.

Use existing upgrade/recovery rewards and, where appropriate, F4 Pokémon unlock
progress. Preserve ordinary survival without taking a challenge. Avoid permanent
stat bonuses, crafting, new currencies or repeatable reward farming. Difficulty
must come from an understandable constraint, not an untelegraphed damage multiplier.
Allow abandonment without corrupting the run or stranding summoned actors.

Acceptance: reproduce selection/layout from seed; prove once-only resolution,
full pause, bounds and restart cleanup. Exercise death, follower faint, leaving
the area, queued upgrades and boss arrival during a challenge. Browser examples
must show different tactical responses for the initial types. Report difficulty
and reward impact, and whether players willingly accept another challenge without
feeling compelled to clear every marker.
```

### F2 — Recurring distinctive bosses with multiple stages

**Purpose:** Give endless runs memorable chapters and bosses more identity. **Dependencies:** S4 attribution, N4/F3 balance and N5 endurance.

**Recorded direction:** Recurring bosses, clearer differences between bosses and potentially multiple stages. Mewtwo/Moltres already exist and must remain recognizable encounters.

**Implementation handoff**

```text
Implement F2 through a data-owned boss encounter/schedule model. First inventory
Mewtwo/Moltres moves and the current single-boss flags, victory accounting and
endless continuation. Add explicit encounter IDs, stage state and a recurring
schedule that cannot confuse later bosses with the initial fifteen-minute victory.
Define warnings, minimum spacing, crowd easing and behavior if a previous boss
has not died. Preserve one run identity and once-only first-victory rewards.

Design bosses around distinct counterplay, not palette/HP substitutions. Give the
first new or reworked encounter at least two meaningful stages, with clear stage
transition tells and altered patterns/positioning demands. Keep the HP/stage UI
truthful. Any transition invulnerability must be brief, intentional and explained;
avoid a long animation during which players cannot do anything useful. Reuse
shared projectiles/telegraphs with new combinations where possible.

Recurring rounds need bounded simultaneous threats, useful recovery/reward beats
and continued party/items/rank preservation. Support three/four-member initial
parties and six-member endless builds, including F3 multi-crits. Boss scaling
must leave good builds powerful and weak builds capable of counterplay.

Acceptance: test threshold skips from large hits, simultaneous stage/death/status
events, pause/stun cancellation, world edges, previous-boss overlap and queued
rewards. Exercise multiple real rounds and ensure no repeated first victory or
achievement grant. Demonstrate distinctive stage tactics and sustained resource
bounds. Record duration/damage per representative build and human readability
feedback separately from scripted survival.
```

### F3 — Uncapped percentage growth and multiple crits per hit

**Purpose:** Honor the owner's explicit scaling model and keep late upgrades valuable. **Priority across sections:** Implement before final N3/N4 balance calibration, even though it is a major future-system change.

**Starting-point conflict before N3:** [builds.ts](src/game/systems/builds.ts) already allows unlimited damage/haste/speed/radius/recharge modifiers, but caps XP, catch-up XP, percent regeneration, projectile speed and duration. Non-training reduction has a separate clamp. Current crit chance is clamped to 100% after overflow adds critical damage. Status application adds an eight-second duration ceiling; the proc interpreter also caps percentage-of-hit damage at 2,000 and effect radius at 12m. Existing text often disagrees with numeric caps. See the catalogue's exact current audit.

**N3 overlap:** Actual attack cadence, critical tiers, lower crit gains, relevant modifier/proc ceilings and stackable relics are implemented in [the N3 report](docs/N3_IMPLEMENTATION_REPORT.md). Complete the remaining F3 provenance, saturation, numerical and endurance work from current code; do not restore haste-to-strength conversion.

**Recorded requirements:** Every percentage-based increase must remain uncapped. Crit over 100% produces multiple crit tiers on one attack. Reaching 100% must be significantly harder than with the original +10/+20/+30 percentage-point Focus Energy cards. This is a gameplay requirement, not permission to allocate infinitely many effects.

**Concrete planned crit interpretation:** Treat total crit chance as `C`, where `1 = 100%`. A hit gets `floor(C)` guaranteed crit tiers plus one additional tier with probability `C - floor(C)`. Proposed damage is `base damage × critMultiplier^tier`, computed as one hit. Thus 250% means two guaranteed tiers and a 50% chance of a third. The tier-count behavior is required; multiplicative damage is the explicit implementation default, to be tuned from measurements rather than left ambiguous. No fixed maximum crit tier.

**Implementation handoff**

```text
Implement F3 under the shared contract. Audit percentage growth from source to
effective outcome across buffs, training, relics, synergies, move/Q profiles,
status application, healing, offer eligibility and UI. Remove hard upper clamps
that make further percentage upgrades stop helping. Do not simply change the
displayed number while leaving a downstream hidden cap. Include the proc
interpreter's damage/radius/status ceilings and any percentage scaling of heals
or echoes, not just the top-level BUILD_STAT_CAPS table.

Implement the recorded crit-tier formula with one deterministic fractional roll
and direct multiplier math, not one loop or projectile per tier. Preserve the
uncapped total chance; stop converting chance overflow into an unrelated damage
stat. Define a single source of crit truth for signatures, learned moves, statuses,
Q/proc behavior and damage labels. Carry tier/provenance through projectiles and
S4 analytics. A landed hit emits one onCrit event carrying its tier; extra tiers
do not recursively duplicate the hit or unbounded item callbacks.

Rebudget all crit-chance sources so 100% is much harder to reach than today.
Measure typical fifteen-minute/endless opportunities before choosing final gains;
there is no owner-approved numerical win rate or replacement gain yet. Update
training rarity values, legacy Scope Lens behavior, synergies, descriptions and
catalogue consistently. Old saves must not lose unrelated progression.

For defensive/recovery/haste percentages with a physical or mathematical boundary,
use continuing-value formulas rather than a hard rating ceiling. Repeated defense
can multiply remaining damage; never allow >100% subtraction to heal the victim.
Audit the current minimum-damage floor and any diminishing returns for dead
upgrades. Keep gained value meaningful. At execution limits, aggregate work or
convert excess into defined equivalent strength, by retaining logical casts/hits in bounded representations; never replace earned
attack speed with a different stat or silently drop earned value for a visual pool.

Acceptance: verify 0/50/100/150/250/500% and large finite crit values with fixed RNG,
including fractional probabilities and tier-scaled damage. Verify continued useful
growth past every old percent cap, stable math, no NaN/Infinity-to-zero damage,
bounded processing and no recursive proc explosion. Check overheal/defense,
status duration, eligibility at old caps, projectile/chain attribution and current
pause/save/restart behavior. Supply before/after crit accessibility and build
results; regenerate the catalogue and document the exact formulas adopted.
```

### F4 — Expand unlockable Pokémon with minimal surrounding metaprogression

**Purpose:** Provide replay motivation through new partner possibilities. **Dependencies:** N3 viable choices and existing achievement/save systems; optional F1/F2 accomplishments.

**Recorded direction:** Not much metaprogression for now; primarily unlockable Pokémon. No mastery grind, daily schedule, online comparison or broad cosmetic system is requested.

**Implementation handoff**

```text
Implement F4 as a compact extension of current Pokémon unlocks. Audit the existing
fifteen starter options, gated first-stage recruits, unlock achievements and legacy
save preservation. Choose a small batch of additional current-Kanto playable
partners or recruit unlock opportunities with distinct move/role identities.
Avoid adding generations or a giant roster merely to increase a count.

Tie each unlock to an understandable finite accomplishment, potentially a selected
challenge or boss outcome. Keep objectives achievable through enjoyable play and
avoid long repeated kill grinds. No permanent between-run HP/damage bonuses,
calendar requirements, accounts, new progression currencies or mandatory mastery
trees. Existing players retain their pools and completed accomplishments.

For each newly playable species, define the signature/Q behavior, growth/evolution
path or single-stage advantage, art fallback and a plausible build. Reuse archetypes
while making handling distinct enough to justify trying another run. Keep first-
stage recruit restrictions and legendary eligibility intentional. Show requirements
and earned results clearly in the existing collection UI.

Acceptance: every added option has a reachable finite unlock and useful gameplay
identity, activates once, survives save migration/import/export and cannot duplicate
rewards across victory/endless/defeat. Test fresh/legacy/complete saves and locked
offer enforcement. Compare representative new partners to reference builds without
requiring identical output. Report what changed in the obtainable Pokémon pool;
do not expand this into a larger metaprogression project.
```

### F5 — Suspend a run and resume it later

**Purpose:** Let players return to an unfinished run without losing their squad/build. **Dependencies:** Explicit simulation snapshot interface, existing save/run accounting; include S4/F2/F3 state as they land.

**Recorded direction:** Support more than the existing temporary Escape pause: the run must be resumable later, including after closing/reopening the browser. Start with one local suspended run and no external account service.

**Evidence / scope:** [save.ts](src/game/save.ts) stores progression and aggregate run records, not a live simulation. Copying `RunState` alone omits private bookkeeping, both RNG streams, spawn accumulation, status ownership and build counters. Snapshots must be an intentional simulation API.

**Implementation handoff**

```text
Implement F5 with an explicit versioned snapshot contract, separate from collection
and live settings. Inventory authoritative state: run identity, map/seed/rules/
unlock pools, both RNG streams, unique IDs, spawn accumulation/director, party and
HP/XP/moves/ranks, projectiles/fields/status provenance, pending choices/rewards,
rerolls, build counters/cooldowns, POI state, boss schedule/stages, endless flags,
achievement accounting and damage analytics. Serialize maps/sets safely. Do not
persist renderer meshes, audio nodes, pressed inputs or stale wall-clock times.

Add Suspend/Resume/Discard flows around the existing pause/title UI. Prefer
immediate save when explicitly suspending plus bounded safe checkpoint writes
for recovery; avoid per-frame storage. Time does not advance while away. Restore
paused and require a fresh user gesture for pointer capture/audio. Preserve a
pending choice without granting it twice, and resume bosses/projectiles with their
remaining simulation time. State compatibility must be explicit across versions.

Handle malformed snapshots, storage quota/unavailability and interrupted writes
without overwriting valid progression or silently deleting a recoverable run.
Use a clear checkpoint/write strategy. Discard requires an explicit UI action;
resuming never starts a second run or resurrects a fainted member. Integrate with
existing import/export only after defining whether suspended state is included.

Acceptance: compare uninterrupted and save/restored seeded continuations, including
future RNG draws and gameplay outcomes. Cover combat, choice, active poison,
projectile flight, boss stage transition and endless. Test close/reopen, repeated
resume, death, discard, old/incompatible versions, failed storage and restart.
Verify capture/audio cleanup, exact run/reward counting and all stored state bounds.
Show the owner an ordinary run suspended today and resumed intact after reload.
```

**Recommended execution order:** N1/N2 can improve feel without retuning combat. Review N3's catalogue, implement F3's scaling model, then finish N3's offer changes and N4's difficulty calibration. Build S4 early if damage attribution is needed for diagnosis. Develop S1/S2/S3 together as small map slices, profiling through N5. F1/F2 extend those foundations, F4 remains a small partner-unlock addition, and F5 can move forward whenever session interruption is the highest practical need. Preserve S5's chill-to-ramping tone throughout.

**What this document does not authorize by implication:** reviving the rejected follower/control/aim-preview work, compulsory tutorials, extensive metaprogression, or turning a documentation request into immediate gameplay implementation. The prompts are ready for future assignments; the complete catalogue is available for the owner's review now.
