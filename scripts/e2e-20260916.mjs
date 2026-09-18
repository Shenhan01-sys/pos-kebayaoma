// scripts/e2e-20260916.mjs — harness uji E2E terotomasi 2026-09-16 (artefak TES- semua, cleanup sisa=0)
// node scripts/e2e-20260916.mjs setup | status | teardown
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PINS = { manager: "111111", budi: "222222", citra: "333333" };
const NAMES = { manager: "TESmanajer", budi: "TEsbudi", citra: "TEScitra" };
const SKU = "TESX";

async function stores() {
  const { data } = await supabase.from("stores").select("id,receipt_prefix");
  return { mjl: data.find((s) => s.receipt_prefix === "MJL").id, ktb: data.find((s) => s.receipt_prefix === "KTB").id };
}

async function fixlink() {
  // email auth HARUS staff-<staffId>@kebayaoma.local (derive app) + staff.user_id terisi
  const { data } = await sb_auth(); const users = data.users?.users || data.users || [];
  const { data: staff } = await supabase.from("staff").select("id,name,user_id").ilike("name", "TES%");
  for (const s of staff) {
    const u = users.find((x) => (x.email || "").endsWith("-e2e-20260916@kebayaoma.test") || x.email === `staff-${s.id}@kebayaoma.local`);
    if (!u) { console.log("no auth for", s.name); continue; }
    if (u.email !== `staff-${s.id}@kebayaoma.local`) await supabase.auth.admin.updateUserById(u.id, { email: `staff-${s.id}@kebayaoma.local` });
    if (s.user_id !== u.id) await supabase.from("staff").update({ user_id: u.id }).eq("id", s.id);
    console.log(s.name, "linked");
  }
}
async function sb_auth() { return supabase.auth.admin.listUsers(); }

async function setup() {
  const { mjl, ktb } = await stores();
  const out = {};
  // 1) auth users via GoTrue admin
  const creds = [
    ["manager", NAMES.manager], ["budi", NAMES.budi], ["citra", NAMES.citra],
  ];
  const ids = {};
  for (const [k, name] of creds) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: `${k}-e2e-20260916@kebayaoma.test`, password: PINS[k], email_confirm: true,
    });
    if (error) throw error;
    ids[k] = data.user?.id ?? data.id;
    out[`auth_${k}`] = data.id;
  }
  // 2) staff rows
  for (const [k, store] of [["manager", null], ["budi", mjl], ["citra", ktb]]) {
    const { data, error } = await supabase.from("staff").insert({
      name: NAMES[k], role: k === "manager" ? "manager" : "staff", store_id: store, active: true, user_id: ids[k],
    }).select("id").single();
    if (error) throw error;
    out[`staff_${k}`] = data.id;
  }
  // 3) produk TESX di KEDUA toko (stok 0 awal; seed via adjust_stock biar ledger konsisten)
  const prods = {};
  for (const [label, store] of [["mjl", mjl], ["ktb", ktb]]) {
    const { data: p, error: e1 } = await supabase.from("products").insert({
      store_id: store, sku: SKU, name: "TES Produk Silang", description: "TES- artifacts 2026-09-16",
    }).select("id").single();
    if (e1) throw e1;
    const { error: e2 } = await supabase.from("variants").insert({
      product_id: p.id, sku: `${SKU}-S`, name: "S", color: "Merah TES", selling_price: 250000, cost_price: 100000,
    });
    if (e2) throw e2;
    const { error: e3 } = await supabase.rpc("adjust_stock", {
      p_product: p.id, p_store: store, p_delta: 10, p_type: "restock", p_staff: "TES", p_reason: "Stok Opname", p_note: "TES-e2e-seed",
    });
    if (e3) throw e3;
    prods[label] = p.id;
    out[`product_${label}`] = p.id;
  }
  // 4) varian utk sewa: rental_price di varian MJL
  const { data: vrm } = await supabase.from("variants").update({ rental_price: 150000, rental_days: 3, deposit_price: 100000 }).eq("sku", `${SKU}-S`);
  void vrm;
  console.log(JSON.stringify({ ok: true, out, pins: PINS, names: NAMES }, null, 2));
}

