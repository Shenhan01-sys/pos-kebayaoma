// lib/report-data.ts — E3: satu sumber kebenaran angka laporan (UI == PDF == xlsx).
// Model P&L: Omzet − HPP − Pengeluaran(v1=0) = Bersih. HPP per baris dari
// transaction_items.cost_price; baris tanpa modal → kelompok "Tanpa modal" (AC-E3#6).

import { toLocalDayKey } from "@/lib/dummy";
import type { Transaction } from "@/lib/dummy";
import { expenseInScope, expensesByCategory, type Expense } from "@/lib/expenses";

export interface ReportLine {
  number: string;
  date: string;
  cashier: string;
  method: string;
  storeId?: string;
  product: string;
  sku: string;
  qty: number;
  unitPrice: number;
  unitCost: number | null; // null = tanpa modal
  lineDiscount: number;
  lineTotal: number;
  margin: number; // lineTotal − (unitCost×qty) ; tanpa modal → margin = lineTotal (belum dikurangi HPP)
  hasCost: boolean;
}

export interface Report {
  sales: number;
  count: number;
  avg: number;
  discount: number;
  tax: number;
  hpp: number; // hanya dari baris ber-modal
  unknownQty: number; // qty baris tanpa modal
  unknownRev: number; // revenue baris tanpa modal
  expenses: number; // E8: Σ pengeluaran petty cash dalam scope+periode
  bersih: number;
  byCategory: [string, number][]; // E8: rekap pengeluaran per kategori
  byMethod: Record<string, number>;
  byDay: [string, number][];
  topProducts: [string, { qty: number; rev: number }][];
  lines: ReportLine[];
}

const R = (n: number) => Math.round(n);

export function computeReport(
  txs: Transaction[],
  storeId: string | null,
  from?: string,
  to?: string,
  expenses: Expense[] = []
): Report {
  const scope = txs.filter((t) => {
    if (t.status !== "paid") return false;
    if (storeId && t.storeId !== storeId) return false;
    const d = new Date(t.createdAt);
    if (from && d < new Date(from + "T00:00:00")) return false;
    if (to && d > new Date(to + "T23:59:59")) return false;
    return true;
  });

  const sales = scope.reduce((s, t) => s + t.total, 0);
  const count = scope.length;
  const discount = scope.reduce((s, t) => s + (t.discount ?? 0), 0);
  const tax = scope.reduce((s, t) => s + (t.tax ?? 0), 0);
  const avg = count ? R(sales / count) : 0;

  let hpp = 0, unknownQty = 0, unknownRev = 0;
  const byMethod: Record<string, number> = {};
  const byDayMap: Record<string, number> = {};
  const prodMap: Record<string, { qty: number; rev: number }> = {};
  const lines: ReportLine[] = [];

  for (const t of scope) {
    byMethod[t.paymentMethod] = (byMethod[t.paymentMethod] ?? 0) + t.total;
    const day = toLocalDayKey(t.createdAt);
    byDayMap[day] = (byDayMap[day] ?? 0) + t.total;
    for (const it of t.items ?? []) {
      const hasCost = it.costPrice != null && it.costPrice > 0;
      const cost = hasCost ? it.costPrice * it.quantity : 0;
      if (hasCost) hpp += cost;
      else { unknownQty += it.quantity; unknownRev += it.total; }
      prodMap[it.name] = prodMap[it.name] ?? { qty: 0, rev: 0 };
      prodMap[it.name].qty += it.quantity;
      prodMap[it.name].rev += it.total;
      lines.push({
        number: t.number,
        date: t.createdAt,
        cashier: t.cashier,
        method: t.paymentMethod,
        storeId: t.storeId,
        product: it.name,
        sku: it.sku,
        qty: it.quantity,
        unitPrice: it.unitPrice,
        unitCost: hasCost ? it.costPrice : null,
        lineDiscount: it.discount ?? 0,
        lineTotal: it.total,
        margin: it.total - cost,
        hasCost,
      });
    }
  }

  // E8: pengeluaran petty cash — scope toko sama dengan transaksi + rentang tanggal sama.
  // expense.storeId null = umum/gabungan → hanya dihitung di scope "semua toko".
  const scopedExpenses = expenses.filter((e) => {
    if (!expenseInScope(e, storeId)) return false;
    const d = new Date(e.date + "T00:00:00");
    if (from && d < new Date(from + "T00:00:00")) return false;
    if (to && d > new Date(to + "T23:59:59")) return false;
    return true;
  });
  const expensesTotal = scopedExpenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = expensesByCategory(scopedExpenses);
  const bersih = sales - hpp - expensesTotal;
  const byDay = Object.entries(byDayMap).sort((a, b) => a[0].localeCompare(b[0]));
  const topProducts = Object.entries(prodMap).sort((a, b) => b[1].rev - a[1].rev);

  return { sales, count, avg, discount, tax, hpp, unknownQty, unknownRev, expenses: expensesTotal, bersih, byCategory, byMethod, byDay, topProducts, lines };
}
