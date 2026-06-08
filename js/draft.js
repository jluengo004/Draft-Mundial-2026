// ─────────────────────────────────────────────────────────
// draft.js — tab "Draft"
// ─────────────────────────────────────────────────────────
import { submitPick, displayName } from './state.js';

// ── Contexto inyectado desde app.js ──
let _ctx = null;

// ── Estado local del módulo ──
let posFilter    = 'ALL';
let pendingPlayer = null;

// ─────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────
export function initDraft(ctx) {
  _ctx = ctx;
  _wireEvents();
  renderDraft();
}

function _wireEvents() {
  // Filtros de posición
  document.querySelectorAll('.filter-pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pos-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      posFilter = btn.dataset.pos;
      renderDraftPlayerList();
    });
  });

  // Búsqueda
  document.getElementById('search-input')
    .addEventListener('input', () => renderDraftPlayerList());

  // Modal
  document.getElementById('btn-cancel-modal')
    .addEventListener('click', closeModal);
  document.getElementById('btn-confirm-pick')
    .addEventListener('click', confirmPick);
}

// ─────────────────────────────────────────────────────────
// RENDER COMPLETO
// ─────────────────────────────────────────────────────────
export function renderDraft() {
  if (!_ctx) return;
  renderDraftStatusBar();
  renderDraftOrderRow();
  renderDraftPlayerList();
  renderDraftPicks();
}

// ─────────────────────────────────────────────────────────
// BARRA DE ESTADO
// ─────────────────────────────────────────────────────────
function renderDraftStatusBar() {
  const { state, USERS, currentUser } = _ctx;
  const turn            = state.currentTurn;
  const total           = state.draftOrder.length;
  const isDone          = turn >= total;
  const currentPickUser = isDone ? null : state.draftOrder[turn];
  const round           = isDone ? _ctx.MAX_PICKS : Math.floor(turn / USERS.length) + 1;
  const myPicks         = state.picks.filter(p => p.user === currentUser).length;

  document.getElementById('ds-turn-num').textContent    = isDone ? total : turn + 1;
  document.getElementById('ds-round').textContent       = round;
  document.getElementById('ds-current-user').textContent =
    currentPickUser ? displayName(currentPickUser) : '—';
  document.getElementById('ds-my-picks').textContent    = myPicks;

  const ind = document.getElementById('draft-turn-indicator');
  if (isDone) {
    ind.textContent = 'DRAFT COMPLETO';
    ind.className   = 'draft-turn-indicator done';
    document.getElementById('draft-complete-banner').classList.add('show');
  } else if (currentPickUser === currentUser) {
    ind.textContent = 'TU TURNO';
    ind.className   = 'draft-turn-indicator my-turn';
  } else {
    ind.textContent = 'ESPERANDO';
    ind.className   = 'draft-turn-indicator other-turn';
  }
}

// ─────────────────────────────────────────────────────────
// ORDEN DEL DRAFT
// ─────────────────────────────────────────────────────────
function renderDraftOrderRow() {
  const { state } = _ctx;
  const row   = document.getElementById('draft-order-row');
  row.innerHTML = '';
  const turn  = state.currentTurn;
  const total = state.draftOrder.length;
  const start = Math.max(0, turn - 3);
  const end   = Math.min(total, turn + 16);
  for (let i = start; i < end; i++) {
    const chip = document.createElement('div');
    chip.className =
      'draft-order-chip' +
      (i === turn ? ' current'   : '') +
      (i <  turn ? ' done-chip' : '');
    chip.textContent = `#${i + 1} ${displayName(state.draftOrder[i])}`;
    row.appendChild(chip);
  }
}

// ─────────────────────────────────────────────────────────
// HISTORIAL DE PICKS
// ─────────────────────────────────────────────────────────
function renderDraftPicks() {
  const { state, PLAYERS_RAW } = _ctx;
  const list = document.getElementById('draft-picks-list');
  list.innerHTML = '';
  const reversed = [...state.picks].reverse();

  if (reversed.length === 0) {
    list.innerHTML =
      '<div style="font-family:IBM Plex Mono,monospace;font-size:0.7rem;color:var(--muted)">Aún no hay picks</div>';
    return;
  }

  reversed.forEach(pick => {
    const player = PLAYERS_RAW.find(p => p.id === pick.playerId);
    if (!player) return;
    const row = document.createElement('div');
    row.className = 'pick-row';
    row.innerHTML =
      `<span class="pick-num">#${pick.pickNum}</span>` +
      `<span class="pick-user">${displayName(pick.user)}</span>` +
      `<span class="pick-pos ${player.pos}">${player.pos}</span>` +
      `<span class="pick-player">${player.name}</span>` +
      `<span class="pick-country">${player.country}</span>`;
    list.appendChild(row);
  });
}

