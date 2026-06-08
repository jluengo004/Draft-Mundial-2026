// ─────────────────────────────────────────────────────────
// ranking.js — tab "Ranking"
// ─────────────────────────────────────────────────────────
import { dbListen, dbSet, dbGet } from './firebase.js';
import { displayName } from './state.js';

// ── Contexto inyectado desde app.js ──
let _ctx        = null;
let _scores     = {};   // { jornada: { playerId: pts } }
let _unsubScores = null;
let _activeJornada = null;
let _activeSection = 'general'; // 'general' | 'jornada'

const ADMIN_USER = 'Jon Luengo'; // único que ve el panel de admin

// ─────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────
export function initRanking(ctx) {
  _ctx = ctx;
  _subscribeScores();
}

function _subscribeScores() {
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
// SUB-NAV (General / Por Jornada)
// ─────────────────────────────────────────────────────────
function _renderSubNav() {
  const nav = document.getElementById('ranking-subnav');
  if (!nav) return;
  nav.innerHTML = '';

  ['general', 'jornada'].forEach(sec => {
    const btn = document.createElement('button');
    btn.className = 'ranking-subnav-btn' + (_activeSection === sec ? ' active' : '');
    btn.textContent = sec === 'general' ? 'Clasificación General' : 'Por Jornada';
    btn.addEventListener('click', () => {
      _activeSection = sec;
      renderRanking();
    });
    nav.appendChild(btn);
  });
}

// ─────────────────────────────────────────────────────────
// SECCIÓN GENERAL
// ─────────────────────────────────────────────────────────
function _renderGeneral() {
  const { USERS, PLAYERS_RAW, state } = _ctx;
  const container = document.getElementById('ranking-content');
  container.innerHTML = '';

  // Calcular puntos totales por usuario
  const totals = USERS.map(user => {
    const pts = _calcUserTotal(user, PLAYERS_RAW, state);
    return { user, pts };
  }).sort((a, b) => b.pts - a.pts);

  const table = document.createElement('div');
  table.className = 'ranking-table';

  // Header
  table.innerHTML = `
    <div class="ranking-header-row">
      <span class="rk-pos">POS</span>
      <span class="rk-user">PARTICIPANTE</span>
      <span class="rk-pts">PTS</span>
      <span class="rk-jornadas">JORNADAS</span>
    </div>
  `;

  const jornadas = Object.keys(_scores).length;

  totals.forEach((entry, idx) => {
    const row = document.createElement('div');
    const isMe = entry.user === _ctx.currentUser;
    row.className = 'ranking-row' + (isMe ? ' ranking-row-me' : '');

    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;

    row.innerHTML =
      `<span class="rk-pos">${medal}</span>` +
      `<span class="rk-user">${displayName(entry.user)}</span>` +
      `<span class="rk-pts">${entry.pts}</span>` +
      `<span class="rk-jornadas">${jornadas} jornadas</span>`;
    table.appendChild(row);
  });

  if (totals.every(e => e.pts === 0)) {
    const empty = document.createElement('div');
    empty.className = 'ranking-empty';
    empty.textContent = 'Aún no hay puntuaciones registradas';
    container.appendChild(empty);
  }

  container.appendChild(table);
}

// ─────────────────────────────────────────────────────────
// SECCIÓN POR JORNADA
// ─────────────────────────────────────────────────────────
function _renderJornada() {
  const container = document.getElementById('ranking-content');
  container.innerHTML = '';

  const jornadas = Object.keys(_scores).map(Number).sort((a, b) => a - b);

  if (jornadas.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'ranking-empty';
    empty.textContent = 'Aún no hay puntuaciones por jornada';
    container.appendChild(empty);
    return;
  }

  if (!_activeJornada || !jornadas.includes(_activeJornada)) {
    _activeJornada = jornadas[jornadas.length - 1];
  }

  // Selector de jornada
  const jornadaSelector = document.createElement('div');
  jornadaSelector.className = 'jornada-selector';
  jornadas.forEach(j => {
    const btn = document.createElement('button');
    btn.className = 'jornada-btn' + (j === _activeJornada ? ' active' : '');
    btn.textContent = `J${j}`;
    btn.addEventListener('click', () => { _activeJornada = j; _renderJornada(); });
    jornadaSelector.appendChild(btn);
  });
  container.appendChild(jornadaSelector);

  // Resultados de esta jornada
  const jornadaScores = _scores[_activeJornada] || {};
  const { USERS, PLAYERS_RAW, state } = _ctx;

  const userResults = USERS.map(user => {
    const { pts, players } = _calcUserJornada(user, _activeJornada, PLAYERS_RAW, state);
    return { user, pts, players };
  }).sort((a, b) => b.pts - a.pts);

  userResults.forEach((entry, idx) => {
    const block = document.createElement('div');
    const isMe  = entry.user === _ctx.currentUser;
    block.className = 'jornada-user-block' + (isMe ? ' jornada-block-me' : '');

    const header = document.createElement('div');
    header.className = 'jornada-user-header';
    header.innerHTML =
      `<span class="jornada-pos">${idx + 1}º</span>` +
      `<span class="jornada-username">${displayName(entry.user)}</span>` +
      `<span class="jornada-total-pts">${entry.pts} pts</span>`;

    // Toggle detail
    const detail = document.createElement('div');
    detail.className = 'jornada-detail';
    detail.style.display = 'none';

    if (entry.players.length === 0) {
      detail.innerHTML = '<div class="jornada-no-alineacion">Sin alineación registrada</div>';
    } else {
      entry.players.forEach(p => {
        const prow = document.createElement('div');
        prow.className = 'jornada-player-row';
        const ppts = jornadaScores[p.id] ?? '—';
        prow.innerHTML =
          `<span class="jornada-player-pos ${p.pos}">${p.pos}</span>` +
          `<span class="jornada-player-name">${p.name}</span>` +
          `<span class="jornada-player-country">${p.country}</span>` +
          `<span class="jornada-player-pts ${typeof ppts === 'number' && ppts > 0 ? 'pts-pos' : ppts < 0 ? 'pts-neg' : ''}">${ppts}</span>`;
        detail.appendChild(prow);
      });
    }

    header.style.cursor = 'pointer';
    let open = isMe; // expandir el propio por defecto
    detail.style.display = open ? 'block' : 'none';
    header.addEventListener('click', () => {
      open = !open;
      detail.style.display = open ? 'block' : 'none';
    });

    block.appendChild(header);
    block.appendChild(detail);
    container.appendChild(block);
  });
}

// ─────────────────────────────────────────────────────────
// PANEL ADMIN (solo Jon)
// ─────────────────────────────────────────────────────────
function _renderAdminPanel() {
  let panel = document.getElementById('ranking-admin-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'ranking-admin-panel';
    panel.className = 'admin-panel';
    document.getElementById('tab-ranking').appendChild(panel);
  }

  panel.innerHTML = `
    <div class="admin-title">⚙ INTRODUCIR PUNTUACIONES</div>
    <div class="admin-row">
      <label class="admin-label">Jornada</label>
      <input type="number" id="admin-jornada" class="admin-input" min="1" max="64" placeholder="Nº jornada" style="width:80px">
    </div>
    <div class="admin-label" style="margin-bottom:8px">Puntuaciones (un jugador por línea: <em>Nombre Apellido = pts</em>)</div>
    <textarea id="admin-scores-input" class="admin-textarea"
      placeholder="Mbappe Kylian = 12&#10;Neuer Manuel = 8&#10;Pedri = -2"></textarea>
    <div style="display:flex;gap:10px;margin-top:12px">
      <button id="admin-preview-btn" class="btn-secondary" style="flex:1">PREVISUALIZAR</button>
      <button id="admin-save-btn" class="btn-danger" style="flex:1">GUARDAR EN DB</button>
    </div>
    <div id="admin-preview" class="admin-preview"></div>
  `;

  document.getElementById('admin-preview-btn').addEventListener('click', _previewScores);
  document.getElementById('admin-save-btn').addEventListener('click', _saveScores);
}

function _parseAdminInput() {
  const { PLAYERS_RAW } = _ctx;
  const raw = document.getElementById('admin-scores-input').value;
  const jornada = parseInt(document.getElementById('admin-jornada').value);
  if (!jornada) return { error: 'Introduce un número de jornada' };

  const lines = raw.split('\n').filter(l => l.trim());
  const results = [];
  const errors  = [];

  lines.forEach(line => {
    const match = line.match(/^(.+?)\s*=\s*(-?\d+(\.\d+)?)\s*$/);
    if (!match) { errors.push(`Línea inválida: "${line}"`); return; }
    const namePart = match[1].trim().toLowerCase();
    const pts      = parseFloat(match[2]);
    const player   = PLAYERS_RAW.find(p =>
      p.name.toLowerCase() === namePart ||
      p.name.toLowerCase().includes(namePart) ||
      namePart.includes(p.name.toLowerCase().split(' ')[0])
    );
    if (!player) {
      errors.push(`Jugador no encontrado: "${match[1].trim()}"`);
    } else {
      results.push({ player, pts });
    }
  });

  return { jornada, results, errors };
}

function _previewScores() {
  const { jornada, results, errors } = _parseAdminInput();
  const preview = document.getElementById('admin-preview');
  if (!preview) return;

  let html = '';
  if (errors?.length) {
    html += `<div class="admin-errors">${errors.map(e => `⚠ ${e}`).join('<br>')}</div>`;
  }
  if (results?.length) {
    html += `<div class="admin-preview-title">Jornada ${jornada} — ${results.length} jugadores</div>`;
    results.forEach(r => {
      html += `<div class="admin-preview-row">` +
        `<span class="jornada-player-pos ${r.player.pos}">${r.player.pos}</span> ` +
        `<strong>${r.player.name}</strong> <span style="color:var(--muted)">${r.player.country}</span>` +
        ` → <span class="${r.pts > 0 ? 'pts-pos' : r.pts < 0 ? 'pts-neg' : ''}">${r.pts} pts</span>` +
        `</div>`;
    });
  }
  preview.innerHTML = html || '<div style="color:var(--muted)">Sin resultados</div>';
}

async function _saveScores() {
  const { jornada, results, errors } = _parseAdminInput();
  if (errors?.length) { _previewScores(); return; }
  if (!results?.length) return;

  const jornadaData = {};
  results.forEach(r => { jornadaData[r.player.id] = r.pts; });

  await dbSet(`scores/${jornada}`, jornadaData);
  _ctx.showToast(`✓ Jornada ${jornada} guardada — ${results.length} jugadores`, 'success');

  const preview = document.getElementById('admin-preview');
  if (preview) preview.innerHTML = '';
  document.getElementById('admin-scores-input').value = '';
}

// ─────────────────────────────────────────────────────────
// CÁLCULOS
// ─────────────────────────────────────────────────────────

/** Puntos totales de un usuario: suma de todos los titulares en todas las jornadas */
function _calcUserTotal(user, PLAYERS_RAW, state) {
  let total = 0;
  Object.entries(_scores).forEach(([jornada, jornadaScores]) => {
    const { pts } = _calcUserJornada(user, Number(jornada), PLAYERS_RAW, state);
    total += pts;
  });
  return total;
}

/** Puntos de un usuario en una jornada concreta */
function _calcUserJornada(user, jornada, PLAYERS_RAW, state) {
  const jornadaScores = _scores[jornada] || {};

  // Picks del usuario
  const userPicks = state.picks
    .filter(p => p.user === user)
    .map(p => PLAYERS_RAW.find(pl => pl.id === p.playerId))
    .filter(Boolean);

  if (userPicks.length === 0) return { pts: 0, players: [] };

  // Obtener alineación del usuario (titulares) desde Firebase ya cargado
  // Usamos _ctx.pitchAssignments que app.js debe pasar
  const assignment = _ctx.pitchAssignments?.[user] || {};
  const assignedIds = new Set(Object.values(assignment));

  // Titulares = jugadores asignados al campo
  const titulares = userPicks.filter(p => assignedIds.has(p.id));

  // Si no hay alineación guardada, usar todos los picks (fallback)
  const activePlayers = titulares.length > 0 ? titulares : userPicks;

  let pts = 0;
  activePlayers.forEach(p => {
    const score = jornadaScores[p.id];
    if (typeof score === 'number') pts += score;
  });

  return { pts, players: activePlayers };
}
