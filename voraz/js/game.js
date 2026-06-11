// ============================================================
// VORAZ — o buraco que engoliu a cidade
// Hole.io-like de cidade procedural infinita
// Three.js + City Kit / Car Kit (Kenney, CC0)
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from '../lib/loaders/GLTFLoader.js';

// ------------------------------------------------------------
// Constantes e helpers
// ------------------------------------------------------------
const CELL = 4;                 // 1 célula = 4 unidades
const CHUNK = 20;               // 5×5 células
const ROAD_C = 2;               // centro da via dentro do chunk (célula 0)
const EAT_FACTOR = 1.25;        // raio necessário = eatR * fator
const TIERS = [
  { r: 0,    name: 'NÍVEL 1 · COME-CONES' },
  { r: 2.0,  name: 'NÍVEL 2 · COME-CARROS' },
  { r: 3.5,  name: 'NÍVEL 3 · COME-CASAS' },
  { r: 5.0,  name: 'NÍVEL 4 · COME-PRÉDIOS' },
  { r: 6.3,  name: 'NÍVEL 5 · DEVORA-TUDO' },
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// RNG determinístico por chunk (mundo novo a cada partida)
let WORLD_SEED = (Math.random() * 0xffffffff) >>> 0;
function hash2i(x, y) {
  let h = WORLD_SEED ^ (x * 374761393) ^ (y * 668265263);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------
// Renderer, cena, câmera, luzes
// ------------------------------------------------------------
// modo de verificação automática (?auto=1): inicia sozinho e vagueia comendo
const AUTO = new URLSearchParams(location.search).has('auto');

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: AUTO });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const SKY = new THREE.Color(0xf4cf9a);          // hora dourada
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 40, 140);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.5, 600);
camera.position.set(0, 18, 12);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.HemisphereLight(0xffe8c4, 0x73825c, 1.05));
const sun = new THREE.DirectionalLight(0xffd9a2, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 5; sun.shadow.camera.far = 250;
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(sun.target);
function fitSun(px, pz, R) {
  const half = clamp(30 + R * 2.5, 35, 90);
  sun.position.set(px + 50, 70, pz + 28);
  sun.target.position.set(px, 0, pz);
  const c = sun.shadow.camera;
  if (Math.abs(c.right - half) > 1) {
    c.left = -half; c.right = half; c.top = half; c.bottom = -half;
    c.updateProjectionMatrix();
  }
}

// ------------------------------------------------------------
// Manifesto de modelos
// fit: tamanho-alvo no mundo (maior dimensão do footprint, exceto axis:'y')
// mass: toneladas · kind: prop | car | house | com | sky
// ------------------------------------------------------------
const MANIFEST = {
  // vias
  'road/road-straight':       { fit: 4, road: true },
  'road/road-crossroad':      { fit: 4, road: true },
  'road/road-crossing':       { fit: 4, road: true },
  'road/construction-cone':   { fit: 0.7,  mass: 0.3, kind: 'prop' },
  'road/construction-barrier':{ fit: 1.7,  mass: 0.8, kind: 'prop' },
  'road/construction-light':  { fit: 1.9,  mass: 1.2, kind: 'prop' },
  'road/light-square':        { fit: 4.6,  mass: 1.5, kind: 'prop', axis: 'y' },
  'road/light-square-double': { fit: 4.6,  mass: 1.8, kind: 'prop', axis: 'y' },
  // subúrbio
  'sub/building-type-a': { fit: 5.5, mass: 60,  kind: 'house' },
  'sub/building-type-b': { fit: 5.5, mass: 70,  kind: 'house' },
  'sub/building-type-c': { fit: 5.5, mass: 65,  kind: 'house' },
  'sub/building-type-d': { fit: 5.5, mass: 80,  kind: 'house' },
  'sub/building-type-e': { fit: 5.5, mass: 75,  kind: 'house' },
  'sub/building-type-f': { fit: 5.5, mass: 85,  kind: 'house' },
  'sub/building-type-g': { fit: 5.5, mass: 90,  kind: 'house' },
  'sub/building-type-h': { fit: 5.5, mass: 95,  kind: 'house' },
  'sub/tree-small':  { fit: 1.7, mass: 1.0, kind: 'prop' },
  'sub/tree-large':  { fit: 3.2, mass: 2.5, kind: 'prop' },
  'sub/fence-low':   { fit: 2.2, mass: 0.8, kind: 'prop' },
  'sub/fence':       { fit: 2.4, mass: 1.0, kind: 'prop' },
  'sub/planter':     { fit: 1.3, mass: 0.6, kind: 'prop' },
  // comercial
  'com/building-a': { fit: 8, mass: 260, kind: 'com' },
  'com/building-b': { fit: 8, mass: 280, kind: 'com' },
  'com/building-c': { fit: 8, mass: 300, kind: 'com' },
  'com/building-d': { fit: 8, mass: 320, kind: 'com' },
  'com/building-e': { fit: 8, mass: 340, kind: 'com' },
  'com/building-f': { fit: 8, mass: 360, kind: 'com' },
  'com/low-detail-building-a': { fit: 7.5, mass: 240, kind: 'com' },
  'com/low-detail-building-b': { fit: 7.5, mass: 250, kind: 'com' },
  'com/low-detail-building-c': { fit: 7.5, mass: 260, kind: 'com' },
  'com/low-detail-building-d': { fit: 7.5, mass: 230, kind: 'com' },
  'com/low-detail-building-e': { fit: 7.5, mass: 220, kind: 'com' },
  'com/low-detail-building-f': { fit: 7.5, mass: 235, kind: 'com' },
  'com/low-detail-building-g': { fit: 7.5, mass: 270, kind: 'com' },
  'com/low-detail-building-h': { fit: 7.5, mass: 290, kind: 'com' },
  'com/building-skyscraper-a': { fit: 10, mass: 3200, kind: 'sky' },
  'com/building-skyscraper-b': { fit: 10, mass: 4200, kind: 'sky' },
  'com/building-skyscraper-c': { fit: 10, mass: 4800, kind: 'sky' },
  'com/building-skyscraper-d': { fit: 10, mass: 5600, kind: 'sky' },
  'com/building-skyscraper-e': { fit: 10, mass: 2800, kind: 'sky' },
  'com/detail-parasol-a': { fit: 1.6, mass: 0.4, kind: 'prop' },
  'com/detail-parasol-b': { fit: 1.6, mass: 0.4, kind: 'prop' },
  // carros
  'car/sedan':            { fit: 3.2, mass: 4,   kind: 'car' },
  'car/sedan-sports':     { fit: 3.2, mass: 4,   kind: 'car' },
  'car/hatchback-sports': { fit: 3.0, mass: 3.5, kind: 'car' },
  'car/taxi':             { fit: 3.2, mass: 4,   kind: 'car' },
  'car/police':           { fit: 3.4, mass: 4.5, kind: 'car' },
  'car/van':              { fit: 3.4, mass: 5,   kind: 'car' },
  'car/suv':              { fit: 3.4, mass: 4.5, kind: 'car' },
  'car/suv-luxury':       { fit: 3.5, mass: 5,   kind: 'car' },
  'car/delivery':         { fit: 4.2, mass: 7,   kind: 'car' },
  'car/ambulance':        { fit: 4.0, mass: 6,   kind: 'car' },
  'car/truck':            { fit: 4.6, mass: 9,   kind: 'car' },
  'car/garbage-truck':    { fit: 5.0, mass: 11,  kind: 'car' },
  'car/firetruck':        { fit: 5.4, mass: 13,  kind: 'car' },
  'car/box':         { fit: 0.9, mass: 0.5, kind: 'prop' },
  'car/cone':        { fit: 0.7, mass: 0.3, kind: 'prop' },
  'car/debris-tire': { fit: 0.8, mass: 0.2, kind: 'prop' },
};
const HOUSES   = Object.keys(MANIFEST).filter(k => MANIFEST[k].kind === 'house');
const COMS     = Object.keys(MANIFEST).filter(k => MANIFEST[k].kind === 'com');
const SKIES    = Object.keys(MANIFEST).filter(k => MANIFEST[k].kind === 'sky');
const CIVCARS  = ['car/sedan', 'car/sedan-sports', 'car/hatchback-sports', 'car/taxi',
                  'car/van', 'car/suv', 'car/suv-luxury', 'car/delivery', 'car/truck'];
const HEROCARS = ['car/police', 'car/ambulance', 'car/firetruck', 'car/garbage-truck'];

const LIB = {};
const loader = new GLTFLoader();
function loadModel(name) {
  return new Promise((resolve, reject) => {
    loader.load('assets/models/' + name + '.glb', g => {
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        if (o.material && o.material.isMeshStandardMaterial && o.material.metalness > 0.5) {
          o.material.metalness = 0.1; o.material.roughness = 0.8;
        }
      });
      const box = new THREE.Box3().setFromObject(g.scene);
      const size = box.getSize(new THREE.Vector3());
      const spec = MANIFEST[name];
      const base = spec.axis === 'y' ? size.y : Math.max(size.x, size.z);
      const s = spec.fit / (base || 1);
      LIB[name] = { scene: g.scene, scale: s, size: size.clone().multiplyScalar(s), min: box.min.clone() };
      resolve();
    }, undefined, reject);
  });
}

