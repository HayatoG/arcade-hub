// ============================================================
// INPUT — teclado+mouse, gamepad e toque unificados
// ============================================================
const edge = new Set();          // ações disparadas neste frame (consumíveis)
const keys = {};
let padIndex = -1, padPrev = [];
let joyX = 0, joyZ = 0, joyId = null;

export const INPUT = {
  mx: 0, mz: 0,                  // vetor de movimento
  mouseX: 0, mouseY: 0,          // posição do ponteiro (px)
  shootHeld: false,
  padAimX: 0, padAimZ: 0,        // mira do stick direito
  gamepadActive: false,
  touchActive: false,
  usingMouseAim: true,

  pressed(action) {              // edge-trigger consumível
    if (edge.has(action)) { edge.delete(action); return true; }
    return false;
  },
  clear() { edge.clear(); },

  init(onGamepad) {
    // ---------- teclado ----------
    const keyActions = {
      ' ': 'melee', 'shift': 'dash', 'e': 'interact', 'i': 'inv', 'j': 'quest',
      'q': 'potHp', 'r': 'potMp', 'escape': 'pause', 'm': 'mute', 'enter': 'confirm',
      '1': 'spell1', '2': 'spell2', '3': 'spell3', '4': 'spell4', 'tab': 'inv',
    };
    window.addEventListener('keydown', e => {
      AudioSys.unlock();
      const k = e.key.toLowerCase();
      if (e.target && e.target.tagName === 'INPUT') {
        if (k === 'enter') edge.add('confirm');
        return;
      }
      keys[k] = true;
      if ([' ', 'tab', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      if (!e.repeat && keyActions[k]) edge.add(keyActions[k]);
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; INPUT.shootHeld = false; });

    // ---------- mouse ----------
    window.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse') {
        INPUT.mouseX = e.clientX; INPUT.mouseY = e.clientY;
        INPUT.usingMouseAim = true;
      }
    });
    window.addEventListener('pointerdown', e => {
      AudioSys.unlock();
      if (e.pointerType !== 'mouse') return;
      if (e.target.closest('.overlay, .modal, button, a, input, .tbtn, #joy, .panel, .spell-slot, .pot')) return;
      if (e.button === 0) { INPUT.shootHeld = true; edge.add('shoot'); edge.add('advance'); }
      if (e.button === 2) edge.add('melee');
    });
    window.addEventListener('pointerup', e => {
      if (e.pointerType === 'mouse' && e.button === 0) INPUT.shootHeld = false;
    });
    window.addEventListener('contextmenu', e => e.preventDefault());

    // ---------- gamepad ----------
    window.addEventListener('gamepadconnected', e => {
      padIndex = e.gamepad.index;
      INPUT.gamepadActive = true;
      if (onGamepad) onGamepad(true, e.gamepad.id);
    });
    window.addEventListener('gamepaddisconnected', e => {
      if (e.gamepad.index === padIndex) { padIndex = -1; INPUT.gamepadActive = false; if (onGamepad) onGamepad(false); }
    });

    // ---------- toque ----------
    const joyEl = document.getElementById('joy');
    const stickEl = document.getElementById('joy-stick');
    function updateJoy(t) {
      const r = joyEl.getBoundingClientRect();
      let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy), max = 46;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      joyX = dx / max; joyZ = dy / max;
      stickEl.style.left = (38 + dx) + 'px';
      stickEl.style.top = (38 + dy) + 'px';
    }
    window.addEventListener('touchstart', e => {
      AudioSys.unlock();
      INPUT.touchActive = true;
      for (const t of e.changedTouches) {
        if (joyId === null && t.clientX < window.innerWidth * 0.45 &&
            !document.elementFromPoint(t.clientX, t.clientY)?.closest('.tbtn, .overlay, .modal, button')) {
          joyId = t.identifier;
          updateJoy(t);
        }
      }
    }, { passive: true });
    window.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) if (t.identifier === joyId) updateJoy(t);
    }, { passive: true });
    window.addEventListener('touchend', e => {
      for (const t of e.changedTouches) if (t.identifier === joyId) {
        joyId = null; joyX = 0; joyZ = 0;
        stickEl.style.left = '38px'; stickEl.style.top = '38px';
      }
    }, { passive: true });

    const bindBtn = (id, down, up) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', e => { e.preventDefault(); AudioSys.unlock(); down(); }, { passive: false });
      if (up) el.addEventListener('touchend', e => { e.preventDefault(); up(); }, { passive: false });
    };
    bindBtn('t-shoot', () => { INPUT.shootHeld = true; edge.add('shoot'); }, () => { INPUT.shootHeld = false; });
    bindBtn('t-melee', () => edge.add('melee'));
    bindBtn('t-spell', () => edge.add('cast'));
    bindBtn('t-dash', () => edge.add('dash'));
    bindBtn('t-interact', () => edge.add('interact'));
    bindBtn('t-inv', () => edge.add('inv'));
    bindBtn('t-quest', () => edge.add('quest'));
    bindBtn('t-pause', () => edge.add('pause'));
  },

  // chamar uma vez por frame (poll do gamepad + vetor de movimento)
  update() {
    this.mx = joyX; this.mz = joyZ;
    if (keys['a'] || keys['arrowleft']) this.mx -= 1;
    if (keys['d'] || keys['arrowright']) this.mx += 1;
    if (keys['w'] || keys['arrowup']) this.mz -= 1;
    if (keys['s'] || keys['arrowdown']) this.mz += 1;

    if (padIndex >= 0) {
      const gp = navigator.getGamepads && navigator.getGamepads()[padIndex];
      if (gp) {
        const dz = v => Math.abs(v) > 0.18 ? v : 0;
        const ax = dz(gp.axes[0] || 0), az = dz(gp.axes[1] || 0);
        if (Math.abs(ax) + Math.abs(az) > 0.05) { this.mx = ax; this.mz = az; }
        this.padAimX = dz(gp.axes[2] || 0); this.padAimZ = dz(gp.axes[3] || 0);
        if (Math.abs(this.padAimX) + Math.abs(this.padAimZ) > 0.05) this.usingMouseAim = false;
        const b = i => gp.buttons[i] && gp.buttons[i].pressed;
        const eb = (i, action) => { if (b(i) && !padPrev[i]) edge.add(action); };
        eb(0, 'interact'); eb(0, 'advance');
        eb(1, 'dash'); eb(2, 'melee'); eb(3, 'cast');
        eb(4, 'spellPrev'); eb(5, 'spellNext');
        eb(9, 'inv'); eb(8, 'quest');
        if (b(7)) this.shootHeld = true;
        else if (padPrev[7]) this.shootHeld = false;   // soltou o gatilho
        padPrev = gp.buttons.map(x => x.pressed);
      }
    }
    const ml = Math.hypot(this.mx, this.mz);
    if (ml > 1) { this.mx /= ml; this.mz /= ml; }
  },

  setInteract(label) {
    const el = document.getElementById('t-interact');
    if (!el) return;
    if (label && this.touchActive) { el.textContent = label; el.classList.remove('hidden'); }
    else el.classList.add('hidden');
  },
};
