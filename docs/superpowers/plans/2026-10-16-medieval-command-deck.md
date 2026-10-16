# Medieval Command Deck Implementation Plan

> **For agentic workers:** Use the dispatching-parallel-agents skill for independent portrait baking and minimap tasks; the coordinator owns selection, production, HUD integration and verification. Use meaningful regression checks and one fresh review of the final change.

**Goal:** Deliver an original medieval RTS HUD with game-model portraits and clearer battlefield controls.

**Architecture:** Static portraits use the existing model providers and a bounded URL lookup with artwork fallback. Selection and production remain snapshot-driven React UI. A cached minimap background receives an independently updated camera overlay. A final focused stylesheet applies the relief materials while preserving compact-screen structure.

**Tech Stack:** Existing React, TypeScript, Three.js, WebP, Vitest and Playwright; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-16-medieval-command-deck-design.md`

## Constraints / review focus

- Preserve approved buildings, animals, walls and all match rules, teams, voice and zombie functionality.
- No copied reference artwork or new live portrait renderer in the playing game.
- All eight city colors, three building ages and reinforced walls need correct portrait variants and fallback.
- Group actions select only eligible owned unit IDs; do not create control over allies/enemies.
- Minimap camera overlay updates while paused and cleans up on unmount, without changing navigation coordinates.
- Collapsed phone/tablet HUD leaves >=70% battlefield input space, with readable text and 44px controls.
- Work in the existing clean checkout; do not commit, push or publish.

## Tasks

- [x] Portraits: add typed lookup, reproducible local model baker and generated WebP portraits; verify coverage, finite keys, image dimensions, file budget and representative visual crops.
- [x] Minimap: add camera footprint geometry, cached map rendering and bounded overlay updates; test pan/rotation/zoom, clipping and cleanup.
- [x] Selection / production: larger model portrait, health display, owned-unit composition selection and portrait-based production progress; retain all current actions and timers.
- [x] HUD: original oak/bronze/stone relief, framed resources and minimap, desktop command deck; preserve compact layout and large text.
- [x] Verify: type/build, bounded full automated suite, appropriate browser regressions, independent review and local runtime captures; update user documentation and evidence.

## Progress

Direction is supplied by the user and prior approved mobile requirements. This is an authorized continuation; routine implementation choices proceed without another design approval cycle.

Implemented 442 local 192px WebP model portraits, 2,684,276 bytes total, with close infantry crops and all city/age/tier variants. No additional runtime WebGL contexts. Six focused lookup/group/camera tests passed; seven including the adaptive presentation ordering regression. Initial new browser run: eight passed, four device-specific skips.

Review: one important empty-selection specificity regression reproduced (196px instead of <=64px), then fixed by limiting expanded desktop styling to actual selections. The existing adaptive renderer also resized its buffer after presenting; regression observed render-before-resize, corrected to resize-before-render to prevent blank presented frames.

Final desktop height is 180px, preserving >=70% sampled battlefield input space with an expanded selection deck. Full automated suite: 473 passed. Final browser matrix: 39 passed, six device-specific skips; complete desktop follow-up: 12 passed, including minimap timer cleanup. Type check, production build and whitespace checks passed. See `docs/medieval-command-deck-verification.md` and its evidence directory for results, captures and limitations.