// instancia um modelo normalizado, ancorado no chão (y=0)
function spawnModel(name, shadows = true) {
  const lib = LIB[name];
  const m = lib.scene.clone(true);
  m.scale.setScalar(lib.scale);
  m.position.y = -lib.min.y * lib.scale;
  const g = new THREE.Group();
  g.add(m);
  if (shadows) m.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ------------------------------------------------------------
// Texturas procedurais (disco do buraco, redemoinho, poeira)
// ------------------------------------------------------------
function discTexture(edge) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, '#000000');
  g.addColorStop(0.62, '#06000a');
  g.addColorStop(0.88, '#16042a');
  g.addColorStop(1, edge);
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
function swirlTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.translate(128, 128);
  x.strokeStyle = color;
  x.lineWidth = 5;
  for (let arm = 0; arm < 3; arm++) {
    x.beginPath();
    for (let t = 0; t < 6.3; t += 0.08) {
      const r = 14 + t * 17;
      const a = t * 1.6 + arm * (Math.PI * 2 / 3);
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      t === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.globalAlpha = 0.55;
    x.stroke();
  }
  return new THREE.CanvasTexture(c);
}
function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(235,215,190,.95)');
  g.addColorStop(1, 'rgba(235,215,190,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const puffTex = puffTexture();

// ------------------------------------------------------------
// Buraco (jogador e rival)
// ------------------------------------------------------------
function makeHole(rimHex, edgeCss, swirlCss) {
  const grp = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ map: discTexture(edgeCss) })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.32;
  disc.renderOrder = 2;
  grp.add(disc);

  const swirl = new THREE.Mesh(
    new THREE.CircleGeometry(0.92, 48),
    new THREE.MeshBasicMaterial({
      map: swirlTexture(swirlCss), transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  swirl.rotation.x = -Math.PI / 2;
  swirl.position.y = 0.36;
  swirl.renderOrder = 3;
  grp.add(swirl);

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(0.96, 1.13, 48),
    new THREE.MeshBasicMaterial({
      color: rimHex, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.38;
  rim.renderOrder = 4;
  grp.add(rim);

  // partículas de sucção orbitando a borda
  const sucks = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: puffTex, color: rimHex, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.userData = { a: Math.random() * Math.PI * 2, d: 1 + Math.random() };
    sucks.push(s);
    grp.add(s);
  }
  scene.add(grp);
  return {
    grp, swirl, rim, sucks,
    mass: 0, x: 0, z: 0, vx: 0, vz: 0,
    R: 1.3, visR: 0.01, alive: true,
  };
}
const holeRadius = m => 1.2 * Math.pow(1 + m, 0.3);

function updateHoleVisual(h, dt, t) {
  h.visR = lerp(h.visR, h.R, 1 - Math.pow(0.002, dt));
  h.grp.position.set(h.x, 0, h.z);
  h.grp.scale.set(h.visR, 1, h.visR);
  h.swirl.rotation.z = t * 1.7;
  h.rim.material.opacity = 0.7 + Math.sin(t * 5) * 0.2;
  for (const s of h.sucks) {
    const u = s.userData;
    u.a += dt * (1.2 + u.d);
    u.d -= dt * 0.55;
    if (u.d < 0.1) { u.d = 1 + Math.random() * 0.3; u.a = Math.random() * Math.PI * 2; }
    s.position.set(Math.cos(u.a) * u.d, 0.5 + (1 - u.d) * 0.3, Math.sin(u.a) * u.d);
    const k = (0.08 + u.d * 0.1);
    s.scale.set(k, k, k);
    s.material.opacity = 0.42 * u.d;
  }
}

// ------------------------------------------------------------
// Cidade procedural em chunks
// ------------------------------------------------------------
const groundGeo = new THREE.PlaneGeometry(CHUNK, CHUNK);
const GROUND_MATS = {
  grass:    new THREE.MeshLambertMaterial({ color: 0x86b75f }),
  park:     new THREE.MeshLambertMaterial({ color: 0x79b35a }),
  concrete: new THREE.MeshLambertMaterial({ color: 0xa8a39a }),
  dirt:     new THREE.MeshLambertMaterial({ color: 0xb59365 }),
};

const chunks = new Map();       // "ci,cj" -> { group, edibles }
let edibles = [];               // todos os comíveis vivos

function districtOf(ci, cj) {
  const d = Math.hypot(ci, cj);
  if (d < 1.5) return 'sub';
  const h = hash2i(ci, cj);
  const wPark = 0.10, wObra = 0.08;
  const wSub  = Math.max(0.06, 0.58 - d * 0.06);
  const wCom  = Math.min(0.46, 0.22 + d * 0.04);
  const wDown = Math.min(0.38, Math.max(0, (d - 2.5) * 0.07));
  const total = wPark + wObra + wSub + wCom + wDown;
  let v = h * total;
  if ((v -= wSub) < 0) return 'sub';
  if ((v -= wCom) < 0) return 'com';
  if ((v -= wDown) < 0) return 'down';
  if ((v -= wPark) < 0) return 'park';
  return 'obra';
}

let ROAD_H = 0;   // altura da superfície da via (calculada após carregar)

function addEdible(list, group, name, x, z, rot, chunkKey, y = 0) {
  const spec = MANIFEST[name];
  const obj = spawnModel(name, spec.kind !== 'prop' || name.includes('tree'));
  obj.position.set(x, y, z);
  obj.rotation.y = rot;
  obj.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); });
  group.add(obj);
  const lib = LIB[name];
  const e = {
    root: obj, name, x, z,
    eatR: Math.max(lib.size.x, lib.size.z) * 0.5,
    h: lib.size.y,
    mass: spec.mass, kind: spec.kind,
    alive: true, falling: null, chunk: chunkKey, car: null,
  };
  edibles.push(e);
  if (list) list.push(e);
  return e;
}

