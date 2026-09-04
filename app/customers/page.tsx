"use client";

import { useState, useEffect } from "react";
import { useData } from "@/store/data";
import { getAllTransactions } from "@/store/cart";
import { transactions as dummyTx, formatRupiah, type Customer } from "@/lib/dummy";
import { Icon } from "@/components/icons";

export default function CustomersPage() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useData();
  const [editing, setEditing] = useState<Customer | null>(null);
  const [adding, setAdding] = useState(false);
  const [history, setHistory] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const blank = { name: "", phone: "", email: "", address: "", birthday: "", notes: "", tags: [] as string[], totalPurchases: 0, visitCount: 0 };
  const [form, setForm] = useState({ ...blank });

  function openAdd() {
    setForm({ ...blank });
    setAdding(true);
    setEditing(null);
    setModalError(null);
  }
  function openEdit(c: Customer) {
    setForm({
      name: c.name, phone: c.phone, email: c.email ?? "", address: c.address ?? "",
      birthday: c.birthday ?? "", notes: c.notes ?? "", tags: c.tags ?? [],
      totalPurchases: c.totalPurchases, visitCount: c.visitCount,
    });
    setEditing(c);
    setAdding(false);
    setModalError(null);
  }
  async function save() {
    if (!form.name) return;
    setModalError(null);
    setBusy(true);
    try {
      const payload = {
        name: form.name, phone: form.phone, email: form.email, address: form.address,
        birthday: form.birthday, notes: form.notes,
        tags: form.tags.map((t) => t.trim()).filter(Boolean),
      };
      if (editing) await updateCustomer(editing.id, payload);
      else await addCustomer({ ...payload, totalPurchases: 0, visitCount: 0 });
      setAdding(false);
      setEditing(null);
    } catch (err: any) {
      setModalError(err?.message || "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }
  async function remove(c: Customer) {
    if (!confirm(`Hapus pelanggan "${c.name}"? Riwayat transaksi tetap tersimpan.`)) return;
    setBusy(true);
    try {
      await deleteCustomer(c.id);
    } catch (err: any) {
      alert(err?.message || "Gagal menghapus");
    } finally {
      setBusy(false);
    }
  }

  function closeModal() {
    setAdding(false);
    setEditing(null);
    setModalError(null);
  }

  useEffect(() => {
    if (!adding && !editing && !history) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeModal();
        setHistory(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adding, editing, history]);

  const initials = (n: string) =>
    n.split(" ").filter(Boolean).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();

  const allTx = getAllTransactions(dummyTx);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Pelanggan</h1>
        <button onClick={openAdd} className="btn-primary">
          <Icon name="plus" size={16} /> Pelanggan
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="card card-pad py-12 text-center">
          <p className="text-gray-600">Belum ada pelanggan. Klik &ldquo;Pelanggan&rdquo; untuk menambahkan.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => {
            const txs = allTx.filter((t) => t.customerName === c.name && t.status === "paid");
            const total = txs.reduce((s, t) => s + t.total, 0);
            return (
              <div key={c.id} className="card card-pad">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="avatar h-10 w-10 bg-grad-olive">{initials(c.name)}</span>
                    <div className="min-w-0">
                      <div className="truncate font-bold text-ink">{c.name}</div>
                      <div className="text-xs text-gray-600">{c.phone}{c.email ? ` · ${c.email}` : ""}</div>
                      {c.tags && c.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.tags.map((t, i) => <span key={`${t}-${i}`} className="pill-muted text-[10px]">{t}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => setHistory(c)} className="btn-ghost px-2.5 py-1 text-xs">Riwayat</button>
                    <button onClick={() => openEdit(c)} className="btn-primary px-2.5 py-1 text-xs">Edit</button>
                    <button onClick={() => remove(c)} disabled={busy} className="btn-danger px-2.5 py-1 text-xs">Hapus</button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-beige/60 px-3 py-2 text-sm">
                  <span className="text-gray-600">Total belanja</span>
                  <b className="tnum text-olive">{formatRupiah(total)}</b>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
                  <span>{txs.length} transaksi</span>
                  {c.visitCount > 0 && <span>{c.visitCount}× kunjungan</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(adding || editing) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={closeModal}>
          <div className="w-full max-w-[420px] rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">{editing ? "Edit Pelanggan" : "Tambah Pelanggan"}</h3>
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
                <span className="mb-1 block text-xs font-medium text-gray-600">Telepon</span>
                <input className="input" placeholder="08xx-xxxx-xxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Email</span>
                <input className="input" placeholder="email@contoh.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Alamat</span>
                <input className="input" placeholder="Alamat" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Tanggal lahir</span>
                <input className="input" type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
              </label>
              <div>
                <span className="mb-1 block text-xs font-medium text-gray-600">Tag</span>
                <div className="flex flex-wrap gap-1.5">
                  {form.tags.map((t, idx) => (
                    <span key={`${t}-${idx}`} className="pill-muted flex items-center gap-1 text-xs">
                      {t}
                      <button onClick={() => setForm({ ...form, tags: form.tags.filter((_, i) => i !== idx) })} className="text-gray-500 hover:text-danger">✕</button>
                    </span>
                  ))}
                </div>
                <input
                  className="input mt-1"
                  placeholder="Tambah tag (Enter untuk simpan)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && !form.tags.includes(val)) {
                        setForm({ ...form, tags: [...form.tags, val] });
                      }
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Catatan</span>
                <textarea className="input" rows={2} placeholder="Catatan" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
            </div>
            <button onClick={save} disabled={busy} className="btn-violet mt-3 w-full py-3 disabled:opacity-50">
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </div>
      )}

      {history && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setHistory(null)}>
          <div className="w-full max-w-[420px] rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">Riwayat: {history.name}</h3>
              <button onClick={() => setHistory(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-600" aria-label="Tutup">
                <Icon name="close" size={16} />
              </button>
            </div>
            <ul className="max-h-80 space-y-1 overflow-auto text-sm pretty-scroll">
              {allTx.filter((t) => t.customerName === history.name).map((t) => (
                <li key={t.id} className="flex justify-between border-b border-black/5 py-2">
                  <span className="font-mono text-xs text-gray-600">
                    {t.number}
                    <br />
                    <span className="text-xs text-gray-600">{new Date(t.createdAt).toLocaleDateString("id-ID")}</span>
                  </span>
                  <span className="font-semibold tnum text-ink">{formatRupiah(t.total)}</span>
                </li>
              ))}
              {allTx.filter((t) => t.customerName === history.name).length === 0 && (
                <li className="py-4 text-center text-gray-600">Belum ada transaksi.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
