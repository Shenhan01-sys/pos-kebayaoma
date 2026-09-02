"use client";

import { useState } from "react";
import { useData } from "@/store/data";
import { useAuth } from "@/store/auth";
import { useSettings } from "@/store/settings";
import { Icon } from "@/components/icons";

type Reason = "Rusak/Hilang" | "Penyesuaian" | "Stok Opname" | "Lainnya";

export default function InventoryPage() {
  const { products, movements, adjustStock } = useData();
  const auth = useAuth();
  const s = useSettings();
  const cashierName = auth.staff?.name ?? s.cashierName;
  const [stockOpen, setStockOpen] = useState<{ productId: string; productName: string; sku: string; current: number } | null>(null);
  const [mode, setMode] = useState<"in" | "out">("in");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState<Reason>("Penyesuaian");
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"stock" | "log">("stock");

  const active = products.filter((p) => p.active);
  const low = active.filter((p) => p.stock <= 5);

  function openStock(productId: string, productName: string, sku: string, current: number) {
    setStockOpen({ productId, productName, sku, current });
    setMode("in");
    setQty(1);
    setReason("Penyesuaian");
    setNote("");
  }
  function apply() {
    if (!stockOpen || qty <= 0) return;
    const delta = mode === "in" ? qty : -qty;
    const type = mode === "in" ? "restock" : "adjustment";
    adjustStock(stockOpen.productId, delta, type, cashierName, reason, note);
    setStockOpen(null);
  }
  const newStock = stockOpen ? Math.max(0, stockOpen.current + (mode === "in" ? qty : -qty)) : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Inventori & Stok</h1>
        <div className="seg">
          <button onClick={() => setTab("stock")} className={`seg-item ${tab === "stock" ? "seg-item-active" : ""}`}>Stok</button>
          <button onClick={() => setTab("log")} className={`seg-item ${tab === "log" ? "seg-item-active" : ""}`}>Riwayat</button>
        </div>
      </div>

      {tab === "stock" && (
        <>
          <div className="mb-3 flex items-center gap-2 rounded-2xl bg-warning/10 px-3 py-2.5 text-sm font-medium text-warning">
            <Icon name="alert" size={16} /> {low.length} produk stok menipis (≤5)
          </div>
          <div className="card overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-beige/70 text-left text-olive">
                <tr>
                  <th className="p-3 font-semibold">Produk</th>
                  <th className="p-3 text-center font-semibold">Series</th>
                  <th className="p-3 text-right font-semibold">Stok</th>
                  <th className="p-3 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {active.map((p) => (
                  <tr key={p.id} className="border-t border-black/5 hover:bg-beige/40">
                    <td className="p-3 font-medium text-ink">{p.name}</td>
                    <td className="p-3 text-center text-xs text-gray-600">{p.variants.length}</td>
                    <td className={`p-3 text-right font-bold tnum ${p.stock === 0 ? "text-danger" : p.stock <= 5 ? "text-warning" : ""}`}>{p.stock}</td>
                    <td className="p-3">
                      <button onClick={() => openStock(p.id, p.name, p.sku, p.stock)} className="btn-primary px-2.5 py-1 text-xs">
                        Restock / Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "log" && (
        <div className="card overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-beige/70 text-left text-olive">
              <tr>
                <th className="p-3 font-semibold">Waktu</th>
                <th className="p-3 font-semibold">Produk</th>
                <th className="p-3 font-semibold">Tipe</th>
                <th className="p-3 text-right font-semibold">Qty</th>
                <th className="p-3 font-semibold">Alasan</th>
                <th className="p-3 font-semibold">Staff</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 && (
                <tr><td className="p-4 text-center text-gray-600" colSpan={6}>Belum ada pergerakan stok.</td></tr>
              )}
              {movements.map((m) => (
                <tr key={m.id} className="border-t border-black/5">
                  <td className="p-3 text-xs text-gray-600">{new Date(m.createdAt).toLocaleString("id-ID")}</td>
                  <td className="p-3 font-medium text-ink">{m.productName} <span className="text-gray-600">({m.sku})</span></td>
                  <td className="p-3"><span className="pill-muted">{m.type}</span></td>
                  <td className={`p-3 text-right font-bold tnum ${m.quantity < 0 ? "text-danger" : "text-success"}`}>{m.quantity > 0 ? "+" : ""}{m.quantity}</td>
                  <td className="p-3">{m.reason ?? "—"}</td>
                  <td className="p-3">{m.staff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stockOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-[380px] rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
            <h3 className="mb-1 text-lg font-bold text-ink">Stok: {stockOpen.productName}</h3>
            <p className="mb-4 text-xs text-gray-600">{stockOpen.sku} · stok saat ini: <span className="font-bold text-ink">{stockOpen.current}</span></p>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("in")}
                className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 transition ${
                  mode === "in" ? "border-success bg-success/10 text-success" : "border-black/10 text-gray-600"
                }`}
              >
                <Icon name="plus" size={20} />
                <span className="text-sm font-bold">Tambah Stok</span>
              </button>
              <button
                onClick={() => setMode("out")}
                className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 transition ${
                  mode === "out" ? "border-danger bg-danger/10 text-danger" : "border-black/10 text-gray-600"
                }`}
              >
                <Icon name="minus" size={20} />
                <span className="text-sm font-bold">Kurangi Stok</span>
              </button>
            </div>

            <label className="mb-1.5 block text-sm text-olive">Jumlah</label>
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-beige text-lg font-bold text-ink shadow-soft transition active:scale-95"
              >
                <Icon name="minus" size={18} />
              </button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="input flex-1 text-center text-xl font-bold tnum"
              />
              <button
                onClick={() => setQty((q) => q + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-beige text-lg font-bold text-ink shadow-soft transition active:scale-95"
              >
                <Icon name="plus" size={18} />
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-2xl bg-beige/60 px-3 py-2.5 text-sm">
              <span className="text-gray-600">Stok setelah penyesuaian</span>
              <span className={`font-extrabold tnum ${newStock === 0 ? "text-danger" : "text-ink"}`}>{newStock}</span>
            </div>

            <label className="mb-1 block text-sm text-olive">Alasan</label>
            <select value={reason} onChange={(e) => setReason(e.target.value as Reason)} className="input mb-2">
              <option>Rusak/Hilang</option>
              <option>Penyesuaian</option>
              <option>Stok Opname</option>
              <option>Lainnya</option>
            </select>
            <label className="mb-1 block text-sm text-olive">Catatan</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="input mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setStockOpen(null)} className="btn-ghost flex-1">Batal</button>
              <button onClick={apply} disabled={qty <= 0} className="btn-violet flex-1 disabled:opacity-40">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
