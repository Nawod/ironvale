# Ironvale — Browser RTS Implementation Plan

Approved user specification and milestone plan, preserved on 2026-10-13.

## Summary

Build an original medieval, 2D isometric RTS in `N:\Projects\GPT\ironvale`. One human faces either one or three computer empires on a shared map. Every empire fights independently; there are no alliances or match timers.

Deliver gathering, hunting, farming, city construction, worker assignments, research, armies, fortifications, and city conquest. Support desktop, tablet, and phone. Online multiplayer follows in a later version.

## Architecture and interfaces

- Use TypeScript, Vite, React for menus and controls, and PixiJS for battlefield rendering. Default to WebGL. [PixiJS documentation](https://pixijs.com/8.x/guides/components/application)
- Run the simulation in a Web Worker at a fixed 20 ticks per second. Keep rendering, camera movement, and UI updates independent.
- Separate world generation, economy, movement, combat, visibility, conquest, and AI into focused modules.
- Human controls and computer opponents submit the same commands: recruit, assign task, build, repair, research, move, attack, attack-move, patrol, stop, and garrison.
- Validate ownership, resources, prerequisites, placement, and visible targets inside the simulation.
- Define serializable match configuration, commands, game state, events, player-visible snapshots, and versioned saves. Include seeded randomness and stable entity IDs.
- Keep simulation code independent of browser APIs so a future authoritative multiplayer server can reuse it. Build no networking or accounts in v1.

## Implementation milestones

1. **Playable battlefield and controls**
   - Create seeded land maps: 96×96 tiles for two empires and 128×128 for four.
   - Give starting locations comparable resources, reachable opponents, and buildable land.
   - Implement isometric projection, depth sorting, camera bounds, zoom, selection, minimap, and fog of war.
   - Add desktop drag selection, right-click orders, shortcuts, and control groups.
   - Add touch selection, army selection, explicit command buttons, camera gestures, and a collapsible command panel. Support portrait and landscape.

2. **Economy and city construction**
   - Start each empire with a capital, six villagers, one scout, and equal resources.
   - Implement food, wood, stone, and gold; finite forests, deposits, and wildlife; replantable farms; carrying capacity and drop-off trips.
   - Implement recruitment queues, population capacity, task reassignment, idle-worker selection, construction, repairs, and placement previews.
   - Add grid pathfinding, building obstacles, group destinations, and recovery from blocked routes.
   - Store all costs, durations, statistics, and prerequisites in shared balance definitions.

3. **Progression, armies, and defenses**
   - Implement **Settlement → Town → Fortified Empire** with paid advancement and prerequisite buildings.
   - Settlement provides houses, storage, farms, barracks, palisades, spearmen, and scouts.
   - Town adds archery ranges, stables, smithies, markets, stone walls, gates, towers, archers, swordsmen, and cavalry.
   - Fortified Empire adds fortresses, siege workshops, advanced research, rams, and trebuchets.
   - Include equipment in troop costs; smithies research weapon and armor improvements.
   - Implement unit counters, ranged attacks, siege damage, patrol, defensive stances, owner-controlled gates, and garrisons.
   - Allow market resource exchange. Cap ordinary population capacity at 100 per empire.

4. **Computer empires and conquest**
   - Implement economy planning, scouting, construction, advancement, recruitment, defense, target selection, attacks, and rebuilding.
   - Easy, Normal, and Hard change decision quality and reaction intervals without hidden resources or map knowledge.
   - Computer rivals may attack and capture each other.
   - A destroyed capital leaves an occupation site. One attacking faction must hold soldiers nearby for 30 simulation seconds; hostile soldiers contest and pause progress. Progress resets when the occupying faction leaves.
   - The original owner can rebuild a fallen capital after clearing attackers, paying its construction cost.
   - Completed occupation eliminates the owner, transfers surviving buildings and villagers, disbands its army, and converts captured capitals into outposts.
   - Captured villagers may temporarily exceed population capacity; further recruitment waits for capacity.
   - End the match when one empire remains, displaying victory or defeat for the human.

5. **Presentation, persistence, and delivery**
   - Create original medieval artwork and animation for terrain, buildings, construction, workers, troops, combat, and destruction.
   - Add team colors, readable silhouettes, attack alerts, production feedback, sound effects, and adjustable music.
   - Implement setup, tutorial, pause, restart, results, manual saves, and one rolling autosave every 60 simulation seconds.
   - Save complete simulation state, including AI plans, queues, fog, occupation progress, and random-generator state in IndexedDB.
   - Pause when the browser tab is hidden. Explain unavailable storage and incompatible saves clearly.
   - Bundle assets locally, produce the production build, and document running and hosting it.

## Test and acceptance plan

- **Simulation:** verify resource conservation, recruitment costs, construction prerequisites, population limits, task changes, depleted resources, path obstruction, gate ownership, combat counters, and fog-restricted targeting.
- **Conquest:** verify contested occupation, interrupted occupation, rebuilding, ownership transfer, captured population overflow, AI-versus-AI elimination, and human victory and defeat.
- **Persistence:** verify save/load continuity, AI and randomness restoration, pause behavior, unavailable storage, and incompatible saves.
- **Computer behavior:** run seeded headless matches for both opponent counts; verify rivals develop economies, advance, defend, attack each other, and complete conquest without rule-breaking.
- **Browser controls:** test desktop and touch flows, including phone orientations, selection, commands, placement, minimap navigation, and saves. Use Playwright device emulation; distinguish this from physical-device testing. [Playwright documentation](https://playwright.dev/docs/emulation)
- **Delivery:** pass type checking, simulation tests, browser tests, and production build; manually play both match configurations. Measure a four-empire, 400-unit stress scenario, targeting 60 FPS on desktop and 30 FPS on mobile-class hardware, with tested hardware reported.

## Assumptions and boundaries

- **Ironvale** is the working name.
- All empires share one original civilization and technology tree, distinguished by colors.
- Terrain elevation is visual; v1 uses land movement without naval combat.
- Local saves belong to the current browser and device.
- Deliver locally runnable source and a deployable build; public deployment is a separate step.
- During implementation, preserve this approved specification and the milestone plan under the project’s Superpowers documentation folders.
