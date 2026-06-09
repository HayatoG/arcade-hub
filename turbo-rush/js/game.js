// ============================================================
// TURBO RUSH — racer infinito 3D
// Three.js + modelos Kenney (CC0)
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from '../lib/loaders/GLTFLoader.js';

// ------------------------------------------------------------
// Constantes do mundo (1 unidade = 1 metro)
// ------------------------------------------------------------
const LANES = 4;
const LANE_W = 3.1;
const ROAD_W = LANES * LANE_W + 1.2;
const TILE_LEN = 14;
const N_TILES = 26;
const SPAWN_Z = -300;
const FOG_FAR = 320;

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const laneX = l => (l - (LANES - 1) / 2) * LANE_W;

// ------------------------------------------------------------
// Cena, câmera, renderer
// ------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

// céu: gradiente de pôr do sol desenhado em canvas
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 16; skyCanvas.height = 256;
const skyCtx = skyCanvas.getContext('2d');
const grad = skyCtx.createLinearGradient(0, 0, 0, 256);
grad.addColorStop(0.0, '#3d2466');
grad.addColorStop(0.45, '#b0486e');
grad.addColorStop(0.75, '#ff8a50');
grad.addColorStop(1.0, '#ffc988');
skyCtx.fillStyle = grad;
skyCtx.fillRect(0, 0, 16, 256);
scene.background = new THREE.CanvasTexture(skyCanvas);
scene.fog = new THREE.Fog(0xffa070, 60, FOG_FAR);

const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 5.4, 10);
camera.lookAt(0, 1.2, -10);

const hemi = new THREE.HemisphereLight(0xffd9b0, 0x5a4a6a, 1.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd9a0, 1.6);
sun.position.set(-35, 55, -40);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -90;
sun.shadow.camera.far = 200;
scene.add(sun);

// chão
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(700, 800),
  new THREE.MeshLambertMaterial({ color: 0x8a6a5a })
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, -0.05, -250);
ground.receiveShadow = true;
scene.add(ground);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------------------------------------
// Carregamento de modelos
// ------------------------------------------------------------
const MODELS = [
  'race', 'race-future', 'sedan-sports',                       // jogáveis
  'sedan', 'taxi', 'police', 'van', 'truck', 'suv', 'ambulance', 'delivery',  // tráfego
  'box', 'cone',
  'roadStraight', 'barrierRed', 'barrierWhite',
  'billboard', 'lightPostModern', 'flagCheckers',
  'tree_pineRoundA', 'tree_pineRoundC', 'tree_simple_dark',
  'rock_tallJ', 'stone_tallB', 'plant_bushDetailed',
];
const TRAFFIC_MODELS = ['sedan', 'taxi', 'police', 'van', 'truck', 'suv', 'ambulance', 'delivery'];
const PROP_MODELS = ['tree_pineRoundA', 'tree_pineRoundC', 'tree_simple_dark',
                     'rock_tallJ', 'stone_tallB', 'plant_bushDetailed', 'billboard', 'lightPostModern'];

const LIB = {};   // nome -> { scene, size }
const loader = new GLTFLoader();

function loadModel(name) {
  return new Promise((resolve, reject) => {
    loader.load('assets/models/' + name + '.glb', g => {
      const obj = g.scene;
      obj.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        // materiais "unlit" (alguns kits) não reagem à luz — converte p/ Lambert
        if (o.material && o.material.isMeshBasicMaterial) {
          o.material = new THREE.MeshLambertMaterial({
            color: o.material.color,
            map: o.material.map || null,
          });
        }
        // glTF sem metallicFactor explícito = metal 1.0 → renderiza preto sem envMap
        if (o.material && o.material.isMeshStandardMaterial && o.material.metalness > 0.5) {
          o.material.metalness = 0;
          o.material.roughness = 0.9;
        }
      });
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      LIB[name] = { obj, size };
      resolve();
    }, undefined, reject);
  });
}

// recentraliza o conteúdo de um grupo: base no chão (y=0), centro em x/z
function recenter(wrapper, inst) {
  const box = new THREE.Box3().setFromObject(wrapper);
  const c = box.getCenter(new THREE.Vector3());
  inst.position.x -= c.x;
  inst.position.z -= c.z;
  inst.position.y -= box.min.y;
  wrapper.userData.halfL = (box.max.z - box.min.z) / 2;
  wrapper.userData.halfW = (box.max.x - box.min.x) / 2;
  return wrapper;
}

