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
  // E20: pencatatan deposit (kolom baru rentals; undefined = data lama / belum ada migrasi → dianggap 0)
  depositRefunded?: number | null; // uang deposit yang sudah dikembalikan ke penyewa
  depositDeducted?: number | null; // potongan deposit (kerusakan/telat) — dicatat, bukan otomatis pendapatan
  depositNote?: string | null;
  depositSettledAt?: string | null;
  startDate: string;
  dueDate: string;
  returnedAt?: string | null; // waktu kembali penuh (rentals.returned_at) — membekukan hitungan denda telat
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
  depositHeld: number; // E20: deposit yang MASIH DITAHAN di semua sewa (diterima − dikembalikan − dipotong), termasuk sewa yang barangnya sudah kembali
}

export function rentalSummary(list: RentalItem[], today: Date): RentalSummary {
  const s: RentalSummary = { open: 0, overdue: 0, dueToday: 0, unitsOut: 0, depositHeld: 0 };
  for (const r of list) {
    s.depositHeld += depositHeld(r); // E20: ditahan sampai dikembalikan/dipotong, bukan sampai barang kembali
    if (!isOpenRental(r)) continue;
    const out = outstandingQty(r);
    s.open++;
    s.unitsOut += out;
    const dl = daysLeft(r.dueDate, today);
    if (dl < 0) s.overdue++;
    else if (dl === 0) s.dueToday++;
  }
  return s;
}

/** deposit total sewa ini = deposit diterima kasir (deposit per unit × qty; tunai, terpisah dari total bayar & omzet) */
export const depositTotal = (r: Pick<RentalItem, "deposit" | "qty">) => (r.deposit ?? 0) * r.qty;

type DepositFields = Pick<RentalItem, "deposit" | "qty" | "depositRefunded" | "depositDeducted">;

/** E20: deposit yang masih ditahan = diterima − dikembalikan − dipotong (tidak pernah negatif) */
export const depositHeld = (r: DepositFields) =>
  Math.max(0, depositTotal(r) - (r.depositRefunded ?? 0) - (r.depositDeducted ?? 0));

export type DepositStatus = "none" | "held" | "partial" | "settled";

/** none: sewa tanpa deposit · held: belum disentuh · partial: sebagian diselesaikan · settled: habis (dikembalikan/dipotong) */
export function depositStatus(r: DepositFields): DepositStatus {
  const total = depositTotal(r);
  if (total <= 0) return "none";
  const left = depositHeld(r);
  if (left <= 0) return "settled";
  return left < total ? "partial" : "held";
}

/** validasi form penyelesaian deposit (cermin aturan RPC settle_rental_deposit); null = layak */
export function validateDepositSettle(r: DepositFields, refund: number, deduct: number): string | null {
  if (!Number.isFinite(refund) || !Number.isFinite(deduct)) return "Jumlah harus berupa angka.";
  if (refund < 0 || deduct < 0) return "Jumlah tidak boleh negatif.";
  if (refund + deduct <= 0) return "Isi jumlah yang dikembalikan atau dipotong.";
  const held = depositHeld(r);
  if (refund + deduct > held) return `Melebihi deposit yang ditahan (${formatRupiahId(held)}).`;
  return null;
}

const formatRupiahId = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

export interface DepositSummary {
  count: number; // jumlah sewa ber-deposit dalam cakupan
  received: number; // deposit diterima (deposit × qty)
  refunded: number;
  deducted: number;
  held: number; // masih ditahan saat ini
}

/**
 * E20: ringkasan deposit sewa untuk laporan. Cakupan = sewa yang MULAI dalam [from, to] (tanggal 'YYYY-MM-DD', kosong = tanpa batas)
 * dan (opsional) toko tertentu. Deposit tidak pernah ikut omzet; nilai dikembalikan/dipotong/ditahan adalah posisi SAAT INI.
 */
export function depositSummary(
  list: (RentalItem & { storeId?: string | null })[],
  opts: { from?: string; to?: string; storeId?: string | null } = {}
): DepositSummary {
  const s: DepositSummary = { count: 0, received: 0, refunded: 0, deducted: 0, held: 0 };
  for (const r of list) {
    if (opts.storeId && r.storeId !== opts.storeId) continue;
    if (opts.from && r.startDate < opts.from) continue;
    if (opts.to && r.startDate > opts.to) continue;
    const total = depositTotal(r);
    if (total <= 0) continue;
    s.count++;
    s.received += total;
    s.refunded += r.depositRefunded ?? 0;
    s.deducted += r.depositDeducted ?? 0;
    s.held += depositHeld(r);
  }
  return s;
}

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

