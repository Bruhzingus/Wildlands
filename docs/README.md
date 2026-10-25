# Current documentation

Updated October 24, 2026. Completed implementation reports, coordination notes and art-overhaul prompts have been removed; their history remains in Git.

## Latest work

| Document | Purpose / status |
| --- | --- |
| [Late-run balance](LATE_RUN_BALANCE.md) | Latest implemented tuning: relics, training, recruitment, shrine/boss endurance and endless pressure. |
| [Starter balance audit](STARTER_BALANCE_AUDIT.md) | October 24 evaluation of starter kits and evolution branches. |
| [Starter audit data](STARTER_AUDIT_DATA.md) | Generated measurements supporting the audit. |
| [Starter balance proposals](STARTER_BALANCE_PROPOSALS/README.md) | Unimplemented options A/B/C, shared corrections and validation plan. |
| [Pokémon upgrades and relics brainstorm](POKEMON_UPGRADES_AND_RELICS_BRAINSTORM.md) | Unimplemented full-run build and upgrade ideas. |

The starter audit, its measurements and the proposals predate the latest late-run balance pass. Treat their baseline numbers as a recorded snapshot; regenerate measurements against current source before implementing a candidate. None of the proposal packages is applied by this cleanup.

## Maintained references

| Document | Purpose |
| --- | --- |
| [Project README](../README.md) | Setup, controls and current feature overview. |
| [Upgrade catalogue](../UPGRADE_CATALOGUE.md) | Generated current upgrade values and formulas. |
| [Remaining improvements](../IMPROVEMENT_DOC.md) | Outstanding performance, audio and scaling follow-ups. |
| [Game design and roadmap](../GAME_DESIGN_AND_ROADMAP.md) | Foundational design, architecture, validation and optional future directions. |
| [Asset coverage](ASSET_COVERAGE.md) | Reproducible per-species local asset inventory. |

Regenerate the catalogue with `node --experimental-strip-types scripts/generate-upgrade-catalogue.mjs`, starter measurements with `node --experimental-strip-types scripts/starter-audit.mjs`, and asset coverage with `npm run assets:audit`.
