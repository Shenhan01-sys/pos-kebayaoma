-- 20260913_enhancements_foundation.sql
-- Fase 0 [[07-Backlog/02 - Implementation Plan Enhancements]] (plan vault 07-Backlog/02):
-- RPC adjust_stock atomik (fix bug E2), vendors + vendor_prices + kolom lot di
-- stock_movements/transaction_items, stock_transfers + RPC, kolom preorder di
-- transactions (+ status 'partial'), rentals + kolom rental di variants,
-- penyesuaian trigger agar reserve stok utk status 'partial'.

begin;

-- ============ 0.1 RPC atomik stok ============
-- _apply_stock_delta = inti TANPA cek scope (dipakai RPC lain yang sudah menjaga
-- otorisasinya sendiri, mis. send_transfer). adjust_stock = wrapper utk panggilan FE.

create or replace function public._apply_stock_delta(
  p_product uuid,
  p_store uuid,
  p_delta int,
  p_type text,
  p_staff text,
  p_reason text default null,
  p_note text default null,
  p_vendor uuid default null,
  p_unit_cost numeric default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old int;
  v_new int;
  v_delta int;
begin
  if p_type not in ('sale','restock','adjustment','return','transfer') then
    raise exception 'invalid_movement_type';
  end if;

  select stock into v_old
    from products
   where id = p_product and store_id = p_store
     for update;
  if not found then
    raise exception 'product_not_found';
  end if;

  update products
     set stock = greatest(0, v_old + p_delta)
   where id = p_product
  returning stock into v_new;

  v_delta := v_new - v_old;
  if v_delta = 0 then
    return v_new;
  end if;

  insert into stock_movements (store_id, variant_id, sku, product_name,
                               type, quantity, reason, note, staff,
                               vendor_id, unit_cost)
  select p_store, p.id, p.sku, p.name, p_type, v_delta,
         p_reason, p_note, p_staff, p_vendor, p_unit_cost
    from products p
   where p.id = p_product;

  return v_new;
end;
$$;

create or replace function public.adjust_stock(
  p_product uuid,
  p_store uuid,
  p_delta int,
  p_type text,
  p_staff text,
  p_reason text default null,
  p_note text default null,
  p_vendor uuid default null,
  p_unit_cost numeric default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Guard scope utk panggilan user-facing; konteks internal/cron (tanpa JWT) = lolos
  if public.my_store_id() is not null
     and not public.is_manager_all()
     and p_store is distinct from public.my_store_id() then
    raise exception 'store_scope';
  end if;

  return public._apply_stock_delta(p_product, p_store, p_delta, p_type, p_staff,
                                   p_reason, p_note, p_vendor, p_unit_cost);
end;
$$;

revoke execute on function public._apply_stock_delta(uuid, uuid, int, text, text, text, text, uuid, numeric) from public, anon, authenticated;
revoke execute on function public.adjust_stock(uuid, uuid, int, text, text, text, text, uuid, numeric) from public;
grant execute on function public.adjust_stock(uuid, uuid, int, text, text, text, text, uuid, numeric) to anon, authenticated;

-- ============ 0.2 Vendor ============

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  phone text,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists vendors_store_lower_name
  on public.vendors (store_id, lower(name));

create table if not exists public.vendor_prices (
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  unit_cost numeric not null,
  updated_at timestamptz not null default now(),
  primary key (vendor_id, product_id)
);

alter table public.stock_movements
  add column if not exists vendor_id uuid references public.vendors(id),
  add column if not exists unit_cost numeric;

alter table public.transaction_items
  add column if not exists vendor_id uuid references public.vendors(id);

alter table public.vendors enable row level security;
alter table public.vendor_prices enable row level security;

drop policy if exists store_scope on public.vendors;
create policy store_scope on public.vendors
  using (public.is_manager_all() or store_id = public.my_store_id())
  with check (public.is_manager_all() or store_id = public.my_store_id());

drop policy if exists store_scope on public.vendor_prices;
create policy store_scope on public.vendor_prices
  using (exists (
    select 1 from public.vendors v
     where v.id = vendor_prices.vendor_id
       and (public.is_manager_all() or v.store_id = public.my_store_id())))
  with check (exists (
    select 1 from public.vendors v
     where v.id = vendor_prices.vendor_id
       and (public.is_manager_all() or v.store_id = public.my_store_id())));

-- ============ 0.3 Transfer antar-outlet (E1) ============
-- CATATAN realita DB (2026-09-13): baris produk PER TOKO (id beda), dan KTB belum punya
-- katalog sama sekali. Maka transfer menyimpan from_product + to_product; jika SKU tidak
-- ada di toko tujuan → clone otomatis katalog (products + variants) saat Kirim.

create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  from_store uuid not null references public.stores(id),
  to_store uuid not null references public.stores(id),
  from_product uuid not null references public.products(id),
  to_product uuid references public.products(id),
  qty int not null check (qty > 0),
  cost numeric,
  status text not null default 'pending'
    check (status in ('pending','sent','cancelled')),
  requested_by text not null,
  sent_by text,
  note text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  check (from_store <> to_store)
);

create index if not exists idx_transfers_status on public.stock_transfers(status);

alter table public.stock_transfers enable row level security;

drop policy if exists store_scope on public.stock_transfers;
create policy store_scope on public.stock_transfers
  using (public.is_manager_all()
         or from_store = public.my_store_id()
         or to_store = public.my_store_id())
  with check (public.is_manager_all()
              or from_store = public.my_store_id()
              or to_store = public.my_store_id());

-- helper internal: nama staff pemanggil (fallback aman utk service/cron)
create or replace function public.caller_staff_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.name from staff s where s.user_id = auth.uid() limit 1),
    'sistem'
  );
