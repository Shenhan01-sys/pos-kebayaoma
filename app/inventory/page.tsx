"use client";

import { useState } from "react";
import { useData } from "@/store/data";
import { formatRupiah } from "@/lib/dummy";
import { Icon } from "@/components/icons";

type Reason = "Rusak/Hilang" | "Penyesuaian" | "Stok Opname" | "Lainnya";

export default function InventoryPage() {
  const { products, movements, adjustStock } = useData();
  const [stockOpen, setStockOpen] = useState<{ productName: string; variantId: string; sku: string; current: number } | null>(null);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<Reason>("Penyesuaian");
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"stock" | "log">("stock");

  const allVariants = products.flatMap((p) => p.variants.map((v) => ({ product: p, v })));
  const low = allVariants.filter((x) => x.v.stock <= 5);

  function openStock(productName: string, variantId: string, sku: string, current: number) {
    setStockOpen({ productName, variantId, sku, current });
    setDelta(0);
    setReason("Penyesuaian");
    setNote("");
  }
  function apply() {
    if (!stockOpen || delta === 0) return;
    const type = delta > 0 ? "restock" : "adjustment";
    adjustStock(stockOpen.variantId, delta, type, "Ani", reason, note);
    setStockOpen(null);
  }

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
            <Icon name="alert" size={16} /> {low.length} varian stok menipis (≤5)
          </div>
          <div className="card overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-beige/70 text-left text-olive">
                <tr>
                  <th className="p-3 font-semibold">Produk</th>
                  <th className="p-3 font-semibold">SKU</th>
                  <th className="p-3 font-semibold">Ukuran/Warna</th>
                  <th className="p-3 text-right font-semibold">Modal</th>
                  <th className="p-3 text-right font-semibold">Harga</th>
                  <th className="p-3 text-right font-semibold">Stok</th>
                  <th className="p-3 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {allVariants.map(({ product, v }) => (
                  <tr key={v.id} className="border-t border-black/5 hover:bg-beige/40">
                    <td className="p-3 font-medium text-ink">{product.name}</td>
                    <td className="p-3 text-xs text-gray-600">{v.sku}</td>
                    <td className="p-3">{v.size} / {v.color}</td>
                    <td className="p-3 text-right tnum">{formatRupiah(v.costPrice)}</td>
                    <td className="p-3 text-right tnum">{formatRupiah(v.sellingPrice)}</td>
                    <td className={`p-3 text-right font-bold tnum ${v.stock === 0 ? "text-danger" : v.stock <= 5 ? "text-warning" : ""}`}>{v.stock}</td>
                    <td className="p-3">
                      <button onClick={() => openStock(product.name, v.id, v.sku, v.stock)} className="btn-primary px-2.5 py-1 text-xs">
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
            <p className="mb-3 text-xs text-gray-600">{stockOpen.sku} · stok saat ini: {stockOpen.current}</p>
            <label className="mb-1 block text-sm text-olive">Jumlah (+ masuk / − keluar)</label>
            <input type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} className="input mb-2" />
            <label className="mb-1 block text-sm text-olive">Alasan</label>
            <select value={reason} onChange={(e) => setReason(e.target.value as Reason)} className="input mb-2">
              <option>Rusak/Hilang</option>
              <option>Penyesuaian</option>
              <option>Stok Opname</option>
              <option>Lainnya</option>
            </select>
            <label className="mb-1 block text-sm text-olive">Catatan</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="input mb-3" />
            <div className="flex gap-2">
              <button onClick={() => setStockOpen(null)} className="btn-ghost flex-1">Batal</button>
              <button onClick={apply} className="btn-violet flex-1">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
