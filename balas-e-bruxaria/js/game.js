// ============================================================
// BALAS & BRUXARIA — RPG isométrico de pólvora e magia
// Entrada principal: cena, câmera, máquina de estados, loop
// Three.js + kits Kenney (CC0)
// ============================================================
import * as THREE from 'three';
import { INPUT } from './input.js';
import * as RPG from './rpg.js';
import { WORLD } from './world.js';
import { ENT, H } from './entities.js';
import { UI } from './ui.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const $ = id => document.getElementById(id);

// ------------------------------------------------------------
// Renderer / cena / câmera
// ------------------------------------------------------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x150f1c);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 160);
camera.position.set(0, 13, 12);
camera.lookAt(0, 0, 0);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------------------------------------
// Contexto compartilhado entre módulos
// ------------------------------------------------------------
const ctx = {
  THREE, scene, camera, renderer,
  state: 'title',
  area: 'vila',
  hero: H,
  rpg: RPG, world: WORLD, ent: ENT, ui: UI, input: INPUT,
  game: null,
};

let shake = 0, time = 0, saveT = 12;
let fpsFrames = 0, fpsAcc = 0, fpsValue = 60;
let ccSkin = 0, ccGift = 'bravo';
let celebrateT = 0, deathT = 0;

const GAME = ctx.game = {
  setState(s) {
    ctx.state = s;
    UI.onState(s);
  },
  setMusic(name) { AudioSys.playMusic(name); },
  announce(msg, dur) { UI.announce(msg, dur); },
  addShake(n) { shake = Math.min(0.6, shake + n); },

  teleport(area, spawn, instant) {
    const doIt = () => {
      ENT.clearEnemies();
      const sp = WORLD.setArea(area);
      ctx.area = area;
      const p = spawn || sp;
      ENT.placeHero(p.x, p.z, area === 'vila' ? Math.PI : 0);
      GAME.setMusic(area.startsWith('d') ? 'dungeon' : area);
      UI.refreshHUD();
      RPG.save();
      // câmera salta para a nova posição
      camera.position.set(H.x, camOffY(), H.z + camOffZ());
    };
    if (instant) { doIt(); return; }
    const fade = $('fade');
    fade.classList.add('show');
    setTimeout(() => {
      doIt();
      setTimeout(() => fade.classList.remove('show'), 120);
    }, 360);
  },

  onHeroDeath() {
    GAME.setState('dead');
    deathT = 1.6;
  },

  celebrate() {
    // festa na praça + créditos
    RPG.saveRecord();
    GAME.teleport('vila', { x: 0, z: 6 });
    GAME.setState('play');
    celebrateT = 12;
    UI.announce('🎉 FESTA NA PRAÇA! 🎉', 3500);
    AudioSys.play('jquest', 1);
    setTimeout(() => {
      if (celebrateT > 0) {
        GAME.setState('credits');
        UI.showCredits();
      }
    }, 5200);
  },

  startNewGame() {
    const name = ($('cc-name').value || 'Pimenta').trim().slice(0, 14);
    RPG.newPlayer(name, RPG.SKINS[ccSkin], ccGift);
    ENT.buildHero(RPG.SKINS[ccSkin]);
    $('create').classList.add('hidden');
    $('menu').classList.add('hidden');
    GAME.setState('play');
    GAME.teleport('vila', { x: 0, z: 14 }, true);
    setTimeout(() => {
      UI.toast(`Bem-vindo(a) a Pederneira, ${name}!`);
      UI.toast('❗ Fale com o Prefeito Aldo, na praça (tecla E)');
    }, 700);
  },

  continueGame() {
    const P = RPG.loadSave();
    if (!P) return;
    ENT.buildHero(P.skin);
    $('menu').classList.add('hidden');
    GAME.setState('play');
    GAME.teleport(P.area || 'vila', { x: P.px, z: P.pz });
    UI.toast(`Bem-vindo(a) de volta, ${P.name}!`);
  },
};

function camOffY() { return ctx.area.startsWith('d') ? 10.6 : 10.8; }
function camOffZ() { return ctx.area.startsWith('d') ? 8.8 : 9.4; }

// ------------------------------------------------------------
// Criação de personagem
// ------------------------------------------------------------
function refreshCreate() {
  $('skin-name').textContent = RPG.SKIN_NAMES[ccSkin];
  document.querySelectorAll('.gift-card').forEach(el => {
    el.classList.toggle('sel', el.dataset.g === ccGift);
  });
  ENT.buildHero(RPG.SKINS[ccSkin]);
  // boneco de prévia num canto aberto da praça
  ENT.placeHero(-5.5, 8.5, 0);
}

function openCreate() {
  $('menu').classList.add('hidden');
  $('create').classList.remove('hidden');
  GAME.setState('create');
  // jogador "fantasma" para a prévia (sem RPG.P ainda — só visual)
  refreshCreate();
}

