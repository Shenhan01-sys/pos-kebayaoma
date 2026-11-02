-- 20261102_rental_calendar_on_paid.sql
-- Sewa (kind='rental') dibayar -> SATU event kalender hari pengembalian dibuat langsung,
-- seperti PO (queue_po_calendar). Sebelumnya event sewa hanya dibuat cron sebagai cadangan WA.
-- Reuse pemanggil async queue_po_calendar (body {po_id}); Edge fn send-reminders MODE A
-- membedakan PO/sewa lewat transactions.kind. Batal/refund sewa -> event dihapus.
-- Trigger terpisah (tidak menyentuh on_transaction_status_change) agar tak meregresi stok/statistik.
-- create_rental: insert 'pending' lalu UPDATE status 'paid' -> cukup trigger UPDATE.
-- Kegagalan HTTP tidak memblokir transaksi (queue_po_calendar menelan error); cron catch-up
-- membuat event untuk sewa terbuka yang belum punya calendar_event_id.

create or replace function public.on_rental_calendar()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.kind = 'rental' then
    if new.status = 'paid' and old.status is distinct from 'paid'
       and new.due_date is not null and new.calendar_event_id is null then
      perform public.queue_po_calendar(new.id);
    elsif new.calendar_event_id is not null
       and old.status not in ('cancelled','refunded')
       and new.status in ('cancelled','refunded') then
      perform public.queue_po_calendar(new.id);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.on_rental_calendar() from public, anon, authenticated;

drop trigger if exists trg_rental_calendar on public.transactions;
create trigger trg_rental_calendar
  after update of status on public.transactions
  for each row execute function public.on_rental_calendar();
