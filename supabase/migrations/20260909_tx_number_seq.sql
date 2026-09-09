-- ----------------------------------------------------------------------------
-- 20260909 NOMOR NOTA ATOMIK (MULTI-KASIR)
-- Masalah: nomor TRX-YYYYMMDD-### dihitung di client dari jumlah transaksi
-- yang terlihat — dua kasir yang bayar bersamaan dapat nomor sama dan salah
-- satunya ditolak UNIQUE(store_id, number). Wajib sebelum mesin 2 dan 3 nyala.
--
-- Solusi: counter per store per hari + upsert atomik dalam satu fungsi RPC.
-- Zona waktu dikunci ke Asia/Jakarta agar prefix tanggal sama dengan filter
-- hari lokal di aplikasi (sebelumnya UTC bisa beda hari).
-- ----------------------------------------------------------------------------

create table if not exists public.tx_counters (
  store_id uuid not null references public.stores(id) on delete cascade,
  day date not null,
  last_seq integer not null default 0,
  primary key (store_id, day)
);

create or replace function public.next_tx_number(p_store_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare
  v_seq int;
begin
  perform set_config('timezone', 'Asia/Jakarta', true);

  insert into public.tx_counters(store_id, day, last_seq)
  values (p_store_id, current_date, 1)
  on conflict (store_id, day) do update
    set last_seq = tx_counters.last_seq + 1
  returning last_seq into v_seq;

  return 'TRX-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

comment on function public.next_tx_number(uuid) is
  'Nomor nota atomik per store per hari (WIB). Dipakai saveTransaction jalur online; jangan hitung nomor di client untuk transaksi online.';

grant execute on function public.next_tx_number(uuid) to anon, authenticated;
