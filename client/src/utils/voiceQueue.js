// On-device queue for voice notes that haven't reached the server yet.
//
// A recording is written here BEFORE any upload is attempted, and removed
// only after the server confirms it. So if the connection is down when you
// record (say, the phone's VPN dropped), the note just waits and is retried
// later instead of being lost — which is the whole point of capturing by voice.
//
// IndexedDB is used because it can hold audio blobs; localStorage can't.
// If IndexedDB is unavailable (some private-browsing modes), it falls back
// to an in-memory list: the retry behaviour still works for the life of the
// page, it just won't survive closing the app.

const DB_NAME = 'intray-voice';
const STORE = 'pending';

const memoryFallback = new Map();
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    let req;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'clientId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function run(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// record: { clientId, blob, mime, durationMs, createdAt }
export async function enqueue(record) {
  const db = await openDb();
  if (!db) {
    memoryFallback.set(record.clientId, record);
    return;
  }
  try {
    await run(db, 'readwrite', (s) => s.put(record));
  } catch {
    memoryFallback.set(record.clientId, record);
  }
}

export async function listPending() {
  const db = await openDb();
  let stored = [];
  if (db) {
    try {
      stored = (await run(db, 'readonly', (s) => s.getAll())) || [];
    } catch {
      stored = [];
    }
  }
  const all = [...stored, ...memoryFallback.values()];
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removePending(clientId) {
  memoryFallback.delete(clientId);
  const db = await openDb();
  if (!db) return;
  try {
    await run(db, 'readwrite', (s) => s.delete(clientId));
  } catch {
    // Worst case the record is retried once more; the server's
    // idempotency key (X-Client-Id) turns that into a no-op.
  }
}

// crypto.randomUUID only exists in secure contexts, and this id has to be
// unique-enough rather than unguessable, so fall back gracefully.
export function newClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `vn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
