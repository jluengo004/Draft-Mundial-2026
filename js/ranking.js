// ─────────────────────────────────────────────────────────
// ranking.js — tab "Ranking"
// ─────────────────────────────────────────────────────────
import { dbListen, dbSet, loadSnapshot, dbGet } from './state.js';
import { displayName } from './state.js';
import { JORNADAS }    from '../data/jornadas.js';

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

  // Precargar snapshots para todas las jornadas con scores
  const jornadasConScores = Object.keys(_scores).map(Number);
  const allCached = jornadasConScores.every(j =>
    USERS.every(u => _snapshotCache[`${j}:${u}`] !== undefined)
  );
  if (!allCached && jornadasConScores.length > 0) {
    Promise.all(
      jornadasConScores.flatMap(j => USERS.map(u => _getSnapshot(j, u)))
    ).then(() => {
      if (document.getElementById('tab-ranking')?.classList.contains('active')) renderRanking();
    });
  }

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
      <span></span>
    </div>`;

  const jornadasOrdenadas = Object.keys(_scores).map(Number).sort((a, b) => a - b);

  totals.forEach((entry, idx) => {
    const isMe  = entry.user === _ctx.currentUser;
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;

    // ── Bloque expandible ──
    const block = document.createElement('div');
    block.className = 'jornada-user-block' + (isMe ? ' jornada-block-me' : '');

    // Header clickable (mismo estilo que _renderJornada)
    const header = document.createElement('div');
    header.className = 'jornada-user-header';
    header.style.cursor = 'pointer';
    header.innerHTML =
      `<span class="jornada-pos">${medal}</span>` +
      `<span class="jornada-username">${displayName(entry.user)}</span>` +
      `<span class="jornada-total-pts">${entry.pts} pts</span>` +
      `<span class="jornada-chevron">▾</span>`;

    // ── Panel de detalle: todos los jugadores con puntos totales ──
    const detail = document.createElement('div');
    detail.className = 'jornada-detail';
    let open = isMe;
    detail.style.display = open ? 'block' : 'none';

    // Picks del usuario
    const userPicks = state.picks
      .filter(p => p.user === entry.user)
      .map(p => PLAYERS_RAW.find(pl => pl.id === p.playerId))
      .filter(Boolean);

    if (userPicks.length === 0) {
      detail.innerHTML = '<div class="jornada-no-alineacion">Sin jugadores fichados</div>';
    } else {
      // Calcular puntos totales por jugador sumando todas las jornadas
      const posOrder = ['PO', 'DF', 'MC', 'DC'];
      const playersWithTotals = userPicks.map(p => {
        const total = jornadasOrdenadas.reduce((sum, j) => {
          const s = (_scores[j] || {})[p.id];
          return sum + (typeof s === 'number' ? s : 0);
        }, 0);
        return { ...p, total };
      }).sort((a, b) => b.total - a.total || posOrder.indexOf(a.pos) - posOrder.indexOf(b.pos));

      playersWithTotals.forEach(p => {
        const prow = document.createElement('div');
        prow.className = 'jornada-player-row';
        prow.innerHTML =
          `<span class="jornada-player-pos ${p.pos}">${p.pos}</span>` +
          `<span class="jornada-player-name">${p.name}</span>` +
          `<span class="jornada-player-country">${p.country}</span>` +
          `<span class="jornada-player-pts ${p.total > 0 ? 'pts-pos' : p.total < 0 ? 'pts-neg' : ''}">${p.total}</span>`;
        detail.appendChild(prow);
      });
    }

    header.addEventListener('click', () => {
      open = !open;
      detail.style.display = open ? 'block' : 'none';
      header.querySelector('.jornada-chevron').style.transform = open ? 'rotate(180deg)' : '';
    });

    block.appendChild(header);
    block.appendChild(detail);
    table.appendChild(block);
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

  // Precargar snapshots async y re-render cuando estén listos
  const needsLoad = USERS.some(u => _snapshotCache[`${_activeJornada}:${u}`] === undefined);
  if (needsLoad) {
    Promise.all(USERS.map(u => _getSnapshot(_activeJornada, u))).then(() => {
      if (document.getElementById('tab-ranking')?.classList.contains('active')) renderRanking();
    });
  }

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
    <div class="admin-row">
      <label class="admin-label">JORNADA</label>
      <select id="admin-jornada" class="admin-input" style="min-width:240px">
        <option value="">— Selecciona jornada —</option>
        ${_jornadaOptions()}
      </select>
      <button id="admin-load-btn" class="btn-secondary" style="font-size:0.65rem;padding:6px 14px;letter-spacing:1px">CARGAR ALINEADOS</button>
    </div>
    <div class="admin-hint">Formato: <code>Nombre Apellido = pts</code> · Edita solo los puntos</div>
    <div class="admin-row" id="admin-filter-row" style="display:none">
      <label class="admin-label">FILTRAR PAÍS</label>
      <input type="text" id="admin-country-filter" class="admin-input"
        placeholder="Ej: España, Francia..." style="flex:1" autocomplete="off">
      <button id="admin-filter-clear" class="btn-secondary"
        style="font-size:0.65rem;padding:6px 10px;letter-spacing:0">✕ Limpiar</button>
    </div>
    <textarea id="admin-scores-input" class="admin-textarea"></textarea>
    <div class="admin-actions">
      <button id="admin-preview-btn" class="btn-secondary">PREVISUALIZAR</button>
      <button id="admin-save-btn" class="btn-danger">GUARDAR EN DB</button>
    </div>
    <div id="admin-preview" class="admin-preview"></div>
  `;

  document.getElementById('admin-load-btn').addEventListener('click', _loadAlineados);
  document.getElementById('admin-preview-btn').addEventListener('click', _previewScores);
  document.getElementById('admin-save-btn').addEventListener('click', _saveScores);
  document.getElementById('admin-country-filter').addEventListener('input', _applyCountryFilter);
  document.getElementById('admin-filter-clear').addEventListener('click', () => {
    document.getElementById('admin-country-filter').value = '';
    _applyCountryFilter();
  });
}

