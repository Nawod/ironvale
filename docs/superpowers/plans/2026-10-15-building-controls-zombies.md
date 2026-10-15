# Building controls and night zombies

Move/remove owned buildings; optional night zombies in single-player and multiplayer. Preserve the previous building visuals, worker task memory, city colors, teams, separate resources and conquest.

Buildings: relocate owned non-capital buildings to visible clear land with a placement preview. Preserve ID, HP, upgrades and farm food. Require empty queues/garrisons and no nearby visible hostiles or damage in the last 10 seconds. Original town halls remain fixed capture objectives. Removal requires in-game confirmation, offers no refund, and permits workers to resume valid saved work. Server validates every action.

Zombies: optional match setting, propagated through single-player, private rooms and separate public queues. Settings changes clear readiness. Persist saves/checkpoints/reconnects. Night is 18:00–06:00 on the authoritative clock. Deterministic bounded forest hordes attack every human/AI city regardless of teams, breach walls, and retreat without attacking at dawn. Neutral owner -2 units: no player slot, commands, recruitment, vision, population, resources or city capture. Disabled mode stays unchanged. Shared undead appearance and HUD phase feedback.

- [ ] Building agent owns new building-actions module, economy command integration and tests.
- [ ] Zombie simulation agent owns new zombies module, combat/teams/navigation/physics/AI/engine integration and tests; informs main of optional saved state shape.
- [ ] Visual agent owns imported/procedural zombie models and tests; preserve all existing appearances.
- [ ] Main owns shared types/definitions, save/server validation, settings propagation, menu/lobby/matchmaking, building placement controls/preview and HUD/minimap.
- [ ] Review integration, automated/browser tests for offline/online behavior and day/night, inspect visuals and refresh only an idle local server.

No purchases, messages to others, commits or publication. Preserve unrelated working-tree edits.
