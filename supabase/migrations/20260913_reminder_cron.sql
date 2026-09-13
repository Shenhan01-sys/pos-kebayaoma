-- 20260913_reminder_cron.sql
-- E6 (Fase 5): pg_cron memanggil Edge Function send-reminders tiap 30 menit.
-- Prasyarat (sudah dieksekusi via MCP 2026-09-13): pg_cron + pg_net ENABLED.
-- Secret TIDAK ada di definisi job: RPC security definer membaca dari Supabase Vault
--   select vault.create_secret('<nilai>', 'reminder_secret');
-- lalu pasang secret Edge Function REMINDER_SECRET dengan <nilai> yang sama.
-- (Edge fn verify_jwt=false; otorisasi internal via header x-reminder-secret.)

create or replace function public.run_reminders()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_req_id bigint;
  v_status int;
  v_content text;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'reminder_secret' limit 1;

  select net.http_post(
    url := 'https://jjwqpakasewzmfhjhyhz.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-secret', coalesce(v_secret, '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  ) into v_req_id;

  -- tunggu respons pg_net (worker async) maks ~22 dtk
  for i in 1..44 loop
    select status_code, content into v_status, v_content
      from net._http_response where id = v_req_id;
    exit when v_status is not null;
    perform pg_sleep(0.5);
  end loop;

  return coalesce(v_status::text, 'pending');
exception when others then
  return 'error: ' || sqlerrm;
end;
$$;

revoke execute on function public.run_reminders() from public, anon, authenticated;
grant execute on function public.run_reminders() to service_role;

-- jadwal tiap 30 menit (unschedule bila job lama ada → idempoten untuk rerun)
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'pos-send-reminders';
select cron.schedule('pos-send-reminders', '*/30 * * * *', $$select public.run_reminders()$$);
