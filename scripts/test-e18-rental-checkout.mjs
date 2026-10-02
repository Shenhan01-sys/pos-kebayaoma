// scripts/test-e18-rental-checkout.mjs — E18 integrasi vs DB produksi dengan SESI KASIR SUNGGUHAN (bukan service role),
// agar RLS benar-benar diuji. Artefak SELALU berawalan "TES-E18"; dibersihkan + bukti sisa = 0.
// Mereplikasi urutan store/data.ts saveTransaction untuk sewa:
//   customers (upsert) → next_tx_number → header(pending) → items → rentals → UPDATE paid (trigger stok)
//  K1 jalur normal: kasir bisa menulis semua langkah; stok baru keluar saat paid; movement 'sale'; sewa terbaca
//  K2 rollback: rentals gagal (FK) → kasir menghapus header → nota hilang, stok tak berubah
//  K3 QRIS pending: header+items+rentals pending → stok TIDAK berubah; paid → stok keluar; batal → stok kembali
//  K4 daftar sewa: join transactions.status memisahkan paid / pending / cancelled (dasar filter fetchRentals)
//  K5 RLS lintas toko: kasir KTB tidak bisa menyisipkan rentals ke nota toko MJL
// Jalankan: node --experimental-strip-types --no-warnings scripts/test-e18-rental-checkout.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.split("=", 1)[0], l.slice(l.indexOf("=") + 1)])
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TAG = "TES-E18";
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

const stores = await j(await A.api("stores?select=id,name,receipt_prefix&order=name"));
const ktb = stores.find((s) => /kota baru/i.test(s.name)) ?? stores[1];
const mjl = stores.find((s) => s.id !== ktb.id);
console.log("toko uji:", ktb.name, "| toko lain:", mjl.name);

let staffId = null, authId = null, productId = null, variantId = null;
const stockOf = async () => Number((await j(await A.api(`products?select=stock&id=eq.${productId}`)))[0].stock);

