# Ironvale verification — 13 October 2026

## Delivered

Locally runnable original medieval RTS, production static build in `dist/`, and a Windows launcher. The approved design and milestone plan remain under `docs/superpowers/`. Online multiplayer and public deployment are future work.

## Automated checks

- TypeScript checking and Vite production build pass.
- 38 simulation/storage tests across nine files pass. Coverage includes equal seeded starts, ownership, costs, population reservations, carrying/drop-off, farms, prerequisites, upgrades, markets, paths, gates, counters, fog targeting, patrol/stances, garrisons, capital rebuilding, contested/interrupted occupation, captured population overflow, transfers, results, saved randomness/AI continuity, incompatible saves, and unavailable storage.
- Production-build Playwright checks run in Chromium on desktop, iPhone 13 emulation and iPad Mini emulation. Twelve checks pass; three device-inapplicable cases are intentionally skipped. They exercise recruitment, tutorial/four-empire setup, actual gathering and house construction, save/reload/resume, portrait/landscape layout, and 400-unit rendering. Touch flows use touchscreen events.
- Screenshots were visually inspected for desktop, phone portrait and phone landscape. Full match outcomes are automated headless runs, rather than a claim that a person has manually played complete matches.

## Headless conquest runs

The diagnostic runner gives the human slot the same AI planner, so all empires develop through ordinary validated commands, with normal resources and fog. Hard difficulty; simulation time, not wall time:

| Seed | Empires | Result | Duration |
|---|---|---|---|
| 42 | 2 | Your empire captures Redcliff; human victory | 404.55 seconds |
| 42 | 4 | Your empire captures all three rivals; human victory | 768.6 seconds |
| 7 | 4 | Redcliff captures Duskwatch, Your empire, then Goldmere; human defeat and AI-versus-AI conquest | 758 seconds |

Rivals gather, construct, advance to Town/Fortified Empire, recruit, defend and launch raids. These seeds demonstrate completion, not a guarantee against every possible stalemate or a comprehensive balance study. The runner exits unsuccessfully if no winner is reached within its requested tick budget. An optional fourth argument selects the seed, e.g. `npm run simulate -- 3 72000 7`.

## Performance and tested hardware

Windows workstation: Intel Core i5-12450H, Intel UHD Graphics; NVIDIA RTX 2050 also installed. Chromium used ANGLE Direct3D11 on **Intel UHD**, not the NVIDIA GPU. Node 24.16.0. Tests use the production build; development React bookkeeping is deliberately excluded from shipping-performance measurements.

400-unit fixture: four empires, 100 troops each. AI decision scheduling is delayed to isolate the fixed simulation/rendering load. Rendering places troops near the camera, includes combat and increases health to keep all 400 alive. It uses the real simulation worker and fog/rendering path. Browser samples retain 120 animation-frame intervals after 30 warm-up intervals.

Desktop targets approximately 60 FPS; phone emulation targets at least 30 FPS under four-times CPU throttling. Both pass. Exact run measurements are in `test-results/desktop-performance.json` and `phone-performance.json`; the final desktop run measured 58.54 FPS and phone emulation measured 54.55 FPS (earlier isolated runs reached 60 FPS). Typical 95th-percentile frame interval: 16.8 ms.

The separate 1,200-tick simulation benchmark retains 400 units: mean approximately 0.39 ms/tick, 95th percentile 0.76 ms, maximum 36.8 ms, against the 50 ms tick budget. Run measurements vary with other workstation activity.

**Phone/tablet testing is emulation on a desktop GPU. No physical mobile hardware, Safari, or Firefox has been verified.** Software-only WebGL performed poorly; the measured targets rely on accelerated graphics. Long-session memory, broad device compatibility, and large seed/balance sweeps remain follow-up validation.

## Review and repairs

A separate read-only review identified save restoration after a captured outpost is destroyed, stale explicit attacks after ownership changes, and hold-position acquisition. Regression tests reproduced and verified the repairs. Final headless validation also caught long cross-map scout routes exceeding an arbitrary search limit; pathfinding now uses an octile heuristic and a map-sized closed-node budget, with a failing-then-passing regression test.

Artwork is original locally generated vector sprites with procedural movement/combat effects; audio is original local synthesis. No remote art/audio service or external asset download is required. This is a playable first release with stylized graphics, rather than photorealistic artwork or a claim of commercial-release balancing.
