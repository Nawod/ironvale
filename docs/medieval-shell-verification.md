# Matching menus, pop-ups and lobby

Ironvale's main menu and surrounding screens now use the approved battlefield
HUD's oak grain, brass borders, inset slate controls and pale serif headings.
The live 3D menu vista remains visible. Primary actions use raised brass buttons;
secondary actions and forms use the same relief treatment as battlefield orders.

The theme covers campaign setup, online entry/create/join/matchmaking, the room
roster and settings, voice panels, preferences, help, pause/victory/defeat panels,
and notification/targeting pop-ups. Each lobby seat includes a lightweight town
portrait in its city color alongside its existing color stripe. This reuses the
bundled images and adds no renderer, external asset, dependency or network rule.

Compact layouts retain scrollable panels and 44px controls. Long player names
wrap; team selectors use their own row on phones. Larger-text preferences remain
available. No changes were made to team limits, readiness, voice privacy, match
timers or simulation rules.

## Verification

The new menu/pop-up and eight-seat lobby checks, together with the existing
readable-interface suite, passed **15 browser cases** across desktop, phone and
tablet. Phone and tablet checks cover both orientations, larger text, reachable
controls, help scrolling, pause/resume, eight real room clients, all eight model
portraits and the private-team voice selector.

The existing multiplayer/voice regressions added **eight passing cases and one
explicit desktop skip** for a compact-only check. These exercise host-started
matches, friend recruitment, reconnecting, the online game menu, mobile quick
mute/unmute in both orientations, FFA open voice and stopping microphone capture.
Combined result: **23 passed, one skipped, no failures or flaky retries**.

Type checking and the production build passed. The existing graphics-chunk size
advisory remains. [Browser results](medieval-shell-evidence/browser-results.json)
and [build output](medieval-shell-evidence/build.txt) record the verification.

Browser checks use Chromium emulation, not physical mobile devices. The eight-seat
fixture uses one rendered host and seven protocol-only guests; it verifies the
real full-room UI without eight concurrent 3D renderers. Fake microphones are used
for the voice regressions; this update does not claim a new Internet audio test.

The production build at `http://localhost:8180` was checked in a fresh browser
context with no page or console errors. The temporary capture room was closed;
the final health response was `{ "ok": true, "rooms": 0, "protocol": 1 }`.
Desktop/phone screenshots were visually inspected for readable text, framing and
control placement. The main menu is intentionally scrollable for setup options.

- [Main menu](medieval-shell-evidence/desktop-main-menu.png)
- [Online entry](medieval-shell-evidence/desktop-online-entry.png)
- [Team lobby](medieval-shell-evidence/desktop-team-lobby.png)
- [Preferences](medieval-shell-evidence/desktop-settings.png)
- [Phone game menu](medieval-shell-evidence/phone-game-menu.png)
- [Phone full-room roster](medieval-shell-evidence/phone-390-medieval-team-roster.png)
- [Production browser result](medieval-shell-evidence/local-runtime.json)
