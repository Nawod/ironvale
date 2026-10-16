# Connected Defenses Implementation Plan

> **For agentic workers:** Use the parallel-agent skill for the independent geometry and simulation tasks; the coordinator owns HUD integration and final verification. Use test-driven-development and one fresh review of the completed change.

**Goal:** Fix fortification joints and add accessible, paid wall-line construction.

**Architecture:** Snapshot-derived connection layouts feed finite shared building templates. A shared bounded route helper feeds UI previews and an atomic simulation command; normal worker build queues and interruption history handle construction. The server validates the same command.

**Tech Stack:** Existing TypeScript, React, Three.js, Vitest and Playwright; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-16-connected-defenses-design.md`

## Constraints and review focus

- Preserve approved non-fortification artwork and current features.
- No hidden occupancy/terrain oracle; validate full-route visibility first.
- No partially paid or partially created lines and no task overflow.
- Gates are two tiles wide; connect actual tile centers without sealing their passage.
- Preview, cancellation and rejected commands must work with touch and mouse.
- Keep caches bounded and release shared GPU resources once.
- Work in this existing clean checkout; no commits, pushes or publications are requested.

## Tasks

- [x] Wall geometry: reproduce corners and gate gaps, add topology-aware layouts and connected models, run targeted tests.
- [x] Simulation: add bounded shared `wallLineTiles(start,end)` helper (up to 64 tiles, returns undefined on invalid/oversized input), `buildWallLine` command `{building:'palisade'|'wall',start,end,workers,player}`, atomic purchase/queue, strict server validation and task resumption tests.
- [x] Interface: explicit wall-line build choices, endpoint planning, green/red route preview, cost and confirm/cancel tray; preserve single placement.
- [x] Verification: bounded full unit suite, type check/build, desktop/phone/tablet targeted browser cases and screenshots, final independent review and fixes.

## Progress

Initial investigation: straight-only yaw resolves corners to X by design. Gate models are centered inside 2x2 footprints while neighboring one-tile walls are offset by half a tile; adapters are needed as well as corner models.

Review fixes: internal request IDs now correlate each command reply. Planner generations protect new plans from old acknowledgments; command-rate rejections carry their sequence and recover submitting controls. Delayed-reply browser regression reproduced the old endpoint erasure before the fix.

Final verification: 466 automated tests passed with no skips, TypeScript and production build passed. Latest merged browser results: 26 passed, 4 device-specific skips, no failures or retries. Prepared desktop and touch-emulated landscape production scenes rendered without browser errors; local server refreshed only after confirming zero rooms, remains healthy on port 8180. No commits or publishing.
