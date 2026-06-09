// ============================================================
// MARÉ VERMELHA — bridge runner de horda infinita
// Three.js + Blocky Characters / Weapon Pack / Blaster Kit (Kenney, CC0)
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from '../lib/loaders/GLTFLoader.js';

// ------------------------------------------------------------
// Constantes
// ------------------------------------------------------------
const LANE = 3.6;            // meia-largura útil da ponte
const BRIDGE_W = 10;
const VISIBLE_CAP = 160;     // bonecos azuis renderizados; acima disso viram poder de dano
const ENEMY_CAP = 120;       // pool fixo: zero alocação durante a partida
const BULLET_CAP = 700;
const SPAWN_Z = -58;

const WEAPONS = [
  { name: 'PISTOLA',        model: 'pistol',       rate: 420, dmg: 10, pellets: 1, area: 0 },
  { name: 'ESPINGARDA',     model: 'shotgunShort', rate: 520, dmg: 9,  pellets: 3, area: 0 },
  { name: 'UZI',            model: 'uzi',          rate: 180, dmg: 9,  pellets: 1, area: 0 },
  { name: 'METRALHADORA',   model: 'machinegun',   rate: 110, dmg: 11, pellets: 1, area: 0 },
  { name: 'LANÇA-FOGUETES', model: 'rocketlauncher', rate: 600, dmg: 45, pellets: 1, area: 2.2 },
];

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

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
scene.background = new THREE.Color(0x12203a);
scene.fog = new THREE.Fog(0x12203a, 45, 85);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 14.5, 14.5);
camera.lookAt(0, 0.6, -8);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.AmbientLight(0xbcd0f0, 1.25));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.7);
sun.position.set(14, 26, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -75;
sun.shadow.camera.far = 110;
scene.add(sun);

// oceano
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 300),
  new THREE.MeshLambertMaterial({ color: 0x1a4a8a })
);
water.rotation.x = -Math.PI / 2;
water.position.set(0, -2.2, -60);
scene.add(water);

// ponte: segmentos reciclados
const bridgeSegs = [];
const SEG_LEN = 8, N_SEGS = 12;
{
  const slabA = new THREE.MeshLambertMaterial({ color: 0x9aa2ae });
  const slabB = new THREE.MeshLambertMaterial({ color: 0x8a92a0 });
  const railM = new THREE.MeshLambertMaterial({ color: 0xc8d0dc });
  for (let i = 0; i < N_SEGS; i++) {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE_W, 1.2, SEG_LEN - 0.06), i % 2 ? slabA : slabB);
    slab.position.y = -0.6;
    slab.receiveShadow = true;
    g.add(slab);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, SEG_LEN - 0.06), railM);
      rail.position.set(side * (BRIDGE_W / 2 - 0.2), 0.35, 0);
      rail.castShadow = true;
      g.add(rail);
    }
    g.position.z = 8 - i * SEG_LEN;
    scene.add(g);
    bridgeSegs.push(g);
  }
}

// ------------------------------------------------------------
// Modelos
// ------------------------------------------------------------
const MODELS = ['character-a', 'character-b', 'character-c', 'character-d', 'character-e', 'character-p',
  'pistol', 'shotgunShort', 'uzi', 'machinegun', 'rocketlauncher', 'crate-medium', 'crate-wide'];
const ENEMY_MODELS = ['character-b', 'character-c', 'character-d', 'character-e'];
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
      LIB[name] = { scene: g.scene, animations: g.animations, size: box.getSize(new THREE.Vector3()) };
      resolve();
    }, undefined, reject);
  });
}

function makeChar(name, height, tint) {
  const lib = LIB[name];
  const obj = lib.scene.clone(true);
  obj.scale.setScalar(height / lib.size.y);
  if (tint) obj.traverse(o => {
    if (o.isMesh && o.material) {
      o.material = o.material.clone();
      if (o.material.color) o.material.color.multiply(new THREE.Color(tint));
    }
  });
  const mixer = new THREE.AnimationMixer(obj);
  const actions = {};
  for (const clip of lib.animations) actions[clip.name] = mixer.clipAction(clip);
  let current = null;
  const play = (n, once = false) => {
    if (current === n || !actions[n]) return;
    const a = actions[n];
    if (once) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
    a.reset().fadeIn(0.1).play();
    if (current && actions[current]) actions[current].fadeOut(0.1);
    current = n;
  };
  const reset = () => { mixer.stopAllAction(); current = null; };
  return { obj, mixer, actions, play, reset };
}

