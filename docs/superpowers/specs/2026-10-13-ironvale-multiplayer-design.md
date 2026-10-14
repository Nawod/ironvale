# Ironvale multiplayer design

Date: 2026-10-13. Status: approved for development. The user explicitly requested development after reviewing the written specification and confirmed a manual host start button.

## Intended outcome

Extend the existing Ironvale game so people can play against each other through public matchmaking or private invitation rooms. Any match size from two through eight is supported: 2, 3, 4, 5, 6, 7, or 8. Eight is a maximum, not a required lobby size. Each empire fights independently under the existing economy, progression, fog, combat and conquest rules. Desktop, tablet and phone controls remain available.

The user selected public matchmaking plus private rooms and approved increasing the maximum to eight. The defaults below resolve details not separately specified: guest display names, exact-size public queues, 120-second reconnection, and optional AI seats in private rooms. No accounts, ranked ladder, alliances, chat, spectators or payments are required for this release.

## Player flows

The main menu offers Single player, Find a match, Create a room and Join a room. Players choose a guest name before going online. Display names are bounded plain text; they are not account identities and are not unique across the service.

Public matchmaking offers a target player count from 2–8. Players join a first-in, first-out queue for that count. The interface displays queued players and allows cancellation. A match starts when that queue has enough connected humans, followed by a short countdown. Public matches contain human seats only, with no automatic AI filling and no arbitrary waiting deadline. A departure before the countdown completes cancels that allocation and returns remaining players to their queue.

Private rooms have a short room code and copyable invite link. The host chooses total empire count from 2–8, map seed, AI difficulty and whether vacant seats may be filled with AI. Joined humans occupy seats before AI. Humans explicitly mark themselves ready; the host starts when the configured seats are occupied by ready humans or AI. At least two humans are required for an online match; one-human games remain available through Single player. Total human and AI empires never exceeds eight. Lobby settings and seats lock at match start. If the host leaves a waiting room, hosting transfers to the oldest connected participant; an empty waiting room expires.

The lobby shows participants, empire colors, readiness and AI seats. Private rooms never start automatically: an explicit **Start match** button belongs to the host, who starts after friends join and become ready. Errors such as an invalid code, full room, match already started or unavailable server are stated plainly. A human cannot join another empire midway through a match. The existing free-for-all capital occupation rules decide the winner; there is no match timer.

## Connection and match lifecycle

Online matches continue when a player opens settings, hides the browser tab or disconnects. Menu actions pause only the local single-player worker. The online interface explains that the shared battlefield keeps running.

Each human seat receives an unguessable reconnection credential. It is retained by that browser, never included in public lobby messages and never treated as a user-editable player ID. After connection loss, the empire remains under its last orders for 120 seconds while the client retries with capped backoff. A successful reconnect restores that seat and its current private snapshot; it does not rewind the match. After the deadline, AI permanently takes over that seat. Explicitly leaving a running match transfers the seat to AI immediately. A second connection with the same valid credential replaces the old connection. Disconnection cannot grant a global pause or avoid conquest.

Online results display victory or defeat from the viewer's seat. An eliminated player receives no enemy vision or command rights. If every human leaves or is eliminated, the server closes the room after a bounded cleanup delay rather than running unattended games indefinitely. Finished rooms retain results briefly, then release resources.

## Authoritative architecture

Use a Node.js HTTP server with WebSocket transport. In production it serves the built client and multiplayer endpoint from the same origin; the development client proxies the endpoint. Clients submit commands and render snapshots. Only the server advances online state, charges costs, decides visibility and applies combat/conquest. Client-supplied ownership fields are ignored in favor of the authenticated connection's seat.

Run each online simulation at the existing fixed 20 ticks per second in a server worker thread, keeping lobby and connection handling responsive. Reuse the pure TypeScript simulation; do not introduce a separate set of multiplayer economy or combat rules. AI processing targets explicitly designated AI seats, instead of assuming that every player except slot zero is a computer. Commands are queued and applied at tick boundaries in server receipt order. Acknowledgements identify the client command sequence and accepted/rejected status.

