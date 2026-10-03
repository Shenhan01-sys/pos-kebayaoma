// scripts/test-e21-proof-lazy.mjs — E21 langkah 1 (READ-ONLY, tanpa artefak): daftar transaksi tidak lagi mengunduh foto bukti.
// Meniru query store/data.ts fetchTransactions (kolom eksplisit tanpa photo_proof + id penanda foto) vs query lama (`*`)
// pada DB produksi dengan service role (baca saja; tidak ada tulis → tak ada artefak TES-).
//  Z1 query baru valid (tak ada kolom salah) · Z2 payload turun drastis vs `select *` · Z3 penanda foto == baris ber-foto
//  Z4 fetchPhotoProof (select photo_proof by id) mengembalikan isi yang sama dgn query lama
//  Z5 mapTransactionRow(baris baru) == mapTransactionRow(baris lama) kecuali photoProof (daftar kolom eksplisit cukup)
// Jalankan: node --experimental-strip-types --no-warnings scripts/test-e21-proof-lazy.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { register } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
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
const { mapTransactionRow, mapTransactionItemRow } = await import("../lib/store-mappers.ts");

const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.split("=", 1)[0], l.slice(l.indexOf("=") + 1)])
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };
const get = async (path) => {
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: H });
  const text = await r.text();
  return { ok: r.ok, status: r.status, bytes: Buffer.byteLength(text), json: r.ok ? JSON.parse(text) : text };
};

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

const COLS = "id,number,store_id,cashier,customer_id,customer_name,status,payment_method,payment_status,subtotal,tax,discount,total,amount_paid,change,qris_ref,kind,due_date,dp_amount,dp_method,created_at";
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

const oldQ = await get("transactions?select=*,transaction_items(*)&order=created_at.desc&limit=200");
const newQ = await get(`transactions?select=${COLS},transaction_items(*)&order=created_at.desc&limit=200`);
const idsQ = await get("transactions?select=id&photo_proof=not.is.null&limit=1000");
check("Z1 query baru (kolom eksplisit + items) valid", newQ.ok && Array.isArray(newQ.json), `status ${newQ.status}`);
console.log(`(info) query lama ${kb(oldQ.bytes)} · query baru ${kb(newQ.bytes)} · penanda foto ${kb(idsQ.bytes)}`);
check("Z2 payload daftar turun ≥ 90% (query lama vs baru + penanda)", oldQ.ok && newQ.bytes + idsQ.bytes <= oldQ.bytes * 0.1,
  `${kb(oldQ.bytes)} → ${kb(newQ.bytes + idsQ.bytes)}`);

const withProofOld = new Set(oldQ.json.filter((t) => t.photo_proof != null).map((t) => t.id));
const idsSet = new Set((idsQ.json ?? []).map((r) => r.id));
const latest200 = new Set(oldQ.json.map((t) => t.id));
const inLatest = [...idsSet].filter((id) => latest200.has(id));
check("Z3 penanda foto == nota ber-foto pada 200 nota terbaru", inLatest.length === withProofOld.size && [...withProofOld].every((id) => idsSet.has(id)),
  `ber-foto ${withProofOld.size}, penanda ${inLatest.length}`);

const sample = oldQ.json.find((t) => t.photo_proof);
if (sample) {
  const one = await get(`transactions?select=photo_proof&id=eq.${sample.id}`);
  check("Z4 fetchPhotoProof (by id) mengembalikan foto yang sama dgn query lama", one.ok && one.json[0]?.photo_proof === sample.photo_proof, `${kb(one.bytes)}`);
} else {
  check("Z4 (dilewati: tak ada nota ber-foto)", true);
}

const strip = (t) => { const m = mapTransactionRow(t, (t.transaction_items ?? []).map(mapTransactionItemRow)); delete m.photoProof; return JSON.stringify(m); };
const oldMap = new Map(oldQ.json.map((t) => [t.id, strip(t)]));
const mismatch = newQ.json.filter((t) => strip(t) !== oldMap.get(t.id));
check("Z5 hasil mapping identik kecuali photoProof (kolom eksplisit cukup)", newQ.json.length === oldQ.json.length && mismatch.length === 0,
  `${newQ.json.length} nota, beda ${mismatch.length}`);

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
