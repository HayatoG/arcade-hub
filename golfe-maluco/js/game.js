// ============================================================
// GOLFE MALUCO — minigolfe interplanetário em 12 buracos
// Three.js + Minigolf Kit (Kenney, CC0)
// Física própria: raycast de altura + reflexão em paredes
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from '../lib/loaders/GLTFLoader.js';

// ------------------------------------------------------------
// Constantes
// ------------------------------------------------------------
const R = 0.035;              // raio da bola (do GLB do kit)
const GRAV = 9.8;
const FLOOR_Y = 0.063;        // topo do gramado das peças
const FRIC_C = 0.30;          // atrito constante
const FRIC_L = 0.50;          // atrito linear (arrasto)
const REST_WALL = 0.74;       // restituição nas paredes
const MAX_SHOT = 4.4;         // velocidade máxima da tacada
const MIN_SHOT = 0.55;
const STOP_V = 0.07;          // abaixo disso a bola pode parar
const H = 1 / 240;            // passo fixo de física
const CUP_CATCH_D2 = 0.058 * 0.058;
const CUP_FAST = 1.35;        // acima disso a bola passa por cima do copo

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);

// ------------------------------------------------------------
// Cena ensolarada
// ------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fdcf5);
scene.fog = new THREE.Fog(0x9fdcf5, 14, 55);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 120);
camera.position.set(0, 2.4, 4);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.HemisphereLight(0xcfeaff, 0x7fb35a, 1.05));
const sun = new THREE.DirectionalLight(0xfff3d6, 2.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);
scene.add(sun.target);

// gramado infinito
const lawn = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshLambertMaterial({ color: 0x6fc05a })
);
lawn.rotation.x = -Math.PI / 2;
lawn.receiveShadow = true;
scene.add(lawn);

// nuvens fofas (decoração barata)
const clouds = [];
{
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const geo = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(k * 1.3 - 1.3 + rand(-0.2, 0.2), rand(-0.1, 0.2), rand(-0.4, 0.4));
      m.scale.set(rand(0.8, 1.3), 0.55, 0.8);
      g.add(m);
    }
    g.position.set(rand(-22, 22), rand(6, 10), rand(-22, 22));
    scene.add(g);
    clouds.push(g);
  }
}

// ------------------------------------------------------------
// Modelos
// ------------------------------------------------------------
const MODELS = ['ball-blue', 'block', 'start', 'straight', 'corner', 'end', 'open', 'side',
  'hole-round', 'ramp-medium', 'ramp-square', 'bump-walls', 'bump-down-walls',
  'tunnel-wide', 'tunnel-narrow', 'gap', 'hill-round', 'hill-square',
  'obstacle-diamond', 'windmill', 'castle', 'crest', 'flag-red', 'flag-blue',
  'narrow-block', 'narrow-round', 'narrow-square', 'split', 'split-start', 'split-walls-to-open'];
const LIB = {};
const loader = new GLTFLoader();

function loadModel(name) {
  return new Promise((resolve, reject) => {
    loader.load('assets/models/' + name + '.glb', g => {
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material && o.material.isMeshStandardMaterial && o.material.metalness > 0.4) {
          o.material.metalness = 0; o.material.roughness = 0.9;
        }
      });
      LIB[name] = g.scene;
      resolve();
    }, undefined, reject);
  });
}

// ------------------------------------------------------------
// Os 12 buracos — peças em grade de 1 unidade
// t: [modelo, x, z, rot] · rot em quartos de volta (rotation.y = r*PI/2)
// convenção: N = -z · corner r0 abre N+O · end r0 abre N · hole r2 abre S
// ------------------------------------------------------------
const HOLES = [
  { name: 'AQUECIMENTO', par: 2,
    t: [['end',0,4,0],['straight',0,3,0],['straight',0,2,0],['straight',0,1,0],['hole-round',0,0,2]],
    tee: [0, 4.1], cup: [0, 0],
    decor: [['start',0,5,0],['crest',-1.2,0.2,0],['flag-blue',1.3,1.4,0]] },

  { name: 'A CURVINHA', par: 2,
    t: [['end',0,3,0],['straight',0,2,0],['corner',0,1,2],['straight',1,1,1],['hole-round',2,1,1]],
    tee: [0, 3.1], cup: [2, 1],
    decor: [['crest',0,-0.2,0],['flag-blue',3.3,0.2,0]] },

  { name: 'ZIGUE-ZAGUE', par: 3,
    t: [['end',0,4,0],['straight',0,3,0],['narrow-square',0,2,0],['corner',0,1,2],
        ['straight',1,1,1],['corner',2,1,0],['straight',2,0,0],['hole-round',2,-1,2]],
    tee: [0, 4.1], cup: [2, -1],
    decor: [['crest',0.9,2.6,0],['flag-blue',-1.1,1,0]] },

  { name: 'CAMPO DE CALOMBOS', par: 3,
    t: [['end',0,5,0],['bump-walls',0,4,0],['bump-down-walls',0,3,0],['bump-walls',0,2,0],
        ['straight',0,1,0],['hole-round',0,0,2]],
    tee: [0, 5.1], cup: [0, 0],
    decor: [['start',0,6,0],['crest',1.2,3,0],['flag-blue',-1.3,1.4,0]] },

  { name: 'O PLATÔ', par: 3,
    t: [['end',0,4,0],['ramp-square',0,3,0],['corner',0,2,2],['ramp-square',1,2,1],
        ['straight',2,2,1],['hole-round',3,2,1]],
    tee: [0, 4.1], cup: [3, 2],
    decor: [['crest',0,1,0],['flag-blue',4.3,1.4,0]] },

  { name: 'FUNIL ESTREITO', par: 3,
    t: [['end',0,5,0],['narrow-round',0,4,0],['straight',0,3,0],['narrow-square',0,2,0],
        ['narrow-block',0,1,0],['hole-round',0,0,2]],
    tee: [0, 5.1], cup: [0, 0],
    decor: [['crest',-1.2,2,0],['flag-blue',1.2,0.4,0]] },

  { name: 'OS TÚNEIS', par: 3,
    t: [['end',0,6,0],['tunnel-wide',0,5,0],['straight',0,4,0],['corner',0,3,2],
        ['tunnel-narrow',1,3,1],['straight',2,3,1],['corner',3,3,0],
        ['tunnel-wide',3,2,0],['hole-round',3,1,2]],
    tee: [0, 6.1], cup: [3, 1],
    decor: [['crest',1.5,4.4,0],['flag-blue',-1.3,3,0]] },

  { name: 'SALTO MORTAL', par: 3,
    t: [['end',0,6,0],['straight',0,5,0],['straight',0,4,0],['ramp-medium',0,3,2],
        ['gap',0,2,0],['straight',0,1,0],['hole-round',0,0,2]],
    tee: [0, 6.1], cup: [0, 0],
    decor: [['start',0,7,0],['crest',-1.2,2,0],['crest',1.2,2,0],['flag-blue',1.3,3.2,0]] },

  { name: 'O MOINHO', par: 3,
    t: [['end',0,5,0],['straight',0,4,0],['straight',0,3,0],['windmill',0,2,2],
        ['straight',0,1,0],['hole-round',0,0,2]],
    tee: [0, 5.1], cup: [0, 0],
    dyn: [{ type: 'mill', x: 0, z: 2, r: 2, speed: 1.7 }],
    decor: [['crest',-1.3,2,0],['flag-blue',1.4,2,0]] },

  { name: 'BLOCOS TRAVESSOS', par: 4,
    t: [['end',0,7,0],['straight',0,6,0],
        ['corner',-1,5,3],['open',0,5,0],['corner',1,5,0],
        ['side',-1,4,2],['obstacle-diamond',0,4,0],['side',1,4,0],
        ['corner',-1,3,2],['open',0,3,0],['corner',1,3,1],
        ['straight',0,2,0],['hole-round',0,1,2]],
    tee: [0, 7.1], cup: [0, 1],
    dyn: [{ type: 'block', cx: 0, z: 4.62, amp: 0.96, speed: 1.5, phase: 0 },
          { type: 'block', cx: 0, z: 3.38, amp: 0.96, speed: 1.9, phase: 2.1 }],
    decor: [['crest',-1.6,6.4,0],['flag-blue',1.7,2.2,0]] },

  { name: 'COLINAS DIVIDIDAS', par: 4,
    t: [['end',0,7,0],['straight',0,6,0],['hill-round',0,5,0],['split-start',0,4,2],
        ['split',0,3,0],['split-walls-to-open',0,2,2],['hill-square',0,1,0],['hole-round',0,0,2]],
    tee: [0, 7.1], cup: [0, 0],
    decor: [['start',0,8,0],['crest',1.2,3.5,0],['flag-blue',-1.3,4,0]] },

  { name: 'GRANDE FINALE', par: 5,
    t: [['end',0,9,0],['straight',0,8,0],['castle',0,7,0],['straight',0,6,0],
        ['windmill',0,5,2],['straight',0,4,0],['ramp-medium',0,3,2],['gap',0,2,0],
        ['straight',0,1,0],['corner',0,0,2],['straight',1,0,1],['hole-round',2,0,1]],
    tee: [0, 9.1], cup: [2, 0],
    dyn: [{ type: 'mill', x: 0, z: 5, r: 2, speed: 2.1 }],
    decor: [['start',0,10,0],['crest',-1.3,7,0],['crest',1.3,7,0],
            ['flag-blue',-1.3,5,0],['flag-blue',3.3,-0.9,0]] },
];
const PAR_TOTAL = HOLES.reduce((s, h) => s + h.par, 0);

