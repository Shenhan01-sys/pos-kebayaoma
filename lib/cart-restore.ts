// lib/cart-restore.ts — keranjang POS bertahan saat app termuat ulang (keluhan staf 2026-11-20 no. 1:
// "aplikasi tiba-tiba refresh padahal sudah sampai konfirmasi bayar, harus scan ulang dari awal").
// Pemicu utama: Android mematikan PWA saat app kamera / RawBT di depan; keranjang dulu hanya di memori.
// Disimpan di localStorage (store/cart.ts) dan dipulihkan bila belum basi. Murni agar teruji.

import { normalizeRentalDraft, type RentalDraft } from "./rental";

export const CART_STORAGE_KEY = "kebaya-oma-cart";
/** keranjang lebih tua dari ini dianggap sisa hari lain → dibuang */
export const CART_TTL_MS = 12 * 60 * 60 * 1000;

export interface PersistedCart<L, R = unknown> {
  lines?: L[];
  customerName?: string | null;
  discount?: number;
  rental?: R | null;
  savedAt?: number;
}

/** bagian baris keranjang yang dibaca saat memulihkan sewa */
interface RestorableLine {
  variantId?: string;
  quantity?: number;
  rental?: boolean;
}

/** baris sewa keranjang cocok 1:1 dengan baris draft (varian & qty sama), tanpa baris non-sewa */
function rentalLinesMatch(lines: RestorableLine[], draft: RentalDraft): boolean {
  if (lines.length !== draft.lines.length) return false;
  return lines.every((l) => {
    if (!l.rental) return false;
    const d = draft.lines.find((x) => x.variantId === l.variantId);
    return !!d && d.qty === l.quantity;
  });
}

export function restoreCart<L extends RestorableLine>(
  p: PersistedCart<L> | null | undefined,
  now: number
): { lines: L[]; customerName: string | null; discount: number; rental: RentalDraft | null } | null {
  if (!p || typeof p.savedAt !== "number" || now - p.savedAt > CART_TTL_MS || now < p.savedAt - 60_000) return null;
  if (!Array.isArray(p.lines)) return null;
  // Draft sewa: bentuk lama (satu barang, tanpa `lines`) dikonversi; rusak → dibuang. Baris sewa keranjang tanpa
  // draft yang cocok juga dibuang — jangan sampai baris bertarif sewa ikut checkout sebagai penjualan.
  const rental = p.rental != null ? normalizeRentalDraft(p.rental) : null;
  if (rental && rentalLinesMatch(p.lines, rental)) {
    return { lines: p.lines, customerName: p.customerName ?? null, discount: 0, rental };
  }
  return {
    lines: p.lines.filter((l) => !l?.rental),
    customerName: p.rental != null ? null : p.customerName ?? null, // nama itu milik penyewa yang dibuang
    discount: typeof p.discount === "number" && p.discount > 0 ? p.discount : 0,
    rental: null,
  };
}
