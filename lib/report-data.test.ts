import { describe, expect, it } from "vitest";
import { computeReport } from "./report-data";
import type { Transaction } from "@/lib/dummy";

const mk = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36),
  number: "T",
  cashier: "c",
  status: "paid",
  paymentMethod: "cash",
  paymentStatus: "paid",
  subtotal: 0,
  tax: 0,
  discount: 0,
  total: 0,
  amountPaid: 0,
  change: 0,
  createdAt: "2026-09-01T10:00:00Z",
  items: [],
  ...over,
} as Transaction);

const item = (name: string, qty: number, price: number, cost: number | null, total: number) => ({
  productId: name, variantId: name, name, sku: name, size: "S", color: "x",
  quantity: qty, unitPrice: price, costPrice: cost ?? 0, discount: 0, total,
});

describe("computeReport (E3)", () => {
  const txs: Transaction[] = [
    mk({ number: "N1", total: 100000, tax: 9090, storeId: "MJL",
      items: [item("Anting", 2, 50000, 40000, 100000), item("Kardus", 1, 0, null, 0)] }),
    mk({ number: "N2", total: 60000, storeId: "KTB", discount: 5000,
      items: [item("Kalung", 1, 60000, 45000, 55000)] }),
    mk({ number: "N3", total: 999999, status: "cancelled", storeId: "MJL",
      items: [item("Batal", 9, 99999, 1, 999999)] }),
  ];

  it("hanya status paid yang dihitung", () => {
    const r = computeReport(txs, null);
    expect(r.count).toBe(2);
    expect(r.sales).toBe(160000);
  });

  it("filter outlet: MJL vs KTB vs Semua", () => {
    expect(computeReport(txs, "MJL").sales).toBe(100000);
    expect(computeReport(txs, "KTB").sales).toBe(60000);
    expect(computeReport(txs, null).sales).toBe(160000);
  });

  it("P&L: bersih = omzet − HPP (tanpa-modol dikecualikan dari HPP)", () => {
    const r = computeReport(txs, null);
    expect(r.hpp).toBe(80000 + 45000);
    expect(r.unknownQty).toBe(1); // Kardus cost null
    expect(r.bersih).toBe(160000 - 125000 - 0);
  });

  it("akuntansi penuh: setiap baris masuk tepat 1 kelompok (ber-modal / tanpa-modal)", () => {
    const r = computeReport(txs, null);
    const withCost = r.lines.filter((l) => l.hasCost);
    const without = r.lines.filter((l) => !l.hasCost);
    expect(withCost.length + without.length).toBe(r.lines.length);
    expect(r.unknownQty).toBe(without.reduce((a, l) => a + l.qty, 0));
    // HPP == Σ(unitCost×qty) baris ber-modal
    expect(r.hpp).toBe(withCost.reduce((a, l) => a + (l.unitCost ?? 0) * l.qty, 0));
  });

  it("byMethod & byDay & topProducts konsisten", () => {
    const r = computeReport(txs, null);
    expect(r.byMethod.cash).toBe(160000);
    expect(Object.values(r.byMethod).reduce((a, b) => a + b, 0)).toBe(r.sales);
    expect(r.topProducts[0][0]).toBe("Anting");
  });

  it("AC-E3#2: buildSheets memakai angka IDENTIK dgn report (sumber tunggal)", async () => {
    const { buildSheets } = await import("./report-export");
    const r = computeReport(txs, null);
    const { summary, detail } = buildSheets(r, { storeLabel: "SEMUA", from: "", to: "" });
    const find = (label: string) => (summary.find((row) => row[0] === label) ?? [])[1];
    expect(find("Omzet")).toBe(r.sales);
    expect(find("HPP")).toBe(r.hpp);
    expect(find("Keuntungan Bersih")).toBe(r.bersih);
    // baris detail == baris report
    expect(detail.length - 1).toBe(r.lines.length);
    // kolom margin numerik riil (number, bukan string)
    const numCols = [7, 8, 9, 11];
    expect(typeof (detail[1] as any)[7]).toBe("number");
    expect(typeof (detail[1] as any)[11]).toBe("number");
    void numCols;
  });
});