// ------------------------------------------------------------
// Estado
// ------------------------------------------------------------
const ST = { MENU: 0, PAN: 1, AIM: 2, ROLLING: 3, HOLED: 4, END: 5 };
let state = ST.MENU;
let holeIdx = 0, strokes = 0, totalStrokes = 0;
let scores = [];
let oobCount = 0;

function loadRecord() { try { const v = parseInt(localStorage.getItem('golfe_record') || '', 10); return Number.isFinite(v) ? v : 0; } catch (e) { return 0; } }
function saveRecord(total) {
  try {
    const cur = loadRecord();
    if (!cur || total < cur) { localStorage.setItem('golfe_record', String(total)); return true; }
  } catch (e) {}
  return false;
}

// ------------------------------------------------------------
// Curso (reconstruído a cada buraco)
// ------------------------------------------------------------
let courseGroup = null, decorGroup = null;
const collidables = [];          // meshes estáticos para raycast
const mills = [];                // colisores analíticos do moinho
const blocks = [];               // blocos deslizantes
let cup = new THREE.Vector3();
let tee = new THREE.Vector3();
let flagMesh = null, flagBaseY = 0;
let courseCenter = new THREE.Vector3();
let courseRadius = 4;

const BLADE_SCALE = 1.48, BLADE_LEN = 0.88, BLADE_HALF_W = 0.105, BLADE_Z = -0.446, HUB_Y = 0.957;

function buildHole(idx) {
  if (courseGroup) { scene.remove(courseGroup); scene.remove(decorGroup); }
  courseGroup = new THREE.Group();
  decorGroup = new THREE.Group();
  collidables.length = 0; mills.length = 0; blocks.length = 0;

  const def = HOLES[idx];
  const minB = new THREE.Vector3(1e9, 0, 1e9), maxB = new THREE.Vector3(-1e9, 0, -1e9);
  const bladesAt = [];   // [{x, z, mesh}] pás de cada moinho construído

  for (const [m, x, z, r] of def.t) {
    const piece = LIB[m].clone(true);
    piece.position.set(x, 0, z);
    piece.rotation.y = r * Math.PI / 2;
    courseGroup.add(piece);
    piece.traverse(o => {
      if (!o.isMesh) return;
      if (o.name === 'blades') {
        o.scale.setScalar(BLADE_SCALE);     // pás alongadas: varrem a pista de verdade
        o.userData.isBlades = true;
        bladesAt.push({ x, z, mesh: o });
      } else collidables.push(o);
    });
    minB.x = Math.min(minB.x, x - 0.5); minB.z = Math.min(minB.z, z - 0.5);
    maxB.x = Math.max(maxB.x, x + 0.5); maxB.z = Math.max(maxB.z, z + 0.5);
  }

  for (const [m, x, z, r] of (def.decor || [])) {
    const piece = LIB[m].clone(true);
    piece.position.set(x, 0, z);
    piece.rotation.y = r * Math.PI / 2;
    decorGroup.add(piece);
  }

  // bandeira vermelha no copo
  flagMesh = LIB['flag-red'].clone(true);
  flagMesh.position.set(def.cup[0], 0.02, def.cup[1]);
  flagBaseY = 0.02;
  decorGroup.add(flagMesh);

  // dinâmicos
  for (const d of (def.dyn || [])) {
    if (d.type === 'mill') {
      const found = bladesAt.find(b => Math.abs(b.x - d.x) < 0.01 && Math.abs(b.z - d.z) < 0.01);
      mills.push({ x: d.x, z: d.z, theta: d.r * Math.PI / 2, speed: d.speed, blades: found ? found.mesh : null, cool: 0 });
    } else if (d.type === 'block') {
      const m = LIB['block'].clone(true);
      m.scale.set(0.42, 0.95, 0.42);
      m.position.set(d.cx, 0.001, d.z);
      courseGroup.add(m);
      blocks.push({ mesh: m, cx: d.cx, z: d.z, amp: d.amp, speed: d.speed, phase: d.phase, x: d.cx, vx: 0, cool: 0 });
    }
  }

  scene.add(courseGroup);
  scene.add(decorGroup);
  scene.updateMatrixWorld(true);
  courseGroup.traverse(o => { if (o.isMesh && !o.userData.isBlades) o.matrixAutoUpdate = false; });

  cup.set(def.cup[0], FLOOR_Y, def.cup[1]);
  tee.set(def.tee[0], FLOOR_Y + R, def.tee[1]);
  courseCenter.set((minB.x + maxB.x) / 2, 0, (minB.z + maxB.z) / 2);
  courseRadius = Math.max(maxB.x - minB.x, maxB.z - minB.z) / 2 + 1;

  // sol e sombras enquadram o buraco
  sun.position.set(courseCenter.x + 3, 6.5, courseCenter.z + 4);
  sun.target.position.copy(courseCenter);
  const d = courseRadius + 1.5;
  sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
  sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 20;
  sun.shadow.camera.updateProjectionMatrix();
}

