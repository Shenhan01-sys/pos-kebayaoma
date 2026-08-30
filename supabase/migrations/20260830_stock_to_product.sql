-- ============================================================================
-- 20260830 REFRACTOR STOK KE LEVEL PRODUK
-- ----------------------------------------------------------------------------
-- Sebelum: stok ada di `variants.stock`. Series (variant) punya stok sendiri.
-- Sesudah: stok ada di `products.stock`. Series hanya info (name/size/color/price).
-- Inventory mencatat 1 angka per produk. Detail series ada di transaction_items.
-- ============================================================================

-- 1) Tambah kolom `stock` di products (default 0)
alter table public.products
  add column if not exists stock integer not null default 0;

-- 2) Migrasi data: total stok dari variants → products
update public.products p
  set stock = coalesce((
    select sum(v.stock) from public.variants v where v.product_id = p.id
  ), 0)
  where exists (select 1 from public.variants v where v.product_id = p.id and v.stock is not null);

-- 3) Tambah kolom `name` di variants (series name)
alter table public.variants
  add column if not exists name text;

-- Default: isi name dari size+color supaya tidak null untuk data lama
update public.variants
  set name = coalesce(nullif(concat(size, ' / ', color), ' / '), 'Series 1')
  where name is null;

alter table public.variants
  alter column name set not null;

-- 4) Tambah kolom `photo_proof` di transactions
alter table public.transactions
  add column if not exists photo_proof text;

-- 5) Drop kolom stock dari variants (setelah data dimigrasi)
alter table public.variants
  drop column if exists stock;

-- ============================================================================
-- 6) Update trigger apply_sale_stock: kurangi stok di produk (group by product)
-- ============================================================================
create or replace function public.apply_sale_stock()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  item record;
begin
  for item in
    select product_id, sum(quantity) as total_qty
    from public.transaction_items
    where transaction_id = new.id
    group by product_id
  loop
    -- Kurangi stok di produk
    update public.products
    set stock = greatest(0, stock - item.total_qty)
    where id = item.product_id;

    -- Catat pergerakan stok (per produk)
    insert into public.stock_movements (
      store_id, variant_id, sku, product_name, type, quantity, reason, note, staff
    )
    select
      new.store_id,
      item.product_id,
      p.sku,
      p.name,
      'sale',
      -item.total_qty,
      'Penjualan',
      new.number,
      new.cashier
    from public.products p
    where p.id = item.product_id;
  end loop;

  -- Update statistik pelanggan
  if new.customer_id is not null then
    update public.customers
    set total_purchases = total_purchases + new.total,
        visit_count = visit_count + 1
    where id = new.customer_id;
  end if;
end;
$$;

-- ============================================================================
-- 7) Update trigger reverse_sale_stock: kembalikan stok di produk (group by product)
-- ============================================================================
create or replace function public.reverse_sale_stock()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  item record;
begin
  for item in
    select product_id, sum(quantity) as total_qty
    from public.transaction_items
    where transaction_id = old.id
    group by product_id
  loop
    -- Kembalikan stok di produk
    update public.products
    set stock = stock + item.total_qty
    where id = item.product_id;

    -- Catat pergerakan stok (per produk)
    insert into public.stock_movements (
      store_id, variant_id, sku, product_name, type, quantity, reason, note, staff
    )
    select
      old.store_id,
      item.product_id,
      p.sku,
      p.name,
      'return',
      item.total_qty,
      case when new.status = 'refunded' then 'Refund' else 'Pembatalan' end,
      old.number,
      old.cashier
    from public.products p
    where p.id = item.product_id;
  end loop;

  -- Turunkan statistik pelanggan
  if old.customer_id is not null then
    update public.customers
    set total_purchases = greatest(0, total_purchases - old.total),
        visit_count = greatest(0, visit_count - 1)
    where id = old.customer_id;
  end if;
end;
$$;

-- Trigger functions on_transaction_status_change dan on_transaction_insert_paid
-- tetap sama (mereka panggil apply_sale_stock/reverse_sale_stock yang sudah diupdate).

-- ============================================================================
-- 8) Pastikan grant tetap
-- ============================================================================
grant execute on function public.apply_sale_stock() to anon, authenticated;
grant execute on function public.reverse_sale_stock() to anon, authenticated;

-- ============================================================================
-- CATATAN:
-- - `stock_movements.variant_id` sekarang menyimpan product_id (bukan variant_id
--   lagi). Nama kolom tidak di-rename untuk backward-compat, tapi semantiknya
--   berubah jadi product reference. Jika mau rename, jalankan terpisah:
--   alter table public.stock_movements rename column variant_id to product_id;
-- - Frontend store/data.ts sudah compatible dengan skema ini.
-- - PowerSync schema (lib/powersync/schema.ts) sudah diupdate mengikuti.
-- ============================================================================
