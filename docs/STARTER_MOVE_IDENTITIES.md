# Starter move identities

The fifteen selectable starter families now use different targeting, geometry, projectile behavior and rank milestones. Evolved forms keep the family mechanic; Eevee's elemental branches adopt their new element's kit. The canonical species catalogue remains unchanged; `getAttackProfile` supplies the actual combat profile and presentation reads that profile.

| Starter | Automatic attack | Q special | Rank growth |
| --- | --- | --- | --- |
| Bulbasaur | Instant narrow vine lanes that pierce a row | A remotely planted Bramble Garden repeatedly damages and slows its footprint | Forked lanes, more pierces; longer garden with more pulses |
| Charmander | A fan of straight flames | Sustained, aimed Flamethrower cone; movement repositions the breath | More flames and piercing; wider, longer breath with more hits |
| Squirtle | Slow bubbles with soaking impact splashes | A traveling Surf front pushes and soaks each crossed enemy once | More bubbles and larger splashes; wider wave, longer travel, stronger push |
| Caterpie | A binding silk line | Piercing Silk Snare fan | More bound targets and stun; more special threads |
| Pidgey | Wide gust projectiles push crowds | Traveling, widening Whirlwind | Split gust lanes and stronger push; broader cyclone |
| Pikachu | Instant lightning chain through clustered foes | Thunder Circuit strikes separate remote enemies over time | More links, longer arcs and stun; more remote strikes |
| Sandshrew | Broad, forward ground lanes | Fault Line ruptures sequentially along a direction | Flanking waves; more and farther special ruptures |
| Vulpix | Foxfire spirals inward around the selected enemy | Orbiting fire guards the caster | More orbiters and wider orbit; more lasting guard flames |
| Oddish | Poisonous spore pods scatter toward separate enemies | Remote Sleep Powder cloud stuns and gradually heals the squad | More scattered pods; broader, longer sleep field |
| Meowth | Coins ricochet between unvisited targets | A fan of ricocheting Pay Day coins | More bounces and twin coins; more special coins |
| Growlithe | A forward pounce lane and follow-up bite | Collision-aware Flame Charge leaves a persistent fire trail | Wider pounce, harder shove and second bite; wider, longer trail |
| Abra | Opposing piercing lances cross at the target | Blink away from a threat and fire a lance back through it | More crossing lances and pierces; wider, longer special lance |
| Machop | A close, forward multihit chop | Timed Close Combat strikes with a launching finisher | More combo hits and knockback; more timed special strikes |
| Gastly | Wisps orbit their moving owner | A remote Haunting Hex marks a cluster before delayed damage | Wider orbit and more wisps; stronger, broader curse |
| Eevee | Swift stars independently seek separate targets | Collision-aware Swift Step damages its path, then launches seeking stars | More stars and piercing; more special stars and dash reach |

Primary milestones are authored in `src/data/rosterContent.ts`, executed by the shared pattern and projectile systems, and described on the actual upgrade cards. Special tuning and rank growth live in `src/data/specials.ts`; `src/game/combat/specials.ts` owns reusable casts and timed effects. Leader signature ranks also train Q, and leader upgrade cards describe its mechanical gains.

Primary and learned moves automatically target nearby enemies independently of mouse look. Directional and placed specials use the camera's aim; Thunder Circuit, Foxfire and healing remain automatic. `specialAimMode` in `src/data/specials.ts` owns this distinction. Specials retain the existing one-press Q control. Only actual casts dispatch `onSpecial`; cooldown haste, damage/area/duration modifiers, attribution, on-hit effects and the Famine healing rule still apply. Timed effects pause with the simulation. Traveling attacks use swept collision, dash/blink movement uses the world's obstacle field, and boss targets resist knockback. Active specials, pulses, projectiles and pooled rendering are bounded.

The starter selector explains both moves. The HUD and pause summary identify the equipped Q ability. Cones, moving wave fronts, remote strike columns, garden vines, powder clouds, curse markers, dash/trail paths and orbiting projectiles make the coverage readable without a shared player-centered explosion.

Focused verification lives in `tests/starter-attacks.test.ts`, `tests/specials.test.ts`, `tests/browser/starter-identity.spec.ts` and `tests/browser/starter-moves.spec.ts`. These establish behavior and rendering invariants; they do not establish human balance across a full run.

Verification on October 19, 2026: production build and TypeScript checks passed; 28 primary/special/effect logic tests passed. Eight browser checks passed against an immutable QA build, covering the starter descriptions, actual keyboard-Q casts for all fifteen starters, distinct geometry, moving/widening wave coverage, pause, reuse and existing attack poses. Every starter rendered compiled effects, dealt damage, paused exactly and retained finite trajectories, with no browser or console errors. The contact sheet and JSON observations are in `artifacts/browser/all-starter-specials.*`. Regression cases cover a distant target after Teleport Lance's blink, aimed fan shots when projectile count becomes even, and nearby enemies behind a traveling wave. A 240-cast maximum-rank stress case checks effect/projectile bounds and expiry.

The full-suite run during integration recorded 231 passes and 17 failures in broader enemy-contact, recruitment/evolution, reward and pacing expectations while those systems were also being changed in the shared workspace. See the local `artifacts/starter-full-suite.log`; those failures are not a claim of whole-game validation.
