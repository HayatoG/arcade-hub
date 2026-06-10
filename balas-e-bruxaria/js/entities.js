// ============================================================
// ENTITIES — herói, NPCs, inimigos, chefes, projéteis, efeitos
// ============================================================
import * as THREE from 'three';
import * as SkeletonUtils from '../lib/utils/SkeletonUtils.js';
import { INPUT } from './input.js';
import * as RPG from './rpg.js';

let ctx = null;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

let time = 0;

// ------------------------------------------------------------
// Personagem animado (SkeletonUtils — rig compartilhado Kenney)
// ------------------------------------------------------------
function makeChar(libKey, height) {
  const lib = ctx.world.LIB[libKey];
  const obj = SkeletonUtils.clone(lib.scene);
  obj.scale.setScalar(height / lib.size.y);
  const mats = [];
  obj.traverse(o => {
    if (o.isMesh && o.material) { o.material = o.material.clone(); mats.push(o.material); }
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

// arma branca presa à mão direita (técnica do Profundezas)
function meleeGrip(model) {
  const inner = ctx.world.LIB[model].scene.clone(true);
  const box = new THREE.Box3().setFromObject(inner);
  inner.position.set(-(box.min.x + box.max.x) / 2, -box.min.y + 0.02, -(box.min.z + box.max.z) / 2);
  const grip = new THREE.Group();
  grip.add(inner);
  grip.rotation.z = Math.PI / 2;
  const h = box.max.y - box.min.y;
  grip.scale.setScalar(clamp(0.58 / h, 0.45, 1.4));
  grip.position.set(-0.26, 0, 0);
  return grip;
}

// arma de fogo presa à mão (técnica do Maré Vermelha)
function gunGrip(model) {
  const inner = ctx.world.LIB[model].scene.clone(true);
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
  grip.scale.setScalar(0.34 / len);
  grip.position.set(-0.29, 0, 0);
  return grip;
}

// ------------------------------------------------------------
// Sprites utilitários (texto/emoji em canvas)
// ------------------------------------------------------------
function canvasSprite(draw, w = 128, h = 128) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  draw(x, c);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.renderOrder = 990;
  return { sp, ctx: x, tex, c };
}

function emojiSprite(emoji, size = 84) {
  return canvasSprite(x => {
    x.font = size + 'px serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(emoji, 64, 70);
  }).sp;
}

// ------------------------------------------------------------
// Pools: números de dano, partículas, moedas
// ------------------------------------------------------------
const dmgPool = [], dmgLive = [];
function initDmgPool() {
  for (let i = 0; i < 26; i++) {
    const t = canvasSprite(() => {}, 192, 96);
    t.sp.visible = false;
    t.sp.scale.set(1.5, 0.75, 1);
    ctx.scene.add(t.sp);
    dmgPool.push({ ...t, life: 0, vy: 0 });
  }
}
function spawnDmg(x, y, z, text, color = '#ffe9b0', big = false) {
  const d = dmgPool.find(p => p.life <= 0);
  if (!d) return;
  d.ctx.clearRect(0, 0, 192, 96);
  d.ctx.font = 'bold ' + (big ? 60 : 46) + 'px "Kenney Future", sans-serif';
  d.ctx.textAlign = 'center'; d.ctx.textBaseline = 'middle';
  d.ctx.lineWidth = 9; d.ctx.strokeStyle = 'rgba(0,0,0,.9)';
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
  for (let i = 0; i < 130; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    m.visible = false;
    ctx.scene.add(m);
    particles.push({ m, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0 });
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

const coinPool = [], coinsLive = [];
function initCoins() {
  for (let i = 0; i < 40; i++) {
    const m = ctx.world.makeProp('dungeon/coin', 1.5);
    m.visible = false;
    m.traverse(o => { if (o.isMesh) o.castShadow = false; });
    ctx.scene.add(m);
    coinPool.push({ m, live: false, vx: 0, vy: 0, vz: 0, t: 0 });
  }
}
function dropCoins(x, z, n) {
  for (let i = 0; i < n; i++) {
    const c = coinPool.find(c => !c.live);
    if (!c) return;
    c.live = true; c.t = 0;
    c.m.position.set(x + rand(-0.3, 0.3), 0.6, z + rand(-0.3, 0.3));
    const a = rand(0, Math.PI * 2);
    c.vx = Math.cos(a) * rand(1, 2.6); c.vz = Math.sin(a) * rand(1, 2.6); c.vy = rand(3.5, 5.5);
    c.m.visible = true;
    coinsLive.push(c);
  }
}

// drops especiais (poções, fragmento)
const drops = [];
function spawnDrop(x, z, kind) {     // kind: 'pocao-vida' | 'pocao-mana' | 'fragmento'
  const sp = emojiSprite(kind === 'fragmento' ? '💖' : kind === 'pocao-vida' ? '🧪' : '🔮');
  sp.scale.set(kind === 'fragmento' ? 1.6 : 1.0, kind === 'fragmento' ? 1.6 : 1.0, 1);
  sp.position.set(x, 1, z);
  ctx.scene.add(sp);
  let glow = null;
  if (kind === 'fragmento') {
    glow = new THREE.PointLight(0xff6ab2, 9, 7, 1.8);
    glow.position.set(x, 1.4, z);
    ctx.scene.add(glow);
  }
  drops.push({ sp, glow, x, z, kind, t: 0 });
}

// ------------------------------------------------------------
// Projéteis
// ------------------------------------------------------------
const bullets = [], bulletPool = [];
const orbs = [], orbPool = [];
const fireballs = [];
function initProjectiles() {
  const bGeo = new THREE.CapsuleGeometry(0.07, 0.5, 2, 6);
  const bMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < 36; i++) {
    const m = new THREE.Mesh(bGeo, bMat);
    m.rotation.x = Math.PI / 2;
    m.visible = false;
    ctx.scene.add(m);
    bulletPool.push(m);
  }
  const oGeo = new THREE.SphereGeometry(0.22, 8, 6);
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(oGeo, new THREE.MeshBasicMaterial({ color: 0xc478ff }));
    m.visible = false;
    ctx.scene.add(m);
    orbPool.push(m);
  }
}

function fireBullet(x, z, dx, dz, dmg) {
  const m = bulletPool.pop();
  if (!m) return;
  m.visible = true;
  m.position.set(x, 1.05, z);
  m.rotation.y = Math.atan2(dx, dz);
  m.rotation.x = Math.PI / 2;
  bullets.push({ m, x, z, dx, dz, dmg, life: 0.85 });
}

function fireOrb(x, z, dx, dz, dmg) {
  const m = orbPool.pop();
  if (!m) return;
  m.visible = true;
  m.position.set(x, 1.0, z);
  orbs.push({ m, x, z, dx, dz, dmg, life: 4 });
}

// ------------------------------------------------------------
// Herói
// ------------------------------------------------------------
export const H = {
  x: 0, z: 14, dir: Math.PI, ch: null, light: null,
  atkCd: 0, combo: 0, comboT: 0, shootCd: 0, shootingT: 0,
  dashT: 0, dashCd: 0, dashDX: 0, dashDZ: 0, iframes: 0,
  stepT: 0, stepAlt: false, castLock: 0, dead: false,
  aimX: 0, aimZ: 1,
  swordGrip: null, gunGrip: null, hand: 'sword',
};
let trail = null;
let muzzle = null, muzzleT = 0;

function buildHero(skin) {
  if (H.ch) { ctx.scene.remove(H.ch.obj); }
  H.ch = makeChar('chars/character-' + skin, 1.5);
  H.ch.obj.position.set(H.x, 0, H.z);
  ctx.scene.add(H.ch.obj);
  H.swordGrip = null; H.gunGrip = null;
  ENT.refreshHandWeapon();
  H.ch.play('idle');
  if (!H.light) {
    H.light = new THREE.PointLight(0xffc890, 4, 9, 2);
    ctx.scene.add(H.light);
  }
  if (!trail) {
    const geo = new THREE.RingGeometry(0.55, 2.0, 24, 1, -Math.PI / 2 - 1.05, 2.1);
    geo.rotateX(-Math.PI / 2);
    trail = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xffc878, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, depthWrite: false,
    }));
    trail.position.y = 0.55;
    ctx.scene.add(trail);
  }
  if (!muzzle) {
    muzzle = canvasSprite(x => {
      const g = x.createRadialGradient(64, 64, 4, 64, 64, 60);
      g.addColorStop(0, 'rgba(255,250,210,1)');
      g.addColorStop(0.4, 'rgba(255,190,90,.85)');
      g.addColorStop(1, 'rgba(255,120,30,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }).sp;
    muzzle.material.blending = THREE.AdditiveBlending;
    muzzle.visible = false;
    ctx.scene.add(muzzle);
  }
}

function setHand(mode) {
  if (H.hand === mode) return;
  H.hand = mode;
  if (H.swordGrip) H.swordGrip.visible = mode === 'sword';
  if (H.gunGrip) H.gunGrip.visible = mode === 'gun';
}

// mira: mouse > stick direito > auto-aim
const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const v3 = new THREE.Vector3();
function computeAim() {
  if (INPUT.gamepadActive && (Math.abs(INPUT.padAimX) + Math.abs(INPUT.padAimZ) > 0.1)) {
    const l = Math.hypot(INPUT.padAimX, INPUT.padAimZ);
    H.aimX = INPUT.padAimX / l; H.aimZ = INPUT.padAimZ / l;
    return;
  }
  if (INPUT.touchActive && !INPUT.usingMouseAim) {
    const e = nearestEnemy(H.x, H.z, 10);
    if (e) {
      const dx = e.ch.obj.position.x - H.x, dz = e.ch.obj.position.z - H.z;
      const l = Math.hypot(dx, dz) || 1;
      H.aimX = dx / l; H.aimZ = dz / l;
    } else { H.aimX = Math.sin(H.dir); H.aimZ = Math.cos(H.dir); }
    return;
  }
  // mouse
  ray.setFromCamera({
    x: (INPUT.mouseX / window.innerWidth) * 2 - 1,
    y: -(INPUT.mouseY / window.innerHeight) * 2 + 1,
  }, ctx.camera);
  if (ray.ray.intersectPlane(groundPlane, v3)) {
    const dx = v3.x - H.x, dz = v3.z - H.z;
    const l = Math.hypot(dx, dz);
    if (l > 0.3) { H.aimX = dx / l; H.aimZ = dz / l; }
  }
}

function nearestEnemy(x, z, maxD) {
  let best = null, bd = maxD;
  for (const e of enemies) {
    if (!e.alive || e.dying) continue;
    if (e.type === 'ghost' && e.phase !== 'visible') continue;
    const d = Math.hypot(e.ch.obj.position.x - x, e.ch.obj.position.z - z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ---- combate do herói ----
function melee() {
  if (H.atkCd > 0 || H.castLock > 0 || H.dead) return;
  setHand('sword');
  const second = H.comboT > 0 && H.combo === 1;
  H.combo = second ? 0 : 1;
  H.comboT = 0.85;
  H.atkCd = second ? 0.5 : 0.34;
  H.ch.play(second ? 'attack-melee-left' : 'attack-melee-right', true, 1.9);
  H.ch.onFinish = () => { if (!H.dead) H.ch.play('idle'); };
  AudioSys.play('swing', 0.5, second ? 0.85 : rand(0.95, 1.15));
  // vira para a mira
  H.dir = Math.atan2(H.aimX, H.aimZ);
  trail.position.set(H.x, 0.55, H.z);
  trail.rotation.y = H.dir;
  trail.material.opacity = 0.8;
  trail.material.color.setHex(second ? 0xffa040 : 0xffc878);
  trail.scale.setScalar(second ? 1.0 : 0.8);

  const st = RPG.stats();
  const dmgBase = st.melee * (second ? 1.45 : 1);
  const fx = Math.sin(H.dir), fz = Math.cos(H.dir);
  let hitAny = false;
  for (const e of enemies) {
    if (!e.alive || e.dying) continue;
    if (e.type === 'ghost' && e.phase === 'hidden') continue;
    const p = e.ch.obj.position;
    const dx = p.x - H.x, dz = p.z - H.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 2.3 + (e.boss ? 0.7 : 0)) continue;
    const cos = (dx * fx + dz * fz) / (dist || 1);
    if (cos < 0.4 && dist > 0.95) continue;
    hitAny = true;
    const crit = Math.random() < 0.1 + st.FOR * 0.005;
    damageEnemy(e, Math.round(dmgBase * rand(0.85, 1.2) * (crit ? 1.8 : 1)), crit, dx / (dist || 1), dz / (dist || 1), second ? 8 : 5);
  }
  if (hitAny) {
    AudioSys.play(Math.random() < 0.5 ? 'hit1' : 'hit2', 0.55, rand(0.92, 1.12));
    ctx.game.addShake(0.14);
  }
}

function shoot(dt) {
  H.shootCd -= dt;
  if (!INPUT.shootHeld || H.dead || H.castLock > 0) return;
  const gunId = RPG.P.equip.fogo;
  if (!gunId) {
    if (INPUT.pressed('shoot')) ctx.ui.toast('Você ainda não tem uma arma de fogo — fale com Bartolomeu!');
    return;
  }
  if (H.shootCd > 0) return;
  const st = RPG.stats();
  const gun = RPG.ITEMS[gunId];
  H.shootCd = st.gunRate;
  H.shootingT = 0.28;
  setHand('gun');
  H.dir = Math.atan2(H.aimX, H.aimZ);
  const pellets = gun.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const spread = (gun.spread || 0.06) * (pellets > 1 ? 1 : 0.7);
    const a = Math.atan2(H.aimX, H.aimZ) + rand(-spread, spread);
    fireBullet(H.x + Math.sin(a) * 0.7, H.z + Math.cos(a) * 0.7, Math.sin(a), Math.cos(a), st.gun);
  }
  AudioSys.play('shot', gun.pellets ? 0.65 : 0.45, gun.rate < 0.15 ? rand(1.2, 1.35) : rand(0.95, 1.1));
  muzzle.position.set(H.x + H.aimX * 1.05, 1.05, H.z + H.aimZ * 1.05);
  muzzle.scale.setScalar(gun.pellets ? 1.5 : 1.0);
  muzzle.visible = true;
  muzzleT = 0.05;
  ctx.game.addShake(gun.pellets ? 0.1 : 0.04);
}

function dash() {
  if (H.dashCd > 0 || H.dead || H.castLock > 0) return;
  let dx = INPUT.mx, dz = INPUT.mz;
  if (Math.hypot(dx, dz) < 0.1) { dx = Math.sin(H.dir); dz = Math.cos(H.dir); }
  const l = Math.hypot(dx, dz) || 1;
  H.dashDX = dx / l; H.dashDZ = dz / l;
  H.dashT = 0.18;
  H.dashCd = 1.4;
  H.iframes = Math.max(H.iframes, 0.4);
  AudioSys.play('dash', 0.5, rand(0.95, 1.1));
  burst(H.x, 0.5, H.z, 0xb08aff, 8, 2.6, 0.35);
}

function castSpell(idx) {
  const P = RPG.P;
  if (H.dead || !P.spells[idx]) {
    if (!P.spells[idx]) ctx.ui.toast('✨ Magia ainda não aprendida — visite a Petúnia!');
    return;
  }
  const id = P.spells[idx];
  const sp = RPG.SPELLS[id];
  if ((P.cds[id] || 0) > 0) return;
  if (P.mana < sp.custo) { ctx.ui.toast('Mana insuficiente!'); AudioSys.play('error', 0.5); return; }
  P.mana -= sp.custo;
  P.cds[id] = sp.cd;
  P.selSpell = idx;
  H.castLock = 0.3;
  H.dir = Math.atan2(H.aimX, H.aimZ);
  H.ch.play('interact-right', true, 2.2);
  H.ch.onFinish = () => { if (!H.dead) H.ch.play('idle'); };
  const st = RPG.stats();

  if (id === 'fogo') {
    AudioSys.play('swing', 0.6, 1.35);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff8a3a }));
    m.position.set(H.x + H.aimX * 0.8, 1.05, H.z + H.aimZ * 0.8);
    ctx.scene.add(m);
    fireballs.push({ m, dx: H.aimX, dz: H.aimZ, life: 0.75, dmg: Math.round(sp.dmg * st.spellPow) });
  } else if (id === 'gelo') {
    AudioSys.play('whisper', 0.7, 1.25);
    const fx = H.aimX, fz = H.aimZ;
    for (let i = 0; i < 14; i++) {
      const a = Math.atan2(fx, fz) + rand(-0.5, 0.5);
      const d = rand(1, 4.2);
      burst(H.x + Math.sin(a) * d, rand(0.4, 1.2), H.z + Math.cos(a) * d, pick([0x9adcf8, 0x6ab2e8, 0xd8f4ff]), 2, 1.5, 0.55);
    }
    for (const e of enemies) {
      if (!e.alive || e.dying) continue;
      const p = e.ch.obj.position;
      const dx = p.x - H.x, dz = p.z - H.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 4.6) continue;
      const cos = (dx * fx + dz * fz) / (dist || 1);
      if (cos < 0.5 && dist > 1) continue;
      e.slowT = 3;
      damageEnemy(e, Math.round(sp.dmg * st.spellPow * rand(0.9, 1.1)), false, dx / (dist || 1), dz / (dist || 1), 3);
    }
  } else if (id === 'cura') {
    AudioSys.play('upgrade', 0.8, 1.1);
    P.hp = Math.min(st.maxHp, P.hp + st.maxHp * sp.heal * st.spellPow);
    for (let i = 0; i < 16; i++) burst(H.x + rand(-0.8, 0.8), rand(0.2, 1.8), H.z + rand(-0.8, 0.8), pick([0x8af0a0, 0xc8ffd8]), 1, 1.2, 0.7);
    ctx.ui.refreshHUD();
  } else if (id === 'tempestade') {
    AudioSys.play('thunder', 0.8);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 3.9, 36),
      new THREE.MeshBasicMaterial({ color: 0xb08aff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(H.x, 0.08, H.z);
    ctx.scene.add(ring);
    setTimeout(() => ctx.scene.remove(ring), 450);
    for (let i = 0; i < 7; i++) {
      const a = rand(0, Math.PI * 2), d = rand(0.5, 3.6);
      burst(H.x + Math.sin(a) * d, rand(0.5, 2.2), H.z + Math.cos(a) * d, pick([0xb08aff, 0xe8d8ff, 0x8a5aff]), 4, 4, 0.6);
    }
    damageInCircle(H.x, H.z, 4.0, Math.round(sp.dmg * st.spellPow), true);
    ctx.game.addShake(0.3);
  }
  ctx.ui.refreshHUD();
}

