# KEPLER ARCADE 🕹️

Fliperama virtual com três jogos completos, feitos só com tecnologias web e
assets [Kenney](https://kenney.nl) (CC0).

**Jogar online:** https://hayatog.github.io/arcade-hub/

| Jogo | Estilo | Tech |
|---|---|---|
| [NOVA STRIKE](https://github.com/HayatoG/nova-strike) | Shoot 'em up vertical 2D | Canvas 2D puro |
| TURBO RUSH (`turbo-rush/`) | Racer infinito 3D | Three.js + glTF |
| ÚLTIMO BASTIÃO (`ultimo-bastiao/`) | Survivors + tower defense | Phaser |

## ÚLTIMO BASTIÃO — sobreviva à horda

Vampire-survivors-like com defesa de base: o tiro é automático, zumbis vêm em
12 ondas e cada moeda coletada **constrói a torre central sozinha** — de ruína
a Bastião Supremo com canhões, muralhas, torretas e mísseis em área.

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
