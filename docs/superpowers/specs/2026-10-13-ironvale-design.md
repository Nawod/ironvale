# Ironvale approved design

Original medieval 2D isometric browser RTS. One human versus one or three independent computer empires; no alliances or time limits. Desktop, tablet, and phone, including both phone orientations. Local saves; online multiplayer deferred.

## Rules
Food, wood, stone, gold. Finite hunting, forestry, mining; replantable farms; carrying and drop-off trips. Paid villager recruitment, construction, repairs, population housing, task reassignment. Settlement → Town → Fortified Empire. Equipment included in troop cost, smithy research. Market resource exchange. Population capacity capped at 100 per empire.

Settlement: capital, houses, storage, farms, barracks, palisades, spearmen, scouts. Town: archery range, stable, smithy, market, stone walls, gates, towers, archers, swordsmen, cavalry. Fortified Empire: fortress, siege workshop, advanced upgrades, rams, trebuchets. Walls block movement, gates admit owner, towers/fortresses garrison soldiers. Commands include move, attack, attack-move, patrol, stop, defensive stance, repair, gather, build, recruit, research, garrison.

Fog applies equally to human and AI. AI builds economies, scouts, advances, defends, recruits, and attacks any rival. Difficulty changes decisions/reaction speed, not resources or knowledge.

Destroyed original capital leaves ruins. Uncontested attacking soldiers occupy for 30 simulation seconds. Hostile soldiers pause progress; leaving resets it. Original owner may rebuild after clearing attackers, paying capital cost. Capture eliminates original owner, transfers surviving buildings and villagers, disbands army, turns capital into outpost. Captured population can exceed capacity but recruitment stops. Last surviving empire wins.

## Delivery and architecture
TypeScript, React, Vite, PixiJS WebGL. Browser-independent simulation in worker at 20 Hz; validated common commands for humans/AI, seeded maps, stable IDs, serializable state. Two-empires map 96×96, four-empires map 128×128. Equal starting capital, six villagers, scout and resources. Original locally bundled artwork and audio, animations, construction stages, minimap, queues, alerts, tutorial, settings, pause, restart, results.

IndexedDB manual save and rolling autosave each 60 simulation seconds retain AI, queues, random state, fog and occupation. Pause on hidden tab. Explain incompatible saves/storage failure. Production build and running/hosting documentation. Test simulation rules, conquest, persistence, AI matches, desktop and emulated touch. Benchmark 400 units; report hardware and distinguish real devices from emulation.
