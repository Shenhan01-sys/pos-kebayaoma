// scripts/test-e20-rental-stock-deposit.mjs — E20 integrasi vs DB produksi dengan SESI KASIR SUNGGUHAN (RLS berlaku).
// Artefak SELALU berawalan "TES-E20"; dibersihkan + bukti sisa = 0. Nomor nota uji "TES-E20-…" (TIDAK memakai next_tx_number).
// PRASYARAT: migrasi 20261003_rental_stock_deposit sudah diterapkan (skrip berhenti dengan pesan jelas bila belum).
//  S1  batal nota sewa SETELAH 1 dari 2 unit diterima → stok kembali TEPAT (tidak dobel); movement 'Pembatalan sewa' +1
//  S2  batal tanpa pengembalian → +qty penuh · S3 batal setelah semua kembali → tak ada tambahan · S4 nota penjualan biasa tak berubah
//  S5  return_rental pada nota batal → 'rental_not_active' (stok tetap) · S6 refund memakai logika yang sama ('Refund sewa')
//  D1  settle_rental_deposit: dikembalikan + dipotong + catatan tercatat; D2 melebihi ditahan → 'deposit_exceeds_held'
//  D3  jumlah 0/negatif → 'amount_invalid'; D4 lunas → settled_at terisi, tak bisa lagi; D5 CHECK constraint menolak update langsung
//  D6  sewa tanpa deposit → ditolak; D7 kasir toko lain → 'store_scope'; D8 deposit nota batal tetap bisa diselesaikan
// Jalankan: node --experimental-strip-types --no-warnings scripts/test-e20-rental-stock-deposit.mjs
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
const TAG = "TES-E20";
const PIN = "737373";

const hdr = (token, key) => ({ apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" });
const admin = hdr(SERVICE, SERVICE);
const call = (h) => ({
  api: (path, init = {}) => fetch(`${url}/rest/v1/${path}`, { headers: h, ...init }),
  rpc: (fn, args) => fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers: h, body: JSON.stringify(args) }),
});
const A = call(admin);
const j = async (r) => { try { return await r.json(); } catch { return null; } };

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const hasErr = async (res, code) => { const b = await j(res.clone()); return !res.ok && JSON.stringify(b).includes(code); };

// prasyarat migrasi
const probe = await A.api("rentals?select=deposit_refunded&limit=1");
if (!probe.ok) {
  console.log("BERHENTI: kolom rentals.deposit_refunded belum ada — migrasi 20261003_rental_stock_deposit belum diterapkan.");
  process.exit(2);
}

const stores = await j(await A.api("stores?select=id,name&order=name"));
const ktb = stores.find((s) => /kota baru/i.test(s.name)) ?? stores[1];
const mjl = stores.find((s) => s.id !== ktb.id);
console.log("toko uji:", ktb.name, "| toko lain:", mjl.name);

let staffId = null, authId = null, productId = null, variantId = null, mjlProductId = null;
const stockOf = async () => Number((await j(await A.api(`products?select=stock&id=eq.${productId}`)))[0].stock);
let seq = 0;

