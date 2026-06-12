// ============================================================
// WORLDMAP — mapa seletor de fases (ilhas flutuantes)
// ============================================================
import * as THREE from 'three';
import { scene, G, burst, rand, pick, lerp, clamp, starCount, hemi, sun, skyColor } from './core.js';
import { LIB, spawnModel } from './world.js';
import { spawnChar } from './player.js';
import { makeCrown } from './boss.js';
import { LEVELS } from './levels.js';

const SFX = () => AudioSys;

const ISLAND_X = [0, 9, 18];
const NAMES = ['VALE QUICANTE', 'PICOS CONGELADOS', '👑 TRONO DO REI BOCÃO'];
const HINTS = ['a primeira quicada', 'cuidado: o gelo escorrega!', 'devolva as estrelas ao céu'];

export const worldmap = {
  group: null, sel: 0, hero: null, locks: [], starMeshes: [],
  hopT: 1, hopFrom: 0, hopTo: 0, camX: 0,
};

export function buildMap() {
  clearMap();
  const grp = new THREE.Group();
  worldmap.group = grp;
  scene.add(grp);
  worldmap.sel = Math.min(G.unlocked - 1, 2);
  worldmap.locks = [];
  worldmap.starMeshes = [];

  skyColor.set(0x8fd8f5);
  scene.fog.color.set(0xbce8f7);
  scene.fog.near = 30; scene.fog.far = 90;
  hemi.intensity = 1.0;
  sun.intensity = 1.4;
  sun.position.set(8, 18, 12);
  sun.target.position.set(9, 0, 0);

  const themes = ['block-grass', 'block-snow', 'block-grass'];
  const tints = [null, null, 0xb98ae0];
  const decos = [['tree', 'flowers'], ['tree-pine-snow', 'stones'], ['rocks']];

  for (let i = 0; i < 3; i++) {
    const x = ISLAND_X[i];
    const isl = new THREE.Group();
    // pilha de blocos 3×2 (+ base afunilada)
    for (let c = -1; c <= 1; c++) {
      for (let y = 0; y >= -1; y--) {
        if (y === -1 && c !== 0) continue;
        const b = spawnModel(themes[i], { tint: tints[i] });
        b.position.set(c, y - 1, 0);
        isl.add(b);
        const b2 = spawnModel(themes[i], { tint: tints[i] });
        b2.position.set(c, y - 1, -1);
        isl.add(b2);
      }
    }
    // decoração
    const d1 = spawnModel(decos[i][0], { scale: 0.9, tint: tints[i] });
    d1.position.set(-0.8, 0, -1);
    isl.add(d1);
    if (decos[i][1]) {
      const d2 = spawnModel(decos[i][1], { scale: 0.8, tint: tints[i] });
      d2.position.set(0.9, 0, -1);
      isl.add(d2);
    }
    if (i === 2) {
      const crown = makeCrown(0.8);
      crown.position.set(0, 1.6, -1);
      isl.add(crown);
    }
    // estrelas conquistadas
    const nStars = i < 2 ? 3 : 1;
    const got = i < 2 ? G.stars[i] : (G.stars[2] ? 1 : 0);
    for (let s = 0; s < nStars; s++) {
      const has = i < 2 ? (got >> s) & 1 : got;
      const st = spawnModel('star', { scale: 0.42 });
      st.position.set((s - (nStars - 1) / 2) * 0.62, 2.45, 0);
      if (!has) st.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(0x49627a); } });
      isl.add(st);
      worldmap.starMeshes.push(st);
    }
    // cadeado (selo na frente da ilha)
    if (i + 1 > G.unlocked) {
      const lock = spawnModel('lock', { scale: 1.5 });
      lock.position.set(x, 0.1, 1.15);
      grp.add(lock);
      worldmap.locks[i] = lock;
    }
    isl.position.set(x, 0, 0);
    isl.userData.baseY = 0;
    isl.userData.phase = i * 1.4;
    grp.add(isl);
    worldmap['island' + i] = isl;

    // trilha de pedrinhas
    if (i < 2) {
      for (let k = 1; k <= 4; k++) {
        const p = spawnModel('stones', { scale: 0.5 });
        p.position.set(x + (ISLAND_X[i + 1] - x) * (k / 5), -0.6 + Math.sin(k * 1.2) * 0.2, 0);
        grp.add(p);
      }
    }
  }

  // nuvens fofas por baixo e atrás
  const cloudGeo = new THREE.SphereGeometry(1, 8, 6);
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(cloudGeo, cloudMat);
      m.scale.set(rand(1, 2), rand(0.5, 0.75), rand(0.8, 1.1));
      m.position.set(k * rand(0.8, 1.2) - 1, rand(-0.15, 0.15), 0);
      g.add(m);
    }
    const below = i < 8;
    g.position.set(rand(-6, 24), below ? rand(-4.5, -2.5) : rand(4, 9), below ? rand(-3, 2) : -rand(8, 16));
    g.userData.drift = rand(0.1, 0.35);
    grp.add(g);
  }

  // herói no mapa
  const hero = spawnChar('character-oobi', 0.95, 0x9af065);
  hero.actions['idle'] && hero.actions['idle'].play();
  hero.wrap.position.set(ISLAND_X[worldmap.sel], 1, 0);
  grp.add(hero.wrap);
  worldmap.hero = hero;
  worldmap.hopT = 1;
  worldmap.camX = ISLAND_X[worldmap.sel];

  updateMapUI();
}