function damageInCircle(x, z, r, dmg, magic = false) {
  for (const e of enemies) {
    if (!e.alive || e.dying) continue;
    const p = e.ch.obj.position;
    const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
    if (d > r + e.def.radius) continue;
    damageEnemy(e, Math.round(dmg * rand(0.9, 1.15)), false, dx / (d || 1), dz / (d || 1), magic ? 4 : 2);
  }
}

function hurtHero(n, srcX, srcZ) {
  if (H.iframes > 0 || H.dead || !RPG.P) return;
  RPG.P.hp -= n;
  H.iframes = 0.9;
  AudioSys.play('hurt', 0.8);
  ctx.game.addShake(0.3);
  const hf = document.getElementById('hurt-flash');
  hf.classList.add('show');
  setTimeout(() => hf.classList.remove('show'), 130);
  burst(H.x, 1, H.z, 0xd8323c, 10, 3.4, 0.5);
  ctx.ui.refreshHUD();
  if (RPG.P.hp <= 0) {
    RPG.P.hp = 0;
    H.dead = true;
    H.ch.play('die', true, 1.1);
    AudioSys.play('die2', 0.7);
    ctx.game.onHeroDeath();
  }
}

// ------------------------------------------------------------
// Inimigos
// ------------------------------------------------------------
const ENEMY_DEFS = {
  zombie:   { model: 'graveyard/character-zombie',   h: 1.5,  hp: 34, spd: 1.3,  dmg: 8,  xp: 9,  coins: [2, 3], radius: 0.55 },
  skeleton: { model: 'graveyard/character-skeleton', h: 1.45, hp: 24, spd: 2.1,  dmg: 7,  xp: 8,  coins: [1, 3], radius: 0.5 },
  orc:      { model: 'dungeon/character-orc',        h: 1.75, hp: 62, spd: 1.15, dmg: 12, xp: 16, coins: [3, 5], radius: 0.65 },
  vampire:  { model: 'graveyard/character-vampire',  h: 1.5,  hp: 34, spd: 2.4,  dmg: 9,  xp: 14, coins: [2, 4], radius: 0.5 },
  ghost:    { model: 'graveyard/character-ghost',    h: 1.45, hp: 22, spd: 1.8,  dmg: 8,  xp: 12, coins: [2, 3], radius: 0.5 },
};
const POOL_N = { zombie: 8, skeleton: 8, orc: 6, vampire: 5, ghost: 6 };
const enemyPool = {};
const enemies = [];

