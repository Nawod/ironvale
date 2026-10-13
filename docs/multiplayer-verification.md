# Ironvale multiplayer verification

Verified locally on Windows on 2026-10-13. This release supports any 2–8 empires, public queues and private invitation rooms. Private rooms start only when the host presses **Start match**, after at least two human players have joined and everyone is ready. Empty private seats may optionally become AI opponents. Offline play remains available with 1–7 computer rivals.

## Delivery and rules

The production Node server serves the browser build and WebSocket connections together. Each match has its own authoritative simulation worker. Commands are validated and bound to the authenticated seat, with ownership, costs, construction prerequisites, population limits and visible-target checks enforced by the shared simulation. Players receive their own fog view, not full match state. Public queues match the requested human count; private rooms never start automatically.

Refresh and connection recovery retain the same seat for 120 seconds; expiration or explicit departure hands it permanently to AI. Online menus and hidden browser tabs do not pause other players. Full match checkpoints contain simulation state, AI plans, fog, queues, randomness and occupation progress; credentials are hashed in server storage. Normal shutdown flushes checkpoints. An unexpected interruption may lose progress since the last checkpoint, taken every 60 simulation seconds.

## Automated checks

- `npm test`: **78 passing tests in 15 files**. Includes the original economy, movement, combat, conquest, visibility and persistence checks, expanded map counts, private room authority, public queues for every count from 2 to 8, actual WebSocket/worker recruitment from multiple seats, replay rejection, seat reconnect, checkpoint restart recovery and elapsed-time server scheduling.
- `npm run build`: type checking, browser production build and server/worker build pass. Vite reports a large graphics bundle warning; it does not fail the build.
- The browser suite exercises offline recruitment, saves, gathering and construction, responsive controls, private host readiness/start, public matching, refresh recovery, menus while simulation continues and eight independent browser contexts sharing one map. Device-specific cases deliberately skip other projects.
- Full browser run after the three review repairs: **21 pass, 6 intentional device-specific skips**, across desktop, phone and tablet Chromium projects. Screenshots of the phone lobby and the eighth player's battlefield were inspected.
- After the subsequent clock repair, all multiplayer browser flows passed again: **7 pass, 2 intentional skips**, including the eight-context match. Local production server health and game page both respond successfully on port 5180.
- Dependency audit: zero known advisories at verification time.

## Independent review and regressions

One fresh read-only review found three important issues; each was reproduced with a failing test and repaired:

1. Build/repair orders now require an appropriate owned building. Build orders against units or completed buildings are rejected, preventing shared-match crashes and free instant repairs. Execution also handles targets that change after assignment.
2. Reconnecting to a restored finished match immediately sends the retained player-private result snapshot, preventing an indefinite loading screen.
3. Resource amounts outside sight retain last-seen values; unseen rival harvesting is no longer disclosed. Enemy orders, queues, routes, cargo, home positions and garrison lists are also removed from visible and remembered entities.

The reviewer found no critical issues and considered replacement-connection handling, host authority, sequence rejection, credential hashing and viewer ownership checks sound. No additional review round was requested.

## Simulation and performance

Test machine: Intel Core i5-12450H; Intel UHD Graphics and NVIDIA GeForce RTX 2050 installed. Chromium actually used **Intel UHD through ANGLE Direct3D11**, not the discrete GPU. Runtime: Node 24.16.0; Playwright 1.64.0.

An eight-empire Hard diagnostic match, seed 7, reached Duskwatch victory at **974.6 simulation seconds** in 77.4 seconds of headless computation. All seats used AI for this diagnostic, including the normally human seat. Rivals developed economies, advanced and conquered each other, ending with one empire; this is a simulation check, not a human playtest.

Browser rendering measurements use controlled 400- and 800-unit fixtures with delayed AI decisions, stable troop counts and native GPU acceleration. Phone testing uses Chromium device emulation and four-times CPU throttling on the desktop GPU. These measurements isolate rendering and do not establish end-to-end eight-player Internet performance or performance on a physical phone. Detailed timing and network reports are written to `test-results/` by the benchmark scripts.

| Fixture | Desktop FPS | Phone-emulated FPS | Phone p95 frame time |
|---|---:|---:|---:|
| 400 units, 4 empires | 60.00 | 60.00 | 16.8 ms |
| 800 units, 8 empires | 60.00 | 57.15 | 33.3 ms |

The eight-connection steady-state network measurement delivered **100 simulation ticks and 25 snapshots per player in 5.01 seconds**, confirming 20 Hz simulation and 5 Hz snapshots. Traffic was **45.51–47.46 KiB/s per player**, with an initial map/view packet total of roughly 160–164 KiB per player. This uses starting economies on localhost, not a late-game WAN load test. The first measurement revealed Windows timer drift; elapsed-time scheduling now catches up bounded batches of fixed steps, with deterministic regression coverage.

The final 800-unit, 1,200-tick pure simulation benchmark measured **1.20 ms mean, 3.23 ms p95 and 123.40 ms maximum** against a 50 ms tick budget. The isolated maximum exceeded that budget; elapsed-time scheduling can recover moderate delays, but these results do not guarantee every tick meets its deadline under all loads.

## Launch and hosting

Double-click `Play Ironvale.cmd`, or build and run `npm start`, then open **http://localhost:5180**. Friends on the same network should all open **http://YOUR-COMPUTER-LAN-IP:5180**; create the room from that address so copied invitations are reachable. Firewall access is device-dependent.

For public Internet play, deploy `dist`, `dist-server` and production dependencies to one Node 24 server with WebSocket support, HTTPS and a persistent private data directory. Configuration and the Docker recipe are in the README. Public hosting has not been deployed. Docker execution, physical phones, Safari/Firefox and simultaneous operation at the 32-room admission ceiling have not been verified. Multiple server instances, accounts, ranked matchmaking, chat and spectators are outside this release.

## Dynamic private-room revision

Private creation and the lobby no longer ask for a player count. Rooms allow up to eight humans, and the host manually starts the current ready joined group (2–8); no empty seats are required. Optional AI filling produces eight empires. Server tests cover every actual private start count from two to eight. Ctrl + left mouse drag pans the camera and preserves selection, verified against the actual pointer handlers and in desktop Chromium.

Updated browser checks: desktop Ctrl-drag, two-person dynamic private room, public matching and eight-browser dynamic room passed. The combined run had two mobile timing failures after the eight-context case (readiness and recruitment acknowledgement waits); unchanged phone/tablet private-room flows both passed in an isolated rerun (6.4s/8.7s). Mobile public matching passed in the combined run. These are emulated devices. The browser test server rebuilt and type-checked the final release.