// ------------------------------------------------------------
// Bola
// ------------------------------------------------------------
let ballMesh = null;
const ball = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(),
  grounded: true, lastVy: 0, settle: 0, slowTime: 0,
  groundNx: 0, groundNy: 1, groundNz: 0,
};
const lastRest = new THREE.Vector3();

function resetBallTo(p) {
  ball.pos.copy(p);
  ball.vel.set(0, 0, 0);
  ball.grounded = true; ball.lastVy = 0; ball.settle = 0; ball.slowTime = 0;
  ball.groundNx = 0; ball.groundNy = 1; ball.groundNz = 0;
  ballMesh.position.copy(p);
  ballMesh.scale.setScalar(1);
}

// ------------------------------------------------------------
// Física — raycasts reutilizados, zero alocação no loop
// ------------------------------------------------------------
const ray = new THREE.Raycaster();
const hits = [];
const vDown = new THREE.Vector3(0, -1, 0);
const vOrig = new THREE.Vector3();
const vDir = new THREE.Vector3();
const vN = new THREE.Vector3();
const nrmMat = new THREE.Matrix3();
let bounceCool = 0;
let millHitCount = 0;

function groundAt(x, y, z) {
  // retorna altura e normal do chão sob (x,z); -1 se vazio
  vOrig.set(x, y + 0.09, z);
  ray.set(vOrig, vDown);
  ray.far = 8;
  hits.length = 0;
  ray.intersectObjects(collidables, false, hits);
  if (!hits.length) return -1;
  const h = hits[0];
  vN.copy(h.face.normal);
  nrmMat.getNormalMatrix(h.object.matrixWorld);
  vN.applyMatrix3(nrmMat).normalize();
  if (vN.y < 0) vN.negate();
  return h.point.y;
}

function wallSweep() {
  // reflete a bola nas paredes (normal ~horizontal); até 2 reflexões por passo
  let sp = Math.hypot(ball.vel.x, ball.vel.z);
  for (let iter = 0; iter < 2 && sp > 1e-4; iter++) {
    vDir.set(ball.vel.x / sp, 0, ball.vel.z / sp);
    vOrig.copy(ball.pos);
    ray.set(vOrig, vDir);
    ray.far = R + 0.014 + sp * H;
    hits.length = 0;
    ray.intersectObjects(collidables, false, hits);
    if (!hits.length) return;
    const h = hits[0];
    vN.copy(h.face.normal);
    nrmMat.getNormalMatrix(h.object.matrixWorld);
    vN.applyMatrix3(nrmMat).normalize();
    if (Math.abs(vN.y) > 0.55) return;          // é chão/rampa, não parede
    vN.y = 0; vN.normalize();
    const dot = ball.vel.x * vN.x + ball.vel.z * vN.z;
    if (dot >= 0) return;
    ball.vel.x -= (1 + REST_WALL) * dot * vN.x;
    ball.vel.z -= (1 + REST_WALL) * dot * vN.z;
    ball.vel.x *= 0.985; ball.vel.z *= 0.985;
    ball.pos.x = h.point.x + vN.x * (R + 0.004);
    ball.pos.z = h.point.z + vN.z * (R + 0.004);
    if (-dot > 0.55 && bounceCool <= 0) {
      AudioSys.play('bounce', clamp(-dot * 0.32, 0.12, 0.85));
      bounceCool = 0.09;
    }
    sp = Math.hypot(ball.vel.x, ball.vel.z);
  }
}

const WHISK = [[Math.cos(1.15), Math.sin(1.15)], [Math.cos(-1.15), Math.sin(-1.15)]];
function whiskers() {
  // raios laterais: evitam afundar em quinas durante deslizes rasantes
  const sp = Math.hypot(ball.vel.x, ball.vel.z);
  if (sp < 1e-4) return;
  const dx = ball.vel.x / sp, dz = ball.vel.z / sp;
  for (let w = 0; w < 2; w++) {
    const [c, s] = WHISK[w];
    vDir.set(dx * c - dz * s, 0, dx * s + dz * c);
    vOrig.copy(ball.pos);
    ray.set(vOrig, vDir);
    ray.far = R + 0.004;
    hits.length = 0;
    ray.intersectObjects(collidables, false, hits);
    if (!hits.length) continue;
    const h = hits[0];
    vN.copy(h.face.normal);
    nrmMat.getNormalMatrix(h.object.matrixWorld);
    vN.applyMatrix3(nrmMat).normalize();
    if (Math.abs(vN.y) > 0.55) continue;
    vN.y = 0; vN.normalize();
    const pen = (R + 0.004) - h.distance;
    if (pen > 0) {
      ball.pos.x += vN.x * pen;
      ball.pos.z += vN.z * pen;
      const dot = ball.vel.x * vN.x + ball.vel.z * vN.z;
      if (dot < 0) { ball.vel.x -= dot * vN.x; ball.vel.z -= dot * vN.z; }
    }
  }
}