export function clearMap() {
  if (worldmap.group) scene.remove(worldmap.group);
  worldmap.group = null;
  worldmap.hero = null;
}

function updateMapUI() {
  const i = worldmap.sel;
  const locked = i + 1 > G.unlocked;
  const nameEl = document.getElementById('map-name');
  nameEl.textContent = locked ? '🔒 ' + NAMES[i] : NAMES[i];
  nameEl.classList.toggle('locked', locked);
  const starsEl = document.getElementById('map-stars');
  const star = on => on ? '★' : '<span class="off">★</span>';
  if (i < 2) {
    let s = '';
    for (let k = 0; k < 3; k++) s += star((G.stars[i] >> k) & 1);
    starsEl.innerHTML = s;
  } else starsEl.innerHTML = star(G.stars[2]);
  document.getElementById('map-hint').textContent = locked
    ? 'COMPLETE A FASE ANTERIOR PARA ABRIR'
    : HINTS[i] + '  ·  PULO/ENTER — ENTRAR';
}

// tenta mover a seleção; retorna se mexeu
export function mapMove(dir) {
  const n = clamp(worldmap.sel + dir, 0, 2);
  if (n === worldmap.sel) return false;
  worldmap.hopFrom = ISLAND_X[worldmap.sel];
  worldmap.sel = n;
  worldmap.hopTo = ISLAND_X[n];
  worldmap.hopT = 0;
  SFX().play('click', 0.7, 1.1);
  updateMapUI();
  return true;
}

export function mapSelLocked() { return worldmap.sel + 1 > G.unlocked; }

export function shakeLock() {
  const l = worldmap.locks[worldmap.sel];
  if (l) l.userData.shake = 0.5;
  SFX().play('click', 0.9, 0.5);
}

// estoura o cadeado da fase recém-aberta
export function popLock(idx) {
  const l = worldmap.locks[idx];
  if (!l) return;
  burst(l.position.x, l.position.y + 0.4, l.position.z, 0xffd34d, 26, { speed: 6, up: 6, life: 0.9 });
  burst(l.position.x, l.position.y + 0.4, l.position.z, 0xc0c8d0, 14, { speed: 5, up: 5, life: 0.7 });
  worldmap.group.remove(l);
  worldmap.locks[idx] = null;
  SFX().play('unlock', 1);
}

export function updateMap(dt, camera) {
  const wm = worldmap;
  if (!wm.group) return;

  // ilhas respiram
  for (let i = 0; i < 3; i++) {
    const isl = wm['island' + i];
    if (isl) isl.position.y = isl.userData.baseY + Math.sin(G.time * 0.9 + isl.userData.phase) * 0.18;
  }
  // nuvens
  for (const c of wm.group.children) {
    if (c.userData.drift) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 26) c.position.x = -8;
    }
  }
  // cadeados balançam
  for (let i = 0; i < wm.locks.length; i++) {
    const l = wm.locks[i];
    if (!l) continue;
    l.rotation.y = Math.sin(G.time * 1.3 + i) * 0.35;
    l.position.y = 0.1 + Math.sin(G.time * 2.2 + i) * 0.08;
    if (l.userData.shake > 0) {
      l.userData.shake -= dt;
      l.position.x = ISLAND_X[i] + rand(-0.07, 0.07);
    } else l.position.x = ISLAND_X[i];
  }
  // estrelas giram
  for (const st of wm.starMeshes) st.rotation.y += dt * 1.6;

  // herói pula entre ilhas
  if (wm.hero) {
    const island = wm['island' + wm.sel];
    const islY = island ? island.position.y : 0;
    if (wm.hopT < 1) {
      wm.hopT = Math.min(1, wm.hopT + dt * 1.8);
      const k = wm.hopT;
      wm.hero.wrap.position.x = lerp(wm.hopFrom, wm.hopTo, k);
      wm.hero.wrap.position.y = 1 + islY + Math.sin(k * Math.PI) * 2.2;
      wm.hero.wrap.rotation.y = (wm.hopTo > wm.hopFrom ? 1 : -1) * (Math.PI / 2 - 0.2);
      if (wm.hopT >= 1) {
        burst(wm.hero.wrap.position.x, wm.hero.wrap.position.y, 0, 0xffffff, 5, { speed: 1.6, up: 1.4, life: 0.3 });
        SFX().play('land', 0.4);
      }
    } else {
      wm.hero.wrap.position.y = 1 + islY;
      wm.hero.wrap.rotation.y += (0.15 - wm.hero.wrap.rotation.y) * dt * 5;
    }
    wm.hero.mixer.update(dt);
  }

  // câmera
  wm.camX = lerp(wm.camX, ISLAND_X[wm.sel], Math.min(1, dt * 4));
  camera.position.set(wm.camX, 2.6, 10.5);
  camera.lookAt(wm.camX, 0.8, 0);
}
