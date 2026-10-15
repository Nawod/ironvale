# Compact in-game HUD implementation plan

> **For agentic workers:** Main owns App/HUD/layout/browser verification. Independent command-panel extraction is dispatched; a read-only usability audit checks preservation and test risks.

**Goal:** Keep Ironvale playable on mobile landscape while making every game feature easy to reach.

**Architecture:** Shared selection/commands remain driven by existing game session commands. A new contextual CommandPanel groups actions. Scoped responsive HUD styles replace the old permanent ledger/deck sizing; compact screens use on-demand overlays.

**Tech Stack:** Existing React, TypeScript, CSS, Lucide icons, Three.js and Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-15-compact-game-hud-design.md`.

**Constraints:** Preserve all simulation/voice behaviors and existing models; readable text and 44px touch targets; no commits or public deployment.

**Review focus:** world-tap obstruction after opening actions, nested scroll access to last actions, large-text landscape, overlays covering mute/menu controls, and losing less-visible game actions.

- [x] Add failing browser checks for usable battlefield area and compact command access in both orientations.
- [x] Extract existing commands into contextual tabs with all original actions and queue/task information.
- [x] Implement compact resource/status controls, minimap/camera/tutorial/voice access, selection summary and responsive command drawer.
- [x] Close drawers before world-targeted orders; preserve Cancel and selection through rotations.
- [x] Verify resource/production/research/manage/worker commands, menu/status/map/camera and larger text with physical hit tests and actual gameplay taps.
- [x] Run full tests/build and focused cross-device/online regressions, inspect screenshots, review and refresh only an idle local server.
