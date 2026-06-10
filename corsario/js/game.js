// ============================================================
// CORSÁRIO — combate naval em mar aberto
// Three.js + Pirate Kit (Kenney, CC0)
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from '../lib/loaders/GLTFLoader.js';

// ------------------------------------------------------------
// Constantes
// ------------------------------------------------------------
const WORLD_R = 320;        // raio navegável
const BALL_CAP = 90;        // pool de balas de canhão
const PART_CAP = 220;       // pool de partículas
const COIN_CAP = 70;        // pool de moedas
const GRAV = 14;            // gravidade das balas
const DAY_LEN = 160;        // segundos por ciclo dia/noite

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function angNorm(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
function turnToward(cur, target, rate, dt) {
  const d = angNorm(target - cur);
  return cur + clamp(d, -rate * dt, rate * dt);
}

// ------------------------------------------------------------
// Cena
// ------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6fb6e8);
scene.fog = new THREE.Fog(0x6fb6e8, 60, 230);
let fogNearT = 60, fogFarT = 230;

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 12, -20);
camera.lookAt(0, 1, 8);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x0a2436, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.8);
sun.position.set(30, 45, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
sun.shadow.camera.far = 160;
scene.add(sun);
scene.add(sun.target);

// ------------------------------------------------------------
// Oceano vivo (deslocamento senoidal de vértices)
// ------------------------------------------------------------
let waveAmp = 1, waveAmpT = 1;
function waveY(x, z, t) {
  return waveAmp * (
    Math.sin(x * 0.055 + t * 0.9) * 0.7 +
    Math.sin(z * 0.042 + t * 0.7) * 0.5 +
    Math.sin((x + z) * 0.03 + t * 0.55) * 0.38 +
    Math.sin((x - z) * 0.09 + t * 1.35) * 0.25 +
    Math.sin(x * 0.13 + z * 0.07 + t * 1.9) * 0.14
  );
}

const OC_SIZE = 800, OC_SEG = 110;
const oceanGeo = new THREE.PlaneGeometry(OC_SIZE, OC_SIZE, OC_SEG, OC_SEG);
oceanGeo.rotateX(-Math.PI / 2);
const oceanMat = new THREE.MeshPhongMaterial({ color: 0x1a6aaa, shininess: 70, specular: 0x446688, flatShading: true });
const ocean = new THREE.Mesh(oceanGeo, oceanMat);
ocean.receiveShadow = true;
scene.add(ocean);
const ocPos = oceanGeo.attributes.position;
const ocArr = ocPos.array;

function updateOcean(t) {
  for (let i = 0; i < ocArr.length; i += 3) {
    ocArr[i + 1] = waveY(ocArr[i], ocArr[i + 2], t);
  }
  ocPos.needsUpdate = true;
  oceanGeo.computeVertexNormals();
}

// ------------------------------------------------------------
// Céu — ciclo dia/noite
// ------------------------------------------------------------
const SKY_KEYS = [
  { t: 0.00, sky: 0x88a4cc, sun: 0xffd9a8, sunI: 1.30, amb: 0.95, water: 0x2a6a9a },
  { t: 0.22, sky: 0x6fb6e8, sun: 0xfff2d8, sunI: 1.85, amb: 1.20, water: 0x1d6ab0 },
  { t: 0.45, sky: 0x7aa8d8, sun: 0xffe8c0, sunI: 1.60, amb: 1.10, water: 0x1a5a9a },
  { t: 0.58, sky: 0xc8784a, sun: 0xff9a5a, sunI: 1.10, amb: 0.80, water: 0x3a4666 },
  { t: 0.70, sky: 0x1c2844, sun: 0x90a8e0, sunI: 0.55, amb: 0.60, water: 0x0d2c4a },
  { t: 0.88, sky: 0x101c34, sun: 0x8098d0, sunI: 0.48, amb: 0.55, water: 0x0b2442 },
  { t: 1.00, sky: 0x88a4cc, sun: 0xffd9a8, sunI: 1.30, amb: 0.95, water: 0x2a6a9a },
];
for (const k of SKY_KEYS) {
  k.skyC = new THREE.Color(k.sky); k.sunC = new THREE.Color(k.sun); k.waterC = new THREE.Color(k.water);
}
const cSky = new THREE.Color(), cSun = new THREE.Color(), cWater = new THREE.Color();
const STORM_SKY = new THREE.Color(0x222e3e), STORM_WATER = new THREE.Color(0x12283a);
let dayT = 0.10, darkMul = 1, darkMulT = 1, flash = 0;

function updateSky(dt) {
  dayT = (dayT + dt / DAY_LEN) % 1;
  let a = SKY_KEYS[0], b = SKY_KEYS[1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (dayT >= SKY_KEYS[i].t && dayT <= SKY_KEYS[i + 1].t) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const f = (dayT - a.t) / (b.t - a.t || 1);
  cSky.copy(a.skyC).lerp(b.skyC, f);
  cSun.copy(a.sunC).lerp(b.sunC, f);
  cWater.copy(a.waterC).lerp(b.waterC, f);
  let sunI = lerp(a.sunI, b.sunI, f), amb = lerp(a.amb, b.amb, f);

  darkMul += (darkMulT - darkMul) * Math.min(1, dt * 1.2);
  if (darkMul < 0.99) {
    cSky.lerp(STORM_SKY, 1 - darkMul);
    cWater.lerp(STORM_WATER, 1 - darkMul);
    sunI *= darkMul; amb = amb * darkMul + 0.25;
  }
  flash = Math.max(0, flash - dt * 4);
  if (flash > 0) {
    cSky.lerp(WHITE, flash * 0.65);
    sunI += flash * 2.2; amb += flash * 1.4;
  }
  scene.background.copy(cSky);
  scene.fog.color.copy(cSky);
  oceanMat.color.copy(cWater);
  sun.intensity = sunI;
  sun.color.copy(cSun);
  hemi.intensity = amb;

  scene.fog.near += (fogNearT - scene.fog.near) * Math.min(1, dt * 2.5);
  scene.fog.far += (fogFarT - scene.fog.far) * Math.min(1, dt * 2.5);
  waveAmp += (waveAmpT - waveAmp) * Math.min(1, dt * 0.6);
}
const WHITE = new THREE.Color(0xffffff);

// ------------------------------------------------------------
// Nuvens baixas (low-poly)
// ------------------------------------------------------------
const clouds = [];
{
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xe8f0fa, transparent: true, opacity: 0.9 });
  const cloudGeo = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 12; i++) {
    const grp = new THREE.Group();
    const n = 2 + Math.floor(rand(0, 3));
    for (let j = 0; j < n; j++) {
      const m = new THREE.Mesh(cloudGeo, cloudMat);
      m.scale.set(rand(4, 7), rand(1.6, 2.6), rand(3, 5));
      m.position.set(rand(-6, 6), rand(-0.8, 0.8), rand(-4, 4));
      grp.add(m);
    }
    const a = rand(0, Math.PI * 2), d = rand(110, 260);
    grp.position.set(Math.cos(a) * d, rand(30, 46), Math.sin(a) * d);
    scene.add(grp);
    clouds.push({ grp, vx: rand(0.6, 1.6) });
  }
}
function updateClouds(dt) {
  for (const c of clouds) {
    c.grp.position.x += c.vx * dt;
    if (c.grp.position.x > 420) c.grp.position.x = -420;
  }
}

