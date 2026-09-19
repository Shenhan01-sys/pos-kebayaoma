-- E8: petty cash / pengeluaran kas kecil (admin + superadmin).
-- TABEL `expenses` SUDAH ADA (seed dari 2026.xlsx sheet "Pengeluaran" via SQL 2026-09-04,
-- 58 baris real MJL): kolom id, store_id, date, description, amount, pic, created_at, updated_at.
-- Migrasi ini TIDAK mengubah data lama — hanya melengkapi + mengamankan:
--   + photo_url (opsional, base64 JPEG pola foto bukti transaksi)
--   + created_by (audit)
--   + RLS: admin (Mama/Ci Lanny) + superadmin (Glori) saja — direct tanpa approval (E12 matriks)
-- Kategori TIDAK jadi kolom: derivasi FE dari `description` (lihat lib/expenses.ts).

alter table public.expenses alter column store_id drop not null; -- tabel existing = NOT NULL; desain E8 butuh null = umum/gabungan
alter table public.expenses add column if not exists photo_url text;
alter table public.expenses add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.expenses enable row level security;

drop policy if exists "expenses_select_admin_superadmin" on public.expenses;
drop policy if exists "expenses_insert_admin_superadmin" on public.expenses;
drop policy if exists "expenses_update_admin_superadmin" on public.expenses;
drop policy if exists "expenses_delete_admin_superadmin" on public.expenses;

create policy "expenses_select_admin_superadmin" on public.expenses
  for select using ( is_superadmin() or has_role('admin') );
create policy "expenses_insert_admin_superadmin" on public.expenses
  for insert with check ( is_superadmin() or has_role('admin') );
create policy "expenses_update_admin_superadmin" on public.expenses
  for update using ( is_superadmin() or has_role('admin') );
create policy "expenses_delete_admin_superadmin" on public.expenses
  for delete using ( is_superadmin() or has_role('admin') );

create index if not exists expenses_date_idx on public.expenses (date desc);
