// ============================================================
// RPG — itens, magias, quests, NPCs, diálogos, save
// ============================================================
let ctx = null;

export const SKINS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const SKIN_NAMES = [
  'Camponês Valente', 'Caçadora do Vale', 'Aprendiz da Forja', 'Andarilha Roxa',
  'Escudeiro Real', 'Colhedora de Ervas', 'Menestrel Fujão', 'Bruxinha do Brejo',
];
export const GIFTS = {
  bravo: { nome: 'Bravo', attr: 'FOR' },
  aguia: { nome: 'Olho-de-Águia', attr: 'MIRA' },
  lua:   { nome: 'Tocado-pela-Lua', attr: 'MAG' },
};

// ------------------------------------------------------------
// Itens — raridade: 0 comum ⚪ · 1 raro 🔵 · 2 épico 🟣
// ------------------------------------------------------------
export const ITEMS = {
  // espadas (melee)
  'espada-enferrujada': { nome: 'Espada Enferrujada', tipo: 'espada', dmg: 12, r: 0, preco: 30, model: 'sword-a', desc: 'Já cortou muito pão. E só pão.' },
  'espada-miliciano':   { nome: 'Espada do Miliciano', tipo: 'espada', dmg: 17, FOR: 1, r: 0, preco: 130, model: 'sword-b', desc: 'Padrão da guarda de Pederneira.' },
  'lanca-guarda':       { nome: 'Lança da Sentinela', tipo: 'espada', dmg: 20, r: 1, preco: 250, model: 'spear-a', desc: 'Cutuca o perigo de longe.' },
  'lamina-conde':       { nome: 'Lâmina do Conde', tipo: 'espada', dmg: 24, FOR: 2, r: 1, preco: 330, model: 'sword-c', desc: 'Elegante, afiada e levemente esnobe.' },
  'marreta-trovao':     { nome: 'Marreta do Trovão', tipo: 'espada', dmg: 31, FOR: 3, r: 2, preco: 620, model: 'hammer-b', desc: 'Bartolomeu jura que não explode. Jura.' },
  'machado-gruk':       { nome: 'Machado do Warchefe', tipo: 'espada', dmg: 34, FOR: 4, r: 2, preco: 700, model: 'axe-double', desc: 'Ainda cheira a sopa de orc.' },
  // armas de fogo
  'vara-trovao':    { nome: 'Vara de Trovão', tipo: 'fogo', dmg: 9, rate: 0.42, preco: 110, r: 0, model: 'pistol', desc: 'A invenção do século, segundo o inventor.' },
  'uzi-benzida':    { nome: 'Uzi Benzida', tipo: 'fogo', dmg: 4.2, rate: 0.12, MIRA: 2, preco: 280, r: 1, model: 'uzi', desc: 'Abençoada pela Maga Petúnia (3 prestações).' },
  'bacamarte-vovo': { nome: 'Bacamarte do Vovô', tipo: 'fogo', dmg: 5.5, rate: 0.95, pellets: 5, spread: 0.38, preco: 390, r: 1, model: 'shotgunShort', desc: 'Herança de família. A família corre.' },
  'trovao-maior':   { nome: 'Trovão Maior', tipo: 'fogo', dmg: 5.2, rate: 0.09, MIRA: 2, preco: 680, r: 2, model: 'machinegun', desc: 'Por que um trovão, se podem ser vários?' },
  // amuletos
  'amuleto-cobre':    { nome: 'Amuleto de Cobre', tipo: 'amuleto', VIG: 2, r: 0, preco: 90, desc: 'Esquenta o peito e a coragem.' },
  'olho-coruja':      { nome: 'Olho de Coruja', tipo: 'amuleto', MIRA: 3, r: 1, preco: 230, desc: 'Pisca quando você erra.' },
  'lua-cheia':        { nome: 'Medalhão da Lua Cheia', tipo: 'amuleto', MAG: 3, r: 1, preco: 230, desc: 'Uiva baixinho nas noites claras.' },
  'amuleto-polvora':  { nome: 'Amuleto de Pólvora', tipo: 'amuleto', MIRA: 2, FOR: 1, r: 1, preco: 200, desc: 'Não aproxime de velas.' },
  'presas-barao':     { nome: 'Presas do Barão', tipo: 'amuleto', MAG: 2, MIRA: 2, r: 2, preco: 500, desc: 'Ele não vai sentir falta.' },
  'coracao-guardiao': { nome: 'Coração do Guardião', tipo: 'amuleto', VIG: 4, MAG: 2, r: 2, preco: 650, desc: 'Bate devagar, mas bate forte.' },
  // consumíveis
  'pocao-vida': { nome: 'Poção de Vida', tipo: 'pocao', cura: 0.4, r: 0, preco: 25, desc: 'Gosto de morango com ferrugem.' },
  'pocao-mana': { nome: 'Poção de Mana', tipo: 'pocao', mana: 0.5, r: 0, preco: 25, desc: 'Espumante, azul e levemente elétrica.' },
  // itens de missão
  'fragmento':   { nome: 'Fragmento do Coração', tipo: 'quest', r: 2, preco: 0, desc: 'Um terço da Relíquia. Pulsa devagarinho.' },
  'flor-do-rio': { nome: 'Flor-do-rio', tipo: 'quest', r: 0, preco: 0, desc: 'Só cresce onde a água canta.' },
  'ensopado':    { nome: 'Ensopado da Rosa', tipo: 'quest', r: 0, preco: 0, desc: 'Ainda quentinho. Não comer. NÃO COMER.' },
};