function _jornadaOptions() {
  return JORNADAS.map(j => {
    const bloqueada = new Date(j.bloqueo) <= new Date();
    return `<option value="${j.id}">${j.id}. ${j.nombre}${bloqueada ? ' 🔒' : ''}</option>`;
  }).join('');
}

function _parseInput() {
  const { PLAYERS_RAW } = _ctx;
  const jornada = parseInt(document.getElementById('admin-jornada').value);
  if (!jornada || jornada < 1) return { error: 'Selecciona una jornada' };

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


/** Rellena el textarea con todos los jugadores alineados (sin duplicados).
 *  Si la jornada está bloqueada usa el snapshot; si no, usa la alineación actual. */
async function _loadAlineados() {
  const { USERS, PLAYERS_RAW, state } = _ctx;
  const jornadaId = parseInt(document.getElementById('admin-jornada').value);
  if (!jornadaId) {
    document.getElementById('admin-preview').innerHTML =
      '<div class="admin-errors">⚠ Selecciona primero una jornada</div>';
    return;
  }

  const jornadaDef  = JORNADAS.find(j => j.id === jornadaId);
  const esBloqueada = jornadaDef && new Date(jornadaDef.bloqueo) <= new Date();

  const seen    = new Set();
  const players = [];

  for (const user of USERS) {
    let assignment = {};
    if (esBloqueada) {
      assignment = await _getSnapshot(jornadaId, user);
    } else {
      assignment = _ctx.pitchAssignments?.[user] || {};
    }
    const assignedIds = new Set(Object.values(assignment));
    const userPicks   = state.picks
      .filter(p => p.user === user)
      .map(p => PLAYERS_RAW.find(pl => pl.id === p.playerId))
      .filter(Boolean);
    userPicks.filter(p => assignedIds.has(p.id)).forEach(p => {
      if (!seen.has(p.id)) { seen.add(p.id); players.push(p); }
    });
  }

  if (players.length === 0) {
    document.getElementById('admin-preview').innerHTML =
      '<div class="admin-errors">⚠ Ningún usuario tiene jugadores alineados' +
      (esBloqueada ? ' (snapshot vacío para esta jornada)' : ' aún') + '</div>';
    return;
  }

  players.sort((a, b) => {
    if (a.country < b.country) return -1;
    if (a.country > b.country) return  1;
    // Dentro del mismo país, orden por posición
    const posOrder = ['PO', 'DF', 'MC', 'DC'];
    return posOrder.indexOf(a.pos) - posOrder.indexOf(b.pos);
  });

  const existing = _scores[jornadaId] || {};
  const lines = players.map(p =>
    `${p.name} = ${existing[p.id] !== undefined ? existing[p.id] : 0}`
  );

  // Guardar cache para filtrado
  _allLoadedLines = players.map((p, i) => ({ name: p.name, country: p.country, line: lines[i] }));

  document.getElementById('admin-scores-input').value = lines.join('\n');
  document.getElementById('admin-preview').innerHTML =
    `<div style="color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:0.65rem">` +
    `${players.length} jugadores cargados${esBloqueada ? ' desde snapshot 🔒' : ' (alineación actual)'}</div>`;

  // Mostrar filtro
  const filterRow = document.getElementById('admin-filter-row');
  if (filterRow) {
    filterRow.style.display = 'flex';
    document.getElementById('admin-country-filter').value = '';
  }
}

/** Guarda puntuaciones editadas actualmente en el textarea de vuelta al cache */
function _syncEditsToCachee() {
  const textarea = document.getElementById('admin-scores-input');
  if (!textarea) return;
  textarea.value.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    const match = line.match(/^(.+?)\s*=\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) return;
    const nameLower = match[1].trim().toLowerCase();
    const entry = _allLoadedLines.find(e => e.name.toLowerCase() === nameLower);
    if (entry) entry.line = line;
  });
}

