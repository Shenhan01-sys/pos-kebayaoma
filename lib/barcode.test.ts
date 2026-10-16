import { describe, expect, it } from "vitest";
import { encodeVoBarcode, isCode128Printable, parseVoBarcode, resolveVoScan } from "./barcode";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("encodeVoBarcode / parseVoBarcode", () => {
  it("round-trip variant+vendor", () => {
    const code = encodeVoBarcode(UUID_A, UUID_B);
    expect(code).toBe(`VO:${UUID_A}:${UUID_B}`);
    expect(parseVoBarcode(code)).toEqual({ refId: UUID_A, vendorId: UUID_B });
  });

  it("tolak kode non-VO", () => {
    expect(parseVoBarcode("123456789")).toBeNull();
    expect(parseVoBarcode("TRX-20260909-001")).toBeNull();
    expect(parseVoBarcode("VO:")).toBeNull();
    expect(parseVoBarcode("VO:tanpakoma")).toBeNull();
    expect(parseVoBarcode(`VO:${UUID_A}:`)).toBeNull();
  });

  it("UUID dengan '-' aman (pemisah ':')", () => {
    const code = encodeVoBarcode(UUID_A, UUID_B);
    const p = parseVoBarcode(code)!;
    expect(p.refId).toMatch(/^1111/);
    expect(p.vendorId).toBe(UUID_B);
  });
});

describe("resolveVoScan", () => {
  const candidates = [
    { productId: "P1", productStock: 5, variantId: "V1" },
    { productId: "P2", productStock: 10, variantId: "V2a" },
    { productId: "P2", productStock: 10, variantId: "V2b" },
  ];

  it("ref = variant id → varian persis", () => {
    expect(resolveVoScan({ refId: "V2b", vendorId: "X" }, candidates)?.variantId).toBe("V2b");
  });

  it("ref = product id (multi varian) → varian pertama produk itu", () => {
    expect(resolveVoScan({ refId: "P2", vendorId: "X" }, candidates)?.variantId).toBe("V2a");
  });

  it("ref tak dikenal → null", () => {
    expect(resolveVoScan({ refId: "nope", vendorId: "X" }, candidates)).toBeNull();
  });
});

describe("isCode128Printable", () => {
  it("kosong / spasi / null → tidak bisa dicetak", () => {
    for (const c of ["", "   ", null, undefined]) expect(isCode128Printable(c)).toBe(false);
  });
  it("kode angka & teks ASCII → bisa", () => {
    for (const c of ["652544", "ANTING-ANTING-S", "VO:abc:def"]) expect(isCode128Printable(c)).toBe(true);
  });
  it("karakter non-ASCII (mis. é, ·) → tidak bisa (JsBarcode CODE128 menolak)", () => {
    expect(isCode128Printable("KEBAYA-É")).toBe(false);
    expect(isCode128Printable("A·B")).toBe(false);
  });
});
