# Ironvale living world and teams

The user requests better game logic and performance, more natural characters, wildlife, materials and environments, improved movement, day/night and weather, and online teams of at most four players. Unequal teams are allowed. Allied cities start near one another, cannot attack each other, and keep separate resources and command ownership.

Use the existing authoritative TypeScript simulation and Three.js renderer. Preserve existing free-for-all games, saves, local play, controls and online reconnects. Work in the existing feature branch without commits or public deployment, consistent with the previous project brief.

## Teams
Private rooms offer free-for-all or teams. Players choose their own team; the host may arrange the roster. Eight team labels allow small opposing groups; each holds at most four players. Changing mode or assignments clears readiness. Starting requires at least two opposing teams, with no equal-size requirement. AI fills the smallest teams. Public team queues are distinct from free-for-all queues and assign balanced groups, each of at most four.

Team membership is immutable during a match and persists through reconnect, AI takeover and checkpoints. Central alliance predicates govern targeting, direct orders, AI threats, gates, occupation and victory. Allied military presence defends friendly ruins and cooperates in hostile occupation without contesting it. A captured city belongs to the occupying player, not a pooled economy. The surviving alliance wins. Shared line of sight helps coordination; inventories, production, upgrades and unit commands remain private and independently owned.

## Living world and movement
A deterministic environment derived from seed and simulation tick supplies time, daylight, smooth weather transitions, wind and precipitation. One full day takes 24 real simulation minutes, starting at 08:00; weather targets change every three simulation minutes with gradual transitions. Clear, overcast, fog, rain and storms affect lighting, mist, clouds and precipitation; rain modestly slows movement. No wall-clock dependency or extra gameplay RNG consumption. Pauses, saves and online snapshots agree.

Add bounded local separation of active units, respecting blocked footprints and map bounds. Retain grid navigation and deterministic combat. Cache obstruction grids until buildings or gate ownership change; use spatial buckets for local interactions and hunting rather than all-pairs scans. Improve snapshot intel lookup and renderer terrain updates.

## Visuals and performance
Replace rectangular anatomy with smooth tapered/capsule shapes, articulated limbs, shaped animal bodies, facial features, ears, tails, saddles and medieval equipment. Use reusable original procedural wood, masonry, cloth, roof, rock and terrain textures. Trees gain irregular leafy crowns. Terrain gets sub-tile surface variation and soft fog boundaries. Add bounded drifting soft cloud layers, rain streaks, mist and day/night sunlight. These are original procedural assets, not a claim of photorealistic scanned models.

Keep reusable instanced geometry, merge static model parts by material, cap precipitation and cloud counts, and adapt pixel density/shadows under sustained rendering load. Dispose all graphics resources. Test ordinary play plus 400/800-unit fixtures; report measured performance and distinguish emulation from physical phones.

## Acceptance
Regression tests cover unequal teams, four-member limits, forged assignments, readiness, queue separation, nearby nonoverlapping spawns, no friendly attacks or conquest, allied gate access, team victory, independent inventories and hidden enemy data. Environment tests cover determinism, time boundaries, transitions, pause/save continuity and movement effects. Run typecheck, simulation/server suite, browser flows, production build and performance fixtures; inspect screenshots of day/night/weather and natural models.
