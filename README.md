# KEPLER ARCADE 🕹️

Fliperama virtual com dois jogos completos, feitos só com tecnologias web e
assets [Kenney](https://kenney.nl) (CC0).

**Jogar online:** https://hayatog.github.io/arcade-hub/

| Jogo | Estilo | Tech |
|---|---|---|
| [NOVA STRIKE](https://github.com/HayatoG/nova-strike) | Shoot 'em up vertical 2D | Canvas 2D puro |
| TURBO RUSH (`turbo-rush/`) | Racer infinito 3D | Three.js + glTF |

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
