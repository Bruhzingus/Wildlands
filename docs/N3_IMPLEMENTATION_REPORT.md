# N3: upgrade audit and rework

October 21, 2026. Owner follow-ups override the older one-copy relic policy and
haste overflow design: percentage bonuses add against base stats; attack speed
keeps making attacks faster; Iron Defense is removed; repeat relics are allowed
where another copy has a meaningful benefit.

## Implemented behavior

Attack intervals are now `base / (1 + haste) / (1 + 0.08 * (rank - 1))` for
signatures. Learned profiles already include their rank factor, so their interval
is `profile.cooldown / (1 + haste)`. There is no 0.20/0.35-second floor and no
haste-to-hit-damage or haste-to-healing conversion. Fractional elapsed time is
carried between updates, including multiple attacks in one simulation step.
Healing moves heal the same amount per cast and cast more often.

At extreme rates, at most 32 representative packets per move per update carry all
logical casts as integer hit counts. Damage remains a per-hit value. Counters,
healing and landed-hit accounting consume the packet count; matching friendly
projectile streams can merge at the existing projectile-pool limit. This keeps
simulation work bounded. Representative casts share a critical roll at these
extreme rates, reducing independent variance; this is documented rather than
presented as a perfect independent-roll simulation. Existing finite world and
projectile pools remain resource budgets, and full saturation without a matching
stream remains a limitation for the wider F3/performance follow-up.

Iron Defense and all four rarity cards are removed from new rewards. Existing
legacy defense buffs still resolve, without making them selectable again.
Concurrent balance work adds Deflection and gives Endure only Epic/Legendary
versions. The current inventory has nine active families / 34 variants. Explicit
rarity curves are shared by rewards, validation and both catalogues.

All 24 active relic families stack, including mixed normal/Legendary copies.
Iron Ball adds damage per copy and multiplies remaining attack rate by 0.7 per
copy; its downside does not disappear at an arbitrary slowdown clamp. Positive
attack-speed bonuses add first, independently of inventory order, and then the
slowdown applies. The schema supports future truly unique mechanics; none of
the current numeric relic effects needs a one-copy restriction. Retired definitions remain resolvable and are not new rewards.

Copies use one numeric counter per item definition; the owned-ID list stays
bounded. Legacy duplicate-ID arrays remain readable. Each copy adds percentage
bonuses and flat bonuses. Triggered damage, healing, recharge, echo strength and
Life Orb's HP cost scale with copies; status relics combine independent proc
chances as `1 - (1 - chance)^copies`. Extra copies do not add recursive callbacks.
Normal/Legendary variants share unlocks. One family per offer/reroll keeps choices
varied, while the same family can be purchased again in later rewards. Collection
achievements count distinct families, not copies or rarity variants.

XP, catch-up XP, percent regeneration, projectile speed and status duration no
longer stop at the old modifier caps. Triggered damage, radius, status duration,
echo strength and flat resource effects no longer hit their former arbitrary
ceilings. Legitimate procs are not discarded by a global twelve-action window;
finite rule traversal and recursion protection bound the work instead.
The concurrent defense rework maps defense bonuses to each species' damage
threshold. Copies add defense bonuses; the one-damage minimum no longer defeats
further defense. Flat projectile/pierce/chain execution counts
remain bounded: offers require a compatible move that can use the entire stated
additional count, rather than selling a partially wasted bonus.

Critical chance now retains its percentage instead of converting overflow to a
different stat. Each full 100% grants a guaranteed tier, plus one fractional roll;
damage is `base * critMultiplier^tier`. A landed hit produces one onCrit event,
carrying its hit count and tier, not one callback per critical tier. Focus Energy
is 4/8/12/16 percentage points; legacy Scope Lens is 8 points, Storm Circuit 2 and
Shadow Focus 4. Starting chance remains 5%, so 100% now requires 24 Common Focus
Energy picks instead of ten, or six Legendary picks instead of three at the old
40-point Legendary value. These are access comparisons, not a human balance claim.

