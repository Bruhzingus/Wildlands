# Kanto asset coverage

Reproduce with `npm run assets:sync` and `npm run assets:audit`. This report validates actual files, not just manifest names. Generated fallback visibility is provided by code for all 151 IDs. Browser rendering requires separate verification with `npm run test:browser`.

- species: 151
- staticArtwork: 151
- metadata: 151
- credits: 151
- idle: 151
- walk: 151
- attack: 151
- generatedFallback: 151

PMD timing follows [the source format](https://wiki.pmdo.pmdcollab.org/PMD_Sprite_Format): durations are 1/60 second; sheets may contain one or eight direction rows. Aliases refer to the original named sheet. Creator attribution and per-image source URLs are in [asset-attributions.json](../public/assets/asset-attributions.json); raw contributor records are mirrored alongside each species and the creator directory. Official Pokemon assets retain their original rights holders.

| ID | Species | Art | Idle | Walk | Attack | Credits |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Bulbasaur | yes | 3f / 8 dirs (Idle) | 6f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 2 | Ivysaur | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 9f / 8 dirs (Attack) | yes |
| 3 | Venusaur | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 4 | Charmander | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 5 | Charmeleon | yes | 6f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 6 | Charizard | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 7 | Squirtle | yes | 8f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 8 | Wartortle | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 9 | Blastoise | yes | 8f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 10 | Caterpie | yes | 10f / 8 dirs (Idle) | 3f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 11 | Metapod | yes | 4f / 8 dirs (Idle) | 10f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 12 | Butterfree | yes | 4f / 8 dirs (Idle) | 12f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 13 | Weedle | yes | 4f / 8 dirs (Idle) | 3f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 14 | Kakuna | yes | 6f / 8 dirs (Idle) | 5f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 15 | Beedrill | yes | 4f / 8 dirs (Walk) | 4f / 8 dirs (Walk) | 18f / 8 dirs (Attack) | yes |
| 16 | Pidgey | yes | 5f / 8 dirs (Idle) | 5f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 17 | Pidgeotto | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 18 | Pidgeot | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 19 | Rattata | yes | 8f / 8 dirs (Idle) | 7f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 20 | Raticate | yes | 6f / 8 dirs (Idle) | 6f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 21 | Spearow | yes | 6f / 8 dirs (Idle) | 5f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 22 | Fearow | yes | 10f / 8 dirs (Idle) | 6f / 8 dirs (Walk) | 15f / 8 dirs (Attack) | yes |
| 23 | Ekans | yes | 2f / 8 dirs (Idle) | 6f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 24 | Arbok | yes | 2f / 8 dirs (Idle) | 6f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 25 | Pikachu | yes | 6f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 26 | Raichu | yes | 6f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 27 | Sandshrew | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 28 | Sandslash | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 29 | Nidoran♀ | yes | 5f / 8 dirs (Idle) | 7f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 30 | Nidorina | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 31 | Nidoqueen | yes | 5f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 9f / 8 dirs (Attack) | yes |
| 32 | Nidoran♂ | yes | 5f / 8 dirs (Idle) | 6f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 33 | Nidorino | yes | 10f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 34 | Nidoking | yes | 2f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 35 | Clefairy | yes | 6f / 8 dirs (Idle) | 8f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 36 | Clefable | yes | 6f / 8 dirs (Idle) | 8f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 37 | Vulpix | yes | 4f / 8 dirs (Idle) | 5f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 38 | Ninetales | yes | 14f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 9f / 8 dirs (Attack) | yes |
| 39 | Jigglypuff | yes | 5f / 8 dirs (Idle) | 5f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 40 | Wigglytuff | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 41 | Zubat | yes | 8f / 8 dirs (Idle) | 8f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 42 | Golbat | yes | 4f / 8 dirs (Idle) | 8f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 43 | Oddish | yes | 5f / 8 dirs (Idle) | 8f / 8 dirs (Walk) | 15f / 8 dirs (Attack) | yes |
| 44 | Gloom | yes | 5f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 15f / 8 dirs (Attack) | yes |
| 45 | Vileplume | yes | 12f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 15f / 8 dirs (Attack) | yes |
| 46 | Paras | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 47 | Parasect | yes | 3f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 19f / 8 dirs (Attack) | yes |
| 48 | Venonat | yes | 2f / 8 dirs (Idle) | 5f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 49 | Venomoth | yes | 8f / 8 dirs (Idle) | 12f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 50 | Diglett | yes | 2f / 8 dirs (Idle) | 3f / 8 dirs (Walk) | 9f / 8 dirs (Attack) | yes |
| 51 | Dugtrio | yes | 2f / 8 dirs (Idle) | 3f / 8 dirs (Walk) | 9f / 8 dirs (Attack) | yes |
| 52 | Meowth | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 53 | Persian | yes | 1f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 16f / 8 dirs (Attack) | yes |
| 54 | Psyduck | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 55 | Golduck | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 56 | Mankey | yes | 5f / 8 dirs (Idle) | 8f / 8 dirs (Walk) | 15f / 8 dirs (Attack) | yes |
| 57 | Primeape | yes | 8f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 58 | Growlithe | yes | 3f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 59 | Arcanine | yes | 1f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 60 | Poliwag | yes | 8f / 8 dirs (Idle) | 5f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 61 | Poliwhirl | yes | 5f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 62 | Poliwrath | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 63 | Abra | yes | 6f / 8 dirs (Idle) | 8f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 64 | Kadabra | yes | 9f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 65 | Alakazam | yes | 8f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 66 | Machop | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 67 | Machoke | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 68 | Machamp | yes | 10f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 69 | Bellsprout | yes | 2f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 70 | Weepinbell | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 71 | Victreebel | yes | 9f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 72 | Tentacool | yes | 7f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 73 | Tentacruel | yes | 7f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 74 | Geodude | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 75 | Graveler | yes | 14f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 76 | Golem | yes | 2f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 15f / 8 dirs (Attack) | yes |
| 77 | Ponyta | yes | 14f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 78 | Rapidash | yes | 14f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 79 | Slowpoke | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 80 | Slowbro | yes | 2f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 18f / 8 dirs (Attack) | yes |
| 81 | Magnemite | yes | 4f / 8 dirs (Idle) | 6f / 8 dirs (Walk) | 19f / 8 dirs (Attack) | yes |
| 82 | Magneton | yes | 4f / 8 dirs (Idle) | 8f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 83 | Farfetch'd | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 84 | Doduo | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 85 | Dodrio | yes | 6f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 86 | Seel | yes | 2f / 8 dirs (Idle) | 7f / 8 dirs (Walk) | 12f / 8 dirs (Attack) | yes |
| 87 | Dewgong | yes | 6f / 8 dirs (Idle) | 7f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 88 | Grimer | yes | 4f / 8 dirs (Idle) | 6f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 89 | Muk | yes | 4f / 8 dirs (Idle) | 5f / 8 dirs (Walk) | 12f / 8 dirs (Attack) | yes |
| 90 | Shellder | yes | 4f / 8 dirs (Idle) | 6f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 91 | Cloyster | yes | 6f / 8 dirs (Idle) | 6f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 92 | Gastly | yes | 6f / 8 dirs (Idle) | 12f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 93 | Haunter | yes | 4f / 8 dirs (Idle) | 10f / 8 dirs (Walk) | 12f / 8 dirs (Attack) | yes |
| 94 | Gengar | yes | 8f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 95 | Onix | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 96 | Drowzee | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 12f / 8 dirs (Attack) | yes |
| 97 | Hypno | yes | 8f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 98 | Krabby | yes | 2f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 16f / 8 dirs (Attack) | yes |
| 99 | Kingler | yes | 2f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 16f / 8 dirs (Attack) | yes |
| 100 | Voltorb | yes | 5f / 8 dirs (Idle) | 8f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 101 | Electrode | yes | 4f / 8 dirs (Idle) | 7f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 102 | Exeggcute | yes | 6f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 103 | Exeggutor | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 104 | Cubone | yes | 6f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 105 | Marowak | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 9f / 8 dirs (Attack) | yes |
| 106 | Hitmonlee | yes | 2f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 107 | Hitmonchan | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 108 | Lickitung | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 109 | Koffing | yes | 6f / 8 dirs (Idle) | 10f / 8 dirs (Walk) | 15f / 8 dirs (Attack) | yes |
| 110 | Weezing | yes | 11f / 8 dirs (Idle) | 6f / 8 dirs (Walk) | 12f / 8 dirs (Attack) | yes |
| 111 | Rhyhorn | yes | 3f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 112 | Rhydon | yes | 2f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 113 | Chansey | yes | 6f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 114 | Tangela | yes | 4f / 8 dirs (Idle) | 6f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 115 | Kangaskhan | yes | 5f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 116 | Horsea | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 117 | Seadra | yes | 8f / 8 dirs (Idle) | 5f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 118 | Goldeen | yes | 15f / 8 dirs (Idle) | 8f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 119 | Seaking | yes | 15f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 120 | Staryu | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 15f / 8 dirs (Attack) | yes |
| 121 | Starmie | yes | 8f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 15f / 8 dirs (Attack) | yes |
| 122 | Mr. Mime | yes | 2f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 123 | Scyther | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 124 | Jynx | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 125 | Electabuzz | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 126 | Magmar | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 127 | Pinsir | yes | 5f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 128 | Tauros | yes | 5f / 8 dirs (Idle) | 7f / 8 dirs (Walk) | 12f / 8 dirs (Attack) | yes |
| 129 | Magikarp | yes | 4f / 8 dirs (Idle) | 7f / 8 dirs (Walk) | 15f / 8 dirs (Attack) | yes |
| 130 | Gyarados | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 131 | Lapras | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 12f / 8 dirs (Attack) | yes |
| 132 | Ditto | yes | 2f / 8 dirs (Idle) | 5f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 133 | Eevee | yes | 2f / 8 dirs (Idle) | 7f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 134 | Vaporeon | yes | 2f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 135 | Jolteon | yes | 2f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 136 | Flareon | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 137 | Porygon | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 138 | Omanyte | yes | 2f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 139 | Omastar | yes | 2f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 140 | Kabuto | yes | 3f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 141 | Kabutops | yes | 4f / 8 dirs (Idle) | 8f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 142 | Aerodactyl | yes | 8f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 143 | Snorlax | yes | 6f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 144 | Articuno | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 145 | Zapdos | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 146 | Moltres | yes | 4f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
| 147 | Dratini | yes | 4f / 8 dirs (Idle) | 5f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 148 | Dragonair | yes | 7f / 8 dirs (Walk) | 7f / 8 dirs (Walk) | 10f / 8 dirs (Attack) | yes |
| 149 | Dragonite | yes | 7f / 8 dirs (Idle) | 4f / 8 dirs (Walk) | 13f / 8 dirs (Attack) | yes |
| 150 | Mewtwo | yes | 8f / 8 dirs (Idle) | 6f / 8 dirs (Walk) | 11f / 8 dirs (Attack) | yes |
| 151 | Mew | yes | 4f / 8 dirs (Idle) | 6f / 8 dirs (Walk) | 14f / 8 dirs (Attack) | yes |
