# Kingdom Lanka regional art pack

This local game-art interpretation combines the actual 0 A.D. Asian elephant,
Mauryan short tunics, regional heads, face textures, shields and weapon meshes
with finite native skeletal pose samples. It is **not a faithful historical
reconstruction** of Sri Lankan dress, armies, monuments, or legendary machines.
Mauryan artwork supplies a regional visual starting point rather than evidence
that those precise garments were worn by the named factions.

0 A.D. artwork is by Wildfire Games and its art contributors, copyright its
respective authors, licensed **CC BY-SA 3.0 Unported**. The derived binary pose
bank and converted PNG textures retain that license. `SOURCE-LICENSE.txt`
preserves the original notice; `LICENSE.txt` states attribution and licensing;
`manifest.json` enumerates all pinned source paths, URLs, SHA-256 hashes, and
changes. The immutable source revision is
`61a3b9507d974084e6badb88a0826bd89a6d5b8b`. No 0 A.D. engine code is included.

Rebuild from the project root with `python scripts/prepare-lanka-characters.py`.
Python, NumPy and Pillow are required. `--offline` rebuilds only from the local
`.cache/historical/source` inputs and fails if an original is missing. Source
recipes, authored meshes and skeletal clips are converted offline; runtime
assets are bundled here and need no external service.

Original equipment/headwear in `src/render/lanka-models3d.ts` and city ornaments
in `src/render/lanka-architecture3d.ts` are separately authored geometry in this
project. Firearms have long metal barrels, wooden stocks and locks; riflemen
add bayonets and cartridge pouches. Cannons have two open spoked wheels, carriage,
barrel and muzzle. Ravana's champion is deliberately legendary and oversized;
the Anuradhapura Yodha is an elite human. The original Dandu Monara is a clearly
legendary peacock-inspired winged craft. Its geometry is centered near ground
level; the battlefield supplies its flight height, allowing shared death and
terrain placement logic.

City ornament families are Lankan (dagoba crowns / Kandy tile roofs), Dravidian
(tiered gopuram-like crowns), colonial (Portuguese bell gable, Dutch stepped
gable, British clock turret), and legendary (winged gold citadel crowns). The
approved building foundations, role-specific structures, wall connections,
opening gates, footprints and simulation functions remain provided by the
original building renderer. Cloth accents use the owning city's color.
