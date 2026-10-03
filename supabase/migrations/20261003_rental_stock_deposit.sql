-- 20261003_rental_stock_deposit.sql
-- E20 (keputusan user 2026-10-03): (a) batal/refund nota sewa tidak lagi menambah stok dobel untuk barang yang
-- sudah DITERIMA kembali; (b) deposit sewa tercatat (dikembalikan / dipotong / catatan) lewat RPC atomik.
-- Tanpa perubahan pada data lama (kolom baru default 0 / null). Dijalankan lewat MCP Supabase (apply_migration).

begin;

-- ============ (a) stok dobel ============
-- reverse_sale_stock (dipicu paid/partial -> cancelled/refunded oleh on_transaction_status_change) mengembalikan SEMUA qty
-- item nota. Untuk nota sewa, sebagian/seluruh barang mungkin sudah dikembalikan lewat return_rental (stok +returned_qty),
-- sehingga pembatalan harus mengembalikan hanya (qty - returned_qty).
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

  if tx.customer_id is not null then
    update public.customers
    set total_purchases = greatest(0, total_purchases - tx.total),
        visit_count = greatest(0, visit_count - 1)
    where id = tx.customer_id;
  end if;
end;
$$;

-- pengaman: barang sewa dari nota yang sudah batal/refund tidak boleh "diterima" lagi (stok sudah dikembalikan oleh trigger)
create or replace function public.return_rental(p_rental uuid, p_qty integer, p_staff text)
returns void language plpgsql security definer set search_path = public
as $$
declare r record; v_left int; v_status text;
begin
  if coalesce(auth.role(), 'anon') = 'anon' then raise exception 'forbidden_role'; end if;
  if p_qty <= 0 then raise exception 'qty_invalid'; end if;

  select * into r from rentals where id = p_rental for update;
  if not found then raise exception 'rental_not_found'; end if;
  if public.my_store_id() is not null and not public.is_manager_all()
     and (select store_id from transactions where id = r.transaction_id) is distinct from public.my_store_id() then
    raise exception 'store_scope';
  end if;
  select status into v_status from transactions where id = r.transaction_id;
  if v_status not in ('paid', 'partial') then raise exception 'rental_not_active'; end if;
  v_left := r.qty - r.returned_qty;
  if p_qty > v_left then raise exception 'too_many_returned'; end if;

  perform public._apply_stock_delta(
    r.product_id,
    (select store_id from transactions where id = r.transaction_id),
    p_qty, 'return', p_staff, 'Pengembalian sewa', 'RENT-' || left(p_rental::text, 8)
  );

  update rentals
     set returned_qty = returned_qty + p_qty,
         returned_at = case when returned_qty + p_qty >= qty then now() else returned_at end
   where id = p_rental;
end;
$$;

-- ============ (b) deposit tercatat ============
-- deposit (per unit, sudah ada) × qty = deposit diterima kasir (tunai, terpisah dari total bayar & omzet).
-- Ditahan = deposit × qty − deposit_refunded − deposit_deducted. Potongan (kerusakan/telat) hanya dicatat,
-- TIDAK otomatis menjadi pendapatan.
alter table public.rentals
  add column if not exists deposit_refunded numeric(12,2) not null default 0,
  add column if not exists deposit_deducted numeric(12,2) not null default 0,
  add column if not exists deposit_note text,
  add column if not exists deposit_settled_at timestamptz;

alter table public.rentals drop constraint if exists rentals_deposit_settle_check;
alter table public.rentals
  add constraint rentals_deposit_settle_check
  check (deposit_refunded >= 0 and deposit_deducted >= 0
         and deposit_refunded + deposit_deducted <= coalesce(deposit, 0) * qty);

create or replace function public.settle_rental_deposit(
  p_rental uuid,
  p_refund numeric,
  p_deduct numeric,
  p_note text,
  p_staff text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_store uuid;
  v_refund numeric := coalesce(p_refund, 0);
  v_deduct numeric := coalesce(p_deduct, 0);
  v_held numeric;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if coalesce(auth.role(), 'anon') = 'anon' then raise exception 'forbidden_role'; end if;
  if v_refund < 0 or v_deduct < 0 or v_refund + v_deduct = 0 then raise exception 'amount_invalid'; end if;

  select * into r from rentals where id = p_rental for update;
  if not found then raise exception 'rental_not_found'; end if;
  select store_id into v_store from transactions where id = r.transaction_id;
  if public.my_store_id() is not null and not public.is_manager_all()
     and v_store is distinct from public.my_store_id() then
    raise exception 'store_scope';
  end if;

  v_held := coalesce(r.deposit, 0) * r.qty - r.deposit_refunded - r.deposit_deducted;
  if v_refund + v_deduct > v_held then raise exception 'deposit_exceeds_held'; end if;

  update rentals
     set deposit_refunded = deposit_refunded + v_refund,
         deposit_deducted = deposit_deducted + v_deduct,
         deposit_note = case
           when v_note is null then deposit_note
           else concat_ws(' | ', deposit_note, '[' || coalesce(nullif(btrim(p_staff), ''), '?') || '] ' || v_note)
         end,
         deposit_settled_at = case when v_held - v_refund - v_deduct <= 0 then now() else deposit_settled_at end
   where id = p_rental;
end;
$$;

revoke execute on function public.settle_rental_deposit(uuid, numeric, numeric, text, text) from public;
grant execute on function public.settle_rental_deposit(uuid, numeric, numeric, text, text) to anon, authenticated;

commit;
