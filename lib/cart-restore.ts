// lib/cart-restore.ts — keranjang POS bertahan saat app termuat ulang (keluhan staf 2026-11-20 no. 1:
// "aplikasi tiba-tiba refresh padahal sudah sampai konfirmasi bayar, harus scan ulang dari awal").
// Pemicu utama: Android mematikan PWA saat app kamera / RawBT di depan; keranjang dulu hanya di memori.
// Disimpan di localStorage (store/cart.ts) dan dipulihkan bila belum basi. Murni agar teruji.

export const CART_STORAGE_KEY = "kebaya-oma-cart";
/** keranjang lebih tua dari ini dianggap sisa hari lain → dibuang */
export const CART_TTL_MS = 12 * 60 * 60 * 1000;

export interface PersistedCart<L, R> {
  lines?: L[];
  customerName?: string | null;
  discount?: number;
  rental?: R | null;
  savedAt?: number;
}

export function restoreCart<L, R>(
  p: PersistedCart<L, R> | null | undefined,
  now: number
): { lines: L[]; customerName: string | null; discount: number; rental: R | null } | null {
  if (!p || typeof p.savedAt !== "number" || now - p.savedAt > CART_TTL_MS || now < p.savedAt - 60_000) return null;
  if (!Array.isArray(p.lines)) return null;
  return {
    lines: p.lines,
    customerName: p.customerName ?? null,
    discount: typeof p.discount === "number" && p.discount > 0 ? p.discount : 0,
    rental: p.rental ?? null,
  };
}
