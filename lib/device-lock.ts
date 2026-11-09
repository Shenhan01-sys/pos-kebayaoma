// lib/device-lock.ts — kunci lokasi tablet: perangkat di-"pairing" ke SATU toko sekali (GPS di toko, atau dipilih
// manual), setelah itu login tidak butuh GPS realtime lagi. Hanya role lintas-toko (superadmin, manager, admin)
// yang boleh mengunci/membuka kunci. Ini kontrol praktis, bukan keamanan: akses data tetap dijaga RLS per toko.
// Bagian murni (tanpa localStorage) diuji di device-lock.test.ts.

import { GEOFENCE_RADIUS_M, haversineMeters, type GeoPoint } from "@/lib/geo";
import { isAllStoreRole } from "@/lib/roles";

export const DEVICE_LOCK_KEY = "kebaya-oma-device-lock";

export interface DeviceLock {
  storeId: string;
  lockedAt: string; // ISO
  by: string; // nama staff yang mengunci
  method: "gps" | "manual";
}

interface StoreLike {
  id: string;
  name: string;
  prefix?: string;
  lat?: number | null;
  lng?: number | null;
}

/** parse nilai localStorage; null bila kosong/rusak */
export function parseDeviceLock(raw: string | null | undefined): DeviceLock | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v.storeId !== "string" || !v.storeId) return null;
    return {
      storeId: v.storeId,
      lockedAt: typeof v.lockedAt === "string" ? v.lockedAt : "",
      by: typeof v.by === "string" ? v.by : "",
      method: v.method === "gps" ? "gps" : "manual",
    };
  } catch {
    return null;
  }
}

export function readDeviceLock(): DeviceLock | null {
  try {
    return parseDeviceLock(localStorage.getItem(DEVICE_LOCK_KEY));
  } catch {
    return null;
  }
}

export function writeDeviceLock(lock: DeviceLock): void {
  try {
    localStorage.setItem(DEVICE_LOCK_KEY, JSON.stringify(lock));
  } catch {
    /* penyimpanan diblokir (mode privat): login tetap jalan lewat geofence biasa */
  }
}

export function clearDeviceLock(): void {
  try {
    localStorage.removeItem(DEVICE_LOCK_KEY);
  } catch {
    /* abaikan */
  }
}

/** hanya role lintas-toko (Glori, Mama, Putri, ...) yang boleh mengunci / membuka kunci */
export const canManageDeviceLock = isAllStoreRole;

/** hanya kasir (akun terikat toko) yang otomatis mengunci tablet saat login pertama di dalam radius toko */
export const shouldAutoLock = (role: string | null | undefined): boolean => role === "kasir";

export type LockDecision =
  | { kind: "no-lock" } // belum dikunci / kunci basi → jalur geofence biasa
  | { kind: "use-lock"; storeId: string } // lewati GPS, pakai toko tablet
  | { kind: "blocked"; message: string }; // akun toko lain di tablet terkunci

/** keputusan login untuk tablet: staffStoreId non-null = akun terikat satu toko (kasir) */
export function decideWithLock(
  lock: DeviceLock | null,
  role: string | null | undefined,
  staffStoreId: string | null,
  stores: StoreLike[]
): LockDecision {
  if (!lock) return { kind: "no-lock" };
  // daftar toko sudah termuat tapi toko terkunci tak ada lagi → kunci basi, abaikan
  if (stores.length > 0 && !stores.some((s) => s.id === lock.storeId)) return { kind: "no-lock" };
  const label = (id: string | null) => {
    const s = stores.find((x) => x.id === id);
    return s ? s.prefix || s.name : "toko lain";
  };
  if (!isAllStoreRole(role) && staffStoreId && staffStoreId !== lock.storeId) {
    return {
      kind: "blocked",
      message: `Tablet ini dikunci ke toko ${label(lock.storeId)}, sedangkan akunmu untuk toko ${label(staffStoreId)}. Minta superadmin/manager membuka kunci tablet bila tablet ini pindah toko.`,
    };
  }
  return { kind: "use-lock", storeId: lock.storeId };
}

/** toko terdekat yang punya koordinat + jaraknya (m); null bila tak ada koordinat sama sekali */
export function nearestStore(point: GeoPoint, stores: StoreLike[]): { store: StoreLike; dist: number } | null {
  let best: { store: StoreLike; dist: number } | null = null;
  for (const s of stores) {
    if (s.lat == null || s.lng == null) continue;
    const d = haversineMeters(point, { lat: s.lat, lng: s.lng });
    if (!best || d < best.dist) best = { store: s, dist: d };
  }
  return best;
}

export type GpsLockResult =
  | { ok: true; store: StoreLike; dist: number }
  | { ok: false; message: string };

/** hasil "scan GPS" untuk mengunci: toko terdekat harus dalam radius geofence */
export function resolveGpsLock(point: GeoPoint, stores: StoreLike[], radiusM: number = GEOFENCE_RADIUS_M): GpsLockResult {
  const n = nearestStore(point, stores);
  if (!n) return { ok: false, message: "Belum ada toko yang koordinatnya terpasang (Pengaturan → Lokasi Toko)." };
  if (n.dist > radiusM) {
    return {
      ok: false,
      message: `Tidak berada di radius toko (terdekat ${n.store.prefix || n.store.name}, ${Math.round(n.dist)} m; batas ${radiusM} m). Mendekat ke toko, atau pilih toko manual.`,
    };
  }
  return { ok: true, store: n.store, dist: n.dist };
}
