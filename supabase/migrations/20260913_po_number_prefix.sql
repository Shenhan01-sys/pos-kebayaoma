-- 20260913_po_number_prefix.sql
-- E6 (Fase 5): nomor nota pre-order berprefix PO- memakai konter TX counter yang sama.
-- LIVE via Supabase MCP 2026-09-13.

create or replace function public.next_po_number(p_store_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_seq int;
begin
  perform set_config('timezone', 'Asia/Jakarta', true);
  insert into public.tx_counters(store_id, day, last_seq)
    values (p_store_id, current_date, 1)
    on conflict (store_id, day) do update set last_seq = tx_counters.last_seq + 1
    returning last_seq into v_seq;
  return 'PO-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

revoke execute on function public.next_po_number(uuid) from public;
grant execute on function public.next_po_number(uuid) to anon, authenticated;
