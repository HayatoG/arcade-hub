// ============================================================
// BATE-ASA — o pinguim que decidiu voar
// Flappy Bird 3D num parque de diversões
// Three.js + Coaster Kit / Cube Pets / Toy Car Kit (Kenney, CC0)
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from '../lib/loaders/GLTFLoader.js';

// ------------------------------------------------------------
// Constantes e helpers
// ------------------------------------------------------------
const CORW = 7;            // meia-largura do corredor de voo
const CEIL = 13.2;         // teto (bonk)
const WALL_H = 14;         // altura visual das paredes de pilares
const GROUND_Y = 0;        // chão
const PLAYER_R = 0.42;     // raio de colisão

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];

const LS = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

// ------------------------------------------------------------
// Renderer, cena, câmera, luzes
// ------------------------------------------------------------
const AUTO = new URLSearchParams(location.search).has('auto');

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: AUTO });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.3, 400);
camera.position.set(0, 4, 10);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const hemi = new THREE.HemisphereLight(0xffffff, 0x6a8c5a, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 5; sun.shadow.camera.far = 220;
sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(sun.target);

// ------------------------------------------------------------
// Alas do parque (biomas)
// ------------------------------------------------------------
const ALAS = [
  {
    name: 'ALA MADEIRA', pilar: 'wood',
    loop: 'coaster-wood-looping', rail: 'coaster-wood-track', train: 'coaster-train-wooden',
    sky: 0xaee3f5, fog: 0xc4ecf7, ground: 0x7fb069, hemi: 1.0, sunI: 1.5, night: false,
  },
  {
    name: 'ALA AÇO', pilar: 'steel',
    loop: 'coaster-steel-looping', rail: 'coaster-steel-track', train: 'coaster-train',
    sky: 0xf4b46a, fog: 0xf7cc92, ground: 0x9c8a5a, hemi: 0.9, sunI: 1.6, night: false,
  },
  {
    name: 'ALA FLUME', pilar: 'flume',
    loop: 'coaster-flume-looping', rail: 'coaster-flume-track', train: 'train-log-flume',
    sky: 0x6fd6c2, fog: 0x9ce8d9, ground: 0x3a9e8c, hemi: 1.0, sunI: 1.4, night: false,
  },
  {
    name: 'ALA NEON', pilar: 'steel',
    loop: 'coaster-steel-looping', rail: 'coaster-steel-track', train: 'coaster-train-front',
    sky: 0x140f33, fog: 0x241a4d, ground: 0x1d2a3a, hemi: 0.42, sunI: 0.5, night: true,
  },
];
const ALA_LEN = 12;                  // pontos por ala
let alaIdx = 0;
const skyColor = new THREE.Color(ALAS[0].sky);
const fogColor = new THREE.Color(ALAS[0].fog);
const groundColor = new THREE.Color(ALAS[0].ground);
const skyTarget = skyColor.clone(), fogTarget = fogColor.clone(), groundTarget = groundColor.clone();
scene.background = skyColor;
scene.fog = new THREE.Fog(fogColor, 30, 150);

// ------------------------------------------------------------
// Carregamento de modelos
// ------------------------------------------------------------
const MODELS = [
  'support-large', 'support-large-bottom',
  'coaster-wood-looping', 'coaster-steel-looping', 'coaster-flume-looping',
  'coaster-wood-track', 'coaster-steel-track', 'coaster-flume-track',
  'coaster-train', 'coaster-train-front', 'coaster-train-wooden', 'train-log-flume',
  'tree', 'tree-large', 'flowers', 'grass',
  'stall-food', 'stall-drinks', 'stall-information', 'bench', 'trash',
  'park-entrance', 'ride-entrance', 'station-gate',
  'item-coin-gold', 'item-box', 'star',
  'animal-penguin', 'animal-chick', 'animal-parrot',
];
const LIB = {};       // nome -> { scene, size }
const loader = new GLTFLoader();

function loadModel(name) {
  return new Promise((resolve, reject) => {
    loader.load('assets/models/' + name + '.glb', g => {
      const root = g.scene;
      root.traverse(o => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; }
      });
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      LIB[name] = { scene: root, size, min: box.min.clone(), center };
      resolve();
    }, undefined, reject);
  });
}

// clona um modelo escalado: a maior dimensão do footprint (x/z) vira `fit`
// (axis:'y' usa a altura como referência)
function spawn(name, fit, axis) {
  const m = LIB[name];
  const obj = m.scene.clone(true);
  const ref = axis === 'y' ? m.size.y : Math.max(m.size.x, m.size.z);
  const s = fit / (ref || 1);
  obj.scale.setScalar(s);
  return obj;
}

// ------------------------------------------------------------
// Estado do jogo
// ------------------------------------------------------------
const ST = { LOADING: 0, MENU: 1, PLAY: 2, DYING: 3, END: 4 };
let state = ST.LOADING;
let paused = false;

const G = {
  score: 0, fichas: 0, loops: 0, raspoes: 0, bestCombo: 0, combo: 0,
  impeto: 0, rajadaT: 0, shieldOn: false, magnetT: 0, invulnT: 0,
  speed: 11, dist: 0, time: 0,
  record: parseInt(LS.get('bateasa_record', '0'), 10) || 0,
};

// dificuldade 0..1
const diff = () => clamp(G.score / 60, 0, 1);

// ------------------------------------------------------------
// Jogador
// ------------------------------------------------------------
const SKINS = [
  { file: 'animal-penguin', name: 'PINGUIM "TORPEDO"', req: 0, hint: '' },
  { file: 'animal-chick',   name: 'PINTINHO VETERANO', req: 15, hint: 'recorde 15 — a estrela de TRAVESSIA' },
  { file: 'animal-parrot',  name: 'PAPAGAIO FANFARRÃO', req: 30, hint: 'recorde 30 — ele JÁ sabia voar' },
];
let skinIdx = clamp(parseInt(LS.get('bateasa_skin', '0'), 10) || 0, 0, SKINS.length - 1);
if (G.record < SKINS[skinIdx].req) skinIdx = 0;

