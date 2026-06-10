// ============================================================
// PROFUNDEZAS — roguelite de masmorra sala-a-sala
// Three.js + Mini Dungeon / Graveyard Kit (Kenney, CC0)
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from '../lib/loaders/GLTFLoader.js';
import * as SkeletonUtils from '../lib/utils/SkeletonUtils.js';

// ------------------------------------------------------------
// Constantes
// ------------------------------------------------------------
const TILE = 2;
const COLS = 12, ROWS = 9;                  // sala 12×9 tiles
const BOUND_X = 9.5, BOUND_Z = 6.5;         // área caminhável
const GATE_XS = [-5, 5];                    // colunas dos portões (parede norte, z=-8)
const SPAWN_POS = { x: 0, z: 5.2 };
const HP_CAP = 9;

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ------------------------------------------------------------
// Cena, câmera, luzes
// ------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0812);
scene.fog = new THREE.Fog(0x0a0812, 18, 40);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 13, 12);
camera.lookAt(0, 0, 0);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.HemisphereLight(0x7a6a9a, 0x2a1c12, 1.0));
const moon = new THREE.DirectionalLight(0xbfb0e8, 0.75);
moon.position.set(9, 16, 7);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
moon.shadow.camera.left = -15; moon.shadow.camera.right = 15;
moon.shadow.camera.top = 13; moon.shadow.camera.bottom = -13;
moon.shadow.camera.far = 60;
scene.add(moon);

// tochas (reutilizadas entre salas)
const torches = [];
function flameTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 36, 2, 32, 36, 28);
  g.addColorStop(0, 'rgba(255,235,170,1)');
  g.addColorStop(0.35, 'rgba(255,160,60,.9)');
  g.addColorStop(1, 'rgba(255,90,20,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const flameTex = flameTexture();
function makeTorch() {
  const grp = new THREE.Group();
  const light = new THREE.PointLight(0xff9040, 16, 11, 1.9);
  light.position.y = 0;
  grp.add(light);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  flame.scale.set(1.1, 1.4, 1);
  grp.add(flame);
  const t = { grp, light, flame, baseI: 16, seed: rand(0, 99) };
  torches.push(t);
  scene.add(grp);
  return t;
}
for (let i = 0; i < 6; i++) makeTorch();

// ------------------------------------------------------------
// Modelos
// ------------------------------------------------------------
const MODELS = [
  'floor', 'floor-detail', 'wall', 'wall-narrow', 'wall-opening', 'column', 'banner',
  'barrel', 'chest', 'coin', 'trap', 'gate', 'stairs', 'rocks', 'weapon-sword',
  'character-human', 'character-orc',
  'graveyard/character-zombie', 'graveyard/character-skeleton', 'graveyard/character-ghost',
  'graveyard/character-vampire', 'graveyard/character-keeper',
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
      const key = name.split('/').pop();
      LIB[key] = { scene: g.scene, animations: g.animations, size: box.getSize(new THREE.Vector3()) };
      resolve();
    }, undefined, reject);
  });
}

function makeProp(name, scale = TILE) {
  const o = LIB[name].scene.clone(true);
  o.scale.setScalar(scale);
  return o;
}

// personagem animado (SkeletonUtils.clone preserva a hierarquia animada)
function makeChar(name, height) {
  const lib = LIB[name];
  const obj = SkeletonUtils.clone(lib.scene);
  obj.scale.setScalar(height / lib.size.y);
  // materiais próprios por instância (flash branco, fantasma translúcido)
  const mats = [];
  obj.traverse(o => {
    if (o.isMesh && o.material) {
      o.material = o.material.clone();
      mats.push(o.material);
    }
  });
  const mixer = new THREE.AnimationMixer(obj);
  const actions = {};
  for (const clip of lib.animations) actions[clip.name] = mixer.clipAction(clip);
  const api = { obj, mixer, actions, mats, onFinish: null };
  let current = null;
  mixer.addEventListener('finished', () => { if (api.onFinish) api.onFinish(); });
  api.play = (n, once = false, speed = 1) => {
    if (current === n || !actions[n]) return;
    const a = actions[n];
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat);
    a.clampWhenFinished = once;
    a.timeScale = speed;
    a.reset().fadeIn(0.1).play();
    if (current && actions[current]) actions[current].fadeOut(0.1);
    current = n;
  };
  api.reset = () => { mixer.stopAllAction(); current = null; api.onFinish = null; };
  Object.defineProperty(api, 'current', { get: () => current });
  return api;
}

// espada presa à mão direita (técnica do Bastião 3D)
function equipSword(ch) {
  const arm = ch.obj.getObjectByName('arm-right');
  if (!arm) return;
  const inner = LIB['weapon-sword'].scene.clone(true);
  const box = new THREE.Box3().setFromObject(inner);
  inner.position.set(
    -(box.min.x + box.max.x) / 2,
    -box.min.y + 0.02,
    -(box.min.z + box.max.z) / 2
  );
  const grip = new THREE.Group();
  grip.add(inner);
  grip.rotation.z = Math.PI / 2;          // lâmina (+Y) aponta ao longo do braço (−X)
  grip.scale.setScalar(1.7);
  grip.position.set(-0.24, 0, 0);
  inner.traverse(o => {                    // lâmina levemente luminosa p/ leitura no escuro
    if (o.isMesh && o.material && o.material.emissive) {
      o.material = o.material.clone();
      o.material.emissive.setHex(0x303038);
    }
  });
  arm.add(grip);
  ch.swordMesh = grip;
}

// ------------------------------------------------------------
// Sprites de texto / ícones (canvas)
// ------------------------------------------------------------
function textSprite(w = 256, h = 128) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.renderOrder = 999;
  return { sp, ctx, tex, c };
}

