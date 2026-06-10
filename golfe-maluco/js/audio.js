// GOLFE MALUCO — áudio
const AudioSys = (() => {
  const sfxFiles = {
    hit: 'hit.ogg', bounce: 'bounce.ogg', bounce2: 'bounce2.ogg',
    click: 'click.ogg', confirm: 'confirm.ogg', coin: 'coin.ogg', oob: 'oob.ogg',
    jingleGood: 'jingle-good.ogg', jingleGreat: 'jingle-great.ogg', jingleRecord: 'jingle-record.ogg',
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
      a.preload = 'auto'; a.loop = true; a.volume = 0.4;
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