const BOSSES = [
  { id: 'vampiro', nome: 'Barão Sanguessuga', model: 'graveyard/character-vampire', h: 2.3, hp: 320, spd: 2.0, dmg: 14, xp: 130, radius: 0.8, drop: 'presas-barao' },
  { id: 'gruk', nome: 'Warchefe Gruk', model: 'dungeon/character-orc', h: 3.1, hp: 470, spd: 1.5, dmg: 16, xp: 190, radius: 1.0, drop: 'machado-gruk' },
  { id: 'guardiao', nome: 'Guardião Cego', model: 'graveyard/character-keeper', h: 3.6, hp: 660, spd: 1.35, dmg: 18, xp: 280, radius: 1.1, drop: 'coracao-guardiao' },
];
let bossChars = [];
let activeBoss = null;

function initEnemyPool() {
  for (const [type, n] of Object.entries(POOL_N)) {
    enemyPool[type] = [];
    const def = ENEMY_DEFS[type];
    for (let i = 0; i < n; i++) {
      const ch = makeChar(def.model, def.h);
      ch.obj.visible = false;
      if (type === 'ghost') ch.mats.forEach(m => { m.transparent = true; m.opacity = 0.8; });
      ctx.scene.add(ch.obj);
      enemyPool[type].push({ type, def, ch, alive: false, boss: false });
    }
  }
  // chefes (1 instância cada)
  bossChars = BOSSES.map((b, i) => {
    const ch = makeChar(b.model, b.h);
    ch.obj.visible = false;
    ctx.scene.add(ch.obj);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 1, 40),
      new THREE.MeshBasicMaterial({ color: 0xd8323c, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    ctx.scene.add(ring);
    return { type: 'boss', def: b, ch, ring, alive: false, boss: true, bossIdx: i };
  });
}

function spawnEnemy(type, x, z, opts = {}) {
  const e = enemyPool[type] && enemyPool[type].find(e => !e.alive);
  if (!e) return null;
  const def = e.def;
  e.alive = true; e.dying = 0;
  e.hp = e.maxHp = Math.round(def.hp * (opts.hpMul || 1));
  e.dmg = Math.round(def.dmg * (opts.dmgMul || 1));
  e.spd = def.spd;
  e.kbx = 0; e.kbz = 0;
  e.flash = 0; e.slowT = 0;
  e.attackCd = rand(0.4, 1);
  e.wake = rand(0.6, 1.2);
  e.ch.reset();
  e.ch.obj.visible = true;
  e.ch.obj.position.set(x, 0, z);
  e.ch.obj.rotation.y = 0;
  e.ch.mats.forEach(m => { if (m.emissive) { m.emissive.setHex(0x000000); m.emissiveIntensity = 1; } });
  e.ch.play('idle');
  e.animSpeed = clamp(e.spd / 1.6, 0.8, 1.8);
  e.ch.onFinish = () => { if (e.alive && !e.dying) e.ch.play('walk', false, e.animSpeed); };
  if (type === 'ghost') { e.phase = 'visible'; e.phaseT = rand(2, 3.5); e.ch.mats.forEach(m => m.opacity = 0.8); }
  if (type === 'vampire') { e.lungeT = rand(2.2, 3.6); e.lunge = 0; e.tele = 0; }
  burst(x, 0.7, z, 0x8a6aff, 8, 2.6, 0.5);
  enemies.push(e);
  return e;
}

function spawnBoss(idx, x, z) {
  const e = bossChars[idx];
  if (e.alive) return e;
  const def = e.def;
  e.alive = true; e.dying = 0;
  e.hp = e.maxHp = def.hp;
  e.dmg = def.dmg;
  e.spd = def.spd;
  e.kbx = 0; e.kbz = 0; e.flash = 0; e.slowT = 0;
  e.attackCd = 1.4;
  e.wake = 1.6;
  e.state = 'chase'; e.stateT = 2;
  e.summoned = false; e.fury = false; e.phase2 = false;
  e.summonT = 6; e.fanT = 2.5;
  e.ch.reset();
  e.ch.obj.visible = true;
  e.ch.obj.position.set(x, 0, z);
  e.ch.obj.rotation.y = 0;
  e.ch.mats.forEach(m => { if (m.emissive) { m.emissive.setHex(0x000000); m.emissiveIntensity = 1; } });
  e.ch.play('walk', false, 1);
  e.animSpeed = 1;
  enemies.push(e);
  activeBoss = e;
  ctx.ui.bossBar(def.nome, 1);
  ctx.game.announce(def.nome.toUpperCase() + ' DESPERTA!', 2200);
  AudioSys.play('ghost', 0.8, 0.8);
  ctx.game.addShake(0.4);
  return e;
}

function releaseEnemy(e) {
  e.alive = false;
  e.ch.obj.visible = false;
  e.ch.reset();
  if (e.ring) e.ring.visible = false;
  const i = enemies.indexOf(e);
  if (i >= 0) enemies.splice(i, 1);
  if (e === activeBoss) activeBoss = null;
}

function damageEnemy(e, dmg, crit, nx, nz, kb = 5) {
  if (!e.alive || e.dying) return;
  e.hp -= dmg;
  const p = e.ch.obj.position;
  spawnDmg(p.x, e.def.h + 0.5, p.z, String(dmg), crit ? '#ffd23e' : '#ffe9b0', crit);
  burst(p.x, 0.9, p.z, crit ? 0xffd23e : 0xff8a5a, 5, 3, 0.4);
  e.flash = 0.08;
  e.ch.mats.forEach(m => { if (m.emissive) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 0.85; } });
  const kbMul = e.boss ? 0.25 : e.type === 'ghost' ? 0.6 : 1;
  e.kbx += nx * kb * kbMul; e.kbz += nz * kb * kbMul;
  if (e.boss) ctx.ui.bossBar(e.def.nome, Math.max(0, e.hp / e.maxHp));

  if (e.hp <= 0 && !e.dying) {
    e.dying = 0.85;
    e.ch.play('die', true, 1.3);
    AudioSys.play(Math.random() < 0.5 ? 'die1' : 'die2', 0.45);
    const def = e.def;
    dropCoins(p.x, p.z, randi(def.coins ? def.coins[0] : 10, def.coins ? def.coins[1] : 16));
    burst(p.x, 0.8, p.z, 0x9a3a3a, 12, 3.6, 0.6);
    RPG.addXp(def.xp);
    spawnDmg(p.x, def.h + 1.1, p.z, '+' + def.xp + ' XP', '#b08aff');
    if (!e.boss) {
      RPG.questEvent('kill', { type: e.type });
      if (Math.random() < 0.09) spawnDrop(p.x + rand(-0.5, 0.5), p.z + rand(-0.5, 0.5), Math.random() < 0.5 ? 'pocao-vida' : 'pocao-mana');
    } else {
      onBossKilled(e);
    }
  }
}

