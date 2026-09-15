-- 20260915_transfer_privacy.sql — E11: transfer mode staff lintas-toko + privasi stok
-- 1) Staff toko A boleh MENGAJUKAN permintaan stok dari toko B, tapi TIDAK boleh tahu
--    jumlah stok toko B. RPC security-definer ini hanya mengekspos katalog (id/nama/sku),
--    TANPA kolom stock — supaya dropdown "Dari (pengirim)" toko sebelah bisa diisi
--    tanpa membocorkan angka stok (produk & stok toko sebelah dijaga RLS products).
-- 2) cancel_transfer kini menjaga store_scope: hanya toko asal/tujuan (atau manager-all)
--    yang boleh membatalkan — sebelumnya tanpa guard (hanya dibentengi UI).

-- (1) katalog masked utk pengajuan transfer
create or replace function public.list_transfer_products(p_store uuid)
returns table (id uuid, name text, sku text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.sku
  from public.products p
  where p.store_id = p_store
    and p.active
    and coalesce(auth.role(), 'anon') <> 'anon'
  order by p.name;
$$;

revoke execute on function public.list_transfer_products(uuid) from public;
grant execute on function public.list_transfer_products(uuid) to anon, authenticated;

-- (1b) daftar transfer TERSEGELONG untuk pihak terlibat (nama produk lintas toko ikut
--      terbaca — sebelumnya embed join products terblokir RLS utk staff toko pengaju).
--      TIDAK menyertakan stok — hanya qty permintaan.
create or replace function public.list_transfers()
returns table (
  id uuid, from_store uuid, to_store uuid, from_product uuid, to_product uuid,
  product_name text, product_sku text, qty int, status text,
  requested_by text, sent_by text, note text,
  created_at timestamptz, sent_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.from_store, t.to_store, t.from_product, t.to_product,
         p.name, p.sku, t.qty, t.status,
         t.requested_by, t.sent_by, t.note, t.created_at, t.sent_at
  from public.stock_transfers t
  left join public.products p on p.id = t.from_product
  where coalesce(auth.role(), 'anon') <> 'anon'
    and (public.is_manager_all()
         or t.from_store = public.my_store_id()
         or t.to_store = public.my_store_id())
  order by t.created_at desc
  limit 200;
$$;

revoke execute on function public.list_transfers() from public;
grant execute on function public.list_transfers() to anon, authenticated;

-- (2) guard pembatalan + PERKERAS kirim: pola lama `my_store_id() is not null and ...`
--     Lolos untuk authenticated tanpa baris staff (my_store_id NULL) — kini wajib terlibat.
create or replace function public.cancel_transfer(p_transfer uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare t record;
begin
  if coalesce(auth.role(), 'anon') = 'anon' then
    raise exception 'forbidden_role';
  end if;
  select * into t from stock_transfers where id = p_transfer for update;
  if not found then raise exception 'transfer_not_found'; end if;
  if t.status <> 'pending' then raise exception 'transfer_not_pending'; end if;
  -- hanya pihak terlibat (asal ATAU tujuan) atau manager-all
  if not public.is_manager_all()
     and (public.my_store_id() is null
          or (t.from_store is distinct from public.my_store_id()
              and t.to_store is distinct from public.my_store_id())) then
    raise exception 'store_scope';
  end if;
  update stock_transfers set status = 'cancelled' where id = p_transfer;
end;
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
  if coalesce(auth.role(), 'anon') = 'anon' then
    raise exception 'forbidden_role';
  end if;

  select * into t from stock_transfers where id = p_transfer for update;
  if not found then raise exception 'transfer_not_found'; end if;
  if t.status <> 'pending' then raise exception 'transfer_not_pending'; end if;

  -- PERKERAT: wajib toko pengirim atau manager-all (authenticated tanpa staff kini ditolak)
  if not public.is_manager_all()
     and (public.my_store_id() is null
          or t.from_store is distinct from public.my_store_id()) then
    raise exception 'store_scope';
  end if;

  select * into v_src from products where id = t.from_product for update;
  if not found or v_src.store_id <> t.from_store then raise exception 'product_not_found'; end if;

  if v_src.stock < t.qty then
    raise exception 'insufficient_stock';
  end if;

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
