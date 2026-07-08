"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useData } from "@/store/data";
import { formatRupiah, BASE_URL, type Product } from "@/lib/dummy";
import ProductForm from "@/components/ProductForm";
import CategoryManager from "@/components/CategoryManager";

export default function ProductsPage() {
  const { products, categories, deleteProduct } = useData();
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const filtered = cat === "all" ? products : products.filter((p) => p.categoryId === cat);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produk</h1>
        <div className="flex gap-2">
          <button onClick={() => setCatOpen(true)} className="rounded-lg bg-beige px-3 py-2 text-sm">
            Kategori
          </button>
          <button onClick={() => setAdding(true)} className="rounded-lg bg-apricot px-3 py-2 text-sm font-bold text-white">
            + Produk
          </button>
        </div>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar">
        <button onClick={() => setCat("all")} className={`rounded-full px-3 py-1 text-sm ${cat === "all" ? "bg-olive text-beige" : "bg-white"}`}>Semua</button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} className={`rounded-full px-3 py-1 text-sm ${cat === c.id ? "bg-olive text-beige" : "bg-white"}`}>{c.name}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-4 shadow">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold">{p.name}</div>
                <div className="text-xs text-gray-500">{p.sku} · {catName(p.categoryId)} · {p.fabric}</div>
                <div className="mt-1">
                  {!p.active && <span className="rounded bg-gray-200 px-1.5 text-xs text-gray-600">Nonaktif</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setQr(p.sku)} className="rounded bg-beige px-2 py-1 text-xs">Label QR</button>
                <button onClick={() => setEditing(p)} className="rounded bg-apricot px-2 py-1 text-xs text-white">Edit</button>
                <button onClick={() => setToDelete(p)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">Hapus</button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {p.variants.map((v) => (
                <div key={v.id} className="rounded-lg border p-2 text-sm">
                  <div className="font-medium">{v.size} · {v.color}</div>
                  <div className="text-gray-500">{formatRupiah(v.sellingPrice)}</div>
                  <div className={v.stock === 0 ? "text-red-600 font-bold" : v.stock <= 5 ? "text-amber-600" : "text-gray-500"}>Stok: {v.stock}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(adding || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-full w-[640px] max-w-full overflow-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">{editing ? "Edit Produk" : "Tambah Produk"}</h3>
              <button onClick={() => { setAdding(false); setEditing(null); }} className="text-gray-400">✕</button>
            </div>
            <ProductForm product={editing ?? undefined} onSaved={() => { setAdding(false); setEditing(null); }} />
          </div>
        </div>
      )}

      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[360px] rounded-xl bg-white p-5 text-center shadow-xl">
            <p className="mb-3">Hapus produk <b>{toDelete.name}</b>?</p>
            <div className="flex gap-2">
              <button onClick={() => setToDelete(null)} className="flex-1 rounded-lg bg-gray-200 py-2">Batal</button>
              <button onClick={() => { deleteProduct(toDelete.id); setToDelete(null); }} className="flex-1 rounded-lg bg-red-600 py-2 text-white">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {qr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[320px] rounded-xl bg-white p-5 text-center shadow-xl">
            <h3 className="mb-2 font-bold">Label QR — {qr}</h3>
            <div className="flex justify-center rounded-lg border p-3">
              <QRCodeSVG value={`${BASE_URL}/product/${qr}`} size={180} level="H" />
            </div>
            <p className="mt-2 text-xs text-gray-500">{BASE_URL}/product/{qr}</p>
            <button onClick={() => setQr(null)} className="mt-3 w-full rounded-lg bg-gray-200 px-3 py-2 text-sm">Tutup</button>
          </div>
        </div>
      )}

      {catOpen && <CategoryManager onClose={() => setCatOpen(false)} />}
    </div>
  );
}