/** satu baris barang dalam draft sewa (satu varian; tarif & deposit per unit) */
export interface RentalDraftLine {
  productId: string;
  variantId: string;
  qty: number;
  /** tarif per unit */
  rentPrice: number;
  /** deposit per unit (info, tidak masuk total bayar) */
  deposit: number | null;
}

/** draft sewa yang dibawa dari halaman /sewa ke keranjang POS.
 *  Satu nota sewa = SATU penyewa + SATU tanggal mulai/lama/jatuh tempo, berisi N baris barang (keluhan staf:
 *  "belum bisa add item yang berbeda dalam 1 nota"). Tiap baris → satu baris tabel rentals saat disimpan. */
export interface RentalDraft {
  days: number;
  startDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  customerName: string;
  customerPhone: string | null;
  lines: RentalDraftLine[];
}

export interface RentalDraftLineInput {
  productId: string;
  variantId: string;
  qty: number;
  rentPrice: number;
  deposit?: number | null;
}

/** rapikan satu baris: qty minimal 1 (bulat), harga ke rupiah utuh, deposit 0/null → null */
export function buildRentalDraftLine(input: RentalDraftLineInput): RentalDraftLine {
  return {
    productId: input.productId,
    variantId: input.variantId,
    qty: Math.max(1, Math.round(input.qty)),
    rentPrice: Math.round(input.rentPrice),
    deposit: input.deposit && input.deposit > 0 ? Math.round(input.deposit) : null,
  };
}

/** gabungkan baris dengan varian sama (qty dijumlah; tarif & deposit memakai baris TERAKHIR); urutan pertama dipertahankan */
export function mergeRentalLines<T extends RentalDraftLine>(lines: T[]): T[] {
  const out: T[] = [];
  for (const l of lines) {
    const i = out.findIndex((x) => x.variantId === l.variantId);
    if (i < 0) out.push({ ...l });
    else out[i] = { ...l, qty: out[i].qty + l.qty };
  }
  return out;
}

/** buat draft dari isian form (jatuh tempo = mulai + hari); harga dibulatkan ke rupiah utuh; varian kembar digabung */
export function buildRentalDraft(input: {
  days: number;
  startDate: string;
  customerName: string;
  customerPhone?: string | null;
  lines: RentalDraftLineInput[];
}): RentalDraft {
  const days = Math.max(1, Math.round(input.days));
  return {
    days,
    startDate: input.startDate,
    dueDate: addDays(input.startDate, days),
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone?.trim() ? input.customerPhone.trim() : null,
    lines: mergeRentalLines(input.lines.map(buildRentalDraftLine)),
  };
}

/** total qty yang diminta per produk (stok disimpan per PRODUK, bukan per varian) */
export function rentalQtyByProduct(lines: Pick<RentalDraftLine, "productId" | "qty">[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty);
  return m;
}

/** pesan kesalahan bila draft belum layak dibayar; null = layak.
 *  stockOf(productId) → stok produk (undefined = produk tidak dikenal). Qty dijumlah per produk lintas baris. */
export function validateRentalDraft(
  d: RentalDraft,
  stockOf: (productId: string) => number | undefined,
  nameOf?: (productId: string) => string | undefined
): string | null {
  if (!d.customerName.trim()) return "Nama penyewa wajib diisi.";
  if (!Array.isArray(d.lines) || d.lines.length === 0) return "Tambahkan minimal satu barang sewa.";
  for (const l of d.lines) {
    if (!l.productId || !l.variantId) return "Ada baris barang sewa yang tidak valid.";
    if (!(l.rentPrice > 0)) return "Harga sewa harus lebih dari 0.";
    if (!(Number.isInteger(l.qty) && l.qty >= 1)) return "Jumlah minimal 1.";
    if (l.deposit != null && !(l.deposit >= 0)) return "Deposit tidak boleh negatif.";
  }
  if (!(d.days >= 1)) return "Lama sewa minimal 1 hari.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.startDate)) return "Tanggal mulai tidak valid.";
  const multi = d.lines.length > 1;
  for (const [productId, qty] of rentalQtyByProduct(d.lines)) {
    const stock = stockOf(productId);
    const name = nameOf?.(productId);
    if (stock === undefined) return `Barang sewa${name ? ` ${name}` : ""} tidak ditemukan — muat ulang data produk.`;
    if (qty > stock) {
      if (!multi) return name ? `Stok ${name} hanya ${stock}.` : `Stok hanya ${stock}.`;
      return `Stok ${name ?? "barang"} hanya ${stock} (diminta ${qty} di nota ini).`;
    }
  }
  return null;
}