function addStatic(group, name, x, z, rot = 0) {
  const obj = spawnModel(name, false);
  obj.position.set(x, 0, z);
  obj.rotation.y = rot;
  obj.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); });
  group.add(obj);
}

function buildChunk(ci, cj) {
  const key = ci + ',' + cj;
  if (chunks.has(key)) return;
  const rng = mulberry32((hash2i(ci, cj) * 0xffffffff) >>> 0);
  const district = districtOf(ci, cj);
  const group = new THREE.Group();
  const ox = ci * CHUNK, oz = cj * CHUNK;
  const list = [];

  // chão
  const gmat = district === 'park' ? GROUND_MATS.park
    : district === 'obra' ? GROUND_MATS.dirt
    : (district === 'com' || district === 'down') ? GROUND_MATS.concrete
    : GROUND_MATS.grass;
  const ground = new THREE.Mesh(groundGeo, gmat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(ox + CHUNK / 2, 0, oz + CHUNK / 2);
  ground.receiveShadow = true;
  ground.matrixAutoUpdate = false; ground.updateMatrix();
  group.add(ground);

  // vias: borda norte (ao longo de X) e oeste (ao longo de Z)
  addStatic(group, 'road/road-crossroad', ox + ROAD_C, oz + ROAD_C);
  for (let k = 1; k < 5; k++) {
    const cross = rng() < 0.18;
    addStatic(group, cross ? 'road/road-crossing' : 'road/road-straight',
      ox + ROAD_C + k * CELL, oz + ROAD_C, Math.PI / 2);
    addStatic(group, cross ? 'road/road-crossing' : 'road/road-straight',
      ox + ROAD_C, oz + ROAD_C + k * CELL, 0);
  }
  // postes no cruzamento e cones ocasionais na pista
  addEdible(list, group, 'road/light-square', ox + ROAD_C + 2.4, oz + ROAD_C + 2.4, Math.PI, key);
  if (rng() < 0.3) addEdible(list, group, 'road/construction-cone',
    ox + ROAD_C + 1 + rng() * 14, oz + ROAD_C + (rng() - 0.5) * 2, 0, key, ROAD_H);

  // interior do quarteirão: 16×16 a partir de (4,4)
  const bx = ox + 4, bz = oz + 4;
  const quad = [[4, 4], [12, 4], [4, 12], [12, 12]];
  const jitter = () => (rng() - 0.5) * 1.6;

  if (district === 'sub') {
    for (const [qx, qz] of quad) {
      if (rng() < 0.85) {
        const face = qz < 8 ? Math.PI : 0;   // de frente para a rua mais próxima
        addEdible(list, group, HOUSES[(rng() * HOUSES.length) | 0],
          bx + qx + jitter(), bz + qz + jitter(), face + (rng() - 0.5) * 0.3, key);
      } else {
        addEdible(list, group, 'sub/tree-large', bx + qx, bz + qz, rng() * 6.3, key);
      }
    }
    const small = ['sub/tree-small', 'sub/planter', 'sub/fence-low', 'car/box', 'sub/tree-small'];
    for (let i = 0; i < 6; i++) {
      addEdible(list, group, small[(rng() * small.length) | 0],
        bx + rng() * 16, bz + 8 + (rng() - 0.5) * 1.5, rng() * 6.3, key);
    }
  } else if (district === 'com') {
    for (const [qx, qz] of quad) {
      addEdible(list, group, COMS[(rng() * COMS.length) | 0],
        bx + qx + jitter() * 0.5, bz + qz + jitter() * 0.5, ((rng() * 4) | 0) * Math.PI / 2, key);
    }
    for (let i = 0; i < 4; i++) {
      const t = rng() < 0.5 ? 'com/detail-parasol-a' : 'sub/planter';
      addEdible(list, group, t, bx + rng() * 16, bz + 8 + (rng() - 0.5) * 2, rng() * 6.3, key);
    }
  } else if (district === 'down') {
    addEdible(list, group, SKIES[(rng() * SKIES.length) | 0], bx + 8, bz + 8, ((rng() * 4) | 0) * Math.PI / 2, key);
    const corners = [[1.5, 1.5], [14.5, 1.5], [1.5, 14.5], [14.5, 14.5]];
    for (const [qx, qz] of corners) {
      if (rng() < 0.7) addEdible(list, group, rng() < 0.5 ? 'sub/planter' : 'com/detail-parasol-b',
        bx + qx, bz + qz, rng() * 6.3, key);
    }
  } else if (district === 'park') {
    for (let i = 0; i < 9; i++) {
      const t = rng() < 0.55 ? 'sub/tree-large' : 'sub/tree-small';
      addEdible(list, group, t, bx + 1 + rng() * 14, bz + 1 + rng() * 14, rng() * 6.3, key);
    }
    for (let i = 0; i < 3; i++) {
      addEdible(list, group, 'sub/planter', bx + rng() * 16, bz + rng() * 16, rng() * 6.3, key);
    }
  } else { // obra
    const stuff = ['road/construction-cone', 'road/construction-barrier', 'car/box',
      'road/construction-light', 'car/debris-tire', 'road/construction-cone'];
    for (let i = 0; i < 14; i++) {
      addEdible(list, group, stuff[(rng() * stuff.length) | 0],
        bx + rng() * 16, bz + rng() * 16, rng() * 6.3, key);
    }
    if (rng() < 0.5) addEdible(list, group, 'car/truck', bx + 4 + rng() * 8, bz + 4 + rng() * 8, rng() * 6.3, key);
  }

  scene.add(group);
  chunks.set(key, { group, list });
}

function unloadChunk(key) {
  const c = chunks.get(key);
  if (!c) return;
  scene.remove(c.group);
  for (const e of c.list) e.alive = false;
  edibles = edibles.filter(e => e.chunk !== key || e.falling);
  chunks.delete(key);
}

function updateChunks(px, pz, R) {
  const ci = Math.floor(px / CHUNK), cj = Math.floor(pz / CHUNK);
  const radius = clamp(Math.ceil((18 + R * 2.1) / CHUNK) + 1, 2, 4);
  // constrói no máximo 8 por frame, dos mais próximos para os mais distantes
  const missing = [];
  for (let i = ci - radius; i <= ci + radius; i++) {
    for (let j = cj - radius; j <= cj + radius; j++) {
      if (!chunks.has(i + ',' + j)) missing.push([i, j, (i - ci) ** 2 + (j - cj) ** 2]);
    }
  }
  missing.sort((a, b) => a[2] - b[2]);
  for (const [i, j] of missing.slice(0, 8)) buildChunk(i, j);
  for (const key of [...chunks.keys()]) {
    const [i, j] = key.split(',').map(Number);
    if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) > radius + 1) unloadChunk(key);
  }
}