// ------------------------------------------------------------
// Chuva (tempestade)
// ------------------------------------------------------------
const RAIN_N = 650;
const rainGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    pos[i * 3] = rand(-45, 45); pos[i * 3 + 1] = rand(2, 42); pos[i * 3 + 2] = rand(-45, 45);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
}
const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
  color: 0xaac8e8, size: 0.18, transparent: true, opacity: 0.55, sizeAttenuation: true,
}));
rain.visible = false;
scene.add(rain);
const rainArr = rainGeo.attributes.position.array;

function updateRain(dt) {
  if (!rain.visible) return;
  for (let i = 0; i < RAIN_N; i++) {
    rainArr[i * 3 + 1] -= 42 * dt;
    if (rainArr[i * 3 + 1] < 0) rainArr[i * 3 + 1] = rand(34, 42);
  }
  rainGeo.attributes.position.needsUpdate = true;
  rain.position.set(P.x, 0, P.z);
}

// ------------------------------------------------------------
// Modelos
// ------------------------------------------------------------
const MODELS = [
  'ship-pirate-small', 'ship-pirate-medium', 'ship-pirate-large',
  'ship-small', 'ship-medium', 'ship-large', 'ship-ghost',
  'cannon-ball', 'chest', 'barrel',
  'patch-sand', 'palm-bend', 'palm-straight', 'palm-detailed-straight',
  'tower-complete-small', 'tower-complete-large',
  'rocks-a', 'rocks-b', 'rocks-c', 'flag-pirate-high',
];
const LIB = {};
const loader = new GLTFLoader();

function loadModel(name) {
  return new Promise((resolve, reject) => {
    loader.load('assets/models/' + name + '.glb', g => {
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material && o.material.isMeshStandardMaterial && o.material.metalness > 0.5) {
          o.material.metalness = 0; o.material.roughness = 0.9;
        }
      });
      const box = new THREE.Box3().setFromObject(g.scene);
      LIB[name] = { scene: g.scene, size: box.getSize(new THREE.Vector3()) };
      resolve();
    }, undefined, reject);
  });
}

// normaliza um casco: comprimento no eixo z, centro no 0, linha-d'água certa
function buildHull(name, len, opts = {}) {
  const lib = LIB[name];
  const inner = lib.scene.clone(true);
  const longAxis = Math.max(lib.size.x, lib.size.z);
  const s = len / longAxis;
  inner.scale.setScalar(s);
  if (lib.size.x > lib.size.z) inner.rotation.y = Math.PI / 2;
  const box = new THREE.Box3().setFromObject(inner);
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  inner.position.x -= cx; inner.position.z -= cz;
  inner.position.y -= box.min.y + len * 0.05;   // calado: afunda um pouco
  if (opts.tint || opts.ghost) {
    inner.traverse(o => {
      if (!o.isMesh || !o.material) return;
      o.material = o.material.clone();
      if (opts.tint && o.material.color) o.material.color.multiply(TMP_C.set(opts.tint));
      if (opts.ghost) {
        o.material.transparent = true;
        o.material.opacity = 0.55;
        if (o.material.emissive) o.material.emissive.set(0x1a8a4a);
        o.castShadow = false;
      }
    });
  }
  return inner;
}
const TMP_C = new THREE.Color();

function buildShipSlot(model, opts = {}) {
  const rocker = new THREE.Group();
  const grp = new THREE.Group();
  grp.add(rocker);
  grp.visible = false;
  scene.add(grp);
  return { grp, rocker, inner: null, busy: false, model, opts };
}

// ------------------------------------------------------------
// Pools — balas, partículas, moedas
// ------------------------------------------------------------
const ballPool = [], ballsLive = [];
function initBallPool() {
  const lib = LIB['cannon-ball'];
  const s = 0.55 / Math.max(lib.size.x, lib.size.y, lib.size.z);
  for (let i = 0; i < BALL_CAP; i++) {
    const m = lib.scene.clone(true);
    m.scale.setScalar(s);
    m.visible = false;
    scene.add(m);
    ballPool.push(m);
  }
}

const PART_MATS = {
  splash: new THREE.MeshBasicMaterial({ color: 0xcfe8ff }),
  smoke: new THREE.MeshBasicMaterial({ color: 0xaab4c0 }),
  fire: new THREE.MeshBasicMaterial({ color: 0xff9a3a }),
  wood: new THREE.MeshBasicMaterial({ color: 0x8a5a30 }),
  gold: new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  ghost: new THREE.MeshBasicMaterial({ color: 0x4adf9a }),
};
const partGeo = new THREE.IcosahedronGeometry(0.24, 0);
const partPool = [], partsLive = [];
function initPartPool() {
  for (let i = 0; i < PART_CAP; i++) {
    const m = new THREE.Mesh(partGeo, PART_MATS.splash);
    m.visible = false;
    scene.add(m);
    partPool.push(m);
  }
}
function spawnBurst(x, y, z, n, key, o = {}) {
  const spd = o.spd ?? 6, up = o.up ?? 4, grav = o.grav ?? 10, life = o.life ?? 0.8, sc = o.scale ?? 1;
  for (let i = 0; i < n; i++) {
    const m = partPool.pop();
    if (!m) return;
    m.material = PART_MATS[key];
    m.visible = true;
    m.position.set(x, y, z);
    const a = rand(0, Math.PI * 2), r = rand(0.3, 1) * spd;
    partsLive.push({
      m, vx: Math.cos(a) * r, vy: rand(0.4, 1) * up, vz: Math.sin(a) * r,
      grav, life: life * rand(0.7, 1.1), maxLife: life, sc,
    });
  }
}
function updateParts(dt) {
  for (let i = partsLive.length - 1; i >= 0; i--) {
    const p = partsLive[i];
    p.life -= dt;
    if (p.life <= 0) {
      p.m.visible = false; partPool.push(p.m);
      partsLive.splice(i, 1);
      continue;
    }
    p.vy -= p.grav * dt;
    p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    p.m.scale.setScalar(Math.max(0.05, p.sc * (p.life / p.maxLife)));
  }
}

const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 12);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd23e, metalness: 0.4, roughness: 0.3, emissive: 0x4a3a08 });
const coinPool = [], coinsLive = [];
function initCoinPool() {
  for (let i = 0; i < COIN_CAP; i++) {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.rotation.x = Math.PI / 2;
    m.castShadow = true;
    m.visible = false;
    scene.add(m);
    coinPool.push(m);
  }
}
function spawnCoins(x, z, total) {
  const n = clamp(Math.round(total / 12), 3, 10);
  const v = Math.max(1, Math.round(total / n));
  for (let i = 0; i < n; i++) {
    const m = coinPool.pop();
    if (!m) return;
    m.visible = true;
    coinsLive.push({
      m, x: x + rand(-4, 4), z: z + rand(-4, 4), value: v,
      life: 35, phase: rand(0, Math.PI * 2),
    });
  }
}

