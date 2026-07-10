"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useData } from "@/store/data";
import { formatRupiah, BASE_URL, type Product } from "@/lib/dummy";
import ProductForm from "@/components/ProductForm";
import CategoryManager from "@/components/CategoryManager";
import { Icon } from "@/components/icons";

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Produk</h1>
        <div className="flex gap-2">
          <button onClick={() => setCatOpen(true)} className="btn-ghost">
            <Icon name="tag" size={16} /> Kategori
          </button>
          <button onClick={() => setAdding(true)} className="btn-primary">
            <Icon name="plus" size={16} /> Produk
          </button>
        </div>
      </div>

      <div className="seg mb-4 w-full overflow-x-auto no-scrollbar">
        <button onClick={() => setCat("all")} className={`seg-item whitespace-nowrap ${cat === "all" ? "seg-item-active" : ""}`}>Semua</button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} className={`seg-item whitespace-nowrap ${cat === c.id ? "seg-item-active" : ""}`}>{c.name}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((p) => (
          <div key={p.id} className="card card-pad">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-bold text-ink">
                  <span className="truncate">{p.name}</span>
                  {!p.active && <span className="pill-muted">Nonaktif</span>}
                </div>
                <div className="text-xs text-gray-600">{p.sku} · {catName(p.categoryId)} · {p.fabric}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => setQr(p.sku)} className="btn-ghost px-2.5 py-1 text-xs">Label QR</button>
                <button onClick={() => setEditing(p)} className="btn-primary px-2.5 py-1 text-xs">Edit</button>
                <button onClick={() => setToDelete(p)} className="btn-danger px-2.5 py-1 text-xs">Hapus</button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {p.variants.map((v) => (
                <div key={v.id} className="rounded-2xl border border-black/5 bg-beige/50 p-2.5 text-sm">
                  <div className="font-medium text-ink">{v.size} · {v.color}</div>
                  <div className="text-gray-600 tnum">{formatRupiah(v.sellingPrice)}</div>
                  <div className={v.stock === 0 ? "font-bold text-danger" : v.stock <= 5 ? "text-warning" : "text-gray-600"}>
                    Stok: {v.stock}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(adding || editing) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-full w-full max-w-[640px] overflow-auto rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">{editing ? "Edit Produk" : "Tambah Produk"}</h3>
              <button onClick={() => { setAdding(false); setEditing(null); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-600">
                <Icon name="close" size={16} />
              </button>
            </div>
            <ProductForm product={editing ?? undefined} onSaved={() => { setAdding(false); setEditing(null); }} />
          </div>
        </div>
      )}

      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-[360px] rounded-t-4xl bg-white p-5 text-center shadow-soft-xl sm:rounded-3xl">
            <p className="mb-4 text-ink">Hapus produk <b>{toDelete.name}</b>?</p>
            <div className="flex gap-2">
              <button onClick={() => setToDelete(null)} className="btn-ghost flex-1">Batal</button>
              <button onClick={() => { deleteProduct(toDelete.id); setToDelete(null); }} className="btn-danger flex-1">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {qr && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-[360px] rounded-t-4xl bg-white p-5 text-center shadow-soft-xl sm:rounded-3xl">
            <h3 className="mb-3 font-bold text-ink">Label QR — {qr}</h3>
            <div className="flex justify-center rounded-2xl border border-black/5 bg-beige/50 p-3">
              <QRCodeSVG value={`${BASE_URL}/product/${qr}`} size={180} level="H" />
            </div>
            <p className="mt-2 text-xs text-gray-600">{BASE_URL}/product/{qr}</p>
            <button onClick={() => setQr(null)} className="btn-ghost mt-4 w-full">Tutup</button>
          </div>
        </div>
      )}

      {catOpen && <CategoryManager onClose={() => setCatOpen(false)} />}
    </div>
  );
}
