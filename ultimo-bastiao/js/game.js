// ============================================================
// ÚLTIMO BASTIÃO — survivors + tower defense
// Phaser 3 + assets Kenney (CC0)
//
// Você é o último guardião do bastião. Zumbis atacam em ondas;
// moedas coletadas constroem e evoluem a torre automaticamente.
// ============================================================
'use strict';

// ------------------------------------------------------------
// Constantes de design
// ------------------------------------------------------------
const WORLD_W = 1600, WORLD_H = 1200;
const CX = WORLD_W / 2, CY = WORLD_H / 2;

const TOWER_LEVELS = [
  { cost: 0,   name: 'RUÍNA',          rate: 0,    dmg: 0,  range: 0,   baseHp: 500 },
  { cost: 60,  name: 'SENTINELA',      rate: 900,  dmg: 16, range: 310, baseHp: 650 },
  { cost: 180, name: 'CANHÃO DUPLO',   rate: 550,  dmg: 22, range: 360, baseHp: 800 },
  { cost: 360, name: 'FORTALEZA',      rate: 500,  dmg: 24, range: 380, baseHp: 1000 },
  { cost: 600, name: 'BASTIÃO SUPREMO',rate: 1100, dmg: 60, range: 460, baseHp: 1250 },
];

const WEAPON_LEVELS = [
  { kills: 0,   name: 'PISTOLA',        rate: 380, dmg: 12, shots: 1, pose: 'p_gun' },
  { kills: 35,  name: 'PISTOLA TÁTICA', rate: 280, dmg: 14, shots: 1, pose: 'p_silencer' },
  { kills: 90,  name: 'METRALHADORA',   rate: 195, dmg: 17, shots: 1, pose: 'p_machine' },
  { kills: 180, name: 'METRALHA DUPLA', rate: 165, dmg: 19, shots: 2, pose: 'p_machine' },
  { kills: 320, name: 'TEMPESTADE',     rate: 115, dmg: 22, shots: 3, pose: 'p_machine' },
];

const LAST_WAVE = 12;

// ------------------------------------------------------------
// Cena de carregamento
// ------------------------------------------------------------
class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload() {
    const { width: w, height: h } = this.scale;
    this.add.text(w / 2, h / 2, 'CARREGANDO...', { fontFamily: 'Kenney Mono, monospace', fontSize: 22, color: '#9cb89c' }).setOrigin(0.5);

    const I = (k, f) => this.load.image(k, 'assets/img/' + f);
    // jogador e zumbis
    I('p_gun', 'survivor1_gun.png'); I('p_silencer', 'survivor1_silencer.png');
    I('p_machine', 'survivor1_machine.png'); I('p_stand', 'survivor1_stand.png');
    I('z1', 'zombie1_hold.png'); I('z1s', 'zombie1_stand.png');
    I('z2', 'zombie2_hold.png'); I('z2s', 'zombie2_stand.png');
    // chão e cenário
    for (const t of ['01', '02', '03', '04', '05', '06']) I('tile' + t, 'tile_' + t + '.png');
    I('crate', 'tile_122.png'); I('crate2', 'tile_130.png');
    I('pond', 'tile_131.png'); I('plant', 'tile_134.png');
    I('bush1', 'tile_181.png'); I('bush2', 'tile_182.png'); I('bush3', 'tile_183.png');
    I('sprout1', 'tile_210.png'); I('sprout2', 'tile_235.png');
    // torre
    I('tbase1', 'towerDefense_tile180.png'); I('tbase2', 'towerDefense_tile181.png');
    I('tbase3', 'towerDefense_tile182.png'); I('tbase4', 'towerDefense_tile183.png');
    I('twall', 'towerDefense_tile184.png');
    I('tplat1', 'towerDefense_tile203.png'); I('tplat2', 'towerDefense_tile204.png');
    I('tgun1', 'towerDefense_tile249.png'); I('tgun2', 'towerDefense_tile250.png');
    I('tgun3', 'towerDefense_tile251.png'); I('tgun4', 'towerDefense_tile252.png');
    I('bullet1', 'towerDefense_tile272.png'); I('bullet2', 'towerDefense_tile273.png');
    I('flame1', 'towerDefense_tile295.png'); I('flame2', 'towerDefense_tile296.png');
    // itens e efeitos
    I('coin', 'coinGold.png');
    I('splat1', 'splat00.png'); I('splat2', 'splat04.png'); I('splat3', 'splat07.png');
    // áudio
    const A = (k, f) => this.load.audio(k, 'assets/sfx/' + f);
    A('shot', 'shot.ogg'); A('tower', 'tower.ogg'); A('zdie1', 'zdie1.ogg'); A('zdie2', 'zdie2.ogg');
    A('coin', 'coin.ogg'); A('hurt', 'hurt.ogg'); A('bite', 'bite.ogg'); A('boom', 'boom.ogg');
    A('upgrade', 'upgrade.ogg'); A('click', 'click.ogg'); A('confirm', 'confirm.ogg');
    this.load.audio('m_game', 'assets/music/game.ogg');
    this.load.audio('m_menu', 'assets/music/menu.ogg');
    this.load.audio('m_over', 'assets/music/gameover.ogg');
  }

  create() {
    // garante que as fontes Kenney estejam prontas antes de desenhar texto
    const go = () => this.scene.start('menu');
    if (document.fonts && document.fonts.load) {
      Promise.all([
        document.fonts.load('20px "Kenney Future"'),
        document.fonts.load('20px "Kenney Mono"'),
      ]).then(go).catch(go);
    } else go();
  }
}

