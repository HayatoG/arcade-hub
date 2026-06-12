// ============================================================
// BOSS — REI BOCÃO, o glutão que engoliu as estrelas
// ============================================================
import * as THREE from 'three';
import { scene, G, burst, addShake, hitStop, clamp, rand, announce } from './core.js';
import { INPUT } from './input.js';
import { spawnChar } from './player.js';
import { spawnSlimeAt, livingSlimes } from './enemies.js';

const SFX = () => AudioSys;
const FLOOR = 4;          // topo do chão da arena

export function makeCrown(r = 0.5) {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd34d, metalness: 0.6, roughness: 0.35 });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, r * 0.55, 10, 1, true), gold);
  ring.material.side = THREE.DoubleSide;
  g.add(ring);
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.18, r * 0.5, 4), gold);
    const a = (i / 5) * Math.PI * 2;
    spike.position.set(Math.cos(a) * r, r * 0.45, Math.sin(a) * r);
    g.add(spike);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class Boss {
  constructor(x, y) {
    this.ch = spawnChar('character-oozi', 3.1, 0xa566e8);
    this.mesh = this.ch.wrap;
    this.x = x; this.y = y; this.vy = 0;
    this.face = -1;
    this.hpMax = 6; this.hp = this.hpMax;
    this.state = 'intro'; this.t = 0;
    this.leaps = 0;
    this.dead = false;
    this.waves = [];
    this.stunStars = [];
    this.flash = 0;

    this.crown = makeCrown(0.62);
    this.crown.position.y = 2.95;
    this.mesh.add(this.crown);

    // estrelinhas do atordoamento
    const sg = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16),
        new THREE.MeshBasicMaterial({ color: 0xffd34d })
      );
      sg.add(s); this.stunStars.push(s);
    }
    sg.position.y = 3.5; sg.visible = false;
    this.stunGroup = sg;
    this.mesh.add(sg);

    // sombra do super bote
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 18),
      new THREE.MeshBasicMaterial({ color: 0x1a0a2a, transparent: true, opacity: 0.5 })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.visible = false;
    scene.add(this.shadow);

    this.waveGeo = new THREE.BoxGeometry(0.7, 1, 1.6);
    this.waveMat = new THREE.MeshBasicMaterial({ color: 0xc77dff, transparent: true, opacity: 0.85 });

    this.mesh.position.set(x, y, 0);
    scene.add(this.mesh);
    this.setAnim('idle');
    this.barWrap = document.getElementById('boss-bar-wrap');
    this.barFill = document.getElementById('boss-fill');
    this.barWrap.classList.remove('hidden');
    this.updateBar();
  }

  setAnim(name, fade = 0.18) {
    if (this.anim === name) return;
    const a = this.ch.actions;
    const next = a[name] || a['idle'];
    if (!next) return;
    const prev = a[this.anim];
    next.reset().fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    this.anim = name;
  }

  updateBar() {
    this.barFill.style.width = (this.hp / this.hpMax * 100) + '%';
  }

  speedK() { return this.hp <= 2 ? 1.32 : 1; }

  spawnWaves(double) {
    const h = this.hp <= 2 ? 0.95 : 0.7;
    for (const dir of [-1, 1]) {
      this.waves.push(this.makeWave(this.x + dir * 1.6, dir, h, 8));
      if (double) this.waves.push(this.makeWave(this.x + dir * 0.6, dir, h, 5.2));
    }
    SFX().play('shock', 0.85);
  }

  makeWave(x, dir, h, speed) {
    const m = new THREE.Mesh(this.waveGeo, this.waveMat.clone());
    m.scale.y = h;
    m.position.set(x, FLOOR + h / 2, 0);
    scene.add(m);
    return { mesh: m, x, dir, h, speed, life: 4 };
  }

  hit(player) {
    this.hp = Math.max(0, this.hp - 2);     // stomp no atordoado dói em dobro
    this.flash = 0.18;
    this.updateBar();
    SFX().play('bosshurt', 1);
    hitStop(0.1); addShake(0.3);
    burst(this.x, this.y + 1.8, 0, 0xc77dff, 24, { speed: 6, up: 6, life: 0.8 });
    player.bounce(15);
    announce(this.hp > 0 ? ['', 'ELE TÁ FRACO!', 'CONTINUA ASSIM!', '', 'AINDA RESPIRA…', ''][this.hp] || '' : '');
    if (this.hp <= 0) {
      this.state = 'dying'; this.t = 0;
      this.stunGroup.visible = false;
      SFX().play('roar', 1, 0.6);
    } else {
      this.state = 'recover'; this.t = 0;
      this.stunGroup.visible = false;
    }
  }

  update(dt, player) {
    this.ch.mixer.update(dt);
    this.t += dt;
    if (this.flash > 0) {
      this.flash -= dt;
      const on = (G.time * 30 | 0) % 2 === 0;
      this.ch.root.traverse(o => {
        if (o.isMesh && o.material.emissive) {
          o.material.emissive.setHex(0xffffff);
          o.material.emissiveIntensity = on && this.flash > 0 ? 0.7 : 0;
        }
      });
    }

    // ondas de choque
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.x += w.dir * w.speed * dt;
      w.life -= dt;
      w.mesh.position.x = w.x;
      w.mesh.scale.x = 0.7 + Math.sin(G.time * 20) * 0.12;
      const gone = w.x < 2.4 || w.x > 27.6 || w.life <= 0;
      if (gone) { scene.remove(w.mesh); this.waves.splice(i, 1); continue; }
      if (player && !player.dead && player.inv <= 0 &&
          Math.abs(player.x - w.x) < 0.55 && player.y < FLOOR + w.h - 0.05) {
        player.damage(w.x);
      }
    }

    if (this.dead) return;
    const K = this.speedK();

    switch (this.state) {
      case 'intro': {
        if (this.t > 1.2) { this.state = 'idle'; this.t = 0; }
        break;
      }
      case 'idle': {
        this.setAnim('idle');
        this.face = player.x < this.x ? -1 : 1;
        if (this.t > 0.7 / K) {
          this.leaps++;
          if (this.leaps % 3 === 0) { this.state = 'superTele'; this.t = 0; SFX().play('roar', 0.9); }
          else { this.state = 'tele'; this.t = 0; }
        }
        break;
      }
      case 'tele': {        // agacha — vai pular!
        this.setAnim('crouch', 0.1);
        this.squash(0.78);
        if (this.t > 0.5 / K) {
          this.state = 'leap'; this.t = 0;
          this.leapFrom = this.x;
          this.leapTo = clamp(player.x, 4, 26);
          this.leapDur = clamp(Math.abs(this.leapTo - this.leapFrom) / 9, 0.5, 0.95) / K;
          this.setAnim('jump', 0.08);
          this.squash(1.18);
          SFX().play('djump', 0.7, 0.55);
        }
        break;
      }
      case 'leap': {
        const k = Math.min(1, this.t / this.leapDur);
        this.x = this.leapFrom + (this.leapTo - this.leapFrom) * k;
        this.y = FLOOR + Math.sin(k * Math.PI) * 5.2;
        this.face = this.leapTo > this.leapFrom ? 1 : -1;
        if (k >= 1) {
          this.state = 'land'; this.t = 0;
          this.y = FLOOR;
          addShake(0.34);
          SFX().play('bossland', 1);
          burst(this.x, FLOOR, 0, 0x8a5acc, 18, { speed: 6, up: 3, life: 0.6 });
          this.squash(0.7);
          this.spawnWaves(false);
          if (this.hp <= 4 && livingSlimes() < 3) {
            for (const d of [-1, 1]) spawnSlimeAt(clamp(this.x + d * 1.5, 3, 27), FLOOR + 1, d);
            SFX().play('roar', 0.5, 1.5);
          }
        }
        break;
      }
      case 'land': {
        this.setAnim('idle', 0.2);
        if (this.t > 0.55 / K) { this.state = 'idle'; this.t = 0; }
        break;
      }
      case 'superTele': {   // rugido + tremedeira
        this.setAnim('crouch', 0.1);
        this.mesh.position.x = this.x + rand(-0.06, 0.06);
        this.squash(0.72);
        if (this.t > 0.8 / K) {
          this.state = 'superUp'; this.t = 0;
          this.setAnim('jump', 0.06);
          SFX().play('djump', 0.8, 0.4);
        }
        break;
      }
      case 'superUp': {     // some no céu
        this.y += 26 * dt;
        if (this.t > 0.75) { this.state = 'shadow'; this.t = 0; this.shadow.visible = true; }
        break;
      }
      case 'shadow': {      // a sombra persegue você…
        this.shadow.position.set(player.x, FLOOR + 0.03, 0);
        this.shadow.scale.setScalar(0.6 + this.t * 0.5);
        this.x = player.x;
        if (this.t > 1.25 / K) {
          this.state = 'slam'; this.t = 0;
          this.y = FLOOR + 13;
          SFX().play('rumble', 0.8);
        }
        break;
      }
      case 'slam': {
        this.y -= 34 * dt;
        this.setAnim('fall', 0.08);
        if (this.y <= FLOOR) {
          this.y = FLOOR;
          this.shadow.visible = false;
          this.state = 'stunned'; this.t = 0;
          addShake(0.5); hitStop(0.06);
          SFX().play('bossland', 1, 0.8);
          SFX().play('shock', 0.9);
          burst(this.x, FLOOR, 0, 0x8a5acc, 30, { speed: 8, up: 4, life: 0.8 });
          this.spawnWaves(this.hp <= 2);
          this.squash(0.55);
          this.stunGroup.visible = true;
          announce('AGORA! PULA NA CABEÇA DELE!', 1.4);
        }
        break;
      }
      case 'stunned': {
        this.setAnim('crouch', 0.15);
        for (let i = 0; i < this.stunStars.length; i++) {
          const a = G.time * 4 + i * (Math.PI * 2 / 3);
          this.stunStars[i].position.set(Math.cos(a) * 0.8, Math.sin(G.time * 7 + i) * 0.1, Math.sin(a) * 0.8);
        }
        // stomp na cabeça = dano
        if (player && !player.dead && player.vy < -1.5 &&
            Math.abs(player.x - this.x) < 1.5 && player.y > this.y + 1.6 && player.y < this.y + 3.4) {
          this.hit(player);
          break;
        }
        if (this.t > 2.8) { this.state = 'recover'; this.t = 0; this.stunGroup.visible = false; }
        break;
      }
      case 'recover': {
        this.setAnim('idle', 0.2);
        this.squash(1.05);
        if (this.t > 0.6) { this.state = 'idle'; this.t = 0; }
        break;
      }
      case 'dying': {
        this.setAnim('die', 0.2);
        this.mesh.scale.y = Math.max(0.12, 1 - this.t * 0.5);
        this.mesh.scale.x = 1 + this.t * 0.4;
        this.mesh.scale.z = 1 + this.t * 0.4;
        if ((G.time * 10 | 0) % 2 === 0) {
          burst(this.x + rand(-1.4, 1.4), this.y + rand(0.3, 2.2), 0, 0xa566e8, 4, { speed: 4, up: 5, life: 0.7 });
        }
        if (this.t > 1.9 && !this.dead) {
          this.dead = true;
          burst(this.x, this.y + 1, 0, 0xc77dff, 40, { speed: 9, up: 8, life: 1.1 });
          burst(this.x, this.y + 1, 0, 0xffd34d, 24, { speed: 7, up: 9, life: 1.2 });
          addShake(0.5);
          this.mesh.visible = false;
          this.barWrap.classList.add('hidden');
          for (const w of this.waves) scene.remove(w.mesh);
          this.waves.length = 0;
        }
        break;
      }
    }

    // contato com o corpo (fora do stun): dói
    if (player && !player.dead && this.state !== 'stunned' && this.state !== 'dying' &&
        this.state !== 'superUp' && this.state !== 'shadow' && player.inv <= 0) {
      if (Math.abs(player.x - this.x) < 1.45 && player.y < this.y + 2.6 && player.y + 0.9 > this.y) {
        player.damage(this.x);
      }
    }

    if (this.state !== 'superTele') this.mesh.position.x = this.x;
    this.mesh.position.y = this.y;
    const targetRot = this.face > 0 ? Math.PI / 2 - 0.3 : -Math.PI / 2 + 0.3;
    this.mesh.rotation.y += (targetRot - this.mesh.rotation.y) * Math.min(1, dt * 6);

    // squash com mola
    this.sq = this.sq ?? 1; this.sqV = this.sqV ?? 0;
    this.sqV += (1 - this.sq) * 90 * dt;
    this.sqV *= Math.max(0, 1 - 9 * dt);
    this.sq += this.sqV * dt;
    if (this.state !== 'dying') {
      this.mesh.scale.set(2 - this.sq, this.sq, 2 - this.sq);
    }
    this.crown.rotation.y = G.time * 0.7;
  }

  squash(v) { this.sq = v; }

  destroy() {
    if (this.mesh.parent) scene.remove(this.mesh);
    if (this.shadow.parent) scene.remove(this.shadow);
    for (const w of this.waves) scene.remove(w.mesh);
    this.waves.length = 0;
    this.barWrap.classList.add('hidden');
  }
}
