"use client";

import { useState } from "react";
import { useData, type Role, type Staff } from "@/store/data";

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
    setEditing(s);
    setAdding(false);
  }
  function save() {
    if (!form.name || !form.pin) return;
    if (editing) updateStaff(editing.id, { name: form.name, pin: form.pin, role: form.role, phone: form.phone, active: form.active });
    else addStaff({ name: form.name, pin: form.pin, role: form.role, phone: form.phone, active: form.active });
    setAdding(false);
    setEditing(null);
  }

  const roleLabel: Record<Role, string> = { admin: "Admin", manager: "Manager", cashier: "Kasir" };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Staff & Peran</h1>
        <button onClick={openAdd} className="rounded-lg bg-apricot px-3 py-2 text-sm font-bold text-white">+ Staff</button>
      </div>

      <div className="space-y-3">
        {staff.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow">
            <div>
              <div className="font-bold">{s.name} {!s.active && <span className="rounded bg-gray-200 px-1.5 text-xs text-gray-600">Nonaktif</span>}</div>
              <div className="text-xs text-gray-500">PIN {s.pin} · {s.phone ?? "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-beige px-2 py-1 text-xs text-olive">{roleLabel[s.role]}</span>
              <button onClick={() => openEdit(s)} className="rounded bg-apricot px-2 py-1 text-xs text-white">Edit</button>
              <button onClick={() => deleteStaff(s.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">Hapus</button>
            </div>
          </div>
        ))}
      </div>

      {(adding || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[380px] max-w-full rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">{editing ? "Edit Staff" : "Tambah Staff"}</h3>
              <button onClick={() => { setAdding(false); setEditing(null); }} className="text-gray-400">✕</button>
            </div>
            <div className="space-y-2">
              <input className="inp" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="inp" placeholder="PIN (4-6 digit)" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
              <select className="inp" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="cashier">Kasir</option>
              </select>
              <input className="inp" placeholder="Telepon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Aktif
              </label>
            </div>
            <button onClick={save} className="mt-3 w-full rounded-lg bg-olive py-2 font-bold text-beige">Simpan</button>
          </div>
        </div>
      )}
    </div>
  );
}