// arma na mão direita (mesma técnica do Bastião 3D)
function equipWeapon(ch, model) {
  const arm = ch.obj.getObjectByName('arm-right');
  if (!arm) return;
  if (ch.weaponMesh && ch.weaponMesh.parent) ch.weaponMesh.parent.remove(ch.weaponMesh);
  const inner = LIB[model].scene.clone(true);
  const box = new THREE.Box3().setFromObject(inner);
  const len = box.max.z - box.min.z;
  inner.position.set(
    -(box.min.x + box.max.x) / 2,
    -(box.min.y + box.max.y) / 2,
    -box.min.z - len * 0.14
  );
  const grip = new THREE.Group();
  grip.add(inner);
  grip.rotation.y = -Math.PI / 2;
  grip.scale.setScalar(0.30 / len);
  grip.position.set(-0.29, 0, 0);
  arm.add(grip);
  ch.weaponMesh = grip;
}

// sprite de texto (números de HP, rótulos de portões)
function textSprite(text, color = '#ffffff', size = 90, bg = null) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 192;
  const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, 512, 192); }
  x.font = 'bold ' + size + 'px "Kenney Future", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 12; x.strokeStyle = 'rgba(0,0,0,.85)';
  x.strokeText(text, 256, 96);
  x.fillStyle = color;
  x.fillText(text, 256, 96);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(4, 1.5, 1);
  sp.userData.redraw = (t, col) => {
    x.clearRect(0, 0, 512, 192);
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, 512, 192); }
    x.strokeText(t, 256, 96);
    x.fillStyle = col || color;
    x.fillText(t, 256, 96);
    tex.needsUpdate = true;
  };
  return sp;
}

// ------------------------------------------------------------
// Estado
// ------------------------------------------------------------
const ST = { MENU: 0, PLAYING: 1, OVER: 2 };
let state = ST.MENU;
let G = null;
const squad = [], enemies = [], bullets = [], gates = [], mixers = [];
let leaderX = 0, targetX = 0;

// formação triangular procedural: cresce sem limite de linhas
const FORMATION = [];
function formationOffset(i) {
  while (FORMATION.length <= i) {
    const idx = FORMATION.length;
    let row = 0, acc = 0;
    while (acc + Math.min(row + 1, 10) <= idx) { acc += Math.min(row + 1, 10); row++; }
    const cols = Math.min(row + 1, 10);
    const k = idx - acc;
    FORMATION.push({ x: (k - (cols - 1) / 2) * 0.72, z: row * 0.68 });
  }
  return FORMATION[i];
}

function loadRecord() { try { return parseInt(localStorage.getItem('mare_record') || '0', 10) || 0; } catch (e) { return 0; } }
function saveRecord(m) { try { if (m > loadRecord()) localStorage.setItem('mare_record', String(m)); } catch (e) {} }

const bulletGeo = new THREE.CapsuleGeometry(0.09, 0.5, 2, 6);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0x9cd8ff });
const rocketMat = new THREE.MeshBasicMaterial({ color: 0xffb060 });

// ---- pool de projéteis: malhas pré-criadas, nunca alocadas em jogo ----
const bulletPool = [];
function initBulletPool() {
  for (let i = 0; i < BULLET_CAP; i++) {
    const m = new THREE.Mesh(bulletGeo, bulletMat);
    m.rotation.x = Math.PI / 2;
    m.visible = false;
    scene.add(m);
    bulletPool.push(m);
  }
}
function getBulletMesh(rocket) {
  const m = bulletPool.pop();
  if (!m) return null;
  m.material = rocket ? rocketMat : bulletMat;
  m.visible = true;
  return m;
}
function releaseBulletMesh(m) {
  m.visible = false;
  bulletPool.push(m);
}