// ------------------------------------------------------------
// Frota — pools de navios inimigos
// ------------------------------------------------------------
const KINDS = {
  merchantS: { pool: 'merchantS', model: 'ship-small', len: 5.2, radius: 2.7, hp: 25, spd: 5.2, behavior: 'flee', gold: t => 35 + 8 * t },
  merchantM: { pool: 'merchantM', model: 'ship-medium', len: 6.4, radius: 3.2, hp: 42, spd: 4.6, behavior: 'flee', gold: t => 55 + 10 * t },
  navyM: { pool: 'navyM', model: 'ship-medium', len: 6.4, radius: 3.2, hp: 55, spd: 6.4, behavior: 'hunt', gold: () => 30, ballDmg: 7, volley: 2, reload: 3.6, range: 26 },
  navyL: { pool: 'navyL', model: 'ship-large', len: 8.2, radius: 4.0, hp: 95, spd: 5.8, behavior: 'hunt', gold: () => 55, ballDmg: 9, volley: 3, reload: 4.4, range: 28 },
  ghost: { pool: 'ghost', model: 'ship-ghost', len: 8.6, radius: 4.1, hp: 300, spd: 7.2, behavior: 'hunt', gold: () => 250, ballDmg: 12, volley: 4, reload: 3.0, range: 30 },
};
const SHIP_POOLS = { merchantS: [], merchantM: [], navyM: [], navyL: [], ghost: [] };
const POOL_OPTS = { navyM: { tint: 0x90a8d0 }, navyL: { tint: 0xb8c4d8 }, ghost: { ghost: true } };
const POOL_N = { merchantS: 4, merchantM: 3, navyM: 4, navyL: 3, ghost: 1 };

function initShipPools() {
  for (const [pool, n] of Object.entries(POOL_N)) {
    const kind = Object.values(KINDS).find(k => k.pool === pool);
    for (let i = 0; i < n; i++) {
      const slot = buildShipSlot(kind.model, POOL_OPTS[pool] || {});
      slot.inner = buildHull(kind.model, kind.len, POOL_OPTS[pool] || {});
      slot.rocker.add(slot.inner);
      SHIP_POOLS[pool].push(slot);
    }
  }
}

// ------------------------------------------------------------
// Ilhas decorativas
// ------------------------------------------------------------
const islands = [];
function placeProp(parent, name, footprint, x, y, z, rotY) {
  const lib = LIB[name];
  const obj = lib.scene.clone(true);
  obj.scale.setScalar(footprint / Math.max(lib.size.x, lib.size.z));
  obj.position.set(x, y, z);
  obj.rotation.y = rotY;
  parent.add(obj);
  return obj;
}
function createIsland(x, z, R, special) {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);
  const patch = placeProp(grp, 'patch-sand', R * 2, 0, 0, 0, rand(0, Math.PI * 2));
  const box = new THREE.Box3().setFromObject(patch);
  const top = box.max.y - grp.position.y - 0.55;
  const palms = ['palm-bend', 'palm-straight', 'palm-detailed-straight'];
  const nP = 2 + Math.floor(rand(0, 3));
  for (let i = 0; i < nP; i++) {
    const a = rand(0, Math.PI * 2), r = rand(0.15, 0.5) * R;
    placeProp(grp, pick(palms), rand(3.4, 4.6), Math.cos(a) * r, top, Math.sin(a) * r, rand(0, Math.PI * 2));
  }
  const nR = Math.floor(rand(0, 3));
  for (let i = 0; i < nR; i++) {
    const a = rand(0, Math.PI * 2), r = rand(0.4, 0.7) * R;
    placeProp(grp, pick(['rocks-a', 'rocks-b', 'rocks-c']), rand(2, 3.4), Math.cos(a) * r, top, Math.sin(a) * r, rand(0, Math.PI * 2));
  }
  if (special === 'fort') {
    placeProp(grp, 'tower-complete-large', 7, 0, top, 0, rand(0, Math.PI * 2));
    placeProp(grp, 'flag-pirate-high', 2.2, R * 0.35, top, R * 0.2, rand(0, Math.PI * 2));
  } else if (special === 'tower') {
    placeProp(grp, 'tower-complete-small', 5, 0, top, 0, rand(0, Math.PI * 2));
  }
  scene.add(grp);
  islands.push({ x, z, r: R * 0.85 });
}
function initIslands() {
  // anel externo
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rand(-0.2, 0.2);
    const d = rand(170, 300);
    const R = rand(11, 17);
    createIsland(Math.cos(a) * d, Math.sin(a) * d, R, i === 0 ? 'fort' : (i % 4 === 1 ? 'tower' : null));
  }
  // ilhas cênicas à frente da posição inicial
  createIsland(-48, 115, 13, 'tower');
  createIsland(55, 145, 15, null);
  createIsland(80, 60, 10, null);
  createIsland(-85, 40, 11, null);
  // ilhas internas (cenário próximo)
  for (let i = 0; i < 3; i++) {
    const a = rand(0, Math.PI * 2), d = rand(100, 145);
    createIsland(Math.cos(a) * d, Math.sin(a) * d, rand(8, 12), null);
  }
}

// ------------------------------------------------------------
// Baús e barris flutuantes
// ------------------------------------------------------------
const pickupSlots = { chest: [], barrel: [] };
const pickupsLive = [];
function initPickups() {
  for (const [name, n, len] of [['chest', 4, 1.8], ['barrel', 4, 1.3]]) {
    for (let i = 0; i < n; i++) {
      const m = buildHull(name, len, {});
      const grp = new THREE.Group();
      grp.add(m);
      grp.visible = false;
      scene.add(grp);
      pickupSlots[name].push(grp);
    }
  }
}
function spawnPickup(kind, x, z) {
  const grp = pickupSlots[kind].find(s => !s.visible);
  if (!grp) return;
  grp.visible = true;
  grp.position.set(x, 0, z);
  pickupsLive.push({ kind, grp, x, z, phase: rand(0, Math.PI * 2), life: 50 });
}

// ------------------------------------------------------------
// Estado
// ------------------------------------------------------------
const ST = { MENU: 0, PLAYING: 1, CHOOSING: 2, SINKING: 3, OVER: 4 };
let state = ST.MENU;
let G = null;
const enemies = [];

const HULL_TIERS = [
  { model: 'ship-pirate-small', name: 'CHALUPA', len: 6.0, radius: 2.9 },
  { model: 'ship-pirate-medium', name: 'BERGANTIM', len: 7.6, radius: 3.5 },
  { model: 'ship-pirate-large', name: 'GALEÃO', len: 9.2, radius: 4.2 },
];

// jogador
const P = {
  grp: null, rocker: null, inner: null,
  x: 0, z: 0, yaw: 0, spd: 0, throttle: 0.5,
  hull: 100, maxHull: 100, reload: 0, reloadMax: 2.2,
  dmg: 12, balls: 2, maxSpd: 11, tier: 0,
  len: 6, radius: 2.9, rollVel: 0,
};
function initPlayer() {
  P.grp = new THREE.Group();
  P.rocker = new THREE.Group();
  P.grp.add(P.rocker);
  scene.add(P.grp);
  setPlayerTier(0);
}
function setPlayerTier(t) {
  P.tier = t;
  if (P.inner) P.rocker.remove(P.inner);
  const tier = HULL_TIERS[t];
  P.inner = buildHull(tier.model, tier.len, {});
  P.rocker.add(P.inner);
  P.len = tier.len; P.radius = tier.radius;
}

function loadRecord() { try { return parseInt(localStorage.getItem('corsario_record') || '0', 10) || 0; } catch (e) { return 0; } }
function saveRecord(g) { try { if (g > loadRecord()) localStorage.setItem('corsario_record', String(g)); } catch (e) {} }

// ------------------------------------------------------------
// Bordadas de canhão
// ------------------------------------------------------------
function fireBall(x, y, z, vx, vy, vz, owner, dmg) {
  const m = ballPool.pop();
  if (!m) return;
  m.visible = true;
  m.position.set(x, y, z);
  ballsLive.push({ m, vx, vy, vz, owner, dmg, life: 4 });
}

