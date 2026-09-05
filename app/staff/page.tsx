"use client";

import { useState, useEffect } from "react";
import { useData, type Role, type Staff } from "@/store/data";
import { useAuth } from "@/store/auth";
import { Icon } from "@/components/icons";

export default function StaffPage() {
  const { staff, addStaff, updateStaff, deleteStaff } = useData();
  const auth = useAuth();
  const isManager = auth.staff?.role === "manager";
  const [editing, setEditing] = useState<Staff | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", pin: "", role: "staff" as Role, phone: "", active: true });
  const [pinError, setPinError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  function openAdd() {
    setForm({ name: "", pin: "", role: "staff", phone: "", active: true });
    setAdding(true);
    setEditing(null);
    setPinError(null);
    setModalError(null);
  }
  function openEdit(s: Staff) {
    setForm({ name: s.name, pin: "", role: s.role, phone: s.phone ?? "", active: s.active });
    setAdding(false);
    setEditing(s);
    setPinError(null);
    setModalError(null);
  }

  const managerCount = staff.filter((s) => s.role === "manager" && s.active).length;

  async function save() {
    if (!form.name) return;
    setModalError(null);

    if (editing) {
      if (form.pin && form.pin.length !== 6) {
        setPinError("PIN harus 6 digit angka");
        return;
      }
      setPinError(null);

      if (editing.role === "manager" && editing.active && (form.role !== "manager" || !form.active) && managerCount <= 1) {
        setModalError("Tidak ada manager lain yang aktif. Tidak bisa menonaktifkan/menurunkan manager terakhir.");
        return;
      }

      setBusy(true);
      try {
        if (!form.pin) {
          const { pin: _pin, ...rest } = form;
          await updateStaff(editing.id, rest);
        } else {
          await updateStaff(editing.id, form);
        }
        setAdding(false);
        setEditing(null);
      } catch (err: any) {
        setModalError(err?.message || "Gagal menyimpan");
      } finally {
        setBusy(false);
      }
    } else {
      if (!form.pin || form.pin.length !== 6) {
        setPinError("PIN harus 6 digit angka");
        return;
      }
      setPinError(null);
      setBusy(true);
      try {
        await addStaff(form);
        setAdding(false);
      } catch (err: any) {
        setModalError(err?.message || "Gagal menambah staff");
      } finally {
        setBusy(false);
      }
    }
  }

  async function remove(s: Staff) {
    if (auth.staff?.id === s.id) {
      alert("Tidak bisa menghapus akun sendiri.");
      return;
    }
    if (s.role === "manager" && managerCount <= 1) {
      alert("Tidak bisa menghapus manager terakhir. Tambahkan manager lain dulu.");
      return;
    }
    if (!confirm(`Hapus ${s.name}? Akun login staff ini juga akan dihapus.`)) return;
    setBusy(true);
    try {
      await deleteStaff(s.id);
    } catch (err: any) {
      alert(err?.message || "Gagal menghapus staff");
    } finally {
      setBusy(false);
    }
  }

  function closeModal() {
    setAdding(false);
    setEditing(null);
    setPinError(null);
    setModalError(null);
  }

  useEffect(() => {
    if (!adding && !editing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adding, editing]);

  const roleLabel: Record<Role, string> = { manager: "Manager", staff: "Staff" };
  const rolePill: Record<Role, string> = {
    manager: "pill-violet",
    staff: "pill-muted",
  };
  const initials = (n: string) =>
    n.split(" ").filter(Boolean).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Staff & Peran</h1>
        {isManager && (
          <button onClick={openAdd} className="btn-primary">
            <Icon name="plus" size={16} /> Staff
          </button>
        )}
      </div>

      {!isManager && (
        <div className="mb-4 rounded-2xl bg-apricot/15 px-4 py-3 text-sm text-ink">
          Hanya manager yang bisa menambah, mengubah, atau menghapus staff.
        </div>
      )}

      {staff.length === 0 ? (
        <div className="card card-pad py-12 text-center">
          <p className="text-gray-600">Belum ada staff. Klik &ldquo;Staff&rdquo; untuk menambahkan.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((s) => (
            <div key={s.id} className="card card-pad flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="avatar h-10 w-10 bg-grad-violet">{initials(s.name)}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-bold text-ink">
                    <span className="truncate">{s.name}</span>
                    {!s.active && <span className="pill-muted">Nonaktif</span>}
                    {auth.staff?.id === s.id && <span className="pill-muted">Anda</span>}
                  </div>
                  <div className="text-xs text-gray-600">PIN tersimpan · {s.phone ?? "—"}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className={`pill ${rolePill[s.role]}`}>{roleLabel[s.role]}</span>
                {isManager && (
                  <>
                    <button onClick={() => openEdit(s)} className="btn-primary px-2.5 py-1 text-xs">Edit</button>
                    <button onClick={() => remove(s)} disabled={busy} className="btn-danger px-2.5 py-1 text-xs">Hapus</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(adding || editing) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={closeModal}>
          <div className="w-full max-w-[380px] rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">{editing ? "Edit Staff" : "Tambah Staff"}</h3>
              <button onClick={closeModal} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-600" aria-label="Tutup">
                <Icon name="close" size={16} />
              </button>
            </div>
            {modalError && (
              <div className="mb-2 rounded-2xl bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{modalError}</div>
            )}
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Nama</span>
                <input className="input" placeholder="Nama lengkap" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">
                  {editing ? "PIN baru (6 digit, kosongkan jika tetap)" : "PIN (6 digit)"}
                </span>
                <input className="input" type="password" inputMode="numeric" maxLength={6} placeholder={editing ? "Kosongkan jika tetap" : "6 digit"} value={form.pin} onChange={(e) => { setForm({ ...form, pin: e.target.value.replace(/\D/g, "") }); setPinError(null); }} />
              </label>
              {pinError && <div className="text-xs font-semibold text-danger">{pinError}</div>}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Peran</span>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                  <option value="manager">Manager</option>
                  <option value="staff">Staff</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Telepon</span>
                <input className="input" placeholder="08xx-xxxx-xxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 rounded-2xl bg-beige/60 px-3 py-2.5 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Aktif
              </label>
            </div>
            <button onClick={save} disabled={busy} className="btn-violet mt-3 w-full py-3 disabled:opacity-50">
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
