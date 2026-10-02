import { describe, expect, it } from "vitest";
import { buildThermalReceiptHtml } from "./thermal-receipt";
import type { Transaction } from "./dummy";

const store = { storeName: "Kebaya Oma", address: "Jl. Contoh 1", phone: "0812" };
const base: Transaction = {
  id: "t1",
  number: "KTB20261002-013",
  cashier: "Putri",
  customerName: "Sari",
  status: "paid",
  paymentMethod: "cash",
  paymentStatus: "paid",
  subtotal: 140000,
  tax: 0,
  discount: 0,
  total: 140000,
  amountPaid: 140000,
  change: 0,
  createdAt: "2026-10-02T10:00:00.000Z",
  items: [
    { productId: "p", variantId: "v", name: "Kebaya Brokat", sku: "123", size: "M", color: "Merah", quantity: 2, unitPrice: 70000, costPrice: 0, discount: 0, total: 140000 },
  ],
};

describe("E19 struk thermal — sewa vs penjualan", () => {
  it("nota SEWA: label, penyewa, tanggal kembali, kaki struk sewa; tanpa 'tidak bisa dikembalikan'", () => {
    const html = buildThermalReceiptHtml({ ...base, kind: "rental", dueDate: "2026-10-07" }, store);
    expect(html).toContain("*** SEWA ***");
    expect(html).toContain("Penyewa: Sari");
    expect(html).toContain("Kembali: 07 Okt 2026");
    expect(html).toContain("Barang sewa wajib dikembalikan paling lambat 07 Okt 2026");
    expect(html).not.toContain("Barang tidak bisa dikembalikan");
    expect(html).not.toContain("Pelanggan: Sari");
  });
  it("nota PENJUALAN: struk persis seperti sebelumnya (tanpa elemen sewa)", () => {
    const html = buildThermalReceiptHtml({ ...base, kind: "sale" }, store);
    expect(html).not.toContain("SEWA");
    expect(html).not.toContain("Kembali:");
    expect(html).toContain("Pelanggan: Sari");
    expect(html).toContain("Barang tidak bisa dikembalikan");
  });
  it("nota PRE-ORDER & tanpa kind: tidak berubah", () => {
    expect(buildThermalReceiptHtml({ ...base, kind: "preorder", dueDate: "2026-10-07" }, store)).not.toContain("*** SEWA ***");
    expect(buildThermalReceiptHtml(base, store)).not.toContain("*** SEWA ***");
  });
  it("nama penyewa di-escape (aman dari HTML)", () => {
    const html = buildThermalReceiptHtml({ ...base, kind: "rental", dueDate: "2026-10-07", customerName: "<b>x</b>" }, store);
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
  });
});
