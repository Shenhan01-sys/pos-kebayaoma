// ============================================================================
// Offline Transaction Queue — IndexedDB store untuk transaksi saat offline
// ============================================================================
// Saat WiFi mati, transaksi baru disimpan ke IndexedDB. Saat online kembali,
// queue di-flush ke Supabase.
//
// Flow:
// 1. saveTransaction() cek navigator.onLine
// 2. Jika offline → simpan ke local state + enqueue(tx) + applySaleSideEffects
// 3. Jika online → INSERT Supabase langsung (skip queue)
// 4. online listener → flushQueue() → push semua pending ke Supabase
// 5. Sukses → dequeue(id) + fetchTransactions() untuk sync state
// ============================================================================

import type { Transaction, TransactionItem } from "@/lib/dummy";

const DB_NAME = "kebaya-oma-offline";
const DB_VERSION = 1;
const STORE = "pending_transactions";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export interface QueuedTransaction {
  localId: string;
  tx: Omit<Transaction, "id" | "items"> & { items: TransactionItem[] };
  enqueuedAt: string;
}

export async function enqueueTransaction(
  tx: QueuedTransaction
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(tx);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("[offline-queue] enqueue error:", err);
  }
}

export async function getPendingTransactions(): Promise<QueuedTransaction[]> {
  try {
    const db = await openDb();
    return await new Promise<QueuedTransaction[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as QueuedTransaction[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function dequeueTransaction(localId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(localId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("[offline-queue] dequeue error:", err);
  }
}

export async function countPending(): Promise<number> {
  try {
    const db = await openDb();
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

/**
 * Register listener: saat online kembali, panggil callback untuk flush queue.
 * Return unsubscribe function.
 */
export function onOnline(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}
