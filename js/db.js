// Petit wrapper IndexedDB : tout reste dans le navigateur du propriétaire.
const NAME = 'cubotheque';
const VERSION = 1;
export const STORES = ['items', 'images', 'sheets', 'solves', 'kv'];
let opening;

function open() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return opening;
}

async function run(store, mode, fn) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const db = {
  all: (s) => run(s, 'readonly', (st) => st.getAll()),
  get: (s, id) => run(s, 'readonly', (st) => st.get(id)),
  put: (s, v) => run(s, 'readwrite', (st) => st.put(v)),
  del: (s, id) => run(s, 'readwrite', (st) => st.delete(id)),
  clear: (s) => run(s, 'readwrite', (st) => st.clear()),
  async putMany(s, list) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const t = d.transaction(s, 'readwrite');
      const st = t.objectStore(s);
      for (const v of list) st.put(v);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  },
};