const player = {
  pos: new THREE.Vector3(0, 6, 0),
  vy: 0, vx: 0,
  group: new THREE.Group(),   // posição no mundo
  body: null,                 // modelo (troca por skin)
  flapAnim: 0, diveHold: false, spin: 0,
};
scene.add(player.group);

// bolha de escudo
const bubble = new THREE.Mesh(
  new THREE.SphereGeometry(0.85, 18, 14),
  new THREE.MeshBasicMaterial({ color: 0x7df0ff, transparent: true, opacity: 0.28, depthWrite: false })
);
bubble.visible = false;
player.group.add(bubble);

function setSkin(i) {
  skinIdx = i;
  if (player.body) player.group.remove(player.body);
  player.body = spawn(SKINS[i].file, 1.0);
  player.baseS = player.body.scale.x;     // escala natural do modelo normalizado
  player.body.rotation.y = Math.PI;       // de costas pra câmera, voando pra -Z
  // centraliza verticalmente no grupo
  const b = new THREE.Box3().setFromObject(player.body);
  const c = b.getCenter(new THREE.Vector3());
  player.body.position.y -= c.y;
  player.group.add(player.body);
}

// ------------------------------------------------------------
// Chão e decoração lateral
// ------------------------------------------------------------
const groundMat = new THREE.MeshLambertMaterial({ color: groundColor });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 420), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = GROUND_Y;
ground.receiveShadow = true;
scene.add(ground);

// faixa central de "caminho" do parque
const pathMat = new THREE.MeshLambertMaterial({ color: 0xd8c39a });
const path = new THREE.Mesh(new THREE.PlaneGeometry(5, 420), pathMat);
path.rotation.x = -Math.PI / 2;
path.position.y = GROUND_Y + 0.02;
scene.add(path);

const DECOR_KINDS = [
  { name: 'tree', fit: 2.6 }, { name: 'tree', fit: 3.2 }, { name: 'tree-large', fit: 4.2 },
  { name: 'stall-food', fit: 3.4 }, { name: 'stall-drinks', fit: 3.2 },
  { name: 'stall-information', fit: 3.0 }, { name: 'bench', fit: 1.6 },
  { name: 'trash', fit: 0.9 }, { name: 'flowers', fit: 1.4 }, { name: 'grass', fit: 1.3 },
  { name: 'ride-entrance', fit: 4.4 }, { name: 'station-gate', fit: 4.0 },
  { name: 'park-entrance', fit: 6.0 },
];
const decor = [];
function makeDecor(z) {
  const k = pick(DECOR_KINDS);
  const obj = spawn(k.name, k.fit);
  const side = Math.random() < 0.5 ? -1 : 1;
  obj.position.set(side * rand(10, 22), GROUND_Y, z);
  obj.rotation.y = rand(0, Math.PI * 2);
  scene.add(obj);
  decor.push(obj);
}

// ------------------------------------------------------------
// Materiais dos pilares por ala
// ------------------------------------------------------------
const PILAR_TINT = { wood: 0xb98a5a, steel: 0xc6cdd4, flume: 0x7fc8e0 };

// cache de materiais tingidos (evita um clone de material por mesh)
const tintCache = new Map();
function tintedMaterial(mat, tint, neon) {
  const key = mat.uuid + '|' + tint + '|' + (neon ? 1 : 0);
  let m = tintCache.get(key);
  if (!m) {
    m = mat.clone();
    if (m.color) m.color.lerp(new THREE.Color(tint), 0.45);
    if (neon && m.emissive) m.emissive = new THREE.Color(0xff2d7a).multiplyScalar(0.3);
    tintCache.set(key, m);
  }
  return m;
}

// pilares: support-large com o fuste esticado até a altura pedida
function makeColumn(height, tint, neon) {
  const grp = new THREE.Group();
  const base = spawn('support-large-bottom', 0.95);
  grp.add(base);
  const shaft = spawn('support-large', 0.95);
  const m = LIB['support-large'];
  const shaftH = m.size.y * (0.95 / Math.max(m.size.x, m.size.z));
  shaft.scale.y *= height / shaftH;
  grp.add(shaft);
  grp.traverse(o => {
    if (o.isMesh) o.material = tintedMaterial(o.material, tint, neon);
  });
  return grp;
}

// trilho horizontal: repete segmentos unitários ao longo de X, centrado na origem
function makeRail(name, length) {
  const grp = new THREE.Group();
  const m = LIB[name];
  const alongX = m.size.x >= m.size.z;
  const segLen = Math.max(alongX ? m.size.x : m.size.z, 0.4);
  const n = Math.max(1, Math.ceil(length / segLen));
  for (let i = 0; i < n; i++) {
    const seg = m.scene.clone(true);
    if (!alongX) seg.rotation.y = Math.PI / 2;
    const holder = new THREE.Group();
    holder.add(seg);
    // centraliza o segmento na própria célula
    const bb = new THREE.Box3().setFromObject(holder);
    const c = bb.getCenter(new THREE.Vector3());
    seg.position.x -= c.x; seg.position.y -= c.y; seg.position.z -= c.z;
    holder.position.x = (i - (n - 1) / 2) * segLen;
    grp.add(holder);
  }
  return grp;
}

// ------------------------------------------------------------
// Obstáculos
// ------------------------------------------------------------
const portals = [];   // { z, gx, gy, gw, gh, oscA, oscW, oscP, ox, group, passed }
const loopRings = []; // { z, x, y, r, group, crossed }
const trains = [];    // { z, y, amp, w, phase, group, carW, carH, len }
const windZones = []; // { z0, z1, force, parts, warned }
const coins = [];     // { z, x, y, mesh, taken }
const boxes = [];     // { z, x, y, mesh, taken }

