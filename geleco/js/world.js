// ============================================================
// WORLD — carga de modelos, construção da fase, objetos vivos
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from '../lib/loaders/GLTFLoader.js';
import { scene, G, rand, pick, burst, addShake, hitStop, announce, lerp, clamp, hemi, sun, skyColor } from './core.js';

const SFX = () => AudioSys;

// ------------------------------------------------------------
// Biblioteca de modelos
// ------------------------------------------------------------
export const LIB = {};
const MODELS = [
  'block-grass', 'block-grass-low', 'block-grass-large-slope',
  'block-snow', 'block-snow-low', 'block-snow-large-slope',
  'block-moving', 'coin-gold', 'star', 'heart',
  'crate', 'crate-item', 'crate-strong', 'spring', 'saw', 'trap-spikes',
  'flag', 'door-large-open', 'sign', 'lock',
  'tree', 'tree-pine', 'tree-snow', 'tree-pine-snow',
  'mushrooms', 'flowers', 'grass', 'stones', 'rocks', 'hedge',
  'character-oobi', 'character-oozi', 'character-oodi', 'character-oopi',
];

export function loadLib(onProgress) {
  const loader = new GLTFLoader();
  let done = 0;
  return Promise.all(MODELS.map(name => new Promise((resolve, reject) => {
    loader.load('assets/models/' + name + '.glb', g => {
      g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const box = new THREE.Box3().setFromObject(g.scene);
      const size = new THREE.Vector3(); box.getSize(size);
      LIB[name] = { scene: g.scene, animations: g.animations, size, box };
      done++; onProgress && onProgress(done / MODELS.length);
      resolve();
    }, undefined, reject);
  })));
}

// clona um modelo simples, com pivô no centro-base
export function spawnModel(name, opts = {}) {
  const src = LIB[name];
  const root = src.scene.clone(true);
  const wrap = new THREE.Group();
  // centraliza: base no y=0, centro em x/z=0
  const box = new THREE.Box3().setFromObject(root);
  const ctr = new THREE.Vector3(); box.getCenter(ctr);
  root.position.set(-ctr.x, -box.min.y, -ctr.z);
  wrap.add(root);
  if (opts.tint) {
    root.traverse(o => {
      if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(opts.tint)); }
    });
  }
  if (opts.scale) wrap.scale.setScalar(opts.scale);
  return wrap;
}

// geometrias "cozidas" de um GLB para InstancedMesh (todas as sub-meshes)
function bakedGeos(name) {
  const src = LIB[name];
  src.scene.updateWorldMatrix(true, true);
  const parts = [];
  src.scene.traverse(o => {
    if (o.isMesh) {
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      parts.push({ geo: g, mat: o.material });
    }
  });
  // normaliza o conjunto: centro-base em 0,0,0
  let bb = null;
  for (const p of parts) {
    p.geo.computeBoundingBox();
    bb = bb ? bb.union(p.geo.boundingBox) : p.geo.boundingBox.clone();
  }
  const ctr = new THREE.Vector3(); bb.getCenter(ctr);
  for (const p of parts) p.geo.translate(-ctr.x, -bb.min.y, -ctr.z);
  const size = new THREE.Vector3(); bb.getSize(size);
  return { parts, size };
}

// cria um InstancedMesh por sub-mesh, aplicando as mesmas matrizes
function instancedFromGLB(name, matrices, tint) {
  const { parts, size } = bakedGeos(name);
  const group = new THREE.Group();
  for (const p of parts) {
    const inst = new THREE.InstancedMesh(p.geo, tint ? tintOf(p.mat, tint) : p.mat, matrices.length);
    inst.castShadow = true; inst.receiveShadow = true;
    matrices.forEach((m, i) => inst.setMatrixAt(i, m));
    group.add(inst);
  }
  return { group, size };
}