Cards preview copy counts, percentage totals, flat bonuses, actual attack rates,
HP and dodge/Q recharge times. The build lists `×N` and marks descriptions as
per-copy when necessary. The menu catalogue and Markdown catalogue use the new
rules. Offers exclude healing-only effects in No Healing, XP rewards at a fully
levelled party, unsupported projectile/chain/pierce bonuses and damage effects
without a damaging move. Evolution branches, owner targeting, learned slots,
recruitment gates, reroll rarity and finite meta unlocks remain intact.

## Disposition of every training family

These decisions cover every rarity variant of each family.

| Family | Decision | Reason and implemented result |
| --- | --- | --- |
| Swords Dance | Keep / clarify | Additive squad damage, including learned moves; existing relic bonuses appear in the preview. Hidden haste damage is removed. |
| Tailwind | Rework | Remove dispatch floors and strength conversion. More percentage now means more casts with unchanged damage/healing per cast. Show the leader's actual move rates. |
| Agility | Clarify / preserve concurrent change | Names leader movement scope. Movement percentages add; its added stamina recharge reduction multiplies remaining recharge time. |
| HP Up | Clarify | Applies to the whole party, not an ambiguous personal owner. Preview actual leader max HP; preserve current HP fractions and recruited-member inheritance. |
| Iron Defense | Retire | Explicit owner request. No new cards or active catalogue rows; reject stale selections. |
| Endure | Preserve concurrent change | Epic/Legendary versions add maximum dodge charges. Common/Rare versions are unavailable; previews show capacity. |
| Calm Mind | Keep / clarify | Recovery rating continues reducing Q cooldown. Show actual seconds; retain manual Q behavior. |
| Focus Energy | Retune / rework | Lower gains, keep uncapped chance, and resolve critical tiers instead of converting to critical damage. |
| Expanding Force | Keep / clarify | Reach/radius percentage remains additive; it is a radius change, not the same percentage of area. Unsupported pure-heal damage/area training is filtered. |
| Deflection | Preserve concurrent change | Adds 3/5/9/15 percentage points by rarity, stops at 50%, and disappears from offers at its cap. Catalogue details show this exception. |

## Disposition of all 24 active relic families

Each row covers its base and Legendary version; Legendary values remain twice
the positive base bonus or triggered strength. This is a behavior audit, not an
assertion that every item was human-tested or that the owner rejected a niche.

| Relic | Decision | Reason and implemented result |
| --- | --- | --- |
| Metronome | Rework stacking | Repeated copies increase echo strength on the existing fifth-attack trigger. Learned echoes retain the learned attack and retarget safely. No echo recursion. |
| Loaded Dice | Keep / stack | Add one/two projectiles per copy; offer only to a compatible current move or Q that can use the full gain. |
| Zap Plate | Rework scaling | Stack critical-hit arc damage; remove the hidden 2,000-damage ceiling; keep the advertised shared cooldown and resolved-hit attribution. |
| Leftovers | Rework stacking | Add 0.8%/1.6% max-HP regeneration per copy for each member, without the old regen cap. Exclude from No Healing. |
| Exp. Share | Keep / filter | Stack catch-up XP instead of unique ownership; do not offer solo or when nobody can gain more levels. |
| Life Orb | Rework stacking | Each copy adds damage and its exact HP cost. High attack speed cannot waive the downside. |
| King's Rock | Rework stacking | Combine stun chances across copies; keep per-hit triggering and no recursive item hits. Status-duration bonuses continue scaling. |
| Shell Bell | Keep / stack | Heal fraction adds per copy at the existing kill interval. Exclude from No Healing. |
| Iron Ball | Rework stacking | Add damage per copy; apply each 30% slowdown to the remaining attack rate after positive bonuses. Both its benefit and its downside keep working. |
| Razor Claw | Keep / stack | Add critical damage per copy; retains synergy with uncapped critical tiers. Exclude unsupported pure-heal builds. |
| Zoom Lens | Retired by concurrent work | Legacy copies still add reach/radius and projectile speed. Both rarities remain in the Markdown legacy reference and are excluded from new rewards and the active menu catalogue. |
| Team Battery | Preserve / stack | Adds dodge capacity per living party member per copy; requires at least three living members to acquire. Legendary copies double capacity. |
| Drill Run | Keep / filter | Add pierces per copy. Reject unsupported attacks and gains that cannot fit in the move's remaining flat-count budget. |
| Discharge | Keep / filter | Add chain targets per copy. Require a current chain attack and enough remaining count capacity. |
| Magnet | Keep / stack | Every copy adds pickup radius; remove the old +10m clamp. Preview meters. |
| Focus Sash | Rework stacking | Stack conditional damage and defense bonuses per copy. Retain low-HP condition; no negative damage or one-damage floor. |
| Heal Bell | Keep / stack | Add each copy's squad max-HP healing on Q. Exclude from No Healing and preserve fainted-member rules. |
| Blast Seed | Rework scaling | Stack damage at the existing fourth-kill trigger and source-move scaling. Remove proc damage/radius truncation; keep recursion blocked. |
| Icy Rock | Rework stacking | Independent slow chances combine; duration remains that rarity's stated duration, improved by duration bonuses. |
| Toxic Barb | Rework stacking | Independent poison chances combine; duration bonuses continue past the old eight-second ceiling. |
| Adrenaline Orb | Keep / stack | Add recharge per critical-hit trigger, preserving the explicit 0.25s cooldown. No overflow-to-different-stat rule. |
| Eruption | Rework scaling / filter | Stack source-scaled Q bursts without the old proc damage/radius ceilings. Do not offer a zero-damage burst to an unsupported healer. |
| Power Gem | Rework scaling | Stack the fraction of actual critical-hit damage; no second target multiplier and no hidden damage ceiling. |
| Binding Band | Keep / filter | Add duration percentage per copy without old modifier/status clamps. Require an active status or timed effect that can benefit. |
| Big Root | Keep / stack | Add max-HP heal fraction per copy while retaining per-attacker counters. Grouped casts preserve every crossed twelfth-attack trigger. Exclude from No Healing. |