function spawnPortal(z) {
  const f = diff();
  const ala = ALAS[alaIdx % ALAS.length];
  const gw = lerp(4.2, 2.7, f) * rand(0.92, 1.08);
  const gh = lerp(4.0, 2.6, f) * rand(0.92, 1.08);
  const gx = rand(-CORW + gw / 2 + 0.5, CORW - gw / 2 - 0.5);
  const gy = rand(gh / 2 + 1.2, CEIL - gh / 2 - 1.0);
  const oscA = (G.score > 18 && Math.random() < lerp(0.15, 0.55, f)) ? rand(0.8, 1.6) : 0;

  const group = new THREE.Group();
  group.position.z = z;
  const tint = PILAR_TINT[ala.pilar];

  const STEP = 1.4;
  for (let cx = -CORW - 1.4; cx <= CORW + 1.4 + 0.01; cx += STEP) {
    const inHole = Math.abs(cx - gx) < gw / 2 + 0.45;
    if (!inHole) {
      const col = makeColumn(WALL_H, tint, ala.night);
      col.position.set(cx, 0, 0);
      group.add(col);
    } else {
      const lowH = gy - gh / 2;
      if (lowH > 0.9) {
        const col = makeColumn(lowH, tint, ala.night);
        col.position.set(cx, 0, 0);
        group.add(col);
      }
      const topY = gy + gh / 2;
      if (topY < WALL_H - 0.5) {
        const col = makeColumn(WALL_H - topY, tint, ala.night);
        col.position.set(cx, topY, 0);
        group.add(col);
      }
    }
  }
  // trilhos horizontais marcando as bordas do vão (fora da área livre)
  const edges = [
    { y: gy - gh / 2 - 0.35, ok: gy - gh / 2 > 0.9 },
    { y: gy + gh / 2 + 0.35, ok: gy + gh / 2 < WALL_H - 0.5 },
  ];
  for (const e of edges) {
    if (!e.ok) continue;
    const rail = makeRail(ala.rail, gw + 1.4);
    rail.position.set(gx, e.y, 0);
    group.add(rail);
  }
  // trilho de cumeeira ligando tudo
  const top = makeRail(ala.rail, (CORW + 1.6) * 2);
  top.position.set(0, WALL_H + 0.2, 0);
  group.add(top);

  scene.add(group);
  portals.push({
    z, gx, gy, gw, gh,
    oscA, oscW: rand(1.2, 2.0), oscP: rand(0, Math.PI * 2), ox: 0,
    group, passed: false,
  });
}

function spawnLoop(z) {
  const ala = ALAS[alaIdx % ALAS.length];
  const r = 2.0;
  const x = rand(-CORW + r + 0.6, CORW - r - 0.6);
  const y = rand(r + 1.6, CEIL - r - 0.8);
  const group = new THREE.Group();
  const ring = spawn(ala.loop, 5.6, 'y');
  const lb = LIB[ala.loop];
  if (lb.size.z > lb.size.x) ring.rotation.y = Math.PI / 2;
  // centraliza o círculo do looping no (0,0) do grupo
  const bb = new THREE.Box3().setFromObject(ring);
  const c = bb.getCenter(new THREE.Vector3());
  ring.position.sub(c);
  group.add(ring);
  // estrela girando no centro
  const star = spawn('star', 1.0);
  star.position.set(0, 0, 0);
  star.userData.star = true;
  group.add(star);
  group.position.set(x, y, z);
  scene.add(group);
  loopRings.push({ z, x, y, r, group, star, crossed: false });
}

function spawnTrain(z) {
  const f = diff();
  const ala = ALAS[alaIdx % ALAS.length];
  const y = rand(2.2, 9.5);
  const group = new THREE.Group();
  group.position.set(0, y, z);
  // barra de trilho atravessando o corredor
  const rail = makeRail(ala.rail, (CORW + 3) * 2);
  rail.position.y = -0.35;
  group.add(rail);
  // trem (3 vagões)
  const cars = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const car = spawn(ala.train, 1.9);
    const cb = LIB[ala.train];
    if (cb.size.z > cb.size.x) car.rotation.y = Math.PI / 2;
    car.position.x = (i - 1) * 2.0;
    cars.add(car);
  }
  group.add(cars);
  scene.add(group);
  trains.push({
    z, y, group, cars,
    amp: CORW + 1, w: rand(0.8, 1.4) * lerp(1, 1.5, f), phase: rand(0, Math.PI * 2),
    halfLen: 3.1, carH: 0.75,
  });
}

function spawnWind(z) {
  const force = (Math.random() < 0.5 ? -1 : 1) * rand(4.5, 7.5);
  const geo = new THREE.BufferGeometry();
  const N = 90;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rand(-CORW, CORW);
    pos[i * 3 + 1] = rand(1, CEIL);
    pos[i * 3 + 2] = z - rand(0, 12);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xbfefff, size: 0.22, transparent: true, opacity: 0.8 });
  const parts = new THREE.Points(geo, mat);
  scene.add(parts);
  windZones.push({ z0: z, z1: z - 12, force, parts, warned: false });
}

function spawnCoinArc(z) {
  const x0 = rand(-CORW + 1, CORW - 1), x1 = rand(-CORW + 1, CORW - 1);
  const y0 = rand(2.5, 10), y1 = rand(2.5, 10);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const mesh = spawn('item-coin-gold', 0.85);
    mesh.position.set(
      lerp(x0, x1, t),
      lerp(y0, y1, t) + Math.sin(t * Math.PI) * 1.6,
      z - i * 1.6
    );
    scene.add(mesh);
    coins.push({ mesh, taken: false });
  }
}

