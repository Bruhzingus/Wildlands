# Calm audio refinement — 2026-10-19

PHASE: Requested audio follow-up to phase 10.

What changed: Short, soft attack plucks, rising jumps, falling dashes, enemy defeat pops and species-colored faint/defeat motifs. All 151 species have deterministic tonal profiles. Element controls the broad texture; species varies pitch and envelope length. The music is an original 100 BPM phrase with open-fifth chords, sparse melody, rests and an alternate ending on the second pass.

Changed files:

- `src/data/audio.ts`: tonal profiles, musical phrase and tempo.
- `src/game/audio.ts`: cue synthesis, contextual mixing, music scheduling and voice allocation.
- `src/game/Simulation.ts`: successful cast/jump/dash events and species metadata on faint/death.
- `src/game/Game.ts`: passes simulation context to audio and preserves defeat identity.
- `src/game/render/Effects.ts`: preserves the previous dash effect; ignores audio-only cast/jump events.
- `tests/audio.test.ts`, `tests/simulation.test.ts`: lifecycle, movement, lethal hits, identity and crowd regression coverage.
- `tests/browser/audio.spec.ts`: rendered waveform and actual keyboard/audio checks.
- `tests/browser/phase10.spec.ts`: corrects stale ready-label expectation to the existing named Pikachu special.
- `README.md`, `GAME_DESIGN_AND_ROADMAP.md`, this report: implementation/tuning notes.

Why the approach is maintainable: Simulation emits successful actions independently of rendering. Each primary/learned attack emits one cast event, including projectile moves with no launch visual. Visual chains, echoes and secondary explosions do not produce extra party attack sounds. Audio uses no simulation RNG and adds no downloaded assets or dependencies.

Mixing rules:

- Eight sound voices and four music voices, at most twelve total. Combat cannot steal the music voices.
- Global attack/impact/death cooldowns apply across species and targets. Normal impacts, critical impacts and deaths also share a 120 ms spacing budget.
- Lethal hits leave their impact slot for the defeat pop.
- Overlapping cues get quieter; distant combat fades and stops beyond 32 world units. Enemy attacks are quieter than party attacks. Global warnings remain audible.
- Higher priority cues can replace lower priority sound voices. Jump/dash feedback outranks ordinary attacks.
- Only sine and triangle tones; short onset ramps and soft decay. Music chords fade in over 650 ms.
- Saved Sound/Music defaults remain 18%/7%. Pause, blur, mute, restart and disposal cancel voices. Long frames never replay a backlog of music.

Tests run:

- Baseline `npm test`: 266 passed.
- `npm test`: 275 passed after implementation.
- `npm run build`: passed, including TypeScript validation. Existing large-bundle warning remains.
- `npx playwright test tests/browser/audio.spec.ts tests/browser/phase10.spec.ts`: six passed in Chrome.

Browser smoke steps: Started Pikachu using a real gesture, held Space/Shift and verified one successful cue each, paused and checked silence, verified separate saved volume controls, restarted using the same graph, tested faint and upgrade feedback, and checked hit-stop/reduced-motion behavior. Offline Web Audio rendered attack/jump/dash/kill/faint/defeat/music through the production graph: nonzero output, default-volume peaks below 0.08, silent tails, and different starter attack waveforms.

Known limitations: Automated waveform checks do not establish subjective comfort or how recognizable each species is by ear. Species share synthesis families; these are original tonal variations, not recorded character cries. Headphone/speaker listening over a full run is still useful for final taste and volume tuning. The complete browser suite was not rerun.

Balance / performance impact: No damage, cooldown, progression or spawn tuning. A synthetic two-minute crowd test continuously sends attacks/hits/deaths and verifies the 8/4/12 voice limits, continuing music, zero audio errors and cleanup. No new target-device frame-rate benchmark was performed.

Next recommended phase: Listen during a full normal run before adding further audio layers; this change does not complete another roadmap phase.

Regression checklist: Gesture unlock, separate volume controls, pause/blur silence, clean restarts, no held-action repeats, projectile launch sound, permanent faints, upgrade pauses, reduced motion, and existing simulation/progression tests pass.
