# Ironvale bundled 3D asset credits

All runtime assets are bundled locally under `public/models`; gameplay does not contact an asset service. Only freely offered content is included. **Ashen Marches uses its own license; the Quaternius and Poly Haven assets use CC0.** Original license notices are retained beside the models. The manifests record provenance, sizes and hashes.

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