// ------------------------------------------------------------
// Estado do mundo
// ------------------------------------------------------------
export const world = {
  group: null,
  solids: [],          // AABBs estáticos { x0, x1, y0, y1 }
  plats: [],           // one-way { x0, x1, top, h }
  movers: [],          // plataformas móveis
  cratesS: [],         // caixas fortes (sólidas)
  crates: [],          // caixas frágeis (trigger)
  coins: [], stars: [], hearts: [],
  springs: [], saws: [], spikes: [],
  flags: [], portal: null,
  enemySpawns: [], bossSpawn: null,
  width: 0,
};

const cloudList = [];

export function clearWorld() {
  if (world.group) { scene.remove(world.group); disposeDeep(world.group); }
  world.group = null;
  cloudList.length = 0;
  Object.assign(world, {
    solids: [], plats: [], movers: [], cratesS: [], crates: [],
    coins: [], stars: [], hearts: [], springs: [], saws: [], spikes: [],
    flags: [], portal: null, enemySpawns: [], bossSpawn: null, width: 0,
  });
}

function disposeDeep(obj) {
  obj.traverse(o => {
    if (o.isMesh) {
      o.geometry && o.geometry.dispose && o.geometry.dispose();
    }
  });
}

// temas
const THEMES = {
  grass: {
    block: 'block-grass', low: 'block-grass-low',
    sky: 0x9be0f7, fog: 0xc3ecf9, hemi: 0.95, sunI: 1.5,
    hill: 0x7fb56b, hill2: 0x5f9e57, cloud: 0xffffff,
    decos: ['tree', 'tree-pine', 'flowers', 'grass', 'mushrooms', 'stones', 'hedge'],
  },
  snow: {
    block: 'block-snow', low: 'block-snow-low',
    sky: 0xbcd8ee, fog: 0xdbeaf7, hemi: 1.0, sunI: 1.25,
    hill: 0xdfeef7, hill2: 0xbcd4e6, cloud: 0xffffff,
    decos: ['tree-snow', 'tree-pine-snow', 'stones', 'rocks'],
  },
  boss: {
    block: 'block-grass', low: 'block-grass-low', tint: 0xb98ae0,
    sky: 0x2a1140, fog: 0x3a1c55, hemi: 0.55, sunI: 0.9,
    hill: 0x4a2a6a, hill2: 0x371d52, cloud: 0x6a4a8a,
    decos: ['rocks', 'stones'],
  },
};

