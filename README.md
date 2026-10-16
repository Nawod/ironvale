# Ironvale

An original 3D medieval RTS for your browser, with single-player and server-authoritative online multiplayer. Build a city, assign workers, gather food/wood/stone/gold, hunt and cultivate, research three development stages, recruit armies, defend with walls and garrisons, and capture rival capitals.

**Two to eight empires** share one map. Online matches support public matchmaking and private invitation rooms. Single-player supports one to seven computer rivals. Choose free-for-all or online teams of up to four commanders. Teams may have unequal sizes, such as 2 versus 4. There are no time limits. Computer opponents fight each other, use the same resources and fog rules, and can capture cities. The last empire or allied team standing wins.

Choose **Riverlands** for rivers, permanent stone bridges and shallow crossings, or **Lowlands** for open land and woodland. Map choice is available in single-player setup, private room settings and public matchmaking. Armies and workers route through crossings; construction and building relocation require dry, fully scouted ground. Older saves keep their original Lowlands map.

## Play locally

Requires Node.js 24. Dependencies are already installed in this workspace.

```powershell
cd N:\Projects\GPT\ironvale
npm ci
npm run build
npm start
```

Open http://localhost:8180. The same Node server serves the game and its online connections. Alternatively, double-click **Play Ironvale.cmd** to build and launch the production game at http://localhost:8180. Close its server window or press Ctrl+C to stop it.

For friends or a phone/tablet on the same Wi-Fi, open http://YOUR-COMPUTER-LAN-IP:8180 on each device. Open that LAN address on the host too before copying the invite, so the invitation points to the reachable computer rather than localhost. The game server listens on the local network. Browser/device firewalls can affect access. Saves are separate on each device and each origin.

## Online matches

Choose **Play with Freinds** and enter your guest name. Accounts are not required.

- **Create room:** share the room code or invitation link. At least two humans must join. Each participant presses **Ready**. Only the creator/host sees the **Start match** button; joining and readiness never start a private game automatically. No player count is chosen when creating a private room: up to eight humans can join, and Start match uses the actual joined count (2–8). The host can optionally fill remaining seats with AI for an eight-empire match. Changing room settings clears readiness so everyone can confirm them.
- **Join room:** use a friend's invitation link or enter their code, then press Ready and wait for the host.
- **Teams:** select Teams when creating a room, or change Match type in the lobby. Each commander chooses a team; the host can arrange every seat. Each team holds at most four players and at least two opposing teams must remain. Unequal sizes are allowed. Changing teams or room settings clears readiness. Allies start in nearby cities, share scouting, use each other's gates and fight together without friendly fire. Resources, buildings, recruitment, upgrades and unit commands stay independently owned. Allied troops cooperate in enemy occupation and defend friendly ruins; conquered cities go to the occupying commander. Team membership persists through refresh, reconnect, AI takeover and server saves.
- **Find a match:** choose free-for-all or teams and select the number of human players2–8. Team and free-for-all queues remain separate. Public team games assign balanced groups of at most four; private rooms support custom unequal groups. Public queues fill that exact count and start after a short countdown. There is no ranked ladder, party matchmaking or artificial queue timeout.

Online games keep running when you open menus, switch tabs or lose your connection. Reconnect within120 seconds to recover the same empire. After the deadline, or when you choose Leave match, the computer takes over permanently. Refresh recovery uses a private credential in this tab's session storage; it is not part of the invitation link. A second connection using that credential replaces the old connection. Guest names are display labels, not accounts.

The server validates every order and only sends your own fog-of-war view. Clients cannot spend another empire's resources, command its troops, or load a local save to rewind a shared match. Server checkpoints use the configured data directory and recover after a normal restart; browser-local saves remain for single-player games.

For local development use `npm run dev` plus `npm run server` in a second terminal. Vite proxies `/ws` to the Node server on8180. The production launcher runs a single combined server.

## Voice chat

