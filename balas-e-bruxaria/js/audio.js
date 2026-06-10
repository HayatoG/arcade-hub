// BALAS & BRUXARIA — áudio (padrão AudioSys do hub, com crossfade de música)
const AudioSys = (() => {
  const sfxFiles = {
    swing: 'swing.ogg', hit1: 'hit1.ogg', hit2: 'hit2.ogg', hitmetal: 'hitmetal.ogg',
    dash: 'dash.ogg', step1: 'step1.ogg', step2: 'step2.ogg',
    gstep1: 'gstep1.ogg', gstep2: 'gstep2.ogg',
    chest: 'chest.ogg', door: 'door.ogg', dooropen: 'dooropen.ogg', creak: 'creak.ogg',
    trap: 'trap.ogg', whisper: 'whisper.ogg', ghost: 'ghost.ogg',
    hurt: 'hurt.ogg', die1: 'zdie1.ogg', die2: 'zdie2.ogg',
    coin: 'coin.ogg', confirm: 'confirm.ogg', click: 'click.ogg', error: 'error.ogg',
    boom: 'boom.ogg', upgrade: 'upgrade.ogg', slam: 'slam.ogg',
    shot: 'shot.ogg', thunder: 'thunder.ogg',
    buy: 'buy.ogg', sell: 'sell.ogg', equip: 'equip.ogg', latch: 'latch.ogg',
    bag: 'bag.ogg', book: 'book.ogg',
    levelup: 'levelup.ogg', jlevel: 'levelup-jingle.ogg', jquest: 'quest-jingle.ogg',
    qaccept: 'quest-accept.ogg',
  };
  const musicFiles = {
    titulo: 'titulo.ogg', vila: 'vila.ogg', campo: 'campo.ogg',
    dungeon: 'dungeon.ogg', boss: 'boss.ogg', gameover: 'gameover.ogg',
  };
  const MUSIC_VOL = 0.34;

  const sfx = {}, music = {};
  let muted = false, currentMusic = null, unlocked = false, fadeTimer = null;

  function load() {
    for (const [n, f] of Object.entries(sfxFiles)) {
      sfx[n] = [];
      for (let i = 0; i < 3; i++) {
        const a = new Audio('assets/sfx/' + f);
        a.preload = 'auto';
        sfx[n].push(a);
      }
    }
    for (const [n, f] of Object.entries(musicFiles)) {
      const a = new Audio('assets/music/' + f);
      a.preload = 'auto'; a.loop = true; a.volume = MUSIC_VOL;
      music[n] = a;
    }
  }

  function play(name, vol = 1, rate = 1) {
    if (muted || !unlocked || !sfx[name]) return;
    const a = sfx[name].find(x => x.paused || x.ended) || sfx[name][0];
    try { a.currentTime = 0; a.volume = vol; a.playbackRate = rate; a.play().catch(() => {}); } catch (e) {}
  }

  // crossfade suave entre faixas (≈0.9 s)
  function playMusic(name) {
    if (currentMusic === name) return;
    const prev = currentMusic ? music[currentMusic] : null;
    currentMusic = name;
    const next = music[name];
    if (!next) return;
    clearInterval(fadeTimer);
    if (!muted && unlocked) {
      next.currentTime = 0;
      next.volume = 0;
      next.play().catch(() => {});
      let t = 0;
      fadeTimer = setInterval(() => {
        t += 0.06;
        const k = Math.min(1, t / 0.9);
        next.volume = MUSIC_VOL * k;
        if (prev) prev.volume = MUSIC_VOL * (1 - k);
        if (k >= 1) {
          clearInterval(fadeTimer);
          if (prev) { prev.pause(); prev.volume = MUSIC_VOL; }
        }
      }, 60);
    } else if (prev) prev.pause();
  }

  function stopMusic() {
    clearInterval(fadeTimer);
    if (currentMusic && music[currentMusic]) music[currentMusic].pause();
    currentMusic = null;
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (currentMusic && !muted && music[currentMusic]) {
      music[currentMusic].volume = MUSIC_VOL;
      music[currentMusic].play().catch(() => {});
    }
  }

  function toggleMute() {
    muted = !muted;
    if (muted) Object.values(music).forEach(m => m.pause());
    else if (currentMusic && music[currentMusic]) {
      music[currentMusic].volume = MUSIC_VOL;
      music[currentMusic].play().catch(() => {});
    }
    return muted;
  }

  // passarinho sintetizado (não há SFX de pássaro nos packs)
  let actx = null;
  function chirp() {
    if (muted || !unlocked) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime;
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const o = actx.createOscillator(), g = actx.createGain();
        const t = t0 + i * (0.09 + Math.random() * 0.06);
        const f = 2400 + Math.random() * 1400;
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * (0.7 + Math.random() * 0.5), t + 0.07);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.045, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        o.connect(g).connect(actx.destination);
        o.start(t); o.stop(t + 0.1);
      }
    } catch (e) {}
  }

  return { load, play, playMusic, stopMusic, unlock, toggleMute, chirp, get muted() { return muted; } };
})();
