// lib/geo.ts — E9: GPS auto-outlet + geofence login (radius 25 m, keputusan user 2026-09-19).
// Kasir/admin: WAJIB berada di radius salah satu toko (yang punya koordinat) saat login.
// Superadmin/manager: di radius toko → activeStore otomatis; di luar → global (manual).
// Fail-open bila TIDAK ada toko yang sudah punya koordinat (hindari lockout massal
// sebelum superadmin memasang koordinat di /settings).

export const GEOFENCE_RADIUS_M = 25;

export interface GeoStore {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Jarak haversine (meter). */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type GeoResult =
  | { kind: "ok"; storeId: string | null } // storeId non-null = dalam radius toko itu
  | { kind: "blocked"; message: string } // kasir/admin di luar radius → login ditolak
  | { kind: "pass-global" }; // superadmin/manager di luar radius → global

/** Evaluasi geofence untuk satu role + titik lokasi. */
export function evaluateGeofence(
  role: string | undefined | null,
  stores: GeoStore[],
  point: GeoPoint,
  radiusM: number = GEOFENCE_RADIUS_M
): GeoResult {
  const configured = stores.filter((s) => s.lat != null && s.lng != null);
  if (configured.length === 0) return { kind: "ok", storeId: null }; // fail-open

  let nearest: { store: GeoStore; dist: number } | null = null;
  for (const s of configured) {
    const d = haversineMeters(point, { lat: s.lat!, lng: s.lng! });
    if (!nearest || d < nearest.dist) nearest = { store: s, dist: d };
  }

  const within = nearest && nearest.dist <= radiusM;

  if (role === "superadmin" || role === "manager") {
    return within ? { kind: "ok", storeId: nearest!.store.id } : { kind: "pass-global" };
  }
  // kasir / admin / role lain: wajib di toko
  if (within) return { kind: "ok", storeId: nearest!.store.id };
  return {
    kind: "blocked",
    message:
      "Login ditolak — kamu harus berada di dalam toko (radius 25 m) untuk masuk. " +
      "Pastikan GPS aktif dan coba lagi di lokasi toko.",
  };
}

/** navigator.geolocation → Promise (timeout, cache singkat). */
export function getPosition(timeoutMs = 10000): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation tidak tersedia di perangkat ini."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(geoErrorText(e.code))),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 }
    );
  });
}

function geoErrorText(code: number): string {
  if (code === 1) return "Izin lokasi ditolak — aktifkan izin lokasi untuk halaman ini.";
  if (code === 2) return "Lokasi tidak tersedia — cek GPS perangkat.";
  if (code === 3) return "Waktu deteksi lokasi habis — coba lagi.";
  return "Gagal mendeteksi lokasi.";
}