function millCollide(mill) {
  // colisor analítico das pás (giram no plano XY local em z = BLADE_Z)
  if (mill.cool > 0 || !mill.blades) return;
  const c = Math.cos(-mill.theta), s = Math.sin(-mill.theta);
  const wx = ball.pos.x - mill.x, wz = ball.pos.z - mill.z;
  const lx = c * wx + s * wz;
  const lz = -s * wx + c * wz;
  if (Math.abs(lz - BLADE_Z) > 0.068 * BLADE_SCALE + R) return;
  if (Math.abs(lx) > BLADE_LEN + 0.1) return;
  const rot = mill.blades.rotation.z;
  const py = ball.pos.y - HUB_Y;             // bola no plano XY local do cubo da pá
  for (let k = 0; k < 4; k++) {
    const a = rot + k * Math.PI / 2;
    const ux = Math.cos(a), uy = Math.sin(a);
    let t = lx * ux + py * uy;               // projeção no braço da pá
    t = clamp(t, 0, BLADE_LEN);
    const ex = lx - ux * t, ey = py - uy * t;
    if (Math.hypot(ex, ey) > BLADE_HALF_W + R) continue;
    // bateu! empurra de volta ao longo da pista + chute lateral da pá
    const side = (lz - BLADE_Z) >= 0 ? 1 : -1;
    let vlx = c * ball.vel.x + s * ball.vel.z;
    let vlz = -s * ball.vel.x + c * ball.vel.z;
    vlz = side * Math.max(0.65, Math.abs(vlz) * 0.8);
    vlx += (-uy) * mill.speed * t * 0.5;
    const nlz = BLADE_Z + side * (0.068 * BLADE_SCALE + R + 0.01);
    // volta ao mundo
    const cc = Math.cos(mill.theta), ss = Math.sin(mill.theta);
    ball.vel.x = cc * vlx + ss * vlz;
    ball.vel.z = -ss * vlx + cc * vlz;
    ball.pos.x = mill.x + cc * lx + ss * nlz;
    ball.pos.z = mill.z + -ss * lx + cc * nlz;
    const spd = Math.hypot(ball.vel.x, ball.vel.z);
    if (spd > 5) { ball.vel.x *= 5 / spd; ball.vel.z *= 5 / spd; }
    mill.cool = 0.14;
    millHitCount++;
    AudioSys.play('bounce2', 0.7);
    return;
  }
}

function blockCollide(b) {
  const hx = 0.21 + R, hz = 0.21 + R;
  const dx = ball.pos.x - b.x, dz = ball.pos.z - b.z;
  const px = hx - Math.abs(dx), pz = hz - Math.abs(dz);
  if (px <= 0 || pz <= 0 || ball.pos.y > 0.16) return;
  const sx = dx >= 0 ? 1 : -1, sz = dz >= 0 ? 1 : -1;
  if (px < pz) {
    ball.pos.x = b.x + sx * hx;
    const rel = ball.vel.x - b.vx;
    if (rel * sx < 0) ball.vel.x = b.vx - rel * 0.6;
    if ((ball.vel.x - b.vx) * sx < 0.12) ball.vel.x = b.vx + sx * 0.12;
  } else {
    ball.pos.z = b.z + sz * hz;
    if (ball.vel.z * sz < 0) ball.vel.z = -ball.vel.z * 0.65;
    if (Math.abs(ball.vel.z) < 0.2) ball.vel.z = sz * 0.2;
  }
  if (b.cool <= 0) { AudioSys.play('bounce2', 0.5); b.cool = 0.15; }
}

function physicsStep() {
  const sp2 = ball.vel.x * ball.vel.x + ball.vel.z * ball.vel.z;
  const sp = Math.sqrt(sp2);

  if (ball.grounded) {
    // gravidade projetada na rampa + atrito
    ball.vel.x += GRAV * ball.groundNx * ball.groundNy * H;
    ball.vel.z += GRAV * ball.groundNz * ball.groundNy * H;
    if (sp > 0) {
      const dec = (FRIC_C + FRIC_L * sp) * H;
      const ns = Math.max(0, sp - dec);
      const f = sp > 1e-6 ? ns / sp : 0;
      ball.vel.x *= f; ball.vel.z *= f;
    }
  } else {
    ball.lastVy -= GRAV * H;
  }

  // movimento horizontal + paredes
  ball.pos.x += ball.vel.x * H;
  ball.pos.z += ball.vel.z * H;
  wallSweep();
  whiskers();

  // dinâmicos
  for (const m of mills) millCollide(m);
  for (const b of blocks) blockCollide(b);

  // chão
  const prevY = ball.pos.y;
  let gy = groundAt(ball.pos.x, ball.pos.y, ball.pos.z);

  // sobre o copo em alta velocidade: ignora a depressão (passa reto)
  const cdx = ball.pos.x - cup.x, cdz = ball.pos.z - cup.z;
  const cupD2 = cdx * cdx + cdz * cdz;
  const spdNow = Math.hypot(ball.vel.x, ball.vel.z);
  if (cupD2 < 0.0056 && spdNow >= CUP_FAST && gy >= 0) gy = Math.max(gy, FLOOR_Y);

  if (ball.grounded) {
    if (gy < 0) {
      ball.grounded = false;            // saiu da pista: cai
      ball.lastVy = clamp(ball.lastVy, -1.5, 3);
    } else {
      const want = gy + R;
      if (want >= ball.pos.y - 0.05) {
        ball.pos.y = want;
        ball.lastVy = clamp((ball.pos.y - prevY) / H, -3, 3);
        // normal do chão (cacheada p/ rampa)
        ball.groundNx = vN.x; ball.groundNy = vN.y; ball.groundNz = vN.z;
      } else {
        ball.grounded = false;          // borda/cliff: vira projétil
        ball.lastVy = clamp(ball.lastVy, -1.5, 3);
      }
    }
  } else {
    ball.pos.y += ball.lastVy * H;
    if (gy >= 0 && ball.pos.y <= gy + R) {
      if (ball.lastVy < -0.6) {
        ball.pos.y = gy + R + 0.001;
        ball.lastVy = -ball.lastVy * 0.42;
        ball.vel.x *= 0.88; ball.vel.z *= 0.88;
        if (bounceCool <= 0) { AudioSys.play('bounce', clamp(-ball.lastVy * 0.4, 0.15, 0.8)); bounceCool = 0.09; }
      } else {
        ball.pos.y = gy + R;
        ball.grounded = true;
        ball.lastVy = 0;
        ball.groundNx = vN.x; ball.groundNy = vN.y; ball.groundNz = vN.z;
      }
    }
  }

  // ímã suave do copo
  if (cupD2 < 0.0081 && spdNow < 1.6 && spdNow > 0.01 && ball.grounded) {
    ball.vel.x -= cdx * 1.4 * H;
    ball.vel.z -= cdz * 1.4 * H;
  }

  // embocou!
  if (state === ST.ROLLING && cupD2 < CUP_CATCH_D2 && spdNow < CUP_FAST && ball.pos.y < FLOOR_Y + R + 0.04) {
    holeIn();
    return;
  }

  // fora do campo
  if (ball.pos.y < -0.05 ||
      Math.abs(ball.pos.x - courseCenter.x) > courseRadius + 4 ||
      Math.abs(ball.pos.z - courseCenter.z) > courseRadius + 4) {
    outOfBounds();
    return;
  }

  // parada total (+ vigia anti-jitter: bola encostada em bisel de parede)
  const fast2 = ball.vel.x * ball.vel.x + ball.vel.z * ball.vel.z;
  if (ball.grounded && fast2 < 0.18 * 0.18) ball.slowTime += H;
  else ball.slowTime = 0;
  const settled = ball.grounded && fast2 < STOP_V * STOP_V && ball.groundNy > 0.95;
  if (settled || ball.slowTime > 2.2) {
    ball.settle += H;
    if (ball.settle > 0.25 || ball.slowTime > 2.2) {
      ball.vel.set(0, 0, 0);
      ball.settle = 0; ball.slowTime = 0;
      if (state === ST.ROLLING) ballStopped();
    }
  } else ball.settle = 0;
}

