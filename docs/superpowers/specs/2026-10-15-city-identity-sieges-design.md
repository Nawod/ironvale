# City identity, armies and siege progression

The user requests clearly different outfit colors for every city, varied army characters, a proper horseman, the free Ashen Marches character/equipment pack, Quaternius Ultimate Fantasy RTS buildings and Ultimate Nature scenery, complete AI destruction of town halls, and wooden walls at the first town-hall level with later upgrades. Existing animals are approved and must retain their appearance.

## Design

Use a saturated, consistent eight-city palette on substantial cloth/shield/roof surfaces; preserve skin, leather, metal and animal colors. Keep class silhouettes distinct through actual guard, marshal, ranger and equipment meshes rather than recoloring one body for every troop. Mounted scout/cavalry/heavy cavalry combine a grounded animated horse with a seated rider and class-appropriate equipment. Use only the freely offered Ashen Marches subset, retain its exact license and ship only game-used derived assets. Never buy the paid collection. Static scenery uses the supplied CC0 packs, normalized to existing footprints and fog-filtered entities. New rocky formations remain decoration of existing stone sources rather than new hidden collision obstacles.

Preserve shared full/crowd pose banks, instancing, source attribution, nonblocking loading, explicit fallbacks and bounded resource disposal. New visuals must remain usable under 400/800-troop fixtures. Existing animals remain unchanged.

AI raids must sustain a valid, visible hostile siege until the town hall reaches zero HP, then enter the existing contested 30-second occupation. Preserve fog, alliances, normal costs/damage, defense and resource ownership. Investigate the actual abandonment/targeting failure and reproduce it before fixing it.

Wooden walls are available at age 1. A selected owned wooden segment upgrades to stone at age 2 for 12 stone over 6 seconds; a selected stone segment upgrades to reinforced stone at age 3 for 24 stone + 8 gold over 10 seconds. Preserve entity IDs, footprints and HP fraction; no free repair or free upgrades on town-hall advancement. Damaged, queued, ownership, age, resource and save-validation cases must be checked. Existing stone/wood saves remain valid. Show availability, cost, remaining time and progression clearly in the HUD.

## Validation and delivery

Write meaningful red/green simulation and model tests; inspect actual asset meshes and city colors; verify mounted grounding/orientation, snapshots, wall UI, readable layouts, multiplayer authority, army rendering and final local runtime. Keep source changes uncommitted and unpublished unless the user requests otherwise. Refresh only the known local Ironvale server after verifying no active rooms.
