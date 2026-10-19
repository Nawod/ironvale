# Historical character artwork

Artwork by **Wildfire Games and the 0 A.D. art contributors**:
https://www.wildfiregames.com/ · https://play0ad.com/

The source artwork and these converted textures / sampled pose derivatives are
licensed **CC BY-SA 3.0 Unported**:
https://creativecommons.org/licenses/by-sa/3.0/
See `SOURCE-LICENSE.txt`, `LICENSE.txt` and `manifest.json`.

This selective pack uses Celtic pants, tunics, long-haired heads, oval shields,
swords and spear parts, a Montefortino helmet, Greek short tunics, bows and arrows,
and a native sarissa. These are custom Ironvale actor assemblies rather than
claims that every assembled outfit reproduces one original 0 A.D. actor.

Four classes have native idle, walk and attack skeletal clips sampled to eight
shared frames: spearman, swordsman, archer and pikeman. Each has three deterministic
clothing / face variants. Original alpha masks apply the eight city colors to
authored cloth and shield islands while retaining skin, hair and equipment art.
Crowd rendering reuses two phases from each original eight-frame cycle to limit
draw batches, retaining the same geometry, outfit variations and city materials.
No 0 A.D. engine code or runtime service is used.

Rebuild from the pinned sources with:

    python scripts/prepare-historical-characters.py

Requires Python, numpy and Pillow. `--offline` rebuilds from the local download
cache and rejects missing sources. The binary bank, manifest and PNG maps are
bundled locally. Gameplay lookups allocate no rigs, mixers, geometry or materials.