// ---- pool de inimigos: bonecos clonados uma única vez e reciclados ----
const enemyPool = [];
function initEnemyPool() {
  const tints = [0xff7a6a, 0xe85a4a, 0xd84838, 0xc83a3a];
  for (let i = 0; i < ENEMY_CAP; i++) {
    const ch = makeChar(ENEMY_MODELS[i % ENEMY_MODELS.length], 1.5, tints[i % tints.length]);
    ch.obj.visible = false;
    scene.add(ch.obj);
    enemyPool.push(ch);
  }
}

// ---- pool de soldados azuis: criados sob demanda, sempre reciclados ----
const soldierPool = [];
function getSoldier() {
  let ch = soldierPool.pop();
  if (!ch) {
    ch = makeChar('character-a', 1.5, 0x7aa8ff);
    ch.obj.rotation.y = Math.PI;
    scene.add(ch.obj);
  } else {
    ch.reset();
    ch.obj.visible = true;
  }
  return ch;
}

// ------------------------------------------------------------
// Esquadrão
// ------------------------------------------------------------
// SEM teto: além de VISIBLE_CAP bonecos, os excedentes viram poder de fogo
// (cada soldado "virtual" soma dano — o pelotão nunca para de crescer)
function addSoldiers(n) {
  G.totalSquad += n;
  while (squad.length < Math.min(G.totalSquad, VISIBLE_CAP)) {
    const ch = getSoldier();
    ch.play('walk');
    ch.actions['walk'].timeScale = rand(0.9, 1.15);
    equipWeapon(ch, WEAPONS[G.weapon].model);
    squad.push({ ch, fireCd: rand(0, WEAPONS[G.weapon].rate) });
  }
  updateHUD();
}

// multiplicador dos soldados além do limite visível
function virtualMul() {
  return squad.length > 0 ? G.totalSquad / squad.length : 1;
}

function loseSoldier() {
  G.totalSquad--;
  if (G.totalSquad < squad.length) {
    const s = squad.pop();
    if (s) {
      s.ch.play('die', true);
      const ch = s.ch;
      setTimeout(() => { ch.obj.visible = false; ch.reset(); soldierPool.push(ch); }, 700);
    }
  }
  AudioSys.play('hurt', 0.5);
  shake = Math.min(0.5, shake + 0.18);
  if (G.totalSquad <= 0) endGame();
  updateHUD();
}

// ------------------------------------------------------------
// Inimigos
// ------------------------------------------------------------
// onda de inimigos: clusters que crescem EXPONENCIALMENTE com a distância
function spawnCluster() {
  const n = Math.min(Math.round(3 + Math.pow(1.6, G.meters / 140)), 22);
  const cx = rand(-LANE * 0.6, LANE * 0.6);
  for (let i = 0; i < n; i++) {
    if (enemies.length >= ENEMY_CAP) return;
    spawnEnemy(false, cx + rand(-2.4, 2.4), rand(-7, 3));
  }
}

function spawnEnemy(isBoss = false, x = 0, dz = 0) {
  const mult = 1 + G.meters / 120;
  let ch;
  if (isBoss) {
    ch = makeChar(pick(ENEMY_MODELS), 4.6, 0xb01418);
    ch.obj.position.set(0, 0, SPAWN_Z + dz);
    scene.add(ch.obj);
  } else {
    ch = enemyPool.pop();                 // reuso: nenhuma alocação em jogo
    if (!ch) return;
    ch.reset();
    ch.obj.visible = true;
    ch.obj.position.set(clamp(x, -LANE, LANE), 0, SPAWN_Z + dz);
  }
  ch.play(isBoss ? 'walk' : 'sprint');
  const e = {
    ch, isBoss,
    hp: isBoss ? Math.round(550 * mult) : Math.round(10 * mult),
    spd: isBoss ? 1.4 : rand(2.6, 4.2),
    dying: 0,
  };
  // passada da animação acompanha a velocidade real (corrida natural)
  const run = ch.actions[isBoss ? 'walk' : 'sprint'];
  if (run) run.timeScale = e.spd / (isBoss ? 1.4 : 3.0);
  e.maxHp = e.hp;
  if (isBoss) {
    e.label = textSprite(String(e.hp), '#ffffff');
    e.label.scale.set(5, 1.9, 1);
    scene.add(e.label);             // segue o gigante via update (evita herdar a escala)
    announce('GIGANTE À FRENTE!');
  }
  enemies.push(e);
}