$('skin-prev').addEventListener('click', () => { ccSkin = (ccSkin + RPG.SKINS.length - 1) % RPG.SKINS.length; AudioSys.play('click', 0.5); refreshCreate(); });
$('skin-next').addEventListener('click', () => { ccSkin = (ccSkin + 1) % RPG.SKINS.length; AudioSys.play('click', 0.5); refreshCreate(); });
document.querySelectorAll('.gift-card').forEach(el => {
  el.addEventListener('click', () => { ccGift = el.dataset.g; AudioSys.play('click', 0.5); refreshCreate(); });
});
$('cc-ok').addEventListener('click', () => { AudioSys.unlock(); AudioSys.play('confirm', 0.7); GAME.startNewGame(); });
$('btn-start').addEventListener('click', () => { AudioSys.unlock(); AudioSys.play('click', 0.6); openCreate(); });
$('btn-continue').addEventListener('click', () => { AudioSys.unlock(); AudioSys.play('confirm', 0.7); GAME.continueGame(); });

// navegação de escolhas do diálogo pelo teclado
window.addEventListener('keydown', e => {
  if (ctx.state !== 'dialog') return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'w'].includes(k)) UI.moveChoice(-1);
  if (['arrowdown', 's'].includes(k)) UI.moveChoice(1);
});

// ------------------------------------------------------------
// Interação contextual (NPCs, baús, portais, placas)
// ------------------------------------------------------------
let nearThing = null;
function scanInteract() {
  nearThing = null;
  let bd = 1e9;
  const consider = (t, d, kind) => { if (d < bd) { bd = d; nearThing = { t, kind }; } };
  for (const p of WORLD.portals()) {
    const d = Math.hypot(H.x - p.x, H.z - p.z);
    if (d < p.r) consider(p, d, 'portal');
  }
  for (const it of WORLD.interactables()) {
    const d = Math.hypot(H.x - it.x, H.z - it.z);
    if (d < it.r) consider(it, d, 'inter');
  }
  for (const n of ENT.npcInteractables()) {
    const d = Math.hypot(H.x - n.x, H.z - n.z);
    if (d < n.r) consider(n, d, 'npc');
  }
  UI.setPrompt(nearThing ? (nearThing.kind === 'portal' ? '🚪 ' : '') + nearThing.t.label : null);
}

function doInteract() {
  if (!nearThing) return;
  const { t, kind } = nearThing;
  if (kind === 'portal') {
    AudioSys.play('dooropen', 0.7);
    GAME.teleport(t.to, t.spawn);
  } else {
    t.fn();
    if (t.once) WORLD.removeInter(t);
  }
  nearThing = null;
  UI.setPrompt(null);
}

// ------------------------------------------------------------
// Entradas globais por estado
// ------------------------------------------------------------
function handleInput() {
  const s = ctx.state;
  if (INPUT.pressed('mute')) {
    const m = AudioSys.toggleMute();
    UI.toast(m ? '🔇 Som desligado' : '🔊 Som ligado');
  }

  if (s === 'title') {
    if (INPUT.pressed('confirm')) {
      if (RPG.hasSave()) GAME.continueGame();
      else openCreate();
    }
    return;
  }
  if (s === 'create') {
    if (INPUT.pressed('confirm')) GAME.startNewGame();
    return;
  }
  if (s === 'play') {
    if (INPUT.pressed('interact')) doInteract();
    if (INPUT.pressed('inv')) UI.openInv();
    else if (INPUT.pressed('quest')) UI.openQlog();
    else if (INPUT.pressed('pause')) UI.openPause();
    return;
  }
  if (s === 'dialog') {
    if (INPUT.pressed('interact') || INPUT.pressed('advance') || INPUT.pressed('confirm')) {
      if (UI.dialogHasChoices) UI.pickChoice();
      else UI.advanceDialog();
    }
    if (INPUT.pressed('pause')) UI.closeDialog(false);
    return;
  }
  if (s === 'inv') {
    if (INPUT.pressed('inv') || INPUT.pressed('pause')) { UI.closeInv(); GAME.setState('play'); }
    return;
  }
  if (s === 'qlog') {
    if (INPUT.pressed('quest') || INPUT.pressed('pause')) { UI.closeQlog(); GAME.setState('play'); }
    return;
  }
  if (s === 'shop') {
    if (INPUT.pressed('pause') || INPUT.pressed('interact')) { UI.closeShop(); GAME.setState('play'); }
    return;
  }
  if (s === 'pause') {
    if (INPUT.pressed('pause')) { UI.closePause(); GAME.setState('play'); }
    return;
  }
  INPUT.clear();
}

