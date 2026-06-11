// ─────────────────────────────────────────────────────────
// app.js — punto de entrada, login y routing de tabs
// ─────────────────────────────────────────────────────────
import { PLAYERS_RAW } from '../data/players.js';
import { USERS }       from '../data/users.js';
import {
  MAX_PICKS, state,
  initState, saveNickname, loadNicknames, displayName,
  loadPitchAssignment, snapshotJornadaSiToca,
  isAlineacionBloqueada, JORNADAS, getJornadaBloqueadaActual
} from './state.js';
import { initPlantilla, renderPlantilla } from './plantilla.js';
import { initDraft, renderDraft }         from './draft.js';
import { initRanking, renderRanking }     from './ranking.js';

// Stable player IDs
PLAYERS_RAW.forEach((p, i) => { p.id = i; });

// ── Estado global ──
export let currentUser        = null;
export let plantillaViewUser  = null;
// Alineaciones de TODOS los usuarios (necesario para cálculo de ranking)
export let pitchAssignments   = {};

// ─────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────
async function initLogin() {
  await loadNicknames();

  // Mapa usuario → nombre de archivo de avatar en assets/avatars/
  const AVATAR_FILES = {
    'Jon Luengo':               'jon.jpg',
    'Oier Ezkerro':             'oier.jpg',
    'Urko Fernandez':           'urko.jpg',
    'Ortiz Mardones':           'ortzi.jpg',
    'Urtzi Suaga':              'urtzi.jpg',
    'Markel Rodeño':            'markel.jpg',
    'Jokin Garcia de Cortazar': 'jokin.jpg',
    'Mikel Palomero':           'mikel.jpg',
    'Aritz Gutierrez':          'aritz.jpg',
  };

  const grid = document.getElementById('user-grid');
  USERS.forEach(u => {
    const btn      = document.createElement('button');
    btn.className  = 'user-btn';

    const avatarFile = AVATAR_FILES[u];
    // const avatarPath = avatarFile ? `./assets/avatars/${avatarFile}` : null;
    const avatarPath = `./assets/avatars/jon.jpg`
    const initial    = displayName(u);

    // Avatar: imagen si existe, sino inicial como fallback
    const avatarHTML = avatarPath
      ? `<img class="user-avatar" src="${avatarPath}" alt="${displayName(u)}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`+
        `<div class="user-avatar-fallback" style="display:none">${initial}</div>`
      : `<div class="user-avatar-fallback">${initial}</div>`;

    btn.innerHTML =
      avatarHTML +
      `<span class="user-btn-name">${displayName(u)}</span>`;

    btn.addEventListener('click', () => {
      document.querySelectorAll('.user-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('btn-enter').disabled = false;
      currentUser = u;
    });
    grid.appendChild(btn);
  });

  document.getElementById('btn-enter').addEventListener('click', async () => {
    if (!currentUser) return;
    const hasNick = localStorage.getItem('nick_set_' + currentUser);
    if (!hasNick) showNicknameScreen();
    else          await bootApp();
  });
}

function showNicknameScreen() {
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-nickname').classList.add('active');
  const input = document.getElementById('nickname-input');
  input.value = displayName(currentUser);
  input.focus();
  input.select();

  const finish = async () => {
    const nick = input.value.trim();
    if (nick) await saveNickname(currentUser, nick);
    localStorage.setItem('nick_set_' + currentUser, '1');
    document.getElementById('screen-nickname').classList.remove('active');
    await bootApp();
  };
  document.getElementById('btn-save-nickname').onclick = finish;
  document.getElementById('btn-skip-nickname').onclick = finish;
}

// ─────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────
async function bootApp() {
  showToast('Conectando…');

  await initState(onStateChange);

  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-main').classList.add('active');
  document.getElementById('topbar-username').textContent = displayName(currentUser);

  // Carga alineación del usuario actual
  pitchAssignments[currentUser] = await loadPitchAssignment(currentUser);
  plantillaViewUser = currentUser;

  // Contexto compartido entre módulos
  const ctx = {
    currentUser,
    PLAYERS_RAW,
    USERS,
    state,
    MAX_PICKS,
    displayName,
    showToast,
    get plantillaViewUser() { return plantillaViewUser; },
    set plantillaViewUser(v) { plantillaViewUser = v; },
    get pitchAssignments()   { return pitchAssignments; },
  };

  initPlantilla({ ...ctx, pitchData: pitchAssignments[currentUser] });
  initDraft(ctx);
  initRanking(ctx);

  // Cuando el ranking necesita ver alineaciones de otros usuarios, las carga lazy
  _preloadAllPitchAssignments();

  // Snapshot de alineaciones si hay jornada bloqueada
  snapshotJornadaSiToca(USERS, () => pitchAssignments).then(() => {
    // Re-render plantilla por si el estado de bloqueo cambió
    if (document.getElementById('tab-plantilla')?.classList.contains('active')) {
      renderPlantilla(plantillaViewUser || currentUser);
    }
  });

  switchTab('plantilla');
}

// Precarga alineaciones de todos los usuarios en segundo plano
async function _preloadAllPitchAssignments() {
  await Promise.all(USERS.map(async u => {
    if (!pitchAssignments[u]) {
      pitchAssignments[u] = await loadPitchAssignment(u);
    }
  }));
}

// ─────────────────────────────────────────────────────────
// FIREBASE CALLBACK
// ─────────────────────────────────────────────────────────
function onStateChange() {
  const active = id => document.getElementById(id)?.classList.contains('active');
  if (active('tab-draft'))    renderDraft();
  if (active('tab-plantilla')) renderPlantilla(plantillaViewUser || currentUser);
  if (active('tab-ranking'))   renderRanking();
}

// ─────────────────────────────────────────────────────────
// TAB SWITCHING
// ─────────────────────────────────────────────────────────
export function switchTab(tab) {
  document.querySelectorAll('.nav-tab').forEach((t, i) => {
    t.classList.toggle('active',
      (i === 0 && tab === 'plantilla') ||
      (i === 1 && tab === 'draft')     ||
      (i === 2 && tab === 'ranking')
    );
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'plantilla') renderPlantilla(plantillaViewUser || currentUser);
  if (tab === 'draft')     renderDraft();
  if (tab === 'ranking')   renderRanking();
}

// ─────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────
export function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'show ' + (type || '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, 3000);
}

// ─────────────────────────────────────────────────────────
// WIRE NAV EVENTS
// ─────────────────────────────────────────────────────────
document.getElementById('nav-plantilla').addEventListener('click', () => switchTab('plantilla'));
document.getElementById('nav-draft').addEventListener('click',     () => switchTab('draft'));
document.getElementById('nav-ranking').addEventListener('click',   () => switchTab('ranking'));

// ─────────────────────────────────────────────────────────
// ARRANQUE
// ─────────────────────────────────────────────────────────
initLogin();