// ------------------------------------------------------------
// Menu
// ------------------------------------------------------------
class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  create() {
    const { width: w, height: h } = this.scale;
    this.cameras.main.setBackgroundColor('#1a2416');

    // chão decorativo
    this.add.tileSprite(w / 2, h / 2, w, h, 'tile01').setAlpha(0.25);

    const music = this.sound.get('m_menu') || this.sound.add('m_menu', { loop: true, volume: 0.4 });
    if (!music.isPlaying) { try { music.play(); } catch (e) {} }

    this.add.text(w / 2, h * 0.2, 'ÚLTIMO', { fontFamily: 'Kenney Future, sans-serif', fontSize: Math.min(84, w / 9), color: '#e8ffe0' })
      .setOrigin(0.5).setShadow(0, 0, '#3dba54', 24, true, true);
    this.add.text(w / 2, h * 0.2 + Math.min(84, w / 9), 'BASTIÃO', { fontFamily: 'Kenney Future, sans-serif', fontSize: Math.min(84, w / 9), color: '#ffd23e' })
      .setOrigin(0.5).setShadow(0, 0, '#a05a10', 24, true, true);

    const story = 'O mundo caiu. Resta uma ruína no meio do campo — e você.\n' +
      'Zumbis virão em 12 ondas. Cada moeda coletada reconstrói a torre\n' +
      'automaticamente: dela nascerão canhões, muralhas e mísseis.\n\nDefenda o último bastião da humanidade.';
    this.add.text(w / 2, h * 0.47, story, { fontFamily: 'Kenney Mono, monospace', fontSize: Math.min(17, w / 38), color: '#bcd8b4', align: 'center', lineSpacing: 8 }).setOrigin(0.5);

    // vitrine: jogador e zumbis
    this.add.image(w / 2, h * 0.63, 'p_machine').setScale(1.2).setAngle(-90);
    this.add.image(w / 2 - 110, h * 0.63, 'z1').setScale(1.05).setAngle(0).setTint(0xbbffbb);
    this.add.image(w / 2 + 110, h * 0.63, 'z2').setScale(1.05).setAngle(180).setTint(0xddffcc);

    const start = this.add.text(w / 2, h * 0.78, '▶ COMEÇAR (ENTER)', { fontFamily: 'Kenney Future, sans-serif', fontSize: Math.min(30, w / 18), color: '#ffffff', backgroundColor: '#7a1f1f', padding: { x: 26, y: 12 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: start, scale: { from: 1, to: 1.06 }, duration: 500, yoyo: true, repeat: -1 });

    this.add.text(w / 2, h * 0.88, 'WASD/setas ou arrastar o dedo · tiro é AUTOMÁTICO · M som',
      { fontFamily: 'Kenney Mono, monospace', fontSize: 13, color: '#7c947c' }).setOrigin(0.5);
    this.add.text(w / 2, h * 0.93, 'recorde de ondas: ' + loadRecord() + ' · arte/áudio: kenney.nl (CC0)',
      { fontFamily: 'Kenney Mono, monospace', fontSize: 12, color: '#5c745c' }).setOrigin(0.5);

    const go = () => { this.sound.play('confirm', { volume: 0.7 }); music.stop(); this.scene.start('game'); };
    start.on('pointerdown', go);
    this.input.keyboard.on('keydown-ENTER', go);
    this.input.keyboard.on('keydown-SPACE', go);
  }
}

// ------------------------------------------------------------
// Jogo
// ------------------------------------------------------------
class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create() {
    const S = this;
    S.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    S.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

    // estado da partida
    S.coins = 0; S.totalCoins = 0; S.kills = 0;
    S.wave = 0; S.waveState = 'break'; S.waveTimer = 3500; S.spawnTimer = 0;
    S.towerLevel = 0; S.weaponLevel = 0;
    S.playerHp = 100; S.playerMaxHp = 100;
    S.baseHp = TOWER_LEVELS[0].baseHp; S.baseMaxHp = TOWER_LEVELS[0].baseHp;
    S.gameOver = false; S.fireTimer = 0; S.towerTimer = 0; S.hurtCd = 0;
    S.bossAlive = false;

    S.buildGround();

    // grupos
    S.bullets = S.physics.add.group({ maxSize: 80 });
    S.towerBullets = S.physics.add.group({ maxSize: 40 });
    S.zombies = S.physics.add.group();
    S.coinsGroup = S.physics.add.group();
    S.splats = [];

    S.buildBase();

