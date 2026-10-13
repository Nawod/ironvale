# Ironvale

An original, single-player medieval RTS for your browser. Build a city, assign workers, gather food/wood/stone/gold, hunt and cultivate, research three development stages, recruit armies, defend with walls and garrisons, and capture rival capitals.

One human plays against **one or three independent computer empires**. There are no alliances or time limits. Computer opponents fight each other, use the same resources and fog rules, and can capture cities. Last empire standing wins.

## Play locally

Requires Node.js 22.12+ or Node.js 24. Dependencies are already installed in this workspace.

```powershell
cd N:\Projects\GPT\ironvale
npm install
npm run dev
```

Open the local address printed by the server, normally http://localhost:5173. Alternatively, double-click **Play Ironvale.cmd** to build and launch the production game at http://localhost:5180. Close its server window or press Ctrl+C to stop it.

For a phone/tablet on the same Wi-Fi, use your computer's LAN IP and server port. The development server listens on the local network. Browser/device firewalls can affect access. Saves are separate on each device and each origin.

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Select | Click; drag to select units; Shift-click adds | Tap; use Idle villagers or Select army for groups |
| Contextual order | Right-click a resource, building, enemy, or ground | Choose an order button, then tap the target |
| Camera | Arrow keys; wheel zoom; middle-button drag | Drag to pan; pinch to zoom |
| Army orders | A attack-move; M move; P patrol; S stop | Command buttons |
| Home | H or the shield/Town center button | Shield/Town center button |
| Control groups | Ctrl+1–9 saves; 1–9 selects | Select army button |
| Pause | Space or Escape | Pause button |

Select villagers to place buildings. Building buttons show their costs and remain locked until the required development stage. Select production buildings to recruit or research. Town advancement requires a completed barracks and storehouse; Fortified Empire requires a smithy and market. Gates admit the owner's troops; walls block routes. Soldiers can garrison towers and fortresses. Hold position permits firing in range without pursuit.

Destroy an original capital and occupy its ruins with soldiers for **30 seconds**. Hostile troops contest and pause occupation; abandoning it resets progress. The owner can rebuild after clearing attackers. Capture transfers surviving buildings and villagers and disbands the defeated army. Captured capitals become outposts. Captured population may exceed housing, but recruitment waits for capacity.

## Saving and sound

Manual saves and a rolling autosave every 60 simulation seconds use IndexedDB. All simulation state is retained, including AI plans, fog, queues, and randomness. Loading starts paused. Leaving the tab pauses automatically. Saves remain in this browser on this device; clearing site data removes them. Local saves are not cloud accounts.

Music and sound effects are synthesized locally and adjustable in Settings. There are no external asset requests. All artwork is original code-drawn medieval vector art, rendered into cached local sprite textures.

## Build and verification

```powershell
npm run check
npm test
npx playwright install chromium
npm run test:browser
npm run simulate -- 1 72000
npm run simulate -- 3 72000
npx tsx scripts/benchmark.ts
npm run build
```

`dist/` is the deployable static site. Serve it through HTTP/HTTPS; opening `index.html` directly through `file://` does not support the module worker. Relative asset paths support hosting in a subdirectory. For a local production preview: `npx vite preview --host 127.0.0.1`.

The simulation is browser-independent TypeScript, running at 20 Hz in a Web Worker. React handles menus/controls; PixiJS WebGL handles the battlefield. Human and AI commands share validation. Rendering receives player-visible snapshots; saved matches retain full state. Future online multiplayer can reuse this simulation in an authoritative server, but networking, accounts, matchmaking, and cross-device saves are not implemented.

The benchmark uses a controlled 400-unit fixture with AI thinking delayed to isolate the load; rendering includes nearby combat, with enlarged unit health to keep the count stable. Browser benchmarks use native Windows Direct3D where available. Phone layouts/controls and CPU-throttled performance are emulated on the desktop GPU, **not physical-phone verification**. Test results, screenshots, headless diagnostic states and performance measurements are in `test-results/` after running the checks. Verified findings and limitations are recorded in `docs/verification.md`.
