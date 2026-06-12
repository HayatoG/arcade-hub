// ============================================================
// GELECO — a geleca que quica
// Plataforma 3D side-scrolling · Platformer Kit (Kenney, CC0)
// ============================================================
import * as THREE from 'three';
import {
  G, scene, camera, renderer, sun, clamp, lerp, rand, AUTO,
  burst, updateParticles, addShake, shakeOffset, hitStop,
  announce, fadeOut, fadeIn, show, hide, saveProgress, starCount, LS,
} from './core.js';
import { INPUT } from './input.js';
import { LEVELS } from './levels.js';
import { loadLib, buildWorld, clearWorld, updateWorld, world } from './world.js';
import { Player } from './player.js';
import { spawnEnemies, clearEnemies, updateEnemies } from './enemies.js';
import { Boss } from './boss.js';
import { buildMap, clearMap, updateMap, mapMove, mapSelLocked, shakeLock, popLock, worldmap } from './worldmap.js';

const SFX = () => AudioSys;
const Q = new URLSearchParams(location.search);

// hooks de teste/depuração
window.__G = G;
window.__P = () => player;
window.__world = world;
window.__DBG = () => ({ winTimer, deadShown, justUnlocked });

let player = null;
let camX = 4, camY = 6;
let clearTimer = 0, deadShown = false, winTimer = 0, bossStar = null;
let justUnlocked = -1;
let lastMapMX = 0;

// ------------------------------------------------------------
// Carga
// ------------------------------------------------------------
AudioSys.load();
INPUT.init();
INPUT.onGamepad = (on, id) =>
  announce(on ? '🎮 CONTROLE CONECTADO!' : '🎮 controle desconectado', 1.8);

const loadEl = document.querySelector('#loading .story');
loadLib(p => { loadEl.textContent = 'PREPARANDO A GOSMA... ' + Math.round(p * 100) + '%'; })
  .then(() => {
    player = new Player();
    scene.add(player.mesh);
    player.mesh.visible = false;

    hide('loading');
    document.getElementById('record').textContent =
      starCount(G.stars[0]) + starCount(G.stars[1]) + (G.stars[2] ? 1 : 0);

    if (Q.has('unlock')) { G.unlocked = clamp(parseInt(Q.get('unlock'), 10) || 3, 1, 3); }

    if (AUTO || Q.has('level')) {
      hide('menu');
      const lv = clamp(parseInt(Q.get('level') || '1', 10) - 1, 0, 2);
      if (Q.has('level')) G.unlocked = Math.max(G.unlocked, lv + 1);
      startLevel(lv, true);
    } else {
      buildMap();
      G.state = 'menu';
      SFX().playMusic('map');
    }
  })
  .catch(err => { loadEl.textContent = 'ERRO AO CARREGAR :( — ' + err; console.error(err); });

// ------------------------------------------------------------
// Fluxo de telas
// ------------------------------------------------------------
function goMap() {
  fadeOut(() => {
    cleanupLevel();
    clearMap();
    buildMap();
    hide('hud'); hide('clear'); hide('dead'); hide('final'); hide('pause');
    show('map-ui');
    G.state = 'map';
    SFX().playMusic('map');
    fadeIn();
    if (justUnlocked >= 0) {
      const idx = justUnlocked; justUnlocked = -1;
      setTimeout(() => popLock(idx), 900);
    }
  });
}

function cleanupLevel() {
  clearWorld();
  clearEnemies();
  if (G.boss) { G.boss.destroy(); G.boss = null; }
  if (bossStar) { scene.remove(bossStar); bossStar = null; }
  if (player) player.mesh.visible = false;
}

function startLevel(idx, instant) {
  const go = () => {
    cleanupLevel();
    clearMap();
    G.levelIdx = idx;
    G.def = LEVELS[idx];
    buildWorld(G.def);
    spawnEnemies();
    G.runCoins = 0;
    G.runStars = [false, false, false];
    G.checkpoint = { x: G.def.spawn.c + 0.5, y: G.def.spawn.y };
    player.hearts = 3;
    player.spawn(G.checkpoint.x, G.checkpoint.y);
    player.mesh.visible = true;
    if (world.bossSpawn) {
      G.boss = new Boss(world.bossSpawn.x, world.bossSpawn.y);
      setTimeout(() => SFX().play('roar', 1), 600);
    }
    camX = player.x; camY = player.y + 2;
    clearTimer = 0; deadShown = false; winTimer = 0;
    hide('menu'); hide('map-ui'); hide('clear'); hide('dead'); hide('final'); hide('pause');
    show('hud');
    G.state = 'level';
    SFX().playMusic(G.def.music);
    announce(G.def.name.toUpperCase(), 2);
    fadeIn();
  };
  if (instant) go(); else fadeOut(go);
}