function onBossKilled(e) {
  const idx = e.bossIdx;
  const p = e.ch.obj.position;
  AudioSys.play('boom', 0.9);
  ctx.game.addShake(0.6);
  ctx.game.announce(e.def.nome.toUpperCase() + ' DERROTADO!', 2400);
  ctx.ui.bossBar(null);
  dropCoins(p.x, p.z, randi(14, 20));
  // loot épico + fragmento
  if (!RPG.P.bossesDead[idx]) {
    RPG.P.bossesDead[idx] = true;
    spawnDrop(p.x, p.z - 1.2, 'fragmento');
    RPG.giveItem(e.def.drop);
    ctx.ui.toast(`🟣 Loot épico: ${RPG.ITEMS[e.def.drop].nome}!`);
  }
  RPG.save();
  ctx.world.onBossDead(idx);
}

// ---- IA dos inimigos comuns + chefes ----
function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.ch.mixer.update(dt);
    const p = e.ch.obj.position;

    if (e.flash > 0) {
      e.flash -= dt;
      if (e.flash <= 0) e.ch.mats.forEach(m => { if (m.emissive && !e.fury) m.emissive.setHex(0x000000); });
    }
    if (e.dying) {
      e.dying -= dt;
      if (e.dying <= 0) releaseEnemy(e);
      continue;
    }
    // knockback
    p.x += e.kbx * dt; p.z += e.kbz * dt;
    e.kbx *= Math.pow(0.001, dt); e.kbz *= Math.pow(0.001, dt);
    if (e.wake > 0) { e.wake -= dt; continue; }
    if (e.ch.current === 'idle') e.ch.play('walk', false, e.animSpeed);

    e.slowT = Math.max(0, e.slowT - dt);
    const slowMul = e.slowT > 0 ? 0.45 : 1;
    if (e.slowT > 0 && Math.random() < dt * 8) burst(p.x, rand(0.2, 1.2), p.z, 0x9adcf8, 1, 0.8, 0.4);

    const dx = H.x - p.x, dz = H.z - p.z;
    const dist = Math.hypot(dx, dz) || 1;
    const nx = dx / dist, nz = dz / dist;
    e.attackCd = Math.max(0, e.attackCd - dt);

    if (e.boss) { updateBoss(e, dt, p, nx, nz, dist, slowMul); }
    else if (e.type === 'ghost') {
      e.phaseT -= dt;
      if (e.phase === 'visible') {
        p.x += nx * e.spd * slowMul * dt; p.z += nz * e.spd * slowMul * dt;
        if (e.phaseT <= 0) { e.phase = 'fading'; e.phaseT = 0.5; }
      } else if (e.phase === 'fading') {
        const o = Math.max(0, e.phaseT / 0.5) * 0.8;
        e.ch.mats.forEach(m => m.opacity = o);
        if (e.phaseT <= 0) { e.phase = 'hidden'; e.phaseT = rand(1.1, 1.7); e.ch.obj.visible = false; }
      } else if (e.phase === 'hidden') {
        p.x += nx * e.spd * 2.6 * slowMul * dt; p.z += nz * e.spd * 2.6 * slowMul * dt;
        if (e.phaseT < 0.45 && !e.whispered) { e.whispered = true; AudioSys.play('whisper', 0.55, rand(0.8, 1)); }
        if (e.phaseT <= 0) { e.phase = 'appearing'; e.phaseT = 0.4; e.whispered = false; e.ch.obj.visible = true; }
      } else {
        const o = (1 - Math.max(0, e.phaseT / 0.4)) * 0.8;
        e.ch.mats.forEach(m => m.opacity = o);
        if (e.phaseT <= 0) { e.phase = 'visible'; e.phaseT = rand(2.2, 3.4); }
      }
      e.ch.obj.position.y = 0.18 + Math.sin(time * 3 + p.x) * 0.1;
      e.ch.obj.rotation.y = Math.atan2(nx, nz);
    } else if (e.type === 'vampire') {
      if (e.tele > 0) {
        e.tele -= dt;
        e.ch.obj.rotation.y = Math.atan2(nx, nz);
        if (e.tele <= 0) {
          e.lunge = 0.42; e.lungeX = nx; e.lungeZ = nz;
          e.ch.play('sprint', false, 2);
          AudioSys.play('swing', 0.35, 0.75);
        }
      } else if (e.lunge > 0) {
        e.lunge -= dt;
        p.x += e.lungeX * 9 * slowMul * dt; p.z += e.lungeZ * 9 * slowMul * dt;
        if (e.lunge <= 0) { e.lungeT = rand(2.4, 3.8); e.ch.play('walk', false, e.animSpeed); }
      } else {
        p.x += nx * e.spd * slowMul * dt; p.z += nz * e.spd * slowMul * dt;
        e.ch.obj.rotation.y = Math.atan2(nx, nz);
        e.lungeT -= dt;
        if (e.lungeT <= 0 && dist > 2.2 && dist < 7.5) {
          e.tele = 0.45; e.flash = 0.45;
          e.ch.mats.forEach(m => { if (m.emissive) { m.emissive.setHex(0xa01020); m.emissiveIntensity = 0.8; } });
        } else if (e.lungeT <= 0) e.lungeT = 1.2;
      }
    } else {
      p.x += nx * e.spd * slowMul * dt; p.z += nz * e.spd * slowMul * dt;
      e.ch.obj.rotation.y = Math.atan2(nx, nz);
    }

    // separação
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
    // colisão com o mundo (fantasma atravessa)
    if (e.type !== 'ghost') {
      const c = ctx.world.collide(p.x, p.z, e.def.radius * 0.7);
      p.x = c.x; p.z = c.z;
    }
    // contato
    const hidden = e.type === 'ghost' && e.phase !== 'visible';
    if (!hidden && dist < e.def.radius + 0.5 && e.attackCd <= 0 && !H.dead) {
      e.attackCd = 1.1;
      e.ch.play('attack-melee-right', true, 1.6);
      e.ch.onFinish = () => { if (e.alive && !e.dying) e.ch.play('walk', false, e.animSpeed); };
      hurtHero(e.dmg);
    }
  }
}