function fireBroadside() {
  if (P.reload > 0) return;
  P.reload = P.reloadMax;
  const fwx = Math.sin(P.yaw), fwz = Math.cos(P.yaw);
  const rx = fwz, rz = -fwx;                 // direita do navio
  const y = P.grp.position.y + 1.3;
  const T = 2 * 6.2 / GRAV;                  // tempo de voo aproximado
  for (const side of [-1, 1]) {
    // mira assistida: inimigo mais próximo deste bordo
    let tgt = null, best = 34;
    for (const e of enemies) {
      if (e.sink > 0) continue;
      const dx = e.x - P.x, dz = e.z - P.z;
      const d = Math.hypot(dx, dz);
      if (d > 34 || d < 2) continue;
      if ((dx * rx * side + dz * rz * side) / d > 0.45 && d < best) { best = d; tgt = e; }
    }
    for (let i = 0; i < P.balls; i++) {
      const off = (i - (P.balls - 1) / 2) * (P.len * 0.28);
      const bx = P.x + fwx * off + rx * side * 1.2;
      const bz = P.z + fwz * off + rz * side * 1.2;
      if (tgt) {
        const k = KINDS[tgt.kind];
        const tx = tgt.x + Math.sin(tgt.yaw) * tgt.spd * T + rand(-2.2, 2.2);
        const tz = tgt.z + Math.cos(tgt.yaw) * tgt.spd * T + rand(-2.2, 2.2);
        const dx = tx - bx, dz = tz - bz;
        const d = Math.hypot(dx, dz) || 1;
        const sp = clamp(d / T, 12, 30);
        fireBall(bx, y, bz, dx / d * sp, rand(5.8, 6.6), dz / d * sp, 0, P.dmg);
      } else {
        const sp = rand(22, 26);
        fireBall(bx, y, bz,
          rx * side * sp + fwx * rand(-2, 2),
          rand(5.5, 6.8),
          rz * side * sp + fwz * rand(-2, 2),
          0, P.dmg);
      }
    }
    const mx = P.x + rx * side * (P.radius + 0.6), mz = P.z + rz * side * (P.radius + 0.6);
    spawnBurst(mx, y, mz, 4, 'smoke', { spd: 3, up: 1.5, grav: 0.6, life: 0.6 });
    spawnBurst(mx, y, mz, 2, 'fire', { spd: 4, up: 2, grav: 2, life: 0.25, scale: 0.8 });
  }
  AudioSys.play('cannon', 0.7);
  shake = Math.min(0.6, shake + 0.22);
  P.rollVel += rand(-0.5, 0.5);
}

function enemyVolley(e) {
  const k = KINDS[e.kind];
  e.reload = k.reload * rand(0.9, 1.15);
  const dx = P.x - e.x, dz = P.z - e.z;
  const dist = Math.hypot(dx, dz);
  const T = 2 * 6 / GRAV;
  const y = e.grp.position.y + 1.3;
  for (let i = 0; i < k.volley; i++) {
    const tx = P.x + rand(-6, 6), tz = P.z + rand(-6, 6);
    const ddx = tx - e.x, ddz = tz - e.z;
    const dd = Math.hypot(ddx, ddz) || 1;
    const sp = clamp(dd / T, 8, 36);
    fireBall(e.x + ddx / dd * 1.5, y, e.z + ddz / dd * 1.5,
      ddx / dd * sp, 6, ddz / dd * sp, 1, k.ballDmg);
  }
  spawnBurst(e.x, y, e.z, 3, 'smoke', { spd: 3, up: 1.5, grav: 0.6, life: 0.5 });
  if (dist < 80) AudioSys.play('cannon', 0.28);
}

function updateBalls(dt, t) {
  for (let i = ballsLive.length - 1; i >= 0; i--) {
    const b = ballsLive[i];
    b.life -= dt;
    b.vy -= GRAV * dt;
    const m = b.m;
    m.position.x += b.vx * dt;
    m.position.y += b.vy * dt;
    m.position.z += b.vz * dt;
    let dead = b.life <= 0;

    if (!dead && b.owner === 0) {
      for (const e of enemies) {
        if (e.sink > 0) continue;
        const k = KINDS[e.kind];
        if (Math.abs(m.position.y - e.grp.position.y) < 4 &&
            Math.hypot(e.x - m.position.x, e.z - m.position.z) < k.radius) {
          damageEnemy(e, b.dmg, m.position);
          dead = true;
          break;
        }
      }
    } else if (!dead && b.owner === 1 && state === ST.PLAYING) {
      if (Math.abs(m.position.y - P.grp.position.y) < 4 &&
          Math.hypot(P.x - m.position.x, P.z - m.position.z) < P.radius) {
        damagePlayer(b.dmg);
        spawnBurst(m.position.x, m.position.y, m.position.z, 6, 'fire', { spd: 5, life: 0.5 });
        spawnBurst(m.position.x, m.position.y, m.position.z, 4, 'wood', { spd: 5, life: 0.7 });
        dead = true;
      }
    }
    if (!dead && m.position.y < waveY(m.position.x, m.position.z, t) + 0.15) {
      spawnBurst(m.position.x, m.position.y + 0.2, m.position.z, 6, 'splash', { spd: 3, up: 5, grav: 12, life: 0.6 });
      if (Math.hypot(m.position.x - P.x, m.position.z - P.z) < 45) AudioSys.play('splash', 0.3);
      dead = true;
    }
    if (dead) {
      m.visible = false;
      ballPool.push(m);
      ballsLive.splice(i, 1);
    }
  }
}

// ------------------------------------------------------------
// Inimigos
// ------------------------------------------------------------
function spawnEnemy(kind, dist, bearing) {
  const k = KINDS[kind];
  const slot = SHIP_POOLS[k.pool].find(s => !s.busy);
  if (!slot) return null;
  slot.busy = true;
  slot.grp.visible = true;
  const a = bearing ?? rand(0, Math.PI * 2);
  const d = dist ?? rand(55, 85);
  const mul = 1 + (G.tide - 1) * 0.16;
  const e = {
    kind, slot, grp: slot.grp, rocker: slot.rocker,
    x: clamp(P.x + Math.sin(a) * d, -WORLD_R + 20, WORLD_R - 20),
    z: clamp(P.z + Math.cos(a) * d, -WORLD_R + 20, WORLD_R - 20),
    yaw: rand(0, Math.PI * 2), spd: 0,
    hp: Math.round(k.hp * mul), maxHp: Math.round(k.hp * mul),
    reload: rand(1.5, 3.5), sink: 0, wander: rand(0, Math.PI * 2),
  };
  enemies.push(e);
  return e;
}

function damageEnemy(e, dmg, at) {
  if (e.sink > 0) return;
  e.hp -= dmg;
  spawnBurst(at.x, at.y, at.z, 5, 'fire', { spd: 5, life: 0.45 });
  spawnBurst(at.x, at.y, at.z, 4, 'wood', { spd: 6, life: 0.7 });
  AudioSys.play('boom', 0.4);
  shake = Math.min(0.5, shake + 0.08);
  if (e.hp <= 0) {
    e.sink = 2.4;
    G.sunk++;
    const k = KINDS[e.kind];
    const gold = Math.round(k.gold(G.tide));
    spawnCoins(e.x, e.z, gold);
    if (e.kind === 'navyL' && Math.random() < 0.5) spawnPickup('chest', e.x + rand(-6, 6), e.z + rand(-6, 6));
    AudioSys.play('boom', 0.8);
    AudioSys.play('splash', 0.5);
    shake = Math.min(0.7, shake + 0.2);
    if (e.kind === 'ghost') {
      G.ghostActive = false;
      fogNearT = 60; fogFarT = 230;
      AudioSys.duck(false);
      AudioSys.play('ghost', 0.7);
      announce('O FANTASMA SE FOI… POR ENQUANTO', 2600, true);
      spawnPickup('chest', e.x + 5, e.z);
      spawnPickup('chest', e.x - 5, e.z + 3);
      spawnBurst(e.x, e.grp.position.y + 2, e.z, 18, 'ghost', { spd: 8, up: 6, life: 1.2 });
    } else {
      announce(KINDS[e.kind].behavior === 'flee' ? 'MERCANTE AFUNDADO!' : 'FRAGATA AFUNDADA!', 1200);
    }
    updateHUD();
  }
}