// instância com o eixo maior alinhado ao Z e comprimento normalizado
function makeInstance(name, targetLen) {
  const { obj, size } = LIB[name];
  const wrapper = new THREE.Group();
  const inst = obj.clone(true);
  const s = targetLen / Math.max(size.x, size.z);
  inst.scale.setScalar(s);
  if (size.x > size.z) inst.rotation.y = Math.PI / 2;
  wrapper.add(inst);
  return recenter(wrapper, inst);
}

// barreira lateral: altura natural, esticada em Z para cobrir o tile
function makeBarrier(name, len) {
  const w = makeInstance(name, 3.6);
  w.scale.z = len / (w.userData.halfL * 2);
  return w;
}

// ------------------------------------------------------------
// Estado do jogo
// ------------------------------------------------------------
const ST = { MENU: 0, PLAYING: 1, DEAD: 2 };
let state = ST.MENU;
let chosenCar = 'race';

let playerGroup = null;
let playerLane = 1.5, playerX = 0;
let speedKmh = 0, speedOffset = 0;
let traveled = 0, spawnAcc = 0, propAcc = 0, boxAcc = 0, coneAcc = 0;
let score = 0, lastScoreInt = 0;
let turboT = 0;
let deadT = 0;
let time = 0;

let hiScore = 0;
try { hiScore = parseInt(localStorage.getItem('turborush_hiscore') || '0', 10) || 0; } catch (e) {}

const roadTiles = [];
const traffic = [];
const props = [];
const pickups = [];   // caixas de turbo e cones

// ------------------------------------------------------------
// Construção do mundo
// ------------------------------------------------------------
function buildRoad() {
  for (let i = 0; i < N_TILES; i++) {
    const g = new THREE.Group();

    // tile de estrada: largura fixa em X = ROAD_W, esticado em Z = TILE_LEN
    const { obj, size } = LIB['roadStraight'];
    const inst = obj.clone(true);
    const s = ROAD_W / size.x;
    inst.scale.setScalar(s);
    const road = new THREE.Group();
    road.add(inst);
    recenter(road, inst);
    road.scale.z = TILE_LEN / (size.z * s);
    g.add(road);

    for (const side of [-1, 1]) {
      const barrier = makeBarrier(i % 4 === 0 ? 'barrierRed' : 'barrierWhite', TILE_LEN * 0.96);
      barrier.position.set(side * (ROAD_W / 2 + 0.6), 0, 0);
      g.add(barrier);
    }
    g.position.z = 10 - i * TILE_LEN;
    scene.add(g);
    roadTiles.push(g);
  }
}

function buildProps() {
  for (let i = 0; i < 56; i++) {
    const name = PROP_MODELS[randi(0, PROP_MODELS.length - 1)];
    const len = name.startsWith('tree') ? rand(5, 8)
              : name.startsWith('rock') || name.startsWith('stone') ? rand(2.5, 5)
              : name === 'billboard' ? 7
              : name === 'lightPostModern' ? 6
              : rand(1.5, 2.5);
    const p = makeInstance(name, len);
    placeProp(p, rand(0, -300));
    scene.add(p);
    props.push(p);
  }
}

function placeProp(p, z) {
  const side = Math.random() < 0.5 ? -1 : 1;
  p.position.set(side * rand(ROAD_W / 2 + 3, ROAD_W / 2 + 36), 0, z);
  p.rotation.y = rand(0, Math.PI * 2);
}

function setPlayerCar(name) {
  if (playerGroup) scene.remove(playerGroup);
  playerGroup = makeInstance(name, 4.3);
  playerGroup.position.set(laneX(playerLane), 0, 0);
  scene.add(playerGroup);
}

