// ============================================================
// LEVELS — design das fases (coordenadas: col = x, y pra cima)
// Bloco na célula (c, y) ocupa x∈[c,c+1], y∈[y,y+1]
// ============================================================

class LevelBuilder {
  constructor(name, subtitle, theme, width, music) {
    this.def = {
      name, subtitle, theme, width, music,
      solids: new Map(),      // "c,y" -> true (blocos cheios)
      plats: [],              // { c, y } plataformas finas one-way
      ents: [],               // entidades { t, c, y, ... }
      spawn: { c: 3, y: 4 },
      ice: theme === 'snow',
    };
  }
  key(c, y) { return c + ',' + y; }
  g(c, y) { this.def.solids.set(this.key(c, y), true); return this; }
  fill(c0, c1, y0, y1) {
    for (let c = c0; c <= c1; c++) for (let y = y0; y <= y1; y++) this.g(c, y);
    return this;
  }
  ground(c0, c1, top = 3) { return this.fill(c0, c1, 0, top); }
  plat(c0, c1, y) { for (let c = c0; c <= c1; c++) this.def.plats.push({ c, y }); return this; }
  ent(t, c, y, extra = {}) { this.def.ents.push({ t, c, y, ...extra }); return this; }
  coin(c, y) { return this.ent('coin', c, y); }
  coinRow(c0, c1, y) { for (let c = c0; c <= c1; c++) this.coin(c, y); return this; }
  coinArc(c0, c1, y, h = 1) {
    const mid = (c0 + c1) / 2, half = (c1 - c0) / 2 || 1;
    for (let c = c0; c <= c1; c++) {
      const t = (c - mid) / half;
      this.coin(c, Math.round(y + h * (1 - t * t)));
    }
    return this;
  }
  spike(c0, c1, y) { for (let c = c0; c <= c1; c++) this.ent('spike', c, y); return this; }
  saw(c, y, range = 0) { return this.ent('saw', c, y, { range }); }
  spring(c, y) { return this.ent('spring', c, y); }
  crate(c, y) { return this.ent('crate', c, y); }
  crateItem(c, y) { return this.ent('crateItem', c, y); }
  crateS(c, y) { return this.ent('crateStrong', c, y); }
  mover(axis, c, y, range) { return this.ent('mover', c, y, { axis, range }); }
  slime(c, y) { return this.ent('slime', c, y); }
  spiky(c, y) { return this.ent('spiky', c, y); }
  bee(c, y) { return this.ent('bee', c, y); }
  star(idx, c, y) { return this.ent('star', c, y, { idx }); }
  heart(c, y) { return this.ent('heart', c, y); }
  flag(c, y) { return this.ent('flag', c, y); }
  portal(c, y) { return this.ent('portal', c, y); }
  sign(c, y, kind = 0) { return this.ent('sign', c, y, { kind }); }
  spawnAt(c, y) { this.def.spawn = { c, y }; return this; }
}

// ------------------------------------------------------------
// FASE 1 — VALE QUICANTE
// ------------------------------------------------------------
function level1() {
  const L = new LevelBuilder('VALE QUICANTE', 'fase 1', 'grass', 126, 'level1');
  L.spawnAt(3, 4);

  // início plano + moedas de boas-vindas
  L.ground(0, 22);
  L.sign(5, 4, 0);
  L.coinRow(7, 9, 4);

  // degraus que ensinam o pulo
  L.fill(9, 11, 4, 4).fill(12, 14, 4, 5);
  L.coin(13, 7);
  L.slime(18, 4);

  // primeiro buraco (pequeno)
  L.ground(26, 69);
  L.coinArc(23, 26, 5, 1);

  // caixas
  L.crate(28, 4).crate(29, 4).crateItem(29, 5);

  // mola → passeio nas alturas + estrela 1
  L.spring(36, 4);
  L.plat(39, 44, 7);
  L.coinRow(39, 44, 9);
  L.star(1, 46, 9);
  L.slime(46, 4);

  // fosso de espinhos (por baixo) — quem foi pela plataforma escapa
  L.spike(53, 56, 4);

  // dupla de gosminhas + subsolo secreto tampado com caixas fortes
  L.slime(60, 4).slime(64, 4);
  L.sign(67, 4, 1);
  // subsolo: col 70-76 (tampa de caixas fortes em y=3)
  for (let c = 70; c <= 76; c++) L.def.solids.delete(L.key(c, 3));
  for (let c = 70; c <= 76; c++) for (let y = 1; y <= 2; y++) L.def.solids.delete(L.key(c, y));
  L.fill(70, 76, 0, 0);
  L.crateS(70, 3).crateS(71, 3).crateS(72, 3).crateS(73, 3).crateS(74, 3);
  L.fill(75, 75, 1, 1).fill(76, 76, 1, 2);          // escadinha de saída
  L.coinRow(70, 74, 1);
  L.star(2, 72, 2);

  // checkpoint
  L.ground(77, 79);
  L.flag(78, 4);

  // vão do pulo duplo (com plataforma de apoio)
  L.ground(85, 104);
  L.plat(82, 82, 6);
  L.coinArc(80, 85, 6, 1);

  // zangão das moedas
  L.bee(88, 7);
  L.coinArc(86, 90, 7, 1);

  // colina: subida, mola no topo → estrela 3 lá no céu
  L.fill(93, 94, 4, 4).fill(95, 96, 4, 5).fill(97, 98, 4, 6).fill(99, 104, 4, 7);
  L.coin(94, 6).coin(96, 7).coin(98, 8);
  L.spring(101, 8);
  L.plat(103, 106, 12);
  L.star(3, 105, 14);
  L.coin(103, 13).coin(106, 13);

  // descida e reta final
  L.ground(105, 125);
  L.fill(105, 106, 4, 6).fill(107, 108, 4, 5).fill(109, 110, 4, 4);
  L.coinRow(112, 118, 4).coinRow(113, 117, 5);
  L.slime(114, 4);
  L.bee(118, 7);
  L.heart(110, 6);

  // portal do fim
  L.portal(122, 4);
  return L.def;
}