// ------------------------------------------------------------
// Tráfego
// ------------------------------------------------------------
let cars = [];
function roadCoord(v) { return Math.round((v - ROAD_C) / CHUNK) * CHUNK + ROAD_C; }

function spawnCar(px, pz, R) {
  const ang = Math.random() * Math.PI * 2;
  const dist = 30 + Math.random() * 40;
  let x = px + Math.cos(ang) * dist, z = pz + Math.sin(ang) * dist;
  const axis = Math.random() < 0.5 ? 'x' : 'z';
  if (axis === 'x') z = roadCoord(z); else x = roadCoord(x);
  const pool = (R >= 3.5 && Math.random() < 0.3) ? HEROCARS : CIVCARS;
  const name = pool[(Math.random() * pool.length) | 0];
  const dir = Math.random() < 0.5 ? 1 : -1;
  const lane = dir * 0.95;
  if (axis === 'x') z += lane; else x -= lane;
  const e = addEdible(null, scene, name, x, z, 0, '__car__', ROAD_H);
  e.car = {
    axis, dir, speed: 3.5 + Math.random() * 2.5, flee: false,
  };
  e.root.traverse(o => { o.matrixAutoUpdate = true; });
  cars.push(e);
}

function updateCars(dt, px, pz, R) {
  const want = clamp(8 + Math.floor(R * 1.2), 8, 22);
  if (cars.length < want) spawnCar(px, pz, R);
  for (const e of cars) {
    if (!e.alive || e.falling) continue;
    const c = e.car;
    // fuga: buraco perto e capaz de comer
    const dx = e.x - px, dz = e.z - pz;
    const d2 = dx * dx + dz * dz;
    const danger = (10 + R * 2.5);
    c.flee = d2 < danger * danger && R >= e.eatR * EAT_FACTOR * 0.8;
    let sp = c.speed * (c.flee ? 2.3 : 1);
    if (c.flee) {
      // foge na direção da via que aumenta a distância
      const away = c.axis === 'x' ? Math.sign(dx || 1) : Math.sign(dz || 1);
      c.dir = away;
    }
    if (c.axis === 'x') e.x += c.dir * sp * dt;
    else e.z += c.dir * sp * dt;
    // cruzamento: chance de virar
    const along = c.axis === 'x' ? e.x : e.z;
    const prev = along - c.dir * sp * dt;
    const cross = roadCoord(along);
    if (!c.flee && Math.sign(along - cross) !== Math.sign(prev - cross) && Math.random() < 0.4) {
      if (c.axis === 'x') { e.x = cross; c.axis = 'z'; }
      else { e.z = cross; c.axis = 'x'; }
      c.dir = Math.random() < 0.5 ? 1 : -1;
    }
    e.root.position.set(e.x, ROAD_H, e.z);
    e.root.rotation.y = c.axis === 'x'
      ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (c.dir > 0 ? 0 : Math.PI);
  }
  // remove engolidos e distantes da lista de tráfego
  cars = cars.filter(e => {
    if (!e.alive || e.falling) return false;
    const far = Math.hypot(e.x - px, e.z - pz) > 95;
    if (far) { scene.remove(e.root); e.alive = false; }
    return !far;
  });
  edibles = edibles.filter(e => e.alive || e.falling);
}

