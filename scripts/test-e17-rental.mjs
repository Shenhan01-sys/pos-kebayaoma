// scripts/test-e17-rental.mjs — E17 integrasi vs DB produksi (artefak SELALU berawalan "TES-E17", dibersihkan).
// Menguji RPC yang dipakai halaman /sewa + bahwa data DB cocok dengan logika lib/rental.ts:
//  I1 create_rental → nota kind=rental/paid/total, baris rentals, stok −qty, movement sale, penyewa auto-create
//  I2 return_rental sebagian → returned_qty, stok +, movement return, returned_at masih kosong
//  I3 return_rental melebihi sisa → too_many_returned (stok tak berubah)
//  I4 return_rental sisa → selesai (returned_at terisi), stok kembali penuh
//  I5 create_rental melebihi stok → insufficient_stock
//  I6 create_rental tarif 0 → no_rental_price
//  I8 varian TANPA rental_price disewa dengan harga default 70% dari harga jual (revisi 2): nota & rentals memakai harga itu
//  I7 bentuk data DB → lib/rental.ts (status, ringkasan, tab, pencarian, WA) konsisten
//  Cleanup + bukti sisa = 0.
// Jalankan: node --experimental-strip-types --no-warnings scripts/test-e17-rental.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { addDays, filterRentals, matchesTab, normalizePhoneId, rentalSummary, statusOf } from "../lib/rental.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.split("=", 1)[0], l.slice(l.indexOf("=") + 1)])
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
const api = (path, init = {}) => fetch(`${url}/rest/v1/${path}`, { headers: H, ...init });
const rpc = (fn, args) => fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(args) });
const j = async (r) => { try { return await r.json(); } catch { return null; } };

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const TAG = "TES-E17";

const store = (await j(await api("stores?select=id,name&order=name&limit=1")))[0];
console.log("toko uji:", store.name);
const stockOf = async (pid) => Number((await j(await api(`products?select=stock&id=eq.${pid}`)))[0].stock);

