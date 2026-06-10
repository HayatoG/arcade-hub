# KEPLER ARCADE 🕹️

Fliperama virtual com nove jogos completos, feitos só com tecnologias web e
assets [Kenney](https://kenney.nl) (CC0).

**Jogar online:** https://hayatog.github.io/arcade-hub/

| Jogo | Estilo | Tech |
|---|---|---|
| [NOVA STRIKE](https://github.com/HayatoG/nova-strike) | Shoot 'em up vertical 2D | Canvas 2D puro |
| TURBO RUSH (`turbo-rush/`) | Racer infinito 3D | Three.js + glTF |
| ÚLTIMO BASTIÃO (`ultimo-bastiao/`) | Survivors + tower defense | Phaser |
| ÚLTIMO BASTIÃO 3D (`bastiao-3d/`) | Survivors isométrico (estilo Diablo) | Three.js + glTF animado |
| MARÉ VERMELHA (`mare-vermelha/`) | Bridge runner de horda infinita | Three.js + glTF animado |
| CORSÁRIO (`corsario/`) | Combate naval em mar aberto | Three.js + glTF |
| PROFUNDEZAS (`profundezas/`) | Roguelite de masmorra sala-a-sala | Three.js + glTF animado |
| GOLFE MALUCO (`golfe-maluco/`) | Minigolfe físico de 12 buracos | Three.js + glTF |
| TRAVESSIA (`travessia/`) | Arcade de travessia infinita (estilo Crossy Road) | Three.js + glTF |

## CORSÁRIO — a maré fantasma

1717: você é o último corsário da Coroa Livre. Mar com ondas vivas, ciclo
dia/noite, bordadas balísticas, mercantes para saquear e fragatas da Armada na
sua esteira. Ouro sobe o nível do navio (chalupa → bergantim → galeão) com
escolha de cartas de upgrade; a cada 5 marés a névoa fecha e o **Navio
Fantasma** aparece. Tempestades com raios, baús, barris de reparo e naufrágio
cinematográfico. Recorde: ouro saqueado.

## PROFUNDEZAS — a coroa do Rei Cego

Roguelite de masmorra com câmera ao estilo Hades: salas procedurais, espada
com arco de 120°, dash com i-frames, armadilhas de espinhos e cinco inimigos
animados (zumbi, esqueleto, orc, vampiro e um fantasma que atravessa paredes e
sussurra antes de aparecer). Limpe a sala, escolha 1 de 2 bênçãos e desça —
a cada 5 salas, um guardião de elite com ataque em área telegrafado. Recorde:
salas vencidas.

## GOLFE MALUCO — torneio interplanetário

Minigolfe 3D com física própria (raycast de terreno, reflexão nas paredes,
rampas, túneis e saltos): 12 buracos artesanais com moinho giratório, blocos
deslizantes e um grande finale. Mira estilingue com prévia de trajetória,
anúncios de BIRDIE/EAGLE/ACE, confete e cartão final com estrelas. Recorde:
menor total de tacadas.

## TRAVESSIA — o pintinho atravessador

Crossy Road à brasileira: grama, estradas, trilhos (o trem avisa com sino e
luz — e passa voando) e rios com troncos à deriva. A câmera avança sozinha e
uma águia leva quem fica parado. Moedas alimentam a **máquina de prêmios**, que
sorteia 13 bichos jogáveis (Cube Pets). Recorde: passos.

## MARÉ VERMELHA — a ponte infinita

Runner de horda no estilo "Last War": o pelotão azul marcha pela ponte com
**tiro automático** enquanto a maré vermelha desce sem fim. Atravesse portões
para somar e multiplicar soldados, ganhar dano/cadência e pegar **armas novas
sobre as caixas** (pistola → espingarda → uzi → metralhadora → lança-foguetes
com dano em área). Gigantes com número de HP na cabeça aparecem a cada 320 m.
Não há vitória — só o recorde de distância.

## ÚLTIMO BASTIÃO — sobreviva à horda

Vampire-survivors-like com defesa de base: o tiro é automático, zumbis vêm em
12 ondas e as moedas coletadas são **depositadas no quadrado ao pé da torre**
(fique sobre ele — a sucção tem cooldown). Com o depósito, a torre cresce
sozinha: de ruína a Bastião Supremo com canhões giratórios, muralhas, torretas
e mísseis em área.

- **5 níveis de torre automáticos** (60/180/360/600 moedas): Sentinela → Canhão
  Duplo → Fortaleza (com torretas laterais) → Bastião Supremo (mísseis em área)
- **5 armas automáticas por abates** (pistola → tempestade de balas)
- 3 tipos de zumbi (errante, corredor, brutamontes) + **gigantes** nas ondas 6 e 12
- Moedas com ímã, sangue no chão, recorde de ondas no navegador
- Teclado (WASD/setas) ou toque (arrastar o dedo) — o tiro mira sozinho

## TURBO RUSH — Rodovia Infinita

Corra por uma rodovia infinita sob um pôr do sol eterno. Desvie do tráfego,
derrube cones para pontuar, pegue caixas de TURBO para esmagar tudo no caminho
e bata o seu recorde.

- **3 carros jogáveis**: Veloz GT, Futuro-X e Clássico S
- Tráfego variado (táxi, polícia, ambulância, caminhões...) com velocidades próprias
- Bônus de "quase-acidente" por ultrapassagens raspando
- TURBO = invencível: demolir carros vale +200
- Velocidade cresce sem parar — até 230 km/h
- Recorde salvo no navegador

**Controles**: ◄ ► trocar de faixa · ▲ acelerar · ▼ frear · M som
**Celular**: toque na metade esquerda/direita da tela para trocar de faixa

## Rodar localmente

```bash
python3 -m http.server 8643
# abra http://localhost:8643
```

> O link do NOVA STRIKE no hub aponta para `../nova-strike/` localmente
> (clone os dois repositórios lado a lado) e para o GitHub Pages em produção.

## Créditos

- Arte 3D: Kenney — Car Kit, Racing Kit, Nature Kit (CC0)
- Áudio: Kenney — Music Loops, Impact Sounds, Interface Sounds, Sci-Fi Sounds (CC0)
- Fontes: Kenney Fonts (CC0)
- Engine 3D: [three.js](https://threejs.org) (MIT, vendorizado em `turbo-rush/lib/`)
