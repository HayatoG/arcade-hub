// ============================================================
// TRAVESSIA — travessia infinita em grade (Crossy Road like)
// Three.js + Cube Pets / Car Kit / Train Kit / Nature Kit /
// Pirate Kit (Kenney, CC0)
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from '../lib/loaders/GLTFLoader.js';

// ------------------------------------------------------------
// Constantes
// ------------------------------------------------------------
const CELL = 2;                 // tamanho da casa da grade
const COLS = 4;                 // casas jogáveis: -4..4 (9 casas)
const DECOR = 8;                // decoração até ±8
const GROUND_W = (DECOR * 2 + 1) * CELL;
const WRAP = 46;                // esteira de carros/troncos
const ROWS_AHEAD = 26, ROWS_BEHIND = 9;
const TRAIN_SPEED = 46;
const EAGLE_WARN = 4.0;         // sombra começa
const EAGLE_AT = 7.0;           // águia mergulha
const BEHIND_LIMIT = 8;         // ficar para trás = águia

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ------------------------------------------------------------
// Bichos (gacha)
// ------------------------------------------------------------
const PETS = [
  { id: 'animal-chick',    name: 'PINTINHO' },
  { id: 'animal-cat',      name: 'GATO' },
  { id: 'animal-dog',      name: 'CACHORRO' },
  { id: 'animal-penguin',  name: 'PINGUIM' },
  { id: 'animal-bunny',    name: 'COELHO' },
  { id: 'animal-fox',      name: 'RAPOSA' },
  { id: 'animal-panda',    name: 'PANDA' },
  { id: 'animal-pig',      name: 'PORCO' },
  { id: 'animal-cow',      name: 'VACA' },
  { id: 'animal-lion',     name: 'LEÃO' },
  { id: 'animal-monkey',   name: 'MACACO' },
  { id: 'animal-koala',    name: 'COALA' },
  { id: 'animal-elephant', name: 'ELEFANTE' },
];

const CAR_MODELS = ['cars/sedan', 'cars/taxi', 'cars/police', 'cars/suv', 'cars/hatchback-sports', 'cars/race'];
const TRUCK_MODELS = ['cars/firetruck', 'cars/delivery', 'cars/garbage-truck'];
const TREE_MODELS = ['nature/tree_pineRoundA', 'nature/tree_pineRoundB', 'nature/tree_pineRoundC',
  'nature/tree_pineRoundE', 'nature/tree_default', 'nature/tree_default_dark'];
const ROCK_MODELS = ['nature/rock_largeA', 'nature/rock_largeB', 'nature/stump_round'];
const FLOAT_MODELS = ['river/boat-row-large', 'river/boat-row-small', 'nature/log_large'];
const TRAIN_PARTS = ['rail/train-locomotive-a', 'rail/train-carriage-box',
  'rail/train-carriage-container-red', 'rail/train-carriage-coal'];

const MODELS = [
  ...PETS.map(p => 'pets/' + p.id),
  ...CAR_MODELS, ...TRUCK_MODELS, ...TREE_MODELS, ...ROCK_MODELS,
  ...FLOAT_MODELS,
  'rail/railroad-straight', ...TRAIN_PARTS,
];

// ------------------------------------------------------------
// Armazenamento (localStorage)
// ------------------------------------------------------------
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const getBank = () => parseInt(LS.get('travessia_moedas', '0'), 10) || 0;
const setBank = n => LS.set('travessia_moedas', Math.max(0, n));
const getRecord = () => parseInt(LS.get('travessia_record', '0'), 10) || 0;
const saveRecord = n => { if (n > getRecord()) LS.set('travessia_record', n); };
function getPets() {
  try {
    const arr = JSON.parse(LS.get('travessia_pets', '["animal-chick"]'));
    return Array.isArray(arr) && arr.length ? arr : ['animal-chick'];
  } catch (e) { return ['animal-chick']; }
}
function savePets(arr) { LS.set('travessia_pets', JSON.stringify(arr)); }

// ------------------------------------------------------------
// Cena
// ------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const SKY = 0x8ed4f7;
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 34, 64);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.AmbientLight(0xd8ecff, 0.95));
const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6abe50, 0.45);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4da, 1.65);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -26; sun.shadow.camera.right = 26;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -34;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 80;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(sun.target);

// ------------------------------------------------------------
// Modelos
// ------------------------------------------------------------
const LIB = {};
const loader = new GLTFLoader();

function loadModel(name) {
  return new Promise((resolve, reject) => {
    loader.load('assets/models/' + name + '.glb', g => {
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        if (o.material && o.material.isMeshStandardMaterial && o.material.metalness > 0.5) {
          o.material.metalness = 0; o.material.roughness = 0.9;
        }
      });
      const box = new THREE.Box3().setFromObject(g.scene);
      LIB[name] = {
        scene: g.scene,
        size: box.getSize(new THREE.Vector3()),
        center: box.getCenter(new THREE.Vector3()),
        min: box.min.clone(),
      };
      resolve();
    }, undefined, reject);
  });
}

// instância centrada em x/z, base no y=0, altura alvo
function makeInst(key, targetH) {
  const lib = LIB[key];
  const s = targetH / lib.size.y;
  const inner = lib.scene.clone(true);
  inner.scale.setScalar(s);
  inner.position.set(-lib.center.x * s, -lib.min.y * s, -lib.center.z * s);
  const g = new THREE.Group();
  g.add(inner);
  return { g, inner, w: lib.size.x * s, h: targetH, d: lib.size.z * s };
}

// instância com eixo longo alinhado ao X, comprimento alvo
function makeAlongX(key, targetLen, targetH = null) {
  const lib = LIB[key];
  const long = Math.max(lib.size.x, lib.size.z);
  const s = targetLen / long;
  const inner = lib.scene.clone(true);
  inner.scale.setScalar(s);
  inner.position.set(-lib.center.x * s, -lib.min.y * s, -lib.center.z * s);
  const g = new THREE.Group();
  if (lib.size.z > lib.size.x) {
    const pivot = new THREE.Group();
    pivot.add(inner);
    pivot.rotation.y = Math.PI / 2;
    g.add(pivot);
  } else g.add(inner);
  return { g, len: targetLen, h: lib.size.y * s };
}

// ------------------------------------------------------------
// Pools genéricos — zero alocação durante a partida
// ------------------------------------------------------------
function makePool(create) {
  const free = [];
  return {
    get() {
      let o = free.pop();
      if (!o) { o = create(); scene.add(o.g); }
      o.g.visible = true;
      return o;
    },
    put(o) { o.g.visible = false; o.g.position.set(0, -50, 0); free.push(o); },
    get free() { return free.length; },
  };
}

