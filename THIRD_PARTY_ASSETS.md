# Ironvale bundled 3D asset credits

Runtime assets are bundled locally under `public/models` and `public/art`;
gameplay does not contact an asset service. Only freely offered content is
included. **Ashen Marches uses its own license; Quaternius and Poly Haven assets
use CC0; the three Wildfire Games terrain textures use CC BY-SA 3.0.** Original
license notices accompany the assets. Manifests record provenance and hashes.

| Assets | Creator and original source | Packaging |
| --- | --- | --- |
| Army characters and equipment | [ChillLands Ashen Marches FREE 100](https://chilllands.itch.io/ashen-marches) | Custom Ashen Marches license, retained at `public/models/ashen/AshenMarches_LICENSE.txt`. Seven character bodies and five equipment models adapted for Ironvale. Finished-game use and modification permitted; standalone asset redistribution prohibited. [Detailed provenance](docs/army-asset-provenance.md). |
| Gold resource and inactive building archive | [Quaternius Ultimate Fantasy RTS](https://quaternius.com/packs/ultimatefantasyrts.html) | CC0; gold is active. Building/wall imports were disabled at the user's request; their files remain available locally. [Detailed provenance](docs/realm-asset-provenance.md). |
| Trees, berry bushes, rocks and mountain formations | [Quaternius Ultimate Nature](https://quaternius.com/packs/ultimatenature.html) | CC0; selected original geometry and natural material colors. |
| Legacy fallback asset archive: peasant and ranger outfits | [Quaternius Modular Character Outfits Fantasy](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html) | Reused from the locally licensed sibling Hearthguard project; compatible skinned bodies retained. |
| Cropped head, eyes, eyebrows and hair | [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) | Reused Hearthguard head separation. Head and hair rebind to the outfit skeleton by bone name and original inverse binds. |
| Idle, walk and sword attack | [Quaternius Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) | Three clips only; mannequin geometry and unused animation buffers removed. |
| Tree chopping | [Quaternius Universal Animation Library 2](https://quaternius.com/packs/universalanimationlibrary2.html) | One work clip only; mannequin geometry and unused animation buffers removed. |
| Deer, horse, cow, alpaca and fox | [Quaternius Ultimate Animated Animals](https://quaternius.com/packs/ultimateanimatedanimals.html) | Deer/horse reused from Hearthguard; cow/alpaca/fox fetched from the exact kit's [CC0 archive mirror](https://github.com/agentkaerf/FreeModels/tree/main/Ultimate%20Animated%20Animals%20-%20July%202021). Original [author distribution](https://drive.google.com/drive/folders/1uJ3N5HfB7jKTseJUNQr3N4YaN0UuEtHk) returned a quota error on 2026-10-15. Original animal license retained. Selected idle/walk/gallop/eating clips only. |
| Bark, pine twigs including alpha, and forest floor | [Poly Haven pine tree](https://polyhaven.com/a/pine_tree_01), [forest floor](https://polyhaven.com/a/forest_floor) | Reused Hearthguard materials. [Poly Haven asset license](https://polyhaven.com/license). |

Repackage with `python scripts/prepare-model-assets.py`; use `--fetch-animals`
to retrieve the three additional animal sources again and `--source PATH` if
Hearthguard is not the adjacent folder. Pillow is required. Only referenced human
textures are copied, image dimensions are limited to 512px, and unreferenced GLB
accessors/buffers are removed. Packaged animal GLBs remain available for ordinary
local repacks without internet access. Source archives are not runtime dependencies.

At load time Ironvale samples shared poses for the free Ashen Marches infantry,
three civilian outfits and three mounted classes. Clothing uses eight city colors;
skin, leather and metal retain distinct materials. Mounted units combine the
existing Quaternius horse with seated riders, reins, saddles and class equipment.
Wildlife uses its existing model and animation path. There are no per-entity
skeletons or animation mixers. Full and crowd geometry banks are bounded and
instanced by material; all sampling and equipment assembly happen during loading.

The static realm provider imports trees, berry bushes, rocks, mountain formations
and gold only. Buildings and walls now use the original Ironvale medieval architecture provider,
created for the user's 2026-10-16 medieval overhaul. It uses original geometry and
procedural material textures; the imported fantasy building archive remains
disabled. Capital ruins retain the earlier Ironvale fallback models. Natural scenery stays grounded and shared;
unused imported building files are not fetched or prepared during gameplay.
Wooden-to-stone-to-reinforced upgrades retain their new rules, costs and timers.
The supplied characters, animals and natural scenery retain their stylized game appearance. The terrain additionally uses the already licensed Poly Haven ground photograph with original grass/soil variation and cosmetic settlement paths. No new external asset pack or purchase was added.

Raw archives and unused source files are excluded under `.art-source/`. The Ashen
Marches runtime dependencies are incorporated into Ironvale and must not be offered
as a separate asset download. The legacy CC0 human archive remains locally bundled
for provenance/repacking compatibility; active armies use Ashen Marches.

The Riverlands update reuses those same licensed twig photographs for bounded,
alpha-tested canopy sprigs on twelve shared tree size/species profiles. It adds
original river shading, stone-crossing textures, bridge geometry, arrow/stone
projectile geometry and shared character-pose adjustments. No additional external
asset or license was introduced; animal models and the approved medieval building
provider are unchanged.

The graphical command-deck portraits in `public/art/portraits` are local renders
of those same game-model providers: original Ironvale architecture, the licensed
Ashen Marches characters/equipment and the credited Quaternius scenery/animals.
They are incorporated game UI, not a separately distributed asset collection.
The reproducible workshop is `scripts/bake-command-portraits.ts`; no external
generation service or additional source pack is used. The oak HUD grain is an
original SVG, with original CSS brass/stone framing. Existing model license
notices and usage restrictions continue to apply.

The river-valley landscape pass adds original seeded meadow, leaf-litter and
gravel coloring, procedural cobblestone joints and river shading. Reeds, lilies,
small flowers and ferns use original shared, vertex-colored geometry. It reuses
the existing licensed ground photograph; no additional third-party asset,
purchase, generation service or runtime download is introduced.

The subsequent highlands overhaul adds three **Wildfire Games** terrain textures
from the official [0 A.D. source mirror](https://github.com/0ad/0ad):
`temp_grass_mod_02.png`, `temp_dirt_gravel_b.png` and `temp_cliff_c.png`.
They are converted to RGB, resized to 512 × 512 and stored as JPEGs in
`public/art/terrain0ad`. These artworks and their resized derivatives retain
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) licensing.
Attribution to [Wildfire Games](https://www.wildfiregames.com/), the original
license, precise source revision, source/output hashes and modification notices
are included beside them. `scripts/prepare-terrain-assets.py` reproduces the
packaging. This is texture artwork reuse; no 0 A.D. engine or map code is copied.
