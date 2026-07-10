"use client";

import { useState } from "react";
import { useData } from "@/store/data";
import { getAllTransactions } from "@/store/cart";
import { formatRupiah, type Customer } from "@/lib/dummy";
import { Icon } from "@/components/icons";

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

  const initials = (n: string) =>
    n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Pelanggan</h1>
        <button onClick={openAdd} className="btn-primary">
          <Icon name="plus" size={16} /> Pelanggan
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {customers.map((c) => {
          const txs = getAllTransactions([]).filter((t) => t.customerName === c.name && t.status === "paid");
          return (
            <div key={c.id} className="card card-pad">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="avatar h-10 w-10 bg-grad-olive">{initials(c.name)}</span>
                  <div className="min-w-0">
                    <div className="truncate font-bold text-ink">{c.name}</div>
                    <div className="text-xs text-gray-600">{c.phone}</div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => setHistory(c)} className="btn-ghost px-2.5 py-1 text-xs">Riwayat</button>
                  <button onClick={() => openEdit(c)} className="btn-primary px-2.5 py-1 text-xs">Edit</button>
                  <button onClick={() => deleteCustomer(c.id)} className="btn-danger px-2.5 py-1 text-xs">Hapus</button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-beige/60 px-3 py-2 text-sm">
                <span className="text-gray-600">Total belanja</span>
                <b className="tnum text-olive">{formatRupiah(c.totalPurchases + txs.reduce((s, t) => s + t.total, 0))}</b>
              </div>
              <div className="mt-1 text-right text-xs text-gray-600">
                {txs.length} transaksi
              </div>
            </div>
          );
        })}
      </div>

      {(adding || editing) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-[420px] rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">{editing ? "Edit Pelanggan" : "Tambah Pelanggan"}</h3>
              <button onClick={() => { setAdding(false); setEditing(null); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-600">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="space-y-2">
              <input className="input" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="Telepon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <button onClick={save} className="btn-violet mt-3 w-full py-3">Simpan</button>
          </div>
        </div>
      )}

      {history && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-[420px] rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">Riwayat: {history.name}</h3>
              <button onClick={() => setHistory(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-600">
                <Icon name="close" size={16} />
              </button>
            </div>
            <ul className="max-h-80 space-y-1 overflow-auto text-sm pretty-scroll">
              {getAllTransactions([]).filter((t) => t.customerName === history.name).map((t) => (
                <li key={t.id} className="flex justify-between border-b border-black/5 py-2">
                  <span className="font-mono text-xs text-gray-600">
                    {t.number}
                    <br />
                    <span className="text-xs text-gray-600">{new Date(t.createdAt).toLocaleDateString("id-ID")}</span>
                  </span>
                  <span className="font-semibold tnum text-ink">{formatRupiah(t.total)}</span>
                </li>
              ))}
              {getAllTransactions([]).filter((t) => t.customerName === history.name).length === 0 && (
                <li className="py-4 text-center text-gray-600">Belum ada transaksi.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
