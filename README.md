# Ironvale

An original 3D medieval RTS for your browser, with single-player and server-authoritative online multiplayer. Build a city, assign workers, gather food/wood/stone/gold, hunt and cultivate, research three development stages, recruit armies, defend with walls and garrisons, and capture rival capitals.

**Two to eight empires** share one map. Online matches support public matchmaking and private invitation rooms. Single-player supports one to seven computer rivals. There are no alliances or time limits. Computer opponents fight each other, use the same resources and fog rules, and can capture cities. Last empire standing wins.

## Play locally

Requires Node.js 24. Dependencies are already installed in this workspace.

```powershell
cd N:\Projects\GPT\ironvale
npm ci
npm run build
npm start
```

Open http://localhost:5180. The same Node server serves the game and its online connections. Alternatively, double-click **Play Ironvale.cmd** to build and launch the production game at http://localhost:5180. Close its server window or press Ctrl+C to stop it.

For friends or a phone/tablet on the same Wi-Fi, open http://YOUR-COMPUTER-LAN-IP:5180 on each device. Open that LAN address on the host too before copying the invite, so the invitation points to the reachable computer rather than localhost. The game server listens on the local network. Browser/device firewalls can affect access. Saves are separate on each device and each origin.

## Online matches

Choose **Play online** and enter your guest name. Accounts are not required.

- **Create room:** share the room code or invitation link. At least two humans must join. Each participant presses **Ready**. Only the creator/host sees the **Start match** button; joining and readiness never start a private game automatically. No player count is chosen when creating a private room: up to eight humans can join, and Start match uses the actual joined count (2–8). The host can optionally fill remaining seats with AI for an eight-empire match. Changing room settings clears readiness so everyone can confirm them.
- **Join room:** use a friend's invitation link or enter their code, then press Ready and wait for the host.
- **Find a match:** select the number of human players2–8. Public queues fill that exact count and start after a short countdown. There is no ranked ladder, party matchmaking or artificial queue timeout.

Online games keep running when you open menus, switch tabs or lose your connection. Reconnect within120 seconds to recover the same empire. After the deadline, or when you choose Leave match, the computer takes over permanently. Refresh recovery uses a private credential in this tab's session storage; it is not part of the invitation link. A second connection using that credential replaces the old connection. Guest names are display labels, not accounts.

The server validates every order and only sends your own fog-of-war view. Clients cannot spend another empire's resources, command its troops, or load a local save to rewind a shared match. Server checkpoints use the configured data directory and recover after a normal restart; browser-local saves remain for single-player games.

For local development use `npm run dev` plus `npm run server` in a second terminal. Vite proxies `/ws` to the Node server on5180. The production launcher runs a single combined server.

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Select | Click; drag to select units; Shift-click adds | Tap; hold 450 ms then drag a box for groups; use Idle villagers or Select army |
| Contextual order | Right-click a resource, building, enemy, or ground | Choose an order button, then tap the target |
| Camera | Ctrl + left mouse drag; arrow keys; wheel zoom; middle-button drag | Drag to pan; pinch to zoom |
| Rotate/reset | Q / E or arrow buttons rotate; diamond button resets angle/zoom | Camera arrow and diamond buttons |
| Army orders | A attack-move; M move; P patrol; S stop | Command buttons |
| Home | H or the shield/Town center button | Shield/Town center button |
| Control groups | Ctrl+1–9 saves; 1–9 selects | Select army button |
| Pause | Space or Escape | Pause button |

Select villagers to place buildings. Building buttons show their costs and remain locked until the required development stage. Select production buildings to recruit or research. Recruits emerge on the front side of their building, using another clear nearby exit if the front is blocked. Town advancement requires a completed barracks and storehouse; Fortified Empire requires a smithy and market. Gates admit the owner's troops; walls block routes. Soldiers can garrison towers and fortresses. Hold position permits firing in range without pursuit.

Destroy an original capital and occupy its ruins with soldiers for **30 seconds**. Hostile troops contest and pause occupation; abandoning it resets progress. The owner can rebuild after clearing attackers. Capture transfers surviving buildings and villagers and disbands the defeated army. Captured capitals become outposts. Captured population may exceed housing, but recruitment waits for capacity.

