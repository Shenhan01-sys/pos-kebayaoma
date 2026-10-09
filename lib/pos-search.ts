// E22 — Pencarian katalog POS sampai level varian.
// Laporan user (2026-10-06): cari "kebaya 150" gagal — filter lama hanya mengecek
// nama produk / SKU produk / tags / SKU+barcode varian, sehingga varian bernama
// spesifik per harga ("kebaya 110", "kebaya 150", dst) tidak pernah tercocokkan,
// dan query multi-kata harus match utuh di satu field.
//
// Semantik baru:
// - Query dipecah per token (spasi); SEMUA token harus cocok (AND).
//   Tiap token bebas cocok di level produk (nama/SKU/tags) ATAU level varian
//   (nama/size/warna/SKU/barcode) — urutan bebas.
// - Token numerik (≥2 digit) ikut mencocokkan harga varian: "150" → 150.000
//   (ribuan) atau 150 (exact, untuk harga satuan); "150000" → 150.000.
import type { Product } from "./dummy";

const NUMERIC_TOKEN = /^\d{2,}$/;

/** Token numerik cocok dengan harga varian? "150" → 150000 atau 150; "150000" → 150000. */
export function matchesPriceToken(token: string, price: number): boolean {
  if (!NUMERIC_TOKEN.test(token)) return false;
  const n = Number(token);
  return price === n * 1000 || price === n;
}

/** Satu token cocok di fields produk ATAU fields varian mana pun milik produk ini? */
function tokenMatches(token: string, p: Product): boolean {
  const q = token.toLowerCase();
  const productHit =
    p.name.toLowerCase().includes(q) ||
    p.sku.toLowerCase().includes(q) ||
    p.tags.some((t) => t.toLowerCase().includes(q));
  if (productHit) return true;
  return p.variants.some(
    (v) =>
      (v.name ?? "").toLowerCase().includes(q) ||
      (v.size ?? "").toLowerCase() === q ||
      (v.color ?? "").toLowerCase().includes(q) ||
      v.sku.toLowerCase().includes(q) ||
      (v.barcode ?? "").toLowerCase() === q ||
      matchesPriceToken(token, v.sellingPrice)
  );
}

/**
 * Filter katalog POS (E22): multi-token AND lintas produk & varian,
 * termasuk nama varian dan harga (token numerik).
 * Query kosong → semua produk lolos (perilaku lama).
 */
export function filterProductsByQuery(products: Product[], query: string): Product[] {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return products;
  return products.filter((p) => tokens.every((t) => tokenMatches(t, p)));
}

/** Satu token cocok di fields varian saja (bukan fields produk)? */
function tokenMatchesVariantFields(token: string, v: Product["variants"][number]): boolean {
  const q = token.toLowerCase();
  return (
    (v.name ?? "").toLowerCase().includes(q) ||
    (v.size ?? "").toLowerCase() === q ||
    (v.color ?? "").toLowerCase().includes(q) ||
    v.sku.toLowerCase().includes(q) ||
    (v.barcode ?? "").toLowerCase() === q ||
    matchesPriceToken(token, v.sellingPrice)
  );
}

/** Semua token cocok di gabungan fields produk + varian ini, DAN minimal satu token khusus kena varian? */
function variantQualifies(tokens: string[], p: Product, v: Product["variants"][number]): boolean {
  const allMatch = tokens.every(
    (t) =>
      tokenMatchesVariantFields(t, v) ||
      p.name.toLowerCase().includes(t.toLowerCase()) ||
      p.sku.toLowerCase().includes(t.toLowerCase()) ||
      p.tags.some((tag) => tag.toLowerCase().includes(t.toLowerCase()))
  );
  if (!allMatch) return false;
  return tokens.some((t) => tokenMatchesVariantFields(t, v));
}

/**
 * E22 lanjutan (feedback user 2026-10-08): hasil pencarian langsung ke level varian —
 * daftar varian yang spesifik kena query (minimal satu token match ke fields varian,
 * mis. nama "kebaya 60" atau harga 60.000), agar bisa langsung dimasukkan ke keranjang
 * tanpa membuka picker dan scroll satu-satu.
 */
export function findMatchingVariants(
  products: Product[],
  query: string
): { product: Product; variant: Product["variants"][number] }[] {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const out: { product: Product; variant: Product["variants"][number] }[] = [];
  for (const p of products) {
    for (const v of p.variants) {
      if (variantQualifies(tokens, p, v)) out.push({ product: p, variant: v });
    }
  }
  return out;
}

/**
 * Cari varian yang cocok persis dengan satu string query (untuk Enter di search bar):
 * barcode/SKU varian exact → prioritas; lalu nama varian/nama produk+nama varian
 * yang mengandung query utuh. Hanya dipakai bila hasilnya TEPAT satu varian.
 */
export function findExactVariantMatch(
  products: Product[],
  query: string
): { product: Product; variant: Product["variants"][number] } | null {
  const code = query.trim().toLowerCase();
  if (!code) return null;

  let hit: { product: Product; variant: Product["variants"][number] } | null = null;
  for (const p of products) {
    for (const v of p.variants) {
      const exactCode = v.barcode === query.trim() || v.sku === query.trim();
      const nameHit =
        (v.name ?? "").toLowerCase().includes(code) ||
        `${p.name} ${v.name ?? ""}`.toLowerCase().includes(code);
      if (exactCode || nameHit) {
        if (hit) return null; // lebih dari satu kandidat → jangan menebak
        hit = { product: p, variant: v };
      }
    }
  }
  return hit;
}
