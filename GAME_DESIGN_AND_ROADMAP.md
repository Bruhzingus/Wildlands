# WILDLANDS — Master Game Design, Technical Specification & Agent Implementation Roadmap

**Version:** 0.7 · **Status:** Phases 00–02 and 04–14 implemented; current verification and remaining limits recorded in [docs/PHASES_10_14_REPORT.md](docs/PHASES_10_14_REPORT.md), with earlier work in [docs/PHASES_07_09_REPORT.md](docs/PHASES_07_09_REPORT.md), [docs/PHASES_04_06_REPORT.md](docs/PHASES_04_06_REPORT.md) and [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md) · **Format:** single source-of-truth document for the project and for sequential Claude / Codex work.

> **Important:** This is an unofficial, noncommercial Pokémon fan prototype. The code and original game design can be adapted, but Pokémon names, characters, sprites, sounds and trademarks are not licensed by PokéAPI or SpriteCollab. A free public launch can still receive a takedown. SpriteCollab's community-work license generally requires attribution and noncommercial use; official sprites have additional rights holders. Maintain full attribution and an asset inventory. Do not monetize or treat a CC license on a repository as authorization from The Pokémon Company. For commercialization, replace these characters/assets with original content and obtain an IP review.

---

## 0. Read this first: how to use this project

The repository contains the original core simulation and Babylon presentation layer, with phases 00–02 and 04–14 implemented. The [current handoff](docs/PHASES_10_14_REPORT.md) covers UX/audio, all-species content, replayable run telemetry, automatic graphics/reliability and finite collection/save progression. Detailed reports: [10](docs/PHASE_10_REPORT.md), [11](docs/PHASE_11_REPORT.md), [12](docs/PHASE_12_REPORT.md), [13](docs/PHASE_13_REPORT.md), [14](docs/PHASE_14_REPORT.md). Earlier reports cover [07–09](docs/PHASES_07_09_REPORT.md), [04–06](docs/PHASES_04_06_REPORT.md) and [00–02](docs/IMPLEMENTATION_REPORT.md). This does not mark phase 03 complete. Human comfort/balance sessions and target-device GPU measurements remain outstanding; scripted evidence is explicitly labeled. Asset sync and audit validate all 151 species' artwork and requested animations on this workspace; see [per-species coverage](docs/ASSET_COVERAGE.md). Downloaded image binaries remain ignored in version control. Run `npm run assets:sync` on a fresh checkout to reproduce the local cache. Without cached assets the renderer tries the documented remote sources, then keeps a visible generated fallback. Local availability is measured by the audit and can vary with the source hosts.

### Start here

```bash
npm install
npm run assets:sync   # Recommended: locally caches as many images/animations as available
npm run assets:audit  # Produces per-species coverage report
npm run dev           # Open http://localhost:5173
```

