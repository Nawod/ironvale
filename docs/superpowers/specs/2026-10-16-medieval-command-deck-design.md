# Medieval command deck

The user approved the buildings and connected walls and asks to continue toward the graphical in-game layout shown in their Age of Empires references. This pass makes Ironvale's existing RTS controls look and read like a medieval command station, preserving the approved world artwork and mechanics.

## Visual brief

Use original Ironvale decoration: carved oak (#372e25), dark bronze (#1f2924), aged brass (#b39a62), warm parchment (#e3d1a3), weathered stone (#797b68), and the existing eight city colors. Georgia is the restrained title face; system sans remains the readable control face. Wood grain, inset stone surfaces, raised metal rims and subtle highlights provide depth. Use the existing crest. No copied Age of Empires logos, icons, textures or artwork.

Desktop layout: compact framed resources across the top; a substantial but bounded command deck along the bottom, with a framed minimap, a larger selected-entity portrait and health information, and the existing contextual commands. Army selections show type/count portraits so the player can pick a subgroup. Training has visible portrait cards and progress. Keep all commands, costs and durations readable rather than hiding functions behind unexplained icons.

Mobile keeps the previous on-demand drawers, narrow resource strip, landscape right-hand commands and at least 44px targets. The ordinary collapsed HUD must leave at least 70 percent of the screen available for battlefield input in the tested orientations. Large-text settings, voice, camera tools, wall planning, menus and keyboard navigation must remain accessible. Portraits and optional composition details shrink or hide within the collapsed mobile selection bar; they must not expand the bar across the battlefield.

## Real model portraits

Render static portraits from the existing Three.js model providers using a reproducible local browser baking script. Include the actual approved building ages, wall tiers, army equipment and eight city colors. Existing animals/scenery can use their game models for matching portraits. Human portraits may crop to the upper body for readable faces/equipment; cavalry and siege retain their identifying silhouettes. Use local WebP files, lazy image loading where appropriate, and a bounded type/age/owner lookup. Do not add live WebGL contexts or animation loops to UI portraits. Missing images must have the original artwork as a fallback. Preserve source asset attribution.

## Selection and production

For one selected entity, show its name, city, current state, a visible health meter (or resource amount), and the larger model portrait. For multiple owned units, group by unit type with counts; activating a group selects those IDs only. Keep the total selection summary and commands functional. Filter destroyed or garrisoned units from actionable groups. Show production portraits with the normal paid authoritative timer; do not change recruitment costs, timings, queue ownership or add cancellation semantics.

## Strategic map

Draw a pale camera footprint on the minimap, updating while panning, rotating and zooming even when the simulation is paused. Use camera-ground intersections and map clipping, never hidden simulation state. Preserve click/tap navigation and provide sensible keyboard activation. Cache terrain/fog and entity background drawing from the latest snapshot; update the camera overlay at a bounded cadence and release timers on unmount. Ordinary fog visibility, same-owner controls and online privacy remain unchanged.

## Verification and limits

Verify portrait coverage and normalization, selection grouping, camera footprint geometry, and lifecycle where meaningful. Run desktop/phone/tablet browser checks of subgroup selection, training, minimap and HUD containment, together with the existing readable/compact controls and wall flows. Capture actual local game renders, including phone landscape, and distinguish prepared scenes from ordinary starts. No new gameplay mode, civilization tree, campaign or naval combat is promised by this UI presentation increment. No paid/external assets, dependencies, commits or deployment are required.