try {
  // --- pra-kondisi (service role): produk + varian stok 5, kasir uji dengan sesi nyata ---
  const p = (await j(await A.api("products", { method: "POST", body: JSON.stringify([{ sku: `${TAG}-P`, name: `${TAG} Kebaya`, store_id: ktb.id, active: true, stock: 5, images: [], tags: [] }]) })))[0];
  productId = p.id;
  const v = (await j(await A.api("variants", { method: "POST", body: JSON.stringify([{ sku: `${TAG}-V`, name: "Seri A", size: "M", color: "TES", color_code: "#000000", selling_price: 100000, cost_price: 0, rental_price: null, rental_days: 3, deposit_price: null, product_id: productId }]) })))[0];
  variantId = v.id;
  const st = (await j(await A.api("staff", { method: "POST", body: JSON.stringify([{ name: `${TAG} kasir`, role: "kasir", store_id: ktb.id, active: true }]) })))[0];
  staffId = st.id;
  const email = `staff-${staffId}@kebayaoma.local`;
  const cu = await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ email, password: PIN, email_confirm: true }) });
  authId = (await j(cu))?.id;
  await A.api(`staff?id=eq.${staffId}`, { method: "PATCH", body: JSON.stringify({ user_id: authId }) });
  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PIN }) });
  const token = (await j(login))?.access_token;
  check("pra-kondisi: kasir uji (role kasir, toko KTB) berhasil login → sesi nyata", !!token && !!authId);
  const K = call(hdr(token, ANON)); // ← SEMUA langkah di bawah memakai sesi kasir (RLS berlaku)

  const startDate = "2026-10-02", dueDate = "2026-10-07";
  // meniru saveTransaction: pelanggan → nomor → header pending → items
  const makeTx = async (suffix, { badRental = false, qty = 2 } = {}) => {
    const name = `${TAG} ${suffix}`;
    let cust = (await j(await K.api(`customers?select=id&store_id=eq.${ktb.id}&name=ilike.${encodeURIComponent(name)}&limit=1`)))?.[0];
    if (!cust) {
      const c = await K.api("customers", { method: "POST", body: JSON.stringify([{ store_id: ktb.id, name, phone: "0857-1111-2222" }]) });
      cust = (await j(c))?.[0];
    }
    const num = await j(await K.rpc("next_tx_number", { p_store_id: ktb.id }));
    const total = 75000 * qty;
    const hr = await K.api("transactions", { method: "POST", body: JSON.stringify([{
      store_id: ktb.id, number: num, cashier: `${TAG} kasir`, customer_id: cust?.id ?? null, customer_name: name,
      status: "pending", payment_method: "cash", payment_status: "pending", subtotal: total, tax: 0, discount: 0, total, amount_paid: total, change: 0,
      kind: "rental", due_date: dueDate,
    }]) });
    const header = (await j(hr))?.[0];
    const ir = header ? await K.api("transaction_items", { method: "POST", body: JSON.stringify([{
      transaction_id: header.id, product_id: productId, variant_id: variantId, name: `${TAG} Kebaya`, sku: `${TAG}-V`, size: "M", color: "TES",
      quantity: qty, unit_price: 75000, cost_price: null, discount: 0, total,
    }]) }) : null;
    const rr = header ? await K.api("rentals", { method: "POST", body: JSON.stringify([{
      transaction_id: header.id, customer_id: cust?.id ?? null, product_id: badRental ? randomUUID() : productId, qty, rent_price: 75000, deposit: null, start_date: startDate, due_date: dueDate,
    }]) }) : null;
    return { header, cust, hr, ir, rr, name };
  };
  const setStatus = (id, status) => K.api(`transactions?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status, payment_status: status === "cancelled" ? "failed" : "paid" }) });

  // K1 jalur normal
  const k1 = await makeTx("normal");
  check("K1a kasir menulis penyewa+nota pending+item+rentals di bawah RLS", k1.hr.ok && k1.ir?.ok && k1.rr?.ok, `hdr ${k1.hr.status} item ${k1.ir?.status} rentals ${k1.rr?.status}`);
  check("K1b sebelum paid: stok BELUM berubah (5)", (await stockOf()) === 5);
  const pr = await setStatus(k1.header.id, "paid");
  check("K1c UPDATE → paid oleh kasir berhasil", pr.ok, `status ${pr.status}`);
  check("K1d stok 5 → 3 setelah paid (trigger)", (await stockOf()) === 3);
  const mv = await j(await A.api(`stock_movements?select=type,quantity&variant_id=eq.${productId}&type=eq.sale`));
  check("K1e movement 'sale' −2 tercatat", mv.length === 1 && Number(mv[0].quantity) === -2, JSON.stringify(mv));
  const r1 = (await j(await K.api(`rentals?select=qty,rent_price,due_date,customers(name,phone),transactions(number,status,kind)&transaction_id=eq.${k1.header.id}`)))?.[0];
  check("K1f kasir membaca sewa dengan join nota+penyewa; nota paid kind=rental", r1?.transactions?.status === "paid" && r1?.transactions?.kind === "rental" && r1?.customers?.phone === "0857-1111-2222" && r1?.due_date === dueDate, JSON.stringify(r1));

  // K2 rollback: rentals gagal (FK) → hapus header
  const k2 = await makeTx("rollback", { badRental: true });
  check("K2a rentals dengan produk tak ada GAGAL (FK) sementara header & item sudah ada", k2.hr.ok && k2.ir?.ok && k2.rr && !k2.rr.ok, `rentals status ${k2.rr?.status}`);
  const del = await K.api(`transactions?id=eq.${k2.header.id}`, { method: "DELETE" });
  const still = await j(await A.api(`transactions?select=id&id=eq.${k2.header.id}`));
  const itemsLeft = await j(await A.api(`transaction_items?select=id&transaction_id=eq.${k2.header.id}`));
  check("K2b rollback: kasir menghapus header → nota & item hilang", del.ok && still.length === 0 && itemsLeft.length === 0, `del ${del.status}`);
  check("K2c stok tetap 3 setelah rollback (tak pernah paid)", (await stockOf()) === 3);

  // K3 QRIS pending
  const k3 = await makeTx("pending", { qty: 1 });
  check("K3a header+item+rentals pending berhasil", k3.hr.ok && k3.ir?.ok && k3.rr?.ok);
  check("K3b selama pending stok TIDAK berubah (3)", (await stockOf()) === 3);
  const pend = (await j(await K.api(`rentals?select=transactions(status)&transaction_id=eq.${k3.header.id}`)))?.[0];
  check("K4a join status memisahkan: nota pending → 'pending' (filter fetchRentals menyembunyikan)", pend?.transactions?.status === "pending");
  await setStatus(k3.header.id, "paid");
  check("K3c webhook/polling → paid: stok 3 → 2", (await stockOf()) === 2);
  await setStatus(k3.header.id, "cancelled");
  check("K3d dibatalkan setelah paid: stok kembali 2 → 3 (reverse_sale_stock)", (await stockOf()) === 3);
  const canc = (await j(await K.api(`rentals?select=transactions(status)&transaction_id=eq.${k3.header.id}`)))?.[0];
  check("K4b nota batal → join status 'cancelled' (disembunyikan filter daftar sewa)", canc?.transactions?.status === "cancelled");

  // K5 RLS lintas toko
  const foreign = (await j(await A.api("transactions", { method: "POST", body: JSON.stringify([{ store_id: mjl.id, number: `${TAG}-MJL-${Date.now()}`, cashier: TAG, customer_name: `${TAG} lintas`, status: "pending", payment_method: "cash", payment_status: "pending", subtotal: 1000, tax: 0, discount: 0, total: 1000, amount_paid: 1000, change: 0, kind: "rental" }]) })))?.[0];
  const x = await K.api("rentals", { method: "POST", body: JSON.stringify([{ transaction_id: foreign.id, product_id: productId, qty: 1, rent_price: 1000, start_date: startDate, due_date: dueDate }]) });
  const leaked = await j(await A.api(`rentals?select=id&transaction_id=eq.${foreign.id}`));
  check("K5 kasir KTB TIDAK bisa menyisipkan rentals ke nota toko MJL (RLS)", !x.ok && leaked.length === 0, `status ${x.status}`);
} finally {
  // cleanup (service role): movement → nota (items/rentals cascade) → penyewa → produk (varian cascade) → staff → auth user
  try {
    await A.api(`stock_movements?product_name=like.${TAG}*`, { method: "DELETE" });
    await A.api(`transactions?customer_name=like.${TAG}*`, { method: "DELETE" });
    await A.api(`customers?name=like.${TAG}*`, { method: "DELETE" });
    if (productId) await A.api(`products?id=eq.${productId}`, { method: "DELETE" });
    if (staffId) await A.api(`staff?id=eq.${staffId}`, { method: "DELETE" });
    if (authId) await fetch(`${url}/auth/v1/admin/users/${authId}`, { method: "DELETE", headers: admin });
  } catch (e) { console.log("cleanup error:", e.message); }
  const cnt = async (q) => (await j(await A.api(q)))?.length ?? -1;
  const left = {
    produk: await cnt(`products?select=id&name=like.${TAG}*`),
    varian: await cnt(`variants?select=id&sku=like.${TAG}*`),
    nota: await cnt(`transactions?select=id&customer_name=like.${TAG}*`),
    penyewa: await cnt(`customers?select=id&name=like.${TAG}*`),
    movement: await cnt(`stock_movements?select=id&product_name=like.${TAG}*`),
    staff: await cnt(`staff?select=id&name=like.${TAG}*`),
  };
  let authLeft = 0;
  if (authId) { const r = await fetch(`${url}/auth/v1/admin/users/${authId}`, { headers: admin }); authLeft = r.ok ? 1 : 0; }
  check("CLEANUP sisa artefak TES-E18 = 0", Object.values(left).every((n) => n === 0) && authLeft === 0, JSON.stringify({ ...left, authUser: authLeft }));
  console.log(`\nHASIL: ${pass} PASS, ${fail} FAIL`);
  process.exitCode = fail ? 1 : 0;
}
