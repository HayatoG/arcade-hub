// ============================================================
// CORE — renderer, cena, helpers, partículas, shake, estado
// ============================================================
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[(Math.random() * arr.length) | 0];

export const LS = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

export const AUTO = new URLSearchParams(location.search).has('auto');

// ------------------------------------------------------------
// Renderer / cena / câmera / luzes
// ------------------------------------------------------------
export const canvas = document.getElementById('game');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: AUTO });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.3, 320);
camera.position.set(4, 6, 12);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

export const hemi = new THREE.HemisphereLight(0xffffff, 0x6a8c5a, 0.95);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 4; sun.shadow.camera.far = 120;
sun.shadow.camera.left = -26; sun.shadow.camera.right = 26;
sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);

export const skyColor = new THREE.Color(0x9be0f7);
scene.background = skyColor;
scene.fog = new THREE.Fog(new THREE.Color(0xbfeaf7), 36, 130);

// ------------------------------------------------------------
// Estado global compartilhado
// ------------------------------------------------------------
export const G = {
  state: 'loading',       // loading | menu | map | level | clear | dead | final | pause
  pausedFrom: null,
  levelIdx: 0,            // 0,1 = fases, 2 = boss
  def: null,              // definição da fase atual
  player: null,
  enemies: [],
  boss: null,
  time: 0,
  hitStop: 0,
  // progresso da run atual na fase
  runCoins: 0, runStars: [false, false, false],
  checkpoint: null,
  // save
  unlocked: parseInt(LS.get('geleco_unlock', '1'), 10),
  stars: [
    parseInt(LS.get('geleco_stars1', '0'), 10),
    parseInt(LS.get('geleco_stars2', '0'), 10),
    LS.get('geleco_boss', '0') === '1' ? 1 : 0,
  ],
  coins: parseInt(LS.get('geleco_coins', '0'), 10),
};

export function saveProgress() {
  LS.set('geleco_unlock', String(G.unlocked));
  LS.set('geleco_stars1', String(G.stars[0]));
  LS.set('geleco_stars2', String(G.stars[1]));
  LS.set('geleco_boss', G.stars[2] ? '1' : '0');
  LS.set('geleco_coins', String(G.coins));
  const bits = n => (n & 1) + ((n >> 1) & 1) + ((n >> 2) & 1);
  LS.set('geleco_record', String(bits(G.stars[0]) + bits(G.stars[1]) + (G.stars[2] ? 1 : 0)));
}
export const starCount = n => (n & 1) + ((n >> 1) & 1) + ((n >> 2) & 1);

// ------------------------------------------------------------
// Partículas (pool)
// ------------------------------------------------------------
const P_MAX = 160;
const pGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
const pool = [];
for (let i = 0; i < P_MAX; i++) {
  const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ transparent: true }));
  m.visible = false;
  scene.add(m);
  pool.push({ mesh: m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grav: 0, size: 1, spin: 0 });
}
let pCursor = 0;

export function burst(x, y, z, color, n = 10, opt = {}) {
  const { speed = 4, up = 3, life = 0.55, size = 1, grav = 9, spread = 1 } = opt;
  for (let i = 0; i < n; i++) {
    const p = pool[pCursor]; pCursor = (pCursor + 1) % P_MAX;
    p.mesh.visible = true;
    p.mesh.position.set(x + rand(-0.2, 0.2) * spread, y + rand(-0.1, 0.25) * spread, z + rand(-0.2, 0.2) * spread);
    p.mesh.material.color.set(color);
    p.mesh.material.opacity = 1;
    p.life = p.max = life * rand(0.7, 1.25);
    p.vx = rand(-speed, speed); p.vz = rand(-speed, speed) * 0.4;
    p.vy = rand(up * 0.3, up * 1.4);
    p.grav = grav; p.size = size * rand(0.7, 1.4);
    p.spin = rand(-9, 9);
    p.mesh.scale.setScalar(p.size);
  }
}

export function updateParticles(dt) {
  for (const p of pool) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.mesh.visible = false; continue; }
    p.vy -= p.grav * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.rotation.x += p.spin * dt;
    p.mesh.rotation.z += p.spin * dt;
    const t = p.life / p.max;
    p.mesh.material.opacity = Math.min(1, t * 2);
    p.mesh.scale.setScalar(p.size * (0.4 + t * 0.6));
  }
}

// ------------------------------------------------------------
// Screen shake e hit-stop
// ------------------------------------------------------------
let shakeAmt = 0;
export function addShake(a) { shakeAmt = Math.min(0.7, shakeAmt + a); }
export function shakeOffset(dt) {
  shakeAmt = Math.max(0, shakeAmt - dt * 1.8);
  if (shakeAmt <= 0.001) return { x: 0, y: 0 };
  return { x: rand(-1, 1) * shakeAmt * 0.5, y: rand(-1, 1) * shakeAmt * 0.5 };
}
export function hitStop(s) { G.hitStop = Math.max(G.hitStop, s); }

// ------------------------------------------------------------
// UI helpers
// ------------------------------------------------------------
const annEl = document.getElementById('announce');
let annTimer = null;
export function announce(text, dur = 1.6) {
  annEl.textContent = text;
  annEl.style.opacity = 1;
  if (annTimer) clearTimeout(annTimer);
  annTimer = setTimeout(() => { annEl.style.opacity = 0; }, dur * 1000);
}

const fadeEl = document.getElementById('fade');
export function fadeOut(cb, t = 450) {
  fadeEl.style.opacity = 1;
  setTimeout(() => cb && cb(), t);
}
export function fadeIn() { fadeEl.style.opacity = 0; }

export function show(id) { document.getElementById(id).classList.remove('hidden'); }
export function hide(id) { document.getElementById(id).classList.add('hidden'); }
