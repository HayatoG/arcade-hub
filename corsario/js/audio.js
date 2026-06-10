// CORSÁRIO — áudio
const AudioSys = (() => {
  const sfxFiles = {
    cannon: 'cannon.ogg', boom: 'boom.ogg', splash: 'splash.ogg',
    coin: 'coin.ogg', chest: 'chest.ogg', repair: 'repair.ogg',
    hurt: 'hurt.ogg', confirm: 'confirm.ogg', click: 'click.ogg',
    upgrade: 'upgrade.ogg', thunder: 'thunder.ogg', ghost: 'ghost.ogg',
    creak: 'creak.ogg', levelup: 'levelup.ogg',
  };
  const musicFiles = { game: 'game.ogg', menu: 'menu.ogg', gameover: 'gameover.ogg' };
  const BASE_VOL = 0.42, DUCK_VOL = 0.14;

  const sfx = {}, music = {};
  let muted = false, currentMusic = null, unlocked = false, ducked = false;

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
      a.preload = 'auto'; a.loop = true; a.volume = BASE_VOL;
      music[n] = a;
    }
  }

  function play(name, vol = 1) {
    if (muted || !unlocked || !sfx[name]) return;
    const a = sfx[name].find(x => x.paused || x.ended) || sfx[name][0];
    try { a.currentTime = 0; a.volume = vol; a.play().catch(() => {}); } catch (e) {}
  }

  function playMusic(name) {
    if (currentMusic === name) return;
    stopMusic();
    currentMusic = name;
    if (music[name]) music[name].volume = ducked ? DUCK_VOL : BASE_VOL;
    if (!muted && unlocked && music[name]) { music[name].currentTime = 0; music[name].play().catch(() => {}); }
  }

  function stopMusic() {
    if (currentMusic && music[currentMusic]) music[currentMusic].pause();
    currentMusic = null;
  }

  // abafa a música (evento do navio fantasma)
  function duck(on) {
    ducked = on;
    if (currentMusic && music[currentMusic]) music[currentMusic].volume = on ? DUCK_VOL : BASE_VOL;
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (currentMusic && !muted && music[currentMusic]) music[currentMusic].play().catch(() => {});
  }

  function toggleMute() {
    muted = !muted;
    if (muted) Object.values(music).forEach(m => m.pause());
    else if (currentMusic && music[currentMusic]) music[currentMusic].play().catch(() => {});
    return muted;
  }

  return { load, play, playMusic, stopMusic, duck, unlock, toggleMute };
})();
