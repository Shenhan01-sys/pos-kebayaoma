-- ----------------------------------------------------------------------------
-- 20260905 FIX STOCK TRIGGERS (KRITIS)
-- Masalah: apply_sale_stock() dan reverse_sale_stock() dideklarasikan
-- RETURNS trigger tetapi dipanggil via PERFORM dari trigger lain.
-- Postgres menolaknya: "trigger functions can only be called as triggers"
-- (0A000, dibuktikan live 2026-09-05). Akibat: SETIAP insert paid dan
-- update menuju paid/cancelled/refunded GAGAL — checkout ke Supabase mati.
--
-- Perbaikan: jadikan keduanya fungsi biasa (RETURNS void) dengan argumen
-- eksplisit, dipanggil dengan NEW.id / OLD.id dari trigger pemicu.
-- Versi zero-arg lama di-drop agar tidak membingungkan.
--
-- Catatan alur: aplikasi menyimpan header sebagai pending, lalu insert items,
-- lalu update ke paid — sehingga trigger pending->paid selalu melihat items.
-- ----------------------------------------------------------------------------

drop function if exists public.apply_sale_stock();
drop function if exists public.reverse_sale_stock();

-- ----------------------------------------------------------------------------
-- Helper: terapkan efek penjualan (kurangi stok produk + movement + stats)
-- ----------------------------------------------------------------------------
create or replace function public.apply_sale_stock(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  item record;
  tx record;
begin
  select * into tx from public.transactions where id = p_transaction_id;
  if not found then return; end if;

  for item in
    select product_id, sum(quantity)::int as total_qty
    from public.transaction_items
    where transaction_id = p_transaction_id
    group by product_id
  loop
    update public.products
    set stock = greatest(0, stock - item.total_qty)
    where id = item.product_id;

    insert into public.stock_movements (
      store_id, variant_id, sku, product_name, type, quantity, reason, note, staff
    )
    select
      tx.store_id,
      item.product_id,
      p.sku,
      p.name,
      'sale',
      -item.total_qty,
      'Penjualan',
      tx.number,
      tx.cashier
    from public.products p
    where p.id = item.product_id;
  end loop;

  if tx.customer_id is not null then
    update public.customers
    set total_purchases = total_purchases + tx.total,
        visit_count = visit_count + 1
    where id = tx.customer_id;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Helper: kembalikan efek penjualan (batal/refund)
-- ----------------------------------------------------------------------------
create or replace function public.reverse_sale_stock(p_transaction_id uuid, p_is_refund boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare
  item record;
  tx record;
begin
  select * into tx from public.transactions where id = p_transaction_id;
  if not found then return; end if;

  for item in
    select product_id, sum(quantity)::int as total_qty
    from public.transaction_items
    where transaction_id = p_transaction_id
    group by product_id
  loop
    update public.products
    set stock = stock + item.total_qty
    where id = item.product_id;

    insert into public.stock_movements (
      store_id, variant_id, sku, product_name, type, quantity, reason, note, staff
    )
    select
      tx.store_id,
      item.product_id,
      p.sku,
      p.name,
      'return',
      item.total_qty,
      case when p_is_refund then 'Refund' else 'Pembatalan' end,
      tx.number,
      tx.cashier
    from public.products p
    where p.id = item.product_id;
  end loop;

  if tx.customer_id is not null then
    update public.customers
    set total_purchases = greatest(0, total_purchases - tx.total),
        visit_count = greatest(0, visit_count - 1)
    where id = tx.customer_id;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Pemicu: perubahan status
-- ----------------------------------------------------------------------------
create or replace function public.on_transaction_status_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- pending -> paid: terapkan efek penjualan (items sudah ada)
  if old.status = 'pending' and new.status = 'paid' then
    perform public.apply_sale_stock(new.id);
  end if;

  -- paid -> cancelled/refunded: kembalikan stok
  if old.status = 'paid' and new.status in ('cancelled', 'refunded') then
    perform public.reverse_sale_stock(old.id, new.status = 'refunded');
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Pemicu: insert langsung paid (mis. via dashboard; items biasanya belum ada
-- sehingga natural no-op — alur aplikasi memakai pending-first)
-- ----------------------------------------------------------------------------
create or replace function public.on_transaction_insert_paid()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'paid' then
    perform public.apply_sale_stock(new.id);
  end if;
  return new;
end;
$$;

grant execute on function public.apply_sale_stock(uuid) to anon, authenticated;
grant execute on function public.reverse_sale_stock(uuid, boolean) to anon, authenticated;
