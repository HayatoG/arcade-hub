// ============================================================
// UI — HUD, diálogos, inventário, quests, lojas, menus
// ============================================================
import * as RPG from './rpg.js';
import { INPUT } from './input.js';

let ctx = null;
const $ = id => document.getElementById(id);

// ------------------------------------------------------------
// Estado do diálogo
// ------------------------------------------------------------
const dlg = { open: false, pages: [], page: 0, shown: 0, done: false, choices: null, after: null, choiceSel: 0 };
let invSel = -1;
let sessionAdd = { FOR: 0, MIRA: 0, MAG: 0, VIG: 0 };
let announceTimer = null;

export const UI = {
  init(c) {
    ctx = c;
    buildSpellbar();
    wireButtons();
  },

  // ---------- HUD ----------
  refreshHUD() {
    const P = RPG.P;
    if (!P) return;
    const s = RPG.stats();
    $('hp-fill').style.transform = `scaleX(${Math.max(0, P.hp / s.maxHp)})`;
    $('hp-num').textContent = Math.ceil(P.hp) + ' / ' + s.maxHp;
    $('mp-fill').style.transform = `scaleX(${Math.max(0, P.mana / s.maxMana)})`;
    $('mp-num').textContent = Math.floor(P.mana) + ' / ' + s.maxMana;
    $('lvl-badge').textContent = 'NV ' + P.level + (P.pts > 0 ? ' (+' + P.pts + ')' : '');
    $('xp-fill').style.transform = `scaleX(${P.xp / RPG.xpNext()})`;
    $('gold-hud').textContent = '🪙 ' + P.gold;
    $('area-name').textContent = ctx.world.areas[ctx.area] ? ctx.world.areas[ctx.area].nome : '';
    $('pot-hp-n').textContent = RPG.countItem('pocao-vida');
    $('pot-mp-n').textContent = RPG.countItem('pocao-mana');
    // rastreador de missão
    let track = '';
    const entries = Object.entries(P.quests).filter(([, st]) => st.state === 'active' || st.state === 'ready');
    for (const [id, st] of entries.slice(0, 3)) {
      const q = RPG.QUESTS[id];
      track += (st.state === 'ready' ? '✔ ' : '▸ ') + q.nome +
        (q.alvo > 1 ? ` (${Math.min(st.prog, q.alvo)}/${q.alvo})` : '') + '\n';
    }
    $('quest-track').textContent = track.trim();
    // magias
    for (let i = 0; i < 4; i++) {
      const slot = $('spell-' + i);
      const id = P.spells[i];
      slot.classList.toggle('locked', !id);
      slot.classList.toggle('sel', P.selSpell === i && !!id);
      slot.querySelector('.emoji').textContent = id ? RPG.SPELLS[id].emoji : '✦';
      slot.querySelector('.cost').textContent = id ? RPG.SPELLS[id].custo : '';
    }
  },

  update(dt) {
    // typewriter
    if (dlg.open && !dlg.done) {
      dlg.shown += dt * 55;
      const txt = dlg.pages[dlg.page] || '';
      const plain = stripLen(txt);
      if (dlg.shown >= plain) { dlg.shown = plain; dlg.done = true; }
      renderDlgText();
    }
    // cooldown das magias
    const P = RPG.P;
    if (P) {
      for (let i = 0; i < 4; i++) {
        const id = P.spells[i];
        const cool = $('spell-' + i).querySelector('.cool');
        if (id && (P.cds[id] || 0) > 0) cool.style.height = (100 * P.cds[id] / RPG.SPELLS[id].cd) + '%';
        else cool.style.height = '0%';
      }
    }
  },

  toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    $('toasts').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 3200);
    setTimeout(() => el.remove(), 3700);
    while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
  },

  announce(msg, dur = 1600) {
    const el = $('announce');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => el.classList.remove('show'), dur);
  },

  levelUpFx() {
    AudioSys.play('jlevel', 0.9);
    AudioSys.play('levelup', 0.7);
    this.announce('✨ NÍVEL ' + RPG.P.level + '! ✨\n+3 pontos de atributo (I)', 2600);
    ctx.ent.levelUpBurst();
    this.refreshHUD();
  },

  setPrompt(label) {
    const el = $('prompt');
    if (label) {
      el.innerHTML = INPUT.gamepadActive ? `Ⓐ — ${label}` : `<b>E</b> — ${label}`;
      el.classList.remove('hidden');
    } else el.classList.add('hidden');
    INPUT.setInteract(label ? '✋' : null);
  },

  bossBar(name, frac = 1) {
    if (!name) { $('bossbar').classList.add('hidden'); return; }
    $('bossbar').classList.remove('hidden');
    $('boss-name').textContent = '☠ ' + name;
    $('boss-fill').style.transform = `scaleX(${frac})`;
  },

  // ---------- diálogo ----------
  openDialog(npcId) {
    const d = RPG.getDialog(npcId);
    this.openRawDialog(d.name, d.lines, d.choices, d.after);
  },
  openSign(texto) {
    this.openRawDialog('🪧 Placa', [texto], null, null);
  },
  openRawDialog(name, lines, choices, after) {
    dlg.open = true;
    dlg.pages = lines;
    dlg.page = 0;
    dlg.shown = 0;
    dlg.done = false;
    dlg.choices = choices || null;
    dlg.after = after || null;
    dlg.choiceSel = 0;
    $('dlg-name').textContent = name;
    $('dlg-text').innerHTML = '';
    $('dlg-choices').innerHTML = '';
    $('dlg-next').classList.add('hidden');
    $('dlg').classList.remove('hidden');
    ctx.game.setState('dialog');
    AudioSys.play('book', 0.5);
  },

  advanceDialog() {
    if (!dlg.open) return;
    if (!dlg.done) {                      // acelera
      dlg.shown = 1e6;
      return;
    }
    if (dlg.page < dlg.pages.length - 1) {
      dlg.page++;
      dlg.shown = 0;
      dlg.done = false;
      $('dlg-next').classList.add('hidden');
      AudioSys.play('click', 0.3, 1.4);
      return;
    }
    // última página
    if (dlg.choices && !$('dlg-choices').children.length) {
      renderChoices();
      return;
    }
    if (!dlg.choices) this.closeDialog(true);
  },

  moveChoice(d) {
    if (!dlg.open || !dlg.choices || !$('dlg-choices').children.length) return;
    dlg.choiceSel = (dlg.choiceSel + d + dlg.choices.length) % dlg.choices.length;
    [...$('dlg-choices').children].forEach((el, i) => el.classList.toggle('sel', i === dlg.choiceSel));
    AudioSys.play('click', 0.3);
  },
  pickChoice() {
    if (!dlg.open || !dlg.choices || !$('dlg-choices').children.length) return false;
    const c = dlg.choices[dlg.choiceSel];
    this.closeDialog(false);
    if (c && c.fn) c.fn();
    if (ctx.state === 'dialog') {/* escolha abriu outro diálogo/loja */}
    return true;
  },

  closeDialog(runAfter) {
    const after = dlg.after;
    dlg.open = false;
    $('dlg').classList.add('hidden');
    if (ctx.state === 'dialog') ctx.game.setState('play');
    if (runAfter && after) after();
  },
  get dialogOpen() { return dlg.open; },
  get dialogHasChoices() { return dlg.open && dlg.choices && $('dlg-choices').children.length > 0; },
  skipDialog() {
    while (dlg.open) {
      if (dlg.choices && dlg.done && dlg.page >= dlg.pages.length - 1) {
        if (!$('dlg-choices').children.length) renderChoices();
        dlg.choiceSel = 0;
        this.pickChoice();
      } else {
        dlg.done = true;
        this.advanceDialog();
      }
    }
  },

  // ---------- inventário ----------
  openInv() {
    sessionAdd = { FOR: 0, MIRA: 0, MAG: 0, VIG: 0 };
    invSel = -1;
    $('inv').classList.remove('hidden');
    this.refreshInv();
    ctx.game.setState('inv');
    AudioSys.play('bag', 0.7);
  },
  closeInv() {
    $('inv').classList.add('hidden');
    RPG.save();
  },
  refreshInv() {
    if ($('inv').classList.contains('hidden')) return;
    const P = RPG.P;
    // equipamento
    const eqRow = $('equip-row');
    eqRow.innerHTML = '';
    for (const slot of ['espada', 'fogo', 'amuleto']) {
      const id = P.equip[slot];
      const it = id && RPG.ITEMS[id];
      const el = document.createElement('div');
      el.className = 'equip-slot';
      el.innerHTML = `<div class="etitle">${{ espada: '🗡 ESPADA', fogo: '🔫 FOGO', amuleto: '📿 AMULETO' }[slot]}</div>
        <div class="ename">${it ? RPG.itemIcon(id) + ' ' + it.nome : '<i style="color:#666">vazio</i>'}</div>`;
      eqRow.appendChild(el);
    }
    // grade
    const grid = $('inv-grid');
    grid.innerHTML = '';
    for (let i = 0; i < RPG.INV_MAX; i++) {
      const s = P.inv[i];
      const el = document.createElement('div');
      el.className = 'islot' + (s ? ' r' + RPG.ITEMS[s.id].r : '') + (invSel === i ? ' sel' : '');
      if (s) {
        el.innerHTML = `<span>${RPG.itemIcon(s.id)}</span>` +
          (s.qty > 1 ? `<span class="qty">×${s.qty}</span>` : '') +
          (Object.values(P.equip).includes(s.id) ? '<span class="eq">EQUIPADO</span>' : '');
        el.addEventListener('click', () => { invSel = i; AudioSys.play('click', 0.4); UI.refreshInv(); });
      }
      grid.appendChild(el);
    }
    // ações + tooltip
    const act = $('inv-actions'), tip = $('inv-tip');
    act.innerHTML = ''; tip.innerHTML = '';
    const sel = P.inv[invSel];
    if (sel) {
      const it = RPG.ITEMS[sel.id];
      const bonus = ['FOR', 'MIRA', 'MAG', 'VIG'].filter(a => it[a]).map(a => `+${it[a]} ${a}`).join(' · ');
      tip.innerHTML = `<b>${RPG.itemIcon(sel.id)} ${it.nome}</b> <span style="color:${['#aaa', '#5ab2ff', '#c478ff'][it.r]}">(${RPG.RAR_NAMES[it.r]})</span><br>` +
        (it.dmg ? `Dano ${it.dmg}${it.rate ? ' · cadência ' + it.rate.toFixed(2) + 's' : ''}${it.pellets ? ' ×' + it.pellets : ''}<br>` : '') +
        (bonus ? bonus + '<br>' : '') + `<i>${it.desc}</i>`;
      if (['espada', 'fogo', 'amuleto'].includes(it.tipo)) {
        const b = document.createElement('button');
        b.className = 'gold';
        b.textContent = '⚔ Equipar';
        b.onclick = () => { RPG.equipItem(sel.id); UI.refreshInv(); };
        act.appendChild(b);
      }
      if (it.tipo === 'pocao') {
        const b = document.createElement('button');
        b.className = 'gold';
        b.textContent = '🧪 Usar';
        b.onclick = () => { RPG.usePotion(sel.id === 'pocao-vida' ? 'vida' : 'mana'); UI.refreshInv(); };
        act.appendChild(b);
      }
      if (it.tipo !== 'quest') {
        const b = document.createElement('button');
        b.textContent = `Vender (🪙${Math.max(1, Math.floor(it.preco / 2))})`;
        b.onclick = () => { RPG.sellItem(invSel); if (!P.inv[invSel]) invSel = -1; UI.refreshInv(); };
        act.appendChild(b);
      }
    } else tip.innerHTML = '<i>Selecione um item…</i>';
    // atributos
    $('attr-pts').textContent = P.pts;
    const list = $('attr-list');
    list.innerHTML = '';
    const descs = { FOR: 'dano corpo a corpo', MIRA: 'dano e cadência de tiro', MAG: 'magia e mana máx.', VIG: 'vida máxima' };
    for (const a of ['FOR', 'MIRA', 'MAG', 'VIG']) {
      const row = document.createElement('div');
      row.className = 'attr-row';
      row.innerHTML = `<span class="aname">${a}</span><span class="aval">${P.attrs[a]}</span>`;
      const minus = document.createElement('button');
      minus.textContent = '−';
      minus.disabled = sessionAdd[a] <= 0;
      minus.onclick = () => { P.attrs[a]--; P.pts++; sessionAdd[a]--; AudioSys.play('click', 0.4); UI.refreshInv(); UI.refreshHUD(); };
      const plus = document.createElement('button');
      plus.textContent = '+';
      plus.disabled = P.pts <= 0;
      plus.onclick = () => { P.attrs[a]++; P.pts--; sessionAdd[a]++; AudioSys.play('upgrade', 0.4, 1.4); UI.refreshInv(); UI.refreshHUD(); };
      const d = document.createElement('span');
      d.className = 'adesc';
      d.textContent = descs[a];
      row.appendChild(minus); row.appendChild(plus); row.appendChild(d);
      list.appendChild(row);
    }
    const s = RPG.stats();
    $('hero-stats').innerHTML =
      `<b>${P.name}</b> · ${RPG.SKIN_NAMES[RPG.SKINS.indexOf(P.skin)] || ''} · dom: ${RPG.GIFTS[P.gift].nome}<br>` +
      `⚔ dano melee: <b>${s.melee}</b> · 🔫 dano tiro: <b>${s.gun || '—'}</b><br>` +
      `✨ poder mágico: <b>×${s.spellPow.toFixed(2)}</b> · ❤️ ${s.maxHp} · 🔵 ${s.maxMana}<br>` +
      `💖 fragmentos: <b>${P.frags}/3</b>`;
  },

  // ---------- diário ----------
  openQlog() {
    const list = $('qlog-list');
    list.innerHTML = '';
    const P = RPG.P;
    const order = Object.keys(RPG.QUESTS);
    let any = false;
    for (const id of order) {
      const q = RPG.QUESTS[id];
      const st = P.quests[id];
      const state = st ? st.state : RPG.qstate(id);
      if (state === 'hidden' || state === 'avail') continue;
      any = true;
      const el = document.createElement('div');
      el.className = 'qentry ' + (state === 'done' ? 'done' : state === 'ready' ? 'ready' : 'active');
      const progTxt = state === 'done' ? '✔ concluída'
        : state === 'ready' ? '★ pronta para entregar — fale com ' + RPG.NPCS[q.entregaPara || q.giver].nome
        : q.alvo > 1 ? `progresso: ${Math.min(st.prog, q.alvo)}/${q.alvo}` : 'em andamento';
      el.innerHTML = `<div class="qname">${id === 'main' ? '⭐ ' : ''}${q.nome}</div>
        <div class="qdesc">${q.desc}</div>
        <div class="qprog">${progTxt}</div>
        <div class="qrew">recompensa: ${q.xp} XP · 🪙${q.gold}${q.item ? ' · ' + RPG.ITEMS[q.item].nome : ''}</div>`;
      list.appendChild(el);
    }
    if (!any) list.innerHTML = '<p style="color:#9a86b4">Nenhuma missão no momento. Converse com o povo da vila!</p>';
    $('qlog').classList.remove('hidden');
    ctx.game.setState('qlog');
    AudioSys.play('book', 0.7);
  },
  closeQlog() { $('qlog').classList.add('hidden'); },

  // ---------- loja ----------
  openShop(kind) {
    const shop = RPG.SHOPS[kind];
    $('shop-title').textContent = shop.titulo;
    this._shopKind = kind;
    this.refreshShop();
    $('shop').classList.remove('hidden');
    ctx.game.setState('shop');
    AudioSys.play('coin', 0.5);
  },
  refreshShop() {
    const kind = this._shopKind;
    const shop = RPG.SHOPS[kind];
    const P = RPG.P;
    $('shop-gold').textContent = '🪙 ' + P.gold;
    const list = $('shop-list');
    list.innerHTML = '';
    // magias (loja da Petúnia)
    if (shop.magias) {
      for (const id of shop.magias) {
        const sp = RPG.SPELLS[id];
        const owned = P.spells.includes(id);
        const row = document.createElement('div');
        row.className = 'shop-row' + (owned ? ' owned' : '');
        row.innerHTML = `<span class="icon">${sp.emoji}</span>
          <span class="info"><div class="iname r1">${sp.nome}</div>
          <div class="idesc">${sp.desc} · custo ${sp.custo} mana · recarga ${sp.cd}s</div></span>
          <span class="price">${owned ? 'aprendida' : '🪙' + sp.preco}</span>`;
        const b = document.createElement('button');
        b.textContent = owned ? '✔' : 'Aprender';
        b.disabled = owned || P.gold < sp.preco;
        b.onclick = () => {
          RPG.addGold(-sp.preco);
          P.spells.push(id);
          AudioSys.play('jquest', 0.7);
          UI.toast(`✨ Magia aprendida: ${sp.nome} (tecla ${P.spells.length})`);
          RPG.save();
          UI.refreshShop(); UI.refreshHUD();
        };
        row.appendChild(b);
        list.appendChild(row);
      }
    }
    for (const id of shop.itens) {
      const it = RPG.ITEMS[id];
      const owned = ['espada', 'fogo', 'amuleto'].includes(it.tipo) && (RPG.countItem(id) > 0 || Object.values(P.equip).includes(id));
      const bonus = ['FOR', 'MIRA', 'MAG', 'VIG'].filter(a => it[a]).map(a => `+${it[a]} ${a}`).join(' ');
      const row = document.createElement('div');
      row.className = 'shop-row' + (owned ? ' owned' : '');
      row.innerHTML = `<span class="icon">${RPG.itemIcon(id)}</span>
        <span class="info"><div class="iname r${it.r}">${it.nome}</div>
        <div class="idesc">${it.dmg ? 'dano ' + it.dmg + ' · ' : ''}${bonus ? bonus + ' · ' : ''}${it.desc}</div></span>
        <span class="price">${owned ? 'comprado' : '🪙' + it.preco}</span>`;
      const b = document.createElement('button');
      b.textContent = owned ? '✔' : 'Comprar';
      b.disabled = owned || P.gold < it.preco;
      b.onclick = () => {
        if (!RPG.giveItem(id)) return;
        RPG.addGold(-it.preco);
        AudioSys.play('buy', 0.8);
        UI.toast(`🛒 Comprado: ${it.nome}`);
        RPG.save();
        UI.refreshShop(); UI.refreshHUD();
      };
      row.appendChild(b);
      list.appendChild(row);
    }
  },
  closeShop() { $('shop').classList.add('hidden'); },

  // ---------- pausa ----------
  openPause() {
    $('pause-help').innerHTML =
      'WASD move · mouse mira · clique esq. tira · clique dir./espaço espada<br>' +
      'SHIFT rola · 1–4 magias · E interage · I inventário · J missões · Q/R poções · M som<br>' +
      '🎮 stick esq. move · dir. mira · RT atira · X espada · B rola · Y magia · LB/RB troca · A interage';
    $('pause').classList.remove('hidden');
    ctx.game.setState('pause');
  },
  closePause() { $('pause').classList.add('hidden'); },

  // ---------- morte ----------
  showDeath(goldLost) {
    $('death-msg').innerHTML =
      `VOCÊ DESMAIOU…<br><small>A Taberneira Rosa te arrastou de volta para a vila.<br>` +
      `O serviço de resgate custou 🪙${goldLost} (10%).</small>`;
    $('death-msg').classList.remove('hidden');
  },
  hideDeath() { $('death-msg').classList.add('hidden'); },

  // ---------- créditos ----------
  showCredits() {
    const P = RPG.P;
    $('credits-roll').innerHTML = `<div class="roll-inner">
      <h3>💖 BALAS &amp; BRUXARIA 💖</h3>
      <p>A Relíquia do Coração voltou a bater.<br>Pederneira está em paz — e levemente à prova de balas.</p>
      <h3>HERÓI DA VILA</h3><p>${P.name}, nível ${P.level}<br>${RPG.SKIN_NAMES[RPG.SKINS.indexOf(P.skin)] || ''} · dom ${RPG.GIFTS[P.gift].nome}</p>
      <h3>ELENCO</h3>
      <p>Prefeito Aldo — burocracia heroica<br>Bartolomeu — pólvora e entusiasmo<br>Maga Petúnia — ceticismo arcano<br>
      Taberneira Rosa — ensopado e resgates<br>Guarda Otto — vigilância do portão<br>Nina &amp; Tobias — comentários<br>Fazendeiro Bento — milho pisoteado</p>
      <h3>VILÕES (DERROTADOS)</h3>
      <p>Barão Sanguessuga 🦇<br>Warchefe Gruk 🪓<br>Guardião Cego 👁</p>
      <h3>FEITO COM</h3>
      <p>Three.js · assets Kenney (kenney.nl, CC0)<br>KEPLER ARCADE</p>
      <h3>🎉 OBRIGADO POR JOGAR! 🎉</h3>
      <p>(as masmorras reabriram, se quiser farmar)</p>
    </div>`;
    $('credits').classList.remove('hidden');
    setTimeout(() => $('btn-credits-ok').classList.remove('hidden'), 9000);
  },

  // ---------- estados ----------
  onState(s) {
    $('hud').classList.toggle('hidden', ['title', 'create', 'credits'].includes(s));
    if (s !== 'play') this.setPrompt(null);
    if (INPUT.touchActive) $('touch').classList.toggle('hidden', !['play', 'dialog'].includes(s));
    if (s !== 'dialog' && dlg.open) { dlg.open = false; $('dlg').classList.add('hidden'); }
    if (s !== 'inv') $('inv').classList.add('hidden');
    if (s !== 'qlog') $('qlog').classList.add('hidden');
    if (s !== 'shop') $('shop').classList.add('hidden');
    if (s !== 'pause') $('pause').classList.add('hidden');
  },
};

