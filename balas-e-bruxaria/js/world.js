// ============================================================
// WORLD — vila, campos (overworld), masmorras, ciclo dia/noite
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from '../lib/loaders/GLTFLoader.js';

let ctx = null;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export const TILE = 2;
const DAY_LEN = 160;                    // segundos por ciclo completo

// ------------------------------------------------------------
// Modelos
// ------------------------------------------------------------
const MODELS = [
  // vila (Fantasy Town Kit)
  'town/wall', 'town/wall-door', 'town/wall-window-shutters', 'town/wall-window-glass',
  'town/wall-wood', 'town/wall-wood-door', 'town/wall-wood-window-shutters', 'town/wall-wood-window-glass',
  'town/roof', 'town/roof-gable', 'town/roof-gable-top', 'town/roof-gable-end', 'town/roof-point', 'town/roof-flat',
  'town/fountain-round-detail', 'town/fountain-center', 'town/lantern', 'town/cart', 'town/cart-high',
  'town/banner-red', 'town/banner-green', 'town/stall-red', 'town/stall-green', 'town/stall-bench',
  'town/stall', 'town/stall-stool',
  'town/tree', 'town/tree-high', 'town/hedge', 'town/fence', 'town/pillar-stone',
  'town/windmill', 'town/wheel', 'town/rock-small', 'town/chimney',
  // natureza (Nature Kit)
  'nature/tree_default', 'nature/tree_oak', 'nature/tree_pineDefaultA', 'nature/tree_pineRoundB',
  'nature/tree_thin', 'nature/tree_fat', 'nature/rock_largeA', 'nature/rock_largeC', 'nature/rock_tallB',
  'nature/stone_largeD', 'nature/flower_purpleA', 'nature/flower_redA', 'nature/flower_yellowA',
  'nature/grass_large', 'nature/plant_bushDetailed', 'nature/plant_bushSmall', 'nature/mushroom_redGroup', 'nature/stump_round',
  'nature/sign', 'nature/crops_cornStageC', 'nature/crops_wheatStageB', 'nature/crops_dirtRow',
  'nature/statue_head', 'nature/statue_column', 'nature/statue_obelisk',
  // cemitério (Graveyard Kit)
  'graveyard/gravestone-bevel', 'graveyard/gravestone-cross', 'graveyard/gravestone-round',
  'graveyard/gravestone-broken', 'graveyard/crypt', 'graveyard/crypt-large', 'graveyard/crypt-large-roof',
  'graveyard/coffin', 'graveyard/coffin-old', 'graveyard/candle', 'graveyard/candle-multiple',
  'graveyard/iron-fence', 'graveyard/iron-fence-damaged', 'graveyard/pillar-obelisk', 'graveyard/pillar-square',
  'graveyard/lantern-candle', 'graveyard/fire-basket', 'graveyard/pine', 'graveyard/pine-crooked',
  'graveyard/cross-wood', 'graveyard/debris', 'graveyard/urn-round', 'graveyard/bench-damaged',
  // masmorra (Mini Dungeon — vindo do Profundezas)
  'dungeon/floor', 'dungeon/floor-detail', 'dungeon/wall', 'dungeon/wall-narrow', 'dungeon/wall-opening',
  'dungeon/column', 'dungeon/banner', 'dungeon/barrel', 'dungeon/chest', 'dungeon/coin', 'dungeon/trap',
  'dungeon/gate', 'dungeon/stairs', 'dungeon/rocks', 'dungeon/weapon-sword', 'dungeon/weapon-spear',
  // personagens
  'dungeon/character-orc',
  'graveyard/character-zombie', 'graveyard/character-skeleton', 'graveyard/character-ghost',
  'graveyard/character-vampire', 'graveyard/character-keeper',
  'chars/character-a', 'chars/character-b', 'chars/character-c', 'chars/character-d',
  'chars/character-e', 'chars/character-f', 'chars/character-g', 'chars/character-h',
  'chars/character-i', 'chars/character-j', 'chars/character-k', 'chars/character-l',
  'chars/character-m', 'chars/character-n', 'chars/character-q', 'chars/character-r',
  // armas
  'weapons/sword-a', 'weapons/sword-b', 'weapons/sword-c', 'weapons/spear-a',
  'weapons/hammer-b', 'weapons/axe-double',
  'guns/pistol', 'guns/uzi', 'guns/machinegun', 'guns/shotgunShort',
];

const LIB = {};
const loader = new GLTFLoader();

function loadModel(path) {
  return new Promise((resolve, reject) => {
    loader.load('assets/models/' + path + '.glb', g => {
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        if (o.material && o.material.isMeshStandardMaterial && o.material.metalness > 0.5) {
          o.material.metalness = 0; o.material.roughness = 0.9;
        }
      });
      const box = new THREE.Box3().setFromObject(g.scene);
      LIB[path] = { scene: g.scene, animations: g.animations, size: box.getSize(new THREE.Vector3()) };
      resolve();
    }, undefined, reject);
  });
}

export function makeProp(path, scale = TILE) {
  const o = LIB[path].scene.clone(true);
  o.scale.setScalar(scale);
  return o;
}

