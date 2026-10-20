# Roadmap phases 04–06 implementation and verification

Implemented on 2026-10-18 in the existing Babylon/TypeScript game. Native cursor capture, camera-relative A/D movement, the simple olive game UI, world health bars, one-shot attack animation and distant spawning are preserved. Phase 03 is not marked complete by this work.

## PHASE: 04 — Data-driven attack archetypes and readable combat

What changed: Extracted targeting, damage/status, swept projectile collision and attack execution from the simulation into reusable combat modules. All 151 species use one of the eight existing archetypes, with data for cooldown, range, projectiles, piercing, area, chains, status procs and rank growth. Curated species overrides retain the common execution path. Bolts, beams and lobs have distinct silhouettes; chains draw connected segments, slash attacks use forward geometry, bursts target enemies, and auras center on their owner. Boss volleys have a 0.70-second fixed-aim windup; elite slams have a 0.65-second impact warning. Stun cancels these actions. Visual instances share geometry/materials and are pooled within hard limits.

Changed files: `src/data/attacks.ts`, `src/data/config.ts`, `src/game/combat/targeting.ts`, `src/game/combat/damage.ts`, `src/game/combat/projectiles.ts`, `src/game/combat/patterns.ts`, `src/game/Simulation.ts`, `src/game/types.ts`, `src/game/render/Effects.ts`, `src/game/Game.ts`, `tests/combat.test.ts`, `tests/combat-animation.test.ts`, `tests/effects.test.ts`, `tests/browser/phases.spec.ts`.

Why the approach is maintainable: Attack data selects parameters rather than species-specific functions. Pure helpers own collision/targeting/status calculations; the simulation owns state and damage; the renderer consumes events and authoritative windups. Rendering budgets do not reduce authoritative damage. Enemy hit events identify their damage recipient so automatic attacks no longer flash the player's screen red.

Tests run: See the final verification record below. Coverage includes all 151 attack profiles, penetration order and duplicate prevention, unique chain targets, exact DoT expiry, slow/type interactions, friendly-fire boundaries, homing reversal without teleportation, lob impacts, forward/centered attack geometry, frozen/cancelled windups, projectile reach, proc damage scaling, visual reuse and full disposal.

Browser smoke steps: Rendered chain, area and critical projectile builds; checked bounded effects; paused during an actual boss windup and verified both state and warnings freeze; resumed into hostile projectile silhouettes. Existing health bar, one-shot animation, movement and native pointer-lock browser regressions passed.

Known limitations: Ordinary contact attacks retain their existing immediate collision behavior. Only the boss volley and elite slam use the new hard-hit warnings. Species still share eight arcade archetypes, and the leader special remains a shared radial ability. No audio or new sprite assets were added.

Balance / performance impact: Pooled rendering is capped at 80 transient effects, 16 windup warnings and 520 instances; free lists retain at most 48 per shape/color. The reuse test executes 80 waves while retaining only 12 instances plus their prototype. Attack growth and status interactions change throughput and need human balance sessions; measured stress conditions are below.

Next recommended phase: 05 — implemented in this same request.

Regression checklist: Camera capture/release and A/D direction; pause freezes; friendly attacks cannot hit the party; hostile shots follow continuous trajectories; world bars, attack poses, spawning, boss/endless and restart cleanup remain covered.

## PHASE: 05 — Recruitment fairness, evolution and level-up economy

What changed: Preserved recruitment gates at 2:45 / 7:00 / 11:30 / 16:00 / 20:00 and levels 4 / 9 / 15 / 22 / 29. The next eligible level-up guarantees a randomized first-stage recruit selection. Living evolution families are excluded; total recruits made controls the next gate after a faint, and capacity remains six. Evolution requires levels 7 or 19 and 170 seconds since recruitment or the previous evolution. Eevee displays three explicit branch cards. Upgrade categories, numeric descriptions, weighted rarities (70/25/5 before luck), rank caps, unique items and canonical/stale-choice validation are explicit. Rejected stale choices refresh valid offers while remaining paused. Leader evolution now updates authoritative player HP. Non-evolving first-stage species have twelve move ranks and gain two ranks per choice after 7:00, while evolving lines retain eight.

Changed files: `src/data/progression.ts`, `src/game/systems/progression.ts`, `src/game/Simulation.ts`, `src/game/types.ts`, `src/ui/UI.ts`, `tests/progression.test.ts`, `tests/simulation.test.ts`, `tests/browser/phases.spec.ts`, `scripts/progression-pacing.mjs`.

