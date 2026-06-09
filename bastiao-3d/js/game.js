// ============================================================
// ÚLTIMO BASTIÃO 3D — A Cripta
// Survivors + tower defense isométrico (estilo Diablo)
// Three.js + Graveyard Kit / Tower Defense Kit da Kenney (CC0)
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from '../lib/loaders/GLTFLoader.js';

// ------------------------------------------------------------
// Constantes de design (1 unidade = 1 metro)
// ------------------------------------------------------------
const ARENA_R = 30;          // raio jogável
const SPAWN_R = 33;          // onde os mortos surgem
const BASE_RING = 3.4;       // anel onde zumbis param para bater na muralha
const PAD_POS = new THREE.Vector3(0, 0.06, 5.2);

const TOWER_LEVELS = [
  { cost: 0,   name: 'RUÍNA',           rate: 0,    dmg: 0,  range: 0,  baseHp: 500 },
  { cost: 60,  name: 'BALISTA',         rate: 1000, dmg: 18, range: 11, baseHp: 650 },
  { cost: 180, name: 'BALISTA DUPLA',   rate: 600,  dmg: 22, range: 13, baseHp: 800 },
  { cost: 360, name: 'CANHÃO + TORRES', rate: 700,  dmg: 34, range: 14, baseHp: 1000 },
  { cost: 600, name: 'CATAPULTA',       rate: 1400, dmg: 70, range: 17, baseHp: 1250 },
];

const WEAPON_LEVELS = [
  { kills: 0,   name: 'PISTOLA',      rate: 380, dmg: 12, shots: 1, model: 'pistol' },
  { kills: 35,  name: 'SILENCIADA',   rate: 290, dmg: 14, shots: 1, model: 'pistolSilencer' },
  { kills: 90,  name: 'ESPINGARDA',   rate: 200, dmg: 17, shots: 1, model: 'shotgunShort' },
  { kills: 180, name: 'UZI',          rate: 170, dmg: 19, shots: 2, model: 'uzi' },
  { kills: 320, name: 'METRALHADORA', rate: 120, dmg: 22, shots: 3, model: 'machinegun' },
];

const LAST_WAVE = 12;

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------
// Renderer, cena, câmera isométrica
// ------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c14);
scene.fog = new THREE.Fog(0x0a0c14, 30, 58);

let VIEW = 11;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
function sizeCamera() {
  const a = window.innerWidth / window.innerHeight;
  camera.left = -VIEW * a; camera.right = VIEW * a;
  camera.top = VIEW; camera.bottom = -VIEW;
  camera.updateProjectionMatrix();
}
sizeCamera();
const CAM_OFF = new THREE.Vector3(15, 19, 15);

window.addEventListener('resize', () => {
  sizeCamera();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// luzes: noite de lua + tocha do guardião + braseiros
scene.add(new THREE.AmbientLight(0x46507a, 1.15));
const moon = new THREE.DirectionalLight(0x8a96d8, 1.1);
moon.position.set(18, 28, 8);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -34; moon.shadow.camera.right = 34;
moon.shadow.camera.top = 34; moon.shadow.camera.bottom = -34;
moon.shadow.camera.far = 90;
scene.add(moon);

const torch = new THREE.PointLight(0xff9c50, 28, 13, 1.8);
torch.position.set(0, 2.2, 8);
scene.add(torch);

const braziers = [];
for (const [x, z] of [[-2.6, 2.6], [2.6, -2.6]]) {
  const l = new THREE.PointLight(0xff7830, 18, 9, 1.8);
  l.position.set(x, 1.6, z);
  scene.add(l);
  braziers.push(l);
}

// chão
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(70, 48),
  new THREE.MeshLambertMaterial({ color: 0x1c2a1c })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ------------------------------------------------------------
// Carregamento de modelos
// ------------------------------------------------------------
const MODELS = [
  'character-zombie', 'character-skeleton', 'character-ghost', 'character-vampire', 'character-keeper',
  'gravestone-bevel', 'gravestone-cross', 'gravestone-round', 'gravestone-broken', 'gravestone-wide',
  'crypt-small', 'crypt-small-roof', 'pine-crooked', 'pine-fall', 'pine',
  'fence-damaged', 'fence', 'iron-fence-damaged', 'lantern-candle', 'lightpost-single',
  'fire-basket', 'pumpkin-carved', 'pumpkin', 'rocks', 'rocks-tall',
  'cross-wood', 'coffin-old', 'debris', 'trunk',
  'tower-round-base', 'tower-round-bottom-a', 'tower-round-middle-a', 'tower-round-top-a',
  'tower-round-roof-a', 'tower-round-build-c',
  'weapon-ballista', 'weapon-cannon', 'weapon-catapult',
  'weapon-ammo-arrow', 'weapon-ammo-cannonball', 'weapon-ammo-boulder', 'wood-structure',
  'pistol', 'pistolSilencer', 'shotgunShort', 'uzi', 'machinegun',
];
const LIB = {};
const loader = new GLTFLoader();

function loadModel(name) {
  return new Promise((resolve, reject) => {
    loader.load('assets/models/' + name + '.glb', g => {
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        if (o.material && o.material.isMeshStandardMaterial && o.material.metalness > 0.5) {
          o.material.metalness = 0; o.material.roughness = 0.9;
        }
      });
      const box = new THREE.Box3().setFromObject(g.scene);
      LIB[name] = { scene: g.scene, animations: g.animations, size: box.getSize(new THREE.Vector3()) };
      resolve();
    }, undefined, reject);
  });
}