// ------------------------------------------------------------
// Texturas de chão (canvas)
// ------------------------------------------------------------
function groundTexture(base, speck, n = 90) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < n; i++) {
    x.fillStyle = speck[i % speck.length];
    x.globalAlpha = rand(0.18, 0.5);
    const s = rand(2, 7);
    x.fillRect(rand(0, 128), rand(0, 128), s, s * rand(0.5, 1.5));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

// ------------------------------------------------------------
// Estado das áreas
// ------------------------------------------------------------
const areas = {};      // key -> {group, colliders:[], rects:[], portals:[], inter:[], bounds, outdoor, spawn}
let curArea = 'vila';
let dayT = 0.28;       // 0=alvorada · 0.25=meio-dia · 0.5=anoitecer · 0.75=meia-noite
let time = 0;
let sun, hemi, lampLights = [], torchPool = [];
const clouds = [], birds = [];
let river = null, riverBase = null, fountainWater = null;
let chirpT = 6;

// masmorras
export const DUNGEONS = [
  { key: 'd1', nome: 'Cripta do Barão Sanguessuga', boss: 0, rooms: 3, theme: 'cripta',
    enemies: ['zombie', 'zombie', 'ghost'], entry: { x: -42, z: -19 }, hpMul: 1 },
  { key: 'd2', nome: 'Forte do Warchefe Gruk', boss: 1, rooms: 4, theme: 'forte',
    enemies: ['skeleton', 'skeleton', 'orc'], entry: { x: 40, z: -23 }, hpMul: 1.5 },
  { key: 'd3', nome: 'Catacumba do Guardião Cego', boss: 2, rooms: 4, theme: 'cata',
    enemies: ['zombie', 'skeleton', 'vampire', 'ghost'], entry: { x: 36, z: 29 }, hpMul: 2.1, traps: true },
];
const DCOLS = 11, DROWS = 9;           // sala 11×9 tiles · centro na coluna 5
const ROOM_SPAN = (DROWS - 1) * TILE;  // 16 un entre linhas de parede
const dstate = {};                     // key -> {rooms:[{locked,cleared}], gates:[], traps:[], exitPortal}

// ------------------------------------------------------------
// WORLD API
// ------------------------------------------------------------
export const WORLD = {
  LIB, makeProp, TILE,
  get area() { return curArea; },
  get dayT() { return dayT; },
  get outdoor() { return areas[curArea] && areas[curArea].outdoor; },
  get areas() { return areas; },

  init(c) { ctx = c; },

  loadAll(onProgress) {
    let done = 0;
    return Promise.all(MODELS.map(m => loadModel(m).then(() => {
      done++;
      if (onProgress) onProgress(done / MODELS.length);
    })));
  },

  buildAll() {
    setupLights();
    buildVila();
    buildCampo();
    DUNGEONS.forEach((d, i) => buildDungeon(d, i));
    buildClouds();
    buildBirds();
    for (const k of Object.keys(areas)) areas[k].group.visible = false;
  },

  addTo(areaKey, obj) { areas[areaKey].group.add(obj); },

  setArea(key) {
    for (const k of Object.keys(areas)) areas[k].group.visible = (k === key);
    curArea = key;
    const a = areas[key];
    if (a.outdoor) applyDayLight(true);
    else applyDungeonLight(key);
    if (key.startsWith('d')) resetDungeonVisit(key);
    return { ...a.spawn };
  },

  // resolve colisões de círculos e retângulos da área atual
  collide(x, z, r = 0.45) {
    const a = areas[curArea];
    if (!a) return { x, z };
    const b = a.bounds;
    x = clamp(x, b.x1 + r, b.x2 - r);
    z = clamp(z, b.z1 + r, b.z2 - r);
    for (const c of a.colliders) {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
      if (d > 0.001 && d < m) { x = c.x + dx / d * m; z = c.z + dz / d * m; }
    }
    for (const rc of a.rects) {
      const nx = clamp(x, rc.x1, rc.x2), nz = clamp(z, rc.z1, rc.z2);
      const dx = x - nx, dz = z - nz, d = Math.hypot(dx, dz);
      if (d < r) {
        if (d > 0.001) { x = nx + dx / d * r; z = nz + dz / d * r; }
        else {
          // dentro do retângulo: expulsa pelo lado mais próximo
          const dists = [Math.abs(x - rc.x1), Math.abs(rc.x2 - x), Math.abs(z - rc.z1), Math.abs(rc.z2 - z)];
          const mi = dists.indexOf(Math.min(...dists));
          if (mi === 0) x = rc.x1 - r; else if (mi === 1) x = rc.x2 + r;
          else if (mi === 2) z = rc.z1 - r; else z = rc.z2 + r;
        }
      }
    }
    if (curArea.startsWith('d')) {
      const res = clampDungeon(curArea, x, z, r);
      x = res.x; z = res.z;
    }
    return { x, z };
  },

  portals() { return areas[curArea].portals; },
  interactables() { return areas[curArea].inter; },
  removeInter(it) {
    const arr = areas[curArea].inter;
    const i = arr.indexOf(it);
    if (i >= 0) arr.splice(i, 1);
    if (it.obj) it.obj.visible = false;
  },

  update(dt, playing) {
    time += dt;
    const a = areas[curArea];
    // ciclo dia/noite
    if (playing && a && a.outdoor) dayT = (dayT + dt / DAY_LEN) % 1;
    if (a && a.outdoor) {
      applyDayLight();
      updateClouds(dt);
      updateBirds(dt);
      // passarinhos de dia
      chirpT -= dt;
      if (chirpT <= 0) {
        chirpT = rand(5, 14);
        if (daylight() > 0.45 && AudioSys.chirp) AudioSys.chirp();
      }
    }
    // água
    if (river && curArea === 'campo') {
      const pos = river.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, 0.1 * Math.sin(time * 2.1 + riverBase[i] * 0.55) + 0.05 * Math.sin(time * 3.3 + riverBase[i * 2 % pos.count] * 0.3));
      }
      pos.needsUpdate = true;
      river.geometry.computeVertexNormals();
    }
    if (fountainWater && curArea === 'vila') {
      fountainWater.material.opacity = 0.7 + 0.08 * Math.sin(time * 2.4);
      fountainWater.position.y = 1.04 + 0.025 * Math.sin(time * 3);
    }
    // tochas tremulam
    for (const t of torchPool) {
      if (!t.grp.visible) continue;
      const f = 0.78 + 0.3 * Math.sin(time * 9 + t.seed) * Math.sin(time * 13.7 + t.seed * 2);
      t.light.intensity = t.baseI * clamp(f, 0.55, 1.15);
      t.flame.scale.set(1.1 + 0.14 * Math.sin(time * 11 + t.seed), 1.4 + 0.22 * Math.sin(time * 8.4 + t.seed), 1);
    }
    if (playing && curArea.startsWith('d')) dungeonUpdate(dt);
    // ímãs/flutuação de marcadores de portal
    for (const p of (a ? a.portals : [])) {
      if (p.disc) { p.disc.rotation.z += dt * 0.8; p.disc.material.opacity = 0.5 + 0.2 * Math.sin(time * 2.5 + p.x); }
    }
  },

  // ---- masmorras ----
  dungeonIndex() { return curArea.startsWith('d') ? parseInt(curArea[1], 10) - 1 : -1; },
  roomOf(z) { return clamp(Math.floor((8 - z + 1) / ROOM_SPAN), 0, 9); },
  gotoBossRoom(n) {                     // usado por __BB e testes
    const d = DUNGEONS[n];
    const st = dstate[d.key];
    st.rooms.forEach((r, i) => { if (i < d.rooms - 1) { r.cleared = true; r.locked = false; } });
    st.gates.forEach(g => g.targetOpen = true);
    return { x: 0, z: -(d.rooms - 1) * ROOM_SPAN + 6 };
  },
  onBossDead(n) {
    const d = DUNGEONS[n];
    const st = dstate[d.key];
    const room = st.rooms[d.rooms - 1];
    room.cleared = true; room.locked = false;
    st.gates.forEach(g => g.targetOpen = true);
    spawnExitPortal(d, n);
    ctx.game.setMusic('dungeon');
    AudioSys.play('door', 0.8);
  },
  bossArenaCenter(n) { return { x: 0, z: -(DUNGEONS[n].rooms - 1) * ROOM_SPAN }; },

  sun() { return sun; },
  setDayT(t) { dayT = ((t % 1) + 1) % 1; if (areas[curArea] && areas[curArea].outdoor) applyDayLight(true); },
  daylight,
};

// ------------------------------------------------------------
// Luzes globais
// ------------------------------------------------------------
function setupLights() {
  hemi = new THREE.HemisphereLight(0xbfd8f8, 0x4a5a3a, 0.9);
  ctx.scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff2d8, 0.95);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0008;
  ctx.scene.add(sun);
  ctx.scene.add(sun.target);
}

function daylight() {
  // 1 = dia pleno, 0 = noite
  return clamp(Math.sin((dayT + 0.05) * Math.PI * 2) * 1.6 + 0.5, 0, 1);
}

const skyDay = new THREE.Color(0x9ec8ee), skyDusk = new THREE.Color(0xd8865a), skyNight = new THREE.Color(0x141228);
const tmpC = new THREE.Color();
function skyColor() {
  const dl = daylight();
  const duskiness = clamp(1 - Math.abs(dl - 0.35) / 0.3, 0, 1);
  tmpC.copy(skyNight).lerp(skyDay, dl);
  tmpC.lerp(skyDusk, duskiness * 0.55);
  return tmpC;
}

