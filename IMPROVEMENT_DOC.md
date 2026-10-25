# Wildlands — Remaining improvements

**Updated:** October 24, 2026. Completed implementation prompts and historical handoffs have been removed. This document keeps the outstanding N5, S5 and F3 follow-ups; the original IDs remain stable for catalogue links.

Movement/evolution presentation, upgrade stacking and critical tiers, difficulty tuning, terrain interactions, exploration rewards, damage analysis, optional challenges, recurring staged bosses, additional starter unlocks and suspended runs are implemented. Their old prompts are retired. Human balance/comfort sessions and target-hardware performance measurements remain outstanding.

For newer design work, start with the [documentation index](docs/README.md), [starter-balance proposals](docs/STARTER_BALANCE_PROPOSALS/README.md) and [upgrade/relic brainstorm](docs/POKEMON_UPGRADES_AND_RELICS_BRAINSTORM.md). The [latest balance update](docs/LATE_RUN_BALANCE.md) and generated [upgrade catalogue](UPGRADE_CATALOGUE.md) describe current tuning; the proposals remain unimplemented.

**The intended game:** A chill opening that naturally becomes more demanding, with existing controls, followers and automatic targeting. Preserve finite Pokémon unlocks and avoid permanent between-run combat-stat inflation.

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

**Shared contract inherited by every prompt**

1. Read this document, `GAME_DESIGN_AND_ROADMAP.md`, the current documentation index and current code. These owner decisions override older roadmap assumptions. Reproduce the current baseline before implementation; implement one coherent entry at a time.
2. Preserve Babylon/TypeScript, authoritative deterministic simulation, data-owned tuning, existing controls/camera, current follower behavior, automatic primary/learned attacks and current Q targeting. No added aiming preview, mandatory tutorial, new input scheme or follower redesign.
3. Preserve complete pause, current recruitment gates, optional evolution, permanent follower fainting, the fifteen-minute first map boss, victory/endless continuity, run analysis and suspended-run recovery. Keep Pokémon unlocks finite; no permanent between-run combat-stat inflation.
4. Percentage-based progression must keep providing value without a hard maximum. F3 specifies the implementation. Entity counts, draw calls, pooled effects and scheduling work remain bounded, with mathematically meaningful aggregation/conversion where needed; a performance limit must not silently become a percentage-stat cap. Do not introduce new stat caps while implementing other entries.
5. Keep cosmetic state out of combat authority and combat state out of renderers. Preserve simulation RNG, IDs, HP, damage timing, pause and reward accounting. New UI/telemetry must observe without changing outcomes. Every new state must have bounded storage or explicit lifecycle ownership.
6. Validate changed behavior with meaningful targeted checks, then run `npm test`, `npm run typecheck`, `npm run build`, and actual browser flows when visuals/input/runtime state change. Windows `.cmd` wrappers or the observed Vite config-loader workaround may be needed. Documentation-only changes need catalogue/link/completeness checks, not another full gameplay test run.
7. Follow the roadmap handoff format: changed files, decisions, exact commands/results, browser observations, known limits, balance/performance effects and remaining work. Distinguish human feedback, scripted balance and measured GPU performance. Update the catalogue when upgrade behavior changes.

## Performance

### N5 — Maintain efficient loading, rendering and long-session behavior

**Priority and purpose:** Ongoing quality work; no reported performance incident. **Dependencies:** Reprofile the existing movement, evolution, world and boss systems.

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

## Audio and comfort

### S5 — Keep sound and impact calm early, richer as the run develops

**Purpose:** Support the intended emotional arc without exhausting the player. **Dependencies:** Existing presentation and the latest late-run balance tuning.

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

## Scaling follow-up

### F3 — Uncapped percentage growth and multiple crits per hit

**Status:** Partly implemented. Actual attack cadence, critical tiers, reduced crit gains, additive percentage bonuses and repeatable numeric relics already exist. Damage analysis and suspended-run snapshots also exist. Remaining work concerns provenance through every damage path, unmatched projectile-pool saturation, numerical stability and long-run endurance. Use current source and the [upgrade catalogue](UPGRADE_CATALOGUE.md) as the baseline.

**Recorded requirements:** Percentage-based increases must retain value without a hard stat maximum. Crit above 100% produces multiple tiers on one attack, and reaching 100% must be harder than the original Focus Energy tuning. Resource and rendering budgets remain bounded.

**Crit interpretation:** With total chance `C`, where `1 = 100%`, a hit receives `floor(C)` guaranteed tiers plus one tier with probability `C - floor(C)`. Damage uses `baseDamage * critMultiplier ** tier`. Thus 250% gives two tiers and a 50% chance of a third. Preserve direct calculation without a loop or effect per tier.

**Implementation handoff**

```text
Finish F3 from current code under the shared contract. Audit percentage growth
from source to effective outcome across training, relics, synergies, move/Q
profiles, statuses, healing, offer eligibility and UI. Find remaining downstream
ceilings that silently discard earned value; preserve current implemented fixes.

Carry critical tier and source provenance through delayed projectiles, chains,
status/relic effects, analytics and snapshots. Keep the existing policy for which
attack paths can crit explicit. A landed hit emits one onCrit event carrying its
tier; additional tiers must not duplicate hits or recursively multiply callbacks.

At resource saturation, preserve logical casts/hits in bounded representations,
including when no matching projectile stream can merge. Never replace earned
attack speed with stronger hits or silently discard value because a visual pool
is full. Check source ownership after evolution, source death and save/resume.

Audit numerical boundaries for defense, healing, haste and very large finite
bonuses. Preserve useful continued growth, avoid NaN/Infinity-to-zero damage,
and never let damage reduction turn a hit into healing.

Acceptance: verify 0/50/100/150/250/500% and large finite critical chances with
fixed RNG, including fractional probability and tier-scaled damage. Check growth
past former caps, overheal/defense, status duration, offer eligibility, attribution,
unmatched pool saturation and pause/save/restart. Profile sustained six-member
endless builds with bounded work and no recursive proc explosion. Regenerate the
catalogue if behavior changes; report human balance and GPU measurements only
when actually performed.
```