// ------------------------------------------------------------
// Engolir (animação de queda)
// ------------------------------------------------------------
const falling = [];
function startFall(e, hole, byPlayer) {
  if (!e.alive || e.falling) return;
  const isBig = e.kind === 'house' || e.kind === 'com' || e.kind === 'sky';
  e.falling = {
    t: 0,
    dur: clamp(0.5 + e.eatR * 0.12, 0.5, 1.2),
    shake: isBig ? 0.3 : 0,
    hole, byPlayer,
    sx: e.x, sz: e.z, sy: e.root.position.y,
    spin: (Math.random() - 0.5) * 6,
    tiltX: (Math.random() - 0.5) * 2.4, tiltZ: (Math.random() - 0.5) * 2.4,
    scale: e.root.scale.x,
  };
  e.root.traverse(o => { o.matrixAutoUpdate = true; });
  falling.push(e);
  if (byPlayer) onPlayerBite(e, isBig);
  else if (player) {
    // som do rival comendo, atenuado pela distância
    const d = Math.hypot(e.x - player.x, e.z - player.z);
    const vol = clamp(1 - d / 70, 0, 1) * 0.45;
    if (vol > 0.04) AudioSys.play(isBig ? 'crash1' : 'crunch1', vol, 0.8 + Math.random() * 0.3);
  }
}

function updateFalling(dt) {
  for (let i = falling.length - 1; i >= 0; i--) {
    const e = falling[i], f = e.falling;
    if (f.shake > 0) {
      f.shake -= dt;
      e.root.position.x = f.sx + (Math.random() - 0.5) * 0.3;
      e.root.position.z = f.sz + (Math.random() - 0.5) * 0.3;
      continue;
    }
    f.t += dt / f.dur;
    const t = Math.min(f.t, 1);
    const k = t * t;
    e.root.position.x = lerp(f.sx, f.hole.x, k * 0.85);
    e.root.position.z = lerp(f.sz, f.hole.z, k * 0.85);
    e.root.position.y = f.sy - k * (1.6 + e.h * 1.1);
    e.root.rotation.y += f.spin * dt;
    e.root.rotation.x = f.tiltX * k;
    e.root.rotation.z = f.tiltZ * k;
    const s = f.scale * (1 - k * 0.8);
    e.root.scale.set(s, s, s);
    if (f.t >= 1) {
      if (e.root.parent) e.root.parent.remove(e.root);
      e.alive = false;
      falling.splice(i, 1);
      swallowed(e, f.hole, f.byPlayer);
      e.falling = null;
    }
  }
}

// checagem de engolir para um buraco
function tryEat(hole, byPlayer) {
  const R = hole.R;
  const r2 = (R * 0.95) * (R * 0.95);
  for (const e of edibles) {
    if (!e.alive || e.falling) continue;
    const dx = e.x - hole.x, dz = e.z - hole.z;
    if (dx * dx + dz * dz > r2) continue;
    if (R < e.eatR * EAT_FACTOR) continue;
    startFall(e, hole, byPlayer);
  }
}

// ------------------------------------------------------------
// Partículas de poeira e rótulos flutuantes
// ------------------------------------------------------------
const puffs = [];
for (let i = 0; i < 40; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: puffTex, transparent: true, opacity: 0, depthWrite: false,
  }));
  s.visible = false;
  scene.add(s);
  puffs.push({ s, life: 0, vx: 0, vy: 0, vz: 0 });
}
function burst(x, z, n, size) {
  for (const p of puffs) {
    if (n <= 0) break;
    if (p.life > 0) continue;
    n--;
    p.life = 0.6 + Math.random() * 0.5;
    const a = Math.random() * Math.PI * 2;
    p.vx = Math.cos(a) * (2 + Math.random() * 3);
    p.vz = Math.sin(a) * (2 + Math.random() * 3);
    p.vy = 2 + Math.random() * 3;
    p.s.position.set(x, 0.5, z);
    p.s.scale.setScalar(size * (0.7 + Math.random() * 0.6));
    p.s.material.opacity = 0.85;
    p.s.visible = true;
  }
}
function updatePuffs(dt) {
  for (const p of puffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.s.position.x += p.vx * dt;
    p.s.position.y += p.vy * dt;
    p.s.position.z += p.vz * dt;
    p.vy -= 4 * dt;
    p.s.material.opacity = Math.max(0, p.life);
    if (p.life <= 0) p.s.visible = false;
  }
}

// rótulos "+N t"
const labels = [];
for (let i = 0; i < 12; i++) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;pointer-events:none;z-index:22;font-family:"Kenney Future",sans-serif;' +
    'color:#3df0ff;text-shadow:0 0 10px rgba(61,240,255,.7),0 2px 0 #000;opacity:0;font-size:15px;';
  document.body.appendChild(div);
  labels.push({ div, life: 0, x: 0, z: 0 });
}
const projV = new THREE.Vector3();
function floatLabel(x, z, text, big) {
  const l = labels.find(l => l.life <= 0);
  if (!l) return;
  l.life = 1; l.x = x; l.z = z;
  l.div.textContent = text;
  l.div.style.fontSize = big ? '24px' : '15px';
  l.div.style.color = big ? '#ff3df0' : '#3df0ff';
}
function updateLabels(dt) {
  for (const l of labels) {
    if (l.life <= 0) continue;
    l.life -= dt * 0.9;
    projV.set(l.x, 1 + (1 - l.life) * 4, l.z).project(camera);
    l.div.style.left = ((projV.x * 0.5 + 0.5) * innerWidth - 20) + 'px';
    l.div.style.top = ((-projV.y * 0.5 + 0.5) * innerHeight) + 'px';
    l.div.style.opacity = Math.max(0, Math.min(1, l.life * 1.6));
  }
}

// ------------------------------------------------------------
// Estado do jogo
// ------------------------------------------------------------
const $ = id => document.getElementById(id);
const ui = {
  hud: $('hud'), menu: $('menu'), end: $('end'), loading: $('loading'),
  tons: $('tons'), tier: $('tier-label'), hungerFill: $('hunger-fill'),
  clock: $('clock'), eaten: $('eaten'),
  combo: $('combo'), comboX: $('combo-x'), comboFill: $('combo-fill'),
  announce: $('announce'), record: $('record'), endStats: $('end-stats'),
  endTitle: $('end-title'), hungerFlash: $('hunger-flash'),
  rivalInfo: $('rival-info'), rivalTons: $('rival-tons'), rivalArrow: $('rival-arrow'),
  touch: $('touch'), joy: $('joy'), joyStick: $('joy-stick'), fade: $('fade'),
};