function damageEnemy(e, dmg) {
  if (e.dying) return;
  e.hp -= dmg;
  if (e.label) e.label.userData.redraw(String(Math.max(0, e.hp)), e.hp < e.maxHp * 0.3 ? '#ff9090' : '#ffffff');
  if (e.hp <= 0) {
    e.dying = 0.7;
    e.ch.play('die', true);
    G.kills++;
    if (e.isBoss) {
      AudioSys.play('boom', 0.8);
      shake = 0.5;
      announce('GIGANTE ABATIDO!');
    } else if (Math.random() < 0.2) AudioSys.play('die', 0.25);
    updateHUD();
  }
}

// ------------------------------------------------------------
// Portões de upgrade
// ------------------------------------------------------------
const GATE_TYPES = [
  { kind: 'soldiers', n: 1, label: '+1', color: '#8af0ff', w: 18 },
  { kind: 'soldiers', n: 2, label: '+2', color: '#8af0ff', w: 24 },
  { kind: 'soldiers', n: 4, label: '+4', color: '#8af0ff', w: 14 },
  { kind: 'soldiers', n: 6, label: '+6', color: '#5af0c8', w: 7 },
  { kind: 'double',   label: '×2', color: '#ffd23e', w: 7 },
  { kind: 'damage',   label: 'DANO +25%', color: '#ff9c6a', w: 15 },
  { kind: 'damage2',  label: 'DANO +50%', color: '#ff7a3a', w: 6 },
  { kind: 'rate',     label: 'CADÊNCIA +20%', color: '#b0ff8a', w: 15 },
  { kind: 'rate2',    label: 'CADÊNCIA +35%', color: '#7aff5a', w: 6 },
  { kind: 'weapon',   label: 'ARMA', color: '#ffffff', w: 20 },
];

function pickGateType(excludeWeapon) {
  const pool = GATE_TYPES.filter(t => !(excludeWeapon && t.kind === 'weapon'));
  const total = pool.reduce((s, t) => s + t.w, 0);
  let r = Math.random() * total;
  for (const t of pool) { r -= t.w; if (r <= 0) return t; }
  return pool[0];
}

function spawnGatePair() {
  const noWeapon = G.weapon >= WEAPONS.length - 1;
  const a = pickGateType(noWeapon);
  let b = pickGateType(noWeapon);
  let guard = 0;
  while (b.kind === a.kind && guard++ < 6) b = pickGateType(noWeapon);
  [[-2.1, a], [2.1, b]].forEach(([x, t]) => spawnGate(x, t));
}

function spawnGate(x, type) {
  const g = new THREE.Group();
  if (type.kind === 'weapon') {
    // caixa com a próxima arma flutuando em cima
    const crate = LIB['crate-medium'].scene.clone(true);
    crate.scale.setScalar(2.2 / Math.max(LIB['crate-medium'].size.x, LIB['crate-medium'].size.z));
    g.add(crate);
    const nextW = WEAPONS[Math.min(G.weapon + 1, WEAPONS.length - 1)];
    const wm = LIB[nextW.model].scene.clone(true);
    wm.scale.setScalar(1.6 / LIB[nextW.model].size.z);
    wm.position.y = 2.1;
    wm.rotation.x = -0.2;
    g.userData.spin = wm;
    g.add(wm);
    const lbl = textSprite(nextW.name, '#ffffff', 64);
    lbl.position.y = 3.6;
    g.add(lbl);
  } else {
    // portal com moldura azul translúcida
    const frameM = new THREE.MeshBasicMaterial({ color: 0x4a8adf, transparent: true, opacity: 0.45 });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6), frameM);
    panel.position.y = 1.5;
    g.add(panel);
    const edgeM = new THREE.MeshBasicMaterial({ color: 0x9cd8ff });
    for (const side of [-1.7, 1.7]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.8, 0.18), edgeM);
      post.position.set(side, 1.4, 0);
      g.add(post);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 0.18), edgeM);
    top.position.y = 2.85;
    g.add(top);
    const lbl = textSprite(type.label, type.color, type.label.length > 4 ? 56 : 110);
    lbl.position.y = 1.55;
    lbl.scale.set(3.2, 1.2, 1);
    g.add(lbl);
  }
  g.position.set(x, 0, SPAWN_Z);
  scene.add(g);
  gates.push({ obj: g, type, taken: false });
}

