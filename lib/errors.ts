// lib/errors.ts — E10: pesan error manusiawi (raw kode RPC → kalimat Indonesia)
// RPC Postgres sengaja tetap melempar kode snake_case (kontrak stabil, mudah diaudit);
// lapisan FE yang menerjemahkan sebelum sampai ke layar user.

export interface HumanizeCtx {
  /** stok riil tersisa — dipakai bila pesan menyangkut kekurangan stok */
  stock?: number | null;
  /** kata kerja konteks utk fallback, mis. "mengirim transfer" */
  action?: string;
}

// Urutan pengecekan = urutan prioritas saat pesan memuat beberapa kode.
const DICT: { code: string; build: (ctx: HumanizeCtx) => string }[] = [
  { code: "insufficient_stock", build: (c) => c.stock != null
      ? `Kapasitas tidak mencukupi, maksimal hanya ${c.stock}.`
      : "Stok tidak mencukupi untuk jumlah ini." },
  { code: "store_scope", build: () => "Kamu tidak punya akses ke data toko ini. Ganti toko di pojok kiri, atau minta bantuan manager." },
  { code: "forbidden_role", build: () => "Akunmu tidak diizinkan melakukan aksi ini (khusus manager)." },
  { code: "product_not_found", build: () => "Produk tidak ditemukan — mungkin baru dihapus. Muat ulang halaman lalu coba lagi." },
  { code: "variant_not_found", build: () => "Varian produk tidak ditemukan — muat ulang halaman lalu coba lagi." },
  { code: "transfer_not_found", build: () => "Pengajuan transfer sudah tidak ada — mungkin sudah diproses orang lain. Muat ulang halaman." },
  { code: "transfer_not_pending", build: () => "Transfer ini sudah diproses (terkirim/dibatalkan), jadi tidak bisa dikirim dua kali." },
  { code: "rental_not_found", build: () => "Data sewa tidak ditemukan — muat ulang halaman." },
  { code: "too_many_returned", build: () => "Jumlah diterima melebihi qty sewa — periksa kembali angka yang dimasukkan." },
  { code: "no_rental_price", build: () => "Varian ini belum punya harga sewa. Isi harga sewa di katalog produk dulu." },
  { code: "qty_invalid", build: () => "Jumlah harus lebih dari 0." },
  { code: "invalid_movement_type", build: () => "Jenis operasi stok tidak dikenal — hubungi manager." },
];

export function humanizeError(err: unknown, ctx: HumanizeCtx = {}): string {
  const raw =
    typeof err === "string" ? err
      : (err as { message?: string } | null)?.message ?? String(err ?? "");
  const lower = raw.toLowerCase();
  for (const { code, build } of DICT) {
    if (lower.includes(code)) return build(ctx);
  }
  // kegagalan jaringan / Supabase tak jelas
  if (/fetch failed|network|enotfound|timeout|failed to fetch/.test(lower)) {
    return "Koneksi internet bermasalah — periksa jaringan lalu coba lagi.";
  }
  // sudah berupa kalimat manusia (mengandung spasi cukup & huruf kecil campur) → pakai apa adanya
  if (/[a-z] [a-z]/.test(raw) && !lower.includes("_")) return raw;
  const act = ctx.action ? ` saat ${ctx.action}` : "";
  return `Gagal${act} — coba lagi. Kalau terus gagal, hubungi manager.`;
}

// Helper utk validasi FE pra-submit (pola pesan standar user E10)
export const maxTransferMsg = (stock: number) =>
  `Kapasitas tidak mencukupi, maksimal transfer hanya ${stock}.`;