function applyDayLight(force) {
  const dl = daylight();
  const sky = skyColor();
  ctx.scene.background = ctx.scene.background || new THREE.Color();
  ctx.scene.background.copy(sky);
  if (!ctx.scene.fog) ctx.scene.fog = new THREE.Fog(0x000000, 30, 95);
  ctx.scene.fog.color.copy(sky);
  ctx.scene.fog.near = 34; ctx.scene.fog.far = 110;
  hemi.intensity = 0.38 + dl * 0.62;
  hemi.color.setHex(0xbfd8f8).lerp(new THREE.Color(0x5a5a9a), 1 - dl);
  sun.intensity = 0.18 + dl * 0.85;
  sun.color.setHex(dl > 0.4 ? 0xfff2d8 : 0x9aa8e8);
  const ang = (dayT - 0.0) * Math.PI * 2;
  const hx = ctx.hero ? ctx.hero.x : 0, hz = ctx.hero ? ctx.hero.z : 0;
  sun.position.set(hx + Math.cos(ang) * 18, 14 + Math.sin(ang) * 10 + 8, hz + 9);
  sun.target.position.set(hx, 0, hz);
  // lampiões acendem à noite
  const lamp = clamp((0.42 - dl) / 0.42, 0, 1);
  for (const l of lampLights) l.intensity = l.baseI * lamp;
}

function applyDungeonLight(key) {
  const theme = DUNGEONS[parseInt(key[1], 10) - 1].theme;
  const cols = { cripta: [0x0c0a14, 0x6a5a9a, 0x2a1c2a], forte: [0x140e0a, 0x8a7a5a, 0x3a2418], cata: [0x0a0e10, 0x5a8a8a, 0x1a2a28] }[theme];
  ctx.scene.background = ctx.scene.background || new THREE.Color();
  ctx.scene.background.setHex(cols[0]);
  if (!ctx.scene.fog) ctx.scene.fog = new THREE.Fog(cols[0], 16, 42);
  ctx.scene.fog.color.setHex(cols[0]);
  ctx.scene.fog.near = 17; ctx.scene.fog.far = 46;
  hemi.intensity = 0.55;
  hemi.color.setHex(cols[1]);
  sun.intensity = 0.32;
  sun.color.setHex(0xbfb0e8);
  for (const l of lampLights) l.intensity = 0;
}

// ------------------------------------------------------------
// Tochas (pool — reposicionadas por sala)
// ------------------------------------------------------------
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
let flameTex = null;
function makeTorch() {
  flameTex = flameTex || flameTexture();
  const grp = new THREE.Group();
  const light = new THREE.PointLight(0xff9040, 14, 11, 1.9);
  grp.add(light);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  flame.scale.set(1.1, 1.4, 1);
  grp.add(flame);
  const t = { grp, light, flame, baseI: 14, seed: rand(0, 99) };
  torchPool.push(t);
  grp.visible = false;
  ctx.scene.add(grp);
  return t;
}

// ------------------------------------------------------------
// Lampião com luz (vila)
// ------------------------------------------------------------
function makeLamp(group, x, z) {
  const m = makeProp('town/lantern');
  m.position.set(x, 0, z);
  group.add(m);
  const l = new THREE.PointLight(0xffa850, 0, 10, 1.8);
  l.position.set(x, 2.6, z);
  l.baseI = 14;
  group.add(l);
  lampLights.push(l);
  return { x, z, r: 0.35 };
}

// ------------------------------------------------------------
// Casa modular (Fantasy Town)
// ------------------------------------------------------------
function makeHouse(w, d, opts = {}) {
  const g = new THREE.Group();
  const pre = opts.wood ? 'town/wall-wood' : 'town/wall';
  const wallH = LIB['town/wall'].size.y;
  const doorI = opts.doorI != null ? opts.doorI : Math.floor(w / 2);
  // paredes do perímetro, viradas para fora
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < d; j++) {
      const edges = [];
      if (j === d - 1) edges.push([0, 1, 0]);              // sul (+z) — frente
      if (j === 0) edges.push([0, -1, Math.PI]);           // norte
      if (i === 0) edges.push([-1, 0, Math.PI / 2]);       // oeste
      if (i === w - 1) edges.push([1, 0, -Math.PI / 2]);   // leste
      for (const [ex, ez, ry] of edges) {
        let name = pre;
        const front = ez === 1;
        if (front && i === doorI) name = pre + '-door';
        else if (Math.random() < 0.45) name = pre + (Math.random() < 0.6 ? '-window-shutters' : '-window-glass');
        const m = makeProp(name, 1);
        m.position.set(i - (w - 1) / 2 + ex * 0.0, 0, j - (d - 1) / 2 + ez * 0.0);
        m.rotation.y = ry;
        g.add(m);
      }
    }
  }
  // telhado de duas águas ao longo do eixo X
  for (let i = 0; i < w; i++) {
    if (d === 1) {
      const r = makeProp('town/roof-point', 1);
      r.position.set(i - (w - 1) / 2, wallH, 0);
      g.add(r);
      continue;
    }
    for (let j = 0; j < d; j++) {
      const south = j >= d / 2;
      const isEnd = i === 0 || i === w - 1;
      const name = isEnd ? 'town/roof-gable' : 'town/roof';
      const m = makeProp(name, 1);
      m.position.set(i - (w - 1) / 2, wallH, j - (d - 1) / 2);
      m.rotation.y = south ? 0 : Math.PI;
      g.add(m);
    }
  }
  if (opts.chimney) {
    const c = makeProp('town/chimney', 1);
    c.position.set((w - 1) / 2 - 0.5, wallH + 0.6, 0);
    g.add(c);
  }
  g.scale.setScalar(TILE);
  return g;
}

function houseAt(area, x, z, w, d, opts = {}) {
  const h = makeHouse(w, d, opts);
  h.position.set(x, 0, z);
  if (opts.flip) h.rotation.y = Math.PI;
  areas[area].group.add(h);
  // colisor retangular (com folga)
  const hw = w * TILE / 2 + 0.3, hd = d * TILE / 2 + 0.3;
  areas[area].rects.push({ x1: x - hw, x2: x + hw, z1: z - hd, z2: z + hd });
  if (opts.banner) {
    const b = makeProp('town/banner-' + opts.banner);
    b.position.set(x - w, 2.4, z + d * TILE / 2 + 0.1 * (opts.flip ? -1 : 1));
    areas[area].group.add(b);
  }
  return h;
}