function drawIcon(ctx, id) {
  ctx.save();
  ctx.translate(128, 88);
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  if (id === 'vida') {
    ctx.fillStyle = '#ff4a5e';
    ctx.shadowColor = '#ff4a5e'; ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.moveTo(0, 42);
    ctx.bezierCurveTo(-66, -8, -34, -54, 0, -22);
    ctx.bezierCurveTo(34, -54, 66, -8, 0, 42);
    ctx.fill();
  } else if (id === 'ouro') {
    ctx.fillStyle = '#ffd23e';
    ctx.shadowColor = '#ffd23e'; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#a8741a';
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke();
  } else if (id === 'dano') {
    ctx.shadowColor = '#cfe2ff'; ctx.shadowBlur = 22;
    ctx.fillStyle = '#dfe9ff';
    ctx.beginPath();                       // lâmina
    ctx.moveTo(0, -58); ctx.lineTo(13, -42); ctx.lineTo(13, 8);
    ctx.lineTo(-13, 8); ctx.lineTo(-13, -42); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#a8741a';
    ctx.fillRect(-32, 8, 64, 12);          // guarda
    ctx.fillRect(-8, 20, 16, 30);          // cabo
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(0, 56, 9, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'veloz') {
    ctx.fillStyle = '#7ad8a0';
    ctx.shadowColor = '#7ad8a0'; ctx.shadowBlur = 22;
    ctx.beginPath();                       // bota
    ctx.moveTo(-22, -52); ctx.lineTo(10, -52); ctx.lineTo(10, 8);
    ctx.lineTo(40, 24); ctx.lineTo(40, 44); ctx.lineTo(-22, 44); ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#bff2d4';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-58, -34 + i * 22); ctx.lineTo(-34, -34 + i * 22);
      ctx.stroke();
    }
  } else if (id === 'dash') {
    ctx.fillStyle = '#b08aff';
    ctx.shadowColor = '#b08aff'; ctx.shadowBlur = 24;
    ctx.beginPath();                       // ampulheta
    ctx.moveTo(-34, -50); ctx.lineTo(34, -50); ctx.lineTo(4, 0);
    ctx.lineTo(34, 50); ctx.lineTo(-34, 50); ctx.lineTo(-4, 0); ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.moveTo(-18, -42); ctx.lineTo(18, -42); ctx.lineTo(0, -12); ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function rewardSprite(id, label) {
  const { sp, ctx, tex } = textSprite(256, 256);
  drawIcon(ctx, id);
  ctx.font = 'bold 26px "Kenney Future", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,.9)';
  ctx.strokeText(label, 128, 208);
  ctx.fillStyle = '#f2ead8';
  ctx.fillText(label, 128, 208);
  tex.needsUpdate = true;
  sp.scale.set(2.3, 2.3, 1);
  return sp;
}

// ------------------------------------------------------------
// Pools: números de dano, partículas, moedas
// ------------------------------------------------------------
const dmgPool = [];
function initDmgPool() {
  for (let i = 0; i < 24; i++) {
    const t = textSprite(192, 96);
    t.sp.visible = false;
    t.sp.scale.set(1.5, 0.75, 1);
    scene.add(t.sp);
    dmgPool.push({ ...t, life: 0, vy: 0 });
  }
}
const dmgLive = [];
function spawnDmg(x, y, z, text, color = '#ffe9b0', big = false) {
  const d = dmgPool.find(p => p.life <= 0);
  if (!d) return;
  d.ctx.clearRect(0, 0, 192, 96);
  d.ctx.font = 'bold ' + (big ? 64 : 50) + 'px "Kenney Future", sans-serif';
  d.ctx.textAlign = 'center'; d.ctx.textBaseline = 'middle';
  d.ctx.lineWidth = 10; d.ctx.strokeStyle = 'rgba(0,0,0,.9)';
  d.ctx.strokeText(text, 96, 48);
  d.ctx.fillStyle = color;
  d.ctx.fillText(text, 96, 48);
  d.tex.needsUpdate = true;
  d.sp.position.set(x + rand(-0.25, 0.25), y, z);
  d.sp.material.opacity = 1;
  d.sp.visible = true;
  d.life = 0.85;
  d.vy = 2.6;
  if (!dmgLive.includes(d)) dmgLive.push(d);
}

const particles = [];
function initParticles() {
  const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    m.visible = false;
    scene.add(m);
    particles.push({ m, life: 0, vx: 0, vy: 0, vz: 0 });
  }
}
function burst(x, y, z, color, n = 8, speed = 3.2, life = 0.5) {
  let made = 0;
  for (const p of particles) {
    if (p.life > 0) continue;
    const a = rand(0, Math.PI * 2), s = rand(speed * 0.4, speed);
    p.vx = Math.cos(a) * s; p.vz = Math.sin(a) * s; p.vy = rand(1.5, 4.5);
    p.life = p.maxLife = rand(life * 0.6, life);
    p.m.position.set(x, y, z);
    p.m.material.color.setHex(color);
    p.m.material.opacity = 1;
    p.m.scale.setScalar(rand(0.7, 1.8));
    p.m.visible = true;
    if (++made >= n) break;
  }
}

const coinPool = [];
function initCoins() {
  for (let i = 0; i < 44; i++) {
    const m = makeProp('coin', 1.6);
    m.visible = false;
    m.traverse(o => { if (o.isMesh) o.castShadow = false; });
    scene.add(m);
    coinPool.push({ m, live: false, vx: 0, vy: 0, vz: 0, t: 0 });
  }
}
const coinsLive = [];
function dropCoins(x, z, n) {
  for (let i = 0; i < n; i++) {
    const c = coinPool.find(c => !c.live);
    if (!c) return;
    c.live = true;
    c.t = 0;
    c.m.position.set(x + rand(-0.3, 0.3), 0.6, z + rand(-0.3, 0.3));
    const a = rand(0, Math.PI * 2);
    c.vx = Math.cos(a) * rand(1, 2.6); c.vz = Math.sin(a) * rand(1, 2.6); c.vy = rand(3.5, 5.5);
    c.m.visible = true;
    coinsLive.push(c);
  }
}

// ------------------------------------------------------------
// Pool de inimigos
// ------------------------------------------------------------
const ENEMY_DEFS = {
  zombie:   { model: 'character-zombie',   h: 1.5,  hp: 32,  spd: 1.25, cost: 1, coins: [2, 3], radius: 0.55, anim: 'walk' },
  skeleton: { model: 'character-skeleton', h: 1.45, hp: 20,  spd: 2.15, cost: 1, coins: [1, 2], radius: 0.5,  anim: 'walk' },
  orc:      { model: 'character-orc',      h: 1.75, hp: 52,  spd: 1.1,  cost: 2, coins: [3, 5], radius: 0.65, anim: 'walk' },
  vampire:  { model: 'character-vampire',  h: 1.5,  hp: 26,  spd: 2.5,  cost: 2, coins: [2, 4], radius: 0.5,  anim: 'walk' },
  ghost:    { model: 'character-ghost',    h: 1.45, hp: 18,  spd: 1.85, cost: 2, coins: [2, 3], radius: 0.5,  anim: 'walk' },
  keeper:   { model: 'character-keeper',   h: 2.95, hp: 250, spd: 1.05, cost: 0, coins: [16, 24], radius: 1.0, anim: 'walk' },
};
const POOL_N = { zombie: 8, skeleton: 8, orc: 6, vampire: 6, ghost: 6, keeper: 2 };
const enemyPool = {};   // tipo -> [chars]
const enemies = [];

function initEnemyPool() {
  for (const [type, n] of Object.entries(POOL_N)) {
    enemyPool[type] = [];
    const def = ENEMY_DEFS[type];
    for (let i = 0; i < n; i++) {
      const ch = makeChar(def.model, def.h);
      ch.obj.visible = false;
      if (type === 'ghost') ch.mats.forEach(m => { m.transparent = true; m.opacity = 0.8; });
      scene.add(ch.obj);
      const e = { type, def, ch, alive: false, ring: null };
      if (type === 'keeper') {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.5, 1, 40),
          new THREE.MeshBasicMaterial({ color: 0xd8323c, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.visible = false;
        scene.add(ring);
        e.ring = ring;
      }
      enemyPool[type].push(e);
    }
  }
}

function spawnEnemy(type, x, z, depth) {
  const e = enemyPool[type].find(e => !e.alive);
  if (!e) return null;
  const def = e.def;
  const hpMul = 1 + (depth - 1) * 0.17;
  const spdMul = 1 + Math.min(0.5, (depth - 1) * 0.035);
  e.alive = true; e.dying = 0;
  e.hp = e.maxHp = Math.round(def.hp * hpMul * (type === 'keeper' ? (1 + depth * 0.05) : 1));
  e.spd = def.spd * spdMul;
  e.kbx = 0; e.kbz = 0;
  e.flash = 0;
  e.attackCd = rand(0.4, 1);
  e.wake = rand(0.7, 1.3);
  e.ch.reset();
  e.ch.obj.visible = true;
  e.ch.obj.position.set(x, 0, z);
  e.ch.obj.rotation.y = Math.PI;
  e.ch.mats.forEach(m => { if (m.emissive) { m.emissive.setHex(0x000000); m.emissiveIntensity = 1; } });
  e.ch.play('idle');
  e.ch.onFinish = () => { if (e.alive && !e.dying) e.ch.play(e.def.anim, false, e.animSpeed || 1); };
  // específicos
  if (type === 'ghost') {
    e.phase = 'visible'; e.phaseT = rand(2, 3.5);
    e.ch.mats.forEach(m => m.opacity = 0.8);
  }
  if (type === 'vampire') { e.lungeT = rand(2.2, 3.6); e.lunge = 0; e.tele = 0; }
  if (type === 'keeper') { e.aoe = 'walk'; e.aoeT = 1.6; }
  e.animSpeed = clamp(e.spd / 1.6, 0.8, 1.8);
  burst(x, 0.7, z, 0x8a6aff, 8, 2.6, 0.5);
  enemies.push(e);
  return e;
}

function releaseEnemy(e) {
  e.alive = false;
  e.ch.obj.visible = false;
  e.ch.reset();
  if (e.ring) e.ring.visible = false;
  const i = enemies.indexOf(e);
  if (i >= 0) enemies.splice(i, 1);
}

// ------------------------------------------------------------
// Sala procedural
// ------------------------------------------------------------
let roomGroup = null;
let traps = [], gates = [], chest = null, rewardIcons = [];

function tileXZ(c, r) { return [(c - (COLS - 1) / 2) * TILE, (r - (ROWS - 1) / 2) * TILE]; }

function buildRoom(depth) {
  if (roomGroup) scene.remove(roomGroup);
  roomGroup = new THREE.Group();
  traps = []; gates = []; chest = null; rewardIcons = [];

  const isElite = depth % 5 === 0;

  // chão
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const [x, z] = tileXZ(c, r);
      const f = makeProp(Math.random() < 0.16 ? 'floor-detail' : 'floor');
      f.position.set(x, 0, z);
      f.rotation.y = randi(0, 3) * Math.PI / 2;
      f.traverse(o => { if (o.isMesh) o.castShadow = false; });
      roomGroup.add(f);
    }
  }

  // paredes do perímetro
  const gateCols = [3, 8];   // x = −5 e +5 na parede norte
  for (let c = 0; c < COLS; c++) {
    for (const r of [0, ROWS - 1]) {
      const [x, z] = tileXZ(c, r);
      const north = r === 0;
      let name = 'wall';
      if (north && gateCols.includes(c)) name = 'wall-opening';
      else if (Math.random() < 0.18) name = 'wall-narrow';
      const w = makeProp(name);
      w.position.set(x, 0, z);
      w.rotation.y = north ? 0 : Math.PI;
      roomGroup.add(w);
    }
  }
  for (let r = 1; r < ROWS - 1; r++) {
    for (const c of [0, COLS - 1]) {
      const [x, z] = tileXZ(c, r);
      const w = makeProp(Math.random() < 0.18 ? 'wall-narrow' : 'wall');
      w.position.set(x, 0, z);
      w.rotation.y = c === 0 ? Math.PI / 2 : -Math.PI / 2;
      roomGroup.add(w);
    }
  }
  // colunas nas quinas
  for (const [c, r] of [[0, 0], [COLS - 1, 0], [0, ROWS - 1], [COLS - 1, ROWS - 1]]) {
    const [x, z] = tileXZ(c, r);
    const col = makeProp('column', TILE * 1.05);
    col.position.set(x + (c === 0 ? 0.5 : -0.5), 0, z + (r === 0 ? 0.5 : -0.5));
    roomGroup.add(col);
  }

  // portões (norte)
  for (const gx of GATE_XS) {
    const g = makeProp('gate');
    g.position.set(gx, 0, -7.6);
    const door = g.getObjectByName('door');
    roomGroup.add(g);
    gates.push({ obj: g, door, x: gx, open: 0, reward: null, icon: null, glow: null });
  }

  // banners na parede norte
  const bannerTint = pick([null, 0x8a5adf, 0x4a8adf, 0xd8a832]);
  for (const c of [1, 2, 5, 6, 9, 10]) {
    if (Math.random() < 0.5) continue;
    const [x] = tileXZ(c, 0);
    const b = makeProp('banner');
    b.position.set(x, 1.7, -6.93);
    if (bannerTint) b.traverse(o => {
      if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(bannerTint)); }
    });
    roomGroup.add(b);
  }

  // escada de entrada (sul) — de onde você desceu
  const st = makeProp('stairs');
  st.position.set(0, 0, 6.9);
  st.rotation.y = Math.PI;
  roomGroup.add(st);

  // barris e pedras decorativas
  const nBarrel = randi(2, 5);
  for (let i = 0; i < nBarrel; i++) {
    const b = makeProp(Math.random() < 0.25 ? 'rocks' : 'barrel', TILE * rand(0.8, 1.05));
    const side = randi(0, 3);
    let x, z;
    if (side === 0) { x = rand(-9, 9); z = rand(-6.4, -5.6); }
    else if (side === 1) { x = rand(-9, 9); z = rand(5.6, 6.4); }
    else { x = (side === 2 ? -1 : 1) * rand(8.6, 9.4); z = rand(-5.5, 5.5); }
    if (Math.abs(x) > 3 || z < 4) {   // não bloqueia o spawn
      b.position.set(x, 0, z);
      b.rotation.y = rand(0, Math.PI * 2);
      roomGroup.add(b);
    }
  }

  // baú (45% das salas) — abre por proximidade e solta ouro
  if (Math.random() < 0.45) {
    const cm = makeProp('chest');
    const cx = pick([-1, 1]) * rand(7.6, 8.8), cz = rand(-4.5, 2);
    cm.position.set(cx, 0, cz);
    cm.rotation.y = Math.atan2(-cx, 0) + rand(-0.4, 0.4);
    roomGroup.add(cm);
    chest = { obj: cm, lid: cm.getObjectByName('lid'), x: cx, z: cz, open: false, t: 0 };
  }

  // armadilhas com espinhos em timer
  const nTraps = randi(1, 3);
  for (let i = 0; i < nTraps; i++) {
    let x, z, ok = false, guard = 0;
    while (!ok && guard++ < 20) {
      x = rand(-7.5, 7.5); z = rand(-4.5, 3.5);
      ok = Math.hypot(x - SPAWN_POS.x, z - SPAWN_POS.z) > 3.6 &&
           traps.every(t => Math.hypot(t.x - x, t.z - z) > 2.5);
    }
    if (!ok) continue;
    const tm = makeProp('trap');
    tm.position.set(x, 0.02, z);
    roomGroup.add(tm);
    const spikes = tm.getObjectByName('spikes');
    if (spikes) spikes.position.y = -0.3;
    traps.push({ obj: tm, spikes, x, z, state: 'idle', t: rand(1.5, 4), hitDone: false });
  }

  // tochas: 2 na parede norte + 2 em cada lateral
  const tps = [[-2, -6.8], [2, -6.8], [-9.6, -2.5], [9.6, -2.5], [-9.6, 3], [9.6, 3]];
  torches.forEach((t, i) => {
    const [x, z] = tps[i];
    t.grp.position.set(x, 2.5, z);
    t.grp.visible = true;
  });

  scene.add(roomGroup);
  return isElite;
}

