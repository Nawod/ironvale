# Fair AI, richer ecology and readable Ironvale

## User intent
Audit whether computer opponents pay the same costs and wait the same construction/training/research times as humans. Expand tree and animal varieties, add harvestable fruit bushes, make sky clouds and the existing day/night/weather simulation apparent, reuse suitable third-party 3D assets as in Hearthguard, and redesign the main menu/HUD with readable text.

Keep the current uncommitted work, team rules, saves, local/online authority and controls. Do not commit, push or deploy remotely. Use the existing `debug` checkout. The requested changes authorize reversible local implementation and verification without additional confirmation gates.

## Fairness
Run mirrored human/AI commands with identical stock, buildings, workers and simulation ticks at all difficulties. Check payment, resource exhaustion, population reservations, construction, training, research and gathering. Run a seeded AI opening audit and report actual timelines and spending. Fix proven differences at shared rule boundaries, not by secretly giving the human bonuses. If rapid AI actions explain the perceived advantage, make difficulty behavior explicit and tune only decision/reaction/opening pressure, keeping costs and timers identical.

## Ecology and world
Add explicit food-resource definitions for deer, wild cattle, alpacas, foxes and berry bushes, with different fixed yields but the same owner-independent harvesting rules. Farms remain owned food. Every city receives equivalent starting food quantities and accessible nearby bushes; animal distributions vary without favoring AI. Save/load accepts new resource kinds and existing deer saves. Neutral animals roam in bounded habitats; bushes remain rooted. Map depleted food to another visible food source sensibly. Represent broadleaf, birch, pine and fir trees as deterministic visual variants of wood resources, preserving wood cost/yield and navigation.

Reuse appropriate locally licensed Hearthguard assets, including the Quaternius human/animal and Poly Haven material assets, with provenance and license files. Batch or bake suitable animation poses for RTS-scale instancing; do not create an unbounded skeleton/mixer per entity. Loading failures must retain a usable battlefield with an explicit asset status. Release model, texture and geometry resources. Imported bodies must retain their heads, equipment, feet placement and team recognition.

The authoritative tick and seed remain the world clock. Improve visible cloud banks, drifting sky-layer motion and soft ground shadows without obscuring commands or revealing hidden enemies. Make rain, fog and storm differences legible, night readable, and dawn/dusk continuous. Keep the normal 24-minute day; menu scenery may animate independently without changing game state. Explain the clock and weather on-screen; validate saved day/night/weather scenes in the browser.

## Interface direction
Use an Ironvale war-table composition with charcoal pine `#17251f`, forest `#294333`, parchment `#eee6ce`, brass `#c6a96a`, slate `#91b0bc`, and danger `#d78870`. Serif display type belongs to the title and settlement names; a familiar system sans-serif carries every numeric, control and instructional label. Main controls use at least 15-16 px text on desktop and 14-16 px on small devices. Resource totals use 20+ px desktop where space permits. Touch actions retain at least 44 px targets. Tooltips and cost text stay readable, rather than relying on browser zoom.

Main menu: a compact identity strip, large campaign title and live village vista; prominent single-player/online choices; setup controls grouped as opponents, difficulty and seed; clear difficulty descriptions and no-cheat assurance. HUD: a readable resource ledger at top; world status and empire/team information in a second strip; camera controls separate from text; bottom selection/production/commands arranged to preserve battlefield space. Phone layouts reflow controls and collapse detailed build lists without horizontal overflow. Settings provide a readable interface-size choice if needed, without changing camera zoom.

## Acceptance
Meaningful fairness tests and a reproducible AI audit report; food harvesting/depletion/retargeting/neutral-motion and equivalent-start tests; visible multi-species environment and locally bundled assets; old-save and multiplayer regression checks; readable HUD/menu browser checks on desktop, phone and tablet. Build, unit/server suite and relevant browser tests must pass. Inspect screenshots and measure 400/800-unit rendering after imported assets.
