-- 20260913_foundation_hardening.sql
-- Menutup temuan security advisor pasca-Fase 0:
-- 1) RPC baru harus menolak pemanggil ANON (guard lama lolos saat tanpa JWT krn
--    my_store_id() NULL). Pola app: client selalu 'authenticated' (login PIN);
--    cron/edge memakai service_role (bypass RLS, tetap boleh).
-- 2) tx_counters: RLS belum aktif (temuan ERROR lama) — akses hanya lewat RPC
--    next_tx_number (security definer), jadi enable RLS tanpa policy itu aman.

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
  if coalesce(auth.role(), 'anon') = 'anon' then
    raise exception 'forbidden_role';
  end if;

  if public.my_store_id() is not null
     and not public.is_manager_all()
     and p_store is distinct from public.my_store_id() then
    raise exception 'store_scope';
  end if;

  return public._apply_stock_delta(p_product, p_store, p_delta, p_type, p_staff,
                                   p_reason, p_note, p_vendor, p_unit_cost);
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

  if public.my_store_id() is not null
     and not public.is_manager_all()
     and t.from_store is distinct from public.my_store_id() then
    raise exception 'store_scope';
  end if;

  select * into v_src from products where id = t.from_product for update;
  if not found or v_src.store_id <> t.from_store then raise exception 'product_not_found'; end if;

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
  update stock_transfers set status = 'cancelled' where id = p_transfer;
end;
$$;

alter table public.tx_counters enable row level security;

-- helper internal tidak perlu terpanggil dari API
revoke execute on function public.caller_staff_name() from public, anon, authenticated;
