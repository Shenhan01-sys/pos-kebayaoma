import { describe, expect, it } from "vitest";
import { canManageDeviceLock, decideWithLock, parseDeviceLock, resolveGpsLock, shouldAutoLock, type DeviceLock } from "./device-lock";

const MJL = { id: "mjl", name: "Kebaya Oma - Monjali", prefix: "MJL", lat: -7.7, lng: 110.36 };
const KTB = { id: "ktb", name: "Kebaya Oma - Kota Baru", prefix: "KTB", lat: -7.78, lng: 110.37 };
const stores = [MJL, KTB];
const lock: DeviceLock = { storeId: "mjl", lockedAt: "2026-11-09T03:00:00Z", by: "Glori", method: "gps" };

describe("parseDeviceLock", () => {
  it("nilai valid dibaca; metode tak dikenal → manual", () => {
    expect(parseDeviceLock(JSON.stringify(lock))).toEqual(lock);
    expect(parseDeviceLock(JSON.stringify({ storeId: "x", method: "aneh" }))?.method).toBe("manual");
  });
  it("kosong / rusak / tanpa storeId → null", () => {
    expect(parseDeviceLock(null)).toBeNull();
    expect(parseDeviceLock("")).toBeNull();
    expect(parseDeviceLock("{bukan json")).toBeNull();
    expect(parseDeviceLock(JSON.stringify({ by: "x" }))).toBeNull();
    expect(parseDeviceLock(JSON.stringify({ storeId: "" }))).toBeNull();
  });
});

describe("hak kunci", () => {
  it("hanya role lintas-toko yang boleh mengunci / membuka", () => {
    expect(canManageDeviceLock("superadmin")).toBe(true);
    expect(canManageDeviceLock("manager")).toBe(true);
    expect(canManageDeviceLock("admin")).toBe(true);
    expect(canManageDeviceLock("kasir")).toBe(false);
    expect(canManageDeviceLock(undefined)).toBe(false);
  });
  it("hanya kasir yang auto-kunci saat login pertama", () => {
    expect(shouldAutoLock("kasir")).toBe(true);
    expect(shouldAutoLock("superadmin")).toBe(false);
    expect(shouldAutoLock("admin")).toBe(false);
  });
});

describe("decideWithLock", () => {
  it("tanpa kunci → jalur geofence biasa", () => {
    expect(decideWithLock(null, "kasir", "mjl", stores)).toEqual({ kind: "no-lock" });
  });
  it("kasir toko yang sama → pakai kunci (tanpa GPS)", () => {
    expect(decideWithLock(lock, "kasir", "mjl", stores)).toEqual({ kind: "use-lock", storeId: "mjl" });
  });
  it("kasir toko lain → ditolak dengan nama kedua toko", () => {
    const r = decideWithLock(lock, "kasir", "ktb", stores);
    expect(r.kind).toBe("blocked");
    if (r.kind === "blocked") {
      expect(r.message).toContain("MJL");
      expect(r.message).toContain("KTB");
    }
  });
  it("role lintas-toko selalu lolos, toko aktif = toko tablet", () => {
    for (const role of ["superadmin", "manager", "admin"]) {
      expect(decideWithLock(lock, role, null, stores)).toEqual({ kind: "use-lock", storeId: "mjl" });
    }
  });
  it("kunci basi (toko tak ada lagi di daftar) → diabaikan; daftar belum termuat → kunci dipakai", () => {
    expect(decideWithLock({ ...lock, storeId: "hilang" }, "kasir", "mjl", stores)).toEqual({ kind: "no-lock" });
    expect(decideWithLock(lock, "kasir", "mjl", [])).toEqual({ kind: "use-lock", storeId: "mjl" });
  });
});

describe("resolveGpsLock (scan GPS untuk mengunci)", () => {
  it("di dalam radius → toko terdekat", () => {
    const r = resolveGpsLock({ lat: -7.70001, lng: 110.36001 }, stores);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.store.id).toBe("mjl");
  });
  it("di luar radius → pesan memuat toko terdekat & jarak", () => {
    const r = resolveGpsLock({ lat: -7.71, lng: 110.36 }, stores);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("MJL");
  });
  it("tak ada koordinat toko → pesan arahan Pengaturan", () => {
    const r = resolveGpsLock({ lat: 0, lng: 0 }, [{ id: "a", name: "A", lat: null, lng: null }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("Pengaturan");
  });
});
