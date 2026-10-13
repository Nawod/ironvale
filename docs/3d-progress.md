# 3D conversion ledger

User approved proceeding on 2026-10-14 and chose the elevated RTS camera with rotation/zoom. Explicit constraint: no Git commits. Existing `3D-game` branch is isolated from the original game branch; use it in place. Execute inline with one final read-only reviewer.

Ruling: preserve the initial 32/16-pixel isometric projection at the default camera angle so existing gameplay and touch coordinates remain stable; rotating uses real camera projection and ground ray picking. Simulation stays on the tile grid.

Ruling: use shared instanced primitive geometry for original 3D models, avoiding a separate draw call per body part per entity. Fog uses only the supplied player's snapshot.

Task 1 complete: watched camera/model import tests fail before implementing; 6 camera/model tests now pass, plus existing 3 gesture regressions. Installed Three.js and removed unused PixiJS dependency.

Task 2 implemented: snapshot-driven scene, instanced procedural models, depth/shadows, articulated movements, 3D projectiles, rings/bars, building footprints, ray picking, Q/E and touch-accessible rotation/reset. Desktop gameplay and save/resume checks pass. Rotated building selection and house placement pass on desktop; emulated device runs pending.

Ruling: map plane UVs run south-to-north whereas simulation rows run north-to-south. Reverse texture rows rather than altering world coordinates. A fog/terrain regression verifies the mapping.

Preliminary 3D stress: Intel UHD Graphics through native ANGLE Direct3D11, 1440×900, 400 units 60.01 FPS / 800 units 60.00 FPS. Final full-suite evidence pending.

Full browser run:29 passed,9 intentional skips,1 failure (phone800 stress28.57FPS under4×CPU throttle). All actual gameplay/device/multiplayer checks passed. An isolated profile reproduced29.51FPS and identified per-part add/transform/color conversion as dominant CPU costs. Added a watched RED regression for redundant color uploads and cached immutable part transforms, keys and colors; regression now GREEN. Performance rerun pending.

Review: fresh read-only reviewer found no blocking findings. Minor offscreen pose reuse fixed by snapping poses after a rendering absence; reviewer suggested rotated pan/pinch browser coverage, now added. Existing rotation-specific pan unit tests pass.

Phone rotated placement test originally tapped a map point hidden by the expanded command deck. Selected a clear on-screen construction site and assert elementFromPoint is CANVAS before tapping; phone now passes. No gameplay rule weakened.

Optimization verified: emulated phone4×CPU throttle measures59.02FPS for both400 and800 units after caching; no units or geometry removed, and full animation/render cadence retained. Cache follow-up reviewer found no blockers; idle transforms, gate closing, color slot reordering/growth and ray-picking bounds are sound. Final full browser run pending.

Final verification complete:93 simulation/server/unit tests in17 files;33 browser tests passed with9 intentional device skips andzero failures; type check and production client/server build passed. Final Intel UHD nativeD3D11 stress: desktop400/80060.00FPS; phone4×CPU throttle40060.00FPS and80053.73FPS. Screenshots inspected; final JSON evidence saved under docs/3d-evidence. Physical mobile/Safari/Firefox remain unverified.

Production health at5180 returnsok; actual served3D renderer, rotation and recruitment smoke checks passed for2- and4-empire offline matches. Existing local server continues serving the rebuilt assets; no server-code changes required restart. Initial ad-hoc4-empire smoke used an overly exact accessible-name locator (button includes its subtitle); corrected locator passed.

Delivery:all tasks complete, README/design/plan/verification updated, no commits/pushes/deployment. HEAD still0c64571a33169fbe6fb40ba09873d5f99920f87d on3D-game, all changes remain uncommitted as requested.
