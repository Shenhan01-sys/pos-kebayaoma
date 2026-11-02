-- 20261103_transfer_send_proof.sql
-- Kirim transfer antar-toko WAJIB foto bukti. Ditegakkan di server:
--   * kolom stock_transfers.send_proof (data URL gambar, dikompres di klien ±1024 px)
--   * RPC send_transfer_with_proof(p_transfer, p_proof): tolak bila bukti kosong/bukan gambar,
--     lalu memanggil send_transfer (semua guard stok/store_scope tetap di sana) dan menyimpan bukti.
--     Gagal di mana pun = seluruh transaksi di-rollback (bukti tidak tersimpan, stok tidak berubah).
--   * send_transfer lama DICABUT dari anon/authenticated agar tidak bisa dipakai melewati bukti
--     (fungsi security definer di atas tetap bisa memanggilnya sebagai owner).
--   * get_transfer_proof(p_transfer): ambil bukti satu transfer (lazy; list_transfers tidak membawa gambar),
--     hanya pihak terlibat atau manager-all.
-- URUTAN DEPLOY: jalankan migrasi ini segera setelah FE baru live (FE lama memanggil send_transfer yang kini dicabut).

alter table public.stock_transfers add column if not exists send_proof text;

create or replace function public.send_transfer_with_proof(p_transfer uuid, p_proof text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), 'anon') = 'anon' then
    raise exception 'forbidden_role';
  end if;
  if p_proof is null or length(btrim(p_proof)) = 0 or left(p_proof, 11) <> 'data:image/' then
    raise exception 'proof_required';
  end if;
  if length(p_proof) > 3000000 then
    raise exception 'proof_too_large';
  end if;

  perform public.send_transfer(p_transfer);

  update public.stock_transfers set send_proof = p_proof where id = p_transfer;
end;
$$;

create or replace function public.get_transfer_proof(p_transfer uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare t record;
begin
  if coalesce(auth.role(), 'anon') = 'anon' then
    raise exception 'forbidden_role';
  end if;
  select from_store, to_store, send_proof into t from public.stock_transfers where id = p_transfer;
  if not found then return null; end if;
  if not public.is_manager_all()
     and (public.my_store_id() is null
          or (t.from_store is distinct from public.my_store_id()
              and t.to_store is distinct from public.my_store_id())) then
    raise exception 'store_scope';
  end if;
  return t.send_proof;
end;
$$;

revoke execute on function public.send_transfer(uuid) from public, anon, authenticated;
revoke execute on function public.send_transfer_with_proof(uuid, text) from public;
revoke execute on function public.get_transfer_proof(uuid) from public;
grant execute on function public.send_transfer_with_proof(uuid, text) to authenticated;
grant execute on function public.get_transfer_proof(uuid) to authenticated;
