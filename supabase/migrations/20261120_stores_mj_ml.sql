-- 20261120_stores_mj_ml.sql — data toko sesuai permintaan toko (keluhan staf 20 Nov 2026):
--   prefix nota MJL → MJ (Monjali), KTB → ML (Malioboro; toko "Kota Baru" = Malioboro, Jl. Cokrodipuran 6),
--   alamat & telp asli menggantikan nilai dummy "Jl. Sudirman No. 123, Jakarta" / "021-1234-5678".
-- Hanya 2 baris `stores`. Nomor nota lama tidak berubah; counter harian tx_counters per store_id (bukan per prefix).
-- Pra-cek 2026-11-20: tidak ada fungsi/view/trigger yang memuat 'MJL|KTB|Kota Baru|Monjali'; 0 nomor ^(MJ|ML)\d{8}-.
--
-- ROLLBACK (nilai sebelum migrasi):
--   update stores set receipt_prefix='MJL', name='Kebaya Oma - Monjali', address='Jl. Sudirman No. 123, Jakarta', phone='021-1234-5678' where receipt_prefix='MJ';
--   update stores set receipt_prefix='KTB', name='Kebaya Oma - Kota Baru', address=null, phone=null where receipt_prefix='ML';

do $$
declare n int;
begin
  update stores
     set receipt_prefix = 'MJ',
         address = 'Jalan Monjali 55, Yogyakarta',
         phone = '0813-2539-7410'
   where receipt_prefix = 'MJL' and name = 'Kebaya Oma - Monjali';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'stores MJL: % baris (harus 1)', n; end if;

  update stores
     set receipt_prefix = 'ML',
         name = 'Kebaya Oma - Malioboro',
         address = 'Cokrodipuran 6, Yogyakarta'
   where receipt_prefix = 'KTB' and name = 'Kebaya Oma - Kota Baru';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'stores KTB: % baris (harus 1)', n; end if;
end $$;