// chão (4 tipos)
const groundGeo = new THREE.BoxGeometry(GROUND_W, 2, CELL - 0.04);
const matGrassA = new THREE.MeshLambertMaterial({ color: 0x9edb53 });
const matGrassB = new THREE.MeshLambertMaterial({ color: 0x8fcc46 });
const matRoad = new THREE.MeshLambertMaterial({ color: 0x4c4f58 });
const matRail = new THREE.MeshLambertMaterial({ color: 0x6e5f4e });
const matRiver = new THREE.MeshLambertMaterial({ color: 0x49a8e8 });
const groundPool = makePool(() => {
  const m = new THREE.Mesh(groundGeo, matGrassA);
  m.receiveShadow = true;
  return { g: m };
});

const treePool = makePool(() => {
  const inst = makeInst(pick(TREE_MODELS), rand(2.2, 3.4));
  inst.g.rotation.y = rand(0, Math.PI * 2);
  inst.g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  return inst;
});
const rockPool = makePool(() => makeInst(pick(ROCK_MODELS), rand(0.7, 1.0)));

// moeda dourada giratória
const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 18);
const coinMat = new THREE.MeshLambertMaterial({ color: 0xffd23e, emissive: 0x7a5a00 });
const coinPool = makePool(() => {
  const g = new THREE.Group();
  const m = new THREE.Mesh(coinGeo, coinMat);
  m.rotation.x = Math.PI / 2;
  m.castShadow = true;
  g.add(m);
  return { g };
});

// carros (modelo fixado na criação; comprimento medido)
let CAR_S = 1;
const carPool = makePool(() => {
  const truck = Math.random() < 0.26;
  const key = truck ? pick(TRUCK_MODELS) : pick(CAR_MODELS);
  const lib = LIB[key];
  const s = CAR_S;
  const inner = lib.scene.clone(true);
  inner.scale.setScalar(s);
  inner.position.set(-lib.center.x * s, -lib.min.y * s, -lib.center.z * s);
  const pivot = new THREE.Group();
  pivot.add(inner);
  pivot.rotation.y = Math.PI / 2;        // nariz (+Z) vira +X
  const g = new THREE.Group();
  g.add(pivot);
  return { g, len: lib.size.z * s, truck };
});

// troncos/barcos do rio
const floatPool = makePool(() => {
  const key = Math.random() < 0.55 ? 'nature/log_large' : pick(FLOAT_MODELS);
  const len = key.includes('boat-row-large') ? 4.6 : key.includes('boat-row-small') ? 3.4 : 2.9;
  const inst = makeAlongX(key, len);
  inst.g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  inst.rideY = key.includes('log') ? inst.h * 0.85 : inst.h * 0.55;
  return inst;
});

// trilho (uma casa)
const railPool = makePool(() => {
  const inst = makeAlongX('rail/railroad-straight', CELL);
  inst.g.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } });
  return inst;
});

// sinal de passagem de nível (2 postes com lâmpadas)
const signalPool = makePool(() => {
  const g = new THREE.Group();
  const lamps = [];
  const poleM = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
  const boxM = new THREE.MeshLambertMaterial({ color: 0x333333 });
  for (const side of [-1, 1]) {
    const post = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.16), poleM);
    pole.position.y = 1.1; pole.castShadow = true;
    post.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.2), boxM);
    head.position.y = 2.1;
    post.add(head);
    for (const lx of [-0.24, 0.24]) {
      const lampMat = new THREE.MeshBasicMaterial({ color: 0x440000 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), lampMat);
      lamp.position.set(lx, 2.1, 0.13);
      post.add(lamp);
      lamps.push(lampMat);
    }
    post.position.set(side * (COLS * CELL + 1.6), 0, 0);
    g.add(post);
  }
  return { g, lamps };
});

// faixas da estrada
const dashGeo = new THREE.BoxGeometry(0.9, 0.06, 0.16);
const dashMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e0 });
const dashPool = makePool(() => {
  const g = new THREE.Group();
  for (let i = -7; i <= 7; i++) {
    const d = new THREE.Mesh(dashGeo, dashMat);
    d.position.x = i * 2.3;
    g.add(d);
  }
  return { g };
});
const edgeGeo = new THREE.BoxGeometry(GROUND_W, 0.06, 0.14);
const edgePool = makePool(() => ({ g: new THREE.Mesh(edgeGeo, dashMat) }));

// trens (2, montados com locomotiva + vagões)
const trains = [];
function buildTrains() {
  const locoLib = LIB['rail/train-locomotive-a'];
  const s = 4.6 / locoLib.size.z;
  for (let t = 0; t < 2; t++) {
    const g = new THREE.Group();
    let x = 0;
    const lens = [];
    for (const part of TRAIN_PARTS) {
      const lib = LIB[part];
      const inner = lib.scene.clone(true);
      inner.scale.setScalar(s);
      inner.position.set(-lib.center.x * s, -lib.min.y * s, -lib.center.z * s);
      const pivot = new THREE.Group();
      pivot.add(inner);
      pivot.rotation.y = Math.PI / 2;     // nariz vira +X
      const len = lib.size.z * s;
      lens.push(len);
      pivot.position.x = x - len / 2;
      g.add(pivot);
      x -= len + 0.22;
    }
    const total = -x - 0.22;
    g.children.forEach(c => { c.position.x += total / 2; });   // centraliza
    g.visible = false;
    scene.add(g);
    trains.push({ g, len: total, busy: false });
  }
}
function getTrain() { return trains.find(t => !t.busy) || null; }