// ------------------------------------------------------------
// Tráfego, pickups
// ------------------------------------------------------------
function spawnTraffic() {
  const usedLanes = new Set();
  const n = Math.random() < 0.4 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    let lane = randi(0, LANES - 1);
    if (usedLanes.has(lane)) continue;
    usedLanes.add(lane);
    const name = TRAFFIC_MODELS[randi(0, TRAFFIC_MODELS.length - 1)];
    const len = ['truck', 'van', 'ambulance', 'delivery'].includes(name) ? 5.4 : 4.3;
    const car = makeInstance(name, len);
    car.position.set(laneX(lane) + rand(-0.2, 0.2), 0, SPAWN_Z);
    car.userData.kmh = rand(45, 80);
    car.userData.lane = lane;
    car.userData.counted = false;
    car.userData.flying = null;
    scene.add(car);
    traffic.push(car);
  }
}

function spawnPickup(kind) {
  const obj = makeInstance(kind, kind === 'box' ? 1.6 : 0.9);
  obj.position.set(laneX(randi(0, LANES - 1)), kind === 'box' ? 0.8 : 0, SPAWN_Z);
  obj.userData.kind = kind;
  obj.userData.flying = null;
  scene.add(obj);
  pickups.push(obj);
}

// ------------------------------------------------------------
// HUD / overlays
// ------------------------------------------------------------
const $ = id => document.getElementById(id);
const hud = $('hud'), startEl = $('start'), goEl = $('gameover'), toastEl = $('toast');
let toastTimer = null;

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 800);
}

function updateHUD() {
  $('score').textContent = Math.floor(score).toLocaleString('pt-BR') + ' PTS';
  $('hiscore').textContent = 'RECORDE ' + Math.max(hiScore, Math.floor(score)).toLocaleString('pt-BR');
  $('speed').textContent = Math.round(speedKmh + speedOffset) + ' km/h';
  const t = $('turbo-label');
  if (turboT > 0) { t.className = 'hud-small turbo-on'; t.textContent = 'TURBO ' + turboT.toFixed(1) + 's'; }
  else { t.className = 'hud-small turbo-off'; t.textContent = 'TURBO'; }
}

// ------------------------------------------------------------
// Controles
// ------------------------------------------------------------
const keys = {};
window.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
  AudioSys.unlock();
  if (e.repeat) return;
  keys[e.key] = true;
  if (state === ST.PLAYING) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') steer(-1);
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') steer(1);
  }
  if (e.key === 'Enter') {
    if (state === ST.MENU) startRun();
    else if (state === ST.DEAD && deadT > 1.2) resetToMenu();
  }
  if (e.key === 'm' || e.key === 'M') AudioSys.toggleMute();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

// toque: metade esquerda/direita da tela troca de faixa
window.addEventListener('pointerdown', e => {
  AudioSys.unlock();
  if (state !== ST.PLAYING) return;
  if (e.target.closest('.overlay, button, a')) return;
  steer(e.clientX < window.innerWidth / 2 ? -1 : 1);
});

function steer(dir) {
  playerLane = clamp(playerLane + dir, 0, LANES - 1);
  AudioSys.play('click', 0.35);
}

// seleção de carro
document.querySelectorAll('.car-card').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.car-card').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    chosenCar = btn.dataset.car;
    setPlayerCar(chosenCar);
    AudioSys.play('click', 0.6);
  });
});
$('btn-start').addEventListener('click', () => { AudioSys.unlock(); startRun(); });
$('btn-retry').addEventListener('click', () => { AudioSys.unlock(); resetToMenu(true); });

// ------------------------------------------------------------
// Fluxo
// ------------------------------------------------------------
function startRun() {
  if (state === ST.PLAYING) return;
  state = ST.PLAYING;
  startEl.classList.add('hidden');
  goEl.classList.add('hidden');
  hud.classList.remove('hidden');

  // limpa o mundo
  for (const c of traffic) scene.remove(c);
  for (const p of pickups) scene.remove(p);
  traffic.length = 0; pickups.length = 0;

  playerLane = 1.5; playerX = laneX(playerLane);
  speedKmh = 70; speedOffset = 0;
  traveled = 0; spawnAcc = 0; boxAcc = 0; coneAcc = 0;
  score = 0; turboT = 0;
  setPlayerCar(chosenCar);
  playerGroup.rotation.set(0, 0, 0);
  AudioSys.play('confirm', 0.8);
  AudioSys.playMusic('drive');
}