let state = 'loading';          // loading | menu | playing | over
let player = null, rival = null;
let hunger = 100, gameTime = 0, eatenCount = 0;
let combo = 0, comboTimer = 0, bestCombo = 0;
let rivalsEaten = 0, rivalTimer = 0, rivalGen = 0;
let tierIdx = 0, shake = 0, warnTimer = 0;

const RECORD_KEY = 'voraz_record';
ui.record.textContent = parseInt(localStorage.getItem(RECORD_KEY) || '0', 10).toLocaleString('pt-BR');

// fila de anúncios
let annTimer = 0;
function announce(text, dur = 2.2) {
  ui.announce.textContent = text;
  ui.announce.style.opacity = 1;
  annTimer = dur;
}

function fmtTons(m) {
  return (m < 10 ? m.toFixed(1) : Math.round(m).toLocaleString('pt-BR')) + ' t';
}
function fmtTime(t) {
  const s = Math.floor(t);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function onPlayerBite(e, isBig) {
  // combo
  combo++;
  comboTimer = 3;
  if (combo > bestCombo) bestCombo = combo;
  const mult = Math.min(1 + combo * 0.05, 3);
  const gained = e.mass * mult;
  player.mass += gained;
  hunger = Math.min(100, hunger + 4 + Math.min(50, e.mass * 0.9));
  eatenCount++;
  floatLabel(e.x, e.z, '+' + fmtTons(gained), isBig);

  if (combo === 5) AudioSys.play('combo1', 0.6);
  else if (combo === 10) { AudioSys.play('combo2', 0.7); announce('VORAZ!', 1.2); }
  else if (combo === 20) { AudioSys.play('combo3', 0.7); announce('INSACIÁVEL!', 1.2); }
  else if (combo === 40) { AudioSys.play('combo4', 0.8); announce('APOCALÍPTICO!', 1.4); }
  else if (combo === 70) { AudioSys.play('combo5', 0.9); announce('FIM DOS TEMPOS!', 1.6); }

  // som e juice por tamanho
  if (e.kind === 'sky') {
    AudioSys.play('bigcrash', 1); AudioSys.play('rumble', 1, 0.7);
    shake = Math.max(shake, 1.4);
    burst(e.x, e.z, 14, 3.2);
    announce('ARRANHA-CÉU DEVORADO!', 1.6);
  } else if (e.kind === 'com') {
    AudioSys.play('crash' + (1 + (Math.random() * 2 | 0)), 0.9);
    AudioSys.play('rumble', 0.7, 0.9);
    shake = Math.max(shake, 0.8);
    burst(e.x, e.z, 10, 2.2);
  } else if (e.kind === 'house') {
    AudioSys.play('crash' + (1 + (Math.random() * 2 | 0)), 0.8, 1.1);
    shake = Math.max(shake, 0.5);
    burst(e.x, e.z, 7, 1.6);
  } else if (e.kind === 'car') {
    AudioSys.play('crunch' + (1 + (Math.random() * 3 | 0)), 0.7, 0.9 + Math.random() * 0.3);
    burst(e.x, e.z, 4, 1);
  } else {
    AudioSys.play('eat' + (1 + (Math.random() * 3 | 0)), 0.55, 0.9 + Math.random() * 0.4);
  }
}

function swallowed(e, hole, byPlayer) {
  if (!byPlayer && hole === rival) rival.mass += e.mass;
}

// ------------------------------------------------------------
// Rival
// ------------------------------------------------------------
function spawnRival() {
  rivalGen++;
  rival = makeHole(0xff5030, '#3a0a06', 'rgba(255,110,60,.9)');
  const a = Math.random() * Math.PI * 2;
  rival.x = player.x + Math.cos(a) * 55;
  rival.z = player.z + Math.sin(a) * 55;
  rival.mass = Math.max(4, player.mass * (0.6 + rivalGen * 0.12));
  rival.R = holeRadius(rival.mass);
  rival.visR = rival.R;
  rival.ai = { tx: rival.x, tz: rival.z, think: 0 };
  ui.rivalInfo.classList.remove('hidden');
  AudioSys.play('rival', 0.9);
  announce('ALGO MAIS ABRIU\nNO ASFALTO...', 2.6);
}

function killRival() {
  scene.remove(rival.grp);
  rival = null;
  ui.rivalInfo.classList.add('hidden');
  ui.rivalArrow.classList.add('hidden');
}

function updateRival(dt) {
  if (!rival) {
    rivalTimer -= dt;
    if (rivalTimer <= 0 && state === 'playing') spawnRival();
    return;
  }
  const r = rival;
  r.R = holeRadius(r.mass);
  r.mass += dt * 0.3 * (1 + rivalGen * 0.4);  // crescimento de pressão
  const ai = r.ai;
  ai.think -= dt;
  const dxp = player.x - r.x, dzp = player.z - r.z;
  const dp = Math.hypot(dxp, dzp);
  const canHunt = r.R > player.R * 1.18;
  const mustFlee = player.R > r.R * 1.18 && dp < 30;
  if (ai.think <= 0) {
    ai.think = 1.6 + Math.random();
    if (canHunt) { ai.tx = player.x; ai.tz = player.z; }
    else if (mustFlee) { ai.tx = r.x - dxp * 2; ai.tz = r.z - dzp * 2; }
    else {
      // procura ponto com mais comida entre 4 candidatos
      let best = null, bestN = -1;
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2, d = 12 + Math.random() * 22;
        const cx = r.x + Math.cos(a) * d, cz = r.z + Math.sin(a) * d;
        let n = 0;
        for (const e of edibles) {
          if (!e.alive || e.falling) continue;
          if (e.eatR * EAT_FACTOR > r.R * 1.4) continue;
          const ddx = e.x - cx, ddz = e.z - cz;
          if (ddx * ddx + ddz * ddz < 144) n++;
        }
        if (n > bestN) { bestN = n; best = [cx, cz]; }
      }
      ai.tx = best[0]; ai.tz = best[1];
    }
  }
  if (canHunt) { ai.tx = player.x; ai.tz = player.z; }
  const sp = (9 + r.R * 0.25) * 0.92;
  const dx = ai.tx - r.x, dz = ai.tz - r.z;
  const d = Math.hypot(dx, dz);
  if (d > 1) {
    r.x += dx / d * sp * dt;
    r.z += dz / d * sp * dt;
  }
  tryEat(r, false);

  // disputa de buracos
  if (dp < Math.max(r.R, player.R) * 0.7) {
    if (player.R > r.R * 1.18) {
      // jogador devora o rival
      const gain = r.mass * 0.4;
      player.mass += gain;
      hunger = Math.min(100, hunger + 45);
      rivalsEaten++;
      eatenCount++;
      shake = Math.max(shake, 1.6);
      burst(r.x, r.z, 16, 3);
      floatLabel(r.x, r.z, '+' + fmtTons(gain), true);
      AudioSys.play('devour', 1);
      announce('VOCÊ DEVOROU O OUTRO!', 2.4);
      killRival();
      rivalTimer = 22;
    } else if (r.R > player.R * 1.18) {
      gameOver('VOCÊ FOI DEVORADO',
        'O outro buraco era maior.\nNa cidade voraz, só o maior fica.');
    }
  }
}

