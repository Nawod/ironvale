# Historical natural scenery

The bundled oak, pine and berry assets are derivatives of authentic **0 A.D.** artwork by [Wildfire Games and contributors](https://www.wildfiregames.com/), from the [official archived GitHub repository](https://github.com/0ad/0ad/tree/61a3b9507d974084e6badb88a0826bd89a6d5b8b/binaries/data/mods/public/art). All source paths are pinned to commit `61a3b9507d974084e6badb88a0826bd89a6d5b8b`. These derivative assets remain licensed under [Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

`public/models/historical-nature/manifest.json` records the exact URLs, SHA-256 hashes and byte counts of original source files and locally shipped derivatives. The original root and art license notices are included unchanged alongside a derivative NOTICE. Preserve these notices and attribution when redistributing the foliage pack. The art notice also retains upstream's CGTextures permission statement.

| Local asset | Original mesh | Original atlas | Triangles |
| --- | --- | --- | ---: |
| oak-a | `meshes/gaia/oak_tree_a.dae` | `textures/skins/gaia/oak_tree_a.png` | 436 |
| oak-b | `meshes/gaia/oak_tree_b.dae` | `textures/skins/gaia/oak_tree_b.png` | 350 |
| pine | `meshes/gaia/pine1.dae` | `textures/skins/gaia/pine.dds` | 58 |
| berries | `meshes/gaia/berry_bush_01.dae` | `textures/skins/gaia/berry_bush_01.png` | 458 |

The mappings are taken from the original `flora/trees/oak.xml`, `flora/trees/pine.xml` and `props/flora/berry_bush.xml` actors. The bush decal and original wind shader are omitted. No full game archive is downloaded or bundled.

Rebuild from the project root with `python scripts/prepare-historical-scenery.py` (Python, numpy and Pillow required). Downloads are cached under the operating system temporary directory, outside the shipped game. Conversion bakes authored static scene transforms, changes Z-up to Y-up where required, converts UV origin and preserves original triangles/normals/UVs. Atlases are resampled to at most 512 pixels and stored as RGBA PNG. A conservative alpha sample separates opaque bark triangles and alpha-tested foliage; both groups retain the source atlas. These are shared meshes with alpha-tested leaf cards, not transparent leaf sprites or per-entity animated forests.

`HistoricalScenery` loads four geometry files and four atlases once, then prepares six tree profiles (three source silhouettes with two uniform scale profiles) and one berry profile. Requests return existing `ModelPart[]` arrays, geometry, materials and maps across entities and owners. Maximum canopy width is 3.2 world units (2.88 for the smaller profile), with a 4.0 height cap (3.6 smaller); source proportions are preserved, so oak crowns are broad and pine is taller. Authored tree templates range approximately 2.07–3.76 units in height before caller variation. The berry profile fits 1.12 width and .95 height. Canopies can visually overhang neighboring forest tiles without changing simulation footprints.

The provider supports only resource `wood` and `berries`; buildings, animals, ore and other entities fall through. Its caller handles fog and entity transforms. Foliage uses `alphaTest=.45`, `DoubleSide`, opaque depth writing and no transparent sorting. The provider owns and disposes its geometry/materials/maps, including partial loads and assets that finish arriving after teardown. It creates no animation mixers.

Verification uses the actual local GLBs with GPU-free Three.js loading, checking finite geometry, UVs, grounding, bounds, source diversity, triangle limits, cutout/opaque materials, repeated-request reuse, error fallback, disposal and derivative hashes. The scoped test file does not establish browser visual quality or GPU rendering performance.
