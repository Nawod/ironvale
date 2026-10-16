# Riverlands and living battlefields implementation plan

> **For agentic workers:** Use superpowers:executing-plans for implementation. Independent simulation, settings and scenery tasks may run in parallel under dispatching-parallel-agents.

**Goal:** Add tactical river crossings and richer landscape/battle presentation while preserving approved buildings and existing game rules.

**Architecture:** Shared simulation terrain codes drive navigation, generation and placement. Optional map settings flow through existing menu/server/save paths. Independent instanced water/scenery providers keep rendering bounded.

**Tech Stack:** TypeScript, React, Three.js, Vitest, Playwright, existing licensed local assets.

**Spec:** `docs/superpowers/specs/2026-10-16-riverlands-battlefields-design.md`

## Global constraints

Preserve approved building art, animal art, city colors, teams, voice, zombies, worker tasks, fair AI and mobile controls. No paid assets, copying reference art, publishing or commits. Missing map setting means Lowlands. Terrain codes: grass 0, earth 1, woodland 2, water 3, ford 4, bridge 5.

## Review focus

- Eight-player and unequal-team starts must remain connected and resource-safe.
- Save reload and online settings changes must preserve map choice.
- Water must block formations, spawns, displacement and relocation, not just ordinary walking.
- Unexplored terrain must not reveal water, bridges, hidden cities or vegetation detail.
- Mobile geometry, draw calls and control access must remain bounded.

## Task 1: Authoritative terrain and safe movement

Files: `src/sim/terrain.ts`, `types.ts`, `world.ts`, `navigation.ts`, relevant spawn/placement/persistence modules, terrain simulation tests.

Interfaces: `MapType`, `mapType?`; `TERRAIN={grass:0,earth:1,woodland:2,water:3,ford:4,bridge:5}`, `isWaterTerrain(value:number):boolean`, `canBuildOnTerrain(terrain:number[],size:number,x:number,y:number,n:number):boolean`.

- [x] Add meaningful failing tests for connected deterministic river generation, safe starts/spawns, water navigation/formation/construction, legacy map handling and persistence validation.
- [x] Implement shared terrain generation and constraints, keeping legacy generation unchanged when omitted.
- [x] Run terrain, navigation, formations, zombies, building action and persistence tests.

## Task 2: Match selection across offline and online

Files: `src/App.tsx`, `src/ui/OnlineLobby.tsx`, protocol/client/server validation, rooms/matchmaking and tests. Own no simulation files.

- [x] Add failing settings/queue tests for valid/invalid map values and separate map queues.
- [x] Offer readable Lowlands/Riverlands selectors in single player, create/join host settings and public matchmaking; retain map on settings edits/reconnect/start.
- [x] Verify server authority, legacy omitted settings, queue grouping and UI access.

## Task 3: Woodland and army motion

Files: `src/render/imported-scenery3d.ts`, `src/render/imported-models3d.ts`, isolated helper/test files. Own no battlefield/building files.

- [x] Inspect current shared-pose/geometry approach; improve tree variety and natural canopy detail within bounded templates.
- [x] Improve class-specific walk/work/attack silhouettes using shared pose banks and existing outfits, preserving all city colors and animals.
- [x] Validate provider geometry/material lifetime, bounded caches and relevant model tests.

## Task 4: Visible river and tactical crossings

Files: new `src/render/riverlands3d.ts`, `terrain3d.ts`, `ground-cover3d.ts`, `battlefield.ts`, minimap component, renderer tests.

- [x] Add meaningful fog/surface/crossing geometry tests before implementation.
- [x] Render lightweight animated water, shores, shallow fords and bridge decks/rails aligned to terrain. Match preview restrictions and keep cosmetics off crossings.
- [x] Integrate lifecycle and shared world clock; run render tests/typecheck.

## Task 5: Integration and delivery

- [x] Review changes for spawn/path/fog/network regressions and approved art preservation.
- [x] Run full unit suite, production build, browser desktop/mobile/online tests and performance sampling.
- [x] Capture visible Riverlands and battle evidence, update verification notes with actual results/limits, mark completed steps.

## Implementation rulings and evidence

- Shared terrain stays immutable during play; navigation cache invalidates on terrain-array replacement. Omitted map setting preserves exact legacy Lowlands world/RNG hashes.
- Crossings are permanent neutral terrain. Bridge decks sit at ground height for unit contact; water uses one animated pass, bridge components three shared batches. No reflection cameras or per-entity models.
- New scene effects use at most two projectile batches, capped at 128 per kind on small screens and 256 on desktop. Snapshot effects do not change combat timers or damage. Turning follows the short angular arc and faces visible work/attack targets.
- Review found and fixed two edge cases with RED-to-GREEN regressions: enclosed garrisons no longer escape to arbitrary opposite-bank tiles, and placement/rejection messages cannot expose terrain in an unscouted footprint. Fresh review found no remaining P1/P2 issues.
- Largest-map terrain generation repeated tile-neighbor scans and trigonometry per texture pixel. Precomputing tile relationships and coordinate waves preserves both a whole-map and mixed-fog pixel hash. Warm median CPU time fell from 94.25ms to 20.94ms in the recorded local microbenchmark.
- The broad browser run crossed system sleep/hibernation. Windows power events and trace timestamps establish the interruption of the day/night scene checks. These require isolated reruns; do not extend timeouts to hide interruption.
- Running all 48 Vitest workers alongside active multi-browser checks caused CPU timeouts. Final CPU verification runs separately with bounded workers; browser/GPU work remains sequential.

- The noninteractive menu backdrop renders at 24fps to reduce background lobby rendering pressure. Interactive matches retain their request-animation-frame cadence; eight-client setup is rechecked without changing its timeout.

- Suspend menu-vista drawing while online/settings/help overlays cover it. Retain the scene/resources and resume the same view on close; model preparation remains asynchronous. This addresses cumulative lobby backdrop cost rather than extending the eight-client test budget.

- Final browser interaction exposed a controlled-input race in host settings. OnlineSession now composes optimistic edits and consumes ordered configuration acknowledgments while refreshing rosters. Rejections/disconnects roll back; leave/start/join reset pending state. Five new client regressions cover rapid edits, ABA replies, rejection, reconnect and ownership. The eight-client setup now passes in 36.18 seconds under its unchanged timeout.

Final verification: 417 automated tests passed; 132 distinct browser cases passed, 30 intentional skips, no unresolved failures. Production build/types and local runtime passed. Evidence and limits: `docs/riverlands-verification.md`.