function makeProp(name, scale = 1) {
  const o = LIB[name].scene.clone(true);
  o.scale.setScalar(scale);
  return o;
}

// personagem animado (animações por nós — clone simples preserva nomes)
function makeChar(name, height) {
  const lib = LIB[name];
  const obj = lib.scene.clone(true);
  const s = height / lib.size.y;
  obj.scale.setScalar(s);
  const mixer = new THREE.AnimationMixer(obj);
  const actions = {};
  for (const clip of lib.animations) actions[clip.name] = mixer.clipAction(clip);
  let current = null;
  const play = (n, once = false) => {
    if (current === n || !actions[n]) return;
    const a = actions[n];
    if (once) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
    a.reset().fadeIn(0.12).play();
    if (current && actions[current]) actions[current].fadeOut(0.12);
    current = n;
  };
  return { obj, mixer, actions, play, get current() { return current; } };
}

// ------------------------------------------------------------
// Estado do jogo
// ------------------------------------------------------------
const ST = { MENU: 0, PLAYING: 1, OVER: 2 };
let state = ST.MENU;
let G = null;            // estado da partida
let player = null;       // personagem do jogador
const mixers = [];       // todos os AnimationMixers ativos
let towerGroup = null, towerWeapon = null, sideTurrets = [];
let padMesh = null;
let shake = 0;

const zombies = [], bullets = [], coins = [], decals = [], boulders = [];

function loadRecord() { try { return parseInt(localStorage.getItem('bastiao3d_record') || '0', 10) || 0; } catch (e) { return 0; } }
function saveRecord(w) { try { if (w > loadRecord()) localStorage.setItem('bastiao3d_record', String(w)); } catch (e) {} }

// ------------------------------------------------------------
// Construção do cenário (uma vez)
// ------------------------------------------------------------
function buildGraveyard() {
  const props = [
    ...Array(14).fill(0).map(() => ['gravestone-' + ['bevel', 'cross', 'round', 'broken', 'wide'][randi(0, 4)], rand(0.9, 1.2)]),
    ...Array(7).fill(0).map(() => [['pine', 'pine-crooked', 'pine-fall'][randi(0, 2)], rand(1.2, 1.9)]),
    ...Array(5).fill(0).map(() => [['rocks', 'rocks-tall', 'trunk', 'debris'][randi(0, 3)], rand(0.9, 1.4)]),
    ...Array(4).fill(0).map(() => [['pumpkin-carved', 'pumpkin', 'cross-wood', 'coffin-old'][randi(0, 3)], 1]),
    ...Array(5).fill(0).map(() => [['fence-damaged', 'fence', 'iron-fence-damaged'][randi(0, 2)], 1.1]),
  ];
  for (const [name, s] of props) {
    const o = makeProp(name, s);
    let x, z;
    do { const a = rand(0, Math.PI * 2), r = rand(8, ARENA_R - 1); x = Math.cos(a) * r; z = Math.sin(a) * r; }
    while (Math.hypot(x - PAD_POS.x, z - PAD_POS.z) < 4);
    o.position.set(x, 0, z);
    o.rotation.y = rand(0, Math.PI * 2);
    scene.add(o);
  }
  // postes de luz e criptas como pontos de referência
  for (const [x, z] of [[-12, -8], [11, 9], [-9, 13]]) {
    const p = makeProp('lightpost-single', 1.4);
    p.position.set(x, 0, z); p.rotation.y = rand(0, Math.PI * 2);
    scene.add(p);
    const l = new THREE.PointLight(0xffc878, 10, 8, 1.8);
    l.position.set(x, 2.6, z);
    scene.add(l);
    braziers.push(l);
  }
  for (const [x, z, ry] of [[-18, 14, 0.6], [17, -15, -2.2]]) {
    const c = makeProp('crypt-small', 1.6);
    const r = makeProp('crypt-small-roof', 1.6);
    c.position.set(x, 0, z); c.rotation.y = ry;
    r.position.set(x, LIB['crypt-small'].size.y * 1.6, z); r.rotation.y = ry;
    scene.add(c, r);
  }
  // braseiros junto à torre
  for (const [x, z] of [[-2.6, 2.6], [2.6, -2.6]]) {
    const b = makeProp('fire-basket', 1.3);
    b.position.set(x, 0, z);
    scene.add(b);
  }
  // quadrado de depósito (dourado, pulsante)
  padMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.12, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x6a5a18, emissive: 0xe8c838, emissiveIntensity: 0.5, metalness: 0, roughness: 0.6 })
  );
  padMesh.position.copy(PAD_POS);
  padMesh.receiveShadow = true;
  scene.add(padMesh);
}