function updateRivalUI() {
  if (!rival) return;
  ui.rivalTons.textContent = fmtTons(rival.mass);
  projV.set(rival.x, 0.5, rival.z).project(camera);
  const onScreen = projV.z < 1 && Math.abs(projV.x) < 0.92 && Math.abs(projV.y) < 0.88;
  if (onScreen) { ui.rivalArrow.classList.add('hidden'); return; }
  ui.rivalArrow.classList.remove('hidden');
  const ang = Math.atan2(-(projV.y), projV.x);
  const rx = Math.cos(ang) * innerWidth * 0.38, ry = Math.sin(ang) * innerHeight * 0.38;
  ui.rivalArrow.style.transform =
    `translate(calc(${rx}px - 50%), calc(${ry}px - 50%)) rotate(${ang}rad)`;
}

// ------------------------------------------------------------
// Entrada
// ------------------------------------------------------------
const keys = {};
let mouseDown = false, mouseX = 0, mouseY = 0;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyM') AudioSys.toggleMute();
  if (e.code === 'Enter') {
    if (state === 'menu') startGame();
    else if (state === 'over') restart();
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('mousedown', e => { mouseDown = true; mouseX = e.clientX; mouseY = e.clientY; });
addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
addEventListener('mouseup', () => { mouseDown = false; });

// joystick de toque
const joy = { active: false, id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
const isTouch = matchMedia('(pointer: coarse)').matches;
ui.touch.addEventListener('touchstart', e => {
  const t = e.changedTouches[0];
  joy.active = true; joy.id = t.identifier;
  joy.bx = t.clientX; joy.by = t.clientY;
  joy.dx = joy.dy = 0;
  ui.joy.style.display = 'block';
  ui.joy.style.left = (joy.bx - 55) + 'px';
  ui.joy.style.top = (joy.by - 55) + 'px';
}, { passive: true });
ui.touch.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (t.identifier !== joy.id) continue;
    const dx = t.clientX - joy.bx, dy = t.clientY - joy.by;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(d, 45);
    joy.dx = dx / d * (k / 45); joy.dy = dy / d * (k / 45);
    ui.joyStick.style.left = (32 + dx / d * k * 0.7) + 'px';
    ui.joyStick.style.top = (32 + dy / d * k * 0.7) + 'px';
  }
}, { passive: true });
const endTouch = e => {
  for (const t of e.changedTouches) {
    if (t.identifier !== joy.id) continue;
    joy.active = false; joy.dx = joy.dy = 0;
    ui.joy.style.display = 'none';
    ui.joyStick.style.left = '32px'; ui.joyStick.style.top = '32px';
  }
};
ui.touch.addEventListener('touchend', endTouch, { passive: true });
ui.touch.addEventListener('touchcancel', endTouch, { passive: true });

if (AUTO) addEventListener('error', e => {
  ui.announce.textContent = 'JS ERROR: ' + e.message;
  ui.announce.style.opacity = 1;
});

function inputVector() {
  if (AUTO && state === 'playing') {
    return [Math.cos(gameTime * 0.55), Math.sin(gameTime * 0.4)];
  }
  let ix = 0, iz = 0;
  if (keys['KeyW'] || keys['ArrowUp']) iz -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) iz += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) ix += 1;
  if (joy.active) { ix += joy.dx; iz += joy.dy; }
  if (!ix && !iz && mouseDown) {
    ix = (mouseX - innerWidth / 2) / (innerWidth / 2);
    iz = (mouseY - innerHeight / 2) / (innerHeight / 2);
    const d = Math.hypot(ix, iz);
    if (d < 0.12) { ix = 0; iz = 0; } else { ix /= Math.max(d, 1); iz /= Math.max(d, 1); }
  }
  const d = Math.hypot(ix, iz);
  if (d > 1) { ix /= d; iz /= d; }
  return [ix, iz];
}

// ------------------------------------------------------------
// Fluxo de jogo
// ------------------------------------------------------------
function resetWorld() {
  for (const key of [...chunks.keys()]) unloadChunk(key);
  for (const e of cars) { if (e.root.parent) e.root.parent.remove(e.root); e.alive = false; }
  cars = [];
  for (const e of falling) { if (e.root.parent) e.root.parent.remove(e.root); }
  falling.length = 0;
  edibles = [];
  if (rival) killRival();
  if (player) { scene.remove(player.grp); player = null; }
  WORLD_SEED = (Math.random() * 0xffffffff) >>> 0;
}

function startGame() {
  resetWorld();
  player = makeHole(0xff3df0, '#2a0636', 'rgba(255,90,235,.9)');
  player.x = 12; player.z = 12;       // dentro do quarteirão inicial
  hunger = 100; gameTime = 0; eatenCount = 0;
  combo = 0; comboTimer = 0; bestCombo = 0;
  rivalsEaten = 0; rivalGen = 0; rivalTimer = AUTO ? 10 : 60;
  tierIdx = 0; shake = 0;
  ui.menu.classList.add('hidden');
  ui.end.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  if (isTouch) ui.touch.classList.remove('hidden');
  ui.tier.textContent = TIERS[0].name;
  state = 'playing';
  AudioSys.playMusic('game');
  announce('COMA TUDO.\nNÃO PARE NUNCA.', 2.4);
}

function restart() { startGame(); }