// ------------------------------------------------------------
// Partículas (pool fixo)
// ------------------------------------------------------------
const PART_MATS = {
  dust: new THREE.MeshBasicMaterial({ color: 0xe8e0c8 }),
  feather: new THREE.MeshBasicMaterial({ color: 0xfff0a0 }),
  water: new THREE.MeshBasicMaterial({ color: 0x9adcff }),
  spark: new THREE.MeshBasicMaterial({ color: 0xffd23e }),
};
const partGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
const particles = [];
for (let i = 0; i < 90; i++) {
  const m = new THREE.Mesh(partGeo, PART_MATS.dust);
  m.visible = false;
  scene.add(m);
  particles.push({ m, vx: 0, vy: 0, vz: 0, t: 0, life: 0, grav: 0 });
}
function spawnBurst(x, y, z, kind, n, power = 1) {
  let made = 0;
  for (const p of particles) {
    if (p.t < p.life) continue;
    p.m.material = PART_MATS[kind];
    p.m.visible = true;
    p.m.position.set(x + rand(-0.3, 0.3), y + rand(0, 0.3), z + rand(-0.3, 0.3));
    p.m.scale.setScalar(rand(0.7, 1.6));
    const a = rand(0, Math.PI * 2);
    const v = rand(1.5, 4) * power;
    p.vx = Math.cos(a) * v;
    p.vz = Math.sin(a) * v;
    p.vy = kind === 'dust' ? rand(0.5, 2) : rand(2.5, 6) * power;
    p.grav = kind === 'dust' ? -3 : -11;
    p.t = 0; p.life = kind === 'dust' ? 0.45 : rand(0.5, 0.9);
    if (++made >= n) break;
  }
}
function updateParticles(dt) {
  for (const p of particles) {
    if (p.t >= p.life) { if (p.m.visible) p.m.visible = false; continue; }
    p.t += dt;
    p.vy += p.grav * dt;
    p.m.position.x += p.vx * dt;
    p.m.position.y += p.vy * dt;
    p.m.position.z += p.vz * dt;
    const k = 1 - p.t / p.life;
    p.m.scale.setScalar(Math.max(0.01, k) * 1.2);
    if (p.t >= p.life) p.m.visible = false;
  }
}

// ------------------------------------------------------------
// Águia (low-poly, cones e caixas)
// ------------------------------------------------------------
const eagle = { g: null, wingL: null, wingR: null, active: false, phase: 0, t: 0, from: new THREE.Vector3(), shadow: null };
function buildEagle() {
  const g = new THREE.Group();
  const brown = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const dark = new THREE.MeshLambertMaterial({ color: 0x4e3520 });
  const white = new THREE.MeshLambertMaterial({ color: 0xe8e2d2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.6), brown);
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.55), white);
  head.position.set(0, 0.18, -0.95);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 6), new THREE.MeshLambertMaterial({ color: 0xffb030 }));
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.12, -1.4);
  g.add(beak);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.7), white);
  tail.position.set(0, 0.05, 1.05);
  g.add(tail);
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.09, 0.85), dark);
    w.position.x = side * 0.95;
    w.castShadow = true;
    wing.add(w);
    g.add(wing);
    if (side < 0) eagle.wingL = wing; else eagle.wingR = wing;
  }
  g.visible = false;
  scene.add(g);
  eagle.g = g;

  const sh = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 26),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34 })
  );
  sh.rotation.x = -Math.PI / 2;
  sh.visible = false;
  scene.add(sh);
  eagle.shadow = sh;
}
function eagleDive() {
  if (eagle.active || !player.alive) return;
  eagle.active = true;
  eagle.phase = 1;
  eagle.t = 0;
  eagle.from.set(player.g.position.x + 4, 13, player.g.position.z + 15);
  eagle.g.visible = true;
  eagle.g.position.copy(eagle.from);
  AudioSys.play('eagle', 0.9);
}
function updateEagle(dt) {
  // sombra de aviso
  if (state === ST.PLAYING && player.alive && !eagle.active && idleT > EAGLE_WARN) {
    const k = clamp((idleT - EAGLE_WARN) / (EAGLE_AT - EAGLE_WARN), 0, 1);
    eagle.shadow.visible = true;
    eagle.shadow.position.set(player.g.position.x, player.g.position.y + 0.04, player.g.position.z);
    eagle.shadow.scale.setScalar(0.25 + k * 0.95);
    eagle.shadow.material.opacity = 0.15 + k * 0.3;
    if (idleT >= EAGLE_AT) eagleDive();
  } else if (!eagle.active) eagle.shadow.visible = false;

  if (!eagle.active) return;
  eagle.t += dt;
  const flap = Math.sin(eagle.t * 18) * 0.5;
  eagle.wingL.rotation.z = flap;
  eagle.wingR.rotation.z = -flap;
  if (eagle.phase === 1) {
    // mergulho
    const k = clamp(eagle.t / 0.72, 0, 1);
    const e = k * k * (3 - 2 * k);
    const tx = player.g.position.x, tz = player.g.position.z, ty = player.g.position.y + 0.35;
    eagle.g.position.set(lerp(eagle.from.x, tx, e), lerp(eagle.from.y, ty, e), lerp(eagle.from.z, tz, e));
    eagle.g.lookAt(tx, ty, tz - 0.01);
    eagle.shadow.visible = true;
    eagle.shadow.position.set(tx, player.g.position.y + 0.04, tz);
    eagle.shadow.scale.setScalar(1.2);
    if (k >= 1) {
      eagle.phase = 2;
      eagle.t = 0;
      AudioSys.play('woosh', 0.8);
      if (player.alive) die('aguia');
    }
  } else if (eagle.phase === 2) {
    // carrega para o céu
    eagle.g.position.y += 9 * dt;
    eagle.g.position.z -= 6 * dt;
    eagle.g.position.x += 1.5 * dt;
    eagle.g.rotation.set(0, Math.PI, 0);
    player.g.position.set(eagle.g.position.x, eagle.g.position.y - 0.75, eagle.g.position.z + 0.2);
    player.g.rotation.z = Math.sin(eagle.t * 6) * 0.25;
    eagle.shadow.visible = false;
  }
}
function eagleReset() {
  eagle.active = false;
  eagle.phase = 0;
  eagle.g.visible = false;
  eagle.shadow.visible = false;
}

// ------------------------------------------------------------
// Fileiras procedurais
// ------------------------------------------------------------
let plan = [];
function resetPlan() { plan = ['grass', 'grass', 'grass', 'grass', 'grass', 'grass']; }
function bandFor(idx) {
  const depth = plan.length;
  const w = [
    ['grass', 30, 1, 3],
    ['road', 34, 1, Math.min(4, 2 + Math.floor(depth / 50))],
    ['river', 20, 1, Math.min(3, 1 + Math.floor(depth / 40))],
    ['rail', depth > 8 ? 16 : 0, 1, 2],
  ];
  const total = w.reduce((s, x) => s + x[1], 0);
  let r = Math.random() * total;
  for (const [t, wt, a, b] of w) {
    r -= wt;
    if (r <= 0) return [t, randi(a, b)];
  }
  return ['grass', 2];
}
function rowType(idx) {
  if (idx < 6) return 'grass';
  while (plan.length <= idx) {
    const [t, n] = bandFor(plan.length);
    // rio e trilho nunca emendam com banda igual sem respiro
    if ((t === 'river' || t === 'rail') && plan[plan.length - 1] === t) { plan.push('grass'); continue; }
    for (let i = 0; i < n; i++) plan.push(t);
  }
  return plan[idx];
}

