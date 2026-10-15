# City Identity and Siege Progression Implementation Plan

**Goal:** Distinct city-colored armies and scenery, proper mounted troops, reliable town-hall sieges, and paid wall progression.
**Architecture:** Extend the existing imported actor provider and add a static scenery provider; preserve shared pose/material batches and simulation ownership. Add a validated wall-upgrade command/queue and repair AI siege commitment through ordinary game orders.
**Tech Stack:** TypeScript, React, Three.js, Node/WebSockets, Vitest and Playwright.
**Spec:** ../specs/2026-10-15-city-identity-sieges-design.md

## Constraints

- Use free Ashen Marches only; retain licenses, ship only game-used derived files, preserve existing animals.
- Preserve fog, alliances, separate resources, deterministic simulation and the existing occupation phase.
- Keep changes uncommitted and do not publish or purchase assets.

## Work

- [x] Import free character/equipment variants, strong cloth colors and mounted poses; test actual geometry/materials/lifecycle.
- [x] Import the requested building/nature packs with grounded footprint-safe variants, owner accents and explicit fallback behavior.
- [x] Reproduce and fix AI siege abandonment; add wall upgrade economy, queue, save and command validation with regression tests.
- [x] Integrate providers, city-color UI consistency, ruined-capital presentation, wall upgrade controls and clear progression text.
- [x] Review, run appropriate game/server/browser/performance checks, inspect visual evidence, document results and refresh the idle local server.

Parallel ownership: army_identity owns imported actor provider, actor helpers/tests and derived actor files; realm_scenery owns new static scenery provider/tests and its derived assets; siege_walls owns simulation/validation and associated tests. Main agent owns renderer integration, HUD/minimap, browser checks and aggregate documentation. Raw sources stay ignored under .art-source/.
