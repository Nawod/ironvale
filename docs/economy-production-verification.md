# Economy and production pass

This continuation adds medieval RTS economy controls while preserving the
approved buildings, connected walls, HUD and mobile panels.

## Implemented behavior

- The coin button beside the army/map controls opens **Economy overview**. It
  shows living owned villagers assigned to food, wood, stone, gold, construction,
  repairs, idle time and other orders. Choose a group to select its workers and
  center the camera. Opening the overview or selecting a group does not change
  their jobs. The existing worker task memory continues to apply to new orders.
- The Train tab offers recruitment batches of one or five. Costs and total
  training time reflect the whole batch. The authoritative simulation validates
  a bounded count, checks population reserved across all owned production queues,
  checks the building's eight-entry limit, then pays and queues the whole batch.
  A rejected batch spends nothing and creates no partial queue. Each unit retains
  its normal individual cost and sequential training time. AI commands without a
  batch size continue to recruit one unit.
- A housing shortage displays a training-paused notice above the queue. Building
  enough housing allows the existing simulation to resume the timer.

## Compatibility and scope

The batch size is a command option, not new persistent game state. Older saves
and single-unit commands remain compatible; paid batches use ordinary queue
entries and existing save/reconnect serialization. Ownership, age requirements,
resource separation, teams and simulation timing are unchanged. The workforce
overview uses the player's filtered snapshot, never hidden world data. Each
eligible worker belongs to one group, including return trips and pending tasks.

## Verification

Nine focused automated tests cover batch accounting, normal training speed,
atomic failure, shared population reservations, queue limits, malformed sizes,
local/server validation, ownership, legacy commands, save continuity and workforce
grouping. The new behavior was observed failing before implementation; all nine
focused checks now pass.
A fresh read-only review found no important correctness or accessibility issues.

The bounded full suite passed **482 automated tests**. The browser matrix passed
**35 cases with four explicit device-specific skips** across desktop, phone and
tablet. It covers actual worker selection, two orientations, keyboard dismissal
and focus restoration, total batch costs, atomic capacity rejection, paused
training timers, online batch costs and reconnect persistence, existing command
access, battlefield input space and the model portrait/minimap regressions.

Type checking, production build and whitespace checks passed. The existing large
graphics-chunk advisory remains. Browser device checks are Chromium emulation,
not physical-device tests. The focused multiplayer check uses one rendered host
and one real protocol guest.

Final visual inspection found clipped recruitment cards above a five-unit queue
on desktop. A browser assertion reproduced the problem. The batch selector now
shares the action-card row, and the desktop Train panel expands to 228px while
ordinary worker/army panels retain their existing size. Three focused desktop,
phone and tablet follow-ups passed, including a check that the complete desktop
card lies inside the visible command area. Browser totals above count each case
and device once, using its latest result.

## Local production check

The local server was stopped when checked; the new production build was started
at `http://localhost:8180`. A real temporary online room verified an order for five
villagers: **350 food → 100 food, five queue entries**. The room was left and
allowed to expire. The server remained healthy with zero rooms; the browser
reported no page or console errors. Production screenshots use a prepared city
for the worker overview and a real room for online recruitment.

- [Automated results](economy-production-evidence/unit-results.json)
- [Browser results](economy-production-evidence/browser-results.json)
- [Build output](economy-production-evidence/build.txt)
- [Production runtime result](economy-production-evidence/local-runtime.json)
- [Economy overview](economy-production-evidence/desktop-economy-overview.png)
- [Batch training](economy-production-evidence/desktop-batch-training.png)
- [Phone overview](economy-production-evidence/phone-economy-overview.png)
