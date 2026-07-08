"use client";

import { useState } from "react";
import { useData } from "@/store/data";
import { formatRupiah } from "@/lib/dummy";

type Reason = "Rusak/Hilang" | "Penyesuaian" | "Stok Opname" | "Lainnya";

export default function InventoryPage() {
  const { products, movements, adjustStock } = useData();
  const [stockOpen, setStockOpen] = useState<{ productName: string; variantId: string; sku: string; current: number } | null>(null);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<Reason>("Penyesuaian");
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"stock" | "log">("stock");

  const allVariants = products.flatMap((p) =>
    p.variants.map((v) => ({ product: p, v }))
  );
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventori & Stok</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab("stock")} className={`rounded-lg px-3 py-1 text-sm ${tab === "stock" ? "bg-olive text-beige" : "bg-white"}`}>Stok</button>
          <button onClick={() => setTab("log")} className={`rounded-lg px-3 py-1 text-sm ${tab === "log" ? "bg-olive text-beige" : "bg-white"}`}>Riwayat</button>
        </div>
      </div>

      {tab === "stock" && (
        <>
          <div className="mb-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">
            {low.length} varian stok menipis (≤5)
          </div>
          <div className="overflow-auto rounded-xl bg-white shadow">
            <table className="w-full text-sm">
              <thead className="bg-beige text-left text-olive">
                <tr>
                  <th className="p-3">Produk</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Ukuran/Warna</th>
                  <th className="p-3 text-right">Modal</th>
                  <th className="p-3 text-right">Harga</th>
                  <th className="p-3 text-right">Stok</th>
                  <th className="p-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {allVariants.map(({ product, v }) => (
                  <tr key={v.id} className="border-t hover:bg-beige/40">
                    <td className="p-3">{product.name}</td>
                    <td className="p-3 text-xs text-gray-500">{v.sku}</td>
                    <td className="p-3">{v.size} / {v.color}</td>
                    <td className="p-3 text-right">{formatRupiah(v.costPrice)}</td>
                    <td className="p-3 text-right">{formatRupiah(v.sellingPrice)}</td>
                    <td className={`p-3 text-right font-bold ${v.stock === 0 ? "text-red-600" : v.stock <= 5 ? "text-amber-600" : ""}`}>{v.stock}</td>
                    <td className="p-3">
                      <button onClick={() => openStock(product.name, v.id, v.sku, v.stock)} className="rounded bg-apricot px-2 py-1 text-xs text-white">
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
        <div className="overflow-auto rounded-xl bg-white shadow">
          <table className="w-full text-sm">
            <thead className="bg-beige text-left text-olive">
              <tr>
                <th className="p-3">Waktu</th>
                <th className="p-3">Produk</th>
                <th className="p-3">Tipe</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3">Alasan</th>
                <th className="p-3">Staff</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 && (
                <tr><td className="p-3 text-gray-400" colSpan={6}>Belum ada pergerakan stok.</td></tr>
              )}
              {movements.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-3 text-xs">{new Date(m.createdAt).toLocaleString("id-ID")}</td>
                  <td className="p-3">{m.productName} <span className="text-gray-400">({m.sku})</span></td>
                  <td className="p-3">{m.type}</td>
                  <td className={`p-3 text-right font-bold ${m.quantity < 0 ? "text-red-600" : "text-green-700"}`}>{m.quantity > 0 ? "+" : ""}{m.quantity}</td>
                  <td className="p-3">{m.reason ?? "—"}</td>
                  <td className="p-3">{m.staff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[380px] max-w-full rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-1 text-lg font-bold">Stok: {stockOpen.productName}</h3>
            <p className="mb-3 text-xs text-gray-500">{stockOpen.sku} · stok saat ini: {stockOpen.current}</p>
            <label className="block text-sm text-olive">Jumlah (+ masuk / − keluar)</label>
            <input type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} className="inp mb-2" />
            <label className="block text-sm text-olive">Alasan</label>
            <select value={reason} onChange={(e) => setReason(e.target.value as Reason)} className="inp mb-2">
              <option>Rusak/Hilang</option>
              <option>Penyesuaian</option>
              <option>Stok Opname</option>
              <option>Lainnya</option>
            </select>
            <label className="block text-sm text-olive">Catatan</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="inp mb-3" />
            <div className="flex gap-2">
              <button onClick={() => setStockOpen(null)} className="flex-1 rounded-lg bg-gray-200 py-2">Batal</button>
              <button onClick={apply} className="flex-1 rounded-lg bg-olive py-2 text-beige">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