function levelComplete() {
  if (G.state !== 'level') return;
  G.state = 'celebrate';
  player.frozen = true;
  player.setAnim('emote-yes', 0.2);
  SFX().stopMusic();
  SFX().play('win', 1);
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      burst(player.x + rand(-2, 2), player.y + rand(1, 3), 0,
        [0x7bf24c, 0xffd34d, 0xff5d8f, 0x6ad8ff][i % 4], 16, { speed: 5, up: 7, life: 1 });
    }, i * 180);
  }
  setTimeout(showClear, 1700);
}

function showClear() {
  const idx = G.levelIdx;
  const before = G.stars[idx];
  let after = before;
  for (let k = 0; k < 3; k++) if (G.runStars[k]) after |= (1 << k);
  G.stars[idx] = after;
  G.coins += G.runCoins;
  const nextUnlock = Math.min(3, idx + 2);
  if (nextUnlock > G.unlocked) { G.unlocked = nextUnlock; justUnlocked = idx + 1; }
  saveProgress();

  const spans = document.querySelectorAll('#clear-stars span');
  spans.forEach((s, k) => {
    const got = (after >> k) & 1, isNew = G.runStars[k] && !((before >> k) & 1);
    s.className = (got ? 'got' : '') + (isNew ? ' new' : '');
    s.textContent = '★';
  });
  document.getElementById('clear-title').textContent =
    ['QUE QUICADA!', 'GELATINOSO!', 'NEM DERRETEU!'][(Math.random() * 3) | 0];
  document.getElementById('clear-stats').textContent =
    `🪙 +${G.runCoins} moedas (total ${G.coins})` +
    (justUnlocked >= 0 ? '\n🔓 NOVA FASE DESBLOQUEADA!' : '');
  show('clear');
  G.state = 'clear';
}

function bossDefeated() {
  G.stars[2] = 1;
  G.coins += G.runCoins;
  saveProgress();
  document.getElementById('final-stats').textContent =
    `⭐ estrelas: ${starCount(G.stars[0]) + starCount(G.stars[1]) + 1}/7 · 🪙 moedas: ${G.coins}`;
  SFX().stopMusic();
  SFX().play('bosswin', 1);
  show('final');
  G.state = 'final';
}

function showDead() {
  document.getElementById('dead-stats').textContent =
    G.levelIdx === 2 ? 'O Rei Bocão riu da sua cara.' : 'A gosma voltou pro pote.';
  SFX().play('gameover', 0.9);
  SFX().duckMusic(0.25);
  show('dead');
  G.state = 'dead';
}

function retryFromCheckpoint() {
  hide('dead');
  fadeOut(() => {
    player.hearts = 3;
    player.spawn(G.checkpoint.x, G.checkpoint.y);
    spawnEnemies();
    if (G.boss) {
      G.boss.destroy();
      G.boss = new Boss(world.bossSpawn.x, world.bossSpawn.y);
    }
    deadShown = false;
    SFX().duckMusic(1);
    G.state = 'level';
    fadeIn();
  }, 350);
}

// ------------------------------------------------------------
// Botões
// ------------------------------------------------------------
const click = (id, fn) => document.getElementById(id).addEventListener('click', () => { SFX().play('click', 0.7); fn(); });
click('btn-start', () => { AudioSys.unlock(); hide('menu'); show('map-ui'); G.state = 'map'; });
click('btn-next', goMap);
click('btn-retry', retryFromCheckpoint);
click('btn-resume', resumeGame);
click('btn-final', goMap);
click('dead-tomap', () => { hide('dead'); goMap(); });
click('pause-tomap', () => { hide('pause'); SFX().duckMusic(1); goMap(); });

function pauseGame() {
  if (G.state !== 'level') return;
  G.pausedFrom = G.state;
  G.state = 'pause';
  document.getElementById('pause-stats').textContent =
    `${G.def.name} · 🪙 ${G.runCoins} · ⭐ ${G.runStars.filter(Boolean).length}`;
  SFX().duckMusic(0.25);
  show('pause');
}
function resumeGame() {
  if (G.state !== 'pause') return;
  hide('pause');
  SFX().duckMusic(1);
  G.state = 'level';
}

// ------------------------------------------------------------
// HUD
// ------------------------------------------------------------
const heartsEl = document.getElementById('hearts');
const coinsEl = document.getElementById('coins');
const starsEl = document.getElementById('stars');
const labelEl = document.getElementById('level-label');
function updateHUD() {
  const h = player.hearts;
  const capacity = Math.max(3, h);
  let s = '';
  for (let i = 0; i < capacity; i++) s += i < h ? '💚' : '🖤';
  heartsEl.textContent = s;
  coinsEl.textContent = '🪙 ' + G.runCoins;
  if (G.levelIdx < 2) {
    let st = '';
    for (let k = 0; k < 3; k++) {
      const has = G.runStars[k] || ((G.stars[G.levelIdx] >> k) & 1);
      st += has ? '★' : '<span class="off">★</span>';
    }
    starsEl.innerHTML = st;
  } else starsEl.textContent = G.boss ? '' : '★';
  labelEl.textContent = G.def ? G.def.name : '';
}