function applyGate(type) {
  AudioSys.play(type.kind === 'weapon' ? 'upgrade' : 'gate', 0.7);
  switch (type.kind) {
    case 'soldiers': addSoldiers(type.n); announce('+' + type.n + (type.n === 1 ? ' SOLDADO' : ' SOLDADOS')); break;
    case 'double': addSoldiers(G.totalSquad); announce('PELOTÃO ×2!'); break;
    case 'damage': G.dmgMul *= 1.25; announce('DANO +25%'); break;
    case 'damage2': G.dmgMul *= 1.5; announce('DANO +50%!'); break;
    case 'rate': G.rateMul *= 0.8; announce('CADÊNCIA +20%'); break;
    case 'rate2': G.rateMul *= 0.65; announce('CADÊNCIA +35%!'); break;
    case 'weapon':
      if (G.weapon < WEAPONS.length - 1) {
        G.weapon++;
        for (const s of squad) equipWeapon(s.ch, WEAPONS[G.weapon].model);
        announce('ARMA NOVA!\n' + WEAPONS[G.weapon].name);
      }
      break;
  }
  updateHUD();
}

// ------------------------------------------------------------
// Fluxo
// ------------------------------------------------------------
function startGame() {
  for (const s of squad) scene.remove(s.ch.obj);
  for (const e of enemies) {
    if (e.label) scene.remove(e.label);
    if (e.isBoss) scene.remove(e.ch.obj);
    else { e.ch.obj.visible = false; e.ch.reset(); enemyPool.push(e.ch); }
  }
  for (const b of bullets) releaseBulletMesh(b.obj);
  for (const g of gates) scene.remove(g.obj);
  squad.length = enemies.length = bullets.length = gates.length = mixers.length = 0;

  G = {
    meters: 0, kills: 0, weapon: 0, totalSquad: 0,
    dmgMul: 1, rateMul: 1,
    speed: 3.2, spawnCd: 1200, nextGate: 40, nextBoss: 300,
    over: false,
  };
  leaderX = 0; targetX = 0;

  addSoldiers(3);
  state = ST.PLAYING;
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('end').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  AudioSys.play('confirm', 0.7);
  AudioSys.playMusic('game');
  announce('A MARÉ SE APROXIMA...');
}

function endGame() {
  if (G.over) return;
  G.over = true;
  state = ST.OVER;
  saveRecord(Math.floor(G.meters));
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('end').classList.remove('hidden');
  document.getElementById('end-stats').innerHTML =
    'distância: <b>' + Math.floor(G.meters) + ' m</b><br>' +
    'abates: ' + G.kills + ' · arma: ' + WEAPONS[G.weapon].name +
    '<br>recorde: ' + loadRecord() + ' m';
  AudioSys.playMusic('gameover');
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
  $('meters').textContent = Math.floor(G.meters) + ' m';
  $('record-live').textContent = 'recorde ' + Math.max(loadRecord(), Math.floor(G.meters)) + ' m';
  $('squad').textContent = '⛨ ' + G.totalSquad;
  $('weapon').textContent = WEAPONS[G.weapon].name +
    (G.dmgMul > 1 ? ' · dano ×' + G.dmgMul.toFixed(2).replace(/\.?0+$/, '') : '');
  $('kills').textContent = 'abates: ' + G.kills;
}

