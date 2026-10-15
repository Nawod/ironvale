# Living World and Teams Implementation Plan

> Execute inline using test-driven-development and verification-before-completion. User authorization covers these reversible local improvements. Preserve the existing instruction against automatic commits and public deployment.

**Goal:** Improve Ironvale's world, movement, performance and online team play.
**Architecture:** Extend authoritative membership and simulation first, then use the same deterministic environment in renderer and HUD. Keep procedural assets reusable and batched.
**Tech Stack:** TypeScript, Three.js, React, WebSockets, Vitest, Playwright.
**Spec:** ../specs/2026-10-14-living-world-teams-design.md

## Constraints and review focus
At most four players per team; uneven teams permitted; no resource or command sharing. Preserve FFA, save compatibility, fog security and reconnects. Check team fill and departure, contested allied occupation, eliminated allied spectators, deterministic environment, and graphics lifecycle/large armies.

### Task 1: Authoritative team simulation
- [x] Write and run failing tests for teams, spawning, friendly fire, shared vision, separate inventories, gates, occupation and victory.
- [x] Add `sim/teams.ts`; extend config/player types; integrate world, combat, economy, AI, visibility and save validation.
- [x] Run focused simulation tests.

### Task 2: Online team lobby and queues
- [x] Add failing room/protocol tests for 2v4, capacity four, assignment permissions, readiness and queue isolation.
- [x] Extend protocol, validation, rooms and lobby. Preserve persisted membership and AI takeover.
- [x] Run room/server/client tests and verify the browser lobby.

### Task 3: Environment, movement and simulation performance
- [x] Add failing deterministic environment, obstacle-cache and movement tests.
- [x] Add `sim/environment.ts`, obstruction caching and spatial separation; expose time/weather in HUD.
- [x] Run simulation tests and compare 400/800-unit benchmarks with baseline.

### Task 4: Natural models, surfaces and atmosphere
- [x] Add model/terrain regression coverage; run before implementation.
- [x] Add reusable procedural texture library, organic anatomy and animals, textured buildings, leafy trees, static-part merging, soft terrain and an atmosphere module.
- [x] Integrate adaptive graphics and remove repeated gate/terrain work.
- [x] Inspect desktop/mobile and day/night/weather screenshots; measure performance.

### Task 5: Integrated verification and delivery
- [x] Run full unit/server suite, typecheck, build and relevant browser flows.
- [x] Review changes for authoritative team constraints, fog privacy and cleanup; resolve regressions.
- [x] Update README and verification record with measured results and limitations. Leave changes uncommitted.