function spawnBox(z) {
  const mesh = spawn('item-box', 1.0);
  mesh.position.set(rand(-CORW + 1.5, CORW - 1.5), rand(3, 10), z);
  scene.add(mesh);
  boxes.push({ mesh, taken: false });
}

// remoção de cena — NÃO descarta geometria (os clones compartilham
// geometria/material com os modelos-fonte da LIB)
function dispose(obj) {
  scene.remove(obj);
}
// para objetos com geometria própria (partículas, vento)
function disposeOwn(obj) {
  scene.remove(obj);
  obj.geometry?.dispose?.();
  obj.material?.dispose?.();
}

// ------------------------------------------------------------
// Gerador do percurso
// ------------------------------------------------------------
let nextSpawnZ = -42;

function spawner() {
  const horizon = player.pos.z - 170;
  while (nextSpawnZ > horizon) {
    const f = diff();
    const spacing = lerp(27, 19, f);
    spawnPortal(nextSpawnZ);
    const mid = nextSpawnZ + spacing * 0.5;   // entre o portal novo e o anterior
    const roll = Math.random();
    if (roll < 0.34) spawnCoinArc(mid + rand(-2, 2));
    else if (roll < 0.58) spawnLoop(mid);
    else if (roll < 0.74 && G.score >= 5) spawnTrain(mid);
    else if (roll < 0.84 && G.score >= 8) spawnWind(mid + 4);
    else if (roll < 0.92) spawnBox(mid);
    else spawnCoinArc(mid);
    nextSpawnZ -= spacing;
  }
  // decoração
  while (decor.length < 46) makeDecor(player.pos.z - rand(20, 170));
}

function cleanup() {
  const behind = player.pos.z + 26;
  // portais somem logo depois que a câmera os atravessa (ela voa ~7.6 atrás)
  const portalBehind = player.pos.z + 9.5;
  for (let i = portals.length - 1; i >= 0; i--)
    if (portals[i].z > portalBehind) { dispose(portals[i].group); portals.splice(i, 1); }
  for (let i = loopRings.length - 1; i >= 0; i--)
    if (loopRings[i].z > behind) { dispose(loopRings[i].group); loopRings.splice(i, 1); }
  for (let i = trains.length - 1; i >= 0; i--)
    if (trains[i].z > behind) { dispose(trains[i].group); trains.splice(i, 1); }
  for (let i = windZones.length - 1; i >= 0; i--)
    if (windZones[i].z1 > behind) { disposeOwn(windZones[i].parts); windZones.splice(i, 1); }
  for (let i = coins.length - 1; i >= 0; i--)
    if (coins[i].taken || coins[i].mesh.position.z > behind) { dispose(coins[i].mesh); coins.splice(i, 1); }
  for (let i = boxes.length - 1; i >= 0; i--)
    if (boxes[i].taken || boxes[i].mesh.position.z > behind) { dispose(boxes[i].mesh); boxes.splice(i, 1); }
  for (let i = decor.length - 1; i >= 0; i--)
    if (decor[i].position.z > behind + 10) { dispose(decor[i]); decor.splice(i, 1); }
}

// ------------------------------------------------------------
// Partículas (penas, rastro da rajada, brilhos)
// ------------------------------------------------------------
const particles = [];
function burst(pos, color, n, spd, life, size = 0.16) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide })
    );
    m.position.copy(pos);
    m.userData = {
      v: new THREE.Vector3(rand(-1, 1), rand(-0.3, 1.4), rand(-1, 1)).multiplyScalar(spd),
      rot: new THREE.Vector3(rand(-5, 5), rand(-5, 5), rand(-5, 5)),
      life, maxLife: life,
    };
    scene.add(m);
    particles.push(m);
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i], u = p.userData;
    u.life -= dt;
    if (u.life <= 0) { disposeOwn(p); particles.splice(i, 1); continue; }
    u.v.y -= 2.5 * dt;
    p.position.addScaledVector(u.v, dt);
    p.rotation.x += u.rot.x * dt; p.rotation.y += u.rot.y * dt; p.rotation.z += u.rot.z * dt;
    p.material.opacity = u.life / u.maxLife;
  }
}

// ------------------------------------------------------------
// HUD
// ------------------------------------------------------------
const $ = id => document.getElementById(id);
const ui = {
  hud: $('hud'), score: $('score'), fichas: $('fichas'), loops: $('loops'),
  ala: $('ala-label'), speed: $('speed'),
  impetoWrap: $('impeto-wrap'), impetoBar: $('impeto-bar'), impetoFill: $('impeto-fill'), impetoHint: $('impeto-hint'),
  combo: $('combo'), comboX: $('combo-x'),
  announce: $('announce'), windFlash: $('wind-flash'),
  menu: $('menu'), end: $('end'), loading: $('loading'), fade: $('fade'),
  record: $('record'), endTitle: $('end-title'), endStats: $('end-stats'),
  skinName: $('skin-name'), skinReq: $('skin-req'), skinBox: $('skin-box'),
  touch: $('touch'), tRajada: $('t-rajada'),
};

let announceT = 0;
function announce(txt, ms = 1500) {
  ui.announce.textContent = txt;
  ui.announce.style.opacity = 1;
  announceT = ms / 1000;
}

let comboT = 0;
function showCombo() {
  ui.comboX.textContent = 'RASPÃO ×' + G.combo;
  ui.combo.classList.remove('hidden');
  comboT = 1.3;
}