// ------------------------------------------------------------
// Entrada
// ------------------------------------------------------------
const keys = {};
window.addEventListener('keydown', e => {
  AudioSys.unlock();
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'Enter' && state !== ST.PLAYING) startGame();
  if (e.key === 'm' || e.key === 'M') AudioSys.toggleMute();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

let dragX = null;
window.addEventListener('pointerdown', e => {
  AudioSys.unlock();
  if (e.target.closest('.overlay, button, a')) return;
  dragX = e.clientX;
});
window.addEventListener('pointermove', e => {
  if (dragX === null) return;
  targetX = clamp(targetX + (e.clientX - dragX) * 0.02, -LANE, LANE);
  dragX = e.clientX;
});
window.addEventListener('pointerup', () => { dragX = null; });
$('btn-start').addEventListener('click', () => { AudioSys.unlock(); startGame(); });
$('btn-retry').addEventListener('click', () => { AudioSys.unlock(); startGame(); });

// ------------------------------------------------------------
// Loop
// ------------------------------------------------------------
const clock = new THREE.Clock();
let shake = 0, time = 0;
let fpsFrames = 0, fpsAcc = 0, fpsValue = 60;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  time += dt;
  fpsFrames++; fpsAcc += dt;
  if (fpsAcc >= 1) { fpsValue = fpsFrames / fpsAcc; fpsFrames = 0; fpsAcc = 0; }

  for (const m of mixers) m.update(dt);
  if (state === ST.PLAYING) update(dt);

  // câmera com tremor
  const cx = leaderX * 0.4;
  camera.position.x = lerp(camera.position.x, cx, 5 * dt);
  let lx = cx, lz = -8;
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.3); lx += rand(-shake, shake); lz += rand(-shake, shake); }
  camera.lookAt(lx, 0.6, lz);

  renderer.render(scene, camera);
}