// ------------------------------------------------------------
// Torre por nível
// ------------------------------------------------------------
function buildTower() {
  if (towerGroup) scene.remove(towerGroup);
  towerGroup = new THREE.Group();
  sideTurrets = [];
  const L = G.towerLevel;
  const S = 2.2;     // escala das peças
  let y = 0;

  const stack = name => {
    const p = makeProp(name, S);
    p.position.y = y;
    towerGroup.add(p);
    y += LIB[name].size.y * S;
  };

  if (L === 0) {
    stack('tower-round-build-c');     // ruína em construção
  } else {
    stack('tower-round-base');
    stack('tower-round-bottom-a');
    if (L >= 2) stack('tower-round-middle-a');
    if (L >= 3) stack('tower-round-top-a');
    // arma no topo
    const weaponName = L >= 4 ? 'weapon-catapult' : L >= 3 ? 'weapon-cannon' : 'weapon-ballista';
    towerWeapon = makeProp(weaponName, S * 0.9);
    towerWeapon.position.y = y + 0.05;
    towerGroup.add(towerWeapon);
  }
  if (L < 1) towerWeapon = null;

  // torretas laterais sobre estruturas de madeira (nível 3+)
  if (L >= 3) {
    for (const [x, z] of [[-4.6, -4.6], [4.6, 4.6]]) {
      const base = makeProp('wood-structure', 1.5);
      base.position.set(x, 0, z);
      towerGroup.add(base);
      const gun = makeProp('weapon-ballista', 1.4);
      gun.position.set(x, LIB['wood-structure'].size.y * 1.5, z);
      gun.userData = { cd: 0, target: null };
      towerGroup.add(gun);
      sideTurrets.push(gun);
    }
  }
  scene.add(towerGroup);
}

// ------------------------------------------------------------
// Entidades
// ------------------------------------------------------------
const ZOMBIE_DEFS = {
  walker:   { model: 'character-zombie',   h: 1.55, hp: w => 26 + w * 5,   spd: w => 1.5 + w * 0.06, dmg: 9,  coins: [1, 2],  anim: 'walk' },
  runner:   { model: 'character-skeleton', h: 1.5,  hp: w => 15 + w * 3.5, spd: w => 2.9 + w * 0.07, dmg: 7,  coins: [1, 2],  anim: 'sprint' },
  ghost:    { model: 'character-ghost',    h: 1.5,  hp: w => 20 + w * 4,   spd: w => 2.2 + w * 0.06, dmg: 8,  coins: [2, 3],  anim: 'walk' },
  brute:    { model: 'character-vampire',  h: 2.2,  hp: w => 140 + w * 22, spd: () => 1.1,           dmg: 24, coins: [6, 9],  anim: 'walk' },
  boss:     { model: 'character-zombie',   h: 3.4,  hp: w => w >= LAST_WAVE ? 2600 : 1100, spd: () => 0.9, dmg: 45, coins: [28, 36], anim: 'walk' },
};

function spawnZombie(forceType) {
  let type = forceType;
  if (!type) {
    const r = Math.random();
    if (G.wave >= 5 && r < 0.1 + G.wave * 0.012) type = 'brute';
    else if (G.wave >= 4 && r < 0.18) type = 'ghost';
    else if (G.wave >= 3 && r < 0.45) type = 'runner';
    else type = 'walker';
  }
  const d = ZOMBIE_DEFS[type];
  const ch = makeChar(d.model, d.h);
  const a = rand(0, Math.PI * 2);
  ch.obj.position.set(Math.cos(a) * SPAWN_R, 0, Math.sin(a) * SPAWN_R);
  scene.add(ch.obj);
  mixers.push(ch.mixer);
  ch.play(d.anim);
  zombies.push({
    ch, type, isBoss: type === 'boss',
    hp: d.hp(G.wave), maxHp: d.hp(G.wave),
    spd: d.spd(G.wave), dmg: d.dmg,
    coinDrop: randi(d.coins[0], d.coins[1]),
    attackCd: 0, retarget: 0, target: 'base', dying: 0,
    r: type === 'boss' ? 1.3 : type === 'brute' ? 0.85 : 0.55,
  });
  if (type === 'boss') G.bossAlive = true;
}

function dropCoins(pos, n) {
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(coinGeo, coinMat);
    c.position.set(pos.x + rand(-0.7, 0.7), 0.25, pos.z + rand(-0.7, 0.7));
    c.rotation.x = Math.PI / 2;
    scene.add(c);
    coins.push({ obj: c, t: rand(0, 6), life: 18 });
  }
}
const coinGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 14);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xe8c838, emissive: 0x7a6210, metalness: 0.3, roughness: 0.35 });

function addDecal(pos, scale = 1) {
  const m = new THREE.Mesh(decalGeo, decalMat.clone());
  m.position.set(pos.x, 0.02 + decals.length * 0.0004, pos.z);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = rand(0, Math.PI * 2);
  m.scale.setScalar(scale * rand(0.7, 1.1));
  scene.add(m);
  decals.push({ obj: m, life: 9 });
  if (decals.length > 50) { const d = decals.shift(); scene.remove(d.obj); }
}
const decalGeo = new THREE.CircleGeometry(0.55, 9);
const decalMat = new THREE.MeshBasicMaterial({ color: 0x5a0e0e, transparent: true, opacity: 0.75 });

const bulletGeo = new THREE.SphereGeometry(0.13, 8, 8);
const bulletMatP = new THREE.MeshBasicMaterial({ color: 0xffe080 });
const bulletMatT = new THREE.MeshBasicMaterial({ color: 0x9cffb0 });

