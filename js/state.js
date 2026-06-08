// ─────────────────────────────────────────────────────────
// IMPORTS — todo desde CDN, compatible con GitHub Pages
// ─────────────────────────────────────────────────────────
import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, set, get, onValue, runTransaction }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

import { USERS } from '../data/users.js';

// ─────────────────────────────────────────────────────────
// FIREBASE INIT
// ─────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBTutsjUcgg0UjIwDXtur2o9nnyEp2Cge4",
  authDomain:        "draft-mundial-2026-4da29.firebaseapp.com",
  databaseURL:       "https://draft-mundial-2026-4da29-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "draft-mundial-2026-4da29",
  storageBucket:     "draft-mundial-2026-4da29.firebasestorage.app",
  messagingSenderId: "785731497516",
  appId:             "1:785731497516:web:85b486024de29acb3beb89"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ─────────────────────────────────────────────────────────
// DB HELPERS
// ─────────────────────────────────────────────────────────
async function dbGet(path) {
  const snap = await get(ref(db, path));
  return snap.exists() ? snap.val() : null;
}

async function dbSet(path, value) {
  await set(ref(db, path), value);
}

function dbListen(path, callback) {
  return onValue(ref(db, path), snap => {
    callback(snap.exists() ? snap.val() : null);
  });
}

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────
export const MAX_PICKS = 17;

// ─────────────────────────────────────────────────────────
// STATE (reflejo local del DB)
// ─────────────────────────────────────────────────────────
export let state = {
  draftOrder:  [],
  picks:       [],
  currentTurn: 0,
};

export let nicknames = {};

let _unsubDraft = null;

// ─────────────────────────────────────────────────────────
// INIT — genera draft order si no existe y suscribe cambios
// ─────────────────────────────────────────────────────────
export async function initState(onStateChange) {
  const existing = await dbGet('draft/order');
  if (!existing) {
    const order = _generateDraftOrder();
    await dbSet('draft/order', order);
    await dbSet('draft/picks', []);
    await dbSet('draft/currentTurn', 0);
  }

  const nicks = await dbGet('nicknames');
  if (nicks) Object.assign(nicknames, nicks);

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
export async function submitPick(currentUser, player, PLAYERS_RAW) {
  const turn = state.currentTurn;
  if (turn >= state.draftOrder.length)        return 'El draft ha terminado';
  if (state.draftOrder[turn] !== currentUser) return 'No es tu turno';

  const draftedIds  = new Set(state.picks.map(p => p.playerId));
  const myPicks     = state.picks.filter(p => p.user === currentUser);
  const myCountries = new Set(
    myPicks.map(p => PLAYERS_RAW.find(pl => pl.id === p.playerId)?.country)
  );

  if (draftedIds.has(player.id))       return 'Jugador ya fichado';
  if (myCountries.has(player.country)) return 'Ya tienes un jugador de ' + player.country;
  if (myPicks.length >= MAX_PICKS)     return 'Ya tienes ' + MAX_PICKS + ' jugadores';

  const newPicks = [...state.picks, { pickNum: turn + 1, user: currentUser, playerId: player.id }];
  await dbSet('draft/picks',       newPicks);
  await dbSet('draft/currentTurn', turn + 1);

  return null;
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
  if (data) Object.assign(nicknames, data);
  return nicknames;
}

export function displayName(user) {
  return nicknames[user] || user.split(' ')[0];
}

// ─────────────────────────────────────────────────────────
// PITCH ASSIGNMENT
// ─────────────────────────────────────────────────────────
export async function savePitchAssignment(user, assignment) {
  await dbSet('pitch/' + user, assignment);
}

export async function loadPitchAssignment(user) {
  return (await dbGet('pitch/' + user)) || {};
}
