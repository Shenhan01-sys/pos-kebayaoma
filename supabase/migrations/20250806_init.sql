-- ============================================================================
-- POS Kebaya Oma — Initial Supabase schema (PWA / single-store MVP)
-- Jalankan di Supabase Dashboard > SQL Editor (atau via supabase-cli).
-- Mirip persis dengan tipe di lib/dummy.ts + lib/types.ts.
-- ============================================================================

create extension if not exists "uuid-ossp";
create schema if not exists app;

-- ----------------------------------------------------------------------------
-- STORES (MVP single-store: 1 baris is_default = true)
-- ----------------------------------------------------------------------------
create table if not exists public.stores (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  address     text,
  phone       text,
  tax_rate    numeric(5,2) not null default 12.00,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Helper: store id default dipakai RLS agar MVP tetap single-tenant.
create or replace function app.current_store_id() returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.stores where is_default = true limit 1;
$$;

insert into public.stores (name, address, phone, tax_rate, is_default)
values ('Kebaya Oma', 'Jl. Sudirman No. 123, Jakarta', '021-1234-5678', 12.00, true)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- CATEGORIES
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id        uuid primary key default uuid_generate_v4(),
  store_id  uuid not null references public.stores(id) on delete cascade,
  name      text not null,
  slug      text not null,
  unique (store_id, slug)
);

-- ----------------------------------------------------------------------------
-- PRODUCTS + VARIANTS
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id           uuid primary key default uuid_generate_v4(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  sku          text not null,
  name         text not null,
  description  text,
  category_id  uuid references public.categories(id) on delete set null,
  images       text[] default '{}',
  tags         text[] default '{}',
  active       boolean not null default true,
  fabric       text,
  care         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (store_id, sku)
);

create table if not exists public.variants (
  id            uuid primary key default uuid_generate_v4(),
  product_id    uuid not null references public.products(id) on delete cascade,
  sku           text not null,
  size          text not null default 'One Size',
  color         text not null default '',
  color_code    text,
  stock         integer not null default 0,
  selling_price numeric(12,2) not null default 0,
  cost_price    numeric(12,2) not null default 0,
  barcode       text,
  unique (product_id, sku)
);

-- ----------------------------------------------------------------------------
-- CUSTOMERS
-- ----------------------------------------------------------------------------
create table if not exists public.customers (
  id              uuid primary key default uuid_generate_v4(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  name            text not null,
  phone           text,
  total_purchases numeric(12,2) not null default 0,
  visit_count     integer not null default 0
);

-- ----------------------------------------------------------------------------
-- STAFF
-- ----------------------------------------------------------------------------
create table if not exists public.staff (
  id       uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name     text not null,
  pin      text not null,            -- hash (bcrypt/argon) sebelum produksi
  role     text not null check (role in ('manager','staff')),
  phone    text,
  active   boolean not null default true
);

-- ----------------------------------------------------------------------------
-- TRANSACTIONS + ITEMS
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id             uuid primary key default uuid_generate_v4(),
  store_id       uuid not null references public.stores(id) on delete cascade,
  number         text not null,
  cashier        text not null,
  customer_id    uuid references public.customers(id) on delete set null,
  customer_name  text,
  status         text not null default 'paid'
                  check (status in ('pending','paid','cancelled','refunded')),
  payment_method text not null check (payment_method in ('qris','cash','transfer','shopee')),
  payment_status text not null default 'pending'
                  check (payment_status in ('pending','paid','failed','expired')),
  subtotal       numeric(12,2) not null default 0,
  tax            numeric(12,2) not null default 0,
  discount       numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  amount_paid    numeric(12,2) not null default 0,
  change         numeric(12,2) not null default 0,
  qris_ref       text,
  created_at     timestamptz not null default now(),
  unique (store_id, number)
);