export function itemIcon(id) {
  const it = ITEMS[id];
  if (!it) return '❓';
  if (it.tipo === 'espada') return id.includes('marreta') ? '🔨' : id.includes('machado') ? '🪓' : id.includes('lanca') ? '🔱' : '🗡️';
  if (it.tipo === 'fogo') return '🔫';
  if (it.tipo === 'amuleto') return '📿';
  if (it.tipo === 'pocao') return it.cura ? '🧪' : '🔮';
  if (id === 'fragmento') return '💖';
  if (id === 'flor-do-rio') return '🌸';
  if (id === 'ensopado') return '🍲';
  return '✦';
}
export const RAR_NAMES = ['comum', 'raro', 'épico'];

// ------------------------------------------------------------
// Magias
// ------------------------------------------------------------
export const SPELLS = {
  fogo:       { nome: 'Bola de Fogo', emoji: '🔥', custo: 10, cd: 1.6, dmg: 24, preco: 100, desc: 'Projétil que explode em área.' },
  gelo:       { nome: 'Estilhaço Gélido', emoji: '❄️', custo: 8, cd: 4, dmg: 16, preco: 160, desc: 'Cone congelante que lentifica.' },
  cura:       { nome: 'Cura Menor', emoji: '💚', custo: 12, cd: 8, heal: 0.35, preco: 220, desc: 'Remenda ossos e orgulho.' },
  tempestade: { nome: 'Tempestade Arcana', emoji: '🌩️', custo: 18, cd: 10, dmg: 34, preco: 400, desc: 'Raios ao seu redor. Dramático.' },
};
export const SPELL_ORDER = ['fogo', 'gelo', 'cura', 'tempestade'];

// ------------------------------------------------------------
// Quests
// ------------------------------------------------------------
export const QUESTS = {
  main:      { nome: 'O Coração de Pederneira', giver: 'aldo', tipo: 'frags', alvo: 3, xp: 300, gold: 250,
               desc: 'Recupere os 3 fragmentos da Relíquia nas masmorras: a Cripta, o Forte e a Catacumba.' },
  trovao:    { nome: 'Teste da vara de trovão', giver: 'bartolomeu', tipo: 'gunhit', alvo: 10, xp: 60, gold: 40, item: 'amuleto-polvora',
               desc: 'Acerte 10 tiros em monstros para provar que a invenção de Bartolomeu funciona.' },
  porao:     { nome: 'Ratos... digo, zumbis!', giver: 'rosa', tipo: 'kill', alvoTipo: 'zombie', alvo: 6, xp: 70, gold: 50,
               desc: 'A Rosa garante que são "ratos grandes". Derrote 6 zumbis.' },
  entrega:   { nome: 'Entrega da Taberneira', giver: 'rosa', entregaPara: 'bento', tipo: 'deliver', alvo: 1, xp: 50, gold: 35,
               desc: 'Leve o ensopado da Rosa ao Fazendeiro Bento, nos campos, antes que esfrie (ou fuja).' },
  flores:    { nome: 'Flores-do-rio', giver: 'petunia', tipo: 'collect', alvoItem: 'flor-do-rio', alvo: 5, xp: 60, gold: 30, item: 'pocao-mana',
               desc: 'Colha 5 flores-do-rio na beira do rio dos campos para as poções da Petúnia.' },
  ossos:     { nome: 'Limpeza de primavera', giver: 'rosa', tipo: 'kill', alvoTipo: 'skeleton', alvo: 8, xp: 90, gold: 70, reqLevel: 3,
               desc: 'Esqueletos não pagam a conta e ainda assombram o forte. Derrote 8.' },
  fantasmas: { nome: 'Fantasmagoria', giver: 'petunia', tipo: 'kill', alvoTipo: 'ghost', alvo: 4, xp: 100, gold: 80, item: 'pocao-vida', reqFrags: 1,
               desc: 'Petúnia precisa de "essência etérea". Tradução: derrote 4 fantasmas.' },
};

