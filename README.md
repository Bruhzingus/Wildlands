# Pokémon Wildlands — Browser Roguelite Prototype

Third-person low-poly Pokémon squad roguelite with automatic attacks, manual jump/dodge/special, paused upgrade selections, delayed first-stage recruitment, evolution, follower permanent fainting, enemy variants, a 15-minute map legendary boss and endless continuation. Includes Kanto 151 registry.

## Run

Requires Node.js 22+ and a modern desktop browser (WebGL). Internet access needed for `npm install`, and to load Pokémon assets unless synced locally.

```bash
npm install
npm run assets:sync       # recommended; optional, needs internet
npm run assets:audit      # reports exactly which Pokémon art/animations are cached
npm run dev
```

Open http://localhost:5173. To test rapidly use `http://localhost:5173/?dev=1&speed=5`.

**Controls:** WASD move, FPS-style mouse look (cursor captured automatically when starting, resuming or choosing an upgrade), wheel zoom, Space jump, Shift dodge, Q special, E interact, ESC pause/release mouse, 1/2/3 choose level-up card. Click **Resume** to capture the mouse and return to play. Mouse sensitivity and invert-Y are saved from the title/pause settings. With `?dev=1`: `]` advances 2 minutes; `[` grants a level, `\` heals. The developer asset gallery previews all 151 species in eight directions using the live game renderer.

Primary and learned attacks automatically target nearby enemies. Mouse look aims directional and placed Q specials; lightning chains, orbiting effects and healing stay automatic.

**Tests:** `npm test`, `npm run typecheck`, `npm run build`, `npm run test:browser`. Browser checks use installed Chrome on Windows or Playwright Chromium elsewhere (`npx playwright install chromium`). Screenshots/traces are ignored under `artifacts/browser/`.

Each living Pokémon receives full shared XP and levels independently during gameplay, gaining modest HP and damage without pausing. Pokémon choices happen at **levels 3, 5, 10, 15…** and prioritize existing move upgrades and stat training, alongside eligible evolutions. Extra move slots unlock at levels 10, 20 and 30; new moves appear occasionally after unlocking a slot. Each Pokémon knows at most four moves, with independent ranks and cooldowns. Elite rewards offer squad training; enemies drop coins and rare items, and supply chests sell more upgrades. Exp. Share helps teammates behind the leader catch up. Enemy scaling follows time with a small capped response to party strength. See [the upgrade rework](docs/UPGRADE_REWORK.md) for tuning and verification details.

Evolution grants +25% max HP, +25% permanent attack damage and +1 rank to every known move, without a rank ceiling. Single-stage Pokémon gain +2 ranks per move training choice from their own level 5.

Pokémon can reach level **100**; the leader should be around **25–35 at 15 minutes**. Evolution and new-move choices happen below level 45. Milestones from level 45 onward focus on upgrading existing moves and squad stats. Training stacks indefinitely, with Common / Rare / Epic versions giving 1× / 2× / 3× bonuses at 55% / 35% / 10% base rarity odds. Team-only relics require a living teammate.

## Documentation

Read **[GAME_DESIGN_AND_ROADMAP.md](GAME_DESIGN_AND_ROADMAP.md)** first. It is the project's master specification and contains 19 sequential copy/paste prompts for Claude/Codex, test checklists, code architecture, release risks and a complete expansion roadmap.

## Assets & licensing

The source ZIP does not contain downloaded Pokémon images. All 151 Pokémon have a known official-artwork URL plus a generated local visible fallback; PMD SpriteCollab idle/walk/attack atlases load where available. Animation coverage varies by species and must be audited with `npm run assets:sync` (`public/assets/asset-download-report.txt`); without a successful asset sync, remote connectivity is required. Some specific actions will use idle rather than attack animations when the sheet is missing. PokéAPI supplies open data, **not** permission to distribute copyrighted Pokémon IP. The SpriteCollab repository also has noncommercial and attribution conditions. This is an unofficial fan-game prototype.

## Current verification status

Roadmap phases 00–02 and 04–15 are implemented. The game includes 151 curated species, protected progression, 36 passive relics, 12 synergies, identifiable enemy factions, four biomes per map, Mewtwo and Moltres fights and scaling endless play. New polish includes clearer HP/party/cooldown feedback, original quiet synth audio, saved comfort controls, automatic/manual graphics, collectible partners, ten achievements, finite side unlocks and reviewed save import/export. See [the phases 10–14 handoff](docs/PHASES_10_14_REPORT.md), with detailed reports for [roster quality](docs/PHASE_11_REPORT.md), [run telemetry](docs/PHASE_12_REPORT.md), [performance](docs/PHASE_13_REPORT.md) and [collection/saves](docs/PHASE_14_REPORT.md). Phase 15 adds [expanded maps and replay hooks](docs/PHASE_15_REPORT.md). [Asset coverage](docs/ASSET_COVERAGE.md) records all 151 species. Human comfort/balance sessions and target-hardware GPU measurements remain outstanding; automated scripts are labeled separately.

Title and pause settings include separate Sound/Music volumes (quiet defaults: 18%/7%), camera shake, hit pause and reduced flashes. System reduced motion disables impact shake/hit pause and damage flashes. Audio unlocks after a user gesture; pause/blur stop combat and ambient audio. All sounds are generated locally without audio downloads.

Audio includes soft attack plucks, rising jumps, descending dashes, enemy defeat pops and companion/player defeat motifs. All 151 species have stable tonal profiles based on element, pitch and envelope; crowded fights share cue limits and soften overlapping sounds. A gentle 100 BPM melody with warm open-fifth chords has rests and an alternate ending. Music has reserved voice capacity so combat cannot cut it off. See [audio tuning and verification](docs/AUDIO_POLISH.md).

Graphics defaults to Automatic, with Low/Balanced/High overrides, independent resolution and decorative effect density. Collection rewards unlock fifteen possible starter partners, four relic sidegrades, eleven single-stage recruits, two repeatable routes through the existing map and optional Quickened/No healing rules. Existing saves migrate without losing previously available content. Permanent unlocks add no combat stats. The collection library shows each requirement and provides local JSON backup/import; audio/camera/graphics preferences use a separate settings key.

Reproducible progression and combat experiments:

```bash
node --experimental-strip-types scripts/progression-pacing.mjs
node --experimental-strip-types scripts/build-stress.mjs
node --experimental-strip-types scripts/boss-pacing.mjs
npm run content:audit
npm run balance:telemetry -- --help
npm run balance:telemetry -- --runs 240 --out artifacts/telemetry/my-runs
npm run profile:reliability
```

The progression experiment maintains party health and approaches targets for close-range attacks to isolate recruitment pacing. Combat stress uses stationary, non-retaliating targets without maintaining party health. Boss pacing uses isolated seeded fights with scripted movement, jumps and dodges, with no forced healing. These do not establish human balance or target-hardware rendering performance.

Every map is now **287.5 × 287.5 m**, 25% wider and deeper (+56.25% area). Runs have eighteen initial discoveries instead of twelve, plus a spring at 3:00, a free salvage cache at 7:00 and an optional champion at 11:00. Seeded orientation, lake placement, rolling terrain, outer discovery types and scenery vary between runs; earned fixed routes remain repeatable. **Volcanic Ridge** is available immediately, with ash groves, taller basalt formations, a crater lake, Fire/Rock spawn weighting and **Moltres at 15:00**. Its Ember Fan, Solar Flare and Ashen Flock reuse the shared telegraph/dodge/combat engine. The new **Onslaught** (+25% enemy arrival frequency) and **Volatile** (+25% enemy damage) rules are optional and available to new and existing saves. Quickened and No healing retain their achievement gates. No new permanent combat bonuses are added.
