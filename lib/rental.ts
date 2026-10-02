// lib/rental.ts — E7: logika murni sewa (teruji vitest, dipakai UI & store).
// Status dihitung DINAMIS dari due_date vs returned_qty (tanpa cron status).
// Basis hari kalender UTC-komponen → deterministik lintas TZ (pola _logic.ts).

const DAY = 86_400_000;
const dayKey = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

export type RentalStatus = "aktif" | "jatuh-tempo" | "lewat" | "sebagian" | "selesai";

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  return new Date(d.getTime() + days * DAY).toISOString().slice(0, 10);
}

export function daysLeft(dueDate: string, today: Date): number {
  return Math.round((dayKey(new Date(dueDate + "T00:00:00Z")) - dayKey(today)) / DAY);
}

export function rentalStatus(
  r: { due_date: string; qty: number; returned_qty: number },
  today: Date
): RentalStatus {
  if (r.returned_qty >= r.qty) return "selesai";
  const dl = daysLeft(r.due_date, today);
  if (dl < 0) return r.returned_qty > 0 ? "sebagian" : "lewat";
  if (dl === 0) return "jatuh-tempo";
  return r.returned_qty > 0 ? "sebagian" : "aktif";
}

// Sisa unit yang masih harus dikembalikan.
export function outstandingQty(r: { qty: number; returned_qty?: number; returnedQty?: number }): number {
  const back = r.returned_qty ?? r.returnedQty ?? 0;
  return Math.max(0, r.qty - back);
}

// Total tagihan sewa = tarif flat × qty (deposit dipisah, tidak masuk omzet sewa).
export function rentTotal(rentPrice: number, qty: number): number {
  return Math.max(0, Math.round(rentPrice * qty));
}

// ===== E17: halaman /sewa — logika murni daftar, filter, ringkasan, WhatsApp =====

export interface RentalItem {
  id: string;
  txNumber: string;
  productName: string;
  customerName?: string | null;
  customerPhone?: string | null;
  qty: number;
  returnedQty: number;
  rentPrice: number; // tarif flat PER UNIT
  deposit?: number | null; // deposit PER UNIT (nilai varian apa adanya; total = deposit × qty)
  startDate: string;
  dueDate: string;
}

export type RentalTab = "aktif" | "terlambat" | "hari-ini" | "selesai";

export const isOpenRental = (r: Pick<RentalItem, "qty" | "returnedQty">) => r.returnedQty < r.qty;

export function statusOf(r: RentalItem, today: Date): RentalStatus {
  return rentalStatus({ due_date: r.dueDate, qty: r.qty, returned_qty: r.returnedQty }, today);
}

export function matchesTab(r: RentalItem, tab: RentalTab, today: Date): boolean {
  if (tab === "selesai") return !isOpenRental(r);
  if (!isOpenRental(r)) return false;
  const dl = daysLeft(r.dueDate, today);
  if (tab === "terlambat") return dl < 0;
  if (tab === "hari-ini") return dl === 0;
  return true; // aktif = semua yang belum kembali penuh
}

const digitsOnly = (s: string) => s.replace(/\D/g, "");

export function matchesQuery(r: RentalItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const qd = digitsOnly(q);
  return (
    r.productName.toLowerCase().includes(q) ||
    (r.customerName ?? "").toLowerCase().includes(q) ||
    r.txNumber.toLowerCase().includes(q) ||
    (qd.length >= 3 && digitsOnly(r.customerPhone ?? "").includes(qd))
  );
}

/** terbuka: jatuh tempo paling dulu (yang terlambat otomatis di atas); selesai: terbaru dulu */
export function sortRentals<T extends RentalItem>(list: T[], tab: RentalTab): T[] {
  const copy = [...list];
  copy.sort((a, b) =>
    tab === "selesai"
      ? b.dueDate.localeCompare(a.dueDate) || b.startDate.localeCompare(a.startDate)
      : a.dueDate.localeCompare(b.dueDate) || a.startDate.localeCompare(b.startDate)
  );
  return copy;
}

export function filterRentals<T extends RentalItem>(
  list: T[],
  opts: { tab: RentalTab; query: string },
  today: Date
): T[] {
  return sortRentals(
    list.filter((r) => matchesTab(r, opts.tab, today) && matchesQuery(r, opts.query)),
    opts.tab
  );
}