function crash() {
  if (turboT > 0 || state !== ST.PLAYING) return;
  state = ST.DEAD;
  deadT = 0;
  AudioSys.play('crash', 1);
  AudioSys.play('explosion', 0.8);
  if (Math.floor(score) > hiScore) {
    hiScore = Math.floor(score);
    try { localStorage.setItem('turborush_hiscore', String(hiScore)); } catch (e) {}
  }
}

function showGameOver() {
  hud.classList.add('hidden');
  goEl.classList.remove('hidden');
  const s = Math.floor(score);
  $('go-stats').innerHTML =
    'PONTUAÇÃO: <b>' + s.toLocaleString('pt-BR') + '</b><br>' +
    'DISTÂNCIA: ' + Math.floor(traveled).toLocaleString('pt-BR') + ' m<br>' +
    (s >= hiScore && s > 0 ? '<span class="record">★ NOVO RECORDE!</span>'
                           : 'RECORDE: ' + hiScore.toLocaleString('pt-BR'));
  AudioSys.playMusic('gameover');
}

function resetToMenu(directStart = false) {
  state = ST.MENU;
  goEl.classList.add('hidden');
  AudioSys.stopMusic();
  if (directStart) startRun();
  else { startEl.classList.remove('hidden'); hud.classList.add('hidden'); }
}

// ------------------------------------------------------------
// Loop principal
// ------------------------------------------------------------
let lastT = 0;

function tick(ts) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016);
  lastT = ts;
  time += dt;

  if (state === ST.PLAYING) updateWorld(dt);
  else if (state === ST.DEAD) updateDeath(dt);
  else idleMenu(dt);

  renderer.render(scene, camera);
}

function idleMenu(dt) {
  // vitrine: carro gira devagar no menu
  if (playerGroup) playerGroup.rotation.y += dt * 0.6;
  camera.position.lerp(new THREE.Vector3(0, 3.2, 9), 0.04);
  camera.lookAt(0, 1, 0);
  moveWorld(8 * dt);   // cenário desliza devagar
}

function updateWorld(dt) {
  // velocidade cresce com o tempo
  speedKmh = Math.min(230, speedKmh + dt * 1.4);
  if (keys['ArrowUp'] || keys['w'] || keys['W']) speedOffset = Math.min(25, speedOffset + 40 * dt);
  else if (keys['ArrowDown'] || keys['s'] || keys['S']) speedOffset = Math.max(-30, speedOffset - 60 * dt);
  else speedOffset = lerp(speedOffset, 0, 2 * dt);

  turboT = Math.max(0, turboT - dt);
  const kmh = speedKmh + speedOffset + (turboT > 0 ? 75 : 0);
  const mps = kmh / 3.6;

  traveled += mps * dt;
  score += mps * dt * 0.6;
  if (Math.floor(score / 500) > Math.floor(lastScoreInt / 500)) AudioSys.play('click', 0.3);
  lastScoreInt = score;

  // posição lateral do jogador
  playerX = lerp(playerX, laneX(playerLane), 9 * dt);
  playerGroup.position.x = playerX;
  playerGroup.rotation.y = (laneX(playerLane) - playerX) * 0.14;
  playerGroup.rotation.z = (laneX(playerLane) - playerX) * 0.06;

  // câmera
  const targetFov = turboT > 0 ? 76 : 64;
  camera.fov = lerp(camera.fov, targetFov, 4 * dt);
  camera.updateProjectionMatrix();
  camera.position.lerp(new THREE.Vector3(playerX * 0.55, 5.4, 10), 6 * dt);
  camera.lookAt(playerX * 0.7, 1.2, -12);

  moveWorld(mps * dt);

  // tráfego
  for (let i = traffic.length - 1; i >= 0; i--) {
    const c = traffic[i];
    if (c.userData.flying) { animateFly(c, dt); if (c.position.y < -4) { scene.remove(c); traffic.splice(i, 1); } continue; }
    c.position.z += (mps - c.userData.kmh / 3.6) * dt;
    if (c.position.z > 14) { scene.remove(c); traffic.splice(i, 1); continue; }

    // quase-acidente
    if (!c.userData.counted && c.position.z > 3 && Math.abs(c.position.x - playerX) < 4.6) {
      c.userData.counted = true;
      score += 25;
      toast('QUASE! +25');
    }
    // colisão
    if (Math.abs(c.position.z) < c.userData.halfL + playerGroup.userData.halfL - 0.5 &&
        Math.abs(c.position.x - playerX) < 1.9) {
      if (turboT > 0) {
        c.userData.flying = { vy: 9, vr: rand(3, 7), vx: Math.sign(c.position.x - playerX || 1) * 6 };
        score += 200;
        toast('DEMOLIÇÃO! +200');
        AudioSys.play('crash', 0.7);
      } else crash();
    }
  }

  // pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if (p.userData.flying) { animateFly(p, dt); if (p.position.y < -4) { scene.remove(p); pickups.splice(i, 1); } continue; }
    p.position.z += mps * dt;
    if (p.userData.kind === 'box') { p.rotation.y += 2.5 * dt; p.position.y = 0.8 + Math.sin(time * 4) * 0.25; }
    if (p.position.z > 14) { scene.remove(p); pickups.splice(i, 1); continue; }
    if (Math.abs(p.position.z) < 2.6 && Math.abs(p.position.x - playerX) < 1.8) {
      if (p.userData.kind === 'box') {
        turboT = 4;
        toast('TURBO!');
        AudioSys.play('turbo', 0.9);
        scene.remove(p); pickups.splice(i, 1);
      } else {
        score += 75;
        toast('CONE! +75');
        AudioSys.play('swerve', 0.6);
        p.userData.flying = { vy: 8, vr: rand(5, 10), vx: rand(-4, 4) };
      }
    }
  }

  // spawns por distância percorrida
  spawnAcc += mps * dt; propAcc += mps * dt; boxAcc += mps * dt; coneAcc += mps * dt;
  const gap = Math.max(26, 58 - traveled / 90);
  if (spawnAcc > gap) { spawnAcc = 0; spawnTraffic(); }
  if (boxAcc > 420) { boxAcc = 0; spawnPickup('box'); }
  if (coneAcc > 160) { coneAcc = 0; spawnPickup('cone'); }

  updateHUD();
}