function updateBoss(e, dt, p, nx, nz, dist, slowMul) {
  const idx = e.bossIdx;
  const hpFrac = e.hp / e.maxHp;
  // invoca capangas
  if (idx === 0 && !e.summoned && hpFrac < 0.5) {
    e.summoned = true;
    ctx.game.announce('«Levantem-se, meus famintos!»', 1800);
    for (const ox of [-2.5, 2.5]) spawnEnemy('zombie', p.x + ox, p.z + 1, { hpMul: 1.1 });
  }
  if (idx === 1 && !e.fury && hpFrac < 0.3) {
    e.fury = true;
    e.spd *= 1.55;
    e.animSpeed = 1.6;
    e.ch.mats.forEach(m => { if (m.emissive) { m.emissive.setHex(0x801010); m.emissiveIntensity = 0.55; } });
    ctx.game.announce('GRUK FICOU FURIOSO!', 1800);
    AudioSys.play('ghost', 0.7, 0.6);
  }
  if (idx === 2 && !e.phase2 && hpFrac < 0.5) {
    e.phase2 = true;
    ctx.game.announce('O GUARDIÃO INVOCA AS SOMBRAS!', 2000);
    AudioSys.play('thunder', 0.7);
  }
  // fase 2 do guardião: fantasmas + leque de projéteis
  if (idx === 2 && e.phase2) {
    e.summonT -= dt;
    if (e.summonT <= 0) {
      e.summonT = 8;
      const ghosts = enemies.filter(x => x.type === 'ghost' && x.alive).length;
      if (ghosts < 3) spawnEnemy('ghost', p.x + rand(-2, 2), p.z + rand(-2, 2), { hpMul: 1.2 });
    }
    e.fanT -= dt;
    if (e.fanT <= 0) {
      e.fanT = 2.8;
      const base = Math.atan2(nx, nz);
      for (let k = -2; k <= 2; k++) {
        const a = base + k * 0.26;
        fireOrb(p.x + Math.sin(a) * 1.2, p.z + Math.cos(a) * 1.2, Math.sin(a), Math.cos(a), e.dmg * 0.7);
      }
      AudioSys.play('whisper', 0.7, 0.7);
    }
  }
  // máquina de estados: perseguir → investida (vampiro) / golpe em área (gruk/guardião)
  if (e.state === 'chase') {
    p.x += nx * e.spd * slowMul * dt; p.z += nz * e.spd * slowMul * dt;
    e.ch.obj.rotation.y = Math.atan2(nx, nz);
    e.stateT -= dt;
    if (e.stateT <= 0) {
      if (idx === 0) {                       // investida telegrafada
        e.state = 'tele'; e.stateT = 0.55;
        e.flash = 0.55;
        e.ch.mats.forEach(m => { if (m.emissive) { m.emissive.setHex(0xa01020); m.emissiveIntensity = 0.85; } });
      } else if (dist < 5.2) {               // slam em área
        e.state = 'slam'; e.stateT = e.fury ? 0.7 : 1.0;
        e.ch.play('attack-melee-right', true, 0.55);
        e.ring.visible = true;
        e.ring.position.set(p.x, 0.06, p.z);
      } else e.stateT = 0.6;
    }
  } else if (e.state === 'tele') {
    e.ch.obj.rotation.y = Math.atan2(nx, nz);
    e.stateT -= dt;
    if (e.stateT <= 0) {
      e.state = 'lunge'; e.stateT = 0.45;
      e.lungeX = nx; e.lungeZ = nz;
      e.ch.play('sprint', false, 2.2);
      AudioSys.play('swing', 0.6, 0.7);
    }
  } else if (e.state === 'lunge') {
    e.stateT -= dt;
    p.x += e.lungeX * 12 * dt; p.z += e.lungeZ * 12 * dt;
    if (e.stateT <= 0) {
      e.state = 'chase'; e.stateT = rand(1.6, 2.6);
      e.ch.play('walk', false, e.animSpeed);
    }
  } else if (e.state === 'slam') {
    const s = 0.4 + 3.0 * (1 - e.stateT / (e.fury ? 0.7 : 1.0));
    e.ring.scale.setScalar(s);
    e.ring.material.opacity = 0.3 + 0.35 * Math.abs(Math.sin(time * 14));
    e.stateT -= dt;
    if (e.stateT <= 0) {
      e.state = 'cd'; e.stateT = e.fury ? 1.2 : 2.0;
      e.ring.visible = false;
      AudioSys.play('slam', 0.85);
      ctx.game.addShake(0.45);
      burst(p.x, 0.4, p.z, 0xff7a3a, 18, 5, 0.6);
      if (Math.hypot(H.x - p.x, H.z - p.z) < 3.4) hurtHero(e.dmg);
    }
  } else {                                   // cd
    p.x += nx * e.spd * 0.5 * slowMul * dt; p.z += nz * e.spd * 0.5 * slowMul * dt;
    e.ch.obj.rotation.y = Math.atan2(nx, nz);
    e.stateT -= dt;
    if (e.stateT <= 0) { e.state = 'chase'; e.stateT = rand(1.2, 2.2); if (e.ch.current !== 'walk') e.ch.play('walk', false, e.animSpeed); }
  }
}

