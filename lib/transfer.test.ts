import { describe, expect, it } from "vitest";
import { canSendTransfer, canCancelTransfer, groupBySku } from "./transfer";

const MJL = "store-mjl";
const KTB = "store-ktb";
const t = { id: "1", fromStore: MJL, toStore: KTB, qty: 5, status: "pending" as const };

describe("canSendTransfer (AC-E1a#6 UI)", () => {
  it("pengirim boleh kirim", () => {
    expect(canSendTransfer(t, MJL, false)).toBe(true);
  });
  it("penerima TIDAK boleh kirim", () => {
    expect(canSendTransfer(t, KTB, false)).toBe(false);
  });
  it("toko lain tidak boleh", () => {
    expect(canSendTransfer(t, "store-x", false)).toBe(false);
  });
  it("manager-all boleh", () => {
    expect(canSendTransfer(t, null, true)).toBe(true);
    expect(canSendTransfer(t, KTB, true)).toBe(true);
  });
});

describe("canCancelTransfer", () => {
  it("asal atau tujuan boleh batal; pihak lain tidak", () => {
    expect(canCancelTransfer(t, MJL, false)).toBe(true);
    expect(canCancelTransfer(t, KTB, false)).toBe(true);
    expect(canCancelTransfer(t, "store-x", false)).toBe(false);
  });
});

describe("groupBySku (AC-E1b#1)", () => {
  const products = [
    { id: "pa", sku: "M-01", name: "Anting", stock: 4, storeId: MJL },
    { id: "pb", sku: "m-01", name: "Anting", stock: 6, storeId: KTB },
    { id: "pc", sku: "K-02", name: "Kalung", stock: 3, storeId: MJL },
  ];
  const rows = groupBySku(products, [MJL, KTB]);

  it("satu baris per SKU (case-insensitive)", () => {
    expect(rows.map((r) => r.sku)).toEqual(expect.arrayContaining(["M-01", "K-02"]));
    expect(rows.find((r) => r.sku === "M-01")).toBeTruthy();
    expect(rows.filter((r) => r.sku.toLowerCase() === "m-01")).toHaveLength(1);
  });
  it("Total == MJL + KTB (0 mismatch)", () => {
    const m = rows.find((r) => r.sku === "M-01")!;
    expect(m.byStore[MJL]).toBe(4);
    expect(m.byStore[KTB]).toBe(6);
    expect(m.total).toBe(m.byStore[MJL] + m.byStore[KTB]);
  });
  it("urut nama", () => {
    expect(rows[0].name.localeCompare(rows[1].name)).toBeLessThan(0);
  });
  it("productIds per toko utk aksi adjust Gabungan", () => {
    const m = rows.find((r) => r.sku === "M-01")!;
    expect(m.productIds[MJL]).toBe("pa");
    expect(m.productIds[KTB]).toBe("pb");
  });
});
