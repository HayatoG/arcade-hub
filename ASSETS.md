# 📦 Catálogo de Assets — KEPLER ARCADE

> **Fonte:** Kenney Game Assets All-in-1 v3.5.0 ([kenney.nl](https://kenney.nl)) · **Licença CC0** — uso livre, comercial inclusive, sem obrigação de crédito (mas a gente credita porque é educado).
> **Onde fica:** pasta `Kenney Game Assets All-in-1 3.5.0/` ao lado deste repositório (não versionada — são ~GB de arquivos).
> **Varredura:** 10/06/2026, direto do sistema de arquivos.

## Números gerais

| Categoria | Pacotes | Arquivos |
|---|---:|---:|
| 🧊 Assets 3D | 52 kits | **4.885 modelos GLB** (+ FBX e OBJ de cada um) |
| 🟦 Assets 2D | 151 packs | **37.516 sprites PNG** (+ vetores) |
| 🔊 Áudio | 16 packs | **1.286 sons OGG** |
| 🖱️ UI | 10 packs | ~4.700 PNGs + ~1.700 SVGs |
| 🎮 Ícones & prompts | 8 packs | ~9.600 imagens |
| 🔤 Fontes | 16 famílias TTF | + webfonts (woff/woff2) |
| 📼 Archive (legado) | 16 packs | versões antigas de kits |
| 🧪 Early access | 2 packs | Medieval Weapons, Racing Kit |

**Regras práticas dos kits 3D** (aprendidas construindo os jogos):

- Use sempre a pasta **`Models/GLB format/`** — é o formato que os jogos do hub carregam via GLTFLoader.
- As peças de cenário **encaixam em grade de 1 unidade** (pistas, estradas, trilhos, masmorras).
- Copie junto a subpasta **`Textures/`** do kit — alguns GLB referenciam o `colormap.png` externo.
- Cuidado com peças assimétricas (rampas!): podem ter face vertical de um lado — teste a orientação (`rotation.y = r·π/2`).
- Os **personagens animados** (Graveyard, Mini Dungeon e afins) compartilham o mesmo rig com estes clipes verificados em jogo: `static, idle, walk, sprint, jump, fall, crouch, sit, drive, die, pick-up, emote-yes/no, holding-right/left/both(+shoot), attack-melee-right/left, attack-kick-right/left, interact-right/left, wheelchair-*`. Armas anexam no nó `arm-right`.

---

## 🧊 Assets 3D — 52 kits

### Personagens & criaturas

| Kit | GLB | O que tem | Dá pra fazer |
|---|---:|---|---|
| Blocky Characters | 18 | 16 civis/soldados + texturas trocáveis (usa `Textures/` externa) | exército, multidões — são os soldados do Maré Vermelha |
| Mini Characters | 26 | 12 civis (m/f) + acessórios de acessibilidade (cadeira de rodas, bengala, óculos) | NPCs de cidade, jogos inclusivos |
| Cube Pets | 24 | bichos cúbicos: pinto, gato, cão, pinguim, coelho, raposa, panda, leão, elefante… | mascotes desbloqueáveis (são os bichos da Travessia) |
| Animated Characters Bundle | 0 (62 FBX) | personagens riggados + acessórios (mochila/capacete astro, barba, boné) e clipes de animação | ⚠️ só FBX — converter p/ GLB antes de usar na web |
| Animated Characters Protagonists / Retro / Survivors | 0 (4 FBX cada) | 1 personagem + idle/jump/run | idem ⚠️ |
| *(embutidos em outros kits)* | — | Graveyard: **fantasma, esqueleto, vampiro, zumbi, guardião** (animados ✔ usados no Bastião 3D e Profundezas) · Mini Dungeon: **humano, orc** (animados ✔) · Space Kit: 2 astronautas + alien · Mini Arcade/Market/Skate/Arena: 1–2 cada | inimigos e heróis prontos para jogos de ação |

### Fantasia, masmorra & terror

| Kit | GLB | O que tem | Dá pra fazer |
|---|---:|---|---|
| Fantasy Town Kit | 167 | vila medieval completa: casas, muros, carroças, bandeiras, chaminés | cidade-hub de RPG, vila de comércio |
| Retro Fantasy Kit | 160 | castelo retrô low-poly: ameias, colunas, barris | dungeon crawler old-school |
| Graveyard Kit | 91 | lápides, criptas, cercas, abóboras, lanternas + 5 personagens animados | survival horror, Halloween — base do Bastião 3D |
| Castle Kit | 76 | castelo modular: pontes levadiças, portões, torres, terreno | cerco a castelo, defesa medieval |
| Modular Dungeon Kit | 39 | corredores/salas modulares grandes (peças pesadas, 0,4–0,9 MB) | masmorra em primeira pessoa estilo Legend of Grimrock |
| Mini Dungeon | 25 | piso/paredes/baú/moeda/armadilha/portão + humano e orc animados | roguelite de salas — é a base do **Profundezas** |
| Mini Arena | 22 | arena de combate compacta + soldado | brawler de arena, autobattler |

### Cidade & urbano

| Kit | GLB | O que tem | Dá pra fazer |
|---|---:|---|---|
| Retro Urban Kit | 124 | prédios retrô, becos, escadas de incêndio, barreiras | beat 'em up urbano, cenário de skate |
| Modular Buildings | 108 | prédios por andar/janela/quina — altura livre | cidade procedural, jogo de demolição |
| Building Kit | 79 | blocos de construção com barricadas | cenário pós-apocalíptico |
| City Kit – Roads | 72 | estradas em grade: retas, curvas, cruzamentos, pontes, postes | malha viária — é a estrada da **Travessia** |
| City Kit – Commercial | 41 | prédios comerciais a–z | centro da cidade |
| City Kit – Suburban | 40 | casas suburbanas | bairro residencial |
| City Kit – Industrial | 25 | galpões e fábricas | zona industrial |
| Mini Market | 20 | mercadinho: caixa, prateleiras, freezers + 2 personagens | simulador de mercado, hide & seek |
| Furniture Kit | 140 | mobília completa de casa (banheiro a quarto) | sims de interior, escape room |
| Food Kit | 200 | comidas: frutas, bacon, garrafas, sacolas… | **jogo de cozinha estilo Overcooked** |

### Natureza & exterior

| Kit | GLB | O que tem | Dá pra fazer |
|---|---:|---|---|
| Nature Kit | 329 | o maior kit: árvores, pedras, pontes, rios, cercas, plantações | qualquer mundo aberto low-poly — árvores da Travessia e do Turbo Rush |
| Nature Kit (Classic) | 0 (232 FBX) | versão antiga ⚠️ só FBX | use o Nature Kit novo |
| Survival Kit | 80 | acampamento: fogueira, barracas, caixas, ferramentas | sobrevivência, crafting (A Short Hike vibes) |
| Holiday Kit | 99 | cabanas de neve, trenós, decoração natalina | jogo de Natal, esqui |
| Hexagon Kit | 72 | tiles hexagonais com construções (fazenda, mina, porto, castelo) | **city builder estilo Dorfromantik** ou 4X |

### Pirata, água & espaço

| Kit | GLB | O que tem | Dá pra fazer |
|---|---:|---|---|
| Pirate Kit | 72 | 8 navios (inclusive fantasma!), canhões, ilhas, palmeiras, fortes, baús | combate naval — é a base do **Corsário** |
| Watercraft Pack | 46 | barcos civis: vela, pesca, casa-flutuante, lanchas | regata, pesca, travessia de rio |
| Space Kit | 153 | base lunar: corredores, rovers, astronautas, alien, foguetes | exploração espacial, base builder |
| Space Station Kit | 177 | interior de estação: camas, painéis, varandas | **Among Us 3D / FTL** — sabotagem em estação |
| Modular Space Kit | 40 | corredores espaciais modulares | nave procedural, roguelite sci-fi |
| Blaster Kit | 40 | 26 armas sci-fi (blaster-a…z) + acessórios | arsenal para shooter espacial |

### Veículos, pistas & esportes

| Kit | GLB | O que tem | Dá pra fazer |
|---|---:|---|---|
| Road Pack | 294 | tiles de pista de corrida (tile000–293) | circuitos fechados grandes |
| Coaster Kit | 183 | **montanha-russa completa**: trilhos, loopings, flumes d'água, carrinhos, bilheteria | tycoon de parque ou runner sobre trilhos 🎢 |
| Marble Kit | 162 | pistas de bolinha de gude: curvas, funis, loopings, bandeiras | **Marble Blast / Switchball** — corrida de bolinha |
| Toy Car Kit | 157 | pista de autorama + **itens estilo Mario Kart** (banana! moedas! cones!) | **kart com itens** 🍌 |
| Platformer Kit | 153 | plataformas de grama, alavancas, moedas, espinhos | **plataforma 3D collectathon** |
| Prototype Kit | 145 | blocos neutros + botões de chão + 3 animais | greybox de qualquer protótipo |
| Factory Kit | 143 | esteiras, caixas, braços, botões | **puzzle de automação / sokoban industrial** |
| Minigolf Kit | 126 | 126 peças de minigolfe: rampas, moinho, túneis, splines com looping | é a base do **Golfe Maluco** (ainda sobram as peças spline!) |
| Racing Kit | 112 | pista de corrida: barreiras, arquibancada, outdoors, câmeras | corrida arcade — é a base do **Turbo Rush** |
| Train Kit | 103 | ferrovias completas + trens | tycoon ferroviário, puzzle de desvios — trilhos da **Travessia** |
| Tower Defense Kit | 160 | torres, **UFOs inimigos com armas**, cristais, tiles | tower defense 3D completo |
| Tower Defense (Classic) | 119 | versão antiga em tiles | idem, visual mais simples |
| Car Kit | 50 | carros civis + **peças de destroço** (portas, para-choques, pneus) | tráfego (Travessia/Turbo Rush) + crashes com debris |
| Mini Skate | 20 | half-pipe, bowl, corrimãos + skatistas | **Tony Hawk de bolso** 🛹 |
| Mini Arcade | 20 | fliperama: máquinas de arcade, pinball, garra, air hockey | um fliperama DENTRO do Kepler Arcade (meta!) |
| Brick Kit | 296 | tijolos estilo LEGO (1x1 a 2x8, rampas, quinas) | construção livre, física de demolição |
| Weapon Pack | 37 | armas modernas: pistola, uzi, shotgun, lança-foguetes + munições | já equipam Maré Vermelha e Bastião 3D |

---

## 🔊 Áudio — 16 packs, 1.286 sons OGG

| Pack | Sons | Conteúdo | Uso típico |
|---|---:|---|---|
| Music Loops | 29 | **trilhas completas em loop**: Infinite Descent, Drumming Sticks, Polka Train, Wacky Waiting… | música de fundo — todos os jogos do hub usam estas |
| Music Jingles | 85 | vinhetas curtas de vitória/derrota (versões normal e retrô) | fanfarra de conquista (birdie do Golfe) |
| Impact Sounds | 130 | impactos por material (madeira, vidro, metal, soft) + **passos** (concreto, neve, carpete, grama) | hits, colisões, footsteps |
| Interface Sounds | 100 | cliques, selects, switches, bongs, erros | menus e HUD |
| UI Audio | 51 | cliques e rollovers clássicos | botões |
| RPG Audio | 51 | portas, baús, livros, couro, metal, criaturas | masmorras e inventários (Profundezas usa) |
| Sci-Fi Sounds | 73 | lasers, naves, escudos, explosões, computadores | espaço (Corsário usa trovão/fantasma daqui) |
| Digital Audio | 62 | blips digitais, lasers, power-ups, fases | arcade retrô-digital |
| Retro Sounds 1 | 34 | 8-bit: pulos, criaturas, lasers | plataforma retrô |
| Retro Sounds 2 | 65 | 8-bit: **moedas**, motores, explosões | arcade (pulo da Travessia) |
| Foley Sounds | 85 | manuseio físico: pegar/largar equipamento, placas | inventário, crafting |
| Casino Audio | 55 | cartas, fichas, dados | jogo de cartas/tabuleiro |
| Synth Voice 1 | 100 | voz sintética (inglês): "begin", "correct", "go", cores | anunciador robótico |
| Synth Voice 2 | 225 | voz sintética: números, letras, palavras | contagens, bingo, treino |
| Voiceover Pack | 94 | locutor humano: números e frases | quiz, esportes |
| Voiceover Pack Fighter | 47 | locutor de luta: **"FIGHT!", "K.O."**, contagem | jogo de luta 🥊 |

## 🔤 Fontes — 16 famílias TTF (+ webfonts)

`Kenney Future` e `Kenney Future Square` (títulos do hub) · `Kenney Mini` / `Mini Square` / `Mini Square Mono` (HUD) · `Kenney Pixel` / `Pixel Square` (retrô 8-bit) · `Kenney Blocks` (display blocado) · `Kenney High` / `High Square` (condensada alta) · `Kenney Rocket` / `Rocket Square` (esportiva) · `Kenney Space` (sci-fi) · `Kenney Bold` / `Thick` (peso pesado) · `Kenney Future Narrow`.

## 🖱️ UI — 10 packs

| Pack | Tamanho | Para quê |
|---|---|---|
| UI Pack | 875 png + 434 svg | botões/painéis/sliders em 5 cores — o canivete suíço |
| UI Pack – Sci-fi | 822 png | HUD futurista |
| UI Pack – Adventure | 260 png | RPG/fantasia |
| UI Pack – Pixel Adventure | 514 png | RPG pixelado |
| UI Adventure Pack | 90 png | painéis de madeira/pergaminho |
| Fantasy UI Borders | 282 png | molduras ornamentadas |
| Mobile Controls | 948 png + 462 svg | **joysticks e botões touch** — úteis p/ celular |
| Cursor Pack | 729 png + 364 svg | cursores temáticos |
| Cursor Pixel Pack | 223 png | cursores pixel |
| UI Pixel Pack | 3 png | mini pack pixel |

## 🎮 Ícones & prompts — 8 packs

| Pack | Imagens | Para quê |
|---|---:|---|
| Input Prompts | 4.554 | **teclas/botões de TODOS os controles** (Xbox, Play, Switch, teclado, mouse, touch) — tutoriais |
| Input Prompts Pixel / 1-Bit | 819 / 1.637 | idem em pixel art |
| Game Icons (+2 expansões) | 957 | ícones de ações de jogo (espada, poção, save…) |
| Board Game Icons / Info | 1.634 | dados, peões, cartas |

## 🟦 Assets 2D — 151 packs, 37.516 sprites (resumo por tema)

| Tema | Packs principais |
|---|---|
| **Plataforma** (20+ packs) | Platformer Assets Pixel (865!), Tile Extensions (365), Pack Medieval (272), Pack Nautical (244), Extra Animations & Enemies (174), Pixel Platformer (186) + expansões Farm/Food/Industrial, New Platformer, Abstract, Scribble, Simplified, Pixel Line, Buildings, Candy, Ice, Mushroom, Holiday |
| **Isométrico** (22 packs) | Modular Roads (1.208!), Nature (752), Tower Defense (472), Modular Buildings (404), Miniature Bases (320), Space Interior (320), Medieval Town (268), Watercraft (261), Minigolf (193), Tiles City/Buildings/Base, Vector Roads… |
| **Roguelike/RPG** | Roguelike City (1.038!), RPG Urban (488), RPG Tiles Vector (232), Tiny Dungeon, Micro Roguelike, Scribble Dungeons, Monochrome RPG, Retro Textures Fantasy |
| **Topdown & RTS** | Tiny Battle (200), RTS Medieval Pixel (209), Topdown Shooter/Tanks (+ Remastered), RTS Sci-fi, Desert Shooter (com 40 sons!) |
| **Espaço & shmup** | Space Shooter Remastered (base do **NOVA STRIKE**), Pixel Shmup (148), Planets (52), Alien UFO (49), Simple Space, Tappy Plane |
| **Cartas, tabuleiro & puzzle** | Playing Cards, Boardgame (26), Letter Tiles (+Redux), Puzzle Packs, Sokoban, Map Pack (192), Cartography, Hexagon (3 packs, 100+86) |
| **Personagens & bichos 2D** | Toon Characters, Character Pack, Fish Pack (128!), Animal Packs, Monster Builder, Robot, Shape Characters, Googly Eyes, Emotes (33), Smilies |
| **Efeitos & utilidades** | Particle Pack (160), Light Masks (456!), Explosion, Smoke, Splat (37), Crosshair, Pattern Packs (3), Background Elements (2), Medals (31), Ranks, Physics Assets, Prototype/Road Textures |
| **Temáticos diversos** | Sketch Town/Desert (348+244), Pico-8 City (362), Tiny Ski/Town, Pirate Pack, Monochrome Pirates, Donuts (24 🍩), Sports (30), Racing, Shooting Gallery, Voxel Packs, 1-Bit Packs, Holiday 2016, Brick Pack, Rolling Ball, Yellow Paint, Rune Pack |

## 📼 Extras

- **Archive (16 packs legados):** Space Kit Legacy, Nature Pack, Medieval Town, Minigolf antigo, Mini Car Kit, Roguelike 15×, Isometric Renders, Onscreen Controls, Pre-rendered Models, Road Pack antigo… — só usar se faltar algo nos kits novos.
- **Early access:** Medieval Weapons (espadas/machados 3D) e Racing Kit atualizado.
- **Other:** 2 packs de samples para Construct, Miniguides (cartilhas de game design da Kenney).
- **Goodies:** wallpapers, papercraft e o Certificado de Incrível™.

---

## ✅ O que o hub já usa (12 jogos)

| Jogo | Kits 3D / sprites | Áudio |
|---|---|---|
| NOVA STRIKE (2D) | Space Shooter Remastered | sci-fi + jingles |
| TURBO RUSH | Car Kit, Racing Kit, Nature Kit | Music Loops, Impact, Interface |
| ÚLTIMO BASTIÃO (2D) | sprites topdown Kenney | Music Loops, Impact |
| ÚLTIMO BASTIÃO 3D | Graveyard Kit, Weapon Pack, Tower (peças) | Music Loops, RPG, Impact |
| MARÉ VERMELHA | Blocky Characters, Weapon Pack, caixas | Music Loops, Impact |
| CORSÁRIO | Pirate Kit | Music Loops, Impact, Sci-Fi, Foley, RPG |
| PROFUNDEZAS | Mini Dungeon + personagens do Graveyard | Music Loops (Infinite Descent!), RPG, Impact |
| GOLFE MALUCO | Minigolf Kit | Music Loops, Jingles, Interface, Impact |
| TRAVESSIA | Cube Pets, Car Kit, Train Kit, Nature Kit, City Roads, barcos do Pirate | Music Loops (Polka Train!), Interface, Retro, Impact |
| BALAS & BRUXARIA | Fantasy Town, Nature, Mini Dungeon, Graveyard, Blocky Characters, Medieval Weapons, Weapon Pack, Fantasy UI Borders, Game Icons | Music Loops (6 trilhas), RPG, Impact, Interface, Jingles |
| VORAZ | City Kits, Car Kit, Modular Buildings | Music Loops, Impact, Interface |
| BATE-ASA | **Coaster Kit** (pilares, loopings, trilhos, trens, barracas), Cube Pets, Toy Car Kit (fichas/caixa), Platformer Kit (estrela) | Music Loops (Wacky Waiting, Swinging Pants, Night at the Beach), Retro 2, Impact, Interface, Jingles |

## 💡 Combinações prontas — o que dá pra fazer em seguida

1. **🏎️ Kart com itens** — Toy Car Kit (já tem banana, moedas, cones e portal de chegada!) + Voiceover ("3, 2, 1…") + Retro Sounds. *Mario Kart de bolso.*
2. **🎢 Magnata do parque** — Coaster Kit (183 peças de montanha-russa com loopings e flumes!) + Mini Arcade + Casino Audio. *RollerCoaster Tycoon ou um runner sobre trilhos.*
3. **🔮 Corrida de bolinha** — Marble Kit (162 peças: funis, loopings) + a física de bola que JÁ TEMOS do Golfe Maluco. *Marble Blast — reaproveitamento máximo de código.*
4. **🍳 Cozinha caótica** — Food Kit (200 comidas) + Mini Market + Furniture Kit + Foley Sounds. *Overcooked solo com pedidos por tempo.*
5. **🛸 Tower defense 3D** — Tower Defense Kit (já vem com UFOs inimigos armados e torres!) + Synth Voice ("incoming!"). *Encaixa no DNA do Último Bastião.*
6. **🚀 Sabotagem na estação** — Space Station Kit + Modular Space Kit + Blaster Kit + Sci-Fi Sounds. *Among Us/FTL singleplayer com impostor IA.*
7. **🛹 Skate arcade** — Mini Skate + Retro Urban Kit + Impact. *Tony Hawk mini com combos.*
8. **⬡ Cidade hexagonal zen** — Hexagon Kit + Music Loops calmas. *Dorfromantik: encaixar tiles, pontuar paisagens.*
9. **🥊 Arena de luta** — Mini Arena + personagens animados (clipes attack-melee/kick prontos!) + **Voiceover Fighter ("FIGHT!", "K.O.!")**. *Brawler 1v1.*
10. **🏭 Fábrica-puzzle** — Factory Kit (esteiras, botões, braços) + Interface Sounds. *Sokoban industrial / mini-Factorio.*
11. **⛺ Ilha relax** — Nature Kit (329!) + Survival Kit + Cube Pets + Music Loops suaves. *A Short Hike: explorar, coletar, conversar.*
12. **🃏 Mesa de cassino** — Playing Cards 2D + Casino Audio (cartas, fichas, dados) + Fantasy UI Borders. *Balatro-lite / blackjack roguelike.*

> **Maior potencial inexplorado:** Marble Kit e Food Kit são os kits mais ricos que ainda não usamos — o Coaster Kit estreou no BATE-ASA (e ainda sobram flumes d'água, estações e filas!), e as peças spline do Minigolf Kit (com looping!) ficaram de fora do Golfe Maluco.
