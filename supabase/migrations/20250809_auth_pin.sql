-- ----------------------------------------------------------------------------
-- 20250809 AUTH PIN KASIR
-- Ganti PIN plaintext dengan Supabase Auth.
-- - staff.user_id -> auth.users (password = PIN, di-hash oleh Auth)
-- - kolom pin dihapus (tidak ada PIN plaintext di DB)
-- - RLS staff: SELECT anon (layar pilih kasir), tulis hanya admin store
-- ----------------------------------------------------------------------------

-- 1) Kolom user_id + hapus pin plaintext
alter table public.staff
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table public.staff drop column if exists pin;

-- 2) Email auth sintetis per staff (deterministik dari id staff)
create or replace function public.staff_auth_email(p_staff uuid) returns text
language sql immutable
as $$
  select 'staff-' || p_staff::text || '@kebayaoma.local';
$$;

-- 3) Helper: apakah user authenticated adalah admin aktif di store saat ini
create or replace function public.is_store_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid()
      and s.store_id = app.current_store_id()
      and s.role = 'admin'
      and s.active
  );
$$;

grant execute on function public.staff_auth_email(uuid) to anon, authenticated;
grant execute on function public.is_store_admin() to anon, authenticated;

-- 4) RLS staff baru
drop policy if exists "store_scope" on public.staff;

drop policy if exists "staff_select" on public.staff;
create policy "staff_select" on public.staff
  for select
  using (store_id = app.current_store_id());

drop policy if exists "staff_admin_insert" on public.staff;
create policy "staff_admin_insert" on public.staff
  for insert
  with check (store_id = app.current_store_id() and public.is_store_admin());

drop policy if exists "staff_admin_update" on public.staff;
create policy "staff_admin_update" on public.staff
  for update
  using (public.is_store_admin())
  with check (store_id = app.current_store_id() and public.is_store_admin());

drop policy if exists "staff_admin_delete" on public.staff;
create policy "staff_admin_delete" on public.staff
  for delete
  using (public.is_store_admin());
