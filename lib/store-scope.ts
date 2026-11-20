// lib/store-scope.ts — toko operasional yang dipakai saat app (re)load (keluhan staf 2026-11-20 no. 7:
// "kalau lupa klik toko MJ, sudah selesai scan terus mau bayar jadinya harus ngulang").
// Sebelumnya activeStoreId hanya di memori: akun lintas-toko (manager/admin) kembali ke "Semua toko"
// tiap reload → checkout ditolak "Pilih toko operasional". Sekarang: toko staf (kasir terkunci) >
// kunci perangkat (lib/device-lock) > pilihan terakhir di perangkat ini. Bagian murni diuji.

export const LAST_STORE_KEY = "kebaya-oma-active-store";

/** toko saat boot; null = "Semua toko" (tetap minta pilih) */
export function resolveBootStore(
  profileStoreId: string | null | undefined,
  lockStoreId: string | null | undefined,
  lastStoreId: string | null | undefined
): string | null {
  return profileStoreId || lockStoreId || lastStoreId || null;
}

export function readLastStore(): string | null {
  try {
    return localStorage.getItem(LAST_STORE_KEY) || null;
  } catch {
    return null;
  }
}

/** dicatat tiap pilihan toko manual; null ("Semua toko") menghapus catatan */
export function writeLastStore(id: string | null): void {
  try {
    if (id) localStorage.setItem(LAST_STORE_KEY, id);
    else localStorage.removeItem(LAST_STORE_KEY);
  } catch {
    /* penyimpanan diblokir: perilaku lama (pilih toko tiap reload) */
  }
}