create table if not exists public.transaction_items (
  id             uuid primary key default uuid_generate_v4(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  product_id     uuid not null references public.products(id) on delete restrict,
  variant_id     uuid not null references public.variants(id) on delete restrict,
  name           text not null,
  sku            text not null,
  size           text,
  color          text,
  quantity       integer not null,
  unit_price     numeric(12,2) not null,
  discount       numeric(12,2) not null default 0,
  total          numeric(12,2) not null
);

-- ----------------------------------------------------------------------------
-- STOCK MOVEMENTS (audit trail)
-- ----------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id           uuid primary key default uuid_generate_v4(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  variant_id   uuid not null references public.variants(id) on delete cascade,
  sku          text not null,
  product_name text not null,
  type         text not null
                check (type in ('sale','restock','adjustment','return','transfer')),
  quantity     integer not null,        -- signed
  reason       text,
  note         text,
  staff        text not null,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- SHIFTS
-- ----------------------------------------------------------------------------
create table if not exists public.shifts (
  id                uuid primary key default uuid_generate_v4(),
  store_id          uuid not null references public.stores(id) on delete cascade,
  staff_name        text not null,
  opened_at         timestamptz not null default now(),
  closed_at         timestamptz,
  starting_cash     numeric(12,2) not null default 0,
  ending_cash       numeric(12,2),
  total_transactions integer not null default 0,
  total_sales       numeric(12,2) not null default 0,
  total_qris        numeric(12,2) not null default 0,
  total_cash        numeric(12,2) not null default 0,
  status            text not null default 'open'
                     check (status in ('open','closed','reconciled'))
);

-- ----------------------------------------------------------------------------
-- QR LABELS (label per produk -> profil publik)
-- ----------------------------------------------------------------------------
create table if not exists public.qr_labels (
  id             uuid primary key default uuid_generate_v4(),
  product_id     uuid references public.products(id) on delete cascade,
  variant_id     uuid references public.variants(id) on delete cascade,
  qr_data        text not null,
  label_template jsonb default '{}',
  is_printed     boolean not null default false,
  printed_at     timestamptz,
  created_at     timestamptz not null default now(),
  check (
    (product_id is not null and variant_id is null)
    or (product_id is null and variant_id is not null)
  )
);

-- ----------------------------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------------------------
create index if not exists idx_products_store_sku   on public.products(store_id, sku);
create index if not exists idx_variants_product     on public.variants(product_id);
create index if not exists idx_variants_barcode     on public.variants(barcode);
create index if not exists idx_tx_store_date        on public.transactions(store_id, created_at);
create index if not exists idx_tx_items_tx         on public.transaction_items(transaction_id);
create index if not exists idx_movements_variant    on public.stock_movements(variant_id);
create index if not exists idx_qrlabels_product     on public.qr_labels(product_id);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (MVP: semua baris hanya milik default store)
-- Tahap berikutnya (Supabase Auth) per-kasir: ganti policy ke auth.uid().
-- ----------------------------------------------------------------------------
alter table public.stores          enable row level security;
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.variants        enable row level security;
alter table public.customers       enable row level security;
alter table public.staff           enable row level security;
alter table public.transactions    enable row level security;
alter table public.transaction_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.shifts          enable row level security;
alter table public.qr_labels       enable row level security;

do $$
declare t text;
begin
  -- stores: di-scope oleh id-nya sendiri (bukan store_id)
  drop policy if exists "store_scope" on public.stores;
  create policy "store_scope" on public.stores
    for all
    using  (id = app.current_store_id())
    with check (id = app.current_store_id());

  -- tabel dengan kolom store_id langsung
  foreach t in array array[
    'categories','products','customers','staff',
    'transactions','stock_movements','shifts'
  ] loop
    execute format($f$
      drop policy if exists "store_scope" on public.%1$s;
      create policy "store_scope" on public.%1$s
        for all
        using  (store_id = app.current_store_id())
        with check (store_id = app.current_store_id());
    $f$, t);
  end loop;

  -- variants: scope via product
  drop policy if exists "store_scope" on public.variants;
  create policy "store_scope" on public.variants for all
    using  (product_id in (select id from public.products where store_id = app.current_store_id()))
    with check (product_id in (select id from public.products where store_id = app.current_store_id()));

  -- transaction_items: scope via transaction
  drop policy if exists "store_scope" on public.transaction_items;
  create policy "store_scope" on public.transaction_items for all
    using  (transaction_id in (select id from public.transactions where store_id = app.current_store_id()))
    with check (transaction_id in (select id from public.transactions where store_id = app.current_store_id()));

  -- qr_labels: scope via product atau variant -> product
  drop policy if exists "store_scope" on public.qr_labels;
  create policy "store_scope" on public.qr_labels for all
    using  (
      product_id in (select id from public.products where store_id = app.current_store_id())
      or variant_id in (select v.id from public.variants v join public.products p on p.id = v.product_id where p.store_id = app.current_store_id())
    )
    with check (
      product_id in (select id from public.products where store_id = app.current_store_id())
      or variant_id in (select v.id from public.variants v join public.products p on p.id = v.product_id where p.store_id = app.current_store_id())
    );
end $$;

-- ----------------------------------------------------------------------------
-- REALTIME (sync inventory antar device)
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.variants;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.stock_movements;

-- ----------------------------------------------------------------------------
-- STORAGE: foto produk
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images','product-images', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "product-images public read" on storage.objects;
create policy "product-images public read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product-images write" on storage.objects;
create policy "product-images write" on storage.objects
  for insert with check (bucket_id = 'product-images');
