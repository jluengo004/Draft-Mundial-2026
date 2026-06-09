// ─────────────────────────────────────────────────────────
// ranking.js — tab "Ranking"
// ─────────────────────────────────────────────────────────
import { dbListen, dbSet } from './state.js';
import { displayName }     from './state.js';

let _ctx             = null;
let _scores          = {};   // { jornada: { playerId: pts } }
let _unsubScores     = null;
let _activeJornada   = null;
let _activeSection   = 'general';

const ADMIN_USER = 'Jon L';

// ─────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────
export function initRanking(ctx) {
  _ctx = ctx;
  if (_unsubScores) _unsubScores();
  _unsubScores = dbListen('scores', data => {
    _scores = data || {};
    if (document.getElementById('tab-ranking')?.classList.contains('active')) {
      renderRanking();
    }
  });
}

// ─────────────────────────────────────────────────────────
// RENDER PRINCIPAL
// ─────────────────────────────────────────────────────────
export function renderRanking() {
  if (!_ctx) return;
  _renderSubNav();
  if (_activeSection === 'general') _renderGeneral();
  else _renderJornada();
  if (_ctx.currentUser === ADMIN_USER) _renderAdminPanel();
}

// ─────────────────────────────────────────────────────────
// SUB-NAV
// ─────────────────────────────────────────────────────────
function _renderSubNav() {
  const nav = document.getElementById('ranking-subnav');
  if (!nav) return;
  nav.innerHTML = '';
  [['general','Clasificación General'], ['jornada','Por Jornada']].forEach(([sec, label]) => {
    const btn = document.createElement('button');
    btn.className = 'ranking-subnav-btn' + (_activeSection === sec ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => { _activeSection = sec; renderRanking(); });
    nav.appendChild(btn);
  });
}

// ─────────────────────────────────────────────────────────
// CLASIFICACIÓN GENERAL
// ─────────────────────────────────────────────────────────
function _renderGeneral() {
  const { USERS, PLAYERS_RAW, state } = _ctx;
  const container = document.getElementById('ranking-content');
  container.innerHTML = '';

  const totals = USERS.map(user => ({
    user, pts: _calcUserTotal(user, PLAYERS_RAW, state)
  })).sort((a, b) => b.pts - a.pts);

  const noScores = Object.keys(_scores).length === 0;
  if (noScores) {
    const empty = document.createElement('div');
    empty.className = 'ranking-empty';
    empty.textContent = 'Aún no hay puntuaciones registradas. El torneo empieza el 11 de junio.';
    container.appendChild(empty);
    return;
  }

  const table = document.createElement('div');
  table.className = 'ranking-table';
  table.innerHTML = `
    <div class="ranking-header-row">
      <span class="rk-pos">POS</span>
      <span class="rk-user">PARTICIPANTE</span>
      <span class="rk-pts">PTS TOTAL</span>
    </div>`;

  totals.forEach((entry, idx) => {
    const row  = document.createElement('div');
    const isMe = entry.user === _ctx.currentUser;
    row.className = 'ranking-row' + (isMe ? ' ranking-row-me' : '');
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
    row.innerHTML =
      `<span class="rk-pos">${medal}</span>` +
      `<span class="rk-user">${displayName(entry.user)}</span>` +
      `<span class="rk-pts">${entry.pts}</span>`;
    table.appendChild(row);
  });
  container.appendChild(table);
}