function animateFly(o, dt) {
  o.userData.flying.vy -= 25 * dt;
  o.position.y += o.userData.flying.vy * dt;
  o.position.x += o.userData.flying.vx * dt;
  o.rotation.x += o.userData.flying.vr * dt;
  o.rotation.z += o.userData.flying.vr * 0.7 * dt;
}

function moveWorld(dz) {
  for (const t of roadTiles) {
    t.position.z += dz;
    if (t.position.z > TILE_LEN + 10) t.position.z -= N_TILES * TILE_LEN;
  }
  for (const p of props) {
    p.position.z += dz;
    if (p.position.z > 20) placeProp(p, p.position.z - 320);
  }
}

function updateDeath(dt) {
  deadT += dt;
  // carro capota
  playerGroup.rotation.x += 7 * dt;
  playerGroup.rotation.y += 4 * dt;
  playerGroup.position.y = Math.max(0, Math.sin(Math.min(deadT * 3, Math.PI)) * 2.2);
  camera.position.x += rand(-0.1, 0.1);
  moveWorld((speedKmh / 3.6) * Math.max(0, 1 - deadT) * dt);
  if (deadT > 1.3 && goEl.classList.contains('hidden')) showGameOver();
}

// ------------------------------------------------------------
// Inicialização
// ------------------------------------------------------------
AudioSys.load();

Promise.all(MODELS.map(loadModel)).then(() => {
  buildRoad();
  buildProps();
  setPlayerCar(chosenCar);
  requestAnimationFrame(tick);
}).catch(err => {
  console.error('Erro ao carregar modelos:', err);
  document.body.insertAdjacentHTML('beforeend',
    '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-family:monospace;background:#1a1422;z-index:99">Erro ao carregar modelos 3D — verifique o console.</div>');
});

// handle de inspeção para testes automatizados
window.__TR = {
  get state() { return state; },
  get score() { return Math.floor(score); },
  get speed() { return Math.round(speedKmh + speedOffset); },
  get traffic() { return traffic.length; },
  get traveled() { return Math.floor(traveled); },
  get models() { return Object.keys(LIB).length; },
  start: () => startRun(),
};
