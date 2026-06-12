// ============================================================
// PLAYER — Geleco: física de plataforma + squash & stretch
// ============================================================
import * as THREE from 'three';
import { clone as skClone } from '../lib/utils/SkeletonUtils.js';
import { G, burst, addShake, hitStop, clamp, lerp } from './core.js';
import { INPUT } from './input.js';
import { LIB, world, dynSolids } from './world.js';

const SFX = () => AudioSys;

const GRAV = 34, TERM = -26;
const WALK = 6.2, ACC_G = 60, ACC_A = 38, FRIC = 48;
const ACC_ICE = 26, FRIC_ICE = 7;
const JUMP_V = 12.6, DJUMP_V = 12.6, COYOTE = 0.1, JBUF = 0.12;
const SPRING_V = 19, SPRING_MEGA_V = 23;
const POUND_V = -28, HALF = 0.3, TALL = 0.9;

export function spawnChar(name, height, tint) {
  const src = LIB[name];
  const root = skClone(src.scene);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  const wrap = new THREE.Group();
  const box = new THREE.Box3().setFromObject(root);
  const ctr = new THREE.Vector3(); box.getCenter(ctr);
  root.position.set(-ctr.x, -box.min.y, -ctr.z);
  const inner = new THREE.Group();          // para squash (escala) sem brigar com anim
  inner.add(root);
  wrap.add(inner);
  const s = height / (box.max.y - box.min.y);
  inner.scale.setScalar(s);
  if (tint) {
    root.traverse(o => {
      if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tint)); }
    });
  }
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const clip of src.animations) actions[clip.name] = mixer.clipAction(clip);
  return { wrap, inner, root, mixer, actions, baseScale: s };
}

export class Player {
  constructor() {
    const ch = spawnChar('character-oobi', 0.95, 0x9af065);
    this.ch = ch;
    this.mesh = ch.wrap;
    // nó da pirueta: gira pelo centro do corpo, sem compor com o yaw do wrap
    this.spinner = new THREE.Group();
    this.mesh.remove(ch.inner);
    this.spinner.position.y = 0.475;
    ch.inner.position.y = -0.475;
    this.spinner.add(ch.inner);
    this.mesh.add(this.spinner);
    this.x = 4; this.y = 5; this.vx = 0; this.vy = 0;
    this.face = 1;
    this.onGround = false;
    this.coyote = 0; this.jbuf = 0; this.jumps = 0;
    this.pounding = false; this.poundDelay = 0;
    this.poundImpact = 0;        // janela de dano da quicada
    this.inv = 0; this.hearts = 3;
    this.dead = false; this.won = false; this.frozen = false;
    this.sq = 1; this.sqV = 0;   // mola do squash
    this.anim = ''; this.runDust = 0;
    this.spin = 0;               // pirueta do pulo duplo
    this.jumpCut = false;        // o corte de altura só vale p/ pulos do jogador
    this.standMover = null;
    this._solids = [];
  }

  spawn(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.dead = false; this.won = false; this.frozen = false;
    this.pounding = false; this.inv = 1.2; this.jumps = 0;
    this.spin = 0; this.sq = 1; this.sqV = 0; this.jumpCut = false;
    // zera qualquer rotação residual (tombo da morte, pirueta interrompida)
    this.mesh.rotation.set(0, this.face > 0 ? Math.PI / 2 - 0.22 : -Math.PI / 2 + 0.22, 0);
    this.spinner.rotation.set(0, 0, 0);
    this.mesh.visible = true;
    this.setAnim('idle', 0);
    this.place();
  }

  place() {
    this.mesh.position.set(this.x, this.y, 0);
  }

  setAnim(name, fade = 0.12) {
    if (this.anim === name) return;
    const a = this.ch.actions;
    const next = a[name] || a['idle'] || a['static'];
    if (!next) return;
    const prev = a[this.anim];
    next.reset().fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    this.anim = name;
  }

  // ---------- reações ----------
  bounce(strong) {
    this.vy = strong || (INPUT.jumpHeld ? 15 : 10);
    this.jumps = 1; this.pounding = false; this.jumpCut = false;
    this.sqV = 4;
  }
  crateBounce() { this.vy = INPUT.jumpHeld ? 12 : 8; this.jumps = 1; this.jumpCut = false; }
  springBounce() {
    const mega = this.pounding;
    this.vy = mega ? SPRING_MEGA_V : SPRING_V;
    this.pounding = false; this.jumps = 1; this.jumpCut = false;
    this.sqV = 5;
    burst(this.x, this.y, 0, mega ? 0xffd34d : 0xbfffa0, mega ? 18 : 10, { speed: 3, up: 5, life: 0.5 });
    SFX().play('spring', 0.9, mega ? 0.8 : 1);
    if (mega) { addShake(0.12); }
  }

