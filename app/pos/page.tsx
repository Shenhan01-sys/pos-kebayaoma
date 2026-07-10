"use client";

import { useState } from "react";
import { formatRupiah, type Product, type Variant } from "@/lib/dummy";
import { useCart } from "@/store/cart";
import { useData } from "@/store/data";
import CheckoutModal from "@/components/CheckoutModal";
import { Icon } from "@/components/icons";

const thumbStyle: Record<string, { grad: string; emoji: string }> = {
  "cat-kebaya": { grad: "bg-apricot", emoji: "👗" },
  "cat-batik": { grad: "bg-olive", emoji: "🧵" },
  "cat-accessories": { grad: "bg-violet", emoji: "💫" },
};

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
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-2.5rem)] lg:flex-row">
      {/* Catalog */}
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1">
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama / SKU / tag…"
              className="input pl-10"
            />
          </div>
          <select
            value={customerName ?? ""}
            onChange={(e) => setCustomer(e.target.value || null)}
            className="input w-auto"
          >
            <option value="">Pelanggan: Umum</option>
            {customers.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category segmented filter */}
        <div className="seg mb-3 w-full overflow-x-auto no-scrollbar">
          <button
            onClick={() => setCat("all")}
            className={`seg-item whitespace-nowrap ${cat === "all" ? "seg-item-active" : ""}`}
          >
            Semua
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`seg-item whitespace-nowrap ${cat === c.id ? "seg-item-active" : ""}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-auto pretty-scroll sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setPicker(p)}
              className="group overflow-hidden rounded-3xl bg-white/90 text-left shadow-soft ring-1 ring-black/5 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-soft-lg"
            >
              <div
                className={`relative flex h-28 items-center justify-center overflow-hidden rounded-t-3xl text-white ${
                  thumbStyle[p.categoryId]?.grad ?? "bg-olive"
                }`}
              >
                <span className="pointer-events-none absolute -bottom-3 -right-2 text-5xl opacity-20">
                  {thumbStyle[p.categoryId]?.emoji ?? "👚"}
                </span>
                <span className="px-3 text-center text-sm font-bold drop-shadow">
                  {p.name}
                </span>
              </div>
              <div className="p-3">
                <div className="truncate text-sm font-semibold leading-tight text-ink">
                  {p.name}
                </div>
                <div className="text-xs text-gray-600">
                  {p.variants.length} varian
                </div>
                <div className="mt-1.5 text-base font-extrabold text-olive tnum">
                  {formatRupiah(p.variants[0]?.sellingPrice ?? 0)}
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-sm text-gray-600">Tidak ada produk.</p>
          )}
        </div>
      </section>

      {/* Cart */}
      <aside className="flex w-full shrink-0 flex-col rounded-3xl bg-white/90 p-4 shadow-soft-lg ring-1 ring-black/5 backdrop-blur-md lg:w-80">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Keranjang</h2>
          {lines.length > 0 && <span className="pill-apricot">{lines.length}</span>}
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-auto pretty-scroll">
          {lines.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-gray-600">
              <Icon name="pos" size={36} className="text-custard" />
              <p className="mt-2 text-sm">Belum ada item di keranjang.</p>
            </div>
          )}
          {lines.map((l) => (
            <div key={l.key} className="rounded-2xl bg-beige/60 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold leading-tight text-ink">{l.name}</span>
                <button
                  onClick={() => remove(l.key)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/5 text-gray-600 transition hover:bg-danger/15 hover:text-danger"
                  aria-label="Hapus"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
              <div className="text-xs text-gray-600">
                {l.size} / {l.color}
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => dec(l.key)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink shadow-soft ring-1 ring-black/5 active:scale-90"
                    aria-label="Kurangi"
                  >
                    <Icon name="minus" size={14} />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tnum">{l.quantity}</span>
                  <button
                    onClick={() => inc(l.key)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink shadow-soft ring-1 ring-black/5 active:scale-90"
                    aria-label="Tambah"
                  >
                    <Icon name="plus" size={14} />
                  </button>
                </div>
                <span className="text-sm font-bold tnum text-olive">
                  {formatRupiah(l.unitPrice * l.quantity)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-black/5 pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-gray-600">Total</span>
            <span className="text-2xl font-extrabold text-olive tnum">
              {formatRupiah(total())}
            </span>
          </div>
          <button
            disabled={lines.length === 0}
            onClick={() => setCheckout(true)}
            className="btn-primary mt-3 w-full py-3 text-base"
          >
            <Icon name="cash" size={18} /> Bayar
          </button>
        </div>
      </aside>

      {/* Variant picker */}
      {picker && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-[440px] rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">{picker.name}</h3>
              <button
                onClick={() => setPicker(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-600"
                aria-label="Tutup"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <p className="mb-3 line-clamp-2 text-xs text-gray-600">{picker.description}</p>
            <div className="max-h-[55vh] space-y-2 overflow-auto pretty-scroll">
              {picker.variants.map((v: Variant) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-2xl bg-beige/60 p-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-ink">
                      {v.size} · {v.color}
                    </div>
                    <div className="text-xs text-gray-600">Stok: {v.stock}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-olive tnum">
                      {formatRupiah(v.sellingPrice)}
                    </span>
                    <button
                      disabled={v.stock === 0}
                      onClick={() => addVariant(picker, v)}
                      className="btn-primary px-3 py-1.5 text-sm"
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
