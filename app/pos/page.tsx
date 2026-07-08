"use client";

import { useState } from "react";
import { formatRupiah, type Product, type Variant } from "@/lib/dummy";
import { useCart } from "@/store/cart";
import { useData } from "@/store/data";
import CheckoutModal from "@/components/CheckoutModal";

export default function PosPage() {
  const [cat, setCat] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [picker, setPicker] = useState<Product | null>(null);
  const [checkout, setCheckout] = useState(false);
  const { lines, addVariant, inc, dec, remove, total, customerName, setCustomer } =
    useCart();
  const { products, categories, customers } = useData();

  const filtered = products
    .filter((p) => (cat === "all" ? true : p.categoryId === cat))
    .filter((p) =>
      query
        ? p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.sku.toLowerCase().includes(query.toLowerCase()) ||
          p.tags.some((t) => t.includes(query.toLowerCase()))
        : true
    );

  return (
    <div className="flex h-full gap-4">
      {/* Catalog */}
      <section className="flex-1 flex flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama / SKU / tag…"
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={customerName ?? ""}
            onChange={(e) => setCustomer(e.target.value || null)}
            className="rounded-lg border px-2 py-2 text-sm"
          >
            <option value="">Pelanggan: Umum</option>
            {customers.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setCat("all")}
            className={`rounded-full px-3 py-1 text-sm ${
              cat === "all" ? "bg-olive text-beige" : "bg-white"
            }`}
          >
            Semua
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`rounded-full px-3 py-1 text-sm ${
                cat === c.id ? "bg-olive text-beige" : "bg-white"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 overflow-auto content-start md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setPicker(p)}
              className="rounded-xl bg-white p-3 text-left shadow hover:ring-2 hover:ring-apricot"
            >
              <div
                className="mb-2 flex h-28 items-center justify-center rounded-lg text-white text-sm font-bold"
                style={{ background: "#775533" }}
              >
                {p.name}
              </div>
              <div className="text-sm font-semibold leading-tight">{p.name}</div>
              <div className="text-xs text-gray-500">
                {p.variants.length} varian
              </div>
              <div className="mt-1 text-sm font-bold text-olive">
                {formatRupiah(p.variants[0]?.sellingPrice ?? 0)}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400">Tidak ada produk.</p>
          )}
        </div>
      </section>

      {/* Cart */}
      <aside className="flex w-80 shrink-0 flex-col rounded-xl bg-white p-3 shadow">
        <h2 className="mb-2 text-lg font-bold">Keranjang</h2>
        <div className="flex-1 space-y-2 overflow-auto">
          {lines.length === 0 && (
            <p className="text-sm text-gray-400">Belum ada item.</p>
          )}
          {lines.map((l) => (
            <div key={l.key} className="rounded-lg border p-2">
              <div className="flex justify-between text-sm font-medium">
                <span>{l.name}</span>
                <button onClick={() => remove(l.key)} className="text-red-400">
                  ✕
                </button>
              </div>
              <div className="text-xs text-gray-500">
                {l.size} / {l.color}
              </div>
              <div className="mt-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => dec(l.key)}
                    className="h-6 w-6 rounded bg-beige"
                  >
                    −
                  </button>
                  <span className="w-6 text-center">{l.quantity}</span>
                  <button
                    onClick={() => inc(l.key)}
                    className="h-6 w-6 rounded bg-beige"
                  >
                    +
                  </button>
                </div>
                <span className="text-sm font-semibold">
                  {formatRupiah(l.unitPrice * l.quantity)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 border-t pt-2">
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-olive">{formatRupiah(total())}</span>
          </div>
          <button
            disabled={lines.length === 0}
            onClick={() => setCheckout(true)}
            className="mt-2 w-full rounded-lg bg-apricot px-3 py-3 font-bold text-white disabled:bg-gray-300"
          >
            Bayar
          </button>
        </div>
      </aside>

      {/* Variant picker */}
      {picker && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-[420px] max-w-full rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-bold">{picker.name}</h3>
              <button onClick={() => setPicker(null)} className="text-gray-400">
                ✕
              </button>
            </div>
            <p className="mb-3 text-xs text-gray-500">{picker.description}</p>
            <div className="space-y-2">
              {picker.variants.map((v: Variant) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border p-2"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {v.size} · {v.color}
                    </div>
                    <div className="text-xs text-gray-500">Stok: {v.stock}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {formatRupiah(v.sellingPrice)}
                    </span>
                    <button
                      disabled={v.stock === 0}
                      onClick={() => {
                        addVariant(picker, v);
                      }}
                      className="rounded-lg bg-apricot px-3 py-1 text-sm text-white disabled:bg-gray-300"
                    >
                      {v.stock === 0 ? "Habis" : "+ Keranjang"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {checkout && <CheckoutModal onClose={() => setCheckout(false)} />}
    </div>
  );
}