/** Filtra el textarea por país sin perder puntuaciones ya editadas */
function _applyCountryFilter() {
  const filter   = (document.getElementById('admin-country-filter')?.value || '').toLowerCase().trim();
  const textarea = document.getElementById('admin-scores-input');
  if (!textarea || !_allLoadedLines.length) return;

  // Sincronizar ediciones actuales al cache antes de filtrar
  _syncEditsToCachee();

  const filtered = filter
    ? _allLoadedLines.filter(e => e.country.toLowerCase().includes(filter))
    : _allLoadedLines;

  textarea.value = filtered.map(e => e.line).join('\n');
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

// Cache de snapshots cargados para no hacer múltiples peticiones DB
const _snapshotCache = {};
let _allLoadedLines = []; // [{name, country, line}] — para filtrado por país

async function _getSnapshot(jornadaId, user) {
  const key = `${jornadaId}:${user}`;
  if (_snapshotCache[key] !== undefined) return _snapshotCache[key];
  const snap = await loadSnapshot(jornadaId, user);
  _snapshotCache[key] = snap || {};
  return _snapshotCache[key];
}

function _calcUserJornadaSync(user, jornada, PLAYERS_RAW, state, snapshotAssignment) {
  const jornadaScores = _scores[jornada] || {};
  const userPicks = state.picks
    .filter(p => p.user === user)
    .map(p => PLAYERS_RAW.find(pl => pl.id === p.playerId))
    .filter(Boolean);

  if (!userPicks.length) return { pts: 0, players: [] };

  // Usar snapshot si existe, si no usar alineación actual como fallback
  const assignment  = snapshotAssignment || _ctx.pitchAssignments?.[user] || {};
  const assignedIds = new Set(Object.values(assignment));
  const titulares   = userPicks.filter(p => assignedIds.has(p.id));
  const activePlayers = titulares.length > 0 ? titulares : userPicks;

  const pts = activePlayers.reduce((sum, p) => {
    const score = jornadaScores[p.id];
    return sum + (typeof score === 'number' ? score : 0);
  }, 0);

  return { pts, players: activePlayers };
}

// Versión async que carga el snapshot de DB
async function _calcUserJornadaAsync(user, jornada, PLAYERS_RAW, state) {
  const snap = await _getSnapshot(jornada, user);
  return _calcUserJornadaSync(user, jornada, PLAYERS_RAW, state, snap);
}

// Versión sync (usa cache si ya está cargado, si no usa alineación actual)
function _calcUserJornada(user, jornada, PLAYERS_RAW, state) {
  const key  = `${jornada}:${user}`;
  const snap = _snapshotCache[key]; // puede ser undefined si no se ha cargado aún
  return _calcUserJornadaSync(user, jornada, PLAYERS_RAW, state, snap);
}