function updateHUD() {
  ui.score.textContent = G.score;
  ui.fichas.textContent = '🪙 ' + G.fichas;
  ui.loops.textContent = '⭐ ' + G.loops;
  ui.ala.textContent = ALAS[alaIdx % ALAS.length].name + (alaIdx >= ALAS.length ? ' +' : '');
  ui.speed.textContent = Math.round(G.speed * 4) + ' km/h';
  ui.impetoFill.style.width = G.impeto + '%';
  ui.impetoBar.classList.toggle('full', G.impeto >= 100);
  ui.impetoHint.classList.toggle('hidden', G.impeto < 100 || G.rajadaT > 0);
  ui.tRajada.classList.toggle('hidden', G.impeto < 100 || G.rajadaT > 0 || !isTouch);
}

// ------------------------------------------------------------
// Entrada
// ------------------------------------------------------------
const keys = {};
let flapQueued = false;
let isTouch = false;

function queueFlap() {
  if (state === ST.PLAY && !paused) flapQueued = true;
}

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  keys[e.code] = true;
  AudioSys.unlock();
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { queueFlap(); e.preventDefault(); }
  if (e.code === 'KeyE') tryRajada();
  if (e.code === 'KeyM') AudioSys.toggleMute();
  if (e.code === 'KeyP' && state === ST.PLAY) {
    paused = !paused;
    announce(paused ? 'PAUSA' : 'VAI!', paused ? 60000 : 800);
    if (!paused) announceT = 0.8;
  }
  if (e.code === 'Enter') {
    if (state === ST.MENU) startGame();
    else if (state === ST.END) restart();
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('pointerdown', () => { AudioSys.unlock(); queueFlap(); });

// toque
window.addEventListener('touchstart', () => { isTouch = true; ui.touch.classList.remove('hidden'); }, { once: true, passive: true });
const bindHold = (id, code) => {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); keys[code] = true; });
  el.addEventListener('pointerup', () => { keys[code] = false; });
  el.addEventListener('pointerleave', () => { keys[code] = false; });
};
bindHold('t-left', 'KeyA');
bindHold('t-right', 'KeyD');
bindHold('t-dive', 'KeyS');
ui.tRajada.addEventListener('pointerdown', e => { e.preventDefault(); tryRajada(); });

// ------------------------------------------------------------
// Mecânicas
// ------------------------------------------------------------
function tryRajada() {
  if (state !== ST.PLAY || paused || G.impeto < 100 || G.rajadaT > 0) return;
  G.impeto = 0;
  G.rajadaT = 2.6;
  AudioSys.play('rajada', 1, 0.9);
  announce('RAJADA!', 1200);
}

function giveImpeto(n) {
  const was = G.impeto;
  G.impeto = clamp(G.impeto + n, 0, 100);
  if (was < 100 && G.impeto >= 100) AudioSys.play('shield', 0.9, 1.4);
}

function powerup() {
  AudioSys.play('box');
  if (!G.shieldOn && Math.random() < 0.55) {
    G.shieldOn = true;
    bubble.visible = true;
    announce('BOLHA DE AR!\num choque grátis', 1600);
    AudioSys.play('shield');
  } else {
    G.magnetT = 8;
    announce('ÍMÃ DE FICHAS!\n8 segundos', 1600);
    AudioSys.play('coin3', 1, 0.8);
  }
}

function loseShield() {
  G.shieldOn = false;
  bubble.visible = false;
  G.invulnT = 1.0;
  AudioSys.play('shield', 1, 0.6);
  burst(player.pos, 0x7df0ff, 12, 3, 0.6);
}

// colisão esfera × caixa
function hitBox(px, py, pz, r, minX, maxX, minY, maxY, minZ, maxZ) {
  const cx = clamp(px, minX, maxX), cy = clamp(py, minY, maxY), cz = clamp(pz, minZ, maxZ);
  const dx = px - cx, dy = py - cy, dz = pz - cz;
  return dx * dx + dy * dy + dz * dz < r * r;
}

function die(causa) {
  if (state !== ST.PLAY) return;
  state = ST.DYING;
  G.dieT = 1.5;
  G.dieCause = causa;
  player.vy = 4;
  AudioSys.play(causa === 'chao' ? 'crash' : 'wood');
  AudioSys.play('hurt');
  AudioSys.stopMusic();
  burst(player.pos, 0xffffff, 10, 4, 1.2, 0.2);
  burst(player.pos, 0x2b2b2b, 8, 3.5, 1.2, 0.18);
  shake = 0.7;
}

// ------------------------------------------------------------
// Atualização principal
// ------------------------------------------------------------
let shake = 0;
let flapCD = 0;

