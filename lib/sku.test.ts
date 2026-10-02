import { describe, expect, it } from "vitest";
import { ensureProductSku, fillVariantSkus, generateSkuCode, SKU_LENGTH, takenCodes } from "./sku";

// RNG deterministik agar tes tidak flaky
const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("generateSkuCode", () => {
  it("8 digit angka, digit pertama 1–9", () => {
    for (let n = 0; n < 200; n++) {
      const c = generateSkuCode(new Set());
      expect(c).toMatch(/^[1-9]\d{7}$/);
      expect(c).toHaveLength(SKU_LENGTH);
    }
  });
  it("unik terhadap kode yang sudah terpakai & kode baru masuk ke set", () => {
    const taken = new Set<string>();
    const codes = new Set<string>();
    for (let n = 0; n < 500; n++) codes.add(generateSkuCode(taken));
    expect(codes.size).toBe(500);
    expect(taken.size).toBe(500);
  });
  it("kode bentrok → mencoba lagi sampai unik", () => {
    // RNG: percobaan 1 menghasilkan 10000000 (bentrok), percobaan 2 menghasilkan 15555555
    const r = seq([0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const taken = new Set(["10000000"]);
    expect(generateSkuCode(taken, r)).toBe("15555555");
  });
});

describe("takenCodes", () => {
  const products = [
    { id: "a", sku: "P1", variants: [{ sku: "V1", barcode: "B1" }, { sku: "V2", barcode: null }] },
    { id: "b", sku: "P2", variants: [{ sku: "V3" }] },
  ];
  it("mengumpulkan SKU produk, SKU varian, dan barcode varian", () => {
    expect([...takenCodes(products)].sort()).toEqual(["B1", "P1", "P2", "V1", "V2", "V3"]);
  });
  it("skip produk yang sedang diedit", () => {
    expect([...takenCodes(products, (p) => p.id === "a")].sort()).toEqual(["P2", "V3"]);
  });
  it("mengabaikan kosong/spasi", () => {
    expect(takenCodes([{ sku: "  ", variants: [{ sku: "" }] }]).size).toBe(0);
  });
});

describe("fillVariantSkus — penyebab 409 (SKU varian kosong/kembar)", () => {
  it("dua varian SKU kosong (kasus 409) → dua kode berbeda", () => {
    const out = fillVariantSkus([{ sku: "" }, { sku: "" }], new Set());
    expect(out[0].sku).toMatch(/^\d{8}$/);
    expect(out[1].sku).toMatch(/^\d{8}$/);
    expect(out[0].sku).not.toBe(out[1].sku);
  });
  it("SKU kembar dalam satu produk → yang kedua diganti, yang pertama dipertahankan", () => {
    const out = fillVariantSkus([{ sku: "ABC" }, { sku: "ABC" }, { sku: "XYZ" }], new Set());
    expect(out[0].sku).toBe("ABC");
    expect(out[1].sku).not.toBe("ABC");
    expect(out[2].sku).toBe("XYZ");
    expect(new Set(out.map((v) => v.sku)).size).toBe(3);
  });
  it("SKU yang bentrok dengan produk lain diganti; SKU lama yang unik tidak berubah", () => {
    const out = fillVariantSkus([{ sku: "LAMA-1" }, { sku: "PAKAI-LAIN" }], new Set(["PAKAI-LAIN"]));
    expect(out[0].sku).toBe("LAMA-1");
    expect(out[1].sku).not.toBe("PAKAI-LAIN");
  });
  it("properti varian lain tidak berubah", () => {
    const out = fillVariantSkus([{ sku: "", name: "S", price: 5 }], new Set());
    expect(out[0]).toMatchObject({ name: "S", price: 5 });
  });
  it("hasil akhir selalu unik (50 varian kosong)", () => {
    const out = fillVariantSkus(Array.from({ length: 50 }, () => ({ sku: "" })), new Set());
    expect(new Set(out.map((v) => v.sku)).size).toBe(50);
  });
});

describe("ensureProductSku", () => {
  it("kosong → kode otomatis", () => {
    expect(ensureProductSku("", new Set())).toMatch(/^\d{8}$/);
    expect(ensureProductSku("   ", new Set())).toMatch(/^\d{8}$/);
  });
  it("unik → dipertahankan; bentrok → diganti", () => {
    expect(ensureProductSku("ANTING", new Set())).toBe("ANTING");
    expect(ensureProductSku("ANTING", new Set(["ANTING"]))).not.toBe("ANTING");
  });
});
