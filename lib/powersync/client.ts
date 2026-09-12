import type { PowerSyncDatabase } from "@powersync/web";

// ============================================================================
// PowerSync Client — offline-first SQLite di browser
// ============================================================================
// PowerSync hanya di-load secara dinamis saat NEXT_PUBLIC_POWERSYNC_URL di-set.
// Tanpa URL, module @powersync/web (besar) tidak ikut di initial bundle,
// sehingga first load lebih ringan dan tidak memicu worker-initialization error.

let db: PowerSyncDatabase | null = null;
let initPromise: Promise<PowerSyncDatabase | null> | null = null;

/**
 * Inisialisasi PowerSync database.
 * Membutuhkan PowerSync service URL dari env NEXT_PUBLIC_POWERSYNC_URL.
 *
 * Jika PowerSync belum dikonfigurasi, return null dan aplikasi fallback
 * ke mode Supabase langsung atau demo mode.
 */
export async function initPowerSync(): Promise<PowerSyncDatabase | null> {
  const powersyncUrl = process.env.NEXT_PUBLIC_POWERSYNC_URL;

  if (!powersyncUrl) {
    console.info("[powersync] NEXT_PUBLIC_POWERSYNC_URL belum di-set. Offline sync nonaktif.");
    return null;
  }

  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Lazy-load package + schema agar tidak masuk bundle utama saat nonaktif.
      const [{ PowerSyncDatabase }, { schema }] = await Promise.all([
        import("@powersync/web"),
        import("./schema"),
      ]);

      db = new PowerSyncDatabase({
        database: { dbFilename: "kebaya-oma.db" },
        schema,
      });

      // PowerSync lokal siap — sync ke cloud membutuhkan backend adapter.
      // Untuk sekarang, SQLite lokal sudah bisa baca/tulis.
      console.info("[powersync] Database lokal siap.", powersyncUrl);
      return db;
    } catch (err) {
      console.error("[powersync] Init error:", err);
      return null;
    }
  })();

  return initPromise;
}

export function getPowerSyncDb(): PowerSyncDatabase | null {
  return db;
}

/**
 * Cek apakah PowerSync aktif dan tersinkronisasi.
 */
export function isPowerSyncReady(): boolean {
  return db !== null;
}
