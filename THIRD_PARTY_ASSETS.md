# Ironvale bundled 3D asset credits

All models and textures below are **CC0 1.0 / public domain**. They are bundled
locally under `public/models`; gameplay does not contact an asset service.
Only freely offered Standard content is included. Original kit license notices
are retained beside the models. `public/models/manifest.json` records model sizes
and SHA-256 hashes.

| Assets | Creator and original source | Packaging |
| --- | --- | --- |
| Peasant and ranger outfits | [Quaternius Modular Character Outfits Fantasy](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html) | Reused from the locally licensed sibling Hearthguard project; compatible skinned bodies retained. |
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

At load time Ironvale samples six walking, working and attack poses, plus one idle
pose, per outfit; animals have six walk poses and one idle pose. These are static
geometries merged by material for instanced rendering. There is no per-entity
skeleton or animation mixer. Dense outfit meshes use deterministic bind-space
vertex clustering with finer face/hair cells, preserving UV islands and source
vertex colors. Team badges and authored tools preserve skin/eye
materials and attach to the sampled skeleton. Humans face +Z; animals face +X.
An additional shared crowd bank uses coarser bind-space cells for dense battles,
retaining materials/anatomy at roughly one third of full human triangles. The
combined banks contain 111 sampled poses and about 28.4 MB of geometry locally.
Feet are grounded separately for each sampled pose. Mounted troop composition
continues to use Ironvale's authored model fallback; the bundled horse is ready for
future rider composition. Buildings, tools, badges and tree variant geometry are
authored in Ironvale. These are detailed game assets rather than photoreal models.
