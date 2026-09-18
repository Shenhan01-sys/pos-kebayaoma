import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/).filter(l => l.includes("=")).map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tes = (await sb.from("staff").select("id,name,user_id").ilike("name", "tes%")).data;
for (const s of tes) {
  const email = `staff-${s.id}@kebayaoma.local`;
  let ok = null;
  for (const p of ["111111", "222222", "333333", "123456"]) {
    const r = await anon.auth.signInWithPassword({ email, password: p });
    if (!r.error) { ok = p; await anon.auth.signOut(); break; }
  }
  if (!ok) { await sb.auth.admin.updateUserById(s.user_id, { password: "123456" }); ok = "123456(reset)"; }
  console.log(s.name, "PIN =", ok);
}
