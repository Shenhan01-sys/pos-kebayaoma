"use client";

import { useState } from "react";
import { useData } from "@/store/data";
import { getAllTransactions } from "@/store/cart";
import { formatRupiah, type Customer } from "@/lib/dummy";

export default function CustomersPage() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useData();
  const [editing, setEditing] = useState<Customer | null>(null);
  const [adding, setAdding] = useState(false);
  const [history, setHistory] = useState<Customer | null>(null);

  const blank = { name: "", phone: "", email: "", address: "", birthday: "", notes: "", tags: [] as string[], totalPurchases: 0, visitCount: 0 };
  const [form, setForm] = useState({ ...blank });

  function openAdd() {
    setForm({ ...blank });
    setAdding(true);
    setEditing(null);
  }
  function openEdit(c: Customer) {
    setForm({ name: c.name, phone: c.phone, email: "", address: "", birthday: "", notes: "", tags: [], totalPurchases: c.totalPurchases, visitCount: c.visitCount });
    setEditing(c);
    setAdding(false);
  }
  function save() {
    if (!form.name) return;
    if (editing) updateCustomer(editing.id, { name: form.name, phone: form.phone });
    else addCustomer({ name: form.name, phone: form.phone, totalPurchases: 0, visitCount: 0 });
    setAdding(false);
    setEditing(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pelanggan</h1>
        <button onClick={openAdd} className="rounded-lg bg-apricot px-3 py-2 text-sm font-bold text-white">+ Pelanggan</button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {customers.map((c) => {
          const txs = getAllTransactions([]).filter((t) => t.customerName === c.name && t.status === "paid");
          return (
            <div key={c.id} className="rounded-xl bg-white p-4 shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.phone}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setHistory(c)} className="rounded bg-beige px-2 py-1 text-xs">Riwayat</button>
                  <button onClick={() => openEdit(c)} className="rounded bg-apricot px-2 py-1 text-xs text-white">Edit</button>
                  <button onClick={() => deleteCustomer(c.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">Hapus</button>
                </div>
              </div>
              <div className="mt-2 text-sm">
                <div>Total belanja: <b>{formatRupiah(c.totalPurchases + txs.reduce((s, t) => s + t.total, 0))}</b></div>
                <div className="text-gray-500">Transaksi: {txs.length}</div>
              </div>
            </div>
          );
        })}
      </div>

      {(adding || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[420px] max-w-full rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">{editing ? "Edit Pelanggan" : "Tambah Pelanggan"}</h3>
              <button onClick={() => { setAdding(false); setEditing(null); }} className="text-gray-400">✕</button>
            </div>
            <div className="space-y-2">
              <input className="inp" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="inp" placeholder="Telepon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <button onClick={save} className="mt-3 w-full rounded-lg bg-olive py-2 font-bold text-beige">Simpan</button>
          </div>
        </div>
      )}

      {history && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[420px] max-w-full rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">Riwayat: {history.name}</h3>
              <button onClick={() => setHistory(null)} className="text-gray-400">✕</button>
            </div>
            <ul className="max-h-80 space-y-1 overflow-auto text-sm">
              {getAllTransactions([]).filter((t) => t.customerName === history.name).map((t) => (
                <li key={t.id} className="flex justify-between border-b py-1">
                  <span>{t.number}<br /><span className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleDateString("id-ID")}</span></span>
                  <span className="font-semibold">{formatRupiah(t.total)}</span>
                </li>
              ))}
              {getAllTransactions([]).filter((t) => t.customerName === history.name).length === 0 && (
                <li className="text-gray-400">Belum ada transaksi.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