// ------------------------------------------------------------
// NPCs
// ------------------------------------------------------------
export const NPCS = {
  aldo:       { nome: 'Prefeito Aldo', skin: 'character-i', area: 'vila', x: 3.2, z: 4.6, ry: -2.2 },
  bartolomeu: { nome: 'Bartolomeu, o Ferreiro', skin: 'character-q', area: 'vila', x: -12, z: -8.5, ry: 2.4, shop: 'ferreiro' },
  petunia:    { nome: 'Maga Petúnia', skin: 'character-r', area: 'vila', x: 12, z: -8.5, ry: -2.4, shop: 'magia' },
  rosa:       { nome: 'Taberneira Rosa', skin: 'character-j', area: 'vila', x: -11.5, z: 9, ry: 1.8 },
  nina:       { nome: 'Nina, a Padeira', skin: 'character-k', area: 'vila', x: 7, z: -3, ry: -1.4, wander: 6 },
  tobias:     { nome: 'Velho Tobias', skin: 'character-l', area: 'vila', x: -6.5, z: 4, ry: 1.2, wander: 5 },
  otto:       { nome: 'Guarda Otto', skin: 'character-m', area: 'vila', x: 2.2, z: 18.5, ry: Math.PI },
  bento:      { nome: 'Fazendeiro Bento', skin: 'character-n', area: 'campo', x: -30, z: 18, ry: 0.6 },
};

export const SHOPS = {
  ferreiro: { titulo: '⚒ FORJA DO BARTOLOMEU',
    itens: ['espada-miliciano', 'lanca-guarda', 'lamina-conde', 'marreta-trovao', 'vara-trovao', 'uzi-benzida', 'bacamarte-vovo', 'trovao-maior', 'amuleto-cobre'] },
  magia: { titulo: '🔮 EMPÓRIO DA PETÚNIA',
    magias: SPELL_ORDER, itens: ['pocao-vida', 'pocao-mana', 'olho-coruja', 'lua-cheia'] },
};

// ------------------------------------------------------------
// Estado do jogador
// ------------------------------------------------------------
export let P = null;

export function newPlayer(name, skin, gift) {
  P = {
    name: name || 'Pimenta', skin: skin || 'a', gift: gift || 'bravo',
    level: 1, xp: 0, pts: 0,
    attrs: { FOR: 1, MIRA: 1, MAG: 1, VIG: 2 },
    gold: 60, hp: 0, mana: 0,
    inv: [], equip: { espada: 'espada-enferrujada', fogo: null, amuleto: null },
    spells: [], selSpell: 0, cds: {},
    quests: {}, counts: { gunhit: 0 },
    frags: 0, bossesDead: [false, false, false],
    area: 'vila', px: 0, pz: 14,
    flags: {},
    playT: 0,
  };
  P.attrs[GIFTS[gift]?.attr || 'FOR'] += 2;
  giveItem('espada-enferrujada');
  giveItem('pocao-vida', 2);
  P.hp = stats().maxHp;
  P.mana = stats().maxMana;
  return P;
}