// ------------------------------------------------------------
// VILA DE PEDERNEIRA
// ------------------------------------------------------------
function buildVila() {
  const group = new THREE.Group();
  ctx.scene.add(group);
  const A = areas.vila = {
    group, colliders: [], rects: [], portals: [], inter: [],
    bounds: { x1: -27, x2: 27, z1: -22, z2: 23 },
    outdoor: true, spawn: { x: 0, z: 14 }, nome: 'Vila de Pederneira',
  };

  // chão
  const grassTex = groundTexture('#5d9c4a', ['#4f8c3e', '#6aac56', '#558e44']);
  grassTex.repeat.set(18, 16);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(58, 50), new THREE.MeshLambertMaterial({ map: grassTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  // praça
  const plazaTex = groundTexture('#c4a878', ['#b49868', '#d4b888', '#ba9e6e'], 130);
  plazaTex.repeat.set(6, 6);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(9.5, 36), new THREE.MeshLambertMaterial({ map: plazaTex }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.012;
  plaza.receiveShadow = true;
  group.add(plaza);
  // caminhos
  for (const [px, pz, pw, ph] of [[0, 16, 4, 14], [0, -15, 4, 12], [-17, 0, 17, 3.4], [17, 0, 17, 3.4]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshLambertMaterial({ map: plazaTex, transparent: true, opacity: 0.85 }));
    p.rotation.x = -Math.PI / 2;
    p.position.set(px, 0.01, pz);
    p.receiveShadow = true;
    group.add(p);
  }

  // chafariz central
  const f = makeProp('town/fountain-round-detail', TILE * 0.95);
  f.position.set(0, 0, 0);
  group.add(f);
  A.colliders.push({ x: 0, z: 0, r: 2.2 });
  fountainWater = new THREE.Mesh(
    new THREE.CircleGeometry(1.3, 24),
    new THREE.MeshPhongMaterial({ color: 0x4f9fdf, transparent: true, opacity: 0.75, shininess: 130, specular: 0xaaccff })
  );
  fountainWater.rotation.x = -Math.PI / 2;
  fountainWater.position.set(0, 0.52, 0);
  group.add(fountainWater);
  const fc = makeProp('town/fountain-center', TILE * 0.95);
  fc.position.set(0, 0.25, 0);
  group.add(fc);

  // enfeites da praça: flores, arbustos e bancos no anel
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.31;
    const d = 7.6;
    const px = Math.sin(a) * d, pz = Math.cos(a) * d;
    if (Math.abs(px) < 2.6 || Math.abs(pz) < 2.6) continue;   // não bloqueia os caminhos
    const m = makeProp(pick(['nature/flower_redA', 'nature/flower_yellowA', 'nature/flower_purpleA', 'nature/plant_bushSmall']), TILE);
    m.position.set(px, 0, pz);
    m.rotation.y = rand(0, 6.3);
    group.add(m);
  }
  for (const [bx2, bz2, br2] of [[-4.2, -3.4, 2.2], [4.2, 3.4, -0.9]]) {
    const b2 = makeProp('town/stall-bench');
    b2.position.set(bx2, 0, bz2);
    b2.rotation.y = br2;
    group.add(b2);
  }

  // casas
  houseAt('vila', -15.5, -13.5, 3, 2, { doorI: 1, chimney: true });                 // forja
  houseAt('vila', 15.5, -13.5, 3, 2, { wood: true, doorI: 1 });                     // empório
  houseAt('vila', -16, 12.5, 4, 3, { doorI: 2, flip: true, chimney: true });        // taberna
  houseAt('vila', 16.5, 12.5, 3, 3, { doorI: 1, flip: true });                      // prefeitura
  houseAt('vila', 0, -19, 3, 2, { wood: true });
  houseAt('vila', -24.5, 0, 2, 2, {});
  houseAt('vila', 24.5, 0, 2, 2, { wood: true });

  // bancas das lojas
  const st1 = makeProp('town/stall-red'); st1.position.set(-11.8, 0, -11.4); st1.rotation.y = 0.3; group.add(st1);
  A.colliders.push({ x: -11.8, z: -11.4, r: 1.5 });
  const st2 = makeProp('town/stall-green'); st2.position.set(11.8, 0, -11.4); st2.rotation.y = -0.3; group.add(st2);
  A.colliders.push({ x: 11.8, z: -11.4, r: 1.5 });
  // armas expostas na banca da forja
  for (const [wm, wx, wz, wr, ws] of [['weapons/sword-b', -11.3, -11.2, 0.8, 0.55], ['guns/pistol', -12.4, -11.5, -0.6, 1.6]]) {
    const w = makeProp(wm, ws);
    w.position.set(wx, 1.18, wz);
    w.rotation.set(Math.PI / 2, wr, 0);
    group.add(w);
  }

  // carroças, bancos, decoração
  const cart = makeProp('town/cart'); cart.position.set(7.5, 0, 7.5); cart.rotation.y = 0.9; group.add(cart);
  A.colliders.push({ x: 7.5, z: 7.5, r: 1.8 });
  const cart2 = makeProp('town/cart-high'); cart2.position.set(-8, 0, -16.5); cart2.rotation.y = -1.2; group.add(cart2);
  A.colliders.push({ x: -8, z: -16.5, r: 1.8 });
  const bench = makeProp('town/stall-bench'); bench.position.set(4.5, 0, -7); bench.rotation.y = 0.5; group.add(bench);

  // bandeiras nas fachadas das casas
  for (const [bx, bz, br, bc] of [
    [-14, -11.4, 0, 'red'], [-17.6, -11.4, 0, 'red'],       // forja
    [14, -11.4, 0, 'green'], [17.6, -11.4, 0, 'green'],     // empório
    [14.5, 9.4, Math.PI, 'red'], [18.5, 9.4, Math.PI, 'red'],  // prefeitura
  ]) {
    const fl = makeProp('town/banner-' + bc, TILE);
    fl.position.set(bx, 2.1, bz);
    fl.rotation.y = br;
    group.add(fl);
  }

  // lampiões
  for (const [lx, lz] of [[-4, -4.6], [4, 4.6], [-4, 4.6], [4, -4.6], [-10, 14], [10, 14], [0, -12.5]]) {
    A.colliders.push(makeLamp(group, lx, lz));
  }

  // árvores e cercas
  for (const [tx, tz] of [[-21, -17], [21, -17], [-25, 17], [25, 17], [-9, 18.5], [9, 18.5], [22, 6], [-22, 6]]) {
    const t = makeProp(Math.random() < 0.5 ? 'town/tree' : 'town/tree-high', TILE * rand(1, 1.3));
    t.position.set(tx, 0, tz);
    t.rotation.y = rand(0, Math.PI * 2);
    group.add(t);
    A.colliders.push({ x: tx, z: tz, r: 0.7 });
  }
  for (let i = -5; i <= 5; i++) {
    if (Math.abs(i) <= 1) continue;     // portão sul
    const fc = makeProp('town/fence');
    fc.position.set(i * 2.4, 0, 22.6);
    group.add(fc);
  }
  A.rects.push({ x1: -27, x2: -2.8, z1: 22.2, z2: 23 });
  A.rects.push({ x1: 2.8, x2: 27, z1: 22.2, z2: 23 });

  // baú escondido atrás da taberna
  const chest = makeProp('dungeon/chest', TILE * 0.9);
  chest.position.set(-22.5, 0, 16.8);
  chest.rotation.y = 2.4;
  group.add(chest);
  A.inter.push({
    x: -22.5, z: 16.8, r: 1.6, label: 'Abrir baú', icon: '🧰', obj: chest, once: true,
    fn: () => {
      AudioSys.play('chest', 0.8);
      const lid = chest.getObjectByName('lid');
      if (lid) lid.rotation.x = -1.1;
      ctx.rpg.addGold(60);
      ctx.rpg.giveItem('pocao-vida');
      ctx.ui.toast('🧰 Baú escondido! +🪙60, Poção de Vida');
      ctx.ent.burstAt(-22.5, 1, 16.8, 0xffd23e, 14);
    },
  });

  // portal para os campos
  addPortal('vila', 0, 22, 'Campos de Pederneira', 'campo', { x: 0, z: -37 }, 0x7ad8a0);
  // placa
  const sg = makeProp('nature/sign', TILE);
  sg.position.set(2.6, 0, 21);
  sg.rotation.y = Math.PI;
  group.add(sg);
  A.inter.push({ x: 2.6, z: 21, r: 1.6, label: 'Ler placa', icon: '🪧', fn: () => ctx.ui.openSign('«Campos de Pederneira — cuidado com tudo o que se mexe. E com parte do que não se mexe.»') });
}

function addPortal(area, x, z, label, to, spawn, color) {
  const A = areas[area];
  const disc = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.5, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(x, 0.06, z);
  A.group.add(disc);
  A.portals.push({ x, z, r: 1.7, label, to, spawn, disc });
}

// ------------------------------------------------------------
// CAMPOS (overworld)
// ------------------------------------------------------------
function buildCampo() {
  const group = new THREE.Group();
  ctx.scene.add(group);
  const A = areas.campo = {
    group, colliders: [], rects: [], portals: [], inter: [],
    bounds: { x1: -49, x2: 49, z1: -41, z2: 41 },
    outdoor: true, spawn: { x: 0, z: -37 }, nome: 'Campos de Pederneira',
  };

  const grassTex = groundTexture('#5b9a48', ['#4d8a3c', '#68a854', '#7ab258', '#538c42']);
  grassTex.repeat.set(30, 26);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(104, 88), new THREE.MeshLambertMaterial({ map: grassTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ---- rio (x ≈ 14) com ponte em z ∈ [-1, 5] ----
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 88), new THREE.MeshLambertMaterial({ color: 0x2a4a66 }));
  bed.rotation.x = -Math.PI / 2;
  bed.position.set(14, 0.02, 0);
  group.add(bed);
  const rg = new THREE.PlaneGeometry(7.4, 88, 5, 44);
  rg.rotateX(-Math.PI / 2);
  riverBase = [];
  const rpos = rg.attributes.position;
  for (let i = 0; i < rpos.count; i++) riverBase.push(rpos.getZ(i));
  river = new THREE.Mesh(rg, new THREE.MeshPhongMaterial({
    color: 0x3f8fd9, transparent: true, opacity: 0.8, shininess: 150, specular: 0xbBddff, side: THREE.DoubleSide,
  }));
  river.position.set(14, 0.16, 0);
  group.add(river);
  A.rects.push({ x1: 10.4, x2: 17.6, z1: -42, z2: -1 });
  A.rects.push({ x1: 10.4, x2: 17.6, z1: 5, z2: 42 });

  // ponte: deque + corrimãos
  const deckTex = groundTexture('#9a7444', ['#8a6438', '#aa8450'], 60);
  deckTex.repeat.set(4, 2);
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 5.4), new THREE.MeshLambertMaterial({ map: deckTex }));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(14, 0.3, 2);
  deck.receiveShadow = true;
  group.add(deck);
  for (const dz of [-0.6, 4.6]) {
    for (let i = 0; i < 4; i++) {
      const fc = makeProp('town/fence');
      fc.position.set(10.6 + i * 2.35, 0.3, dz);
      group.add(fc);
    }
  }
  A.rects.push({ x1: 10, x2: 18.2, z1: -1.1, z2: -0.4 });
  A.rects.push({ x1: 10, x2: 18.2, z1: 4.4, z2: 5.1 });

  // flores-do-rio (coletáveis)
  const flowerSpots = [[9.2, -8], [9.4, 12], [18.6, -14], [18.4, 8], [9.0, 22], [18.8, 24], [9.3, -22], [18.5, -27]];
  for (const [fx, fz] of flowerSpots) {
    const fl = makeProp('nature/flower_purpleA', TILE * 1.2);
    fl.position.set(fx, 0, fz);
    fl.rotation.y = rand(0, 6);
    group.add(fl);
    A.inter.push({
      x: fx, z: fz, r: 1.5, label: 'Colher flor-do-rio', icon: '🌸', obj: fl, once: true,
      fn: () => {
        AudioSys.play('coin', 0.6, 1.3);
        ctx.rpg.giveItem('flor-do-rio');
        ctx.rpg.questEvent('collect', { item: 'flor-do-rio' });
        ctx.ui.toast('🌸 Flor-do-rio colhida (' + ctx.rpg.countItem('flor-do-rio') + ')');
        ctx.ent.burstAt(fx, 0.8, fz, 0xd88aff, 8);
      },
    });
  }

  // ---- fazenda do Bento ----
  const wind = makeProp('town/windmill', TILE * 1.6);
  wind.position.set(-36, 0, 14);
  wind.rotation.y = 0.8;
  group.add(wind);
  A.colliders.push({ x: -36, z: 14, r: 2.6 });
  for (let cx = 0; cx < 4; cx++) {
    for (let cz = 0; cz < 3; cz++) {
      const dirt = makeProp('nature/crops_dirtRow', TILE);
      dirt.position.set(-31 + cx * 2.1, 0, 20 + cz * 2.4);
      group.add(dirt);
      const crop = makeProp(cz === 1 ? 'nature/crops_wheatStageB' : 'nature/crops_cornStageC', TILE);
      crop.position.set(-31 + cx * 2.1, 0.05, 20 + cz * 2.4);
      group.add(crop);
    }
  }
  for (let i = 0; i < 5; i++) {
    const fc = makeProp('town/fence');
    fc.position.set(-33 + i * 2.35, 0, 17.6);
    group.add(fc);
  }

  // ---- entradas das masmorras ----
  // d1: cripta (oeste)
  const cr = makeProp('graveyard/crypt-large', TILE * 1.3);
  cr.position.set(-43, 0, -27);
  group.add(cr);
  const crr = makeProp('graveyard/crypt-large-roof', TILE * 1.3);
  crr.position.set(-43, LIB['graveyard/crypt-large'].size.y * TILE * 1.3, -27);
  group.add(crr);
  A.rects.push({ x1: -47.5, x2: -38.5, z1: -31, z2: -23.5 });
  for (const [gx, gz, gm] of [[-38, -21, 'gravestone-cross'], [-46, -20, 'gravestone-bevel'], [-39.5, -16.5, 'gravestone-round'], [-45, -15, 'gravestone-broken'], [-36, -17, 'cross-wood']]) {
    const gs = makeProp('graveyard/' + gm, TILE * 0.9);
    gs.position.set(gx, 0, gz);
    gs.rotation.y = rand(-0.4, 0.4);
    group.add(gs);
    A.colliders.push({ x: gx, z: gz, r: 0.55 });
  }
  for (const [px2, pz2] of [[-47, -21], [-37.5, -25]]) {
    const pn = makeProp('graveyard/pine-crooked', TILE * 1.2);
    pn.position.set(px2, 0, pz2);
    group.add(pn);
    A.colliders.push({ x: px2, z: pz2, r: 0.8 });
  }
  addPortal('campo', -42, -19, 'Entrar: Cripta do Barão', 'd1', { x: 0, z: 6 }, 0xb08aff);
  addSign(A, group, -38.5, -19.5, '«Cripta do Barão Sanguessuga. Visitas: nunca. Saídas: raras.»');

  // d2: forte (leste, depois da ponte)
  for (const [cx2, cz2] of [[37.6, -27.5], [42.4, -27.5]]) {
    const col = makeProp('dungeon/column', TILE * 1.3);
    col.position.set(cx2, 0, cz2);
    group.add(col);
    A.colliders.push({ x: cx2, z: cz2, r: 0.8 });
  }
  const fgate = makeProp('dungeon/gate', TILE * 1.3);
  fgate.position.set(40, 0, -27.5);
  group.add(fgate);
  const fb = makeProp('dungeon/banner', TILE * 1.2);
  fb.position.set(40, 2.6, -27.2);
  group.add(fb);
  A.rects.push({ x1: 36.5, x2: 43.5, z1: -29, z2: -26.6 });
  addPortal('campo', 40, -23, 'Entrar: Forte do Gruk', 'd2', { x: 0, z: 6 }, 0xff9a4a);
  addSign(A, group, 36.5, -22, '«Forte do Warchefe Gruk. Toque a campainha. A campainha é um machado.»');

  // d3: catacumba (sudeste)
  const sh = makeProp('nature/statue_head', TILE * 1.6);
  sh.position.set(36, 0, 34.5);
  sh.rotation.y = Math.PI;
  group.add(sh);
  A.colliders.push({ x: 36, z: 34.5, r: 2.2 });
  for (const [ox, oz] of [[32.5, 31], [39.5, 31]]) {
    const ob = makeProp('nature/statue_column', TILE * 1.2);
    ob.position.set(ox, 0, oz);
    group.add(ob);
    A.colliders.push({ x: ox, z: oz, r: 0.7 });
  }
  addPortal('campo', 36, 29, 'Entrar: Catacumba do Guardião', 'd3', { x: 0, z: 6 }, 0x7ad8d8);
  addSign(A, group, 32, 27.5, '«Catacumba do Guardião Cego. Ele não vê você. Ele OUVE sua arma nova.»');

  // ---- portal de volta para a vila ----
  addPortal('campo', 0, -40, 'Vila de Pederneira', 'vila', { x: 0, z: 19 }, 0xffd23e);
  addSign(A, group, -3.4, -36, '«↑ Vila de Pederneira · ← Cripta · Forte → (pela ponte) · Catacumba ↘»');

  // ---- árvores e pedras espalhadas ----
  const treeKinds = ['nature/tree_default', 'nature/tree_oak', 'nature/tree_pineDefaultA', 'nature/tree_pineRoundB', 'nature/tree_thin', 'nature/tree_fat'];
  let placed = 0, guard = 0;
  while (placed < 46 && guard++ < 400) {
    const tx = rand(-47, 47), tz = rand(-39, 39);
    if (Math.abs(tx - 14) < 7) continue;                      // rio
    if (tx < -24 && tz > 10) continue;                        // fazenda
    if (Math.hypot(tx, tz + 38) < 8) continue;                // entrada vila
    if (Math.hypot(tx + 42, tz + 21) < 10) continue;          // cripta
    if (Math.hypot(tx - 40, tz + 25) < 9) continue;           // forte
    if (Math.hypot(tx - 36, tz - 31) < 9) continue;           // catacumba
    if (A.colliders.some(c => Math.hypot(c.x - tx, c.z - tz) < 3)) continue;
    const t = makeProp(pick(treeKinds), TILE * rand(1.1, 1.7));
    t.position.set(tx, 0, tz);
    t.rotation.y = rand(0, Math.PI * 2);
    group.add(t);
    A.colliders.push({ x: tx, z: tz, r: 0.75 });
    placed++;
  }
  for (let i = 0; i < 14; i++) {
    const rx = rand(-46, 46), rz = rand(-38, 38);
    if (Math.abs(rx - 14) < 7 || (rx < -24 && rz > 10)) continue;
    const r = makeProp(pick(['nature/rock_largeA', 'nature/rock_largeC', 'nature/rock_tallB', 'nature/stone_largeD']), TILE * rand(0.9, 1.5));
    r.position.set(rx, 0, rz);
    r.rotation.y = rand(0, Math.PI * 2);
    group.add(r);
    A.colliders.push({ x: rx, z: rz, r: 1.0 });
  }
  for (let i = 0; i < 26; i++) {
    const gx = rand(-47, 47), gz = rand(-39, 39);
    if (Math.abs(gx - 14) < 7) continue;
    const g2 = makeProp(pick(['nature/grass_large', 'nature/plant_bushDetailed', 'nature/flower_yellowA', 'nature/flower_redA', 'nature/mushroom_redGroup']), TILE * rand(0.8, 1.3));
    g2.position.set(gx, 0, gz);
    g2.rotation.y = rand(0, 6);
    group.add(g2);
  }
}

