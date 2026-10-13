# Implementation ledger — 2026-10-13-ironvale

Approved spec and plan preserved. Execution is inline with final independent review per executing-plans skill.

Ruling: new standalone project folder is the isolated workspace; parent was not a repository. Initialize only this project on feature/ironvale.
Pre-flight: simulation definitions/types are shared by economy, combat, AI, renderer and saves; keep all consumers importing one schema. Worker publishes only player-visible snapshots. Saves separately retain full state.
Ruling: use original vector-drawn sprite atlases rather than remote/generated imagery; reproducible, bundled, coherent medieval silhouettes.

Tasks 1–4 simulation foundations implemented. 21 tests pass: deterministic equal starts, recruitment/construction/gathering, conquest/counters/fog/navigation, fair AI commands, complete deterministic save restoration. Type checking passes.
Ruling: captured original capitals become outposts; rebuilding uses the original entity ID. Autosave is simulation-time based and stops while paused.
Ruling: original owner may rebuild only after clearing military enemies within six tiles. Contested occupation preserves progress, absent occupier resets it.
Root workspace cleanup: an accidental empty parent Git initialization was removed after verifying zero commits, objects, and refs. Project repository remains isolated.
