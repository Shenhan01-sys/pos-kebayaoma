-- 20261004_customer_stats_rental.sql
-- B2 (keputusan user "gas" 2026-10-04, opsi 1): statistik pelanggan (total_purchases / visit_count)
-- tidak lagi menghitung nota SEWA (kind='rental') sebagai "belanja" — trigger skip sewa,
-- + koreksi one-time: kembalikan kontribusi nota sewa lunas yang sudah tercatat.
-- Stok/movement TIDAK berubah (logika stok sewa tetap pakai jalur E20).

begin;

-- (1) apply_sale_stock: statistik pelanggan hanya untuk non-rental
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

  -- B2: nota sewa bukan "belanja" pelanggan (uang sewa & deposit di luar omzet belanja)
  if tx.customer_id is not null and tx.kind is distinct from 'rental' then
    update public.customers
    set total_purchases = total_purchases + tx.total,
        visit_count = visit_count + 1
    where id = tx.customer_id;
  end if;
end;
$$;

-- (2) reverse_sale_stock: simetris — batal/refund sewa tidak mengurangi statistik
--     (statistik sewa memang tidak pernah ditambah sejak perubahan ini)
create or replace function public.reverse_sale_stock(p_transaction_id uuid, p_is_refund boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare
  item record;
  tx record;
  v_back int;
begin
  select * into tx from public.transactions where id = p_transaction_id;
  if not found then return; end if;

  for item in
    select product_id, sum(quantity)::int as total_qty
    from public.transaction_items
    where transaction_id = p_transaction_id
    group by product_id
  loop
    v_back := item.total_qty;
    if tx.kind = 'rental' then
      v_back := greatest(0, item.total_qty - coalesce((
        select sum(r.returned_qty)::int from public.rentals r
         where r.transaction_id = p_transaction_id and r.product_id = item.product_id
      ), 0));
    end if;

    if v_back > 0 then
      update public.products
      set stock = stock + v_back
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
        v_back,
        case when p_is_refund then 'Refund' else 'Pembatalan' end || case when tx.kind = 'rental' then ' sewa' else '' end,
        tx.number,
        tx.cashier
      from public.products p
      where p.id = item.product_id;
    end if;
  end loop;

  -- B2: simetris dengan apply_sale_stock — sewa tidak menyentuh statistik pelanggan
  if tx.customer_id is not null and tx.kind is distinct from 'rental' then
    update public.customers
    set total_purchases = greatest(0, total_purchases - tx.total),
        visit_count = greatest(0, visit_count - 1)
    where id = tx.customer_id;
  end if;
end;
$$;

-- (3) koreksi one-time: kembalikan kontribusi nota sewa lunas yang tercatat sebelum perubahan
--     (idempoten-pengaman: jalankan SEKALI; jumlah baris terdampak dicatat di vault)
update public.customers c
set total_purchases = greatest(0, c.total_purchases - sub.total),
    visit_count = greatest(0, c.visit_count - sub.visits)
from (
  select customer_id, sum(total) as total, count(*) as visits
  from public.transactions
  where status = 'paid' and kind = 'rental' and customer_id is not null
  group by customer_id
) sub
where c.id = sub.customer_id;

commit;