// ------------------------------------------------------------
// Bênçãos / recompensas
// ------------------------------------------------------------
const REWARDS = [
  { id: 'vida',  label: '+1 VIDA' },
  { id: 'ouro',  label: 'OURO' },
  { id: 'dano',  label: '+25% DANO' },
  { id: 'veloz', label: '+VELOCIDADE' },
  { id: 'dash',  label: 'DASH VELOZ' },
];

function openGates() {
  const opts = [...REWARDS];
  AudioSys.play('door', 0.8);
  for (const g of gates) {
    const r = opts.splice(randi(0, opts.length - 1), 1)[0];
    g.reward = r;
    const icon = rewardSprite(r.id, r.label);
    icon.scale.set(2.7, 2.7, 1);
    icon.position.set(g.x, 1.8, -6.0);
    scene.add(icon);
    g.icon = icon;
    const glow = new THREE.PointLight(0xffc878, 7, 6, 1.8);
    glow.position.set(g.x, 1.6, -6.2);
    scene.add(glow);
    g.glow = glow;
    rewardIcons.push(icon);
  }
}

function clearGateIcons() {
  for (const g of gates) {
    if (g.icon) scene.remove(g.icon);
    if (g.glow) scene.remove(g.glow);
    g.icon = null; g.glow = null;
  }
}

