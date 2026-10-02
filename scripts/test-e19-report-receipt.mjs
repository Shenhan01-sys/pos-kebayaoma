// scripts/test-e19-report-receipt.mjs — E19 integrasi vs DB produksi: struk sewa + pemisahan omzet sewa di laporan.
// Memakai kode ASLI (lib/report-data.ts, lib/report-export.ts buildSheets, lib/thermal-receipt.ts) atas BARIS ASLI
// dari database (alias "@/" di-resolve oleh hook kecil di bawah). Artefak SELALU berawalan "TES-E19"; dibersihkan + bukti sisa = 0.
// Nomor nota uji berformat "TES-E19-..." → TIDAK memakai next_tx_number (tak ada celah penomoran KTB).
// Header disisipkan langsung 'paid' SEBELUM item (trigger insert-paid tanpa item = no-op) dan tanpa customer_id → stok
// & statistik pelanggan tak tersentuh. Pemetaan baris → Transaction di sini meniru mapper store/data.ts (mapper asli
// mengimpor klien Supabase sehingga tak bisa dimuat dari node) — keterbatasan dicatat di vault.
//  R1 `kind`/`due_date` tersimpan & terbaca dari DB; R2 computeReport memisahkan sewa vs penjualan dari baris asli
//  R3 invarian pada SEMUA nota lunas produksi: salesRetail + rentalSales == sales, byMethod == sales
//  R4 buildSheets angka identik; R5 struk sewa asli: label + tanggal kembali; struk penjualan tak berubah
// Jalankan: node --experimental-strip-types --no-warnings scripts/test-e19-report-receipt.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { register } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// alias "@/x" → <root>/x.ts
register(
  "data:text/javascript," +
    encodeURIComponent(`
  const root = ${JSON.stringify(pathToFileURL(root).href + "/")};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  }`),
  import.meta.url
);
const { computeReport } = await import("../lib/report-data.ts");
const { buildSheets } = await import("../lib/report-export.ts");
const { buildThermalReceiptHtml } = await import("../lib/thermal-receipt.ts");

const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.split("=", 1)[0], l.slice(l.indexOf("=") + 1)])
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const TAG = "TES-E19";
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation" };
const api = (path, init = {}) => fetch(`${url}/rest/v1/${path}`, { headers: H, ...init });
const j = async (r) => { try { return await r.json(); } catch { return null; } };

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

// meniru mapper store/data.ts (baris DB → Transaction)
const mapTx = (r) => ({
  id: r.id, number: r.number, storeId: r.store_id ?? undefined, cashier: r.cashier, customerName: r.customer_name ?? undefined,
  status: r.status, paymentMethod: r.payment_method, paymentStatus: r.payment_status,
  subtotal: Number(r.subtotal), tax: Number(r.tax), discount: Number(r.discount), total: Number(r.total),
  amountPaid: Number(r.amount_paid), change: Number(r.change), createdAt: r.created_at,
  kind: r.kind ?? undefined, dueDate: r.due_date ?? undefined,
  items: (r.transaction_items ?? []).map((i) => ({
    productId: i.product_id, variantId: i.variant_id, name: i.name, sku: i.sku, size: i.size, color: i.color,
    quantity: Number(i.quantity), unitPrice: Number(i.unit_price), costPrice: i.cost_price == null ? 0 : Number(i.cost_price),
    discount: Number(i.discount), total: Number(i.total),
  })),
});

const stores = await j(await api("stores?select=id,name&order=name"));
const ktb = stores.find((s) => /kota baru/i.test(s.name)) ?? stores[1];
console.log("toko uji:", ktb.name);

