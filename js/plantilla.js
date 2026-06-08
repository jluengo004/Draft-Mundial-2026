// ─────────────────────────────────────────────────────────
// plantilla.js — tab "Mi Plantilla"
// ─────────────────────────────────────────────────────────
import { savePitchAssignment, loadPitchAssignment, displayName } from './state.js';

// ── Contexto inyectado desde app.js ──
let _ctx = null;

// ── Estado local del módulo ──
let pitchAssignment      = {};  // { user: { slotId: playerId } }
let selectedSquadPlayerId = null;

// ── Definición de slots del campo (4-3-3) ──
const PITCH_SLOTS = [
  { id: 'PO-0', pos: 'PO' },
  { id: 'DF-0', pos: 'DF' }, { id: 'DF-1', pos: 'DF' },
  { id: 'DF-2', pos: 'DF' }, { id: 'DF-3', pos: 'DF' },
  { id: 'MC-0', pos: 'MC' }, { id: 'MC-1', pos: 'MC' }, { id: 'MC-2', pos: 'MC' },
  { id: 'DC-0', pos: 'DC' }, { id: 'DC-1', pos: 'DC' }, { id: 'DC-2', pos: 'DC' },
];

// ─────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────
export function initPlantilla(ctx) {
  _ctx = ctx;
  pitchAssignment[ctx.currentUser] = ctx.pitchData || {};
  _buildUserSelector();
  renderPlantilla(ctx.currentUser);
}

function _buildUserSelector() {
  const sel = document.getElementById('plantilla-user-selector');
  sel.innerHTML = '';
  _ctx.USERS.forEach(u => {
    const btn = document.createElement('button');
    btn.className   = 'user-pill' + (u === _ctx.currentUser ? ' active' : '');
    btn.textContent = displayName(u);
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.user-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _ctx.plantillaViewUser = u;
      selectedSquadPlayerId  = null;
      highlightCompatibleSlots(null);
      if (!pitchAssignment[u]) {
        pitchAssignment[u] = await loadPitchAssignment(u);
      }
      renderPlantilla(u);
    });
    sel.appendChild(btn);
  });
}

// ─────────────────────────────────────────────────────────
// RENDER PRINCIPAL
// ─────────────────────────────────────────────────────────
export function renderPlantilla(user) {
  if (!_ctx) return;
  const { PLAYERS_RAW, state, MAX_PICKS, currentUser } = _ctx;

  const userPicks = state.picks
    .filter(p => p.user === user)
    .map(p => PLAYERS_RAW.find(pl => pl.id === p.playerId))
    .filter(Boolean);

  document.getElementById('plantilla-count').textContent =
    `${userPicks.length} / ${MAX_PICKS} jugadores`;
  document.querySelector('.plantilla-title').textContent =
    user === currentUser ? 'Mi Plantilla' : `Plantilla de ${displayName(user)}`;

  // Validar y limpiar asignaciones obsoletas
  const assignment = pitchAssignment[user] || {};
  const pickIds    = new Set(userPicks.map(p => p.id));
  Object.keys(assignment).forEach(sid => {
    if (!pickIds.has(assignment[sid])) delete assignment[sid];
  });
  pitchAssignment[user] = assignment;

  const assignedIds = new Set(Object.values(assignment));
  const isMe        = user === currentUser;

  _renderPitchSlots(user, userPicks, assignment, assignedIds, isMe, PLAYERS_RAW);
  _renderSquadPanel(user, userPicks, assignment, assignedIds, isMe, PLAYERS_RAW);
}

// ─────────────────────────────────────────────────────────
// CAMPO SVG
// ─────────────────────────────────────────────────────────
function _renderPitchSlots(user, userPicks, assignment, assignedIds, isMe, PLAYERS_RAW) {
  PITCH_SLOTS.forEach(slot => {
    const g = document.getElementById('slot-' + slot.id);
    if (!g) return;

    const playerId = assignment[slot.id];
    const player   = playerId !== undefined
      ? PLAYERS_RAW.find(p => p.id === playerId)
      : null;

    const circleBg = g.querySelector('circle.slot-bg');
    const textPos  = g.querySelector('text.slot-pos');
    const textName = g.querySelector('text.slot-name');
    const textCtry = g.querySelector('text.slot-country');

    if (player) {
      g.classList.remove('empty'); g.classList.add('filled');
      circleBg.setAttribute('stroke-dasharray', 'none');
      circleBg.style.fill = '#12121a';
      textPos.setAttribute('opacity', '0.35');
      const shortName = player.name.split(' ').pop();
      textName.textContent = shortName.length > 9 ? shortName.slice(0, 9) + '…' : shortName;
      textName.setAttribute('opacity', '1');
      textCtry.textContent = player.country.slice(0, 3).toUpperCase();
      textCtry.setAttribute('opacity', '1');
    } else {
      g.classList.remove('filled'); g.classList.add('empty');
      circleBg.setAttribute('stroke-dasharray', '5 3');
      circleBg.style.fill = 'rgba(10,10,20,0.55)';
      textPos.setAttribute('opacity', '1');
      if (textName) { textName.textContent = ''; textName.setAttribute('opacity', '0'); }
      if (textCtry) { textCtry.textContent = ''; textCtry.setAttribute('opacity', '0'); }
    }

    g.onclick      = null;
    g.style.cursor = isMe ? 'pointer' : 'default';
    if (!isMe) return;

    g.onclick = async () => {
      if (selectedSquadPlayerId !== null) {
        const candidate = PLAYERS_RAW.find(p => p.id === selectedSquadPlayerId);
        if (!candidate) return;
        if (candidate.pos !== slot.pos) {
          setHint(`❌ ${candidate.pos} no encaja en posición ${slot.pos}`, 'var(--red)');
          setTimeout(() => setHint(null), 1800);
          return;
        }
        // Quitar de slot anterior si lo hubiera
        Object.keys(assignment).forEach(k => {
          if (assignment[k] === selectedSquadPlayerId) delete assignment[k];
        });
        assignment[slot.id]   = selectedSquadPlayerId;
        pitchAssignment[user] = assignment;
        await savePitchAssignment(user, assignment);
        selectedSquadPlayerId = null;
        highlightCompatibleSlots(null);
        renderPlantilla(user);
      } else if (player) {
        // Quitar del campo
        delete assignment[slot.id];
        pitchAssignment[user] = assignment;
        await savePitchAssignment(user, assignment);
        renderPlantilla(user);
      }
    };
  });
}

