import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const staffEmail = (staffId: string) => `staff-${staffId}@kebayaoma.local`;

const ROLE_RE = /^(admin|manager|cashier)$/;
const PIN_RE = /^\d{4,6}$/;

async function requireAdmin(req: NextRequest): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return { ok: false, res: NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 }) };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { ok: false, res: NextResponse.json({ error: "Session tidak valid" }, { status: 401 }) };

  const { data: staff } = await admin
    .from("staff")
    .select("id, role, active, store_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!staff || !staff.active || staff.role !== "admin") {
    return { ok: false, res: NextResponse.json({ error: "Hanya admin yang bisa mengelola staff" }, { status: 403 }) };
  }

  return { ok: true, userId: data.user.id };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const storeId = process.env.NEXT_PUBLIC_STORE_ID;

  switch (body.action) {
    case "create": {
      const { name, pin, role, phone, active } = body;
      if (!name?.trim()) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
      if (!PIN_RE.test(String(pin ?? ""))) return NextResponse.json({ error: "PIN harus 4-6 digit" }, { status: 400 });
      if (!ROLE_RE.test(String(role ?? ""))) return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });

      const { data: staff, error: insErr } = await admin
        .from("staff")
        .insert({ store_id: storeId, name: name.trim(), role, phone: phone || null, active: active !== false })
        .select("id")
        .single();
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

      const { data: user, error: userErr } = await admin.auth.admin.createUser({
        email: staffEmail(staff.id),
        password: String(pin),
        email_confirm: true,
        user_metadata: { staff_id: staff.id, store_id: storeId, role, name: name.trim() },
      });
      if (userErr) {
        await admin.from("staff").delete().eq("id", staff.id);
        return NextResponse.json({ error: userErr.message }, { status: 500 });
      }

      const { error: linkErr } = await admin.from("staff").update({ user_id: user.user.id }).eq("id", staff.id);
      if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

      return NextResponse.json({ ok: true, id: staff.id });
    }

    case "update": {
      const { id, name, pin, role, phone, active } = body;
      if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

      const { data: existing, error: findErr } = await admin
        .from("staff")
        .select("id, user_id")
        .eq("id", id)
        .maybeSingle();
      if (findErr || !existing) return NextResponse.json({ error: "Staff tidak ditemukan" }, { status: 404 });

      const patch: Record<string, any> = {};
      if (name !== undefined) {
        if (!String(name).trim()) return NextResponse.json({ error: "Nama tidak boleh kosong" }, { status: 400 });
        patch.name = String(name).trim();
      }
      if (role !== undefined) {
        if (!ROLE_RE.test(String(role))) return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
        patch.role = role;
      }
      if (phone !== undefined) patch.phone = phone || null;
      if (active !== undefined) patch.active = active !== false;

      if (Object.keys(patch).length) {
        const { error: updErr } = await admin.from("staff").update(patch).eq("id", id);
        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      if (pin !== undefined && pin !== "" && existing.user_id) {
        if (!PIN_RE.test(String(pin))) return NextResponse.json({ error: "PIN harus 4-6 digit" }, { status: 400 });
        const { error: pwdErr } = await admin.auth.admin.updateUserById(existing.user_id, { password: String(pin) });
        if (pwdErr) return NextResponse.json({ error: pwdErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    case "delete": {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

      const { data: existing, error: findErr } = await admin
        .from("staff")
        .select("id, user_id")
        .eq("id", id)
        .maybeSingle();
      if (findErr || !existing) return NextResponse.json({ error: "Staff tidak ditemukan" }, { status: 404 });

      if (existing.user_id) {
        const { error: delUserErr } = await admin.auth.admin.deleteUser(existing.user_id);
        if (delUserErr) return NextResponse.json({ error: delUserErr.message }, { status: 500 });
      }

      const { error: delErr } = await admin.from("staff").delete().eq("id", id);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: `Aksi tidak dikenal: ${body.action}` }, { status: 400 });
  }
}
