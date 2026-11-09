// lib/label-text.ts — teks stiker barcode: judul = nama produk + nama varian, size "One Size" disembunyikan.
// Alasan: produk hasil seed Excel bernama generik ("Kebaya") dan semua varian ber-size default "One Size";
// pembeda sebenarnya ada di nama varian ("Kebaya Encim", "Kebaya Lawasan", ...).

const GENERIC_SERIES = /^series\s*\d*$/i;
const NO_SIZE = new Set(["", "one size", "onesize"]);

const has = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.toLowerCase());

/** nama produk + nama varian tanpa duplikasi ("Kebaya" + "Kebaya Encim" → "Kebaya Encim"); "Series N" dianggap tak informatif */
export function labelTitle(productName: string, variantName?: string | null): string {
  const p = productName.trim();
  const v = (variantName ?? "").trim();
  if (!v || GENERIC_SERIES.test(v)) return p;
  if (!p || has(v, p)) return v;
  if (has(p, v)) return p;
  return `${p} ${v}`;
}

/** size untuk stiker; "" (kosong/"One Size") = jangan dicetak */
export function labelSize(size?: string | null): string {
  const s = (size ?? "").trim();
  return NO_SIZE.has(s.toLowerCase()) ? "" : s;
}

/** warna untuk stiker; "" bila sudah tercakup di judul (seed Excel: warna = nama varian) */
export function labelColor(color: string | null | undefined, title: string): string {
  const c = (color ?? "").trim();
  return c && !has(title, c) ? c : "";
}

/** gabung bagian info varian (size, warna, ...) yang terisi; bagian kosong/"One Size" dibuang → tak ada " / " yatim */
export function joinInfo(parts: (string | null | undefined)[], sep = " / "): string {
  return parts.map((p) => (p ?? "").trim()).filter((p) => p && !NO_SIZE.has(p.toLowerCase())).join(sep);
}