function applyReward(id, times) {
  for (let i = 0; i < times; i++) {
    switch (id) {
      case 'vida':
        if (G.hp < G.maxHp) G.hp++;
        else if (G.maxHp < HP_CAP) { G.maxHp++; G.hp++; }
        break;
      case 'ouro': G.gold += 20 + G.depth * 4; break;
      case 'dano': G.dmgMul *= 1.25; G.buffs.dano++; break;
      case 'veloz': G.speed = Math.min(8, G.speed * 1.08); G.buffs.veloz++; break;
      case 'dash': G.dashMul = Math.max(0.45, G.dashMul * 0.85); G.buffs.dash++; break;
    }
  }
  AudioSys.play('upgrade', 0.8);
}

// ------------------------------------------------------------
// Estado / herói
// ------------------------------------------------------------
const ST = { MENU: 0, PLAYING: 1, DYING: 2, OVER: 3 };
let state = ST.MENU;
let G = null;
let hero = null;
let shake = 0, slowmo = 0, time = 0, camZoom = 1;
let trail = null;

function loadRecord() { try { return parseInt(localStorage.getItem('profundezas_record') || '0', 10) || 0; } catch (e) { return 0; } }
function saveRecord(n) { try { if (n > loadRecord()) localStorage.setItem('profundezas_record', String(n)); } catch (e) {} }

let heroLight = null;
function initHero() {
  hero = makeChar('character-human', 1.5);
  equipSword(hero);
  hero.obj.castShadow = true;
  scene.add(hero.obj);
  // lanterna do herói — legibilidade estilo Hades
  heroLight = new THREE.PointLight(0xffc890, 7, 8, 2);
  heroLight.position.set(0, 2.2, 0.6);
  scene.add(heroLight);
  // rastro do golpe (arco de 120°)
  const geo = new THREE.RingGeometry(0.55, 2.0, 24, 1, -Math.PI / 2 - 1.05, 2.1);
  geo.rotateX(-Math.PI / 2);
  trail = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0xffc878, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, depthWrite: false,
  }));
  trail.position.y = 0.55;
  scene.add(trail);
}

function startGame() {
  for (const e of [...enemies]) releaseEnemy(e);
  for (const c of coinsLive) { c.live = false; c.m.visible = false; }
  coinsLive.length = 0;
  clearGateIcons();

  G = {
    depth: 1, cleared: 0, kills: 0, gold: 0,
    hp: 5, maxHp: 5,
    dmg: 11, dmgMul: 1, speed: 5.2, dashMul: 1,
    buffs: { dano: 0, veloz: 0, dash: 0 },
    iframes: 0, atkCd: 0, dashT: 0, dashCd: 0, dashDirX: 0, dashDirZ: 0,
    stepT: 0, stepAlt: false, hurtCd: 0,
    px: SPAWN_POS.x, pz: SPAWN_POS.z, dir: Math.PI,
    over: false, choosing: false,
  };
  slowmo = 0;
  enterRoom();
  state = ST.PLAYING;
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('end').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  if ('ontouchstart' in window) document.getElementById('touch').classList.remove('hidden');
  AudioSys.play('confirm', 0.7);
  AudioSys.playMusic('game');
}

function enterRoom() {
  const isElite = buildRoom(G.depth);
  G.px = SPAWN_POS.x; G.pz = SPAWN_POS.z; G.dir = Math.PI;
  hero.obj.position.set(G.px, 0, G.pz);
  hero.obj.rotation.y = G.dir;
  hero.reset();
  hero.play('idle');
  hero.onFinish = () => { if (state === ST.PLAYING) hero.play(moveVecLen() > 0.1 ? 'walk' : 'idle'); };
  G.choosing = false;

  // composição de inimigos
  if (isElite) {
    spawnEnemy('keeper', 0, -3, G.depth);
    if (G.depth >= 10) {
      spawnEnemy('skeleton', -4, -2, G.depth);
      spawnEnemy('skeleton', 4, -2, G.depth);
    }
    announce('SALA ' + G.depth + ' — ELITE', 2200);
    setTimeout(() => state === ST.PLAYING && announce('O GUARDIÃO DESPERTA!', 1600), 2300);
  } else {
    let budget = Math.min(11, 3 + Math.floor(G.depth * 0.9));
    const avail = ['zombie', 'skeleton'];
    if (G.depth >= 2) avail.push('orc');
    if (G.depth >= 3) avail.push('vampire');
    if (G.depth >= 4) avail.push('ghost');
    let guard = 0;
    while (budget > 0 && guard++ < 30) {
      const t = pick(avail);
      const def = ENEMY_DEFS[t];
      if (def.cost > budget && budget < 2) break;
      if (def.cost > budget) continue;
      let x, z, ok = false, g2 = 0;
      while (!ok && g2++ < 15) {
        x = rand(-8, 8); z = rand(-5.5, 2.5);
        ok = Math.hypot(x - G.px, z - G.pz) > 4.2;
      }
      if (spawnEnemy(t, x, z, G.depth)) budget -= def.cost;
      else break;
    }
    announce('SALA ' + G.depth, 1400);
  }
  updateHUD();
}

