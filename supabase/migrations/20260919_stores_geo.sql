-- E9: GPS auto-outlet + geofence login.
-- stores + lat/lng (nullable — kosong = geofence belum aktif utk toko itu, fail-open).
-- SECURITY: policy lama `store_scope` (manager-all / staff toko sendiri = ALL) memungkinkan
-- kasir UPDATE baris stores via API (bisa mengubah koordinat geofence!).
-- E12 matriks: pengaturan toko = superadmin → tulis = superadmin; baca = authenticated.

alter table public.stores add column if not exists lat double precision;
alter table public.stores add column if not exists lng double precision;

drop policy if exists "store_scope" on public.stores;

create policy "stores_select_authenticated" on public.stores
  for select using (auth.uid() is not null);
create policy "stores_update_superadmin" on public.stores
  for update using (is_superadmin()) with check (is_superadmin());
create policy "stores_insert_superadmin" on public.stores
  for insert with check (is_superadmin());
create policy "stores_delete_superadmin" on public.stores
  for delete using (is_superadmin());


-- view store_directory: ikutkan lat/lng (koordinat toko bukan data sensitif;
-- dipakai FE utk geofence). View jalan dgn hak owner (bypass RLS stores) — perilaku E11 tetap.
create or replace view public.store_directory as
  select id, name, receipt_prefix, lat, lng from stores;
grant select on public.store_directory to anon, authenticated;