$$;

create or replace function public.send_transfer(p_transfer uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  v_src record;
  v_to_product uuid;
  v_cat uuid;
  v_staff text;
begin
  select * into t from stock_transfers where id = p_transfer for update;
  if not found then raise exception 'transfer_not_found'; end if;
  if t.status <> 'pending' then raise exception 'transfer_not_pending'; end if;

  -- hanya pihak PENGIRIM (atau manager-all) yang boleh menekan Kirim
  if public.my_store_id() is not null
     and not public.is_manager_all()
     and t.from_store is distinct from public.my_store_id() then
    raise exception 'store_scope';
  end if;

  select * into v_src from products where id = t.from_product for update;
  if not found or v_src.store_id <> t.from_store then raise exception 'product_not_found'; end if;

  -- produk tujuan: same SKU di toko tujuan; kalau belum ada → clone katalog (stock 0)
  select id into v_to_product
    from products
   where store_id = t.to_store and lower(sku) = lower(v_src.sku)
   limit 1;

  if v_to_product is null then
    select c.id into v_cat
      from categories src
      join categories c on c.store_id = t.to_store and c.slug = src.slug
     where src.id = v_src.category_id
     limit 1;

    insert into products (store_id, sku, name, description, category_id, images,
                          tags, active, fabric, care, season, brand, compare_at, stock)
    select t.to_store, v_src.sku, v_src.name, v_src.description, v_cat, v_src.images,
           v_src.tags, v_src.active, v_src.fabric, v_src.care,
           v_src.season, v_src.brand, v_src.compare_at, 0
    returning id into v_to_product;

    insert into variants (product_id, sku, name, size, color, color_code,
                          selling_price, cost_price, barcode)
    select v_to_product, tv.sku, tv.name, tv.size, tv.color, tv.color_code,
           tv.selling_price, tv.cost_price, tv.barcode
      from variants tv where tv.product_id = v_src.id;
  end if;

  v_staff := public.caller_staff_name();

  -- pakai inti tanpa-guard: kirim = -qty asal, terima = +qty tujuan (1 transaksi,
  -- gagal di mana pun = rollback penuh)
  perform public._apply_stock_delta(t.from_product, t.from_store, -t.qty, 'transfer',
    v_staff, 'Transfer keluar', 'TRF-' || left(p_transfer::text, 8));
  perform public._apply_stock_delta(v_to_product, t.to_store, t.qty, 'transfer',
    v_staff, 'Transfer masuk', 'TRF-' || left(p_transfer::text, 8));

  update stock_transfers
     set status = 'sent', sent_at = now(), sent_by = v_staff,
         to_product = v_to_product
   where id = p_transfer;
end;
$$;

create or replace function public.cancel_transfer(p_transfer uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare t record;
begin
  select * into t from stock_transfers where id = p_transfer for update;
  if not found then raise exception 'transfer_not_found'; end if;
  if t.status <> 'pending' then raise exception 'transfer_not_pending'; end if;
  update stock_transfers set status = 'cancelled' where id = p_transfer;
end;
$$;

revoke execute on function public.send_transfer(uuid), public.cancel_transfer(uuid) from public;
grant execute on function public.send_transfer(uuid), public.cancel_transfer(uuid) to anon, authenticated;

-- ============ 0.4 Preorder (E6) ============

alter table public.transactions
  drop constraint if exists transactions_status_check;
alter table public.transactions
  add constraint transactions_status_check
  check (status in ('pending','paid','partial','cancelled','refunded'));

alter table public.transactions
  add column if not exists kind text not null default 'sale' check (kind in ('sale','preorder')),
  add column if not exists due_date date,
  add column if not exists dp_amount numeric,
  add column if not exists dp_method text,
  add column if not exists reminded_at_50 timestamptz,
  add column if not exists reminded_at_20 timestamptz;

create index if not exists idx_tx_preorder_open on public.transactions(kind, status, due_date)
  where kind = 'preorder' and status = 'partial';

-- ============ 0.4b Sewa (E7) ============

alter table public.variants
  add column if not exists rental_price numeric,
  add column if not exists rental_days int not null default 3,
  add column if not exists deposit_price numeric;

create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  customer_id uuid references public.customers(id),
  product_id uuid not null references public.products(id),
  qty int not null check (qty > 0),
  rent_price numeric not null,
  deposit numeric,
  start_date date not null default current_date,
  due_date date not null,
  returned_at timestamptz,
  returned_qty int not null default 0 check (returned_qty >= 0 and returned_qty <= qty),
  reminded_at_20 timestamptz,
  reminded_at_0 timestamptz,
  overdue_reminded_at timestamptz
);

create index if not exists idx_rentals_due on public.rentals(due_date);

alter table public.rentals enable row level security;

drop policy if exists store_scope on public.rentals;
create policy store_scope on public.rentals
  using (exists (
    select 1 from public.transactions t
     where t.id = rentals.transaction_id
       and (public.is_manager_all() or t.store_id = public.my_store_id())))
  with check (exists (
    select 1 from public.transactions t
     where t.id = rentals.transaction_id
       and (public.is_manager_all() or t.store_id = public.my_store_id())));

-- ============ 0.4c Trigger: reserve stok juga utk 'partial' (PO & Sewa) ============

create or replace function public.on_transaction_insert_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('paid','partial') then
    perform public.apply_sale_stock(new.id);
  end if;
  return new;
end;
$$;

create or replace function public.on_transaction_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- pending -> paid/partial: terapkan efek penjualan (reserve utk PO)
  if old.status = 'pending' and new.status in ('paid','partial') then
    perform public.apply_sale_stock(new.id);
  end if;

  -- paid/partial -> cancelled/refunded: kembalikan stok
  if old.status in ('paid','partial') and new.status in ('cancelled','refunded') then
    perform public.reverse_sale_stock(old.id, new.status = 'refunded');
  end if;

  -- partial -> paid: LUNAS — stok sudah direverse saat PO, JANGAN decrement lagi
  return new;
end;
$$;

commit;