// ------------------------------------------------------------
// NPCs
// ------------------------------------------------------------
const npcs = [];
function spawnNPCs() {
  for (const [id, def] of Object.entries(RPG.NPCS)) {
    const ch = makeChar('chars/' + def.skin, 1.5);
    ch.obj.position.set(def.x, 0, def.z);
    ch.obj.rotation.y = def.ry || 0;
    ch.play('idle');
    ch.actions['idle'].time = rand(0, 2);
    ctx.world.addTo(def.area, ch.obj);
    // marcador de quest
    const mk = canvasSprite(() => {}, 96, 96);
    mk.sp.scale.set(0.9, 0.9, 1);
    mk.sp.position.set(def.x, 2.6, def.z);
    mk.sp.visible = false;
    ctx.world.addTo(def.area, mk.sp);
    npcs.push({ id, def, ch, mk, mkChar: '', wanderT: rand(2, 5), tx: def.x, tz: def.z, baseRy: def.ry || 0 });
  }
}

function drawMarker(n, chr) {
  n.mkChar = chr;
  const x = n.mk.ctx;
  x.clearRect(0, 0, 96, 96);
  if (!chr) { n.mk.sp.visible = false; n.mk.tex.needsUpdate = true; return; }
  x.font = 'bold 64px "Kenney Future", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 10; x.strokeStyle = 'rgba(0,0,0,.9)';
  x.strokeText(chr, 48, 50);
  x.fillStyle = chr === '!' ? '#ffd23e' : '#8af0a0';
  x.fillText(chr, 48, 50);
  n.mk.tex.needsUpdate = true;
  n.mk.sp.visible = true;
}

let markerT = 0;
function updateNPCs(dt, playing) {
  markerT -= dt;
  for (const n of npcs) {
    if (n.def.area !== ctx.area) continue;
    n.ch.mixer.update(dt);
    const p = n.ch.obj.position;
    // marcador
    if (markerT <= 0 && RPG.P) {
      const chr = RPG.npcMarker(n.id) || '';
      if (chr !== n.mkChar) drawMarker(n, chr);
    }
    n.mk.sp.position.set(p.x, 2.5 + Math.sin(time * 2.5 + p.x) * 0.12, p.z);
    if (!playing) continue;
    // olha para o herói quando perto
    const dx = H.x - p.x, dz = H.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 4.5) {
      const want = Math.atan2(dx, dz);
      let diff = want - n.ch.obj.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      n.ch.obj.rotation.y += diff * Math.min(1, 6 * dt);
      if (n.ch.current === 'walk') n.ch.play('idle');
      continue;
    }
    // passeio
    if (n.def.wander) {
      n.wanderT -= dt;
      const tdx = n.tx - p.x, tdz = n.tz - p.z;
      const td = Math.hypot(tdx, tdz);
      if (td > 0.3) {
        p.x += tdx / td * 1.1 * dt;
        p.z += tdz / td * 1.1 * dt;
        n.ch.obj.rotation.y = Math.atan2(tdx, tdz);
        n.ch.play('walk', false, 0.9);
      } else {
        n.ch.play('idle');
        if (n.wanderT <= 0) {
          n.wanderT = rand(3, 7);
          n.tx = n.def.x + rand(-n.def.wander, n.def.wander);
          n.tz = n.def.z + rand(-n.def.wander, n.def.wander);
        }
      }
    }
  }
  if (markerT <= 0) markerT = 0.4;
}

