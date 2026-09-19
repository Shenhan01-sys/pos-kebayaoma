import { describe, expect, it } from "vitest";
import { evaluateGeofence, haversineMeters, type GeoStore } from "./geo";

// MJL & KTB dummy: 1 derajat lat ≈ 111.320 m; 0.001° ≈ 111 m.
const stores: GeoStore[] = [
  { id: "mjl", name: "MJL", lat: -7.0, lng: 112.0 },
  { id: "ktb", name: "KTB", lat: -7.001, lng: 112.0 }, // ±111 m dari MJL
];

describe("haversineMeters", () => {
  it("jarak nol saat titik sama", () => {
    expect(haversineMeters({ lat: -7, lng: 112 }, { lat: -7, lng: 112 })).toBe(0);
  });
  it("±111 m untuk 0.001° latitude", () => {
    const d = haversineMeters({ lat: -7, lng: 112 }, { lat: -7.001, lng: 112 });
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(125);
  });
});

describe("evaluateGeofence (E9)", () => {
  const atMJL = { lat: -7.000005, lng: 112 }; // ~0.6 m dari MJL
  const far = { lat: -6.95, lng: 112.05 }; // >5 km dari kedua toko

  it("fail-open: tidak ada toko ber-koordinat → semua boleh masuk", () => {
    const r = evaluateGeofence("kasir", [{ id: "x", name: "X", lat: null, lng: null }], far);
    expect(r).toEqual({ kind: "ok", storeId: null });
  });

  it("kasir di dalam radius → ok (presence check)", () => {
    const r = evaluateGeofence("kasir", stores, atMJL);
    expect(r).toEqual({ kind: "ok", storeId: "mjl" });
  });

  it("kasir di luar radius → blocked", () => {
    const r = evaluateGeofence("kasir", stores, far);
    expect(r.kind).toBe("blocked");
  });

  it("admin di luar radius → blocked (aturan sama dgn kasir)", () => {
    expect(evaluateGeofence("admin", stores, far).kind).toBe("blocked");
  });

  it("superadmin di dalam radius → auto pilih toko; di luar → global", () => {
    expect(evaluateGeofence("superadmin", stores, atMJL)).toEqual({ kind: "ok", storeId: "mjl" });
    expect(evaluateGeofence("superadmin", stores, far)).toEqual({ kind: "pass-global" });
  });

  it("manager di luar radius → global (tidak diblok)", () => {
    expect(evaluateGeofence("manager", stores, far)).toEqual({ kind: "pass-global" });
  });

  it("nearest dipilih saat dua toko berdekatan", () => {
    const r = evaluateGeofence("kasir", stores, { lat: -7.0009, lng: 112 }); // lebih dekat KTB? 0.0009 dari MJL, 0.0001 dari KTB
    expect(r.kind === "ok" && r.storeId).toBe("ktb");
  });
});