let productId = null;
let variantId = null;
try {
  // pra-kondisi: produk + varian bertarif sewa, stok 5 lewat RPC adjust_stock
  const p = (await j(await api("products", { method: "POST", body: JSON.stringify([{ sku: `${TAG}-P`, name: `${TAG} Kebaya`, store_id: store.id, active: true, stock: 0, images: [], tags: [] }]) })))[0];
  productId = p.id;
  const v = (await j(await api("variants", { method: "POST", body: JSON.stringify([{ sku: `${TAG}-V`, name: "Seri A", size: "M", color: "TES", color_code: "#000000", selling_price: 500000, cost_price: 0, rental_price: 100000, rental_days: 3, deposit_price: 50000, product_id: productId }]) })))[0];
  variantId = v.id;
  // adjust_stock menolak service role (E12: khusus manager/superadmin) → stok awal diisi langsung (service role melewati RLS)
  const seed = await api(`products?id=eq.${productId}`, { method: "PATCH", body: JSON.stringify({ stock: 5 }) });
  check("pra-kondisi: stok awal 5", seed.ok && (await stockOf(productId)) === 5);

  const start = "2026-10-02";
  const mk = (over = {}) => ({
    p_store: store.id, p_product: productId, p_variant: v.id, p_qty: 2, p_rent_price: 100000, p_deposit: 50000,
    p_start_date: start, p_days: 3, p_customer_name: `${TAG} Penyewa`, p_customer_phone: "0812-3456-7890", p_cashier: TAG, p_payment_method: "cash", ...over,
  });

  // I1
  const r1 = await rpc("create_rental", mk());
  const txId = await j(r1);
  check("I1a create_rental sukses → id nota", r1.ok && typeof txId === "string", `status ${r1.status}`);
  const tx = (await j(await api(`transactions?select=number,kind,status,total,amount_paid,customer_name&id=eq.${txId}`)))[0];
  check("I1b nota: kind=rental, status=paid, total=200000 (tarif×qty)", tx?.kind === "rental" && tx?.status === "paid" && Number(tx?.total) === 200000, JSON.stringify({ k: tx?.kind, s: tx?.status, t: tx?.total }));
  const rent = (await j(await api(`rentals?select=*,customers(name,phone),transactions(number,store_id),products(name)&transaction_id=eq.${txId}`)))[0];
  check("I1c baris rentals: qty 2, rent_price 100000/unit, deposit 50000/unit, due = mulai+3", rent && Number(rent.qty) === 2 && Number(rent.rent_price) === 100000 && Number(rent.deposit) === 50000 && rent.due_date === addDays(start, 3), `due ${rent?.due_date}`);
  check("I1d penyewa auto-create dengan HP", rent?.customers?.name === `${TAG} Penyewa` && !!rent?.customers?.phone, rent?.customers?.phone);
  check("I1e stok 5 → 3", (await stockOf(productId)) === 3);
  const mv1 = await j(await api(`stock_movements?select=type,quantity&variant_id=eq.${productId}&type=eq.sale`));
  check("I1f movement 'sale' −2 tercatat", mv1.length === 1 && Number(mv1[0].quantity) === -2, JSON.stringify(mv1));

  // I2
  const q1 = await rpc("return_rental", { p_rental: rent.id, p_qty: 1, p_staff: TAG });
  const a2 = (await j(await api(`rentals?select=returned_qty,returned_at&id=eq.${rent.id}`)))[0];
  check("I2a terima sebagian (1 dari 2)", q1.ok && Number(a2.returned_qty) === 1 && a2.returned_at === null, JSON.stringify(a2));
  check("I2b stok 3 → 4", (await stockOf(productId)) === 4);
  const mv2 = await j(await api(`stock_movements?select=type,quantity&variant_id=eq.${productId}&type=eq.return`));
  check("I2c movement 'return' +1", mv2.length === 1 && Number(mv2[0].quantity) === 1, JSON.stringify(mv2));

  // I3
  const q3 = await rpc("return_rental", { p_rental: rent.id, p_qty: 5, p_staff: TAG });
  const e3 = JSON.stringify(await j(q3));
  check("I3a terima > sisa ditolak: too_many_returned", !q3.ok && e3.includes("too_many_returned"), `status ${q3.status}`);
  check("I3b stok tetap 4 setelah penolakan", (await stockOf(productId)) === 4);

  // I4
  const q4 = await rpc("return_rental", { p_rental: rent.id, p_qty: 1, p_staff: TAG });
  const a4 = (await j(await api(`rentals?select=returned_qty,returned_at&id=eq.${rent.id}`)))[0];
  check("I4a terima sisa → selesai (returned_at terisi)", q4.ok && Number(a4.returned_qty) === 2 && !!a4.returned_at, JSON.stringify(a4));
  check("I4b stok kembali penuh 5", (await stockOf(productId)) === 5);

  // I5/I6
  const q5 = await rpc("create_rental", mk({ p_qty: 99 }));
  check("I5 qty melebihi stok ditolak: insufficient_stock", !q5.ok && JSON.stringify(await j(q5)).includes("insufficient_stock"));
  const q6 = await rpc("create_rental", mk({ p_rent_price: 0 }));
  check("I6 tarif 0 ditolak: no_rental_price", !q6.ok && JSON.stringify(await j(q6)).includes("no_rental_price"));
  check("I5/I6 tidak mengubah stok (5)", (await stockOf(productId)) === 5);

  // I7: data nyata DB → logika halaman. Buat satu sewa terbuka terlambat untuk uji tab/ringkasan.
  const q7 = await rpc("create_rental", mk({ p_qty: 1, p_start_date: "2026-09-20", p_days: 3, p_customer_name: `${TAG} Telat` }));
  const rows = await j(await api(`rentals?select=*,customers(name,phone),transactions(number,store_id),products(name)&products.name=like.${TAG}*`));
  const mapped = rows.filter((r) => r.products?.name?.startsWith(TAG)).map((r) => ({
    id: r.id, txNumber: r.transactions?.number ?? "—", productName: r.products?.name ?? "—",
    customerName: r.customers?.name ?? null, customerPhone: r.customers?.phone ?? null,
    qty: Number(r.qty), returnedQty: Number(r.returned_qty ?? 0), rentPrice: Number(r.rent_price),
    deposit: r.deposit != null ? Number(r.deposit) : null, startDate: r.start_date, dueDate: r.due_date,
  }));
  const today = new Date(2026, 9, 2); // 2 Okt 2026
  const late = mapped.find((m) => m.customerName === `${TAG} Telat`);
  check("I7a sewa 20 Sep +3 hari dibaca 'lewat' pada 2 Okt", q7.ok && late && statusOf(late, today) === "lewat");
  check("I7b tab terlambat memuat yang telat saja; selesai memuat yang sudah kembali", filterRentals(mapped, { tab: "terlambat", query: "" }, today).map((m) => m.id).join() === late.id && filterRentals(mapped, { tab: "selesai", query: "" }, today).length === 1);
  const sm = rentalSummary(mapped, today);
  check("I7c ringkasan: 1 terbuka, 1 terlambat, deposit ditahan 50000 (1 unit × 50000/unit)", sm.open === 1 && sm.overdue === 1 && sm.depositHeld === 50000, JSON.stringify(sm));
  check("I7d pencarian lewat HP (digit) menemukan sewa; HP dinormalisasi ke 62…", filterRentals(mapped, { tab: "aktif", query: "0812 3456" }, today).length === 1 && normalizePhoneId(late.customerPhone) === "6281234567890");
  check("I7e matchesTab hari-ini tidak salah menandai yang telat", !matchesTab(late, "hari-ini", today));

  // I8: varian tanpa harga sewa (rental_price null) — harga default 70% × harga jual dikirim klien
  const v2 = (await j(await api("variants", { method: "POST", body: JSON.stringify([{ sku: `${TAG}-V2`, name: "Seri B", size: "L", color: "TES", color_code: "#000000", selling_price: 100000, cost_price: 0, rental_price: null, rental_days: 3, deposit_price: null, product_id: productId }]) })))[0];
  const stockBefore = await stockOf(productId);
  const q8 = await rpc("create_rental", mk({ p_variant: v2.id, p_qty: 1, p_rent_price: 70000, p_deposit: null, p_customer_name: `${TAG} Default` }));
  const tx8 = await j(q8);
  const t8 = q8.ok ? (await j(await api(`transactions?select=kind,total&id=eq.${tx8}`)))[0] : null;
  const r8 = q8.ok ? (await j(await api(`rentals?select=rent_price,deposit,qty&transaction_id=eq.${tx8}`)))[0] : null;
  check("I8a varian tanpa rental_price tetap bisa disewa dengan harga default (RPC tidak mensyaratkan harga varian)", q8.ok && t8?.kind === "rental" && Number(t8?.total) === 70000 && Number(r8?.rent_price) === 70000 && r8?.deposit === null, JSON.stringify({ t8, r8 }));
  check("I8b stok −1 untuk sewa default", (await stockOf(productId)) === stockBefore - 1);
} finally {
  // cleanup: movements → transaksi (rentals/transaction_items cascade) → penyewa → produk (varian cascade)
  try {
    if (productId) {
      // kolom stock_movements.variant_id berisi ID PRODUK; hapus juga lewat nama utk jaga-jaga
      await api(`stock_movements?variant_id=eq.${productId}`, { method: "DELETE" });
      await api(`stock_movements?product_name=like.${TAG}*`, { method: "DELETE" });
      const txs = await j(await api(`transaction_items?select=transaction_id&product_id=eq.${productId}`));
      for (const t of new Set((txs ?? []).map((x) => x.transaction_id))) await api(`transactions?id=eq.${t}`, { method: "DELETE" });
      await api(`customers?name=like.${TAG}*`, { method: "DELETE" });
      await api(`products?id=eq.${productId}`, { method: "DELETE" });
    }
  } catch (e) { console.log("cleanup error:", e.message); }
  const left = {
    produk: (await j(await api(`products?select=id&name=like.${TAG}*`))).length,
    varian: (await j(await api(`variants?select=id&sku=like.${TAG}*`))).length,
    penyewa: (await j(await api(`customers?select=id&name=like.${TAG}*`))).length,
    sewa: productId ? (await j(await api(`rentals?select=id&product_id=eq.${productId}`))).length : 0,
    movement: (await j(await api(`stock_movements?select=id&product_name=like.${TAG}*`))).length,
    notaTes: (await j(await api(`transactions?select=id&customer_name=like.${TAG}*`))).length,
  };
  check("CLEANUP sisa artefak TES-E17 = 0", Object.values(left).every((n) => n === 0), JSON.stringify(left));
  console.log(`\nHASIL: ${pass} PASS, ${fail} FAIL`);
  process.exitCode = fail ? 1 : 0;
}
