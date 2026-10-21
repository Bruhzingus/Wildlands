# In-game upgrade catalogue

October 21, 2026.

The title and pause menus now have a **Browse all upgrades** button. The catalogue
reads game definitions directly and has 521 entries across the document's ten
groups: 36 training variants, 60 active/retired relic definitions, five progression
rules, 151 signatures, 41 learned moves, 25 Q special families, 72 evolutions,
89 recruitment/starter choices, 12 synergies and 30 stat/effect-limit references.
Unlimited training ranks use exact growth descriptions and representative rank
transitions rather than an incomplete list of numbered cards.

The list scrolls independently of its header and controls. Desktop navigation
shows group counts; the group selector works at every viewport size. Search
matches names, owner Pokémon, effects, requirements and eligible learnsets. Rarity
words such as “legendary” also constrain results to that rarity. Filters combine
group, rarity, Pokémon type and availability, including locked and retired entries.
Sorts apply within document groups: original order, name both ways, rarity both
ways or minimum level. Reset and empty-result states preserve keyboard access.

Rarity badges, entry borders, group accents and Pokémon-type labels use distinct
colours, with text labels alongside every colour. Summaries and key numbers are
visible immediately; expandable details show milestones, rank samples, eligible
Pokémon, triggers, evolution gates and achievement unlocks. Retired definitions
are explicitly marked and remain inspectable. Legendary variants share their
base relic's unlock state.

Catalogue text can be selected and copied. Its text-selection rule overrides the
gameplay-wide selection lock; buttons, selectors and disclosure controls retain
their normal interaction. Verified by dragging to select an entry title in Chrome.

Opening from pause keeps the entire run and simulation RNG unchanged. Escape
or Back returns to the same paused menu and restores focus to the catalogue
button. Text entry and scrolling do not reach gameplay input. Space works inside
the catalogue; the existing gameplay Space handling remains in place outside it.
View listeners are owned by an abort controller and released on close/disposal.
The finite catalogue data is cached once; no Pokémon images, renderer or new
combat actors are created by the catalogue.

Changed implementation:

- `src/ui/upgradeCatalogueData.ts`: complete inventory, unlocks, search/filter/sort.
- `src/ui/UpgradeCatalogue.ts` and `src/ui/upgradeCatalogue.css`: catalogue view,
  accessible controls, colour labels, responsive scrolling and listener lifecycle.
- `src/ui/UI.ts`: title/pause entry points, return focus and disposal.
- `src/game/Game.ts`: allow native Space behavior while browsing the catalogue.
- `tests/upgrade-catalogue.test.ts` and `tests/browser/upgrade-catalogue.spec.ts`:
  completeness, filters, ordering, read-only behavior and actual browser flows.
- `tests/browser/phase14.spec.ts`: save-import inventory expectation now follows
  the expanded relic registry instead of the obsolete fixed count of 36.
- Catalogue/design documentation and the generator's menu access note.

Validation logs live in `artifacts/catalogue-*.log`. Desktop and 320px screenshots
are `artifacts/browser/upgrade-catalogue-{desktop,mobile}.png`. Existing upgrade
choice, collection/import/export, unlock and expedition browser flows were also
checked.

Validation:

- Baseline `npm.cmd test`: 416/416 passed before menu implementation.
- Final `npm.cmd test`: 421/421 passed (`artifacts/catalogue-tests.log`), including
  four new catalogue tests and the concurrent balance suite.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build -- --configLoader runner`: passed, including TypeScript
  (`artifacts/catalogue-build.log`); the existing large-chunk advisory remains.
- `npx.cmd playwright test tests/browser/upgrade-catalogue.spec.ts tests/browser/phase14.spec.ts`:
  6/6 passed (`artifacts/catalogue-browser-final.log`). These cover desktop and
  320/390px browsing, all groups, independent scrolling, combined filters, sorting,
  colours, details, search spaces, empty results, Escape/focus restoration, repeated
  opening, unchanged paused state/RNG, resuming and collection save/import flows.
- All five existing upgrade-card browser tests passed in the broader regression
  run (`artifacts/catalogue-browser.log`). That run exposed the obsolete relic
  count expectation and a search ambiguity; the final six-test run passes after
  those corrections.
- `node --experimental-strip-types scripts/generate-upgrade-catalogue.mjs`:
  regenerated successfully. The previous document is preserved in ignored
  `artifacts/UPGRADE_CATALOGUE.before-menu.md`.
- `git diff --check`: passed (existing line-ending notices only).

Limits: descriptions report current gameplay behavior, including existing caps
and critical-overflow behavior; this does not complete the separate F3 rework.
No human usability study or target-device performance benchmark was performed.
The production bundle retains its existing large-chunk advisory. Existing
evolution, terrain, legendary-reward and concurrent balance changes are preserved.