function addSign(A, group, x, z, texto) {
  const sg = makeProp('nature/sign', TILE);
  sg.position.set(x, 0, z);
  sg.rotation.y = Math.PI;
  group.add(sg);
  A.inter.push({ x, z, r: 1.6, label: 'Ler placa', icon: '🪧', fn: () => ctx.ui.openSign(texto) });
}

// ------------------------------------------------------------
// Nuvens low-poly com sombras móveis + pássaros
// ------------------------------------------------------------
function buildClouds() {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x666677 });
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x102010, transparent: true, opacity: 0.16, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const n = randi(3, 5);
    let w = 0;
    for (let j = 0; j < n; j++) {
      const s = rand(0.9, 1.7);
      const m = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 5), mat);
      m.position.set(j * 1.3 - n * 0.65, rand(-0.2, 0.4), rand(-0.7, 0.7));
      m.castShadow = false;
      g.add(m);
      w = Math.max(w, Math.abs(m.position.x) + s);
    }
    g.position.set(rand(-50, 50), rand(20, 26), rand(-38, 38));
    const sh = new THREE.Mesh(new THREE.CircleGeometry(w * 0.9, 14), shadowMat);
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(g.position.x, 0.07, g.position.z);
    areas.campo.group.add(g);
    areas.campo.group.add(sh);
    clouds.push({ g, sh, v: rand(0.5, 1.1) });
  }
}
function updateClouds(dt) {
  if (curArea !== 'campo') return;
  for (const c of clouds) {
    c.g.position.x += c.v * dt;
    if (c.g.position.x > 56) c.g.position.x = -56;
    c.sh.position.x = c.g.position.x;
    c.sh.material.opacity = 0.16 * daylight();
  }
}

function birdTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 32;
  const x = c.getContext('2d');
  x.strokeStyle = '#2a2a33'; x.lineWidth = 4; x.lineCap = 'round';
  x.beginPath(); x.moveTo(8, 22); x.quadraticCurveTo(20, 6, 32, 20); x.quadraticCurveTo(44, 6, 56, 22); x.stroke();
  return new THREE.CanvasTexture(c);
}
function buildBirds() {
  const tex = birdTexture();
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sp.scale.set(1.6, 0.8, 1);
    areas.campo.group.add(sp);
    birds.push({ sp, a: rand(0, 6), r: rand(10, 30), cx: rand(-30, 30), cz: rand(-25, 25), h: rand(9, 14), v: rand(0.2, 0.45) });
  }
}
function updateBirds(dt) {
  if (curArea !== 'campo') return;
  for (const b of birds) {
    b.a += b.v * dt;
    b.sp.position.set(b.cx + Math.cos(b.a) * b.r, b.h + Math.sin(time * 2 + b.r) * 0.6, b.cz + Math.sin(b.a) * b.r);
    b.sp.material.opacity = daylight();
  }
}

// ------------------------------------------------------------
// MASMORRAS
// ------------------------------------------------------------
function dTileX(c) { return (c - 5) * TILE; }

function buildDungeon(D, idx) {
  const group = new THREE.Group();
  ctx.scene.add(group);
  const totalRows = D.rooms * (DROWS - 1) + 1;
  const A = areas[D.key] = {
    group, colliders: [], rects: [], portals: [], inter: [],
    bounds: { x1: -9, x2: 9, z1: 8 - (totalRows - 1) * TILE - 1, z2: 9 },
    outdoor: false, spawn: { x: 0, z: 6 }, nome: D.nome,
  };
  const st = dstate[D.key] = { rooms: [], gates: [], traps: [], exitPortal: null, chests: [] };
  for (let i = 0; i < D.rooms; i++) st.rooms.push({ locked: false, cleared: false });

  // chão
  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < DCOLS; c++) {
      const fl = makeProp(Math.random() < 0.14 ? 'dungeon/floor-detail' : 'dungeon/floor');
      fl.position.set(dTileX(c), 0, 8 - r * TILE);
      fl.rotation.y = randi(0, 3) * Math.PI / 2;
      fl.traverse(o => { if (o.isMesh) o.castShadow = false; });
      group.add(fl);
    }
  }
  // paredes laterais contínuas
  for (let r = 0; r < totalRows; r++) {
    for (const c of [0, DCOLS - 1]) {
      const w = makeProp(Math.random() < 0.16 ? 'dungeon/wall-narrow' : 'dungeon/wall');
      w.position.set(dTileX(c), 0, 8 - r * TILE);
      w.rotation.y = c === 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(w);
    }
  }
  // linhas de parede transversais (k = 0..rooms) — abertura no centro (col 5)
  for (let k = 0; k <= D.rooms; k++) {
    const wz = 8 - k * ROOM_SPAN;
    const isEntry = k === 0, isEnd = k === D.rooms;
    for (let c = 1; c < DCOLS - 1; c++) {
      if (c === 5 && !isEnd) {
        const w = makeProp('dungeon/wall-opening');
        w.position.set(0, 0, wz);
        w.rotation.y = isEntry ? Math.PI : 0;
        group.add(w);
        continue;
      }
      const w = makeProp(Math.random() < 0.16 ? 'dungeon/wall-narrow' : 'dungeon/wall');
      w.position.set(dTileX(c), 0, wz);
      w.rotation.y = k === 0 ? Math.PI : 0;
      group.add(w);
    }
    // portão animável (não na entrada nem no fundo)
    if (!isEntry && !isEnd) {
      const g = makeProp('dungeon/gate');
      g.position.set(0, 0, wz + 0.4);
      group.add(g);
      st.gates.push({ obj: g, door: g.getObjectByName('door'), z: wz, open: 1, targetOpen: true, line: k });
    }
  }
  // colunas nos cantos de cada sala + banners
  for (let i = 0; i < D.rooms; i++) {
    const zc = -i * ROOM_SPAN;
    for (const [cc, rr] of [[1, 1], [DCOLS - 2, 1], [1, DROWS - 2], [DCOLS - 2, DROWS - 2]]) {
      if (Math.random() < 0.4 && D.theme !== 'forte') continue;
      const col = makeProp('dungeon/column', TILE * 1.02);
      col.position.set(dTileX(cc), 0, zc + 8 - rr * TILE);
      group.add(col);
      A.colliders.push({ x: dTileX(cc), z: zc + 8 - rr * TILE, r: 0.6 });
    }
  }
  // escada de entrada
  const stairs = makeProp('dungeon/stairs');
  stairs.position.set(0, 0, 7.2);
  stairs.rotation.y = Math.PI;
  group.add(stairs);

  // decoração temática por sala
  for (let i = 0; i < D.rooms; i++) decorateRoom(D, A, group, i, st);

  // baú do meio da masmorra
  const chestRoom = Math.max(1, D.rooms - 2);
  const cm = makeProp('dungeon/chest');
  const cx = pick([-1, 1]) * 6.8, cz = -chestRoom * ROOM_SPAN + rand(-3, 3);
  cm.position.set(cx, 0, cz);
  cm.rotation.y = Math.atan2(-cx, 0);
  group.add(cm);
  st.chests.push(A.inter[A.inter.length] = {
    x: cx, z: cz, r: 1.6, label: 'Abrir baú', icon: '🧰', obj: cm, once: true, dungeonChest: D.key,
    fn: () => {
      AudioSys.play('chest', 0.8);
      const lid = cm.getObjectByName('lid');
      if (lid) lid.rotation.x = -1.1;
      const gold = 40 + idx * 35 + randi(0, 25);
      ctx.rpg.addGold(gold);
      if (Math.random() < 0.6) { ctx.rpg.giveItem('pocao-vida'); ctx.ui.toast(`🧰 +🪙${gold} e uma Poção de Vida!`); }
      else { ctx.rpg.giveItem('pocao-mana'); ctx.ui.toast(`🧰 +🪙${gold} e uma Poção de Mana!`); }
      ctx.ent.burstAt(cx, 1, cz, 0xffd23e, 14);
    },
  });

  // portal de saída (sempre presente na entrada)
  addPortal(D.key, 0, 8.2, 'Sair para os campos', 'campo', { x: D.entry.x, z: D.entry.z + 3 }, 0x7ad8a0);
}