export function stats() {
  const eq = a => ['espada', 'fogo', 'amuleto'].reduce((s, slot) => {
    const it = P.equip[slot] && ITEMS[P.equip[slot]];
    return s + (it && it[a] || 0);
  }, 0);
  const A = a => P.attrs[a] + eq(a);
  const wep = ITEMS[P.equip.espada] || ITEMS['espada-enferrujada'];
  const gun = P.equip.fogo ? ITEMS[P.equip.fogo] : null;
  return {
    FOR: A('FOR'), MIRA: A('MIRA'), MAG: A('MAG'), VIG: A('VIG'),
    maxHp: 70 + A('VIG') * 12,
    maxMana: 20 + A('MAG') * 6,
    melee: Math.round(wep.dmg * (1 + 0.07 * A('FOR'))),
    gun: gun ? Math.max(1, Math.round(gun.dmg * (1 + 0.06 * A('MIRA')))) : 0,
    gunRate: gun ? gun.rate * (1 - Math.min(0.35, A('MIRA') * 0.015)) : 1,
    spellPow: 1 + 0.09 * A('MAG'),
    manaRegen: 1.1 + A('MAG') * 0.06,
    speed: 5.4,
  };
}

export function xpNext(level = P.level) { return 40 + (level - 1) * 50 + (level - 1) * (level - 1) * 8; }

export function addXp(n) {
  if (!P) return;
  P.xp += Math.round(n);
  let ups = 0;
  while (P.xp >= xpNext()) {
    P.xp -= xpNext();
    P.level++; P.pts += 3; ups++;
  }
  if (ups > 0) {
    const s = stats();
    P.hp = s.maxHp; P.mana = s.maxMana;          // level up cura tudo
    saveRecord();
    if (ctx) ctx.ui.levelUpFx();
  }
  if (ctx) ctx.ui.refreshHUD();
}

export function addGold(n) {
  P.gold = Math.max(0, P.gold + Math.round(n));
  if (ctx) ctx.ui.refreshHUD();
}

// ------------------------------------------------------------
// Inventário
// ------------------------------------------------------------
export const INV_MAX = 20;

export function giveItem(id, qty = 1) {
  const def = ITEMS[id];
  if (!def) return false;
  const stackable = def.tipo === 'pocao' || def.tipo === 'quest';
  if (stackable) {
    const s = P.inv.find(s => s && s.id === id);
    if (s) { s.qty += qty; if (ctx) ctx.ui.refreshInv(); return true; }
  }
  for (let i = 0; i < qty; i++) {
    if (P.inv.filter(Boolean).length >= INV_MAX) { if (ctx) ctx.ui.toast('🎒 Inventário cheio!'); return false; }
    P.inv.push({ id, qty: stackable ? qty : 1 });
    if (stackable) break;
  }
  if (ctx) ctx.ui.refreshInv();
  return true;
}

export function removeItem(id, qty = 1) {
  const i = P.inv.findIndex(s => s && s.id === id);
  if (i < 0) return false;
  const s = P.inv[i];
  if (s.qty > qty) s.qty -= qty;
  else P.inv.splice(i, 1);
  if (ctx) ctx.ui.refreshInv();
  return true;
}

export function countItem(id) {
  return P.inv.reduce((n, s) => n + (s && s.id === id ? s.qty : 0), 0);
}

export function equipItem(id) {
  const def = ITEMS[id];
  if (!def || !['espada', 'fogo', 'amuleto'].includes(def.tipo)) return false;
  P.equip[def.tipo] = id;
  AudioSys.play('equip', 0.7);
  if (ctx) { ctx.ent.refreshHandWeapon(); ctx.ui.refreshInv(); ctx.ui.refreshHUD(); }
  save();
  return true;
}

export function sellItem(idx) {
  const s = P.inv[idx];
  if (!s) return;
  const def = ITEMS[s.id];
  if (def.tipo === 'quest') { if (ctx) ctx.ui.toast('Isso é importante demais para vender!'); return; }
  if (Object.values(P.equip).includes(s.id) && P.inv.filter(x => x && x.id === s.id).length <= 1) {
    if (ctx) ctx.ui.toast('Está equipado — troque antes de vender.');
    return;
  }
  const val = Math.max(1, Math.floor(def.preco / 2));
  if (s.qty > 1) s.qty--; else P.inv.splice(idx, 1);
  addGold(val);
  AudioSys.play('sell', 0.8);
  if (ctx) { ctx.ui.toast(`Vendido: ${def.nome} (+🪙${val})`); ctx.ui.refreshInv(); }
}

