// _logic.ts — logika murni reminder (tanpa Deno/DB) supaya teruji vitest & dipakai Edge fn.
// Aritmetika HARI KALENDER murni (Date.UTC dari komponen y/m/d) → deterministik
// di TZ lokal dev maupun TZ UTC runtime Deno.

const dayKey = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
const DAY = 86_400_000;

// Basis KALENDER: "hari-1 = hari pembuatan" (aturan user).
// total = due_day − created_day ; elapsed = today_day − created_day.
export function dayProgress(createdISO: string, dueDateISO: string, today: Date) {
  const start = dayKey(new Date(createdISO));
  const due = dayKey(new Date(dueDateISO + "T00:00:00"));
  const total = Math.max(1, Math.round((due - start) / DAY));
  const elapsed = Math.round((dayKey(today) - start) / DAY);
  return { total, elapsed, pct: Math.min(1, Math.max(0, elapsed / total)) };
}

export const startOfDay = (d: Date) => new Date(dayKey(d));

export type PoStage = "50" | "20" | null;

// Pre-order: 50% lalu 20% masa tempo; skip yang sudah ditandai.
// Prioritas: kanal 50% punya pesan sendiri — kalau H-20% lewat TANPA 50% pernah
// terkirim (mis. server mati seminggu), kirim '50' dulu, baru '20' berikutnya.
export function poStage(t: { created_at: string; due_date: string; reminded_at_50?: string | null; reminded_at_20?: string | null }, today: Date): PoStage {
  const { pct } = dayProgress(t.created_at, t.due_date, today);
  if (!t.reminded_at_50 && pct >= 0.5) return "50";
  if (!t.reminded_at_20 && pct >= 0.8) return "20";
  return null;
}

export type RentalStage = "20" | "0" | "overdue" | null;

// Sewa: H-20% (≤20% hari sisa), H-0 (hari jatuh tempo), overdue (lewat, maks 1×/hari).
export function rentalStage(
  r: { start_date: string; due_date: string; returned_qty?: number; qty: number; reminded_at_20?: string | null; reminded_at_0?: string | null; overdue_reminded_at?: string | null },
  today: Date
): RentalStage {
  if ((r.returned_qty ?? 0) >= r.qty) return null;
  const due = dayKey(new Date(r.due_date + "T00:00:00"));
  const start = dayKey(new Date(r.start_date + "T00:00:00"));
  const total = Math.max(1, Math.round((due - start) / DAY));
  const daysLeft = Math.round((due - dayKey(today)) / DAY);

  if (daysLeft < 0) {
    // sudah pernah diingatkan hari kalender yang sama?
    if (r.overdue_reminded_at && dayKey(new Date(r.overdue_reminded_at)) === dayKey(today)) return null;
    return "overdue";
  }
  if (daysLeft === 0 && !r.reminded_at_0) return "0";
  if (daysLeft > 0 && !r.reminded_at_20 && daysLeft <= Math.ceil(total * 0.2)) return "20";
  return null;
}

export function sameDate(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

// Sisa hari kalender menuju tanggal due (negatif = lewat). Deterministik lintas TZ.
export function daysUntil(dateISO: string, today: Date): number {
  return Math.round((dayKey(new Date(dateISO + "T00:00:00")) - dayKey(today)) / DAY);
}

// Normalisasi nomor HP Indonesia → format 62 utk Fonnte.
export function normalizePhone(raw: string): string {
  const d = raw.replace(/[^\d]/g, "");
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return "62" + d.slice(1);
  return "62" + d;
}

export const rupiahInt = (n: number) => Math.round(n).toLocaleString("id-ID");
