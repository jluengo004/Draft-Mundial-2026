// ─────────────────────────────────────────────────────────
// FIREBASE CONFIG
// Rellena estos valores con los de tu proyecto en Firebase Console
// ─────────────────────────────────────────────────────────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, set, get, onValue, runTransaction }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const firebaseConfig = {
  apiKey:            "TU_API_KEY",
  authDomain:        "TU_PROJECT.firebaseapp.com",
  databaseURL:       "https://TU_PROJECT-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "TU_PROJECT",
  storageBucket:     "TU_PROJECT.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId:             "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ─────────────────────────────────────────────────────────
// DB HELPERS
// ─────────────────────────────────────────────────────────

/** Lee una ruta una sola vez. Devuelve el valor o null. */
export async function dbGet(path) {
  const snap = await get(ref(db, path));
  return snap.exists() ? snap.val() : null;
}

/** Escribe un valor en una ruta. */
export async function dbSet(path, value) {
  await set(ref(db, path), value);
}

/**
 * Escribe SOLO si la ruta aún no existe.
 * Útil para inicializar el draftOrder sin sobreescribir si ya existe.
 * Devuelve true si se escribió, false si ya existía.
 */
export async function dbSetIfAbsent(path, value) {
  let written = false;
  await runTransaction(ref(db, path), current => {
    if (current === null) { written = true; return value; }
    return current; // no tocar si ya existe
  });
  return written;
}

/**
 * Suscribe a cambios en tiempo real en una ruta.
 * Devuelve la función de unsubscribe.
 */
export function dbListen(path, callback) {
  const r = ref(db, path);
  const unsub = onValue(r, snap => {
    callback(snap.exists() ? snap.val() : null);
  });
  return unsub; // llama a unsub() para dejar de escuchar
}