// ------------------------------------------------------------
// Atualização principal
// ------------------------------------------------------------
function updateHero(dt) {
  if (!H.ch) return;
  H.ch.mixer.update(dt);
  if (H.dead) return;

  H.atkCd = Math.max(0, H.atkCd - dt);
  H.comboT = Math.max(0, H.comboT - dt);
  H.iframes = Math.max(0, H.iframes - dt);
  H.dashCd = Math.max(0, H.dashCd - dt);
  H.castLock = Math.max(0, H.castLock - dt);
  H.shootingT = Math.max(0, H.shootingT - dt);

  computeAim();

  // entradas de combate
  if (INPUT.pressed('melee')) melee();
  if (INPUT.pressed('dash')) dash();
  shoot(dt);
  for (let s = 0; s < 4; s++) if (INPUT.pressed('spell' + (s + 1))) castSpell(s);
  if (INPUT.pressed('cast')) castSpell(RPG.P.selSpell);
  if (INPUT.pressed('spellNext')) { RPG.P.selSpell = (RPG.P.selSpell + 1) % 4; ctx.ui.refreshHUD(); AudioSys.play('click', 0.4); }
  if (INPUT.pressed('spellPrev')) { RPG.P.selSpell = (RPG.P.selSpell + 3) % 4; ctx.ui.refreshHUD(); AudioSys.play('click', 0.4); }
  if (INPUT.pressed('potHp')) RPG.usePotion('vida');
  if (INPUT.pressed('potMp')) RPG.usePotion('mana');

  // movimento
  const st = RPG.stats();
  const ml = Math.hypot(INPUT.mx, INPUT.mz);
  let nx = H.x, nz = H.z;
  if (H.dashT > 0) {
    H.dashT -= dt;
    nx += H.dashDX * 16 * dt;
    nz += H.dashDZ * 16 * dt;
    burst(H.x, 0.35, H.z, 0x8a6aff, 1, 0.8, 0.25);
    H.ch.play('sprint', false, 1.6);
  } else if (ml > 0.12 && H.castLock <= 0) {
    nx += (INPUT.mx / ml) * Math.min(ml, 1) * st.speed * dt;
    nz += (INPUT.mz / ml) * Math.min(ml, 1) * st.speed * dt;
    if (H.shootingT <= 0 && H.atkCd <= 0) H.dir = Math.atan2(INPUT.mx, INPUT.mz);
    H.stepT -= dt;
    if (H.stepT <= 0) {
      H.stepT = 0.3;
      H.stepAlt = !H.stepAlt;
      const grass = ctx.world.outdoor;
      AudioSys.play((grass ? 'gstep' : 'step') + (H.stepAlt ? '1' : '2'), 0.22, rand(0.9, 1.1));
    }
    if (!['attack-melee-right', 'attack-melee-left', 'interact-right'].includes(H.ch.current)) {
      H.ch.play('walk', false, clamp(st.speed / 3.4, 1, 1.9));
    }
  } else if (!['attack-melee-right', 'attack-melee-left', 'interact-right'].includes(H.ch.current)) {
    if (H.shootingT > 0) H.ch.play('holding-right-shoot', false, 1.4);
    else H.ch.play('idle');
  }
  const c = ctx.world.collide(nx, nz, 0.45);
  H.x = c.x; H.z = c.z;
  H.ch.obj.position.set(H.x, 0, H.z);
  H.ch.obj.rotation.y = H.dir;
  H.ch.obj.visible = H.iframes > 0.05 ? (Math.floor(time * 16) % 2 === 0) : true;
  H.light.position.set(H.x, 2.2, H.z + 0.5);
  H.light.intensity = ctx.world.outdoor ? 0 : 6;

  // troca para espada quando fica um tempo sem atirar
  if (H.hand === 'gun' && H.shootingT <= 0 && H.shootCd < -1.2) setHand('sword');

  // mana
  RPG.P.mana = Math.min(st.maxMana, RPG.P.mana + st.manaRegen * dt);
  for (const k of Object.keys(RPG.P.cds)) RPG.P.cds[k] = Math.max(0, RPG.P.cds[k] - dt);

  // rastro do golpe
  if (trail.material.opacity > 0) {
    trail.material.opacity = Math.max(0, trail.material.opacity - dt * 3.2);
    trail.scale.setScalar(Math.min(1.2, trail.scale.x + dt * 2.4));
    trail.position.set(H.x, 0.55, H.z);
    trail.rotation.y = H.dir;
  }
  if (muzzleT > 0) { muzzleT -= dt; if (muzzleT <= 0) muzzle.visible = false; }
}

function updateProjectiles(dt) {
  // balas do herói
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    b.x += b.dx * 22 * dt;
    b.z += b.dz * 22 * dt;
    b.m.position.set(b.x, 1.05, b.z);
    let dead = b.life <= 0;
    for (const e of enemies) {
      if (!e.alive || e.dying) continue;
      if (e.type === 'ghost' && e.phase === 'hidden') continue;
      const p = e.ch.obj.position;
      if (Math.hypot(p.x - b.x, p.z - b.z) < e.def.radius + 0.25) {
        const crit = Math.random() < 0.08 + RPG.stats().MIRA * 0.006;
        damageEnemy(e, Math.round(b.dmg * rand(0.85, 1.15) * (crit ? 1.8 : 1)), crit, b.dx, b.dz, 3);
        RPG.questEvent('gunhit');
        dead = true;
        break;
      }
    }
    if (dead) {
      b.m.visible = false;
      bulletPool.push(b.m);
      bullets.splice(i, 1);
    }
  }
  // bolas de fogo
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const f = fireballs[i];
    f.life -= dt;
    f.m.position.x += f.dx * 13 * dt;
    f.m.position.z += f.dz * 13 * dt;
    burst(f.m.position.x, 1.0, f.m.position.z, pick([0xff8a3a, 0xffc24a]), 1, 0.6, 0.3);
    let explode = f.life <= 0;
    for (const e of enemies) {
      if (!e.alive || e.dying) continue;
      const p = e.ch.obj.position;
      if (Math.hypot(p.x - f.m.position.x, p.z - f.m.position.z) < e.def.radius + 0.35) { explode = true; break; }
    }
    if (explode) {
      AudioSys.play('boom', 0.6, rand(0.95, 1.15));
      burst(f.m.position.x, 1, f.m.position.z, 0xff8a3a, 16, 4.5, 0.55);
      burst(f.m.position.x, 1, f.m.position.z, 0xffd23e, 8, 3, 0.4);
      damageInCircle(f.m.position.x, f.m.position.z, 2.4, f.dmg, true);
      ctx.game.addShake(0.18);
      ctx.scene.remove(f.m);
      fireballs.splice(i, 1);
    }
  }
  // orbes dos chefes
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    o.life -= dt;
    o.x += o.dx * 7.5 * dt;
    o.z += o.dz * 7.5 * dt;
    o.m.position.set(o.x, 1.0 + Math.sin(time * 6 + i) * 0.1, o.z);
    let dead = o.life <= 0;
    if (!H.dead && Math.hypot(H.x - o.x, H.z - o.z) < 0.55) {
      hurtHero(Math.round(o.dmg));
      dead = true;
    }
    if (dead) {
      o.m.visible = false;
      orbPool.push(o.m);
      orbs.splice(i, 1);
    }
  }
}