const rowsByIdx = new Map();

function genRow(idx) {
  const type = idx < 0 ? 'grass' : rowType(idx);
  const z = -idx * CELL;
  const row = { idx, type, z, items: [], blocked: null, coins: null, cars: null,
    floats: null, dir: 1, speed: 0, railT: 0, railState: 0, signal: null, train: null, trainDir: 1 };

  const ground = groundPool.get();
  ground.g.material = type === 'grass' ? (idx % 2 ? matGrassB : matGrassA)
    : type === 'road' ? matRoad : type === 'rail' ? matRail : matRiver;
  ground.g.position.set(0, type === 'river' ? -1.55 : -1, z);
  row.ground = ground;

  if (type === 'grass') {
    row.blocked = new Set();
    row.coins = new Map();
    // decoração densa fora da área jogável
    for (let c = -DECOR; c <= DECOR; c++) {
      if (Math.abs(c) <= COLS) continue;
      if (Math.random() < 0.34) {
        const t = treePool.get();
        t.g.position.set(c * CELL + rand(-0.3, 0.3), 0, z);
        row.items.push({ pool: treePool, o: t });
      }
    }
    // obstáculos jogáveis (nunca nas 4 primeiras fileiras)
    if (idx > 3) {
      const cols = [];
      for (let c = -COLS; c <= COLS; c++) cols.push(c);
      for (let i = cols.length - 1; i > 0; i--) { const j = randi(0, i); [cols[i], cols[j]] = [cols[j], cols[i]]; }
      const nObs = randi(0, Math.min(4, 2 + Math.floor(idx / 60)));
      for (let i = 0; i < nObs; i++) {
        const c = cols[i];
        const rock = Math.random() < 0.3;
        const o = rock ? rockPool.get() : treePool.get();
        o.g.position.set(c * CELL, 0, z);
        row.items.push({ pool: rock ? rockPool : treePool, o });
        row.blocked.add(c);
      }
      // moedas em casas livres
      if (Math.random() < 0.34) {
        const nc = Math.random() < 0.25 ? 2 : 1;
        for (let i = 0; i < nc; i++) {
          const c = cols[nObs + i];
          if (c === undefined || row.coins.has(c)) continue;
          const coin = coinPool.get();
          coin.g.position.set(c * CELL, 0.55, z);
          row.coins.set(c, coin);
          row.items.push({ pool: coinPool, o: coin });
        }
      }
    }
  } else if (type === 'road') {
    row.dir = Math.random() < 0.5 ? 1 : -1;
    row.speed = clamp(rand(2.0, 3.0) + idx * 0.045 * rand(0.6, 1.4), 2, 9);
    row.cars = [];
    const n = randi(2, 3);
    const gap = WRAP / n;
    const off = rand(0, gap);
    for (let i = 0; i < n; i++) {
      const car = carPool.get();
      let x = -WRAP / 2 + off + i * gap + rand(-2, 2);
      x = ((x + WRAP / 2) % WRAP + WRAP) % WRAP - WRAP / 2;
      car.g.position.set(x, 0, z);
      car.g.rotation.y = row.dir > 0 ? 0 : Math.PI;
      row.cars.push(car);
      row.items.push({ pool: carPool, o: car });
    }
    // pintura: tracejado entre pistas, linha cheia nas bordas
    const prev = idx > 0 ? rowType(idx - 1) : 'grass';
    if (prev === 'road') {
      const d = dashPool.get();
      d.g.position.set(0, 0.04, z + CELL / 2);
      row.items.push({ pool: dashPool, o: d });
    } else {
      const e = edgePool.get();
      e.g.position.set(0, 0.04, z + CELL / 2 - 0.2);
      row.items.push({ pool: edgePool, o: e });
    }
  } else if (type === 'rail') {
    for (let c = -DECOR; c <= DECOR; c++) {
      const r = railPool.get();
      r.g.position.set(c * CELL, 0.02, z);
      row.items.push({ pool: railPool, o: r });
    }
    const sig = signalPool.get();
    sig.g.position.set(0, 0, z + 0.55);
    sig.lamps.forEach(l => l.color.setHex(0x440000));
    row.signal = sig;
    row.items.push({ pool: signalPool, o: sig });
    row.railState = 0;
    row.railT = rand(2.0, 6.5);
  } else if (type === 'river') {
    row.dir = Math.random() < 0.5 ? 1 : -1;
    row.speed = clamp(rand(1.1, 1.9) + idx * 0.012, 1, 3.4);
    row.floats = [];
    const n = randi(2, 3);
    const gap = WRAP / n;
    const off = rand(0, gap);
    for (let i = 0; i < n; i++) {
      const f = floatPool.get();
      let x = -WRAP / 2 + off + i * gap + rand(-1.5, 1.5);
      x = ((x + WRAP / 2) % WRAP + WRAP) % WRAP - WRAP / 2;
      f.g.position.set(x, -0.78, z);
      row.floats.push(f);
      row.items.push({ pool: floatPool, o: f });
    }
  }
  // fileira após estrada: pinta borda na estrada de trás
  if (type !== 'road' && idx > 0 && rowType(idx - 1) === 'road') {
    const e = edgePool.get();
    e.g.position.set(0, 0.04, z + CELL / 2 + 0.2);
    row.items.push({ pool: edgePool, o: e });
  }
  return row;
}

function freeRow(row) {
  groundPool.put(row.ground);
  for (const it of row.items) it.pool.put(it.o);
  if (row.train) { row.train.busy = false; row.train.g.visible = false; row.train = null; }
  row.items.length = 0;
}

function ensureRows() {
  const fr = Math.round(-focus.z / CELL);
  const minI = fr - ROWS_BEHIND, maxI = fr + ROWS_AHEAD;
  for (const [i, r] of rowsByIdx) {
    if (i < minI || i > maxI) { freeRow(r); rowsByIdx.delete(i); }
  }
  for (let i = minI; i <= maxI; i++) {
    if (!rowsByIdx.has(i)) rowsByIdx.set(i, genRow(i));
  }
}

// ------------------------------------------------------------
// Jogador
// ------------------------------------------------------------
const player = {
  g: new THREE.Group(), model: null, petId: LS.get('travessia_sel', 'animal-chick'),
  row: 0, x: 0,
  hopping: false, hopT: 0, hopDur: 0.15,
  fx: 0, fz: 0, fy: 0, tx: 0, tz: 0, ty: 0, trow: 0,
  charging: false, chargeDir: null, buffered: null,
  riding: null, alive: true, deathT: 0, cause: '',
  vx: 0, vy: 0, spin: 0, landT: 0,
};
scene.add(player.g);