function roomCleared() {
  G.cleared = G.depth;
  G.choosing = true;
  openGates();
  announce('ESCOLHA SUA BÊNÇÃO', 2000);
}

function chooseGate(g) {
  const isElite = G.depth % 5 === 0;
  applyReward(g.reward.id, isElite ? 2 : 1);
  announce(isElite ? 'BÊNÇÃO DUPLA!\n' + g.reward.label : g.reward.label, 1600);
  updateHUD();
  const fadeEl = document.getElementById('fade');
  fadeEl.classList.add('show');
  G.choosing = false;
  G.transition = true;
  setTimeout(() => {
    clearGateIcons();
    // moedas esquecidas são recolhidas automaticamente na descida
    for (const c of coinsLive) { c.live = false; c.m.visible = false; G.gold++; }
    coinsLive.length = 0;
    G.depth++;
    enterRoom();
    G.transition = false;
    fadeEl.classList.remove('show');
  }, 400);
}

function startDeath() {
  state = ST.DYING;
  G.over = true;
  hero.play('die', true, 1);
  slowmo = 1.5;
  AudioSys.play('hurt', 0.9);
  AudioSys.play('die2', 0.7);
  shake = 0.5;
  saveRecord(G.cleared);
  setTimeout(() => {
    state = ST.OVER;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('touch').classList.add('hidden');
    document.getElementById('end').classList.remove('hidden');
    document.getElementById('end-stats').innerHTML =
      'salas vencidas: <b>' + G.cleared + '</b><br>' +
      'abates: ' + G.kills + ' · ouro: ' + G.gold +
      '<br>recorde: ' + loadRecord() + ' salas';
    AudioSys.playMusic('gameover');
  }, 2100);
}

// ------------------------------------------------------------
// Combate
// ------------------------------------------------------------
function attack() {
  if (state !== ST.PLAYING || G.atkCd > 0 || G.transition) return;
  G.atkCd = 0.38;
  hero.play('attack-melee-right', true, 1.9);
  AudioSys.play('swing', 0.5, rand(0.9, 1.15));
  trail.position.set(G.px, 0.55, G.pz);
  trail.rotation.y = G.dir;
  trail.material.opacity = 0.8;
  trail.scale.setScalar(0.8);

  const fx = Math.sin(G.dir), fz = Math.cos(G.dir);
  let hitAny = false;
  for (const e of enemies) {
    if (!e.alive || e.dying) continue;
    if (e.type === 'ghost' && e.phase === 'hidden') continue;
    const ex = e.ch.obj.position.x, ez = e.ch.obj.position.z;
    const dx = ex - G.px, dz = ez - G.pz;
    const dist = Math.hypot(dx, dz);
    const range = 2.2 + (e.type === 'keeper' ? 0.5 : 0);
    if (dist > range) continue;
    const cos = (dx * fx + dz * fz) / (dist || 1);
    if (cos < 0.45 && dist > 0.95) continue;
    hitAny = true;
    const crit = Math.random() < 0.12;
    const dmg = Math.round(G.dmg * G.dmgMul * rand(0.85, 1.2) * (crit ? 1.8 : 1));
    damageEnemy(e, dmg, crit, dx / (dist || 1), dz / (dist || 1));
  }
  if (hitAny) {
    AudioSys.play(Math.random() < 0.5 ? 'hit1' : 'hit2', 0.55, rand(0.92, 1.12));
    shake = Math.min(0.4, shake + 0.14);
  }
}

function damageEnemy(e, dmg, crit, nx, nz) {
  e.hp -= dmg;
  const p = e.ch.obj.position;
  spawnDmg(p.x, e.def.h + 0.5, p.z, String(dmg), crit ? '#ffd23e' : '#ffe9b0', crit);
  burst(p.x, 0.9, p.z, crit ? 0xffd23e : 0xff8a5a, 6, 3, 0.4);
  // flash branco
  e.flash = 0.08;
  e.ch.mats.forEach(m => { if (m.emissive) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 0.85; } });
  // knockback
  const kb = e.type === 'keeper' ? 1.6 : e.type === 'ghost' ? 3 : 6;
  e.kbx += nx * kb; e.kbz += nz * kb;

  if (e.hp <= 0 && !e.dying) {
    e.dying = 0.8;
    e.ch.play('die', true, 1.3);
    G.kills++;
    AudioSys.play(Math.random() < 0.5 ? 'die1' : 'die2', 0.4);
    dropCoins(p.x, p.z, randi(e.def.coins[0], e.def.coins[1]));
    burst(p.x, 0.8, p.z, 0x9a3a3a, 12, 3.6, 0.6);
    if (e.type === 'keeper') {
      AudioSys.play('boom', 0.8);
      shake = 0.55;
      announce('GUARDIÃO ABATIDO!', 1600);
      if (e.ring) e.ring.visible = false;
    }
    updateHUD();
  }
}

function hurtPlayer(n) {
  if (G.iframes > 0 || G.over) return;
  G.hp -= n;
  G.iframes = 0.95;
  AudioSys.play('hurt', 0.8);
  shake = Math.min(0.55, shake + 0.3);
  const hf = document.getElementById('hurt-flash');
  hf.classList.add('show');
  setTimeout(() => hf.classList.remove('show'), 120);
  burst(G.px, 1, G.pz, 0xd8323c, 10, 3.4, 0.5);
  updateHUD();
  if (G.hp <= 0) startDeath();
}

function dash() {
  if (state !== ST.PLAYING || G.dashCd > 0 || G.transition) return;
  let dx = moveX, dz = moveZ;
  if (Math.hypot(dx, dz) < 0.1) { dx = Math.sin(G.dir); dz = Math.cos(G.dir); }
  const l = Math.hypot(dx, dz) || 1;
  G.dashDirX = dx / l; G.dashDirZ = dz / l;
  G.dashT = 0.18;
  G.dashCd = 1.5 * G.dashMul;
  G.iframes = Math.max(G.iframes, 0.35);
  AudioSys.play('dash', 0.5, rand(0.95, 1.1));
  burst(G.px, 0.5, G.pz, 0xb08aff, 8, 2.6, 0.35);
}

// ------------------------------------------------------------
// HUD
// ------------------------------------------------------------
const $ = id => document.getElementById(id);
let announceTimer = null;
function announce(msg, dur = 1500) {
  const el = $('announce');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => el.classList.remove('show'), dur);
}

function updateHUD() {
  $('hearts').textContent = '♥'.repeat(Math.max(0, G.hp)) + '♡'.repeat(Math.max(0, G.maxHp - G.hp));
  $('gold').textContent = '⛃ ' + G.gold;
  $('room-label').textContent = 'SALA ' + G.depth + (G.depth % 5 === 0 ? ' ★' : '');
  $('kills').textContent = 'abates: ' + G.kills;
  const b = [];
  if (G.buffs.dano) b.push('DANO×' + G.buffs.dano);
  if (G.buffs.veloz) b.push('VELOZ×' + G.buffs.veloz);
  if (G.buffs.dash) b.push('DASH×' + G.buffs.dash);
  $('buffs').textContent = b.join(' · ');
}