// ------------------------------------------------------------
// Construção
// ------------------------------------------------------------
export function buildWorld(def) {
  clearWorld();
  const T = THEMES[def.theme];
  const grp = new THREE.Group();
  world.group = grp;
  world.width = def.width;
  scene.add(grp);

  // céu / névoa / luz
  skyColor.set(T.sky);
  scene.fog.color.set(T.fog);
  scene.fog.near = 36; scene.fog.far = 130;
  hemi.intensity = T.hemi;
  sun.intensity = T.sunI;

  // ---- blocos sólidos → AABBs mesclados por linha
  const cells = def.solids;
  const byRow = new Map();
  for (const k of cells.keys()) {
    const [c, y] = k.split(',').map(Number);
    if (!byRow.has(y)) byRow.set(y, new Set());
    byRow.get(y).add(c);
  }
  for (const [y, set] of byRow) {
    const cols = [...set].sort((a, b) => a - b);
    let s = cols[0], p = cols[0];
    for (let i = 1; i <= cols.length; i++) {
      if (cols[i] === p + 1) { p = cols[i]; continue; }
      world.solids.push({ x0: s, x1: p + 1, y0: y, y1: y + 1 });
      s = p = cols[i];
    }
  }

  // ---- visual dos blocos (instanced, 2 camadas de profundidade)
  const blkSize = LIB[T.block].size;
  const S = new THREE.Vector3(1 / blkSize.x, 1 / blkSize.y, 1 / blkSize.z);
  const NOROT = new THREE.Quaternion();
  const blockMats = [];
  for (const k of cells.keys()) {
    const [c, y] = k.split(',').map(Number);
    blockMats.push(new THREE.Matrix4().compose(new THREE.Vector3(c + 0.5, y, 0), NOROT, S));
    blockMats.push(new THREE.Matrix4().compose(new THREE.Vector3(c + 0.5, y, -1), NOROT, S));
  }
  grp.add(instancedFromGLB(T.block, blockMats, T.tint).group);

  // ---- plataformas finas (one-way)
  if (def.plats.length) {
    const lowSize = LIB[T.low].size;
    const h = lowSize.y / lowSize.x;                // altura ao normalizar p/ 1 de largura
    const LS3 = new THREE.Vector3(1 / lowSize.x, 1 / lowSize.x, 1 / lowSize.z);
    const platMats = [];
    for (const p of def.plats) {
      platMats.push(new THREE.Matrix4().compose(new THREE.Vector3(p.c + 0.5, p.y + 1 - h, 0), NOROT, LS3));
      world.plats.push({ x0: p.c, x1: p.c + 1, top: p.y + 1, h });
    }
    grp.add(instancedFromGLB(T.low, platMats, T.tint).group);
  }

  // ---- entidades
  for (const e of def.ents) {
    const x = e.c + 0.5, y = e.y;
    switch (e.t) {
      case 'coin': {
        const m = spawnModel('coin-gold', { scale: 1.05 });
        m.position.set(x, y + 0.22, 0);
        grp.add(m);
        world.coins.push({ mesh: m, x, y: y + 0.5, taken: false, t: rand(0, 6) });
        break;
      }
      case 'star': {
        const had = (G.stars[G.levelIdx] >> (e.idx - 1)) & 1;
        const m = spawnModel('star', { scale: 1.15 });
        m.position.set(x, y + 0.1, 0);
        if (had) m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.35; } });
        grp.add(m);
        world.stars.push({ mesh: m, x, y: y + 0.5, idx: e.idx, taken: false, had, t: 0 });
        break;
      }
      case 'heart': {
        const m = spawnModel('heart', { scale: 0.85 });
        m.position.set(x, y + 0.15, 0);
        grp.add(m);
        world.hearts.push({ mesh: m, x, y: y + 0.5, taken: false, t: 0 });
        break;
      }
      case 'crate': case 'crateItem': case 'crateStrong': {
        const name = e.t === 'crate' ? 'crate' : e.t === 'crateItem' ? 'crate-item' : 'crate-strong';
        const m = spawnModel(name, { scale: 0.96 });
        m.position.set(x, y + 0.02, 0);
        grp.add(m);
        const c = { mesh: m, x0: e.c + 0.04, x1: e.c + 0.96, y0: e.y, y1: e.y + 0.96, broken: false, item: e.t === 'crateItem' };
        if (e.t === 'crateStrong') world.cratesS.push(c); else world.crates.push(c);
        break;
      }
      case 'spring': {
        const m = spawnModel('spring', { scale: 0.9 });
        m.position.set(x, y, 0);
        grp.add(m);
        world.springs.push({ mesh: m, x, y, t: 9 });
        break;
      }
      case 'saw': {
        const m = spawnModel('saw', { scale: 1.1 });
        m.position.set(x, y - 0.18, 0);
        grp.add(m);
        world.saws.push({ mesh: m, x, baseX: x, y: y - 0.18, range: e.range || 0, dir: 1, t: rand(0, 6) });
        break;
      }
      case 'spike': {
        const m = spawnModel('trap-spikes', { scale: 1 });
        m.position.set(x, y, 0);
        grp.add(m);
        world.spikes.push({ x0: e.c + 0.2, x1: e.c + 0.8, y0: e.y, y1: e.y + 0.55 });
        break;
      }
      case 'mover': {
        const m = spawnModel('block-moving', { scale: 1 });
        const w = 1.6, h = 0.48;
        m.scale.set(w / LIB['block-moving'].size.x, 1, 1);
        m.position.set(x, y, 0);
        grp.add(m);
        world.movers.push({
          mesh: m, axis: e.axis, base: { x, y }, range: e.range, t: rand(0, 2),
          x, y, px: x, py: y, w, h,
        });
        break;
      }
      case 'flag': {
        const m = spawnModel('flag', { scale: 1.3 });
        m.position.set(x, y, 0);
        grp.add(m);
        world.flags.push({ mesh: m, x, y, active: false });
        break;
      }
      case 'portal': {
        const m = spawnModel('door-large-open', { scale: 1.25 });
        m.position.set(x, y, -0.2);
        grp.add(m);
        const glow = new THREE.Mesh(
          new THREE.PlaneGeometry(1.3, 1.9),
          new THREE.MeshBasicMaterial({ color: 0x7bf24c, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
        );
        glow.position.set(x, y + 1.05, -0.1);
        grp.add(glow);
        world.portal = { mesh: m, glow, x, y, t: 0 };
        break;
      }
      case 'sign': {
        const m = spawnModel('sign', { scale: 1.1 });
        m.position.set(x, y, -0.55);
        grp.add(m);
        break;
      }
      case 'slime': case 'spiky': case 'bee':
        world.enemySpawns.push({ t: e.t, x, y });
        break;
      case 'boss':
        world.bossSpawn = { x, y };
        break;
    }
  }

  // ---- decoração + fundo
  buildScenery(def, T, grp);
  return world;
}