// ─────────────────────────────────────────────────────────
// POR JORNADA
// ─────────────────────────────────────────────────────────
function _renderJornada() {
  const container = document.getElementById('ranking-content');
  container.innerHTML = '';

  const jornadas = Object.keys(_scores).map(Number).sort((a, b) => a - b);
  if (jornadas.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'ranking-empty';
    empty.textContent = 'Aún no hay jornadas puntuadas.';
    container.appendChild(empty);
    return;
  }

  if (!_activeJornada || !jornadas.includes(_activeJornada)) {
    _activeJornada = jornadas[jornadas.length - 1];
  }

  // Selector jornadas
  const sel = document.createElement('div');
  sel.className = 'jornada-selector';
  jornadas.forEach(j => {
    const btn = document.createElement('button');
    btn.className = 'jornada-btn' + (j === _activeJornada ? ' active' : '');
    btn.textContent = `J${j}`;
    btn.addEventListener('click', () => { _activeJornada = j; _renderJornada(); });
    sel.appendChild(btn);
  });
  container.appendChild(sel);

  const jornadaScores = _scores[_activeJornada] || {};
  const { USERS, PLAYERS_RAW, state } = _ctx;

  const userResults = USERS.map(user => {
    const { pts, players } = _calcUserJornada(user, _activeJornada, PLAYERS_RAW, state);
    return { user, pts, players };
  }).sort((a, b) => b.pts - a.pts);

  userResults.forEach((entry, idx) => {
    const isMe  = entry.user === _ctx.currentUser;
    const block = document.createElement('div');
    block.className = 'jornada-user-block' + (isMe ? ' jornada-block-me' : '');

    const header = document.createElement('div');
    header.className = 'jornada-user-header';
    header.innerHTML =
      `<span class="jornada-pos">${idx + 1}º</span>` +
      `<span class="jornada-username">${displayName(entry.user)}</span>` +
      `<span class="jornada-total-pts">${entry.pts} pts</span>` +
      `<span class="jornada-chevron">▾</span>`;

    const detail = document.createElement('div');
    detail.className = 'jornada-detail';
    let open = isMe;
    detail.style.display = open ? 'block' : 'none';

    if (entry.players.length === 0) {
      detail.innerHTML = '<div class="jornada-no-alineacion">Sin alineación registrada esta jornada</div>';
    } else {
      entry.players.forEach(p => {
        const ppts = jornadaScores[p.id];
        const prow = document.createElement('div');
        prow.className = 'jornada-player-row';
        prow.innerHTML =
          `<span class="jornada-player-pos ${p.pos}">${p.pos}</span>` +
          `<span class="jornada-player-name">${p.name}</span>` +
          `<span class="jornada-player-country">${p.country}</span>` +
          `<span class="jornada-player-pts ${typeof ppts === 'number' ? (ppts > 0 ? 'pts-pos' : ppts < 0 ? 'pts-neg' : '') : 'pts-none'}">${typeof ppts === 'number' ? ppts : '—'}</span>`;
        detail.appendChild(prow);
      });
    }

    header.style.cursor = 'pointer';
    header.addEventListener('click', () => {
      open = !open;
      detail.style.display = open ? 'block' : 'none';
      header.querySelector('.jornada-chevron').style.transform = open ? 'rotate(180deg)' : '';
    });

    block.appendChild(header);
    block.appendChild(detail);
    container.appendChild(block);
  });
}

// ─────────────────────────────────────────────────────────
// ADMIN PANEL (solo Jon Luengo)
// ─────────────────────────────────────────────────────────
function _renderAdminPanel() {
  let panel = document.getElementById('ranking-admin-panel');
  if (panel) return; // ya renderizado, no duplicar

  panel = document.createElement('div');
  panel.id = 'ranking-admin-panel';
  panel.className = 'admin-panel';
  document.getElementById('tab-ranking').appendChild(panel);

  panel.innerHTML = `
    <div class="admin-title">⚙ INTRODUCIR PUNTUACIONES</div>
    <div class="admin-hint">Un jugador por línea: <code>Apellido Nombre = pts</code> (o parte del nombre)</div>
    <div class="admin-row">
      <label class="admin-label">JORNADA</label>
      <input type="number" id="admin-jornada" class="admin-input" min="1" max="64" placeholder="1">
    </div>
    <textarea id="admin-scores-input" class="admin-textarea"
      placeholder="Mbappe Kylian = 12&#10;Neuer Manuel = 8&#10;Pedri = 6&#10;Yamal Lamine = -2"></textarea>
    <div class="admin-actions">
      <button id="admin-preview-btn" class="btn-secondary">PREVISUALIZAR</button>
      <button id="admin-save-btn" class="btn-danger">GUARDAR EN DB</button>
    </div>
    <div id="admin-preview" class="admin-preview"></div>
  `;

  document.getElementById('admin-preview-btn').addEventListener('click', _previewScores);
  document.getElementById('admin-save-btn').addEventListener('click', _saveScores);
}