// ------------------------------------------------------------
// FASE 2 — PICOS CONGELADOS
// ------------------------------------------------------------
function level2() {
  const L = new LevelBuilder('PICOS CONGELADOS', 'fase 2', 'snow', 133, 'level2');
  L.spawnAt(3, 4);

  // gelo inicial + serra de aviso
  L.ground(0, 14);
  L.sign(5, 4, 2);
  L.coinRow(8, 10, 4);
  L.saw(12, 4);

  // travessia com plataformas móveis
  L.mover('H', 16, 5, 3);
  L.ground(20, 26);
  L.spiky(23, 4);
  L.mover('H', 28, 5, 3);

  // zigue-zague de plataformas finas até o planalto
  L.ground(32, 48);
  L.plat(33, 34, 5).plat(36, 37, 7);
  L.coin(33, 6).coin(36, 8).coin(37, 8);
  L.fill(41, 48, 4, 8);
  L.bee(44, 11);
  L.crate(46, 9).crateItem(47, 9);

  // vale profundo — estrela 1 + mola de volta (quicada na mola!)
  L.ground(49, 60, 0);
  L.plat(50, 51, 6).plat(53, 54, 3);
  L.saw(52, 1);
  L.coinRow(55, 58, 1);
  L.star(1, 57, 2);
  L.spring(59, 1);
  L.plat(60, 61, 8);
  L.sign(56, 1, 3);

  // planalto do checkpoint
  L.ground(61, 72);
  L.spiky(68, 4);
  L.flag(70, 4);

  // corredor das serras móveis
  L.ground(73, 88);
  L.saw(75, 4, 3).saw(79, 4, 3);
  L.coinArc(74, 80, 6, 1);
  // pilha de caixas fortes com coração
  L.crateS(83, 4).crateS(83, 5);
  L.heart(83, 7);
  L.crate(86, 4).crateItem(87, 4);

  // abismo com ilhota e mola para o planalto alto
  L.ground(91, 92);
  L.spring(91, 4);
  L.coinArc(89, 94, 6, 2);

  // planalto alto — zangões e estrela 2 (use um zangão de trampolim!)
  L.ground(95, 104);
  L.fill(95, 104, 4, 7);
  L.bee(98, 10).bee(102, 11);
  L.coinRow(97, 100, 9);
  L.star(2, 102, 13);

  // descida escorregadia com espinhos
  L.ground(105, 110);
  L.fill(105, 106, 4, 6).fill(107, 108, 4, 5).fill(109, 110, 4, 4);
  L.spike(109, 109, 5);
  L.coin(106, 8).coin(108, 7).coin(110, 6);

  // travessia final de móveis
  L.mover('H', 112, 5, 2);
  L.mover('V', 116, 4, 3);

  // ilha final
  L.ground(119, 132);
  L.slime(121, 4).slime(123, 4);
  L.plat(119, 120, 6);
  L.star(3, 120, 8);
  L.coinRow(124, 127, 4);
  L.portal(129, 4);
  return L.def;
}

// ------------------------------------------------------------
// ARENA — TRONO DO REI BOCÃO
// ------------------------------------------------------------
function bossArena() {
  const L = new LevelBuilder('TRONO DO REI BOCÃO', 'chefe', 'boss', 30, 'boss');
  L.spawnAt(5, 4);
  L.ground(0, 29);
  L.fill(0, 1, 4, 12).fill(28, 29, 4, 12);     // paredes da arena
  L.plat(6, 8, 7).plat(21, 23, 7);             // palanques de fuga
  L.ent('boss', 20, 4);
  return L.def;
}

export const LEVELS = [level1(), level2(), bossArena()];