function tintOf(mat, tint) {
  const m = mat.clone();
  m.color = m.color.clone().multiply(new THREE.Color(tint));
  return m;
}

function buildScenery(def, T, grp) {
  // decos sobre os topos (na fileira de trás)
  const tops = new Map();
  for (const k of def.solids.keys()) {
    const [c, y] = k.split(',').map(Number);
    if (!tops.has(c) || tops.get(c) < y + 1) tops.set(c, y + 1);
  }
  let lastDeco = -3;
  for (const [c, top] of [...tops.entries()].sort((a, b) => a[0] - b[0])) {
    if (c - lastDeco < 2 || Math.random() > 0.3 || top > 10) continue;
    lastDeco = c;
    const name = pick(T.decos);
    const m = spawnModel(name, { scale: rand(0.8, 1.3), tint: T.tint });
    m.position.set(c + 0.5, top, -1);
    m.rotation.y = rand(0, Math.PI * 2);
    grp.add(m);
  }

  // colinas distantes
  const hillGeo = new THREE.SphereGeometry(1, 10, 7);
  for (let i = 0; i < Math.ceil(def.width / 12); i++) {
    const m = new THREE.Mesh(hillGeo, new THREE.MeshLambertMaterial({ color: i % 2 ? T.hill : T.hill2 }));
    const s = rand(6, 13);
    m.scale.set(s * rand(1.2, 2), s, s);
    m.position.set(i * 12 + rand(-3, 3), rand(-4, -1), -rand(11, 22));
    m.receiveShadow = true;
    grp.add(m);
  }

  // nuvens
  const cloudGeo = new THREE.SphereGeometry(1, 8, 6);
  const cloudMat = new THREE.MeshLambertMaterial({ color: T.cloud });
  for (let i = 0; i < Math.ceil(def.width / 9); i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(cloudGeo, cloudMat);
      m.scale.set(rand(1, 2.1), rand(0.55, 0.8), rand(0.8, 1.2));
      m.position.set(k * rand(0.8, 1.3) - 1.2, rand(-0.2, 0.2), 0);
      g.add(m);
    }
    g.position.set(rand(0, def.width), rand(9, 16), -rand(13, 26));
    g.userData.drift = rand(0.12, 0.4);
    grp.add(g);
    cloudList.push(g);
  }

  // pilares de gosma na arena do chefe
  if (def.theme === 'boss') {
    const gooMat = new THREE.MeshLambertMaterial({ color: 0x8a4ec9 });
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rand(0.5, 1.1), rand(0.9, 1.6), rand(4, 9), 7), gooMat);
      m.position.set(rand(2, def.width - 2), 4 + m.geometry.parameters.height / 2, -rand(2.5, 7));
      grp.add(m);
    }
  }
}