export function usePotion(kind) {       // 'vida' | 'mana'
  const id = 'pocao-' + kind;
  if (countItem(id) <= 0) { AudioSys.play('error', 0.5); return false; }
  const s = stats();
  if (kind === 'vida' && P.hp >= s.maxHp) return false;
  if (kind === 'mana' && P.mana >= s.maxMana) return false;
  removeItem(id, 1);
  if (kind === 'vida') P.hp = Math.min(s.maxHp, P.hp + s.maxHp * 0.4);
  else P.mana = Math.min(s.maxMana, P.mana + s.maxMana * 0.5);
  AudioSys.play('upgrade', 0.7, kind === 'vida' ? 1.1 : 1.3);
  if (ctx) { ctx.ui.refreshHUD(); ctx.ent.heroBurst(kind === 'vida' ? 0xff6a7a : 0x6ab2ff); }
  return true;
}

// ------------------------------------------------------------
// Quests — estados: hidden → avail → active → ready → done
// ------------------------------------------------------------
export function qstate(id) {
  const q = QUESTS[id], st = P.quests[id];
  if (st) return st.state;
  // disponível?
  if (id === 'main') return 'avail';
  if (id === 'trovao') return P.flags.gotPistol ? 'avail' : 'hidden';
  if (id === 'entrega') return P.quests.porao && P.quests.porao.state === 'done' ? 'avail' : 'hidden';
  if (q.reqLevel && P.level < q.reqLevel) return 'hidden';
  if (q.reqFrags && P.frags < q.reqFrags) return 'hidden';
  return 'avail';
}

export function qprogress(id) {
  const st = P.quests[id];
  return st ? st.prog : 0;
}

export function acceptQuest(id) {
  if (qstate(id) !== 'avail') return false;
  P.quests[id] = { state: 'active', prog: 0 };
  const q = QUESTS[id];
  if (q.tipo === 'frags') P.quests[id].prog = P.frags;
  if (q.tipo === 'deliver') giveItem('ensopado');
  if (q.tipo === 'collect') checkQuests();
  AudioSys.play('qaccept', 0.8);
  if (ctx) { ctx.ui.toast(`📜 Nova missão: ${q.nome}`); ctx.ui.refreshHUD(); }
  save();
  return true;
}

export function questEvent(tipo, data = {}) {
  if (!P) return;
  if (tipo === 'gunhit') P.counts.gunhit++;
  for (const [id, st] of Object.entries(P.quests)) {
    if (st.state !== 'active') continue;
    const q = QUESTS[id];
    let adv = false;
    if (q.tipo === 'kill' && tipo === 'kill' && data.type === q.alvoTipo) { st.prog++; adv = true; }
    if (q.tipo === 'gunhit' && tipo === 'gunhit') { st.prog++; adv = true; }
    if (q.tipo === 'frags' && tipo === 'frag') { st.prog = P.frags; adv = true; }
    if (q.tipo === 'collect' && (tipo === 'collect' && data.item === q.alvoItem)) { st.prog = countItem(q.alvoItem); adv = true; }
    if (adv) {
      if (st.prog >= q.alvo) {
        st.state = 'ready';
        if (ctx) ctx.ui.toast(`📜 ${q.nome}: pronto! Volte para ${NPCS[q.entregaPara || q.giver].nome}.`);
        AudioSys.play('confirm', 0.7);
      }
      if (ctx) ctx.ui.refreshHUD();
    }
  }
}

export function checkQuests() {        // re-checa coletáveis (flores)
  for (const [id, st] of Object.entries(P.quests)) {
    const q = QUESTS[id];
    if (st.state === 'active' && q.tipo === 'collect') {
      st.prog = countItem(q.alvoItem);
      if (st.prog >= q.alvo) st.state = 'ready';
    }
  }
}

export function turnInQuest(id) {
  const st = P.quests[id];
  if (!st || st.state !== 'ready') return false;
  const q = QUESTS[id];
  st.state = 'done';
  if (q.tipo === 'collect') removeItem(q.alvoItem, q.alvo);
  if (q.tipo === 'deliver') removeItem('ensopado', 1);
  addGold(q.gold || 0);
  addXp(q.xp || 0);
  if (q.item) giveItem(q.item);
  AudioSys.play('jquest', 0.8);
  if (ctx) {
    ctx.ui.toast(`✅ Missão concluída: ${q.nome} (+${q.xp} XP, +🪙${q.gold}${q.item ? ', ' + ITEMS[q.item].nome : ''})`);
    ctx.ui.refreshHUD();
  }
  save();
  return true;
}

