# Kingdom Lanka: kingdoms and legends

Ironvale is renamed **Kingdom Lanka** in the game, browser title, online lobby,
production launcher and package metadata. The existing workspace folder, browser
save database, guest preferences and reconnect keys stay compatible. Existing
saved matches remain playable with their original neutral rules.

The player's new request authorizes the faction overhaul. This is a cross-era
skirmish drawing on Sri Lankan history and legend, rather than a chronological
campaign or a claim to reconstruct every army exactly. Historical factions and
Ravana are visibly distinguished in setup. No ethnic group receives moral or
biological superiority; specialties are bounded game rules, not historical facts.

## Playable roster

All factions retain foundational workers, horse scouts, cavalry, infantry and
siege options. Special troops require the owning faction, building, age,
resources, training time and population reservations.

| Faction | Signature troops and specialties |
| --- | --- |
| Anuradhapura | War elephants with 10% more HP; Yodha champions inspired by the epic warrior tradition |
| Polonnaruwa | War elephants; farms cost 20% less wood; buildings with a stone cost construct 15% faster |
| Kandy | War elephants and musketeers; towers and fortresses have 15% more HP |
| Chola | War elephants; spear and pike infantry gain 15% attack |
| Elara | War elephants; spear, pike and sword infantry gain one armor |
| Jaffna | War elephants; archers/crossbows gain 10% attack; market returns 75 per 100 |
| Portuguese | Musketeers and cannon; fortresses have 20% more HP |
| Dutch | Musketeers and cannon; markets cost 20% less wood; market returns 80 per 100 |
| British | Musketeers, riflemen and cannon |
| Ravana · Legendary | War elephants, Rakshasa giants and Dandu Monara flying craft |

Riflemen occupy two population, elephants and cannon four, and flying craft eight.
Firearms have a slower two-second attack cycle; cannon take 3.5 seconds and are
strong against buildings but weak against individual troops. Spears/pikes
counter elephants; mounted units counter firearm infantry. Dandu can cross
water and mountain terrain but cannot gather, garrison or occupy capitals.
Ranged troops can attack it, including height-aware mountain interception.
Its high resource cost and 90-second training time apply to AI and humans alike.

Solo AI factions are varied and deterministic from the seed. An explicit legacy
match with no faction remains neutral. In multiplayer, each person chooses their
own faction before starting. A faction change clears readiness but keeps the
voice connection; it cannot change another player's faction or alter a live game.
Factions persist through saves, matchmaking, refresh, AI takeover and checkpoints.

## Art and interface

The army provider uses selective native 0 A.D. regional tunics, heads, shields,
equipment, Asian elephant geometry and sampled animation clips. Original
headwear, firearm equipment, cannon and peacock-inspired craft distinguish the
factions. Ten city adornment variants are grouped into Lankan, Dravidian,
colonial and legendary families and layer over the approved functional buildings.
Connected wall/gate geometry is preserved. Each city retains its ownership color.

The menu and lobby show readable faction choices and specialty descriptions.
The command panel uses the same effective costs/stats as the authoritative
simulation. Population costs are explicit. Native unit and capital portraits
render from the actual game providers rather than generic placeholders. A
scrollable kingdom guide is available in Help.

Assets remain local. Shared sampled poses and original instanced ornament banks
replace per-unit skeletons. Faction-enabled views load the regional bank; legacy
views load the earlier bank. Mixed matches may load both. Landscape and animal
providers remain shared and retain their existing behavior.

## Preserved modes and limitations

Server-authoritative multiplayer, uneven teams of at most four, separate
resources, shared allied scouting, no friendly fire, open/team voice channels,
mute controls, optional neutral night zombies, day/night, weather, map generation,
worker task resumption and building management remain part of the game.

This is a substantial playable faction update, not a complete 0 A.D. engine port,
a historically exact simulator or evidence that the game exceeds Age of Empires
in overall production quality. Dandu is a ranged aircraft, not a transport system.
Naval battles, historical campaigns, faction-specific technology trees and exact
period uniforms are not implemented by this update.

## Research basis

The following primary institutional sources informed the roster and visual
direction. Their historical descriptions do not establish the numerical bonuses
above; those are original gameplay choices.

- [Central Cultural Fund: Tissamaharama](https://ccf.gov.lk/heritage-sites/tissamaharama/)
  identifies the southern Ruhuna center and its association with Dutugemunu's
  campaign against Elara. The game keeps the ancient Anuradhapura/Elara themes
  separate from the much later medieval Chola faction.
- [Central Cultural Fund: Polonnaruwa](https://ccf.gov.lk/heritage-sites/polonnaruwa/)
  describes the medieval capital, Chola occupation, irrigation and agricultural
  development. Those themes inform construction/farm specialties.
- [Rijksmuseum: restitution research](https://www.rijksmuseum.nl/en/research/our-research/overarching/provenance-research-colonial-collections/restitution)
  records Kandyan swords, firearms and Lewke's cannon seized in 1765. Kandy's
  firearm infantry therefore draws on its own weapons tradition rather than
  treating firearms as exclusively European.
- [Galle Heritage Foundation: military galleries](https://galleheritage.gov.lk/display-galleries/)
  distinguishes Portuguese, Dutch and British military phases and their
  gunpowder fortifications. [UNESCO's Galle entry](https://whc.unesco.org/en/list/451/)
  supports the colonial urban-architecture direction.
- [Sri Lanka National Archives: 1815 Convention](https://archives.gov.lk/online-exhibits/path-to-freedom/1-1815-convention)
  distinguishes successive coastal administrations and the later transfer of
  Kandyan sovereignty, rather than collapsing all of them into an ancient era.
- [Sri Lanka Tourism: Ravana](https://www.srilanka.travel/ravana) and its
  [Ramayana places guide](https://www.srilanka.travel/ramayanaya/places.php)
  explicitly frame the ruler and flying-peacock traditions as legend. The game
  follows that framing; oversized Rakshasa warriors are fantasy interpretations.

0 A.D. art and modified derivatives retain Wildfire Games attribution, source
hashes, original notices and CC BY-SA 3.0 terms. Original gameplay code integrates
the rules with the existing server and modes; required notices are not removed.
