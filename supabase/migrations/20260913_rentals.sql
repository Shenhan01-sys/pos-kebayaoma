-- 20260913_rentals.sql
-- E7 (Fase 6): kind 'rental', RPC create_rental (1 transaksi atomik + header paid +
-- items + baris rentals; stok reserve oleh trigger on_transaction_insert_paid) dan
-- return_rental (pengembalian via RPC adjust atomik + movement return).

begin;

-- izinkan kind 'rental'
alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions
  add constraint transactions_kind_check
  check (kind in ('sale','preorder','rental'));

-- helper: ambil/refresh id produk KTB? TIDAK perlu — rental memakai produk toko tsb langsung.

create or replace function public.create_rental(
  p_store uuid,
  p_product uuid,
  p_variant uuid,
  p_qty int,
  p_rent_price numeric,
  p_deposit numeric,
  p_start_date date,
  p_days int,
  p_customer_name text,
  p_customer_phone text,
  p_cashier text,
  p_payment_method text,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cust uuid;
  v_tx uuid;
  v_number text;
  v_due date;
  v_total numeric;
  v_prod record;
  v_var record;
begin
  if coalesce(auth.role(), 'anon') = 'anon' then raise exception 'forbidden_role'; end if;
  if public.my_store_id() is not null and not public.is_manager_all()
     and p_store is distinct from public.my_store_id() then raise exception 'store_scope'; end if;
  if p_qty <= 0 then raise exception 'qty_invalid'; end if;
  if p_rent_price <= 0 then raise exception 'no_rental_price'; end if;

  select * into v_prod from products where id = p_product and store_id = p_store for update;
  if not found then raise exception 'product_not_found'; end if;
  select * into v_var from variants where id = p_variant and product_id = p_product;
  if not found then raise exception 'variant_not_found'; end if;
  if v_prod.stock < p_qty then raise exception 'insufficient_stock'; end if;

  v_due := p_start_date + coalesce(p_days, 3);
  v_total := round(p_rent_price * p_qty);

  -- pelanggan (auto-create di customers, keputusan E7c)
  select id into v_cust from customers
    where store_id = p_store and lower(name) = lower(p_customer_name) limit 1;
  if v_cust is null and coalesce(p_customer_name, '') <> '' then
    insert into customers (store_id, name, phone)
      values (p_store, p_customer_name, p_customer_phone)
      returning id into v_cust;
  end if;

  -- header 'pending' dulu → items → update 'paid': trigger status-change reserve stok
  -- SAAT items sudah lengkap (pola produksi saveTransaction; trigger insert-paid
  -- TIDAK boleh decrement saat items belum ada).
  v_number := public.next_tx_number(p_store);
  insert into transactions (store_id, number, cashier, status, payment_method, payment_status,
      subtotal, tax, discount, total, amount_paid, change, kind, due_date, customer_id, customer_name)
    values (p_store, v_number, p_cashier, 'pending', p_payment_method, 'pending',
      v_total, 0, 0, v_total, v_total, 0, 'rental', v_due, v_cust, p_customer_name)
    returning id into v_tx;

  insert into transaction_items (transaction_id, product_id, variant_id, name, sku, size, color,
      quantity, unit_price, cost_price, discount, total)
    values (v_tx, p_product, p_variant, v_prod.name, v_var.sku, v_var.size, v_var.color,
      p_qty, p_rent_price, null, 0, v_total);

  update transactions set status = 'paid', payment_status = 'paid' where id = v_tx;

  insert into rentals (transaction_id, customer_id, product_id, qty, rent_price, deposit, start_date, due_date)
    values (v_tx, v_cust, p_product, p_qty, p_rent_price, p_deposit, p_start_date, v_due);

  return v_tx;
end;
$$;

-- Pengembalian sebagian/penuh: qty masuk stok (movement return) + update rentals.
create or replace function public.return_rental(
  p_rental uuid,
  p_qty int,
  p_staff text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_left int;
begin
  if coalesce(auth.role(), 'anon') = 'anon' then raise exception 'forbidden_role'; end if;
  if p_qty <= 0 then raise exception 'qty_invalid'; end if;

  select * into r from rentals where id = p_rental for update;
  if not found then raise exception 'rental_not_found'; end if;
  if public.my_store_id() is not null and not public.is_manager_all()
     and (select store_id from transactions where id = r.transaction_id) is distinct from public.my_store_id() then
    raise exception 'store_scope';
  end if;
  v_left := r.qty - r.returned_qty;
  if p_qty > v_left then raise exception 'too_many_returned'; end if;

  -- kembalikan stok lewat inti atomik (type 'return', movement +qty)
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

revoke execute on function public.create_rental(uuid, uuid, uuid, int, numeric, numeric, date, int, text, text, text, text, text) from public;
revoke execute on function public.return_rental(uuid, int, text) from public;
grant execute on function public.create_rental(uuid, uuid, uuid, int, numeric, numeric, date, int, text, text, text, text, text) to anon, authenticated;
grant execute on function public.return_rental(uuid, int, text) to anon, authenticated;

commit;