// marcador sobre o NPC: '!' tem quest, '?' pronta para entregar
export function npcMarker(npcId) {
  for (const [id, q] of Object.entries(QUESTS)) {
    const st = P && P.quests[id];
    const target = q.entregaPara || q.giver;
    if (st && st.state === 'ready' && target === npcId) return '?';
    if (st && st.state === 'active' && q.tipo === 'deliver' && q.entregaPara === npcId) return '?';
  }
  for (const [id, q] of Object.entries(QUESTS)) {
    if (q.giver === npcId && P && qstate(id) === 'avail') return '!';
  }
  return null;
}

// ------------------------------------------------------------
// Diálogos (pt-BR, leves)
// ------------------------------------------------------------
function questChoiceLines(id, linhas, aceitar, recusar) {
  return {
    lines: linhas,
    choices: [
      { label: '✔ ' + (aceitar || 'Aceitar missão'), fn: () => acceptQuest(id) },
      { label: '✖ ' + (recusar || 'Agora não'), fn: () => {} },
    ],
  };
}

export function getDialog(npcId) {
  const N = NPCS[npcId];
  const D = { name: N.nome, lines: [], choices: null, after: null };
  const ready = id => P.quests[id] && P.quests[id].state === 'ready';
  const active = id => P.quests[id] && P.quests[id].state === 'active';
  const done = id => P.quests[id] && P.quests[id].state === 'done';

  // ---- entregas prontas para este NPC ----
  if (npcId === 'bento' && active('entrega')) {
    P.quests.entrega.state = 'ready';
    D.lines = ['Isso é... o <b>ensopado da Rosa</b>?! Você atravessou o rio com ele?',
      'Herói de verdade é isso. Dragão qualquer um enfrenta — agora, entregar comida quente...'];
    D.after = () => turnInQuest('entrega');
    return D;
  }
  for (const [qid, q] of Object.entries(QUESTS)) {
    if (qid !== 'main' && ready(qid) && (q.entregaPara || q.giver) === npcId) {
      D.lines = {
        trovao: ['<b>DEZ ACERTOS!</b> Eu sabia! A vara de trovão funciona!', 'Toma este amuleto. É à prova de faísca. Quase.'],
        porao: ['Os "ratos" sumiram? Maravilha!', 'Se alguém perguntar, eram ratos GRANDES. A reputação da taberna agradece.'],
        ossos: ['Oito esqueletos a menos! Agora sim dá pra varrer o salão em paz.'],
        flores: ['Ahh, as flores-do-rio! Frescas e cantarolantes.', 'Toma uma poção. Receita da casa — quase não explode.'],
        fantasmas: ['Essência etérea fresquinha! Os fantasmas nem vão sentir falta. Eles não sentem nada, na real.'],
      }[qid] || ['Missão cumprida, herói!'];
      D.after = () => turnInQuest(qid);
      return D;
    }
  }

  // ---- principal ----
  if (npcId === 'aldo') {
    if (ready('main')) {
      D.lines = ['Os... os <b>três fragmentos</b>! O Coração de Pederneira pode bater de novo!',
        'Hoje ninguém dorme cedo: <b>FESTA NA PRAÇA!</b> 🎉'];
      D.after = () => { turnInQuest('main'); P.flags.celebrate = true; save(); if (ctx) ctx.game.celebrate(); };
      return D;
    }
    if (!P.quests.main) {
      const d = questChoiceLines('main', [
        `${P.name}! Que bom que chegou. A situação é... como dizer... <b>uma lástima oficial</b>.`,
        'A <b>Relíquia do Coração</b>, que protegia a vila, foi partida em <b>3 fragmentos</b> e roubada por três senhores das trevas: o <b>Barão Sanguessuga</b>, o <b>Warchefe Gruk</b> e o <b>Guardião Cego</b>.',
        'Eles se esconderam nas masmorras dos campos: a <b>Cripta</b>, o <b>Forte</b> e a <b>Catacumba</b>.',
        'Recupere os fragmentos! Fale antes com <b>Bartolomeu</b>, o ferreiro — ele anda gritando sobre uma invenção nova que "cospe trovões". Estamos todos um pouco preocupados.',
      ], 'Aceitar a missão', 'Preciso respirar primeiro');
      d.choices[0].fn = () => { acceptQuest('main'); P.flags.mainAccepted = true; save(); };
      Object.assign(D, d);
      return D;
    }
    D.lines = P.frags > 0
      ? [`Já são <b>${P.frags} de 3</b> fragmentos! A vila inteira torce por você. Eu, oficialmente.`]
      : ['Os fragmentos, herói! A Cripta fica a oeste dos campos, o Forte a leste e a Catacumba ao sul. Fale com Bartolomeu antes!'];
    return D;
  }

  // ---- ferreiro ----
  if (npcId === 'bartolomeu') {
    if (P.flags.mainAccepted && !P.flags.gotPistol) {
      P.flags.gotPistol = true;
      giveItem('vara-trovao');
      equipItem('vara-trovao');
      save();
      D.lines = ['Chegou na hora! Olha só: eu misturei salitre, carvão e enxofre, e ADIVINHA — <b>BUM!</b>',
        'Eu chamo de <i>pólvora</i>. E isto aqui é a <b>VARA DE TROVÃO</b>. Aponta, aperta, e o problema... deixa de ser um problema.',
        'É sua! De graça! Só preciso que você... hã... <b>teste em monstros</b>. Por segurança. Minha e da vila.',
        'A Maga Petúnia disse que isso é "magia de preguiçoso". Ela só está com inveja do barulho.'];
      D.after = () => { if (ctx) { ctx.ui.toast('🔫 Recebeu: Vara de Trovão (equipada!)'); ctx.ui.refreshHUD(); } };
      return D;
    }
    if (qstate('trovao') === 'avail') {
      Object.assign(D, questChoiceLines('trovao', [
        'E aí, a vara de trovão está trovejando direito?',
        'Faz um favor: <b>acerte 10 tiros</b> em monstros e me conta. É pesquisa científica. Com explosões.',
      ]));
      D.choices.push({ label: '🛒 Ver mercadorias', fn: () => ctx.ui.openShop('ferreiro') });
      return D;
    }
    D.lines = [pick([
      'Espada boa é espada que volta inteira. Arma de fogo boa é a que volta com o dono inteiro.',
      'Hoje forjei três espadas e um cano novo. A modernidade não espera!',
      'Se a marreta falhar, usa a vara. Se a vara falhar... corre. Tática clássica.',
    ])];
    D.choices = [
      { label: '🛒 Ver mercadorias', fn: () => ctx.ui.openShop('ferreiro') },
      { label: 'Até logo', fn: () => {} },
    ];
    return D;
  }

  // ---- maga ----
  if (npcId === 'petunia') {
    const choices = [
      { label: '🛒 Ver magias e poções', fn: () => ctx.ui.openShop('magia') },
      { label: 'Até logo', fn: () => {} },
    ];
    if (qstate('flores') === 'avail') {
      Object.assign(D, questChoiceLines('flores', [
        'Bem-vindo(a) ao único estabelecimento da vila que NÃO cheira a pólvora.',
        'O Bartolomeu e aquele canhão de bolso... <i>magia de preguiçoso</i>, é o que é!',
        'Se quiser ser útil de verdade: colha <b>5 flores-do-rio</b> na beira do rio. Minhas poções não se fazem sozinhas.',
      ]));
      D.choices.push(...choices);
      return D;
    }
    if (qstate('fantasmas') === 'avail') {
      Object.assign(D, questChoiceLines('fantasmas', [
        'Sinto cheiro de fragmento na sua mochila... e de oportunidade!',
        'Preciso de <b>essência etérea</b>. Derrote <b>4 fantasmas</b> e ela vem até mim. Física básica. Quer dizer, metafísica.',
      ]));
      D.choices.push(...choices);
      return D;
    }
    D.lines = [pick([
      'Magia é arte, técnica e séculos de estudo. Pólvora é... barulho com fumaça. Hmpf.',
      'Dizem que a pólvora é o futuro. O futuro é surdo, então.',
      'Entre uma bola de fogo e uma "bala", escolha as duas. Sou moderna, não boba.',
    ])];
    D.choices = choices;
    return D;
  }

  // ---- taberneira ----
  if (npcId === 'rosa') {
    if (qstate('porao') === 'avail') {
      Object.assign(D, questChoiceLines('porao', [
        'Psiu! Herói! Tenho um probleminha no porão. <b>Ratos</b>. Ratos... grandes. Verdes. Que gemem.',
        'Tá, são <b>zumbis</b>. Mas se a clientela souber, a taberna vira lenda — do jeito ruim. Derrota uns 6 pra mim?',
      ]));
      return D;
    }
    if (qstate('entrega') === 'avail') {
      Object.assign(D, questChoiceLines('entrega', [
        'Você de novo! Olha, o <b>Fazendeiro Bento</b> pediu meu ensopado famoso.',
        'Leva pra ele nos campos? Ainda está quente. Se chacoalhar muito, ele engrossa. É... uma característica.',
      ], 'Levar o ensopado'));
      return D;
    }
    if (qstate('ossos') === 'avail') {
      Object.assign(D, questChoiceLines('ossos', [
        'Os clientes andam reclamando de <b>esqueletos</b> no caminho do forte. Esqueleto não bebe, não paga e ainda assusta quem paga!',
        'Faz uma limpeza de primavera? Uns <b>8</b> já resolvem.',
      ]));
      return D;
    }
    D.lines = [pick([
      'O segredo do meu ensopado? Não pergunte. Sério, é segredo de guilda.',
      'Um caneco de suco de beterraba pro herói da casa! É o que temos.',
      'Dizem que o Barão Sanguessuga não entra aqui porque uma vez cobrei couvert dele.',
    ])];
    return D;
  }

  // ---- aldeões ----
  if (npcId === 'nina') {
    D.lines = [pick([
      'O Bartolomeu testou a tal "vara de trovão" ontem. Meu pão caiu da janela. EM OUTRA RUA.',
      'Pólvora, dizem, é o progresso. O progresso espantou minhas galinhas até o moinho.',
      'Quer pão de mel? Acabou. O progresso comeu.',
    ])];
    return D;
  }
  if (npcId === 'tobias') {
    D.lines = [pick([
      'No meu tempo, monstro se enfrentava com espada, escudo e gritaria. Hoje é “pou, pou” e acabou. Que juventude.',
      'Eu ouvi um trovão ontem à noite. Num céu limpo. Ou era o Bartolomeu, ou Zeus mudou pra cá.',
      'A Petúnia e o Bartolomeu brigam tanto que um dia ainda inventam a <i>varinha-revólver</i>. Anota aí.',
    ])];
    return D;
  }
  if (npcId === 'otto') {
    D.lines = [pick([
      'Os campos andam perigosos. Leve poções. E casaco. E, sei lá, uma vara de trovão.',
      'Regras da vila: não correr na praça, não alimentar zumbis, não apontar a vara de trovão pro chafariz.',
      'Eu vigio o portão. O portão está... vigiado. Missão cumprida diariamente.',
    ])];
    return D;
  }
  if (npcId === 'bento') {
    D.lines = [pick([
      'Essas nuvens de hoje... estão projetando sombra na minha plantação de propósito, eu juro.',
      'Um orc pisou no meu milharal semana passada. A bota dele era do tamanho de um leitão.',
      'Se vir flores na beira do rio, são da Petúnia. Tudo aqui é de alguém, menos os mosquitos.',
    ])];
    return D;
  }

  D.lines = ['...'];
  return D;
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ------------------------------------------------------------
// Save / load
// ------------------------------------------------------------
const SAVE_KEY = 'bruxaria_save';
const RECORD_KEY = 'bruxaria_record';

export function save() {
  if (!P) return;
  try {
    if (ctx && ctx.hero) { P.px = ctx.hero.x; P.pz = ctx.hero.z; P.area = ctx.area; }
    localStorage.setItem(SAVE_KEY, JSON.stringify(P));
  } catch (e) {}
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.name) return null;
    P = data;
    P.counts = P.counts || { gunhit: 0 };
    P.cds = {};
    return P;
  } catch (e) { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function saveRecord() {
  try {
    const r = parseInt(localStorage.getItem(RECORD_KEY) || '0', 10) || 0;
    if (P && P.level > r) localStorage.setItem(RECORD_KEY, String(P.level));
  } catch (e) {}
}

export function loadRecord() {
  try { return parseInt(localStorage.getItem(RECORD_KEY) || '0', 10) || 0; } catch (e) { return 0; }
}

export const RPG = {
  init(c) { ctx = c; },
  get P() { return P; },
};