function _parseInput() {
  const { PLAYERS_RAW } = _ctx;
  const jornada = parseInt(document.getElementById('admin-jornada').value);
  if (!jornada || jornada < 1) return { error: 'Introduce un número de jornada válido' };

  const lines   = document.getElementById('admin-scores-input').value
    .split('\n').map(l => l.trim()).filter(Boolean);
  const results = [];
  const errors  = [];

  lines.forEach(line => {
    const match = line.match(/^(.+?)\s*=\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) { errors.push(`Formato inválido: "${line}"`); return; }
    const namePart = match[1].trim().toLowerCase();
    const pts      = parseFloat(match[2]);
    // Buscar por coincidencia: nombre completo, o apellido, o parte del nombre
    const player = PLAYERS_RAW.find(p => {
      const n = p.name.toLowerCase();
      return n === namePart || n.startsWith(namePart) || namePart.split(' ').every(w => n.includes(w));
    });
    if (!player) errors.push(`No encontrado: "${match[1].trim()}"`);
    else         results.push({ player, pts });
  });

  return { jornada, results, errors };
}

function _previewScores() {
  const { jornada, results, errors, error } = _parseInput();
  const preview = document.getElementById('admin-preview');
  if (!preview) return;
  if (error) { preview.innerHTML = `<div class="admin-errors">⚠ ${error}</div>`; return; }

  let html = '';
  if (errors.length)  html += `<div class="admin-errors">${errors.map(e => `⚠ ${e}`).join('<br>')}</div>`;
  if (results.length) {
    html += `<div class="admin-preview-title">Jornada ${jornada} — ${results.length} jugador(es)</div>`;
    results.forEach(r => {
      html +=
        `<div class="admin-preview-row">` +
        `<span class="jornada-player-pos ${r.player.pos}">${r.player.pos}</span> ` +
        `<strong>${r.player.name}</strong> ` +
        `<span style="color:var(--muted);font-size:0.75rem">${r.player.country}</span> → ` +
        `<span class="${r.pts > 0 ? 'pts-pos' : r.pts < 0 ? 'pts-neg' : ''}">${r.pts} pts</span>` +
        `</div>`;
    });
  }
  preview.innerHTML = html || '<div style="color:var(--muted);font-size:0.75rem">Sin resultados</div>';
}

async function _saveScores() {
  const { jornada, results, errors, error } = _parseInput();
  if (error) { _previewScores(); return; }
  if (errors.length) { _previewScores(); return; }
  if (!results.length) return;

  const jornadaData = {};
  results.forEach(r => { jornadaData[r.player.id] = r.pts; });
  await dbSet(`scores/${jornada}`, jornadaData);

  _ctx.showToast(`✓ Jornada ${jornada} — ${results.length} jugadores guardados`, 'success');
  document.getElementById('admin-scores-input').value = '';
  document.getElementById('admin-preview').innerHTML  = '';
}

// ─────────────────────────────────────────────────────────
// CÁLCULOS
// ─────────────────────────────────────────────────────────
function _calcUserTotal(user, PLAYERS_RAW, state) {
  return Object.keys(_scores).reduce((sum, j) => {
    return sum + _calcUserJornada(user, Number(j), PLAYERS_RAW, state).pts;
  }, 0);
}

function _calcUserJornada(user, jornada, PLAYERS_RAW, state) {
  const jornadaScores = _scores[jornada] || {};
  const userPicks = state.picks
    .filter(p => p.user === user)
    .map(p => PLAYERS_RAW.find(pl => pl.id === p.playerId))
    .filter(Boolean);

  if (!userPicks.length) return { pts: 0, players: [] };

  // Titulares de ese usuario desde pitchAssignments
  const assignment  = _ctx.pitchAssignments?.[user] || {};
  const assignedIds = new Set(Object.values(assignment));
  const titulares   = userPicks.filter(p => assignedIds.has(p.id));

  // Fallback: si no tiene alineación guardada, usar todos sus picks
  const activePlayers = titulares.length > 0 ? titulares : userPicks;

  const pts = activePlayers.reduce((sum, p) => {
    const score = jornadaScores[p.id];
    return sum + (typeof score === 'number' ? score : 0);
  }, 0);

  return { pts, players: activePlayers };
}
