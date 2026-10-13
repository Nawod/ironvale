# Ironvale Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver server-authoritative online Ironvale for any 2–8 empires, public matchmaking and host-started private rooms, without breaking offline play.

**Architecture:** Shared pure simulation, one Node worker per match at20 Hz, WebSocket room service and player-private snapshots at5 Hz. Local and online session transports feed the same React/Pixi gameplay. Server checkpoints retain full state; browser saves remain offline only.

**Tech Stack:** Existing TypeScript/React/Vite/Pixi, Node24, ws, esbuild, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-ironvale-multiplayer-design.md`

## Global constraints

- Any count 2–8; private-room host explicitly presses Start match. No auto-start on friend join.
- At least two humans online; optional private AI filling; public queues exact requested human count.
- Same validated commands/fog, no client ownership authority, no alliances/time limit.
- 120-second reconnect, permanent AI takeover after expiry/leave. Online tab hiding never pauses the match.
- Node worker simulations20 Hz; snapshots5 Hz. Save-version migration preserves existing offline games.
- Local delivery and deployable server; public deployment requires a hosting destination.

## Review focus

1. Replacement socket closes must not disconnect the new owner of a reclaimed seat.
2. Host departure, settings changes and countdown cancellation must not leave stranded participants.
3. Server checkpoints must never expose bearer credentials through static serving or lobby payloads.
4. Every UI/renderer ownership check must use the viewer's actual seat, including seats4–7.
5. Malformed commands, replayed sequences and slow consumers must not halt another room.

## Task1: Expand shared simulation and saves

Files: `src/sim/{types,world,ai,visibility,save}.ts`, `tests/multiplayer-sim.test.ts`.
Interfaces: MatchConfig supports opponents1–7 and optional participant controllers; Player.controller human|ai; Snapshot.playerId; createGame(config), snapshot(state,viewer), decodeSave(text) migrate version1→2.

- [ ] Add failing tests: all counts2–8 have equal six villagers/scout/resources and expected96/128/160/192 maps; human seats receive no AI orders; nonzero private snapshots and legacy saves restore correctly.
- [ ] Run targeted Vitest and inspect RED.
- [ ] Implement expanded start geometry/colors, explicit controllers, player-private snapshots and migration.
- [ ] Run full simulation suite and check types; commit.

## Task2: Protocol and room authority

Files: `src/net/protocol.ts`, `server/{validation,rooms}.ts`, `tests/rooms.test.ts`.
Interfaces: validateMessage(value): ClientMessage; RoomService connects Peer{send}, handles(peerId,message), disconnects(peerId), sweeps(now), uses injected MatchDriver. RoomView public metadata only; credentials SHA256 hashed.

- [ ] Add failing tests for count bounds, sanitized guest names, host-only start, two ready humans, optional AI seats, manual start, host transfer, private fullness, FIFO public queues/countdown cancellation, reconnect replacement/expiry and spoofed/replayed commands.
- [ ] Observe RED; implement bounded protocol validation, lobby/match lifecycle, token authority and rate limits.
- [ ] Run room/protocol suite; commit.

## Task3: Threaded server and checkpoints

Files: `server/{index,match-worker,driver,persistence}.ts`, `scripts/build-server.mjs`, `tests/server.test.ts`; package/config scripts.
Interfaces: startServer(options): Promise<{port,close}>; WorkerDriver submits commands with seat/sequence, publishes private snapshots; CheckpointStore saves/loads/cleans atomic room envelopes with credential hashes. HTTP serves dist and /health; /ws same-origin upgrade.

- [ ] Write failing real WebSocket integration tests for private two-player host start/nonzero recruitment, public matching, 2–8 seats, private fog, rejection of invalid requests, reconnection, checkpoints and independent matches.
- [ ] Observe RED; install ws/@types/ws/esbuild; implement worker20 Hz, ack transport, bounded server, heartbeat/backpressure, atomic checkpoints/recovery and static serving.
- [ ] Run server tests/build; commit.

## Task4: Session transport and multiplayer UI

Files: `src/net/{session,online}.ts`, `src/ui/OnlineLobby.tsx`, `src/App.tsx`, `src/render/battlefield.ts`, `src/ui/Minimap.tsx`, `src/styles.css`.
Interfaces: Session.postMessage(message), terminate(), onmessage; OnlineSession lobby listeners, current status/room/credential, reconnect; LocalSession wraps Worker. OnlineLobby shows queue or room; sends ready/settings/start/leave.

- [ ] Add failing Playwright multiplayer checks with separate contexts: join/ready never auto-start, only host sees Start match, recruitment from each seat, invitation link, two-person public queue, refresh reconnect, hidden tab simulation continues, eight-context smoke.
- [ ] Observe RED; implement session adapters, guest/lobby menus, countdowns/reconnect feedback, true viewer ownership everywhere, online menu/leave/save restrictions and responsive layouts.
- [ ] Run original offline and new online browser flows; commit.

## Task5: Verification and delivery

Files: `scripts/{benchmark,simulate}.ts`, `README.md`, `docs/multiplayer-verification.md`, launcher/config example, Dockerfile.

- [ ] Run headless eight-empire/mixed-controller checks and800-unit simulation/browser fixture; record hardware, tick timing, bandwidth and emulation limitations.
- [ ] Run full type/simulation/server/browser suite and production build. Inspect screenshots, health endpoint and actual local multiplayer.
- [ ] Request one fresh read-only review of the whole branch. Fix significant findings with RED→GREEN regressions and rerun relevant checks.
- [ ] Document localhost/LAN operation, HTTP/WSS hosting/persistent volume, restart recovery and the explicit private host button. Start local production server and commit verified delivery.