function updatePlay(dt) {
  const f = diff();
  G.time += dt;
  const rajada = G.rajadaT > 0;

  // velocidade para frente
  const base = lerp(11, 22, f) * (rajada ? 1.65 : 1);
  G.speed = lerp(G.speed, base, dt * 2);
  player.pos.z -= G.speed * dt;
  G.dist += G.speed * dt;

  // vento
  let windF = 0;
  for (const w of windZones) {
    if (player.pos.z < w.z0 && player.pos.z > w.z1) {
      windF = w.force;
      if (!w.warned) {
        w.warned = true;
        AudioSys.play('warn', 0.9);
        AudioSys.play('wind', 1, 0.6);
        announce(w.force > 0 ? 'VENTO →' : '← VENTO', 1000);
        ui.windFlash.classList.add('on');
        setTimeout(() => ui.windFlash.classList.remove('on'), 900);
      }
    }
  }

  // física vertical
  flapCD -= dt;
  if (flapQueued && flapCD <= 0) {
    player.vy = rajada ? 5.5 : 8.8;
    player.flapAnim = 1;
    flapCD = 0.09;
    AudioSys.play(pick(['flap1', 'flap2', 'flap3']), 0.8, rand(0.9, 1.15));
  }
  flapQueued = false;

  const diving = keys['KeyS'] || keys['ArrowDown'];
  if (diving && !player.diveHold && !rajada) {
    player.vy = Math.min(player.vy, -14);
    AudioSys.play('dive', 0.7, 1.2);
  }
  player.diveHold = !!diving;

  if (rajada) {
    // na rajada o pinguim "nada": sem gravidade, leve controle vertical
    player.vy = lerp(player.vy, (keys['Space'] || keys['KeyW'] || keys['ArrowUp']) ? 4 : (diving ? -4 : 0), dt * 5);
    G.rajadaT -= dt;
    if (G.rajadaT <= 0) { G.invulnT = 0.5; announce('', 1); ui.announce.style.opacity = 0; }
    // rastro
    if (Math.random() < 0.8) burst(player.pos, 0x7dffe2, 1, 0.6, 0.4, 0.14);
    player.spin += dt * 9;
  } else {
    player.vy += -26 * dt;
    player.vy = clamp(player.vy, diving ? -19 : -15, 10);
    player.spin = lerp(player.spin, Math.round(player.spin / (Math.PI * 2)) * Math.PI * 2, dt * 8);
  }
  player.pos.y += player.vy * dt;

  // teto
  if (player.pos.y > CEIL) {
    player.pos.y = CEIL;
    player.vy = -2;
    AudioSys.play('metal', 0.7);
  }
  // chão = morte
  if (player.pos.y < GROUND_Y + PLAYER_R + 0.1) {
    if (rajada || G.invulnT > 0) {
      player.pos.y = GROUND_Y + PLAYER_R + 0.1;
      player.vy = Math.abs(player.vy) * 0.4 + 2;
    } else { die('chao'); return; }
  }

  // lateral
  const lat = (keys['KeyA'] || keys['ArrowLeft'] ? -1 : 0) + (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0);
  const targetVx = lat * 8 + windF;
  player.vx = lerp(player.vx, targetVx, dt * 6);
  player.pos.x += player.vx * dt;
  if (Math.abs(player.pos.x) > CORW) {
    player.pos.x = Math.sign(player.pos.x) * CORW;
    player.vx *= -0.3;
  }

  G.invulnT = Math.max(0, G.invulnT - dt);
  G.magnetT = Math.max(0, G.magnetT - dt);

  // ---- portais ----
  for (const p of portals) {
    if (p.oscA) p.ox = Math.sin(G.time * p.oscW + p.oscP) * p.oscA;
    p.group.position.x = p.ox;

    const pz = player.pos.z, px = player.pos.x, py = player.pos.y;
    const HZ = 0.45;
    // colisão na faixa do portal
    if (Math.abs(pz - p.z) < HZ + PLAYER_R && !rajada && G.invulnT <= 0) {
      const gx = p.gx + p.ox;
      const hw = p.gw / 2, hh = p.gh / 2;
      const hit =
        hitBox(px, py, pz, PLAYER_R, -9 + p.ox, gx - hw, 0, WALL_H, p.z - HZ, p.z + HZ) ||
        hitBox(px, py, pz, PLAYER_R, gx + hw, 9 + p.ox, 0, WALL_H, p.z - HZ, p.z + HZ) ||
        hitBox(px, py, pz, PLAYER_R, gx - hw, gx + hw, 0, p.gy - hh, p.z - HZ, p.z + HZ) ||
        hitBox(px, py, pz, PLAYER_R, gx - hw, gx + hw, p.gy + hh, WALL_H, p.z - HZ, p.z + HZ);
      if (hit) {
        if (G.shieldOn) loseShield();
        else { die('pilar'); return; }
      }
    }
    // pontuação ao cruzar
    if (!p.passed && pz < p.z - HZ - PLAYER_R) {
      p.passed = true;
      G.score++;
      AudioSys.play('point', 0.9);
      // raspão?
      const gx = p.gx + p.ox;
      const margin = Math.min(
        p.gw / 2 - Math.abs(px - gx),
        p.gh / 2 - Math.abs(py - p.gy)
      );
      if (margin < 0.55) {
        G.combo++;
        G.raspoes++;
        G.bestCombo = Math.max(G.bestCombo, G.combo);
        giveImpeto(12);
        AudioSys.play('raspao', 0.9, 1 + G.combo * 0.06);
        showCombo();
        shake = 0.25;
      } else {
        G.combo = 0;
      }
      checkAla();
    }
  }

  // ---- loopings ----
  for (const l of loopRings) {
    l.star.rotation.y += dt * 3;
    if (!l.crossed && player.pos.z < l.z) {
      l.crossed = true;
      const d = Math.hypot(player.pos.x - l.x, player.pos.y - l.y);
      if (d < l.r * 0.8) {
        G.loops++;
        G.score += 3;
        giveImpeto(30);
        AudioSys.play('loop');
        announce('LOOPING! +3', 900);
        burst(new THREE.Vector3(l.x, l.y, l.z), 0xffd34d, 14, 4, 0.8);
        l.star.visible = false;
        checkAla();
      }
    }
  }

  // ---- trens ----
  for (const t of trains) {
    const tx = Math.sin(G.time * t.w + t.phase) * t.amp;
    t.cars.position.x = tx;
    if (!rajada && G.invulnT <= 0 && Math.abs(player.pos.z - t.z) < 0.8 + PLAYER_R) {
      // barra de trilho
      const railHit = hitBox(player.pos.x, player.pos.y, player.pos.z, PLAYER_R,
        -CORW - 3, CORW + 3, t.y - 0.55, t.y - 0.1, t.z - 0.4, t.z + 0.4);
      // vagões
      const carHit = hitBox(player.pos.x, player.pos.y, player.pos.z, PLAYER_R,
        tx - t.halfLen, tx + t.halfLen, t.y - 0.1, t.y + t.carH, t.z - 0.6, t.z + 0.6);
      if (railHit || carHit) {
        if (G.shieldOn) loseShield();
        else { die('trem'); return; }
      }
    }
  }

  // ---- fichas ----
  for (const c of coins) {
    if (c.taken) continue;
    c.mesh.rotation.y += dt * 4;
    if (G.magnetT > 0) {
      const d = c.mesh.position.distanceTo(player.pos);
      if (d < 7) c.mesh.position.lerp(player.pos, dt * 6);
    }
    if (c.mesh.position.distanceTo(player.pos) < 0.9) {
      c.taken = true;
      c.mesh.visible = false;
      G.fichas++;
      giveImpeto(9);
      AudioSys.play(pick(['coin1', 'coin2', 'coin3']), 0.8);
      burst(c.mesh.position, 0xffd34d, 5, 2, 0.4, 0.1);
    }
  }

  // ---- caixas ----
  for (const b of boxes) {
    if (b.taken) continue;
    b.mesh.rotation.y += dt * 2;
    b.mesh.rotation.x += dt * 1.3;
    if (b.mesh.position.distanceTo(player.pos) < 1.1) {
      b.taken = true;
      b.mesh.visible = false;
      powerup();
    }
  }

  spawner();
  cleanup();
  updateHUD();
}

