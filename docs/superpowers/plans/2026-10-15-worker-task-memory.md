# Worker task memory

User request: a new worker task temporarily interrupts the current one; resume all remembered tasks after the newer task finishes.

Implement a bounded per-worker stack of interrupted orders, including any paused wall construction sequence. Most recently interrupted work resumes first. Preserve existing consecutive-wall placement order. Stop clears all pending work. Skip completed, destroyed, depleted or foreign tasks; prefer explicit pending work before automatic resource retargeting or farm work. Preserve carried resources, costs, fog, independent ownership and army behavior. Capture clears previous-owner tasks. Save/load retains task memory; other players' snapshots hide it.

- [x] Write regression tests for nested interruptions, gathering, construction, repair, movement, wall sequences, Stop, ownership, groups, save validation and privacy.
- [x] Add scheduling/resumption to authoritative worker commands and simulation; preserve AI behavior and existing wall progression.
- [x] Show pending work in the worker HUD and document Stop/resumption.
- [x] Run full automated checks, focused browser flows and review, then refresh the idle local server and verify playability.
