# Ironvale 3D conversion

Status: approved by the user with "proceed". User requested conversion to 3D and explicitly prohibited automatic Git commits. All work, including this design, stays uncommitted until the user separately requests a commit.

## Outcome

Replace the flat battlefield with genuine 3D terrain, medieval buildings, workers, wildlife, armies and siege equipment. Preserve the existing economy, recruitment, research, AI, fog, conquest, offline saves and online room rules. Private rooms still start manually with the actual 2–8 ready joined players. This conversion changes presentation and camera controls; the authoritative simulation stays on its current two-dimensional tile grid.

## Proposed approach

Use Three.js for the battlefield, with React continuing to manage menus and commands. Build original stylized low-poly models locally from reusable geometry and materials. This matches the existing original medieval art and keeps assets bundled locally. Use real depth, lighting, shadows and articulated animation, rather than flat images facing the camera.

An alternative is Babylon.js, which offers a broader game-engine framework but would introduce more engine infrastructure around an already working simulation. A sprite-based 2.5D upgrade would be cheaper but would not satisfy the requested genuine 3D conversion. The proposed choice is Three.js with focused renderer modules.

The current code already isolates the battlefield behind `BattlefieldView` and a small session-independent view interface. Retain that boundary. The server, simulation commands and saved entity coordinates remain compatible. World tile `(x,y)` becomes render-space `(x,height,z=y)`; visual elevation does not change movement or combat rules.

## Camera and controls

User-selected camera: an elevated orthographic RTS camera with zoom and rotation around the current focus. Keep Ctrl + left mouse drag and middle drag for panning, normal left drag for selection, right click for contextual orders, arrows for camera movement, shortcuts, control groups and minimap navigation. Add visible camera rotation/reset controls, with Q/E keyboard rotation. The Home action recenters on the capital without losing the selected units.

Touch: quick one-finger drag pans; holding for 450 milliseconds then dragging selects multiple owned units; pinch zooms. Visible rotation controls make camera rotation available without conflicting with those gestures. The existing collapsible command panel remains usable in portrait and landscape.

The user selected the elevated RTS camera with rotation and zoom on 2026-10-14. Free-flight and adjustable pitch are outside this conversion. Camera motion must remain bounded to the map and must never interrupt the simulation.

## World and visual feedback

Render seeded terrain as batched geometry with bounded visible detail. Use shared geometry/materials and instancing for repeated scenery where appropriate. Keep fog derived exclusively from the viewer's snapshot: unexplored land obscures terrain detail and entities; explored but unseen areas show only remembered entities and remembered resource amounts. Camera rotation must never reveal unseen opponents.

Provide recognizable 3D silhouettes for every existing building and unit type. Team colors remain visible on banners, clothing and equipment. Buildings show construction progress, damage and destroyed-capital occupation state. Recruits appear at the front-side simulation exits added in the previous fix. Units animate walking, gathering and attacking; ranged attacks and siege shots have visible trajectories. Selected units have ground rings and health bars. Placement previews show valid/invalid footprints and never replace simulation-side validation.

Terrain picking uses a camera ray projected onto the ground. Entity picking resolves visible model hits to stable entity IDs. Rectangle selection uses projected screen positions of owned units so it works at every camera rotation. Selection feedback follows the screen rectangle, even when the ground projection changes.

## Performance and lifecycle

Target 60 FPS desktop and 30 FPS mobile-class rendering under the existing 400/800-unit fixtures, measuring again rather than carrying over the 2D results. Limit pixel density on small screens, bound shadow rendering to the viewed area and reduce optional visual detail when necessary. Avoid one material or texture per repeated entity.

Dispose meshes, textures, event listeners and animation loops on match changes and renderer unmount. Report unsupported WebGL with an actionable message. Use no external asset requests or paid services. Keep synthesized audio and the recently added first-interaction unlock and Test sound control.

## Verification and delivery

Verify 3D projection/picking and selection after rotation, placement previews, Ctrl-drag, touch hold selection, pinch, minimap and home navigation. Adapt the existing browser tests that calculate fixed isometric coordinates; retain their gameplay assertions. Re-run type checking, simulation/server tests, browser flows and the production build. Exercise offline and online play, including nonzero viewer seats and eight-player rooms. Inspect desktop, phone and tablet screenshots and measure 400/800-unit rendering on the actual test machine.

Document new camera controls and current performance results. Device emulation must remain labeled; it is not physical-device testing. Deliver the runnable source and local build on the existing `3D-game` branch, leave changes uncommitted, and do not push or deploy publicly.

Reference APIs: [Three.js orthographic camera](https://threejs.org/docs/#api/en/cameras/OrthographicCamera), [raycaster](https://threejs.org/docs/#api/en/core/Raycaster), [instanced meshes](https://threejs.org/docs/#api/en/objects/InstancedMesh).
