# Larger random terrain and mineral visibility

The earlier river-valley pass improved surface detail but retained a flat plane
and a long north–south river template. This pass changes the map structure and
geometry. It preserves the approved buildings, walls, animals, army models,
responsive HUD, teams, separate resources, voice and optional zombie rules.

## Implemented

- **Actual elevated ground:** a subdivided mesh uses shared triangle-consistent
  vertex heights. Walkable hills rise gradually; rocky ridges have real peaks
  around eight to ten world units. Mountain tiles block navigation and building
  footprints. Buildings require a sufficiently gentle slope. Objects, health
  bars, targeting previews, ground plants and projectiles use the ground height.
- **Random map structure:** seeds change forest patches, ridges, shorelines,
  water placement, width and direction. Riverlands selects a winding meander,
  bounded lake chain or short-stream basins. Every map does not have an
  edge-to-edge river. Lowlands has rolling land and occasional lakes. Passes and
  crossings connect traversable land; starting cities receive equal reserves
  and protected flat terrain. Expansion resources remain seeded and uneven.
- **Larger worlds:** Standard/Large/Huge selectors work offline, in private
  rooms and in public matchmaking. Queues separate incompatible map sizes.
  The default is Large; Huge is always 256 × 256. Fresh matches use new seeds;
  typed seeds reproduce the map with the same settings. The match/room displays
  its replay seed. Old saves keep their stored terrain and dimensions.
- **Gold recognition:** dark angular host rock has broad bright yellow ore
  seams, ochre fragments and warm scree. Stone remains cool grey. The imported
  Quaternius gold core is retained and combined with original shared geometry.
- **Material artwork:** three grass, dirt and cliff textures from Wildfire
  Games' official 0 A.D. mirror are bundled at 512 × 512. The original license,
  attribution, exact source revision, hashes and JPEG modification notices
  accompany them under `public/art/terrain0ad`. The artworks and derivatives
  remain CC BY-SA 3.0. No engine/map code is copied.

| Empires | Standard | Large (default) | Huge |
| --- | --- | --- | --- |
| 2 | 128 × 128 | 160 × 160 | 256 × 256 |
| 3–4 | 160 × 160 | 192 × 192 | 256 × 256 |
| 5–6 | 192 × 192 | 224 × 224 | 256 × 256 |
| 7–8 | 224 × 224 | 256 × 256 | 256 × 256 |

The two-player default has about 2.78 times the tile area of the previous 96 × 96
map; Huge has about 7.11 times that area. Start a new match to see the generator.
The changes are an original Ironvale terrain system; the game does not claim
Age of Empires' finished visual fidelity. Naval gameplay, terrain combat bonuses
and mountain line-of-sight simulation are outside this pass.

## Correctness and interaction

The full suite passes **540 automated tests**. Coverage includes deterministic
world generation, all size profiles, unequal teams and connected terrain,
protected starts and resource counts, unique dry resource positions, mountain
navigation, slope restrictions, masked height snapshots, malformed/legacy saves,
terrain geometry/normals, hill targeting and grounded scenery. Mineral checks
cover exposed ore from four camera directions, picking, cache reuse and disposal.

Read-only review reproduced a real regression: mesh, courtyard and touch picking
could select entities behind a foreground mountain. Eight regression tests now
verify terrain depth limits, visible unit tops, elevated courtyards, touch margins
and legacy flat picking. The fix limits entity hits to the visible ground depth.
The reviewer also compared 7,056 camera rays with actual height-mesh intersections;
the maximum XY difference in that diagnostic was 0.000014 tiles.

Online initial/reconnect packets include full player-masked heights. Later packets
send exact changed index/value pairs, retaining the client's array reference when
unchanged. Tests exercise a real Huge socket payload and reconnect: the unchanged
delta packet is under 1,000 characters versus an initial packet above 250,000.
Offline worker snapshot allocation/structured cloning remains unchanged.

The final browser results contain **30 passes, three explicit device-specific
skips and no remaining failures**, counting each case/device once using its
latest result. They cover generated mountain/lake scenes and textures, Huge and
Large launch/replay seeds, mobile orientations, contextual HUD controls, controlled
bridge routing and water placement rejection, a real Huge private match and
reconnect, menu GPU suspension and night presentation. The controlled bridge
fixture initially retained resources in newly reshaped water; the fixture was
corrected and all three device cases passed again. That arena explicitly tests
crossing behavior and is not an example of new random map placement.

Type checking, production build and whitespace checks passed. The existing
650.91 kB graphics-chunk build advisory remains. Phone/tablet checks use Chromium
emulation on a desktop GPU, not physical mobile hardware.

## Performance

Initial wildlife path requests are spread deterministically across forty ticks
instead of every animal requesting a route on the first tick. Hunting still
stops nearby animals, and saved continuation remains deterministic. Terrain and
decoration caches/caps remain active; there is no additional renderer or reflection
pass. Three small local material images total about 391 KB.

The recorded Node CPU sample uses ordinary seed-778 starting worlds with AI
thinking disabled to isolate world/wildlife cost. Eighty subsequent 20 Hz steps
were measured; these are not large-battle or physical-device FPS claims.

| Measurement | 2 empires, 160 × 160 | 8 empires, 256 × 256 |
| --- | ---: | ---: |
| Generation | 121.43 ms | 237.88 ms |
| Resource/actor entities | 1,315 | 3,093 |
| Animals | 204 | 502 |
| First simulation tick | 7.32 ms | 6.84 ms |
| Subsequent tick median | 0.59 ms | 2.02 ms |
| Subsequent tick p95 | 2.46 ms | 7.04 ms |
| One player snapshot | 2.71 ms | 3.19 ms |
| Full initial snapshot bytes | 164,009 | 405,326 |

## References and production evidence

The supplied screenshots guide the visual direction. The linked YouTube resolves
to **Age of Empires 4 - MASSIVE HILL DEFENSE**, but actual video frame access
returned HTTP 403; the footage was not watched. The official 0 A.D. mirror's
Alpine Valley source was inspected for terrain and passage constraints; the
generator here is original. Asset attribution is in `THIRD_PARTY_ASSETS.md` and
the texture directory's `CREDITS.txt`, `LICENSE.txt` and `manifest.json`.

The local production game runs at `http://localhost:8180`. Highlands captures
use a prepared settlement/scouting scene on actual seed-778 generated terrain
with ordinary models and hit points. The ordinary-start and gold-selection
captures use an unmodified seed-42 new game. The runtime report records readiness,
decoration budgets, errors and server health. This is a local build, not a public
deployment.

- [Automated results](highlands-evidence/unit-results.json)
- [Browser results](highlands-evidence/browser-results.json)
- [Build output](highlands-evidence/build.txt)
- [CPU sample](highlands-evidence/performance.json)
- [Local runtime report](highlands-evidence/local-runtime.json)
- [Desktop highlands](highlands-evidence/desktop-highlands.png)
- [Night](highlands-evidence/desktop-highlands-night.png)
- [Phone landscape](highlands-evidence/phone-landscape-highlands.png)
- [Phone portrait](highlands-evidence/phone-portrait-highlands.png)
- [Ordinary new game](highlands-evidence/desktop-ordinary-start.png)
- [Selectable gold deposit](highlands-evidence/desktop-gold-deposit.png)
