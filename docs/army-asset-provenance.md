# Ironvale army assets

## Source and permitted use

The character and equipment subset comes from **Ashen Marches FREE 100**,
ChillLands, version 2.1.4, downloaded 15 October 2026 through the author's official
itch.io **Download Now → No thanks, just take me to the downloads** flow:
https://chilllands.itch.io/ashen-marches

Only the free GLB download and its separate license were requested. No purchase,
paid archive, account credential, or unofficial mirror was used. The full 1,200
model pack is not included. None of the sampler's animals, creatures, scenery or
props are installed by this army import.

The complete unmodified license is at
`public/models/ashen/AshenMarches_LICENSE.txt` (itch.io license version 2.0,
9 October 2026). It permits modification and royalty-free use in personal and
commercial finished projects, distribution incorporated in those projects
(including compiled builds and engine-packed data), and project source sharing
with collaborators. It prohibits distributing original or modified files as
standalone assets, source packs, stock, competing libraries, or asset templates.
No attribution is required; Ironvale nevertheless credits ChillLands. These
runtime game dependencies must remain part of Ironvale, and must not be offered
as a separately downloadable asset collection. The original free archive and
unused source files remain in the ignored `.art-source/` directory.

The license explicitly covers the Free 100 and Free 12 editions. The bundled notice matches the free archive's license. The author discloses an AI-assisted procedural
Blender workflow with subsequent inspection and revision.

## Shipped game-specific subset

All paths below are relative to `public/models/ashen/`. Character GLBs retain
the author's original animation clips and rigs, but their palette image is
replaced with baked linear vertex colors and separately assigned cloth, skin,
leather/trim and metal material islands. This permits saturated city colors on
whole garments while keeping natural skin, leather boots, hair, straps and metal.
The heavy cavalry helmet uses cool iron vertex colors to distinguish it from timber. The source model IDs are also recorded in each GLB's asset metadata.

| Ironvale file | Original source ID | Game use |
| --- | --- | --- |
| `apothecary.glb` | `dun_huma_apothecary` | Civilian outfit 1 |
| `falconer.glb` | `dun_huma_falconer` | Civilian outfit 2 |
| `alchemist.glb` | `nth_huma_alchemist` | Civilian outfit 3 |
| `guard.glb` | `gth_huma_march_guard` | Swordsman, spearman, cavalry rider |
| `marshal.glb` | `nth_huma_castle_marshal` | Pikeman, heavy cavalry rider |
| `ranger.glb` | `nth_huma_ranger` | Archer, scout rider |
| `executioner.glb` | `dun_huma_royal_executioner` | Crossbowman |
| `sword.glb` | `gth_equi_arming_sword` | Sword infantry and cavalry |
| `shield.glb` | `gth_equi_heater_shield` | Sword infantry and cavalry |
| `kite.glb` | `gth_equi_kite_shield` | Pikeman and heavy cavalry |
| `pike.glb` | `nth_equi_pike` | Pikeman |
| `helm.glb` | `dun_equi_great_helm` | Heavy cavalry |

City cloth uses the same eight `COLORS` entries as cities and the interface.
Civilian variants are bounded by entity ID modulo three. Military silhouettes
vary by class: helmet and shield infantry, taller marshal with pike/kite shield,
hooded bowman with visible bow/string/arrow, bare-arm crossbowman, lightly equipped
mounted scout, sword-and-shield cavalry, and lance/kite-shield/helmet heavy cavalry.
Some weapons and all saddle equipment are original simple Ironvale geometry.

## Existing horse and wildlife

Mounted units reuse `public/models/horse.glb`, the previously installed CC0
Quaternius animal model. Its original appearance and materials are retained.
See `public/models/animals-license.txt` and `public/models/manifest.json` for its
existing provenance. No deer, cow, alpaca or fox model or texture was changed.

Mounted horse and rider are baked facing **positive Z**, matching the human unit
heading convention. Wildlife remains **positive X**, matching its existing
battlefield heading offset. The horse is grounded per animation sample. Its
animated torso provides the saddle position; rider thighs spread around the
horse, knees bend, feet remain above the ground, and arms reach toward the reins.
Saddle cloth, leather seat, stirrups and reins are part of the mounted composition.

## Reproduction and verification

With an authorized local copy of the FREE 100 GLB archive extracted, run:

```text
python scripts/prepare-army-assets.py path/to/AshenMarches_Free100_GLB
```

Pillow is required. This script never downloads or purchases anything. It installs
only the twelve listed runtime model dependencies and the exact bundled license.

`tests/imported-models3d.test.ts` parses the actual shipped meshes and checks
finite poses, substantial garment coverage in every city, unchanged skin across
owners, distinct class bodies, civilian variants, visible readied ranged weapons,
mounted grounding/orientation/seating throughout the gallop, bounded full/crowd
banks, no per-entity rigs, and disposal of horse geometry and city materials.
The game's normal loader uses the GLBs directly; no external asset host is needed.

All pose sampling, skeletal changes and equipment assembly occur once during
loading, yielding between shared banks so menu input and navigation remain responsive. Leaving a screen cancels the remaining preparation and releases partial banks. Entities share finite geometry banks and eight shared city materials;
lookup creates no meshes, skeletons, mixers or geometry. Wildlife banks continue
to use the original code path and materials.