function fireBullet(from, target, dmg, isTower, speed = 16) {
  const b = new THREE.Mesh(bulletGeo, isTower ? bulletMatT : bulletMatP);
  b.position.copy(from);
  const dir = new THREE.Vector3(target.x - from.x, 0, target.z - from.z).normalize();
  scene.add(b);
  bullets.push({ obj: b, vx: dir.x * speed, vz: dir.z * speed, dmg, life: 1.3 });
}

// catapulta: pedra em arco com dano em área
function fireBoulder(targetPos, dmg) {
  const o = makeProp('weapon-ammo-boulder', 2);
  const from = new THREE.Vector3(0, towerHeight() + 0.5, 0);
  o.position.copy(from);
  scene.add(o);
  boulders.push({ obj: o, from, to: targetPos.clone(), t: 0, dur: 0.9, dmg });
  AudioSys.play('tower', 0.4);
}

function towerHeight() {
  return towerWeapon ? towerWeapon.position.y : 2;
}

// ------------------------------------------------------------
// Partida
// ------------------------------------------------------------
function startGame() {
  // limpa entidades anteriores
  for (const z of zombies) scene.remove(z.ch.obj);
  for (const b of bullets) scene.remove(b.obj);
  for (const c of coins) scene.remove(c.obj);
  for (const d of decals) scene.remove(d.obj);
  for (const bo of boulders) scene.remove(bo.obj);
  zombies.length = bullets.length = coins.length = decals.length = boulders.length = mixers.length = 0;
  if (player) scene.remove(player.ch.obj);

  G = {
    coins: 0, deposited: 0, kills: 0,
    wave: 0, waveState: 'break', waveTimer: 4000, spawnTimer: 0,
    towerLevel: 0, weaponLevel: 0,
    playerHp: 100, playerMaxHp: 100,
    baseHp: TOWER_LEVELS[0].baseHp, baseMaxHp: TOWER_LEVELS[0].baseHp,
    fireTimer: 0, towerTimer: 0, towerScan: 0, depositCd: 0, hurtCd: 0,
    bossAlive: false, over: false, victory: false, runTime: 0,
  };

  const ch = makeChar('character-keeper', 1.6);
  ch.obj.position.set(0, 0, 8);
  scene.add(ch.obj);
  mixers.push(ch.mixer);
  ch.play('idle');
  player = { ch, pos: ch.obj.position };
  equipWeapon(WEAPON_LEVELS[0].model);

  buildTower();
  state = ST.PLAYING;
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('end').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('tower-info').classList.remove('hidden');
  AudioSys.play('confirm', 0.7);
  AudioSys.playMusic('game');
  announce('COLETE MOEDAS E DEPOSITE\nNO QUADRADO DOURADO', 2400);
}

function endGame(victory, reason) {
  if (G.over) return;
  G.over = true; G.victory = victory;
  state = ST.OVER;
  saveRecord(victory ? G.wave : G.wave - 1);
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('tower-info').classList.add('hidden');
  const end = document.getElementById('end');
  end.classList.remove('hidden');
  document.getElementById('end-title').textContent = victory ? 'A NOITE PASSOU!' : 'FIM DA LINHA';
  document.getElementById('end-title').style.color = victory ? '#e8c838' : '';
  document.getElementById('end-reason').textContent = victory
    ? 'As 12 ondas foram contidas. O sol nasce sobre o cemitério — e o bastião ainda está de pé.'
    : reason;
  document.getElementById('end-stats').innerHTML =
    'ondas: ' + G.wave + '/' + LAST_WAVE + ' · abates: ' + G.kills +
    '<br>depósito: ' + G.deposited + ' moedas · torre: ' + TOWER_LEVELS[G.towerLevel].name +
    '<br>recorde de ondas: ' + loadRecord();
  document.getElementById('btn-retry').textContent = victory ? 'JOGAR DE NOVO ⏎' : 'TENTAR DE NOVO ⏎';
  AudioSys.playMusic(victory ? 'menu' : 'gameover');
}

// ------------------------------------------------------------
// HUD
// ------------------------------------------------------------
const $ = id => document.getElementById(id);
let announceTimer = null;
function announce(msg, dur = 1800) {
  const el = $('announce');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => el.classList.remove('show'), dur);
}

function updateHUD() {
  $('coins').textContent = '⬤ ' + G.coins;
  $('kills').textContent = 'abates: ' + G.kills;
  $('weapon').textContent = 'arma: ' + WEAPON_LEVELS[G.weaponLevel].name;
  $('wave').textContent = G.waveState === 'break' && G.wave < LAST_WAVE ? 'PREPARE-SE...' : 'ONDA ' + G.wave + '/' + LAST_WAVE;
  $('hp-player').style.width = clamp(G.playerHp / G.playerMaxHp * 100, 0, 100) + '%';
  $('hp-base').style.width = clamp(G.baseHp / G.baseMaxHp * 100, 0, 100) + '%';
  const next = TOWER_LEVELS[G.towerLevel + 1];
  if (next) {
    $('tower-name').textContent = 'TORRE: ' + TOWER_LEVELS[G.towerLevel].name + ' → depósito ' + G.deposited + '/' + next.cost;
    $('tower-fill').style.width = clamp(G.deposited / next.cost * 100, 0, 100) + '%';
  } else {
    $('tower-name').textContent = 'TORRE: ' + TOWER_LEVELS[G.towerLevel].name + ' (MÁX)';
    $('tower-fill').style.width = '100%';
  }
}

