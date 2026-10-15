# City armies, realm assets and sieges — verification

Historical verification before the user-requested building rollback. Building and wall visuals have since been restored to the previous model library; see `building-rollback-verification.md`.

Verified locally on 15 October 2026. Changes remain uncommitted and unpublished.

## Delivered behavior

- Free Ashen Marches characters/equipment: three civilian outfits, four distinct infantry bodies, eight city cloth palettes, and seated scout/cavalry/heavy-cavalry riders. Existing animal assets remain unchanged.
- Quaternius Fantasy RTS building stages and Ultimate Nature trees, berry bushes, rocks and mountain formations. Owner roofs/standards match army colors. Visible enemy buildings show their observed stage; fog remembers the last observed stage.
- AI commits its main assault to town-hall destruction and breaches walls blocking either attack or occupation. Regressions cover defended capitals, enclosures completed during a raid, surviving small forces and lone trebuchets outside two enclosure sizes. Capture still requires normal contested occupation.
- Wooden walls at level 1; paid stone upgrades at level 2 and reinforcement at level 3. Upgrade timers, ownership, costs, saved queues and damage fraction are preserved. Wall meshes retain footprint bounds and readable vertical heights.
- Shared geometry banks and instancing remain active. Model preparation yields between banks, allowing input and screen changes; cancellation releases partial data.

## Automated checks

- `npm test`: **217 passed**, 28 files. Includes economy fairness on all three difficulties, teams, server authority, save/load, siege regressions and actual imported geometry/material/lifecycle checks.
- `npm run check`: passed. The final Playwright run rebuilt both client and server successfully.
- Broad browser run: 60 passed, 17 device-specific skips, one eight-seat menu-loading timeout. This exposed synchronous pose preparation blocking input.
- After the loading fix, focused browser recheck: **25 passed, 2 device-specific skips**. Covers all wall progression, fruit gathering, actor/texture/scenery failures, readable menu setup on desktop/phone/tablet, and successful eight-seat entry. Together the runs verify all 82 applicable browser cases; the eight-seat failure was reproduced and corrected.
- Local production runtime at `http://localhost:8180`: healthy, zero rooms at verification, correct local GLB/image responses, multiplayer welcome, actors/scenery/textures ready, villager recruitment spends 50 food, and no browser page errors. Temporary preview and test servers stopped after use.

## Rendering measurements

Windows Chromium, Intel UHD Graphics through D3D11. Each sample uses 120 frames after warm-up and waits for both actor and scenery imports. Army stress fixtures contain archers and spearmen; these figures are not measurements of 800 mounted troops. Phone means an emulated 390×664 viewport on this computer with 4× browser CPU throttling, not a physical phone.

| Layout | Troops | FPS | 95th percentile frame | Render scale |
|---|---:|---:|---:|---:|
| Desktop 1440×900 | 400 | 60.01 | 16.8 ms | 1.00 |
| Desktop 1440×900 | 800 | 60.00 | 16.8 ms | 1.00 |
| Emulated phone, 4× CPU throttle | 400 | 52.94 | 33.3 ms | 0.85 |
| Emulated phone, 4× CPU throttle | 800 | 34.95 | 50.0 ms | 0.85 |

The actor gallery loads 405 shared pose frames, 2,962 geometries, 31,681,746 geometry bytes, 48 materials and zero live mixers. These are complete shared banks, not per-unit allocations. Performance varies by hardware, viewport, camera and battle composition.

## Visual review and evidence

Inspected all eight city palettes and every infantry/mounted class, the cool iron heavy-cavalry helmet, day/night/rain scenes, and desktop/phone wall upgrade panels. Evidence is under `docs/realm-evidence`: `city-armies.png`, `local-runtime.png/json`, the wall-upgrade images, and the four performance JSON files. Final browser and unit summaries are retained alongside them.

See `THIRD_PARTY_ASSETS.md` and the two asset-provenance documents for exact licenses and intentional model mappings. Farms and animated gates retain authored geometry; stables reuse barracks models and smithies/workshops reuse storage yards. The supplied packs are stylized game assets.