function updateFx(dt) {
  for (let i = dmgLive.length - 1; i >= 0; i--) {
    const d = dmgLive[i];
    d.life -= dt;
    d.sp.position.y += d.vy * dt;
    d.vy *= 0.92;
    if (d.life < 0.35) d.sp.material.opacity = d.life / 0.35;
    if (d.life <= 0) { d.sp.visible = false; dmgLive.splice(i, 1); }
  }
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
  // moedas
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
    const dx = H.x - c.m.position.x, dz = H.z - c.m.position.z;
    const d = Math.hypot(dx, dz);
    if (c.t > 0.4 && d < 2.6) {
      c.m.position.x += (dx / d) * 8 * dt;
      c.m.position.z += (dz / d) * 8 * dt;
    }
    if (c.t > 0.4 && d < 0.62) {
      c.live = false; c.m.visible = false;
      coinsLive.splice(i, 1);
      RPG.addGold(1);
      if (Math.random() < 0.5) AudioSys.play('coin', 0.35, rand(0.95, 1.15));
    }
  }
  // drops especiais
  for (let i = drops.length - 1; i >= 0; i--) {
    const dr = drops[i];
    dr.t += dt;
    dr.sp.position.y = 1 + Math.sin(dr.t * 3) * 0.15;
    if (dr.glow) dr.glow.intensity = 8 + Math.sin(dr.t * 5) * 3;
    if (dr.kind === 'fragmento' && Math.random() < dt * 14) {
      burst(dr.x + rand(-0.4, 0.4), rand(0.6, 1.6), dr.z + rand(-0.4, 0.4), pick([0xff6ab2, 0xffd2e8]), 1, 0.7, 0.5);
    }
    if (Math.hypot(H.x - dr.x, H.z - dr.z) < 1.3) {
      ctx.scene.remove(dr.sp);
      if (dr.glow) ctx.scene.remove(dr.glow);
      drops.splice(i, 1);
      if (dr.kind === 'fragmento') {
        RPG.P.frags++;
        RPG.giveItem('fragmento');
        RPG.questEvent('frag');
        AudioSys.play('jquest', 0.9);
        ctx.game.announce(`💖 FRAGMENTO ${RPG.P.frags}/3 RECUPERADO!`, 2600);
        burst(H.x, 1.2, H.z, 0xff6ab2, 22, 4, 0.8);
        RPG.save();
      } else {
        RPG.giveItem(dr.kind);
        AudioSys.play('coin', 0.6);
        ctx.ui.toast((dr.kind === 'pocao-vida' ? '🧪' : '🔮') + ' ' + RPG.ITEMS[dr.kind].nome + ' recolhida');
      }
    }
  }
}

// ------------------------------------------------------------
// API
// ------------------------------------------------------------
export const ENT = {
  H, enemies, npcs,
  init(c) { ctx = c; },
  createPools() {
    initDmgPool();
    initParticles();
    initCoins();
    initProjectiles();
    initEnemyPool();
    spawnNPCs();
  },
  buildHero,
  makeChar,

  refreshHandWeapon() {
    if (!H.ch || !RPG.P) return;
    const arm = H.ch.obj.getObjectByName('arm-right');
    if (!arm) return;
    if (H.swordGrip) arm.remove(H.swordGrip);
    if (H.gunGrip) arm.remove(H.gunGrip);
    const sw = RPG.ITEMS[RPG.P.equip.espada];
    H.swordGrip = meleeGrip('weapons/' + (sw ? sw.model : 'sword-a'));
    arm.add(H.swordGrip);
    const gun = RPG.P.equip.fogo && RPG.ITEMS[RPG.P.equip.fogo];
    H.gunGrip = gun ? gunGrip('guns/' + gun.model) : null;
    if (H.gunGrip) arm.add(H.gunGrip);
    H.swordGrip.visible = H.hand === 'sword' || !H.gunGrip;
    if (H.gunGrip) H.gunGrip.visible = H.hand === 'gun';
  },

  update(dt, playing) {
    time += dt;
    updateNPCs(dt, playing);
    if (!playing) { if (H.ch) H.ch.mixer.update(dt); updateFx(dt); return; }
    updateHero(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateFx(dt);
  },

  spawnEnemy, spawnBoss, damageEnemy, hurtHero, damageInCircle,
  castSpellIdx: castSpell,
  enemiesAlive() { return enemies.filter(e => e.alive && !e.dying).length; },
  clearEnemies() {
    for (const e of [...enemies]) releaseEnemy(e);
    for (const b of bullets) { b.m.visible = false; bulletPool.push(b.m); }
    bullets.length = 0;
    for (const o of orbs) { o.m.visible = false; orbPool.push(o.m); }
    orbs.length = 0;
    for (const f of fireballs) ctx.scene.remove(f.m);
    fireballs.length = 0;
    for (const c of coinsLive) { c.live = false; c.m.visible = false; }
    coinsLive.length = 0;
    for (const d of drops) { ctx.scene.remove(d.sp); if (d.glow) ctx.scene.remove(d.glow); }
    drops.length = 0;
    ctx.ui.bossBar(null);
    activeBoss = null;
  },
  killRoom() {
    for (const e of [...enemies]) if (e.alive && !e.dying) damageEnemy(e, 99999, false, 0, 0, 0);
  },
  vacuumDrops() { for (const d of drops) { d.x = H.x; d.z = H.z; } },
  get activeBoss() { return activeBoss; },
  get dropCount() { return drops.length; },
  burstAt(x, y, z, color, n = 10, speed = 3.4) { burst(x, y, z, color, n, speed, 0.6); },
  heroBurst(color) { burst(H.x, 1, H.z, color, 14, 3, 0.6); },
  levelUpBurst() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        burst(H.x, 0.4 + i * 0.5, H.z, 0xffd23e, 16, 4, 0.9);
        burst(H.x, 0.6 + i * 0.5, H.z, 0xfff0b0, 8, 2.5, 0.8);
      }, i * 160);
    }
  },

  npcInteractables() {
    const out = [];
    for (const n of npcs) {
      if (n.def.area !== ctx.area) continue;
      const p = n.ch.obj.position;
      out.push({ x: p.x, z: p.z, r: 2.2, label: 'Falar com ' + n.def.nome.split(',')[0], icon: '💬', npc: n.id, fn: () => ctx.ui.openDialog(n.id) });
    }
    return out;
  },

  placeHero(x, z, dir = Math.PI) {
    H.x = x; H.z = z; H.dir = dir;
    H.dead = false;
    if (H.ch) {
      H.ch.obj.position.set(x, 0, z);
      H.ch.obj.rotation.y = dir;
      H.ch.obj.visible = true;
      H.ch.reset();
      H.ch.play('idle');
    }
  },

  reviveHero() {
    H.dead = false;
    H.iframes = 1.2;
    if (H.ch) { H.ch.reset(); H.ch.play('idle'); }
  },
};