let productId = null, variantId = null;
const txIds = [];
try {
  const p = (await j(await api("products", { method: "POST", body: JSON.stringify([{ sku: `${TAG}-P`, name: `${TAG} Kebaya`, store_id: ktb.id, active: true, stock: 9, images: [], tags: [] }]) })))[0];
  productId = p.id;
  const v = (await j(await api("variants", { method: "POST", body: JSON.stringify([{ sku: `${TAG}-V`, name: "Seri A", size: "M", color: "TES", color_code: "#000000", selling_price: 100000, cost_price: 40000, product_id: productId }]) })))[0];
  variantId = v.id;
  const stock0 = Number((await j(await api(`products?select=stock&id=eq.${productId}`)))[0].stock);

  const mkNote = async (suffix, { kind, total, qty, unit, cost, method = "cash", due = null }) => {
    const hr = await api("transactions", { method: "POST", body: JSON.stringify([{
      store_id: ktb.id, number: `${TAG}-${suffix}`, cashier: `${TAG} kasir`, customer_name: `${TAG} Pelanggan`,
      status: "paid", payment_method: method, payment_status: "paid", subtotal: total, tax: 0, discount: 0, total,
      amount_paid: total, change: 0, kind, due_date: due,
    }]) });
    const h = (await j(hr))?.[0];
    if (!h) throw new Error(`header ${suffix} gagal: ${hr.status}`);
    txIds.push(h.id);
    const ir = await api("transaction_items", { method: "POST", body: JSON.stringify([{
      transaction_id: h.id, product_id: productId, variant_id: variantId, name: `${TAG} Kebaya`, sku: `${TAG}-V`, size: "M", color: "TES",
      quantity: qty, unit_price: unit, cost_price: cost, discount: 0, total,
    }]) });
    if (!ir.ok) throw new Error(`item ${suffix} gagal: ${ir.status}`);
    return h;
  };
  await mkNote("S1", { kind: "sale", total: 200000, qty: 2, unit: 100000, cost: 40000 });
  await mkNote("R1", { kind: "rental", total: 140000, qty: 2, unit: 70000, cost: null, method: "transfer", due: "2026-10-07" });
  const canc = await mkNote("R2", { kind: "rental", total: 70000, qty: 1, unit: 70000, cost: null, due: "2026-10-09" });
  // batalkan nota R2 langsung (tanpa trigger stok? — status paid→cancelled memicu reverse_sale_stock; item sewa + stok TES saja)
  // → stok produk TES berubah, hanya artefak uji; dipakai untuk menguji "nota batal tak dihitung".
  await api(`transactions?id=eq.${canc.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled", payment_status: "failed" }) });

  // R1: kind & due_date tersimpan/terbaca
  const rows = await j(await api(`transactions?select=*,transaction_items(*)&number=like.${TAG}-*&order=number`));
  const byNo = Object.fromEntries(rows.map((r) => [r.number, r]));
  check("R1a kolom kind & due_date tersimpan dan terbaca dari DB",
    byNo[`${TAG}-R1`]?.kind === "rental" && byNo[`${TAG}-R1`]?.due_date === "2026-10-07" && byNo[`${TAG}-S1`]?.kind === "sale" && byNo[`${TAG}-S1`]?.due_date == null,
    JSON.stringify(rows.map((r) => [r.number, r.kind, r.due_date, r.status])));

  // R2: computeReport (kode asli) atas baris asli
  const txs = rows.map(mapTx);
  const r = computeReport(txs, null);
  check("R2a omzet total = penjualan 200.000 + sewa 140.000; nota batal tak dihitung", r.sales === 340000 && r.salesRetail === 200000 && r.rentalSales === 140000 && r.rentalCount === 1 && r.count === 2,
    `sales ${r.sales} retail ${r.salesRetail} rental ${r.rentalSales} n=${r.rentalCount} count ${r.count}`);
  check("R2b sewa tidak jadi 'tanpa modal' & tidak masuk produk terlaris; HPP hanya dari penjualan (2×40.000)", r.unknownQty === 0 && r.hpp === 80000 && r.topProducts.length === 1 && r.topProducts[0][1].qty === 2 && r.rentalProducts.length === 1 && r.rentalProducts[0][1].qty === 2,
    `unknown ${r.unknownQty} hpp ${r.hpp} top ${JSON.stringify(r.topProducts)} rentalProducts ${JSON.stringify(r.rentalProducts)}`);
  check("R2c byMethod menjumlah ke omzet total (tunai 200.000, transfer 140.000)", r.byMethod.cash === 200000 && r.byMethod.transfer === 140000);
  check("R2d baris laporan bertanda kind benar", r.lines.find((l) => l.number === `${TAG}-R1`)?.kind === "rental" && r.lines.find((l) => l.number === `${TAG}-S1`)?.kind === "sale");

  // R4: buildSheets
  const sh = buildSheets(r, { storeLabel: "KTB", from: "", to: "" });
  const f = (label) => (sh.summary.find((row) => row[0] === label) ?? [])[1];
  const detR1 = sh.detail.find((row) => row[0] === `${TAG}-R1`);
  check("R4 buildSheets: Omzet/Penjualan/Sewa identik dgn report; baris detail sewa bertanda 'Sewa'", f("Omzet") === 340000 && f("  Omzet Penjualan") === 200000 && f("  Omzet Sewa") === 140000 && detR1?.[detR1.length - 1] === "Sewa");

  // R5: struk (kode asli) atas baris asli
  const store = { storeName: "Kebaya Oma", address: "-", phone: "-" };
  const rHtml = buildThermalReceiptHtml(mapTx(byNo[`${TAG}-R1`]), store);
  const sHtml = buildThermalReceiptHtml(mapTx(byNo[`${TAG}-S1`]), store);
  check("R5a struk sewa: label *** SEWA ***, 'Kembali: 07 Okt 2026', footer batas kembali; tanpa 'tidak bisa dikembalikan'",
    rHtml.includes("*** SEWA ***") && rHtml.includes("Kembali: 07 Okt 2026") && rHtml.includes("wajib dikembalikan paling lambat 07 Okt 2026") && !rHtml.includes("Barang tidak bisa dikembalikan"));
  check("R5b struk penjualan biasa tidak berubah (tanpa label SEWA, footer lama)", !sHtml.includes("*** SEWA ***") && !sHtml.includes("Kembali:") && sHtml.includes("Barang tidak bisa dikembalikan"));

  // stok produk TES: trigger paid→cancelled hanya memengaruhi produk TES
  const stock1 = Number((await j(await api(`products?select=stock&id=eq.${productId}`)))[0].stock);
  console.log(`(info) stok produk TES ${stock0} → ${stock1} (efek trigger pada artefak uji saja)`);

  // R3: invarian pada SEMUA nota lunas produksi (read-only) — termasuk nota asli
  const prod = (await j(await api("transactions?select=*,transaction_items(*)&status=eq.paid&number=not.like.TES-*&limit=5000"))) ?? [];
  const pr = computeReport(prod.map(mapTx), null);
  check(`R3a produksi (${prod.length} nota lunas asli): penjualan + sewa == omzet total`, pr.salesRetail + pr.rentalSales === pr.sales, `retail ${pr.salesRetail} + sewa ${pr.rentalSales} vs ${pr.sales}`);
  check("R3b produksi: byMethod menjumlah ke omzet total", Object.values(pr.byMethod).reduce((a, b) => a + b, 0) === pr.sales);
  console.log(`(info) produksi: omzet ${pr.sales}, sewa ${pr.rentalSales} (${pr.rentalCount} nota)`);
} finally {
  // cleanup
  for (const id of txIds) await api(`transaction_items?transaction_id=eq.${id}`, { method: "DELETE" });
  for (const id of txIds) await api(`transactions?id=eq.${id}`, { method: "DELETE" });
  await api(`stock_movements?variant_id=eq.${productId}`, { method: "DELETE" }).catch(() => {});
  if (variantId) await api(`variants?id=eq.${variantId}`, { method: "DELETE" });
  if (productId) await api(`products?id=eq.${productId}`, { method: "DELETE" });
  const left = {
    nota: (await j(await api(`transactions?select=id&number=like.${TAG}-*`)))?.length,
    produk: (await j(await api(`products?select=id&sku=like.${TAG}-*`)))?.length,
    varian: (await j(await api(`variants?select=id&sku=like.${TAG}-*`)))?.length,
    movement: productId ? (await j(await api(`stock_movements?select=id&variant_id=eq.${productId}`)))?.length : 0,
  };
  check("Cleanup: sisa artefak TES-E19 = 0", Object.values(left).every((n) => n === 0), JSON.stringify(left));
}
console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