function update(dt) {
  const ms = dt * 1000;
  G.speed = Math.min(5.5, 3.2 + G.meters / 220);
  G.meters += G.speed * dt;

  // ---- ponte rola ----
  for (const seg of bridgeSegs) {
    seg.position.z += G.speed * dt;
    if (seg.position.z > 16) seg.position.z -= N_SEGS * SEG_LEN;
  }

  // ---- movimento lateral ----
  if (keys['a'] || keys['arrowleft']) targetX -= 7 * dt;
  if (keys['d'] || keys['arrowright']) targetX += 7 * dt;
  targetX = clamp(targetX, -LANE, LANE);
  leaderX = lerp(leaderX, targetX, 8 * dt);

  // ---- esquadrão em formação ----
  const vMul = virtualMul();
  squad.forEach((s, i) => {
    s.ch.mixer.update(dt);
    const f = formationOffset(i);
    const sx = leaderX + f.x, sz = f.z;
    s.ch.obj.position.x = lerp(s.ch.obj.position.x, clamp(sx, -LANE - 0.4, LANE + 0.4), 10 * dt);
    s.ch.obj.position.z = lerp(s.ch.obj.position.z, sz, 10 * dt);

    // tiro automático
    s.fireCd -= ms;
    if (s.fireCd <= 0) {
      const w = WEAPONS[G.weapon];
      s.fireCd = w.rate * G.rateMul * rand(0.92, 1.08);
      for (let p = 0; p < w.pellets; p++) {
        const spread = w.pellets > 1 ? (p - (w.pellets - 1) / 2) * 0.5 : rand(-0.06, 0.06);
        const b = getBulletMesh(w.area > 0);          // do pool, sem alocação
        if (!b) break;
        b.position.set(s.ch.obj.position.x, 1.1, s.ch.obj.position.z - 0.5);
        bullets.push({ obj: b, vx: spread * 6, dmg: w.dmg * G.dmgMul * vMul, area: w.area, life: 2.6 });
      }
      if (i === 0) AudioSys.play('shot', 0.12);
    }
  });

  // ---- projéteis ----
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    b.obj.position.z -= 30 * dt;
    b.obj.position.x += b.vx * dt;
    let hit = null;
    for (const e of enemies) {
      if (e.dying) continue;
      const ep = e.ch.obj.position;
      const r = e.isBoss ? 1.9 : 0.55;
      if (Math.abs(ep.z - b.obj.position.z) < 0.7 && Math.abs(ep.x - b.obj.position.x) < r) { hit = e; break; }
    }
    if (hit) {
      if (b.area) {
        AudioSys.play('boom', 0.35);
        const hp = hit.ch.obj.position;
        for (const e of enemies) {
          if (e.dying) continue;
          const ep = e.ch.obj.position;
          if (Math.hypot(ep.x - hp.x, ep.z - hp.z) < b.area) damageEnemy(e, b.dmg);
        }
      } else damageEnemy(hit, b.dmg);
    }
    if (hit || b.life <= 0) { releaseBulletMesh(b.obj); bullets.splice(i, 1); }
  }

  // ---- inimigos ----
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const ep = e.ch.obj.position;
    e.ch.mixer.update(dt);   // só inimigos ativos animam
    if (e.dying) {
      e.dying -= dt;
      if (e.label) { scene.remove(e.label); e.label = null; }
      if (e.dying <= 0) {
        if (e.isBoss) scene.remove(e.ch.obj);
        else { e.ch.obj.visible = false; e.ch.reset(); enemyPool.push(e.ch); }  // recicla
        enemies.splice(i, 1);
      }
      continue;
    }
    // avança de verdade: marcha da ponte + corrida própria
    ep.z += (G.speed + e.spd) * dt;
    if (e.label) e.label.position.set(ep.x, 5.6, ep.z);
    // converge para o pelotão gradualmente
    if (ep.z > -30) ep.x = lerp(ep.x, leaderX, (ep.z > -12 ? 0.9 : 0.3) * dt);
    e.ch.obj.rotation.y = Math.atan2(leaderX - ep.x, 4);

    if (ep.z > -0.4) {
      // alcançou o pelotão
      e.dying = 0.4;
      e.ch.play('die', true);
      const losses = e.isBoss ? 4 : 1;
      for (let k = 0; k < losses; k++) loseSoldier();
      if (G.over) return;
    }
  }

  // ---- portões ----
  for (let i = gates.length - 1; i >= 0; i--) {
    const g = gates[i];
    g.obj.position.z += G.speed * dt;
    if (g.obj.userData.spin) g.obj.userData.spin.rotation.y += 2.5 * dt;
    if (!g.taken && g.obj.position.z > -0.6 && g.obj.position.z < 1.4 &&
        Math.abs(g.obj.position.x - leaderX) < 2.0) {
      g.taken = true;
      applyGate(g.type);
      g.obj.visible = false;
    }
    if (g.obj.position.z > 6) { scene.remove(g.obj); gates.splice(i, 1); }
  }

  // ---- spawns: a maré não para ----
  G.spawnCd -= ms;
  if (G.spawnCd <= 0) {
    G.spawnCd = Math.max(380, 1200 - G.meters * 2.2);
    spawnCluster();
    if (G.meters > 150 && Math.random() < 0.5) spawnCluster();
  }
  if (G.meters >= G.nextGate) {
    G.nextGate += rand(55, 75);
    spawnGatePair();
  }
  if (G.meters >= G.nextBoss) {
    G.nextBoss += 320;
    spawnEnemy(true);
  }

  if (Math.floor(G.meters) % 5 === 0) updateHUD();
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
  initBulletPool();
  initEnemyPool();
  document.getElementById('loading').classList.add('hidden');
  AudioSys.playMusic('menu');
  tick();
}).catch(err => {
  console.error('Erro ao carregar modelos:', err);
  document.getElementById('loading').innerHTML = '<p class="story">Erro ao carregar modelos — veja o console.</p>';
});

// handle de testes
window.__MV = {
  get state() { return state; },
  get meters() { return G ? Math.floor(G.meters) : 0; },
  get squad() { return G ? G.totalSquad : 0; },
  get visible() { return squad.length; },
  get enemies() { return enemies.length; },
  get pool() { return enemyPool.length; },
  get bulletsLive() { return bullets.length; },
  get fps() { return Math.round(fpsValue); },
  get kills() { return G ? G.kills : 0; },
  get weapon() { return G ? G.weapon : 0; },
  get gates() { return gates.length; },
  get models() { return Object.keys(LIB).length; },
  get over() { return G ? G.over : false; },
  setX: x => { targetX = x; },
  grow: n => { if (G) addSoldiers(n); },
};