// ------------------------------------------------------------
// Câmera da fase
// ------------------------------------------------------------
function updateCamera(dt) {
  const isBoss = G.def && G.def.theme === 'boss';
  const pad = isBoss ? 11 : 7;
  const tx = clamp(player.x + player.face * (isBoss ? 0.5 : 2.0), pad, world.width - pad);
  camX = lerp(camX, tx, Math.min(1, dt * 5));
  const ty = isBoss ? 6.6 : player.y + 1.7;
  camY = lerp(camY, ty, Math.min(1, dt * (player.onGround ? 5 : 2.6)));
  const sh = shakeOffset(dt);
  const cz = isBoss ? 14.5 : 11.2;
  camera.position.set(camX + sh.x, camY + 1.3 + sh.y, cz);
  camera.lookAt(camX + sh.x, camY + 0.25 + sh.y, 0);
  sun.position.set(camX + 9, camY + 13, 11);
  sun.target.position.set(camX, camY, 0);
}

// ------------------------------------------------------------
// Loop principal
// ------------------------------------------------------------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  G.time += dt;

  INPUT.update();
  if (INPUT.pressed('mute')) {
    const m = AudioSys.toggleMute();
    announce(m ? '🔇 SOM DESLIGADO' : '🔊 SOM LIGADO', 1.1);
  }

  // touch overlay
  document.getElementById('touch').classList.toggle(
    'hidden', !(INPUT.touchActive && (G.state === 'level' || G.state === 'map')));

  switch (G.state) {
    case 'menu': {
      updateMap(dt, camera);
      if (INPUT.pressed('confirm') || INPUT.pressed('jump')) {
        document.getElementById('btn-start').click();
      }
      break;
    }
    case 'map': {
      // navegação (1 toque = 1 ilha): teclas/dpad por edge + stick por eixo
      let moved = false;
      if (INPUT.pressed('left')) { mapMove(-1); moved = true; }
      if (INPUT.pressed('right')) { mapMove(1); moved = true; }
      const mx = INPUT.moveX;
      if (!moved && Math.abs(mx) > 0.55 && Math.abs(lastMapMX) <= 0.55) mapMove(mx > 0 ? 1 : -1);
      lastMapMX = mx;
      if (INPUT.pressed('jump') || INPUT.pressed('confirm')) {
        if (mapSelLocked()) { shakeLock(); announce('🔒 COMPLETE A FASE ANTERIOR!', 1.4); }
        else { SFX().play('confirm', 0.9); startLevel(worldmap.sel); }
      }
      INPUT.pressed('pound');
      updateMap(dt, camera);
      break;
    }
    case 'level': case 'celebrate': {
      let sdt = dt;
      if (G.hitStop > 0) { G.hitStop -= dt; sdt = 0; }

      if (G.state === 'level' && INPUT.pressed('pause')) { pauseGame(); break; }

      player.update(sdt);
      updateEnemies(sdt, player);
      if (G.boss) {
        G.boss.update(sdt, player);
        if (G.boss.dead && winTimer === 0) {
          winTimer = 0.001;
          // a estrela roubada finalmente livre!
          bossStar = new THREE.Group();
          const st = LEVELSTAR();
          bossStar.add(st);
          bossStar.position.set(G.boss.x, G.boss.y + 1, 0);
          scene.add(bossStar);
        }
        if (winTimer > 0) {
          winTimer += sdt;
          if (bossStar) { bossStar.position.y += sdt * 1.6; bossStar.rotation.y += sdt * 2.5; }
          if (winTimer > 2.4 && G.state !== 'final') { bossDefeated(); break; }
        }
      }
      updateWorld(sdt, player.dead ? null : player);

      // portal de fim de fase
      if (G.state === 'level' && world.portal && !player.dead &&
          Math.abs(player.x - world.portal.x) < 0.6 && Math.abs(player.y - world.portal.y) < 1.4) {
        levelComplete();
      }

      // morreu de vez
      if (player.dead && player.deadT > 1.15 && !deadShown) {
        deadShown = true;
        showDead();
      }

      updateCamera(dt);
      updateHUD();
      break;
    }
    case 'pause': {
      if (INPUT.pressed('pause') || INPUT.pressed('confirm')) resumeGame();
      break;
    }
    case 'clear': {
      if (INPUT.pressed('confirm') || INPUT.pressed('jump')) document.getElementById('btn-next').click();
      break;
    }
    case 'dead': {
      if (INPUT.pressed('confirm') || INPUT.pressed('jump')) document.getElementById('btn-retry').click();
      break;
    }
    case 'final': {
      if (INPUT.pressed('confirm') || INPUT.pressed('jump')) document.getElementById('btn-final').click();
      break;
    }
  }

  updateParticles(dt);
  INPUT.clear();
  renderer.render(scene, camera);
}

// estrela dourada de vitória do chefe
import { spawnModel } from './world.js';
function LEVELSTAR() {
  const m = spawnModel('star', { scale: 2.2 });
  return m;
}

requestAnimationFrame(frame);
