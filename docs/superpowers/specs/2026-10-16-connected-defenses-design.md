# Connected defenses

The user wants the wall joints in their screenshot fixed and continued progress toward detailed medieval RTS play. Preserve the approved city architecture and existing teams, voice, resources, worker task resumption, optional zombies, weather and Riverlands.

## Wall joints

Infer cardinal connections from the player's known snapshot in linear time, using only living fortifications of the same owner, including remembered buildings and construction sites. Render actual L, T and cross junctions instead of choosing one straight model for every tile. Wooden posts and braces and stone footings/parapets must meet at tile boundaries. Mixed materials and tier upgrades must remain connected. Two-tile gates need adapters at the actual neighboring tile centers, while their lifted central passage stays clear. Removing or moving a neighbor updates the joint. Keep geometry shared in a finite template cache; release owned resources once.

## Wall-line placement

Keep individual placement available; add an explicit Wall line build choice for wooden and stone walls. Select villagers, choose the wall-line tool, tap/click a start and an end, inspect the route and total resource cost, then press Build line. A non-axis-aligned choice makes an orthogonal L, X first then Y, with no duplicate elbow tile. Limit each command to 64 tiles. All tiles are charged once, built with the normal timers, and queued in order before the villagers resume prior work. Reuse living same-owner palisade/stone segments without charging for them; do not reuse gates or another city's walls.

The complete route must be within bounds, currently scouted and buildable before resources or entities change. Check visibility across the entire route before consulting hidden occupancy/terrain. No partial purchases, no automatic deletion, no free construction, no shared team resources. Task limits must include the complete queue and reject atomically. Solo and multiplayer use the same authoritative command, with strict network validation. A rejected order retains its plan for adjustment. An accepted plan clears its endpoints while keeping the wall tool available.

## Interface and verification

Use the existing medieval HUD colors and typography. Placement controls must have readable text and 44px touch targets and fit narrow phones and landscape screens. A small contextual tray replaces the ordinary placement banner during wall planning; keep battlefield and camera access usable. Cancel, selection changes, switching tools and leaving a game clear the plan. Preview markers must reflect only known information and mark invalid routes clearly.

Verify topology/geometry, gate passage, bounded caches, all-or-nothing resources, visibility, task resumption and online validation with automated tests. Inspect actual desktop and mobile browser renders and capture representative walls and placement UI. Do not claim a full Age of Empires equivalent; this increment is connected fortifications and easier defense construction.