function setPet(id) {
  player.petId = id;
  LS.set('travessia_sel', id);
  if (player.model) player.g.remove(player.model);
  const inst = makeInst('pets/' + id, 1.2);
  inst.inner.rotation.y = Math.PI;        // encara -Z (para frente)
  player.model = inst.g;
  player.g.add(player.model);
}

const DIRS = { f: [0, -1], b: [0, 1], l: [-1, 0], r: [1, 0] };
const DIR_ANG = { f: 0, b: Math.PI, l: Math.PI / 2, r: -Math.PI / 2 };

function hop(dir) {
  if (state !== ST.PLAYING || !player.alive) return;
  if (player.hopping) { player.buffered = dir; return; }
  const [dx, dz] = DIRS[dir];
  const targetRow = player.row - dz;        // frente = fileira maior
  const fr = Math.round(-focus.z / CELL);
  if (targetRow < fr - 4) return;           // não pode voltar para trás da câmera
  const tRowType = targetRow < 0 ? 'grass' : rowType(targetRow);
  let tx;
  if (tRowType === 'river') {
    tx = player.x + dx * CELL;              // contínuo sobre a água
    if (Math.abs(tx) > COLS * CELL + 2.5) return;
  } else {
    const col = clamp(Math.round((player.x + dx * CELL) / CELL), -COLS, COLS);
    if (dx !== 0 && col === Math.round(player.x / CELL) && Math.abs(player.x - col * CELL) < 0.4) return; // borda
    tx = col * CELL;
    const r = rowsByIdx.get(targetRow);
    if (r && r.blocked && r.blocked.has(col)) {  // árvore/pedra: esbarra
      player.g.rotation.y = DIR_ANG[dir];
      player.landT = 0.12;
      AudioSys.play('tick', 0.5);
      return;
    }
  }
  player.hopping = true;
  player.hopT = 0;
  player.fx = player.g.position.x; player.fz = player.g.position.z; player.fy = player.g.position.y;
  player.tx = tx; player.tz = -targetRow * CELL;
  player.ty = tRowType === 'river' ? -0.25 : 0;
  player.trow = targetRow;
  player.riding = null;
  player.g.rotation.y = DIR_ANG[dir];
  idleT = 0;
  AudioSys.play('jump', 0.45);
}

function land() {
  player.hopping = false;
  player.row = player.trow;
  player.x = player.tx;
  player.g.position.set(player.tx, player.ty, player.tz);
  player.landT = 0.13;
  const row = rowsByIdx.get(player.row);
  spawnBurst(player.tx, player.ty + 0.05, player.tz, 'dust', 5, 0.7);

  // pontuação
  if (player.row > maxRow) {
    maxRow = player.row;
    if (maxRow > getRecord() && !newRec) {
      newRec = true;
      announce('NOVO RECORDE!');
      AudioSys.play('record', 0.8);
    }
    updateHUD();
  }
  if (!row) return;

  if (row.type === 'river') {
    const f = row.floats.find(f => Math.abs(f.g.position.x - player.x) < f.len / 2 + 0.45);
    if (f) {
      player.riding = f;
      player.x = clamp(player.x, f.g.position.x - f.len * 0.42, f.g.position.x + f.len * 0.42);
      player.g.position.x = player.x;
      player.g.position.y = -0.78 + f.rideY;
    } else {
      die('agua');
      return;
    }
  }
  if (row.coins) {
    for (const [c, coin] of row.coins) {
      if (Math.abs(coin.g.position.x - player.x) < 0.95) {
        row.coins.delete(c);
        const k = row.items.findIndex(it => it.o === coin);
        if (k >= 0) row.items.splice(k, 1);
        coinPool.put(coin);
        runCoins++;
        setBank(getBank() + 1);
        spawnBurst(player.x, 0.7, player.g.position.z, 'spark', 7, 0.8);
        AudioSys.play('coin', 0.6);
        updateHUD();
      }
    }
  }
  if (player.buffered) { const b = player.buffered; player.buffered = null; hop(b); }
}

function die(cause, dir = 1) {
  if (!player.alive) return;
  player.alive = false;
  player.cause = cause;
  player.deathT = 0;
  player.hopping = false;
  idleT = 0;
  const p = player.g.position;
  if (cause === 'carro') {
    player.g.scale.set(1.5, 0.08, 1.5);
    p.y = 0.02;
    spawnBurst(p.x, 0.4, p.z, 'feather', 16, 1.3);
    AudioSys.play('hit', 0.9);
    shake = 0.65;
  } else if (cause === 'agua') {
    spawnBurst(p.x, -0.4, p.z, 'water', 18, 1.2);
    AudioSys.play('splash', 0.8);
    shake = 0.3;
  } else if (cause === 'trem') {
    player.vx = dir * 10;
    player.vy = 10;
    player.spin = 14;
    spawnBurst(p.x, 0.6, p.z, 'feather', 18, 1.6);
    AudioSys.play('hit', 1);
    AudioSys.play('train', 0.9);
    shake = 0.9;
  } else if (cause === 'aguia') {
    shake = 0.4;
  }
  setTimeout(() => endGame(), 1150);
}

// ------------------------------------------------------------
// Estado / fluxo
// ------------------------------------------------------------
const ST = { MENU: 0, PLAYING: 1, OVER: 2 };
let state = ST.MENU;
let focus = { x: 0, z: 0 };
let maxRow = 0, runCoins = 0, idleT = 0, graceT = 0, newRec = false;
let shake = 0, time = 0;
let fpsFrames = 0, fpsAcc = 0, fpsValue = 60;

function resetWorld() {
  for (const [, r] of rowsByIdx) freeRow(r);
  rowsByIdx.clear();
  resetPlan();
  eagleReset();
  for (const p of particles) { p.t = p.life = 0; p.m.visible = false; }
}

function startGame() {
  const sel = PETS[selIdx];
  if (!getPets().includes(sel.id)) {       // bicho bloqueado não joga
    AudioSys.play('tick', 0.7);
    announce('BICHO BLOQUEADO!\nuse a máquina de prêmios');
    return;
  }
  if (player.petId !== sel.id || !player.model) setPet(sel.id);
  resetWorld();
  player.row = 0; player.x = 0;
  player.alive = true; player.hopping = false; player.buffered = null;
  player.riding = null; player.vx = 0; player.vy = 0; player.spin = 0;
  player.g.position.set(0, 0, 0);
  player.g.rotation.set(0, 0, 0);
  player.g.scale.set(1, 1, 1);
  player.g.visible = true;
  focus.x = 0; focus.z = 0;
  maxRow = 0; runCoins = 0; idleT = 0; graceT = 2.2; newRec = false;
  ensureRows();
  state = ST.PLAYING;
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('end').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  AudioSys.play('confirm', 0.7);
  AudioSys.playMusic('game');
  updateHUD();
}

