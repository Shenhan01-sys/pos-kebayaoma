import { describe, expect, it } from "vitest";
import { buildEscposReceipt, bytesToBase64, ESCPOS_COLS, leftRight, toAscii, wrap } from "./escpos-receipt";
import type { Transaction } from "./dummy";

const store = { storeName: "Kebaya Oma", address: "Jalan Monjali 55, Yogyakarta", phone: "" };
const base: Transaction = {
  id: "t1",
  number: "MJL20261120-001",
  cashier: "Putri",
  customerName: "Sari",
  status: "paid",
  paymentMethod: "cash",
  paymentStatus: "paid",
  subtotal: 140000,
  tax: 0,
  discount: 0,
  total: 140000,
  amountPaid: 150000,
  change: 10000,
  createdAt: "2026-11-20T03:00:00.000Z",
  items: [
    { productId: "p", variantId: "v", name: "Kebaya Brokat Panjang Sekali Namanya Lho", sku: "123", size: "M", color: "Merah", quantity: 2, unitPrice: 70000, costPrice: 0, discount: 0, total: 140000 },
  ],
};

/** teks yang tercetak (byte kontrol dibuang) per baris */
const printed = (bytes: Uint8Array) => {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x1b) { i += bytes[i + 1] === 0x40 ? 1 : 2; continue; } // ESC @ / ESC a n / ESC E n
    if (b === 0x1d && bytes[i + 1] === 0x21) { i += 2; continue; } // GS ! n
    if (b === 0x1d && bytes[i + 1] === 0x28) { i += 4 + (bytes[i + 3] | (bytes[i + 4] << 8)); continue; } // GS ( k pL pH …
    out += b === 0x0a ? "\n" : String.fromCharCode(b);
  }
  return out;
};

describe("toAscii / wrap / leftRight", () => {
  it("unicode diganti ASCII", () => {
    expect(toAscii("Rp 150.000 — ok × 2…")).toBe("Rp 150.000 - ok x 2...");
    expect(toAscii("Café")).toBe("Cafe");
  });
  it("baris tidak pernah melebihi lebar kertas", () => {
    for (const l of wrap("Kebaya Brokat Panjang Sekali Namanya Lho dan masih panjang lagi ya")) expect(l.length).toBeLessThanOrEqual(ESCPOS_COLS);
    expect(wrap("x".repeat(ESCPOS_COLS + 8))).toEqual(["x".repeat(ESCPOS_COLS), "x".repeat(8)]);
  });
  it("kiri-kanan rata kanan; tak muat → nilai di baris sendiri", () => {
    expect(ESCPOS_COLS).toBe(48);
    expect(leftRight("Subtotal", "Rp 140.000")).toEqual(["Subtotal" + " ".repeat(ESCPOS_COLS - 8 - 10) + "Rp 140.000"]);
    const r = leftRight("x".repeat(ESCPOS_COLS - 2), "Rp 140.000");
    expect(r).toHaveLength(2);
    expect(r[1].endsWith("Rp 140.000")).toBe(true);
    expect(r[1]).toHaveLength(ESCPOS_COLS);
  });
});

describe("buildEscposReceipt", () => {
  it("init printer, isi nota penjualan, tanpa baris Telp bila kosong", () => {
    const b = buildEscposReceipt(base, store);
    expect(Array.from(b.slice(0, 2))).toEqual([0x1b, 0x40]);
    const t = printed(b);
    expect(t).toContain("KEBAYA OMA");
    expect(t).toContain("Jalan Monjali 55, Yogyakarta");
    expect(t).not.toContain("Telp:");
    expect(t).toContain("MJL20261120-001");
    expect(t).toContain("Pelanggan: Sari");
    expect(t).toContain("Bayar (CASH)");
    expect(t).toContain("Kembali");
    expect(t).toContain("Barang tidak bisa dikembalikan");
    expect(t).not.toContain("SEWA");
    for (const line of t.split("\n")) expect(line.length).toBeLessThanOrEqual(ESCPOS_COLS);
  });
  it("nota sewa: label, penyewa, telp, kaki sewa", () => {
    const t = printed(buildEscposReceipt({ ...base, kind: "rental", dueDate: "2026-11-25" }, store, { renterPhone: "0812" }));
    expect(t).toContain("*** SEWA ***");
    expect(t).toContain("Penyewa: Sari");
    expect(t).toContain("Telp penyewa: 0812");
    expect(t).not.toContain("Barang tidak bisa dikembalikan");
  });
  it("QR verifikasi memakai perintah GS ( k bila URL diberikan", () => {
    const b = Array.from(buildEscposReceipt(base, store, { verifyUrl: "https://x.id/verify/t1" }));
    const at = b.findIndex((v, i) => v === 0x1d && b[i + 1] === 0x28 && b[i + 2] === 0x6b);
    expect(at).toBeGreaterThan(0);
    expect(printed(Uint8Array.from(b))).toContain("Scan untuk verifikasi resmi");
    expect(printed(buildEscposReceipt(base, store))).not.toContain("Scan untuk verifikasi");
  });
  it("Mode Latihan: tanda LATIHAN & BUKAN NOTA SAH, tanpa QR verifikasi", () => {
    const b = buildEscposReceipt({ ...base, training: true, number: "LATIHAN-231500" }, store, { verifyUrl: "https://x.id/verify/t1" });
    const t = printed(b);
    expect(t).toContain("*** LATIHAN ***");
    expect(t).toContain("BUKAN NOTA SAH");
    expect(t).not.toContain("Scan untuk verifikasi");
    const arr = Array.from(b);
    expect(arr.some((v, i) => v === 0x1d && arr[i + 1] === 0x28 && arr[i + 2] === 0x6b)).toBe(false);
    expect(printed(buildEscposReceipt(base, store))).not.toContain("LATIHAN");
  });
  it("base64 bolak-balik", () => {
    const b = buildEscposReceipt(base, store);
    expect(Buffer.from(bytesToBase64(b), "base64").equals(Buffer.from(b))).toBe(true);
  });
});