// ------------------------------------------------------------
// Fluxo da partida
// ------------------------------------------------------------
const $ = id => document.getElementById(id);
let announceTimer = null;
function announce(msg, dur = 1600, color = '#fdfaf2') {
  const el = $('announce');
  el.textContent = msg;
  el.style.color = color;
  el.classList.add('show');
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => el.classList.remove('show'), dur);
}

function relStr(d) {
  if (d === 0) return '0';
  return d > 0 ? '+' + d : '−' + (-d);
}

function totalRel() {
  let rel = 0;
  for (let i = 0; i < scores.length; i++) rel += scores[i] - HOLES[i].par;
  return rel;
}

function updateHUD() {
  const def = HOLES[holeIdx];
  $('hole-label').textContent = 'BURACO ' + (holeIdx + 1) + ' · PAR ' + def.par;
  $('strokes').textContent = 'tacadas: ' + strokes + ' / ' + (def.par + 4);
  $('total').textContent = 'TOTAL ' + relStr(totalRel());
  const rec = loadRecord();
  $('record-live').textContent = rec ? 'recorde: ' + rec + ' tacadas' : '';
}

// câmera
let camTheta = 0, camPitch = 0.46, camDist = 2.6;
let panT = 0, panDur = 2.8;
const panFrom = new THREE.Vector3(), panLookFrom = new THREE.Vector3();
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

function idealCam(out) {
  out.set(
    ball.pos.x + Math.sin(camTheta) * Math.cos(camPitch) * camDist,
    ball.pos.y + Math.sin(camPitch) * camDist,
    ball.pos.z + Math.cos(camTheta) * Math.cos(camPitch) * camDist
  );
  if (out.y < 0.3) out.y = 0.3;
}

function recenterCam() {
  camTheta = Math.atan2(ball.pos.x - cup.x, ball.pos.z - cup.z);
}

let holeTimer = null;

function startHole(idx) {
  clearTimeout(holeTimer);
  holeIdx = idx;
  strokes = 0;
  buildHole(idx);
  resetBallTo(tee);
  lastRest.copy(tee);
  recenterCam();
  camPitch = 0.46;
  state = ST.PAN;
  panT = 0;
  // panorâmica: da bandeira até a bola
  tmpA.set(tee.x - cup.x, 0, tee.z - cup.z).normalize();
  panFrom.set(cup.x + tmpA.x * 1.3, 1.7, cup.z + tmpA.z * 1.3);
  panLookFrom.copy(cup);
  camPos.copy(panFrom);
  const def = HOLES[idx];
  announce('BURACO ' + (idx + 1) + ' · PAR ' + def.par + '\n' + def.name, 2400, '#ffc93e');
  updateHUD();
}

function shoot(dx, dz, speed) {
  const n = Math.hypot(dx, dz);
  if (n < 1e-6) return;
  ball.vel.set(dx / n * speed, 0, dz / n * speed);
  lastRest.copy(ball.pos);
  strokes++;
  totalStrokes++;
  state = ST.ROLLING;
  AudioSys.play('hit', clamp(0.3 + speed / MAX_SHOT * 0.7, 0, 1));
  updateHUD();
}

function ballStopped() {
  const def = HOLES[holeIdx];
  if (strokes >= def.par + 4) {
    announce('LIMITE DE TACADAS!', 1600, '#ff9b7a');
    finishHole(false);
  } else {
    state = ST.AIM;
  }
}

function outOfBounds() {
  AudioSys.play('oob', 0.6);
  strokes++;
  totalStrokes++;
  announce('FORA DO CAMPO! +1', 1500, '#ff9b7a');
  oobCount++;
  resetBallTo(lastRest);
  const def = HOLES[holeIdx];
  if (strokes >= def.par + 4) finishHole(false);
  else state = ST.AIM;
  updateHUD();
}

const SCORE_NAMES = [
  [s => s === 1, 'ACE! BURACO EM UM!', '#ffc93e', 'jingleGreat'],
  [(s, d) => d <= -3, 'ALBATROZ!', '#ffc93e', 'jingleGreat'],
  [(s, d) => d === -2, 'EAGLE!', '#ffa53e', 'jingleGreat'],
  [(s, d) => d === -1, 'BIRDIE!', '#7ed957', 'jingleGreat'],
  [(s, d) => d === 0, 'PAR!', '#fdfaf2', 'jingleGood'],
  [(s, d) => d === 1, 'BOGEY', '#f4ecd2', 'jingleGood'],
  [(s, d) => d === 2, 'BOGEY DUPLO', '#ffb89b', null],
];