export interface RentalSummary {
  open: number; // jumlah sewa yang belum kembali penuh
  overdue: number;
  dueToday: number;
  unitsOut: number; // unit yang sedang di luar
  depositHeld: number; // deposit (per unit × unit yang belum kembali)
}

export function rentalSummary(list: RentalItem[], today: Date): RentalSummary {
  const s: RentalSummary = { open: 0, overdue: 0, dueToday: 0, unitsOut: 0, depositHeld: 0 };
  for (const r of list) {
    if (!isOpenRental(r)) continue;
    const out = outstandingQty(r);
    s.open++;
    s.unitsOut += out;
    s.depositHeld += (r.deposit ?? 0) * out;
    const dl = daysLeft(r.dueDate, today);
    if (dl < 0) s.overdue++;
    else if (dl === 0) s.dueToday++;
  }
  return s;
}

/** deposit total sewa ini (deposit per unit × qty) */
export const depositTotal = (r: Pick<RentalItem, "deposit" | "qty">) => (r.deposit ?? 0) * r.qty;

/** nomor HP Indonesia → format internasional tanpa "+" (08xx / +62 / 62 / 8xx), null bila tidak masuk akal */
export function normalizePhoneId(raw: string | null | undefined): string | null {
  const d = digitsOnly(raw ?? "");
  if (!d) return null;
  let n = d;
  if (n.startsWith("0")) n = "62" + n.slice(1);
  else if (n.startsWith("8")) n = "62" + n;
  if (!n.startsWith("62")) return null;
  return n.length >= 10 && n.length <= 15 ? n : null;
}

