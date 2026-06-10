// PROFUNDEZAS — áudio
const AudioSys = (() => {
  const sfxFiles = {
    swing: 'swing.ogg', hit1: 'hit1.ogg', hit2: 'hit2.ogg', hitmetal: 'hitmetal.ogg',
    dash: 'dash.ogg', step1: 'step1.ogg', step2: 'step2.ogg',
    chest: 'chest.ogg', door: 'door.ogg', trap: 'trap.ogg', whisper: 'whisper.ogg',
    hurt: 'hurt.ogg', die1: 'zdie1.ogg', die2: 'zdie2.ogg',
    coin: 'coin.ogg', confirm: 'confirm.ogg', click: 'click.ogg',
    boom: 'boom.ogg', upgrade: 'upgrade.ogg', slam: 'slam.ogg',
  };
  const musicFiles = { game: 'game.ogg', menu: 'menu.ogg', gameover: 'gameover.ogg' };

  const sfx = {}, music = {};
  let muted = false, currentMusic = null, unlocked = false;

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
      a.preload = 'auto'; a.loop = true; a.volume = 0.38;
      music[n] = a;
    }
  }

  function play(name, vol = 1, rate = 1) {
    if (muted || !unlocked || !sfx[name]) return;
    const a = sfx[name].find(x => x.paused || x.ended) || sfx[name][0];
    try { a.currentTime = 0; a.volume = vol; a.playbackRate = rate; a.play().catch(() => {}); } catch (e) {}
  }

  function playMusic(name) {
    if (currentMusic === name) return;
    stopMusic();
    currentMusic = name;
    if (!muted && unlocked && music[name]) { music[name].currentTime = 0; music[name].play().catch(() => {}); }
  }

  function stopMusic() {
    if (currentMusic && music[currentMusic]) music[currentMusic].pause();
    currentMusic = null;
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

  return { load, play, playMusic, stopMusic, unlock, toggleMute };
})();
