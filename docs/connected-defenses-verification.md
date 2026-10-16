# Connected defenses verification — 16 October 2026

## Delivered

- Wooden and stone walls render connected L, T and cross joints. Same-city living snapshot neighbors determine topology; construction and remembered sections count, destroyed walls do not. Removal, relocation and paid tier upgrades update the join. Gate adapters meet the actual offset centers of adjacent tiles without closing the lifted passage. Other building architecture remains unchanged.
- Villager Build tabs include Wooden wall line and Stone wall line, alongside individual buildings. Select a start and end, review the route and cost, then Build line. Routes turn horizontally then vertically and contain at most 64 sections. Existing living wooden/stone sections owned by that commander are reused free. Normal construction timers apply.
- A route either passes all bounds, scouting, terrain, occupancy, age, resource and worker-task checks, or changes nothing. The full scouting pass precedes hidden terrain/occupancy reads. Worker sequences continue FIFO across wooden and stone walls and preserve prior work; interruptions and the 128-task limit still apply. The same command runs solo and online.
- Internal request IDs correlate local and online responses. Planner generations protect a new plan from an earlier acknowledgment. Rate-limited commands return their own sequence; rejection/disconnection releases submitting controls without replaying purchases.

## Evidence

`npm run check`, `npm run build` and `git diff --check` passed. The full bounded Vitest run passed **466 tests with no failures or skips**, including real guest-server wall-line submission, ownership enforcement, atomic cost/queue checks, normal build timers, task resumption, all gate ports, real rendered instance seams and exhaustive connection-cache disposal checks. The finite fortification variant cache shares geometry across ages, entities and city colors; adjacency remains linear in known fortifications.

The first focused Playwright run passed 19 checks with two intentional device skips. After visual inspection found a cramped landscape Build button, its width was fixed and the affected planner plus existing worker, production, research, trading, upgrade, removal and online formation/rally flows passed a further 10 checks with two device skips. Latest results merge to **26 distinct passes, four device-specific skips, zero failures or retries**. Reports and screenshots are in [connected-defenses-evidence](connected-defenses-evidence/).

The original missing wall-line control and late-acknowledgment plan erasure were observed in failing browser regressions before their implementations/fixes. Initial fixture clicks also exposed minimap pixel rounding; the tests now use an exact quarter-map location rather than assuming fractional browser click coordinates. Landscape captures wait for the load notice to clear before visual inspection.

## Local preview

The combined production server was refreshed after confirming its known process and zero active rooms. The updated game is available at **http://localhost:8180**. Its final health response was `{ "ok": true, "rooms": 0, "protocol": 1 }`. The prepared production scene rendered both cities, mixed defense tiers, gates, city colors and armies with zero browser errors. Screenshots use ordinary game geometry and health values; cities and units were arranged specifically for review.

## Limits

Phone/tablet results use desktop Chromium touch and viewport emulation, not physical devices. This increment adds connected defenses and accessible construction, rather than a complete Age of Empires feature set. Naval units, destructible bridges, civilization-specific technology trees and campaigns remain outside this change. No new art packages, paid assets or dependencies were added. No commit, push or external deployment was performed.
