-- 20261115_soft_delete_catalog.sql — hapus produk/seri yang sudah punya riwayat (transaksi, sewa, transfer).
-- transaction_items / rentals / stock_transfers merujuk products & variants dengan restrict/no action, jadi
-- hard delete ditolak (23503). Solusi: soft delete — baris disembunyikan dari katalog & kasir, riwayat utuh.
-- FE: deleteProduct/updateProduct mencoba hard delete dulu; bila 23503 → set deleted_at (+ SKU diberi
-- akhiran agar kode bisa dipakai lagi dan tidak tertangkap pencocokan SKU transfer antar-toko).

alter table public.products add column if not exists deleted_at timestamptz;
alter table public.variants add column if not exists deleted_at timestamptz;