// ------------------------------------------------------------
// Loop principal
// ------------------------------------------------------------
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  time += dt;
  fpsFrames++; fpsAcc += dt;
  if (fpsAcc >= 1) { fpsValue = fpsFrames / fpsAcc; fpsFrames = 0; fpsAcc = 0; }

  INPUT.update();
  handleInput();

  const playing = ctx.state === 'play';
  WORLD.update(dt, playing || ctx.state === 'dead');
  ENT.update(dt, playing);
  UI.update(dt);
  INPUT.clear();

  if (playing) {
    scanInteract();
    saveT -= dt;
    if (saveT <= 0) { saveT = 12; RPG.save(); }
    if (RPG.P) RPG.P.playT += dt;
  }

  // morte → respawn na vila
  if (ctx.state === 'dead' && deathT > 0) {
    ENT.update(dt, false);
    deathT -= dt;
    if (deathT <= 0) {
      const lost = Math.floor(RPG.P.gold * 0.1);
      RPG.addGold(-lost);
      UI.showDeath(lost);
      GAME.teleport('vila', { x: -10, z: 11 }, true);   // em frente à taberna
      RPG.P.hp = Math.ceil(RPG.stats().maxHp * 0.5);
      ENT.reviveHero();
      RPG.save();
      setTimeout(() => {
        UI.hideDeath();
        GAME.setState('play');
        UI.refreshHUD();
      }, 2400);
    }
  }

  // festa na praça
  if (celebrateT > 0) {
    celebrateT -= dt;
    if (Math.random() < dt * 6) {
      const a = rand(0, Math.PI * 2), d = rand(2, 8);
      ENT.burstAt(Math.sin(a) * d, rand(1, 4), Math.cos(a) * d,
        [0xffd23e, 0xff6ab2, 0x7ad8a0, 0x8ab2ff, 0xc478ff][Math.floor(rand(0, 5))], 10, 4);
    }
    if (Math.random() < dt * 1.5) AudioSys.play('coin', 0.3, rand(1, 1.5));
  }

  // câmera
  updateCamera(dt);
  renderer.render(scene, camera);
}

const camLook = new THREE.Vector3();
function updateCamera(dt) {
  const s = ctx.state;
  if (s === 'title') {
    const a = time * 0.1;
    camera.position.set(Math.sin(a) * 16, 8.5, Math.cos(a) * 16);
    camera.lookAt(0, 1.5, 0);
    return;
  }
  if (s === 'create') {
    // prévia 3D girando
    if (H.ch) H.ch.obj.rotation.y += dt * 0.8;
    const px = H.x, pz = H.z;
    camera.position.lerp(new THREE.Vector3(px - 1.2, 1.85, pz + 3.4), Math.min(1, 5 * dt));
    camLook.set(px - 0.4, 1.0, pz);
    camera.lookAt(camLook);
    return;
  }
  let cx = H.x, cy = camOffY(), cz = H.z + camOffZ();
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 1.6);
    cx += rand(-shake, shake) * 0.5;
    cy += rand(-shake, shake) * 0.4;
  }
  camera.position.x = lerp(camera.position.x, cx, 5 * dt);
  camera.position.y = lerp(camera.position.y, cy, 5 * dt);
  camera.position.z = lerp(camera.position.z, cz, 5 * dt);
  camLook.set(camera.position.x, 0.5, camera.position.z - camOffZ() + 0.6);
  camera.lookAt(camLook);
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
AudioSys.load();
{
  const rec = RPG.loadRecord();
  $('record').textContent = rec > 0 ? 'nível ' + rec : '—';
  if (RPG.hasSave()) $('btn-continue').classList.remove('hidden');
}
if (document.fonts && document.fonts.load) {
  document.fonts.load('20px "Kenney Future"');
  document.fonts.load('20px "Kenney Mono"');
}

RPG.RPG.init(ctx);
INPUT.init((connected, id) => {
  if (connected) UI.toast('🎮 Controle conectado' + (id ? ': ' + id.slice(0, 24) : ''));
  else UI.toast('🎮 Controle desconectado');
});
WORLD.init(ctx);
ENT.init(ctx);
UI.init(ctx);

WORLD.loadAll(f => {
  $('loading').querySelector('.story').textContent =
    'ACENDENDO AS FORJAS DE PEDERNEIRA... ' + Math.round(f * 100) + '%';
}).then(() => {
  WORLD.buildAll();
  ENT.createPools();
  // cenário de fundo do menu: a vila
  WORLD.setArea('vila');
  ENT.buildHero('a');
  ENT.placeHero(0, 3.5, 0);
  $('loading').classList.add('hidden');
  AudioSys.playMusic('titulo');
  tick();
}).catch(err => {
  console.error('Erro ao carregar modelos:', err);
  $('loading').innerHTML = '<p class="story">Erro ao carregar — veja o console.</p>';
});

