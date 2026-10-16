# River-valley landscape pass

The user's supplied RTS screenshots lead this pass: readable open meadows,
organic woodland floors, bright shallow banks, moving blue water, small riverside
plants and stone lanes through established settlements. Existing buildings,
animals, armies, walls, resource rules and mobile HUD remain in use.

The rendering changes use local original geometry and existing licensed ground
photographs. Seeded surface fields supply broad meadow variation and resource
beds. Known developed buildings supply a paving mask with procedural stone joints.
The water pass gains blue/green depth and softer highlights. Four shared instanced
detail batches add reeds, lilies, flowers and ferns near the camera, capped at 180
instances on compact screens or 480 on desktop. No additional renderer, reflection
camera, asset download or simulation state is introduced.

Tests cover determinism, fog noninterference, historical building ages, water and
crossing exclusions, route/building clearance, paused visibility loss, caps and
owned-resource cleanup. Real browser scenes exercise the shaders on desktop,
phone and tablet; ordinary Riverlands navigation and construction checks remain
required. Final captures include prepared daytime/rain scenes and an ordinary new
game. Performance measurements distinguish CPU surface generation and browser
rendering from physical-device guarantees.
