# Building visual rollback — 15 October 2026

Restored every building, wall and capital ruin to the original Ironvale ModelLibrary. That model library is unchanged from the previous committed version. The imported scenery provider now loads only 11 natural-resource models, avoiding the 27 unused building downloads and their preparation.

The new characters, eight city outfit colors, mounted riders, natural scenery, animals, weather, HUD, online teams, AI siege behavior and paid wall-upgrade rules remain in place. Stone and reinforced walls use the previous stone-wall appearance; their distinct upgrade labels, costs, timing and strength remain active.

Verification: 37 focused tests passed (scenery scope/geometry/lifecycle, renderer, siege AI and wall progression). Client/server production build passed. All 15 browser checks passed across desktop, phone and tablet: normal play/recruit/save/load, rotated building picking/construction, and level 1–3 wall progression including preserved damage. The running local game at http://localhost:8180 loads detailed actors and nature, welcomes multiplayer connections, spends the normal recruitment cost and reports no browser errors. The restored roofed town center was visually inspected alongside the retained new outfits, animals and scenery.

Runtime evidence: docs/realm-evidence/local-runtime.png and local-runtime.json. Browser/unit summaries: building-rollback-browser.txt and building-rollback-tests.txt in the same evidence directory. Earlier imported-building previews and verification notes are historical.