  damage(fromX) {
    if (this.inv > 0 || this.dead) return;
    this.hearts--;
    SFX().play('hurt', 0.95);
    burst(this.x, this.y + 0.5, 0, 0xff5d5d, 12, { speed: 4, up: 4, life: 0.5 });
    addShake(0.22); hitStop(0.07);
    if (this.hearts <= 0) { this.die(); return; }
    this.inv = 1.2;
    this.vx = (this.x < fromX ? -1 : 1) * 7;
    this.vy = 8;
    this.pounding = false;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deadT = 0;
    SFX().play('die', 1);
    burst(this.x, this.y + 0.4, 0, 0x7bf24c, 26, { speed: 6, up: 7, life: 0.9 });
    this.setAnim('die', 0.06);
    this.vx = 0; this.vy = 6;
  }

  fellOff() {                      // caiu do mapa
    this.hearts--;
    SFX().play('hurt', 0.9);
    addShake(0.2);
    if (this.hearts <= 0) { this.dead = true; this.deadT = 0.6; SFX().play('die', 1); return; }
    const cp = G.checkpoint;
    this.spawn(cp.x, cp.y);
  }

  // ---------- update ----------
  update(dt) {
    const ch = this.ch;
    ch.mixer.update(dt);

    if (this.dead) {
      this.deadT += dt;
      this.vy -= GRAV * 0.6 * dt;
      this.y += this.vy * dt;
      this.mesh.rotation.z += dt * 5;
      this.place();
      return;
    }
    if (this.frozen) { this.place(); return; }

    this.inv = Math.max(0, this.inv - dt);
    this.poundImpact = Math.max(0, this.poundImpact - dt);
    this.mesh.visible = this.inv <= 0 || (G.time * 18 | 0) % 2 === 0;

    const ice = G.def && G.def.ice;
    const mx = INPUT.moveX;

    // ---- horizontal
    if (!this.pounding) {
      const acc = this.onGround ? (ice ? ACC_ICE : ACC_G) : ACC_A;
      if (Math.abs(mx) > 0.08) {
        this.vx += mx * acc * dt;
        const cap = WALK * Math.min(1, Math.abs(mx) + 0.25);
        this.vx = clamp(this.vx, -cap, cap);
        this.face = mx > 0 ? 1 : -1;
      } else if (this.onGround) {
        const f = (ice ? FRIC_ICE : FRIC) * dt;
        if (Math.abs(this.vx) <= f) this.vx = 0; else this.vx -= Math.sign(this.vx) * f;
      } else {
        this.vx *= (1 - 0.6 * dt);
      }
    }

    // ---- pulo
    if (INPUT.pressed('jump')) this.jbuf = JBUF;
    else this.jbuf = Math.max(0, this.jbuf - dt);

    if (this.jbuf > 0 && !this.pounding) {
      if (this.onGround || this.coyote > 0) {
        this.vy = JUMP_V; this.jumps = 1; this.jbuf = 0; this.coyote = 0;
        this.onGround = false; this.jumpCut = true;
        this.sqV = 3.5;
        burst(this.x, this.y, 0, 0xcfd8c8, 5, { speed: 1.6, up: 1.2, life: 0.3, grav: 3 });
        SFX().play('jump', 0.75);
      } else if (this.jumps === 1) {
        this.vy = DJUMP_V; this.jumps = 2; this.jbuf = 0; this.jumpCut = true;
        this.spin = Math.PI * 2;
        burst(this.x, this.y + 0.3, 0, 0xffffff, 9, { speed: 2.6, up: 2, life: 0.4, grav: 2 });
        SFX().play('djump', 0.8);
      }
    }
    // corte de pulo (altura variável) — só nos pulos do jogador, nunca em mola/quique
    if (!INPUT.jumpHeld && this.vy > 4 && this.jumpCut && !this.pounding) this.vy = 4;

    // ---- quicada
    if (INPUT.pressed('pound') && !this.onGround && !this.pounding) {
      this.pounding = true;
      this.poundDelay = 0.11;
      this.vx *= 0.2;
      SFX().play('rumble', 0.5, 1.6);
    }

    // ---- gravidade
    if (this.pounding) {
      if (this.poundDelay > 0) { this.poundDelay -= dt; this.vy = 0.5; }
      else this.vy = POUND_V;
    } else {
      this.vy -= GRAV * dt;
      if (this.vy < TERM) this.vy = TERM;
    }

    // ---- integra + colide
    const solids = dynSolids(this._solids);
    const prevY = this.y;
    this.standMover = null;

    // X
    this.x += this.vx * dt;
    if (this.x < HALF) { this.x = HALF; this.vx = 0; }
    if (this.x > world.width - HALF) { this.x = world.width - HALF; this.vx = 0; }
    for (const s of solids) {
      if (this.x + HALF > s.x0 && this.x - HALF < s.x1 && this.y < s.y1 - 0.02 && this.y + TALL > s.y0 + 0.02) {
        if (this.vx > 0 && this.x < s.x0) { this.x = s.x0 - HALF; this.vx = 0; }
        else if (this.vx < 0 && this.x > s.x1) { this.x = s.x1 + HALF; this.vx = 0; }
        else if (this.vx === 0) { this.x = this.x < (s.x0 + s.x1) / 2 ? s.x0 - HALF : s.x1 + HALF; }
      }
    }

    // Y
    this.y += this.vy * dt;
    const wasGround = this.onGround;
    this.onGround = false;
    for (const s of solids) {
      if (this.x + HALF <= s.x0 || this.x - HALF >= s.x1) continue;
      if (this.vy <= 0 && this.y <= s.y1 && prevY >= s.y1 - 0.05) {
        this.y = s.y1; this.vy = 0; this.onGround = true;
        if (s.mover) this.standMover = s.mover;
      } else if (this.vy > 0 && this.y + TALL >= s.y0 && prevY + TALL <= s.y0 + 0.05) {
        this.y = s.y0 - TALL; this.vy = 0.5;
      }
    }
    // one-way
    if (this.vy <= 0) {
      for (const p of world.plats) {
        if (this.x + HALF <= p.x0 || this.x - HALF >= p.x1) continue;
        if (this.y <= p.top && prevY >= p.top - 0.06) {
          this.y = p.top; this.vy = 0; this.onGround = true;
        }
      }
    }

    // carrega junto com a plataforma móvel
    if (this.standMover) {
      this.x += this.standMover.x - this.standMover.px;
      this.y = this.standMover.y + this.standMover.h;
    }

    // pouso
    if (this.onGround && !wasGround) {
      this.jumps = 0; this.spin = 0;
      if (this.pounding) {
        this.pounding = false;
        this.poundImpact = 0.14;
        addShake(0.3); hitStop(0.05);
        burst(this.x, this.y + 0.05, 0, 0xd8cfa8, 22, { speed: 6.5, up: 2.5, life: 0.55, grav: 8 });
        SFX().play('pound', 1);
        if (INPUT.jumpHeld) {           // super quique
          this.vy = 16.5; this.jumps = 1; this.onGround = false; this.jumpCut = false;
          SFX().play('djump', 0.9, 0.8);
        } else this.sqV = -8;
      } else {
        this.sqV = -5 * Math.min(1, Math.abs(this.vy) * 0.04 + 0.4);
        if (prevY - this.y > 0.01) SFX().play('land', 0.4);
        burst(this.x, this.y + 0.03, 0, 0xcfd8c8, 4, { speed: 1.8, up: 1, life: 0.25, grav: 4 });
      }
    }
    this.coyote = this.onGround ? COYOTE : Math.max(0, this.coyote - dt);

    // poeira de corrida
    if (this.onGround && Math.abs(this.vx) > 3.4) {
      this.runDust -= dt;
      if (this.runDust <= 0) {
        this.runDust = 0.09;
        burst(this.x - this.face * 0.25, this.y + 0.04, 0, 0xdfe8d8, 1, { speed: 1, up: 1.4, life: 0.3, grav: 3 });
      }
    }

    // caiu do mundo
    if (this.y < -4) { this.fellOff(); return; }

    // ---- visual: rotação, squash, anim
    const targetRot = this.face > 0 ? Math.PI / 2 - 0.22 : -Math.PI / 2 + 0.22;
    this.mesh.rotation.y += (targetRot - this.mesh.rotation.y) * Math.min(1, dt * 14);

    if (this.spin > 0) {
      const d = Math.min(this.spin, dt * 13);
      this.spin -= d;
      this.spinner.rotation.x -= d;
    } else this.spinner.rotation.x *= (1 - Math.min(1, dt * 16));

    // mola do squash
    this.sqV += (1 - this.sq) * 130 * dt;
    this.sqV *= Math.max(0, 1 - 11 * dt);
    this.sq += this.sqV * dt;
    let sy = this.sq, sxz = 2 - this.sq;
    if (!this.onGround && !this.pounding) {
      const st = clamp(1 + Math.abs(this.vy) * 0.011, 1, 1.22);
      sy *= st; sxz *= (2 - st);
    }
    if (this.pounding) { sy = 0.72; sxz = 1.25; }
    this.ch.inner.scale.set(this.ch.baseScale * clamp(sxz, 0.6, 1.5), this.ch.baseScale * clamp(sy, 0.45, 1.6), this.ch.baseScale * clamp(sxz, 0.6, 1.5));

    // animação
    if (this.pounding) this.setAnim('crouch', 0.06);
    else if (!this.onGround) this.setAnim(this.vy > 1 ? 'jump' : 'fall');
    else if (Math.abs(this.vx) > 4.4) this.setAnim('sprint');
    else if (Math.abs(this.vx) > 0.4) this.setAnim('walk');
    else this.setAnim('idle');
    const wa = this.ch.actions['walk'], sa = this.ch.actions['sprint'];
    if (wa) wa.timeScale = 1.5;
    if (sa) sa.timeScale = 1.25;

    this.place();
  }

  idleAnim(dt) { this.setAnim('idle'); }
}