The original twelve retired definitions stay retired; concurrent work also retires
both Zoom Lens variants and adds Team Battery, leaving 24 active families and 14
retired definitions. Those changes are preserved alongside this audit.

## Move and composition categories

| Category | Decision | Result |
| --- | --- | --- |
| Signature training, all 151 species | Keep / fix execution | Existing profiles and authored milestones remain; rank/haste cadence is executed at its stated rate with selected-owner targeting. |
| Learned-move training, all 41 definitions | Keep / fix execution | Independent cooldowns and mastery gains remain. Remove dispatch floors; preserve move identity, per-hit output, counters and learned echoes. |
| Learning a new move | Keep | Species/level/free-slot gates, Rare rarity and occasional offer branch remain. No unwanted automatic learning. |
| Q special families | Keep / clarify | Q grows with leader signature ranks. Calm Mind affects recharge; Tailwind affects automatic primary/learned attack cadence. Q and standalone proc attacks retain their existing noncritical policy; hit-derived effects inherit resolved hit damage. |
| Evolution, all 72 branches | Keep | Explicit owner/branch, HP fraction, XP and known moves are preserved. Keep-training alternatives remain. |
| Recruitment and starters | Keep | First-stage gates, unlocks, line exclusion and rare six-member pacing remain. |
| Automatic synergies, all 12 | Keep / clarify | Distinct living contributors and immediate composition refresh remain. Rebudget the two crit-chance sources and allow their percentage effects to keep scaling. |

## Matched scripted comparison

Before and after used eight identical configurations, seeds starting at 1001 with
stride 197, starters 1/4/7/39, cautious movement, balanced/offense choices, fresh
pool, Wildlands, 960 seconds and health assistance. Both reports have stable
source fingerprints and zero finite-state/recruit-gate validation failures.
The after run includes the preserved concurrent defense and balance changes;
this comparison measures the combined workspace rather than isolating N3's effect.

After was run from an immutable local snapshot to avoid concurrent edits changing
the source during measurement. Its fingerprint is
`08ead785c3772dec8948e9858eaaa480e593001c26446767d2705afe02d79305`.
The earlier live-source `n3-after` reports are provisional and superseded by this
snapshot. Command for the stable after run:

