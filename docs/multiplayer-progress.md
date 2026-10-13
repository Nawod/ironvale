# Multiplayer execution ledger

Plan: docs/superpowers/plans/2026-10-13-ironvale-multiplayer.md

Spec approved by explicit user instruction to start development; private manual Start match confirmed. Existing project is isolated on multiplayer branch; original single-player branch preserved. Implementation is native in this session with one final independent review.

Execution decision: proceed with the user's explicit development instruction rather than add another approval round. Plan/spec remain reviewable in the project. No public deployment is authorized without a target.

Preflight: UI and renderer currently assume player0. Controller identity, snapshot perspective, saves and map count must be changed together before network consumers. Server binds each command to the connection's seat; no local re-indexing of owners.

Tasks1–3: expanded simulation/saves (47 tests green), room validation/lifecycle and actual worker/WebSocket/checkpoint server (16 tests green). Red tests observed before each subsystem. Public integration exercised every count2–8. Runtime commands are revalidated and bound to the seat. Dependency audit was repaired by upgrading Vitest; zero advisories remain.

Transport decision: first snapshot carries terrain and fog; following snapshots carry fog changes and omit unused paths. Reconnecting sockets get fresh full snapshots. Server data lives outside the static client root.

Task4: desktop private/manual-host/public/eight-context flows green; phone/tablet private/public/reload flows green. Existing offline controls/saves remain green. Cancelled public countdown and expired resume regressions observed RED to GREEN.

Task5 in progress: eight-empire Hard seed7 ends with Duskwatch victory at974.6 simulation seconds, including several AI-versus-AI occupations. The800-unit initial desktop test fell below55 FPS; camera-bounded terrain caching repairs this (60 FPS desktop,56 FPS four-times CPU-throttled phone). Physical mobile hardware remains unverified.

Final review: three Important findings reproduced RED and repaired GREEN: construction-target crash/free healing, finished-room checkpoint resume, and live resource amounts under fog. Enemy remembered/visible entity metadata is sanitized consistently. No Critical findings. Reviewer declined public hosting, Docker, physical phones, alternate browsers and maximum-room capacity.

Clock measurement: Windows interval drift repaired using bounded elapsed-time fixed-step scheduling. Eight connections now receive100 ticks/25 snapshots in5.01 seconds;45.51–47.46 KiB/s per player, initial160–164 KiB. Clock regressions and full70-test/14-file suite pass; final production build passes. Full browser after review:21 pass/6 device-specific skips. Rendering800 units:desktop60.00 FPS,phone-emulated57.15 FPS; four-times CPU throttling, Intel UHD ANGLE D3D11.

Delivery: post-clock multiplayer browsers7 pass/2 intentional skips. Production localhost5180 health and game page verified. Server left running; launcher and README support later restarts/LAN play. 800-unit simulation benchmark mean1.20ms/p953.23ms/max123.40ms; maximum tick overrun documented. Final report:docs/multiplayer-verification.md.

User revision: Ctrl + left-drag pans without selection/orders. Private rooms have no preselected count, always admit up to8, and start with the actual2–8 ready humans. Optional AI filling remains explicit. New panning/dynamic-room tests observed RED before implementation; full78-test/15-file suite passes.

Revision browser verification: desktoppan/private2/public2/private8 pass; phone/tablet public pass. Two combined-run mobile acknowledgement timeouts after8-context load; isolated unchanged private/reconnect checks both pass (6.4s/8.7s). Final browser test server built/type-checked the release. Updated local production server restarted on5180.
