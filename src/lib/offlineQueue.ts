// Simple offline cache + write queue using IndexedDB (no extra deps)
// Stores per-school cached datasets and a mutation queue to sync when online.

type OfflineOpTable = "students" | "payments" | "fee_structures";

export type OfflineOpInput =
  | {
      table: OfflineOpTable;
      type: "insert";
      payload: Record<string, any>;
      // local temp id used in UI/caches before server assigns a real id
      tempId?: string;
    }
  | {
      table: OfflineOpTable;
      type: "update";
      rowId: string;
      patch: Record<string, any>;
    }
  | {
      table: OfflineOpTable;
      type: "delete";
      rowId: string;
    };

type OfflineOp =
  | ({
      id: string;
      createdAt: number;
    } & OfflineOpInput);

const DB_NAME = "myfee_offline";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("cache")) {
        db.createObjectStore("cache", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  storeName: "cache" | "queue",
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

export const makeCacheKey = (schoolId: string, table: OfflineOpTable) => `${schoolId}:${table}`;

export async function getOfflineCache<T>(key: string): Promise<T | null> {
  const db = await openDb();
  try {
    const res = await tx<{ key: string; value: any } | undefined>(db, "cache", "readonly", (s) => s.get(key));
    return res?.value ?? null;
  } finally {
    db.close();
  }
}

export async function setOfflineCache<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  try {
    await tx(db, "cache", "readwrite", (s) => s.put({ key, value }));
  } finally {
    db.close();
  }
}

export async function enqueueOfflineOp(op: OfflineOpInput): Promise<OfflineOp> {
  const full: OfflineOp = {
    ...(op as any),
    id: (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`) as string,
    createdAt: Date.now(),
  } as OfflineOp;

  const db = await openDb();
  try {
    await tx(db, "queue", "readwrite", (s) => s.put(full));
    return full;
  } finally {
    db.close();
  }
}

export async function listOfflineOps(): Promise<OfflineOp[]> {
  const db = await openDb();
  try {
    const ops = await tx<OfflineOp[]>(db, "queue", "readonly", (s) => s.getAll());
    return (ops || []).sort((a, b) => a.createdAt - b.createdAt);
  } finally {
    db.close();
  }
}

export async function removeOfflineOp(id: string): Promise<void> {
  const db = await openDb();
  try {
    await tx(db, "queue", "readwrite", (s) => s.delete(id));
  } finally {
    db.close();
  }
}

export async function syncOfflineQueue(supabase: any): Promise<{ synced: number; failed: number }> {
  if (isOffline()) return { synced: 0, failed: 0 };

  const ops = await listOfflineOps();
  let synced = 0;
  let failed = 0;

  for (const op of ops) {
    try {
      if (op.type === "insert") {
        // Never send local temp ids to the server
        const payload = { ...op.payload };
        delete (payload as any).id;

        const { error } = await supabase.from(op.table).insert([payload]);
        if (error) throw error;
      }

      if (op.type === "update") {
        const { error } = await supabase.from(op.table).update(op.patch).eq("id", op.rowId);
        if (error) throw error;
      }

      if (op.type === "delete") {
        const { error } = await supabase.from(op.table).delete().eq("id", op.rowId);
        if (error) throw error;
      }

      await removeOfflineOp(op.id);
      synced += 1;
    } catch (e) {
      // Keep it in queue for next attempt
      failed += 1;
    }
  }

  return { synced, failed };
}
