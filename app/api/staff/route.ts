import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const staffEmail = (staffId: string) => `staff-${staffId}@kebayaoma.local`;

const ROLE_RE = /^(manager|staff)$/;
const PIN_RE = /^\d{6}$/; // Supabase Auth menolak password < 6 karakter

interface Caller {
  id: string;
  store_id: string | null; // NULL = manager lintas semua toko
  isAll: boolean;
}

async function requireAdmin(req: NextRequest): Promise<{ ok: true; caller: Caller } | { ok: false; res: NextResponse }> {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return { ok: false, res: NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 }) };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { ok: false, res: NextResponse.json({ error: "Session tidak valid" }, { status: 401 }) };

  const { data: staff } = await admin
    .from("staff")
    .select("id, role, active, store_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!staff || !staff.active || staff.role !== "manager") {
    return { ok: false, res: NextResponse.json({ error: "Hanya manager yang bisa mengelola staff" }, { status: 403 }) };
  }

  const storeId = (staff.store_id as string | null) ?? null;
  return { ok: true, caller: { id: staff.id as string, store_id: storeId, isAll: storeId === null } };
}

async function otherActiveManagerCount(storeId: string | null, excludeId: string): Promise<number> {
  // Manager lintas-toko (store NULL) meng-cover semua toko.
  let q = admin
    .from("staff")
    .select("id", { count: "exact", head: true })
    .eq("role", "manager")
    .eq("active", true)
    .neq("id", excludeId);
  q = storeId === null ? q.is("store_id", null) : q.or(`store_id.is.null,store_id.eq.${storeId}`);
  const { count } = await q;
  return count ?? 0;
}

function resolveTargetStore(
  caller: Caller,
  requested: unknown,
  role: string
): { ok: true; storeId: string | null } | { ok: false; res: NextResponse } {
  let storeId: string | null =
    requested === undefined || requested === null || requested === ""
      ? null
      : String(requested);
  if (role !== "manager" && !storeId) {
    // Kasir wajib terikat 1 toko; default ikut toko manager pembuat.
    if (!caller.isAll && caller.store_id) return { ok: true, storeId: caller.store_id };
    return { ok: false, res: NextResponse.json({ error: "Kasir wajib assigned ke toko (MJL/KTB)" }, { status: 400 }) };
  }
  if (!caller.isAll && storeId !== caller.store_id) {
    // Manager toko tidak bisa membuat/memindah staff ke toko lain.
    return { ok: false, res: NextResponse.json({ error: "Hanya bisa mengelola staff toko sendiri" }, { status: 403 }) };
  }
  if (role === "manager" && !storeId && !caller.isAll) {
    // Manager toko tidak bisa mengangkat manager lintas-toko.
    return { ok: false, res: NextResponse.json({ error: "Hanya manager lintas-toko yang bisa membuat manager lintas-toko" }, { status: 403 }) };
  }
  return { ok: true, storeId };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;

  const body: any = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });

  switch (body.action) {
    case "create": {
      const { name, pin, role, phone, active, store_id } = body;
      if (!name?.trim()) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
      if (!PIN_RE.test(String(pin ?? ""))) return NextResponse.json({ error: "PIN harus 6 digit angka" }, { status: 400 });
      if (!ROLE_RE.test(String(role ?? ""))) return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
      const target = resolveTargetStore(auth.caller, store_id, String(role));
      if (!target.ok) return target.res;
      const storeId = target.storeId;

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
      const { id, name, pin, role, phone, active, store_id } = body;
      if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

      let findQuery = admin
        .from("staff")
        .select("id, user_id, role, active, store_id")
        .eq("id", id);
      if (!auth.caller.isAll) findQuery = findQuery.eq("store_id", auth.caller.store_id as string);
      const { data: existing, error: findErr } = await findQuery.maybeSingle();
      if (findErr || !existing) return NextResponse.json({ error: "Staff tidak ditemukan" }, { status: 404 });

      const demoteSelf =
        existing.id === auth.caller.id &&
        ((role !== undefined && role !== "manager") || active === false);
      if (demoteSelf) {
        return NextResponse.json({ error: "Tidak bisa menurunkan/menonaktifkan akun sendiri" }, { status: 400 });
      }

      const removingManager =
        existing.role === "manager" &&
        existing.active &&
        ((role !== undefined && role !== "manager") || active === false);
      if (removingManager && (await otherActiveManagerCount((existing.store_id as string | null) ?? null, existing.id)) === 0) {
        return NextResponse.json({ error: "Tidak bisa menonaktifkan/menurunkan manager terakhir" }, { status: 400 });
      }

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
      if (store_id !== undefined) {
        const nextRole = (role !== undefined ? String(role) : existing.role) as string;
        const target = resolveTargetStore(auth.caller, store_id, nextRole);
        if (!target.ok) return target.res;
        patch.store_id = target.storeId;
      }

      if (Object.keys(patch).length) {
        const { error: updErr } = await admin.from("staff").update(patch).eq("id", id);
        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      if (pin !== undefined && pin !== "" && existing.user_id) {
        if (!PIN_RE.test(String(pin))) return NextResponse.json({ error: "PIN harus 6 digit angka" }, { status: 400 });
        const { error: pwdErr } = await admin.auth.admin.updateUserById(existing.user_id, { password: String(pin) });
        if (pwdErr) return NextResponse.json({ error: pwdErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    case "delete": {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

      let delQuery = admin
        .from("staff")
        .select("id, user_id, role, active, store_id")
        .eq("id", id);
      if (!auth.caller.isAll) delQuery = delQuery.eq("store_id", auth.caller.store_id as string);
      const { data: existing, error: findErr } = await delQuery.maybeSingle();
      if (findErr || !existing) return NextResponse.json({ error: "Staff tidak ditemukan" }, { status: 404 });

      if (existing.id === auth.caller.id) {
        return NextResponse.json({ error: "Tidak bisa menghapus akun sendiri" }, { status: 400 });
      }
      if (
        existing.role === "manager" &&
        existing.active &&
        (await otherActiveManagerCount((existing.store_id as string | null) ?? null, existing.id)) === 0
      ) {
        return NextResponse.json({ error: "Tidak bisa menghapus manager terakhir" }, { status: 400 });
      }

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