function holeIn() {
  state = ST.HOLED;
  AudioSys.play('coin', 0.8);
  ball.vel.set(0, 0, 0);
  const def = HOLES[holeIdx];
  const d = strokes - def.par;
  let label = '+' + d, color = '#ff9b7a', jingle = null;
  for (const [test, l, c, j] of SCORE_NAMES) {
    if (test(strokes, d)) { label = l; color = c; jingle = j; break; }
  }
  setTimeout(() => {
    announce(label, 1900, color);
    if (jingle) AudioSys.play(jingle, 0.75);
    confettiBurst(cup.x, FLOOR_Y + 0.1, cup.z, d <= 0 ? 130 : 60);
  }, 380);
  finishHole(true);
}

function finishHole(holed) {
  scores[holeIdx] = strokes;
  updateHUD();
  const delay = holed ? 2400 : 1700;
  clearTimeout(holeTimer);
  holeTimer = setTimeout(() => {
    if (state !== ST.HOLED && state !== ST.AIM && state !== ST.ROLLING) return;
    if (holeIdx + 1 < HOLES.length) startHole(holeIdx + 1);
    else endTournament();
  }, delay);
  if (!holed) state = ST.HOLED; // trava entrada até o próximo buraco
}

function startGame() {
  scores = [];
  totalStrokes = 0;
  oobCount = 0;
  $('menu').classList.add('hidden');
  $('end').classList.add('hidden');
  $('hud').classList.remove('hidden');
  AudioSys.play('confirm', 0.7);
  AudioSys.playMusic('game');
  startHole(0);
}

function endTournament() {
  state = ST.END;
  const complete = scores.length === HOLES.length && scores.every(s => Number.isFinite(s));
  const total = scores.reduce((a, b) => a + (b || 0), 0);
  const rel = total - PAR_TOTAL;
  const isRecord = complete && saveRecord(total);
  const rec = loadRecord();

  // estrelas: abaixo do par = 3 · até +6 = 2 · resto = 1
  const stars = rel <= 0 ? 3 : (rel <= 6 ? 2 : 1);
  $('stars').innerHTML = '★'.repeat(stars) + '<span class="off">' + '★'.repeat(3 - stars) + '</span>';
  $('end-title').textContent = isRecord ? 'NOVO RECORDE!' : (rel <= 0 ? 'CAMPEÃO DA GALÁXIA!' : 'FIM DO TORNEIO');

  let h1 = '<tr><th>BURACO</th>', h2 = '<tr><th>PAR</th>', h3 = '<tr><th>VOCÊ</th>';
  for (let i = 0; i < HOLES.length; i++) {
    h1 += '<th>' + (i + 1) + '</th>';
    h2 += '<td>' + HOLES[i].par + '</td>';
    const sc = Number.isFinite(scores[i]) ? scores[i] : null;
    const cls = sc === null ? '' : (sc < HOLES[i].par ? 'under' : (sc > HOLES[i].par ? 'over' : ''));
    h3 += '<td class="' + cls + '">' + (sc === null ? '—' : sc) + '</td>';
  }
  h1 += '<th>TOT</th></tr>'; h2 += '<td class="tot">' + PAR_TOTAL + '</td></tr>';
  h3 += '<td class="tot">' + total + '</td></tr>';
  $('scorecard').innerHTML = '<table>' + h1 + h2 + h3 + '</table>';
  $('end-stats').innerHTML = 'total: <b>' + total + ' tacadas</b> (' + relStr(rel) + ' do par)' +
    '<br>recorde: ' + (rec ? rec + ' tacadas' : '—') + (isRecord ? ' · <b>NOVO!</b>' : '');

  $('hud').classList.add('hidden');
  $('end').classList.remove('hidden');
  AudioSys.playMusic('gameover');
  if (isRecord) setTimeout(() => AudioSys.play('jingleRecord', 0.8), 600);
}

// ------------------------------------------------------------
// Mira estilingue + medidor + linha pontilhada
// ------------------------------------------------------------
let aiming = false, orbiting = false;
let aimPower = 0;
const aimDir = new THREE.Vector3();
const dragStart = { x: 0, y: 0 };
const lastPtr = { x: 0, y: 0 };

const aimGroup = new THREE.Group();
scene.add(aimGroup);
const arrowMat = new THREE.MeshBasicMaterial({ color: 0x7ed957 });
const shaftGeo = new THREE.BoxGeometry(0.022, 0.006, 1);
shaftGeo.translate(0, 0, 0.5);
const shaft = new THREE.Mesh(shaftGeo, arrowMat);
const head = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.11, 10), arrowMat);
head.rotation.x = Math.PI / 2;
aimGroup.add(shaft);
aimGroup.add(head);
aimGroup.visible = false;

const dots = [];
{
  const g = new THREE.SphereGeometry(0.013, 8, 6);
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 - i * 0.06 }));
    m.visible = false;
    scene.add(m);
    dots.push(m);
  }
}

function hideAim() {
  aimGroup.visible = false;
  for (const d of dots) d.visible = false;
  $('power-wrap').classList.add('hidden');
}

const projV = new THREE.Vector3();
function ballScreenPos() {
  projV.copy(ball.pos).project(camera);
  return {
    x: (projV.x * 0.5 + 0.5) * window.innerWidth,
    y: (-projV.y * 0.5 + 0.5) * window.innerHeight,
  };
}

function updateAimVisual() {
  if (aimPower < 0.05) { hideAim(); return; }
  const len = 0.22 + aimPower * 0.95;
  aimGroup.position.set(ball.pos.x, ball.pos.y - R + 0.015, ball.pos.z);
  aimGroup.rotation.y = Math.atan2(aimDir.x, aimDir.z);
  shaft.scale.z = len;
  head.position.set(0, 0, len);
  arrowMat.color.setHSL(lerp(0.33, 0.0, aimPower), 0.9, 0.55);
  aimGroup.visible = true;

  // linha pontilhada de prévia segue o terreno
  const reach = 0.45 + aimPower * 2.4;
  for (let i = 0; i < dots.length; i++) {
    const t = (i + 1) / dots.length * reach;
    const x = ball.pos.x + aimDir.x * t;
    const z = ball.pos.z + aimDir.z * t;
    const gy = groundAt(x, ball.pos.y + 0.4, z);
    if (gy < 0) { dots[i].visible = false; continue; }
    dots[i].position.set(x, gy + 0.018, z);
    dots[i].visible = true;
  }
  $('power-wrap').classList.remove('hidden');
  $('power-fill').style.width = (aimPower * 100).toFixed(0) + '%';
}

