-- ============================================================================
-- 20250823 AUTO STOCK & CUSTOMER STATS ON TRANSACTION STATUS CHANGE
-- Trigger otomatis:
--   pending → paid      : kurangi stok per item, naikkan total_purchases & visit_count
--   paid → cancelled    : kembalikan stok per item, turunkan total_purchases & visit_count
--   paid → refunded     : sama seperti cancelled
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Helper: kurangi stok per item transaksi
-- ----------------------------------------------------------------------------
create or replace function public.apply_sale_stock()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  item record;
  v record;
begin
  for item in
    select * from public.transaction_items where transaction_id = new.id
  loop
    -- Kurangi stok
    update public.variants
    set stock = greatest(0, stock - item.quantity)
    where id = item.variant_id;

    -- Catat pergerakan stok
    insert into public.stock_movements (
      store_id, variant_id, sku, product_name, type, quantity, reason, note, staff
    )
    select
      new.store_id,
      item.variant_id,
      item.sku,
      item.name,
      'sale',
      -item.quantity,
      'Penjualan',
      new.number,
      new.cashier;
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

-- ----------------------------------------------------------------------------
-- 2) Helper: kembalikan stok per item transaksi (batal/refund)
-- ----------------------------------------------------------------------------
create or replace function public.reverse_sale_stock()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  item record;
  v record;
begin
  for item in
    select * from public.transaction_items where transaction_id = old.id
  loop
    -- Kembalikan stok
    update public.variants
    set stock = stock + item.quantity
    where id = item.variant_id;

    -- Catat pergerakan stok
    insert into public.stock_movements (
      store_id, variant_id, sku, product_name, type, quantity, reason, note, staff
    )
    select
      old.store_id,
      item.variant_id,
      item.sku,
      item.name,
      'return',
      item.quantity,
      case when new.status = 'refunded' then 'Refund' else 'Pembatalan' end,
      old.number,
      old.cashier;
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

-- ----------------------------------------------------------------------------
-- 3) Trigger untuk UPDATE (pending → paid, paid → cancelled/refunded)
-- ----------------------------------------------------------------------------
create or replace function public.on_transaction_status_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- pending → paid: apply sale side effects
  if old.status = 'pending' and new.status = 'paid' then
    perform public.apply_sale_stock();
  end if;

  -- paid → cancelled/refunded: reverse sale
  if old.status = 'paid' and new.status in ('cancelled', 'refunded') then
    perform public.reverse_sale_stock();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_transaction_status_change on public.transactions;
create trigger trg_transaction_status_change
  after update of status on public.transactions
  for each row
  when (old.status is distinct from new.status)
  execute function public.on_transaction_status_change();

-- ----------------------------------------------------------------------------
-- 4) Trigger untuk INSERT (transaksi langsung paid: cash/transfer)
-- ----------------------------------------------------------------------------
create or replace function public.on_transaction_insert_paid()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'paid' then
    perform public.apply_sale_stock();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_transaction_insert_paid on public.transactions;
create trigger trg_transaction_insert_paid
  after insert on public.transactions
  for each row
  execute function public.on_transaction_insert_paid();

-- ----------------------------------------------------------------------------
-- 4) Grant execute ke roles yang diperlukan
-- ----------------------------------------------------------------------------
grant execute on function public.apply_sale_stock() to anon, authenticated;
grant execute on function public.reverse_sale_stock() to anon, authenticated;
grant execute on function public.on_transaction_status_change() to anon, authenticated;
grant execute on function public.on_transaction_insert_paid() to anon, authenticated;