The server sends each player only their own fog-filtered snapshot, initially at five updates per second, with tick numbers for interpolation and stale-packet rejection. Opponent resources, queues, plans and unseen entities never enter that player's payload. Public room metadata contains only names, colors, readiness and connection status. Client snapshots cannot become server state.

Extract the existing UI's worker messaging into a session interface with local-worker and online implementations. Introduce an explicit viewer player ID throughout controls, camera/home selection, tutorial, rendering, minimap, population/resource panels and result messages. Replace hard-coded ownership-zero checks. Keep server-assigned entity IDs and empire colors stable during reconnection and conquest.

Use focused modules for the wire protocol, runtime message validation, rooms, matchmaking, connection credentials, server simulation transport and browser session transport. A malformed or unauthorized message fails without crashing another match. Enforce bounded message sizes, arrays, names, queue membership, room counts, connection counts and command rates. Heartbeats identify dead connections; slow consumers do not accumulate unlimited snapshots. Bind private-room and seat authority on the server, including host-only start/settings operations. Public deployment uses HTTPS/WSS.

## Two-to-eight-empire simulation

Represent the total empire count explicitly. Generate 96×96 maps for two, 128×128 for three/four, 160×160 for five/six and 192×192 for seven/eight. Distribute starts symmetrically with equal starting capital, six villagers, scout, resources and comparable nearby forest, wildlife and deposits. Keep starts buildable and mutually reachable. Assign eight distinct team colors and readable labels. Preserve the ordinary population cap of 100 per empire and captured-population exception.

The existing single-player two/four-empire choices continue to work. Its opponent selector can also expose 1–7 AI rivals using the same expanded world generator. Existing version-one local saves migrate to the new count/controller representation without changing their simulated outcome; incompatible or damaged data still produces a useful error. New saves record controller types and map/participant metadata with a new save version.

## Persistence and delivery

Single-player manual saves and autosaves remain browser-local. Online clients cannot load local files to replace authoritative match state, save opponents' hidden information or rewind a shared game. The online controls explain this difference.

Server-owned match checkpoints periodically retain complete simulation state and room/controller metadata on a configured persistent data directory. Write checkpoints atomically; persist credential hashes rather than reusable raw credentials. On server restart, recover valid matches and allow their participants to reconnect. A running server shutdown notifies clients; missing/unusable server storage is reported in logs and deployment checks. Do not silently claim durable recovery on an ephemeral hosting filesystem.

Deliver source, production client/server build, local multiplayer launcher, configuration example, health endpoint, and deployment instructions for a Node host with WebSocket support and persistent storage. Tests can demonstrate separate browsers joining through localhost/LAN. Availability on the public internet requires a chosen hosting destination and its deployment credentials; do not describe a local server as publicly deployed.

## Verification

- Test every match count 2–8 for stable IDs, equal starts, map reachability, controller assignment, fog isolation and existing conquest behavior.
- Test lobby authority, readiness, host transfer, private capacity/AI filling, public exact-size queue allocation/cancellation and disconnected participants.
- Test command ownership spoofing, invalid payloads, invisible targeting, limits, private snapshots and independent simultaneous matches.
- Test reconnect within the deadline, expired reconnect, duplicate connection, explicit leave, AI takeover, hidden-tab behavior, checkpoint recovery and old local-save migration.
- Use separate Playwright browser contexts for real server-connected players. Exercise two-player public matching, private invitation rooms, every supported count through server integration tests, an eight-player browser smoke match, issued orders, disconnection/reconnection and results. Retain original offline checks and responsive phone/tablet emulation.
- Run seeded mixed-controller headless matches and an eight-empire, 800-unit performance fixture. Report actual workstation measurements, snapshot bandwidth and server tick timings. Mobile emulation is not physical-device verification.
- Pass type checking, simulation/server/browser tests and production build. Update the project verification report with evidence and limitations. Preserve the original approved single-player specification alongside this extension.

## Private-room and camera revision

User-authorized revision: private creation does not ask for a player count. Private lobbies admit up to eight humans, and the host explicitly starts with the actual ready joined group of two to eight. Optional AI filling creates eight empires. Public queues retain their requested match sizes. Ctrl + left mouse drag pans the battlefield without selecting units or issuing commands; middle drag and touch gestures remain available.
