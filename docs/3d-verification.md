# Ironvale 3D verification — 2026-10-14

Converted the battlefield to Three.js with original procedural medieval mesh models for every existing unit, building and resource. The elevated orthographic camera supports rotation, zoom, bounded panning and ray-based ground/model picking. Shared instanced geometry, cached model transforms and cached instance colors retain animation while reducing CPU work. React menus and original illustrated UI icons remain in place.

The authoritative simulation, save format and multiplayer protocol remain unchanged. Private rooms still accept a dynamic 2–8 joined players and start only through the host's Start match button. Public queues, AI opponents, ownership validation, recruitment exits, conquest, audio and browser-local saves retain their existing behavior.

## Controls

- Q/E or the visible curved-arrow buttons rotate the camera. The diamond button restores the default angle and zoom.
- Ctrl + left drag, middle drag or arrow keys pan; wheel zooms. Ordinary drag selects units, and right-click issues orders.
- Touch drag pans; hold 450 ms and drag selects groups; pinch zooms. Rotation/reset buttons also work on touch.
- Minimap and Home/Town center navigation continue to center the map independently of camera rotation.

## Final checks

- Type checking: passed.
- Simulation/server/unit suite: **93 tests passed in 17 files**.
- Chromium browser suite: **33 passed, 9 intentional device-specific skips, zero failures**. Desktop 1440×900, emulated iPhone 13 portrait/landscape and iPad Mini.
- Production build: passed. Client graphics bundle is 529.87 kB before gzip / 132.56 kB gzipped; Vite emits its standard 500 kB chunk advisory.
- Fresh read-only review and caching follow-up: no Critical or Important findings. A minor offscreen interpolation artifact was fixed by snapping stale poses on re-entry.

Checks include default/rotated camera projection round trips; fog texture orientation; model coverage and resource reuse; unchanged versus changed instance-color uploads; rotated drag panning; real 3D model selection; rotated ground placement; touch hold selection and pinch; recruitment, gathering, construction, tutorial and saves; audible Web Audio analyser output; dynamic host-started private rooms, public matchmaking, reconnect and eight separate browser contexts sharing one map. Screenshot inspection covered desktop, phone and tablet.

## Performance

Hardware: Windows, **12th Gen Intel Core i5-12450H**, Intel UHD Graphics through Chromium ANGLE Direct3D11. Same production build and browser settings as functional checks.

| View | World units | CPU throttle | FPS | p95 frame interval |
|---|---:|---:|---:|---:|
| Desktop 1440×900 | 400 | 1× | 60.00 | 16.8 ms |
| Desktop 1440×900 | 800 | 1× | 60.00 | 16.7 ms |
| Phone emulation 390×664 | 400 | 4× | 60.00 | 16.7 ms |
| Phone emulation 390×664 | 800 | 4× | 53.73 | 33.4 ms |

Each result samples 120 frame intervals after a 30-frame warm-up. Controlled four/eight-empire fixtures keep 100 troops per empire, delay AI planning and enlarge unit health to preserve counts during combat. Normal camera culling remains active; these are world counts, not a claim that every unit is on-screen simultaneously. CPU-throttled phone emulation uses this desktop GPU and **does not establish performance on a physical phone**. Physical touch devices, Safari and Firefox were not tested in this conversion.

The first phone 800-unit run measured 28.57 FPS; an isolated profile reproduced 29.51 FPS and identified repeated per-part transforms/color conversion. Cached immutable transforms, batch keys and colors resolved this without dropping units, mesh detail or animation cadence. The final whole-suite measurements above supersede the initial runs.

Evidence screenshots and final JSON measurements are in [3d-evidence](3d-evidence). The execution ledger is [3d-progress.md](3d-progress.md); approved design and plan are under `docs/superpowers/`.

## Delivery

Production health and actual served 3D renderer/rotation/recruitment smoke checks passed for both two- and four-empire single-player configurations.

Source and the deployable `dist`/`dist-server` builds are local. Play at **http://localhost:5180**; running/hosting instructions remain in the README. No public deployment was performed. Changes remain uncommitted on `3D-game`; HEAD remains `0c64571a33169fbe6fb40ba09873d5f99920f87d`.
