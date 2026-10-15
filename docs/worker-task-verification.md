# Worker task memory — verified 15 October 2026

A new villager assignment temporarily interrupts existing work. After it finishes, the most recently interrupted valid task resumes. Each worker retains their own task list, including paused wall construction sequences. The worker HUD shows a collapsible pending-task count and the resume order. Stop clears pending work and wall plans.

Gathering a new source completes when that source is exhausted; older explicit tasks run before automatic source retargeting or farm work. Carried resources are preserved. If all drop-offs are lost, a remembered available task (such as finishing a storehouse) can run without discarding unfinished harvesting. Tasks outside vision return to their last known location before checking their target. Finished/destroyed/depleted tasks and work for a previous owner are skipped. Capture clears the old owner's list. Reassigning a paused wall retains its remaining segments; duplicate tasks do not multiply.

Task lists survive manual/autosave, online simulation and server checkpoints. Other players' snapshots hide them. Optional save fields preserve compatibility with older saves; malformed or oversized task lists are rejected. The 128 pending task/segment limit rejects extra assignments before charging or changing orders. Existing army orders and the previous building visuals are retained.

Verification:
- Full automated suite: 232 passed, 29 files, including 16 worker-task regressions. Client/server production build and type check passed.
- Browser regression run: 9 passed across desktop, phone and tablet (task memory, ordinary gathering/construction, readable controls).
- Final focused browser run: 4 passed, 2 device-specific skips. Verifies pending-list contrast, interrupted gathering during house construction, actual IndexedDB task persistence, automatic resumption and Stop on three layouts. The desktop online case verifies each worker's saved and resumed orders through real server snapshots, with the other player's resources unchanged.
- Read-only review identified a lost paused-wall-tail case; its red/green regression and capacity-aware fix were rechecked successfully.
- The idle local server was restarted only after confirming zero active rooms. Local runtime verification reports detailed actors/nature ready, correct recruitment cost, multiplayer welcome and zero browser page errors.
- Inspected the phone pending list after correcting its heading contrast; the saved gathering task and current building status are readable. Screenshots and logs are in `docs/worker-task-evidence`.

Changes remain local and uncommitted. Play at http://localhost:8180; reload an existing tab to load the update.