    // jogador
    S.player = S.physics.add.sprite(CX, CY + 150, 'p_gun').setScale(0.85);
    S.player.setCircle(16, 4, 4).setCollideWorldBounds(true).setDepth(10);

    // colisões
    S.physics.add.overlap(S.bullets, S.zombies, (b, z) => S.hitZombie(b, z, false));
    S.physics.add.overlap(S.towerBullets, S.zombies, (b, z) => S.hitZombie(b, z, true));
    S.physics.add.overlap(S.player, S.coinsGroup, (p, c) => S.collectCoin(c));
    S.physics.add.overlap(S.player, S.zombies, (p, z) => S.zombieAttack(z, 'player'));
    S.physics.add.collider(S.zombies, S.obstacles);
    S.physics.add.collider(S.player, S.obstacles);
    S.physics.add.collider(S.zombies, S.zombies);

    // câmera
    S.cameras.main.startFollow(S.player, true, 0.09, 0.09);

    // controles
    S.keys = S.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,M,P');
    S.joy = null;
    S.input.on('pointerdown', p => { S.joy = { ox: p.x, oy: p.y, x: p.x, y: p.y }; });
    S.input.on('pointermove', p => { if (S.joy) { S.joy.x = p.x; S.joy.y = p.y; } });
    S.input.on('pointerup', () => { S.joy = null; });
    S.input.keyboard.on('keydown-M', () => { S.sound.mute = !S.sound.mute; });
    S.input.keyboard.on('keydown-P', () => {
      if (S.gameOver) return;
      if (S.scene.isPaused()) return;
      S.physics.world.isPaused ? S.resumeGame() : S.pauseGame();
    });

    S.buildHUD();

    S.music = S.sound.add('m_game', { loop: true, volume: 0.35 });
    try { S.music.play(); } catch (e) {}