// ------------------------------------------------------------
// internos
// ------------------------------------------------------------
function stripLen(html) { return html.replace(/<[^>]*>/g, '').length; }

function renderDlgText() {
  const txt = dlg.pages[dlg.page] || '';
  // corta respeitando tags
  let out = '', count = 0, i = 0;
  const limit = Math.floor(dlg.shown);
  while (i < txt.length && count < limit) {
    if (txt[i] === '<') {
      const j = txt.indexOf('>', i);
      out += txt.slice(i, j + 1);
      i = j + 1;
    } else {
      out += txt[i];
      i++; count++;
    }
  }
  // fecha tags abertas (simples)
  const opens = (out.match(/<b>/g) || []).length - (out.match(/<\/b>/g) || []).length;
  if (opens > 0) out += '</b>';
  const opensI = (out.match(/<i>/g) || []).length - (out.match(/<\/i>/g) || []).length;
  if (opensI > 0) out += '</i>';
  $('dlg-text').innerHTML = out;
  if (dlg.done) {
    if (dlg.page < dlg.pages.length - 1 || !dlg.choices) $('dlg-next').classList.remove('hidden');
    else if (dlg.choices && !$('dlg-choices').children.length) renderChoices();
  }
}

function renderChoices() {
  const box = $('dlg-choices');
  box.innerHTML = '';
  dlg.choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'dlg-choice' + (i === dlg.choiceSel ? ' sel' : '');
    b.textContent = c.label;
    b.onclick = e => {
      e.stopPropagation();
      dlg.choiceSel = i;
      UI.pickChoice();
    };
    box.appendChild(b);
  });
  $('dlg-next').classList.add('hidden');
}

