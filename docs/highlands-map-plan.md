# Larger random battlefields

The previous surface pass did not address the user's central complaint: a flat
map and the same long river structure. This pass replaces that geometry and map
generation while retaining the approved buildings, walls and interface.

The accepted direction is larger seeded worlds with true height meshes, rolling
walkable hills, blocking rocky ridges, lake-chain/basin/meander water layouts,
connected land routes and equal flat starting economies. Three sizes and replay
seeds are available offline and online. Old saves retain their stored terrain.
Height-aware rendering and targeting must agree with simulation sampling.
Distinct physical ore deposits make gold readable beside cool-grey stone.

Implementation order: seeded generation and saved state; shared height sampling
and movement/build constraints; actual mesh and grounded objects/input; layered
local terrain materials; map settings and incremental online height transport;
automated and browser verification, mobile review and local production evidence.
Independent simulation, mineral and settings work uses disjoint file ownership.

The supplied screenshots are visual references. The YouTube link resolves to
Age of Empires 4 - MASSIVE HILL DEFENSE, but video frame access returned HTTP 403;
no claim of watching that footage is made. The official 0 A.D. GitHub mirror's
Alpine Valley source was inspected for terrain/pass constraints. No engine/map
code is copied. Three grass/dirt/cliff artworks are packaged separately under
their original CC BY-SA 3.0 terms, retaining attribution, source revision and
derivative notices.