function decorateRoom(D, A, group, i, st) {
  const zc = -i * ROOM_SPAN;
  const edge = () => pick([-1, 1]) * rand(5.6, 7.4);
  const inner = () => rand(-5.5, 5.5);
  if (D.theme === 'cripta') {
    for (let n = 0; n < 4; n++) {
      const m = makeProp('graveyard/' + pick(['gravestone-bevel', 'gravestone-round', 'gravestone-broken', 'coffin-old', 'urn-round']), TILE * 0.85);
      const x = edge(), z = zc + rand(-5.5, 5.5);
      m.position.set(x, 0, z);
      m.rotation.y = rand(0, 6.3);
      group.add(m);
      A.colliders.push({ x, z, r: 0.5 });
    }
    const cd = makeProp('graveyard/candle-multiple', TILE);
    cd.position.set(inner(), 0, zc + inner());
    group.add(cd);
  } else if (D.theme === 'forte') {
    for (let n = 0; n < 3; n++) {
      const m = makeProp('dungeon/' + pick(['barrel', 'rocks', 'barrel']), TILE * rand(0.85, 1));
      const x = edge(), z = zc + rand(-5.5, 5.5);
      m.position.set(x, 0, z);
      m.rotation.y = rand(0, 6.3);
      group.add(m);
      A.colliders.push({ x, z, r: 0.55 });
    }
    for (const c of [2, 8]) {
      const b = makeProp('dungeon/banner');
      b.position.set(dTileX(c), 1.7, zc - 7.1);
      group.add(b);
    }
    const wp = makeProp('dungeon/' + pick(['weapon-sword', 'weapon-spear']), TILE);
    wp.position.set(edge(), 0.4, zc + inner());
    wp.rotation.z = Math.PI / 2.2;
    group.add(wp);
  } else {
    for (let n = 0; n < 3; n++) {
      const m = makeProp(pick(['graveyard/pillar-obelisk', 'graveyard/urn-round', 'graveyard/debris', 'graveyard/pillar-square']), TILE * 0.9);
      const x = edge(), z = zc + rand(-5.5, 5.5);
      m.position.set(x, 0, z);
      m.rotation.y = rand(0, 6.3);
      group.add(m);
      A.colliders.push({ x, z, r: 0.5 });
    }
    // armadilhas
    if (D.traps && i > 0) {
      for (let n = 0; n < 2; n++) {
        const tm = makeProp('dungeon/trap');
        const x = rand(-5, 5), z = zc + rand(-4, 4);
        tm.position.set(x, 0.02, z);
        group.add(tm);
        const spikes = tm.getObjectByName('spikes');
        if (spikes) spikes.position.y = -0.3;
        st.traps.push({ obj: tm, spikes, x, z, state: 'idle', t: rand(1.5, 4), hitDone: false });
      }
    }
  }
}