// ------------------------------------------------------------
// Entrada
// ------------------------------------------------------------
const keys = {};
let moveX = 0, moveZ = 0;       // vetor de movimento atual (teclado + toque)
let joyX = 0, joyZ = 0;

function moveVecLen() { return Math.hypot(moveX, moveZ); }

window.addEventListener('keydown', e => {
  AudioSys.unlock();
  const k = e.key.toLowerCase();
  keys[k] = true;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (e.key === 'Enter' && (state === ST.MENU || state === ST.OVER)) startGame();
  if (k === 'm') AudioSys.toggleMute();
  if (k === ' ' || k === 'j') attack();
  if (k === 'shift' || k === 'k') dash();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

window.addEventListener('pointerdown', e => {
  AudioSys.unlock();
  if (e.target.closest('.overlay, button, a, .tbtn, #joy')) return;
  if (e.pointerType === 'mouse') attack();
});

$('btn-start').addEventListener('click', () => { AudioSys.unlock(); AudioSys.play('click', 0.6); startGame(); });
$('btn-retry').addEventListener('click', () => { AudioSys.unlock(); AudioSys.play('click', 0.6); startGame(); });

// toque: joystick à esquerda + botões à direita
const joyEl = $('joy'), stickEl = $('joy-stick');
let joyId = null;
window.addEventListener('touchstart', e => {
  AudioSys.unlock();
  for (const t of e.changedTouches) {
    if (t.clientX < window.innerWidth * 0.45 && joyId === null && state === ST.PLAYING) {
      joyId = t.identifier;
      updateJoy(t);
    }
  }
}, { passive: true });
window.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) if (t.identifier === joyId) updateJoy(t);
}, { passive: true });
window.addEventListener('touchend', e => {
  for (const t of e.changedTouches) if (t.identifier === joyId) {
    joyId = null; joyX = 0; joyZ = 0;
    stickEl.style.left = '38px'; stickEl.style.top = '38px';
  }
}, { passive: true });
function updateJoy(t) {
  const r = joyEl.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = t.clientX - cx, dy = t.clientY - cy;
  const d = Math.hypot(dx, dy), max = 44;
  if (d > max) { dx = dx / d * max; dy = dy / d * max; }
  joyX = dx / max; joyZ = dy / max;
  stickEl.style.left = (38 + dx) + 'px';
  stickEl.style.top = (38 + dy) + 'px';
}
$('btn-atk-t').addEventListener('touchstart', e => { e.preventDefault(); attack(); });
$('btn-dash-t').addEventListener('touchstart', e => { e.preventDefault(); dash(); });

// ------------------------------------------------------------
// Loop principal
// ------------------------------------------------------------
const clock = new THREE.Clock();
let fpsFrames = 0, fpsAcc = 0, fpsValue = 60;

function tick() {
  requestAnimationFrame(tick);
  let dt = Math.min(0.05, clock.getDelta());
  fpsFrames++; fpsAcc += dt;
  if (fpsAcc >= 1) { fpsValue = fpsFrames / fpsAcc; fpsFrames = 0; fpsAcc = 0; }
  time += dt;

  // câmera lenta na morte
  if (slowmo > 0) { slowmo -= dt; dt *= 0.28; }

  // tochas tremulam sempre
  for (const t of torches) {
    const f = 0.78 + 0.3 * Math.sin(time * 9 + t.seed) * Math.sin(time * 13.7 + t.seed * 2) + rand(-0.06, 0.06);
    t.light.intensity = t.baseI * clamp(f, 0.55, 1.15);
    t.flame.scale.set(1.1 + 0.14 * Math.sin(time * 11 + t.seed), 1.4 + 0.22 * Math.sin(time * 8.4 + t.seed), 1);
  }

  if (state === ST.PLAYING || state === ST.DYING) update(dt);

  // números de dano
  for (let i = dmgLive.length - 1; i >= 0; i--) {
    const d = dmgLive[i];
    d.life -= dt;
    d.sp.position.y += d.vy * dt;
    d.vy *= 0.92;
    if (d.life < 0.35) d.sp.material.opacity = d.life / 0.35;
    if (d.life <= 0) { d.sp.visible = false; dmgLive.splice(i, 1); }
  }
  // partículas
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vy -= 9.5 * dt;
    p.m.position.x += p.vx * dt;
    p.m.position.y = Math.max(0.05, p.m.position.y + p.vy * dt);
    p.m.position.z += p.vz * dt;
    p.m.material.opacity = clamp(p.life / p.maxLife, 0, 1);
    if (p.life <= 0) p.m.visible = false;
  }

  // lanterna acompanha o herói
  if (heroLight && G) heroLight.position.set(G.px, 2.2, G.pz + 0.6);

  // câmera segue o herói
  const fx = camZoom < 1 ? 1 : 0.42, fz = camZoom < 1 ? 1 : 0.36;   // zoom de inspeção segue exato
  const tx = (G ? G.px : 0) * fx, tz = (G ? G.pz : 0) * fz;
  let cx = tx, cy = 12.6 * camZoom, cz = tz + 10.2 * camZoom;
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 1.6);
    cx += rand(-shake, shake) * 0.5; cy += rand(-shake, shake) * 0.4;
  }
  camera.position.x = lerp(camera.position.x, cx, 4.5 * dt);
  camera.position.y = lerp(camera.position.y, cy, 4.5 * dt);
  camera.position.z = lerp(camera.position.z, cz, 4.5 * dt);
  camera.lookAt(camera.position.x, 0.4, camera.position.z - 10.5 * camZoom);

  renderer.render(scene, camera);
}