// ─────────────────────────────────────────────────────────
// PANEL DE JUGADORES (titulares / suplentes)
// ─────────────────────────────────────────────────────────
function _renderSquadPanel(user, userPicks, assignment, assignedIds, isMe, PLAYERS_RAW) {
  const posOrder  = ['PO', 'DF', 'MC', 'DC'];
  const titulares = userPicks.filter(p => assignedIds.has(p.id));
  const suplentes = userPicks.filter(p => !assignedIds.has(p.id));
  const benchList = document.getElementById('bench-list');
  benchList.innerHTML = '';

  if (userPicks.length === 0) {
    benchList.innerHTML =
      '<div style="font-family:IBM Plex Mono,monospace;font-size:0.7rem;color:var(--muted);padding:8px 0">Aún no tienes jugadores</div>';
    setHint(null);
    return;
  }

  // ── Titulares ──
  const titleT = document.createElement('div');
  titleT.className   = 'squad-section-title';
  titleT.textContent = `Titulares (${titulares.length}/11)`;
  benchList.appendChild(titleT);

  if (titulares.length === 0) {
    benchList.appendChild(_emptyMsg('Ninguno alineado aún'));
  } else {
    [...titulares]
      .sort((a, b) => posOrder.indexOf(a.pos) - posOrder.indexOf(b.pos))
      .forEach(p => benchList.appendChild(_makeCard(p, true, isMe, assignment, user, PLAYERS_RAW)));
  }

  // ── Suplentes ──
  const titleS = document.createElement('div');
  titleS.className   = 'squad-section-title';
  titleS.textContent = `Suplentes (${suplentes.length})`;
  benchList.appendChild(titleS);

  if (suplentes.length === 0) {
    benchList.appendChild(_emptyMsg('Todos en el campo'));
  } else {
    [...suplentes]
      .sort((a, b) => posOrder.indexOf(a.pos) - posOrder.indexOf(b.pos))
      .forEach(p => benchList.appendChild(_makeCard(p, false, isMe, assignment, user, PLAYERS_RAW)));
  }

  // Restaurar highlight si hay jugador seleccionado
  if (selectedSquadPlayerId !== null) {
    const sel = PLAYERS_RAW.find(p => p.id === selectedSquadPlayerId);
    if (sel) highlightCompatibleSlots(sel.pos);
  } else {
    setHint(null);
  }
}

function _makeCard(player, isTitular, isMe, assignment, user, PLAYERS_RAW) {
  const isSelected = selectedSquadPlayerId === player.id;
  const card       = document.createElement('div');
  card.className   = 'bench-card' + (isSelected ? ' selected-card' : '');
  card.innerHTML   =
    `<span class="bench-card-pos ${player.pos}">${player.pos}</span>` +
    `<span class="bench-card-name">${player.name}</span>` +
    `<span class="bench-card-country">${player.country}</span>`;

  if (!isMe) return card;

  card.onclick = async () => {
    if (isTitular) {
      // Quitar del campo → pasa a suplentes
      const slotId = Object.keys(assignment).find(k => assignment[k] === player.id);
      if (slotId) {
        delete assignment[slotId];
        pitchAssignment[user] = assignment;
        await savePitchAssignment(user, assignment);
      }
      selectedSquadPlayerId = null;
      highlightCompatibleSlots(null);
      renderPlantilla(user);
    } else {
      // Seleccionar / deseleccionar para alinear
      if (isSelected) {
        selectedSquadPlayerId = null;
        highlightCompatibleSlots(null);
        setHint(null);
      } else {
        selectedSquadPlayerId = player.id;
        highlightCompatibleSlots(player.pos);
        setHint(
          `Seleccionado: ${player.name} — pulsa un círculo ${player.pos} en el campo`,
          'var(--accent)'
        );
      }
      renderPlantilla(user);
    }
  };
  return card;
}

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────
function highlightCompatibleSlots(pos) {
  PITCH_SLOTS.forEach(slot => {
    const g = document.getElementById('slot-' + slot.id);
    if (!g) return;
    pos && slot.pos === pos
      ? g.classList.add('can-receive')
      : g.classList.remove('can-receive');
  });
}

function setHint(msg, color) {
  const el = document.getElementById('bench-hint');
  if (!el) return;
  if (msg === null) {
    el.textContent = 'Pulsa un suplente para alinearlo · Pulsa un titular para quitarlo';
    el.style.color = 'var(--muted)';
  } else {
    el.textContent = msg;
    el.style.color = color || 'var(--muted)';
  }
}

function _emptyMsg(text) {
  const el = document.createElement('div');
  el.style.cssText =
    'font-family:IBM Plex Mono,monospace;font-size:0.65rem;color:var(--muted);padding:6px 0';
  el.textContent = text;
  return el;
}
