# Gameplay and gesture refinements — 2026-10-14

Scope authorized in the user's requested changes: wandering animals; direct touch gathering/movement/attacks; more army types; sequential stone-wall construction; one-click whole-army selection; Ctrl-drag rotation/middle-drag panning; pinch/twist touch camera; highlighted "Play with Freinds" button. Work remains uncommitted. Starting HEAD b91b89c (the existing 3D conversion commit), not created during this task.

Rulings: these extend existing simulation/control flows. Animals move in the authoritative simulation, near fixed habitats, stop for close hunters, and preserve RNG/waypoint state through saves. Stone walls are paid/placed immediately and queue per selected builder in placement order; explicit orders cancel assignments. Queue data is hidden from opponents. Friendly units/buildings remain selectable on touch; selected workers directly gather from resources/own farms, soldiers directly attack enemies, and ground taps move. Manual task buttons remain available.

Army additions: pikeman (Town barracks), crossbowman (Fortified Empire range), heavy cavalry (Fortified Empire stable). Shared definitions drive recruitment/age costs, movement and combat. AI uses available troop types. New 3D equipment and UI icons distinguish troops.

Watched RED tests: wildlife movement, wall queue continuity/cancellation, new recruitment, Ctrl rotation and touch context. Implemented and GREEN: 103 unit/simulation/server tests in 18 files. Focused browser controls:13 passed/2 device-specific skips, including direct touch gathering, middle drag, pinch and twist. Final browser suite:42 passed,12 intentional device skips,zero failures. Desktop400/800 measured60.00FPS;4×CPU-throttled phone40060.00FPS/80052.56FPS on Intel UHD Graphics through ANGLE D3D11. Physical mobile devices remain untested. Type checking and production build passed.

Review found stale deer fog-memory when the old location became visibly empty. Added a failing regression and fixed it without exposing hidden current positions. Also added a failing regression for queue append during another builder's completion; queued earlier sites now stay assigned. Both fixes and the whole103-test suite pass.

User confirmed pikemen/crossbowmen/heavy cavalry. No commits/pushes/deployment. Existing branch remains3D-game; new changes stay uncommitted.

Production delivery verified on the restarted local server at http://localhost:5180; health returnsok. Browser smoke on final built assets loaded a one-villager Town/Fortified fixture, placed three stone walls, observed two pending assignments, and waited until all three were completed in sequence. It then recruited a crossbowman and selected the entire army. Screenshot inspected and saved in docs/gameplay-evidence alongside final performance JSON. An earlier ad-hoc ray pick selected a different actor in the crowded showcase fixture; the final check used Idle villagers in a one-builder fixture to select its worker unambiguously.

Final HEAD remainsb91b89c947a8f3502a397592b21b8a30889d2086; no new commits were created. Local server session20087 remains running.

Follow-up: selected villagers now finish an unfinished friendly building by ordinary left-click or touch tap. Completed buildings and friendly units retain selection behavior; soldiers do not receive construction assignments; Shift-click allows building selection. Both mouse/touch regressions observed failing before the fix and now pass. Actual half-built-house completion browser tests pass on desktop, phone and tablet; final105-test simulation/server suite passes. Browser verification rebuilt/type-checked production assets. Changes remain uncommitted.

Touch-rotation follow-up: reversed the two-finger twist camera direction at the user's request. Production yaw now adds the normalized finger-angle change. Gesture regression passes; real model selection after twist passes on emulated phone and tablet (2 passed/1 intentional desktop skip). Browser checks rebuilt/type-checked production assets. Desktop rotation and pinch scale retain their existing formulas. No commits made.
