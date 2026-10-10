/**
 * Persistência em IndexedDB com uma API mínima baseada em Promises.
 * Se o IndexedDB não estiver disponível (aba anônima de alguns navegadores),
 * cai para localStorage para o app continuar funcionando.
 */
import { migrateLegacy } from "./notes.js";

const DB_NAME = "dev-notes";
const STORE = "notes";
const LEGACY_KEY = "notes"; // chave usada pela versão antiga do app
const FALLBACK_KEY = "dev-notes:v2";

const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function openDb() {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
  return request(req);
}

class IndexedDbStore {
  constructor(db) {
    this.db = db;
  }
  tx(mode) {
    return this.db.transaction(STORE, mode).objectStore(STORE);
  }
  all() {
    return request(this.tx("readonly").getAll());
  }
  put(note) {
    return request(this.tx("readwrite").put(note));
  }
  delete(id) {
    return request(this.tx("readwrite").delete(id));
  }
  async putMany(notes) {
    const store = this.tx("readwrite");
    await Promise.all(notes.map((n) => request(store.put(n))));
  }
}

class LocalStore {
  read() {
    try {
      return JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? "[]");
    } catch {
      return [];
    }
  }
  write(notes) {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(notes));
  }
  async all() {
    return this.read();
  }
  async put(note) {
    this.write([...this.read().filter((n) => n.id !== note.id), note]);
  }
  async delete(id) {
    this.write(this.read().filter((n) => n.id !== id));
  }
  async putMany(notes) {
    for (const n of notes) await this.put(n);
  }
}

/** Abre o armazenamento e migra, uma única vez, as notas da versão antiga. */
export async function openStore() {
  let store;
  try {
    store = new IndexedDbStore(await openDb());
  } catch {
    store = new LocalStore();
  }

  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      await store.putMany(migrateLegacy(legacy));
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    /* sem acesso ao localStorage: nada a migrar */
  }

  return store;
}
