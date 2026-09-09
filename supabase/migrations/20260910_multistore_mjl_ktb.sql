-- ----------------------------------------------------------------------------
-- 20260910 MULTI-STORE MJL (Monjali) + KTB (Kota Baru)
-- - stores.receipt_prefix: MJL / KTB. Baris default lama -> Monjali.
-- - staff.store_id jadi NULLABLE; NULL = manager lintas semua toko
--   (kasir/staff wajib terikat 1 toko; manager dikosongkan = cek semua).
-- - RLS per-user: app.my_store_id() dari baris staff auth.uid();
--   app.is_manager_all() = manager aktif dengan store_id NULL.
-- - next_tx_number pakai prefix toko (MJL-YYYYMMDD-### / KTB-...).
-- - store_directory: direktori publik (id, name, prefix) untuk login picker
--   + switcher toko tanpa membocorkan alamat/telepon/pajak.
-- ----------------------------------------------------------------------------

-- 1) Prefix + toko kedua -----------------------------------------------
alter table public.stores
  add column if not exists receipt_prefix text;

update public.stores
  set name = 'Kebaya Oma - Monjali', receipt_prefix = 'MJL'
  where is_default = true and (receipt_prefix is null or receipt_prefix = '');

insert into public.stores (id, name, address, phone, tax_rate, is_default, receipt_prefix)
values ('b3c4d5e6-f7a8-4b9c-8d0e-1f2a3b4c5d6e', 'Kebaya Oma - Kota Baru', null, null, 12.00, false, 'KTB')
on conflict (id) do update
  set name = excluded.name, receipt_prefix = excluded.receipt_prefix;

-- 2) Direktori publik ---------------------------------------------------
create or replace view public.store_directory as
  select id, name, receipt_prefix from public.stores;

comment on view public.store_directory is
  'Publik (anon): id/nama/prefix toko untuk login picker & switcher. Kolom sensitif (alamat/telepon/pajak) tidak ikut.';

grant select on public.store_directory to anon, authenticated;

-- 3) staff.store_id nullable; manager -> NULL (semua toko) ----------------
alter table public.stores alter column receipt_prefix set default 'TRX-';

alter table public.staff alter column store_id drop not null;

update public.staff set store_id = null where role = 'manager';

-- 4) Helper otorisasi per-user ------------------------------------------
create or replace function public.my_store_id() returns uuid
language sql stable security definer set search_path = public
as $$
  select s.store_id from public.staff s
  where s.user_id = auth.uid() and s.active
  limit 1;
$$;

create or replace function public.is_manager_all() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid()
      and s.role = 'manager'
      and s.active
      and s.store_id is null
  );
$$;

create or replace function public.manages_store(p_store uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_manager_all() or exists (
    select 1 from public.staff s
    where s.user_id = auth.uid()
      and s.role = 'manager'
      and s.active
      and s.store_id = p_store
  );
$$;

-- Kompat: nama historis, arti kini = mengelola tokonya sendiri / semua.
create or replace function public.is_store_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select public.manages_store(public.my_store_id());
$$;

grant execute on function public.my_store_id() to anon, authenticated;
grant execute on function public.is_manager_all() to anon, authenticated;
grant execute on function public.manages_store(uuid) to anon, authenticated;
grant execute on function public.is_store_admin() to anon, authenticated;

-- 5) Policy ulang: scope toko per-user + bypass manager-all -------------
-- Tabel ber-store_id langsung
do $$
declare t text;
begin
  foreach t in array array['categories','products','customers','transactions','stock_movements','shifts'] loop
    execute format('drop policy if exists "store_scope" on public.%I', t);
    execute format(
      'create policy "store_scope" on public.%I for all using (public.is_manager_all() or store_id = public.my_store_id()) with check (public.is_manager_all() or store_id = public.my_store_id())',
      t
    );
  end loop;
end $$;

-- stores: baris tokonya sendiri, atau semua bila manager-all
drop policy if exists "store_scope" on public.stores;
create policy "store_scope" on public.stores for all
  using (public.is_manager_all() or id = public.my_store_id())
  with check (public.is_manager_all() or id = public.my_store_id());

-- variants / transaction_items / qr_labels (scope via parent)
drop policy if exists "store_scope" on public.variants;
create policy "store_scope" on public.variants for all
  using (public.is_manager_all() or product_id in (select id from public.products where store_id = public.my_store_id()))
  with check (public.is_manager_all() or product_id in (select id from public.products where store_id = public.my_store_id()));

drop policy if exists "store_scope" on public.transaction_items;
create policy "store_scope" on public.transaction_items for all
  using (public.is_manager_all() or transaction_id in (select id from public.transactions where store_id = public.my_store_id()))
  with check (public.is_manager_all() or transaction_id in (select id from public.transactions where store_id = public.my_store_id()));

drop policy if exists "store_scope" on public.qr_labels;
create policy "store_scope" on public.qr_labels for all
  using (public.is_manager_all()
    or product_id in (select id from public.products where store_id = public.my_store_id())
    or variant_id in (select v.id from public.variants v join public.products p on p.id = v.product_id where p.store_id = public.my_store_id()))
  with check (public.is_manager_all()
    or product_id in (select id from public.products where store_id = public.my_store_id())
    or variant_id in (select v.id from public.variants v join public.products p on p.id = v.product_id where p.store_id = public.my_store_id()));

-- staff: picker login tetap jalan untuk anon; tulis hanya pengelola toko
drop policy if exists "staff_select" on public.staff;
create policy "staff_select" on public.staff for select
  using (auth.uid() is null
    or public.is_manager_all()
    or user_id = auth.uid()
    or store_id = public.my_store_id());

drop policy if exists "staff_admin_insert" on public.staff;
create policy "staff_admin_insert" on public.staff for insert
  with check (public.manages_store(store_id));

drop policy if exists "staff_admin_update" on public.staff;
create policy "staff_admin_update" on public.staff for update
  using (public.manages_store(store_id))
  with check (public.manages_store(store_id));

drop policy if exists "staff_admin_delete" on public.staff;
create policy "staff_admin_delete" on public.staff for delete
  using (public.manages_store(store_id));

-- 6) Nomor nota pakai prefix toko ----------------------------------------
create or replace function public.next_tx_number(p_store_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare
  v_seq int;
  v_prefix text;
begin
  perform set_config('timezone', 'Asia/Jakarta', true);

  select coalesce(nullif(s.receipt_prefix, ''), 'TRX-') into v_prefix
  from public.stores s where s.id = p_store_id;
  if v_prefix is null then v_prefix := 'TRX-'; end if;

  insert into public.tx_counters(store_id, day, last_seq)
  values (p_store_id, current_date, 1)
  on conflict (store_id, day) do update
    set last_seq = tx_counters.last_seq + 1
  returning last_seq into v_seq;

  return v_prefix || to_char(current_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

comment on function public.next_tx_number(uuid) is
  'Nomor nota atomik per store per hari (WIB) dengan prefix toko (MJL-/KTB-).';