    // handle de testes
    window.__UB = {
      get wave() { return S.wave; }, get coins() { return S.totalCoins; },
      get kills() { return S.kills; }, get towerLevel() { return S.towerLevel; },
      get zombies() { return S.zombies.countActive(true); },
      get playerHp() { return S.playerHp; }, get baseHp() { return S.baseHp; },
      get over() { return S.gameOver; },
      addCoins: n => { S.totalCoins += n; S.coins += n; S.checkTowerUpgrade(); },
    };
  }

  // ---------------- mundo ----------------
  buildGround() {
    const S = this;
    S.add.tileSprite(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 'tile01').setDepth(0);
    const rng = new Phaser.Math.RandomDataGenerator(['bastiao']);
    // manchas suaves de terra
    for (let i = 0; i < 36; i++) {
      const k = rng.pick(['tile05', 'tile06']);
      S.add.image(rng.between(32, WORLD_W - 32), rng.between(32, WORLD_H - 32), k)
        .setAlpha(0.28).setDepth(0.1).setScale(rng.realInRange(0.8, 1.6));
    }
    // poças d'água decorativas
    for (let i = 0; i < 4; i++) {
      const x = rng.between(120, WORLD_W - 120), y = rng.between(120, WORLD_H - 120);
      if (Phaser.Math.Distance.Between(x, y, CX, CY) < 300) continue;
      S.add.image(x, y, 'pond').setDepth(0.15).setScale(rng.realInRange(1, 1.5));
    }
    // vegetação decorativa
    for (let i = 0; i < 52; i++) {
      const k = rng.pick(['bush1', 'bush2', 'bush3', 'plant', 'sprout1', 'sprout2']);
      const x = rng.between(40, WORLD_W - 40), y = rng.between(40, WORLD_H - 40);
      if (Phaser.Math.Distance.Between(x, y, CX, CY) < 220) continue;
      S.add.image(x, y, k).setDepth(0.2).setScale(rng.realInRange(0.6, 1.0));
    }
    // obstáculos físicos (caixotes)
    S.obstacles = S.physics.add.staticGroup();
    for (let i = 0; i < 14; i++) {
      const k = rng.pick(['crate', 'crate2']);
      const x = rng.between(120, WORLD_W - 120), y = rng.between(120, WORLD_H - 120);
      if (Phaser.Math.Distance.Between(x, y, CX, CY) < 320) continue;
      S.obstacles.create(x, y, k).setScale(0.9).refreshBody().setDepth(1);
    }
  }

  buildBase() {
    const S = this;
    if (S.baseParts) S.baseParts.forEach(p => p.destroy());
    S.baseParts = [];
    const L = S.towerLevel;
    const add = (x, y, k, scale = 1, angle = 0) => {
      const img = S.add.image(CX + x, CY + y, k).setScale(scale).setAngle(angle).setDepth(5);
      S.baseParts.push(img);
      return img;
    };

    // plataforma central cresce com o nível
    add(0, 0, ['tbase1', 'tbase2', 'tbase3', 'tbase4', 'tbase4'][L], 1.15 + L * 0.12);
    if (L >= 1) S.towerGun = add(0, 0, ['tgun1', 'tgun1', 'tgun2', 'tgun2', 'tgun4'][L], 0.95 + L * 0.1);
    else S.towerGun = null;

    // muralhas a partir do nível 3
    if (L >= 2) {
      const r = 95 + L * 8;
      const n = L >= 3 ? 8 : 4;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.PI / n;
        add(Math.cos(a) * r, Math.sin(a) * r, 'twall', 0.55, Phaser.Math.RadToDeg(a) + 90);
      }
    }
    // torretas laterais no nível 4+
    S.sideTurrets = [];
    if (L >= 3) {
      for (const [dx, dy] of [[-130, -130], [130, 130], [130, -130], [-130, 130]].slice(0, L >= 4 ? 4 : 2)) {
        add(dx, dy, 'tplat1', 0.6);
        const gun = add(dx, dy, 'tgun1', 0.55);
        S.sideTurrets.push(gun);
      }
    }

    // corpo físico da base (área que os zumbis atacam)
    if (!S.baseZone) {
      S.baseZone = S.add.zone(CX, CY, 170, 170);
      S.physics.add.existing(S.baseZone, true);
      S.physics.add.overlap(S.baseZone, S.zombies, (b, z) => S.zombieAttack(z, 'base'));
    }
  }

  // ---------------- HUD ----------------
  buildHUD() {
    const S = this;
    const T = (x, y, txt, size, color) => S.add.text(x, y, txt,
      { fontFamily: 'Kenney Mono, monospace', fontSize: size, color }).setScrollFactor(0).setDepth(100);

    S.ui = {};
    S.ui.wave = S.add.text(S.scale.width / 2, 16, '', { fontFamily: 'Kenney Future, sans-serif', fontSize: 24, color: '#ffd23e' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(100).setShadow(0, 2, '#000', 4);
    S.ui.coins = T(16, 14, '', 20, '#ffd23e');
    S.ui.kills = T(16, 40, '', 14, '#bcd8b4');
    S.ui.weapon = T(16, 62, '', 14, '#9ce0ff');
    S.ui.towerName = T(16, S.scale.height - 78, '', 15, '#e8c878');
    S.ui.towerBar = S.add.graphics().setScrollFactor(0).setDepth(100);
    S.ui.hpBars = S.add.graphics().setScrollFactor(0).setDepth(100);
    S.ui.announce = S.add.text(S.scale.width / 2, S.scale.height * 0.32, '', { fontFamily: 'Kenney Future, sans-serif', fontSize: 38, color: '#ffffff', align: 'center' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(101).setShadow(0, 0, '#7a1f1f', 18, true, true).setAlpha(0);
  }

  announce(msg, color = '#ffffff') {
    const S = this;
    S.ui.announce.setText(msg).setColor(color).setAlpha(1).setScale(0.7);
    S.tweens.add({ targets: S.ui.announce, scale: 1, duration: 220, ease: 'Back.Out' });
    S.tweens.add({ targets: S.ui.announce, alpha: 0, delay: 1600, duration: 500 });
  }

  updateHUD() {
    const S = this;
    S.ui.coins.setText('⬤ ' + S.coins + ' moedas');
    S.ui.kills.setText('abates: ' + S.kills);
    S.ui.weapon.setText('arma: ' + WEAPON_LEVELS[S.weaponLevel].name);
    S.ui.wave.setText(S.waveState === 'break' && S.wave < LAST_WAVE ? 'PREPARE-SE...' : 'ONDA ' + S.wave + '/' + LAST_WAVE);

    // barra de progresso da torre
    const g = S.ui.towerBar;
    g.clear();
    const next = TOWER_LEVELS[S.towerLevel + 1];
    const w = 230, x = 16, y = S.scale.height - 56;
    if (next) {
      const fr = Phaser.Math.Clamp(S.totalCoins / next.cost, 0, 1);
      g.fillStyle(0x000000, 0.5).fillRect(x, y, w, 14);
      g.fillStyle(0xe8c838, 1).fillRect(x, y, w * fr, 14);
      g.lineStyle(1, 0xffffff, 0.4).strokeRect(x, y, w, 14);
      S.ui.towerName.setText('TORRE: ' + TOWER_LEVELS[S.towerLevel].name + '  →  ' + S.totalCoins + '/' + next.cost);
    } else {
      S.ui.towerName.setText('TORRE: ' + TOWER_LEVELS[S.towerLevel].name + ' (MÁX)');
    }

    // barras de vida (jogador e base)
    const h = S.ui.hpBars;
    h.clear();
    const bw = 230, bx = S.scale.width - bw - 16;
    h.fillStyle(0x000000, 0.5).fillRect(bx, 16, bw, 14);
    h.fillStyle(0x3dba54, 1).fillRect(bx, 16, bw * Phaser.Math.Clamp(S.playerHp / S.playerMaxHp, 0, 1), 14);
    h.lineStyle(1, 0xffffff, 0.4).strokeRect(bx, 16, bw, 14);
    h.fillStyle(0x000000, 0.5).fillRect(bx, 42, bw, 14);
    h.fillStyle(0xe07840, 1).fillRect(bx, 42, bw * Phaser.Math.Clamp(S.baseHp / S.baseMaxHp, 0, 1), 14);
    h.lineStyle(1, 0xffffff, 0.4).strokeRect(bx, 42, bw, 14);
    if (!S.ui.hpLabels) {
      S.ui.hpLabels = true;
      this.add.text(bx - 8, 16, 'VOCÊ', { fontFamily: 'Kenney Mono, monospace', fontSize: 12, color: '#9cd89c' }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
      this.add.text(bx - 8, 42, 'BASE', { fontFamily: 'Kenney Mono, monospace', fontSize: 12, color: '#e8b894' }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    }
  }

  // ---------------- ondas ----------------
  startWave() {
    const S = this;
    S.wave++;
    S.waveState = 'active';
    S.waveTimer = 26000 + S.wave * 1500;
    S.spawnTimer = 400;
    S.announce('ONDA ' + S.wave, S.wave === LAST_WAVE ? '#ff6060' : '#ffffff');
    S.sound.play('confirm', { volume: 0.6 });
    if (S.wave === 6 || S.wave === LAST_WAVE) {
      S.time.delayedCall(2500, () => S.spawnZombie('boss'));
    }
  }

  spawnZombie(forceType) {
    const S = this;
    // ponto na borda do mundo
    const side = Phaser.Math.Between(0, 3);
    const x = side === 0 ? -30 : side === 1 ? WORLD_W + 30 : Phaser.Math.Between(0, WORLD_W);
    const y = side === 2 ? -30 : side === 3 ? WORLD_H + 30 : Phaser.Math.Between(0, WORLD_H);

    let type = forceType;
    if (!type) {
      const r = Math.random();
      if (S.wave >= 5 && r < 0.1 + S.wave * 0.012) type = 'brute';
      else if (S.wave >= 3 && r < 0.42) type = 'runner';
      else type = 'walker';
    }

    const defs = {
      walker: { key: 'z1', hp: 26 + S.wave * 5, spd: 52 + S.wave * 2.2, dmg: 9, coins: [1, 2], scale: 0.85, tint: 0xffffff, score: 1 },
      runner: { key: 'z2', hp: 15 + S.wave * 3.5, spd: 100 + S.wave * 2.5, dmg: 7, coins: [1, 2], scale: 0.75, tint: 0xddffcc, score: 1 },
      brute:  { key: 'z1s', hp: 140 + S.wave * 22, spd: 38, dmg: 24, coins: [6, 9], scale: 1.45, tint: 0x88c888, score: 3 },
      boss:   { key: 'z1s', hp: S.wave >= LAST_WAVE ? 2600 : 1100, spd: 30, dmg: 45, coins: [28, 36], scale: 2.4, tint: 0x60a860, score: 10 },
    };
    const d = defs[type];
    const z = S.zombies.create(x, y, d.key);
    z.baseTint = d.tint;
    z.setScale(d.scale).setTint(d.tint).setDepth(8);
    z.setCircle(16, 4, 4);
    z.hp = d.hp; z.maxHp = d.hp; z.dmg = d.dmg; z.spd = d.spd;
    z.coinDrop = Phaser.Math.Between(d.coins[0], d.coins[1]);
    z.isBoss = type === 'boss'; z.zScore = d.score;
    z.attackCd = 0; z.retarget = 0;
    if (z.isBoss) S.bossAlive = true;
    return z;
  }

  // ---------------- combate ----------------
  nearestZombie(x, y, range) {
    let best = null, bd = range * range;
    this.zombies.getChildren().forEach(z => {
      if (!z || !z.active) return;
      const d = (z.x - x) ** 2 + (z.y - y) ** 2;
      if (d < bd) { bd = d; best = z; }
    });
    return best;
  }

  fireBullet(fromX, fromY, target, dmg, isTower, speed = 540) {
    const S = this;
    const group = isTower ? S.towerBullets : S.bullets;
    const b = group.get(fromX, fromY, isTower ? 'bullet2' : 'bullet1');
    if (!b) return;
    b.setActive(true).setVisible(true).setScale(0.8).setDepth(9);
    b.body.enable = true;
    b.dmg = dmg;
    const ang = Phaser.Math.Angle.Between(fromX, fromY, target.x, target.y);
    S.physics.velocityFromRotation(ang, speed, b.body.velocity);
    b.setRotation(ang);
    S.time.delayedCall(1300, () => S.killBullet(b));
  }

  killBullet(b) {
    if (!b.active) return;
    b.setActive(false).setVisible(false);
    b.body.enable = false;
  }

  hitZombie(b, z, isTower) {
    const S = this;
    if (!b.active || !z.active) return;
    const dmg = b.dmg || 10;
    S.killBullet(b);
    z.hp -= dmg;
    z.setTint(0xff7070);
    S.time.delayedCall(70, () => { if (z.active) z.setTint(z.baseTint); });
    if (z.hp <= 0) S.killZombie(z);
  }

  killZombie(z) {
    const S = this;
    if (!z.active) return;
    // sangue
    const splat = S.add.image(z.x, z.y, 'splat' + Phaser.Math.Between(1, 3))
      .setTint(0x7a1212).setAlpha(0.75).setScale(z.isBoss ? 0.6 : 0.28)
      .setAngle(Phaser.Math.Between(0, 360)).setDepth(0.5);
    S.splats.push(splat);
    if (S.splats.length > 70) S.splats.shift().destroy();
    S.tweens.add({ targets: splat, alpha: 0, delay: 7000, duration: 2500, onComplete: () => splat.destroy() });

    // moedas
    for (let i = 0; i < z.coinDrop; i++) {
      const c = S.coinsGroup.create(z.x + Phaser.Math.Between(-22, 22), z.y + Phaser.Math.Between(-22, 22), 'coin');
      c.setScale(0.45).setDepth(3).setBounce(0.4);
      S.tweens.add({ targets: c, scale: 0.52, duration: 360, yoyo: true, repeat: -1 });
      S.time.delayedCall(14000, () => { if (c.active) c.destroy(); });
    }

    S.kills += 1;
    if (z.isBoss) {
      S.bossAlive = false;
      S.cameras.main.shake(380, 0.012);
      S.announce('GIGANTE ABATIDO!', '#8aff9c');
      S.sound.play('boom', { volume: 0.8 });
    }
    S.sound.play(Math.random() < 0.5 ? 'zdie1' : 'zdie2', { volume: 0.4 });
    z.destroy();
    S.checkWeaponUpgrade();
  }

  zombieAttack(z, targetKind) {
    const S = this;
    if (!z.active || z.attackCd > 0 || S.gameOver) return;
    z.attackCd = 800;
    if (targetKind === 'player') {
      if (S.hurtCd > 0) return;
      S.hurtCd = 450;
      S.playerHp -= z.dmg;
      S.sound.play('hurt', { volume: 0.5 });
      S.cameras.main.shake(120, 0.006);
      S.player.setTint(0xff6060);
      S.time.delayedCall(90, () => S.player.clearTint());
      if (S.playerHp <= 0) S.endGame(false, 'Você foi devorado pela horda.');
    } else {
      S.baseHp -= z.dmg;
      S.sound.play('bite', { volume: 0.4 });
      if (S.baseHp <= 0) S.endGame(false, 'O bastião foi destruído.');
    }
  }

  // ---------------- economia ----------------
  collectCoin(c) {
    if (!c.active) return;
    c.destroy();
    this.coins++; this.totalCoins++;
    this.sound.play('coin', { volume: 0.35 });
    this.checkTowerUpgrade();
  }

  checkTowerUpgrade() {
    const S = this;
    let upgraded = null;
    // pode subir mais de um nível de uma vez se as moedas bastarem
    while (TOWER_LEVELS[S.towerLevel + 1] && S.totalCoins >= TOWER_LEVELS[S.towerLevel + 1].cost) {
      S.towerLevel++;
      upgraded = TOWER_LEVELS[S.towerLevel];
      S.baseMaxHp = upgraded.baseHp;
      S.baseHp = Math.min(S.baseMaxHp, S.baseHp + Math.round(upgraded.baseHp * 0.35));
    }
    if (!upgraded) return;
    S.buildBase();
    S.sound.play('upgrade', { volume: 0.9 });
    S.cameras.main.flash(260, 255, 220, 120);
    S.announce('TORRE EVOLUIU!\n' + upgraded.name, '#ffd23e');
  }

  checkWeaponUpgrade() {
    const S = this;
    const next = WEAPON_LEVELS[S.weaponLevel + 1];
    if (!next || S.kills < next.kills) return;
    S.weaponLevel++;
    S.player.setTexture(next.pose);
    S.sound.play('upgrade', { volume: 0.8 });
    S.announce('ARMA NOVA!\n' + next.name, '#9ce0ff');
  }

  // ---------------- fim ----------------
  endGame(victory, reason) {
    const S = this;
    if (S.gameOver) return;
    S.gameOver = true;
    S.music.stop();
    S.physics.pause();
    saveRecord(S.wave - (victory ? 0 : 1));
    S.scene.launch('end', { victory, reason, wave: S.wave, kills: S.kills, coins: S.totalCoins, towerLevel: S.towerLevel });
  }

  pauseGame() {
    this.physics.world.isPaused = true;
    this.announce('PAUSADO', '#bcd8b4');
  }
  resumeGame() { this.physics.world.isPaused = false; }

  // ---------------- loop ----------------
  update(time, dt) {
    const S = this;
    if (S.gameOver || S.physics.world.isPaused) return;

    S.hurtCd = Math.max(0, S.hurtCd - dt);

    // --- movimento do jogador ---
    let vx = 0, vy = 0;
    const K = S.keys;
    if (K.A.isDown || K.LEFT.isDown) vx -= 1;
    if (K.D.isDown || K.RIGHT.isDown) vx += 1;
    if (K.W.isDown || K.UP.isDown) vy -= 1;
    if (K.S.isDown || K.DOWN.isDown) vy += 1;
    if (S.joy) {
      const dx = S.joy.x - S.joy.ox, dy = S.joy.y - S.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > 12) { vx = dx / d; vy = dy / d; }
    }
    const len = Math.hypot(vx, vy) || 1;
    S.player.setVelocity((vx / len) * 230, (vy / len) * 230);

    // --- tiro automático do jogador ---
    S.fireTimer -= dt;
    const wd = WEAPON_LEVELS[S.weaponLevel];
    const target = S.nearestZombie(S.player.x, S.player.y, 420);
    if (target) {
      S.player.setRotation(Phaser.Math.Angle.Between(S.player.x, S.player.y, target.x, target.y));
      if (S.fireTimer <= 0) {
        S.fireTimer = wd.rate;
        for (let i = 0; i < wd.shots; i++) {
          const off = (i - (wd.shots - 1) / 2) * 26;
          S.fireBullet(S.player.x, S.player.y, { x: target.x + off, y: target.y + off }, wd.dmg, false);
        }
        S.sound.play('shot', { volume: 0.22 });
      }
    } else if (vx || vy) {
      S.player.setRotation(Math.atan2(vy, vx));
    }

    // --- torre automática ---
    const td = TOWER_LEVELS[S.towerLevel];
    if (td.rate > 0) {
      S.towerTimer -= dt;
      if (S.towerTimer <= 0) {
        const t = S.nearestZombie(CX, CY, td.range);
        if (t) {
          S.towerTimer = td.rate;
          if (S.towerLevel >= 4) S.fireMissile(t, td.dmg);
          else {
            S.fireBullet(CX, CY - 10, t, td.dmg, true, 480);
            if (S.towerLevel >= 2) S.time.delayedCall(110, () => { if (t.active) S.fireBullet(CX, CY - 10, t, td.dmg, true, 480); });
          }
          if (S.towerGun) S.towerGun.setRotation(Phaser.Math.Angle.Between(CX, CY, t.x, t.y) + Math.PI / 2);
          S.sound.play('tower', { volume: 0.25 });
        }
      }
      // torretas laterais
      if (S.sideTurrets && S.sideTurrets.length && S.towerLevel >= 3) {
        S.sideTurrets.forEach((gun, i) => {
          gun.cd = (gun.cd || 0) - dt;
          if (gun.cd <= 0) {
            const t = S.nearestZombie(gun.x, gun.y, 300);
            if (t) {
              gun.cd = 850;
              gun.setRotation(Phaser.Math.Angle.Between(gun.x, gun.y, t.x, t.y) + Math.PI / 2);
              S.fireBullet(gun.x, gun.y, t, 12, true, 460);
            }
          }
        });
      }
    }

    // --- zumbis perseguem ---
    S.zombies.getChildren().forEach(z => {
      if (!z || !z.active) return;
      z.attackCd = Math.max(0, z.attackCd - dt);
      z.retarget -= dt;
      if (z.retarget <= 0) {
        z.retarget = 400;
        const dp = Phaser.Math.Distance.Between(z.x, z.y, S.player.x, S.player.y);
        const db = Phaser.Math.Distance.Between(z.x, z.y, CX, CY);
        z.targetObj = (z.isBoss || db < dp * 1.15) ? { x: CX, y: CY } : S.player;
      }
      const t = z.targetObj || { x: CX, y: CY };
      const ang = Phaser.Math.Angle.Between(z.x, z.y, t.x, t.y);
      S.physics.velocityFromRotation(ang, z.spd, z.body.velocity);
      z.setRotation(ang);
      // barra de vida do gigante
      if (z.isBoss) {
        if (!z.hpBar) z.hpBar = S.add.graphics().setDepth(50);
        z.hpBar.clear().fillStyle(0x000000, 0.5).fillRect(z.x - 50, z.y - 70, 100, 8)
          .fillStyle(0xff5050, 1).fillRect(z.x - 50, z.y - 70, 100 * Math.max(0, z.hp / z.maxHp), 8);
        z.once('destroy', () => z.hpBar && z.hpBar.destroy());
      }
    });

    // --- ímã de moedas ---
    S.coinsGroup.getChildren().forEach(c => {
      if (!c || !c.active) return;
      const d = Phaser.Math.Distance.Between(c.x, c.y, S.player.x, S.player.y);
      if (d < 160) {
        const ang = Phaser.Math.Angle.Between(c.x, c.y, S.player.x, S.player.y);
        S.physics.velocityFromRotation(ang, 90 + (160 - d) * 3.2, c.body.velocity);
      } else c.setVelocity(0, 0);
    });

    // --- diretor de ondas ---
    if (S.waveState === 'break') {
      S.waveTimer -= dt;
      if (S.waveTimer <= 0) S.startWave();
    } else {
      S.waveTimer -= dt;
      S.spawnTimer -= dt;
      if (S.waveTimer > 0 && S.spawnTimer <= 0) {
        S.spawnTimer = Math.max(330, 1500 - S.wave * 95);
        S.spawnZombie();
        if (S.wave >= 8 && Math.random() < 0.35) S.spawnZombie();
      }
      if (S.waveTimer <= 0 && S.zombies.countActive(true) === 0 && !S.bossAlive) {
        if (S.wave >= LAST_WAVE) { S.endGame(true, ''); return; }
        S.waveState = 'break';
        S.waveTimer = 6000;
        S.announce('ONDA ' + S.wave + ' SOBREVIVIDA!', '#8aff9c');
        S.playerHp = Math.min(S.playerMaxHp, S.playerHp + 20);
      }
    }

    S.updateHUD();
  }

  fireMissile(target, dmg) {
    const S = this;
    const m = S.add.image(CX, CY - 20, 'tgun3').setScale(0.8).setDepth(20);
    const tx = target.x, ty = target.y;
    m.setRotation(Phaser.Math.Angle.Between(CX, CY, tx, ty) + Math.PI / 2);
    S.tweens.add({
      targets: m, x: tx, y: ty, duration: 420, ease: 'Quad.In',
      onComplete: () => {
        m.destroy();
        // explosão em área
        const boom = S.add.image(tx, ty, 'flame1').setScale(0.5).setDepth(20).setTint(0xffc060);
        S.tweens.add({ targets: boom, scale: 2.6, alpha: 0, duration: 320, onComplete: () => boom.destroy() });
        S.cameras.main.shake(150, 0.008);
        S.sound.play('boom', { volume: 0.5 });
        S.zombies.getChildren().forEach(z => {
          if (!z || !z.active) return;
          if (Phaser.Math.Distance.Between(z.x, z.y, tx, ty) < 110) {
            z.hp -= dmg;
            if (z.hp <= 0) S.killZombie(z);
          }
        });
      },
    });
  }
}

// ------------------------------------------------------------
// Fim de jogo / vitória
// ------------------------------------------------------------
class EndScene extends Phaser.Scene {
  constructor() { super('end'); }

  create(data) {
    const { width: w, height: h } = this.scale;
    this.add.rectangle(w / 2, h / 2, w, h, 0x0a0f08, 0.82);

    const music = this.sound.add(data.victory ? 'm_menu' : 'm_over', { loop: true, volume: 0.4 });
    try { music.play(); } catch (e) {}

    this.add.text(w / 2, h * 0.26, data.victory ? 'VITÓRIA!' : 'FIM DA LINHA', {
      fontFamily: 'Kenney Future, sans-serif', fontSize: Math.min(64, w / 10),
      color: data.victory ? '#ffd23e' : '#ff5050',
    }).setOrigin(0.5).setShadow(0, 0, data.victory ? '#a05a10' : '#5a0a0a', 22, true, true);

    const sub = data.victory
      ? 'As 12 ondas passaram. O bastião resiste.\nA humanidade tem um amanhã — por sua causa.'
      : data.reason;
    this.add.text(w / 2, h * 0.4, sub, { fontFamily: 'Kenney Mono, monospace', fontSize: 17, color: '#cfe8c8', align: 'center', lineSpacing: 8 }).setOrigin(0.5);

    this.add.text(w / 2, h * 0.55,
      'ondas: ' + data.wave + '/' + LAST_WAVE + '   abates: ' + data.kills +
      '\nmoedas: ' + data.coins + '   torre: ' + TOWER_LEVELS[data.towerLevel].name +
      '\nrecorde de ondas: ' + loadRecord(),
      { fontFamily: 'Kenney Mono, monospace', fontSize: 17, color: '#ffd23e', align: 'center', lineSpacing: 10 }).setOrigin(0.5);

    const btn = this.add.text(w / 2, h * 0.72, data.victory ? '▶ JOGAR DE NOVO (ENTER)' : '▶ TENTAR DE NOVO (ENTER)', {
      fontFamily: 'Kenney Future, sans-serif', fontSize: 24, color: '#ffffff',
      backgroundColor: '#7a1f1f', padding: { x: 22, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: btn, scale: { from: 1, to: 1.05 }, duration: 500, yoyo: true, repeat: -1 });

    const menuBtn = this.add.text(w / 2, h * 0.82, 'menu principal', { fontFamily: 'Kenney Mono, monospace', fontSize: 15, color: '#9cb89c' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });

    const restart = () => { music.stop(); this.scene.stop('game'); this.scene.stop(); this.scene.start('game'); };
    const toMenu = () => { music.stop(); this.scene.stop('game'); this.scene.stop(); this.scene.start('menu'); };
    btn.on('pointerdown', restart);
    menuBtn.on('pointerdown', toMenu);
    this.input.keyboard.on('keydown-ENTER', restart);
  }
}

// ------------------------------------------------------------
// Recorde
// ------------------------------------------------------------
function loadRecord() {
  try { return parseInt(localStorage.getItem('bastiao_record') || '0', 10) || 0; } catch (e) { return 0; }
}
function saveRecord(w) {
  try { if (w > loadRecord()) localStorage.setItem('bastiao_record', String(w)); } catch (e) {}
}

// ------------------------------------------------------------
// Boot do Phaser
// ------------------------------------------------------------
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#1a2416',
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [BootScene, MenuScene, GameScene, EndScene],
});