// ------------------------------------------------------------
// Handle de testes
// ------------------------------------------------------------
window.__BB = {
  get state() { return ctx.state; },
  get area() { return ctx.area; },
  get pos() { return [+H.x.toFixed(2), +H.z.toFixed(2)]; },
  get hp() { return RPG.P ? RPG.P.hp : 0; },
  get mana() { return RPG.P ? RPG.P.mana : 0; },
  get level() { return RPG.P ? RPG.P.level : 0; },
  get xp() { return RPG.P ? RPG.P.xp : 0; },
  get pts() { return RPG.P ? RPG.P.pts : 0; },
  get gold() { return RPG.P ? RPG.P.gold : 0; },
  get frags() { return RPG.P ? RPG.P.frags : 0; },
  get bosses() { return RPG.P ? RPG.P.bossesDead.slice() : []; },
  get enemies() { return ENT.enemiesAlive(); },
  get bossHp() { return ENT.activeBoss ? ENT.activeBoss.hp : 0; },
  get drops() { return ENT.dropCount; },
  get fps() { return Math.round(fpsValue); },
  get models() { return Object.keys(WORLD.LIB).length; },
  get quests() {
    if (!RPG.P) return {};
    const out = {};
    for (const id of Object.keys(RPG.QUESTS)) {
      out[id] = { state: RPG.P.quests[id] ? RPG.P.quests[id].state : RPG.qstate(id), prog: RPG.qprogress(id) };
    }
    return out;
  },
  get inv() { return RPG.P ? RPG.P.inv.map(s => s ? s.id + (s.qty > 1 ? '×' + s.qty : '') : null) : []; },
  get equip() { return RPG.P ? { ...RPG.P.equip } : {}; },
  get spells() { return RPG.P ? RPG.P.spells.slice() : []; },
  get handWeapon() { return H.hand; },

  createChar(name = 'Testudo', skin = 'c', gift = 'aguia') {
    ccSkin = Math.max(0, RPG.SKINS.indexOf(skin));
    ccGift = gift;
    $('cc-name').value = name;
    $('menu').classList.add('hidden');
    $('create').classList.add('hidden');
    GAME.startNewGame();
  },
  continueGame() { GAME.continueGame(); },
  teleport(area, x, z) { GAME.teleport(area, x != null ? { x, z } : null, true); },
  setPos(x, z) { ENT.placeHero(x, z); },
  giveItem(id, qty = 1) { return RPG.giveItem(id, qty); },
  equipItem(id) { return RPG.equipItem(id); },
  giveGold(n) { RPG.addGold(n); },
  giveXp(n) { RPG.addXp(n); },
  setLevel(n) {
    if (!RPG.P) return;
    while (RPG.P.level < n) RPG.addXp(RPG.xpNext() - RPG.P.xp);
  },
  learnSpell(id) { if (RPG.P && !RPG.P.spells.includes(id)) { RPG.P.spells.push(id); UI.refreshHUD(); } },
  castSpell(i) { ENT.castSpellIdx(i); },
  startQuest(id) { return RPG.acceptQuest(id); },
  completeQuest(id) {
    if (!RPG.P) return false;
    if (!RPG.P.quests[id]) RPG.acceptQuest(id);
    const st = RPG.P.quests[id];
    if (!st) return false;
    if (st.state === 'active') { st.prog = RPG.QUESTS[id].alvo; st.state = 'ready'; }
    return RPG.turnInQuest(id);
  },
  killRoom() { ENT.killRoom(); },
  spawnEnemy(type, x, z, opts) { return !!ENT.spawnEnemy(type, x, z, opts || {}); },
  enemyList() {
    return ENT.enemies.map(e => ({
      t: e.boss ? 'boss:' + e.def.id : e.type,
      hp: e.hp, x: +e.ch.obj.position.x.toFixed(1), z: +e.ch.obj.position.z.toFixed(1),
      dying: !!e.dying,
    }));
  },
  get stats() { return RPG.P ? RPG.stats() : null; },
  gotoBoss(n) {
    GAME.teleport('d' + (n + 1), null, true);
    const p = WORLD.gotoBossRoom(n);
    ENT.placeHero(p.x, p.z);
  },
  damageHero(n) { H.iframes = 0; ENT.hurtHero(n); },
  vacuum() { ENT.vacuumDrops(); },
  skipDialog() { UI.skipDialog(); },
  interact() { doInteract(); },
  save() { RPG.save(); },
  openShop(kind) { UI.openShop(kind); },
  openInv() { UI.openInv(); },
  openQlog() { UI.openQlog(); },
  clearSave() { try { localStorage.removeItem('bruxaria_save'); } catch (e) {} },
  setDayT(t) { WORLD.setDayT(t); },
};
