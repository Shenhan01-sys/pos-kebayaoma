-- 20260913_po_calendar_on_create.sql
-- E6 revisi (keputusan user 2026-09-14 02:12): SAAT checkout PO dibuat SATU event
-- kalender dengan 3 reminder bawaan Google (50% masa tempo, 80%, hari-H 08:00).
-- Cron send-reminders jadi catch-up + WA + sewa. LIVE via MCP 2026-09-14.

alter table public.transactions add column if not exists calendar_event_id text;

-- pemanggil async Edge fn (fire-and-forget; kegagalan TIDAK boleh memblokir checkout)
create or replace function public.queue_po_calendar(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'reminder_secret' limit 1;
  perform net.http_post(
    url := 'https://jjwqpakasewzmfhjhyhz.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type','application/json','x-reminder-secret', coalesce(v_secret,'')),
    body := json_build_object('po_id', p_id)::jsonb,
    timeout_milliseconds := 10000);
exception when others then
  null; -- checkout tetap jalan; cron akan catch-up membuat event
end;
$$;
revoke execute on function public.queue_po_calendar(uuid) from public, anon, authenticated;

-- trigger: insert langsung partial & transisi pending->partial = bikin event PO
create or replace function public.on_transaction_insert_paid()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status in ('paid','partial') then perform public.apply_sale_stock(new.id); end if;
  if new.status = 'partial' and new.kind = 'preorder' and new.due_date is not null
     and new.calendar_event_id is null then
    perform public.queue_po_calendar(new.id);
  end if;
  return new;
end;
$$;

create or replace function public.on_transaction_status_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status = 'pending' and new.status in ('paid','partial') then
    perform public.apply_sale_stock(new.id);
  end if;
  if new.status = 'partial' and new.kind = 'preorder' and new.due_date is not null
     and new.calendar_event_id is null then
    perform public.queue_po_calendar(new.id);
  end if;
  -- (20260913_po_calendar_on_cancel) preorder batal/refund & punya event -> fn cabang delete
  if new.kind = 'preorder' and new.calendar_event_id is not null
     and old.status not in ('cancelled','refunded')
     and new.status in ('cancelled','refunded') then
    perform public.queue_po_calendar(new.id);
  end if;
  if old.status in ('paid','partial') and new.status in ('cancelled','refunded') then
    perform public.reverse_sale_stock(old.id, new.status = 'refunded');
  end if;
  return new;
end;
$$;
