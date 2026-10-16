# River-valley landscape verification

This pass takes visual direction from the supplied medieval RTS references:
readable green meadows, textured woodland floors, blue water, planted shores and
stone town ground. Approved buildings, walls, armies, animals and the responsive
HUD remain in use. It is an original Ironvale environment, not imported Age of
Empires art. Existing map layouts, height rules, crossings and simulation behavior
are unchanged; this is a landscape presentation pass.

## Changes

- Public map seeds produce broad green/dry meadow variation without consuming
  simulation randomness. Known trees supply leaf-litter beds; known stone and
  gold deposits supply gravel. Scouted age-two and age-three town buildings gain
  cobbled surroundings with procedural staggered stone joints. Last-seen enemy
  buildings retain their last-seen development stage.
- Rivers use brighter blue water, green shallows, pale banks and softer moving
  highlights. Water shading blends known/memory brightness while unknown cells
  remain hidden. Rain and day/night lighting continue to affect the scene.
- Reeds, lilies, small meadow flowers and woodland ferns use four shared instanced
  batches. The combined budget is 480 clumps on desktop and 180 on compact screens.
  They stay near the camera, require current visibility, avoid buildings and busy
  settlement paths, and leave bridges, fords and their immediate approaches clear.
- Ground fields and style textures rebuild for changed terrain knowledge or town
  and resource layouts. Ordinary visible-to-memory fog changes reuse those fields
  and repaint only affected tiles plus a one-tile neighbor halo. Decoration work
  runs when a snapshot or camera cell changes, rather than every animation frame.
  All added geometry, materials and owned textures are released with the renderer.

No additional assets or external services were added. The existing licensed
ground photograph and local character/scenery assets remain bundled. New plant
geometry and material patterns are original. Both Lowlands and Riverlands use the
new ground presentation; river plants naturally require river terrain.

## Verification

The full bounded suite passed **494 automated tests**. Twelve new tests cover
determinism and read-only sampling, hidden-state noninterference, last-seen ages,
water/crossing exclusions, building/path clearance, in-place paused fog changes,
compact budgets, shader binding and disposal. Incremental ground painting is
checked byte-for-byte against a complete repaint. The existing terrain pixel
contract remains intact when the optional landscape context is absent.

The final browser matrix passed **33 cases with three explicit device-specific
skips**, with no failures or retries. It covers new clear/rain scenes on desktop,
phone and tablet, both phone orientations, ordinary new games and menu return,
existing river routes/construction and shared online map settings, compact HUD
access and existing night presentation. Browser reports count each case and
device once. A separate read-only review found no important actionable issues.

Type checking, production build and whitespace checks passed. The existing
650.91 kB minified graphics chunk still produces the build's size advisory.
Device checks use Chromium emulation on the desktop GPU, not physical phones.

## Performance evidence

Seven measured warm Node CPU rounds used fully visible seeded maps:

| Median CPU work | 96 x 96, 418 entities | 192 x 192, 1,079 entities |
| --- | ---: | ---: |
| Landscape fields | 4.21 ms | 10.01 ms |
| Complete new surface pixels | 5.81 ms | 24.59 ms |
| Style texture byte preparation | 0.64 ms | 2.58 ms |
| Local decoration plan | 0.38 ms | 0.48 ms |
| Reused-field 3 x 3 fog change, including halo | 0.16 ms | 0.17 ms |

The richer initial/full ground generation costs more than the old pixel pass
(3.63 ms and 15.21 ms respectively). The optimization reduces repeated local fog
work; these numbers do not imply a whole-game FPS improvement. Texture figures
measure CPU byte preparation, not GPU uploads. New exploration or changed town
layouts still require broader work. Instancing and compact caps bound the added
plant geometry without reflection passes, extra renderers or transparent sorting.

## Local production evidence

The existing production server at `http://localhost:8180` serves the rebuilt
frontend. Screenshots of the river valley use a prepared town/scouting fixture
with ordinary models, units and hit points. The ordinary-start capture shows an
unmodified new game. The runtime report records asset readiness, decoration
budgets, browser errors and server health. No public deployment was performed.

- [Automated results](river-valley-evidence/unit-results.json)
- [Browser results](river-valley-evidence/browser-results.json)
- [Build output](river-valley-evidence/build.txt)
- [CPU measurements](river-valley-evidence/surface-performance.json)
- [Production runtime report](river-valley-evidence/local-runtime.json)
- [Desktop river valley](river-valley-evidence/desktop-river-valley-day.png)
- [Desktop rain](river-valley-evidence/desktop-river-valley-rain.png)
- [Phone landscape](river-valley-evidence/phone-landscape-river-valley-day.png)
- [Phone portrait](river-valley-evidence/phone-portrait-river-valley-day.png)
- [Ordinary new game](river-valley-evidence/desktop-ordinary-start.png)
