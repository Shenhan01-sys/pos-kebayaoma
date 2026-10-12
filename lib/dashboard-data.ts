// lib/dashboard-data.ts — B2: agregasi murni untuk Dashboard `/` (pola lib/report-data.ts E19).
// Sewa (kind='rental') dipisah dari penjualan: KPI omzet tetap TOTAL (penjualan + sewa)
// dengan rincian sewa terpisah (sub-label); donut metode bayar & Produk Terlaris hanya
// penjualan murni (preorder lunas dihitung penjualan — omzet penuh saat lunas, aturan E6).

import type { Transaction } from "./dummy";
import { toLocalDayKey } from "./dummy";

export interface DashboardSummary {
  /** omzet lunas total (penjualan + sewa) — KPI utama, disertai rincian sewa */
  sales: number;
  /** omzet lunas tanpa sewa */
  salesOnly: number;
  /** rincian nota sewa lunas */
  rental: { total: number; count: number };
  /** jumlah nota lunas (semua jenis) */
  count: number;
  /** metode bayar → nilai penjualan murni (donut) */
  byMethod: Record<string, number>;
  /** total nilai byMethod */
  methodTotal: number;
  /** produk terlaris penjualan murni, terurut qty desc — pemanggil menylice sendiri */
  topProducts: [string, number][];
}

const isRental = (t: Transaction) => t.kind === "rental";

/**
 * Agregasi dashboard. B2: sewa dipisah dari penjualan.
 * E25: `today` (kunci hari lokal, mis. "2026-10-12") — bila diisi, seluruh
 * agregasi HANYA atas nota hari itu (KPI berlabel "Hari Ini"; semula terlanjur
 * menjumlah 200 nota terakhir lintas bulan sehingga angka terasa tak berubah).
 * `today` tidak diisi = semua waktu (kompatibel pemanggil lama & unit test).
 */
export function computeDashboard(txs: Transaction[], today?: string): DashboardSummary {
  const scoped = today ? txs.filter((t) => toLocalDayKey(t.createdAt) === today) : txs;
  const paid = scoped.filter((t) => t.status === "paid");
  const salesTx = paid.filter((t) => !isRental(t));
  const rentalTx = paid.filter(isRental);

  const top: Record<string, number> = {};
  salesTx.forEach((t) =>
    t.items.forEach((it) => {
      top[it.name] = (top[it.name] ?? 0) + it.quantity;
    })
  );

  return {
    sales: paid.reduce((sum, t) => sum + t.total, 0),
    salesOnly: salesTx.reduce((sum, t) => sum + t.total, 0),
    rental: {
      total: rentalTx.reduce((sum, t) => sum + t.total, 0),
      count: rentalTx.length,
    },
    count: paid.length,
    byMethod: (() => {
      const byMethod: Record<string, number> = {};
      salesTx.forEach((t) => {
        byMethod[t.paymentMethod] = (byMethod[t.paymentMethod] ?? 0) + t.total;
      });
      return byMethod;
    })(),
    methodTotal: salesTx.reduce((sum, t) => sum + t.total, 0),
    topProducts: Object.entries(top).sort((a, b) => b[1] - a[1]),
  };
}
