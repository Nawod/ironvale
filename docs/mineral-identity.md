# Recognizable mineral deposits

Gold uses a substantial dark grey angular outcrop with bright exposed golden
seams, darker ochre fragments and irregular warm loose scree around its foot.
Stone remains cool grey, with the existing moss variants retained. These are
opaque physical parts of the scenery and remain subject to existing fog and
mesh picking.

The installed `public/models/realm/Resource_Gold_1.glb` remains the imported
core. Its existing Quaternius CC0 attribution and source record are retained in
`public/models/realm/manifest.json` and `THIRD_PARTY_ASSETS.md`. Inspection of
that local GLB found 1,071 rock vertices and 189 ore vertices; the original ore
base color was dark brown, which made the small fitted deposit difficult to
distinguish from ordinary rock.

The additional angular host stones, exposed seams, nuggets and loose fragments
are original geometry authored in `createGoldDeposit` in
`src/render/models3d.ts`. No downloaded model, texture, engine code or new
third-party asset was added. The imported source geometry is folded into four
shared material batches with the additions. The loading fallback uses the same
original assembly. Ownership stays with each model library, including disposal
of generated geometries and materials.

Focused automated checks cover the gold footprint and vertical silhouette,
grounding, bright ore surface coverage with exposed dark host rock, low scree,
cool stone contrast, and visible ore from four camera directions at 0.65 zoom.
Ray tests also confirm entity picking. Repeated gold requests across 1,000
entities reuse the same imported assembly and do not grow its cache. These
checks do not replace an in-game browser review under the final scene lighting.