function hurtFlash() {
  const v = $('vignette');
  v.classList.add('hurt');
  setTimeout(() => v.classList.remove('hurt'), 220);
}

// ------------------------------------------------------------
// Entrada
// ------------------------------------------------------------
const keys = {};
let joy = null;
window.addEventListener('keydown', e => {
  AudioSys.unlock();
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'Enter') {
    if (state === ST.MENU) startGame();
    else if (state === ST.OVER) startGame();
  }
  if (e.key === 'm' || e.key === 'M') AudioSys.toggleMute();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('pointerdown', e => {
  AudioSys.unlock();
  if (e.target.closest('.overlay, button, a')) return;
  joy = { ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
});
window.addEventListener('pointermove', e => { if (joy) { joy.x = e.clientX; joy.y = e.clientY; } });
window.addEventListener('pointerup', () => { joy = null; });
$('btn-start').addEventListener('click', () => { AudioSys.unlock(); startGame(); });
$('btn-retry').addEventListener('click', () => { AudioSys.unlock(); startGame(); });

// ------------------------------------------------------------
// Lógica por quadro
// ------------------------------------------------------------
function nearestZombie(x, z, range) {
  let best = null, bd = range * range;
  for (const zb of zombies) {
    if (zb.dying) continue;
    const d = (zb.ch.obj.position.x - x) ** 2 + (zb.ch.obj.position.z - z) ** 2;
    if (d < bd) { bd = d; best = zb; }
  }
  return best;
}

function damageZombie(zb, dmg) {
  if (zb.dying) return;
  zb.hp -= dmg;
  flashChar(zb.ch, 0xff5050);
  if (zb.hp <= 0) {
    zb.dying = 0.9;
    zb.ch.play('die', true);
    G.kills++;
    addDecal(zb.ch.obj.position, zb.isBoss ? 2.6 : 1);
    dropCoins(zb.ch.obj.position, zb.coinDrop);
    AudioSys.play(Math.random() < 0.5 ? 'zdie1' : 'zdie2', 0.4);
    if (zb.isBoss) {
      G.bossAlive = false;
      shake = 0.5;
      announce('GIGANTE ABATIDO!');
      AudioSys.play('boom', 0.8);
    }
    checkWeaponUpgrade();
  }
}

function flashChar(ch, color) {
  ch.obj.traverse(o => {
    if (o.isMesh && o.material) {
      if (!o.userData.baseEmissive) o.userData.baseEmissive = o.material.emissive ? o.material.emissive.clone() : null;
      if (o.material.emissive) { o.material = o.material.clone(); o.material.emissive.setHex(color); o.material.emissiveIntensity = 0.7; }
    }
  });
  setTimeout(() => {
    ch.obj.traverse(o => {
      if (o.isMesh && o.material && o.material.emissive && o.userData.baseEmissive) {
        o.material.emissive.copy(o.userData.baseEmissive);
        o.material.emissiveIntensity = 1;
      }
    });
  }, 80);
}

// prende a arma na mão direita — os nós do braço seguem as animações.
// braço do boneco estende-se pelo −X local (mão em x≈−0,28);
// armas do Weapon Pack têm o cano no −Z.
function equipWeapon(model) {
  const arm = player.ch.obj.getObjectByName('arm-right');
  if (!arm) return;
  if (player.weaponMesh && player.weaponMesh.parent) player.weaponMesh.parent.remove(player.weaponMesh);
  const inner = LIB[model].scene.clone(true);
  const box = new THREE.Box3().setFromObject(inner);
  const len = box.max.z - box.min.z;
  // empunhadura fica no lado −Z do modelo; boca do cano no +Z
  inner.position.set(
    -(box.min.x + box.max.x) / 2,
    -(box.min.y + box.max.y) / 2,
    -box.min.z - len * 0.14
  );
  const grip = new THREE.Group();
  grip.add(inner);
  grip.rotation.y = -Math.PI / 2;       // boca do cano (+Z) aponta para fora do braço (−X)
  grip.scale.setScalar(0.30 / len);     // ~1/3 da altura do boneco
  grip.position.set(-0.29, 0, 0);       // na mão (ponta do braço)
  arm.add(grip);
  player.weaponMesh = grip;
}

function checkWeaponUpgrade() {
  const next = WEAPON_LEVELS[G.weaponLevel + 1];
  if (!next || G.kills < next.kills) return;
  G.weaponLevel++;
  equipWeapon(next.model);
  AudioSys.play('upgrade', 0.8);
  announce('ARMA NOVA!\n' + next.name);
}

function checkTowerUpgrade() {
  let up = null;
  while (TOWER_LEVELS[G.towerLevel + 1] && G.deposited >= TOWER_LEVELS[G.towerLevel + 1].cost) {
    G.towerLevel++;
    up = TOWER_LEVELS[G.towerLevel];
    G.baseMaxHp = up.baseHp;
    G.baseHp = Math.min(G.baseMaxHp, G.baseHp + Math.round(up.baseHp * 0.35));
  }
  if (!up) return;
  buildTower();
  AudioSys.play('upgrade', 0.9);
  shake = 0.35;
  announce('TORRE EVOLUIU!\n' + up.name);
}

function hitBase(zb) {
  G.baseHp -= zb.dmg;
  AudioSys.play('bite', 0.45);
  shake = Math.min(0.4, shake + 0.12);
  // flash na torre
  if (towerGroup) {
    towerGroup.traverse(o => { if (o.isMesh && o.material && o.material.emissive) { o.material = o.material.clone(); o.material.emissive.setHex(0x8a1010); } });
    setTimeout(() => towerGroup && towerGroup.traverse(o => { if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(0x000000); }), 110);
  }
  if (G.baseHp <= 0) endGame(false, 'A torre ruiu. O cemitério consumiu o último bastião.');
}

function startWave() {
  G.wave++;
  G.waveState = 'active';
  G.waveTimer = 26000 + G.wave * 1500;
  G.spawnTimer = 400;
  announce('ONDA ' + G.wave, G.wave === LAST_WAVE ? 2400 : 1600);
  AudioSys.play('confirm', 0.6);
  if (G.wave === 6 || G.wave === LAST_WAVE) setTimeout(() => state === ST.PLAYING && spawnZombie('boss'), 2500);
}

// ------------------------------------------------------------
// Loop principal
// ------------------------------------------------------------
const clock = new THREE.Clock();
let time = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  time += dt;

  // braseiros tremulam
  braziers.forEach((l, i) => { l.intensity = l.userData.base || (l.userData.base = l.intensity); l.intensity *= 0.85 + 0.3 * Math.abs(Math.sin(time * 11 + i * 2)); });
  if (padMesh) padMesh.material.emissiveIntensity = 0.35 + 0.3 * Math.sin(time * 4);

  for (const m of mixers) m.update(dt);

  if (state === ST.PLAYING) updateGame(dt);

  // câmera segue o guardião (ou a torre no menu)
  const focus = player ? player.pos : new THREE.Vector3(0, 0, 0);
  const wantPos = new THREE.Vector3().copy(focus).add(CAM_OFF);
  camera.position.lerp(wantPos, 0.08);
  const look = new THREE.Vector3().copy(focus);
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 1.4);
    look.x += rand(-shake, shake); look.z += rand(-shake, shake);
  }
  camera.lookAt(look);
  if (player) torch.position.set(player.pos.x, 2.2, player.pos.z);

  renderer.render(scene, camera);
}