function gameOver(title, flavor) {
  if (state !== 'playing') return;
  state = 'over';
  const tons = Math.round(player.mass);
  const prev = parseInt(localStorage.getItem(RECORD_KEY) || '0', 10);
  const isRecord = tons > prev;
  if (isRecord) localStorage.setItem(RECORD_KEY, String(tons));
  ui.endTitle.textContent = title;
  ui.endStats.textContent =
    `${flavor}\n\n` +
    `🕳 ${tons.toLocaleString('pt-BR')} toneladas devoradas${isRecord ? ' — NOVO RECORDE!' : ''}\n` +
    `🍽 ${eatenCount} objetos · 🔥 maior combo ×${bestCombo}\n` +
    `⚫ rivais devorados: ${rivalsEaten} · ⏱ ${fmtTime(gameTime)}`;
  ui.end.classList.remove('hidden');
  ui.hud.classList.add('hidden');
  ui.touch.classList.add('hidden');
  ui.hungerFlash.classList.remove('on');
  AudioSys.playMusic('gameover');
}

document.getElementById('btn-start').addEventListener('click', () => { AudioSys.unlock(); startGame(); });
document.getElementById('btn-retry').addEventListener('click', restart);
addEventListener('pointerdown', () => AudioSys.unlock(), { once: true });

// ------------------------------------------------------------
// Loop principal
// ------------------------------------------------------------
const clock = new THREE.Clock();
let elapsed = 0;

function updateHUD() {
  ui.tons.textContent = fmtTons(player.mass);
  ui.clock.textContent = fmtTime(gameTime);
  ui.eaten.textContent = 'devorados: ' + eatenCount;
  ui.hungerFill.style.width = hunger + '%';
  if (comboTimer > 0 && combo >= 2) {
    ui.combo.classList.remove('hidden');
    ui.comboX.textContent = '×' + combo;
    ui.comboFill.style.width = (comboTimer / 3 * 100) + '%';
  } else ui.combo.classList.add('hidden');
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  if (annTimer > 0) {
    annTimer -= dt;
    if (annTimer <= 0) ui.announce.style.opacity = 0;
  }

  if (state === 'playing') {
    gameTime += dt;

    // movimento
    const [ix, iz] = inputVector();
    const speed = clamp(9 + player.R * 0.25, 9, 17);
    player.vx = lerp(player.vx, ix * speed, 1 - Math.pow(0.0001, dt));
    player.vz = lerp(player.vz, iz * speed, 1 - Math.pow(0.0001, dt));
    player.x += player.vx * dt;
    player.z += player.vz * dt;
    player.R = holeRadius(player.mass);

    // fome
    hunger -= dt * (1.0 + player.R * 0.18);
    if (hunger < 25) {
      ui.hungerFlash.classList.add('on');
      warnTimer -= dt;
      if (warnTimer <= 0) { AudioSys.play('warn', 0.7); warnTimer = 3; }
    } else ui.hungerFlash.classList.remove('on');
    if (hunger <= 0) {
      hunger = 0;
      player.mass = Math.max(0, player.mass - dt * (2 + player.mass * 0.06));
      if (player.mass < 1.5) {
        gameOver('O BURACO FECHOU',
          'A fome venceu. O asfalto cicatrizou\ncomo se nada tivesse acontecido.');
      }
    }

    // combo
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }

    // nível
    const newTier = TIERS.reduce((acc, t, i) => player.R >= t.r ? i : acc, 0);
    if (newTier > tierIdx) {
      tierIdx = newTier;
      ui.tier.textContent = TIERS[tierIdx].name;
      AudioSys.play('levelup', 0.9);
      AudioSys.play('up', 0.7);
      announce(TIERS[tierIdx].name.replace(' · ', '\n'), 2.2);
      shake = Math.max(shake, 0.6);
    }

    updateChunks(player.x, player.z, player.R);
    updateCars(dt, player.x, player.z, player.R);
    tryEat(player, true);
    updateRival(dt);
    if (state !== 'playing') { renderer.render(scene, camera); return; }

    updateHoleVisual(player, dt, elapsed);
    if (rival) { updateHoleVisual(rival, dt, elapsed); updateRivalUI(); }
    updateHUD();
  }

  updateFalling(dt);
  updatePuffs(dt);
  updateLabels(dt);

  // câmera
  if (player) {
    if (shake > 0) shake = Math.max(0, shake - dt * 2.2);
    const h = clamp(15 + player.visR * 2.1, 16, 80);
    const sx = (Math.random() - 0.5) * shake, sz = (Math.random() - 0.5) * shake;
    camera.position.x = lerp(camera.position.x, player.x + sx, 1 - Math.pow(0.001, dt));
    camera.position.z = lerp(camera.position.z, player.z + h * 0.58 + sz, 1 - Math.pow(0.001, dt));
    camera.position.y = lerp(camera.position.y, h, 1 - Math.pow(0.005, dt));
    camera.lookAt(player.x + sx, 0, player.z + sz);
    scene.fog.near = h * 1.6;
    scene.fog.far = h * 4.2;
    fitSun(player.x, player.z, player.visR);
  }

  renderer.render(scene, camera);

  // captura de tela do modo auto (extraída via --dump-dom)
  if (AUTO && state === 'playing') {
    if (!autoShots[0] && gameTime > 6) autoCapture(0);
    if (!autoShots[1] && gameTime > 17) autoCapture(1);
  }
}
const autoShots = [null, null];
function autoCapture(i) {
  autoShots[i] = true;
  const div = document.createElement('div');
  div.id = 'autoshot' + i;
  div.style.display = 'none';
  div.textContent = renderer.domElement.toDataURL('image/png');
  document.body.appendChild(div);
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
AudioSys.load();
Promise.all(Object.keys(MANIFEST).map(loadModel)).then(() => {
  ROAD_H = LIB['road/road-straight'].size.y;
  // mundo de fundo para o menu
  buildChunk(0, 0); buildChunk(-1, 0); buildChunk(0, -1); buildChunk(-1, -1);
  camera.position.set(10, 22, 24);
  camera.lookAt(10, 0, 8);
  ui.loading.classList.add('hidden');
  state = 'menu';
  AudioSys.playMusic('menu');
  tick();
  if (AUTO) startGame();
}).catch(err => {
  ui.loading.querySelector('.story').textContent = 'ERRO AO CARREGAR: ' + err.message;
  console.error(err);
});