```powershell
node --experimental-strip-types artifacts/n3-final-snapshot/scripts/balance-telemetry.mjs --runs 8 --seconds 960 --starters 1,4,7,39 --behaviors cautious --builds balanced,offense --pools fresh --assisted --out artifacts/telemetry/n3-final-snapshot --quiet
```

| Cohort (four runs each) | Kills/min before → after | Aggregate squad level before → after | Mean longest upgrade gap before → after |
| --- | --- | --- | --- |
| Balanced | 57.344 → 49.718 | 96.75 → 78.00 | 105.38s → 85.07s |
| Offense | 55.230 → 57.391 | 91.50 → 96.25 | 108.29s → 115.17s |

Seven after runs reached 15 minutes, with four living members each. The overall worst
selected-upgrade gap was 148.32s before and 153.16s after; the desired sub-90s
hypothesis still needs work. This pass does not claim to have solved interruption
pacing or calibrated human difficulty. Boss victories were 2/7 reached before
and 0/7 after, censored by the 960-second window; that is not a human win rate or
evidence of a statistically meaningful balance improvement. Before/after JSON,
CSV and Markdown files live in ignored `artifacts/telemetry/n3-*`; the after
snapshot also retains its original reports under its own artifacts directory.

## Validation and changed files

An earlier reconciled inventory passed all 437 logic tests. After the concurrent
rarity/defense changes, a fixed validation snapshot ran 442 tests: 441 passed and
one scripted progression-route assertion failed. Seed 1986 dies at 886 seconds,
while the older test expects every health-maintained route to reach 900. The
other five seeds reach 900; all six recruit three teammates and report four living
party entries and no follower faints. Assistance restores HP before each tick;
it does not guarantee survival through damage within that tick. This remains a
reported balance/harness follow-up; no survival assertion was weakened to hide it.
All eight targeted N3 tests pass.

All 17 fixed-snapshot browser checks pass: actual haste previews, repeated normal
and Legendary relics, stack counts, additive percentage previews, rerolls, four
move slots, progression, colour/layout filters and read-only pause browsing.
The test server needed manual shutdown after the checks completed; Playwright's
final result is `passed`, with no failed tests and exit code 0.

`npm.cmd run typecheck` passes. `npm.cmd run build -- --configLoader runner`
completed production output, with the existing large-chunk advisory. The PowerShell
wrapper reported a native-stderr error for that warning, although Vite completed
the build. The content audit passes for 151 species/profiles, 72 evolution edges
and 453 animations, with no issues. `git diff --check` passes.

Validation source and tests are retained in `artifacts/n3-validation-stable`;
logs are `artifacts/n3-tests-stable.log` and `artifacts/n3-browser-stable.log`.
The isolated browser server uses the workspace's already optimized Babylon bundle
because fresh dependency optimization hits the Windows directory-access restriction.
Baseline `npm.cmd test` passed 421 tests before this pass.
Targeted N3 coverage exercises actual attack counts and equal per-hit damage,
sub-floor cadence, extreme packet counts, repeated relic effects/costs, previews,
old caps, crit tiers, removed defense and incompatible/challenge offers. Existing
owner, branch, rarity, pause and gating tests were retained and updated where the
owner explicitly changed the old unique/cap contract.

Implementation files: `src/data/{progression,items,synergies}.ts`,
`src/game/{Simulation,types,achievements}.ts`,
`src/game/combat/{cadence,critical,damage,patterns,projectiles}.ts`,
`src/game/systems/{builds,progression}.ts`, `src/ui/{UI,upgradePreview,upgradeCatalogueData}.ts`,
the catalogue generator, upgrade/combat/economy tests and browser upgrade flows.
Existing movement, evolution, environment, enemy/balance and presentation changes
from other work were preserved.

Remaining limits: no human full-run balance or target-device GPU study was
performed. Very high cast packets share representative critical rolls/trajectories.
This resolves the N3 upgrade behaviors and the necessary percentage/crit overlap;
it does not claim completion of all F3 provenance, saturation or endurance work.
Human item preference and the remaining measured upgrade-gap hypothesis remain
explicit follow-up work, without deleting unreviewed niche items.