Why the approach is maintainable: Recruitment gates remain in `config.ts`; evolution, rarity and rank tuning live in `data/progression.ts`; offer generation and validated application share `systems/progression.ts`. Cards carry member identity and source species instead of inferring species from large entity IDs. The UI displays authoritative choices and rank metadata.

Tests run: See final verification below. Tests exercise every gate, family exclusion, capacity, fainted slots, explicit branches, second-evolution maturity, stale/wrong/duplicate choices, rarity bounds, ranked training and all non-evolving species. Integrated seeded runs exercise the real simulation and level-up loop.

Browser smoke steps: Confirmed no recruit before 2:45, a recruit offer at eligibility, real selection with automatic cursor recapture, all three Eevee branches, Jolteon application and absence of stale branches afterward. The existing offline portrait/large party UID test passed.

Known limitations: The four-member casual-run survival target requires human playtesting. Seeded pacing keeps player and follower health full to isolate progression; it does not prove survivability or that ordinary players reach each gate promptly. Evolution offer chance remains tunable at 72% when eligible.

Balance / performance impact: A 24-seed, 15-minute orbit experiment produced four living members and three recruits in every run, with mean level 30.38 and no faints under health maintenance. Gates prevent the fourth recruit before 16:00 even when XP is high. Non-evolving species now have explicit continued growth, but relative species balance remains provisional.

Next recommended phase: 06 — implemented in this same request.

Regression checklist: First-stage-only recruitment, original time/level gates, full party protection, permanent follower fainting, total-recruit accounting, complete upgrade pause, explicit evolution selection, boss timing and optional endless continuation remain covered.

## PHASE: 06 — Deep build variety without bloating controls

What changed: Added 36 unique passive items and 12 composition synergies. A declarative effect engine handles onAttack, onCrit, onHit, onDeath, onSpecial, onRecruit and onEvolve through shared action types. It enforces ownership, counters, cooldowns, stacking rules, bounded proc depth, offensive action budgets and stat caps. Iron Ball trades attack speed for damage; Nursery Stone favors unevolved members at the expense of evolved/single-stage members. Pause/results show owned items, active synergies, move ranks, leader modifiers and relevant caps in the existing simple UI. Chain lightning, wide AoE and critical burst use the same generic systems with different composition/item choices.

Changed files: `src/data/items.ts`, `src/data/synergies.ts`, `src/game/systems/builds.ts`, `src/game/systems/progression.ts`, `src/game/Simulation.ts`, `src/game/types.ts`, `src/ui/UI.ts`, `src/style.css`, `tests/builds.test.ts`, `tests/build-integration.test.ts`, `tests/combat.test.ts`, `tests/browser/phases.spec.ts`, `scripts/build-stress.mjs`, `README.md`, `GAME_DESIGN_AND_ROADMAP.md`, this report.

Why the approach is maintainable: Content is data with shared modifiers, event rules and action interpretation. Items are unique per run; optional explicit member ownership disables an assigned item after that member faints. Synergies require distinct living contributors and cache only composition matching; current health, ownership and buffs still affect modifiers immediately. Pure fraction damage procs consume resolved hit damage once. Echoes execute after the main cast and retarget if needed. Resource rewards and self-damage costs remain reliable when offensive proc capacity is exhausted.

Tests run: See final verification below. Tests cover content counts/uniqueness, every event hook, distinct-member synergy matching, ownership/faint behavior, stat and proc limits, two tradeoffs, actual recruit/evolve integration, invalid-choice rejection, high armor/self-damage, lethal costs, echo behavior, fraction damage and extreme build safety.

Browser smoke steps: Used three different party/item builds, observed distinct attack events and rendered effects, read each active synergy and owned item in the pause summary, and verified a complete state freeze while reading it. Production smoke verifies the final compiled game and actual native cursor capture.

Known limitations: Throughput against stationary, non-retaliating targets is a stress measurement, not a survival or balance result. Target-desktop GPU FPS and multiple human runs of each build remain unmeasured. The existing Babylon production bundle still triggers Vite's large-chunk warning.

Balance / performance impact: Combat stress runs three archetypes and an all-36-item, six-member extreme build against 190 replenished 280-HP targets for 60 seconds at 30 simulation updates/second. Party HP is not reset; normal automatic attacks and special cooldowns are used. State remains finite, entity caps hold and offensive procs stay bounded. Detailed conditions and observed metrics are recorded below.

Next recommended phase: 07. Phase 03 remains available as the earlier asset/presentation checkpoint; this request does not claim its completion.

Regression checklist: One Q ability and automatic squad attacks, item uniqueness, complete pause, cursor recapture after choices, recruitment/evolution rewards, stat caps, permanent faints, end screens, endless preservation and restarts remain covered.

