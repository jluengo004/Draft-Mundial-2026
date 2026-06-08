// ─────────────────────────────────────────────────────────
// app.js — punto de entrada, login y routing de tabs
// ─────────────────────────────────────────────────────────
import { PLAYERS_RAW } from '../data/players.js';
import { USERS }       from '../data/users.js';
import {
  MAX_PICKS, state,
  initState, saveNickname, loadNicknames, displayName,
  loadPitchAssignment
} from './state.js';
import { initPlantilla, renderPlantilla } from './plantilla.js';
import { initDraft, renderDraft }         from './draft.js';
import { initRanking, renderRanking } from './ranking.js';

// Stable player IDs (se asignan una sola vez al arrancar)
PLAYERS_RAW.forEach((p, i) => { p.id = i; });

// ── Estado global compartido entre módulos ──
export let currentUser       = null;
export let plantillaViewUser = null;

// ─────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────
async function initLogin() {
  await loadNicknames();

  const grid = document.getElementById('user-grid');
  USERS.forEach(u => {
    const btn = document.createElement('button');
    btn.className   = 'user-btn';
    btn.textContent = displayName(u);
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
    const skipKey = 'skip_nick_' + currentUser;
    if (!localStorage.getItem(skipKey) && !displayName(currentUser).includes(' ') === false) {
      // Mostrar pantalla de apodo si nunca la ha visto
    }
    // Siempre mostrar nickname screen la primera vez
    const hasNick = localStorage.getItem('nick_set_' + currentUser);
    if (!hasNick) {
      showNicknameScreen();
    } else {
      await bootApp();
    }
  });
}

function showNicknameScreen() {
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-nickname').classList.add('active');
  const input = document.getElementById('nickname-input');
  input.value = displayName(currentUser);
  input.focus();
  input.select();

  document.getElementById('btn-save-nickname').onclick = async () => {
    const nick = input.value.trim();
    if (nick) await saveNickname(currentUser, nick);
    localStorage.setItem('nick_set_' + currentUser, '1');
    document.getElementById('screen-nickname').classList.remove('active');
    await bootApp();
  };

  document.getElementById('btn-skip-nickname').onclick = async () => {
    const nick = input.value.trim();
    if (nick) await saveNickname(currentUser, nick);
    localStorage.setItem('nick_set_' + currentUser, '1');
    document.getElementById('screen-nickname').classList.remove('active');
    await bootApp();
  };
}

// ─────────────────────────────────────────────────────────
// BOOT — conecta Firebase y arranca la app
// ─────────────────────────────────────────────────────────
async function bootApp() {
  showToast('Conectando…');

  await initState(onStateChange);

  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-main').classList.add('active');
  document.getElementById('topbar-username').textContent = displayName(currentUser);

  // Carga alineación del usuario actual desde DB
  const pitchData = await loadPitchAssignment(currentUser);

  plantillaViewUser = currentUser;

  // Inicializa los dos módulos pasándoles lo que necesitan
  initPlantilla({ currentUser, PLAYERS_RAW, USERS, state, plantillaViewUser, pitchData, displayName });
  initDraft({ currentUser, PLAYERS_RAW, USERS, state, displayName, showToast });
  initRanking({
  currentUser,
  PLAYERS_RAW,
  USERS,
  state,
  displayName,
  showToast,
  pitchAssignments: state.pitchAssignments || {}
});

  switchTab('plantilla');
}

// ─────────────────────────────────────────────────────────
// CALLBACK DE FIREBASE — se llama cuando cambia /draft en DB
// ─────────────────────────────────────────────────────────
function onStateChange() {
  if (document.getElementById('tab-draft').classList.contains('active')) {
    renderDraft();
  }
  if (document.getElementById('tab-plantilla').classList.contains('active')) {
    renderPlantilla(plantillaViewUser || currentUser);
  }
  if (document.getElementById('tab-ranking')?.classList.contains('active')) {
    renderRanking();
  }
}

// ─────────────────────────────────────────────────────────
// TAB SWITCHING
// ─────────────────────────────────────────────────────────
export function switchTab(tab) {
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.remove('active');
  });
  document.getElementById('nav-' + tab)?.classList.add('active');

  document.querySelectorAll('.tab-content')
  .forEach(c => c.classList.remove('active'));

  document.getElementById('tab-' + tab)
    ?.classList.add('active');

  if (tab === 'plantilla') renderPlantilla(plantillaViewUser || currentUser);
  if (tab === 'draft') renderDraft();
  if (tab === 'ranking') renderRanking();
}

// ─────────────────────────────────────────────────────────
// TOAST (compartido entre módulos)
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
document.getElementById('nav-ranking').addEventListener('click', () => switchTab('ranking'));

// ─────────────────────────────────────────────────────────
// ARRANQUE
// ─────────────────────────────────────────────────────────
initLogin();
