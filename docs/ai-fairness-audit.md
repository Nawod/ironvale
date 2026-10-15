# AI economy fairness audit

Verified locally on 2026-10-15. No production economy or AI behavior was changed by this audit.

## Finding

No AI-only discount, resource grant, extra gathering output, population exemption, production prerequisite bypass, or shortened production timer was found. Thirty-nine mirrored regression cases pass across easy, normal and hard. Six ordinary-engine opening runs, each 180 simulated seconds, reconcile all resource changes to observed purchases and worker deliveries with zero unexplained balance and no timer anomalies.

The AI can issue several economic orders in one decision and consistently revisit idle workers/queues. Difficulty changes its decision interval and strategy targets. Those are real play advantages, and explain an earlier army without changing its soldiers' prices or training time. This evidence does not establish that every difficulty is equally comfortable for a human player.

## Shared rules checked

`src/sim/ai.ts` routes purchases and orders through the same `applyCommand` exported to human controls by `src/sim/engine.ts`. AI code does not write player resource totals. The only difficulty branches in AI choose think interval, villager target, and raid threshold. Neither `applyCommand` nor `updateEconomy` branches on controller or difficulty.

| Behavior | Observed shared rule |
| --- | --- |
| Initial stock | 350 food, 450 wood, 200 stone, 150 gold per city |
| Decision interval | Easy 100 ticks / 5 s; normal 50 / 2.5 s; hard 25 / 1.25 s |
| Worker target | Easy 18; normal/hard 26 |
| Raid threshold | Easy 12 soldiers; normal/hard 8 |
| Spearman | 45 food + 20 wood; 12 s in a completed, owned barracks |
| House | 50 wood, paid once; 12 s of one adjacent villager's work |
| Construction teamwork | Each actual adjacent villager contributes once per tick; two builders can halve work time for either controller |
| Age research | 400 food + 150 gold for age 2; 45 s; requires completed storage and barracks |
| Smithy research | First weapons upgrade 100 food + 80 gold; 30 s; age-limited and duplicate-protected |
| Housing/queues | Pending recruits across all buildings reserve housing; eight slots per recruit queue |
| Gathering | Wood 2.8/s; farm food 3.6/s; carry/depletion/delivery conserve source quantity |
| Farm replant | 35 wood once for 900 food; no replant or food creation without payment |

The new deer/cattle/alpaca/fox/bush world was present during the recorded runs. Food type selection uses the common `harvestedResource` helper. The ecology tests owned by the main implementation cover those types separately.

Duplicate worker IDs were explicitly submitted in house construction and wood gathering. They do not create extra workers or extra per-tick processing; construction and gathering remain at the literal rates above. Online command validation also deduplicates ID lists. Ownership, unfinished building, locked troop, insufficient resources, queue capacity and reserved population rejection cases preserve stock.

## Reproducible opening observations

The human seat receives no commands. The second seat uses its unmodified normal AI. The observer calls ordinary `step(s)` at 20 ticks/s, retains the generated world and stock, and adds no production hooks. Every new building placement and queue entry provides observable evidence of an accepted purchase. Their catalog/queue costs are journaled, worker carry-to-stock deliveries are observed, and balances are checked every tick. JSON files include source hashes and a purchase journal with stock after each observed acceptance.

Purchase timestamps are observed at the end of an engine tick: that same tick already contributes 50 ms to a new active queue. A nominal 12 s recruit can therefore appear 11.95 s after its first end-of-tick queue observation. Mirrored boundary tests include the 50 ms simulation precision; this is the same for humans.

| Seed | Difficulty | Barracks purchased | Barracks completed | First spearman | Soldiers at 180 s | Run time |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 42 | Easy | 6.50 s | 31.80 s | 48.45 s | 9 | 1,156 ms |
| 42 | Normal | 4.00 s | 28.00 s | 40.95 s | 11 | 810 ms |
| 42 | Hard | 2.75 s | 27.85 s | 40.95 s | 10 | 780 ms |
| 7 | Easy | 6.50 s | 31.60 s | 48.45 s | 9 | 1,063 ms |
| 7 | Normal | 4.00 s | 28.00 s | 40.95 s | 11 | 864 ms |
| 7 | Hard | 2.75 s | 27.85 s | 40.95 s | 11 | 812 ms |

The first AI decision is at 1.50 s for this seat on all difficulties. It pays 80 wood for storage and 50 food for a villager, leaving 300 food, 370 wood, 200 stone, 150 gold. It next pays the same 150 wood for the barracks, leaving 220 wood before subsequent deliveries. The 24 s barracks work timer starts after a real builder arrives; the easy builder has farther to travel in these runs. Hard does not invariably have the largest army at a fixed time because worker investment, age research, unit choices and pathing compete for the same resources.

The following balances use `(food, wood, stone, gold)` and include only accepted construction, recruitment and research purchases. No trade, repair or replant caused unmatched movement in these opening runs.

| Seed | Difficulty | Accepted purchases by 180 s | Stock at 180 s | Unexplained change |
| --- | --- | --- | --- | --- |
| 42 | Easy | (1405, 900, 0, 190) | (1656.88, 555, 875, 560) | (0, 0, 0, 0) |
| 42 | Normal | (1660, 1455, 0, 205) | (1180, 15, 800, 530) | (0, 0, 0, 0) |
| 42 | Hard | (1745, 915, 0, 150) | (1275, 615, 875, 705) | (0, 0, 0, 0) |
| 7 | Easy | (1405, 900, 0, 190) | (1666.88, 555, 875, 560) | (0, 0, 0, 0) |
| 7 | Normal | (1660, 1275, 0, 205) | (1290, 165, 800, 515) | (0, 0, 0, 0) |
| 7 | Hard | (1775, 1275, 0, 285) | (1144.5, 165, 800, 480) | (0, 0, 0, 0) |

For example, easy/seed 42 food reconciles as `350 initial + 2711.88 delivered - 1405 accepted purchases = 1656.88 stock`. Seed 42 normal wood reconciles as `450 + 1020 - 1455 = 15`. The low wood balance is an actual purchase constraint, not waived for AI.

## Verification and limits

Run from the project root:

```text
npx vitest run tests/ai-fairness.test.ts
npx tsx scripts/audit-ai.ts 180 42
npx tsx scripts/audit-ai.ts 180 7
```

The focused suite passes **39/39** tests. Retained machine-readable output is `realm-evidence/ai-fairness-vitest.json`. Per-difficulty evidence is `realm-evidence/ai-opening-{easy,normal,hard}-{42,7}.json`; compact reports are `realm-evidence/ai-opening-summary-{42,7}.json`. Re-running the script writes fresh files under `test-results/`.

Mirrored tests clone the same seat, terrain, workers, stock, buildings, visibility, commands and ticks, changing only its controller. They assert independent literal costs, elapsed-time boundaries, source/carry/stock quantities and command rejection side effects as well as full matching state. Autonomous AI planning is also run for the identical human seat using the existing `includeHuman` option and produces identical spending/state.

This is a deterministic local economy audit, not a human-vs-AI win-rate or late-game battle study. The passive opening observer intentionally treats any unclassified stock movement as an explicit anomaly; a longer run with market trades or combat repairs requires investigating that journal rather than interpreting it automatically as cheating. Full project/server/browser checks belong to the final integrated verification after concurrent rendering/UI work finishes.
