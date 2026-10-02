// lib/sku.ts — E16: kode SKU/barcode otomatis (8 digit angka, unik) — user tidak mengisi SKU manual.
// Alasan: SKU varian kosong/kembar → 409 (unique product_id+sku) di Supabase; kode angka 8 digit =
// Code128 subset C = 79 modul → barcode 3 dot (0,375 mm), lebar seragam, paling andal di scanner.

export const SKU_LENGTH = 8;

/** 8 digit angka (digit pertama 1–9), unik terhadap `taken`; kode baru otomatis dimasukkan ke `taken`. */
export function generateSkuCode(taken: Set<string>, rnd: () => number = Math.random): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let s = String(1 + Math.floor(rnd() * 9));
    for (let k = 1; k < SKU_LENGTH; k++) s += String(Math.floor(rnd() * 10));
    if (!taken.has(s)) {
      taken.add(s);
      return s;
    }
  }
  throw new Error("Gagal membuat kode SKU unik — coba lagi.");
}

interface CodeHolder {
  sku?: string | null;
  barcode?: string | null;
  variants?: CodeHolder[];
}

/** semua kode yang sudah terpakai (SKU produk, SKU varian, barcode varian); `skip` = lewati produk tertentu (mis. yang sedang diedit) */
export function takenCodes<T extends CodeHolder>(products: T[], skip?: (p: T) => boolean): Set<string> {
  const taken = new Set<string>();
  const add = (v?: string | null) => {
    const t = (v ?? "").trim();
    if (t) taken.add(t);
  };
  for (const p of products) {
    if (skip?.(p)) continue;
    add(p.sku);
    for (const v of p.variants ?? []) {
      add(v.sku);
      add(v.barcode);
    }
  }
  return taken;
}

/**
 * Pastikan setiap varian punya SKU: kosong, kembar dalam daftar, atau bentrok dengan produk lain
 * → diganti kode otomatis. SKU unik yang sudah ada dipertahankan (produk lama tidak berubah).
 */
export function fillVariantSkus<T extends { sku: string }>(variants: T[], takenByOthers: Set<string>, rnd?: () => number): T[] {
  const taken = new Set(takenByOthers);
  const seen = new Set<string>();
  return variants.map((v) => {
    const sku = (v.sku ?? "").trim();
    if (sku && !seen.has(sku) && !takenByOthers.has(sku)) {
      seen.add(sku);
      return { ...v, sku };
    }
    const fresh = generateSkuCode(taken, rnd);
    seen.add(fresh);
    return { ...v, sku: fresh };
  });
}

/** SKU produk: kosong atau bentrok → kode otomatis; selain itu dipertahankan */
export function ensureProductSku(sku: string, takenByOthers: Set<string>, rnd?: () => number): string {
  const t = (sku ?? "").trim();
  if (t && !takenByOthers.has(t)) return t;
  return generateSkuCode(new Set(takenByOthers), rnd);
}