function releaseEnemy(i) {
  const e = enemies[i];
  e.slot.busy = false;
  e.slot.grp.visible = false;
  e.slot.rocker.rotation.set(0, 0, 0);
  enemies.splice(i, 1);
}

function updateEnemies(dt, t) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const k = KINDS[e.kind];

    if (e.sink > 0) {
      e.sink -= dt;
      e.grp.position.y -= 1.4 * dt;
      e.rocker.rotation.x += 0.35 * dt;
      e.rocker.rotation.z += 0.2 * dt;
      if (Math.random() < 0.25) spawnBurst(e.x + rand(-2, 2), e.grp.position.y + 1, e.z + rand(-2, 2), 2, 'splash', { spd: 2, up: 3, life: 0.5 });
      if (e.sink <= 0) releaseEnemy(i);
      continue;
    }

    const dx = P.x - e.x, dz = P.z - e.z;
    const dist = Math.hypot(dx, dz);
    const bearToP = Math.atan2(dx, dz);
    e.wander += dt * 0.4;
    let desired, spdT;

    if (k.behavior === 'flee') {
      desired = bearToP + Math.PI + Math.sin(e.wander) * 0.5;
      spdT = dist < 70 ? k.spd : k.spd * 0.45;
    } else {
      if (dist > k.range + 6) {
        desired = bearToP;
        spdT = k.spd;
      } else if (dist < k.range * 0.5) {
        desired = bearToP + Math.PI;        // abre distância
        spdT = k.spd * 0.7;
      } else {
        const side = angNorm(bearToP + Math.PI / 2 - e.yaw);
        const side2 = angNorm(bearToP - Math.PI / 2 - e.yaw);
        desired = Math.abs(side) < Math.abs(side2) ? bearToP + Math.PI / 2 : bearToP - Math.PI / 2;
        spdT = clamp(P.spd + 0.5, k.spd * 0.4, k.spd);   // emparelha com o jogador
      }
      e.reload -= dt;
      if (e.reload <= 0 && dist < k.range + 4 && state === ST.PLAYING) enemyVolley(e);
    }

    // afastar da borda do mundo
    const dC = Math.hypot(e.x, e.z);
    if (dC > WORLD_R - 30) desired = Math.atan2(-e.x, -e.z);

    e.yaw = turnToward(e.yaw, desired, 0.55, dt);
    e.spd = lerp(e.spd, spdT, dt * 0.8);
    e.x += Math.sin(e.yaw) * e.spd * dt;
    e.z += Math.cos(e.yaw) * e.spd * dt;

    // separação entre navios (e do jogador)
    for (let j = 0; j < enemies.length; j++) {
      if (j === i) continue;
      const o = enemies[j];
      const sx = e.x - o.x, sz = e.z - o.z;
      const sd = Math.hypot(sx, sz);
      if (sd > 0.01 && sd < 9) { e.x += sx / sd * 3 * dt; e.z += sz / sd * 3 * dt; }
    }
    {
      const sx = e.x - P.x, sz = e.z - P.z;
      const sd = Math.hypot(sx, sz);
      const min = k.radius + P.radius + 1.5;
      if (sd > 0.01 && sd < min) { e.x = P.x + sx / sd * min; e.z = P.z + sz / sd * min; }
    }
    // ilhas
    for (const isl of islands) {
      const sx = e.x - isl.x, sz = e.z - isl.z;
      const sd = Math.hypot(sx, sz);
      const min = isl.r + k.radius;
      if (sd > 0.01 && sd < min) { e.x = isl.x + sx / sd * min; e.z = isl.z + sz / sd * min; }
    }

    placeOnWaves(e.grp, e.rocker, e.x, e.z, e.yaw, k.len, t, i * 1.7);
  }
}

// posiciona um navio sobre as ondas (bob + roll + pitch)
function placeOnWaves(grp, rocker, x, z, yaw, len, t, phase) {
  const fwx = Math.sin(yaw), fwz = Math.cos(yaw);
  const h = waveY(x, z, t);
  grp.position.set(x, h + Math.sin(t * 1.7 + phase) * 0.1, z);
  grp.rotation.y = yaw;
  const d = len * 0.45;
  const hf = waveY(x + fwx * d, z + fwz * d, t);
  const hb = waveY(x - fwx * d, z - fwz * d, t);
  const hl = waveY(x + fwz * d * 0.6, z - fwx * d * 0.6, t);
  const hr = waveY(x - fwz * d * 0.6, z + fwx * d * 0.6, t);
  rocker.rotation.x = lerp(rocker.rotation.x, Math.atan2(hb - hf, d * 2), 0.12);
  rocker.rotation.z = lerp(rocker.rotation.z, Math.atan2(hl - hr, d * 1.2), 0.12);
}

// ------------------------------------------------------------
// Marés (ondas de inimigos)
// ------------------------------------------------------------
function spawnTide(n) {
  if (n % 5 === 0) {
    // ====== NAVIO FANTASMA ======
    G.ghostActive = true;
    fogNearT = 12; fogFarT = 75;
    AudioSys.duck(true);
    AudioSys.play('ghost', 0.8);
    AudioSys.play('creak', 0.7);
    announce('A NÉVOA FECHA…\nNAVIO FANTASMA À VISTA', 3400, true);
    spawnEnemy('ghost', 60, P.yaw + rand(-0.6, 0.6));
    return;
  }
  const merch = Math.min(1 + Math.ceil(n / 2), 4);
  for (let i = 0; i < merch; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    spawnEnemy(n >= 4 && i % 3 === 2 ? 'merchantM' : 'merchantS',
      rand(55, 75), P.yaw + side * rand(0.3, 0.8));
  }
  const navy = Math.min(Math.ceil(n / 2), 5);
  for (let i = 0; i < navy; i++) {
    const kind = n >= 4 && i % 2 === 1 ? 'navyL' : 'navyM';
    if (i === 0) spawnEnemy(kind, 60, P.yaw + rand(-0.15, 0.15));
    else spawnEnemy(kind, rand(60, 90), P.yaw + rand(-1.2, 1.2));
  }
  announce('MARÉ ' + n, 2000);
}

// ------------------------------------------------------------
// Jogador — dano, upgrades, evolução
// ------------------------------------------------------------
function damagePlayer(dmg) {
  if (state !== ST.PLAYING) return;
  P.hull -= dmg;
  AudioSys.play('hurt', 0.6);
  shake = Math.min(0.8, shake + 0.3);
  updateHUD();
  if (P.hull <= 0) {
    P.hull = 0;
    startSinking();
  }
}