function updateGame(dt) {
  const ms = dt * 1000;
  G.runTime += dt;
  G.hurtCd = Math.max(0, G.hurtCd - ms);

  // ---- movimento do guardião ----
  let vx = 0, vz = 0;
  if (keys['a'] || keys['arrowleft']) vx -= 1;
  if (keys['d'] || keys['arrowright']) vx += 1;
  if (keys['w'] || keys['arrowup']) vz -= 1;
  if (keys['s'] || keys['arrowdown']) vz += 1;
  if (joy) {
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy;
    const d = Math.hypot(dx, dy);
    if (d > 14) { vx = dx / d; vz = dy / d; }
  }
  // converte direção de tela para o plano isométrico (câmera a 45°):
  // direita na tela = mundo (+x,−z); baixo na tela = mundo (+x,+z)
  const iso = Math.SQRT1_2;
  const wx = (vx + vz) * iso, wz = (vz - vx) * iso;
  const moving = !!(vx || vz);
  const SPD = 5.2;
  if (moving) {
    player.pos.x = clamp(player.pos.x + wx * SPD * dt, -ARENA_R, ARENA_R);
    player.pos.z = clamp(player.pos.z + wz * SPD * dt, -ARENA_R, ARENA_R);
    // não atravessa a torre
    const dc = Math.hypot(player.pos.x, player.pos.z);
    if (dc < 2.6) { player.pos.x *= 2.6 / dc; player.pos.z *= 2.6 / dc; }
    player.ch.obj.rotation.y = Math.atan2(wx, wz);
  }

  // ---- tiro automático ----
  G.fireTimer -= ms;
  const wd = WEAPON_LEVELS[G.weaponLevel];
  const tgt = nearestZombie(player.pos.x, player.pos.z, 9.5);
  if (tgt) {
    const tp = tgt.ch.obj.position;
    player.ch.obj.rotation.y = Math.atan2(tp.x - player.pos.x, tp.z - player.pos.z);
    if (G.fireTimer <= 0) {
      G.fireTimer = wd.rate;
      for (let i = 0; i < wd.shots; i++) {
        const off = (i - (wd.shots - 1) / 2) * 0.7;
        fireBullet(new THREE.Vector3(player.pos.x, 1.1, player.pos.z),
          { x: tp.x + off, z: tp.z + off }, wd.dmg, false);
      }
      AudioSys.play('shot', 0.2);
    }
  }
  player.ch.play(moving ? 'sprint' : (tgt ? 'holding-both-shoot' : 'idle'));

  // ---- depósito no quadrado ----
  G.depositCd -= ms;
  const onPad = Math.hypot(player.pos.x - PAD_POS.x, player.pos.z - PAD_POS.z) < 1.7;
  if (onPad && G.coins > 0 && G.depositCd <= 0) {
    G.depositCd = 200;
    const n = Math.min(G.coins, 2);
    G.coins -= n; G.deposited += n;
    AudioSys.play('coin', 0.25);
    checkTowerUpgrade();
  }

  // ---- torre: arma gira e atira ----
  const td = TOWER_LEVELS[G.towerLevel];
  if (td.rate > 0 && towerWeapon) {
    G.towerScan -= ms;
    if (G.towerScan <= 0 || (G.towerTarget && (G.towerTarget.dying || G.towerTarget.hp <= 0))) {
      G.towerScan = 150;
      G.towerTarget = nearestZombie(0, 0, td.range);
    }
    if (G.towerTarget && !G.towerTarget.dying) {
      const tp = G.towerTarget.ch.obj.position;
      const want = Math.atan2(tp.x, tp.z);
      let diff = want - towerWeapon.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      towerWeapon.rotation.y += clamp(diff, -6 * dt, 6 * dt);
    }
    G.towerTimer -= ms;
    if (G.towerTimer <= 0 && G.towerTarget && !G.towerTarget.dying) {
      G.towerTimer = td.rate;
      const tp = G.towerTarget.ch.obj.position;
      if (G.towerLevel >= 4) fireBoulder(tp, td.dmg);
      else {
        fireBullet(new THREE.Vector3(0, towerHeight() + 0.4, 0), { x: tp.x, z: tp.z }, td.dmg, true, 18);
        if (G.towerLevel >= 2) setTimeout(() => {
          if (state === ST.PLAYING && G.towerTarget && !G.towerTarget.dying) {
            const p2 = G.towerTarget.ch.obj.position;
            fireBullet(new THREE.Vector3(0, towerHeight() + 0.4, 0), { x: p2.x, z: p2.z }, td.dmg, true, 18);
          }
        }, 120);
        AudioSys.play('tower', 0.25);
      }
    }
    // torretas laterais independentes
    for (const gun of sideTurrets) {
      gun.userData.cd -= ms;
      if (!gun.userData.target || gun.userData.target.dying) {
        gun.userData.target = nearestZombie(gun.position.x, gun.position.z, 10);
      }
      const t = gun.userData.target;
      if (t && !t.dying) {
        const tp = t.ch.obj.position;
        const want = Math.atan2(tp.x - gun.position.x, tp.z - gun.position.z);
        let diff = want - gun.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        gun.rotation.y += clamp(diff, -7 * dt, 7 * dt);
        if (gun.userData.cd <= 0) {
          gun.userData.cd = 900;
          fireBullet(new THREE.Vector3(gun.position.x, gun.position.y + 0.4, gun.position.z), { x: tp.x, z: tp.z }, 12, true, 16);
        }
      }
    }
  }

  // ---- zumbis ----
  for (let i = zombies.length - 1; i >= 0; i--) {
    const zb = zombies[i];
    const zp = zb.ch.obj.position;
    if (zb.dying) {
      zb.dying -= dt;
      if (zb.dying <= 0) { scene.remove(zb.ch.obj); zombies.splice(i, 1); }
      continue;
    }
    zb.attackCd = Math.max(0, zb.attackCd - ms);
    zb.retarget -= ms;
    if (zb.retarget <= 0) {
      zb.retarget = 400;
      const dp = Math.hypot(zp.x - player.pos.x, zp.z - player.pos.z);
      const db = Math.hypot(zp.x, zp.z);
      zb.target = (zb.isBoss || db < dp * 1.15) ? 'base' : 'player';
    }
    const db = Math.hypot(zp.x, zp.z);
    const tx = zb.target === 'base' ? 0 : player.pos.x;
    const tz = zb.target === 'base' ? 0 : player.pos.z;
    const dist = Math.hypot(tx - zp.x, tz - zp.z);

    if (zb.target === 'base' && db < BASE_RING) {
      // bate na muralha
      zb.ch.obj.rotation.y = Math.atan2(-zp.x, -zp.z);
      if (zb.attackCd <= 0) {
        zb.attackCd = 900;
        zb.ch.play('attack-melee-right', true);
        setTimeout(() => !zb.dying && zb.ch.play(ZOMBIE_DEFS[zb.type].anim), 600);
        hitBase(zb);
      }
    } else if (zb.target === 'player' && dist < 1.15 + zb.r) {
      // morde o guardião
      zb.ch.obj.rotation.y = Math.atan2(player.pos.x - zp.x, player.pos.z - zp.z);
      if (zb.attackCd <= 0 && G.hurtCd <= 0) {
        zb.attackCd = 800; G.hurtCd = 450;
        zb.ch.play('attack-melee-right', true);
        setTimeout(() => !zb.dying && zb.ch.play(ZOMBIE_DEFS[zb.type].anim), 600);
        G.playerHp -= zb.dmg;
        AudioSys.play('hurt', 0.5);
        hurtFlash();
        shake = Math.min(0.35, shake + 0.1);
        if (G.playerHp <= 0) { endGame(false, 'O guardião tombou. A horda venceu a noite.'); return; }
      }
    } else {
      const ang = Math.atan2(tx - zp.x, tz - zp.z);
      zp.x += Math.sin(ang) * zb.spd * dt;
      zp.z += Math.cos(ang) * zb.spd * dt;
      zb.ch.obj.rotation.y = ang;
      if (zb.type === 'ghost') zp.y = 0.25 + Math.sin(time * 3 + i) * 0.15;
    }
    // nunca por cima da torre
    if (db < 2.3) { zp.x *= 2.3 / db; zp.z *= 2.3 / db; }
  }

  // ---- projéteis ----
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    b.obj.position.x += b.vx * dt;
    b.obj.position.z += b.vz * dt;
    let hit = false;
    for (const zb of zombies) {
      if (zb.dying) continue;
      const zp = zb.ch.obj.position;
      if (Math.hypot(zp.x - b.obj.position.x, zp.z - b.obj.position.z) < 0.45 + zb.r) {
        damageZombie(zb, b.dmg);
        hit = true;
        break;
      }
    }
    if (hit || b.life <= 0) { scene.remove(b.obj); bullets.splice(i, 1); }
  }

  // ---- pedras da catapulta ----
  for (let i = boulders.length - 1; i >= 0; i--) {
    const bo = boulders[i];
    bo.t += dt / bo.dur;
    if (bo.t >= 1) {
      scene.remove(bo.obj);
      boulders.splice(i, 1);
      shake = Math.min(0.45, shake + 0.2);
      AudioSys.play('boom', 0.5);
      addDecal(bo.to, 2);
      for (const zb of zombies) {
        if (zb.dying) continue;
        const zp = zb.ch.obj.position;
        if (Math.hypot(zp.x - bo.to.x, zp.z - bo.to.z) < 2.4) damageZombie(zb, bo.dmg);
      }
      continue;
    }
    bo.obj.position.lerpVectors(bo.from, bo.to, bo.t);
    bo.obj.position.y = bo.from.y + Math.sin(bo.t * Math.PI) * 5 - bo.t * (bo.from.y - 0.3);
    bo.obj.rotation.x += 4 * dt;
  }

  // ---- moedas (ímã) ----
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.t += dt; c.life -= dt;
    c.obj.rotation.z += 3 * dt;
    c.obj.position.y = 0.25 + Math.sin(c.t * 4) * 0.08;
    const d = Math.hypot(c.obj.position.x - player.pos.x, c.obj.position.z - player.pos.z);
    if (d < 3.4) {
      const pull = (3.4 - d) * 4 + 2.5;
      c.obj.position.x += (player.pos.x - c.obj.position.x) / d * pull * dt;
      c.obj.position.z += (player.pos.z - c.obj.position.z) / d * pull * dt;
    }
    if (d < 0.8) {
      scene.remove(c.obj); coins.splice(i, 1);
      G.coins++;
      AudioSys.play('coin', 0.3);
      continue;
    }
    if (c.life <= 0) { scene.remove(c.obj); coins.splice(i, 1); }
  }

  // ---- decalques de sangue somem ----
  for (let i = decals.length - 1; i >= 0; i--) {
    const d = decals[i];
    d.life -= dt;
    if (d.life < 2) d.obj.material.opacity = 0.75 * (d.life / 2);
    if (d.life <= 0) { scene.remove(d.obj); decals.splice(i, 1); }
  }

  // ---- diretor de ondas ----
  if (G.waveState === 'break') {
    G.waveTimer -= ms;
    if (G.waveTimer <= 0) startWave();
  } else {
    G.waveTimer -= ms;
    G.spawnTimer -= ms;
    if (G.waveTimer > 0 && G.spawnTimer <= 0) {
      G.spawnTimer = Math.max(330, 1500 - G.wave * 95);
      spawnZombie();
      if (G.wave >= 8 && Math.random() < 0.35) spawnZombie();
    }
    if (G.waveTimer <= 0 && zombies.length === 0 && !G.bossAlive) {
      if (G.wave >= LAST_WAVE) { endGame(true, ''); return; }
      G.waveState = 'break';
      G.waveTimer = 6000;
      announce('ONDA ' + G.wave + ' SOBREVIVIDA!');
      G.playerHp = Math.min(G.playerMaxHp, G.playerHp + 20);
    }
  }

  updateHUD();
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
AudioSys.load();
$('record').textContent = loadRecord();

