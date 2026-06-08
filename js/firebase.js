// ─────────────────────────────────────────────────────────
// FIREBASE CONFIG
// Rellena estos valores con los de tu proyecto en Firebase Console
// ─────────────────────────────────────────────────────────
// import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, set, get, onValue, runTransaction }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBTutsjUcgg0UjIwDXtur2o9nnyEp2Cge4",
  authDomain: "draft-mundial-2026-4da29.firebaseapp.com",
  databaseURL: "https://draft-mundial-2026-4da29-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "draft-mundial-2026-4da29",
  storageBucket: "draft-mundial-2026-4da29.firebasestorage.app",
  messagingSenderId: "785731497516",
  appId: "1:785731497516:web:85b486024de29acb3beb89",
  measurementId: "G-LPVRSB373M"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
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
