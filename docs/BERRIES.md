# Berry trees

Sixteen seeded scenery trees per run are marked on the minimap. Each carries one berry type, drops one to three fruit (one is most likely), and changes to a different type after three active game minutes only when the player is at least 12 world units away. The previous fruit disappears at that change. Collecting a fruit does not cause another drop during the same variant. Fruit can fall again after the next change.

Each berry tree uses an overlapping tapered trunk, wide lower canopy, and smaller upper canopy. Both foliage layers and the trunk use a muted palette keyed to the active berry type, while five brighter berries sit partly inside the canopy edge. This keeps the model visually attached as it rotates types without changing its gameplay collider.

| Initial roll | Berry | Wildlands pickup | Pokemon reference |
| --- | --- | --- | --- |
| Common (52%) | Oran | Restore 10 leader HP over 20 seconds | [Oran Berry](https://bulbapedia.bulbagarden.net/wiki/Oran_Berry) restores 10 HP in core games |
| Uncommon (26%) | Leppa | -20% special cooldown for 20 seconds | [Leppa Berry](https://bulbapedia.bulbagarden.net/wiki/Leppa_Berry) restores PP |
| Scarce (14%) | Sitrus | Restore 25% leader max HP over 20 seconds | [Sitrus Berry](https://bulbapedia.bulbagarden.net/wiki/Sitrus_Berry) restores 25% max HP in later core games |
| Rare (6%) | Pinap | +50% XP for 20 seconds | [Pinap Berry](https://bulbapedia.bulbagarden.net/wiki/Pinap_Berry_(GO)) doubles Candy rewards in Pokemon GO; timed XP is a Wildlands adaptation |
| Very rare (2%) | Silver Pinap | +50% XP for 20 seconds, plus 25 immediate XP | [Silver Pinap Berry](https://bulbapedia.bulbagarden.net/wiki/Silver_Pinap_Berry_(GO)) grants more Candy and a catch bonus in Pokemon GO; XP is a Wildlands adaptation |

Every berry adds an independent 20-second stack. Oran and Sitrus recovery, Leppa's cooldown reduction, and Pinap XP bonuses add per active stack. Famine blocks Oran and Sitrus recovery stacks while still allowing Leppa and XP stacks. When a tree rotates, its current type is excluded from that roll, so rotation chances differ from the initial percentages.