// troca de ala
function checkAla() {
  const idx = Math.floor(G.score / ALA_LEN);
  if (idx !== alaIdx) {
    alaIdx = idx;
    const ala = ALAS[alaIdx % ALAS.length];
    skyTarget.set(ala.sky);
    fogTarget.set(ala.fog);
    groundTarget.set(ala.ground);
    announce(ala.name, 1800);
    AudioSys.play('loop', 1, 0.8);
    AudioSys.playMusic(ala.night ? 'night' : 'game');
  }
}

// ------------------------------------------------------------
// Morte
// ------------------------------------------------------------
function updateDying(dt) {
  G.dieT -= dt;
  player.vy -= 22 * dt;
  player.pos.y = Math.max(GROUND_Y + 0.3, player.pos.y + player.vy * dt);
  player.pos.z -= G.speed * 0.25 * dt;
  player.body.rotation.x += dt * 7;
  player.body.rotation.z += dt * 5;
  if (Math.random() < 0.5) burst(player.pos, Math.random() < 0.5 ? 0xffffff : 0x2b2b2b, 1, 2, 0.9, 0.14);
  if (G.dieT <= 0) endGame();
}

function endGame() {
  state = ST.END;
  const novo = G.score > G.record;
  if (novo) { G.record = G.score; LS.set('bateasa_record', String(G.score)); }
  AudioSys.play('gameover', 0.9);
  const causas = {
    pilar: 'ESPATIFADO NO PILAR',
    trem: 'ATROPELADO PELO TREM',
    chao: 'DE CARA NO CHÃO',
  };
  ui.endTitle.textContent = novo ? 'NOVO RECORDE!' : (causas[G.dieCause] || 'DEPENADO');
  ui.endStats.textContent =
    `${G.score} pontos${novo ? ' ★' : ''} · recorde ${G.record}\n` +
    `🪙 ${G.fichas} fichas · ⭐ ${G.loops} loopings\n` +
    `raspões ${G.raspoes} · melhor combo ×${G.bestCombo}\n` +
    `${ALAS[alaIdx % ALAS.length].name} · ${Math.round(G.dist)} m voados`;
  ui.end.classList.remove('hidden');
  ui.hud.classList.add('hidden');
  updateSkinUI();
}

// ------------------------------------------------------------
// Câmera
// ------------------------------------------------------------
function updateCamera(dt) {
  const p = player.pos;
  const rajada = G.rajadaT > 0;
  const tx = p.x * 0.65;
  const ty = clamp(p.y + 2.3, 2.2, CEIL + 2);
  const tz = p.z + (rajada ? 8.8 : 7.6);
  camera.position.x = lerp(camera.position.x, tx, dt * 5);
  camera.position.y = lerp(camera.position.y, ty, dt * 5);
  camera.position.z = lerp(camera.position.z, tz, dt * 8);
  const fovT = rajada ? 62 : 50;
  if (Math.abs(camera.fov - fovT) > 0.3) {
    camera.fov = lerp(camera.fov, fovT, dt * 4);
    camera.updateProjectionMatrix();
  }
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 2);
    camera.position.x += rand(-1, 1) * shake * 0.3;
    camera.position.y += rand(-1, 1) * shake * 0.3;
  }
  camera.lookAt(p.x * 0.8, p.y * 0.8 + 1, p.z - 9);
  sun.position.set(p.x + 35, 60, p.z + 25);
  sun.target.position.set(p.x, 0, p.z - 10);
}

// visual do jogador
function updatePlayerVisual(dt) {
  player.group.position.copy(player.pos);
  if (!player.body) return;
  if (state === ST.PLAY) {
    player.flapAnim = Math.max(0, player.flapAnim - dt * 4);
    const squash = 1 + player.flapAnim * 0.25;   // achata no flap
    player.body.scale.set(player.baseS * squash, player.baseS * (2 - squash), player.baseS);
    const pitch = clamp(-player.vy * 0.06, -0.5, 0.7);
    const roll = clamp(-player.vx * 0.07, -0.6, 0.6);
    player.body.rotation.x = lerp(player.body.rotation.x, pitch, dt * 8);
    player.body.rotation.z = G.rajadaT > 0 ? player.spin : lerp(player.body.rotation.z, roll, dt * 8);
  } else if (state === ST.MENU) {
    player.body.rotation.x = 0;
    player.body.rotation.z = Math.sin(performance.now() / 600) * 0.12;
    player.group.position.y = 6 + Math.sin(performance.now() / 500) * 0.3;
  }
  bubble.scale.setScalar(1 + Math.sin(performance.now() / 200) * 0.05);
}

