# Implementation ledger — 2026-10-13-ironvale

Approved spec and plan preserved. Execution is inline with final independent review per executing-plans skill.

Ruling: new standalone project folder is the isolated workspace; parent was not a repository. Initialize only this project on feature/ironvale.
Pre-flight: simulation definitions/types are shared by economy, combat, AI, renderer and saves; keep all consumers importing one schema. Worker publishes only player-visible snapshots. Saves separately retain full state.
Ruling: use original vector-drawn sprite atlases rather than remote/generated imagery; reproducible, bundled, coherent medieval silhouettes.

Tasks 1–4 simulation foundations implemented. 21 tests pass: deterministic equal starts, recruitment/construction/gathering, conquest/counters/fog/navigation, fair AI commands, complete deterministic save restoration. Type checking passes.
Ruling: captured original capitals become outposts; rebuilding uses the original entity ID. Autosave is simulation-time based and stops while paused.
Ruling: original owner may rebuild only after clearing military enemies within six tiles. Contested occupation preserves progress, absent occupier resets it.
Root workspace cleanup: an accidental empty parent Git initialization was removed after verifying zero commits, objects, and refs. Project repository remains isolated.

Tasks 1–6 delivered: worker simulation, fair AI/conquest, original Pixi battlefield and animations, responsive React controls, IndexedDB saves/autosaves, sound/settings, tutorial/results, launcher, hosting documentation and deployable build.

Final evidence: 38 simulation/storage tests pass; 12 production-browser checks pass, with three device-inapplicable skips. Type checking/build pass. Desktop/phone/tablet portraits and phone landscape inspected. Phone/tablet are emulated, not physically tested. See docs/verification.md for measured hardware, fixtures, complete-match results and limits.

Headless Hard seed42: two empires end at404.55 seconds with human-slot victory; four end at768.6 seconds with human-slot victory. Seed7: Redcliff captures both AI rivals and the human, winning at758 seconds. Diagnostic human slot uses the same fair planner. No simulated match timer is added.

Independent review completed. Reproduced and repaired captured-outpost save restoration, attacks against newly friendly/garrisoned targets, and hold-position firing. Final headless run exposed long diagonal scouting routes; a regression test failed before repairing A* search budgeting/heuristics and passes after.

Performance ruling: benchmark shipping production build, not development React diagnostics. Batch terrain into fog-aware eight-tile chunks, update minimap through image data, and cache original textures. The400-unit production fixture meets approximately60 FPS desktop and exceeds30 FPS under four-times CPU-throttled phone emulation. Simulation95th percentile remains below1 ms against50 ms budget.