function buildSpellbar() {
  const bar = $('spellbar');
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('div');
    el.className = 'spell-slot locked';
    el.id = 'spell-' + i;
    el.style.pointerEvents = 'auto';
    el.innerHTML = `<span class="key">${i + 1}</span><span class="emoji">✦</span><span class="cost"></span><div class="cool"></div>`;
    el.addEventListener('click', () => {
      if (RPG.P && RPG.P.spells[i]) { RPG.P.selSpell = i; UI.refreshHUD(); AudioSys.play('click', 0.4); }
    });
    bar.appendChild(el);
  }
}

function wireButtons() {
  document.querySelectorAll('.panel-close').forEach(el => {
    el.addEventListener('click', () => {
      AudioSys.play('click', 0.5);
      ctx.game.setState('play');
    });
  });
  $('btn-resume').addEventListener('click', () => { AudioSys.play('click', 0.5); ctx.game.setState('play'); });
  $('btn-mute').addEventListener('click', () => {
    const m = AudioSys.toggleMute();
    $('btn-mute').textContent = m ? '🔇 MUDO' : '🔊 SOM';
  });
  $('btn-quit').addEventListener('click', () => { RPG.save(); location.reload(); });
  $('btn-credits-ok').addEventListener('click', () => {
    $('credits').classList.add('hidden');
    ctx.game.setState('play');
  });
  // diálogo: clique avança
  $('dlg').addEventListener('click', () => UI.advanceDialog());
  // poções clicáveis
  $('pot-hp').addEventListener('click', () => RPG.usePotion('vida'));
  $('pot-mp').addEventListener('click', () => RPG.usePotion('mana'));
}
