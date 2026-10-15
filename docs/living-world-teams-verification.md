# Living world and online teams verification

The later [fair AI and ecology verification](fair-ai-living-realm-verification.md) supersedes this report's visual assets and rendering measurements. The team rules below remain applicable.

Work started 2026-10-14 and verified 2026-10-15 in the existing `debug` branch. Changes remain uncommitted and have not been published to a public host.

## Delivered behavior

- Private and public online games offer free-for-all or teams. Maximum four commanders per team; private rooms allow uneven groups, including tested 2v4. Players choose their own team, while the host can arrange any seat. Server validation rejects fifth members and unauthorized assignments; changes clear readiness and membership freezes on start.
- Starting cities form nearby allied clusters with independent starting resources. Exhaustive tests cover all legal ordered team-size partitions for 2-8 players, preserving at least 23 tiles between capitals and map margins. The border test found a compressed three-player cluster, which was corrected by positioning the entire cluster inside the map.
- Alliance rules apply to automatic targeting, direct attack commands, AI threats, allied gates, rebuilding, occupation and victory. Allies cooperate in capturing enemy ruins and defend friendly ones. The capturing commander receives conquered assets. Resources, recruitment, upgrades, production queues and commands remain individually owned. Shared scouting does not reveal inventories or enemy orders.
- Membership survives refresh, reconnect, AI takeover and save/checkpoint restoration. Old free-for-all saves still load. Public team queues are separate from free-for-all; AI fill respects four-member limits.
- A deterministic 24-minute day starts at 08:00. Weather targets change every three simulation minutes and blend over 30 seconds. Clear, overcast, fog, rain and storms affect clouds, rain, mist, wind and lighting. Maximum rain movement penalty: 12%. Match tick and seed drive both simulation and presentation; pause/save behavior does not depend on wall-clock time.
- Smooth articulated people, shaped deer/horses, irregular leafy crowns, textured masonry/wood/roof/cloth/metal and finer ground surfaces replace the former rectangular anatomy and cone trees. Original procedural assets remain stylized RTS art; photorealistic scanned or externally authored character assets are not included.
- Spatial crowd separation respects blocked footprints and bounds. Obstruction grids survive unchanged ticks, allied players reuse gate-compatible grids, target selection avoids sorting, hunting uses target lookup, snapshots use ID sets, and unchanged terrain skips texture uploads. Static model geometry and surface textures are reused. Sustained rendering load reduces optional pixel density and shadows.

## Verification evidence

- `npm test`: **124 passing tests in 20 files**, including the dense-crowd review regression.
- `npm run build`: passed (TypeScript, Vite browser build and Node server/worker bundles). Vite reports its existing >500 kB graphics-chunk advisory; the final graphics bundle is approximately 548 kB / 137 kB gzip.
- Full Playwright suite: **52 passed, 17 platform-specific skips** across desktop, phone and tablet configurations. Includes eight simultaneous browser participants, private/public online games, reconnect, recruitment, saving/loading, touch selection/commands, rotation, placement, team roster changes and independent resources.
- New team browser flow uses three independent browser contexts, starts an unequal 1v2 game, confirms readiness reset and guest assignment restrictions, recruits independently, and refreshes an allied seat without losing its team or inventory.
- Day, midnight and rain scenes are rendered in desktop and phone layouts and inspected from captured screenshots. Night remains deliberately readable, with moonlight and glowing windows.

## Measured performance

Controlled simulation fixture, 1,200 ticks with AI thinking delayed and 400/800 troops:

| Units | Mean simulation tick | 95th percentile | 50 ms budget |
|---|---:|---:|---:|
| 400 | 0.734 ms | 1.988 ms | Passed |
| 800 | 1.221 ms | 3.000 ms | Passed |

The initial 800-unit baseline measured 2.463 ms mean and 4.382 ms p95. These are local benchmark samples, not a guarantee for every map or hardware configuration; individual pathfinding spikes can still exceed 50 ms.

Final focused rendering measurements, Intel UHD / Windows Direct3D11 (full-suite results also retained in logs):

| Layout | Units | FPS | 95th percentile frame |
|---|---:|---:|---:|
| Desktop | 400 | 60.00 | 16.8 ms |
| Desktop | 800 | 60.00 | 16.8 ms |
| Phone layout, CPU throttled 4x | 400 | 55.82 | 16.8 ms |
| Phone layout, CPU throttled 4x | 800 | 54.55 | 33.3 ms |

The earlier full-suite phone-layout 800-unit sample was 32.43 FPS, illustrating run-to-run variation; the final sample above is not a physical-phone FPS claim. Phone and tablet runs use desktop GPU emulation, **not physical mobile devices**. Fixtures isolate a controlled battle and are not a simultaneous multi-room server capacity claim.

## Running the result

The launcher, production server, development WebSocket proxy, environment example and container now consistently use port **8180**. Double-click `Play Ironvale.cmd`, or build and run `npm start`, then open `http://localhost:8180`. Friends on the same network use the host's LAN address and port 8180. Internet-wide access still requires deploying the existing Node/WebSocket server to an accessible host.

Three.js rendering APIs were checked against the [official documentation](https://threejs.org/docs/).

## Final review and verification

Independent review found two concrete issues: mismatched development/production ports, and a dense collision bucket that repeatedly skipped later IDs. Ports now consistently use 8180. The collision defect was reproduced with a failing test, then fixed with separate active/idle buckets, tick-rotated bounded scan windows and a maximum successful displacement of 0.09 tiles per unit per tick. The reviewer rechecked this fix and reported no remaining actionable defect in the reviewed routine.

Final `npm test`: 124 passing tests in 20 files. Final `npm run build`: passed. Focused living-world/team browser rerun: 7 passed, one desktop-only team test skipped on phone. Final gameplay/recruitment/save/construction/rendering rerun: 11 passed, one phone-only landscape test skipped on desktop. `git diff --check` passes. The updated production server was started locally on port 8180; HTTP health, root page and WebSocket welcome were checked separately.

Evidence screenshots and measured reports are retained in `docs/living-world-evidence/`. The production process remains available locally; no remote deployment, commit or push was performed.
