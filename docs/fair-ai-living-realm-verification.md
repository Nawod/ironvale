# Fair AI, ecology and readable interface verification

Implemented locally on 2026-10-15 in the existing uncommitted `debug` workspace. This report supersedes the visual/asset descriptions and rendering measurements in the earlier living-world report. No public deployment, commit or push was performed.

## AI audit

Humans and AI use the same purchase validation, gathering rates, construction work, recruitment queues, research timers, housing reservations and initial inventory. Difficulty changes decision frequency, worker target and raid threshold. Six ordinary 180-second openings (two seeds, three difficulties) found no unexplained resource changes or shortened production timers. The AI gains time from consistent assignments and queueing. No unsupported economy nerf was applied. The audit includes 39 fairness tests, literal-cost/boundary checks and mirrored-controller comparisons; full evidence and reproduction steps are in [ai-fairness-audit.md](ai-fairness-audit.md).

## Delivered behavior

- Oak, birch, pine and fir trees; deer, cattle, alpacas and foxes; two harvestable fruit bushes beside each city. Every empire receives the same 720 starting animal food plus 300 bush food. Food gathering delivers into the owner's food stock and retargets only visible neutral food sources. Bushes remain rooted and animals roam.
- Complete CC0 infantry and animal meshes, source skin colors and UVs, team badges and attached tools, sampled walking/work/attack poses, proper forward orientation and grounded feet. Models and reduced textures are bundled locally with [credits and retained licenses](../THIRD_PARTY_ASSETS.md). Buildings and mounted troops retain authored procedural models. These are detailed game assets rather than photoreal scans.
- Nonblocking model loading with a playable basic-model fallback. Optional forest maps are awaited before replacing procedural foliage; unavailable images retain complete original trees and show an explicit status. Late image/model completion is disposed safely after leaving a scene.
- Shared full and crowd animation banks; the crowd bank preserves anatomy/materials while reducing human triangles to roughly one third. It is used for more than 180 visible troops or zoom below 0.7. Large armies omit actor shadow passes while retaining scenery shadows. No animation mixer or rig is retained per entity.
- A deterministic 24-minute day, starting at 08:00; three-minute weather targets with 30-second blends; clear/overcast/fog/rain/storm conditions. Wind-driven cloud banks, bounded rain, cloud shadows, daylight/moonlight, glowing windows and wet-ground shading follow the match tick and seed. Maximum rain movement penalty is 12% for all players. Pauses and save/reconnect preserve the clock.
- Revised village menu and HUD with 22–24px resource totals, 16px controls, 14px costs/times and at least 44px control targets; persistent larger-text preference. Separate resource/status/camera rows, scrolling production lists, visible training/construction times and queue progress. Phone camera framing respects the larger interface.
- Prior online team rules remain: up to four players per team, uneven sides allowed, allied cities nearby, no friendly attacks, individual stock/production/commands, shared scouting and cooperative combat.

## Validation

`npm test`: **189 passing tests in 24 files**. Production build and TypeScript compilation pass. The complete browser run exercised 87 project/case combinations: 69 passed, 17 were intentionally skipped for device-specific cases, and one phone placement case found a shortcut covering its map target. The phone selection shortcuts now hide while choosing an order target and return after the command. The final focused rerun passed **5/5**, including the original rotated-placement target, restored shortcuts, fruit gathering, house placement and readable/large controls. All **70 applicable unique browser checks** therefore have passing verification; the original full-run log and final correction log are both retained.

Independent read-only simulation and rendering reviews found no remaining important defect after the optional-texture fallback correction; parent verification includes the complete tests rather than relying on reviewer test execution.

Final full-suite rendering measurements, Intel UHD / Windows Direct3D11, with detailed models and forest textures loaded:

| Layout | Units | FPS | Frame p95 | Render scale |
| --- | ---: | ---: | ---: | ---: |
| Desktop 1440x900 | 400 | 59.51 | 16.8 ms | 1.00 |
| Desktop 1440x900 | 800 | 56.69 | 16.8 ms | 0.85 |
| Phone layout, CPU throttled 4x | 400 | 48.32 | 33.4 ms | 0.85 |
| Phone layout, CPU throttled 4x | 800 | 32.14 | 50.0 ms | 0.75 |

The initial detailed-model desktop samples were 50.00 FPS at 400 units and 36.18 FPS at 800 units. Shared crowd poses, reduced shadow work and earlier adaptive density recover the existing performance thresholds while keeping imported anatomy. The lighter render scale affects the 3D canvas; interface text stays at its normal CSS resolution. Run-to-run variation remains: focused phone-layout samples reached 57.15/50.71 FPS for 400/800, and the full-run values above are retained rather than replacing them with the faster samples.

Isolated simulation samples after browser tests finished, 1,200 ticks each:

| Units | Mean tick | Tick p95 | Tick budget |
| --- | ---: | ---: | ---: |
| 400 | 0.60 ms | 1.55 ms | 50 ms |
| 800 | 1.37 ms | 3.34 ms | 50 ms |

The 800-unit sample still had a 156 ms maximum outlier. Typical tick cost is well below budget; this is not a guarantee that every pathfinding/allocation spike stays below 50 ms. Simulation runs in a separate worker.

Screenshots, test logs and JSON reports are retained in `realm-evidence/`. Browser phone/tablet checks use desktop Chromium/GPU emulation, **not physical devices**. Controlled army fixtures do not establish multi-room server capacity or human-vs-AI win rates.

## Running locally

Double-click `Play Ironvale.cmd` or build and run `npm start`, then open <http://localhost:8180>. Other players on the same network use the host's LAN address with port 8180. Internet play requires an accessible Node/WebSocket deployment; this task did not publish one.

The local server was refreshed only after `/health` reported zero rooms. `node scripts/verify-local-runtime.mjs` then passed against port 8180: health ready, correct GLB/JPEG/PNG response types and revalidation headers, WebSocket welcome, decoded detailed models/forest maps, successful recruitment with 50 food deducted and no page errors. Runtime evidence is retained as `realm-evidence/local-runtime.json` and `local-runtime.png`. The managed server remains running locally.
