-- ----------------------------------------------------------------------------
-- 20260905 RBAC MANAGER + STAFF
-- Unifikasi role menjadi 2 nilai: manager, staff.
-- - staff_role_check: penegasan manager|staff. Remote sudah bernilai ini
--   (dibuktikan probe REST 2026-09-05: admin/cashier/invalid ditolak 23514,
--   manager/staff diterima). File ini mendokumentasikan + membuatnya
--   reproducible untuk fresh setup.
-- - transactions_payment_method_check: tambah 'shopee'. Types + UI + laporan
--   sudah memakai shopee; probe 2026-09-05 membuktikan insert shopee ke DB
--   ditolak 23514 sebelum migrasi ini.
-- - is_store_admin(): cek role='manager' (nama fungsi historis dipertahankan
--   karena 4 policy staff merujuknya; arti kini = manager aktif di store
--   saat ini, RBAC 2-role 2026-09-05).
-- ----------------------------------------------------------------------------

-- 1) staff role CHECK -> manager|staff
alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff
  add constraint staff_role_check check (role in ('manager', 'staff'));

-- 2) transactions payment_method CHECK + shopee
alter table public.transactions drop constraint if exists transactions_payment_method_check;
alter table public.transactions
  add constraint transactions_payment_method_check
  check (payment_method in ('qris', 'cash', 'transfer', 'shopee'));

-- 3) Helper otorisasi: manager aktif di store saat ini
create or replace function public.is_store_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid()
      and s.store_id = app.current_store_id()
      and s.role = 'manager'
      and s.active
  );
$$;

comment on function public.is_store_admin() is
  'Historic name: true jika pemanggil adalah staff aktif ber-role manager di store saat ini (RBAC 2-role 2026-09-05).';
