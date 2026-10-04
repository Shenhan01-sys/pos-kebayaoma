import { describe, expect, it } from "vitest";
import { computeDashboard } from "./dashboard-data";
import type { Transaction, TransactionItem } from "./dummy";

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

const item = (name: string, qty: number): TransactionItem =>
  ({ name, quantity: qty } as TransactionItem);

describe("B2 computeDashboard — sewa terpisah dari penjualan", () => {
  it("campuran: omzet KPI = penjualan + sewa; donut & terlaris hanya penjualan", () => {
    const d = computeDashboard([
      mk({ total: 100000, paymentMethod: "cash", items: [item("Kebaya A", 1)] }),
      mk({ total: 50000, paymentMethod: "qris", items: [item("Kebaya A", 2)] }),
      mk({ kind: "rental", total: 105000, paymentMethod: "cash", items: [item("Kebaya Sewa", 1)] }),
    ]);
    expect(d.sales).toBe(255000); // KPI total tetap (paritas semantik E19)
    expect(d.salesOnly).toBe(150000);
    expect(d.rental).toEqual({ total: 105000, count: 1 });
    expect(d.count).toBe(3);
    expect(d.byMethod).toEqual({ cash: 100000, qris: 50000 }); // sewa tidak masuk donut
    expect(d.methodTotal).toBe(150000);
    expect(d.topProducts).toEqual([["Kebaya A", 3]]); // sewa tidak masuk terlaris
  });

  it("nota non-lunas (pending/cancelled) tidak dihitung apa pun", () => {
    const d = computeDashboard([
      mk({ kind: "rental", total: 70000, status: "pending", items: [item("Sewa", 1)] }),
      mk({ total: 90000, status: "cancelled", items: [item("Batal", 1)] }),
    ]);
    expect(d.sales).toBe(0);
    expect(d.rental).toEqual({ total: 0, count: 0 });
    expect(d.count).toBe(0);
    expect(d.byMethod).toEqual({});
    expect(d.topProducts).toEqual([]);
  });

  it("preorder lunas dihitung sebagai penjualan (aturan E6)", () => {
    const d = computeDashboard([
      mk({ kind: "preorder", total: 80000, paymentMethod: "transfer", items: [item("PO Barang", 1)] }),
    ]);
    expect(d.salesOnly).toBe(80000);
    expect(d.byMethod).toEqual({ transfer: 80000 });
    expect(d.topProducts).toEqual([["PO Barang", 1]]);
  });

  it("semua sewa: donut & terlaris kosong, sales = nilai sewa", () => {
    const d = computeDashboard([
      mk({ kind: "rental", total: 105000, paymentMethod: "qris", items: [item("Kebaya", 1)] }),
      mk({ kind: "rental", total: 35000, paymentMethod: "cash", items: [item("Kain", 1)] }),
    ]);
    expect(d.sales).toBe(140000);
    expect(d.rental).toEqual({ total: 140000, count: 2 });
    expect(d.byMethod).toEqual({});
    expect(d.methodTotal).toBe(0);
    expect(d.topProducts).toEqual([]);
  });

  it("tanpa sewa: perilaku sama seperti agregasi lama", () => {
    const d = computeDashboard([
      mk({ total: 100000, paymentMethod: "cash", items: [item("A", 1)] }),
      mk({ total: 100000, paymentMethod: "cash", items: [item("B", 2)] }),
    ]);
    expect(d.sales).toBe(200000);
    expect(d.salesOnly).toBe(200000);
    expect(d.rental).toEqual({ total: 0, count: 0 });
    expect(d.byMethod).toEqual({ cash: 200000 });
    expect(d.topProducts).toEqual([["B", 2], ["A", 1]]);
  });

  it("daftar kosong", () => {
    expect(computeDashboard([])).toEqual({
      sales: 0,
      salesOnly: 0,
      rental: { total: 0, count: 0 },
      count: 0,
      byMethod: {},
      methodTotal: 0,
      topProducts: [],
    });
  });
});
