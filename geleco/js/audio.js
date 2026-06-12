// GELECO — áudio (Kenney CC0)
const AudioSys = (() => {
  const sfxFiles = {
    jump: 'jump.ogg', djump: 'djump.ogg', spring: 'spring.ogg',
    stomp: 'stomp.ogg', coin1: 'coin1.ogg', coin2: 'coin2.ogg', coin3: 'coin3.ogg',
    star: 'star.ogg', check: 'check.ogg', heart: 'heart.ogg', unlock: 'unlock.ogg',
    crate: 'crate.ogg', cratestrong: 'cratestrong.ogg',
    pound: 'pound.ogg', land: 'land.ogg', bossland: 'bossland.ogg',
    hurt: 'hurt.ogg', die: 'die.ogg', gameover: 'gameover.ogg',
    roar: 'roar.ogg', bosshurt: 'bosshurt.ogg', rumble: 'rumble.ogg', shock: 'shock.ogg',
    click: 'click.ogg', confirm: 'confirm.ogg',
    win: 'win.ogg', bosswin: 'bosswin.ogg',
  };
  const musicFiles = { map: 'map.ogg', level1: 'level1.ogg', level2: 'level2.ogg', boss: 'boss.ogg' };

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
      a.preload = 'auto'; a.loop = true; a.volume = 0.3;
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

  function duckMusic(f) {
    if (currentMusic && music[currentMusic]) music[currentMusic].volume = 0.3 * f;
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

  return { load, play, playMusic, stopMusic, duckMusic, unlock, toggleMute };
})();
