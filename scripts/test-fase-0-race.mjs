// scripts/test-fase-0-race.mjs — AC-E2a#1: 20 panggilan adjust_stock(-1) paralel.
// Pra-kondisi: produk 'TES-RACE' stok=100 ada di DB. Jalankan: node scripts/test-fase-0-race.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.split("=", 1)[0], l.slice(l.indexOf("=") + 1)])
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const prod = await (await fetch(`${url}/rest/v1/products?select=id,store_id,stock&sku=eq.TES-RACE`, { headers: H })).json();
const p = prod[0];
if (!p) { console.error("produk TES-RACE tidak ada"); process.exit(1); }
console.log("stok awal:", p.stock);

const results = await Promise.all(
  Array.from({ length: 20 }, () =>
    fetch(`${url}/rest/v1/rpc/adjust_stock`, {
      method: "POST", headers: H,
      body: JSON.stringify({ p_product: p.id, p_store: p.store_id, p_delta: -1, p_type: "adjustment", p_staff: "TES-RACE" }),
    })
  )
);
const ok = results.filter((r) => r.ok).length;

const final = await (await fetch(`${url}/rest/v1/products?select=stock&id=eq.${p.id}`, { headers: H })).json();
const mv = await (await fetch(`${url}/rest/v1/stock_movements?select=quantity&staff=eq.TES-RACE`, { headers: H })).json();
const mvSum = mv.reduce((a, m) => a + m.quantity, 0);

const expected = p.stock - 20;
console.log(`sukses: ${ok}/20 | stok akhir: ${final[0].stock} (harus ${expected}) | movement: ${mv.length} baris, sum ${mvSum}`);
console.log(ok === 20 && final[0].stock === expected && mv.length === 20 && mvSum === -20
  ? "PASS AC-E2a#1" : "FAIL AC-E2a#1");