const UPGRADES = [
  { id: 'hull', icon: '🛡️', t: 'CASCO REFORÇADO', d: '+25 de casco máximo e reparo completo' },
  { id: 'dmg', icon: '💥', t: 'PÓLVORA NEGRA', d: '+25% de dano em cada bala de canhão' },
  { id: 'rate', icon: '⚡', t: 'ARTILHEIROS VELOZES', d: 'recarga das bordadas 15% mais rápida' },
  { id: 'speed', icon: '⛵', t: 'VELAS NOVAS', d: '+12% de velocidade máxima' },
  { id: 'balls', icon: '☄️', t: 'BORDADA EXTRA', d: '+1 bala por lado em cada bordada' },
];
let cardChoices = [];

function openCards() {
  state = ST.CHOOSING;
  const pool = UPGRADES.filter(u => !(u.id === 'balls' && P.balls >= 6));
  cardChoices = [];
  while (cardChoices.length < 3 && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    cardChoices.push(pool.splice(i, 1)[0]);
  }
  document.querySelectorAll('#cards .card').forEach((btn, i) => {
    const u = cardChoices[i];
    btn.innerHTML = u
      ? '<span class="c-icon">' + u.icon + '</span><span class="c-title">' + u.t + '</span><span class="c-desc">' + u.d + '</span>'
      : '';
    btn.style.visibility = u ? 'visible' : 'hidden';
  });
  document.getElementById('cards-title').textContent = 'NÍVEL ' + (G.level + 1) + ' — ESCOLHA UMA MELHORIA';
  document.getElementById('cards').classList.remove('hidden');
  AudioSys.play('levelup', 0.7);
}

function chooseCard(i) {
  const u = cardChoices[i];
  if (!u || state !== ST.CHOOSING) return;
  switch (u.id) {
    case 'hull': P.maxHull += 25; P.hull = P.maxHull; break;
    case 'dmg': P.dmg = Math.round(P.dmg * 1.25); break;
    case 'rate': P.reloadMax = Math.max(0.7, P.reloadMax * 0.85); break;
    case 'speed': P.maxSpd = Math.min(18, P.maxSpd * 1.12); break;
    case 'balls': P.balls = Math.min(6, P.balls + 1); break;
  }
  G.level++;
  G.nextGold += Math.round(130 * Math.pow(1.45, G.level - 1));
  document.getElementById('cards').classList.add('hidden');
  AudioSys.play('upgrade', 0.8);
  state = ST.PLAYING;

  // evolução de casco em níveis-chave
  if (G.level === 3 && P.tier === 0) evolveHull(1);
  else if (G.level === 6 && P.tier === 1) evolveHull(2);
  else announce(u.t + '!', 1600);
  updateHUD();
}

function evolveHull(tier) {
  setPlayerTier(tier);
  const name = HULL_TIERS[tier].name;
  announce('SEU NAVIO EVOLUIU!\nAGORA É UM ' + name, 3000);
  AudioSys.play('levelup', 0.9);
  AudioSys.play('upgrade', 0.8);
  spawnBurst(P.x, P.grp.position.y + 2, P.z, 20, 'gold', { spd: 7, up: 7, life: 1.1 });
  shake = 0.5;
}

function updatePlayer(dt, t) {
  // leme + velas
  let turn = 0;
  if (keys['arrowleft'] || keys['a']) turn -= 1;
  if (keys['arrowright'] || keys['d']) turn += 1;
  turn += touchTurn;
  turn = clamp(turn, -1, 1);
  if (keys['arrowup'] || keys['w']) P.throttle = clamp(P.throttle + 0.7 * dt, 0, 1);
  if (keys['arrowdown'] || keys['s']) P.throttle = clamp(P.throttle - 0.9 * dt, 0, 1);

  const spdF = P.spd / P.maxSpd;
  P.yaw += turn * 1.0 * (0.35 + 0.65 * spdF) * dt;
  P.spd = lerp(P.spd, P.throttle * P.maxSpd, dt * 0.55);   // inércia naval
  P.x += Math.sin(P.yaw) * P.spd * dt;
  P.z += Math.cos(P.yaw) * P.spd * dt;

  // limites do mundo
  const dC = Math.hypot(P.x, P.z);
  if (dC > WORLD_R) {
    P.x *= WORLD_R / dC; P.z *= WORLD_R / dC;
    if (G.edgeWarn <= 0) { announce('MAR ABERTO DEMAIS — VOLTE!', 1500); G.edgeWarn = 5; }
  }
  G.edgeWarn -= dt;

  // colisão com ilhas
  for (const isl of islands) {
    const sx = P.x - isl.x, sz = P.z - isl.z;
    const sd = Math.hypot(sx, sz);
    const min = isl.r + P.radius;
    if (sd > 0.01 && sd < min) {
      P.x = isl.x + sx / sd * min; P.z = isl.z + sz / sd * min;
      P.spd *= 0.5;
    }
  }

  // disparo
  P.reload = Math.max(0, P.reload - dt);
  if ((keys[' '] || fireHeld) && P.reload <= 0) fireBroadside();

  // visual
  placeOnWaves(P.grp, P.rocker, P.x, P.z, P.yaw, P.len, t, 0);
  P.rollVel = lerp(P.rollVel, 0, dt * 3);
  P.rocker.rotation.z += P.rollVel * 0.1 - turn * spdF * 0.06;

  // esteira (wake)
  G.wakeT -= dt;
  if (P.spd > 3.5 && G.wakeT <= 0) {
    G.wakeT = 0.09;
    const fwx = Math.sin(P.yaw), fwz = Math.cos(P.yaw);
    spawnBurst(P.x - fwx * P.len * 0.5, P.grp.position.y + 0.1, P.z - fwz * P.len * 0.5,
      1, 'splash', { spd: 1.5, up: 1.5, grav: 5, life: 0.5, scale: 0.7 });
  }
}

// ------------------------------------------------------------
// Naufrágio do jogador
// ------------------------------------------------------------
let sinkT = 0;
function startSinking() {
  state = ST.SINKING;
  sinkT = 3.2;
  AudioSys.play('boom', 0.9);
  AudioSys.play('splash', 0.8);
  AudioSys.duck(false);
  announce('O CASCO CEDE…', 2500);
  shake = 1;
}
function updateSinking(dt) {
  sinkT -= dt;
  P.grp.position.y -= 1.1 * dt;
  P.rocker.rotation.x += 0.3 * dt;
  P.rocker.rotation.z += 0.18 * dt;
  if (Math.random() < 0.3) {
    spawnBurst(P.x + rand(-2, 2), P.grp.position.y + 0.8, P.z + rand(-2, 2), 2, 'splash', { spd: 2.5, up: 3.5, life: 0.6 });
  }
  if (sinkT <= 0) endGame();
}

function endGame() {
  state = ST.OVER;
  saveRecord(G.gold);
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('btn-fire').classList.add('hidden');
  document.getElementById('end').classList.remove('hidden');
  document.getElementById('end-stats').innerHTML =
    'ouro saqueado: <b>' + G.gold + '</b><br>' +
    'marés sobrevividas: ' + G.tide + ' · navios afundados: ' + G.sunk +
    '<br>nível ' + G.level + ' · ' + HULL_TIERS[P.tier].name.toLowerCase() +
    '<br>recorde: ' + loadRecord() + ' de ouro';
  AudioSys.playMusic('gameover');
}

