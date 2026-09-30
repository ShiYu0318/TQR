// Where saved designs live: IndexedDB in the browser (room for thumbnails and generated models), or memory when the
// browser refuses storage (private windows) and in tests.
import type { Result } from "@tqr/tri-core";
import type { SavedState } from "./share";

export interface DesignRecord {
  id: string;
  name: string;
  state: SavedState;
  /** small picture of the view when it was saved (data URL), if one could be taken */
  thumb: string | null;
  /** the generated sculpture, kept so loading needs no new solve */
  result: { result: Result; links: string[] } | null;
  created: number;
  updated: number;
}

export interface DesignStore {
  /** false when records only last until the page closes */
  durable: boolean;
  all(): Promise<DesignRecord[]>;
  get(id: string): Promise<DesignRecord | undefined>;
  put(record: DesignRecord): Promise<void>;
  remove(id: string): Promise<void>;
}

export function memoryStore(): DesignStore {
  const rows = new Map<string, DesignRecord>();
  return {
    durable: false,
    all: async () => [...rows.values()].map((r) => structuredClone(r)),
    get: async (id) => (rows.has(id) ? structuredClone(rows.get(id)!) : undefined),
    put: async (r) => void rows.set(r.id, structuredClone(r)),
    remove: async (id) => void rows.delete(id),
  };
}

const DB = "tqr", TABLE = "designs";

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(TABLE, { keyPath: "id" });
  return request(r);
}

export async function indexedDbStore(): Promise<DesignStore> {
  const db = await openDb();
  const table = (mode: IDBTransactionMode) => db.transaction(TABLE, mode).objectStore(TABLE);
  return {
    durable: true,
    all: () => request(table("readonly").getAll() as IDBRequest<DesignRecord[]>),
    get: (id) => request(table("readonly").get(id) as IDBRequest<DesignRecord | undefined>),
    put: async (r) => void (await request(table("readwrite").put(r))),
    remove: async (id) => void (await request(table("readwrite").delete(id))),
  };
}