// ------------------------------------------------------------
// Piloto automático (?auto=1) — verificação
// ------------------------------------------------------------
let autoFlapT = 0;
function autoPilot(dt) {
  autoFlapT -= dt;
  const next = portals.filter(p => !p.passed && p.z < player.pos.z).sort((a, b) => b.z - a.z)[0];
  let tx = 0, ty = 6;
  if (next) { tx = next.gx + next.ox; ty = next.gy; }
  keys['KeyA'] = player.pos.x > tx + 0.4;
  keys['KeyD'] = player.pos.x < tx - 0.4;
  if (player.pos.y < ty - 0.2 && player.vy < 2 && autoFlapT <= 0) {
    flapQueued = true;
    autoFlapT = 0.14;
  }
  keys['KeyS'] = player.pos.y > ty + 2.2;
  if (G.impeto >= 100) tryRajada();
}

// ------------------------------------------------------------
// Fluxo de jogo
// ------------------------------------------------------------
function resetWorld() {
  for (const p of portals) dispose(p.group);
  for (const l of loopRings) dispose(l.group);
  for (const t of trains) dispose(t.group);
  for (const w of windZones) disposeOwn(w.parts);
  for (const c of coins) dispose(c.mesh);
  for (const b of boxes) dispose(b.mesh);
  for (const d of decor) dispose(d);
  for (const p of particles) disposeOwn(p);
  portals.length = loopRings.length = trains.length = windZones.length = 0;
  coins.length = boxes.length = decor.length = particles.length = 0;

  Object.assign(G, {
    score: 0, fichas: 0, loops: 0, raspoes: 0, bestCombo: 0, combo: 0,
    impeto: 0, rajadaT: 0, shieldOn: false, magnetT: 0, invulnT: 0,
    speed: 11, dist: 0, time: 0,
  });
  bubble.visible = false;
  alaIdx = 0;
  const ala = ALAS[0];
  skyTarget.set(ala.sky); fogTarget.set(ala.fog); groundTarget.set(ala.ground);
  player.pos.set(0, 6, 0);
  player.vy = 0; player.vx = 0; player.spin = 0;
  if (player.body) { player.body.rotation.set(0, Math.PI, 0); player.body.scale.setScalar(player.baseS); }
  nextSpawnZ = -42;
  spawner();
}

function startGame() {
  AudioSys.unlock();
  AudioSys.play('click');
  setSkin(skinIdx);
  resetWorld();
  state = ST.PLAY;
  paused = false;
  ui.menu.classList.add('hidden');
  ui.end.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  AudioSys.playMusic('game');
  announce('VOA, TORPEDO!', 1300);
  updateHUD();
}

function restart() { startGame(); }

function toMenu() {
  state = ST.MENU;
  resetWorld();
  ui.menu.classList.remove('hidden');
  ui.end.classList.add('hidden');
  ui.hud.classList.add('hidden');
  AudioSys.playMusic('menu');
  updateSkinUI();
}

// seletor de skins
function updateSkinUI() {
  const s = SKINS[skinIdx];
  const locked = G.record < s.req;
  ui.skinName.textContent = s.name + (locked ? ' 🔒' : '');
  ui.skinBox.classList.toggle('locked', locked);
  ui.skinReq.textContent = s.hint;
  ui.skinReq.classList.toggle('hidden', !s.hint);
  ui.record.textContent = G.record;
}
function cycleSkin(dir) {
  AudioSys.play('click', 0.7);
  skinIdx = (skinIdx + dir + SKINS.length) % SKINS.length;
  if (G.record >= SKINS[skinIdx].req) LS.set('bateasa_skin', String(skinIdx));
  setSkin(skinIdx);
  updateSkinUI();
}
$('skin-prev').addEventListener('click', () => cycleSkin(-1));
$('skin-next').addEventListener('click', () => cycleSkin(1));
$('btn-start').addEventListener('click', () => {
  if (G.record < SKINS[skinIdx].req) { skinIdx = 0; setSkin(0); }
  startGame();
});
$('btn-retry').addEventListener('click', restart);

// ------------------------------------------------------------
// Loop principal
// ------------------------------------------------------------
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  if (paused) return;

  // transição de cores entre alas
  skyColor.lerp(skyTarget, dt * 1.5);
  fogColor.lerp(fogTarget, dt * 1.5);
  groundColor.lerp(groundTarget, dt * 1.5);
  groundMat.color.copy(groundColor);
  const ala = ALAS[alaIdx % ALAS.length];
  hemi.intensity = lerp(hemi.intensity, ala.hemi, dt * 1.5);
  sun.intensity = lerp(sun.intensity, ala.sunI, dt * 1.5);

  if (announceT > 0) {
    announceT -= dt;
    if (announceT <= 0) ui.announce.style.opacity = 0;
  }
  if (comboT > 0) {
    comboT -= dt;
    if (comboT <= 0) ui.combo.classList.add('hidden');
  }

  if (state === ST.PLAY) {
    if (AUTO) autoPilot(dt);
    updatePlay(dt);
  } else if (state === ST.DYING) {
    updateDying(dt * 0.55);   // câmera lenta dramática
  }

  // chão acompanha o jogador
  ground.position.z = player.pos.z - 120;
  path.position.z = player.pos.z - 120;

  updateParticles(dt);
  updatePlayerVisual(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
AudioSys.load();
try {
  document.fonts.load('20px "Kenney Future"');
  document.fonts.load('20px "Kenney Mono"');
} catch (e) {}

Promise.all(MODELS.map(loadModel)).then(() => {
  ui.loading.classList.add('hidden');
  setSkin(skinIdx);
  resetWorld();
  updateSkinUI();
  if (AUTO) {
    startGame();
  } else {
    state = ST.MENU;
    AudioSys.playMusic('menu');
  }
  requestAnimationFrame(frame);
}).catch(err => {
  ui.loading.querySelector('.story').textContent = 'ERRO AO CARREGAR: ' + err.message;
  console.error(err);
});
