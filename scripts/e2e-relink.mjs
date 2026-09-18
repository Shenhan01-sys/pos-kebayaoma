import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/).filter(l => l.includes("=")).map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await sb.auth.admin.listUsers();
const list = data.users?.users || data.users || [];
const tes = (await sb.from("staff").select("id,name,role,user_id").ilike("name","tes%")).data;
for (const s of tes) {
  const email = `staff-${s.id}@kebayaoma.local`;
  let u = list.find((x) => x.email === email);
  if (!u && s.user_id) u = list.find((x) => x.id === s.user_id);
  if (!u) {
    const { data: c, error } = await sb.auth.admin.createUser({ email, password: "123456", email_confirm: true });
    if (error) { console.log("create err", s.name, error.message); continue; }
    u = c.user;
  }
  if (u.email !== email) await sb.auth.admin.updateUserById(u.id, { email });
  await sb.from("staff").update({ user_id: u.id }).eq("id", s.id);
  console.log(s.name, "->", u.id, email);
}

