# Imported realm assets

**Current scope after the building rollback (15 October 2026):** only the four trees, berry bush, five rock/mountain variants and gold resource are loaded. All buildings, walls and capital ruins use the previous Ironvale model library. The building mappings below describe the retained inactive archive, not the active renderer. Characters, scenery, wall-upgrade rules, siege logic and other improvements remain in place.

Downloaded 2026-10-15 from the original public Quaternius distributions; no purchase, generated substitute, or mirror was used.

- [Ultimate Fantasy RTS](https://quaternius.com/packs/ultimatefantasyrts.html): author lists 128 CC0 models with building evolution stages. [Original author folder](https://drive.google.com/drive/folders/1h7sztlZyavWla-JDk3jp6KiWDdMh08yd); selected embedded glTF geometry converted losslessly into GLB containers.
- [Ultimate Nature](https://quaternius.com/packs/ultimatenature.html): author lists 150 CC0 models. [Original author folder](https://drive.google.com/drive/folders/1-Kl0L_Jg8awbh0S5T-z3zxh4mVlnxTpa); selected OBJ faces triangulated and converted to GLB with original named MTL diffuse colors. Normals are recomputed during import.
- Both author pages link [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). Original unedited notices: `public/models/realm/rts-license.txt` and `nature-license.txt`. The RTS distribution's own notice is titled “Ultimate Platformer Pack”; retained verbatim, despite the apparent author copy/paste title. The requested RTS webpage independently states CC0.
- `public/models/realm/manifest.json` retains every original filename, author Drive ID, original file SHA-256, converted GLB SHA-256, and byte count. There are 38 shipped GLBs, totaling 8,219,460 bytes. They have no image textures, external buffers, paid assets, or runtime asset-service dependency.

## Mapping and intentional limits

| Simulation entity | Imported source | Ages 1 / 2 / 3 |
| --- | --- | --- |
| Town center, outpost | TownCenter | FirstAge Level1 / FirstAge Level3 / SecondAge Level3 |
| House | Houses, variant 1 | FirstAge Level1 / FirstAge Level3 / SecondAge Level3 |
| Storehouse | Storage | FirstAge Level1 / FirstAge Leve3 (author spelling) / SecondAge Level3 |
| Barracks | Barracks | FirstAge Level1 / FirstAge Level3 / SecondAge Level3 |
| Archery range | Archery | FirstAge Level1 / FirstAge Level3 / SecondAge Level3 |
| Stable | Barracks family | Reuses barracks geometry; source pack has no literal stable |
| Smithy, siege workshop | Storage family | Reuses yard geometry; source pack has no literal smithy/workshop |
| Market | Market | FirstAge Level1 / FirstAge Level3 / SecondAge Level3 |
| Watchtower | WatchTower | FirstAge Level1 / FirstAge Level3 / SecondAge Level3 |
| Fortress | Wonder | FirstAge Level1 / FirstAge Level3 / SecondAge Level3 |
| Palisade | Wall_FirstAge | Timber at every age |
| Wall | Wall_SecondAge / WallTowers_SecondAge | Stone; towered stone only with purchased `wallTier === 3`, independent of player age |
| Wood resource | CommonTree_1, BirchTree_1, PineTree_1, CommonTree_3 | Four deterministic shared variants |
| Berries | BushBerries_1 | Real named Berry geometry plus source green foliage; no fruitless shrub substitute |
| Stone | Rock_1, Rock_3, Rock_Moss_2, Mountain_Single, Mountain_Group_1 | Five deterministic variants; mountain forms occupy existing stone resource tiles only |
| Gold | Resource_Gold_1 | Source gold and stone remain distinct |
| Farm, gate, all actors | Existing renderer fallback | Animated gate and crop layout are intentionally unsupported here; animals unchanged |

These are visual substitutions. No terrain generation, simulation coordinates, collision obstacles, entity footprints, resources, fog, or navigation rules change. Map roots remain at their existing positions: buildings at footprint centers; resources at their existing root. Geometry is centered in X/Z and grounded at Y=0.

Buildings fit within 94% of their existing square footprint, preserving aspect ratio, with maximum height 3.8 tiles (fortress 4.5). Wall segments retain their horizontal proportions and use readable vertical heights of 1.15 wooden, 1.35 stone and 1.65 reinforced stone tiles. Trees cap canopy width at 1.75 and height at 3.8. Berries cap width at 1.12 and height at .95. All rock/gold/mountain forms stay within .96 of the existing resource tile; low rocks cap at .7, gold .8, mountain forms 1.25. Destroyed town center/outpost uses a low imported moss-rock ruin capped at .32.

Source `Main`, `Red`, and `Yellow` roof/cloth materials use the central owner `COLORS` palette. For source wood/stone roofs without a separate material, only elevated upward sloping faces are split into a roof material. Walls, posts, timber, foliage, water, and stone keep source colors. Paired cloth standards inside building footprints make open yards and ceremonial plazas legible by owner. Those small standards are authored geometry and explicitly marked as such; the rest is imported source geometry. The source town center is an open ceremonial plaza, not a roofed European town hall.

## Loading and resource ownership

`ImportedScenery.load()` is an idempotent Promise; `get(entity, age, variant)` returns undefined until ready or for unsupported types so the host retains its existing fallback. Loading failure records `error` and releases owned resources. Disposal during asynchronous load releases late sources without becoming ready. Source meshes are statically baked and merged by material once. Shared finite template/footprint variants and owner-material arrays are cached; entities never get cloned scenes, skeletons, mixers, geometries, or materials. Owner changes reuse the same geometry. The host owns snapshot visibility/fog selection and calls `dispose()` when leaving the battle.

## Reproduction and checks

From repository root, install Python `gdown` for complete author-folder listings, then run `python scripts/prepare-realm-assets.py --list` and `python scripts/prepare-realm-assets.py`. The default source cache is in the system temporary directory, outside the public bundle. Ordinary Drive folder pages list only 50 files; the embedded folder view supplies the complete list. Pillow is optional for `python scripts/prepare-realm-preview.py`, a CPU-only source silhouette contact sheet.

`npx vitest run tests/imported-scenery3d.test.ts` checks actual shipped GLB loading, finite geometry/normals, centered grounded footprint fit, genuine age changes, owner/natural materials, fruit geometry, stone mountain bounds, paid wall tiers, ruins, caching, errors, and asynchronous resource disposal. Browser appearance and GPU performance must also be reviewed by the host integration; CPU geometry tests do not establish those.