const DEATH_TITLES = {
  carro: 'ATROPELADO!',
  agua: 'GLUB GLUB GLUB...',
  trem: 'O TREM NÃO FREIA',
  aguia: 'LEVADO PELA ÁGUIA',
};
function endGame() {
  if (state !== ST.PLAYING) return;
  state = ST.OVER;
  saveRecord(maxRow);
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('end').classList.remove('hidden');
  document.getElementById('end-title').textContent = DEATH_TITLES[player.cause] || 'FIM DA TRAVESSIA';
  document.getElementById('end-stats').innerHTML =
    'travessia: <b>' + maxRow + ' passos</b>' +
    (newRec ? ' · <b>NOVO RECORDE!</b>' : '') +
    '<br>moedas: +' + runCoins + ' 🪙 (total ' + getBank() + ')' +
    '<br>recorde: ' + getRecord() + ' passos';
  AudioSys.play('lose', 0.55);
  AudioSys.playMusic('gameover');
}

function backToMenu() {
  state = ST.MENU;
  document.getElementById('end').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
  updateMenuUI();
  AudioSys.playMusic('menu');
}

// ------------------------------------------------------------
// HUD / anúncios
// ------------------------------------------------------------
const $ = id => document.getElementById(id);
let announceTimer = null;
function announce(msg, dur = 1600) {
  const el = $('announce');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => el.classList.remove('show'), dur);
}
function updateHUD() {
  $('steps').textContent = maxRow + (maxRow === 1 ? ' passo' : ' passos');
  $('record-live').textContent = 'recorde ' + Math.max(getRecord(), maxRow);
  $('coins').textContent = '🪙 ' + getBank();
  $('run-coins').textContent = '+' + runCoins + ' nesta corrida';
}

// ------------------------------------------------------------
// Menu: seletor de bicho + máquina de prêmios
// ------------------------------------------------------------
const THUMBS = {}, THUMBS_LOCK = {};
let selIdx = 0;

function makeThumbs() {
  const tr = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  tr.setSize(180, 180);
  const sc = new THREE.Scene();
  sc.add(new THREE.AmbientLight(0xffffff, 1.25));
  const dl = new THREE.DirectionalLight(0xffffff, 1.9);
  dl.position.set(2.5, 4, 3);
  sc.add(dl);
  const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
  cam.position.set(1.35, 1.5, 2.3);
  cam.lookAt(0, 0.5, 0);
  const black = new THREE.MeshBasicMaterial({ color: 0x10141c });
  for (const p of PETS) {
    const inst = makeInst('pets/' + p.id, 1.15);
    inst.g.rotation.y = 0.5;
    sc.add(inst.g);
    tr.render(sc, cam);
    THUMBS[p.id] = tr.domElement.toDataURL();
    inst.g.traverse(o => { if (o.isMesh) o.material = black; });
    tr.render(sc, cam);
    THUMBS_LOCK[p.id] = tr.domElement.toDataURL();
    sc.remove(inst.g);
  }
  tr.dispose();
}

function updateSelector() {
  const p = PETS[selIdx];
  const owned = getPets().includes(p.id);
  $('sel-img').src = owned ? THUMBS[p.id] : THUMBS_LOCK[p.id];
  $('sel-name').textContent = owned ? p.name : '? ? ?';
  $('sel-name').classList.toggle('locked', !owned);
  if (owned && state === ST.MENU) setPet(p.id);
}
function updateMenuUI() {
  $('bank-n').textContent = getBank();
  $('record').textContent = getRecord();
  updateSelector();
}

let gachaBusy = false;
function spinGacha() {
  if (gachaBusy) return;
  if (getBank() < 100) {
    const b = $('btn-gacha');
    b.classList.remove('poor');
    void b.offsetWidth;
    b.classList.add('poor');
    AudioSys.play('tick', 0.7);
    announce('MOEDAS INSUFICIENTES!\njunte 100 🪙 atravessando', 1800);
    return;
  }
  gachaBusy = true;
  setBank(getBank() - 100);
  updateMenuUI();
  AudioSys.play('confirm', 0.6);
  $('gacha').classList.remove('hidden');
  const cap = $('capsule');
  cap.classList.remove('open');
  cap.classList.add('shake');
  $('gacha-result').classList.add('hidden');
  $('gacha-ok').classList.add('hidden');
  cap.style.display = '';
  const tickInt = setInterval(() => AudioSys.play('tick', 0.4), 180);
  setTimeout(() => {
    clearInterval(tickInt);
    cap.classList.remove('shake');
    cap.classList.add('open');
    const win = PETS[randi(0, PETS.length - 1)];
    const pets = getPets();
    const dup = pets.includes(win.id);
    setTimeout(() => {
      cap.style.display = 'none';
      $('gacha-img').src = THUMBS[win.id];
      $('gacha-name').textContent = win.name;
      if (dup) {
        setBank(getBank() + 30);
        $('gacha-sub').textContent = 'Repetido! +30 moedas de volta 🪙';
        AudioSys.play('dup', 0.8);
      } else {
        pets.push(win.id);
        savePets(pets);
        $('gacha-sub').textContent = 'NOVO BICHO DESBLOQUEADO!';
        selIdx = PETS.findIndex(p => p.id === win.id);
        AudioSys.play('unlock', 0.9);
      }
      $('gacha-result').classList.remove('hidden');
      $('gacha-ok').classList.remove('hidden');
      updateMenuUI();
    }, 420);
  }, 1450);
}

$('sel-prev').addEventListener('click', () => { AudioSys.unlock(); selIdx = (selIdx + PETS.length - 1) % PETS.length; AudioSys.play('click', 0.5); updateSelector(); });
$('sel-next').addEventListener('click', () => { AudioSys.unlock(); selIdx = (selIdx + 1) % PETS.length; AudioSys.play('click', 0.5); updateSelector(); });
$('btn-gacha').addEventListener('click', () => { AudioSys.unlock(); spinGacha(); });
$('gacha-ok').addEventListener('click', () => {
  $('gacha').classList.add('hidden');
  $('capsule').classList.remove('open');
  $('capsule').style.display = '';
  gachaBusy = false;
  AudioSys.play('click', 0.5);
  updateMenuUI();
});
$('btn-start').addEventListener('click', () => { AudioSys.unlock(); startGame(); });
$('btn-retry').addEventListener('click', () => { AudioSys.unlock(); startGame(); });
$('btn-menu').addEventListener('click', () => { AudioSys.unlock(); backToMenu(); });

