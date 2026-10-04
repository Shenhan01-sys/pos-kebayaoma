// scripts/test-b2-customer-stats.mjs — B2 integrasi vs DB produksi dengan SESI KASIR SUNGGUHAN (RLS berlaku).
// Artefak SELALU berawalan "TES-B2"; dibersihkan + bukti sisa = 0. Nomor nota uji "TES-B2-…" (TIDAK memakai next_tx_number).
// PRASYARAT: migrasi 20261004_customer_stats_rental sudah diterapkan (guard kind='rental' pada statistik pelanggan).
//  T1  nota SEWA lunas (kasir nyata + customer_id) → total_purchases/visit_count TIDAK berubah
//  T2  batal nota sewa → statistik TETAP (simetris — tidak dikurangi)
//  T3  nota PENJUALAN lunas → statistik naik TEPAT (+total · +1 visit)  [regresi jalur sale tidak rusak]
//  T4  batal penjualan → statistik dikembalikan TEPAT                    [regresi jalur reverse]
//  T5  koreksi one-time: pelanggan sewa asli (nota KTB20261002-009) = 0/0 [read-only]
// Jalankan: node --experimental-strip-types --no-warnings scripts/test-b2-customer-stats.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.split("=", 1)[0], l.slice(l.indexOf("=") + 1)])
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TAG = "TES-B2";
const PIN = "747474";