function update(dt) {
  hero.mixer.update(dt);

  if (state === ST.DYING) {
    for (const e of enemies) e.ch.mixer.update(dt);
    return;
  }

  // ---- timers do herói ----
  G.atkCd = Math.max(0, G.atkCd - dt);
  G.iframes = Math.max(0, G.iframes - dt);
  G.dashCd = Math.max(0, G.dashCd - dt);
  $('dash-fill').style.width = (100 * (1 - G.dashCd / (1.5 * G.dashMul))) + '%';

  // pisca durante i-frames
  hero.obj.visible = G.iframes > 0.05 ? (Math.floor(time * 16) % 2 === 0) : true;

  // ---- movimento ----
  moveX = joyX; moveZ = joyZ;
  if (keys['a'] || keys['arrowleft']) moveX -= 1;
  if (keys['d'] || keys['arrowright']) moveX += 1;
  if (keys['w'] || keys['arrowup']) moveZ -= 1;
  if (keys['s'] || keys['arrowdown']) moveZ += 1;
  let ml = Math.hypot(moveX, moveZ);
  if (ml > 1) { moveX /= ml; moveZ /= ml; ml = 1; }

  if (!G.transition) {
    if (G.dashT > 0) {
      G.dashT -= dt;
      G.px += G.dashDirX * 16 * dt;
      G.pz += G.dashDirZ * 16 * dt;
      burst(G.px, 0.35, G.pz, 0x8a6aff, 1, 0.8, 0.25);
    } else if (ml > 0.12) {
      G.px += (moveX / ml) * Math.min(ml, 1) * G.speed * dt;
      G.pz += (moveZ / ml) * Math.min(ml, 1) * G.speed * dt;
      G.dir = Math.atan2(moveX, moveZ);
      G.stepT -= dt;
      if (G.stepT <= 0) {
        G.stepT = 0.3;
        G.stepAlt = !G.stepAlt;
        AudioSys.play(G.stepAlt ? 'step1' : 'step2', 0.25, rand(0.9, 1.1));
      }
      if (hero.current !== 'attack-melee-right') hero.play('walk', false, clamp(G.speed / 3.4, 1, 1.9));
    } else if (hero.current !== 'attack-melee-right') {
      hero.play('idle');
    }
  }
  G.px = clamp(G.px, -BOUND_X, BOUND_X);
  G.pz = clamp(G.pz, -BOUND_Z, BOUND_Z);
  hero.obj.position.set(G.px, 0, G.pz);
  hero.obj.rotation.y = G.dir;

  // rastro do golpe
  if (trail.material.opacity > 0) {
    trail.material.opacity = Math.max(0, trail.material.opacity - dt * 3.2);
    trail.scale.setScalar(Math.min(1.15, trail.scale.x + dt * 2.4));
    trail.position.set(G.px, 0.55, G.pz);
    trail.rotation.y = G.dir;
  }

  // ---- inimigos ----
  let aliveCount = 0;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.ch.mixer.update(dt);
    const p = e.ch.obj.position;

    // flash branco (também durante a morte)
    if (e.flash > 0) {
      e.flash -= dt;
      if (e.flash <= 0) e.ch.mats.forEach(m => { if (m.emissive) m.emissive.setHex(0x000000); });
    }

    if (e.dying) {
      e.dying -= dt;
      if (e.dying <= 0) releaseEnemy(e);
      continue;
    }
    aliveCount++;
    // knockback
    p.x += e.kbx * dt; p.z += e.kbz * dt;
    e.kbx *= Math.pow(0.001, dt); e.kbz *= Math.pow(0.001, dt);

    if (e.wake > 0) { e.wake -= dt; continue; }
    if (e.ch.current === 'idle') e.ch.play(e.def.anim, false, e.animSpeed);

    const dx = G.px - p.x, dz = G.pz - p.z;
    const dist = Math.hypot(dx, dz) || 1;
    const nx = dx / dist, nz = dz / dist;
    e.attackCd = Math.max(0, e.attackCd - dt);

    // ---------------- IA por tipo ----------------
    if (e.type === 'ghost') {
      e.phaseT -= dt;
      if (e.phase === 'visible') {
        p.x += nx * e.spd * dt; p.z += nz * e.spd * dt;
        if (e.phaseT <= 0) {
          e.phase = 'fading'; e.phaseT = 0.5;
        }
      } else if (e.phase === 'fading') {
        const o = Math.max(0, e.phaseT / 0.5) * 0.8;
        e.ch.mats.forEach(m => m.opacity = o);
        if (e.phaseT <= 0) {
          e.phase = 'hidden'; e.phaseT = rand(1.1, 1.7);
          e.ch.obj.visible = false;
        }
      } else if (e.phase === 'hidden') {
        // desliza invisível na direção do herói — atravessa tudo
        p.x += nx * e.spd * 2.6 * dt; p.z += nz * e.spd * 2.6 * dt;
        if (e.phaseT < 0.45 && !e.whispered) {
          e.whispered = true;
          AudioSys.play('whisper', 0.55, rand(0.8, 1));   // sussurro antes de aparecer
        }
        if (e.phaseT <= 0) {
          e.phase = 'appearing'; e.phaseT = 0.4;
          e.whispered = false;
          e.ch.obj.visible = true;
        }
      } else { // appearing
        const o = (1 - Math.max(0, e.phaseT / 0.4)) * 0.8;
        e.ch.mats.forEach(m => m.opacity = o);
        if (e.phaseT <= 0) { e.phase = 'visible'; e.phaseT = rand(2.2, 3.4); }
      }
      e.ch.obj.position.y = 0.18 + Math.sin(time * 3 + p.x) * 0.1;   // flutua
      e.ch.obj.rotation.y = Math.atan2(nx, nz);
      // fantasma NÃO é limitado pelas paredes
    } else if (e.type === 'vampire') {
      if (e.tele > 0) {
        e.tele -= dt;
        e.ch.obj.rotation.y = Math.atan2(nx, nz);
        if (e.tele <= 0) {
          e.lunge = 0.42;
          e.lungeX = nx; e.lungeZ = nz;
          e.ch.play('sprint', false, 2);
          AudioSys.play('swing', 0.35, 0.75);
        }
      } else if (e.lunge > 0) {
        e.lunge -= dt;
        p.x += e.lungeX * 9 * dt; p.z += e.lungeZ * 9 * dt;
        if (e.lunge <= 0) { e.lungeT = rand(2.4, 3.8); e.ch.play('walk', false, e.animSpeed); }
      } else {
        p.x += nx * e.spd * dt; p.z += nz * e.spd * dt;
        e.ch.obj.rotation.y = Math.atan2(nx, nz);
        e.lungeT -= dt;
        if (e.lungeT <= 0 && dist > 2.2 && dist < 7.5) {
          e.tele = 0.45;
          e.flash = 0.45;
          e.ch.mats.forEach(m => { if (m.emissive) { m.emissive.setHex(0xa01020); m.emissiveIntensity = 0.8; } });
        } else if (e.lungeT <= 0) e.lungeT = 1.2;
      }
    } else if (e.type === 'keeper') {
      e.aoeT -= dt;
      if (e.aoe === 'walk') {
        p.x += nx * e.spd * dt; p.z += nz * e.spd * dt;
        e.ch.obj.rotation.y = Math.atan2(nx, nz);
        if (e.aoeT <= 0 && dist < 4.2) {
          e.aoe = 'tele'; e.aoeT = 1.0;
          e.ch.play('attack-melee-right', true, 0.55);
          e.ring.visible = true;
          e.ring.position.set(p.x, 0.06, p.z);
        }
      } else if (e.aoe === 'tele') {
        const s = 0.4 + 2.6 * (1 - e.aoeT / 1.0);
        e.ring.scale.setScalar(s);
        e.ring.material.opacity = 0.3 + 0.35 * Math.abs(Math.sin(time * 14));
        if (e.aoeT <= 0) {
          e.aoe = 'cd'; e.aoeT = 2.3;
          e.ring.visible = false;
          AudioSys.play('slam', 0.85);
          shake = 0.5;
          burst(p.x, 0.4, p.z, 0xff7a3a, 18, 5, 0.6);
          if (Math.hypot(G.px - p.x, G.pz - p.z) < 3.0) hurtPlayer(1);
        }
      } else { // cooldown
        p.x += nx * e.spd * 0.5 * dt; p.z += nz * e.spd * 0.5 * dt;
        e.ch.obj.rotation.y = Math.atan2(nx, nz);
        if (e.aoeT <= 0) { e.aoe = 'walk'; e.aoeT = 0.8; if (e.ch.current !== 'walk') e.ch.play('walk', false, e.animSpeed); }
      }
    } else {
      // zumbi / esqueleto / orc: perseguição direta
      p.x += nx * e.spd * dt; p.z += nz * e.spd * dt;
      e.ch.obj.rotation.y = Math.atan2(nx, nz);
    }

    // separação entre inimigos
    for (const o of enemies) {
      if (o === e || !o.alive || o.dying) continue;
      const ox = p.x - o.ch.obj.position.x, oz = p.z - o.ch.obj.position.z;
      const od = Math.hypot(ox, oz);
      const min = e.def.radius + o.def.radius;
      if (od > 0.01 && od < min) {
        p.x += (ox / od) * (min - od) * 2.4 * dt;
        p.z += (oz / od) * (min - od) * 2.4 * dt;
      }
    }

    // limites (fantasma atravessa)
    if (e.type !== 'ghost') {
      p.x = clamp(p.x, -BOUND_X, BOUND_X);
      p.z = clamp(p.z, -BOUND_Z, BOUND_Z);
    }

    // dano por contato
    const hidden = e.type === 'ghost' && e.phase !== 'visible';
    if (!hidden && dist < e.def.radius + 0.45 && e.attackCd <= 0) {
      e.attackCd = 1.1;
      e.ch.play('attack-melee-right', true, 1.6);
      hurtPlayer(1);
    }
  }

  // sala limpa → abre os portões
  if (!G.choosing && !G.transition && aliveCount === 0 && enemies.length === 0) roomCleared();

  // ---- portões e bênçãos ----
  for (const g of gates) {
    if (G.choosing && g.open < 1) {
      g.open = Math.min(1, g.open + dt * 1.4);
      if (g.door) g.door.position.y = g.open * 0.62;
    }
    if (g.icon) {
      g.icon.position.y = 1.8 + Math.sin(time * 2.6 + g.x) * 0.16;
      if (G.choosing && Math.hypot(G.px - g.x, G.pz - (-6.0)) < 1.3) chooseGate(g);
    }
  }

  // ---- baú ----
  if (chest && !chest.open && Math.hypot(G.px - chest.x, G.pz - chest.z) < 1.4) {
    chest.open = true;
    AudioSys.play('chest', 0.8);
    dropCoins(chest.x, chest.z, randi(6, 10));
    burst(chest.x, 0.7, chest.z, 0xffd23e, 12, 3.5, 0.6);
  }
  if (chest && chest.open && chest.lid && chest.t < 1) {
    chest.t = Math.min(1, chest.t + dt * 3);
    chest.lid.rotation.x = -chest.t * 1.15;
  }

  // ---- armadilhas ----
  for (const t of traps) {
    t.t -= dt;
    if (t.state === 'idle' && t.t <= 0) {
      t.state = 'tele'; t.t = 0.65;
      AudioSys.play('trap', 0.4, 1.3);
    } else if (t.state === 'tele') {
      if (t.spikes) t.spikes.position.y = -0.3 + 0.07 * Math.abs(Math.sin(time * 22));  // telegrafa
      if (t.t <= 0) {
        t.state = 'up'; t.t = 0.75; t.hitDone = false;
        if (t.spikes) t.spikes.position.y = 0;
        AudioSys.play('trap', 0.55, 0.95);
      }
    } else if (t.state === 'up') {
      if (!t.hitDone) {
        if (Math.hypot(G.px - t.x, G.pz - t.z) < 0.85) { hurtPlayer(1); t.hitDone = true; }
        for (const e of enemies) {
          if (!e.alive || e.dying || (e.type === 'ghost')) continue;
          const p = e.ch.obj.position;
          if (Math.hypot(p.x - t.x, p.z - t.z) < 0.85) {
            damageEnemy(e, 14 + G.depth * 2, false, 0, 0);
          }
        }
        t.hitDone = true;
      }
      if (t.t <= 0) { t.state = 'idle'; t.t = rand(2.2, 4.5); if (t.spikes) t.spikes.position.y = -0.3; }
    }
  }

  // ---- moedas ----
  for (let i = coinsLive.length - 1; i >= 0; i--) {
    const c = coinsLive[i];
    c.t += dt;
    c.m.rotation.y += 6 * dt;
    if (c.m.position.y > 0.25 || c.vy > 0) {
      c.vy -= 12 * dt;
      c.m.position.x += c.vx * dt;
      c.m.position.y = Math.max(0.25, c.m.position.y + c.vy * dt);
      c.m.position.z += c.vz * dt;
    }
    const dx = G.px - c.m.position.x, dz = G.pz - c.m.position.z;
    const d = Math.hypot(dx, dz);
    if (c.t > 0.4 && d < 2.4) {   // ímã
      c.m.position.x += (dx / d) * 8 * dt;
      c.m.position.z += (dz / d) * 8 * dt;
    }
    if (c.t > 0.4 && d < 0.62) {
      c.live = false; c.m.visible = false;
      coinsLive.splice(i, 1);
      G.gold++;
      if (Math.random() < 0.5) AudioSys.play('coin', 0.35, rand(0.95, 1.15));
      updateHUD();
    }
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
  initHero();
  initEnemyPool();
  initDmgPool();
  initParticles();
  initCoins();
  buildRoom(1);                    // sala visível atrás do menu
  hero.obj.position.set(SPAWN_POS.x, 0, SPAWN_POS.z);
  hero.obj.rotation.y = Math.PI;
  hero.play('idle');
  document.getElementById('loading').classList.add('hidden');
  AudioSys.playMusic('menu');
  tick();
}).catch(err => {
  console.error('Erro ao carregar modelos:', err);
  document.getElementById('loading').innerHTML = '<p class="story">Erro ao carregar modelos — veja o console.</p>';
});