function computeAim(px, py) {
  const dx = px - dragStart.x, dy = py - dragStart.y;
  const lenPx = Math.hypot(dx, dy);
  aimPower = clamp(lenPx / (Math.min(window.innerWidth, window.innerHeight) * 0.42), 0, 1);
  // direção no mundo: puxar para trás = atirar para frente (estilingue)
  tmpA.set(ball.pos.x - camera.position.x, 0, ball.pos.z - camera.position.z).normalize(); // frente
  tmpB.set(-tmpA.z, 0, tmpA.x);  // direita da tela
  aimDir.set(tmpA.x * dy - tmpB.x * dx, 0, tmpA.z * dy - tmpB.z * dx);
  if (aimDir.lengthSq() > 1e-8) aimDir.normalize();
}

window.addEventListener('pointerdown', e => {
  AudioSys.unlock();
  if (e.target.closest('.overlay, button, a')) return;
  if (state === ST.PAN) { panT = panDur; return; }   // pular panorâmica
  lastPtr.x = e.clientX; lastPtr.y = e.clientY;
  if (state !== ST.AIM) { orbiting = true; return; }
  const bp = ballScreenPos();
  const near = Math.hypot(e.clientX - bp.x, e.clientY - bp.y) <
    Math.max(95, Math.min(window.innerWidth, window.innerHeight) * 0.11);
  if (near) {
    aiming = true;
    aimPower = 0;
    dragStart.x = e.clientX; dragStart.y = e.clientY;
  } else orbiting = true;
});

window.addEventListener('pointermove', e => {
  if (aiming) {
    computeAim(e.clientX, e.clientY);
    updateAimVisual();
  } else if (orbiting) {
    camTheta -= (e.clientX - lastPtr.x) * 0.006;
    camPitch = clamp(camPitch + (e.clientY - lastPtr.y) * 0.004, 0.18, 1.15);
  }
  lastPtr.x = e.clientX; lastPtr.y = e.clientY;
});

window.addEventListener('pointerup', () => {
  if (aiming) {
    aiming = false;
    if (aimPower > 0.06 && state === ST.AIM) {
      shoot(aimDir.x, aimDir.z, MIN_SHOT + aimPower * (MAX_SHOT - MIN_SHOT));
    }
    hideAim();
  }
  orbiting = false;
});

window.addEventListener('wheel', e => {
  camDist = clamp(camDist + e.deltaY * 0.002, 1.3, 4.5);
}, { passive: true });

window.addEventListener('keydown', e => {
  AudioSys.unlock();
  if (e.key === 'Enter') {
    if (state === ST.MENU || state === ST.END) startGame();
  }
  if (e.key === 'r' || e.key === 'R') recenterCam();
  if (e.key === 'm' || e.key === 'M') AudioSys.toggleMute();
});

$('btn-start').addEventListener('click', () => { AudioSys.unlock(); startGame(); });
$('btn-retry').addEventListener('click', () => { AudioSys.unlock(); startGame(); });

// ------------------------------------------------------------
// Confete (pool com InstancedMesh — zero alocação por quadro)
// ------------------------------------------------------------
const CONF_N = 130;
const confetti = {
  mesh: null, active: 0,
  px: new Float32Array(CONF_N), py: new Float32Array(CONF_N), pz: new Float32Array(CONF_N),
  vx: new Float32Array(CONF_N), vy: new Float32Array(CONF_N), vz: new Float32Array(CONF_N),
  rx: new Float32Array(CONF_N), rz: new Float32Array(CONF_N),
  life: new Float32Array(CONF_N),
};
const confDummy = new THREE.Object3D();
const CONF_COLORS = [0xffc93e, 0x7ed957, 0xff8c42, 0x6ec6ff, 0xff6b9d, 0xfdfaf2];
{
  const geo = new THREE.BoxGeometry(0.022, 0.022, 0.006);
  const mat = new THREE.MeshBasicMaterial();
  confetti.mesh = new THREE.InstancedMesh(geo, mat, CONF_N);
  confetti.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const c = new THREE.Color();
  for (let i = 0; i < CONF_N; i++) {
    c.setHex(CONF_COLORS[i % CONF_COLORS.length]);
    confetti.mesh.setColorAt(i, c);
    confetti.life[i] = 0;
    confDummy.position.set(0, -10, 0);
    confDummy.scale.setScalar(0.001);
    confDummy.updateMatrix();
    confetti.mesh.setMatrixAt(i, confDummy.matrix);
  }
  confetti.mesh.frustumCulled = false;
  scene.add(confetti.mesh);
}

function confettiBurst(x, y, z, n) {
  let spawned = 0;
  for (let i = 0; i < CONF_N && spawned < n; i++) {
    if (confetti.life[i] > 0) continue;
    confetti.px[i] = x + rand(-0.05, 0.05);
    confetti.py[i] = y;
    confetti.pz[i] = z + rand(-0.05, 0.05);
    const a = rand(0, Math.PI * 2), sp = rand(0.3, 1.1);
    confetti.vx[i] = Math.cos(a) * sp;
    confetti.vz[i] = Math.sin(a) * sp;
    confetti.vy[i] = rand(1.2, 2.6);
    confetti.rx[i] = rand(0, Math.PI);
    confetti.rz[i] = rand(0, Math.PI);
    confetti.life[i] = rand(1.1, 1.7);
    spawned++;
  }
  confetti.active = Math.max(confetti.active, spawned);
}

function updateConfetti(dt) {
  if (confetti.active <= 0) return;
  let alive = 0;
  for (let i = 0; i < CONF_N; i++) {
    if (confetti.life[i] <= 0) continue;
    confetti.life[i] -= dt;
    confetti.vy[i] -= 4.6 * dt;
    confetti.px[i] += confetti.vx[i] * dt;
    confetti.py[i] += confetti.vy[i] * dt;
    confetti.pz[i] += confetti.vz[i] * dt;
    confetti.rx[i] += 6 * dt;
    confetti.rz[i] += 4.4 * dt;
    confDummy.position.set(confetti.px[i], confetti.py[i], confetti.pz[i]);
    confDummy.rotation.set(confetti.rx[i], 0, confetti.rz[i]);
    const s = confetti.life[i] < 0.35 ? Math.max(0.001, confetti.life[i] / 0.35) : 1;
    confDummy.scale.setScalar(s);
    if (confetti.life[i] <= 0) { confDummy.position.y = -10; confDummy.scale.setScalar(0.001); }
    else alive++;
    confDummy.updateMatrix();
    confetti.mesh.setMatrixAt(i, confDummy.matrix);
  }
  confetti.mesh.instanceMatrix.needsUpdate = true;
  confetti.active = alive;
}

