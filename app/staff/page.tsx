"use client";

import { useState } from "react";
import { useData, type Role, type Staff } from "@/store/data";
import { Icon } from "@/components/icons";

export default function StaffPage() {
  const { staff, addStaff, updateStaff, deleteStaff } = useData();
  const [editing, setEditing] = useState<Staff | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", pin: "", role: "cashier" as Role, phone: "", active: true });

  function openAdd() {
    setForm({ name: "", pin: "", role: "cashier", phone: "", active: true });
    setAdding(true);
    setEditing(null);
  }
  function openEdit(s: Staff) {
    setForm({ name: s.name, pin: s.pin, role: s.role, phone: s.phone ?? "", active: s.active });
    setAdding(false);
    setEditing(s);
  }
  function save() {
    if (!form.name || !form.pin) return;
    if (editing) updateStaff(editing.id, { name: form.name, pin: form.pin, role: form.role, phone: form.phone, active: form.active });
    else addStaff({ name: form.name, pin: form.pin, role: form.role, phone: form.phone, active: form.active });
    setAdding(false);
    setEditing(null);
  }

  const roleLabel: Record<Role, string> = { admin: "Admin", manager: "Manager", cashier: "Kasir" };
  const rolePill: Record<Role, string> = {
    admin: "pill-violet",
    manager: "pill-apricot",
    cashier: "pill-muted",
  };
  const initials = (n: string) =>
    n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Staff & Peran</h1>
        <button onClick={openAdd} className="btn-primary">
          <Icon name="plus" size={16} /> Staff
        </button>
      </div>

      <div className="space-y-3">
        {staff.map((s) => (
          <div key={s.id} className="card card-pad flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <span className="avatar h-10 w-10 bg-grad-violet">{initials(s.name)}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-bold text-ink">
                  <span className="truncate">{s.name}</span>
                  {!s.active && <span className="pill-muted">Nonaktif</span>}
                </div>
                <div className="text-xs text-gray-600">PIN {s.pin} · {s.phone ?? "—"}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className={`pill ${rolePill[s.role]}`}>{roleLabel[s.role]}</span>
              <button onClick={() => openEdit(s)} className="btn-primary px-2.5 py-1 text-xs">Edit</button>
              <button onClick={() => deleteStaff(s.id)} className="btn-danger px-2.5 py-1 text-xs">Hapus</button>
            </div>
          </div>
        ))}
      </div>

      {(adding || editing) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-[380px] rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">{editing ? "Edit Staff" : "Tambah Staff"}</h3>
              <button onClick={() => { setAdding(false); setEditing(null); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-600">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="space-y-2">
              <input className="input" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="PIN (4-6 digit)" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="cashier">Kasir</option>
              </select>
              <input className="input" placeholder="Telepon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <label className="flex items-center gap-2 rounded-2xl bg-beige/60 px-3 py-2.5 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Aktif
              </label>
            </div>
            <button onClick={save} className="btn-violet mt-3 w-full py-3">Simpan</button>
          </div>
        </div>
      )}
    </div>
  );
}
