import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, set, get, onValue, runTransaction }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

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

export async function dbGet(path) {
  const snap = await get(ref(db, path));
  return snap.exists() ? snap.val() : null;
}

export async function dbSet(path, value) {
  await set(ref(db, path), value);
}

export async function dbSetIfAbsent(path, value) {
  let written = false;
  await runTransaction(ref(db, path), current => {
    if (current === null) { written = true; return value; }
    return current;
  });
  return written;
}

export function dbListen(path, callback) {
  const unsub = onValue(ref(db, path), snap => {
    callback(snap.exists() ? snap.val() : null);
  });
  return unsub;
}
