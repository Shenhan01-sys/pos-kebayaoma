// scripts/test-e16-sku.mjs — E16 integrasi vs DB produksi (artefak SELALU berawalan "TES-E16", dibersihkan).
//  I1 reproduksi 409: dua varian SKU kosong dalam 1 produk → 409/23505 (penyebab error user)
//  I2 produk yatim: setelah I1 produk tertinggal tanpa varian (bug lama, tanpa rollback)
//  I3 rollback: hapus produk yatim → varian tak ada, produk hilang
//  I4 fix: SKU otomatis (lib/sku.ts) → 2 varian tersimpan, SKU 8 digit berbeda, cocok saat dicari (scan)
//  I5 produk dengan SKU varian kembar → setelah fillVariantSkus tetap tersimpan
//  Cleanup + bukti sisa = 0.
// Jalankan: node --experimental-strip-types --no-warnings scripts/test-e16-sku.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fillVariantSkus, ensureProductSku, takenCodes } from "../lib/sku.ts";

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
const j = async (r) => { try { return await r.json(); } catch { return null; } };

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

const store = (await j(await api("stores?select=id,name&order=name&limit=1")))[0];
const cat = (await j(await api(`categories?select=id&store_id=eq.${store.id}&limit=1`)))[0];
console.log("toko uji:", store.name, "| kategori:", cat ? "ada" : "null");

const newProduct = async (suffix, sku) => {
  const r = await api("products", { method: "POST", body: JSON.stringify([{ sku, name: `TES-E16 ${suffix}`, store_id: store.id, category_id: cat?.id ?? null, active: true, stock: 0, images: [], tags: [] }]) });
  const b = await j(r);
  if (!r.ok) throw new Error("gagal buat produk uji: " + JSON.stringify(b));
  return b[0];
};
const varRow = (pid, v) => ({ sku: v.sku, name: v.name, size: "S", color: "TES", color_code: "#000000", selling_price: 1000, cost_price: 500, barcode: null, rental_price: null, rental_days: 3, deposit_price: null, product_id: pid });

try {
  // I1 + I2 : cara lama (SKU varian kosong ×2)
  const p1 = await newProduct("lama", "TES-E16-P1");
  const r1 = await api("variants", { method: "POST", body: JSON.stringify([varRow(p1.id, { sku: "", name: "A" }), varRow(p1.id, { sku: "", name: "B" })]) });
  const b1 = await j(r1);
  check("I1 reproduksi 409: dua varian SKU kosong → konflik unik", r1.status === 409 && b1?.code === "23505", `status ${r1.status} code ${b1?.code}`);
  const left1 = await j(await api(`variants?select=id&product_id=eq.${p1.id}`));
  const stillThere = await j(await api(`products?select=id&id=eq.${p1.id}`));
  check("I2 bug lama: produk tertinggal TANPA varian (yatim)", stillThere.length === 1 && left1.length === 0);
  // I3 rollback
  await api(`products?id=eq.${p1.id}`, { method: "DELETE" });
  const gone = await j(await api(`products?select=id&id=eq.${p1.id}`));
  check("I3 rollback: produk dihapus, tak ada yatim", gone.length === 0);

  // I4 fix: SKU otomatis
  const existing = await j(await api("products?select=sku,variants(sku,barcode)&limit=2000"));
  const taken = takenCodes(existing);
  const skuP = ensureProductSku("", taken); taken.add(skuP);
  const filled = fillVariantSkus([{ sku: "", name: "A" }, { sku: "", name: "B" }], taken);
  const p2 = await newProduct("baru", skuP);
  const r2 = await api("variants", { method: "POST", body: JSON.stringify(filled.map((v) => varRow(p2.id, v))) });
  check("I4a fix: 2 varian SKU kosong + SKU otomatis → tersimpan (201)", r2.status === 201, `status ${r2.status}`);
  const got = await j(await api(`variants?select=sku&product_id=eq.${p2.id}`));
  check("I4b dua varian punya SKU 8 digit berbeda", got.length === 2 && got.every((v) => /^\d{8}$/.test(v.sku)) && got[0].sku !== got[1].sku, got.map((v) => v.sku).join(", "));
  const scan = await j(await api(`variants?select=product_id&or=(sku.eq.${got[0].sku},barcode.eq.${got[0].sku})`));
  check("I4c kode dapat dicari persis (jalur scan) → tepat 1 varian", scan.length === 1 && scan[0].product_id === p2.id);

  // I5 SKU kembar yang diisi manual
  const p3 = await newProduct("kembar", ensureProductSku("TES-E16-P3", taken));
  const fixed = fillVariantSkus([{ sku: "TES-E16-DUP", name: "A" }, { sku: "TES-E16-DUP", name: "B" }], taken);
  const r3 = await api("variants", { method: "POST", body: JSON.stringify(fixed.map((v) => varRow(p3.id, v))) });
  check("I5 SKU kembar manual → setelah fillVariantSkus tersimpan", r3.status === 201 && fixed[0].sku === "TES-E16-DUP" && fixed[1].sku !== "TES-E16-DUP", `status ${r3.status}`);
} finally {
  // cleanup: hapus semua produk TES-E16 (varian ikut lewat CASCADE)
  await api("products?name=like.TES-E16*", { method: "DELETE" });
  const rp = await j(await api("products?select=id&name=like.TES-E16*"));
  const rv = await j(await api("variants?select=id&sku=like.TES-E16*"));
  check("CLEANUP sisa produk TES-E16 = 0", rp.length === 0, `sisa ${rp.length}`);
  check("CLEANUP sisa varian TES-E16 = 0", rv.length === 0, `sisa ${rv.length}`);
  console.log(`\nHASIL: ${pass} PASS, ${fail} FAIL`);
  process.exitCode = fail ? 1 : 0;
}