// ------------------------------------------------------------
// Loop principal
// ------------------------------------------------------------
const clock = new THREE.Clock();
let timeAcc = 0, simTime = 0;
let fpsFrames = 0, fpsAcc = 0, fpsValue = 60;
const rollAxis = new THREE.Vector3();
const rollQ = new THREE.Quaternion();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  simTime += dt;
  fpsFrames++; fpsAcc += dt;
  if (fpsAcc >= 1) { fpsValue = fpsFrames / fpsAcc; fpsFrames = 0; fpsAcc = 0; }
  bounceCool = Math.max(0, bounceCool - dt);

  // nuvens à deriva
  for (let i = 0; i < clouds.length; i++) {
    clouds[i].position.x += dt * 0.18 * (i % 2 ? 1 : -1);
    if (clouds[i].position.x > 26) clouds[i].position.x = -26;
    if (clouds[i].position.x < -26) clouds[i].position.x = 26;
  }

  // dinâmicos: animação visual
  for (const m of mills) {
    m.cool = Math.max(0, m.cool - dt);
    if (m.blades) m.blades.rotation.z += m.speed * dt;
  }
  for (const b of blocks) {
    b.cool = Math.max(0, b.cool - dt);
    b.x = b.cx + Math.sin(simTime * b.speed + b.phase) * b.amp;
    b.vx = Math.cos(simTime * b.speed + b.phase) * b.speed * b.amp;
    b.mesh.position.x = b.x;
  }

  // física (passo fixo)
  if (state === ST.AIM || state === ST.ROLLING) {
    timeAcc = Math.min(timeAcc + dt, H * 10);
    while (timeAcc >= H) {
      timeAcc -= H;
      physicsStep();
      if (state !== ST.AIM && state !== ST.ROLLING) break;
      // bola empurrada enquanto mirava (moinho/bloco)? vira rolagem livre
      if (state === ST.AIM && ball.vel.lengthSq() > 0.12) {
        if (aiming) { aiming = false; hideAim(); }
        state = ST.ROLLING;
      }
    }
  }

  // bola: posição + rotação de rolagem
  if (ballMesh) {
    ballMesh.position.copy(ball.pos);
    const sp = Math.hypot(ball.vel.x, ball.vel.z);
    if (sp > 0.01) {
      rollAxis.set(ball.vel.z / sp, 0, -ball.vel.x / sp);
      rollQ.setFromAxisAngle(rollAxis, sp * dt / R);
      ballMesh.quaternion.premultiply(rollQ);
    }
    if (state === ST.HOLED) {
      // afunda no copo
      ballMesh.position.x = lerp(ballMesh.position.x, cup.x, 10 * dt);
      ballMesh.position.z = lerp(ballMesh.position.z, cup.z, 10 * dt);
      ballMesh.position.y = Math.max(0.03, ballMesh.position.y - 0.35 * dt);
      ballMesh.scale.multiplyScalar(Math.max(0.55, 1 - 1.2 * dt));
    }
  }

  // bandeira levanta quando a bola chega perto
  if (flagMesh) {
    const near = state !== ST.PAN &&
      Math.hypot(ball.pos.x - cup.x, ball.pos.z - cup.z) < 0.85;
    const wantY = near ? 1.1 : flagBaseY;
    flagMesh.position.y = lerp(flagMesh.position.y, wantY, 5 * dt);
    flagMesh.visible = flagMesh.position.y < 1.0;
  }

  // câmera
  if (state === ST.PAN) {
    panT += dt;
    const t = ease(clamp(panT / panDur, 0, 1));
    idealCam(tmpA);
    camPos.lerpVectors(panFrom, tmpA, t);
    camLook.lerpVectors(panLookFrom, ball.pos, t);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    if (panT >= panDur) { state = ST.AIM; camLook.copy(ball.pos); }
  } else if (state !== ST.MENU) {
    idealCam(tmpA);
    const k = state === ST.ROLLING ? 4.5 : 6.5;
    camera.position.lerp(tmpA, Math.min(1, k * dt));
    camLook.lerp(ball.pos, Math.min(1, 8 * dt));
    camera.lookAt(camLook);
  } else {
    // menu: órbita lenta sobre o buraco 1
    const a = simTime * 0.12;
    camera.position.set(courseCenter.x + Math.sin(a) * 4.4, 2.6, courseCenter.z + Math.cos(a) * 4.4);
    camera.lookAt(courseCenter.x, 0.1, courseCenter.z);
  }

  updateConfetti(dt);
  renderer.render(scene, camera);
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
AudioSys.load();
{
  const rec = loadRecord();
  $('record').textContent = rec ? 'RECORDE: ' + rec + ' tacadas' : 'sem recorde ainda';
}
if (document.fonts && document.fonts.load) {
  document.fonts.load('20px "Kenney Future"');
  document.fonts.load('20px "Kenney Mono"');
}

Promise.all(MODELS.map(loadModel)).then(() => {
  ballMesh = LIB['ball-blue'].clone(true);
  ballMesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(ballMesh);
  buildHole(0);              // cenário de fundo do menu
  resetBallTo(tee);
  document.getElementById('loading').classList.add('hidden');
  AudioSys.playMusic('menu');
  tick();
}).catch(err => {
  console.error('Erro ao carregar modelos:', err);
  document.getElementById('loading').innerHTML = '<p class="story">Erro ao carregar modelos — veja o console.</p>';
});

// handle de testes
window.__GM = {
  get state() { return state; },
  get hole() { return holeIdx; },
  get par() { return HOLES[holeIdx].par; },
  get strokes() { return strokes; },
  get total() { return totalStrokes; },
  get scores() { return scores.slice(); },
  get pos() { return [ball.pos.x, ball.pos.y, ball.pos.z]; },
  get vel() { return [ball.vel.x, ball.vel.y, ball.vel.z]; },
  get speed() { return Math.hypot(ball.vel.x, ball.vel.z); },
  get grounded() { return ball.grounded; },
  get fps() { return Math.round(fpsValue); },
  get oob() { return oobCount; },
  get millHits() { return millHitCount; },
  get cup() { return [cup.x, cup.z]; },
  get models() { return Object.keys(LIB).length; },
  skipPan() { panT = panDur; },
  shootAt(dx, dz, speed) { if (state === ST.AIM) shoot(dx, dz, speed); },
  shootToCup(speed) {
    if (state !== ST.AIM) return;
    shoot(cup.x - ball.pos.x, cup.z - ball.pos.z, speed);
  },
  gotoHole(n) { startHole(clamp(n, 0, HOLES.length - 1)); },
};
