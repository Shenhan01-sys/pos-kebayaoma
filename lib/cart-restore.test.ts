import { describe, expect, it } from "vitest";
import { CART_TTL_MS, restoreCart } from "./cart-restore";

const now = 1_800_000_000_000;
const saved = { lines: [{ key: "v1", quantity: 2 }], customerName: "Sari", discount: 5000, rental: null, savedAt: now - 60_000 };

const header = { days: 3, startDate: "2026-11-20", dueDate: "2026-11-23", customerName: "Sari", customerPhone: "0857" };
const rLine = (variantId: string, quantity: number) => ({ key: variantId, variantId, quantity, rental: true });

describe("restoreCart", () => {
  it("keranjang baru dipulihkan utuh", () => {
    expect(restoreCart(saved, now)).toEqual({ lines: saved.lines, customerName: "Sari", discount: 5000, rental: null });
  });
  it("basi (> TTL), tanpa savedAt, atau rusak → tidak dipulihkan", () => {
    expect(restoreCart({ ...saved, savedAt: now - CART_TTL_MS - 1 }, now)).toBeNull();
    expect(restoreCart({ ...saved, savedAt: undefined }, now)).toBeNull();
    expect(restoreCart({ ...saved, lines: "x" as never }, now)).toBeNull();
    expect(restoreCart(null, now)).toBeNull();
  });
  it("diskon tidak valid jadi 0", () => {
    expect(restoreCart({ ...saved, discount: -3 }, now)?.discount).toBe(0);
  });
});

describe("restoreCart — draft sewa multi-barang", () => {
  it("draft baru (lines) yang cocok dengan baris keranjang dipulihkan", () => {
    const rental = {
      ...header,
      lines: [
        { productId: "p1", variantId: "v1", qty: 2, rentPrice: 75000, deposit: 20000 },
        { productId: "p2", variantId: "v2", qty: 1, rentPrice: 50000, deposit: null },
      ],
    };
    const r = restoreCart({ ...saved, discount: 0, lines: [rLine("v1", 2), rLine("v2", 1)], rental }, now);
    expect(r?.rental).toEqual(rental);
    expect(r?.lines).toHaveLength(2);
    expect(r?.customerName).toBe("Sari");
  });
  it("draft LAMA (satu barang, tanpa lines) dikonversi ke lines: [satu baris]", () => {
    const old = { ...header, productId: "p1", variantId: "v1", qty: 2, rentPrice: 75000, deposit: 20000 };
    const r = restoreCart({ ...saved, discount: 0, lines: [rLine("v1", 2)], rental: old }, now);
    expect(r?.rental).toEqual({
      ...header,
      lines: [{ productId: "p1", variantId: "v1", qty: 2, rentPrice: 75000, deposit: 20000 }],
    });
    expect(r?.lines).toHaveLength(1);
  });
  it("draft lama dengan deposit null tetap dikonversi", () => {
    const old = { ...header, customerPhone: null, productId: "p1", variantId: "v1", qty: 1, rentPrice: 75000, deposit: null };
    const r = restoreCart({ ...saved, lines: [rLine("v1", 1)], rental: old }, now);
    expect(r?.rental?.lines).toEqual([{ productId: "p1", variantId: "v1", qty: 1, rentPrice: 75000, deposit: null }]);
    expect(r?.rental?.customerPhone).toBeNull();
  });
  it("draft rusak → dibuang BESERTA baris sewa & nama penyewa; baris biasa tetap", () => {
    const r = restoreCart({ ...saved, lines: [rLine("v1", 2), { key: "v9", quantity: 1 }], rental: { days: 3 } }, now);
    expect(r?.rental).toBeNull();
    expect(r?.lines).toEqual([{ key: "v9", quantity: 1 }]);
    expect(r?.customerName).toBeNull();
  });
  it("draft dengan baris tidak valid (qty 0 / tanpa variantId / lines kosong) → dibuang", () => {
    const bad = (lines: unknown[]) => restoreCart({ ...saved, lines: [rLine("v1", 2)], rental: { ...header, lines } }, now)?.rental;
    expect(bad([{ productId: "p1", variantId: "v1", qty: 0, rentPrice: 1, deposit: null }])).toBeNull();
    expect(bad([{ productId: "p1", qty: 2, rentPrice: 1, deposit: null }])).toBeNull();
    expect(bad([])).toBeNull();
  });
  it("draft & baris keranjang tidak cocok (qty beda / baris hilang) → sewa dibuang", () => {
    const rental = { ...header, lines: [{ productId: "p1", variantId: "v1", qty: 2, rentPrice: 75000, deposit: null }] };
    expect(restoreCart({ ...saved, lines: [rLine("v1", 3)], rental }, now)?.rental).toBeNull();
    const r = restoreCart({ ...saved, lines: [], rental }, now);
    expect(r?.rental).toBeNull();
    expect(r?.lines).toEqual([]);
  });
  it("baris sewa tanpa draft → dibuang (tidak boleh ikut checkout sebagai penjualan)", () => {
    const r = restoreCart({ ...saved, lines: [rLine("v1", 2), { key: "v9", quantity: 1 }], rental: null }, now);
    expect(r?.lines).toEqual([{ key: "v9", quantity: 1 }]);
    expect(r?.customerName).toBe("Sari");
  });
});