// handle de testes
window.__PF = {
  get state() { return state; },
  get depth() { return G ? G.depth : 0; },
  get cleared() { return G ? G.cleared : 0; },
  get kills() { return G ? G.kills : 0; },
  get gold() { return G ? G.gold : 0; },
  get hp() { return G ? G.hp : 0; },
  get enemies() { return enemies.filter(e => e.alive && !e.dying).length; },
  get choosing() { return G ? G.choosing : false; },
  get models() { return Object.keys(LIB).length; },
  get fps() { return Math.round(fpsValue); },
  get over() { return G ? G.over : false; },
  killAll() {
    for (const e of [...enemies]) if (e.alive && !e.dying) damageEnemy(e, 99999, false, 0, 0);
  },
  hurt(n = 1) { if (G) G.iframes = 0; hurtPlayer(n); },
  setPos(x, z) { if (G) { G.px = x; G.pz = z; } },
  zoom(f = 1) { camZoom = f; },
  attack() { attack(); },
  list() {
    return enemies.map(e => ({
      t: e.type, x: +e.ch.obj.position.x.toFixed(1), z: +e.ch.obj.position.z.toFixed(1),
      aoe: e.aoe || null, wake: +(e.wake || 0).toFixed(2), dying: +(e.dying || 0).toFixed(2),
      anim: e.ch.current,
    }));
  },
};
