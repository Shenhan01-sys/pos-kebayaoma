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