// ------------------------------------------------------------
// Entrada
// ------------------------------------------------------------
const KEYMAP = {
  arrowup: 'f', w: 'f', arrowdown: 'b', s: 'b',
  arrowleft: 'l', a: 'l', arrowright: 'r', d: 'r',
};
window.addEventListener('keydown', e => {
  AudioSys.unlock();
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'enter') {
    if (state === ST.MENU && $('gacha').classList.contains('hidden')) startGame();
    else if (state === ST.OVER) startGame();
    return;
  }
  if (k === 'm') { AudioSys.toggleMute(); return; }
  const dir = KEYMAP[k];
  if (dir) {
    e.preventDefault();
    player.charging = true;
    player.chargeDir = dir;
  }
});
window.addEventListener('keyup', e => {
  const dir = KEYMAP[e.key.toLowerCase()];
  if (dir && player.chargeDir === dir) {
    player.charging = false;
    player.chargeDir = null;
    hop(dir);
  }
});

let touchStart = null;
window.addEventListener('pointerdown', e => {
  AudioSys.unlock();
  if (e.target.closest('.overlay, button, a')) return;
  touchStart = { x: e.clientX, y: e.clientY, t: performance.now() };
  player.charging = true;     // pré-carrega o pulo
});
window.addEventListener('pointerup', e => {
  if (!touchStart) return;
  player.charging = false;
  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  touchStart = null;
  let dir = 'f';
  if (Math.abs(dx) > 22 || Math.abs(dy) > 22) {
    dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy < 0 ? 'f' : 'b');
  }
  hop(dir);
});
window.addEventListener('pointercancel', () => { touchStart = null; player.charging = false; });

// ------------------------------------------------------------
// Atualização das fileiras (carros, trens, rio)
// ------------------------------------------------------------
function updateRows(dt) {
  const fr = Math.round(-focus.z / CELL);
  for (const [idx, row] of rowsByIdx) {
    if (idx < fr - 4 || idx > fr + 22) continue;

    if (row.type === 'road') {
      for (const car of row.cars) {
        car.g.position.x += row.dir * row.speed * dt;
        if (row.dir > 0 && car.g.position.x > WRAP / 2) car.g.position.x -= WRAP;
        if (row.dir < 0 && car.g.position.x < -WRAP / 2) car.g.position.x += WRAP;
      }
    } else if (row.type === 'river') {
      for (const f of row.floats) {
        f.g.position.x += row.dir * row.speed * dt;
        if (row.dir > 0 && f.g.position.x > WRAP / 2) f.g.position.x -= WRAP;
        if (row.dir < 0 && f.g.position.x < -WRAP / 2) f.g.position.x += WRAP;
        f.g.position.y = -0.78 + Math.sin(time * 2.2 + f.g.position.x) * 0.035;
      }
    } else if (row.type === 'rail') {
      // só corre o ciclo perto da janela visível
      if (idx < fr - 2 || idx > fr + 19) continue;
      if (row.railState === 0) {
        row.railT -= dt;
        if (row.railT <= 0) {
          const tr = getTrain();
          if (tr) {
            row.railState = 1;
            row.railT = 1.2;          // aviso: 1.2s de suspense
            row.train = tr;
            tr.busy = true;
            row.trainDir = Math.random() < 0.5 ? 1 : -1;
            if (Math.abs(idx - player.row) < 11) AudioSys.play('bell', 0.7);
            row.bellAgain = true;
          } else row.railT = rand(0.5, 1.5);
        }
      } else if (row.railState === 1) {
        row.railT -= dt;
        const on = Math.floor(time * 7) % 2 === 0;
        row.signal.lamps.forEach((l, i) => l.color.setHex((on === (i % 2 === 0)) ? 0xff2020 : 0x440000));
        if (row.bellAgain && row.railT < 0.55 && Math.abs(idx - player.row) < 11) {
          AudioSys.play('bell', 0.6);
          row.bellAgain = false;
        }
        if (row.railT <= 0) {
          row.railState = 2;
          const tr = row.train;
          tr.g.visible = true;
          tr.g.rotation.y = row.trainDir > 0 ? 0 : Math.PI;
          tr.g.position.set(-row.trainDir * (WRAP / 2 + tr.len / 2 + 1), 0.25, row.z);
          if (Math.abs(idx - player.row) < 9) AudioSys.play('train', 0.55);
        }
      } else if (row.railState === 2) {
        const tr = row.train;
        tr.g.position.x += row.trainDir * TRAIN_SPEED * dt;
        const on = Math.floor(time * 7) % 2 === 0;
        row.signal.lamps.forEach((l, i) => l.color.setHex((on === (i % 2 === 0)) ? 0xff2020 : 0x440000));
        // trem varre o jogador
        if (player.alive && player.row === idx && player.g.position.y < 0.5 &&
            Math.abs(player.g.position.x - tr.g.position.x) < tr.len / 2 + 0.6) {
          die('trem', row.trainDir);
        }
        if (Math.abs(tr.g.position.x) > WRAP / 2 + tr.len / 2 + 2) {
          tr.g.visible = false;
          tr.busy = false;
          row.train = null;
          row.railState = 0;
          row.railT = rand(3, 8);
          row.signal.lamps.forEach(l => l.color.setHex(0x440000));
        }
      }
    }
    // moedas giram
    if (row.coins) {
      for (const [, c] of row.coins) {
        c.g.rotation.y += 2.6 * dt;
        c.g.position.y = 0.55 + Math.sin(time * 3 + c.g.position.x) * 0.07;
      }
    }
  }
}