const hdr = (token, key) => ({ apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" });
const admin = hdr(SERVICE, SERVICE);
const call = (h) => ({
  api: (path, init = {}) => fetch(`${url}/rest/v1/${path}`, { headers: h, ...init }),
});
const A = call(admin);
const j = async (r) => { try { return await r.json(); } catch { return null; } };

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

// prasyarat: fungsi guard sudah terpasang? perilaku T1 membuktikan; cek kolom kind ada
const probe = await A.api("transactions?select=kind&limit=1");
if (!probe.ok) {
  console.log("BERHENTI: kolom transactions.kind tidak terbaca — cek DB/migrasi.");
  process.exit(2);
}

const stores = await j(await A.api("stores?select=id,name&order=name"));
const ktb = stores.find((s) => /kota baru/i.test(s.name)) ?? stores[1];
console.log("toko uji:", ktb.name);

let staffId = null, authId = null, productId = null, variantId = null, customerId = null;
const statsOf = async () => (await j(await A.api(`customers?select=total_purchases,visit_count&id=eq.${customerId}`)))[0];
let seq = 0;

try {
  const p = (await j(await A.api("products", { method: "POST", body: JSON.stringify([{ sku: `${TAG}-P`, name: `${TAG} Kebaya`, store_id: ktb.id, active: true, stock: 10, images: [], tags: [] }]) })))[0];
  productId = p.id;
  const v = (await j(await A.api("variants", { method: "POST", body: JSON.stringify([{ sku: `${TAG}-V`, name: "Seri A", size: "M", color: "TES", color_code: "#000000", selling_price: 75000, cost_price: 0, product_id: productId }]) })))[0];
  variantId = v.id;
  const c = (await j(await A.api("customers", { method: "POST", body: JSON.stringify([{ store_id: ktb.id, name: `${TAG} Penyewa`, phone: "081234567890" }]) })))[0];
  customerId = c.id;
  const st = (await j(await A.api("staff", { method: "POST", body: JSON.stringify([{ name: `${TAG} kasir`, role: "kasir", store_id: ktb.id, active: true }]) })))[0];
  staffId = st.id;
  const email = `staff-${staffId}@kebayaoma.local`;
  const cu = await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ email, password: PIN, email_confirm: true }) });
  authId = (await j(cu))?.id;
  await A.api(`staff?id=eq.${staffId}`, { method: "PATCH", body: JSON.stringify({ user_id: authId }) });
  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PIN }) });
  const token = (await j(login))?.access_token;
  check("pra-kondisi: kasir uji login → sesi nyata", !!token && !!authId);
  const K = call(hdr(token, ANON));

  // meniru saveTransaction: header pending → item → (rentals) → paid, oleh kasir, DENGAN customer_id
  const makeNote = async (kind, total) => {
    const number = `${TAG}-${String(++seq).padStart(2, "0")}`;
    const h = (await j(await K.api("transactions", { method: "POST", body: JSON.stringify([{
      store_id: ktb.id, number, cashier: `${TAG} kasir`, customer_id: customerId, customer_name: `${TAG} Penyewa`, status: "pending",
      payment_method: "cash", payment_status: "pending", subtotal: total, tax: 0, discount: 0, total, amount_paid: total, change: 0,
      kind, due_date: kind === "rental" ? "2026-10-07" : null,
    }]) })))[0];
    await K.api("transaction_items", { method: "POST", body: JSON.stringify([{
      transaction_id: h.id, product_id: productId, variant_id: variantId, name: `${TAG} Kebaya`, sku: `${TAG}-V`, size: "M", color: "TES",
      quantity: 1, unit_price: total, cost_price: null, discount: 0, total,
    }]) });
    if (kind === "rental") {
      await K.api("rentals", { method: "POST", body: JSON.stringify([{
        transaction_id: h.id, customer_id: customerId, product_id: productId, qty: 1, rent_price: total, deposit: 20000,
        start_date: "2026-10-02", due_date: "2026-10-07",
      }]) });
    }
    const paid = await K.api(`transactions?id=eq.${h.id}`, { method: "PATCH", body: JSON.stringify({ status: "paid", payment_status: "paid" }) });
    return { id: h.id, number, paidOk: paid.ok };
  };
  const setStatus = (id, status) => K.api(`transactions?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status, payment_status: "failed" }) });

  // ===== T1: sewa lunas → statistik tidak berubah =====
  const t1 = await makeNote("rental", 105000);
  const s1 = await statsOf();
  check("T1 nota SEWA lunas → total_purchases/visit_count pelanggan TETAP 0/0", t1.paidOk && Number(s1.total_purchases) === 0 && s1.visit_count === 0, JSON.stringify(s1));

  // ===== T2: batal sewa → statistik tetap (simetris) =====
  await setStatus(t1.id, "cancelled");
  const s2 = await statsOf();
  check("T2 batal nota sewa → statistik tetap 0/0 (tidak dikurangi)", Number(s2.total_purchases) === 0 && s2.visit_count === 0, JSON.stringify(s2));

  // ===== T3: penjualan lunas → statistik naik TEPAT (regresi jalur sale) =====
  const t3 = await makeNote("sale", 120000);
  const s3 = await statsOf();
  check("T3 nota PENJUALAN lunas → +120.000 · +1 visit", t3.paidOk && Number(s3.total_purchases) === 120000 && s3.visit_count === 1, JSON.stringify(s3));

  // ===== T4: batal penjualan → statistik dikembalikan (regresi reverse) =====
  await setStatus(t3.id, "cancelled");
  const s4 = await statsOf();
  check("T4 batal penjualan → statistik kembali 0/0", Number(s4.total_purchases) === 0 && s4.visit_count === 0, JSON.stringify(s4));

  // ===== T5: koreksi one-time — pelanggan sewa asli 0/0 (read-only) =====
  const dewi = (await j(await A.api(`customers?select=name,total_purchases,visit_count&id=eq.e5ed3697-c7de-4597-9518-ee3683249974`)))[0];
  check("T5 koreksi one-time: pelanggan sewa asli (Dewi) = 0/0", dewi && Number(dewi.total_purchases) === 0 && dewi.visit_count === 0, JSON.stringify(dewi));
} catch (e) {
  console.log("ERROR:", e?.message ?? e);
  fail++;
} finally {
  // ===== cleanup =====
  if (customerId) await A.api(`customers?id=eq.${customerId}`, { method: "DELETE" });
  if (productId) await A.api(`products?id=eq.${productId}`, { method: "DELETE" }); // items/rentals ikut cascade via transactions
  const nota = (await j(await A.api(`transactions?select=id&number=like.${TAG}-%`))) ?? [];
  for (const n of nota) await A.api(`transactions?id=eq.${n.id}`, { method: "DELETE" });
  if (staffId) await A.api(`staff?id=eq.${staffId}`, { method: "DELETE" });
  if (authId) await fetch(`${url}/auth/v1/admin/users/${authId}`, { method: "DELETE", headers: admin });

  const left = ["transactions", "transaction_items", "rentals", "customers", "products", "variants", "staff", "stock_movements"]
    .map(async (t) => [t, (await j(await A.api(`${t}?select=id&${t === "staff" ? "name" : t === "stock_movements" ? "note" : t === "customers" || t === "transactions" ? "number" : "sku"}=like.${TAG}%`)))?.length ?? 0]);
  const counts = await Promise.all(left);
  const total = counts.reduce((a, [, n]) => a + n, 0);
  console.log(`cleanup: sisa artefak ${TAG} = ${total}`, JSON.stringify(counts.filter(([, n]) => n > 0)));
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
}