// ------------------------------------------------------------
// Moedas e recolhíveis
// ------------------------------------------------------------
function updateCoins(dt, t) {
  for (let i = coinsLive.length - 1; i >= 0; i--) {
    const c = coinsLive[i];
    c.life -= dt;
    const dx = P.x - c.x, dz = P.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < 9 && state === ST.PLAYING) {            // ímã
      c.x += dx / d * 16 * dt; c.z += dz / d * 16 * dt;
    }
    c.m.position.set(c.x, waveY(c.x, c.z, t) + 0.5 + Math.sin(t * 3 + c.phase) * 0.15, c.z);
    c.m.rotation.z += 2.5 * dt;
    if (d < 2.6 && state === ST.PLAYING) {
      addGold(c.value);
      AudioSys.play('coin', 0.45);
      spawnBurst(c.x, c.m.position.y + 0.3, c.z, 4, 'gold', { spd: 3, up: 4, life: 0.5 });
      c.life = 0;
    }
    if (c.life <= 0) {
      c.m.visible = false;
      coinPool.push(c.m);
      coinsLive.splice(i, 1);
    }
  }
}

function updatePickups(dt, t) {
  for (let i = pickupsLive.length - 1; i >= 0; i--) {
    const p = pickupsLive[i];
    p.life -= dt;
    p.grp.position.set(p.x, waveY(p.x, p.z, t) + 0.15 + Math.sin(t * 2 + p.phase) * 0.1, p.z);
    p.grp.rotation.y += 0.4 * dt;
    const d = Math.hypot(P.x - p.x, P.z - p.z);
    if (d < P.radius + 1.6 && state === ST.PLAYING) {
      if (p.kind === 'chest') {
        const v = 60 + 15 * G.tide;
        addGold(v);
        AudioSys.play('chest', 0.7);
        announce('BAÚ SAQUEADO! +' + v + ' DE OURO', 1500);
        spawnBurst(p.x, p.grp.position.y + 1, p.z, 10, 'gold', { spd: 5, up: 6, life: 0.9 });
      } else {
        P.hull = Math.min(P.maxHull, P.hull + 18);
        AudioSys.play('repair', 0.7);
        announce('CASCO REPARADO +18', 1400);
        spawnBurst(p.x, p.grp.position.y + 1, p.z, 8, 'ghost', { spd: 4, up: 5, life: 0.8 });
      }
      updateHUD();
      p.life = 0;
    }
    if (p.life <= 0) {
      p.grp.visible = false;
      pickupsLive.splice(i, 1);
    }
  }
}

function addGold(v) {
  G.gold += v;
  if (G.gold >= G.nextGold && state === ST.PLAYING) openCards();
  updateHUD();
}

// ------------------------------------------------------------
// Tempestade
// ------------------------------------------------------------
function updateStorm(dt) {
  if (!G.storm) {
    if (G.time >= G.stormNext) {
      G.storm = 18;
      G.boltT = 2;
      waveAmpT = 2.1;
      darkMulT = 0.4;
      rain.visible = true;
      announce('TEMPESTADE NO HORIZONTE!', 2200);
      AudioSys.play('thunder', 0.5);
    }
    return;
  }
  G.storm -= dt;
  G.boltT -= dt;
  if (G.boltT <= 0) {
    G.boltT = rand(1.6, 4.2);
    flash = 1;
    AudioSys.play('thunder', rand(0.4, 0.7));
    shake = Math.min(0.5, shake + 0.12);
  }
  if (G.storm <= 0) {
    G.storm = 0;
    G.stormNext = G.time + rand(75, 115);
    waveAmpT = 1;
    darkMulT = 1;
    rain.visible = false;
    announce('O CÉU ABRE.', 1600);
  }
}

// ------------------------------------------------------------
// Fluxo de jogo
// ------------------------------------------------------------
function clearWorld() {
  for (let i = enemies.length - 1; i >= 0; i--) releaseEnemy(i);
  for (const b of ballsLive) { b.m.visible = false; ballPool.push(b.m); }
  ballsLive.length = 0;
  for (const p of partsLive) { p.m.visible = false; partPool.push(p.m); }
  partsLive.length = 0;
  for (const c of coinsLive) { c.m.visible = false; coinPool.push(c.m); }
  coinsLive.length = 0;
  for (const p of pickupsLive) p.grp.visible = false;
  pickupsLive.length = 0;
}

function startGame() {
  clearWorld();
  G = {
    gold: 0, nextGold: 100, level: 1, tide: 1, sunk: 0,
    time: 0, tidePause: 0, stormNext: rand(50, 75), storm: 0, boltT: 0,
    ghostActive: false, edgeWarn: 0, wakeT: 0, pickupT: 14,
  };
  P.x = 0; P.z = 0; P.yaw = 0; P.spd = 0; P.throttle = 0.35;
  P.maxHull = 100; P.hull = 100; P.reload = 0; P.reloadMax = 2.2;
  P.dmg = 12; P.balls = 2; P.maxSpd = 11; P.rollVel = 0;
  setPlayerTier(0);
  P.rocker.rotation.set(0, 0, 0);
  fogNearT = 60; fogFarT = 230;
  waveAmpT = 1; darkMulT = 1; rain.visible = false;
  dayT = 0.10;
  AudioSys.duck(false);

  state = ST.PLAYING;
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('end').classList.add('hidden');
  document.getElementById('cards').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  if ('ontouchstart' in window) document.getElementById('btn-fire').classList.remove('hidden');
  AudioSys.play('confirm', 0.7);
  AudioSys.playMusic('game');
  spawnTide(1);
  updateHUD();
}

// ------------------------------------------------------------
// HUD
// ------------------------------------------------------------
const $ = id => document.getElementById(id);
let announceTimer = null;
function announce(msg, dur = 1500, ghostly = false) {
  const el = $('announce');
  el.textContent = msg;
  el.classList.toggle('ghostly', ghostly);
  el.classList.add('show');
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => el.classList.remove('show'), dur);
}

function updateHUD() {
  if (!G) return;
  $('gold').textContent = '⛁ ' + G.gold;
  $('record-live').textContent = 'recorde ' + Math.max(loadRecord(), G.gold);
  $('tide').textContent = 'MARÉ ' + G.tide;
  $('sunk').textContent = 'afundados: ' + G.sunk;
  $('ship-level').textContent = HULL_TIERS[P.tier].name + ' · NÍVEL ' + G.level;
  const pct = clamp(P.hull / P.maxHull, 0, 1);
  const hb = $('hull-bar');
  hb.style.width = (pct * 100) + '%';
  hb.style.background = pct > 0.5
    ? 'linear-gradient(90deg,#4adf9a,#8af0c0)'
    : pct > 0.25 ? 'linear-gradient(90deg,#ffb23e,#ffd23e)' : 'linear-gradient(90deg,#d8503c,#ff7a5a)';
}

function updateReloadHUD() {
  const pct = P.reloadMax > 0 ? 1 - P.reload / P.reloadMax : 1;
  $('reload-bar').style.width = (pct * 100) + '%';
  $('reload-label').textContent = pct >= 1 ? 'CANHÕES PRONTOS' : 'RECARREGANDO…';
}