/** total tagihan sewa (Σ tarif × qty) — deposit TIDAK termasuk */
export const rentalDraftTotal = (d: { lines: Pick<RentalDraftLine, "rentPrice" | "qty">[] }) =>
  d.lines.reduce((s, l) => s + rentTotal(l.rentPrice, l.qty), 0);

/** deposit total yang harus diterima kasir terpisah (Σ per unit × qty) */
export const rentalDraftDeposit = (d: { lines: Pick<RentalDraftLine, "deposit" | "qty">[] }) =>
  d.lines.reduce((s, l) => s + (l.deposit ?? 0) * l.qty, 0);

/** total unit dalam draft */
export const rentalDraftUnits = (d: { lines: Pick<RentalDraftLine, "qty">[] }) => d.lines.reduce((s, l) => s + l.qty, 0);

/** data yang disisipkan ke tabel rentals saat transaksi sewa disimpan (satu baris rentals per baris draft) */
export function toRentalSpec(d: RentalDraft) {
  return {
    startDate: d.startDate,
    dueDate: d.dueDate,
    customerPhone: d.customerPhone,
    lines: d.lines.map((l) => ({ productId: l.productId, qty: l.qty, rentPrice: l.rentPrice, deposit: l.deposit })),
  };
}

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function normalizeLine(raw: unknown): RentalDraftLine | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Record<string, unknown>;
  if (!isStr(l.productId) || !isStr(l.variantId)) return null;
  if (!isNum(l.qty) || l.qty < 1 || !Number.isInteger(l.qty)) return null;
  if (!isNum(l.rentPrice) || l.rentPrice < 0) return null;
  if (l.deposit != null && (!isNum(l.deposit) || l.deposit < 0)) return null;
  return { productId: l.productId, variantId: l.variantId, qty: l.qty, rentPrice: l.rentPrice, deposit: l.deposit && (l.deposit as number) > 0 ? (l.deposit as number) : null };
}

/** pulihkan draft dari localStorage (keranjang dipersist). Bentuk lama (satu barang: productId/variantId/qty/… di
 *  tingkat atas, tanpa `lines`) dikonversi ke `lines: [satu baris]`. Rusak/tidak lengkap → null (draft dibuang). */
export function normalizeRentalDraft(raw: unknown): RentalDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isNum(r.days) || r.days < 1) return null;
  if (!isStr(r.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(r.startDate)) return null;
  if (!isStr(r.dueDate) || !/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate)) return null;
  if (typeof r.customerName !== "string") return null;
  if (r.customerPhone != null && typeof r.customerPhone !== "string") return null;
  let lines: RentalDraftLine[];
  if (Array.isArray(r.lines)) {
    const parsed = r.lines.map(normalizeLine);
    if (parsed.length === 0 || parsed.some((l) => l === null)) return null;
    lines = mergeRentalLines(parsed as RentalDraftLine[]);
  } else if ("productId" in r) {
    const one = normalizeLine(r); // bentuk lama (sebelum multi-barang)
    if (!one) return null;
    lines = [one];
  } else return null;
  return {
    days: r.days,
    startDate: r.startDate,
    dueDate: r.dueDate,
    customerName: r.customerName,
    customerPhone: typeof r.customerPhone === "string" && r.customerPhone.trim() ? r.customerPhone : null,
    lines,
  };
}

// ===== E19: struk sewa — label SEWA + tanggal kembali =====

export interface ReceiptRentalInfo {
  /** label tebal di bawah nomor nota */
  label: string;
  /** tanggal harus kembali, mis. "07 Okt 2026" (null bila nota tak membawa tanggal) */
  returnDate: string | null;
  /** jam kembali = jam sewa (jam nota dibuat), mis. "14.30" WIB; null bila waktu nota tak diketahui */
  returnTime: string | null;
  /** tanggal + jam untuk dicetak, mis. "07 Okt 2026 14.30 WIB" (null bila tanpa tanggal) */
  returnLabel: string | null;
  /** telepon penyewa (null bila tidak diketahui) */
  phone: string | null;
  /** pengganti kalimat "Barang tidak bisa dikembalikan" di kaki struk */
  footer: string;
}

