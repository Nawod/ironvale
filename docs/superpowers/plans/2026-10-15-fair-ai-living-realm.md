# Fair AI and Living Realm Implementation Plan

**Goal:** Verify equal AI economy rules and deliver richer ecology, imported models and readable interfaces.
**Spec:** ../specs/2026-10-15-fair-ai-living-realm-design.md
**Execution:** Inline implementation with independent bounded audit/asset tasks under dispatching-parallel-agents. Keep all work uncommitted.

- [x] Audit AI costs/timers and write mirrored-controller tests plus seeded opening evidence; fix proven rule defects and document real difficulty behavior.
- [x] Prepare licensed imported model assets and a self-contained loader/pose-baking provider; preserve RTS batching and existing fallback models.
- [x] Add neutral food-resource definitions, berries and fauna, harvesting/retargeting, habitat motion, varied trees and fair start distributions. Test missing behavior before implementation.
- [x] Integrate imported models and richer atmospheric presentation, verifying load/lifecycle/fog and 400/800-unit performance.
- [x] Redesign menu, HUD and settings around readable type, useful difficulty/world information and responsive command space; inspect screenshots and add behavioral browser assertions.
- [x] Run complete typecheck/build/unit-server and relevant browser checks, review, update evidence, and refresh the local server safely once no active matches need preserving.

File ownership while independent tasks run: AI audit owns new tests/ai-fairness.test.ts and scripts/audit-ai.ts only; asset task owns public/models, THIRD_PARTY_ASSETS.md, scripts/prepare-model-assets.*, src/render/imported-models3d.ts and its focused tests only. Main agent owns simulation changes, renderer integration and UI. Shared interfaces: imported provider returns existing `ModelPart[]`; food types and rules remain simulation-owned. No agent changes another task's files without coordinating.