// trava z na linha de parede, exceto pela abertura central com portão aberto
function clampDungeon(key, x, z, r) {
  const idx = parseInt(key[1], 10) - 1;
  const D = DUNGEONS[idx];
  const st = dstate[key];
  for (let k = 0; k <= D.rooms; k++) {
    const wz = 8 - k * ROOM_SPAN;
    if (Math.abs(z - wz) < 1.1 + r) {
      const gate = st.gates.find(g => g.line === k);
      const openEnough = gate ? gate.open > 0.7 : true;
      const solid = k === D.rooms;                       // fundo da masmorra
      if (solid || Math.abs(x) > 1.1 || !openEnough) {
        z = wz + (z > wz ? 1 : -1) * (1.1 + r);
      }
    }
  }
  return { x, z };
}

function resetDungeonVisit(key) {
  const idx = parseInt(key[1], 10) - 1;
  const D = DUNGEONS[idx];
  const st = dstate[key];
  st.rooms.forEach((r, i) => {
    const bossRoom = i === D.rooms - 1;
    r.cleared = bossRoom && ctx.rpg.P && ctx.rpg.P.bossesDead[idx];
    r.locked = false;
  });
  st.gates.forEach(g => { g.targetOpen = true; g.open = 1; if (g.door) g.door.position.y = 0.62; });
  if (st.exitPortal) { /* permanece */ }
  // reabre baú da masmorra (farmável)
  const a = areas[key];
  for (const it of st.chests) if (!a.inter.includes(it)) { a.inter.push(it); if (it.obj) it.obj.visible = true; }
  // tochas para a sala 0
  curRoom = 0;
  placeTorches(0);
  ctx.ent.clearEnemies();
}

function placeTorches(roomIdx) {
  while (torchPool.length < 6) makeTorch();
  const zc = -roomIdx * ROOM_SPAN;
  const spots = [[-4, zc - 7], [4, zc - 7], [-8.6, zc - 2], [8.6, zc - 2], [-8.6, zc + 3], [8.6, zc + 3]];
  torchPool.forEach((t, i) => {
    if (i >= spots.length) { t.grp.visible = false; return; }
    t.grp.position.set(spots[i][0], 2.5, spots[i][1]);
    t.grp.visible = curArea.startsWith('d');
  });
}

let curRoom = 0;
function dungeonUpdate(dt) {
  const idx = parseInt(curArea[1], 10) - 1;
  const D = DUNGEONS[idx];
  const st = dstate[curArea];
  const hero = ctx.hero;
  if (!hero) return;
  const room = clamp(Math.floor((6.5 - hero.z) / ROOM_SPAN + 0.5), 0, D.rooms - 1);
  if (room !== curRoom) { curRoom = room; placeTorches(room); }

  const rst = st.rooms[room];
  const roomCenterZ = -room * ROOM_SPAN;
  // entrou fundo na sala → tranca e invoca
  if (!rst.cleared && !rst.locked && hero.z < roomCenterZ + 5.2) {
    rst.locked = true;
    st.gates.forEach(g => { g.targetOpen = false; });
    AudioSys.play('latch', 0.8);
    const isBoss = room === D.rooms - 1;
    if (isBoss) {
      ctx.ent.spawnBoss(idx, 0, roomCenterZ - 3);
      ctx.game.setMusic('boss');
    } else {
      const budget = 3 + room + idx * 2;
      let b = budget, guard = 0;
      while (b > 0 && guard++ < 20) {
        const t = pick(D.enemies);
        const cost = (t === 'orc' || t === 'vampire') ? 2 : 1;
        if (cost > b && b < 2) break;
        if (cost > b) continue;
        let ex, ez, ok = false, g2 = 0;
        while (!ok && g2++ < 12) {
          ex = rand(-7, 7); ez = roomCenterZ + rand(-6, 4);
          ok = Math.hypot(ex - hero.x, ez - hero.z) > 4;
        }
        if (ctx.ent.spawnEnemy(t, ex, ez, { hpMul: D.hpMul * (1 + room * 0.12) })) b -= cost;
        else break;
      }
      ctx.game.announce('SALA ' + (room + 1), 1200);
    }
  }
  // sala trancada limpa → destranca
  if (rst.locked && ctx.ent.enemiesAlive() === 0) {
    rst.locked = false;
    rst.cleared = true;
    st.gates.forEach(g => { g.targetOpen = true; });
    AudioSys.play('door', 0.8);
    if (room < D.rooms - 1) ctx.game.announce('SALA LIMPA!', 1100);
  }
  // anima portões
  for (const g of st.gates) {
    const want = g.targetOpen ? 1 : 0;
    if (g.open !== want) {
      g.open = clamp(g.open + (want > g.open ? dt : -dt) * 1.6, 0, 1);
      if (g.door) g.door.position.y = g.open * 0.62;
    }
  }
  // armadilhas
  for (const t of st.traps) {
    t.t -= dt;
    if (t.state === 'idle' && t.t <= 0) {
      t.state = 'tele'; t.t = 0.65;
      if (Math.hypot(hero.x - t.x, hero.z - t.z) < 12) AudioSys.play('trap', 0.4, 1.3);
    } else if (t.state === 'tele') {
      if (t.spikes) t.spikes.position.y = -0.3 + 0.07 * Math.abs(Math.sin(time * 22));
      if (t.t <= 0) {
        t.state = 'up'; t.t = 0.75; t.hitDone = false;
        if (t.spikes) t.spikes.position.y = 0;
        if (Math.hypot(hero.x - t.x, hero.z - t.z) < 12) AudioSys.play('trap', 0.55, 0.95);
      }
    } else if (t.state === 'up') {
      if (!t.hitDone) {
        if (Math.hypot(hero.x - t.x, hero.z - t.z) < 0.85) ctx.ent.hurtHero(10);
        ctx.ent.damageInCircle(t.x, t.z, 0.95, 20);
        t.hitDone = true;
      }
      if (t.t <= 0) { t.state = 'idle'; t.t = rand(2.2, 4.5); if (t.spikes) t.spikes.position.y = -0.3; }
    }
  }
}

function spawnExitPortal(D, idx) {
  const st = dstate[D.key];
  if (st.exitPortal) return;
  const zc = -(D.rooms - 1) * ROOM_SPAN;
  addPortal(D.key, 0, zc - 5, 'Voltar aos campos', 'campo', { x: D.entry.x, z: D.entry.z + 3 }, 0xffd23e);
  st.exitPortal = true;
}