The online lobby and match have a **Voice chat** panel. In a match, use the headphones button to open it; after joining, a separate **Muted / Mic on** button stays visible for immediate mute control. Expand it, choose a channel and press **Join voice**. Allow microphone access; you join muted, then press **Unmute** to talk. **Mute** silences your microphone, the sound button mutes incoming voices independently, and **Leave** stops microphone capture. Voice stays connected when the lobby starts a match. Controls remain accessible over the war council, settings and match-result overlays.

Free-for-all uses **Open**, where everyone in that room using Open can talk. Team games also offer **Team**, where only teammates using Team are connected. Switching channels closes the old connections first and starts muted in the new channel. Teammates using Open do not hear Team chat. Changing team assignments or match type ends voice membership; join again once the new arrangement is settled. Disconnects and seat replacement stop capture and require an explicit rejoin. Voice is not recorded or included in saved games.

Microphones work at localhost or a browser-trusted HTTPS origin. Friends opening the plain HTTP LAN address can still play, but the browser blocks microphone access there. Use HTTPS with a trusted certificate, either through your hosting proxy or the built-in HTTPS options below. This is a [browser requirement](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). If incoming audio is blocked by the browser, the panel offers **Enable incoming voice audio**.

The game uses an audio-only WebRTC mesh (at most seven peer connections per player), the existing room connection for validated signaling, and [Cloudflare's public STUN server](https://developers.cloudflare.com/realtime/sfu/get-started/connection-patterns/). Some internet networks require a TURN relay; configure your own through `VOICE_ICE_SERVERS` if direct calls cannot connect. No relay service is purchased or bundled. This JSON configuration is delivered to browsers, so use client relay credentials rather than a provider's management API key. For example: `[{"urls":"turn:relay.example.com:3478","username":"client-user","credential":"client-credential"}]`. An empty array selects local/direct connections only. Local automated calls use simulated microphones and real WebRTC audio transport; physical-device and public-internet calls are not part of this verification.

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Select | Click; drag to select units; Shift-click adds | Tap; hold 450 ms then drag a box for groups; use Idle villagers or Select all army |
| Contextual order | Right-click a resource, building, enemy, or ground | With units selected, tap resources to gather, enemies to attack, or ground to move; command buttons remain available |
| Camera | Middle-button drag or arrow keys pan; Ctrl + left drag rotates; wheel zooms | Drag to pan; two fingers pinch to zoom and twist to rotate |
| Rotate/reset | Q / E; open Camera tools for rotate/reset buttons | Open the compass button for rotate/reset |
| Army orders | A attack-move; M move; P patrol; S stop | Commands → Orders |
| Home | H or the shield/Town center button | Shield/Town center button |
| Control groups | Ctrl+1–9 saves; 1–9 selects | Select all army button |
| Pause / menu | Space; Escape dismisses an open panel before opening the menu | Top-right Game menu button |

On phones and tablets, tap **Commands** beside the selected unit or building. Workers have **Orders / Build / Tasks**; buildings show **Train / Improve / Manage** as appropriate. Portrait uses a bottom sheet; short landscape uses a right-side drawer. Lists scroll to reach every action. Selecting a building placement or targeted order closes the panel so you can tap the battlefield. Use **Cancel** to leave targeting mode. The map button opens the minimap; Realm status shows the age, opponents, time, weather and zombie state. The Game menu contains Save (single-player), Settings, Help and exit controls. Larger text is available in Settings. Desktop keeps a compact bottom command dock and minimap; the dock can be collapsed.

Select villagers to place buildings. Building buttons show their costs and remain locked until the required development stage. Select production buildings to recruit or research. Recruits emerge on the front side of their building, using another clear nearby exit if the front is blocked. Town advancement requires a completed barracks and storehouse; Fortified Empire requires a smithy and market. Gates admit the owner's troops; walls block routes. Soldiers can garrison towers and fortresses. Hold position permits firing in range without pursuit.

With villagers selected, click or tap an unfinished friendly building to assign them to finish construction. Completed buildings remain selectable; Shift-click can select an unfinished building without assigning workers.

Workers remember interrupted tasks automatically. A newly assigned task runs first, then the worker returns to the most recently interrupted task and continues through their saved work. Gathering lasts until that source is exhausted; pending assignments take priority over automatically finding another source or farming a newly completed farm. Distant jobs return to their last known location before checking the target. Completed, destroyed or no-longer-owned jobs are skipped. Each selected worker keeps their own tasks; open **Tasks** and expand the pending-task count to inspect the list. Stop clears the task list. Task memory is saved and retained in online matches.

Select an owned building and open **Manage** to **Move building** or **Remove building** in solo and online games. Moving a completed building preserves its health, upgrades, farm food and identity; choose clear, currently scouted land. Empty its production/upgrade queue and garrison first. Visible enemies must be more than ten tiles away and ten seconds must pass after damage. Removal requires confirmation and gives no resource refund; workers resume their remaining valid tasks. Original town centers remain fixed and cannot be removed because they are conquest objectives.

Enable **Zombie mode** before a single-player match, when creating an online room, or in public matchmaking. Private hosts can change it before starting; everyone must ready again. Zombie and ordinary public queues stay separate. Neutral undead attack human and computer cities regardless of teams from **18:00 until 06:00**, then stop attacking and return to their original forest refuges. The 24-minute world day starts at 08:00, so the first raid begins after ten minutes of match time. Hordes refill once per night, from eight toward twelve per surviving city, capped at 96 globally. They use no player resources or population, grant no scouting, and cannot capture cities or win the match. Players and AI can fight them, and zombies can breach walls. Normal conquest remains the objective; mode, wave cycle and refuge positions survive saves and server recovery.

For connected defenses, choose **Wooden wall line** or **Stone wall line** in a villager's Build tab. Click/tap a start and an end, review the green/red route markers and total resource cost, then press **Build line**. A diagonal choice forms an L, horizontally then vertically, with at most 64 sections per order. Existing living wooden/stone sections you own are reused free. The entire route must be visible and clear before anything is purchased; blocked routes and insufficient resources leave the match unchanged. **Start over** chooses a new start; **Cancel** leaves the tool. Individual wall placement remains available.

Consecutive wooden and stone wall placement keeps its construction order. Interrupting that work pauses the entire remaining wall sequence; it resumes after the newer task. Each site is paid for once when placed. Saved work is limited to 128 pending tasks/segments per worker; a full list rejects further assignments before spending resources. Wooden and stone corners, T-junctions and crossings join automatically, including offset connections beside gates and mixed-material upgrades.

Army Orders also includes **Formation**: Line places melee ahead of archers and siege, Box keeps compact ranks, and Spread gives wider spacing. The formation shapes the next Move, Attack-move or Patrol destination; troops use separate reachable tiles. This is destination formation rather than a rigid marching formation.

The medieval command deck uses carved oak and brass framing, portraits rendered from the game's actual models, a visible health meter and illustrated production progress. Portraits follow each city's color, the building age and reinforced wall tier. Select a mixed army and click its type/count portraits to select just those troops; on mobile, find those groups in Commands → Orders. The minimap's pale outline shows the current camera view and follows panning, rotation and zoom. Click/tap the map to navigate; keyboard activation returns to your town center. Compact phone/tablet panels still open on demand.

The 442 bundled WebP portraits total about 2.7 MB and load as ordinary images; selecting units does not create another 3D renderer. To regenerate them after changing models, run `npx tsx scripts/bake-command-portraits.ts` locally. The optional `--preview` flag renders a small sample. Normal builds use the bundled portraits and do not run the workshop. Missing images fall back to the earlier artwork. [Command-deck verification and screenshots](docs/medieval-command-deck-verification.md).

Production buildings have **Set rally point** in Train. Tap ground for new recruits to move there, or tap a visible resource/owned completed farm to send newly trained villagers to work. **Clear rally point** restores idle recruitment. Only future recruits follow it; costs, timers and existing units remain unchanged. Rally/formation state survives saves and online reconnects.

Wild deer roam near their original habitat in the authoritative simulation and pause while a nearby villager hunts them. Pikemen train at barracks in Town; crossbowmen and heavy cavalry unlock in Fortified Empire at archery ranges and stables. Spears counter mounted troops, mounted troops counter archers, and bows/crossbows counter spear infantry.

Destroy an original capital and occupy its ruins with soldiers for **30 seconds**. Hostile troops contest and pause occupation; abandoning it resets progress. The owner can rebuild after clearing attackers. Capture transfers surviving buildings and villagers and disbands the defeated army. Captured capitals become outposts. Captured population may exceed housing, but recruitment waits for capacity.

## Saving and sound

Manual saves and a rolling autosave every 60 simulation seconds use IndexedDB. All simulation state is retained, including AI plans, fog, queues, and randomness. Loading starts paused. Leaving the tab pauses single-player automatically; online matches continue. Saves remain in this browser on this device; clearing site data removes them. Local saves are not cloud accounts.

Music and sound effects are synthesized locally and adjustable in Settings. Audio unlocks on your first tap, click or keypress; Settings includes a Test sound button. All models and textures are served locally. Free Ashen Marches characters provide three civilian outfits and distinct infantry and mounted classes, with full garments colored for each city. Riders sit on the existing Quaternius horses. Buildings and walls now use original medieval architecture: timber frames, stone foundations, tiled roofs, courtyards, market stalls, forges and crenellated fortifications, with age-dependent details and city colors. The imported fantasy building archive stays disabled. Ultimate Nature supplies varied trees, berry bushes, rocks and mountain formations; the Quaternius gold resource remains active. Animals keep their existing appearance. Shared sampled poses and instanced scenery avoid a skeleton per unit. Procedural models remain available during loading or asset failure. Credits, license differences and model mappings are in [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md). These are stylized RTS assets.

Wooden walls are available at town hall level 1. Select an owned wall to purchase its stone upgrade at level 2, then reinforced stone at level 3. Each upgrade shows its cost and timer and preserves the wall's damage percentage. AI armies commit to destroying the town hall, breach defenses blocking occupation, and still obey the normal resource, training and contested capture rules.

Oak, birch, pine and fir silhouettes vary the woodland. Berry bushes provide food alongside the four animal species; all empires receive the same starting animal yield and two fruit bushes. Villagers carry food to storage using the same economy rules as farms and hunting. The HUD uses compact edge controls, contextual command tabs, visible training/construction times and a persistent larger-text option in Settings. Mobile panels open on demand to leave the battlefield accessible.

## AI fairness

AI and humans pay the same costs and use the same gathering, construction, research and training timers. Difficulty changes decision frequency, worker targets and the army size before raids. The AI can build an army earlier through immediate worker assignments and consistent queueing; it receives no extra starting stock or production-speed multiplier. A mirrored-controller test suite and six ordinary 180-second seeded openings found no unexplained resource changes or shortened timers. See [the audit and reproduction steps](docs/ai-fairness-audit.md).

## Time, weather and movement

A world day lasts 24 simulation minutes, starting at 08:00. The world clock appears beside the match timer on desktop and in Realm status on compact screens. Dawn, daylight, dusk and moonlit night change the lighting; windows glow at night. Weather targets change every three simulation minutes and blend over 30 seconds between clear, overcast, fog, rain and storms. Clouds drift with wind, rain is visible, and mist reduces distant contrast. Rain slows ground movement by at most 12 percent. All players use the same seed and authoritative match tick, so pauses, saves, refreshes and reconnects preserve the same weather and time.

Units use local crowd separation that respects building footprints, with bounded neighbor checks. Navigation grids are reused until buildings or gate ownership change. Repeated scenery uses shared textures and instancing, static mesh parts are merged, terrain uploads are skipped when visibility is unchanged, and sustained rendering load reduces optional pixel density/shadows. Detailed actor shadows are omitted above 180 visible troops while scenery shadows remain; clouds and soft ground shadows use bounded shared layers.

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

The benchmark uses controlled 400- and 800-unit fixtures with AI thinking delayed to isolate the load; rendering includes nearby combat, with enlarged unit health to keep the count stable. Rendering measurements wait for detailed models and forest maps to load, and record the adaptive render scale. Browser benchmarks use native Windows Direct3D where available. Phone layouts/controls and CPU-throttled performance are emulated on the desktop GPU, **not physical-phone verification**. Test results, screenshots, diagnostic states and performance measurements are in `test-results/` after running the checks. The detailed medieval art and formation/rally verification is in [docs/medieval-overhaul-verification.md](docs/medieval-overhaul-verification.md). The responsive in-game HUD checks and screenshots are in [docs/compact-hud-verification.md](docs/compact-hud-verification.md). Latest ecology, model, interface and fairness verification is in [docs/fair-ai-living-realm-verification.md](docs/fair-ai-living-realm-verification.md). Earlier team verification is in `docs/living-world-teams-verification.md`; gameplay and gesture evidence is in `docs/gameplay-refinements.md`; initial 3D evidence is in `docs/3d-verification.md`. Multiplayer evidence and hosting limits are in `docs/multiplayer-verification.md`.


## Public hosting

Use a Node24 host with a persistent filesystem and WebSocket support. This project is locally verified; it has not been published to a public service. All players must connect to the same server instance.

Set environment variables in your host settings or shell; `.env.example` is a configuration reference and is not loaded automatically:

| Variable | Default | Purpose |
|---|---|---|
| PORT |8180| HTTP/WebSocket port |
| HOST |0.0.0.0| Listen address |
| DATA_DIR |./server-data| Private persistent match checkpoints |
| MAX_ROOMS |32| Room admission limit; size according to host resources |
| PUBLIC_ORIGIN |unset| Exact allowed browser origin, e.g. https://game.example.com |
| VOICE_ICE_SERVERS |Cloudflare STUN| JSON array of STUN/TURN servers used by browser voice connections |
| HTTPS_KEY_FILE |unset| PEM private-key file for built-in HTTPS; set with HTTPS_CERT_FILE |
| HTTPS_CERT_FILE |unset| PEM certificate chain trusted by players' browsers; set with HTTPS_KEY_FILE |

Build with `npm ci && npm run build`, then run `npm start`. Put HTTPS in front of the server and proxy both ordinary HTTP and WebSocket upgrades on `/ws`. Set PUBLIC_ORIGIN to the browser-visible HTTPS origin. Keep DATA_DIR outside the public `dist` directory, attach durable storage, and restrict its filesystem permissions. Check `/health` for readiness. Stop using SIGINT/SIGTERM so the server flushes its current matches before exit. Unexpected process/power failures recover the most recent60-simulation-second checkpoint, rather than every uncheckpointed command.

A Dockerfile is included:

```text
docker build -t ironvale .
docker run --rm -p 8180:8180 -v ironvale-data:/data ironvale
```

The Docker recipe is provided for hosting; Docker execution is not part of the Windows verification. Use a single instance for this release. Multiple independent instances would have separate queues and rooms; a distributed match router is future work. MAX_ROOMS is an admission ceiling, not a claim that32 eight-player games have been load-tested simultaneously.

WebSocket implementation follows the [ws documentation](https://github.com/websockets/ws); server simulation isolation uses [Node worker threads](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html).

The Riverlands landscape and battle update adds twelve shared woodland silhouettes
with photographic sprigs, class-specific work/attack poses, smooth unit turning,
and pooled arrows and siege stones. The approved building and animal art remains
in use. [Implementation and verification notes](docs/riverlands-verification.md)
record the map rules, compatibility, performance measurements and browser checks.