// ------------------------------------------------------------
// Atualização do jogador
// ------------------------------------------------------------
function updatePlayer(dt) {
  if (!player.alive) {
    player.deathT += dt;
    if (player.cause === 'agua') {
      player.g.position.y -= 2.2 * dt;
      player.g.scale.multiplyScalar(Math.max(0.2, 1 - dt * 1.5));
    } else if (player.cause === 'trem') {
      player.vy -= 22 * dt;
      player.g.position.x += player.vx * dt;
      player.g.position.y = Math.max(-1.5, player.g.position.y + player.vy * dt);
      player.g.rotation.z += player.spin * dt;
      player.g.rotation.x += player.spin * 0.6 * dt;
    }
    return;
  }

  // pulo em arco com squash & stretch
  if (player.hopping) {
    player.hopT += dt / player.hopDur;
    const t = Math.min(1, player.hopT);
    const arc = Math.sin(Math.PI * t) * 0.62;
    player.g.position.x = lerp(player.fx, player.tx, t);
    player.g.position.z = lerp(player.fz, player.tz, t);
    player.g.position.y = lerp(player.fy, player.ty, t) + arc;
    const st = 1 + Math.sin(Math.PI * t) * 0.22;
    player.g.scale.set(1 / st * 1.05, st, 1 / st * 1.05);
    if (t >= 1) land();
    return;
  }

  // squash de carregar/pousar
  let targetY = 1;
  if (player.charging) targetY = 0.68;
  else if (player.landT > 0) { player.landT -= dt; targetY = 0.82; }
  const sy = lerp(player.g.scale.y, targetY, 18 * dt);
  player.g.scale.set(1 + (1 - sy) * 0.55, sy, 1 + (1 - sy) * 0.55);

  const row = rowsByIdx.get(player.row);

  // rio: tronco carrega o jogador
  if (player.riding) {
    player.x += (row ? row.dir * row.speed : 0) * dt;
    player.g.position.x = player.x;
    player.g.position.y = player.riding.g.position.y + player.riding.rideY;
    if (Math.abs(player.x) > COLS * CELL + 2.6) { die('agua'); return; }
  } else if (row && row.type === 'river') {
    die('agua');
    return;
  }

  // carros
  if (row && row.type === 'road' && player.g.position.y < 0.5) {
    for (const car of row.cars) {
      if (Math.abs(car.g.position.x - player.g.position.x) < car.len / 2 + 0.62) {
        die('carro', row.dir);
        return;
      }
    }
  }

  // pressão dupla: ficar para trás = águia
  if (graceT <= 0) {
    idleT += dt;
    if (player.g.position.z > focus.z + BEHIND_LIMIT && !eagle.active) {
      announce('A ÁGUIA TE ALCANÇOU!');
      eagleDive();
    }
  }
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

  if (state === ST.PLAYING) {
    if (graceT > 0) graceT -= dt;
    // câmera avança sozinha (pressão!) e segue o jogador
    if (player.alive) {
      if (graceT <= 0) {
        const creep = Math.min(1.55, 0.42 + maxRow * 0.012);
        focus.z -= creep * dt;
      }
      const desired = player.g.position.z - 2.4;
      if (desired < focus.z) focus.z += (desired - focus.z) * Math.min(1, 5 * dt);
    }
    focus.x = lerp(focus.x, clamp(player.g.position.x * 0.45, -3.5, 3.5), 4 * dt);
    updatePlayer(dt);
  }

  ensureRows();
  updateRows(dt);
  updateEagle(dt);
  updateParticles(dt);

  // câmera isométrica com tremor
  let sx = 0, sz = 0;
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); sx = rand(-shake, shake) * 0.6; sz = rand(-shake, shake) * 0.6; }
  camera.position.set(focus.x + 9.6 + sx, 18.2, focus.z + 12.8 + sz);
  camera.lookAt(focus.x + sx, 0, focus.z - 3.4 + sz);

  // sol acompanha o foco (sombras estáveis)
  sun.position.set(focus.x - 9, 22, focus.z + 4);
  sun.target.position.set(focus.x, 0, focus.z - 8);

  renderer.render(scene, camera);
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
AudioSys.load();
$('record').textContent = getRecord();
$('bank-n').textContent = getBank();

if (document.fonts && document.fonts.load) {
  document.fonts.load('20px "Kenney Future"');
  document.fonts.load('20px "Kenney Mono"');
}

Promise.all(MODELS.map(loadModel)).then(() => {
  CAR_S = 2.55 / LIB['cars/sedan'].size.z;   // escala única do Car Kit
  buildTrains();
  buildEagle();
  makeThumbs();
  const ownedSel = PETS.findIndex(p => p.id === player.petId && getPets().includes(p.id));
  selIdx = ownedSel >= 0 ? ownedSel : 0;
  setPet(PETS[selIdx].id);
  resetPlan();
  ensureRows();
  updateMenuUI();
  document.getElementById('loading').classList.add('hidden');
  AudioSys.playMusic('menu');
  tick();
}).catch(err => {
  console.error('Erro ao carregar modelos:', err);
  document.getElementById('loading').innerHTML = '<p class="story">Erro ao carregar modelos — veja o console.</p>';
});

// handle de testes
window.__TV = {
  get state() { return state; },
  get steps() { return maxRow; },
  get bank() { return getBank(); },
  get runCoins() { return runCoins; },
  get rows() { return rowsByIdx.size; },
  get fps() { return Math.round(fpsValue); },
  get alive() { return player.alive; },
  get playerRow() { return player.row; },
  get models() { return Object.keys(LIB).length; },
  get pets() { return getPets().length; },
  get pools() {
    return { ground: groundPool.free, tree: treePool.free, car: carPool.free,
      float: floatPool.free, rail: railPool.free, coin: coinPool.free };
  },
  get ahead() {
    const r = rowsByIdx.get(player.row + 1);
    if (!r) return null;
    return {
      type: r.type, dir: r.dir, speed: r.speed, st: r.railState,
      px: +player.g.position.x.toFixed(2),
      blocked: r.blocked ? [...r.blocked] : [],
      cars: r.cars ? r.cars.map(c => ({ x: +c.g.position.x.toFixed(1), len: +c.len.toFixed(1) })) : [],
      floats: r.floats ? r.floats.map(f => ({ x: +f.g.position.x.toFixed(1), len: +f.len.toFixed(1) })) : [],
    };
  },
  get rails() {
    const out = [];
    for (const [i, r] of rowsByIdx) if (r.type === 'rail') out.push({ idx: i, st: r.railState, t: +r.railT.toFixed(2), dir: r.trainDir, tx: r.train ? +r.train.g.position.x.toFixed(1) : null });
    return out.sort((a, b) => a.idx - b.idx);
  },
  get debug() {
    return { idleT: idleT.toFixed(2), graceT: graceT.toFixed(2), eagle: eagle.active,
      phase: eagle.phase, pz: player.g.position.z.toFixed(1), fz: focus.z.toFixed(1),
      hopping: player.hopping, riding: !!player.riding, cause: player.cause,
      rowType: player.row < 0 ? 'grass' : rowType(player.row) };
  },
  hop: d => hop(d),
  railSoon: () => { for (const [, r] of rowsByIdx) if (r.type === 'rail' && r.railState === 0) r.railT = Math.min(r.railT, 0.4); },
  give: n => { setBank(getBank() + n); updateMenuUI(); },
  gacha: () => spinGacha(),
  start: () => startGame(),
};