// ------------------------------------------------------------
// Sólidos dinâmicos para colisão do player/inimigos
// ------------------------------------------------------------
export function dynSolids(out) {
  out.length = 0;
  for (const s of world.solids) out.push(s);
  for (const c of world.cratesS) if (!c.broken) out.push(c);
  for (const mv of world.movers) {
    out.push({ x0: mv.x - mv.w / 2, x1: mv.x + mv.w / 2, y0: mv.y, y1: mv.y + mv.h, mover: mv });
  }
  return out;
}

// ------------------------------------------------------------
// Update por frame (animações + triggers com o player)
// ------------------------------------------------------------
export function updateWorld(dt, player) {
  // nuvens
  for (const c of cloudList) {
    c.position.x += c.userData.drift * dt;
    if (world.width && c.position.x > world.width + 14) c.position.x = -14;
  }

  // movers
  for (const mv of world.movers) {
    mv.t += dt;
    mv.px = mv.x; mv.py = mv.y;
    const o = Math.sin(mv.t * 1.4) * mv.range * 0.5 + mv.range * 0.5;
    if (mv.axis === 'H') mv.x = mv.base.x + o;
    else mv.y = mv.base.y + o;
    mv.mesh.position.set(mv.x, mv.y, 0);
  }

  // moedas
  for (const c of world.coins) {
    if (c.taken) continue;
    c.t += dt;
    c.mesh.rotation.y += dt * 2.6;
    c.mesh.position.y = c.y - 0.32 + Math.sin(c.t * 2.2) * 0.08;
    if (player && Math.abs(player.x - c.x) < 0.62 && Math.abs(player.y + 0.45 - c.y) < 0.78) {
      c.taken = true; c.mesh.visible = false;
      G.runCoins++;
      burst(c.x, c.y, 0, 0xffd34d, 7, { speed: 2.5, up: 3, life: 0.4, grav: 6 });
      SFX().play(pick(['coin1', 'coin2', 'coin3']), 0.7);
    }
  }

  // estrelas
  for (const s of world.stars) {
    if (s.taken) continue;
    s.t += dt;
    s.mesh.rotation.y += dt * 1.8;
    s.mesh.position.y = s.y - 0.4 + Math.sin(s.t * 1.7) * 0.1;
    if (player && Math.abs(player.x - s.x) < 0.75 && Math.abs(player.y + 0.45 - s.y) < 0.85) {
      s.taken = true; s.mesh.visible = false;
      G.runStars[s.idx - 1] = true;
      burst(s.x, s.y, 0, 0xffd34d, 22, { speed: 5, up: 6, life: 0.9, grav: 7 });
      hitStop(0.12); addShake(0.18);
      announce(s.had ? 'ESTRELA (de novo)!' : '⭐ ESTRELA!');
      SFX().play('star', 0.95);
    }
  }

  // corações
  for (const h of world.hearts) {
    if (h.taken) continue;
    h.t += dt;
    h.mesh.rotation.y += dt * 2;
    h.mesh.position.y = h.y - 0.35 + Math.sin(h.t * 2) * 0.09;
    if (player && player.hearts < 4 && Math.abs(player.x - h.x) < 0.65 && Math.abs(player.y + 0.45 - h.y) < 0.8) {
      h.taken = true; h.mesh.visible = false;
      player.hearts++;
      burst(h.x, h.y, 0, 0xff5d8f, 12, { speed: 3, up: 4, life: 0.6 });
      SFX().play('heart', 0.9);
      announce('💚 +1 VIDA!');
    }
  }

  // molas
  for (const sp of world.springs) {
    sp.t += dt;
    const k = Math.max(0, 1 - sp.t * 6);
    sp.mesh.scale.y = 0.9 * (1 - 0.45 * k) + 0.001;
    if (player) {
      const px = player.x, feet = player.y;
      if (Math.abs(px - sp.x) < 0.55 && feet <= sp.y + 0.55 && feet > sp.y - 0.25 && player.vy <= 0.1) {
        sp.t = 0;
        player.springBounce();
      }
    }
  }

  // serras
  for (const sw of world.saws) {
    sw.t += dt;
    sw.mesh.rotation.z += dt * 9;
    if (sw.range > 0) {
      sw.x = sw.baseX + Math.sin(sw.t * 1.6) * sw.range * 0.5;
      sw.mesh.position.x = sw.x;
    }
    if (player && player.inv <= 0) {
      const cy = sw.y + 0.55;
      if (Math.abs(player.x - sw.x) < 0.62 && player.y < cy + 0.5 && player.y + 0.9 > cy - 0.5) {
        player.damage(sw.x);
      }
    }
  }

  // espinhos
  if (player && player.inv <= 0) {
    for (const s of world.spikes) {
      if (player.x + 0.28 > s.x0 && player.x - 0.28 < s.x1 && player.y < s.y1 && player.y + 0.5 > s.y0) {
        player.damage(player.x + (Math.random() < 0.5 ? 1 : -1));
        break;
      }
    }
  }

  // caixas frágeis
  if (player) {
    for (const c of world.crates) {
      if (c.broken) continue;
      const pad = 0.06;
      if (player.x + 0.3 > c.x0 - pad && player.x - 0.3 < c.x1 + pad &&
          player.y < c.y1 + pad && player.y + 0.9 > c.y0 - pad) {
        breakCrate(c, player);
      }
    }
    // caixas fortes: quebram com a quicada por cima
    if (player.pounding) {
      for (const c of world.cratesS) {
        if (c.broken) continue;
        if (player.x + 0.3 > c.x0 && player.x - 0.3 < c.x1 &&
            player.y <= c.y1 + 0.12 && player.y > c.y0) {
          c.broken = true; c.mesh.visible = false;
          burst((c.x0 + c.x1) / 2, c.y1, 0, 0x8a5a2a, 16, { speed: 5, up: 5, life: 0.7 });
          burst((c.x0 + c.x1) / 2, c.y1, 0, 0xc9963f, 10, { speed: 4, up: 4, life: 0.5 });
          addShake(0.15);
          SFX().play('cratestrong', 1);
        }
      }
    }
  }

  // bandeira de checkpoint
  for (const f of world.flags) {
    if (!f.active && player && Math.abs(player.x - f.x) < 0.7 && Math.abs(player.y - f.y) < 1.2) {
      f.active = true;
      G.checkpoint = { x: f.x, y: f.y + 0.1 };
      f.mesh.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0x2a8a1a); o.material.emissiveIntensity = 0.6; } });
      burst(f.x, f.y + 1.2, 0, 0x7bf24c, 16, { speed: 3, up: 5, life: 0.8 });
      announce('CHECKPOINT!');
      SFX().play('check', 0.9);
    }
    if (f.active) f.mesh.rotation.y = Math.sin(G.time * 3) * 0.12;
  }

  // portal
  if (world.portal) {
    const p = world.portal;
    p.t += dt;
    p.glow.material.opacity = 0.25 + Math.sin(p.t * 3) * 0.15;
    p.glow.scale.setScalar(1 + Math.sin(p.t * 3) * 0.05);
  }
}

function breakCrate(c, player) {
  c.broken = true; c.mesh.visible = false;
  burst((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, 0, 0xb9854a, 14, { speed: 4.5, up: 4.5, life: 0.55 });
  SFX().play('crate', 0.9);
  if (c.item) {
    G.runCoins += 5;
    burst((c.x0 + c.x1) / 2, c.y1 + 0.2, 0, 0xffd34d, 16, { speed: 3.5, up: 6, life: 0.8, grav: 6 });
    SFX().play('coin3', 0.9);
  }
  // pousou em cima? mini-quique
  if (player.vy < -1 && player.y > c.y1 - 0.3) player.crateBounce();
}