/** jam "HH.mm" zona WIB dari timestamp ISO; null bila tidak valid */
export function timeWib(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Jakarta" }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value;
  const m = parts.find((p) => p.type === "minute")?.value;
  return h && m ? `${h}.${m}` : null;
}

/** info tambahan struk untuk nota sewa; null untuk nota selain sewa (struk penjualan/PO tidak berubah) */
export function receiptRentalInfo(
  tx: { kind?: string | null; dueDate?: string | null; createdAt?: string | null },
  extra: { phone?: string | null } = {}
): ReceiptRentalInfo | null {
  if (tx.kind !== "rental") return null;
  const returnDate = tx.dueDate ? formatDateId(tx.dueDate) : null;
  const returnTime = timeWib(tx.createdAt); // jam kembali = jam sewa
  const returnLabel = returnDate ? (returnTime ? `${returnDate} ${returnTime} WIB` : returnDate) : null;
  return {
    label: "*** SEWA ***",
    returnDate,
    returnTime,
    returnLabel,
    phone: extra.phone?.trim() ? extra.phone.trim() : null,
    footer: returnLabel
      ? `Barang sewa wajib dikembalikan paling lambat ${returnLabel}`
      : "Barang sewa wajib dikembalikan sesuai tanggal jatuh tempo",
  };
}

// ===== E30: denda keterlambatan progresif (dapat diatur per toko di Pengaturan) =====

export interface LateFeeConfig {
  /** denda hari pertama telat (Rp) */
  base: number;
  /** tambahan denda tiap hari berikutnya (Rp) */
  step: number;
}

/** jumlah hari telat (0 bila belum lewat jatuh tempo) */
export function lateDays(dueDate: string, now: Date): number {
  return Math.max(0, -daysLeft(dueDate, now));
}

/**
 * Denda total telat `days` hari. Hari ke-n = base + (n-1)*step, sehingga makin lama makin besar:
 * total = days*base + step*days*(days-1)/2. Per sewa (bukan per unit). 0 bila belum telat / konfigurasi 0.
 */
export function lateFee(days: number, cfg: LateFeeConfig): number {
  const d = Math.max(0, Math.floor(Number.isFinite(days) ? days : 0));
  const base = Math.max(0, Number(cfg.base) || 0);
  const step = Math.max(0, Number(cfg.step) || 0);
  if (d === 0) return 0;
  return Math.round(base * d + (step * d * (d - 1)) / 2);
}

/** hari telat sewa ini: berhenti bertambah saat kembali penuh (returnedAt), selain itu dihitung sampai `now` */
export function rentalLateDays(r: Pick<RentalItem, "dueDate" | "qty" | "returnedQty" | "returnedAt">, now: Date): number {
  const end = !isOpenRental(r) && r.returnedAt ? new Date(r.returnedAt) : now;
  return lateDays(r.dueDate, Number.isNaN(end.getTime()) ? now : end);
}

/** denda sewa ini saat ini (beku setelah kembali penuh) */
export function rentalLateFee(r: Pick<RentalItem, "dueDate" | "qty" | "returnedQty" | "returnedAt">, now: Date, cfg: LateFeeConfig): number {
  return lateFee(rentalLateDays(r, now), cfg);
}

/** telepon penyewa untuk struk: dari spesifikasi sewa saat checkout, selain itu dari tabel pelanggan (id lalu nama) */
export function renterPhone(
  tx: { customerId?: string | null; customerName?: string | null; rental?: { customerPhone?: string | null } | null },
  customers: { id: string; name: string; phone?: string | null }[]
): string | null {
  const direct = tx.rental?.customerPhone?.trim();
  if (direct) return direct;
  const byId = tx.customerId ? customers.find((c) => c.id === tx.customerId) : undefined;
  const name = (tx.customerName ?? "").trim().toLowerCase();
  const found = byId ?? (name ? customers.find((c) => c.name.trim().toLowerCase() === name) : undefined);
  return found?.phone?.trim() || null;
}