## Saving and sound

Manual saves and a rolling autosave every 60 simulation seconds use IndexedDB. All simulation state is retained, including AI plans, fog, queues, and randomness. Loading starts paused. Leaving the tab pauses single-player automatically; online matches continue. Saves remain in this browser on this device; clearing site data removes them. Local saves are not cloud accounts.

Music and sound effects are synthesized locally and adjustable in Settings. Audio unlocks on your first tap, click or keypress; Settings includes a Test sound button. There are no external asset requests. The battlefield uses original locally generated 3D medieval meshes, animated workers and troops, directional lighting, desktop shadows and visible projectile trajectories. UI icons retain the original code-drawn artwork.

## Build and verification

```powershell
npm run check
npm test
npx playwright install chromium
npm run test:browser
npm run simulate -- 1 72000
npm run simulate -- 3 72000
npx tsx scripts/benchmark.ts 7
npx tsx scripts/network-benchmark.ts
npm run build
```

`dist/` contains the browser build and `dist-server/` contains the Node server and simulation worker. To provide online play, deploy both together with the production dependencies; a static-only host supports offline play but cannot run multiplayer. Serve it through HTTP/HTTPS; opening `index.html` directly through `file://` does not support the module worker. Relative asset paths support hosting in a subdirectory. For local production play use `npm start`; Vite preview serves static files only.

The simulation is browser-independent TypeScript, running at20 Hz in a browser worker offline or a Node worker thread online. React handles menus/controls; Three.js WebGL handles the 3D battlefield. Human and AI commands share validation. Rendering receives player-visible snapshots; saved matches retain full state. Online rooms use WebSockets, player-specific snapshots, and server-controlled human/AI seats. Accounts, ranked play, chat, spectators, and cross-device guest identity are not implemented.

The benchmark uses a controlled 400- and 800-unit fixtures with AI thinking delayed to isolate the load; rendering includes nearby combat, with enlarged unit health to keep the count stable. Browser benchmarks use native Windows Direct3D where available. Phone layouts/controls and CPU-throttled performance are emulated on the desktop GPU, **not physical-phone verification**. Test results, screenshots, headless diagnostic states and performance measurements are in `test-results/` after running the checks. 3D conversion evidence is in `docs/3d-verification.md`. Original verification is in `docs/verification.md`; multiplayer evidence and current limits are in `docs/multiplayer-verification.md`.


## Public hosting

Use a Node24 host with a persistent filesystem and WebSocket support. This project is locally verified; it has not been published to a public service. All players must connect to the same server instance.

Set environment variables in your host settings or shell; `.env.example` is a configuration reference and is not loaded automatically:

| Variable | Default | Purpose |
|---|---|---|
| PORT |5180| HTTP/WebSocket port |
| HOST |0.0.0.0| Listen address |
| DATA_DIR |./server-data| Private persistent match checkpoints |
| MAX_ROOMS |32| Room admission limit; size according to host resources |
| PUBLIC_ORIGIN |unset| Exact allowed browser origin, e.g. https://game.example.com |

Build with `npm ci && npm run build`, then run `npm start`. Put HTTPS in front of the server and proxy both ordinary HTTP and WebSocket upgrades on `/ws`. Set PUBLIC_ORIGIN to the browser-visible HTTPS origin. Keep DATA_DIR outside the public `dist` directory, attach durable storage, and restrict its filesystem permissions. Check `/health` for readiness. Stop using SIGINT/SIGTERM so the server flushes its current matches before exit. Unexpected process/power failures recover the most recent60-simulation-second checkpoint, rather than every uncheckpointed command.

A Dockerfile is included:

```text
docker build -t ironvale .
docker run --rm -p 5180:5180 -v ironvale-data:/data ironvale
```

The Docker recipe is provided for hosting; Docker execution is not part of the Windows verification. Use a single instance for this release. Multiple independent instances would have separate queues and rooms; a distributed match router is future work. MAX_ROOMS is an admission ceiling, not a claim that32 eight-player games have been load-tested simultaneously.

WebSocket implementation follows the [ws documentation](https://github.com/websockets/ws); server simulation isolation uses [Node worker threads](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html).