async function status(label = "") {
  const { mjl, ktb } = await stores();
  const [txs, trf, prods, mvs, custs, rens, staff] = await Promise.all([
    supabase.from("transactions").select("id,number,status,kind,calendar_event_id,total,amount_paid,customer_name").or("number.like.TES*,customer_name.like.TES*"),
    supabase.from("stock_transfers").select("id,from_store,to_store,qty,status,requested_by,sent_by,note").or("requested_by.like.TES*,note.like.TES%"),
    supabase.from("products").select("id,stock,name,store_id").eq("sku", SKU),
    supabase.from("stock_movements").select("id,sku,quantity,note,reason").or(`note.like.TES*,staff.eq.TES`),
    supabase.from("customers").select("id,name").ilike("name", "TES%"),
    supabase.from("rentals").select("id,qty,returned_qty,due_date"),
    supabase.from("staff").select("id,name,role,store_id,user_id").ilike("name", "TES%"),
  ]);
  // drift per store asli
  const drift = [];
  for (const s of [mjl, ktb]) {
    const { data: ps } = await supabase.from("products").select("stock").eq("store_id", s).not("sku", "eq", SKU);
    const { data: mss } = await supabase.from("stock_movements").select("quantity,variant_id").in("store_id", [s]);
    const mvByVar = {};
    (mss ?? []).forEach((m) => { mvByVar[m.variant_id] = (mvByVar[m.variant_id] ?? 0) + m.quantity; });
    const { data: prodsAll } = await supabase.from("products").select("id,stock").eq("store_id", s).not("sku", "eq", SKU);
    void ps;
    (prodsAll ?? []).forEach((p) => { if ((p.stock - (mvByVar[p.id] ?? 0)) !== 10) drift.push(`${s.slice(0, 4)}: drift ${p.id.slice(0, 4)}=${p.stock - (mvByVar[p.id] ?? 0)}`); });
  }
  console.log(JSON.stringify({
    label,
    transactions: txs.data, transfers: trf.data, tesProducts: prods.data, tesMovements: mvs.data,
    customers: custs.data, rentals: rens.data, staff: staff.data, driftOffenders: drift,
  }, null, 2));
}

async function teardown() {
  // rental + transaksinya lebih dulu (FK produk)
  const { data: prodsDel } = await supabase.from("products").select("id").in("sku", [SKU, "TESX2"]);
  const pids = (prodsDel ?? []).map((p) => p.id);
  if (pids.length) {
    const { error: er0 } = await supabase.from("rentals").delete().in("product_id", pids);
    if (er0) throw er0;
  }
  const { data: txs } = await supabase.from("transactions").select("id,calendar_event_id").or("number.ilike.tes*,customer_name.ilike.tes*,cashier.ilike.tes%");
  const events = (txs ?? []).map((t) => t.calendar_event_id).filter(Boolean);
  let { error } = await supabase.from("transactions").delete().or("number.ilike.tes*,customer_name.ilike.tes*,cashier.ilike.tes%");
  if (error) throw error;
  ({ error } = await supabase.from("stock_transfers").delete().or("requested_by.ilike.tes*,sent_by.ilike.tes*,note.ilike.tes%"));
  if (error) throw error;
  ({ error } = await supabase.from("stock_movements").delete().or("note.ilike.tes*,staff.ilike.tes*,sku.ilike.tesX%"));
  if (error) throw error;
  ({ error } = await supabase.from("vendors").delete().ilike("name", "tes%"));
  if (error) throw error;
  ({ error } = await supabase.from("shifts").delete().ilike("staff_name", "tes%"));
  if (error) throw error;
  ({ error } = await supabase.from("products").delete().in("sku", [SKU, "TESX2"]));
  if (error) throw error;
  ({ error } = await supabase.from("customers").delete().ilike("name", "TES%"));
  if (error) throw error;
  const st = await status("after-teardown"); void st;
  const { data: staffDel } = await supabase.from("staff").select("id,user_id,name").ilike("name", "TES%");
  for (const s of staffDel ?? []) {
    try { await supabase.auth.admin.deleteUser(s.user_id); } catch (e) { console.error("auth del", e.message); }
  }
  ({ error } = await supabase.from("staff").delete().ilike("name", "TES%"));
  if (error) throw error;
  console.log(JSON.stringify({ ok: true, pending_calendar_events_from_cancelled: events }, null, 2));
}

const cmd = process.argv[2];
try {
  if (cmd === "setup") { await setup(); await fixlink(); }
  else if (cmd === "fixlink") await fixlink();
  else if (cmd === "status") await status(process.argv[3] ?? "");
  else if (cmd === "teardown") await teardown();
  else console.log("usage: setup|status [label]|teardown");
} catch (e) { console.error("ERR", e.message); process.exit(1); }
