import { describe, expect, it } from "vitest";
import { humanizeError, maxTransferMsg } from "./errors";

describe("humanizeError (AC-E10#2–4)", () => {
  it("memetakan SEMUA kode RPC ke kalimat Indonesia", () => {
    const codes = [
      "insufficient_stock", "store_scope", "forbidden_role", "product_not_found",
      "variant_not_found", "transfer_not_found", "transfer_not_pending",
      "rental_not_found", "too_many_returned", "no_rental_price", "qty_invalid",
      "invalid_movement_type",
    ];
    for (const code of codes) {
      const msg = humanizeError(new Error(code));
      expect(msg).not.toMatch(/_/);
      expect(msg.length).toBeGreaterThan(15);
    }
  });
  it("insufficient_stock + ctx.stock → pesan dengan angka riil (standar user)", () => {
    expect(humanizeError(new Error("insufficient_stock"), { stock: 4 }))
      .toBe("Kapasitas tidak mencukupi, maksimal hanya 4.");
  });
  it("kode di dalam pesan panjang tetap tertangkap", () => {
    expect(humanizeError(new Error("ERROR: insufficient_stock\nCONTEXT: ...")))
      .toBe("Stok tidak mencukupi untuk jumlah ini.");
  });
  it("masalah jaringan → pesan koneksi", () => {
    expect(humanizeError(new TypeError("Failed to fetch"))).toMatch(/Koneksi/);
  });
  it("kalimat manusiawi lolos apa adanya", () => {
    expect(humanizeError("Pilih toko operasional (MJL/KTB) dulu.")).toBe(
      "Pilih toko operasional (MJL/KTB) dulu."
    );
  });
  it("kode tak dikenal → fallback sopan tanpa snake_case", () => {
    const msg = humanizeError({ message: "weird_db_code" }, { action: "menyimpan stok" });
    expect(msg).toBe("Gagal saat menyimpan stok — coba lagi. Kalau terus gagal, hubungi manager.");
  });
  it("string langsung & null aman", () => {
    expect(humanizeError("store_scope")).toMatch(/tidak punya akses/);
    expect(humanizeError(null)).toMatch(/Gagal/);
  });
});

describe("maxTransferMsg (AC-E10#1)", () => {
  it("format persis sesuai permintaan user", () => {
    expect(maxTransferMsg(3)).toBe("Kapasitas tidak mencukupi, maksimal transfer hanya 3.");
  });
});
