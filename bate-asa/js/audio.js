// BATE-ASA — áudio
const AudioSys = (() => {
  const sfxFiles = {
    flap1: 'flap1.ogg', flap2: 'flap2.ogg', flap3: 'flap3.ogg',
    coin1: 'coin1.ogg', coin2: 'coin2.ogg', coin3: 'coin3.ogg',
    point: 'point.ogg', raspao: 'raspao.ogg', loop: 'loop.ogg',
    box: 'box.ogg', shield: 'shield.ogg', rajada: 'rajada.ogg',
    dive: 'dive.ogg', warn: 'warn.ogg', metal: 'metal.ogg',
    wood: 'wood.ogg', crash: 'crash.ogg', hurt: 'hurt.ogg',
    wind: 'wind.ogg', gameover: 'gameover.ogg', click: 'click.ogg',
  };
  const musicFiles = { menu: 'menu.ogg', game: 'game.ogg', night: 'night.ogg' };

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
      a.preload = 'auto'; a.loop = true; a.volume = 0.32;
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
