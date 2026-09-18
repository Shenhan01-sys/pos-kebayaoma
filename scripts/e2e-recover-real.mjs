import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/).filter(l => l.includes("=")).map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const real = (await sb.from("staff").select("id,name,role,user_id,active").order("name")).data.filter(x => !x.name.startsWith("TES"));
console.log("REAL STAFF:", JSON.stringify(real, null, 1));
const tempPins = real.map((s, i) => ({ ...s, pin: String(111111 + i * 111111).slice(0, 6) }));
for (const s of tempPins) {
  if (s.user_id) {
    const exists = (await sb.auth.admin.listUsers()).data;
    const u = (exists.users?.users || exists.users || []).find((x) => x.id === s.user_id);
    if (u) { console.log(s.name, "user masih ada — skip"); continue; }
  }
  const { data, error } = await sb.auth.admin.createUser({ email: `staff-${s.id}@kebayaoma.local`, password: s.pin, email_confirm: true });
  if (error) { console.log(s.name, "ERR", error.message); continue; }
  await sb.from("staff").update({ user_id: data.user?.id }).eq("id", s.id);
  console.log(s.name, "RECREATED", { auth: data.user?.id, pin: s.pin });
}
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
for (const s of tempPins) {
  const r = await anon.auth.signInWithPassword({ email: `staff-${s.id}@kebayaoma.local`, password: s.pin });
  console.log("signin", s.name, r.error ? r.error.message : "OK");
}
