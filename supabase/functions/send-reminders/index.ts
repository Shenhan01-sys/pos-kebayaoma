// supabase/functions/send-reminders/index.ts
// E6/E7 reminder. Dua mode:
//  A. body {po_id}  — dipicu TRIGGER saat checkout PO: buat SATU event kalender dengan
//     3 popup Google bawaan (50% masa tempo: proses; 80%: ingatkan; hari-H: siapkan barang).
//     Simpan transactions.calendar_event_id (idempoten).
//  B. {} (cron */30m) — catch-up: PO partial tanpa event -> buat; + WA 50%/80% (Fonnte);
//     + sewa H-20%/H-0/overdue (maks 1/hari) via kanal WA/kalender.
// Env: FONNTE_TOKEN, FONNTE_OWNER_NUMBER, COMPOSIO_API_KEY, COMPOSIO_CONNECTED_ACCOUNT_ID,
//      COMPOSIO_USER_ID, COMPOSIO_CAL_ID (opsional), COMPOSIO_CAL_TOOL_SLUG (opsional), REMINDER_SECRET.
// verify_jwt=false; otorisasi internal via header x-reminder-secret.

import { createClient } from "npm:@supabase/supabase-js@2";
import { poStage, rentalStage, normalizePhone, rupiahInt, dayProgress, daysUntil, poReminderOffsets, poEventParts } from "./_logic.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-reminder-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonOk = (obj: unknown) => new Response(JSON.stringify(obj), { headers: { ...cors, "Content-Type": "application/json" } });

const nowJakarta = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));

async function sendWa(token: string, to: string, message: string) {
  const r = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ target: normalizePhone(to), message }),
  });
  if (!r.ok) throw new Error(`fonnte ${r.status}`);
  return r.json();
}

