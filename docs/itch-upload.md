# Kingdom Lanka: itch.io upload

Prepared 28 October 2026 for the existing game at https://ironvale.onrender.com/.

## Ready file

Upload `releases/kingdom-lanka-itch.zip`. It contains `index.html` at its root and is a small fullscreen launcher, not a standalone/offline asset bundle. The actual game, models, single-player worker and online server continue loading from Render. Updating the Render game updates what itch.io players see. Render must remain available for either mode through this launcher.

1. Create or edit your itch.io project and choose **HTML** as its project kind.
2. Upload **kingdom-lanka-itch.zip** and select **This file will be played in the browser**.
3. Select **Click to launch in fullscreen** and **Mobile friendly**. Landscape is recommended on phones.
4. Save as a draft first. Preview single-player and a private online room before publishing your page.

This preparation does not upload/publish an itch.io page, modify Render, commit or push source changes.

## Why this package uses an embed

Live checks confirmed that Render currently serves Kingdom Lanka and `/health` responds with protocol 1. A same-origin WebSocket receives a welcome message. A direct WebSocket using `https://html-classic.itch.zone` as its Origin receives HTTP 403 under the current server-origin rules.

The launcher embeds the Render game itself. Its real game frame therefore keeps `https://ironvale.onrender.com` as its origin and uses the existing server normally. No blanket cross-origin permission or live server change is needed. A separate static itch.io build would require a configurable remote endpoint, a carefully configured server-origin allowlist and cross-origin voice configuration. The current static output also contains over 1,000 files, so it needs repackaging to satisfy itch.io's HTML ZIP file-count limit. Those adaptations are deliberately not claimed for this launcher.

## Checks and limits

`python scripts/package-itch-launcher.py` rebuilds the ZIP and validates its CRC, root index and content. A SHA-256 report is saved beside it.

`node scripts/verify-itch-launcher.mjs` extracts the actual ZIP and serves it inside a sandboxed, separate-origin iframe, then checks the live Render game on Chromium desktop and landscape iPhone emulation. Both load the menu, start a local single-player game, show the town-center HUD and receive a protocol-1 welcome over the live multiplayer WebSocket. The probe only opens and closes a socket; it does not create online rooms or start remote matches. Temporary local verification servers close afterward.

Evidence: `docs/itch-evidence/verification.json`, desktop/phone menu and playing screenshots. This is an itch-style frame test, not verification on an actual uploaded itch.io page. Actual itch.io sandbox/permission policy, physical phones, Safari and microphone/voice permission delegation remain to be checked after draft upload. If the platform blocks a browser feature, opening the Render game directly remains available. No new full-game test/build result is claimed because game code was not changed.

Official references: [itch.io HTML games](https://itch.io/docs/creators/html5), [Render WebSockets](https://render.com/docs/websocket). Hosting-plan limits and cold starts depend on the current Render service plan; it was not inspected.
