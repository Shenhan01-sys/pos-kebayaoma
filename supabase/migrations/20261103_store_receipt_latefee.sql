-- 20261103_store_receipt_latefee.sql
-- (1) Alamat/telepon nota per toko: kolom stores.address & stores.phone sudah ada; dibaca semua
--     user login (policy stores_select_authenticated), diubah superadmin (stores_update_superadmin)
--     lewat Pengaturan. Tidak ada perubahan skema untuk bagian ini.
-- (2) Denda telat sewa progresif, dapat diatur per toko di Pengaturan:
--     denda hari ke-n = late_fee_base + (n-1) * late_fee_step  (Rp, per sewa bukan per unit)
--     total telat d hari = d*base + step*d*(d-1)/2. Default 0 = denda mati.

alter table public.stores
  add column if not exists late_fee_base numeric not null default 0 check (late_fee_base >= 0),
  add column if not exists late_fee_step numeric not null default 0 check (late_fee_step >= 0);