// ─────────────────────────────────────────────────────────
// LISTA DE JUGADORES
// ─────────────────────────────────────────────────────────
function renderDraftPlayerList() {
  const { state, PLAYERS_RAW, currentUser, MAX_PICKS } = _ctx;
  const list = document.getElementById('draft-player-list');
  list.innerHTML = '';

  const draftedIds   = new Set(state.picks.map(p => p.playerId));
  const myPicks      = state.picks.filter(p => p.user === currentUser);
  const myCountries  = new Set(
    myPicks.map(p => PLAYERS_RAW.find(pl => pl.id === p.playerId)?.country)
  );
  const searchTerm   = (document.getElementById('search-input')?.value || '').toLowerCase();
  const isMyTurn     =
    state.currentTurn < state.draftOrder.length &&
    state.draftOrder[state.currentTurn] === currentUser;
  const myPicksFull  = myPicks.length >= MAX_PICKS;

  // Agrupar por país
  const byCountry = {};
  PLAYERS_RAW.forEach(p => {
    if (!byCountry[p.country]) byCountry[p.country] = [];
    byCountry[p.country].push(p);
  });

  const posOrderArr = ['PO', 'DF', 'MC', 'DC'];

  Object.keys(byCountry).sort().forEach(country => {
    const players  = byCountry[country]
      .sort((a, b) => posOrderArr.indexOf(a.pos) - posOrderArr.indexOf(b.pos));
    const filtered = players.filter(p => {
      if (posFilter !== 'ALL' && p.pos !== posFilter) return false;
      if (searchTerm &&
          !p.name.toLowerCase().includes(searchTerm) &&
          !country.toLowerCase().includes(searchTerm)) return false;
      return true;
    });
    if (filtered.length === 0) return;

    const isCountryDrafted = myCountries.has(country);
    const availCount       = players.filter(p => !draftedIds.has(p.id)).length;

    const section = document.createElement('div');
    section.className = 'country-section';

    const header = document.createElement('div');
    header.className = 'country-header' + (isCountryDrafted ? ' has-drafted' : '');
    header.innerHTML =
      `<span>${country} <span style="color:var(--border)">(${availCount} disp.)</span></span>` +
      `<span class="chevron">▾</span>`;
    header.addEventListener('click', () => {
      section.classList.toggle('collapsed');
      header.classList.toggle('collapsed');
    });
    section.appendChild(header);

    const playersDiv = document.createElement('div');
    playersDiv.className = 'country-players';

    filtered.forEach(p => {
      const isDrafted      = draftedIds.has(p.id);
      const isCountryBlock = !isDrafted && isCountryDrafted;
      const row = document.createElement('div');
      row.className =
        'draft-player-row' +
        (isDrafted      ? ' drafted'        : '') +
        (isCountryBlock ? ' country-drafted' : '');
      row.innerHTML =
        `<span class="dpr-pos ${p.pos}">${p.pos}</span>` +
        `<span class="dpr-name">${p.name}</span>` +
        (isDrafted
          ? '<span class="dpr-badge">FICHADO</span>'
          : isCountryBlock
            ? '<span class="dpr-badge" style="color:#ff4444;border-color:#ff4444">PAÍS</span>'
            : '');

      if      (!isDrafted && !isCountryBlock && isMyTurn && !myPicksFull)
        row.addEventListener('click', () => openModal(p));
      else if (!isDrafted && !isCountryBlock && !isMyTurn)
        row.addEventListener('click', () => _ctx.showToast('No es tu turno', 'error'));
      else if (!isDrafted && isCountryBlock)
        row.addEventListener('click', () => _ctx.showToast('Ya tienes un jugador de ' + country, 'error'));
      else if (myPicksFull && !isDrafted)
        row.addEventListener('click', () => _ctx.showToast('Ya tienes 17 jugadores', 'error'));

      playersDiv.appendChild(row);
    });

    section.appendChild(playersDiv);
    list.appendChild(section);
  });
}

// ─────────────────────────────────────────────────────────
// MODAL DE CONFIRMACIÓN
// ─────────────────────────────────────────────────────────
function openModal(player) {
  const { state, currentUser, MAX_PICKS } = _ctx;
  pendingPlayer = player;
  const myPicks = state.picks.filter(p => p.user === currentUser).length;
  document.getElementById('modal-body').innerHTML =
    `¿Fichas a <strong>${player.name}</strong> (${player.pos}) de <strong>${player.country}</strong>?` +
    `<br><br>Pick: ${myPicks + 1} / ${MAX_PICKS}`;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  pendingPlayer = null;
}

async function confirmPick() {
  if (!pendingPlayer) return;
  const player = pendingPlayer;
  closeModal();

  const error = await submitPick(_ctx.currentUser, player, _ctx.PLAYERS_RAW);
  if (error) {
    _ctx.showToast(error, 'error');
    return;
  }
  _ctx.showToast(`✓ ${player.name} fichado`, 'success');
  // La UI se actualiza sola via onStateChange cuando Firebase notifica el cambio
}
