# Detailed medieval Ironvale implementation plan

> **For agentic workers:** Use the existing shared workspace with disjoint file ownership. Read this plan and the linked spec. Root integrates and verifies the playable result. No commits or public deployment.

**Goal:** Make Ironvale visibly more like a detailed medieval RTS and add disciplined group control and production rally points.

**Architecture:** Keep Three.js instancing, original collision footprints and authoritative 20Hz simulation. Add a cached original medieval building provider and a detailed terrain material; extend validated unit/building commands for formations and rally points. Existing saves tolerate optional fields.

**Tech Stack:** Existing TypeScript, React, Three.js, Vitest and Playwright; no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-16-detailed-medieval-overhaul-design.md`.

## Constraints and review focus

All prior multiplayer/team/voice/task/zombie behavior persists. Finite geometry/material caches, fog-safe surface detail, no hidden-state leakage, no resource/training advantages, valid world taps in mobile landscape, old-save compatibility, bounded formation work at large army counts.

- [x] Building art: add `src/render/medieval-buildings3d.ts`, returning cached `ModelPart[]` for building Entity + age. Root integrates before old fallback. Provider owns and disposes its resources; tests bounds/shared parts, city identity and finite variants. Do not alter renderer integration or simulation here.
- [x] Formation/rally simulation: add `src/sim/formations.ts`, optional typed fields and commands, validation/economy/recruitment/save/protocol support and meaningful tests. Own sim/net/server files; root owns UI. Root and agent agree exact command interfaces before UI edits.
- [x] Terrain/proportion integration: root owns `terrain3d.ts`, terrain materials, `battlefield.ts` and assets loading. Preserve fog boundaries and camera math; use bundled local ground maps and original procedural detail. Geometry changes must not change simulation terrain or footprints.
- [x] UI integration: root owns `App.tsx` and `CommandPanel.tsx`. Army formation select in Orders; Set rally point in Train, existing mode/banner/cancel behavior; no new permanent mobile panels.
- [x] Verify and review: focused failing tests → implementation → focused passes; full tests/check/build; original and new playable browser flows; screenshot critique and bounded-load checks; documentation with actual limitations and final local preview.
