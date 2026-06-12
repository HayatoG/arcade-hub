// ============================================================
// INPUT — teclado, gamepad e toque unificados (side-scroller)
// Ações: jump (edge+held), pound (edge), left/right (held),
//        pause, mute, confirm, back
// ============================================================
const edge = new Set();
const keys = {};
let padIndex = -1, padPrev = [];
let tLeft = false, tRight = false, tJump = false;

export const INPUT = {
  moveX: 0,                 // -1..1
  jumpHeld: false,
  gamepadActive: false,
  touchActive: false,

  pressed(action) {
    if (edge.has(action)) { edge.delete(action); return true; }
    return false;
  },
  clear() { edge.clear(); },

  init() {
    // ---------- teclado ----------
    window.addEventListener('keydown', e => {
      AudioSys.unlock();
      const k = e.key.toLowerCase();
      keys[k] = true;
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      if (e.repeat) return;
      if (k === ' ' || k === 'w' || k === 'arrowup') edge.add('jump');
      if (k === 's' || k === 'arrowdown') edge.add('pound');
      if (k === 'a' || k === 'arrowleft') edge.add('left');
      if (k === 'd' || k === 'arrowright') edge.add('right');
      if (k === 'p' || k === 'escape') edge.add('pause');
      if (k === 'm') edge.add('mute');
      if (k === 'enter') edge.add('confirm');
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; tLeft = tRight = tJump = false; });

    window.addEventListener('pointerdown', () => AudioSys.unlock());

    // ---------- gamepad ----------
    window.addEventListener('gamepadconnected', e => {
      padIndex = e.gamepad.index;
      INPUT.gamepadActive = true;
      INPUT.onGamepad && INPUT.onGamepad(true, e.gamepad.id);
    });
    window.addEventListener('gamepaddisconnected', e => {
      if (e.gamepad.index === padIndex) { padIndex = -1; INPUT.gamepadActive = false; INPUT.onGamepad && INPUT.onGamepad(false); }
    });

    // ---------- toque ----------
    const hold = (id, down, up) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', e => { e.preventDefault(); AudioSys.unlock(); INPUT.touchActive = true; down(); }, { passive: false });
      el.addEventListener('touchend', e => { e.preventDefault(); up && up(); }, { passive: false });
      el.addEventListener('touchcancel', () => up && up(), { passive: true });
      // também aceita mouse (testes no desktop)
      el.addEventListener('mousedown', e => { e.preventDefault(); AudioSys.unlock(); down(); });
      el.addEventListener('mouseup', () => up && up());
      el.addEventListener('mouseleave', () => up && up());
    };
    hold('t-left', () => { tLeft = true; }, () => { tLeft = false; });
    hold('t-right', () => { tRight = true; }, () => { tRight = false; });
    hold('t-jump', () => { tJump = true; edge.add('jump'); }, () => { tJump = false; });
    hold('t-pound', () => edge.add('pound'));
    hold('t-pause', () => edge.add('pause'));
    window.addEventListener('touchstart', () => { INPUT.touchActive = true; }, { passive: true, once: true });
  },

  // uma vez por frame
  update() {
    this.moveX = 0;
    if (keys['a'] || keys['arrowleft']) this.moveX -= 1;
    if (keys['d'] || keys['arrowright']) this.moveX += 1;
    if (tLeft) this.moveX -= 1;
    if (tRight) this.moveX += 1;

    let held = keys[' '] || keys['w'] || keys['arrowup'] || tJump;

    if (padIndex >= 0) {
      const gp = navigator.getGamepads && navigator.getGamepads()[padIndex];
      if (gp) {
        const ax = gp.axes[0] || 0;
        if (Math.abs(ax) > 0.22) this.moveX = ax;
        const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
        if (b(14)) this.moveX = -1;            // dpad ←
        if (b(15)) this.moveX = 1;             // dpad →
        const eb = (i, action) => { if (b(i) && !padPrev[i]) edge.add(action); };
        eb(14, 'left'); eb(15, 'right');        // dpad (navegação de menus)
        eb(0, 'jump');                          // A
        eb(1, 'pound'); eb(2, 'pound');         // B / X
        eb(13, 'pound');                        // dpad ↓
        eb(6, 'pound'); eb(7, 'pound');         // gatilhos
        eb(9, 'pause');                         // start
        if (b(0)) held = true;
        if (gp.buttons.some((x, i) => x.pressed && !padPrev[i])) this.gamepadActive = true;
        padPrev = gp.buttons.map(x => x.pressed);
      }
    }
    this.jumpHeld = !!held;
    this.moveX = Math.max(-1, Math.min(1, this.moveX));
  },
};