export function formatDateId(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** teks pengingat WhatsApp ke penyewa (dipakai tombol WA manual — tidak butuh Fonnte) */
export function reminderText(r: RentalItem, today: Date): string {
  const name = r.customerName?.trim() || "Kak";
  const item = `${r.productName} ×${outstandingQty(r)}`;
  const dl = daysLeft(r.dueDate, today);
  const due = formatDateId(r.dueDate);
  if (dl < 0) {
    return `Halo ${name}, pengingat dari Kebaya Oma: sewa ${item} (nota ${r.txNumber}) sudah lewat ${-dl} hari dari jatuh tempo ${due}. Mohon segera dikembalikan ya. Terima kasih 🙏`;
  }
  if (dl === 0) {
    return `Halo ${name}, pengingat dari Kebaya Oma: sewa ${item} (nota ${r.txNumber}) jatuh tempo HARI INI (${due}). Mohon dikembalikan hari ini ya. Terima kasih 🙏`;
  }
  return `Halo ${name}, pengingat dari Kebaya Oma: sewa ${item} (nota ${r.txNumber}) jatuh tempo ${due} (${dl} hari lagi). Terima kasih 🙏`;
}

export function waLink(phone: string | null | undefined, text: string): string | null {
  const n = normalizePhoneId(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

// ===== E17 revisi 1: harga sewa dari persentase harga jual (pilihan cepat di form produk) =====

/** pilihan persen harga sewa dari harga jual (keputusan user 2026-10-02) */
export const RENTAL_PCT_OPTIONS = [50, 60, 70, 80, 90] as const;

/** harga sewa = persen × harga jual, dibulatkan ke Rp 500 terdekat (min Rp 500); null bila harga jual belum diisi */
export function rentalPriceFromPct(sellingPrice: number, pct: number): number | null {
  if (!(sellingPrice > 0) || !(pct > 0)) return null;
  return Math.max(500, Math.round((sellingPrice * pct) / 100 / 500) * 500);
}

/** persen pilihan yang sama persis dengan harga sewa saat ini (untuk menyorot chip), atau null bila diisi manual */
export function matchingRentalPct(sellingPrice: number, rentalPrice: number | null | undefined): number | null {
  if (!rentalPrice) return null;
  for (const p of RENTAL_PCT_OPTIONS) if (rentalPriceFromPct(sellingPrice, p) === rentalPrice) return p;
  return null;
}

// ===== E17 revisi 2: barang tanpa harga sewa tetap bisa disewa (default persen dari harga jual) =====

/** default bila harga sewa varian belum diatur — salah satu dari RENTAL_PCT_OPTIONS; bisa diubah di form sewa */
export const DEFAULT_RENTAL_PCT = 70;

export interface ResolvedRentalPrice {
  /** harga sewa per unit yang dipakai; null bila tak bisa dihitung (harga jual belum diisi) */
  price: number | null;
  /** true = memakai default persen (harga sewa varian belum diatur) */
  isDefault: boolean;
}

/** harga sewa varian bila sudah diatur; kalau belum → DEFAULT_RENTAL_PCT × harga jual */
export function resolveRentalPrice(
  sellingPrice: number,
  rentalPrice: number | null | undefined,
  pct: number = DEFAULT_RENTAL_PCT
): ResolvedRentalPrice {
  if ((rentalPrice ?? 0) > 0) return { price: rentalPrice as number, isDefault: false };
  return { price: rentalPriceFromPct(sellingPrice, pct), isDefault: true };
}

// ===== E18: sewa dibayar lewat checkout POS (draft dari /sewa → keranjang /pos → CheckoutModal) =====

/** draft sewa yang dibawa dari halaman /sewa ke keranjang POS */
export interface RentalDraft {
  productId: string;
  variantId: string;
  qty: number;
  /** tarif per unit */
  rentPrice: number;
  /** deposit per unit (info, tidak masuk total bayar) */
  deposit: number | null;
  days: number;
  startDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  customerName: string;
  customerPhone: string | null;
}

/** buat draft dari isian form (jatuh tempo = mulai + hari); harga dibulatkan ke rupiah utuh */
export function buildRentalDraft(input: {
  productId: string;
  variantId: string;
  qty: number;
  rentPrice: number;
  deposit?: number | null;
  days: number;
  startDate: string;
  customerName: string;
  customerPhone?: string | null;
}): RentalDraft {
  const days = Math.max(1, Math.round(input.days));
  return {
    productId: input.productId,
    variantId: input.variantId,
    qty: Math.max(1, Math.round(input.qty)),
    rentPrice: Math.round(input.rentPrice),
    deposit: input.deposit && input.deposit > 0 ? Math.round(input.deposit) : null,
    days,
    startDate: input.startDate,
    dueDate: addDays(input.startDate, days),
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone?.trim() ? input.customerPhone.trim() : null,
  };
}

/** pesan kesalahan bila draft belum layak dibayar; null = layak */
export function validateRentalDraft(d: RentalDraft, stock: number): string | null {
  if (!d.customerName.trim()) return "Nama penyewa wajib diisi.";
  if (!(d.rentPrice > 0)) return "Harga sewa harus lebih dari 0.";
  if (!(d.qty >= 1)) return "Jumlah minimal 1.";
  if (!(d.days >= 1)) return "Lama sewa minimal 1 hari.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.startDate)) return "Tanggal mulai tidak valid.";
  if (d.qty > stock) return `Stok hanya ${stock}.`;
  return null;
}

/** total tagihan sewa (tarif × qty) — deposit TIDAK termasuk */
export const rentalDraftTotal = (d: Pick<RentalDraft, "rentPrice" | "qty">) => rentTotal(d.rentPrice, d.qty);

/** deposit total yang harus diterima kasir terpisah (per unit × qty) */
export const rentalDraftDeposit = (d: Pick<RentalDraft, "deposit" | "qty">) => (d.deposit ?? 0) * d.qty;

/** data yang disisipkan ke tabel rentals saat transaksi sewa disimpan */
export function toRentalSpec(d: RentalDraft) {
  return {
    productId: d.productId,
    qty: d.qty,
    rentPrice: d.rentPrice,
    deposit: d.deposit,
    startDate: d.startDate,
    dueDate: d.dueDate,
    customerPhone: d.customerPhone,
  };
}

// ===== E19: struk sewa — label SEWA + tanggal kembali =====

export interface ReceiptRentalInfo {
  /** label tebal di bawah nomor nota */
  label: string;
  /** tanggal harus kembali, mis. "07 Okt 2026" (null bila nota tak membawa tanggal) */
  returnDate: string | null;
  /** pengganti kalimat "Barang tidak bisa dikembalikan" di kaki struk */
  footer: string;
}

/** info tambahan struk untuk nota sewa; null untuk nota selain sewa (struk penjualan/PO tidak berubah) */
export function receiptRentalInfo(tx: { kind?: string | null; dueDate?: string | null }): ReceiptRentalInfo | null {
  if (tx.kind !== "rental") return null;
  const returnDate = tx.dueDate ? formatDateId(tx.dueDate) : null;
  return {
    label: "*** SEWA ***",
    returnDate,
    footer: returnDate
      ? `Barang sewa wajib dikembalikan paling lambat ${returnDate}`
      : "Barang sewa wajib dikembalikan sesuai tanggal jatuh tempo",
  };
}
