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

async function addCalEvent(apiKey: string, account: string, summary: string, dueISO: string, desc: string) {
  // Google: all-day event memakai date, end bersifat EXCLUSIVE → end = due + 1 hari.
  const endISO = new Date(new Date(dueISO + "T00:00:00Z").getTime() + 86_400_000).toISOString().slice(0, 10);
  const args = {
    summary,
    description: desc,
    start: { date: dueISO },
    end: { date: endISO },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 1440 },
        { method: "popup", minutes: 240 },
      ],
    },
  };
  // Nama tool persis berbeda antar versi toolkit Composio. Env override = escape hatch
  // (salin slug asli dari dashboard → Toolkits → Google Calendar). Kalau tidak diset,
  // coba kandidat umum; error hanya bila SEMUA kandidat gagal (kanal lain tetap jalan).
  const candidates = (Deno.env.get("COMPOSIO_CAL_TOOL_SLUG") || "")
    ? [Deno.env.get("COMPOSIO_CAL_TOOL_SLUG")!]
    : ["GOOGLECALENDAR_CREATE_EVENT", "GOOGLE_CALENDAR_CREATE_EVENT", "GOOGLECALENDAR_EVENT_CREATE", "GOOGLECALENDAR_CREATE_CALENDAR_EVENT"];
  let lastErr = "no-slug";
  for (const slug of candidates) {
    try {
      const r = await fetch("https://backend.composio.dev/api/v3/tools/execute", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tool_slug: slug, connected_account_id: account, arguments: args }),
      });
      if (r.ok) { await r.json(); return; }
      lastErr = `${slug}: ${r.status}`;
    } catch (e) {
      lastErr = `${slug}: ${String(e)}`;
    }
  }
  throw new Error(`composio all-slugs-failed (${lastErr})`);
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
    const owner = Deno.env.get("FONNTE_OWNER_NUMBER");
    if (fonnte && owner) {
      try { await sendWa(fonnte, normalizePhone(owner), msg); waOk = true; log.push(`PO ${t.number} WA-${stage} ok`); }
      catch (e) { log.push(`PO ${t.number} WA-${stage} FAIL ${String(e)}`); }
    } else {
      log.push(`PO ${t.number}: FONNTE_TOKEN/OWNER belum diset — WA dilewati (tidak ditandai reminded)`);
    }

    if (calKey && calAcc) {
      try { await addCalEvent(calKey, calAcc, `Lunas PO ${t.number} - ${who}`, t.due_date, msg); log.push(`PO ${t.number} cal ok`); }
      catch (e) { log.push(`PO ${t.number} cal FAIL ${String(e)}`); }
    }

    // Tandai HANYA bila WA (kanal utama) sukses — kalau token mati, retry ronde berikutnya (AC-E6#6)
    if (waOk) {
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
    if (fonnte && phone) {
      try { await sendWa(fonnte, normalizePhone(phone), msg); waOk = true; log.push(`rent ${r.id} WA-${stage} ok`); }
      catch (e) { log.push(`rent ${r.id} WA-${stage} FAIL ${String(e)}`); }
    } else {
      log.push(`rent ${r.id}: no phone/token — WA dilewati`);
    }
    if (waOk) {
      const col = stage === "20" ? "reminded_at_20" : stage === "0" ? "reminded_at_0" : "overdue_reminded_at";
      await supabase.from("rentals").update({ [col]: new Date().toISOString() }).eq("id", r.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: log.length, log }), { headers: { ...cors, "Content-Type": "application/json" } });
});