## Final verification record

Environment: Windows, Node 24.11.1, installed Chrome with Playwright and software WebGL. Local cached assets from the existing all-151 audit were reused; this change does not introduce new art dependencies.

- `npm test`: **111 passed, 0 failed**, including the final resource-budget regressions.
- `npm run build`: TypeScript and Vite production build passed; Vite reports the existing approximately 6.1 MB Babylon main chunk (1.35 MB gzip).
- `npm run test:browser -- tests/browser/camera.spec.ts tests/browser/game.spec.ts tests/browser/ui.spec.ts tests/browser/combat.spec.ts tests/browser/phases.spec.ts --output artifacts/browser/roadmap-04-06-results`: 16 passed. This includes six native-pointer-lock cases (normal gestures, capture loss/denial, cancellation and late grants), all existing gameplay/UI/combat visual cases and three new phase cases.
- `npm run test:browser -- tests/browser/phases.spec.ts --output artifacts/browser/roadmap-final-build-results`: all three new phase cases passed again after the resource-budget fix. The change also passed the final full logic suite and production build.
- `npm run preview -- --port 4173 --strictPort`, followed by `node artifacts/production-smoke.mjs`: passed on the compiled bundle. Starter and Resume gestures acquired native pointer lock; mouse look continued past the viewport; Escape froze the clock; restart returned all four starters; the developer gallery was absent without its flag; no page or console errors occurred.
- `node --experimental-strip-types scripts/progression-pacing.mjs`: 24 seeded runs, four living members and three recruits in all runs at 15:00 under explicit health maintenance; mean level 30.38.
- `node --experimental-strip-types scripts/build-stress.mjs`: all four 60-second throughput/cap scenarios passed after the resource-budget fix. The script prints full conditions and metrics as JSON.
- `node artifacts/browser/render-stress-probe.mjs`: a real WebGL/native-pointer-lock run with 36 items, six members and 190 replenished targets passed finite-state, rendering-cap and error checks; conditions and measurements are below.

### Combat stress measurements

All four simulation scenarios used stationary, non-retaliating, replenished 280-HP Rattata, 190 active targets, move rank six, a fixed training fixture and suppressed level-up selections. Normal special cooldowns were respected; no party HP maintenance was used. These deliberately unequal builds demonstrate different throughput and event patterns, not equal balance.

| Scenario | Damage in 60 seconds | Kills | Critical hits |
|---|---:|---:|---:|
| Chain lightning | 268,351 | 879 | 564 |
| Wide AoE | 3,729,782 | 13,264 | 6,173 |
| Critical burst | 301,009 | 1,002 | 994 |
| All 36 items, six members | 5,188,612 | 18,493 | 13,684 |

The extreme run reached seven active projectiles, 143 drops, twelve offensive proc actions per 100 ms and 591 bytes of build bookkeeping. Guaranteed nonvisual resource actions are tracked separately (peak twenty per 100 ms here); they retain rule counters/cooldowns and do not consume the offensive quota. The measured extreme simulation CPU time was 2.818 ms at p95, with an 8.597 ms maximum. These CPU timings are local measurements, not GPU frame times.

The browser rendering probe used Chrome's **SwiftShader software renderer** at 1440×900 with the same extreme composition and 190 replenished targets, two seconds of warmup and 10.085 seconds of observation. It rendered 123 frames, averaging **12.2 FPS**. This does not meet or establish the target-hardware FPS goal: hardware-accelerated desktop measurement remains outstanding. Simulation step CPU p95 was 3.2 ms and render submission CPU p95 was 3.0 ms. Peak transient effects were 80/80, pooled instances 316/520, projectiles 7/220 and drops 145/165. All state stayed finite, all six members remained alive without forced healing, and page/console errors and cap violations were zero. The artificial tightly packed crowd is a rendering stress fixture rather than normal encounter placement. Detailed local output is `artifacts/browser/render-stress.json`.

Screenshots/traces are local ignored artifacts under `artifacts/browser/`, including `phase-storm.png`, `phase-area.png`, `phase-critical.png`, their pause summaries, `phase-boss-windup.png` and `phase-boss-volley.png`. The boss warning was inspected visually; the white fixed-aim line and impact ring remain visible without extra UI effects.

The combat-readability follow-up's previously interrupted combined verification is superseded by the successful current 16-case browser run. All-151 sprite coverage remains documented separately in [ASSET_COVERAGE.md](ASSET_COVERAGE.md). No claim of universally bug-free gameplay, human balance acceptance or target-hardware FPS is made.