Optional gameplay QA: `http://localhost:5173/?dev=1` exposes `[`: gain level, `]`: advance two game-minutes, `\`: heal; `?dev=1&speed=5` accelerates simulation roughly 5× (for QA; not intended as a normal player setting).

```bash
npm run test        # Fast, deterministic logic tests (Node 22+)
npm run typecheck   # Full TypeScript check after npm install
npm run build       # Typecheck + production build
npm run preview     # Production bundle local preview
```

**Agent contract:** Read *this entire document*, inspect the repository, run the baseline tests and a real browser smoke test, and **implement only the requested next phase**. Do not rebuild the whole game, remove existing features, overwrite this document, or invent completion claims. At the end of each phase report changed files, decisions, tests, known issues and gameplay consequences. Favor small, verifiable commits.

---

## 1. The creative vision

**October 23, 2026 lighting/map follow-up:** All maps are a further 25% wider
and deeper (359.375 metres per side, +56.25% area over phase 15).
Directional sunlight, baked ground shade, layered atmospheric color and a
gradient sky improve depth; continuous scenic foothills/ridges close all sides
and corners beyond the soft/hard movement bounds. See
[the handoff](docs/LIGHTING_AND_MAP_EDGES.md) for implementation and verification.

**N1 movement presentation (October 21, 2026):** Renderer-owned travel sampling
drives grounded walk cadence and facing, preserves loop phase through stops and
attacks, and holds grounded frames during jumps. Walk foot anchors and contact
shadows follow the shared terrain; native hovering sheets retain their timing.
Controls, follower formation and simulation outcomes are preserved. See
[the N1 handoff](docs/N1_IMPLEMENTATION_REPORT.md) for evidence and limits.

**October 22 owner extension:** N1 additionally includes innate leader movement
techniques to distinguish kits: Run-up, finite hold-Space flight, Splash leap,
and the existing Abra teleport. Magikarp and Zubat are available through existing
finite achievements. Movement changes are visible in starter cards, the HUD,
pause, evolution previews and the catalogue. These mechanics were explicitly
requested after the initial presentation-only N1 implementation.

**N3 upgrade rework (October 21, 2026):** Attack speed keeps increasing actual
cast rate; haste no longer adds hit/heal strength. Iron Defense is removed.
Numeric relic bonuses and their drawbacks stack, including normal/Legendary
copies. See [the N3 audit and handoff](docs/N3_IMPLEMENTATION_REPORT.md)
for every upgrade disposition, uncapped stat/crit changes, verification and limits.

**October 21, 2026 follow-up:** Improvement entries N2 (paused evolution
presentation) and S1 (terrain/biome composition) are implemented. See
[the N2/S1 handoff](docs/N2_S1_IMPLEMENTATION_REPORT.md) for changed behavior,
validation, resource costs and remaining human review.

**Upgrade follow-up (October 21, 2026):** Percentage bonuses add against the base
stat: `100 * (1 + 0.05 + 0.10) = 115`. Training and relics now have very rare
Legendary variants, and upgrade cards preview current and resulting percentages.
See [the upgrade handoff](docs/LEGENDARY_UPGRADES_REPORT.md) and
[the current catalogue](UPGRADE_CATALOGUE.md).

The title and pause menus now include **Browse all upgrades**: a scrollable,
colour-coded catalogue grouped like the document, with search, filters, sorting
and expandable progression details. See [the menu handoff](docs/UPGRADE_CATALOGUE_MENU_REPORT.md).

### High concept

A low-poly third-person Pokémon action roguelite. Start with one first-stage Pokémon; fight swarms through mostly automatic attacks; explore a compact multi-biome woodland; pause completely when offered upgrades; slowly recruit new **first-stage Pokémon** and evolve them later; choose rare items that create extreme team builds; survive escalating variants and a final legendary encounter at 15:00. After winning, choose to end the run or continue endless.

**The critical hook:** *Your teammates are your weapons.* A new Pokémon is both a new character and a new attack pattern; improving its move increases that particular contribution to the team. Having three to four Pokémon at the end of an average normal-length run should be common. All six is a special late/endless achievement, not the baseline.

### Design pillars (ordered)

1. **Easy to play, rewarding to master:** Relaxed traversal, forgiving aiming, automatic attacks. Manual jump, dodge and a single Q ability for tactical spikes.
2. **Reward pauses:** Ordinary Pokémon levels happen during combat with small stat gains. Time, enemies, cooldowns and projectiles freeze for milestone, recruitment, elite and chest choices. No decision timer. Each upgrade card is clear, numeric where possible, and immediately noticeable.
3. **Escalating sensory impact:** Quiet green woodland and sparse enemies → stronger attackers and thicker crowds → visible synergies and big hits → one readable late boss; keep a hard VFX budget.
4. **Party-first builds:** Starter, recruits, evolutions, unlimited move training, global bonuses, one-time relics, elemental interactions, optional team compositions.
5. **Meaningful risk, not homework:** Up to five non-leading Pokémon can permanently faint for the run; teammates still attack automatically. No manual menu micromanagement, item crafting, resource inventory, or extraction routine.
6. **Cohesive low-cost art:** Low-poly environment primitives, light fog, sprite-sheet character animation, simple VFX shapes and concise UI.
7. **Deterministic, extendable tech:** Reusable archetypes and effects, seeded RNG, clean boundaries, testable pure simulation, no network calls in combat.

### Non-goals until the game is fun

Multiplayer, real-time Pokémon move PP / turns, overworld NPC quest trees, catch-rate minigames, full Pokémon status charts, every canon mechanic, evolutions outside original 151, 3D modeled monsters, an elaborate inventory, unlimited camera/gameplay options, and a backend database.

---

## 2. Locked answers from the 22-question design brief

| Design dimension | Decision |
|---|---|
| Camera | Behind-and-above, rotatable Megabonk-style camera |
| Controls | WASD, jump, dodge, Q special, E interact, mouse camera orbit |
| Attack aiming | Standard and learned attacks auto-target nearby enemies. Only directional or placed Q specials use mouse aim; lightning chains, orbiting effects and support specials remain automatic. |
| Starter roster | Small permanently unlocked roster, expanded by winning |
| Recruitment method | Level-up selection; mixture of guaranteed/time-gated and randomized availability |
| Recruitment pacing | First recruit after multiple minutes; typical 15-minute run ~4 total Pokémon |
| Evolution | Eligible evolutions reliably offered at personal level milestones after time + level prerequisites; evolution remains optional |
| Single-stage Pokémon | Strong starting profile and specialized growth options (future balancing pass) |
| Follower health | Followers can take damage and **faint for the remainder of the run** |
| Stats/type chart | Simplified arcade balancing; intuitive Pokémon type advantages |
| Enemy variants | Normal, Dark (vintage TCG style), Rocket-controlled, Rabid, Poisoned, Legendary |
| Variant special moves | Variants retain species types and shared move patterns; a variant of a tier-3 species becomes a tier-4 elite with a larger attack budget. Poisoned contact and the final boss retain their special behaviours. |
| Difficulty | Primarily advance species strength and variant threat over time, with gradual, bounded density growth |
| Build sources | Recruits, evolutions, upgraded moves, global items, synergies equally important |
| Late-game spectacle | Wild builds possible but readability and FPS protected |
| Maps | Forest/grassland, lake, rocky ruins and other compact themed areas on one interconnected map |
| Exploration | Chests, heals, shrines, elites and future secrets — optional, not objectives |
| 15:00 | Legendary boss; victory can transition into endless mode |
| Metaprogression | Unlocks, not grindy permanent power inflation |
| Difficulty | Casual early, rewards dodging and intelligent builds later |
| Platform | Desktop browsers first; mobile/controller only after quality gates |
| Publishing | Free public fan game is user goal, but has important IP uncertainty |

If a future agent interprets any default in contradiction with this section, **this section wins**.

---

## 3. Golden run: player experience and pacing

### First 2:45 — Find your footing

Player selects starter from an unlockable roster, appears in the forest, can freely orbit the camera, move, jump, dodge, trigger a Q special ability, and automatically attack nearby targets without aiming. Begin with three weak normal wild Pokémon at the fringes. Arrivals start roughly 2.8 seconds apart with an initial director budget of 18; one actor slot stays reserved for the scheduled boss. Arrival intervals and budgets change smoothly as the run progresses, without doubled batches. XP crystals and coins fall. Low density, gentle audio and VFX. Ordinary levels add 2% HP and damage without pausing; the first Pokémon choice arrives at level 3, followed by levels 5, 10, 15 and so on. Exploration items may be found, but nothing is mandatory.

Personal levels continue to **100**, with the leader targeting **25–35 at 15 minutes**. Evolution and significant new moves belong to the progression below level 45; from level 45 onward, milestones prioritize existing move upgrades and stat training. Level 100 is an extended-run goal, not the standard-run expectation. Aggregate squad progress remains separate from the leader's level.

### 2:45–7:00 — First partnership

First new Pokémon becomes available once **both** elapsed time and player level thresholds are met. Recruitment is chosen from three first-stage species. A follower occupies a formation slot, attacks automatically, and has its own HP. Its position and attacks are visible in the party HUD. Starter may become eligible to evolve after sufficient run experience/time. From 6:00, an occasional tier-3 miniboss can appear among the ordinary enemies; these are individual encounters with more durability and two attacks.

### 7:00–11:30 — Defining the build

Second teammate becomes available. Variants are more frequent. A player may choose to focus an Electric pair, boost a projectile-heavy squad, search for an optional chest, or deliberately evolve the leader. Progress feels visibly faster; teammates can faint if left in danger.

### 11:30–15:00 — High-intensity phase

Third teammate can be recruited if the player has reached the associated level. A **four-member party** is a reasonable target for successful standard runs. Upgrades get dramatic, while tier-2 enemies remain the ordinary population and occasional tier-3 minibosses supply tougher encounters. Tier-4 enemies, including variants of tier-3 species and legendary birds, only enter the ordinary arrival lottery from 13:00 and remain very rare. An arena-wide legendary warning precedes the much tougher Mewtwo boss at 15:00, when ordinary arrivals ease and new tier-4 arrivals stop to make room for the boss.

### Beyond 15:00 — Endless

Defeat Mewtwo; choose victory or continue. Fourth recruit eligibility at 16:00, fifth at 20:00. A full six-member party should feel like an achievement available mainly here. Further biome, boss and scaling improvements are on the roadmap. The system never requires six for the first boss.

### Current gates (one source of truth)

Located in `src/data/config.ts`:

| New recruit | Earliest clock | Earliest player level | Total team if nobody fainted |
|---|---:|---:|---:|
| 1 | 2:45 | 4 | 2 |
| 2 | 7:00 | 9 | 3 |
| 3 | 11:30 | 15 | 4 |
| 4 | 16:00 | 22 | 5 |
| 5 | 20:00 | 29 | 6 |

These gates are tuning targets, not promises that every playthrough hits them exactly. Recruitment opens **when eligible, after any current choice**, without spending a Pokémon milestone. Minimum levels use aggregate earned squad progress. Every living teammate receives full shared XP and levels independently; Exp. Share boosts teammates below the leader's level. Pokémon milestones prioritize existing moves and stat training, with occasional new moves after extra slots unlock at personal levels 10, 20 and 30, plus eligible evolution; elite/boss rewards offer squad training. Enemy coins fund supply chests, while free caches and rare enemy drops award relics. Adjust using session telemetry; do not hardcode unlocks in UI code. Recruitment remains first-stage only. Branching species show every evolution plus an option to keep training. See [the current progression rules](docs/UPGRADE_REWORK.md).

---

## 4. Core interaction and combat rules

**Controls:** FPS-style mouse look automatically captures/hides the cursor when starting, resuming or choosing an upgrade. Camera rotation uses relative mouse deltas only while the browser actually owns pointer lock. Escape pauses and releases capture; click Resume to capture again. Lost or blocked capture keeps the game paused with a visible retry message. Moving the mouse up looks toward the horizon by default; invert-Y reverses it. WASD moves relative to the camera (A left, D right); the wheel zooms. Space jumps. Shift dodges in the initial input direction with a cooldown and temporary invulnerability. Q activates the leader's special on cooldown. E interacts within `DESIGN.interactionRadius`. Numeric keys select paused level-up options. One press activates one action: holding Q, Shift or Space does **not** automatically repeat it. Camera sensitivity and invert-Y persist locally and can be changed on the title and pause screens.

**Input invariants:** Inputs are sampled once per visual frame. Simulation updates are dt-limited. Pausing halts all movement, enemy AI, cooldowns, projectiles, XP collection and timer. Blur pauses; resumed play should not retain stuck movement keys. Menus cannot accidentally activate in-world input. Entity IDs are unique and monotonic within a run.

**Mouse capture reliability:** Starting and resuming request raw relative pointer movement (`unadjustedMovement: true`) to avoid the adjusted cursor path during long camera swipes. `src/game/pointerLock.ts` retries standard pointer lock if raw movement is unsupported, preserves permission-denial handling and prevents cancelled requests from starting a fallback. This is a mitigation for reported trackpad stalls; physical trackpad verification remains outstanding. Automated tests for this change use simulated API responses without capturing the desktop cursor.

**Targeting:** Every party member's primary and learned attacks select nearby enemies automatically, regardless of camera direction or movement. Mouse look supplies aim only to directional Q specials (cones, waves, fans, dashes and lances) or placed Q fields (garden, powder and hex). Thunder Circuit, orbiting Foxfire and healing remain automatic. The aiming mode for each special is explicit in `src/data/specials.ts`.

The October 20, 2026 targeting correction and verification are recorded in [the auto-aim follow-up](docs/AUTO_AIM_FOLLOWUP.md).

**Combat model:** Each party member has one named primary auto-attack defined by a reusable archetype: bolt, burst, slash, aura, chain, beam, lob, heal. The engine uses shared implementation; Pokémon IDs only select parameters and VFX. Damage may scale with a simplified element advantage. Optional status interactions include wet + electric, poison + fire, etc. Do not copy canon turn-based moveset rules.

**Follower risk:** Approximately one in five enemies currently targets a follower. A leader death ends the run; a follower falling to 0 HP permanently removes it from the active party (and the run's build). No resurrection in the initial ruleset. Healing springs and support Pokémon may heal followers. Recruitment gating counts recruits made over the run, not how many living team slots remain, to avoid reroll exploits after faints.

**Variant definitions:**

| Variant | Visual change | Stat change | Special mechanic |
|---|---|---|---|
| Normal | Standard sprite | Baseline | None |
| Dark (TCG) | Cool tint and outlined diamond | 1.5× durability/power, slightly faster animation/aggression | Keeps the species' actual types; no novel attack |
| Rocket | Muted red tint and outlined R | 1.7× durability/power, 1.03× speed, increased aggression | Modified Pokémon; no trainer or novel attack |
| Rabid | Warm tint and double chevron | 0.82× durability, 1.75× movement speed, increased aggression | No novel attack |
| Poisoned | Green tint and droplet glyph | 1.3× durability/power | Contact applies 4.5s poison to leader or follower; persists after separation |
| Legendary | Crown glyph and boss HP bar | Explicit boss HP/damage/speed tuning | Four-attack boss cycle with readable, pausable windups |

The exact multipliers are provisional and are intended to be tuned with real-run metrics. Avoid bloated variant subclasses or bespoke moves for Dark/Rocket/Rabid. Their additional attack slots come from encounter tier and reuse the authored shared patterns.

**Enemy strength and encounter progression:** Every species has an authored arcade profile for encounter strength, visible size, health, damage, speed and relative rarity. Evolution stage and natural strength determine its encounter tier; the species profile still distinguishes combat power and size within a tier. Bulky single-stage Pokémon can be tougher and visibly larger than small evolved species. Size uses a compressed visual scale to keep very large or long Pokémon readable. Species identity combines with tier durability, variant combat modifiers and time/party scaling when an enemy is created.

Ordinary encounters use overlapping strength pools and a moving weighted threat window. Weak species dominate the opening, then taper out as slightly stronger species become eligible. Normal Rattata, Caterpie, Weedle and Magikarp stop arriving at 3:00; enhanced versions remain eligible longer because their added threat counts toward progression. Tier-2 enemies remain the majority later in the run, rather than every arrival becoming a final evolution. Existing living enemies remain in the world when their arrival window closes.

| Encounter tier | Species and variants | Attack budget | Ordinary arrival budget |
|---|---|---|---|
| 1 | Weak unevolved species | 1 | Sparse opening; weakest normal species retire by 3:00 |
| 2 | Middle evolutions and other ordinary species | 1 | Main population after the opening and throughout the late game |
| 3 | All third-stage evolutions; fully evolved two-stage or single-stage species with authored strength at least 6 | Up to 2 distinct attacks | Starts at 6:00 with a 1% tier roll, growing smoothly to 5% at 14:00; at most 3 alive, with at least 18 seconds between arrivals |
| 4 | Every non-normal variant of a tier-3 species, legendary birds and Mew | Starts with 2; strong encounters can gain a third at 14:00 and a fourth in endless or very hard shrines | From 13:00; tier roll grows to 0.3% at 15:00, plus the separately bounded legendary lottery; at most 1 alive, with at least 60 seconds between arrivals; no new arrivals during Mewtwo |
| 5 | Mewtwo and explicitly scheduled bosses | 4 | Scheduled encounter outside the ordinary lottery |

Tier-3 enemies are minibosses with substantial added durability and two alternating attacks. Tier-4 encounters receive a larger durability increase, and require a deliberate fight even for a developed party. Time-based health floors and bounded party scaling support this distinction; displayed HP depends on the species, variant, elapsed time and party investment rather than one fixed promised value. Mewtwo has a further major health and damage increase beyond tier-4 enemies.

Tier-4 attack progression also depends on strength: an enemy with authored strength at least 8 may carry three attacks from 14:00. A strength of at least 9.5 unlocks four attacks from 18:00 in endless. Shrine tiers 13–15 can grant four attacks to strength-8 or stronger legendary guardians before that clock gate. Earlier shrine guardians retain their natural combat rank; shrine Mewtwo uses rank 4 without becoming a scheduled boss. Attacks cycle through readable windups rather than firing all unlocked moves simultaneously.

Shrines have [15 authored species tiers](docs/SHRINE_TIERS.md), with stone Pokémon sculptures, coloured magic dust, recommended levels 5–90, varied guardian counts and arena sizes, and telegraphed poison, fire and slow ground. Nearby previews show the actual encounter. The leader must be within 10 levels of its recommendation. Opening fights target 20–35 seconds with specials; later fights target 15–45 seconds depending on the build and matchup. Guardians award 2–3× equivalent wild XP, adjusted by ±2.5% per level of difference, capped at ±25%.

Naturally stronger ordinary species award more XP to preserve personal progression with fewer arrivals. Tier-3 minibosses and tier-4 elites receive a further shared XP multiplier to compensate for their durability; explicitly promoted shrine guardians use their actual combat tier. Weak opening rewards and scheduled boss rewards retain their established values; species, tier, faction and elite bonuses apply once to the shared instant/drop reward total.

Ordinary species strength plus variant threat must fit the elapsed threat ceiling, currently `2.4 + elapsedSeconds / 85`. Eligible encounters ease into the pool and retain species rarity weights, alongside the tier gates and arrival budgets above. For example, Dragonite has strength 10 and a relative rarity weight of 0.12; Rocket adds 2.2 threat, so a Rocket Dragonite only begins to become eligible after about 13:53, then must pass the rare tier-4 lottery, alive limit and spacing checks. Random ordinary wild elites require another 2.5 threat and cannot appear before 3:00. Rare legendary elites, optional landmark guardians and the scheduled boss follow their own authored gates outside the ordinary threat window. These are tuning values, not official Pokémon stats or guaranteed encounter times.

---

## 5. Systems and content framework

### Data ownership

- `src/data/kanto.ts`: source-of-truth for ID, Generation 1 name, primary/secondary type, stage, parents/children, game attack archetype and move label. All 151 IDs must resolve without fetching PokéAPI.
- `src/data/enemySpecies.ts`: per-species encounter strength, visible size, health, damage, speed and rarity profiles, independent of evolution stage.
- `src/data/enemyTiers.ts`: evolution/strength tier classification, variant promotion, miniboss and elite arrival budgets, durability tuning and time/strength attack limits.
- `src/data/config.ts`: run timer, recruitment time/level thresholds, movement, entity budgets, type multipliers and tuning constants.
- `src/data/attacks.ts`: eight attack archetypes, species overrides, elemental procs and rank growth.
- `src/data/rosterContent.ts`, `encounters.ts`, `evolutions.ts`, `validateRoster.ts`: 151 authored loadouts, overlapping strength pools and weighted threat windows, named adaptations and independent roster validation.
- `src/data/progression.ts`: evolution maturity, rarity weights, gradual move-slot unlocks and training definitions; recruitment gates remain in `config.ts`.
- `src/data/items.ts` and `src/data/synergies.ts`: passive item rules, ownership, tradeoffs and team composition requirements.
- `src/data/variants.ts`: faction multipliers, added encounter threat, reward XP, rarity, poison, animation and identifying glyph tuning.
- `src/data/world.ts`: four biome palettes, landmark anchors, site spacing and soft boundaries.
- `src/data/director.ts`: timed arrival interval/budget landmarks, faction weights and Mewtwo tuning.
- `src/game/types.ts`: all run-state models, entity types, choice schema and normalized fields.
- `src/game/Simulation.ts`: authoritative single-player game simulation: inputs, enemy/party behaviour, damage, pickups, level-ups, win/loss.
- `src/game/combat/`: targeting, swept projectile collisions, shared attack patterns, damage and statuses.
- `src/game/systems/progression.ts`: generates upgrade offers, evaluates recruitment/evolution and applies choices.
- `src/game/systems/builds.ts`: generic event-driven build rules, modifiers, proc budgets and readable build summaries.
- `src/game/systems/spawning.ts`: variant-aware encounter selection, elite threat eligibility, per-species enemy stats and distant spawn placement.
- `src/game/systems/director.ts`: smoothly interpolated arrival intervals/budgets, faction weights, pressure/density adaptation and telemetry; swept radial-wave collision.
- `src/game/systems/environment.ts`: shared seeded POIs, clear routes, biome/terrain queries, rare optional hooks and static collision.
- `src/game/render/World.ts`: low-poly terrain, vegetation instances, POI geometry and region colors; game logic must not live here.
- `src/game/render/AssetLibrary.ts`: sprites/animations from SpriteCollab/official artwork, resilient fallbacks and caching.
- `src/game/render/Effects.ts`: projectile/drop meshes and transient hit indicators.
- `src/game/Game.ts`: engine lifecycle, keyboard/camera inputs, update/render, scene and save coordination.
- `src/game/audio.ts`: original procedural cues, ambient motif, gesture unlock, voice limits and audio lifecycle.
- `src/game/feedback.ts` and `src/data/feedback.ts`: bounded impact shake/hit pause and comfort overrides, independent of simulation RNG.
- `src/game/settings.ts`: sanitized camera, sound/music, comfort and graphics settings; partial writes preserve other preferences.
- `src/game/graphics.ts` and `performance.ts`: automatic/manual pixel/effect profiles and bounded opt-in development diagnostics.
- `src/ui/UI.ts` and `src/style.css`: start screen, upgrades, HUD, mini-map, pause, result and endgame actions.
- `src/ui/minimap.ts`: north-up square projection and symbol placement with overlap protection.
- `src/ui/upgradeIcons.ts`: local SVG icons for shared attack, item and training categories.
- `src/game/save.ts`, `achievements.ts`, `src/data/unlocks.ts`: version-two migration, finite collection rewards and actual run accounting, with no permanent stat bonuses or network account.
- `src/ui/UnlockLibrary.ts` and `unlocks.css`: collection progress, route/rule selection, earned rewards and reviewed JSON backup/import.
- `scripts/balance-telemetry.mjs` and `scripts/lib/`: deterministic headless experiments, JSON/CSV summaries/replay and manually armed real-session recording; not imported into production.
- `scripts/reliability-profile.mjs`: reproducible thirty-minute endless CPU/state/memory stress, separate from rendered GPU performance.
- `scripts/sync-assets.mjs`: optional developer-time local asset mirroring and report.
- `tests/simulation.test.ts`: deterministic gameplay invariants independent of WebGL.

### Entity and performance rules

- **Simulation is authoritative**, never infer gameplay health, time, type or damage from Babylon meshes.
- Render visual IDs map to simulation entity IDs. Destroy stale meshes/sprites when corresponding entities are removed.
- Assets are lazy-loaded and shared by species and animation, not duplicated for every actor. Fallback art must be visible while animations are loading or fail.
- Use mesh instances / shared primitives for terrain detail. Keep enemy collision cheap; use spatial hashing only when profiling justifies it. Never add a rigidbody for each XP crystal or wild Pokémon.
- Keep gameplay updates independent of frame rate. Limit per-frame steps after tab regain; no multiplying combat damage with FPS.
- Seed procedural spawn and landmark placement; avoid `Math.random()` inside deterministic combat logic.
- **Never** fetch PokéAPI in the combat loop. Offline local species data is authoritative; API data may enrich species labels or credits at build time.
- All arbitrary asset URLs must be user/developer-approved and from documented sources; do not scrape or hotlink unknown third-party asset sites.

### Combat readability follow-up (2026-10-18)

- Player and nearby enemies have thin, outlined world health bars. Muted green identifies the player; muted red identifies enemies. At most 24 enemy bars appear within 28 units, with no added labels, damage numbers or flashes. Shared instances read authoritative HP and follow camera/jump movement; loaded sprite bounds reserve stable clearance above attack poses.
- Party attacks retain target facing and play once across their simulation attack window. Player and enemy attack sprites also gain restrained anticipation, melee lunges, ranged recoil or casting lift, followed by recovery. Native sheets retain their original motion with smaller additions. Enemy windups hold readiness and flow directly into release; reduced motion suppresses the additions. Directional, pooled crescent sweeps accompany slashes. Damage and cooldown rules are preserved.
- Opening and regular waves spawn 24–34 units from the player; scheduled bosses spawn 30–38 units away. Bounded sampling and an inward fallback preserve distance near arena edges. Spawn cadence and entity limits are preserved.
- Visual tuning lives in `src/data/config.ts`; spawn placement lives in `src/game/systems/spawning.ts`. These requested refinements do not mark later roadmap phases complete.

Audio refinement (2026-10-19): `src/data/audio.ts` owns species tonal profiles and an original 100 BPM musical phrase. Simulation emits successful `cast`, `jump` and `dash` events; visual chains and projectile effects do not retrigger party attack audio. Enemy defeats use a quiet, shared-budget pop. Sound/music reserve 8/4 voices within the existing 12-voice maximum; distance attenuation, overlap attenuation and shared impact timing keep crowds restrained. Existing quiet volume defaults and gesture/pause lifecycle remain. Verification and listening limitations are recorded in [audio polish](docs/AUDIO_POLISH.md). This is a requested audio refinement, not completion of a new roadmap phase.

Attack animation integration (2026-10-20): Party body poses now follow the actual learned move or special being cast. Overlapping automatic casts share a complete body motion while retaining independent damage, effects and cooldowns; Q starts its own pose immediately. Slash effects retain their own aim, and forward dash/trail damage is clipped ahead of its origin. Native sheets and reduced-motion behavior are preserved. Recovery notes, verification and remaining limits are in [the animation follow-up](docs/ATTACK_ANIMATION_FOLLOWUP.md).

### Future data schema

For future content expansion, migrate species definitions to JSON content packs validated by Zod or TypeBox at load time. Suggested example:

```json
{
  "id": 25,
  "displayName": "Pikachu",
  "types": ["electric"],
  "evolution": {"options": [{"id": 26, "minRunLevel": 15}]},
  "role": "chain-dps",
  "attack": {"kind": "chain", "range": 10, "cooldown": 1.1, "baseDamage": 13},
  "special": {"kind": "radial-shockwave", "cooldown": 16},
  "asset": {"pmdId": "0025", "fallbackArtId": 25}
}
```

JSON values shown are example design data, not canon stats. Version schemas, write data migration scripts and validate *all* 151 records in CI before adding complex content packs.

---

## 6. Baseline feature inventory — what's in the repository now

**Implemented in source:**

- Real Babylon.js world with generated rolling terrain and low-poly, instanced props.
- Open meadow, Pinewood, Old Ruins and Lake Edge; shared rolling terrain, Great Pine/Broken Gate/Watchstones/Stillwater landmarks, safe spawn, clear site approaches, pond collision and soft square boundaries.
- Twelve seeded optional caches/shrines/heals/elite sites, three rare event hooks and a north-up biome minimap with distinct symbols and overlap protection.
- Free third-person camera, walking, jumping, Shift dodge with iframes and Q special.
- Level-up modal with 3 choices and full simulation pause.
- Authoritative 151 Generation 1 species catalog and evolution connections.
- SpriteCollab idle/walk/attack animation metadata loader, artwork fallback and generated canvas fallback.
- Party follower formations, auto-attacks, per-teammate HP and permanent fainting.
- Data-driven bolt, burst, slash, aura, chain, beam, lob and heal attacks with species parameters and rank growth; boss volley and elite slam windups; capped, reused projectile/effect visuals.
- A three-enemy opening, smoothly increasing arrival pressure through 3/7/11/13-minute landmarks, lower ordinary arrivals during the 15-minute boss, adaptive future-arrival budgets, runtime faction weights, spawn telemetry and bounded endless scaling after victory.
- Species-specific enemy strength, size, bulk, damage, speed and rarity; weak normal arrivals retire by 3:00, tier-2 enemies remain the main population, tier-3 minibosses begin sparsely at 6:00, and tier-4 encounters stay rare until the final two minutes or very hard shrines.
- Data-driven Dark/Rocket/Rabid/Poisoned factions with non-color glyphs, correct XP and persistent contact poison; normal factions retain shared attacks and species types.
- Mewtwo warning before 15:00, a four-attack cycle with pausable/stunnable tells, substantially increased boss durability/damage and no new ordinary tier-4 arrivals during the fight.
- Time- and level-gated first-stage recruitment; non-pausing personal levels and choices at levels 3, 5, 10, 15…; reliable optional milestone evolution (including branches).
- 36 unique passive items, 12 composition synergies and seven build event hooks; item tradeoffs, stat/proc caps and pause/result build summaries.
- Nine global training upgrades that stack indefinitely; signature and learned moves also have no rank ceiling. Each stat has Common, Rare and Epic versions worth 1×, 2× and 3×, with base rarity odds of 55%, 35% and 10%. Extra move slots unlock at levels 10, 20 and 30, with new-move offers appearing on 30% of eligible milestones that have room alongside training and evolution. Team-only relics require a living teammate. Evolution grants +25% maximum HP, +25% permanent attack damage and +1 rank to every known move. Non-evolving species gain +2 ranks per move training choice from their own level 5.
- Free treasure caches, coin-funded supply chests, enemy coin/item drops, shrines, healing springs and elite squad-training rewards.
- Win/loss screens, endless continuation, unlocked starter progression and local saves.
- Clear health/XP hierarchy, numeric party HP/critical and permanent-faint notices, cooldown-ready feedback and numeric upgrade cards with semantic icons.
- Original quiet synth cues and a gentle ambient motif; gesture unlock, independent volume sliders, bounded voices and complete pause/blur cleanup.
- Minimal special/incoming-boss impact shake and 30–40ms hit pause; independent toggles, reduced flashes, system reduced-motion override and buffered action input.
- QA dev flags, deterministic simulation tests, optional local 151 asset sync.

**Verification:** See [the phase 10 report](docs/PHASE_10_REPORT.md) for current automated/browser verification; earlier reports retain their historical results. Asset availability is documented per species. Balance, subjective listening/comfort over human 15-minute sessions, fuller screen-reader alternatives, mobile controls and target-hardware performance remain future work.

**Current simplifications to refine:** special ability remains a shared type-damage radial pulse; species moves reuse eight archetypes; biome layout is authored/random-decorated; some single-stage Pokémon need more differentiated roles; static collision currently covers the player against tree trunks, boulders and ruins; healing/invulnerability need balancing. Requested PMD states are audited with alias-aware metadata and source timing. Official artwork and generated fallbacks remain visible while sheets load.

This transparency is intentional. A future coding agent should never mistake a roadmap goal for a feature already complete.

---

## 7. Acceptance criteria for a complete first public-facing playable build

**Core (mandatory):**

1. `npm install`, `npm run typecheck`, `npm run test` and `npm run build` all succeed on clean checkout, with a documented Node version.
2. New player can open a starter selection, select a Pokémon and move, jump, dodge, pause/resume and fire one Q ability without console errors.
3. All 151 IDs have valid catalog entries and a visible character fallback. Verify sprite/animation success metrics across the 151; list missing PMD animations explicitly rather than silently claiming complete coverage.
4. All gameplay continues only while unpaused. Screens never show enemies moving behind upgrade menus.
5. Recruitment cannot happen before 2:45; an ordinary 15-minute run can plausibly end with four team members; five/six are late or endless.
6. Recruit list never contains a second/third-stage Pokémon, and no team member evolves without the corresponding chosen evolution card.
7. Teammates visibly lose health, can permanently faint and leave the formation; player defeat ends run.
8. Dark/Rocket/Rabid/Poisoned are visually identifiable and functionally distinct; tier-3 minibosses can carry two attacks, tier-4 elites can carry up to four under the time/strength/shrine gates, and Mewtwo cycles four telegraphed attacks.
9. At 15:00 spawn legendary Mewtwo; defeating it opens victory or endless. Endless preserves the squad and upgrades.
10. Full 10–15-minute playthrough retains at least a target 50+ FPS at 1080p on a mid-range desktop GPU, configurable based on actual performance testing.

**Polish (next quality gate):** early combat readable at 1080p, at least 2 fundamentally different viable builds, clear enemy hit feedback, no unbounded memory growth after restarting 10 runs, audio obeys browser gesture/autoplay restrictions, options include effects/audio toggles, damage telegraphs remain visible amid late-game VFX.

---

# 8. Sequenced Claude / Codex implementation prompts

**Workflow:** The steps below are executable assignments, not loose suggestions. Use one prompt at a time, in order. Put this document in the repo and tell your agent to read it each session. The first three prompts are **mandatory validation/fix phases** for this supplied prototype, not feature expansion. Mark acceptance criteria with actual observed evidence, not assumptions.

## Phase 00 — Clean checkout, honest verification (first prompt)

```text
You are the senior lead engineer responsible for Pokémon Wildlands. Read the entire GAME_DESIGN_AND_ROADMAP.md and inspect the existing Vite/TypeScript/Babylon.js project. Preserve architecture and current functionality. Install dependencies on Node 22+, run npm test, npm run typecheck, npm run build, start npm run dev, and use Chromium/Playwright to complete the following real smoke test: title screen -> select starter -> scene renders -> WASD/camera/jump/dodge/Q -> an enemy takes damage -> a level-up pauses fully -> choose card -> E landmark interaction -> ESC pause/resume -> restart. Fix every runtime/API/TypeScript issue you find. Do not replace Babylon with another engine. Log exact errors and the fixes. Run tests again. Add minimal Playwright smoke automation and screenshots in an ignored artifacts folder. Exit criteria: clean build plus demonstrated real browser gameplay; document any asset-network-dependent limitations. Do NOT claim 151 PMD sheets are complete without auditing them.
```

## Phase 01 — 151-Pokémon asset coverage and animation accuracy

```text
Audit AssetLibrary.ts, SpriteCollab AnimData.xml parsing and SpriteManager atlas usage. Run npm run assets:sync with internet and inspect the manifest and failure report for all 151 Kanto IDs. Verify sprite orientation, 8-direction row mapping, animation frame counts, frame duration, attack/walk fallback and sprite scale across at least 25 representative Pokémon (tiny, large, multi-stage, flying, legendary, Eevee branches). Prioritize local cached assets, then remote asset host, then official artwork, then generated visible fallback. Confirm no invisible actors or repeated network loops on failed animation loads. Add a small in-app dev asset gallery browsable by species ID and state, accessible only ?dev=1. Do not claim unavailable animations exist; produce an asset coverage report with per-species idle/walk/attack checks. Add image attribution metadata and source URLs. Success: every 151 ID is visible, missing PMD animations degrade gracefully, and loaded PMD atlases animate at correct timing.
```

## Phase 02 — Camera, movement and environmental collision feel

```text
Make the player controller feel as smooth and precise as a polished lightweight roguelite while preserving WASD + Space + Shift + Q + E. Inspect input tap events, relative-camera movement, acceleration/deceleration, dodge direction and i-frames, jump arc, ground height and camera smoothing. Add coyote time only if useful, no sprint or stamina mechanic. Stop player walking through large obstacles without introducing heavy physics; use low-cost collider primitives. Preserve useful vertical terrain. Add player ground contact and simple footstep/dodge particles. Implement mouse sensitivity and invert-Y settings as small persistent options. Success: 10-minute movement session has no jitter, clipping into ground or sudden camera jumps, no repeated Q while key is held, and camera still supports casual exploration.
```

## Phase 03 — Character visuals, formations and follower survival

```text
Refine six-member formation around the controlled leader. Keep follow motion non-physics, smooth and collision-light. Enemies may preferentially attack the leader, but some intentionally threaten followers. Implement readable follower HP/damage feedback, clear permanent faint animation and party slot removal, plus recovery from healing support or map healing before faint. Add group spacing heuristics to prevent dense sprite overlap and ground billboarding issues. Fix sprite facing when the camera rotates without movement. Ensure the entire system stays O(team_size) per frame, and changes do not rewrite Simulation. Write deterministic tests for fainting and formation changes. Success: multiple simultaneous squad members are visually distinguishable; one follower can faint without corrupting upgrade, targeting or later recruitment gates.
```

## Phase 04 — Data-driven attack archetypes and readable combat

```text
Separate attack calculations, target acquisition, projectile spawn, elemental status and visual events currently in Simulation.ts into cohesive, testable combat modules. Preserve the eight archetypes (bolt/burst/slash/aura/chain/beam/lob/heal), but allow data-configurable cooldown, projectile count, piercing, AoE radius, special hit proc, range and growth per Pokémon. Add explicit enemy windups and projectile silhouettes for hard hits. A friendly attack must not damage friends; enemy projectiles must not teleport. Add pooled/reused visuals. Keep arcade-like simplified Pokémon strengths, not the canonical full combat simulator. Implement no fewer than three noticeably different attack patterns and test projectile penetration, chain target uniqueness, DoT, slow and team synergies. Success: attacks are easy to read and satisfying even without audio.
```

## Phase 05 — Recruitment fairness, evolution and level-up economy

```text
Treat progression.ts/config.ts as the only source of recruitment/evolution timing and upgrade availability. Preserve recruitment from first-stage Kanto species ONLY and the 2:45 / 7:00 / 11:30 / 16:00 / 20:00 gates plus minimum levels, pending a tuning experiment. Mix scheduled eligibility with randomized candidate pools; no recruit choice before eligible. Handle no free slots and teammate faints. Evolve only via selected level-up choices after time/level conditions; support every Kanto branch (Eevee's Vaporeon/Jolteon/Flareon) with multiple explicit cards and avoid repeated stale choices. Every non-evolving species must have a viable growth plan. Add an upgrade taxonomy, rarity distribution, unlimited training, duplicate protection, and invalid-choice guards. Test expected team sizes over seeded simulated runs. Success: standard 15-minute runs average ~4 living party Pokémon for competent casual players and six is largely an endless achievement.
```

## Phase 06 — Deep build variety without bloating controls

```text
Expand items and synergy rules while preserving one leader ability and automatic squad attacks. Implement an event-driven effect system (onAttack, onCrit, onHit, onDeath, onSpecial, onRecruit, onEvolve) with ownership, stacking rules, caps and clear UI descriptions. Design at least 30 meaningful passive items and 8 meaningful team synergies; avoid a separate special-case function per item. Include at least two build-defining tradeoffs, e.g. slower attack speed for very high damage, or stronger unevolved teammates at the expense of evolution bonuses. Validate 'broken' combos against target FPS and visual spam caps. Add build summary at pause/end screen. Success: at least three viable archetypes (chain lightning, wide AoE, crit burst) feel different across multiple runs and work with a wide range of species.
```

## Phase 07 — Enemy factions and special variant behaviours

```text
Keep the five intended enemy kinds: normal, TCG-inspired Dark, Rocket-controlled, Rabid, Poisoned, plus Legendary as boss-tier. Dark/Rocket/Rabid must NOT gain novel attacks: they only change stats, animation speed/AI aggression and subtle readable visuals (TCG Dark style is NOT a Dark-type chart change). Rocket means a modified Pokémon, not an actual Rocket trainer character. Poisoned gets persistent poison status and optionally a small temporary poison hazard. Legendary bosses may have unique attacks with visible tells. Implement a data-driven variant multiplier definition, correct reward XP and spawn rarity, and a non-color-only visual cue so color-blind players can identify variants. Success: distinct variants are recognizable instantly but do not introduce content maintenance for each species × variant.
```

## Phase 08 — Multi-biome map polish and useful exploration

```text
Take the existing roughly 230×230m map and create a cohesive low-poly multi-biome space: open meadow/spawn, shadowy woodland, rocky ruins, lake edge. Establish natural navigational landmarks and modest rolling hills without procedural dungeon networks. Add soft collision boundaries, safe spawn region and scattered optional chests/shrines/healing/elite sites. Randomize encounter and treasure placements using the run seed. Add rare event hooks but NO quest checklist or mandatory objectives. Improve minimap clarity and anti-overlap. Avoid one mesh per blade of grass; keep instance sharing. Success: the player has optional directions worth exploring but can also remain around the starting area and still play a full run.
```

## Phase 09 — 15-minute pacing, legendary boss, endless difficulty

```text
Instrument the difficulty director with run-time spawn weights, entity-budget adaptation and phase transitions at ~3, 7, 11, 13 and 15 minutes. Gradually raise spectacle while keeping accessibility. Build a polished Mewtwo boss with 3 clearly telegraphed behaviours: aimed volley, expanding psychic ring, brief summon/charge phase. The boss must have readable HP and spawn warning. On death, present victory with the option to end or continue endless while retaining all accumulated items, party HP, species and upgrades. Increase endless difficulty, offer late fifth/sixth team slots, optionally schedule subsequent bosses. Success: 15-minute run has a distinct dramatic arc, final challenge fair to a 3–4 Pokémon team and endless stays playable beyond 20 minutes.
```

## Phase 10 — UX, upgrade pause and sound

```text
Polish existing screens rather than rebuilding them from scratch. Prioritize game readability: improve HP and XP hierarchy, party faint warnings, cooldown ready feedback, level-up cards with numeric descriptions, rarity color used sparingly and clear item/attack icons. Implement a short audio system using original sounds / appropriately licensed material, with sound and music sliders (default quiet), browser autoplay compliance, no duplicate audio events during pause. Add minimal screen shake and hit-stop on special/boss hits, toggleable in settings. Respect reduced motion. Success: the experience is understandable within 30 seconds without a tutorial wall and remains relaxing for most of the run.
```

## Phase 11 — Kanto roster completion and content balancing

```text
Audit all 151 species IDs against the original Gen 1 roster, types, evolution graph and SpriteCollab art. All must be representable as enemies in some spawn table, not just data entries. Ensure playable first-stage recruitment excludes stage-2+ forms but permits Kanto single-stage species when unlocked, with legendaries boss/rare-only. Introduce a curated data file for per-species attack parameters, roles and a small number of unique signatures while continuing to reuse attack archetypes. Make each evolved species feel stronger without implementing 151 handcrafted abilities. Ensure Eevee branch choices, trade evolutions and stone evolutions work with adapted game-specific run requirements. Balance extreme stat disparities to make weak starters viable. Add validation scripts for missing IDs, invalid evolutions, missing animation assets and duplicate move entries. Success: a content QA view can load/test every species and variant without exceptions.
```

## Phase 12 — Run metrics, balance experiments and difficulty tuning

```text
Build a local development-only simulation/telemetry harness that can run hundreds of deterministic seeds with configurable scripted player behaviors, without opening a WebGL scene. Track time per level, kills/minute, HP lost, follower faint rate, recruit offer times, party size at 15m, evolution count, item rarity, boss outcome and longest period without meaningful upgrades. Generate summary tables and optional CSV/JSON reports. Use real playtest sessions to calibrate: typical living party ~4 at 15m; first recruit never before 2:45; no long stretches of zero upgrades; early game calm; late game clear; victory rate reasonable for a casual player with dodging. Do not force mathematically 'perfect' fairness at the expense of fun. Success: balance changes are tied to measured hypotheses and regression checks.
```

## Phase 13 — Reliability, performance and memory tests

```text
Profile a long session with 200+ enemies, projectile caps, 6 follower sprites, 30 minutes of endless, and 10 consecutive restarts. Instrument active mesh counts, sprite managers, texture count, drop count, projectile count, JS heap and frame time. Avoid per-frame DOM rebuilding, redundant Vector3 allocations, animation requests on every frame, and global event-listener leaks. Replace high-volume collision scans with spatial partition only where profiling demonstrates a hot path. Add fixed-timestep accumulator / bounded substeps with interpolation if necessary. Add settings for graphics quality, VFX density and resolution. Success: stable memory and predictable FPS on agreed target hardware; no indefinite growth after restarting and no crashes from missing textures.
```

## Phase 14 — Meta-unlocks, achievements and save migration

```text
Expand the versioned local save schema without disrupting existing saves. Permanently unlock new starter options, item pool entries, maps and challenge modifiers via run accomplishments. Do NOT create a grinding system of infinite global +damage/+HP bonuses. Add a compact unlock library and 8–12 achievements, e.g. reach 15:00 with a Poison team, defeat 100 Rocket variants, survive 20 minutes endless, evolve both leader and a follower. Protect against damaged saves with schema migration and fallback. Support export/import save JSON as an optional user tool. Success: progression creates reasons to replay without trivializing combat.
```

## Phase 15 — New maps, bosses and replay hooks

Implemented 2026-10-20, including the requested 25% expansion of every map. See [the phase 15 handoff](docs/PHASE_15_REPORT.md) for scope, exact verification and limitations.

```text
Create a clean MapDefinition and EncounterDefinition registry so new maps reuse the same movement/combat/progression engine. Add one fresh map (e.g. volcanic ridge or coastal marsh), not a massive open world, with a new environment palette, geography, spawn weighting, unique optional landmarks and legendary encounter. Ensure quality/pacing remains consistent. Add 2 challenge mutations (enemy speed +20%, no healing, etc.) and one alternate boss. Keep art cheap, mostly primitives and reusable materials. Success: maps can be added without changing core Simulation combat logic.
```

## Phase 16 — Accessibility, input support and player comfort

```text
Implement key rebinding, camera inversion and sensitivity, color-blind-safe variant indicators, reduced flash/shake, VFX density slider, volume sliders, readable font sizes and full keyboard operability on all menus. Audit high-contrast text and focus outlines. Only then prototype controller mapping through the same input abstraction; postpone mobile until touch UI can be supported without compromised readability. Success: every essential action can be performed without mouse-click targeting and screen effects are optional.
```

## Phase 17 — Release engineering and content/legal checklist

```text
Prepare a clean production Vite deploy (DigitalOcean static/nginx or other static host), asset cache strategy, integrity and 404 fallback tests, source attributions page, copyright acknowledgement, privacy/no-analytics note and basic accessibility statement. Test actual distribution URLs and cache headers. Before any public fan-game launch, document Nintendo/The Pokémon Company rights, SpriteCollab attribution and noncommercial conditions, origin of each external sprite and sound, and exact takedown procedure. Public release is a business/legal risk decision for the owner, not a technical green light. Never claim that free/noncommercial fan status provides copyright permission. Success: production site deploys reliably, all necessary attribution appears, and launch risk is explicitly reviewed.
```

## Phase 18 — Optional commercialization fork with original creatures

```text
Create a new creature-content adapter compatible with the same rendering, stats, attacks, evolution and metadata interfaces, but containing fully original names, creatures, sounds and artwork. Make no assumptions that Pokémon source assets may be reused commercially. Replace branded terms, move names and trademarked imagery as part of a complete original-IP pass. Keep the roguelite’s unique party mechanics and engineering but build a new creative identity and legal asset chain. Success: no Pokémon characters, sprites, sounds, trademarks or copied creative expression remain in the commercial branch; complete rights records for all new assets.
```

---

## 9. The mandatory handoff template for all coding-agent phases

At the end of **every** phase, the coding agent must produce this exact report structure:

```text
PHASE: [identifier] — [name]
What changed: [summary of implemented gameplay and architecture]
Changed files: [explicit list]
Why the approach is maintainable: [state/data/API boundaries]
Tests run: [exact commands + observed results]
Browser smoke steps: [what was actually verified in the browser]
Known limitations: [truthful, specific]
Balance / performance impact: [measured or not measured]
Next recommended phase: [identifier]
Regression checklist: [features confirmed intact]
```

**Reject an agent response** that says “implemented” but cannot give changed files, test commands and test outcomes, or silently removes an existing module instead of migrating it.

### Merge requirements

- At least one meaningful automated regression check for new game-state behaviour.
- No TypeScript errors, no missing required asset silently hidden, and a successful actual browser run if visual code was changed.
- No regressions to pause semantics, time gates, first-stage recruit restriction, teammate fainting, 15-minute boss and optional endless mode.
- New features are behind tunable configuration/data rather than magic numbers embedded in UI or renderer.
- The source of truth is clearly identified and any new design decision is recorded here.

---

## 10. Balance targets and first-iteration experiments

**Early experimentation — hypothesis, not fact:**

| Metric | Target |
|---|---|
| Average active party at standard-run end | About 4 Pokémon |
| First recruit | Never before 2:45; most competent runs 2:45–4:30 |
| Second recruit | Roughly 7–9 minutes |
| Third recruit | Roughly 11:30–14 minutes |
| Fourth/fifth recruits | Mostly endless mode |
| Starter to first level-up | Within 30–50 seconds for active players |
| Mid-run paused upgrade cadence | Roughly every 30–60 seconds, scaling appropriately |
| Early enemy visibility | Sparse, very readable |
| Mid-run enemies | Dense enough to reward range/AoE decisions |
| Boss fight duration | Roughly 30–75 seconds for a viable 3–4 teammate build |
| Visual frame budget | ~16.7–20ms on target desktop; no unbounded VFX |
| First-level min healthy player | Able to survive with basic movement and occasional dodges |
| Distinct build archetypes | At least 3 competitive routes before expansion |

Design and development cadence: implement → browser test → telemetry → adjust → rerun automated tests → only then add content. **Do not add 100 more Pokémon before the core 12 feel different and fun.**

### Specific QA edge cases to test

- Eevee chooses each of three evolution paths; evolving Eevee removes all other Eevee choices.
- Evolved Pokémon never appear among first-stage recruits.
- A fainting follower disappears from world/HUD, its auto-attack stops, and later choices never target its old UID.
- If a follower faints directly before a scheduled recruitment event, recruitment tally does not reset.
- An XP crystal crossing an ordinary level threshold keeps combat running; crossing a milestone queues exactly one personal choice and remembers excess XP.
- Pausing on top of a chest does not repeatedly grant chest loot.
- Boss special projectiles stop moving behind a pause modal.
- Restart 10 times and confirm texture/mesh/session listeners do not grow continuously.
- Remote PMD or official art request fails: fallback is visible, no unhandled rejection or invisible Pokémon.
- A level-up and legendary spawn on the same frame are resolved deterministically.
- Player can win with fewer than six followers; endless retains remaining team and passive inventory.
- Legendries are Kanto species and use the correct species IDs.
- Mobile viewport may show “desktop supported” rather than broken menus until mobile is implemented.

---

## 11. Release and attribution reference

- PokéAPI documentation: https://pokeapi.co/docs/v2
- PokeAPI sprite repository: https://github.com/PokeAPI/sprites
- PMD SpriteCollab: https://github.com/PMDCollab/SpriteCollab
- SpriteCollab browser: https://sprites.pmdcollab.org/
- Babylon.js: https://www.babylonjs.com/
- Vite: https://vite.dev/



---

## 12. Product definition: what counts as genuinely fun?

After 3–5 ten-minute playtest sessions, ask the player to answer these questions with real examples:

1. Did you keep moving because exploration looked inviting, or because the map was confusing?
2. Did your level-up choice change your next minute of play visibly?
3. Could you name which Pokémon was doing what for your squad?
4. Was losing a teammate tense but understandable, or random and frustrating?
5. Did the game become more stimulating with elapsed time without becoming visually unreadable?
6. Was the manual Q ability satisfying rather than mandatory busywork?
7. Were there at least two interesting build paths on offer?
8. Did you immediately want to try a different starter or squad after the run?

If the answer to questions 2, 3, 5 and 8 is usually **no**, prioritize the combat, upgrades and feedback before any new maps, enemies or Pokémon content.

**North-star statement:** A relaxing beginning, a distinct evolving team, a steady rhythm of paused choices, surprising build synergies and a triumphant fifteen-minute finale — delivered by a lightweight, maintainable system that an AI-assisted solo developer can safely extend.