Promise.all(MODELS.map(loadModel)).then(() => {
  buildGraveyard();
  G = { towerLevel: 0 };   // torre de vitrine no menu
  buildTower();
  document.getElementById('loading').classList.add('hidden');
  AudioSys.playMusic('menu');
  tick();
}).catch(err => {
  console.error('Erro ao carregar modelos:', err);
  document.getElementById('loading').innerHTML = '<p class="story">Erro ao carregar os modelos 3D — veja o console.</p>';
});

// handle de testes
window.__B3 = {
  get state() { return state; },
  get wave() { return G ? G.wave : -1; },
  get coins() { return G ? G.coins : 0; },
  get deposited() { return G ? G.deposited : 0; },
  get towerLevel() { return G ? G.towerLevel : 0; },
  get zombies() { return zombies.length; },
  get playerHp() { return G ? G.playerHp : 0; },
  get baseHp() { return G ? G.baseHp : 0; },
  get kills() { return G ? G.kills : 0; },
  get models() { return Object.keys(LIB).length; },
  get over() { return G ? !!G.over : false; },
  addCoins: n => { if (G) G.coins += n; },
  setPos: (x, z) => { if (player) { player.pos.x = x; player.pos.z = z; } },
  get pos() { return player ? { x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2) } : null; },
};
