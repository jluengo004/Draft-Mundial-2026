// ─────────────────────────────────────────────────────────
// STATE — sincronizado con Firebase Realtime Database
//
// Estructura en DB:
//   /draft/order       → string[]   orden completo de 153 turnos
//   /draft/picks       → Pick[]     [{pickNum, user, playerId}]
//   /draft/currentTurn → number
//   /nicknames         → {user: nick}
//   /pitch/{user}      → {slotId: playerId}  (alineaciones locales por usuario)
// ─────────────────────────────────────────────────────────
import { dbGet, dbSet, dbSetIfAbsent, dbListen } from './firebase.js';
import { USERS } from '../data/users.js';

export const MAX_PICKS = 17;

// ── Estado local (reflejo del DB) ──
export let state = {
  draftOrder:   [],
  picks:        [],
  currentTurn:  0,
};

export let nicknames = {};

// ── Listeners activos (para limpiarlos si hiciera falta) ──
let _unsubDraft = null;

// ─────────────────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────────────────

/**
 * Genera el orden del draft (si no existe en DB) y
 * suscribe a cambios en tiempo real.
 * @param {function} onStateChange  callback al recibir cambios del draft
 */
export async function initState(onStateChange) {
  // Genera el draftOrder solo si aún no existe en DB
  const existing = await dbGet('draft/order');
  if (!existing) {
    const order = _generateDraftOrder();
    await dbSet('draft/order', order);
    await dbSet('draft/picks', []);
    await dbSet('draft/currentTurn', 0);
  }

  // Carga nicknames
  const nicks = await dbGet('nicknames');
  if (nicks) nicknames = nicks;

  // Suscribe al nodo /draft en tiempo real
  if (_unsubDraft) _unsubDraft();
  _unsubDraft = dbListen('draft', data => {
    if (!data) return;
    state.draftOrder  = data.order       || [];
    state.picks       = data.picks       || [];
    state.currentTurn = data.currentTurn ?? 0;
    onStateChange(state);
  });
}

function _generateDraftOrder() {
  const shuffled = [...USERS].sort(() => Math.random() - 0.5);
  const order = [];
  for (let round = 0; round < MAX_PICKS; round++) {
    order.push(...(round % 2 === 0 ? [...shuffled] : [...shuffled].reverse()));
  }
  return order;
}

// ─────────────────────────────────────────────────────────
// PICKS
// ─────────────────────────────────────────────────────────

/**
 * Registra un pick. Valida en cliente antes de escribir.
 * El servidor (Firebase Rules) debería validar también.
 * Devuelve null si ok, o string con el error.
 */
export async function submitPick(currentUser, player, PLAYERS_RAW) {
  const turn = state.currentTurn;
  if (turn >= state.draftOrder.length)     return 'El draft ha terminado';
  if (state.draftOrder[turn] !== currentUser) return 'No es tu turno';

  const draftedIds  = new Set(state.picks.map(p => p.playerId));
  const myPicks     = state.picks.filter(p => p.user === currentUser);
  const myCountries = new Set(
    myPicks.map(p => PLAYERS_RAW.find(pl => pl.id === p.playerId)?.country)
  );

  if (draftedIds.has(player.id))          return 'Jugador ya fichado';
  if (myCountries.has(player.country))    return 'Ya tienes un jugador de ' + player.country;
  if (myPicks.length >= MAX_PICKS)        return 'Ya tienes ' + MAX_PICKS + ' jugadores';

  // Escritura atómica: añade el pick y avanza el turno
  const newPicks = [...state.picks, { pickNum: turn + 1, user: currentUser, playerId: player.id }];
  await dbSet('draft/picks',       newPicks);
  await dbSet('draft/currentTurn', turn + 1);

  return null; // sin error
}

// ─────────────────────────────────────────────────────────
// NICKNAMES
// ─────────────────────────────────────────────────────────

export async function saveNickname(user, nick) {
  nicknames[user] = nick;
  await dbSet('nicknames/' + user, nick);
}

export async function loadNicknames() {
  const data = await dbGet('nicknames');
  if (data) nicknames = data;
  return nicknames;
}

export function displayName(user) {
  return nicknames[user] || user.split(' ')[0];
}

// ─────────────────────────────────────────────────────────
// PITCH ASSIGNMENT (se guarda en DB bajo /pitch/{user})
// ─────────────────────────────────────────────────────────

export async function savePitchAssignment(user, assignment) {
  await dbSet('pitch/' + user, assignment);
}

export async function loadPitchAssignment(user) {
  return (await dbGet('pitch/' + user)) || {};
}