async function calExecute(apiKey: string, slug: string, account: string, userId: string, args: Record<string, unknown>): Promise<any> {
  const r = await fetch(`https://backend.composio.dev/api/v3.1/tools/execute/${slug}`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ arguments: args, connected_account_id: account, user_id: userId }),
  });
  if (!r.ok) throw new Error(`composio ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Event PO: due 08:00-09:00 WIB + 3 popup (50/80/hari-H). Mengembalikan event id (atau null).
async function createPoEvent(apiKey: string, account: string, userId: string, calId: string, summary: string, dueISO: string, desc: string, createdISO: string): Promise<string | null> {
  const args = {
    summary, description: desc,
    start_datetime: `${dueISO}T08:00:00+07:00`,
    end_datetime: `${dueISO}T09:00:00+07:00`,
    calendar_id: calId, timezone: "Asia/Jakarta", create_meeting_room: false,
    reminders: { useDefault: false, overrides: poReminderOffsets(createdISO, dueISO).map((m) => ({ method: "popup", minutes: m })) },
  };
  const data = await calExecute(apiKey, Deno.env.get("COMPOSIO_CAL_TOOL_SLUG") || "GOOGLECALENDAR_CREATE_EVENT", account, userId, args);
  return data?.data?.response_data?.id ?? null;
}

// Event sewederhana (hari-H pengembalian) + popup standar.
async function createRentEvent(apiKey: string, account: string, userId: string, calId: string, summary: string, dueISO: string, desc: string): Promise<void> {
  const args = {
    summary, description: desc,
    start_datetime: `${dueISO}T08:00:00+07:00`,
    end_datetime: `${dueISO}T09:00:00+07:00`,
    calendar_id: calId, timezone: "Asia/Jakarta", create_meeting_room: false,
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 1440 }, { method: "popup", minutes: 240 }] },
  };
  await calExecute(apiKey, Deno.env.get("COMPOSIO_CAL_TOOL_SLUG") || "GOOGLECALENDAR_CREATE_EVENT", account, userId, args);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = Deno.env.get("REMINDER_SECRET");
  if (secret && req.headers.get("x-reminder-secret") !== secret) return jsonOk2({ error: "unauthorized" }, 401);
  function jsonOk2(o: unknown, status: number) { return new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } }); }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return jsonOk({ ok: false, dryRun: true, note: "SUPABASE_SERVICE_ROLE_KEY belum diset; fungsi inert." });

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const fonnte = Deno.env.get("FONNTE_TOKEN");
  const calKey = Deno.env.get("COMPOSIO_API_KEY");
  const calAcc = Deno.env.get("COMPOSIO_CONNECTED_ACCOUNT_ID");
  const calUser = Deno.env.get("COMPOSIO_USER_ID");
  const calId = Deno.env.get("COMPOSIO_CAL_ID") || "f7368342e38e8f29957efacc2169e60af85e821d9e21abfad1f21313ab49cd03@group.calendar.google.com";
  const calOn = !!(calKey && calAcc && calUser);
  const today = nowJakarta();
  const log: string[] = [];

  let body: { po_id?: string } = {};
  try { body = await req.json(); } catch { /* cron: '{}' */ }

  // ---- MODE A: checkout PO (trigger) ----
  if (body.po_id) {
    if (!calOn) return jsonOk({ ok: true, skipped: "calendar-off", note: "secret kalender belum lengkap; cron tidak bisa membuat event — cek COMPOSIO_* secrets." });
    const { data: t } = await supabase.from("transactions")
      .select("id, number, customer_name, total, amount_paid, due_date, created_at, kind, status, calendar_event_id, transaction_items(name, quantity)")
      .eq("id", body.po_id).maybeSingle();
    if (!t) return jsonOk({ ok: false, error: "po-not-found" });
    const voided = t.status === "cancelled" || t.status === "refunded";
    if (voided) {
      // PO dibatalkan/di-refund → hapus event kalender yatim (bila ada) lalu kosongkan kolom.
      if (!t.calendar_event_id) return jsonOk({ ok: true, skipped: "tidak-ada-event" });
      if (!calOn) return jsonOk({ ok: true, skipped: "calendar-off" });
      try {
        await calExecute(calKey!, "GOOGLECALENDAR_DELETE_EVENT", calAcc!, calUser!, { event_id: t.calendar_event_id, calendar_id: calId });
        await supabase.from("transactions").update({ calendar_event_id: null }).eq("id", t.id);
        log.push(`PO ${t.number} event dihapus (status ${t.status})`);
        return jsonOk({ ok: true, log });
      } catch (e) { log.push(`PO ${t.number} delete event FAIL ${String(e)}`); return jsonOk({ ok: false, log }); }
    }
    if (t.calendar_event_id) return jsonOk({ ok: true, skipped: "event-sudah-ada" });
    if (t.kind !== "preorder" || !t.due_date) return jsonOk({ ok: true, skipped: "bukan-PO-bergelar" });
    const { summary, description: desc } = poEventParts(t);
    try {
      const evId = await createPoEvent(calKey!, calAcc!, calUser!, calId, summary, t.due_date, desc, t.created_at);
      if (evId) await supabase.from("transactions").update({ calendar_event_id: evId }).eq("id", t.id);
      log.push(`PO ${t.number} event dibuat${evId ? " + id disimpan" : " (tanpa id)"}`);
      return jsonOk({ ok: true, log, eventId: evId });
    } catch (e) {
      log.push(`PO ${t.number} event FAIL ${String(e)}`); // cron akan catch-up
      return jsonOk({ ok: false, log });
    }
  }

  // ---- MODE B: cron ----
  const { data: pos } = await supabase.from("transactions")
    .select("id, number, customer_name, total, amount_paid, due_date, created_at, reminded_at_50, reminded_at_20, calendar_event_id, transaction_items(name, quantity)")
    .eq("kind", "preorder").eq("status", "partial").not("due_date", "is", null);

  for (const t of pos ?? []) {
    // B1. catch-up event kalender belum ada -> buat (idempoten; info lengkap via poEventParts)
    if (!t.calendar_event_id && calOn) {
      const { summary, description: desc } = poEventParts(t);
      try {
        const evId = await createPoEvent(calKey!, calAcc!, calUser!, calId, summary, t.due_date, desc, t.created_at);
        if (evId) await supabase.from("transactions").update({ calendar_event_id: evId }).eq("id", t.id);
        log.push(`PO ${t.number} event catch-up ok`);
      } catch (e) { log.push(`PO ${t.number} catch-up FAIL ${String(e)}`); }
    }

    // B2. WA 50% & 80% (kalender popup sudah menangani push, WA untuk nomor owner/pelanggan)
    const stage = poStage(t, today);
    if (!stage) continue;
    const who = t.customer_name ?? "pelanggan";
    const remaining = Math.max(0, (t.total ?? 0) - (t.amount_paid ?? 0));
    const owner = Deno.env.get("FONNTE_OWNER_NUMBER");
    const waConfigured = !!(fonnte && owner);
    if (!waConfigured) continue; // tanpa Fonnte: 0 aksi WA, event kalender popup sudah cukup
    const { total, elapsed } = dayProgress(t.created_at, t.due_date, today);
    const msg = stage === "50"
      ? `Halo ${who}, pre-order ${t.number} (${total} hari) sudah 50% masa tempo. Sisa bayar Rp ${rupiahInt(remaining)}, tempo ${t.due_date}. — Kebaya Oma`
      : `Reminder: pre-order ${t.number} H-1 (${elapsed}/${total} hari). Sisa Rp ${rupiahInt(remaining)}, tempo ${t.due_date}. — Kebaya Oma`;
    try {
      await sendWa(fonnte!, owner!, msg); log.push(`PO ${t.number} WA-${stage} ok`);
      const col = stage === "50" ? "reminded_at_50" : "reminded_at_20";
      await supabase.from("transactions").update({ [col]: new Date().toISOString() }).eq("id", t.id);
    } catch (e) { log.push(`PO ${t.number} WA-${stage} FAIL ${String(e)}`); }
  }

  // ---- Sewa (H-20%, H-0, overdue) ----
  const { data: rent } = await supabase.from("rentals")
    .select("id, due_date, start_date, returned_qty, qty, reminded_at_20, reminded_at_0, overdue_reminded_at, customers(name, phone)")
    .is("returned_at", null);
  for (const r of rent ?? []) {
    const stage = rentalStage(r, today);
    if (!stage) continue;
    const daysLeft = daysUntil(r.due_date, today);
    const who = (r.customers as { name?: string } | null)?.name ?? "penyewa";
    const phone = (r.customers as { phone?: string } | null)?.phone;
    const msg = stage === "overdue"
      ? `TEPAT TEMPO LEWAT: sewa ${who} (${r.qty} pcs) tempo ${r.due_date}. Konfirmasi pengembalian. — Kebaya Oma`
      : stage === "0"
      ? `Hari ini jatuh tempo pengembalian sewa ${who} (${r.qty} pcs). — Kebaya Oma`
      : `Sewa ${who} (${r.qty} pcs) jatuh tempo ${r.due_date} (${daysLeft} hari lagi). — Kebaya Oma`;
    let done = false;
    if (fonnte && phone) { try { await sendWa(fonnte, phone, msg); done = true; log.push(`rent ${r.id} WA-${stage} ok`); } catch (e) { log.push(`rent ${r.id} WA-${stage} FAIL ${String(e)}`); } }
    if (!done && calOn) { try { await createRentEvent(calKey!, calAcc!, calUser!, calId, `Kembali sewa ${who} (${r.qty} pcs)`, r.due_date, msg); done = true; log.push(`rent ${r.id} cal-${stage} ok`); } catch (e) { log.push(`rent ${r.id} cal FAIL ${String(e)}`); } }
    if (done) {
      const col = stage === "20" ? "reminded_at_20" : stage === "0" ? "reminded_at_0" : "overdue_reminded_at";
      await supabase.from("rentals").update({ [col]: new Date().toISOString() }).eq("id", r.id);
    }
  }

  return jsonOk({ ok: true, processed: log.length, log });
});
