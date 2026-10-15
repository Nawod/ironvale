# Wall alignment and multiplayer voice implementation plan

> **For agentic workers:** Use the dispatched independent wall and signaling tasks; main implements the voice client, interface and integration verification.

**Goal:** Correct wall facing and deliver opt-in lobby/game voice with private team channels.

**Architecture:** Snapshot adjacency determines wall yaw. Authenticated WebSocket signaling coordinates a bounded WebRTC audio mesh; shared session ownership preserves voice through lobby/game UI transitions.

**Tech Stack:** Existing TypeScript, Three.js, React, WebSocket server, browser WebRTC, Vitest and Playwright. No new packages.

**Spec:** `docs/superpowers/specs/2026-10-15-walls-voice-design.md`.

**Constraints:** Preserve prior building visuals and gameplay; no commits/deploy/purchases; do not record audio or serialize voice memberships. Microphone is opt-in, initially muted, and stopped on leaving/disconnect. Secure context required for remote microphone access.

**Review focus:** stale channel signals, wrong-room/team routing, mic permission resolving after leave, lobby-to-game continuity, and cleanup after socket replacement/reconnect.

- [x] Wall task: reproduce fixed-yaw root cause, test run adjacency, integrate cached yaw, verify enclosed rectangle/mixed defenses/moved pieces without hidden-state access.
- [x] Signaling task: define bounded protocol, test ownership/channel/team/epoch checks, implement ephemeral membership and lifecycle cleanup, preserve ordinary room rate limits.
- [x] Client task: test capture/connection lifecycle, implement muted join, deterministic offers and queued ICE, close-before-switch with epoch validation, errors and audio cleanup.
- [x] Integration: wire OnlineSession lifecycle and events; share controller across lobby/game VoicePanel; add channel, microphone, incoming mute, leave and connection feedback controls.
- [x] Deployment support: expose configured ICE servers, document HTTPS and optional relay. Verify defaults remain compatible with current server.
- [x] Verification: full tests/build, real browser microphone/peer audio transport, lobby/game continuation, open/team isolation, mute/switch/leave and wall screenshots on desktop/phone/tablet. Read-only review and local runtime refresh only when no rooms are active.
