// E8: apply migrasi expenses ke prod (DDL via supabase-js rpc exec tidak ada →
// pakai pg langsung bila ada, else tampilkan SQL utk SQL editor). Idempotent.
const { readFileSync } = require("fs");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const sql = readFileSync("supabase/migrations/20260919_expenses.sql", "utf8");

(async () => {
  // Cek apakah tabel sudah ada (idempotent) + coba DDL via postgrest-pg? PostgREST tidak bisa DDL.
  // Gunakan koneksi pooler bila tersedia (SUPABASE_DB_URL), else pandu manual.
  const dbUrl = env.SUPABASE_DB_URL || env.DATABASE_URL;
  if (!dbUrl) {
    console.log("NO_DB_URL: jalankan SQL berikut via Supabase SQL editor:\n");
    console.log(sql);
    process.exit(2);
  }
  const { Client } = require("pg");
  const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(sql);
  const { rows } = await c.query(
    "select count(*)::int as n from pg_policies where tablename='expenses'"
  );
  const t = await c.query(
    "select column_name from information_schema.columns where table_name='expenses' order by ordinal_position"
  );
  console.log("OK policies:", rows[0].n, "columns:", t.rows.map((r) => r.column_name).join(","));
  await c.end();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
