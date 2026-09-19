// lib/expenses.ts — E8: petty cash (pengeluaran kas kecil).
// Tabel `expenses` sudah ada di DB (seed dari 2026.xlsx "Pengeluaran"): description
// teks bebas (kebiasaan user), PIC teks bebas. Kategori = DERIVASI FE dari
// description (pemetaan dari jenis di Excel) — tidak mengubah data lama.

export interface Expense {
  id: string;
  storeId: string | null; // null = umum/gabungan (hanya dihitung di scope "semua")
  date: string; // 'YYYY-MM-DD'
  description: string;
  amount: number;
  pic: string;
  photoUrl?: string;
  createdBy?: string | null;
  createdAt: string;
}

// Jenis dari 2026.xlsx sheet "Pengeluaran" + "Lainnya" untuk sisanya.
export const EXPENSE_CATEGORIES = [
  "Listrik",
  "Alfamart",
  "Gosend",
  "Pulsa",
  "Fee Becak",
  "Pahala",
  "Ongkir",
  "Lainnya",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Klasifikasi description teks bebas → kategori (rule-based, case-insensitive). */
export function categorizeExpense(description: string): ExpenseCategory {
  const d = description.toLowerCase();
  if (d.includes("listrik")) return "Listrik";
  if (d.includes("alfa")) return "Alfamart";
  if (/g0?send/.test(d)) return "Gosend";
  if (d.includes("becak") || d === "fee") return "Fee Becak";
  if (d.includes("pulsa")) return "Pulsa";
  if (d.includes("pahala")) return "Pahala";
  if (d.includes("ongkir") || d.includes("reparasi")) return "Ongkir";
  return "Lainnya";
}

/** Rekap per kategori dari daftar expense yang sudah terfilter scope/periode. */
export function expensesByCategory(list: Expense[]): [string, number][] {
  const m: Record<string, number> = {};
  for (const e of list) {
    const c = categorizeExpense(e.description);
    m[c] = (m[c] ?? 0) + e.amount;
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

/** Apakah expense masuk scope toko? storeId null pada expense = umum/gabungan:
 *  hanya dihitung di scope "semua" (hindari dobel-hitung saat MJL+KTB dijumlah). */
export function expenseInScope(e: Expense, storeId: string | null): boolean {
  if (storeId === null) return true; // scope "semua toko" → semua masuk
  return e.storeId === storeId; // scope toko tertentu → hanya milik toko itu
}