try {
  const p = (await j(await A.api("products", { method: "POST", body: JSON.stringify([{ sku: `${TAG}-P`, name: `${TAG} Kebaya`, store_id: ktb.id, active: true, stock: 10, images: [], tags: [] }]) })))[0];
  productId = p.id;
  const v = (await j(await A.api("variants", { method: "POST", body: JSON.stringify([{ sku: `${TAG}-V`, name: "Seri A", size: "M", color: "TES", color_code: "#000000", selling_price: 100000, cost_price: 0, product_id: productId }]) })))[0];
  variantId = v.id;
  const pm = (await j(await A.api("products", { method: "POST", body: JSON.stringify([{ sku: `${TAG}-PM`, name: `${TAG} Kebaya MJL`, store_id: mjl.id, active: true, stock: 5, images: [], tags: [] }]) })))[0];
  mjlProductId = pm.id;
  const st = (await j(await A.api("staff", { method: "POST", body: JSON.stringify([{ name: `${TAG} kasir`, role: "kasir", store_id: ktb.id, active: true }]) })))[0];
  staffId = st.id;
  const email = `staff-${staffId}@kebayaoma.local`;
  const cu = await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ email, password: PIN, email_confirm: true }) });
  authId = (await j(cu))?.id;
  await A.api(`staff?id=eq.${staffId}`, { method: "PATCH", body: JSON.stringify({ user_id: authId }) });
  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PIN }) });
  const token = (await j(login))?.access_token;
  check("pra-kondisi: kasir uji (role kasir, toko KTB) login → sesi nyata", !!token && !!authId);
  const K = call(hdr(token, ANON));

  // meniru saveTransaction: header pending → item → (rentals) → paid, semuanya oleh kasir
  const makeNote = async (suffix, { kind = "rental", qty = 2, deposit = 20000 } = {}) => {
    const number = `${TAG}-${String(++seq).padStart(2, "0")}-${suffix}`;
    const total = 75000 * qty;
    const h = (await j(await K.api("transactions", { method: "POST", body: JSON.stringify([{
      store_id: ktb.id, number, cashier: `${TAG} kasir`, customer_name: `${TAG} ${suffix}`, status: "pending", payment_method: "cash", payment_status: "pending",
      subtotal: total, tax: 0, discount: 0, total, amount_paid: total, change: 0, kind, due_date: kind === "rental" ? "2026-10-07" : null,
    }]) })))?.[0];
    await K.api("transaction_items", { method: "POST", body: JSON.stringify([{
      transaction_id: h.id, product_id: productId, variant_id: variantId, name: `${TAG} Kebaya`, sku: `${TAG}-V`, size: "M", color: "TES",
      quantity: qty, unit_price: 75000, cost_price: null, discount: 0, total,
    }]) });
    let rid = null;
    if (kind === "rental") {
      rid = (await j(await K.api("rentals", { method: "POST", body: JSON.stringify([{
        transaction_id: h.id, product_id: productId, qty, rent_price: 75000, deposit, start_date: "2026-10-02", due_date: "2026-10-07",
      }]) })))?.[0]?.id;
    }
    const paid = await K.api(`transactions?id=eq.${h.id}`, { method: "PATCH", body: JSON.stringify({ status: "paid", payment_status: "paid" }) });
    return { id: h.id, number, rid, paidOk: paid.ok };
  };
  const setStatus = (id, status) => K.api(`transactions?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status, payment_status: status === "paid" ? "paid" : "failed" }) });
  const cancelMoves = async (number) => (await j(await A.api(`stock_movements?select=type,quantity,reason&note=eq.${number}&type=eq.return`))) ?? [];

  // ===== (a) stok dobel =====
  const s1 = await makeNote("s1");
  check("S1a sewa 2 unit dibayar → stok 10 → 8", s1.paidOk && (await stockOf()) === 8);
  const r1 = await K.rpc("return_rental", { p_rental: s1.rid, p_qty: 1, p_staff: `${TAG} kasir` });
  check("S1b terima 1 unit → stok 9", r1.ok && (await stockOf()) === 9, `status ${r1.status}`);
  await setStatus(s1.id, "cancelled");
  check("S1c batal nota → stok 10 (BUKAN 11): hanya 1 unit (2−1) yang dikembalikan", (await stockOf()) === 10, `stok ${await stockOf()}`);
  const m1 = await cancelMoves(s1.number);
  check("S1d movement pembatalan = +1 dengan alasan 'Pembatalan sewa'", m1.length === 1 && Number(m1[0].quantity) === 1 && m1[0].reason === "Pembatalan sewa", JSON.stringify(m1));

  const s2 = await makeNote("s2");
  await setStatus(s2.id, "cancelled");
  check("S2 batal tanpa pengembalian: 10 → 8 → 10 (qty penuh kembali)", (await stockOf()) === 10);

  const s3 = await makeNote("s3");
  await K.rpc("return_rental", { p_rental: s3.rid, p_qty: 2, p_staff: `${TAG} kasir` });
  check("S3a semua kembali → stok 10", (await stockOf()) === 10);
  await setStatus(s3.id, "cancelled");
  const m3 = await cancelMoves(s3.number);
  check("S3b batal setelah semua kembali: stok tetap 10 dan TIDAK ada movement pembatalan", (await stockOf()) === 10 && m3.length === 0, `stok ${await stockOf()} movement ${m3.length}`);

  const s4 = await makeNote("s4", { kind: "sale", qty: 1 });
  check("S4a nota penjualan biasa dibayar → stok 9", s4.paidOk && (await stockOf()) === 9);
  await setStatus(s4.id, "cancelled");
  const m4 = await cancelMoves(s4.number);
  check("S4b batal penjualan biasa → stok 10 penuh, alasan 'Pembatalan' (tanpa 'sewa')", (await stockOf()) === 10 && m4.length === 1 && m4[0].reason === "Pembatalan", JSON.stringify(m4));

  const r5 = await K.rpc("return_rental", { p_rental: s1.rid, p_qty: 1, p_staff: `${TAG} kasir` });
  check("S5 return_rental pada nota yang sudah batal → 'rental_not_active', stok tetap 10", (await hasErr(r5, "rental_not_active")) && (await stockOf()) === 10, `status ${r5.status}`);

  const s6 = await makeNote("s6");
  await K.rpc("return_rental", { p_rental: s6.rid, p_qty: 1, p_staff: `${TAG} kasir` });
  await setStatus(s6.id, "refunded");
  const m6 = await cancelMoves(s6.number);
  check("S6 refund setelah 1 dari 2 kembali → stok 10 (bukan 11), alasan 'Refund sewa'", (await stockOf()) === 10 && m6.length === 1 && m6[0].reason === "Refund sewa", `stok ${await stockOf()} ${JSON.stringify(m6)}`);

  // ===== (b) deposit =====
  const rentalRow = async (rid) => (await j(await A.api(`rentals?select=*&id=eq.${rid}`)))[0];
  const d0 = await makeNote("d0", { qty: 2, deposit: 20000 }); // diterima 40.000
  const s1r = await K.rpc("settle_rental_deposit", { p_rental: d0.rid, p_refund: 25000, p_deduct: 5000, p_note: "kancing hilang", p_staff: `${TAG} kasir` });
  let row = await rentalRow(d0.rid);
  check("D1 kembalikan 25.000 + potong 5.000 + catatan tercatat; settled_at masih kosong (sisa 10.000)",
    s1r.ok && Number(row.deposit_refunded) === 25000 && Number(row.deposit_deducted) === 5000 && row.deposit_settled_at == null && /\[TES-E20 kasir\] kancing hilang/.test(row.deposit_note ?? ""),
    JSON.stringify({ ref: row.deposit_refunded, ded: row.deposit_deducted, note: row.deposit_note, settled: row.deposit_settled_at }));

  const over = await K.rpc("settle_rental_deposit", { p_rental: d0.rid, p_refund: 20000, p_deduct: 0, p_note: "", p_staff: `${TAG} kasir` });
  row = await rentalRow(d0.rid);
  check("D2 melebihi yang ditahan (20.000 > 10.000) → 'deposit_exceeds_held', angka tak berubah", (await hasErr(over, "deposit_exceeds_held")) && Number(row.deposit_refunded) === 25000 && Number(row.deposit_deducted) === 5000);

  const z = await K.rpc("settle_rental_deposit", { p_rental: d0.rid, p_refund: 0, p_deduct: 0, p_note: "", p_staff: `${TAG} kasir` });
  const neg = await K.rpc("settle_rental_deposit", { p_rental: d0.rid, p_refund: -5, p_deduct: 0, p_note: "", p_staff: `${TAG} kasir` });
  check("D3 jumlah 0 dan negatif → 'amount_invalid'", (await hasErr(z, "amount_invalid")) && (await hasErr(neg, "amount_invalid")));

  const last = await K.rpc("settle_rental_deposit", { p_rental: d0.rid, p_refund: 10000, p_deduct: 0, p_note: "", p_staff: `${TAG} kasir` });
  row = await rentalRow(d0.rid);
  const again = await K.rpc("settle_rental_deposit", { p_rental: d0.rid, p_refund: 1, p_deduct: 0, p_note: "", p_staff: `${TAG} kasir` });
  check("D4 habis (10.000) → settled_at terisi; penyelesaian berikutnya ditolak", last.ok && row.deposit_settled_at != null && (await hasErr(again, "deposit_exceeds_held")));

  const direct = await K.api(`rentals?id=eq.${d0.rid}`, { method: "PATCH", body: JSON.stringify({ deposit_refunded: 999999 }) });
  row = await rentalRow(d0.rid);
  check("D5 CHECK constraint menolak update langsung melebihi deposit (dikembalikan 999.999)", !direct.ok && Number(row.deposit_refunded) === 35000, `status ${direct.status}`);

  const d6 = await makeNote("d6", { qty: 1, deposit: null });
  const nodep = await K.rpc("settle_rental_deposit", { p_rental: d6.rid, p_refund: 1000, p_deduct: 0, p_note: "", p_staff: `${TAG} kasir` });
  check("D6 sewa tanpa deposit → ditolak ('deposit_exceeds_held')", await hasErr(nodep, "deposit_exceeds_held"));

  // D7 kasir KTB vs sewa toko MJL (dibuat service role)
  const fh = (await j(await A.api("transactions", { method: "POST", body: JSON.stringify([{ store_id: mjl.id, number: `${TAG}-MJL-1`, cashier: TAG, customer_name: `${TAG} lintas`, status: "paid", payment_method: "cash", payment_status: "paid", subtotal: 1000, tax: 0, discount: 0, total: 1000, amount_paid: 1000, change: 0, kind: "rental", due_date: "2026-10-07" }]) })))?.[0];
  const fr = (await j(await A.api("rentals", { method: "POST", body: JSON.stringify([{ transaction_id: fh.id, product_id: mjlProductId, qty: 1, rent_price: 1000, deposit: 10000, start_date: "2026-10-02", due_date: "2026-10-07" }]) })))?.[0];
  const cross = await K.rpc("settle_rental_deposit", { p_rental: fr.id, p_refund: 1000, p_deduct: 0, p_note: "", p_staff: `${TAG} kasir` });
  row = await rentalRow(fr.id);
  check("D7 kasir KTB menyelesaikan deposit sewa toko MJL → ditolak, angka tak berubah", !cross.ok && Number(row.deposit_refunded) === 0, `status ${cross.status} ${JSON.stringify(await j(cross.clone()))}`);

  // D8 deposit nota batal tetap bisa diselesaikan
  const d8 = await makeNote("d8", { qty: 1, deposit: 10000 });
  await setStatus(d8.id, "cancelled");
  const afterCancel = await K.rpc("settle_rental_deposit", { p_rental: d8.rid, p_refund: 10000, p_deduct: 0, p_note: "nota batal", p_staff: `${TAG} kasir` });
  row = await rentalRow(d8.rid);
  check("D8 deposit sewa dari nota yang sudah batal tetap bisa dikembalikan", afterCancel.ok && Number(row.deposit_refunded) === 10000 && row.deposit_settled_at != null);
} finally {
  try {
    await A.api(`stock_movements?product_name=like.${TAG}*`, { method: "DELETE" });
    await A.api(`transactions?customer_name=like.${TAG}*`, { method: "DELETE" });
    await A.api(`customers?name=like.${TAG}*`, { method: "DELETE" });
    if (productId) await A.api(`products?id=eq.${productId}`, { method: "DELETE" });
    if (mjlProductId) await A.api(`products?id=eq.${mjlProductId}`, { method: "DELETE" });
    if (staffId) await A.api(`staff?id=eq.${staffId}`, { method: "DELETE" });
    if (authId) await fetch(`${url}/auth/v1/admin/users/${authId}`, { method: "DELETE", headers: admin });
  } catch (e) { console.log("cleanup error:", e.message); }
  const cnt = async (q) => (await j(await A.api(q)))?.length ?? -1;
  const left = {
    produk: await cnt(`products?select=id&name=like.${TAG}*`),
    varian: await cnt(`variants?select=id&sku=like.${TAG}*`),
    nota: await cnt(`transactions?select=id&customer_name=like.${TAG}*`),
    sewa: await cnt(`rentals?select=id&transaction_id=in.(${(await j(await A.api(`transactions?select=id&number=like.${TAG}-*`)))?.map((x) => x.id).join(",") || "00000000-0000-0000-0000-000000000000"})`),
    penyewa: await cnt(`customers?select=id&name=like.${TAG}*`),
    movement: await cnt(`stock_movements?select=id&product_name=like.${TAG}*`),
    staff: await cnt(`staff?select=id&name=like.${TAG}*`),
  };
  let authLeft = 0;
  if (authId) { const r = await fetch(`${url}/auth/v1/admin/users/${authId}`, { headers: admin }); authLeft = r.ok ? 1 : 0; }
  check("CLEANUP sisa artefak TES-E20 = 0", Object.values(left).every((n) => n === 0) && authLeft === 0, JSON.stringify({ ...left, authUser: authLeft }));
  console.log(`\nHASIL: ${pass} PASS, ${fail} FAIL`);
  process.exitCode = fail ? 1 : 0;
}
