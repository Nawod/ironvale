# Medieval command deck

This update gives Ironvale an original medieval RTS interface based on the user's
reference direction: framed resources above the battlefield, a compact minimap,
an illustrated selection panel and contextual orders/production below it. It
preserves the approved buildings and connected walls, existing match rules and
the on-demand phone/tablet controls.

## Changes

- Oak grain, brass borders and inset slate give the HUD a relief appearance.
  The desktop command deck and minimap use 180px height; an empty selection keeps
  the original small instruction bar. Compact layouts retain their existing size
  limits, scrolling and 44px controls.
- Selection, recruitment and production use 192px transparent WebP images rendered
  locally from the actual game models. There are 442 bounded variants covering
  eight city colors, building ages and reinforced walls, totaling 2,684,276 bytes.
  They are ordinary image elements with lazy loading and an earlier-art fallback;
  selecting a unit does not instantiate another WebGL renderer.
- A mixed army exposes type/count portrait buttons. These select only that
  player's living, ungarrisoned units of the chosen type. Mobile users find the
  same controls in Commands → Orders.
- The minimap caches its terrain/entity drawing and paints the clipped camera
  footprint at 10Hz. It follows camera movement while simulation time is paused,
  skips hidden canvases and removes its timer on unmount. Click/tap navigation
  remains unchanged; keyboard activation returns to the player's town center.
- Selection membership uses a memoized set. Adaptive renderer resolution changes
  now happen before presenting the frame, preventing a cleared frame after a
  resolution adjustment. Simulation timing and multiplayer commands are unchanged.

## Verification

The bounded full automated suite passed all **473 tests**. The final browser
results contain **39 passing cases and six explicit device-specific skips**
across desktop, phone and tablet. The complete desktop compact/readability/new-deck
set was rerun after the height adjustment: **12 passed**. Type checking,
production build and whitespace checks passed. The build retains the existing
large graphics-chunk advisory.

The [evidence directory](medieval-command-deck-evidence) contains machine-readable
[automated results](medieval-command-deck-evidence/unit-results.json),
[browser results](medieval-command-deck-evidence/browser-results.json) and
screenshots. Browser totals use the latest result for each case/project, avoiding
duplicate counting of reruns. Tests use Chromium desktop, phone and tablet
emulation; this is not a physical-device certification or an online voice/network
load test.

The focused regressions cover portrait coverage/dimensions/city variants/image
budget, owned-unit grouping, camera projection and clipping, and adaptive render
ordering. Browser checks exercise real model portraits, subgroup selection,
production costs/progress, no extra WebGL contexts, fallback artwork, paused
camera updates, timer cleanup, empty selection height, command access, readable
controls and connected wall placement.

## Review and fixes

A fresh read-only code review found that expanded-deck styling also applied when
nothing was selected. A failing browser check reproduced the 196px empty deck;
the selector now requires a selection. Existing battlefield-space checks then
found that the selected desktop deck was slightly too tall; it was reduced to
180px. A separate regression reproduced the adaptive renderer presenting before
its drawing-buffer resize, and now verifies resize-before-present.

## Reproduction and limits

Normal builds use the bundled portraits. `npx tsx scripts/bake-command-portraits.ts`
regenerates them using one offline renderer; `--preview` renders a small sample.
The model workshop is not part of the playing game. Existing source-asset licenses
remain in force; this change adds no external asset pack, service or dependency.

Production screenshots show a prepared two-city scene using ordinary game models
and the actual local production build at `http://localhost:8180`. The final browser
session reported no page or console errors; the server health response was
`{ "ok": true, "rooms": 0, "protocol": 1 }`. Desktop and phone landscape captures
were visually checked with commands both closed and open.

- [Desktop battlefield and command deck](medieval-command-deck-evidence/desktop-medieval-command-deck.png)
- [Phone landscape, compact controls](medieval-command-deck-evidence/phone-medieval-command-deck.png)
- [Phone landscape, army orders](medieval-command-deck-evidence/phone-medieval-commands-open.png)
- [Local runtime result](medieval-command-deck-evidence/local-runtime.json)

The interface is implemented and playable; the reference games' full graphics and
feature sets are not a completion claim.
