// supabase/functions/send-reminders/index.ts
// E6/E7: cron pengingat pre-order (50% & 20% masa tempo) & sewa (H-20%, H-0, overdue).
// Dipanggil pg_cron via pg_net (HTTP POST) tiap 30 menit. WA=Fonnte; Kalender=Composio.
// Idempoten via kolom reminded_at_50/_20 (PO) dan reminded_at_20/0/overdue (rentals).
// Env: FONNTE_TOKEN, COMPOSIO_API_KEY, COMPOSIO_CONNECTED_ACCOUNT_ID, REMINDER_SECRET,
//      SUPABASE_URL (auto), service role key via env SUPABASE_SERVICE_ROLE_KEY.
// verify_jwt=false di dashboard; otorisasi pakai header x-reminder-secret.

import { createClient } from "npm:@supabase/supabase-js@2";
import { poStage, rentalStage, normalizePhone, rupiahInt, dayProgress, daysUntil } from "./_logic.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-reminder-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const nowJakarta = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));

async function sendWa(token: string, to: string, message: string) {
  const r = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ target: to.replace(/[^0-9]/g, "").replace(/^0/, "62"), message }),
  });
  if (!r.ok) throw new Error(`fonnte ${r.status}`);
  return r.json();
}

async function addCalEvent(apiKey: string, account: string, userId: string, calId: string, summary: string, dueISO: string, desc: string) {
  // Schema TERVERIFIKASI live 2026-09-14 (uji create+delete event sungguhan):
  //   POST /api/v3.1/tools/execute/GOOGLECALENDAR_CREATE_EVENT, header x-api-key,
  //   body { arguments: {…datetime…}, connected_account_id, user_id }.
  // Event timed 08:00–09:00 Asia/Jakarta pada tanggal due (schema tool ini tidak
  // menerima all-day `date`; datetime + timezone eksplisit = aman lintas TZ runtime).
  const args = {
    summary,
    description: desc,
    start_datetime: `${dueISO}T08:00:00+07:00`,
    end_datetime: `${dueISO}T09:00:00+07:00`,
    calendar_id: calId,
    timezone: "Asia/Jakarta",
    create_meeting_room: false, // default Composio=on; reminder tidak perlu link Meet
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 1440 },
        { method: "popup", minutes: 240 },
      ],
    },
  };
  const slug = Deno.env.get("COMPOSIO_CAL_TOOL_SLUG") || "GOOGLECALENDAR_CREATE_EVENT";
  const r = await fetch(`https://backend.composio.dev/api/v3.1/tools/execute/${slug}`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ arguments: args, connected_account_id: account, user_id: userId }),
  });
  if (!r.ok) throw new Error(`composio ${r.status}: ${(await r.text()).slice(0, 200)}`);
  await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = Deno.env.get("REMINDER_SECRET");
  if (secret && req.headers.get("x-reminder-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    // Secret belum diset (dashboard → Edge Functions → Secrets) — DRY-RUN, jangan error ke cron.
    return new Response(
      JSON.stringify({ ok: false, dryRun: true, note: "SUPABASE_SERVICE_ROLE_KEY belum diset; fungsi inert." }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const fonnte = Deno.env.get("FONNTE_TOKEN");
  const calKey = Deno.env.get("COMPOSIO_API_KEY");
  const calAcc = Deno.env.get("COMPOSIO_CONNECTED_ACCOUNT_ID");
  const calUser = Deno.env.get("COMPOSIO_USER_ID");
  // Kalender target "Preorder Kebaya Oma" (group id; diverifikasi create+delete 2026-09-14).
  const calId = Deno.env.get("COMPOSIO_CAL_ID") ||
    "f7368342e38e8f29957efacc2169e60af85e821d9e21abfad1f21313ab49cd03@group.calendar.google.com";
  const today = nowJakarta();
  const log: string[] = [];

  // ---- Pre-order (50% & 20% masa tempo) ----
  const { data: pos } = await supabase
    .from("transactions")
    .select("id, number, customer_name, total, amount_paid, due_date, created_at, reminded_at_50, reminded_at_20")
    .eq("kind", "preorder")
    .eq("status", "partial")
    .not("due_date", "is", null);

  for (const t of pos ?? []) {
    const stage = poStage(t, today);
    if (!stage) continue;
    const { total, elapsed } = dayProgress(t.created_at, t.due_date, today);
    const remaining = Math.max(0, (t.total ?? 0) - (t.amount_paid ?? 0));
    const who = t.customer_name ?? "pelanggan";

    const msg =
      stage === "50"
        ? `Halo ${who}, pre-order ${t.number} (${total} hari) sudah lewat 50% masa tempo. Sisa bayar Rp ${rupiahInt(remaining)}, jatuh tempo ${t.due_date}. — Kebaya Oma`
        : `Reminder: pre-order ${t.number} tinggal H-1 (${elapsed}/${total} hari). Sisa bayar Rp ${rupiahInt(remaining)} jatuh tempo ${t.due_date}. — Kebaya Oma`;

    let waOk = false;
    let calOk = false;
    const owner = Deno.env.get("FONNTE_OWNER_NUMBER");
    const waConfigured = !!(fonnte && owner);
    if (waConfigured) {
      try { await sendWa(fonnte, normalizePhone(owner), msg); waOk = true; log.push(`PO ${t.number} WA-${stage} ok`); }
      catch (e) { log.push(`PO ${t.number} WA-${stage} FAIL ${String(e)}`); }
    } else {
      log.push(`PO ${t.number}: Fonnte belum diset — WA dilewati`);
    }

    if (calKey && calAcc && calUser) {
      try { await addCalEvent(calKey, calAcc, calUser, calId, `Lunas PO ${t.number} - ${who}`, t.due_date, msg); calOk = true; log.push(`PO ${t.number} cal ok`); }
      catch (e) { log.push(`PO ${t.number} cal FAIL ${String(e)}`); }
    }

    // Tandai bila WA (kanal utama) sukses; ATAU bila WA memang tidak dikonfigurasi & kalender
    // sukses (hindari spam event berulang saat setup kalender-only). Kalau WA dikonfigurasi tapi
    // GAGAL → jangan tandai; retry ronde berikutnya (AC-E6#6).
    if (waOk || (!waConfigured && calOk)) {
      const col = stage === "50" ? "reminded_at_50" : "reminded_at_20";
      const { error } = await supabase.from("transactions").update({ [col]: new Date().toISOString() }).eq("id", t.id);
      if (error) log.push(`PO ${t.number} mark FAIL ${error.message}`);
    }
  }

  // ---- Sewa (H-20%, H-0, escalation overdue) ----
  const { data: rent } = await supabase
    .from("rentals")
    .select("id, due_date, start_date, returned_qty, qty, reminded_at_20, reminded_at_0, overdue_reminded_at, customers(name, phone)")
    .is("returned_at", null);

  for (const r of rent ?? []) {
    const stage = rentalStage(r, today);
    if (!stage) continue;
    const daysLeft = daysUntil(r.due_date, today);
    const who = (r.customers as { name?: string } | null)?.name ?? "penyewa";
    const phone = (r.customers as { phone?: string } | null)?.phone;

    const msg =
      stage === "overdue"
        ? `TEPAT TEMPO LEWAT: sewa ${who} (${r.qty} pcs) jatuh tempo ${r.due_date}. Mohon dikonfirmasi pengembaliannya. — Kebaya Oma`
        : stage === "0"
        ? `Hari ini jatuh tempo pengembalian sewa ${who} (${r.qty} pcs). — Kebaya Oma`
        : `Sewa ${who} (${r.qty} pcs) akan jatuh tempo ${r.due_date} (${daysLeft} hari lagi). — Kebaya Oma`;

    let waOk = false;
    let calOk = false;
    const waConfigured = !!(fonnte && phone);
    if (waConfigured) {
      try { await sendWa(fonnte, normalizePhone(phone), msg); waOk = true; log.push(`rent ${r.id} WA-${stage} ok`); }
      catch (e) { log.push(`rent ${r.id} WA-${stage} FAIL ${String(e)}`); }
    } else {
      log.push(`rent ${r.id}: no phone/token — WA dilewati`);
    }
    if (calKey && calAcc && calUser) {
      try { await addCalEvent(calKey, calAcc, calUser, calId, `Kembali sewa ${who} (${r.qty} pcs)`, r.due_date, msg); calOk = true; log.push(`rent ${r.id} cal ok`); }
      catch (e) { log.push(`rent ${r.id} cal FAIL ${String(e)}`); }
    }
    if (waOk || (!waConfigured && calOk)) {
      const col = stage === "20" ? "reminded_at_20" : stage === "0" ? "reminded_at_0" : "overdue_reminded_at";
      await supabase.from("rentals").update({ [col]: new Date().toISOString() }).eq("id", r.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: log.length, log }), { headers: { ...cors, "Content-Type": "application/json" } });
});