// ------------------------------------------------------------
// Entrada
// ------------------------------------------------------------
const keys = {};
let touchTurn = 0, fireHeld = false;
window.addEventListener('keydown', e => {
  AudioSys.unlock();
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (e.key === 'Enter' && (state === ST.MENU || state === ST.OVER)) startGame();
  if (k === 'm') AudioSys.toggleMute();
  if (state === ST.CHOOSING && ['1', '2', '3'].includes(e.key)) chooseCard(Number(e.key) - 1);
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

let dragX = null, dragY = null;
window.addEventListener('pointerdown', e => {
  AudioSys.unlock();
  if (e.target.closest('.overlay, button, a')) return;
  dragX = e.clientX; dragY = e.clientY;
});
window.addEventListener('pointermove', e => {
  if (dragX === null) return;
  touchTurn = clamp(touchTurn + (e.clientX - dragX) * 0.006, -1, 1);
  P.throttle = clamp(P.throttle - (e.clientY - dragY) * 0.004, 0, 1);
  dragX = e.clientX; dragY = e.clientY;
});
window.addEventListener('pointerup', () => { dragX = null; touchTurn = 0; });

const fireBtn = $('btn-fire');
fireBtn.addEventListener('pointerdown', e => { e.preventDefault(); AudioSys.unlock(); fireHeld = true; });
fireBtn.addEventListener('pointerup', () => { fireHeld = false; });
fireBtn.addEventListener('pointerleave', () => { fireHeld = false; });

$('btn-start').addEventListener('click', () => { AudioSys.unlock(); startGame(); });
$('btn-retry').addEventListener('click', () => { AudioSys.unlock(); startGame(); });
document.querySelectorAll('#cards .card').forEach(btn => {
  btn.addEventListener('click', () => { AudioSys.unlock(); chooseCard(Number(btn.dataset.i)); });
});

// ------------------------------------------------------------
// Câmera
// ------------------------------------------------------------
let shake = 0;
const camTarget = new THREE.Vector3(), lookTarget = new THREE.Vector3();
function updateCamera(dt, t) {
  if (state === ST.MENU) {
    const a = t * 0.12;
    camTarget.set(P.x + Math.sin(a) * 26, 11, P.z + Math.cos(a) * 26);
    camera.position.lerp(camTarget, Math.min(1, dt * 2));
    camera.lookAt(P.x, 1.5, P.z);
    return;
  }
  const fwx = Math.sin(P.yaw), fwz = Math.cos(P.yaw);
  const dist = 14 + P.len * 1.1, h = 6.2 + P.len * 0.5;
  camTarget.set(P.x - fwx * dist, P.grp.position.y + h, P.z - fwz * dist);
  camera.position.lerp(camTarget, Math.min(1, dt * 3));
  lookTarget.set(P.x + fwx * 9, P.grp.position.y + 2.2, P.z + fwz * 9);
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 1.4);
    lookTarget.x += rand(-shake, shake);
    lookTarget.y += rand(-shake, shake) * 0.6;
    lookTarget.z += rand(-shake, shake);
  }
  camera.lookAt(lookTarget);
}

// ------------------------------------------------------------
// Loop
// ------------------------------------------------------------
const clock = new THREE.Clock();
let time = 0;
let fpsFrames = 0, fpsAcc = 0, fpsValue = 60;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  time += dt;
  fpsFrames++; fpsAcc += dt;
  if (fpsAcc >= 1) { fpsValue = fpsFrames / fpsAcc; fpsFrames = 0; fpsAcc = 0; }

  updateOcean(time);
  updateSky(dt);
  updateParts(dt);
  updateRain(dt);
  updateClouds(dt);

  // sol acompanha o jogador (sombras em qualquer ponto do mapa)
  sun.position.set(P.x + 26, 42, P.z + 26);
  sun.target.position.set(P.x, 0, P.z);

  if (state === ST.PLAYING) {
    G.time += dt;
    updatePlayer(dt, time);
    updateEnemies(dt, time);
    updateBalls(dt, time);
    updateCoins(dt, time);
    updatePickups(dt, time);
    updateStorm(dt);
    updateReloadHUD();

    // próxima maré
    if (enemies.length === 0) {
      G.tidePause += dt;
      if (G.tidePause > 2.6) {
        G.tidePause = 0;
        G.tide++;
        spawnTide(G.tide);
        updateHUD();
      }
    } else G.tidePause = 0;

    // baús e barris à deriva
    G.pickupT -= dt;
    if (G.pickupT <= 0) {
      G.pickupT = rand(13, 22);
      const a = rand(0, Math.PI * 2), d = rand(28, 60);
      const kind = P.hull < P.maxHull * 0.6 ? (Math.random() < 0.65 ? 'barrel' : 'chest')
        : (Math.random() < 0.4 ? 'barrel' : 'chest');
      spawnPickup(kind, clamp(P.x + Math.sin(a) * d, -WORLD_R, WORLD_R), clamp(P.z + Math.cos(a) * d, -WORLD_R, WORLD_R));
    }
  } else if (state === ST.CHOOSING) {
    placeOnWaves(P.grp, P.rocker, P.x, P.z, P.yaw, P.len, time, 0);
    updateEnemiesVisualOnly(time);
    updateCoins(dt, time);
    updatePickups(dt, time);
  } else if (state === ST.SINKING) {
    updateSinking(dt);
    updateEnemiesVisualOnly(time);
    updateBalls(dt, time);
  } else if (state === ST.MENU || state === ST.OVER) {
    if (P.grp) placeOnWaves(P.grp, P.rocker, P.x, P.z, P.yaw, P.len, time, 0);
  }

  updateCamera(dt, time);
  renderer.render(scene, camera);
}

function updateEnemiesVisualOnly(t) {
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.sink > 0) continue;
    placeOnWaves(e.grp, e.rocker, e.x, e.z, e.yaw, KINDS[e.kind].len, t, i * 1.7);
  }
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
AudioSys.load();
$('record').textContent = loadRecord();

if (document.fonts && document.fonts.load) {
  document.fonts.load('20px "Kenney Future"');
  document.fonts.load('20px "Kenney Mono"');
}

Promise.all(MODELS.map(loadModel)).then(() => {
  initBallPool();
  initPartPool();
  initCoinPool();
  initShipPools();
  initPickups();
  initIslands();
  initPlayer();
  document.getElementById('loading').classList.add('hidden');
  AudioSys.playMusic('menu');
  tick();
}).catch(err => {
  console.error('Erro ao carregar modelos:', err);
  document.getElementById('loading').innerHTML = '<p class="story">Erro ao carregar modelos — veja o console.</p>';
});

// handle de testes
window.__CS = {
  get state() { return state; },
  get gold() { return G ? G.gold : 0; },
  get tide() { return G ? G.tide : 0; },
  get sunk() { return G ? G.sunk : 0; },
  get hull() { return P.hull; },
  get level() { return G ? G.level : 0; },
  get tier() { return P.tier; },
  get enemies() { return enemies.length; },
  get balls() { return ballsLive.length; },
  get parts() { return partsLive.length; },
  get coins() { return coinsLive.length; },
  get fps() { return Math.round(fpsValue); },
  get models() { return Object.keys(LIB).length; },
  fire: () => fireBroadside(),
  gold100: () => addGold(100),
  pickCard: i => chooseCard(i),
  tp: (x, z) => { P.x = x; P.z = z; },
  setYaw: y => { P.yaw = y; },
  hurt: n => damagePlayer(n),
  killAll: () => { for (const e of enemies) if (e.sink <= 0) damageEnemy(e, 99999, e.grp.position); },
  jumpTide: n => { if (G) G.tide = n - 1; },
  forceStorm: () => { if (G) G.stormNext = G.time; },
  get storm() { return G ? G.storm : 0; },
  nearest: () => {
    let best = null, bd = 1e9;
    for (const e of enemies) {
      if (e.sink > 0) continue;
      const d = Math.hypot(e.x - P.x, e.z - P.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best ? { kind: best.kind, d: Math.round(bd), x: Math.round(best.x), z: Math.round(best.z), hp: best.hp } : null;
  },
};
