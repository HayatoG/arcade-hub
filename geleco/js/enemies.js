// ============================================================
// ENEMIES — gosminha (slime), espinhoso (spiky), zangão (bee)
// ============================================================
import * as THREE from 'three';
import { scene, G, burst, hitStop, addShake, rand, clamp } from './core.js';
import { INPUT } from './input.js';
import { world } from './world.js';
import { spawnChar } from './player.js';

const SFX = () => AudioSys;
export const enemies = [];

// topo do chão mais alto abaixo de (x, yFrom)
function groundTop(x, yFrom) {
  let best = -99;
  for (const s of world.solids) {
    if (x >= s.x0 && x <= s.x1 && s.y1 <= yFrom + 0.15 && s.y1 > best) best = s.y1;
  }
  for (const c of world.cratesS) {
    if (!c.broken && x >= c.x0 && x <= c.x1 && c.y1 <= yFrom + 0.15 && c.y1 > best) best = c.y1;
  }
  return best;
}

class Enemy {
  constructor(type, x, y) {
    this.type = type; this.x = x; this.y = y;
    this.alive = true; this.dying = 0;
    this.baseX = x; this.baseY = y; this.t = rand(0, 6);
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.vy = 0;

    if (type === 'slime') {
      this.ch = spawnChar('character-oozi', 0.62, 0xff7d6a);
      this.speed = 1.7;
    } else if (type === 'spiky') {
      this.ch = spawnChar('character-oodi', 0.7, 0xffb05c);
      this.speed = 1.3;
      this.spikes = [];
      const cone = new THREE.ConeGeometry(0.09, 0.34, 5);
      const mat = new THREE.MeshLambertMaterial({ color: 0xe8e4d8 });
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(cone, mat);
        const a = (i / 7) * Math.PI * 1.5 - Math.PI * 0.75;
        m.position.set(Math.sin(a) * 0.3, 0.55 + Math.cos(a) * 0.28, 0);
        m.rotation.z = -a;
        m.castShadow = true;
        this.ch.wrap.add(m);
        this.spikes.push(m);
      }
    } else { // bee
      this.ch = spawnChar('character-oopi', 0.55, 0xffe06a);
      this.wings = [];
      const wg = new THREE.PlaneGeometry(0.34, 0.2);
      const wm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
      for (const sgn of [-1, 1]) {
        const w = new THREE.Mesh(wg, wm);
        w.position.set(sgn * 0.26, 0.52, -0.05);
        this.ch.wrap.add(w);
        this.wings.push(w);
      }
    }
    this.mesh = this.ch.wrap;
    this.mesh.position.set(x, y, 0);
    scene.add(this.mesh);
    const act = this.ch.actions['walk'] || this.ch.actions['idle'];
    if (act) { act.play(); act.timeScale = 1.3; }
  }

  spikesOut() {
    if (this.type !== 'spiky') return false;
    return (this.t % 3.3) < 1.65;
  }

  update(dt, player) {
    if (!this.alive) {
      this.dying -= dt;
      if (this.dying <= 0 && this.mesh.parent) scene.remove(this.mesh);
      else { this.mesh.scale.y *= (1 - 8 * dt); this.mesh.scale.x *= (1 + 2 * dt); }
      return;
    }
    this.t += dt;
    this.ch.mixer.update(dt);

    if (this.type === 'bee') {
      this.x = this.baseX + Math.sin(this.t * 0.85) * 2.6;
      this.y = this.baseY + Math.sin(this.t * 2.2) * 1.05;
      this.dir = Math.cos(this.t * 0.85) >= 0 ? 1 : -1;
      for (let i = 0; i < this.wings.length; i++) {
        this.wings[i].rotation.z = (i ? 1 : -1) * (0.5 + Math.sin(this.t * 38) * 0.7);
      }
    } else {
      // andadores: gravidade + patrulha com detecção de borda
      this.vy -= 30 * dt;
      this.y += this.vy * dt;
      const top = groundTop(this.x, this.y + 0.3);
      if (this.y <= top && this.vy <= 0) { this.y = top; this.vy = 0; }
      const ahead = groundTop(this.x + this.dir * 0.42, this.y + 0.3);
      const wallAt = this.y + 0.2;
      let blocked = ahead < this.y - 0.6;              // borda
      for (const s of world.solids) {                  // parede
        if (this.x + this.dir * 0.45 > s.x0 && this.x + this.dir * 0.45 < s.x1 && wallAt > s.y0 && wallAt < s.y1) { blocked = true; break; }
      }
      if (blocked) this.dir *= -1;
      this.x += this.dir * this.speed * dt;

      if (this.type === 'spiky') {
        const k = this.spikesOut() ? 1 : Math.max(0.05, 1 - ((this.t % 3.3) - 1.65) * 6);
        const kk = this.spikesOut() ? Math.min(1, ((this.t % 3.3)) * 6) : k;
        for (const s of this.spikes) s.scale.setScalar(clamp(kk, 0.05, 1));
      }
    }

    // vira pro lado certo
    const targetRot = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.mesh.rotation.y += (targetRot - this.mesh.rotation.y) * Math.min(1, dt * 8);
    this.mesh.position.set(this.x, this.y, 0);

    // ---- interação com o player
    if (!player || player.dead || player.frozen) return;

    // quicada mata num raio
    if (player.poundImpact > 0 && Math.abs(player.x - this.x) < 1.35 && Math.abs(player.y - this.y) < 1.1) {
      this.kill(player, true);
      return;
    }

    const h = this.type === 'bee' ? 0.6 : 0.65;
    const overl = Math.abs(player.x - this.x) < 0.62 && player.y < this.y + h && player.y + 0.9 > this.y;
    if (!overl) return;

    const stomp = player.vy < -1.5 && player.y > this.y + h * 0.45;
    if (stomp) {
      if (this.type === 'spiky' && this.spikesOut()) {
        player.damage(this.x);
      } else {
        this.kill(player);
        player.bounce();
      }
    } else if (player.inv <= 0) {
      player.damage(this.x);
    }
  }

  kill(player, fromPound) {
    this.alive = false; this.dying = 0.35;
    const col = this.type === 'slime' ? 0xff7d6a : this.type === 'spiky' ? 0xffb05c : 0xffe06a;
    burst(this.x, this.y + 0.4, 0, col, 16, { speed: 5, up: 5.5, life: 0.6 });
    hitStop(fromPound ? 0.03 : 0.06);
    addShake(0.08);
    SFX().play('stomp', 0.95, fromPound ? 0.85 : 1);
    G.runCoins += 1;
    burst(this.x, this.y + 0.7, 0, 0xffd34d, 4, { speed: 2, up: 4, life: 0.45 });
  }
}

export function spawnEnemies() {
  clearEnemies();
  for (const s of world.enemySpawns) enemies.push(new Enemy(s.t, s.x, s.y));
}

export function spawnSlimeAt(x, y, dir) {
  const e = new Enemy('slime', x, y);
  e.dir = dir; e.vy = 5;
  enemies.push(e);
  return e;
}

export function clearEnemies() {
  for (const e of enemies) if (e.mesh.parent) scene.remove(e.mesh);
  enemies.length = 0;
}

export function updateEnemies(dt, player) {
  for (const e of enemies) {
    if (player && Math.abs(e.x - player.x) > 30) continue;
    e.update(dt, player);
  }
}

export function livingSlimes() {
  return enemies.filter(e => e.alive && e.type === 'slime').length;
}
