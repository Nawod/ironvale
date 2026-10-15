# Detailed medieval Ironvale overhaul

The user chose detailed medieval cities and battles after supplying Age of Empires II/III references. Success means an obvious change in the playable battlefield and more deliberate control of armies, while preserving the newly verified mobile HUD. This authorizes new medieval building art and supersedes the earlier rollback of imported fantasy buildings; do not merely turn those imports back on.

Use the existing Three.js renderer and deterministic authoritative simulation. A new engine would discard tested multiplayer, tasks and controls; a fixed sprite renderer would remove the existing camera rotation. Keep browser delivery, no new dependencies, only existing licensed assets or original code/art. Do not copy Age of Empires artwork or branding.

## Playable delivery

1. Original age-aware medieval architecture for every building class: stone foundations, timber frames, tiled roofs, layered windows/doors, chimneys, courtyards and functional silhouettes. Fortifications need joined wall runs, crenellations and substantial gates. Shared/merged geometry and materials; cache by finite variants, never per-frame geometry creation. Preserve footprints and world picking. Retain city colors and readable health/construction state.
2. Richer natural terrain using the already bundled ground photographs and original procedural soil/grass detail, soft material transitions, building foundations/paths and constrained decorative detail. Fog must not reveal hidden buildings or resources. Natural scenery and army assets stay compatible. Adjust visual proportions carefully so cities feel substantial without changing collision footprints or input projection.
3. Army formation choice (line, box, spread), distributing group move/attack-move/patrol destinations instead of sending all troops to one point. Preserve worker task memory. Apply the same authoritative behavior to humans and AI; persist through save/reconnect. Validate bounded positions/selection/ownership, and avoid sending formation slots into buildings or out of the map.
4. Production rally points: select a production building, choose Set rally point, and tap the map or a food/wood/mining source for villagers. New units receive a valid own order on emergence. No extra production speed, free resources or shared ownership. Marker belongs only to the selecting player. Save/reconnect compatibility and no current-state rewind.
5. Preserve compact Commands navigation, text sizes and 44px controls. Add formation choice to army Orders and rally action to Train. Targeted actions close mobile drawers as before.

## Preservation

Keep teams of at most four, unequal teams, separate resources, no friendly fire, opt-in voice, worker interruption tasks, building move/remove, wooden-wall upgrades, zombies, day/night/weather, conquest rules and existing saved games. Land/water navigation, naval warfare, bridges, multiple civilization technology trees and campaigns are separate later systems: do not fake these with nonfunctional decorative water or claim full Age of Empires parity. The current delivery must be described as a substantial first overhaul, not a finished commercial-scale equivalent.

## Verification

Meaningful tests for group destination spacing, boundary/obstacle handling, save round trips, ownership/invalid rally commands and recruitment orders. Geometry bounds/shared-cache checks and real visual review. Browser tests must demonstrate the new commands, actual movement/recruitment, original terrain picking at rotated cameras and mobile landscape/portrait controls. Re-run all simulation/network tests and a production build. Keep the working local game available; no commits, public deployment or purchases requested.
